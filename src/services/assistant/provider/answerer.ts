import { errorText } from "@/utils/stringUtils";
import type { Chat, TranscriptItem } from "../chats";
import { get } from "./connection";
import { SYSTEM_PROMPT } from "./context";
import { readDocs } from "./docs";
import { searchHelp } from "./knowledge";
import {
  complete,
  INVALID_ARGUMENTS,
  type Message,
  type ToolDefinition,
  type ToolInput,
  type ToolResultBlock
} from "./providers";

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
// This question's results stay whole until they outgrow the budget, then the oldest are shortened. History never
// changes between steps otherwise, so providers serve the whole prefix from their prompt cache
const RESULTS_BUDGET = 32_000; // characters
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
  let sentContext = "";
  try {
    // Earlier questions keep only their answers
    for (const result of toolResults(chat.messages.slice(0, start))) result.content = TRIMMED;
    for (let step = 0; step < MAX_STEPS; step++) {
      signal.throwIfAborted();
      onStatus?.(step ? `Thinking · step ${step + 1}` : "Thinking");
      // The map context opens the question, not the byte-identical system prompt, and a changed one (after an
      // Apply) joins the newest message, so the history before it stays cached
      const mapContext = await context();
      signal.throwIfAborted();
      if (!step)
        chat.messages.push({
          role: "user",
          content: [
            { type: "text", text: mapContext },
            { type: "text", text: question }
          ]
        });
      else if (mapContext !== sentContext) chat.messages.at(-1)!.content.push({ type: "text", text: mapContext });
      sentContext = mapContext;
      trimToBudget(toolResults(chat.messages.slice(start)));
      const request = { ...get(), system: SYSTEM_PROMPT, messages: chat.messages, tools: definitions, signal };
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
          : INVALID_ARGUMENTS in call.input
            ? { content: String(call.input[INVALID_ARGUMENTS]), isError: true }
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

const resultSize = (result: ToolResultBlock): number =>
  typeof result.content === "string" ? result.content.length : JSON.stringify(result.content).length;

/** Shorten the oldest results until the rest fit the budget; the latest result is always kept */
function trimToBudget(results: ToolResultBlock[]): void {
  let total = results.reduce((sum, result) => sum + resultSize(result), 0);
  for (const result of results.slice(0, -1)) {
    if (total <= RESULTS_BUDGET) return;
    total -= resultSize(result) - TRIMMED.length;
    result.content = TRIMMED;
  }
}

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
