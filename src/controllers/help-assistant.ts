import { destroyDialog } from "@/components/dialog/dialog-helpers";
import type { Limits } from "@/services/help/api";
import { ask, getLimits, HelpApiError, OFFICIAL_ORIGIN, sendFeedback, signIn, signOut } from "@/services/help/api";
import { getToken } from "@/services/help/auth";
import {
  adoptConversationId,
  clearConversationId,
  getConversationId,
  isNewConversation
} from "@/services/help/conversation";
import { renderMarkdown } from "@/utils/markdown";
import { ensureEl } from "../utils";
import { buildMessageRow, buildTypingRow } from "./help-assistant-chat";
import { mountMapPanel, newMapConversation, refreshMapContext, unmountMapPanel } from "./help-assistant-map";

// The panel holds two chats. Help asks the gateway, which answers from the wiki and cannot touch the
// map. This map is the user's own model working on the map that is open. Help is what the call
// button opens; the map assistant is one click away, or straight from the Tools menu and the notes
// editor, where the user has already asked for it.
export type AssistantMode = "help" | "map";

export interface OpenOptions {
  mode?: AssistantMode;
}

export interface WidgetNotice {
  html: string;
  askDisabled: boolean;
  retryCountdown?: number;
}

const DEFAULT_RETRY_SECONDS = 30;
const MAX_QUESTION_LENGTH = 1000;
const MAX_INPUT_HEIGHT = 108;
const INIT_MESSAGE =
  "Hi! Ask anything about the Fantasy Map Generator. I cannot change maps, but I can teach you how to do it.";

const isOfficialOrigin = (): boolean => location.origin === OFFICIAL_ORIGIN || import.meta.env.DEV;

function isMounted(): boolean {
  return document.getElementById("helpAssistant") !== null;
}

// The call button mirrors the dialog: while the panel is up it shows a close glyph, so a
// second click on it reads as "close" rather than "open again"
function markBubble(isOpen: boolean): void {
  const bubble = document.getElementById("helpAssistantBubble");
  if (!bubble) return;
  bubble.classList.toggle("open", isOpen);
  bubble.setAttribute("aria-expanded", String(isOpen));
}

function toggle(): void {
  if (isMounted()) $("#helpAssistant").dialog("close");
  else open();
}

// A chat panel is a companion to the map, not a modal over it: it takes the bottom-right
// corner — over its own call button, which the title bar's close then stands in for.
function open(options: OpenOptions = {}): void {
  const mode = options.mode ?? "help";
  if (isMounted()) {
    // an entry point that names a mode reaches in: switch, and come out from under the notes editor
    setMode(mode);
    $("#helpAssistant").dialog("moveToTop");
    return;
  }

  renderDialog();

  $("#helpAssistant").dialog({
    title: "Azgaar Assistant",
    position: { my: "right bottom", at: "right-16 bottom-44", of: window },
    width: Math.min(400, window.innerWidth - 24),
    // both modes are transcripts, so the panel always takes the messenger height
    height: Math.min(560, window.innerHeight - 140),
    minWidth: 300,
    minHeight: 320,
    resizable: true,
    close: () => {
      stopRetryTimer();
      autoRetried = false;
      unmountMapPanel();
      markBubble(false);
      destroyDialog("helpAssistant");
    }
  });

  markBubble(true);
  addTitlebarNewChat();
  setMode(mode);
  if (isOfficialOrigin()) void refreshLimits();
}

