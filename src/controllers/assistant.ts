import { destroyDialog } from "@/components/dialog/dialog-helpers";
import type { Limits } from "@/services/assistant/gateway/api";
import {
  ask,
  GatewayError,
  getLimits,
  OFFICIAL_ORIGIN,
  sendFeedback,
  signIn,
  signOut
} from "@/services/assistant/gateway/api";
import { getToken } from "@/services/assistant/gateway/auth";
import {
  adoptConversationId,
  clearConversationId,
  getConversationId,
  isNewConversation
} from "@/services/assistant/gateway/conversation";
import { renderMarkdown } from "@/utils/markdown";
import { ensureEl } from "../utils";
import { mountMapPanel, refreshMapContext, unmountMapPanel } from "./assistant-map";

// The dialog opens on Help (wiki-grounded gateway answers) unless a contextual entry point — the
// Tools menu button or the notes editor — asks for This map, the own-key Assistant over the open map.
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
  return document.getElementById("assistant") !== null;
}

// The call button mirrors the dialog: while the panel is up it shows a close glyph, so a
// second click on it reads as "close" rather than "open again"
function markBubble(isOpen: boolean): void {
  const bubble = document.getElementById("assistantBubble");
  if (!bubble) return;
  bubble.classList.toggle("open", isOpen);
  bubble.setAttribute("aria-expanded", String(isOpen));
}

function toggle(): void {
  if (isMounted()) $("#assistant").dialog("close");
  else open();
}

// A chat panel is a companion to the map, not a modal over it: it takes the bottom-right
// corner — over its own call button, which the title bar's close then stands in for.
function open(options: OpenOptions = {}): void {
  const mode = options.mode ?? "help";
  if (isMounted()) {
    setMode(mode);
    $("#assistant").dialog("moveToTop");
    return;
  }
  renderDialog();

  const width = Math.min(400, window.innerWidth - 24);
  const chatHeight = Math.min(560, window.innerHeight - 140);

  $("#assistant").dialog({
    title: "Azgaar Assistant",
    position: { my: "right bottom", at: "right-16 bottom-44", of: window },
    width,
    height: chatHeight,
    minWidth: 300,
    minHeight: 320,
    resizable: true,
    close: () => {
      stopRetryTimer();
      autoRetried = false;
      markBubble(false);
      unmountMapPanel();
      destroyDialog("assistant");
    }
  });

  markBubble(true);
  if (isOfficialOrigin()) {
    addTitlebarNewChat();
    void refreshLimits();
  }
  setMode(mode);
}

// "New chat" belongs with close and minimize: a window action, not chat content. Its own button,
// apart from the layout reset one, so it is there whether or not the dialog was ever moved
function addTitlebarNewChat(): void {
  const titlebar = document.getElementById("assistant")?.closest(".ui-dialog")?.querySelector(".ui-dialog-titlebar");
  if (!titlebar || titlebar.querySelector("#assistantNewChat")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.id = "assistantNewChat";
  button.className = "assistantNewChat icon-plus";
  button.dataset.tip = "Start a new chat";
  button.setAttribute("aria-label", "Start a new chat");
  button.addEventListener("click", resetConversationLog);
  titlebar.insertBefore(button, titlebar.querySelector(".ui-dialog-titlebar-reset, .ui-dialog-titlebar-collapse"));
}

export function setMode(mode: AssistantMode): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>("#assistant .assistantMode")) {
    const active = button.dataset.mode === mode;
    button.setAttribute("aria-selected", String(active));
    button.classList.toggle("selected", active);
  }
  ensureEl("assistantHelp").hidden = mode !== "help";
  const newChat = document.getElementById("assistantNewChat");
  if (newChat) newChat.hidden = mode !== "help";
  const mapHost = ensureEl("assistantMap");
  mapHost.hidden = mode !== "map";
  if (mode !== "map") return;
  if (!mapHost.dataset.mounted) {
    mountMapPanel(mapHost);
    mapHost.dataset.mounted = "1";
  }
  refreshMapContext();
}

