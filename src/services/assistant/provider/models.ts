// Discover the chat models a key can use
import { anthropicHeaders, bearerHeaders, endpoint, type ProviderSpec, readError } from "./providers";

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

/** `localUrl` is the local server's address, used only by the local provider */
export async function listModels(
  providerId: ProviderSpec["id"],
  key: string,
  localUrl = "",
  signal?: AbortSignal
): Promise<string[]> {
  return filterChatModels(providerId, await fetchModelIds(providerId, key, localUrl, signal));
}

async function fetchModelIds(
  providerId: ProviderSpec["id"],
  key: string,
  localUrl: string,
  signal?: AbortSignal
): Promise<string[]> {
  if (providerId === "qwen") return fetchQwenModelIds(key, signal);
  const response = await fetch(modelsUrl(providerId, localUrl), { headers: authHeaders(providerId, key), signal });
  if (!response.ok) throw new Error(await readError(response));
  const json = await response.json();
  return (json.data ?? []).map((model: { id: string }) => model.id);
}

async function fetchQwenModelIds(key: string, signal?: AbortSignal): Promise<string[]> {
  const models: string[] = [];
  for (let page = 1; ; page++) {
    const url = `https://dashscope-intl.aliyuncs.com/api/v1/models?providers=qwen&features=function-calling&page_no=${page}&page_size=100`;
    const response = await fetch(url, { headers: authHeaders("qwen", key), signal });
    if (!response.ok) throw new Error(await readError(response));
    const json = await response.json();
    const batch: { model: string }[] = json.output?.models ?? [];
    models.push(...batch.map(item => item.model));
    if (!batch.length || models.length >= (json.output?.total ?? models.length)) return models;
  }
}

function modelsUrl(providerId: ProviderSpec["id"], localUrl: string): string {
  if (providerId === "anthropic") return "https://api.anthropic.com/v1/models?limit=1000";
  return `${endpoint(providerId, localUrl)}/models`;
}

const authHeaders = (providerId: ProviderSpec["id"], key: string): Record<string, string> =>
  providerId === "anthropic" ? anthropicHeaders(key) : bearerHeaders(key);
