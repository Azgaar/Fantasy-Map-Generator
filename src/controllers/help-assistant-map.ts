// One assistant for hosted and personal connections, with bounded tools and explicit note Apply.

import { confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import {
  type Conversation,
  create,
  currentMapId,
  type Entry,
  forCurrentMap,
  isEmpty,
  list,
  remove,
  select,
  touch
} from "@/services/agent/conversations";
import { applyProposal, getSelection, proposedNoteHtml, safeNoteHtml, setSelection } from "@/services/agent/map-tools";
import {
  DEFAULT_LOCAL_URL,
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
import {
  canUseHostedAssistant,
  HelpApiError,
  PROVIDER_SETUP_MESSAGE,
  request,
  signIn,
  signOut
} from "@/services/help/api";
import { getToken } from "@/services/help/auth";
import { openURL } from "@/utils";
import { renderMarkdown } from "@/utils/markdown";
import { ensureEl } from "../utils";
import { buildMessageRow, buildTypingRow } from "./help-assistant-chat";
import { type EditEntry, noteChipLabel, undoEdit } from "./help-assistant-notes";

const MODEL_STORAGE = "fmg-ai-chat-model";
const MAX_INPUT_HEIGHT = 108;

export const MAP_SUGGESTIONS = [
  "Which states have no ports?",
  "List the five largest burgs and their states",
  "Describe the place selected with Here"
];

export const NOTE_SUGGESTIONS = [
  "Write a description for this note",
  "Make it more ominous",
  "Tighten the wording, keep the facts"
];

export const needsKey = (model: string, key: string): boolean =>
  model !== "hosted" && providerOf(model).id !== "local" && !key.trim();

let host: HTMLElement | null = null;
let conversation: Conversation;
let currentStep: HTMLDetailsElement | null = null;
let busy = false;
let turnContext = "";
let noteLabel: string | null = null;

const session = createSession(() => ({
  key: ensureEl<HTMLInputElement>("helpMapKey").value,
  model: ensureEl<HTMLSelectElement>("helpMapModel").value,
  context: turnContext
}));

export function mountMapPanel(target: HTMLElement): void {
  host = target;
  conversation = forCurrentMap();
  target.innerHTML = panelHtml();
  bind();
  window.addEventListener("assistant-context", refreshMapContext);
  setInitialValues();
  renderConversations();
  renderTranscript();
  renderUsage();
}

// Called on every switch into the panel: the note chip and the suggestions follow the notes editor
export function refreshMapContext(): void {
  void noteChipLabel().then(label => {
    if (!host || !document.getElementById("helpMapContext")) return;
    label = getSelection()?.label ?? label;
    noteLabel = label;
    const chip = ensureEl("helpMapContext");
    chip.hidden = label === null;
    chip.textContent = label === null ? "" : `Here: ${label} ×`;
    if (isEmpty(conversation)) renderTranscript();
    ensureEl("helpMapInput").focus();
  });
}

export function unmountMapPanel(): void {
  destroyDialog("helpMapNotePreview");
  window.removeEventListener("assistant-context", refreshMapContext);
  session.cancel();
  busy = false;
  currentStep = null;
  if (host) host.innerHTML = "";
  host = null;
}

// The titlebar's "New chat" while this panel is on screen
export function newMapConversation(): void {
  if (busy) return;
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
    <div id="helpMapSetup" class="helpMapSetup" hidden>
      <p id="helpMapSetupText"></p><button id="helpMapChooseProvider" type="button">Use your own provider</button>
    </div>
    <div id="helpMapLog" class="helpAssistantLog" role="log" aria-live="polite"></div>
    <div id="helpMapAllowance" class="helpMapUsage" aria-live="polite"></div>
    <div id="helpMapContext" class="helpMapContext" hidden></div>
    <div class="helpAssistantComposer">
      <textarea id="helpMapInput" rows="1" aria-label="Your message"
        placeholder="Ask about FMG, explore this map, or edit notes…"></textarea>
      <button id="helpMapSend" type="button" class="helpAssistantSend icon-right-big"
        title="Send (Enter)" aria-label="Send"></button>
    </div>
    <div id="helpMapDrawer" class="helpMapDrawer" hidden>
      <p>Messages and relevant map excerpts go to the selected provider. Hosted records are retained for up to 90 days.</p>
      <button id="helpMapSignIn" type="button">${getToken() ? "Sign out" : "Sign in with Discord (optional)"}</button>
      <p>Changing provider starts a fresh conversation. Your previous chat stays in history.</p>
      <div id="helpMapHint" class="helpMapHint" hidden>Add your API key to start. It stays in this browser and goes only to the provider.</div>
      <label>
        <span>Chat</span>
        <select id="helpMapConversation" title="Switch between saved chats"></select>
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

function showProviderSetup(message = PROVIDER_SETUP_MESSAGE): void {
  ensureEl("helpMapSetupText").textContent = message;
  ensureEl("helpMapSetup").hidden = false;
}
function bind(): void {
  ensureEl("helpMapChooseProvider").onclick = () => {
    toggleDrawer(true);
    ensureEl("helpMapProvider").focus();
  };
  ensureEl("helpMapSignIn").onclick = () => {
    if (getToken())
      void signOut().then(() => {
        ensureEl("helpMapSignIn").textContent = "Sign in with Discord (optional)";
      });
    else signIn();
  };
  ensureEl("helpMapContext").addEventListener("click", () => setSelection());
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
  if (model === "hosted") {
    ensureEl("helpMapStatusModel").textContent = "FMG provided";
    return;
  }
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
  const hosted = new Option(
    canUseHostedAssistant() ? "FMG provided (default)" : "FMG provided (official site only)",
    "hosted"
  );
  hosted.disabled = !canUseHostedAssistant();
  providerSelect.append(hosted, ...PROVIDERS.map(provider => new Option(provider.label, provider.id)));

  // the stored model decides the provider, not the other way round: it is the only thing persisted
  const stored = localStorage.getItem(MODEL_STORAGE) ?? "";
  const fallback = canUseHostedAssistant() ? "hosted" : PROVIDERS[0].models[0];
  const model = stored === "hosted" || !stored ? fallback : isKnownModel(stored) ? stored : fallback;
  if (conversation.connection && conversation.connection !== model) conversation = create();
  providerSelect.value = model === "hosted" ? "hosted" : providerOf(model).id;
  buildModelSelect();
  ensureEl<HTMLSelectElement>("helpMapModel").value = model;

  providerSelect.addEventListener("change", () => {
    if (busy) return;
    conversation = create();
    renderConversations();
    renderTranscript();
    buildModelSelect(); // fresh conversation on provider switch
    loadKeyForModel();
    void refreshModels();
  });
  ensureEl("helpMapModel").addEventListener("change", () => {
    if (busy) return;
    conversation = create();
    renderConversations();
    renderTranscript();
    loadKeyForModel();
    void refreshModels();
  });
  loadKeyForModel();
  updateSendButton();
  void refreshModels();
  if (!canUseHostedAssistant()) {
    ensureEl("helpMapSignIn").hidden = true;
    if (
      needsKey(model, ensureEl<HTMLInputElement>("helpMapKey").value) ||
      (model === LOCAL_MODEL && !ensureEl<HTMLInputElement>("helpMapLocalModel").value.trim())
    ) {
      showProviderSetup();
      toggleDrawer(true);
    }
  }
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
  if (providerId === "hosted") {
    ensureEl<HTMLSelectElement>("helpMapModel").replaceChildren(new Option("FMG provided", "hosted"));
    return;
  }
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
  if (providerId === "hosted") return;
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
  for (const id of ["helpMapModel", "helpMapKey"]) ensureEl(id).closest("label")!.hidden = model === "hosted";
  if (model === "hosted") {
    ensureEl("helpMapLocal").hidden = true;
    renderStatus();
    updateSendButton();
    return;
  }
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
  for (const id of ["helpMapProvider", "helpMapModel", "helpMapConversation", "helpMapDelete"]) {
    const el = document.getElementById(id) as HTMLSelectElement | HTMLButtonElement | null;
    if (el) el.disabled = busy;
  }
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

  if (conversation.archived) {
    tip("This is an archived chat. Start a new conversation to ask a question.", true, "warn", 4000);
    return;
  }
  const input = ensureEl<HTMLTextAreaElement>("helpMapInput");
  const question = (text ?? input.value).trim();
  if (!question) return;

  const model = ensureEl<HTMLSelectElement>("helpMapModel").value;
  const key = ensureEl<HTMLInputElement>("helpMapKey").value;
  if (model === "hosted" && !canUseHostedAssistant()) {
    showProviderSetup();
    toggleDrawer(true);
    return;
  }
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
  if (model !== "hosted") localStorage.setItem(keyStorageFor(model), key);
  localStorage.setItem(MODEL_STORAGE, model);
  toggleDrawer(false);

  ensureEl("helpMapSetup").hidden = true;
  input.value = "";
  resizeInput(input);
  addEntry({ kind: "message", role: "user", text: question });
  renderConversations();

  busy = true;
  updateSendButton();
  showThinking("Thinking…");
  const thread = conversation;
  const record = (entry: Entry) => {
    if (conversation === thread) addEntry(entry);
    else {
      thread.entries.push(entry);
      touch(thread);
    }
  };
  try {
    const openNote = await Controllers.NotesEditor.current();
    const passage = openNote ? await Controllers.NotesEditor.assistantSelection() : null;
    turnContext = openNote
      ? `Open note target: ${openNote.id}. ${passage ? "A passage is selected: use read_note and propose_note with scope selection." : "Read it with read_note before editing."}`
      : "";
    await session.ask(thread, question, {
      onText: answer => record({ kind: "message", role: "assistant", text: answer }),
      onScript: code => addEntry({ kind: "script", code }),
      onScriptResult: result => completeStep(result),
      onStatus: status => (status ? showThinking(status) : hideThinking()),
      onUsage: renderUsage,
      onAllowance: remaining => {
        const status = document.getElementById("helpMapAllowance");
        if (status) status.textContent = `${remaining} tasks left today · resets 00:00 UTC`;
      },
      onTool: name => showThinking(name === "propose_note" ? "Preparing a note preview…" : "Collecting context…"),
      onProposal: proposal => record({ kind: "proposal", proposal }),
      onReport: draft => record({ kind: "report", draft, requestId: crypto.randomUUID() })
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    const message = (error instanceof Error && error.message) || String(error);
    if (model === "hosted" && !aborted && error instanceof HelpApiError) {
      showProviderSetup(
        "The FMG-provided connection could not complete your request. You can retry later, or choose your own provider in Settings."
      );
      toggleDrawer(true);
      const composer = document.getElementById("helpMapInput") as HTMLTextAreaElement | null;
      if (composer && !composer.value) composer.value = question;
    }
    record({ kind: "message", role: aborted ? "system" : "error", text: aborted ? "Stopped." : message });
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
    const label = item.mapId === currentMapId() ? item.title : `${item.title} (other map)`;
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

function openNotePreview(label: string, content: HTMLElement, opener: HTMLButtonElement): void {
  destroyDialog("helpMapNotePreview");
  const dialog = document.createElement("div");
  dialog.id = "helpMapNotePreview";
  dialog.className = "dialog stable";
  const title = document.createElement("h2");
  title.textContent = label;
  const hint = document.createElement("p");
  hint.textContent = "Draft preview. Close this window and choose Apply to update the map.";
  // Reuse the sanitized content shown in the proposal card.
  dialog.append(title, hint, content.cloneNode(true));
  dialog.addEventListener("click", event => {
    const link = (event.target as Element).closest("a[href]");
    if (!link) return;
    event.preventDefault();
    openURL(link.getAttribute("href") ?? "");
  });
  (document.getElementById("dialogs") ?? document.body).append(dialog);
  window.$(dialog).dialog({
    title: "Note preview",
    modal: true,
    resizable: true,
    width: Math.min(720, window.innerWidth - 24),
    height: Math.min(640, window.innerHeight - 80),
    position: { my: "center", at: "center", of: window },
    buttons: { Close: () => window.$(dialog).dialog("close") },
    close: () => {
      destroyDialog(dialog.id);
      if (opener.isConnected) opener.focus({ preventScroll: true });
    }
  });
}

function renderEntry(entry: Entry): HTMLElement {
  if (entry.kind === "proposal") {
    const p = entry.proposal;
    const panel = document.createElement("div");
    panel.className = "helpAssistantBubble helpMapNoteProposal";
    panel.dataset.proposalId = p.id;
    const title = document.createElement("strong");
    title.textContent = `${p.selection ? "Selected passage" : "Notes"}: ${p.label}`;
    const preview = document.createElement("div");
    try {
      preview.innerHTML =
        p.status === "proposed" && !p.selection ? proposedNoteHtml(p.html) : safeNoteHtml(p.selection?.html ?? p.html);
    } catch {
      preview.textContent = "Unsupported note content";
    }
    const actions = document.createElement("div");
    actions.className = "helpMapNoteActions";
    if (p.status === "proposed") {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = "preview";
      button.textContent = "Preview";
      button.setAttribute("aria-haspopup", "dialog");
      button.onclick = () => openNotePreview(title.textContent ?? p.label, preview, button);
      actions.append(button);
    } else {
      const status = document.createElement("span");
      status.className = "helpMapNoteStatus";
      status.dataset.state = p.status;
      status.setAttribute("role", "status");
      status.tabIndex = -1;
      status.textContent = { applied: "✓ Applied", undone: "↶ Undone", discarded: "Discarded" }[p.status];
      actions.append(status);
    }
    const detail = document.createElement("p");
    detail.className = "helpMapNoteDetail";
    detail.textContent = {
      proposed: "Review the note, then Apply to update the map.",
      applied: "Note updated on this map. Save the map file to keep the change.",
      undone: "Original note restored.",
      discarded: "No changes made."
    }[p.status];
    const error = document.createElement("p");
    error.className = "helpMapNoteError";
    error.setAttribute("role", "alert");
    error.hidden = true;
    const redraw = () => {
      touch(conversation);
      renderTranscript();
      const card = [...document.querySelectorAll<HTMLElement>(".helpMapNoteProposal")].find(
        el => el.dataset.proposalId === p.id
      );
      card?.querySelector<HTMLElement>(".helpMapNoteStatus")?.focus({ preventScroll: true });
    };
    if (p.status === "proposed" || p.status === "applied") {
      const apply = document.createElement("button");
      apply.type = "button";
      apply.dataset.action = p.status === "applied" ? "undo" : "apply";
      apply.textContent = p.status === "applied" ? "Undo" : "Apply";
      apply.onclick = async () => {
        apply.disabled = true;
        error.hidden = true;
        try {
          await applyProposal(p, p.status === "applied");
          redraw();
        } catch (e) {
          error.textContent = e instanceof Error ? e.message : String(e);
          error.hidden = false;
          apply.disabled = false;
        }
      };
      actions.append(apply);
    }
    if (p.status === "proposed") {
      const discard = document.createElement("button");
      discard.type = "button";
      discard.textContent = "Discard";
      discard.onclick = () => {
        p.status = "discarded";
        redraw();
      };
      actions.append(discard);
    }
    panel.append(title, preview, actions, detail, error);
    return panel;
  }
  if (entry.kind === "report") {
    const panel = document.createElement("div");
    panel.className = "helpAssistantBubble";
    const title = document.createElement("strong");
    title.textContent = entry.draft.kind === "bug" ? "Bug report" : "Idea";
    panel.append(title);
    const controls: Record<string, HTMLInputElement | HTMLTextAreaElement> = {};
    for (const [key, label] of [
      ["title", "Title"],
      ["description", "Description"],
      ...(entry.draft.kind === "bug"
        ? [
            ["steps", "Steps to reproduce"],
            ["expected", "Expected behaviour"]
          ]
        : [])
    ]) {
      const row = document.createElement("label");
      row.style.display = "block";
      row.textContent = label;
      const field = key === "title" ? document.createElement("input") : document.createElement("textarea");
      field.value = String(entry.draft[key] ?? "");
      field.style.width = "100%";
      field.disabled = Boolean(entry.receipt);
      controls[key] = field;
      row.append(field);
      panel.append(row);
    }
    const send = document.createElement("button");
    send.textContent = entry.receipt ? "Submitted" : "Submit report";
    send.disabled = Boolean(entry.receipt);
    const status = document.createElement("p");
    status.textContent = entry.receipt
      ? "Submitted for review"
      : "Review what will be shared with moderators. Approved reports may be published on GitHub.";
    send.onclick = async () => {
      send.disabled = true;
      try {
        const draft = {
          kind: entry.draft.kind,
          ...Object.fromEntries(Object.entries(controls).map(([k, v]) => [k, v.value]))
        };
        const result = await request<{ receipt: string }>("/v2/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft, requestId: entry.requestId })
        });
        entry.draft = draft;
        entry.receipt = result.receipt;
        touch(conversation);
        renderTranscript();
      } catch (e) {
        status.textContent = e instanceof Error ? e.message : String(e);
        send.disabled = false;
      }
    };
    const check = document.createElement("button");
    check.textContent = "Check status";
    check.hidden = !entry.receipt;
    check.onclick = async () => {
      try {
        const result = await request<{ state: string; url: string | null }>(`/v2/reports/${entry.receipt}`, {
          method: "GET"
        });
        status.textContent = result.state.replaceAll("_", " ");
        if (result.url && /^https:\/\/github\.com\//.test(result.url)) {
          const a = document.createElement("a");
          a.href = result.url;
          a.textContent = " View on GitHub";
          status.append(a);
        }
      } catch (e) {
        status.textContent = e instanceof Error ? e.message : String(e);
      }
    };
    panel.append(status, send, check);
    return panel;
  }
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
    ? `I can explain FMG, explore this map and prepare changes to the note “${noteLabel}”. Changes are previewed before Apply.`
    : "Ask about FMG, explore the current map, or draft and edit notes. Right-click the map to attach a place.";
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