function renderDialog(): void {
  destroyDialog("assistant");

  // Panel styling lives with the panel: the dialog is built here and torn down on close, so
  // its stylesheet rides along with it instead of sitting in the global sheet
  const styles = /* html */ `
    <style>
      #assistant.ui-dialog-content { display: flex; flex-direction: column; gap: .5em; overflow: hidden; padding: .6em .7em .5em; font-family: var(--sans-serif); }
      #assistant > div          { width: auto; }
      .ui-dialog-titlebar .assistantNewChat { font-size: .62em; }

      #assistant .assistantLog   { flex: 1; min-height: 0; overflow: hidden auto; padding-right: .2em; line-height: 1.4; }
      #assistant .assistantMsg   { display: flex; margin-bottom: .55em; }
      #assistant .assistantMsg.user { justify-content: flex-end; }
      #assistant .assistantStack { display: flex; flex-direction: column; min-width: 0; max-width: 88%; }
      #assistant .assistantBubble { padding: .45em .65em; border-radius: .4em; background: rgb(0 0 0 / 6%); overflow-wrap: anywhere; }
      #assistant .assistantMsg.user .assistantBubble   { background: var(--header); color: #ffffff; }
      #assistant .assistantMsg.user .assistantBubble a { color: #ffffff; }

      /* answers are rendered markdown: keep block spacing tight enough to read as one message */
      #assistant .assistantBubble > :first-child { margin-top: 0; }
      #assistant .assistantBubble > :last-child  { margin-bottom: 0; }
      #assistant .assistantBubble p              { margin: .4em 0; }
      #assistant .assistantBubble :is(h3, h4, h5, h6) { margin: .6em 0 .3em; font-size: 1em; }
      #assistant .assistantBubble :is(ol, ul)    { margin: .4em 0; padding-left: 1.3em; }
      #assistant .assistantBubble pre            { overflow-x: auto; margin: .4em 0; padding: .4em .5em; border-radius: .3em; background: rgb(0 0 0 / 6%); font-size: .9em; }
      #assistant .assistantBubble code           { font-family: var(--monospace); }
      #assistant .assistantBubble table          { display: block; overflow-x: auto; border-collapse: collapse; }
      #assistant .assistantBubble :is(td, th)    { padding: .15em .4em; border: 1px solid rgb(0 0 0 / 12%); }

      /* three dots standing in for the answer while the gateway is thinking */
      #assistant .assistantTyping   { display: flex; align-items: center; gap: .28em; padding: .65em; }
      #assistant .assistantTyping i { width: .4em; height: .4em; border-radius: 50%; background: currentcolor; opacity: .35; animation: assistantTyping 1.2s infinite ease-in-out; }
      #assistant .assistantTyping i:nth-child(2) { animation-delay: .15s; }
      #assistant .assistantTyping i:nth-child(3) { animation-delay: .3s; }
      @keyframes assistantTyping { 0%, 60%, 100% { opacity: .25; transform: none; } 30% { opacity: .8; transform: translateY(-.18em); } }
      @media (prefers-reduced-motion: reduce) { #assistant .assistantTyping i { animation: none; } }

      #assistant .assistantDivider { display: flex; align-items: center; gap: .6em; margin: .6em 0; opacity: .5; font-size: .82em; text-transform: uppercase; letter-spacing: .06em; }
      #assistant .assistantDivider::before,
      #assistant .assistantDivider::after { content: ""; flex: 1; height: 1px; background: currentcolor; }

      #assistant .assistantFeedback        { display: flex; gap: .2em; margin-top: .15em; }
      #assistant .assistantFeedback button { padding: 0 .15em; border: none; background: none; opacity: .35; font-size: .9em; transition: .15s; }
      #assistant .assistantFeedback button:hover    { opacity: .75; }
      #assistant .assistantFeedback button.selected { opacity: 1; }

      /* server refusals and countdowns: loud enough to notice, quiet enough to stay out of the way */
      #assistant .assistantNotice { flex: none; max-height: 30%; overflow-y: auto; padding: .45em .6em; border-left: 3px solid var(--header); border-radius: .25em; background: rgb(0 0 0 / 5%); font-size: .9em; }
      #assistant .assistantNotice > :first-child { margin-top: 0; }
      #assistant .assistantNotice > :last-child  { margin-bottom: 0; }
      #assistant .assistantCountdown { margin-top: .3em; opacity: .7; font-variant-numeric: tabular-nums; }

      #assistant .assistantComposer          { flex: none; display: flex; align-items: flex-end; gap: .4em; padding: .3em .3em .3em .5em; border: 1px solid rgb(0 0 0 / 18%); border-radius: .5em; background: rgb(255 255 255 / 55%); transition: border-color .15s; }
      #assistant .assistantComposer:focus-within { border-color: var(--header); }
      #assistant .assistantComposer textarea { flex: 1; min-width: 0; height: 1.7em; max-height: ${MAX_INPUT_HEIGHT}px; padding: .2em 0; border: 0; background: none; resize: none; font: inherit; line-height: 1.4; }
      #assistant .assistantSend              { flex: none; display: flex; align-items: center; justify-content: center; width: 1.9em; height: 1.9em; border: 0; border-radius: .4em; background: var(--header); color: #ffffff; font-size: 1em; transition: .15s; }
      #assistant .assistantSend::before      { margin: 0; }
      #assistant .assistantSend:hover        { background: var(--header-active); }
      #assistant .assistantSend:disabled     { opacity: .4; cursor: default; }

      /* quick links and the account state: present, but plainly secondary to the transcript */
      #assistant .assistantBar     { flex: none; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .2em .8em; padding-top: .4em; border-top: 1px solid rgb(0 0 0 / 10%); font-size: .9em; }
      #assistant .assistantLinks   { display: flex; gap: .8em; }
      #assistant .assistantAccount { display: flex; align-items: center; gap: .5em; opacity: .85; }
      #assistant .assistantLink        { padding: 0; border: 0; background: none; color: inherit; font: inherit; text-decoration: underline; }
      #assistant .assistantLink:hover  { color: var(--header-active); }

      #assistant .assistantUnlisted { flex: none; line-height: 1.4; }
    </style>`;

  const chat = /* html */ `
    <div id="assistantLog" class="assistantLog" role="log" aria-live="polite"></div>
    <div id="assistantNotice" class="assistantNotice" hidden></div>
    <div class="assistantComposer">
      <textarea id="assistantQuestion" rows="1" maxlength="1000" aria-label="Your question"
        placeholder="Ask a question…"></textarea>
      <button id="assistantAsk" type="button" class="assistantSend icon-right-big"
        title="Send (Enter)" aria-label="Send"></button>
    </div>`;

  // Self-hosted copies are not on the gateway's origin allowlist: explain, don't error
  const unlisted = /* html */ `
    <div class="assistantUnlisted">
      <div class="assistantMsg bot">
        <div class="assistantStack">
          <div class="assistantBubble">
            <p>The free assistant is only available on the official site: <a href="https://azgaar.github.io/Fantasy-Map-Generator/" target="_blank" rel="noopener noreferrer"> azgaar.github.io/Fantasy-Map-Generator</a>. On a self-hosted copy, the <a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki" target="_blank" rel="noopener noreferrer">documentation</a> covers most questions.</p>
          </div>
        </div>
      </div>
    </div>`;

  const bar = /* html */ `
    <div class="assistantBar">
      <div class="assistantLinks">
        <a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki" target="_blank" rel="noopener noreferrer">Wiki</a>
        <a href="https://discordapp.com/invite/X7E84HU" target="_blank" rel="noopener noreferrer">Discord</a>
        <a href="https://www.reddit.com/r/FantasyMapGenerator/" target="_blank" rel="noopener noreferrer">Reddit</a>
        <a href="https://www.patreon.com/azgaar" target="_blank" rel="noopener noreferrer">Patreon</a>
        <a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Policy" target="_blank" rel="noopener noreferrer"
          title="What is sent, how long questions are kept, and the rest of the small print">Policy</a>
      </div>
      <div class="assistantAccount">
        <span id="assistantLimits"></span>
        <span id="assistantAuth"></span>
      </div>
    </div>`;

  const modes = /* html */ `
    <div class="assistantModes" role="tablist">
      <button type="button" class="assistantMode icon-help-circled" data-mode="help" role="tab" aria-selected="true"
        data-tip="Ask how to use the map generator — answers come from the documentation">Help</button>
      <button type="button" class="assistantMode icon-robot" data-mode="map" role="tab" aria-selected="false"
        data-tip="Ask about, or edit, the map you have open using your own AI key">This map</button>
    </div>`;

  const html = /* html */ `<div id="assistant" class="dialog stable">
    ${styles}
    ${modes}
    <div id="assistantHelp" class="assistantPanel">
      ${isOfficialOrigin() ? chat : unlisted}
      ${bar}
    </div>
    <div id="assistantMap" class="assistantPanel" hidden></div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  for (const button of document.querySelectorAll<HTMLButtonElement>("#assistant .assistantMode")) {
    button.addEventListener("click", () => setMode(button.dataset.mode as AssistantMode));
  }

  if (!isOfficialOrigin()) return;
  resetConversationLog();

  ensureEl("assistantAsk").addEventListener("click", () => void submit(normalizeQuestion(getQuestionInput())));

  const input = ensureEl<HTMLTextAreaElement>("assistantQuestion");
  // Enter sends, Shift+Enter breaks the line — the messenger convention the panel now imitates
  input.addEventListener("keydown", event => {
    const key = event as KeyboardEvent;
    if (key.key !== "Enter" || key.shiftKey || key.isComposing) return;
    key.preventDefault();
    void submit(normalizeQuestion(getQuestionInput()));
  });
  input.addEventListener("input", () => resizeInput(input));
}

function resizeInput(input: HTMLTextAreaElement): void {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, MAX_INPUT_HEIGHT)}px`;
}

