// Anthropic Messages API, called straight from the browser with the user's own key — same approach
// as the AI Text Generator. OpenAI-compatible providers go through openai.ts.

import type { Connection } from "./connection";
import type { SystemBlock } from "./context";
import { completeOpenAI } from "./openai";

export interface TextBlock {
  type: "text";
  text: string;
}

export type ToolInput = Record<string, unknown>;
/** Holds the error in place of arguments a provider sent as broken JSON, so the model hears why its call failed */
export const INVALID_ARGUMENTS = "invalidArguments";

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: ToolInput;
}

export interface ImageBlock {
  type: "image";
  source: { type: "base64"; media_type: "image/png"; data: string };
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | (TextBlock | ImageBlock)[];
  is_error?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface Message {
  role: "user" | "assistant";
  content: ContentBlock[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface CompletionRequest extends Connection {
  system: SystemBlock[];
  messages: Message[];
  tools: ToolDefinition[];
  signal?: AbortSignal;
}

export interface Usage {
  input: number; // tokens billed at the full rate, including cache writes
  output: number;
  cached: number; // cache reads, billed at a tenth of the input rate
}

export interface Completion {
  content: (TextBlock | ToolUseBlock)[];
  usage: Usage;
  truncated?: boolean; // stopped at the output limit; reasoning models can spend all of it before a word
}

export interface ProviderSpec {
  id: "anthropic" | "openai" | "mistral" | "qwen" | "deepseek" | "local";
  label: string;
  fallbackModel: string;
  keyLink: string;
  baseUrl?: string; // OpenAI-compatible endpoints only; absent for the native Anthropic adapter
}

export const PROVIDERS: ProviderSpec[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    fallbackModel: "claude-sonnet-5-5",
    keyLink: "https://console.anthropic.com/account/keys"
  },
  {
    id: "openai",
    label: "OpenAI",
    fallbackModel: "gpt-6-luna",
    keyLink: "https://platform.openai.com/account/api-keys",
    baseUrl: "https://api.openai.com/v1"
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    fallbackModel: "deepseek-flash",
    keyLink: "https://platform.deepseek.com/api_keys",
    baseUrl: "https://api.deepseek.com/v1"
  },
  {
    id: "mistral",
    label: "Mistral",
    fallbackModel: "mistral-small-latest",
    keyLink: "https://console.mistral.ai/api-keys",
    baseUrl: "https://api.mistral.ai/v1"
  },
  {
    id: "qwen",
    label: "Qwen",
    fallbackModel: "qwen3.8-flash",
    keyLink: "https://modelstudio.console.alibabacloud.com/?tab=playground#/api-key",
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
  },
  {
    id: "local",
    label: "Local",
    fallbackModel: "",
    keyLink: "https://ollama.com",
    baseUrl: "http://localhost:11434/v1"
  }
];

export const providerById = (id: string | null | undefined): ProviderSpec | undefined =>
  PROVIDERS.find(provider => provider.id === id);

export const DEFAULT_PROVIDER = providerById("openai")!;

export const keyStorageForProvider = (providerId: ProviderSpec["id"]): string => `fmg-ai-kl-${providerId}`;

/** The OpenAI-compatible base URL: a local server's own address, else the provider's */
export const endpoint = (providerId: ProviderSpec["id"], localUrl = ""): string =>
  ((providerId === "local" && localUrl) || providerById(providerId)?.baseUrl || "").replace(/\/+$/, "");

/** Local servers commonly run without auth, so the header is only sent when there is a key */
export const bearerHeaders = (key: string): Record<string, string> => (key ? { Authorization: `Bearer ${key}` } : {});

export const anthropicHeaders = (key: string): Record<string, string> => ({
  "x-api-key": key,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true"
});

// A busy cloud provider can hold a request open with keep-alives for good; a local model may just be slow
const TIMEOUT_MINUTES = 3;

export async function complete(request: CompletionRequest): Promise<Completion> {
  // An empty turn (a model that ended without a word) is rejected by every provider once it is history
  request = { ...request, messages: request.messages.filter(message => message.content.length) };
  const provider = providerById(request.provider);
  if (!provider) throw new Error(`Unknown provider: ${request.provider}`);
  if (!request.model) throw new Error("Enter a model name (e.g. llama3.2)");
  const timeout = provider.id === "local" ? undefined : AbortSignal.timeout(TIMEOUT_MINUTES * 60_000);
  const signals = [request.signal, timeout].filter(signal => signal !== undefined);
  const call = { ...request, signal: signals.length ? AbortSignal.any(signals) : undefined };
  try {
    if (provider.id === "anthropic") return await completeAnthropic(call);
    return await completeOpenAI(endpoint(provider.id, request.localUrl), call);
  } catch (error) {
    if (!timeout?.aborted || request.signal?.aborted) throw error;
    throw new Error(`${provider.label} did not answer in ${TIMEOUT_MINUTES} minutes. Ask again, or pick another model`);
  }
}

async function completeAnthropic({
  key,
  model,
  system,
  messages,
  tools,
  signal
}: CompletionRequest): Promise<Completion> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", ...anthropicHeaders(key) },
    body: JSON.stringify({ model, system, messages: markCached(messages), tools, max_tokens: 4096 })
  });

  if (!response.ok) throw new Error(await readError(response));

  const json = await response.json();
  return {
    content: json.content ?? [],
    truncated: json.stop_reason === "max_tokens",
    usage: {
      input: (json.usage?.input_tokens ?? 0) + (json.usage?.cache_creation_input_tokens ?? 0),
      output: json.usage?.output_tokens ?? 0,
      cached: json.usage?.cache_read_input_tokens ?? 0
    }
  };
}

/** Anthropic caches only up to a marked block: marking the latest one lets the next step reread the chat cheaply */
export function markCached(messages: Message[]): Message[] {
  const last = messages.at(-1);
  if (!last?.content.length) return messages;
  const content = [...last.content];
  const marked: ContentBlock & { cache_control: SystemBlock["cache_control"] } = {
    ...content.at(-1)!,
    cache_control: { type: "ephemeral" }
  };
  content[content.length - 1] = marked;
  return [...messages.slice(0, -1), { ...last, content }];
}

/** The provider's own error message, whichever of the usual shapes it comes in */
export async function readError(response: Response): Promise<string> {
  try {
    const json = await response.json();
    const message = json.error?.message || json.error || json.message || json.output?.message;
    if (typeof message === "string" && message) return message;
  } catch {
    // not JSON
  }
  return `${response.status} ${response.statusText}`;
}
