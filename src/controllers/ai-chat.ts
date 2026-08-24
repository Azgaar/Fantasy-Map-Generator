import { confirmationDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import {
  type Conversation,
  create,
  type Entry,
  forCurrentMap,
  isEmpty,
  list,
  type MessageRole,
  remove,
  select,
  touch
} from "@/services/agent/conversations";
import { DEFAULT_MODEL, keyStorageFor, PROVIDERS, providerOf } from "@/services/agent/providers";
import type { RunResult } from "@/services/agent/runtime";
import { createSession } from "@/services/agent/session";
import { openURL } from "@/utils";
import { renderMarkdown } from "@/utils/markdown";
import { destroyDialogIfExists, ensureEl } from "../utils";

const DIALOG_ID = "aiChat";
const MODEL_STORAGE = "fmg-ai-chat-model";
const MAX_INPUT_HEIGHT = 120;

const SUGGESTIONS = [
  "Which states have no ports?",
  "List the five largest burgs and their states",
  "How is the land split between biomes?"
];

const session = createSession(() => ({
  key: ensureEl<HTMLInputElement>("aiChatKey").value,
  model: ensureEl<HTMLSelectElement>("aiChatModel").value
}));

let conversation: Conversation;
let currentStep: HTMLDetailsElement | null = null;
let busy = false;

function open(): void {
  if (customization) {
    tip("Please exit the customization mode first", false, "error");
    return;
  }

  conversation = forCurrentMap();
  renderDialog();
  setInitialValues();
  renderConversations();
  renderTranscript();
  renderUsage();

  $(`#${DIALOG_ID}`).dialog({
    title: "AI Chat",
    width: 480,
    height: 560,
    minWidth: 320,
    minHeight: 320,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" },
    close: cleanup
  });

  ensureEl("aiChatInput").focus();
}

function renderDialog(): void {
  destroyDialogIfExists(DIALOG_ID);
  ensureEl("dialogs").insertAdjacentHTML("beforeend", dialogHtml());

  ensureEl("aiChatConversation").addEventListener("change", event => {
    conversation = select((event.target as HTMLSelectElement).value);
    renderTranscript();
    renderUsage();
  });
  ensureEl("aiChatNew").addEventListener("click", startNewConversation);
  ensureEl("aiChatRemove").addEventListener("click", removeConversation);
  ensureEl("aiChatKeyHelp").addEventListener("click", () =>
    openURL(providerOf(ensureEl<HTMLSelectElement>("aiChatModel").value).keyLink)
  );
  ensureEl("aiChatSend").addEventListener("click", () => {
    if (busy) session.cancel();
    else void send();
  });

  ensureEl("aiChatLog").addEventListener("click", event => {
    const link = (event.target as HTMLElement)?.closest?.("a[href]");
    if (!link) return;
    event.preventDefault();
    openURL(link.getAttribute("href") ?? "");
  });

  const input = ensureEl<HTMLTextAreaElement>("aiChatInput");
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, MAX_INPUT_HEIGHT)}px`;
    updateSendButton();
  });
  input.addEventListener("keydown", event => {
    if (!(event instanceof KeyboardEvent) || event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void send();
  });
}

function dialogHtml(): string {
  return /* html */ `<div id="${DIALOG_ID}" class="dialog stable" style="user-select: text">
    <style>
      #aiChat { display: flex; flex-direction: column; gap: 0.3em; height: 100%; }
      /* .dialog > div sizes children to their content; the chat wants the full width */
      #aiChat > div, #aiChat > textarea { width: auto; }
      #aiChatTop { display: flex; align-items: center; gap: 0.3em; }
      #aiChatTop > select { flex: 1; min-width: 0; }
      #aiChatLog { flex: 1 1 auto; overflow-y: auto; display: flex; flex-direction: column; gap: 0.45em; }
      #aiChatEmpty { margin: auto; display: flex; flex-direction: column; align-items: center; gap: 0.5em; text-align: center; }
      #aiChatEmpty > div { opacity: 0.7; max-width: 22em; }
      #aiChatEmpty button { padding: 0.25em 0.7em; border-radius: 1em; cursor: pointer; }
      #aiChatInput { resize: none; overflow-y: auto; }
      #aiChatBottom { display: flex; align-items: center; gap: 0.3em; flex-wrap: wrap; }
      #aiChatBottom > select { flex: 1; min-width: 6em; }
      #aiChatBottom > input { flex: 1; min-width: 5em; }
      #aiChat .aiChatUser { align-self: flex-end; max-width: 85%; padding: 0.3em 0.6em; border-radius: 0.8em 0.8em 0.2em 0.8em; background: rgba(128, 128, 128, 0.18); }
      #aiChat .aiChatAssistant { align-self: flex-start; max-width: 95%; }
      #aiChat .aiChatSystem { align-self: center; text-align: center; font-style: italic; opacity: 0.65; }
      #aiChat .aiChatError { align-self: center; text-align: center; color: #b03030; }
      #aiChat .aiChatMessage { white-space: pre-wrap; overflow-wrap: anywhere; }
      #aiChat .aiChatStep { align-self: flex-start; max-width: 100%; font-size: 0.9em; opacity: 0.8; }
      #aiChat .aiChatStep summary { cursor: pointer; user-select: none; }
      #aiChat .aiChatStep pre { margin: 0.2em 0; padding: 0.3em 0.4em; max-height: 14em; overflow: auto; border-radius: 0.3em; background: rgba(128, 128, 128, 0.12); }
      #aiChatThinking { align-self: flex-start; display: flex; align-items: center; gap: 0.4em; font-style: italic; opacity: 0.7; }
      #aiChatThinking i { width: 0.35em; height: 0.35em; border-radius: 50%; background: currentColor; animation: aiChatBlink 1.2s infinite ease-in-out; }
      #aiChatThinking i:nth-child(3) { animation-delay: 0.2s; }
      #aiChatThinking i:nth-child(4) { animation-delay: 0.4s; }
      @keyframes aiChatBlink { 0%, 70%, 100% { opacity: 0.25; } 35% { opacity: 1; } }
      #aiChat .aiChatAssistant { white-space: normal; }
      #aiChat .aiChatAssistant > :first-child { margin-top: 0; }
      #aiChat .aiChatAssistant > :last-child { margin-bottom: 0; }
      #aiChat .aiChatAssistant p { margin: 0 0 0.4em; }
      #aiChat .aiChatAssistant h3, #aiChat .aiChatAssistant h4, #aiChat .aiChatAssistant h5, #aiChat .aiChatAssistant h6 { margin: 0.5em 0 0.2em; font-size: 1em; font-weight: bold; }
      #aiChat .aiChatAssistant ul, #aiChat .aiChatAssistant ol { margin: 0.2em 0 0.4em; padding-left: 1.3em; }
      #aiChat .aiChatAssistant li { margin: 0.1em 0; }
      #aiChat .aiChatAssistant code { padding: 0 0.25em; border-radius: 0.25em; background: rgba(128, 128, 128, 0.16); font-family: monospace; }
      #aiChat .aiChatAssistant pre { margin: 0.3em 0; padding: 0.35em 0.45em; overflow-x: auto; border-radius: 0.3em; background: rgba(128, 128, 128, 0.12); }
      #aiChat .aiChatAssistant pre code { padding: 0; background: none; }
      #aiChat .aiChatAssistant table { display: block; width: max-content; max-width: 100%; margin: 0.3em 0; overflow-x: auto; border-collapse: collapse; }
      #aiChat .aiChatAssistant th, #aiChat .aiChatAssistant td { padding: 0.15em 0.45em; border: 1px solid rgba(128, 128, 128, 0.35); }
      #aiChat .aiChatAssistant th { background: rgba(128, 128, 128, 0.12); text-align: left; }
      #aiChat .aiChatAssistant blockquote { margin: 0.3em 0; padding-left: 0.6em; border-left: 2px solid rgba(128, 128, 128, 0.4); opacity: 0.85; }
      #aiChat .aiChatAssistant hr { margin: 0.4em 0; border: none; border-top: 1px solid rgba(128, 128, 128, 0.3); }
      #aiChat .aiChatAssistant a { text-decoration: underline; cursor: pointer; }
    </style>

    <div id="aiChatTop">
      <select id="aiChatConversation" data-tip="Switch between conversations. Each one is sent in full with every question, so a fresh one costs less"></select>
      <button id="aiChatNew" class="icon-plus" data-tip="Start a new conversation"></button>
      <button id="aiChatRemove" class="icon-trash" data-tip="Delete the current conversation"></button>
    </div>

    <div id="aiChatLog"></div>

    <div id="aiChatUsage" class="totalLine"></div>

    <textarea id="aiChatInput" rows="2" placeholder="Ask about the map…" data-tip="Type a question. Enter to send, Shift + Enter for a new line"></textarea>

    <div id="aiChatBottom">
      <button id="aiChatSend" class="icon-right-open" data-tip="Send the message"></button>
      <select id="aiChatModel" data-tip="Model to ask. Bigger models reason better and cost more"></select>
      <input
        id="aiChatKey"
        type="password"
        placeholder="API key"
        class="icon-key"
        data-tip="Anthropic API key. It's stored on your machine only (browser storage) and sent directly to the provider"
      />
      <button id="aiChatKeyHelp" class="icon-help-circled" data-tip="Click to see where to get the key"></button>
    </div>
  </div>`;
}

function setInitialValues(): void {
  const select = ensureEl<HTMLSelectElement>("aiChatModel");
  select.options.length = 0;
  PROVIDERS.forEach(provider => {
    const group = document.createElement("optgroup");
    group.label = provider.label;
    provider.models.forEach(model => {
      group.append(new Option(model, model));
    });
    select.append(group);
  });
  const stored = localStorage.getItem(MODEL_STORAGE) ?? "";
  select.value = PROVIDERS.some(provider => provider.models.includes(stored)) ? stored : DEFAULT_MODEL;

  select.addEventListener("change", loadKeyForModel);
  loadKeyForModel();
  updateSendButton();
}

// Each provider has its own key slot, so switching models swaps the key field with it
function loadKeyForModel(): void {
  const model = ensureEl<HTMLSelectElement>("aiChatModel").value;
  const key = ensureEl<HTMLInputElement>("aiChatKey");
  key.value = localStorage.getItem(keyStorageFor(model)) ?? "";
  key.dataset.tip = `${providerOf(model).label} API key. It's stored on your machine only (browser storage) and sent directly to the provider`;
  updateSendButton();
}

