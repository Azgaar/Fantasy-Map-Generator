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
// Providers bill an image by its pixels, not its base64 length: an emblem costs about as much as this much text
const IMAGE_SIZE = 1_000; // characters
const NO_VISION = "[The image is not available: this model cannot see images]";
const IMAGE_REJECTED = /image|vision|multimodal/i; // how providers word a model without vision; a 429 or outage is not retried
// Text beside a lookup ("Let me check…") or a failed call is a preamble, shown only when no answer follows it
const LOOKUP = /^(read|view)_/;
const CUT_OFF =
  "Your reply was cut off at the output limit. Think briefly and keep calls small: split a large batch into several propose_change calls.";
// Models sometimes describe a proposal they never sent
const CLAIM =
  /\bI(?:'ve| have)? (?:proposed|prepared|submitted)\b|\b(?:proposal|batch|card)\b[^.\n]{0,40}\b(?:is waiting|waiting for|pending|above)\b/i;
const DECLINED = /\bproposed nothing\b|\bnothing (?:to propose|proposed)\b/i;
const UNPROPOSED =
  "Your answer says something was proposed, but no propose_change call succeeded in this question, so the user sees no card. Call propose_change now, or say plainly that nothing was proposed.";

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
  let preamble = "";
  let said = ""; // answers shown for this question
  let proposed = false;
  let nudged = false;
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
      trimToBudget(chat.messages.slice(start));
      const request = { ...get(), system: SYSTEM_PROMPT, messages: chat.messages, tools: definitions, signal };
      // A model without vision rejects images: tell it they are unavailable and ask once more
      const completion = await complete(request).catch(error => {
        if (signal.aborted || !IMAGE_REJECTED.test(errorText(error)) || !dropImages(chat.messages)) throw error;
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
      const calls = completion.content.filter(block => block.type === "tool_use");
      if (!calls.length && completion.truncated) {
        chat.messages.push({ role: "user", content: [{ type: "text", text: CUT_OFF }] });
        continue;
      }
      if (!calls.length) {
        said += answer;
        if (answer || preamble) onItem({ kind: "answer", text: answer || preamble });
        if (!nudged && byName.has("propose_change") && !proposed && CLAIM.test(said) && !DECLINED.test(said)) {
          nudged = true;
          preamble = "";
          chat.messages.push({ role: "user", content: [{ type: "text", text: UNPROPOSED }] });
          continue;
        }
        if (!answer && !preamble) onItem({ kind: "notice", text: "The model ended without an answer. Ask again." });
        return;
      }
      const responses: ToolResultBlock[] = [];
      const items: TranscriptItem[] = [];
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
        if (outcome.item) items.push(outcome.item);
        responses.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: outcome.content,
          is_error: outcome.isError ?? false
        });
      }
      if (answer && (calls.some(call => LOOKUP.test(call.name)) || responses.some(result => result.is_error)))
        preamble = answer;
      else if (answer) {
        said += answer;
        onItem({ kind: "answer", text: answer });
        preamble = "";
      }
      if (items.some(item => item.kind === "proposal")) proposed = true;
      for (const item of items) onItem(item);
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

const resultSize = ({ content }: ToolResultBlock): number =>
  typeof content === "string"
    ? content.length
    : content.reduce((sum, part) => sum + (part.type === "text" ? part.text.length : IMAGE_SIZE), 0);

/** Shorten the oldest results until the rest fit the budget; the latest step's results are always kept whole */
function trimToBudget(messages: Message[]): void {
  const results = toolResults(messages);
  const latest = toolResults(messages.slice(-1)).length;
  let total = results.reduce((sum, result) => sum + resultSize(result), 0);
  for (const result of results.slice(0, results.length - latest)) {
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
