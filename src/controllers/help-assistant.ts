// First-party help assistant: asks the fmg-bot gateway one question at a time and renders the
// answer as escaped markdown. Replaces the OpenWidget bubble. Client design spec:
// docs/superpowers/specs/2026-09-01-help-box-client-design.md (fork repo).

import { destroyDialog } from "@/components/dialog/dialog-helpers";
import type { Limits } from "@/services/help/api";
import { ask, getLimits, HelpApiError, OFFICIAL_ORIGIN } from "@/services/help/api";
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
    <div id="helpAssistantLog" class="helpAssistantLog">
      <p>Ask anything about using the Fantasy Map Generator.</p>
    </div>
    <div id="helpAssistantNotice" hidden></div>
    <textarea id="helpAssistantQuestion" rows="3" maxlength="1000"
      placeholder="e.g. How do I export my map as SVG?"></textarea>
    <div class="helpAssistantFooter">
      <span id="helpAssistantLimits"></span>
      <button id="helpAssistantAsk">Ask</button>
    </div>
    <div class="helpAssistantDisclosure">Questions are kept for 90 days to help improve the documentation.</div>`;

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

  try {
    const { answer } = await ask(question);
    if (!isMounted()) return;
    appendAnswer(renderMarkdown(answer));
    ensureEl<HTMLTextAreaElement>("helpAssistantQuestion").value = "";
    setNotice(null);
    autoRetried = false;
  } catch (error) {
    if (!isMounted()) return;
    if (error instanceof HelpApiError) applyNotice(noticeFor(error), error, question);
    else console.error(error);
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

// renderMarkdown output only — the renderer escapes every leaf
function appendAnswer(safeHtml: string): void {
  const entry = document.createElement("div");
  entry.className = "helpAssistantAnswer";
  entry.innerHTML = safeHtml;
  appendToLog(entry);
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

async function refreshLimits(): Promise<void> {
  try {
    const limits = await getLimits();
    ensureEl("helpAssistantLimits").textContent = limitsLabel(limits);
  } catch {
    // limits are a nicety; asking still reports the authoritative state
  }
}

export const HelpAssistant = { open };
