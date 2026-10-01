import { DEFAULT_PROVIDER, keyStorageForProvider, type ProviderSpec, providerById } from "./providers";

export interface Connection {
  provider: ProviderSpec["id"];
  model: string;
  key: string;
  localUrl: string;
}

const PROVIDER_STORAGE = "fmg-ai-chat-provider";
const LOCAL_URL_STORAGE = "fmg-ai-local-url";
const CONNECTED_STORAGE = "fmg-assistant-connected";
const modelStorage = (providerId: ProviderSpec["id"]) => `fmg-ai-model-${providerId}`;

/** The saved connection, or what it would be with another provider: each provider keeps its own model */
export function get(providerId?: ProviderSpec["id"]): Connection {
  const provider = providerById(providerId ?? localStorage.getItem(PROVIDER_STORAGE)) ?? DEFAULT_PROVIDER;
  const local = provider.id === "local";
  return {
    provider: provider.id,
    model: localStorage.getItem(modelStorage(provider.id)) || provider.fallbackModel,
    key: local ? "" : localStorage.getItem(keyStorageForProvider(provider.id)) || "",
    localUrl: localStorage.getItem(LOCAL_URL_STORAGE) || providerById("local")!.baseUrl!
  };
}

export function save({ provider, model, key, localUrl }: Connection): void {
  localStorage.setItem(PROVIDER_STORAGE, provider);
  localStorage.setItem(modelStorage(provider), model);
  if (provider !== "local") localStorage.setItem(keyStorageForProvider(provider), key);
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