// Rollover must be SHOWN, not silent: whenever the conversation id is dropped, the old
// transcript is cleared too — otherwise the next exchange reads as one continuous thread
// that stopped making sense. Used by both "New chat" and sign-out; NOT sign-in (the page
// navigates away anyway).
function resetConversationLog(): void {
  clearConversationId();
  const log = ensureEl("assistantLog");
  log.textContent = "";

  const { row, stack } = buildMessageRow("bot");
  const bubble = document.createElement("div");
  bubble.className = "assistantBubble";
  bubble.textContent = INIT_MESSAGE;
  stack.appendChild(bubble);
  log.appendChild(row);

  setNotice(null);
}

function getQuestionInput(): string {
  return ensureEl<HTMLTextAreaElement>("assistantQuestion").value;
}

// isRetry marks an automatic re-submission of a rate-limited question after its countdown —
// distinct from the user clicking Ask again, which always starts a fresh retry chain.
async function submit(question: string | null, isRetry = false): Promise<void> {
  if (!question) return;
  const button = ensureEl<HTMLButtonElement>("assistantAsk");
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
    const input = ensureEl<HTMLTextAreaElement>("assistantQuestion");
    input.value = "";
    resizeInput(input);
    setNotice(null);
    autoRetried = false;
  } catch (error) {
    if (!isMounted()) return;
    typing.remove();
    if (error instanceof GatewayError) {
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

// Side is the whole distinction: the assistant speaks from the left, the user from the right
function buildMessageRow(role: "user" | "bot"): { row: HTMLElement; stack: HTMLElement } {
  const row = document.createElement("div");
  row.className = `assistantMsg ${role}`;

  const stack = document.createElement("div");
  stack.className = "assistantStack";
  row.appendChild(stack);
  return { row, stack };
}

// The question is the user's own text: insert via textContent, never as markup
function appendQuestion(text: string): void {
  const { row, stack } = buildMessageRow("user");
  const bubble = document.createElement("div");
  bubble.className = "assistantBubble";
  bubble.textContent = text;
  stack.appendChild(bubble);
  appendToLog(row);
}

function appendTyping(): HTMLElement {
  const { row, stack } = buildMessageRow("bot");
  const bubble = document.createElement("div");
  bubble.className = "assistantBubble assistantTyping";
  bubble.setAttribute("aria-label", "Thinking…");
  bubble.innerHTML = "<i></i><i></i><i></i>";
  stack.appendChild(bubble);
  appendToLog(row);
  return row;
}

function appendDivider(): void {
  const divider = document.createElement("div");
  divider.className = "assistantDivider";
  divider.textContent = "new conversation";
  appendToLog(divider);
}

// renderMarkdown output only — the renderer escapes every leaf
function appendAnswer(safeHtml: string, requestId: number | null): void {
  const { row, stack } = buildMessageRow("bot");
  const bubble = document.createElement("div");
  bubble.className = "assistantBubble";
  bubble.innerHTML = safeHtml;
  stack.appendChild(bubble);
  // requestId null means there is nothing server-side to rate — no control (never post null)
  if (requestId !== null) stack.appendChild(buildFeedbackControl(requestId));
  appendToLog(row);
}

export function buildFeedbackControl(requestId: number): HTMLElement {
  const row = document.createElement("div");
  row.className = "assistantFeedback";

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
        if (error instanceof GatewayError && error.code === "unauthorized") void refreshLimits();
      });
    });
    row.appendChild(button);
  }
  return row;
}

