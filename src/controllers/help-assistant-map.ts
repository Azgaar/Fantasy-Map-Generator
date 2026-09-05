// The assistant dialog's "This map" panel: the BYOK agent over the open map (formerly the AI Chat
// dialog), wearing the help panel's chat furniture. Model, key and past chats live in a drawer;
// notes are edited through write_note, and every edit carries its own undo.

import { confirmationDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import {
  type Conversation,
  create,
  type Entry,
  forCurrentMap,
  isEmpty,
  list,
  remove,
  select,
  touch
} from "@/services/agent/conversations";
import {
  DEFAULT_LOCAL_URL,
  DEFAULT_MODEL,
  keyStorageFor,
  LOCAL_MODEL,
  LOCAL_MODEL_STORAGE,
  LOCAL_URL_STORAGE,
  PROVIDERS,
  providerOf,
  registerModels
} from "@/services/agent/providers";
import { cachedModels, listModels, mergeModels } from "@/services/agent/providers-models";
import type { RunResult } from "@/services/agent/runtime";
import { createSession } from "@/services/agent/session";
import { openURL } from "@/utils";
import { renderMarkdown } from "@/utils/markdown";
import { ensureEl } from "../utils";
import { buildMessageRow, buildTypingRow } from "./help-assistant-chat";
import { type EditEntry, noteChipLabel, noteContext, undoEdit, writeNoteTool } from "./help-assistant-notes";

const MODEL_STORAGE = "fmg-ai-chat-model";
const MAX_INPUT_HEIGHT = 108;

export const MAP_SUGGESTIONS = [
  "Which states have no ports?",
  "List the five largest burgs and their states",
  "How is the land split between biomes?"
];

export const NOTE_SUGGESTIONS = [
  "Write a description for this note",
  "Make it more ominous",
  "Tighten the wording, keep the facts"
];

export const needsKey = (model: string, key: string): boolean => providerOf(model).id !== "local" && !key.trim();

let host: HTMLElement | null = null;
let conversation: Conversation;
let currentStep: HTMLDetailsElement | null = null;
let busy = false;
let turnContext = "";
let noteLabel: string | null = null;

const session = createSession(
  () => ({
    key: ensureEl<HTMLInputElement>("helpMapKey").value,
    model: ensureEl<HTMLSelectElement>("helpMapModel").value,
    context: turnContext
  }),
  [writeNoteTool(entry => addEntry(entry))]
);

export function mountMapPanel(target: HTMLElement): void {
  host = target;
  conversation = forCurrentMap();
  target.innerHTML = panelHtml();
  bind();
  setInitialValues();
  renderConversations();
  renderTranscript();
  renderUsage();
}

// Called on every switch into the panel: the note chip and the suggestions follow the notes editor
export function refreshMapContext(): void {
  void noteChipLabel().then(label => {
    if (!host || !document.getElementById("helpMapContext")) return;
    noteLabel = label;
    const chip = ensureEl("helpMapContext");
    chip.hidden = label === null;
    chip.textContent = label === null ? "" : `Note: ${label}`;
    if (isEmpty(conversation)) renderTranscript();
    ensureEl("helpMapInput").focus();
  });
}

export function unmountMapPanel(): void {
  session.cancel();
  busy = false;
  currentStep = null;
  if (host) host.innerHTML = "";
  host = null;
}

// The titlebar's "New chat" while this panel is on screen
export function newMapConversation(): void {
  if (isEmpty(conversation)) {
    tip("This chat is already empty", true, "warn", 3000);
    return;
  }
  conversation = create();
  renderConversations();
  renderTranscript();
  renderUsage();
}

function panelHtml(): string {
  return /* html */ `
    <div id="helpMapLog" class="helpAssistantLog" role="log" aria-live="polite"></div>
    <div id="helpMapContext" class="helpMapContext" hidden></div>
    <div class="helpAssistantComposer">
      <textarea id="helpMapInput" rows="1" aria-label="Your message"
        placeholder="Ask about this map…"></textarea>
      <button id="helpMapSend" type="button" class="helpAssistantSend icon-right-big"
        title="Send (Enter)" aria-label="Send"></button>
    </div>
    <div id="helpMapDrawer" class="helpMapDrawer" hidden>
      <div id="helpMapHint" class="helpMapHint" hidden>Add your API key to start. It stays in this browser and goes only to the provider.</div>
      <label>
        <span>Chat</span>
        <select id="helpMapConversation" title="Switch between chats. Each one is sent in full with every message, so a fresh one costs less"></select>
        <button id="helpMapDelete" type="button" class="icon-trash" title="Delete this chat" aria-label="Delete this chat"></button>
      </label>
      <label>
        <span>Provider</span>
        <select id="helpMapProvider" title="Who runs the model. Each provider keeps its own key"></select>
      </label>
      <label>
        <span>Model</span>
        <select id="helpMapModel" title="Bigger models reason better and cost more"></select>
      </label>
      <label>
        <span>API key</span>
        <input id="helpMapKey" type="password" placeholder="API key" />
        <button id="helpMapKeyHelp" type="button" class="icon-help-circled" title="Where to get the key" aria-label="Where to get the key"></button>
      </label>
      <label id="helpMapLocal" hidden>
        <span>Server</span>
        <input id="helpMapLocalUrl" type="text" placeholder="${DEFAULT_LOCAL_URL}" title="Base URL of an OpenAI-compatible local server (Ollama, llama.cpp, LM Studio). For Ollama outside localhost, allow the app origin via OLLAMA_ORIGINS" />
        <input id="helpMapLocalModel" type="text" placeholder="model name" title="Name of the model as your local server knows it" />
      </label>
    </div>
    <div class="helpMapStatus">
      <button id="helpMapStatusModel" type="button" title="Change the model or key"></button>
      <span class="helpMapStatusEnd">
        <span id="helpMapUsage" class="helpMapUsage"></span>
        <button id="helpMapSettings" type="button" class="helpMapGear icon-cog" title="Model, key and chats"
          aria-label="Model, key and chats" aria-expanded="false"></button>
      </span>
    </div>`;
}

function bind(): void {
  ensureEl("helpMapConversation").addEventListener("change", event => {
    conversation = select((event.target as HTMLSelectElement).value);
    renderTranscript();
    renderUsage();
  });
  ensureEl("helpMapDelete").addEventListener("click", removeConversation);
  ensureEl("helpMapKeyHelp").addEventListener("click", () =>
    openURL(providerOf(ensureEl<HTMLSelectElement>("helpMapModel").value).keyLink)
  );
  ensureEl("helpMapSend").addEventListener("click", () => {
    if (busy) session.cancel();
    else void send();
  });
  ensureEl("helpMapSettings").addEventListener("click", () => toggleDrawer());
  ensureEl("helpMapStatusModel").addEventListener("click", () => toggleDrawer(true));
  ensureEl("helpMapKey").addEventListener("input", renderStatus);

  ensureEl("helpMapLog").addEventListener("click", event => {
    const link = (event.target as HTMLElement)?.closest?.("a[href]");
    if (!link) return;
    event.preventDefault();
    openURL(link.getAttribute("href") ?? "");
  });

  const input = ensureEl<HTMLTextAreaElement>("helpMapInput");
  input.addEventListener("input", () => {
    resizeInput(input);
    updateSendButton();
  });
  // Enter sends, Shift+Enter breaks the line — the same convention as the help chat
  input.addEventListener("keydown", event => {
    const key = event as KeyboardEvent;
    if (key.key !== "Enter" || key.shiftKey || key.isComposing) return;
    key.preventDefault();
    void send();
  });
}

function resizeInput(input: HTMLTextAreaElement): void {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, MAX_INPUT_HEIGHT)}px`;
}

function toggleDrawer(open?: boolean): void {
  const drawer = ensureEl("helpMapDrawer");
  drawer.hidden = open === undefined ? !drawer.hidden : !open;
  ensureEl("helpMapSettings").setAttribute("aria-expanded", String(!drawer.hidden));
  if (drawer.hidden) ensureEl("helpMapHint").hidden = true;
}

function renderStatus(): void {
  const model = ensureEl<HTMLSelectElement>("helpMapModel").value;
  const provider = providerOf(model);
  const name = model === LOCAL_MODEL ? "local model" : `${model} · ${provider.label}`;
  const key = ensureEl<HTMLInputElement>("helpMapKey").value;
  ensureEl("helpMapStatusModel").textContent =
    provider.id === "local" ? name : `${name} · ${key ? "key set" : "no key"}`;
}

function setInitialValues(): void {
  // Models found by earlier discovery runs must route before any fetch happens this session
  PROVIDERS.forEach(provider => {
    registerModels(provider.id, cachedModels(provider.id));
  });

  const providerSelect = ensureEl<HTMLSelectElement>("helpMapProvider");
  providerSelect.replaceChildren();
  providerSelect.append(...PROVIDERS.map(provider => new Option(provider.label, provider.id)));

  // the stored model decides the provider, not the other way round: it is the only thing persisted
  const stored = localStorage.getItem(MODEL_STORAGE) ?? "";
  const model = isKnownModel(stored) ? stored : DEFAULT_MODEL;
  providerSelect.value = providerOf(model).id;
  buildModelSelect();
  ensureEl<HTMLSelectElement>("helpMapModel").value = model;

  providerSelect.addEventListener("change", () => {
    buildModelSelect(); // falls to the provider's first model
    loadKeyForModel();
    void refreshModels();
  });
  ensureEl("helpMapModel").addEventListener("change", () => {
    loadKeyForModel();
    void refreshModels();
  });
  loadKeyForModel();
  updateSendButton();
  void refreshModels();
}

function isKnownModel(model: string): boolean {
  try {
    providerOf(model);
    return true;
  } catch {
    return false;
  }
}

// One provider's models only: the flat list across every provider was too long to pick from
function buildModelSelect(): void {
  const providerId = ensureEl<HTMLSelectElement>("helpMapProvider").value;
  const provider = PROVIDERS.find(candidate => candidate.id === providerId) ?? PROVIDERS[0];
  const select = ensureEl<HTMLSelectElement>("helpMapModel");
  const previous = select.value;
  select.replaceChildren();
  mergeModels(provider.models, cachedModels(provider.id)).forEach(model => {
    select.append(new Option(model === LOCAL_MODEL ? "custom model…" : model, model));
  });
  // keep the choice when the list is only being refreshed, otherwise take the first model
  const keep = [...select.options].some(option => option.value === previous);
  select.value = keep ? previous : (select.options[0]?.value ?? "");
}

// Ask the selected provider what its key can actually use, so new models appear without a release
async function refreshModels(): Promise<void> {
  const providerId = ensureEl<HTMLSelectElement>("helpMapProvider").value;
  const key = ensureEl<HTMLInputElement>("helpMapKey").value;
  if (providerId !== "local" && !key) return;
  try {
    await listModels(providerId as (typeof PROVIDERS)[number]["id"], key);
    if (document.getElementById("helpMapModel")) buildModelSelect();
  } catch {
    // unreachable server or bad key: the curated list stands
  }
}

// Each provider has its own key slot, so switching models swaps the key field with it
function loadKeyForModel(): void {
  const model = ensureEl<HTMLSelectElement>("helpMapModel").value;
  const local = providerOf(model).id === "local";
  const key = ensureEl<HTMLInputElement>("helpMapKey");
  key.value = localStorage.getItem(keyStorageFor(model)) ?? "";
  key.placeholder = local ? "API key (optional)" : "API key";
  key.title = local
    ? "Optional API key — most local servers need none. Sent as a Bearer token when set"
    : `${providerOf(model).label} API key. It's stored on your machine only (browser storage) and sent directly to the provider`;

  // Discovered local models already carry their name; only the sentinel needs the manual fields
  ensureEl("helpMapLocal").hidden = model !== LOCAL_MODEL;
  if (model === LOCAL_MODEL) {
    ensureEl<HTMLInputElement>("helpMapLocalUrl").value = localStorage.getItem(LOCAL_URL_STORAGE) ?? "";
    ensureEl<HTMLInputElement>("helpMapLocalModel").value = localStorage.getItem(LOCAL_MODEL_STORAGE) ?? "";
  }
  renderStatus();
  updateSendButton();
}