// "New chat" belongs with close and minimize — a window action, not chat content. Putting it
// in the titlebar keeps the body a pure transcript and inherits the FMG button styling.
function addTitlebarNewChat(): void {
  const titlebar = document
    .getElementById("helpAssistant")
    ?.closest(".ui-dialog")
    ?.querySelector(".ui-dialog-titlebar");
  if (!titlebar || titlebar.querySelector("#helpAssistantNewChat")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.id = "helpAssistantNewChat";
  button.className = "helpAssistantNewChat icon-ccw";
  button.title = "Start a new chat";
  button.setAttribute("aria-label", "Start a new chat");
  // one control, whichever transcript is on screen
  button.addEventListener("click", () => (currentMode === "map" ? newMapConversation() : resetConversationLog()));
  titlebar.insertBefore(button, titlebar.querySelector(".ui-dialog-titlebar-collapse"));
}

let currentMode: AssistantMode = "help";

export function setMode(mode: AssistantMode): void {
  currentMode = mode;
  for (const button of document.querySelectorAll<HTMLButtonElement>("#helpAssistant .helpAssistantMode")) {
    const active = button.dataset.mode === mode;
    button.setAttribute("aria-selected", String(active));
    button.classList.toggle("selected", active);
  }
  ensureEl("helpAssistantHelp").hidden = mode !== "help";
  const mapHost = ensureEl("helpAssistantMap");
  mapHost.hidden = mode !== "map";
  if (mode !== "map") return;
  // the map chat is built on first use and then left alone: switching back and forth must not
  // cost a rebuild, or an in-flight request and a half-typed question go with it
  if (!mapHost.dataset.mounted) {
    mountMapPanel(mapHost);
    mapHost.dataset.mounted = "1";
  }
  refreshMapContext();
}

function renderDialog(): void {
  destroyDialog("helpAssistant");

  // Panel styling lives with the panel: the dialog is built here and torn down on close, so
  // its stylesheet rides along with it instead of sitting in the global sheet
  const styles = /* html */ `
    <style>
      #helpAssistant.ui-dialog-content { display: flex; flex-direction: column; gap: .5em; overflow: hidden; padding: .6em .7em .5em; font-family: var(--sans-serif); }
      #helpAssistant > div          { width: auto; }
      .ui-dialog-titlebar .helpAssistantNewChat { font-size: .62em; }

      /* two chats in one panel: the switch is a tab strip, not a pair of buttons */
      #helpAssistant .helpAssistantModes { flex: none; display: flex; gap: .15em; padding: .15em; border-radius: .45em; background: rgb(0 0 0 / 6%); }
      #helpAssistant .helpAssistantMode  { flex: 1; padding: .25em .5em; border: 0; border-radius: .35em; background: none; color: inherit; font: inherit; font-size: .92em; opacity: .65; transition: .15s; }
      #helpAssistant .helpAssistantMode::before  { margin-right: .3em; }
      #helpAssistant .helpAssistantMode:hover    { opacity: .9; }
      #helpAssistant .helpAssistantMode.selected { background: var(--light-solid); opacity: 1; font-weight: bold; box-shadow: 0 1px 2px rgb(0 0 0 / 15%); }
      #helpAssistant .helpAssistantPanel { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: .5em; }
      #helpAssistant .helpAssistantPanel[hidden] { display: none; }

      #helpAssistant .helpAssistantLog   { flex: 1; min-height: 0; overflow: hidden auto; padding-right: .2em; line-height: 1.4; }
      #helpAssistant .helpAssistantMsg   { display: flex; margin-bottom: .55em; }
      #helpAssistant .helpAssistantMsg.user { justify-content: flex-end; }
      #helpAssistant .helpAssistantStack { display: flex; flex-direction: column; min-width: 0; max-width: 88%; }
      #helpAssistant .helpAssistantBubble { padding: .45em .65em; border-radius: .4em; background: rgb(0 0 0 / 6%); overflow-wrap: anywhere; }
      #helpAssistant .helpAssistantMsg.user .helpAssistantBubble   { background: var(--header); color: #ffffff; }
      #helpAssistant .helpAssistantMsg.user .helpAssistantBubble a { color: #ffffff; }

      /* answers are rendered markdown: keep block spacing tight enough to read as one message */
      #helpAssistant .helpAssistantBubble > :first-child { margin-top: 0; }
      #helpAssistant .helpAssistantBubble > :last-child  { margin-bottom: 0; }
      #helpAssistant .helpAssistantBubble p              { margin: .4em 0; }
      #helpAssistant .helpAssistantBubble :is(h3, h4, h5, h6) { margin: .6em 0 .3em; font-size: 1em; }
      #helpAssistant .helpAssistantBubble :is(ol, ul)    { margin: .4em 0; padding-left: 1.3em; }
      #helpAssistant .helpAssistantBubble pre            { overflow-x: auto; margin: .4em 0; padding: .4em .5em; border-radius: .3em; background: rgb(0 0 0 / 6%); font-size: .9em; }
      #helpAssistant .helpAssistantBubble code           { font-family: var(--monospace); }
      #helpAssistant .helpAssistantBubble table          { display: block; overflow-x: auto; border-collapse: collapse; }
      #helpAssistant .helpAssistantBubble :is(td, th)    { padding: .15em .4em; border: 1px solid rgb(0 0 0 / 12%); }

      /* three dots standing in for the answer while the model is thinking */
      #helpAssistant .helpAssistantTyping   { display: flex; align-items: center; gap: .28em; padding: .65em; }
      #helpAssistant .helpAssistantTyping i { width: .4em; height: .4em; border-radius: 50%; background: currentcolor; opacity: .35; animation: helpAssistantTyping 1.2s infinite ease-in-out; }
      #helpAssistant .helpAssistantTyping i:nth-child(2) { animation-delay: .15s; }
      #helpAssistant .helpAssistantTyping i:nth-child(3) { animation-delay: .3s; }
      @keyframes helpAssistantTyping { 0%, 60%, 100% { opacity: .25; transform: none; } 30% { opacity: .8; transform: translateY(-.18em); } }
      @media (prefers-reduced-motion: reduce) { #helpAssistant .helpAssistantTyping i { animation: none; } }

      #helpAssistant .helpAssistantDivider { display: flex; align-items: center; gap: .6em; margin: .6em 0; opacity: .5; font-size: .82em; text-transform: uppercase; letter-spacing: .06em; }
      #helpAssistant .helpAssistantDivider::before,
      #helpAssistant .helpAssistantDivider::after { content: ""; flex: 1; height: 1px; background: currentcolor; }

      #helpAssistant .helpAssistantFeedback        { display: flex; gap: .2em; margin-top: .15em; }
      #helpAssistant .helpAssistantFeedback button { padding: 0 .15em; border: none; background: none; opacity: .35; font-size: .9em; transition: .15s; }
      #helpAssistant .helpAssistantFeedback button:hover    { opacity: .75; }
      #helpAssistant .helpAssistantFeedback button.selected { opacity: 1; }

      /* server refusals and countdowns: loud enough to notice, quiet enough to stay out of the way */
      #helpAssistant .helpAssistantNotice { flex: none; max-height: 30%; overflow-y: auto; padding: .45em .6em; border-left: 3px solid var(--header); border-radius: .25em; background: rgb(0 0 0 / 5%); font-size: .9em; }
      #helpAssistant .helpAssistantNotice > :first-child { margin-top: 0; }
      #helpAssistant .helpAssistantNotice > :last-child  { margin-bottom: 0; }
      #helpAssistant .helpAssistantCountdown { margin-top: .3em; opacity: .7; font-variant-numeric: tabular-nums; }

      #helpAssistant .helpAssistantComposer          { flex: none; display: flex; align-items: flex-end; gap: .4em; padding: .3em .3em .3em .5em; border: 1px solid rgb(0 0 0 / 18%); border-radius: .5em; background: rgb(255 255 255 / 55%); transition: border-color .15s; }
      #helpAssistant .helpAssistantComposer:focus-within { border-color: var(--header); }
      #helpAssistant .helpAssistantComposer textarea { flex: 1; min-width: 0; height: 1.7em; max-height: ${MAX_INPUT_HEIGHT}px; padding: .2em 0; border: 0; background: none; resize: none; font: inherit; line-height: 1.4; }
      #helpAssistant .helpAssistantSend              { flex: none; display: flex; align-items: center; justify-content: center; width: 1.9em; height: 1.9em; border: 0; border-radius: .4em; background: var(--header); color: #ffffff; font-size: 1em; transition: .15s; }
      #helpAssistant .helpAssistantSend::before      { margin: 0; }
      #helpAssistant .helpAssistantSend:hover        { background: var(--header-active); }
      #helpAssistant .helpAssistantSend:disabled     { opacity: .4; cursor: default; }

      /* quick links and the account state: present, but plainly secondary to the transcript */
      #helpAssistant .helpAssistantBar     { flex: none; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .2em .8em; padding-top: .4em; border-top: 1px solid rgb(0 0 0 / 10%); font-size: .9em; }
      #helpAssistant .helpAssistantLinks   { display: flex; gap: .8em; }
      #helpAssistant .helpAssistantAccount { display: flex; align-items: center; gap: .5em; opacity: .85; }
      #helpAssistant .helpAssistantTier    { opacity: .8; }
      #helpAssistant .helpAssistantLink        { padding: 0; border: 0; background: none; color: inherit; font: inherit; text-decoration: underline; }
      #helpAssistant .helpAssistantLink:hover  { color: var(--header-active); }

      #helpAssistant .helpAssistantUnlisted { flex: none; line-height: 1.4; }

      /* This map: the same transcript, plus what only a scripted assistant needs */
      #helpAssistant .helpMapEmpty        { display: flex; flex-direction: column; align-items: center; gap: .4em; padding: .3em 0; text-align: center; }
      #helpAssistant .helpMapEmpty > p    { margin: 0 0 .2em; opacity: .7; }
      #helpAssistant .helpMapEmpty button { max-width: 100%; padding: .3em .7em; border: 1px solid rgb(0 0 0 / 15%); border-radius: 1em; background: none; color: inherit; font: inherit; font-size: .9em; transition: .15s; }
      #helpAssistant .helpMapEmpty button:hover { border-color: var(--header); color: var(--header-active); }

      /* the script the model ran: folded away, because the answer is the point */
      #helpAssistant .helpMapStep         { align-self: flex-start; max-width: 100%; margin-bottom: .55em; font-size: .9em; opacity: .8; }
      #helpAssistant .helpMapStep summary { cursor: pointer; user-select: none; }
      #helpAssistant .helpMapStep pre     { max-height: 14em; overflow: auto; margin: .25em 0 0; padding: .35em .45em; border-radius: .3em; background: rgb(0 0 0 / 6%); font-size: .92em; }

      /* an edit is an event in the transcript, not a message: flat, and it carries its own undo */
      #helpAssistant .helpMapEdit        { display: flex; align-items: center; gap: .5em; margin-bottom: .55em; padding: .35em .6em; border-left: 3px solid var(--header); border-radius: .25em; background: rgb(0 0 0 / 5%); font-size: .9em; }
      #helpAssistant .helpMapEdit span   { flex: 1; min-width: 0; }
      #helpAssistant .helpMapEdit button { flex: none; padding: .1em .5em; border: 1px solid rgb(0 0 0 / 15%); border-radius: .3em; background: none; color: inherit; font: inherit; font-size: .92em; }
      #helpAssistant .helpMapEdit button:disabled { opacity: .45; cursor: default; }

      #helpAssistant .helpMapContext { flex: none; align-self: flex-start; max-width: 100%; padding: .1em .6em; border-radius: 1em; background: rgb(0 0 0 / 8%); font-size: .85em; }

      /* model and key: reachable in a click, never in the way of the conversation */
      #helpAssistant .helpMapDrawer       { flex: none; display: flex; flex-direction: column; gap: .35em; max-height: 45%; overflow-y: auto; padding: .5em; border-radius: .4em; background: rgb(0 0 0 / 5%); font-size: .9em; }
      #helpAssistant .helpMapDrawer label { display: flex; align-items: center; gap: .4em; }
      #helpAssistant .helpMapDrawer label > span       { flex: none; width: 4.6em; opacity: .8; }
      #helpAssistant .helpMapDrawer :is(select, input) { flex: 1; min-width: 0; }
      #helpAssistant .helpMapDrawer button             { flex: none; }
      #helpAssistant .helpMapHint   { color: #b03030; }
      #helpAssistant .helpMapStatus { flex: none; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .2em .8em; padding-top: .4em; border-top: 1px solid rgb(0 0 0 / 10%); font-size: .9em; }
      #helpAssistant .helpMapStatus button       { padding: 0; border: 0; background: none; color: inherit; font: inherit; text-decoration: underline dotted; }
      #helpAssistant .helpMapStatus button:hover { color: var(--header-active); }
      #helpAssistant .helpMapStatusEnd { display: flex; align-items: center; gap: .5em; }
      #helpAssistant .helpMapGear   { text-decoration: none; opacity: .7; font-size: 1.05em; }
      #helpAssistant .helpMapUsage  { opacity: .7; }
      #helpAssistant .helpMapErrorBubble { background: rgb(176 48 48 / 12%); }

      /* last word: the display rules above are more specific than the hidden attribute, and a
         panel, drawer or row that is switched off must stay off */
      #helpAssistant [hidden] { display: none !important; }
    </style>`;

  const chat = /* html */ `
    <div id="helpAssistantLog" class="helpAssistantLog" role="log" aria-live="polite"></div>
    <div id="helpAssistantNotice" class="helpAssistantNotice" hidden></div>
    <div class="helpAssistantComposer">
      <textarea id="helpAssistantQuestion" rows="1" maxlength="1000" aria-label="Your question"
        placeholder="Ask a question…"></textarea>
      <button id="helpAssistantAsk" type="button" class="helpAssistantSend icon-right-big"
        title="Send (Enter)" aria-label="Send"></button>
    </div>`;

  // Self-hosted copies are not on the gateway's origin allowlist: explain, don't error. This map
  // still works there — it runs on the user's own key — so the switch above stays useful.
  const unlisted = /* html */ `
    <div class="helpAssistantUnlisted">
      <div class="helpAssistantMsg bot">
        <div class="helpAssistantStack">
          <div class="helpAssistantBubble">
            <p>The free assistant is only available on the official site:
              <a href="https://azgaar.github.io/Fantasy-Map-Generator/" target="_blank" rel="noopener noreferrer">
                azgaar.github.io/Fantasy-Map-Generator</a>.</p>
            <p>On a self-hosted copy, the
              <a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki" target="_blank" rel="noopener noreferrer">documentation</a>
              covers most questions. <b>This map</b> still works here: it runs on your own AI key.</p>
          </div>
        </div>
      </div>
    </div>`;

  const bar = /* html */ `
    <div class="helpAssistantBar">
      <div class="helpAssistantLinks">
        <a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki" target="_blank" rel="noopener noreferrer">Wiki</a>
        <a href="https://discordapp.com/invite/X7E84HU" target="_blank" rel="noopener noreferrer">Discord</a>
        <a href="https://www.reddit.com/r/FantasyMapGenerator/" target="_blank" rel="noopener noreferrer">Reddit</a>
        <a href="https://www.patreon.com/azgaar" target="_blank" rel="noopener noreferrer">Patreon</a>
        <a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Policy" target="_blank" rel="noopener noreferrer"
          title="What is sent, how long questions are kept, and the rest of the small print">Policy</a>
      </div>
      <div class="helpAssistantAccount">
        <span id="helpAssistantLimits"></span>
        <span id="helpAssistantAuth"></span>
      </div>
    </div>`;

  const modes = /* html */ `
    <div class="helpAssistantModes" role="tablist">
      <button type="button" class="helpAssistantMode icon-help" data-mode="help" role="tab" aria-selected="true"
        title="Ask how to use the Generator — answered from the documentation">Help</button>
      <button type="button" class="helpAssistantMode icon-robot" data-mode="map" role="tab" aria-selected="false"
        title="Ask about the map you have open, or have it write your notes, with your own AI key">This map</button>
    </div>`;

  const html = /* html */ `<div id="helpAssistant" class="dialog stable">
    ${styles}
    ${modes}
    <div id="helpAssistantHelp" class="helpAssistantPanel">
      ${isOfficialOrigin() ? chat : unlisted}
      ${bar}
    </div>
    <div id="helpAssistantMap" class="helpAssistantPanel" hidden></div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  for (const button of document.querySelectorAll<HTMLButtonElement>("#helpAssistant .helpAssistantMode")) {
    button.addEventListener("click", () => setMode(button.dataset.mode as AssistantMode));
  }

  if (!isOfficialOrigin()) return;
  resetConversationLog();

  ensureEl("helpAssistantAsk").addEventListener("click", () => void submit(normalizeQuestion(getQuestionInput())));

  const input = ensureEl<HTMLTextAreaElement>("helpAssistantQuestion");
  // Enter sends, Shift+Enter breaks the line — the messenger convention the panel now imitates
  input.addEventListener("keydown", event => {
    const key = event as KeyboardEvent;
    if (key.key !== "Enter" || key.shiftKey || key.isComposing) return;
    key.preventDefault();
    void submit(normalizeQuestion(getQuestionInput()));
  });
  input.addEventListener("input", () => resizeInput(input));
}

export function resizeInput(input: HTMLTextAreaElement): void {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, MAX_INPUT_HEIGHT)}px`;
}

// Rollover must be SHOWN, not silent: whenever the conversation id is dropped, the old
// transcript is cleared too — otherwise the next exchange reads as one continuous thread
// that stopped making sense. Used by both "New chat" and sign-out; NOT sign-in (the page
// navigates away anyway).
function resetConversationLog(): void {
  clearConversationId();
  const log = ensureEl("helpAssistantLog");
  log.textContent = "";

  const { row, stack } = buildMessageRow("bot");
  const bubble = document.createElement("div");
  bubble.className = "helpAssistantBubble";
  bubble.textContent = INIT_MESSAGE;
  stack.appendChild(bubble);
  log.appendChild(row);

  setNotice(null);
}

function getQuestionInput(): string {
  return ensureEl<HTMLTextAreaElement>("helpAssistantQuestion").value;
}

// isRetry marks an automatic re-submission of a rate-limited question after its countdown —
// distinct from the user clicking Ask again, which always starts a fresh retry chain.
async function submit(question: string | null, isRetry = false): Promise<void> {
  if (!question) return;
  const button = ensureEl<HTMLButtonElement>("helpAssistantAsk");
  if (button.disabled) return;

  button.disabled = true;
  if (!isRetry) appendQuestion(question);
  const typing = appendTyping();

  const sentId = getConversationId();
  try {
    const { answer, conversationId, requestId } = await ask(question, sentId ?? undefined);
    const isNew = isNewConversation(sentId, conversationId);
    // Pure storage — safe to do even if the dialog was closed during a slow ask, so it runs
    // before the isMounted() guard: otherwise closing the dialog mid-ask would lose the
    // server-issued id and silently orphan the conversation.
    adoptConversationId(conversationId);
    if (!isMounted()) return;
    typing.remove();
    if (isNew) appendDivider();
    appendAnswer(renderMarkdown(answer), requestId);
    const input = ensureEl<HTMLTextAreaElement>("helpAssistantQuestion");
    input.value = "";
    resizeInput(input);
    setNotice(null);
    autoRetried = false;
  } catch (error) {
    if (!isMounted()) return;
    typing.remove();
    if (error instanceof HelpApiError) {
      // A poisoned/rejected id is the server's most likely reason for invalid_request — start
      // the next ask clean rather than repeating the same 400 forever.
      if (error.code === "invalid_request") clearConversationId();
      applyNotice(noticeFor(error), error, question);
    } else console.error(error);
  } finally {
    if (isMounted()) {
      if (!button.dataset.locked) button.disabled = false;
      void refreshLimits();
    }
  }
}

// The question is the user's own text: insert via textContent, never as markup
function appendQuestion(text: string): void {
  const { row, stack } = buildMessageRow("user");
  const bubble = document.createElement("div");
  bubble.className = "helpAssistantBubble";
  bubble.textContent = text;
  stack.appendChild(bubble);
  appendToLog(row);
}

function appendTyping(): HTMLElement {
  const row = buildTypingRow();
  appendToLog(row);
  return row;
}

function appendDivider(): void {
  const divider = document.createElement("div");
  divider.className = "helpAssistantDivider";
  divider.textContent = "new conversation";
  appendToLog(divider);
}

// renderMarkdown output only — the renderer escapes every leaf
function appendAnswer(safeHtml: string, requestId: number | null): void {
  const { row, stack } = buildMessageRow("bot");
  const bubble = document.createElement("div");
  bubble.className = "helpAssistantBubble";
  bubble.innerHTML = safeHtml;
  stack.appendChild(bubble);
  // requestId null means there is nothing server-side to rate — no control (never post null)
  if (requestId !== null) stack.appendChild(buildFeedbackControl(requestId));
  appendToLog(row);
}

export function buildFeedbackControl(requestId: number): HTMLElement {
  const row = document.createElement("div");
  row.className = "helpAssistantFeedback";

  for (const rating of ["up", "down"] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = rating === "up" ? "👍" : "👎";
    button.setAttribute("aria-label", rating === "up" ? "Good answer" : "Bad answer");
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      const previous = row.querySelector(".selected");
      previous?.classList.remove("selected");
      previous?.setAttribute("aria-pressed", "false");
      button.classList.add("selected");
      button.setAttribute("aria-pressed", "true");
      // a failed post is a silent nicety-miss: revert the selection, never a widget state
      sendFeedback(requestId, rating).catch((error: unknown) => {
        button.classList.remove("selected");
        button.setAttribute("aria-pressed", "false");
        previous?.classList.add("selected");
        previous?.setAttribute("aria-pressed", "true");
        // the shared transport already cleared the token on a 401 — resync the footer
        // instead of leaving it stuck claiming "Signed in"
        if (error instanceof HelpApiError && error.code === "unauthorized") void refreshLimits();
      });
    });
    row.appendChild(button);
  }
  return row;
}