function appendToLog(node: HTMLElement): void {
  const log = ensureEl("assistantLog");
  log.appendChild(node);
  log.scrollTop = log.scrollHeight;
}

function setNotice(safeHtml: string | null): void {
  const notice = ensureEl("assistantNotice");
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

function applyNotice(notice: WidgetNotice, error: GatewayError, question: string): void {
  setNotice(notice.html);
  const button = ensureEl<HTMLButtonElement>("assistantAsk");
  stopRetryTimer();

  if (!notice.askDisabled) return;
  button.disabled = true;
  button.dataset.locked = "true";

  // cap_reached/quota/blocked have no countdown: the notice text is the whole story
  if (notice.retryCountdown === undefined) return;

  // the wait lives in the notice, not on the send button — an icon button has no room for it
  const countdown = document.createElement("div");
  countdown.className = "assistantCountdown";
  ensureEl("assistantNotice").appendChild(countdown);

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
  const host = document.getElementById("assistantAuth");
  if (!host) return;
  host.textContent = "";

  if (tier === "anonymous") {
    if (!canSignIn()) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "assistantLink";
    button.textContent = "Sign in";
    button.title = "Sign in with Discord for more questions a day";
    button.addEventListener("click", () => {
      clearConversationId();
      signIn();
    });
    host.appendChild(button);
    return;
  }

  const out = document.createElement("button");
  out.type = "button";
  out.className = "assistantLink";
  out.textContent = "Sign out";
  out.addEventListener("click", () => {
    void signOut().then(() => {
      resetConversationLog();
      void refreshLimits();
    });
  });
  host.appendChild(out);
}

async function refreshLimits(): Promise<void> {
  try {
    const limits = await getLimits();
    ensureEl("assistantLimits").textContent = limitsLabel(limits);
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
export function noticeFor(error: GatewayError): WidgetNotice {
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
export function shouldAutoRetry(error: GatewayError, alreadyRetried: boolean): boolean {
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

export const Assistant = { open, toggle };
