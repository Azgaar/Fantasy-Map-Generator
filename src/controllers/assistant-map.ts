// The Assistant dialog's "This map" panel: the own-key Assistant over the open map, with model
// settings in a drawer and note editing through write_note.

import { confirmationDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import {
  type Conversation,
  create,
  currentMapId,
  type Entry,
  forCurrentMap,
  isEmpty,
  list,
  type MessageRole,
  remove,
  select,
  touch
} from "@/services/assistant/conversations";
import {
  DEFAULT_LOCAL_URL,
  DEFAULT_MODEL,
  keyStorageForProvider,
  LOCAL_MODEL,
  LOCAL_MODEL_STORAGE,
  LOCAL_URL_STORAGE,
  PROVIDERS,
  type ProviderSpec,
  providerOf,
  registerModels
} from "@/services/assistant/providers";
import { cachedModels, listModels, modelChoices } from "@/services/assistant/providers-models";
import type { RunResult } from "@/services/assistant/runtime";
import { createSession } from "@/services/assistant/session";
import { openURL } from "@/utils";
import { renderMarkdown } from "@/utils/markdown";
import { ensureEl } from "../utils";
import { type EditEntry, noteChipLabel, noteContext, undoEdit, writeNoteTool } from "./assistant-notes";

const MODEL_STORAGE = "fmg-ai-chat-model";
const MODEL_PROVIDER_STORAGE = "fmg-ai-chat-provider";
const MODEL_AUTO_STORAGE = "fmg-ai-chat-auto-model";
const CUSTOM_MODEL = "__custom_model__";
const REPLACED_MODELS: Record<string, string> = { "deepseek-chat": "deepseek-flash" };
const MAX_INPUT_HEIGHT = 120;

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
let modelWasChosen = false;

const session = createSession(
  () => ({
    key: ensureEl<HTMLInputElement>("assistantMapKey").value,
    model: selectedModel(),
    providerId: selectedProvider().id,
    context: turnContext
  }),
  [writeNoteTool(entry => addEntry(entry))]
);

export function mountMapPanel(target: HTMLElement): void {
  host = target;
  modelWasChosen = false;
  conversation = forCurrentMap();
  target.innerHTML = panelHtml();
  bind();
  setInitialValues();
  renderConversations();
  renderTranscript();
  renderUsage();
}

// Called on every open/switch into the panel: the note chip and the suggestions follow the notes editor
export function refreshMapContext(): void {
  void noteChipLabel().then(label => {
    if (!host || !document.getElementById("assistantMapContext")) return;
    noteLabel = label;
    const chip = ensureEl("assistantMapContext");
    chip.hidden = label === null;
    chip.textContent = label === null ? "" : `Note: ${label}`;
    if (isEmpty(conversation)) renderTranscript();
    ensureEl("assistantMapInput").focus();
  });
}

export function unmountMapPanel(): void {
  session.cancel();
  busy = false;
  currentStep = null;
  if (host) host.innerHTML = "";
  host = null;
}

function panelHtml(): string {
  return /* html */ `
    <div class="assistantMapTop">
      <select id="assistantMapConversation" data-tip="Switch between conversations. Each one is sent in full with every question, so a fresh one costs less"></select>
      <button id="assistantMapNew" class="icon-plus" data-tip="Start a new conversation"></button>
      <button id="assistantMapRemove" class="icon-trash" data-tip="Delete the current conversation"></button>
    </div>
    <div id="assistantMapLog" class="assistantMapLog"></div>
    <div id="assistantMapContext" class="assistantMapContext" hidden></div>
    <div class="assistantMapComposer">
      <textarea id="assistantMapInput" rows="2" placeholder="Ask about this map…" data-tip="Enter to send, Shift + Enter for a new line"></textarea>
      <button id="assistantMapSend" class="icon-right-open" data-tip="Send the message"></button>
      <button id="assistantMapSettings" class="icon-cog" data-tip="Model and API key" aria-expanded="false"></button>
    </div>
    <div id="assistantMapDrawer" class="assistantMapDrawer" hidden>
      <div id="assistantMapHint" class="assistantMapHint" hidden>Add your API key to start. It stays in this browser and goes only to the provider.</div>
      <label>Provider <select id="assistantMapProvider" data-tip="Who runs the model. Each provider keeps its own key"></select></label>
      <label>Model <select id="assistantMapModel" data-tip="Model to ask. Bigger models reason better and cost more"></select><input id="assistantMapCustomModel" type="text" placeholder="Exact model ID" data-tip="Type any model ID supported by this provider" hidden /></label>
      <label>API key
        <input id="assistantMapKey" type="password" placeholder="API key" class="icon-key" />
        <button id="assistantMapKeyHelp" class="icon-help-circled" data-tip="Where to get the key"></button>
      </label>
      <div id="assistantMapLocal" hidden>
        <input id="assistantMapLocalUrl" type="text" placeholder="${DEFAULT_LOCAL_URL}" data-tip="Base URL of an OpenAI-compatible local server (Ollama, llama.cpp, LM Studio). For Ollama outside localhost, allow the app origin via OLLAMA_ORIGINS" />
        <input id="assistantMapLocalModel" type="text" placeholder="model name, e.g. llama3.2" data-tip="Name of the model as your local server knows it" />
      </div>
    </div>
    <div class="assistantMapStatus">
      <button id="assistantMapStatusModel" type="button" data-tip="Change the model or key"></button>
      <span id="assistantMapStatusKey"></span>
      <span id="assistantMapUsage"></span>
    </div>`;
}

function bind(): void {
  ensureEl("assistantMapConversation").addEventListener("change", event => {
    conversation = select((event.target as HTMLSelectElement).value);
    renderTranscript();
    renderUsage();
  });
  ensureEl("assistantMapNew").addEventListener("click", startNewConversation);
  ensureEl("assistantMapRemove").addEventListener("click", removeConversation);
  ensureEl("assistantMapKeyHelp").addEventListener("click", () => openURL(selectedProvider().keyLink));
  ensureEl("assistantMapSend").addEventListener("click", () => {
    if (busy) session.cancel();
    else void send();
  });
  ensureEl("assistantMapSettings").addEventListener("click", () => toggleDrawer());
  ensureEl("assistantMapStatusModel").addEventListener("click", () => toggleDrawer(true));
  ensureEl("assistantMapKey").addEventListener("input", renderStatus);
  ensureEl("assistantMapKey").addEventListener("change", () => void refreshModels());

  ensureEl("assistantMapLog").addEventListener("click", event => {
    const link = (event.target as HTMLElement)?.closest?.("a[href]");
    if (!link) return;
    event.preventDefault();
    openURL(link.getAttribute("href") ?? "");
  });

  const input = ensureEl<HTMLTextAreaElement>("assistantMapInput");
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

function toggleDrawer(open?: boolean): void {
  const drawer = ensureEl("assistantMapDrawer");
  drawer.hidden = open === undefined ? !drawer.hidden : !open;
  ensureEl("assistantMapSettings").setAttribute("aria-expanded", String(!drawer.hidden));
  if (drawer.hidden) ensureEl("assistantMapHint").hidden = true;
}

function renderStatus(): void {
  const model = selectedModel();
  const provider = selectedProvider();
  ensureEl("assistantMapStatusModel").textContent =
    model === LOCAL_MODEL ? "local model" : `${model || "custom model"} · ${provider.label}`;
  const key = ensureEl<HTMLInputElement>("assistantMapKey").value;
  ensureEl("assistantMapStatusKey").textContent = provider.id === "local" ? "" : key ? "· key set" : "· no key";
}

function selectedProvider(): ProviderSpec {
  return (
    PROVIDERS.find(provider => provider.id === ensureEl<HTMLSelectElement>("assistantMapProvider").value) ??
    PROVIDERS[0]
  );
}

function selectedModel(): string {
  const model = ensureEl<HTMLSelectElement>("assistantMapModel").value;
  return model === CUSTOM_MODEL ? ensureEl<HTMLInputElement>("assistantMapCustomModel").value.trim() : model;
}

function setInitialValues(): void {
  // Models found by earlier discovery runs must route before any fetch happens this session
  PROVIDERS.forEach(provider => {
    registerModels(provider.id, cachedModels(provider.id));
  });
  const providerSelect = ensureEl<HTMLSelectElement>("assistantMapProvider");
  providerSelect.replaceChildren();
  providerSelect.append(...PROVIDERS.map(provider => new Option(provider.label, provider.id)));

  // Saved provider is needed when a manually entered model is not in discovery results.
  const saved = localStorage.getItem(MODEL_STORAGE) ?? "";
  const stored = REPLACED_MODELS[saved] ?? saved;
  const savedProvider = PROVIDERS.find(provider => provider.id === localStorage.getItem(MODEL_PROVIDER_STORAGE));
  const known = isKnownModel(stored);
  providerSelect.value = savedProvider?.id ?? (known ? providerOf(stored).id : providerOf(DEFAULT_MODEL).id);
  modelWasChosen = Boolean(stored && (savedProvider || known) && localStorage.getItem(MODEL_AUTO_STORAGE) !== "true");
  buildModelSelect(modelWasChosen ? stored : undefined);

  providerSelect.addEventListener("change", () => {
    modelWasChosen = false;
    ensureEl<HTMLInputElement>("assistantMapCustomModel").value = "";
    buildModelSelect();
    loadKeyForModel();
    void refreshModels();
  });
  ensureEl("assistantMapModel").addEventListener("change", () => {
    modelWasChosen = true;
    loadKeyForModel(false);
    void refreshModels();
  });
  ensureEl("assistantMapCustomModel").addEventListener("input", () => {
    modelWasChosen = true;
    renderStatus();
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

// One provider's models only: a flat list across every provider is too long to pick from
function buildModelSelect(saved?: string): void {
  const provider = selectedProvider();
  const select = ensureEl<HTMLSelectElement>("assistantMapModel");
  const previous = saved ?? selectedModel();
  const models = modelChoices(provider, cachedModels(provider.id));
  select.replaceChildren();
  models.forEach(model => {
    select.append(new Option(model === LOCAL_MODEL ? "custom model…" : model, model));
  });
  if (provider.id !== "local") select.append(new Option("Other model…", CUSTOM_MODEL));
  const model = modelWasChosen && previous ? previous : models[0];
  if (models.includes(model)) select.value = model;
  else if (provider.id !== "local" && model) {
    select.value = CUSTOM_MODEL;
    ensureEl<HTMLInputElement>("assistantMapCustomModel").value = model;
  } else select.value = models[0];
  ensureEl("assistantMapCustomModel").hidden = select.value !== CUSTOM_MODEL;
}

// Ask the selected provider what its key can actually use, so new models appear without a release
async function refreshModels(): Promise<void> {
  const providerId = selectedProvider().id;
  const key = ensureEl<HTMLInputElement>("assistantMapKey").value;
  if (providerId !== "local" && !key) return;
  try {
    await listModels(providerId as (typeof PROVIDERS)[number]["id"], key);
    if (document.getElementById("assistantMapModel") && selectedProvider().id === providerId) {
      buildModelSelect();
      renderStatus();
    }
  } catch {
    // Keep cached results or the fallback when discovery fails.
  }
}

// Each provider has its own key slot, so switching models swaps the key field with it
function loadKeyForModel(loadKey = true): void {
  const model = ensureEl<HTMLSelectElement>("assistantMapModel").value;
  const provider = selectedProvider();
  const local = provider.id === "local";
  const key = ensureEl<HTMLInputElement>("assistantMapKey");
  if (loadKey) key.value = localStorage.getItem(keyStorageForProvider(provider.id)) ?? "";
  key.placeholder = local ? "API key (optional)" : "API key";
  key.dataset.tip = local
    ? "Optional API key — most local servers need none. Sent as a Bearer token when set"
    : `${provider.label} API key. It's stored on your machine only (browser storage) and sent directly to the provider`;

  ensureEl("assistantMapCustomModel").hidden = model !== CUSTOM_MODEL;
  // Discovered local models already carry their name; only the sentinel needs the manual fields
  ensureEl("assistantMapLocal").hidden = model !== LOCAL_MODEL;
  if (model === LOCAL_MODEL) {
    ensureEl<HTMLInputElement>("assistantMapLocalUrl").value = localStorage.getItem(LOCAL_URL_STORAGE) ?? "";
    ensureEl<HTMLInputElement>("assistantMapLocalModel").value = localStorage.getItem(LOCAL_MODEL_STORAGE) ?? "";
  }
  renderStatus();
  updateSendButton();
}

// The request outlives the panel when the dialog is closed mid-run, so every DOM touch below
// tolerates a missing element — the conversation keeps the content either way
function updateSendButton(): void {
  const button = document.getElementById("assistantMapSend") as HTMLButtonElement | null;
  if (!button) return;
  button.className = busy ? "icon-cancel" : "icon-right-open";
  button.dataset.tip = busy ? "Stop the current request" : "Send the message";
  button.disabled = !busy && !ensureEl<HTMLTextAreaElement>("assistantMapInput").value.trim();
}

async function send(text?: string): Promise<void> {
  if (busy) return;
  if (customization) {
    tip("Please exit the customization mode first", false, "error");
    return;
  }

  const input = ensureEl<HTMLTextAreaElement>("assistantMapInput");
  const question = (text ?? input.value).trim();
  if (!question) return;

  const provider = selectedProvider();
  const model = selectedModel();
  const key = ensureEl<HTMLInputElement>("assistantMapKey").value;
  if (ensureEl<HTMLSelectElement>("assistantMapModel").value === CUSTOM_MODEL && !model) {
    toggleDrawer(true);
    ensureEl("assistantMapCustomModel").focus();
    tip("Please enter a model ID", true, "error", 4000);
    return;
  }
  if (needsKey(provider.fallbackModel, key)) {
    toggleDrawer(true);
    ensureEl("assistantMapHint").hidden = false;
    ensureEl("assistantMapKey").focus();
    return;
  }
  if (model === LOCAL_MODEL) {
    const localModel = ensureEl<HTMLInputElement>("assistantMapLocalModel").value.trim();
    if (!localModel) {
      toggleDrawer(true);
      ensureEl("assistantMapLocalModel").focus();
      tip("Please enter the local model name", true, "error", 4000);
      return;
    }
    localStorage.setItem(LOCAL_URL_STORAGE, ensureEl<HTMLInputElement>("assistantMapLocalUrl").value.trim());
    localStorage.setItem(LOCAL_MODEL_STORAGE, localModel);
  }
  localStorage.setItem(keyStorageForProvider(provider.id), key);
  localStorage.setItem(MODEL_STORAGE, model);
  localStorage.setItem(MODEL_PROVIDER_STORAGE, provider.id);
  localStorage.setItem(MODEL_AUTO_STORAGE, String(!modelWasChosen));
  toggleDrawer(false);

  input.value = "";
  input.style.height = "auto";
  addEntry({ kind: "message", role: "user", text: question });
  renderConversations();

  busy = true;
  updateSendButton();
  showThinking("Thinking");
  turnContext = (await noteContext()) ?? "";

  try {
    await session.ask(conversation, question, {
      onText: answer => addEntry({ kind: "message", role: "assistant", text: answer }),
      onScript: code => addEntry({ kind: "script", code }),
      onScriptResult: result => completeStep(result),
      onStatus: status => (status ? showThinking(status) : hideThinking()),
      onUsage: renderUsage,
      onTool: () => showThinking("Editing the note")
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
    if (document.getElementById("assistantMapInput")) {
      updateSendButton();
      ensureEl("assistantMapInput").focus();
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

// Rendering — the conversation is the source of truth, the log is rebuilt from it on every mount

function renderConversations(): void {
  const select = document.getElementById("assistantMapConversation") as HTMLSelectElement | null;
  if (!select) return;

  select.options.length = 0;
  list().forEach(item => {
    const label = item.mapId === currentMapId() ? item.title : `${item.title} (other map)`;
    select.options.add(new Option(label, item.id));
  });
  select.value = conversation.id;
}

function renderUsage(): void {
  const line = document.getElementById("assistantMapUsage");
  if (!line) return;

  const { input, output, cached } = conversation.usage;
  if (!input && !output) {
    line.textContent = "";
    return;
  }
  const cheap = cached ? `, ${thousands(cached)} cached` : "";
  line.textContent = `· ${thousands(input)} sent${cheap}, ${thousands(output)} received`;
  line.dataset.tip = "Tokens spent in this conversation. Cached tokens cost a tenth of the rest";
}

const thousands = (value: number): string => (value < 1000 ? String(value) : `${(value / 1000).toFixed(1)}k`);

function renderTranscript(): void {
  const log = document.getElementById("assistantMapLog");
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

  const log = document.getElementById("assistantMapLog");
  if (!log) return;
  document.getElementById("assistantMapEmpty")?.remove();
  const element = renderEntry(entry);
  log.append(element);
  if (entry.kind === "script") currentStep = element as HTMLDetailsElement;

  const thinking = document.getElementById("assistantMapThinking");
  if (thinking) log.append(thinking);
  scrollToEnd();
}

function renderEntry(entry: Entry): HTMLElement {
  if (entry.kind === "message") {
    const roles: Record<MessageRole, string> = {
      user: "assistantMapUser",
      assistant: "assistantMapAssistant",
      system: "assistantMapSystem",
      error: "assistantMapError"
    };
    const element = document.createElement("div");
    element.className = `assistantMapMessage ${roles[entry.role]}`;
    // only the model writes Markdown; everything else is shown exactly as typed
    if (entry.role === "assistant") element.innerHTML = renderMarkdown(entry.text);
    else element.textContent = entry.text;
    return element;
  }
  if (entry.kind === "edit") return renderEdit(entry);

  const details = document.createElement("details");
  details.className = "assistantMapStep";
  details.append(document.createElement("summary"), preElement(entry.code));
  setStepSummary(details, entry.result);
  if (entry.result) details.append(preElement(resultText(entry.result)));
  return details;
}

function renderEdit(entry: EditEntry): HTMLElement {
  const element = document.createElement("div");
  element.className = "assistantMapEdit";
  const verb = entry.previous ? "Updated" : "Created";
  const label = (): string =>
    `${verb} note “${entry.name}” · ${thousands(entry.chars)} chars${entry.undone ? " · undone" : ""}`;
  const text = document.createElement("span");
  text.textContent = label();
  const undo = document.createElement("button");
  undo.type = "button";
  undo.className = "icon-ccw";
  undo.textContent = " Undo";
  undo.dataset.tip = "Put the note back the way it was before this edit";
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
  container.id = "assistantMapEmpty";

  const hint = document.createElement("div");
  hint.textContent = noteLabel
    ? `I can read this map and rewrite the note “${noteLabel}” in the notes editor. Every edit has an Undo.`
    : "I can read this map and answer questions about it, and edit notes when the notes editor is open.";
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
  const log = document.getElementById("assistantMapLog");
  if (!log) return;

  let thinking = document.getElementById("assistantMapThinking");
  if (!thinking) {
    thinking = document.createElement("div");
    thinking.id = "assistantMapThinking";
    thinking.append(document.createElement("span"), ...[0, 1, 2].map(() => document.createElement("i")));
    log.append(thinking);
  }

  const label = thinking.querySelector("span");
  if (label) label.textContent = status;
  log.append(thinking);
  scrollToEnd();
}

function hideThinking(): void {
  document.getElementById("assistantMapThinking")?.remove();
}

// Follow new content only when the user is already at the bottom, so scrolling back stays put
function scrollToEnd(): void {
  const log = document.getElementById("assistantMapLog");
  if (!log) return;
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
  if (atBottom) log.scrollTop = log.scrollHeight;
}
