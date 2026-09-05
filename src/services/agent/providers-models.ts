// Live model discovery: every supported provider exposes GET /models, so the selector can list
// what a key can actually use instead of a hardcoded snapshot. Results are cached for a day and
// merged after the curated recommendations.

import { DEFAULT_LOCAL_URL, LOCAL_URL_STORAGE, PROVIDERS, type ProviderSpec, registerModels } from "./providers";

const CACHE_TTL = 24 * 60 * 60 * 1000;

// What counts as a chat model: the endpoints also list embeddings, audio, image and moderation
// variants that cannot drive the tool loop
const FILTERS: Partial<Record<ProviderSpec["id"], { include?: RegExp; exclude?: RegExp }>> = {
  anthropic: { include: /^claude/ },
  openai: { include: /^(gpt|o\d)/, exclude: /audio|realtime|image|tts|embed|whisper|moderation|transcribe|dall/ },
  mistral: { exclude: /embed|moderation|ocr|voxtral|transcribe/ },
  qwen: { include: /^qwen/, exclude: /embed|ocr|audio|tts|asr|image|video|omni|vl|mt/ },
  deepseek: { include: /^deepseek/ }
};

export function filterChatModels(providerId: ProviderSpec["id"], ids: string[]): string[] {
  const filter = FILTERS[providerId];
  if (!filter) return ids;
  return ids.filter(id => (!filter.include || filter.include.test(id)) && !filter.exclude?.test(id));
}

export async function listModels(providerId: ProviderSpec["id"], key: string): Promise<string[]> {
  const models = filterChatModels(providerId, await fetchModelIds(providerId, key));
  cacheModels(providerId, models);
  registerModels(providerId, models);
  return models;
}

async function fetchModelIds(providerId: ProviderSpec["id"], key: string): Promise<string[]> {
  const response = await fetch(modelsUrl(providerId), { headers: authHeaders(providerId, key) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const json = await response.json();
  return (json.data ?? []).map((model: { id: string }) => model.id);
}

function modelsUrl(providerId: ProviderSpec["id"]): string {
  if (providerId === "anthropic") return "https://api.anthropic.com/v1/models";
  if (providerId === "local") {
    const base = (localStorage.getItem(LOCAL_URL_STORAGE) || DEFAULT_LOCAL_URL).replace(/\/+$/, "");
    return `${base}/models`;
  }
  const provider = PROVIDERS.find(candidate => candidate.id === providerId);
  return `${provider?.baseUrl}/models`;
}

function authHeaders(providerId: ProviderSpec["id"], key: string): Record<string, string> {
  if (providerId === "anthropic") {
    return { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" };
  }
  return key ? { Authorization: `Bearer ${key}` } : {};
}

export function cacheModels(providerId: ProviderSpec["id"], models: string[]): void {
  try {
    localStorage.setItem(`fmg-ai-models-${providerId}`, JSON.stringify({ time: Date.now(), models }));
  } catch {
    // a full or unavailable storage only costs a refetch next time
  }
}

export function cachedModels(providerId: ProviderSpec["id"]): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(`fmg-ai-models-${providerId}`) ?? "null");
    if (!stored || !Array.isArray(stored.models)) return [];
    return Date.now() - stored.time > CACHE_TTL ? [] : stored.models;
  } catch {
    return [];
  }
}

export function mergeModels(curated: string[], discovered: string[]): string[] {
  return [...curated, ...discovered.filter(model => !curated.includes(model))];
}