function appendToLog(node: HTMLElement): void {
  const log = ensureEl("helpAssistantLog");
  log.appendChild(node);
  log.scrollTop = log.scrollHeight;
}

function setNotice(safeHtml: string | null): void {
  const notice = ensureEl("helpAssistantNotice");
  notice.hidden = safeHtml === null;
  notice.innerHTML = safeHtml ?? "";
}

let retryTimer: ReturnType<typeof setInterval> | null = null;
let autoRetried = false;

function stopRetryTimer(): void {
  if (!retryTimer) return;
  clearInterval(retryTimer);
  retryTimer = null;
}

function applyNotice(notice: WidgetNotice, error: HelpApiError, question: string): void {
  setNotice(notice.html);
  const button = ensureEl<HTMLButtonElement>("helpAssistantAsk");
  stopRetryTimer();

  if (!notice.askDisabled) return;
  button.disabled = true;
  button.dataset.locked = "true";

  // cap_reached/quota/blocked have no countdown: the notice text is the whole story
  if (notice.retryCountdown === undefined) return;

  // the wait lives in the notice, not on the send button — an icon button has no room for it
  const countdown = document.createElement("div");
  countdown.className = "helpAssistantCountdown";
  ensureEl("helpAssistantNotice").appendChild(countdown);

  const autoRetry = shouldAutoRetry(error, autoRetried);
  let secondsLeft = notice.retryCountdown;
  countdown.textContent = `Ready again in ${secondsLeft}s`;
  retryTimer = setInterval(() => {
    secondsLeft -= 1;
    if (secondsLeft > 0) {
      countdown.textContent = `Ready again in ${secondsLeft}s`;
      return;
    }
    stopRetryTimer();
    delete button.dataset.locked;
    button.disabled = false;
    setNotice(null);
    if (autoRetry && isMounted()) {
      autoRetried = true;
      void submit(question, true);
    }
  }, 1000);
}

