// Translates the agent's Anthropic-shaped conversation into the OpenAI chat/completions format
// spoken by OpenAI, Mistral, Qwen (DashScope compatible mode) and DeepSeek, and back.

import type { SystemBlock } from "./context";
import type { Completion, CompletionRequest, Message, TextBlock, ToolDefinition, ToolUseBlock } from "./providers";

type ChatMessage = Record<string, unknown>;

export function toChatMessages(system: SystemBlock[], messages: Message[]): ChatMessage[] {
  const chat: ChatMessage[] = [{ role: "system", content: system.map(block => block.text).join("\n\n") }];

  for (const message of messages) {
    if (message.role === "assistant") {
      const text = message.content
        .filter(block => block.type === "text")
        .map(block => block.text)
        .join("\n\n");
      const toolCalls = message.content
        .filter(block => block.type === "tool_use")
        .map(block => ({
          id: block.id,
          type: "function",
          function: { name: block.name, arguments: JSON.stringify(block.input) }
        }));

      const entry: ChatMessage = { role: "assistant", content: text || null };
      if (toolCalls.length) entry.tool_calls = toolCalls;
      chat.push(entry);
      continue;
    }

    for (const block of message.content) {
      if (block.type === "text") chat.push({ role: "user", content: block.text });
      else if (block.type === "tool_result") {
        chat.push({ role: "tool", tool_call_id: block.tool_use_id, content: block.content });
      }
    }
  }

  return chat;
}

export function toChatTools(tools: ToolDefinition[]): ChatMessage[] {
  return tools.map(tool => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.input_schema }
  }));
}

export function fromChatResponse(json: {
  choices?: {
    message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] };
    finish_reason?: string;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
    prompt_cache_hit_tokens?: number;
  };
}): Completion {
  const message = json.choices?.[0]?.message ?? {};
  const content: (TextBlock | ToolUseBlock)[] = [];

  if (message.content) content.push({ type: "text", text: message.content });
  for (const call of message.tool_calls ?? []) {
    content.push({
      type: "tool_use",
      id: call.id,
      name: call.function.name,
      input: parseArguments(call.function.arguments)
    });
  }

  const finishReason = json.choices?.[0]?.finish_reason ?? "stop";
  const cached = json.usage?.prompt_tokens_details?.cached_tokens ?? json.usage?.prompt_cache_hit_tokens ?? 0;

  return {
    content,
    stopReason: finishReason === "tool_calls" ? "tool_use" : finishReason === "stop" ? "end_turn" : finishReason,
    usage: { input: (json.usage?.prompt_tokens ?? 0) - cached, output: json.usage?.completion_tokens ?? 0, cached }
  };
}

function parseArguments(raw: string): { code?: string } {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function completeOpenAI(
  baseUrl: string,
  { key, model, system, messages, tools, signal }: CompletionRequest
): Promise<Completion> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: toChatMessages(system, messages),
      tools: toChatTools(tools),
      max_tokens: 4096
    })
  });

  if (!response.ok) throw new Error(await readChatError(response));
  return fromChatResponse(await response.json());
}

async function readChatError(response: Response): Promise<string> {
  try {
    const json = await response.json();
    return json.error?.message || json.message || `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}