// The request outlives the panel when the dialog is closed mid-run, so every DOM touch below
// tolerates a missing element — the conversation keeps the content either way
function updateSendButton(): void {
  const button = document.getElementById("helpMapSend") as HTMLButtonElement | null;
  if (!button) return;
  button.className = `helpAssistantSend ${busy ? "icon-cancel" : "icon-right-big"}`;
  button.title = busy ? "Stop" : "Send (Enter)";
  button.disabled = !busy && !ensureEl<HTMLTextAreaElement>("helpMapInput").value.trim();
}

async function send(text?: string): Promise<void> {
  if (busy) return;
  if (customization) {
    tip("Please exit the customization mode first", false, "error");
    return;
  }

  const input = ensureEl<HTMLTextAreaElement>("helpMapInput");
  const question = (text ?? input.value).trim();
  if (!question) return;

  const model = ensureEl<HTMLSelectElement>("helpMapModel").value;
  const key = ensureEl<HTMLInputElement>("helpMapKey").value;
  if (needsKey(model, key)) {
    toggleDrawer(true);
    ensureEl("helpMapHint").hidden = false;
    ensureEl("helpMapKey").focus();
    return;
  }
  if (model === LOCAL_MODEL) {
    const localModel = ensureEl<HTMLInputElement>("helpMapLocalModel").value.trim();
    if (!localModel) {
      toggleDrawer(true);
      ensureEl("helpMapLocalModel").focus();
      tip("Please enter the local model name", true, "error", 4000);
      return;
    }
    localStorage.setItem(LOCAL_URL_STORAGE, ensureEl<HTMLInputElement>("helpMapLocalUrl").value.trim());
    localStorage.setItem(LOCAL_MODEL_STORAGE, localModel);
  }
  localStorage.setItem(keyStorageFor(model), key);
  localStorage.setItem(MODEL_STORAGE, model);
  toggleDrawer(false);

  input.value = "";
  resizeInput(input);
  addEntry({ kind: "message", role: "user", text: question });
  renderConversations();

  busy = true;
  updateSendButton();
  showThinking("Thinking…");
  turnContext = (await noteContext()) ?? "";

  try {
    await session.ask(conversation, question, {
      onText: answer => addEntry({ kind: "message", role: "assistant", text: answer }),
      onScript: code => addEntry({ kind: "script", code }),
      onScriptResult: result => completeStep(result),
      onStatus: status => (status ? showThinking(status) : hideThinking()),
      onUsage: renderUsage,
      onTool: () => showThinking("Writing the note…")
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
    if (document.getElementById("helpMapInput")) {
      updateSendButton();
      ensureEl("helpMapInput").focus();
    }
  }
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
    title: "Delete chat",
    message: `Delete "${conversation.title}"?<br />The chat cannot be restored`,
    confirm: "Delete",
    onConfirm: drop
  });
}

