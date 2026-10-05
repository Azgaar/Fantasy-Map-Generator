// Translates the Assistant's Anthropic-shaped chat into the OpenAI chat/completions format
// spoken by OpenAI, Mistral, Qwen (DashScope compatible mode) and DeepSeek, and back.

import { errorText } from "@/utils/stringUtils";
import type { SystemBlock } from "./context";
import {
  bearerHeaders,
  type Completion,
  type CompletionRequest,
  type ImageBlock,
  INVALID_ARGUMENTS,
  type Message,
  readError,
  type TextBlock,
  type ToolDefinition,
  type ToolInput,
  type ToolUseBlock
} from "./providers";

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

      if (!text && !toolCalls.length) continue; // an empty turn is invalid: content may be null only beside tool calls
      const entry: ChatMessage = { role: "assistant", content: text || null };
      if (toolCalls.length) entry.tool_calls = toolCalls;
      chat.push(entry);
      continue;
    }

    // A tool message holds text only, so images a tool returned follow its results as one user message
    const images: ChatMessage[] = [];
    for (const block of message.content) {
      if (block.type === "text") chat.push({ role: "user", content: block.text });
      else if (block.type === "image") chat.push({ role: "user", content: [imageUrl(block)] });
      else if (block.type === "tool_result") {
        const parts =
          typeof block.content === "string" ? [{ type: "text" as const, text: block.content }] : block.content;
        const text = parts.flatMap(part => (part.type === "text" ? [part.text] : [])).join("\n");
        chat.push({ role: "tool", tool_call_id: block.tool_use_id, content: text || "The image follows." });
        for (const part of parts) if (part.type === "image") images.push(imageUrl(part));
      }
    }
    if (images.length)
      chat.push({ role: "user", content: [{ type: "text", text: "Images from the tools above:" }, ...images] });
  }

  return chat;
}

const imageUrl = ({ source }: ImageBlock): ChatMessage => ({
  type: "image_url",
  image_url: { url: `data:${source.media_type};base64,${source.data}` }
});

export function toChatTools(tools: ToolDefinition[]): ChatMessage[] {
  return tools.map(tool => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.input_schema }
  }));
}

export function fromChatResponse(json: {
  choices?: {
    message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] };
    finish_reason?: string | null;
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

  const cached = json.usage?.prompt_tokens_details?.cached_tokens ?? json.usage?.prompt_cache_hit_tokens ?? 0;

  return {
    content,
    truncated: json.choices?.[0]?.finish_reason === "length",
    usage: { input: (json.usage?.prompt_tokens ?? 0) - cached, output: json.usage?.completion_tokens ?? 0, cached }
  };
}

function parseArguments(raw: string): ToolInput {
  try {
    const input: unknown = JSON.parse(raw || "{}");
    if (typeof input !== "object" || input === null || Array.isArray(input))
      return { [INVALID_ARGUMENTS]: "The arguments must be a JSON object. Send the call again with named parameters" };
    return input as ToolInput;
  } catch (error) {
    return {
      [INVALID_ARGUMENTS]: `The arguments are not valid JSON (${errorText(error)}); a long call may have hit the output limit. Send it again, shorter if it was long`
    };
  }
}

// DeepSeek counts its reasoning against the limit, so a large batch would be cut off at 4096
const outputLimit = (baseUrl: string) => (baseUrl.includes("deepseek.com") ? 8192 : 4096);

export async function completeOpenAI(
  baseUrl: string,
  { key, model, system, messages, tools, signal }: CompletionRequest
): Promise<Completion> {
  const openAI = baseUrl === "https://api.openai.com/v1";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", ...bearerHeaders(key) },
    body: JSON.stringify({
      model,
      messages: toChatMessages(system, messages),
      tools: toChatTools(tools),
      ...(openAI ? { max_completion_tokens: 4096 } : { max_tokens: outputLimit(baseUrl) }),
      ...(openAI && /^gpt-6-(sol|luna)$/.test(model) ? { reasoning_effort: "none" } : {})
    })
  });

  if (!response.ok) throw new Error(await readError(response));
  return fromChatResponse(await response.json());
}