// The request outlives the dialog when it is closed mid-run, so every DOM touch below tolerates a
// missing dialog — the conversation keeps the content either way
function updateSendButton(): void {
  const button = document.getElementById("aiChatSend") as HTMLButtonElement | null;
  if (!button) return;
  button.className = busy ? "icon-cancel" : "icon-right-open";
  button.dataset.tip = busy ? "Stop the current request" : "Send the message";
  button.disabled = !busy && !ensureEl<HTMLTextAreaElement>("aiChatInput").value.trim();
}

async function send(text?: string): Promise<void> {
  if (busy) return;

  const input = ensureEl<HTMLTextAreaElement>("aiChatInput");
  const question = (text ?? input.value).trim();
  if (!question) return;

  const key = ensureEl<HTMLInputElement>("aiChatKey").value;
  if (!key) {
    ensureEl("aiChatKey").focus();
    tip("Please enter an API key", true, "error", 4000);
    return;
  }
  const model = ensureEl<HTMLSelectElement>("aiChatModel").value;
  localStorage.setItem(keyStorageFor(model), key);
  localStorage.setItem(MODEL_STORAGE, model);

  input.value = "";
  input.style.height = "auto";
  addEntry({ kind: "message", role: "user", text: question });
  renderConversations();

  busy = true;
  updateSendButton();
  showThinking("Thinking");

  try {
    await session.ask(conversation, question, {
      onText: answer => addEntry({ kind: "message", role: "assistant", text: answer }),
      onScript: code => addEntry({ kind: "script", code }),
      onScriptResult: result => completeStep(result),
      onStatus: status => (status ? showThinking(status) : hideThinking()),
      onUsage: renderUsage
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    const message = (error instanceof Error && error.message) || String(error);
    addEntry({ kind: "message", role: aborted ? "system" : "error", text: aborted ? "Stopped." : message });
  } finally {
    busy = false;
    currentStep = null;
    hideThinking();
    touch(conversation);
    if (document.getElementById(DIALOG_ID)) {
      updateSendButton();
      ensureEl("aiChatInput").focus();
    }
  }
}

function startNewConversation(): void {
  if (isEmpty(conversation)) {
    tip("This conversation is already empty", true, "warn", 3000);
    return;
  }
  conversation = create();
  renderConversations();
  renderTranscript();
  renderUsage();
}

function removeConversation(): void {
  const drop = (): void => {
    remove(conversation.id);
    conversation = forCurrentMap();
    renderConversations();
    renderTranscript();
    renderUsage();
  };

  if (isEmpty(conversation)) {
    drop();
    return;
  }
  confirmationDialog({
    title: "Delete conversation",
    message: `Delete "${conversation.title}"?<br />The conversation cannot be restored`,
    confirm: "Delete",
    onConfirm: drop
  });
}

// Rendering — the conversation is the source of truth, the log is rebuilt from it on every open

function renderConversations(): void {
  const select = document.getElementById("aiChatConversation") as HTMLSelectElement | null;
  if (!select) return;

  select.options.length = 0;
  list().forEach(item => {
    const label = item.mapId === mapId ? item.title : `${item.title} (other map)`;
    select.options.add(new Option(label, item.id));
  });
  select.value = conversation.id;
}

function renderUsage(): void {
  const line = document.getElementById("aiChatUsage");
  if (!line) return;

  const { input, output, cached } = conversation.usage;
  if (!input && !output) {
    line.textContent = "";
    return;
  }
  const cheap = cached ? `, ${thousands(cached)} cached` : "";
  line.textContent = `Tokens: ${thousands(input)} sent${cheap} · ${thousands(output)} received`;
  line.dataset.tip = "Tokens spent in this conversation. Cached tokens cost a tenth of the rest";
}

const thousands = (value: number): string => (value < 1000 ? String(value) : `${(value / 1000).toFixed(1)}k`);

function renderTranscript(): void {
  const log = document.getElementById("aiChatLog");
  if (!log) return;

  log.innerHTML = "";
  conversation.entries.forEach(entry => {
    log.append(renderEntry(entry));
  });
  if (isEmpty(conversation)) log.append(emptyState());
  scrollToEnd();
}

function addEntry(entry: Entry): void {
  conversation.entries.push(entry);
  touch(conversation);

  const log = document.getElementById("aiChatLog");
  if (!log) return;
  document.getElementById("aiChatEmpty")?.remove();
  const element = renderEntry(entry);
  log.append(element);
  if (entry.kind === "script") currentStep = element as HTMLDetailsElement;

  const thinking = document.getElementById("aiChatThinking");
  if (thinking) log.append(thinking);
  scrollToEnd();
}

function renderEntry(entry: Entry): HTMLElement {
  if (entry.kind === "message") {
    const roles: Record<MessageRole, string> = {
      user: "aiChatUser",
      assistant: "aiChatAssistant",
      system: "aiChatSystem",
      error: "aiChatError"
    };
    const element = document.createElement("div");
    element.className = `aiChatMessage ${roles[entry.role]}`;
    // only the model writes Markdown; everything else is shown exactly as typed
    if (entry.role === "assistant") element.innerHTML = renderMarkdown(entry.text);
    else element.textContent = entry.text;
    return element;
  }

  const details = document.createElement("details");
  details.className = "aiChatStep";
  details.append(document.createElement("summary"), preElement(entry.code));
  setStepSummary(details, entry.result);
  if (entry.result) details.append(preElement(resultText(entry.result)));
  return details;
}

function completeStep(result: RunResult): void {
  const entry = conversation.entries.at(-1);
  if (entry?.kind === "script") entry.result = result;
  touch(conversation);
  if (!currentStep) return;

  setStepSummary(currentStep, result);
  currentStep.append(preElement(resultText(result)));
  currentStep = null;
  scrollToEnd();
}

function setStepSummary(details: HTMLDetailsElement, result?: RunResult): void {
  const summary = details.querySelector("summary");
  if (!summary) return;
  if (!result) summary.textContent = "Running a script…";
  else summary.textContent = result.ok ? `Ran a script · ${result.ms} ms` : `Script failed · ${result.ms} ms`;
}

function resultText(result: RunResult): string {
  const logs = result.logs.length ? `${result.logs.join("\n")}\n\n` : "";
  return result.ok ? logs + result.value : `${logs}${result.error?.message}\n${result.error?.stack}`;
}

function preElement(text: string): HTMLPreElement {
  const element = document.createElement("pre");
  element.textContent = text;
  return element;
}

function emptyState(): HTMLElement {
  const container = document.createElement("div");
  container.id = "aiChatEmpty";

  const hint = document.createElement("div");
  hint.textContent = "I can read the current map and answer questions about it. I cannot change it yet.";
  container.append(hint);

  SUGGESTIONS.forEach(suggestion => {
    const button = document.createElement("button");
    button.textContent = suggestion;
    button.addEventListener("click", () => void send(suggestion));
    container.append(button);
  });

  return container;
}

function showThinking(status: string): void {
  const log = document.getElementById("aiChatLog");
  if (!log) return;

  let thinking = document.getElementById("aiChatThinking");
  if (!thinking) {
    thinking = document.createElement("div");
    thinking.id = "aiChatThinking";
    thinking.append(document.createElement("span"), ...[0, 1, 2].map(() => document.createElement("i")));
    log.append(thinking);
  }

  const label = thinking.querySelector("span");
  if (label) label.textContent = status;
  log.append(thinking);
  scrollToEnd();
}

function hideThinking(): void {
  document.getElementById("aiChatThinking")?.remove();
}

// Follow new content only when the user is already at the bottom, so scrolling back stays put
function scrollToEnd(): void {
  const log = document.getElementById("aiChatLog");
  if (!log) return;
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
  if (atBottom) log.scrollTop = log.scrollHeight;
}

function cleanup(): void {
  session.cancel();
  busy = false;
  currentStep = null;
  destroyDialogIfExists(DIALOG_ID);
}

export const AiChat = { open };
