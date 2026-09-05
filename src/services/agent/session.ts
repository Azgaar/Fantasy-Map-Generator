// The agent loop: ask the model, run whatever tools it asks for, feed the results back, repeat
// until it answers or the iteration budget runs out. `run` is built in; callers register any
// further tools (the assistant's write_note, for instance) alongside it.

import { buildSystemPrompt } from "./context";
import type { Conversation } from "./conversations";
import {
  type Completion,
  complete,
  type Message,
  type ToolDefinition,
  type ToolInput,
  type ToolResultBlock
} from "./providers";
import { type RunResult, runScript } from "./runtime";
import { capture } from "./snapshot";

const MAX_ITERATIONS = 30;

// Script output dominates a long conversation's token bill and is rarely needed once the model has
// answered, so all but the most recent results are replaced with a marker before the next request.
const KEEP_DETAILED_RESULTS = 6;
const TRIMMED_RESULT = "[earlier script output trimmed to save tokens]";

const RUN_TOOL: ToolDefinition = {
  name: "run",
  description: `Execute JavaScript against the currently open map and get its result back.

The code runs as the body of an async function in the page's global scope, so every FMG global is in
scope and top-level \`await\` works. \`return\` the value you want to see — only the returned value and
console output come back, so aggregate and slice before returning. A \`describe(pathOrValue)\` helper
is in scope for inspecting an unfamiliar global at runtime.`,
  input_schema: {
    type: "object",
    properties: {
      code: { type: "string", description: "JavaScript to execute. Use `return` to produce the result." }
    },
    required: ["code"]
  }
};

export interface ToolOutcome {
  content: string;
  isError?: boolean;
}

export interface AgentTool {
  definition: ToolDefinition;
  handle: (input: ToolInput) => Promise<ToolOutcome>;
}

export interface SessionHandlers {
  onText: (text: string) => void;
  onScript: (code: string) => void;
  onScriptResult: (result: RunResult) => void;
  onStatus: (status: string) => void;
  onUsage: () => void;
  onTool?: (name: string, input: ToolInput) => void;
}

export interface SessionConfig {
  key: string;
  model: string;
  context?: string; // extra per-turn system text, e.g. the note open in the notes editor
}

export function createSession(getConfig: () => SessionConfig, tools: AgentTool[] = []) {
  let controller: AbortController | null = null;
  const definitions = [RUN_TOOL, ...tools.map(tool => tool.definition)];
  const byName = new Map(tools.map(tool => [tool.definition.name, tool]));

  async function runTool(toolUse: { name: string; input: ToolInput }, handlers: SessionHandlers): Promise<ToolOutcome> {
    if (toolUse.name === RUN_TOOL.name) {
      const code = typeof toolUse.input.code === "string" ? toolUse.input.code : "";
      handlers.onScript(code);
      handlers.onStatus("Running script");
      capture();
      const result = await runScript(code);
      handlers.onScriptResult(result);
      return { content: formatResult(result), isError: !result.ok };
    }

    const tool = byName.get(toolUse.name);
    if (!tool) {
      const known = definitions.map(definition => definition.name).join(", ");
      return { content: `Unknown tool "${toolUse.name}". Available tools: ${known}.`, isError: true };
    }
    handlers.onTool?.(toolUse.name, toolUse.input);
    handlers.onStatus(`Using ${toolUse.name}`);
    try {
      return await tool.handle(toolUse.input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: `${toolUse.name} failed: ${message}`, isError: true };
    }
  }

  async function ask(conversation: Conversation, question: string, handlers: SessionHandlers): Promise<void> {
    const { messages } = conversation;
    messages.push({ role: "user", content: [{ type: "text", text: question }] });
    controller = new AbortController();

    try {
      for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
        const { key, model } = getConfig();
        handlers.onStatus(iteration === 1 ? "Thinking" : `Thinking (step ${iteration})`);
        trimHistory(messages);

        const completion = await complete({
          key,
          model,
          system: buildSystemPrompt(),
          messages,
          tools: definitions,
          signal: controller.signal
        });

        conversation.usage.input += completion.usage.input;
        conversation.usage.output += completion.usage.output;
        conversation.usage.cached += completion.usage.cached;
        handlers.onUsage();

        messages.push({ role: "assistant", content: completion.content });
        emitText(completion, handlers);

        const toolUses = completion.content.filter(block => block.type === "tool_use");
        if (!toolUses.length) return;

        const results: ToolResultBlock[] = [];
        for (const toolUse of toolUses) {
          const outcome = await runTool(toolUse, handlers);
          results.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: outcome.content,
            is_error: outcome.isError ?? false
          });
        }

        messages.push({ role: "user", content: results });
      }

      handlers.onText(`(stopped after ${MAX_ITERATIONS} tool steps — ask again to continue)`);
    } finally {
      controller = null;
      handlers.onStatus("");
    }
  }

  return { ask, cancel: (): void => controller?.abort() };
}

export function trimHistory(messages: Message[]): void {
  const results = messages.flatMap(message => message.content.filter(block => block.type === "tool_result"));
  results.slice(0, Math.max(0, results.length - KEEP_DETAILED_RESULTS)).forEach(block => {
    block.content = TRIMMED_RESULT;
  });
}

function emitText(completion: Completion, handlers: SessionHandlers): void {
  const text = completion.content
    .filter(block => block.type === "text")
    .map(block => block.text.trim())
    .filter(Boolean)
    .join("\n\n");
  if (text) handlers.onText(text);
}

function formatResult(result: RunResult): string {
  const parts: string[] = [];
  if (result.logs.length) parts.push(`console:\n${result.logs.join("\n")}`);
  if (result.ok) parts.push(`result (${result.ms} ms):\n${result.value}`);
  else parts.push(`threw after ${result.ms} ms:\n${result.error?.message}\n${result.error?.stack}`);
  return parts.join("\n\n");
}
