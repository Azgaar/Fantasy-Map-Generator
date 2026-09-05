// First-party help assistant: asks the fmg-bot gateway one question at a time and renders the
// answer as escaped markdown. Replaces the OpenWidget bubble. Client design spec:
// docs/superpowers/specs/2026-09-01-help-box-client-design.md (fork repo).

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

export interface WidgetNotice {
  html: string;
  askDisabled: boolean;
  retryCountdown?: number;
}

const DEFAULT_RETRY_SECONDS = 30;

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

const MAX_QUESTION_LENGTH = 1000;

export function normalizeQuestion(raw: string): string | null {
  const question = raw.trim();
  if (!question.length || question.length > MAX_QUESTION_LENGTH) return null;
  return question;
}

const isOfficialOrigin = (): boolean => location.origin === OFFICIAL_ORIGIN || import.meta.env.DEV;

function isMounted(): boolean {
  return document.getElementById("helpAssistant") !== null;
}

function open(): void {
  renderDialog();

  $("#helpAssistant").dialog({
    title: "Azgaar's Assistant",
    position: { my: "center", at: "center", of: "svg" },
    width: Math.min(420, window.innerWidth - 20), // fixed sane width — FMG dialogs otherwise grow with content
    resizable: false,
    close: () => {
      if (retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
      autoRetried = false;
      destroyDialog("helpAssistant");
    }
  });

  if (isOfficialOrigin()) void refreshLimits();
}

function renderDialog(): void {
  destroyDialog("helpAssistant");

  const form = /* html */ `
    <a href="#" id="helpAssistantNewChat" class="helpAssistantNewChat">New chat</a>
    <div id="helpAssistantLog" class="helpAssistantLog">
      <p>Ask anything about using the Fantasy Map Generator.</p>
    </div>
    <div id="helpAssistantNotice" hidden></div>
    <textarea id="helpAssistantQuestion" rows="3" maxlength="1000"
      placeholder="e.g. How do I export my map as SVG?"></textarea>
    <div class="helpAssistantFooter">
      <span id="helpAssistantLimits"></span>
      <span id="helpAssistantAuth"></span>
      <button id="helpAssistantAsk">Ask</button>
    </div>
    <div class="helpAssistantDisclosure">Questions are kept for 90 days to help improve the documentation.</div>`;

  // The community channels the OpenWidget panel used to offer — alternative ways to get help.
  // GitHub points at the wiki (a turned-away user wants docs, not source). Patreon lives HERE
  // deliberately and must NOT be added to the cap_reached text — that asymmetry is a ruling.
  const links = /* html */ `
    <div class="helpAssistantLinks">
      <a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki" target="_blank" rel="noopener noreferrer">GitHub</a>
      <a href="https://discordapp.com/invite/X7E84HU" target="_blank" rel="noopener noreferrer">Discord</a>
      <a href="https://www.reddit.com/r/FantasyMapGenerator/" target="_blank" rel="noopener noreferrer">Reddit</a>
      <a href="https://www.patreon.com/azgaar" target="_blank" rel="noopener noreferrer">Patreon</a>
    </div>`;

  // Self-hosted copies are not on the gateway's origin allowlist: explain, don't error
  const unlisted = /* html */ `
    <div class="helpAssistantUnlisted">
      <p>The free assistant is only available on the official site:
        <a href="https://azgaar.github.io/Fantasy-Map-Generator/" target="_blank" rel="noopener noreferrer">
          azgaar.github.io/Fantasy-Map-Generator</a>.</p>
      <p>On a self-hosted copy, the
        <a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki" target="_blank" rel="noopener noreferrer">documentation</a>
        covers most questions.</p>
    </div>`;

  const html = /* html */ `<div id="helpAssistant" class="dialog stable">
    ${isOfficialOrigin() ? form : unlisted}
    ${links}
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  if (!isOfficialOrigin()) return;
  ensureEl("helpAssistantAsk").addEventListener("click", () => void submit(normalizeQuestion(getQuestionInput())));
  ensureEl("helpAssistantQuestion").addEventListener("keydown", event => {
    if (
      (event as KeyboardEvent).key === "Enter" &&
      ((event as KeyboardEvent).ctrlKey || (event as KeyboardEvent).metaKey)
    ) {
      void submit(normalizeQuestion(getQuestionInput()));
    }
  });
  ensureEl("helpAssistantNewChat").addEventListener("click", event => {
    event.preventDefault();
    resetConversationLog();
  });
}

// Rollover must be SHOWN, not silent: whenever the conversation id is dropped, the old
// transcript is cleared too — otherwise the next exchange reads as one continuous thread
// that stopped making sense. Used by both "New chat" and sign-out; NOT sign-in (the page
// navigates away anyway).
function resetConversationLog(): void {
  clearConversationId();
  const log = ensureEl("helpAssistantLog");
  log.textContent = "";
  const welcome = document.createElement("p");
  welcome.textContent = "Ask anything about using the Fantasy Map Generator.";
  log.appendChild(welcome);
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
  button.disabled = true;
  button.textContent = "Asking…";
  if (!isRetry) appendEntry("helpAssistantAsked", question);

  const sentId = getConversationId();
  try {
    const { answer, conversationId, requestId } = await ask(question, sentId ?? undefined);
    const isNew = isNewConversation(sentId, conversationId);
    // Pure storage — safe to do even if the dialog was closed during a slow ask, so it runs
    // before the isMounted() guard: otherwise closing the dialog mid-ask would lose the
    // server-issued id and silently orphan the conversation.
    adoptConversationId(conversationId);
    if (!isMounted()) return;
    if (isNew) appendDivider();
    appendAnswer(renderMarkdown(answer), requestId);
    ensureEl<HTMLTextAreaElement>("helpAssistantQuestion").value = "";
    setNotice(null);
    autoRetried = false;
  } catch (error) {
    if (!isMounted()) return;
    if (error instanceof HelpApiError) {
      // A poisoned/rejected id is the server's most likely reason for invalid_request — start
      // the next ask clean rather than repeating the same 400 forever.
      if (error.code === "invalid_request") clearConversationId();
      applyNotice(noticeFor(error), error, question);
    } else console.error(error);
  } finally {
    if (isMounted()) {
      if (!button.dataset.locked) {
        button.disabled = false;
        button.textContent = "Ask";
      }
      void refreshLimits();
    }
  }
}

// The question is the user's own text: insert via textContent, never as markup
function appendEntry(className: string, text: string): void {
  const entry = document.createElement("p");
  entry.className = className;
  entry.textContent = text;
  appendToLog(entry);
}

function appendDivider(): void {
  const divider = document.createElement("div");
  divider.className = "helpAssistantDivider";
  divider.textContent = "— new conversation —";
  appendToLog(divider);
}

// renderMarkdown output only — the renderer escapes every leaf
function appendAnswer(safeHtml: string, requestId: number | null): void {
  const entry = document.createElement("div");
  entry.className = "helpAssistantAnswer";
  entry.innerHTML = safeHtml;
  // requestId null means there is nothing server-side to rate — no control (never post null)
  if (requestId !== null) entry.appendChild(buildFeedbackControl(requestId));
  appendToLog(entry);
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

function applyNotice(notice: WidgetNotice, error: HelpApiError, question: string): void {
  setNotice(notice.html);
  const button = ensureEl<HTMLButtonElement>("helpAssistantAsk");
  if (retryTimer) clearInterval(retryTimer);

  if (!notice.askDisabled) return;
  button.disabled = true;
  button.dataset.locked = "true";

  if (notice.retryCountdown === undefined) {
    button.textContent = "Ask"; // stable label — cap_reached/quota/blocked have no countdown
    return;
  }

  const autoRetry = shouldAutoRetry(error, autoRetried);
  let secondsLeft = notice.retryCountdown;
  button.textContent = `Wait ${secondsLeft}s`;
  retryTimer = setInterval(() => {
    secondsLeft -= 1;
    if (secondsLeft > 0) {
      button.textContent = `Wait ${secondsLeft}s`;
      return;
    }
    if (retryTimer) clearInterval(retryTimer);
    retryTimer = null;
    delete button.dataset.locked;
    button.disabled = false;
    button.textContent = "Ask";
    setNotice(null);
    if (autoRetry && isMounted()) {
      autoRetried = true;
      void submit(question, true);
    }
  }, 1000);
}

// Sign-in is shown only on the exact official origin (or DEV, where the stub closes the
// loop) — NOT via isOfficialOrigin(): a staging build widens that gate, and sign-in from
// staging would land the user on production with their token (server redirect is fixed).
const canSignIn = (): boolean => import.meta.env.DEV || location.origin === OFFICIAL_ORIGIN;

function renderAuth(tier: string): void {
  const host = document.getElementById("helpAssistantAuth");
  if (!host) return;
  host.textContent = "";

  if (tier === "anonymous") {
    if (!canSignIn()) return;
    const button = document.createElement("button");
    button.textContent = "Sign in with Discord for more";
    button.addEventListener("click", () => {
      clearConversationId();
      signIn();
    });
    host.appendChild(button);
    return;
  }

  const label = document.createElement("span");
  label.textContent = `Signed in (${tier}) · `;
  const out = document.createElement("a");
  out.href = "#";
  out.textContent = "Sign out";
  out.addEventListener("click", event => {
    event.preventDefault();
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

export const HelpAssistant = { open };
