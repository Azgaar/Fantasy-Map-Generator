// Discover models available to a key and keep one fallback for unavailable endpoints.

import { DEFAULT_LOCAL_URL, LOCAL_URL_STORAGE, PROVIDERS, type ProviderSpec, registerModels } from "./providers";

const CACHE_TTL = 24 * 60 * 60 * 1000;

// What counts as a chat model: the endpoints also list embeddings, audio, image and moderation
// variants that cannot drive the tool loop
const FILTERS: Partial<Record<ProviderSpec["id"], { include?: RegExp; exclude?: RegExp }>> = {
  anthropic: { include: /^claude/ },
  openai: {
    include: /^(gpt|o\d)/,
    exclude: /audio|realtime|image|tts|embed|whisper|moderation|transcribe|dall|gpt-6-astra/
  },
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
  if (providerId === "qwen") return fetchQwenModelIds(key);
  const response = await fetch(modelsUrl(providerId), { headers: authHeaders(providerId, key) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const json = await response.json();
  return (json.data ?? []).map((model: { id: string }) => model.id);
}

async function fetchQwenModelIds(key: string): Promise<string[]> {
  const models: string[] = [];
  for (let page = 1; ; page++) {
    const url = `https://dashscope-intl.aliyuncs.com/api/v1/models?providers=qwen&features=function-calling&page_no=${page}&page_size=100`;
    const response = await fetch(url, { headers: authHeaders("qwen", key) });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const json = await response.json();
    const batch: { model: string }[] = json.output?.models ?? [];
    models.push(...batch.map(item => item.model));
    if (!batch.length || models.length >= (json.output?.total ?? models.length)) return models;
  }
}

function modelsUrl(providerId: ProviderSpec["id"]): string {
  if (providerId === "anthropic") return "https://api.anthropic.com/v1/models?limit=1000";
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

export function modelChoices(provider: ProviderSpec, discovered: string[]): string[] {
  if (provider.id === "local")
    return [provider.fallbackModel, ...discovered.filter(model => model !== provider.fallbackModel)];
  const models = [...new Set(discovered.length ? discovered : [provider.fallbackModel])];
  const recommended = recommendedModel(provider, models);
  return [recommended, ...models.filter(model => model !== recommended)];
}

export function recommendedModel(provider: ProviderSpec, models: string[]): string {
  if (provider.recommendedAlias && models.includes(provider.recommendedAlias)) return provider.recommendedAlias;
  const family = models.filter(model => provider.recommendedFamily?.test(model));
  family.sort((a, b) => compareVersions(b, a) || a.length - b.length || a.localeCompare(b));
  return family[0] ?? models[0] ?? provider.fallbackModel;
}

function compareVersions(a: string, b: string): number {
  const first =
    a
      .match(/\d+(?:[.-]\d+)*/)?.[0]
      .split(/[.-]/)
      .map(Number) ?? [];
  const second =
    b
      .match(/\d+(?:[.-]\d+)*/)?.[0]
      .split(/[.-]/)
      .map(Number) ?? [];
  for (let index = 0; index < 2; index++) {
    const difference = (first[index] ?? 0) - (second[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}