// Rendering — the conversation is the source of truth, the log is rebuilt from it on every mount

function renderConversations(): void {
  const select = document.getElementById("helpMapConversation") as HTMLSelectElement | null;
  if (!select) return;

  select.options.length = 0;
  list().forEach(item => {
    const label = item.mapId === mapId ? item.title : `${item.title} (other map)`;
    select.options.add(new Option(label, item.id));
  });
  select.value = conversation.id;
}

function renderUsage(): void {
  const line = document.getElementById("helpMapUsage");
  if (!line) return;

  const { input, output, cached } = conversation.usage;
  if (!input && !output) {
    line.textContent = "";
    return;
  }
  const cheap = cached ? `, ${thousands(cached)} cached` : "";
  line.textContent = `${thousands(input)} sent${cheap}, ${thousands(output)} back`;
  line.title = "Tokens spent in this chat. Cached tokens cost a tenth of the rest";
}

const thousands = (value: number): string => (value < 1000 ? String(value) : `${(value / 1000).toFixed(1)}k`);

function renderTranscript(): void {
  const log = document.getElementById("helpMapLog");
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

  const log = document.getElementById("helpMapLog");
  if (!log) return;
  document.getElementById("helpMapEmpty")?.remove();
  const element = renderEntry(entry);
  log.append(element);
  if (entry.kind === "script") currentStep = element as HTMLDetailsElement;

  const thinking = document.getElementById("helpMapThinking");
  if (thinking) log.append(thinking);
  scrollToEnd();
}

