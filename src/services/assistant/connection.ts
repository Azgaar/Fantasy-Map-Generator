import {
  DEFAULT_LOCAL_URL,
  keyStorageForProvider,
  LOCAL_MODEL_STORAGE,
  LOCAL_URL_STORAGE,
  DEFAULT_PROVIDER,
  PROVIDERS,
  type ProviderSpec
} from "./providers";

export interface Connection {
  provider: ProviderSpec["id"];
  model: string;
  key: string;
  localUrl: string;
  localModel: string;
}

const PROVIDER_STORAGE = "fmg-ai-chat-provider";
const MODEL_STORAGE = "fmg-ai-chat-model";
const CONNECTED_STORAGE = "fmg-assistant-connected";

export function get(): Connection {
  const provider = PROVIDERS.find(item => item.id === localStorage.getItem(PROVIDER_STORAGE)) ?? DEFAULT_PROVIDER;
  return {
    provider: provider.id,
    model: localStorage.getItem(MODEL_STORAGE) || provider.fallbackModel,
    key: provider.id === "local" ? "" : localStorage.getItem(keyStorageForProvider(provider.id)) || "",
    localUrl: localStorage.getItem(LOCAL_URL_STORAGE) || DEFAULT_LOCAL_URL,
    localModel: localStorage.getItem(LOCAL_MODEL_STORAGE) || ""
  };
}

export function save(connection: Connection): void {
  localStorage.setItem(PROVIDER_STORAGE, connection.provider);
  localStorage.setItem(MODEL_STORAGE, connection.model);
  if (connection.provider !== "local") localStorage.setItem(keyStorageForProvider(connection.provider), connection.key);
  localStorage.setItem(LOCAL_URL_STORAGE, connection.localUrl);
  localStorage.setItem(LOCAL_MODEL_STORAGE, connection.localModel);
  localStorage.setItem(CONNECTED_STORAGE, "1");
}

export function clear(): void {
  const { provider } = get();
  localStorage.removeItem(keyStorageForProvider(provider));
  localStorage.setItem(CONNECTED_STORAGE, "0");
}

export function isConnected(): boolean {
  const connection = get();
  const marker = localStorage.getItem(CONNECTED_STORAGE);
  if (marker === "0") return false;
  const connected = connection.provider === "local" ? Boolean(connection.localModel) : Boolean(connection.key);
  if (connected && marker !== "1") localStorage.setItem(CONNECTED_STORAGE, "1");
  return connected;
}
