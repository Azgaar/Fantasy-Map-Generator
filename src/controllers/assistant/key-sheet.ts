import * as Connection from "@/services/assistant/provider/connection";
import { listModels } from "@/services/assistant/provider/models";
import { DEFAULT_PROVIDER, type ProviderSpec, providerById } from "@/services/assistant/provider/providers";
import { ensureEl as el } from "@/utils";
import { t } from "@/utils/i18n";
import { errorText } from "@/utils/stringUtils";

/** The "Connect your AI key" sheet: provider fields, model discovery and saving the connection.
 * Discovery doubles as the key check: a failure shows the provider's error but never blocks Connect */
class KeySheetForm {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private discovery: AbortController | null = null;

  wire(): void {
    el("assistantProvider").addEventListener("change", () => this.fillProvider());
    el("assistantApiKey").addEventListener("input", () => this.scheduleDiscovery());
    el("assistantLocalUrl").addEventListener("input", () => this.scheduleDiscovery());
  }

  /** Fill the sheet from the saved connection */
  fill(): void {
    const connection = Connection.get();
    el<HTMLSelectElement>("assistantProvider").value = connection.provider;
    this.input("assistantLocalUrl").value = connection.localUrl;
    el("assistantDisconnect").hidden = !Connection.isConnected();
    this.fillProvider();
  }

  /** Leaving the sheet drops a pending or running discovery */
  cancelDiscovery(): void {
    this.discovery?.abort();
    this.discovery = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Save the entered connection; false, with the reason shown, when a field is missing */
  save(): boolean {
    const provider = this.provider.id;
    const local = provider === "local";
    const model = this.input("assistantModel").value.trim();
    const key = this.input("assistantApiKey").value.trim();
    if (!model || (!local && !key)) {
      el("assistantDiscoveryError").textContent = local ? t("Enter a model name.") : t("Enter a model and API key.");
      return false;
    }
    Connection.save({
      provider,
      model,
      key: local ? "" : key,
      localUrl: this.input("assistantLocalUrl").value.trim() || Connection.get().localUrl
    });
    return true;
  }

  private get provider(): ProviderSpec {
    return providerById(el<HTMLSelectElement>("assistantProvider").value) ?? DEFAULT_PROVIDER;
  }

  private input(id: string): HTMLInputElement {
    return el<HTMLInputElement>(id);
  }

  private setModels(models: string[]): void {
    el("assistantModels").replaceChildren(...models.map(model => new Option(model)));
  }

  private fillProvider(): void {
    const provider = this.provider;
    const local = provider.id === "local";
    const draft = Connection.get(provider.id);
    this.input("assistantModel").value = draft.model;
    this.input("assistantApiKey").value = draft.key;
    el("assistantModelLabel").textContent = local ? "Model name" : "Model";
    el<HTMLAnchorElement>("assistantKeyLink").href = provider.keyLink;
    for (const node of el("assistantKey").querySelectorAll<HTMLElement>("[data-remote]")) node.hidden = local;
    for (const node of el("assistantKey").querySelectorAll<HTMLElement>("[data-local]")) node.hidden = !local;
    this.setModels(provider.fallbackModel ? [provider.fallbackModel] : []);
    void this.discover();
  }

  private scheduleDiscovery(): void {
    this.cancelDiscovery();
    el("assistantDiscoveryError").textContent = "";
    this.setModels([]);
    this.timer = setTimeout(() => void this.discover(), 350);
  }

  /** List the models the entered key can use; a newer discovery cancels this one */
  private async discover(): Promise<void> {
    const provider = this.provider;
    const key = this.input("assistantApiKey").value.trim();
    const url = this.input("assistantLocalUrl").value.trim();
    this.discovery?.abort();
    this.discovery = new AbortController();
    const { signal } = this.discovery;
    const error = el("assistantDiscoveryError");
    error.textContent = "";
    if (provider.id !== "local" && !key) return this.setModels([]);
    try {
      const found = await listModels(provider.id, key, url, signal);
      if (!signal.aborted) this.setModels(found);
    } catch (failure) {
      if (!signal.aborted) error.textContent = errorText(failure);
    }
  }
}

export const KeySheet = new KeySheetForm();
