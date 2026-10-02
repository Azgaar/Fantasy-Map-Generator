import { markAssistantOpen } from "@/components/assistant-bubble";
import { Controllers } from "@/controllers";
import { askServer } from "@/services/assistant/azgaar-server/answerer";
import {
  AzgaarServerError,
  getLimits,
  isOfficial,
  type Limits,
  sendFeedback,
  signIn,
  signOut
} from "@/services/assistant/azgaar-server/api";
import { getToken } from "@/services/assistant/azgaar-server/auth";
import {
  append,
  type Chat,
  canContinue,
  create,
  current,
  isLong,
  list,
  load,
  remove,
  select,
  type Tier,
  type TranscriptItem,
  touch
} from "@/services/assistant/chats";
import { askProvider } from "@/services/assistant/provider/answerer";
import * as Connection from "@/services/assistant/provider/connection";
import { listModels } from "@/services/assistant/provider/models";
import { DEFAULT_PROVIDER, PROVIDERS, type ProviderSpec, providerById } from "@/services/assistant/provider/providers";
import { renderMarkdown } from "@/utils/markdown";
import { capitalize, errorText, escapeHtml } from "@/utils/stringUtils";
import { si } from "@/utils/unitUtils";
import { ensureEl } from "../../utils";
import { AssistantMap } from "./map";
import { proposalHtml } from "./proposal-card";
import { Proposals } from "./proposals";
import { AssistantWidgets, type WidgetContext } from "./widgets";

type View = "chat" | "chats" | "key";
type Notice = { text: string; item?: TranscriptItem; retry?: () => void };

const dialogId = "assistant";
const MAX_QUESTION_LENGTH = 1000;
const POLICY = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Policy";
const DISCORD = "https://discordapp.com/invite/X7E84HU";
const PATREON = "https://www.patreon.com/azgaar";

let chat: Chat | undefined;
let view: View = "chat";
let busy = false;
let abort: AbortController | null = null;
let limits: Limits | null = null;
let notice: Notice | null = null;
let initialized = false;
let openMap = 0; // the map id last seen: reloading the same map keeps the selected chat
let observedTier: Tier = null;
let noteLabel: string | null = null;
let answerStatus = "Thinking";
let discoveryTimer: ReturnType<typeof setTimeout> | null = null;
let discoveryId = 0;

const tier = (): Tier => {
  if (Connection.isConnected()) return "key";
  if (!isOfficial()) return null;
  return getToken() ? "member" : "guest";
};
const tokens = (entry?: Chat) => (entry ? entry.usage.input + entry.usage.output + entry.usage.cached : 0);
/** The chat takes questions: it has the current tier's answerer and its map is open */
const writable = (entry: Chat | undefined): entry is Chat =>
  Boolean(entry && canContinue(entry, tier(), AssistantMap.id()));

// Built once and hidden on close, unlike other dialogs: an answer in flight, the draft and the scroll survive,
// so only open() and events that can fire before it check that the dialog exists
const isBuilt = () => document.getElementById(dialogId) !== null;
let showing = false;
let unseen = false; // the transcript changed while hidden, so reopen at its end
const el = <T extends HTMLElement = HTMLElement>(id: string): T => ensureEl<T>(id);

function toggle(): void {
  if (showing) $(`#${dialogId}`).dialog("close");
  else open();
}

function open(): void {
  if (!isBuilt()) {
    showing = true;
    build();
  } else {
    $(`#${dialogId}`).dialog(showing ? "moveToTop" : "open");
    if (!showing) {
      showing = true;
      render(!unseen); // sign-in and proposal availability may have changed while hidden
      unseen = false;
    }
    void refreshContextChip();
  }
  markAssistantOpen(true);
}

function build(): void {
  view = "chat";
  renderDialog();
  $(`#${dialogId}`).dialog({
    title: "Azgaar Assistant",
    position: { my: "right bottom", at: "right-16 bottom-44", of: window },
    width: Math.min(340, window.innerWidth - 24),
    height: Math.min(580, window.innerHeight - 140),
    minWidth: 300,
    minHeight: 320,
    resizable: true,
    close: closeAssistant
  });
  addChatsButton();
  void initialize();
}

function closeAssistant(): void {
  showing = false;
  markAssistantOpen(false);
  AssistantWidgets.clearMarks();
}