const canSignIn = (): boolean => import.meta.env.DEV || location.origin === OFFICIAL_ORIGIN;

function renderAuth(tier: string): void {
  const host = document.getElementById("helpAssistantAuth");
  if (!host) return;
  host.textContent = "";

  if (tier === "anonymous") {
    if (!canSignIn()) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "helpAssistantLink";
    button.textContent = "Sign in";
    button.title = "Sign in with Discord for more questions a day";
    button.addEventListener("click", () => {
      clearConversationId();
      signIn();
    });
    host.appendChild(button);
    return;
  }

  const label = document.createElement("span");
  label.className = "helpAssistantTier";
  label.textContent = `Signed in (${tier})`;
  const out = document.createElement("button");
  out.type = "button";
  out.className = "helpAssistantLink";
  out.textContent = "Sign out";
  out.addEventListener("click", () => {
    void signOut().then(() => {
      resetConversationLog();
      void refreshLimits();
    });
  });
  host.appendChild(label);
  host.appendChild(out);
}

async function refreshLimits(): Promise<void> {
  try {
    const limits = await getLimits();
    ensureEl("helpAssistantLimits").textContent = limitsLabel(limits);
    renderAuth(limits.tier);
  } catch {
    // limits are a nicety; asking still reports the authoritative state. Render auth from
    // local state rather than dropping it — a signed-in user must keep the sign-out affordance
    // even when /v1/limits is failing.
    renderAuth(getToken() ? "member" : "anonymous");
  }
}

