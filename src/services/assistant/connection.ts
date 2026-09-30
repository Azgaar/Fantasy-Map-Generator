import { DEFAULT_PROVIDER, keyStorageForProvider, PROVIDERS, type ProviderSpec } from "./providers";

export interface Connection {
  provider: ProviderSpec["id"];
  model: string;
  key: string;
  localUrl: string;
}

const PROVIDER_STORAGE = "fmg-ai-chat-provider";
const MODEL_STORAGE = "fmg-ai-chat-model";
const LOCAL_MODEL_STORAGE = "fmg-ai-local-model";
const LOCAL_URL_STORAGE = "fmg-ai-local-url";
const CONNECTED_STORAGE = "fmg-assistant-connected";
const LOCAL = PROVIDERS.find(provider => provider.id === "local")!;

/** The saved connection, or what it would be with another provider: a local model keeps its own name */
export function get(providerId?: ProviderSpec["id"]): Connection {
  const saved = PROVIDERS.find(item => item.id === localStorage.getItem(PROVIDER_STORAGE)) ?? DEFAULT_PROVIDER;
  const provider = PROVIDERS.find(item => item.id === providerId) ?? saved;
  const local = provider === LOCAL;
  const model = local
    ? localStorage.getItem(LOCAL_MODEL_STORAGE)
    : provider === saved
      ? localStorage.getItem(MODEL_STORAGE)
      : null;
  return {
    provider: provider.id,
    model: model || provider.fallbackModel,
    key: local ? "" : localStorage.getItem(keyStorageForProvider(provider.id)) || "",
    localUrl: localStorage.getItem(LOCAL_URL_STORAGE) || LOCAL.baseUrl!
  };
}

export function save({ provider, model, key, localUrl }: Connection): void {
  localStorage.setItem(PROVIDER_STORAGE, provider);
  if (provider === "local") localStorage.setItem(LOCAL_MODEL_STORAGE, model);
  else {
    localStorage.setItem(MODEL_STORAGE, model);
    localStorage.setItem(keyStorageForProvider(provider), key);
  }
  localStorage.setItem(LOCAL_URL_STORAGE, localUrl);
  localStorage.setItem(CONNECTED_STORAGE, "1");
}

export function clear(): void {
  localStorage.removeItem(keyStorageForProvider(get().provider));
  localStorage.setItem(CONNECTED_STORAGE, "0");
}

export function isConnected(): boolean {
  const connection = get();
  const marker = localStorage.getItem(CONNECTED_STORAGE);
  if (marker === "0") return false;
  const connected = Boolean(connection.provider === "local" ? connection.model : connection.key);
  if (connected && marker !== "1") localStorage.setItem(CONNECTED_STORAGE, "1");
  return connected;
}
