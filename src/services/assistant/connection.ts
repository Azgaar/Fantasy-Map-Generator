import { DEFAULT_PROVIDER, keyStorageForProvider, type ProviderSpec, providerById } from "./providers";

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

/** The saved connection, or what it would be with another provider: a local model keeps its own name */
export function get(providerId?: ProviderSpec["id"]): Connection {
  const saved = providerById(localStorage.getItem(PROVIDER_STORAGE)) ?? DEFAULT_PROVIDER;
  const provider = providerById(providerId) ?? saved;
  const local = provider.id === "local";
  const model = local
    ? localStorage.getItem(LOCAL_MODEL_STORAGE)
    : provider === saved
      ? localStorage.getItem(MODEL_STORAGE)
      : null;
  return {
    provider: provider.id,
    model: model || provider.fallbackModel,
    key: local ? "" : localStorage.getItem(keyStorageForProvider(provider.id)) || "",
    localUrl: localStorage.getItem(LOCAL_URL_STORAGE) || providerById("local")!.baseUrl!
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
  if (localStorage.getItem(CONNECTED_STORAGE) === "0") return false;
  const connection = get();
  return Boolean(connection.provider === "local" ? connection.model : connection.key);
}