const STYLES = /* html */ `
  <style>
    #assistant.ui-dialog-content { display: flex; flex-direction: column; gap: .5em; overflow: hidden; padding: .6em .7em .5em; font-family: var(--sans-serif); }
    #assistant > * { width: auto; }
    #assistant [hidden] { display: none !important; }
    #assistant button { cursor: pointer; font: inherit; }
    #assistant button:disabled { cursor: default; opacity: .5; }
    #assistant pre, #assistant code { font-family: var(--monospace); }
    .ui-dialog .ui-dialog-titlebar #assistantOpenChats { font-size: .62em; }

    #assistantTranscript, #assistantChats, #assistantKey { flex: 1; min-height: 0; overflow: hidden auto; padding-right: .2em; line-height: 1.45; }

    #assistant .assistantItem { max-width: 92%; margin: 0 0 .7em; overflow-wrap: anywhere; }
    #assistant .assistantItem > :first-child { margin-top: 0; }
    #assistant .assistantItem > :last-child { margin-bottom: 0; }
    #assistant .assistantItem p { margin: .45em 0; }
    #assistant .assistantItem :is(h1, h2, h3, h4, h5, h6) { margin: .7em 0 .3em; font-size: 1em; }
    #assistant .assistantItem :is(ol, ul) { margin: .45em 0; padding-left: 1.3em; }
    #assistant .assistantItem pre { overflow: auto; max-height: 14em; margin: .45em 0; padding: .4em .55em; border-radius: .3em; background: rgb(0 0 0 / 6%); white-space: pre-wrap; }
    #assistant .assistantItem table { display: block; overflow-x: auto; margin: .45em 0; border-collapse: collapse; font-size: .92em; }
    #assistant .assistantItem :is(td, th) { padding: .2em .5em; border: 1px solid rgb(0 0 0 / 14%); }
    #assistant .assistantItem th { background: rgb(0 0 0 / 5%); }

    #assistant .assistantQuestion { width: fit-content; margin-left: auto; padding: .45em .7em; border-radius: .8em .8em .2em .8em; background: var(--header); color: #fff; white-space: pre-wrap; }
    #assistant .assistantAnswer { padding: .1em .1em 0; }
    #assistant .assistantWelcome { padding: .6em .75em; border-radius: .5em; background: rgb(0 0 0 / 5%); }

    #assistant .assistantStep { width: fit-content; margin: 0 0 .5em; font-size: .9em; opacity: .75; }
    #assistant .assistantStep summary { cursor: pointer; }
    #assistant .assistantStep.failed summary { color: #a3262e; }
    #assistant .assistantProposal { width: 100%; overflow: hidden; border: 1px solid rgb(0 0 0 / 14%); border-radius: .55em; background: rgb(255 255 255 / 60%); }
    #assistant .assistantProposalHeader { display: flex; align-items: center; gap: .55em; padding: .5em .7em; border-bottom: 1px solid rgb(0 0 0 / 8%); background: rgb(0 0 0 / 3%); }
    #assistant .assistantProposalState { flex: none; padding: .1em .55em; border-radius: 1em; background: var(--header); color: #fff; font-size: .72em; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; }
    #assistant .assistantProposal.applied .assistantProposalState { background: #3d7a3a; }
    #assistant .assistantProposal:is(.undone, .discarded) .assistantProposalState { background: rgb(0 0 0 / 40%); }
    #assistant .assistantProposalSummary { flex: 1; font-weight: 600; }
    #assistant .assistantProposalHeader .assistantButton { flex: none; padding: .1em .6em; font-size: .9em; }
    #assistant .assistantProposalBody { display: grid; gap: .55em; padding: .55em .7em; }
    #assistant details.assistantProposalBody:not([open]) { padding-block: .35em; }
    #assistant .assistantProposalBody > summary { cursor: pointer; opacity: .7; font-size: .9em; }
    #assistant .assistantChangeName { display: flex; align-items: center; gap: .35em; margin-bottom: .1em; font-weight: 600; }
    #assistant .assistantChangeName > svg { flex: none; }
    #assistant .assistantChangeTag { margin-left: auto; padding: 0 .5em; border-radius: 1em; font-size: .75em; font-weight: 600; }
    #assistant .assistantChangeTag.add { background: rgb(61 122 58 / 15%); color: #2f6a2c; }
    #assistant .assistantChangeTag.remove { background: rgb(160 40 40 / 12%); color: #8a2a2a; }
    #assistant .assistantChangeField { display: grid; grid-template-columns: 5.5em minmax(0, 1fr); gap: 0 .6em; padding-left: .6em; font-size: .92em; }
    #assistant .assistantChangeField > span:first-child { opacity: .6; }
    #assistant .assistantChangeField del { opacity: .55; }
    #assistant .assistantChangeField i { margin: 0 .35em; font-style: normal; opacity: .45; }
    #assistant .assistantChangeField ins { font-weight: 600; text-decoration: none; }
    #assistant .assistantChangeField em { opacity: .6; }
    #assistant .assistantChangeMore { opacity: .6; font-size: .9em; }
    #assistant .assistantNotePreview { grid-column: 1 / -1; max-height: 10em; overflow: auto; margin-top: .35em; padding: .35em .6em; border-radius: .35em; background: rgb(0 0 0 / 4%); }
    #assistant .assistantNotePreview p { margin: .3em 0; }
    #assistant .assistantChangeEntity > .assistantNotePreview { margin: .15em 0 0 .6em; font-size: .92em; }
    #assistant .assistantProposalFooter { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .4em; padding: .4em .7em; border-top: 1px solid rgb(0 0 0 / 8%); }
    #assistant .assistantProposalFooter > span:first-child { opacity: .6; font-size: .88em; }
    #assistant .assistantProposalActions { display: flex; gap: .4em; }
    #assistant :is(.assistantEntity, .assistantCommand) { padding: 0; border: 0; background: none; color: inherit; }
    #assistant .assistantEntity { text-decoration-line: underline; text-decoration-style: dotted; text-underline-offset: 2px; }
    #assistant .assistantEntity:hover { color: var(--header-active); }
    #assistant .assistantEntity > span { display: inline-block; margin-right: .35em; opacity: .55; font-size: .9em; }
    #assistant .assistantEntity > .assistantGood { width: 1.2em; height: 1.2em; margin-right: .3em; vertical-align: -.25em; }
    #assistant .assistantCommand { padding: 0 .4em; border: 1px solid var(--header); border-radius: .35em; }
    #assistant .assistantCommand:hover { background: rgb(0 0 0 / 5%); }
    #assistant .assistantWidget { width: 100%; overflow: hidden; border: 1px solid rgb(0 0 0 / 14%); border-radius: .55em; background: rgb(255 255 255 / 60%); }
    #assistant .assistantWidgetHeader { display: flex; align-items: center; justify-content: space-between; gap: .55em; padding: .4em .7em; border-bottom: 1px solid rgb(0 0 0 / 8%); background: rgb(0 0 0 / 3%); font-weight: 600; }
    #assistant .assistantWidgetHeader .assistantButton { flex: none; padding: .1em .6em; font-size: .9em; font-weight: normal; }
    #assistant .assistantWidgetHeader .assistantButton[aria-pressed="true"] { background: var(--header); color: #fff; }
    #assistant .assistantWidgetNote { padding: .3em .7em 0; opacity: .6; font-size: .9em; }
    #assistant .assistantWidget ul { max-height: 16em; overflow-y: auto; margin: 0; padding: .35em .7em; list-style: none; }
    #assistant .assistantWidget li { display: flex; align-items: baseline; gap: .4em; padding: .1em 0; }
    #assistant .assistantWidget li small { margin-left: auto; opacity: .6; text-align: right; }
    #assistant .assistantWidget li.gone { opacity: .5; }
    #assistant .assistantCard { padding: .6em .7em; }
    #assistant .assistantCardHead { display: flex; align-items: center; gap: .6em; }
    #assistant .assistantCardHead svg { flex: none; width: 3.6em; height: 3.6em; }
    #assistant .assistantCardHead strong { display: block; font-size: 1.05em; }
    #assistant .assistantCardHead small { opacity: .6; }
    #assistant .assistantCard dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: .15em .8em; margin: .55em 0 0; }
    #assistant .assistantCard dt { opacity: .6; }
    #assistant .assistantCard dd { margin: 0; }
    #assistant .assistantCardNote { margin: .5em 0 0; opacity: .8; font-size: .92em; }
    #assistant .assistantChart { display: grid; grid-template-columns: minmax(0, max-content) minmax(3em, 1fr) auto; align-items: center; gap: .25em .6em; padding: .45em .7em; }
    #assistant .assistantBar { display: contents; }
    #assistant .assistantBar > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #assistant .assistantBar > span:last-child { font-variant-numeric: tabular-nums; opacity: .75; text-align: right; }
    #assistant .assistantBarTrack { height: .75em; border-radius: .2em; background: rgb(0 0 0 / 6%); }
    #assistant .assistantBarTrack i { display: block; height: 100%; min-width: 1px; border-radius: .2em; background: var(--header); }
    #assistant .assistantPie { display: flex; align-items: center; gap: .8em; padding: .45em .7em; }
    #assistant .assistantPie svg { flex: none; width: 6.5em; height: 6.5em; }
    #assistant .assistantPie ul { flex: 1; padding: 0; }
    #assistant .assistantPie li i { flex: none; width: .75em; height: .75em; border-radius: .15em; }
    #assistant .assistantChoices { margin: 0; padding: .5em .7em; }
    #assistant .assistantChartCaption { padding: 0 .7em .45em; opacity: .6; font-size: .88em; }
    #assistant .assistantInset { position: relative; display: grid; place-items: center; width: 100%; aspect-ratio: 480 / 300; padding: 0; border: 0; background: rgb(0 0 0 / 4%); color: inherit; }
    #assistant .assistantInset :is(img, svg) { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
    #assistant .assistantInset span { opacity: .6; font-size: .9em; }
    #assistant .assistantEmblem { display: block; width: 9em; height: 9em; margin: .5em auto; }
    #assistant .assistantNoticeItem { padding: .4em .6em; border-left: 3px solid var(--header); border-radius: .25em; background: rgb(0 0 0 / 4%); font-size: .9em; }
    #assistant .assistantDivider { display: flex; align-items: center; gap: .6em; margin: .8em 0; opacity: .5; font-size: .78em; text-transform: uppercase; letter-spacing: .06em; }
    #assistant .assistantDivider::before, #assistant .assistantDivider::after { content: ""; flex: 1; height: 1px; background: currentcolor; }

    #assistant .assistantActions { display: flex; flex-wrap: wrap; gap: .4em; margin-top: .5em; }
    #assistant .assistantButton { padding: .25em .7em; border: 1px solid var(--header); border-radius: .35em; background: none; color: inherit; }
    #assistant .assistantButton:hover:not(:disabled) { background: rgb(0 0 0 / 5%); }
    #assistant .assistantPrimary { background: var(--header); color: #fff; }
    #assistant .assistantPrimary:hover:not(:disabled) { background: var(--header-active); }
    #assistant .assistantLink { padding: 0; border: 0; background: none; color: inherit; text-decoration: underline; }
    #assistant .assistantLink:hover:not(:disabled) { color: var(--header-active); }

    #assistant .assistantFeedback { display: flex; gap: .15em; margin-top: .2em; }
    #assistant .assistantFeedback button { padding: 0 .2em; border: 0; background: none; opacity: .3; font-size: .9em; }
    #assistant .assistantFeedback button:hover { opacity: .7; }
    #assistant .assistantFeedback button[aria-pressed="true"] { opacity: 1; }

    #assistant .assistantTyping { display: flex; align-items: center; gap: .28em; padding: .2em .1em; opacity: .7; }
    #assistant .assistantTyping i { width: .4em; height: .4em; border-radius: 50%; background: currentcolor; animation: assistantTyping 1.2s infinite ease-in-out; }
    #assistant .assistantTyping i:nth-child(2) { animation-delay: .15s; }
    #assistant .assistantTyping i:nth-child(3) { animation-delay: .3s; margin-right: .35em; }
    @keyframes assistantTyping { 0%, 60%, 100% { opacity: .25; transform: none; } 30% { opacity: .9; transform: translateY(-.18em); } }
    @media (prefers-reduced-motion: reduce) { #assistant .assistantTyping i { animation: none; } }

    #assistantContext { flex: none; align-self: flex-start; padding: .1em .55em; border-radius: 1em; background: rgb(0 0 0 / 6%); font-size: .9em; }
    #assistantNotice { flex: none; max-height: 30%; overflow-y: auto; padding: .45em .6em; border-left: 3px solid var(--header); border-radius: .25em; background: rgb(0 0 0 / 5%); font-size: .9em; }
    #assistantNotice p { margin: 0 0 .3em; }

    #assistantComposer { flex: none; display: flex; align-items: flex-end; gap: .4em; padding: .3em .3em .3em .6em; border: 1px solid rgb(0 0 0 / 20%); border-radius: .6em; background: rgb(255 255 255 / 70%); }
    #assistantComposer:focus-within { border-color: var(--header); }
    #assistantQuestion { flex: 1; min-width: 0; height: 1.7em; max-height: 108px; padding: .2em 0; border: 0; outline: none; background: none; resize: none; font: inherit; line-height: 1.4; }
    #assistantAsk { flex: none; display: flex; align-items: center; justify-content: center; width: 1.9em; height: 1.9em; padding: 0; border: 0; border-radius: .45em; background: var(--header); color: #fff; }
    #assistantAsk::before { margin: 0; }
    #assistantAsk:hover { background: var(--header-active); }
    #assistantQuestion:placeholder-shown + #assistantAsk:not(.busy) { opacity: .45; }

    #assistant .assistantFooter { flex: none; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .2em .8em; padding-top: .4em; border-top: 1px solid rgb(0 0 0 / 10%); font-size: .9em; }
    #assistant .assistantFooter > span { display: flex; flex-wrap: wrap; align-items: center; gap: .2em .7em; }
    #assistant .assistantFooter a { color: inherit; }
    #assistantTier { padding: 0 .5em; border-radius: 1em; background: var(--header); color: #fff; }

    #assistant .assistantViewHeader { display: flex; justify-content: space-between; align-items: center; padding-bottom: .45em; border-bottom: 1px solid rgb(0 0 0 / 15%); }
    #assistant .assistantChatRow { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: .1em .6em; padding: .45em .3em; border-bottom: 1px solid rgb(0 0 0 / 8%); }
    #assistant .assistantChatRow:hover, #assistant .assistantChatRow.current { background: rgb(0 0 0 / 4%); }
    #assistant .assistantChatRow.current .assistantChatTitle { font-weight: bold; }
    #assistant .assistantChatTitle { overflow: hidden; padding: 0; border: 0; background: none; color: inherit; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
    #assistant .assistantChatRow :is(time, small) { font-size: .9em; opacity: .65; }
    #assistant .assistantChatRow small { grid-column: 1 / -1; }
    #assistant .assistantDelete { padding: 0 .2em; border: 0; background: none; opacity: .4; }
    #assistant .assistantDelete:is(:hover, :focus-visible) { opacity: 1; }
    #assistant .assistantEmpty { padding: 1em 0; opacity: .65; }

    #assistantKey h3 { margin: 0 0 .4em; font-size: 1.1em; }
    #assistantKey p { margin: 0 0 .5em; }
    #assistantKey .assistantFields { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: .45em .6em; margin: .8em 0 .4em; }
    #assistantKey .assistantFields :is(input, select) { width: 100%; box-sizing: border-box; }
    #assistantKey .assistantFields a { grid-column: 2; justify-self: start; color: inherit; font-size: .9em; }
    #assistantLocalHint { font-size: .9em; opacity: .8; }
    #assistantDiscoveryError { min-height: 1.2em; color: #a3262e; font-size: .9em; overflow-wrap: anywhere; }
    #assistant .assistantSheetActions { display: flex; justify-content: flex-end; gap: .5em; margin-top: .4em; }
  </style>`;