// Declined states are designed states: the budget/quota text arrives display-ready from the
// server (with live links) and is rendered verbatim — never composed here.
export function noticeFor(error: HelpApiError): WidgetNotice {
  const html = renderMarkdown(error.message);
  switch (error.code) {
    case "cap_reached":
    case "quota":
    case "blocked":
      return { html, askDisabled: true };
    case "rate_limited":
      return { html, askDisabled: true, retryCountdown: error.retryAfter ?? DEFAULT_RETRY_SECONDS };
    default:
      return { html, askDisabled: false };
  }
}

// One automatic retry only where the server sent a retryAfter — never on the client's default
// countdown, and never twice in a row for the same failure chain.
export function shouldAutoRetry(error: HelpApiError, alreadyRetried: boolean): boolean {
  return error.code === "rate_limited" && error.retryAfter !== undefined && !alreadyRetried;
}

export function limitsLabel(limits: Limits): string {
  if (limits.remaining <= 0) return "No questions left today";
  return `${limits.remaining} question${limits.remaining === 1 ? "" : "s"} left today`;
}

export function normalizeQuestion(raw: string): string | null {
  const question = raw.trim();
  if (!question.length || question.length > MAX_QUESTION_LENGTH) return null;
  return question;
}

export const HelpAssistant = { open, toggle };