function renderEntry(entry: Entry): HTMLElement {
  if (entry.kind === "message") return renderMessage(entry.role, entry.text);
  if (entry.kind === "edit") return renderEdit(entry);

  const details = document.createElement("details");
  details.className = "helpMapStep";
  details.append(document.createElement("summary"), preElement(entry.code));
  setStepSummary(details, entry.result);
  if (entry.result) details.append(preElement(resultText(entry.result)));
  return details;
}

function renderMessage(role: "user" | "assistant" | "system" | "error", text: string): HTMLElement {
  // a cancellation is an event in the thread, not something anyone said
  if (role === "system") {
    const divider = document.createElement("div");
    divider.className = "helpAssistantDivider";
    divider.textContent = text;
    return divider;
  }

  const { row, stack } = buildMessageRow(role === "user" ? "user" : "bot");
  const bubble = document.createElement("div");
  bubble.className = role === "error" ? "helpAssistantBubble helpMapErrorBubble" : "helpAssistantBubble";
  // only the model writes Markdown; everything else is shown exactly as typed
  if (role === "assistant") bubble.innerHTML = renderMarkdown(text);
  else bubble.textContent = text;
  stack.appendChild(bubble);
  return row;
}

function renderEdit(entry: EditEntry): HTMLElement {
  const element = document.createElement("div");
  element.className = "helpMapEdit";
  const verb = entry.previous ? "Updated" : "Created";
  const label = (): string =>
    `${verb} note “${entry.name}” · ${thousands(entry.chars)} chars${entry.undone ? " · undone" : ""}`;
  const text = document.createElement("span");
  text.textContent = label();
  const undo = document.createElement("button");
  undo.type = "button";
  undo.textContent = "Undo";
  undo.title = "Put the note back the way it was before this edit";
  undo.disabled = Boolean(entry.undone);
  undo.addEventListener("click", () => {
    undo.disabled = true;
    void undoEdit(entry).then(() => {
      text.textContent = label();
      touch(conversation);
    });
  });
  element.append(text, undo);
  return element;
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
  container.id = "helpMapEmpty";
  container.className = "helpMapEmpty";

  const hint = document.createElement("p");
  hint.textContent = noteLabel
    ? `I can read this map and rewrite the note “${noteLabel}”. Every edit has an undo.`
    : "I can read the map you have open, and write your notes when the Notes Editor is open.";
  container.append(hint);

  (noteLabel ? NOTE_SUGGESTIONS : MAP_SUGGESTIONS).forEach(suggestion => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = suggestion;
    button.addEventListener("click", () => void send(suggestion));
    container.append(button);
  });

  return container;
}

function showThinking(status: string): void {
  const log = document.getElementById("helpMapLog");
  if (!log) return;

  let thinking = document.getElementById("helpMapThinking");
  if (!thinking) {
    thinking = buildTypingRow(status);
    thinking.id = "helpMapThinking";
    log.append(thinking);
  }
  thinking.querySelector(".helpAssistantTyping")?.setAttribute("aria-label", status);
  log.append(thinking);
  scrollToEnd();
}

function hideThinking(): void {
  document.getElementById("helpMapThinking")?.remove();
}

// Follow new content only when the user is already at the bottom, so scrolling back stays put
function scrollToEnd(): void {
  const log = document.getElementById("helpMapLog");
  if (!log) return;
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
  if (atBottom) log.scrollTop = log.scrollHeight;
}
