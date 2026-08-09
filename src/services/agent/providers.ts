// Anthropic Messages API, called straight from the browser with the user's own key — same approach
// as the AI Text Generator. The Prototype supports one provider; the MVP adds the others behind
// this same interface.

import type { SystemBlock } from "./context";

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: { code?: string };
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
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

export interface CompletionRequest {
  key: string;
  model: string;
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
  stopReason: string;
  usage: Usage;
}

export const MODELS = ["claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5"];
export const DEFAULT_MODEL = "claude-sonnet-5";
export const KEY_STORAGE = "fmg-ai-kl-anthropic";
export const KEY_LINK = "https://console.anthropic.com/account/keys";

export async function complete({
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
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({ model, system, messages, tools, max_tokens: 4096 })
  });

  if (!response.ok) throw new Error(await readError(response));

  const json = await response.json();
  return {
    content: json.content ?? [],
    stopReason: json.stop_reason ?? "end_turn",
    usage: {
      input: (json.usage?.input_tokens ?? 0) + (json.usage?.cache_creation_input_tokens ?? 0),
      output: json.usage?.output_tokens ?? 0,
      cached: json.usage?.cache_read_input_tokens ?? 0
    }
  };
}

async function readError(response: Response): Promise<string> {
  try {
    const json = await response.json();
    return json.error?.message || json.error || `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}
