import { errorText } from "@/utils/stringUtils";
import type { Chat, TranscriptItem } from "../chats";
import { get } from "./connection";
import { buildSystemPrompt } from "./context";
import { readDocs } from "./docs";
import { searchHelp } from "./knowledge";
import { complete, type Message, type ToolDefinition, type ToolInput, type ToolResultBlock } from "./providers";

export interface ToolOutcome {
  content: ToolResultBlock["content"];
  item?: TranscriptItem;
  isError?: boolean;
}

export interface Tool {
  definition: ToolDefinition;
  status: string; // what the Assistant is doing while the tool runs
  handle(input: ToolInput): Promise<ToolOutcome>;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const KNOWLEDGE: Tool[] = [
  {
    status: "Reading help",
    definition: {
      name: "read_help",
      description:
        "Search the Knowledge Base for how to use the generator. Returns the best-matching sections and other matching headings; pass a heading to read that section.",
      input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
    },
    handle: async input => ({ content: await searchHelp(String(input.query ?? "")) })
  },
  {
    status: "Reading docs",
    definition: {
      name: "read_docs",
      description:
        "Read reference docs by topic: data-model sections, Configuration, Globals, Registries, PackedGraph, Operations, Commands.",
      input_schema: {
        type: "object",
        properties: { topics: { type: "array", items: { type: "string" } } },
        required: ["topics"]
      }
    },
    handle: async input => ({ content: await readDocs(strings(input.topics)) })
  }
];
const MAX_STEPS = 30;
const KEPT_RESULTS = 4;
const TRIMMED = "[Earlier tool result shortened]";
const NO_VISION = "[The image is not available: this model cannot see images]";

export interface ProviderOptions {
  tools: Tool[]; // map tools, beside the knowledge ones
  context: () => Promise<string>;
  onStatus?: (status: string) => void;
}

export async function askProvider(
  chat: Chat,
  question: string,
  onItem: (item: TranscriptItem) => void,
  signal: AbortSignal,
  { tools: mapTools, context, onStatus }: ProviderOptions
): Promise<void> {
  const tools = [...KNOWLEDGE, ...mapTools];
  const definitions = tools.map(tool => tool.definition);
  const byName = new Map(tools.map(tool => [tool.definition.name, tool]));

  onItem({ kind: "question", text: question });
  const start = chat.messages.length;
  let rollbackTo = start;
  chat.messages.push({ role: "user", content: [{ type: "text", text: question }] });
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      signal.throwIfAborted();
      onStatus?.(step ? `Thinking · step ${step + 1}` : "Thinking");
      // Earlier questions keep only their answers; this one keeps its latest tool results
      const stale = [
        ...toolResults(chat.messages.slice(0, start)),
        ...toolResults(chat.messages.slice(start)).slice(0, -KEPT_RESULTS)
      ];
      stale.forEach(result => {
        result.content = TRIMMED;
      });
      const system = buildSystemPrompt(await context());
      signal.throwIfAborted();
      const request = { ...get(), system, messages: chat.messages, tools: definitions, signal };
      // A model without vision rejects images: tell it they are unavailable and ask once more
      const completion = await complete(request).catch(error => {
        if (signal.aborted || !dropImages(chat.messages)) throw error;
        return complete(request);
      });
      if (signal.aborted) throw signal.reason;
      chat.usage.input += completion.usage.input;
      chat.usage.output += completion.usage.output;
      chat.usage.cached += completion.usage.cached;
      if (completion.content.length) chat.messages.push({ role: "assistant", content: completion.content });
      const answer = completion.content
        .filter(block => block.type === "text")
        .map(block => block.text)
        .join("\n\n")
        .trim();
      if (answer) onItem({ kind: "answer", text: answer });
      const calls = completion.content.filter(block => block.type === "tool_use");
      if (!calls.length) return;
      const responses: ToolResultBlock[] = [];
      for (const call of calls) {
        const tool = byName.get(call.name);
        if (!signal.aborted) onStatus?.(tool?.status ?? "Working");
        const outcome: ToolOutcome = signal.aborted
          ? { content: "Cancelled before this tool ran.", isError: true }
          : tool
            ? await tool.handle(call.input).catch(error => ({ content: errorText(error), isError: true }))
            : { content: `Unknown tool ${call.name}. Available: ${[...byName.keys()].join(", ")}`, isError: true };
        if (outcome.item) onItem(outcome.item);
        responses.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: outcome.content,
          is_error: outcome.isError ?? false
        });
      }
      chat.messages.push({ role: "user", content: responses });
      rollbackTo = chat.messages.length;
      signal.throwIfAborted();
    }
    onItem({ kind: "notice", text: `Stopped after ${MAX_STEPS} steps. Ask again to continue.` });
  } catch (error) {
    chat.messages.splice(rollbackTo);
    throw error;
  }
}

const toolResults = (messages: Message[]): ToolResultBlock[] =>
  messages.flatMap(message => message.content.filter(block => block.type === "tool_result"));

/** Replace every image in the history with a note; false when there was none */
function dropImages(messages: Message[]): boolean {
  let dropped = false;
  for (const result of toolResults(messages)) {
    if (typeof result.content === "string") continue;
    result.content = result.content.map(part => {
      if (part.type !== "image") return part;
      dropped = true;
      return { type: "text", text: NO_VISION };
    });
  }
  return dropped;
}
