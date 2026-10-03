// The "Connect your AI key" sheet: provider fields, model discovery and saving the connection
import * as Connection from "@/services/assistant/provider/connection";
import { listModels } from "@/services/assistant/provider/models";
import { DEFAULT_PROVIDER, type ProviderSpec, providerById } from "@/services/assistant/provider/providers";
import { ensureEl as el } from "@/utils";
import { errorText } from "@/utils/stringUtils";

let discoveryTimer: ReturnType<typeof setTimeout> | null = null;
let discoveryId = 0;

const input = (id: string) => el<HTMLInputElement>(id);
const selectedProvider = (): ProviderSpec =>
  providerById(el<HTMLSelectElement>("assistantProvider").value) ?? DEFAULT_PROVIDER;
const setModels = (models: string[]) =>
  el("assistantModels").replaceChildren(...models.map(model => new Option(model)));

function wire(): void {
  el("assistantProvider").addEventListener("change", fillProvider);
  el("assistantApiKey").addEventListener("input", scheduleDiscovery);
  el("assistantLocalUrl").addEventListener("input", scheduleDiscovery);
}

/** Fill the sheet from the saved connection */
function fill(): void {
  const connection = Connection.get();
  el<HTMLSelectElement>("assistantProvider").value = connection.provider;
  input("assistantLocalUrl").value = connection.localUrl;
  el("assistantDisconnect").hidden = !Connection.isConnected();
  fillProvider();
}

function cancelDiscovery(): void {
  discoveryId++;
  if (discoveryTimer) clearTimeout(discoveryTimer);
  discoveryTimer = null;
}

function fillProvider(): void {
  const provider = selectedProvider();
  const local = provider.id === "local";
  const draft = Connection.get(provider.id);
  input("assistantModel").value = draft.model;
  input("assistantApiKey").value = draft.key;
  el("assistantModelLabel").textContent = local ? "Model name" : "Model";
  el<HTMLAnchorElement>("assistantKeyLink").href = provider.keyLink;
  for (const node of el("assistantKey").querySelectorAll<HTMLElement>("[data-remote]")) node.hidden = local;
  for (const node of el("assistantKey").querySelectorAll<HTMLElement>("[data-local]")) node.hidden = !local;
  setModels(provider.fallbackModel ? [provider.fallbackModel] : []);
  void discover();
}

function scheduleDiscovery(): void {
  cancelDiscovery();
  el("assistantDiscoveryError").textContent = "";
  setModels([]);
  discoveryTimer = setTimeout(() => void discover(), 350);
}

// Discovery doubles as the key check: a failure shows the provider's error but never blocks Connect.
// Leaving the sheet cancels it, so a late answer is dropped
async function discover(): Promise<void> {
  const provider = selectedProvider();
  const key = input("assistantApiKey").value.trim();
  const url = input("assistantLocalUrl").value.trim();
  const request = ++discoveryId;
  const error = el("assistantDiscoveryError");
  error.textContent = "";
  if (provider.id !== "local" && !key) return setModels([]);
  try {
    const found = await listModels(provider.id, key, url);
    if (request === discoveryId) setModels(found);
  } catch (failure) {
    if (request === discoveryId) error.textContent = errorText(failure);
  }
}

/** Save the entered connection; false, with the reason shown, when a field is missing */
function save(): boolean {
  const provider = selectedProvider().id;
  const local = provider === "local";
  const model = input("assistantModel").value.trim();
  const key = input("assistantApiKey").value.trim();
  if (!model || (!local && !key)) {
    el("assistantDiscoveryError").textContent = local ? "Enter a model name." : "Enter a model and API key.";
    return false;
  }
  Connection.save({
    provider,
    model,
    key: local ? "" : key,
    localUrl: input("assistantLocalUrl").value.trim() || Connection.get().localUrl
  });
  return true;
}

export const KeySheet = { wire, fill, cancelDiscovery, save };