function renderDialog(): void {
  const providers = PROVIDERS.map(provider => `<option value="${provider.id}">${provider.label}</option>`).join("");

  const html = /* html */ `<div id="${dialogId}" class="dialog stable">
    ${STYLES}
    <div id="assistantTranscript" role="log" aria-live="polite" aria-label="Assistant chat"></div>

    <div id="assistantChats" hidden>
      <div class="assistantViewHeader">
        <strong>Chats</strong>
        <button type="button" class="assistantLink" data-action="new-chat">+ New chat</button>
      </div>
      <div id="assistantChatList"></div>
    </div>

    <form id="assistantKey" hidden>
      <h3>Connect your AI key</h3>
      <p>Unlimited questions, and I can read and edit this map. Your key stays in this browser and goes only to the provider. I run scripts in this page to read your map. Only use me on maps from sources you trust.</p>
      <div class="assistantFields">
        <label for="assistantProvider">Provider</label>
        <select id="assistantProvider">${providers}</select>
        <label id="assistantModelLabel" for="assistantModel">Model</label>
        <input id="assistantModel" list="assistantModels" autocomplete="off" spellcheck="false" />
        <label for="assistantApiKey" data-remote>API key</label>
        <input id="assistantApiKey" type="password" autocomplete="off" data-remote />
        <a id="assistantKeyLink" target="_blank" rel="noopener noreferrer" data-remote>Where to get one</a>
        <label for="assistantLocalUrl" data-local>Server</label>
        <input id="assistantLocalUrl" autocomplete="off" spellcheck="false" data-local />
      </div>
      <datalist id="assistantModels"></datalist>
      <p id="assistantLocalHint" data-local>ⓘ Local models need no key. Point to the server and enter the model name. Set the server's context window to at least 8k tokens (Ollama's num_ctx).</p>
      <div id="assistantDiscoveryError" role="status"></div>
      <div class="assistantSheetActions">
        <button type="button" class="assistantButton" data-action="close-key">Cancel</button>
        <button type="button" id="assistantDisconnect" class="assistantButton" data-action="disconnect">Disconnect</button>
        <button type="submit" class="assistantButton assistantPrimary">Connect</button>
      </div>
    </form>

    <div id="assistantContext" hidden></div>

    <div id="assistantNotice" role="status" hidden>
      <div id="assistantNoticeText"></div>
      <div id="assistantNoticeActions" class="assistantActions">
        <button type="button" id="assistantRetry" class="assistantButton" data-action="retry">Retry</button>
        <button type="button" id="assistantNoticeSignIn" class="assistantButton" data-action="sign-in">Sign in</button>
        <button type="button" id="assistantNoticeKey" class="assistantButton assistantPrimary" data-action="key"></button>
      </div>
      <div id="assistantLong">
        <p>This chat is getting long — each question re-sends all of it.</p>
        <button type="button" class="assistantButton" data-action="new-chat">Start a new chat</button>
      </div>
    </div>

    <div id="assistantComposer">
      <textarea id="assistantQuestion" rows="1" maxlength="${MAX_QUESTION_LENGTH}" aria-label="Your question" placeholder="Ask a question…"></textarea>
      <button id="assistantAsk" type="button"></button>
    </div>

    <div class="assistantFooter">
      <span>
        <a href="${DISCORD}" target="_blank" rel="noopener noreferrer">Discord</a>
        <a href="${PATREON}" target="_blank" rel="noopener noreferrer">Patreon</a>
        <a href="${POLICY}" target="_blank" rel="noopener noreferrer">Policy</a>
      </span>
      <span id="assistantAccount">
        <span id="assistantTier"></span>
        <span id="assistantStatus"></span>
        <button type="button" id="assistantSignIn" class="assistantLink" data-action="sign-in">Sign in</button>
        <button type="button" id="assistantSignOut" class="assistantLink" data-action="sign-out">Sign out</button>
        <button type="button" id="assistantUseKey" class="assistantLink" data-action="key"></button>
      </span>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  el(dialogId).addEventListener("click", handleClick);
  el("assistantAsk").addEventListener("click", () => (busy ? stop() : void send()));
  const input = el<HTMLTextAreaElement>("assistantQuestion");
  input.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    if (!busy) void send();
  });
  input.addEventListener("input", () => fitInput(input));
  el("assistantKey").addEventListener("submit", event => {
    event.preventDefault();
    connect();
  });
  el("assistantProvider").addEventListener("change", fillProvider);
  el("assistantApiKey").addEventListener("input", scheduleDiscovery);
  el("assistantLocalUrl").addEventListener("input", scheduleDiscovery);
}

// The titlebar only exists once jQuery UI has built the dialog
function addChatsButton(): void {
  const titlebar = el(dialogId).closest(".ui-dialog")?.querySelector(".ui-dialog-titlebar");
  if (!titlebar) return;
  const button = document.createElement("button");
  button.id = "assistantOpenChats";
  button.type = "button";
  button.className = "icon-list-bullet";
  button.dataset.tip = "Chats";
  button.setAttribute("aria-label", "Chats");
  button.addEventListener("click", () => {
    if (!busy && initialized) showView(view === "chats" ? "chat" : "chats");
  });
  titlebar.insertBefore(button, titlebar.querySelector(".ui-dialog-titlebar-reset, .ui-dialog-titlebar-collapse"));
  titlebar.querySelector(".ui-dialog-titlebar-collapse")?.setAttribute("aria-label", "Minimize or restore Assistant");
  titlebar.querySelector(".ui-dialog-titlebar-close")?.setAttribute("aria-label", "Close Assistant");
}

function handleClick(event: MouseEvent): void {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (!target || (target as HTMLButtonElement).disabled) return;
  const { action, id, index, rating } = target.dataset;
  if (action === "new-chat") newChat();
  else if (action === "key") openKeySheet();
  else if (action === "close-key") showView("chat");
  else if (action === "disconnect") disconnect();
  else if (action === "sign-in") signIn();
  else if (action === "sign-out") void leaveMember();
  else if (action === "retry") notice?.retry?.();
  else if (action === "open-chat" && id) openChat(id);
  else if (action === "delete-chat" && id) deleteChat(id);
  else if (action === "apply" || action === "undo" || action === "redo" || action === "discard")
    decide(action, Number(index));
  else if (action === "rate") void rateItem(Number(index), rating as "up" | "down");
  else if (action === "entity" && id) AssistantWidgets.openEntity(id);
  else if (action === "command" && id) AssistantWidgets.runCommand(id);
  else if (action === "mark") toggleMarks(Number(index));
  else if (action === "choose") choose(Number(index), Number(target.dataset.choice));
  else if (action === "inset") revealInset(Number(index));
}

async function initialize(): Promise<void> {
  try {
    await load();
  } catch {
    notice = { text: "Chats could not be loaded.", retry: () => void initialize() };
    render();
    return;
  }
  const now = tier();
  openMap = AssistantMap.id();
  chat = current();
  if (!writable(chat) || chat?.tier !== now)
    chat = now ? create(now, AssistantMap.id(), AssistantMap.name()) : undefined;
  observedTier = now;
  initialized = true;
  notice = null;
  render();
  void refreshContextChip();
  if (isOfficial() && now !== "key") void refreshLimits();
}

/** A fresh chat for the tier and map open now; the previous one stays in the list */
function startChat(): void {
  const now = tier();
  chat = now ? create(now, AssistantMap.id(), AssistantMap.name()) : undefined;
  observedTier = now;
  clearNotice();
  AssistantWidgets.clearMarks();
  const input = el<HTMLTextAreaElement>("assistantQuestion");
  input.value = "";
  fitInput(input);
  showView("chat");
}

function newChat(): void {
  if (!busy && initialized) startChat();
}

function openChat(id: string): void {
  chat = select(id);
  clearNotice();
  AssistantWidgets.clearMarks();
  showView("chat");
}

function deleteChat(id: string): void {
  remove(id);
  if (chat?.id === id) {
    chat = undefined;
    AssistantWidgets.clearMarks();
  }
  renderChats();
}

function showView(next: View): void {
  if (view === "key" && next !== "key") cancelDiscovery();
  view = next;
  render();
}

function render(keepScroll = false): void {
  const readOnly = !writable(chat);
  el("assistantTranscript").hidden = view !== "chat";
  el("assistantChats").hidden = view !== "chats";
  el("assistantKey").hidden = view !== "key";
  el("assistantComposer").hidden = view !== "chat" || readOnly;
  renderContextChip();
  const openChats = document.getElementById("assistantOpenChats") as HTMLButtonElement | null;
  if (openChats) openChats.disabled = busy || !initialized;
  const ask = el<HTMLButtonElement>("assistantAsk");
  ask.className = busy ? "busy icon-cancel" : "icon-right-big";
  ask.setAttribute("aria-label", busy ? "Stop" : "Send");
  ask.title = busy ? "Stop" : "Send (Enter)";
  if (view === "chat") renderTranscript(keepScroll);
  if (view === "chats") renderChats();
  renderNotice();
  renderFooter();
}

function renderTranscript(keepScroll = false): void {
  // a hidden log can't hold its scroll position, so open() renders it instead
  if (!showing) {
    unseen = true;
    return;
  }
  const log = el("assistantTranscript");
  const top = log.scrollTop;
  const items = chat?.items ?? [];
  const now = tier();
  const live = chat?.mapId === AssistantMap.id();
  const continues = writable(chat);
  const canAsk = !busy && continues;
  let html = items.length ? "" : welcomeHtml(now);
  items.forEach((item, index) => {
    if (item !== notice?.item) html += itemHtml(item, { index, live, canAsk });
  });
  if (initialized && !continues && (chat || now)) {
    html += /* html */ `<div class="assistantItem assistantNoticeItem">Start a new chat to continue
      <div class="assistantActions"><button type="button" class="assistantButton" data-action="new-chat">New chat</button></div>
    </div>`;
  }
  if (busy) html += `<div class="assistantTyping"><i></i><i></i><i></i>${escapeHtml(answerStatus)}…</div>`;
  log.innerHTML = html;
  log.scrollTop = keepScroll ? top : log.scrollHeight;
}

function welcomeHtml(now: Tier): string {
  const note = noteLabel ? escapeHtml(noteLabel) : "";
  const paragraphs = !now
    ? [
        "The free Assistant runs only on the official site. Connect your own AI key or a local model to ask questions here."
      ]
    : now === "key"
      ? [
          "Hi! Ask about the Fantasy Map Generator or this map. I can read and propose changes to your map.",
          note ? `I can work on the note “${note}”.` : ""
        ]
      : [
          "Hi! Ask anything about the Fantasy Map Generator.",
          `Connect your own AI key and I can read this map, answer questions about it and edit it, with no daily limit.`
        ];
  const connect =
    now === "key"
      ? ""
      : `<div class="assistantActions"><button type="button" class="assistantButton assistantPrimary" data-action="key">🔑 Connect your AI key</button></div>`;
  const text = paragraphs
    .filter(Boolean)
    .map(paragraph => `<p>${paragraph}</p>`)
    .join("");
  return `<div class="assistantItem assistantWelcome">${text}${connect}</div>`;
}

function itemHtml(item: TranscriptItem, context: WidgetContext): string {
  const { index, live } = context;
  if (item.kind === "question") return `<div class="assistantItem assistantQuestion">${escapeHtml(item.text)}</div>`;
  if (item.kind === "answer") {
    const feedback =
      item.ratingId == null
        ? ""
        : `<div class="assistantFeedback">${(["up", "down"] as const)
            .map(
              rating =>
                `<button type="button" data-action="rate" data-index="${index}" data-rating="${rating}" aria-pressed="${item.rating === rating}" aria-label="${rating === "up" ? "Good answer" : "Bad answer"}">${rating === "up" ? "👍" : "👎"}</button>`
            )
            .join("")}</div>`;
    return `<div class="assistantItem assistantAnswer">${AssistantWidgets.answer(item.text, live)}${feedback}</div>`;
  }
  if (item.kind === "step") {
    const { result } = item;
    const summary = !result ? "Reading the map" : result.ok ? "Read the map" : "Map read failed";
    const output = result ? (result.ok ? [result.value, ...result.logs].join("\n") : result.error?.message) : "";
    return /* html */ `<details class="assistantItem assistantStep${result && !result.ok ? " failed" : ""}">
      <summary>${summary}${result ? ` · ${result.ms} ms` : ""}</summary>
      <pre>${escapeHtml(item.code)}</pre>${output ? `<pre>${escapeHtml(output)}</pre>` : ""}
    </details>`;
  }
  if (item.kind === "proposal") return proposalHtml(item.proposal, index, AssistantMap.id());
  if (item.kind === "divider") return `<div class="assistantDivider">New memory</div>`;
  if (item.kind === "widget") return AssistantWidgets.html(item.widget, context);
  return `<div class="assistantItem assistantNoticeItem">${renderMarkdown(item.text)}</div>`;
}

function renderChats(): void {
  const entries = list();
  el("assistantChatList").innerHTML = entries.length
    ? entries.map(chatRowHtml).join("")
    : `<div class="assistantEmpty">No chats yet.</div>`;
}

function chatRowHtml(entry: Chat): string {
  const used = tokens(entry);
  const meta = [
    escapeHtml(entry.mapName) + (entry.mapId === AssistantMap.id() ? "" : " (other map)"),
    entry.tier === "key" ? "🔑" : "",
    used ? `${si(used)} tokens` : ""
  ]
    .filter(Boolean)
    .join(" · ");
  const title = escapeHtml(entry.title);
  const updated = new Date(entry.updated);
  return /* html */ `<div class="assistantChatRow${entry === chat ? " current" : ""}">
    <button type="button" class="assistantChatTitle" data-action="open-chat" data-id="${entry.id}" title="${title}">${title}</button>
    <time datetime="${updated.toISOString()}" title="${updated.toLocaleString()}">${timeAgo(entry.updated)}</time>
    <button type="button" class="assistantDelete icon-trash" data-action="delete-chat" data-id="${entry.id}" aria-label="Delete chat ${title}"></button>
    <small>${meta}</small>
  </div>`;
}

function renderFooter(): void {
  const now = tier();
  const connection = Connection.get();
  el("assistantTier").hidden = now !== "guest" && now !== "member";
  el("assistantTier").textContent = now === "member" ? "Member" : "Guest";
  el("assistantStatus").textContent =
    now === "key"
      ? `${connection.provider === "local" ? "Local" : "🔑"} ${connection.model} · ${si(tokens(chat))} tokens`
      : now && limits
        ? limitsLabel(limits)
        : "";
  el("assistantSignIn").hidden = now !== "guest";
  el("assistantSignOut").hidden = now !== "member";
  el("assistantUseKey").textContent = now === "key" ? "Key" : "Use key";
  for (const button of el("assistantAccount").querySelectorAll("button")) button.disabled = busy || !initialized;
}

function renderNotice(): void {
  const long = Boolean(chat && isLong(chat));
  const live = Boolean(notice?.item);
  const now = tier();
  el("assistantNotice").hidden = view !== "chat" || (!notice && !long);
  el("assistantNoticeText").hidden = !notice;
  el("assistantNoticeText").innerHTML = notice ? renderMarkdown(notice.text) : "";
  el("assistantRetry").hidden = !notice?.retry;
  el("assistantNoticeSignIn").hidden = !live || now !== "guest";
  el("assistantNoticeKey").hidden = !live;
  el("assistantNoticeKey").textContent = now === "key" ? "Key" : "🔑 Connect your AI key";
  el("assistantNoticeActions").hidden = !notice?.retry && !live;
  el("assistantLong").hidden = !long;
  for (const button of el("assistantNotice").querySelectorAll("button")) button.disabled = busy;
}

// The live notice sits above the composer; once the next answer arrives it moves into the transcript
function showNotice(next: Notice): void {
  notice = next;
  renderNotice();
}

function clearNotice(): void {
  notice = null;
}

function fitInput(input: HTMLTextAreaElement): void {
  input.style.height = "";
  if (input.value) input.style.height = `${input.scrollHeight}px`;
}

async function refreshContextChip(): Promise<void> {
  const note = await Controllers.NotesEditor.current();
  noteLabel = note ? note.name || note.id : null;
  renderContextChip();
  if (view === "chat" && !chat?.items.length) renderTranscript();
}

function renderContextChip(): void {
  el("assistantContext").textContent = noteLabel ? `Note: ${noteLabel}` : "";
  el("assistantContext").hidden = view !== "chat" || !noteLabel;
}

async function refreshLimits(): Promise<void> {
  if (!isOfficial() || tier() === "key") return;
  try {
    limits = await getLimits();
  } catch (error) {
    // An expired sign-in clears its token, so the second attempt asks as a Guest
    const expired = error instanceof AzgaarServerError && error.code === "unauthorized";
    limits = expired ? await getLimits().catch(() => null) : null;
  }
  if (initialized && observedTier !== tier()) newChat();
  renderFooter();
}

async function leaveMember(): Promise<void> {
  await signOut();
  newChat();
  void refreshLimits();
}

function decide(action: "apply" | "undo" | "redo" | "discard", index: number): void {
  const owner = chat;
  const item = owner?.items[index];
  if (!owner || item?.kind !== "proposal") return;
  try {
    if (action === "discard") Proposals.discard(item.proposal);
    else if (!Proposals.run(action, item.proposal, AssistantMap.id()))
      showNotice({ text: `The map changed since; ${capitalize(action)} is unavailable.` });
    touch(owner);
  } catch (error) {
    showNotice({ text: errorText(error) });
  }
  if (chat === owner && view === "chat") {
    renderTranscript();
    void refreshContextChip();
  }
}

function toggleMarks(index: number): void {
  const item = chat?.items[index];
  if (item?.kind !== "widget" || item.widget.type !== "entities") return;
  AssistantWidgets.toggleMarks(item.widget);
  renderTranscript(true);
}

function revealInset(index: number): void {
  const item = chat?.items[index];
  if (item?.kind === "widget" && item.widget.type === "inset") AssistantWidgets.revealInset(item.widget);
}

/** A choice with operations becomes a proposal card; one without is sent as the user's next question */
function choose(index: number, number: number): void {
  const owner = chat;
  const item = owner?.items[index];
  if (!owner || item?.kind !== "widget" || item.widget.type !== "choices" || item.widget.picked !== undefined) return;
  const { widget } = item;
  const choice = widget.choices[number];
  if (!choice) return;
  if (!choice.operations) {
    if (busy || !writable(owner)) return;
    widget.picked = number;
    el<HTMLTextAreaElement>("assistantQuestion").value = choice.label;
    void send();
    return;
  }
  const count = owner.items.filter(entry => entry.kind === "proposal").length;
  const proposal = Proposals.propose(choice.label, choice.operations, count + 1, AssistantMap.id());
  if (typeof proposal === "string") {
    showNotice({ text: proposal });
    return;
  }
  widget.picked = number;
  append(owner, { kind: "proposal", proposal });
  renderTranscript();
}

/** Select a rating at once; roll it back if the Azgaar server refuses it */
async function rateItem(index: number, rating: "up" | "down"): Promise<void> {
  const owner = chat;
  const item = owner?.items[index];
  if (!owner || item?.kind !== "answer" || item.ratingId == null || item.rating === rating) return;
  const show = (value?: "up" | "down") => {
    item.rating = value;
    touch(owner);
    if (chat === owner && view === "chat") renderTranscript();
  };
  const previous = item.rating;
  show(rating);
  try {
    await sendFeedback(item.ratingId, rating);
  } catch (error) {
    show(previous);
    if (error instanceof AzgaarServerError && error.code === "unauthorized") void refreshLimits();
  }
}

function openKeySheet(): void {
  if (busy) return;
  const connection = Connection.get();
  el<HTMLSelectElement>("assistantProvider").value = connection.provider;
  el<HTMLInputElement>("assistantLocalUrl").value = connection.localUrl;
  el("assistantDisconnect").hidden = !Connection.isConnected();
  showView("key");
  fillProvider();
}

function cancelDiscovery(): void {
  discoveryId++;
  if (discoveryTimer) clearTimeout(discoveryTimer);
  discoveryTimer = null;
}

function selectedProvider(): ProviderSpec {
  return providerById(el<HTMLSelectElement>("assistantProvider").value) ?? DEFAULT_PROVIDER;
}

function fillProvider(): void {
  const provider = selectedProvider();
  const local = provider.id === "local";
  const draft = Connection.get(provider.id);
  el<HTMLInputElement>("assistantModel").value = draft.model;
  el<HTMLInputElement>("assistantApiKey").value = draft.key;
  el("assistantModelLabel").textContent = local ? "Model name" : "Model";
  el<HTMLAnchorElement>("assistantKeyLink").href = provider.keyLink;
  for (const node of el("assistantKey").querySelectorAll<HTMLElement>("[data-remote]")) node.hidden = local;
  for (const node of el("assistantKey").querySelectorAll<HTMLElement>("[data-local]")) node.hidden = !local;
  setModels(provider.fallbackModel ? [provider.fallbackModel] : []);
  void discover();
}

function setModels(models: string[]): void {
  el("assistantModels").replaceChildren(...models.map(model => new Option(model)));
}

function scheduleDiscovery(): void {
  cancelDiscovery();
  el("assistantDiscoveryError").textContent = "";
  setModels([]);
  discoveryTimer = setTimeout(() => void discover(), 350);
}

// Discovery doubles as the key check: a failure shows the provider's error but never blocks Connect
async function discover(): Promise<void> {
  const provider = selectedProvider();
  const key = el<HTMLInputElement>("assistantApiKey").value.trim();
  const url = el<HTMLInputElement>("assistantLocalUrl").value.trim();
  const request = ++discoveryId;
  const error = el("assistantDiscoveryError");
  error.textContent = "";
  if (provider.id !== "local" && !key) return setModels([]);
  const stale = () => request !== discoveryId || view !== "key";
  try {
    const found = await listModels(provider.id, key, url);
    if (!stale()) setModels(found);
  } catch (failure) {
    if (!stale()) error.textContent = errorText(failure);
  }
}

function connect(): void {
  const provider = selectedProvider().id;
  const local = provider === "local";
  const model = el<HTMLInputElement>("assistantModel").value.trim();
  const key = el<HTMLInputElement>("assistantApiKey").value.trim();
  if (!model || (!local && !key)) {
    el("assistantDiscoveryError").textContent = local ? "Enter a model name." : "Enter a model and API key.";
    return;
  }
  const wasConnected = Connection.isConnected();
  Connection.save({
    provider,
    model,
    key: local ? "" : key,
    localUrl: el<HTMLInputElement>("assistantLocalUrl").value.trim() || Connection.get().localUrl
  });
  if (wasConnected) showView("chat");
  else newChat();
}

function disconnect(): void {
  Connection.clear();
  newChat();
  void refreshLimits();
}

async function send(): Promise<void> {
  if (busy || !writable(chat)) return;
  const input = el<HTMLTextAreaElement>("assistantQuestion");
  const question = normalizeQuestion(input.value);
  if (!question) return;
  input.value = "";
  fitInput(input);
  clearNotice();
  busy = true;
  answerStatus = "Thinking";
  const request = new AbortController();
  abort = request;
  const active = chat;
  const from = active.items.length;
  const visible = () => chat === active;
  const onItem = (item: TranscriptItem) => {
    append(active, item);
    if (!visible()) return;
    if (item.kind === "notice") showNotice({ text: item.text, item });
    if (item.kind === "answer" && notice) {
      clearNotice();
      renderNotice();
    }
    if (view === "chat") renderTranscript();
  };
  const onStatus = (status: string) => {
    answerStatus = status;
    if (visible() && view === "chat") renderTranscript();
  };
  render();
  try {
    if (active.tier === "key")
      await askProvider(active, question, onItem, request.signal, {
        tools: AssistantMap.tools(active),
        context: () => AssistantMap.context(active),
        onStatus
      });
    else await askServer(active, question, onItem, request.signal);
  } catch (error) {
    if (!request.signal.aborted) {
      const item: TranscriptItem = { kind: "notice", text: errorText(error) };
      append(active, item);
      if (chat === active) showNotice({ text: item.text, item, retry: () => resend(active, question, from) });
    }
  } finally {
    busy = false;
    abort = null;
    touch(active);
    render();
    if (showing) el("assistantQuestion").focus();
    void refreshLimits();
  }
}

/** Ask the failed question again; a failure before any step leaves nothing of it behind */
function resend(owner: Chat, question: string, from: number): void {
  if (busy || chat !== owner) return;
  const tail = owner.items.slice(from);
  if (tail.every(item => item.kind === "question" || item.kind === "notice")) owner.items.splice(from);
  else if (tail.at(-1)?.kind === "notice") owner.items.pop();
  el<HTMLTextAreaElement>("assistantQuestion").value = question;
  void send();
}

function stop(): void {
  abort?.abort();
}

function timeAgo(time: number): string {
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : new Date(time).toLocaleDateString();
}

window.addEventListener("map:generated", () => {
  if (!initialized || openMap === AssistantMap.id()) return;
  openMap = AssistantMap.id();
  stop();
  startChat();
  void refreshContextChip();
});

window.addEventListener("notes:context-changed", () => {
  if (isBuilt()) void refreshContextChip();
});

export const limitsLabel = (value: Limits): string =>
  value.remaining
    ? `${value.remaining} question${value.remaining === 1 ? "" : "s"} left today`
    : "No questions left today";

export function normalizeQuestion(raw: string): string | null {
  const question = raw.trim();
  return question && question.length <= MAX_QUESTION_LENGTH ? question : null;
}

export const Assistant = { open, toggle };
