// The agent loop: ask the model, run whatever scripts it asks for, feed the results back, repeat
// until it answers or the iteration budget runs out.

import { buildSystemPrompt } from "./context";
import type { Conversation } from "./conversations";
import { type Completion, complete, type Message, type ToolDefinition, type ToolResultBlock } from "./providers";
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

export interface SessionHandlers {
  onText: (text: string) => void;
  onScript: (code: string) => void;
  onScriptResult: (result: RunResult) => void;
  onStatus: (status: string) => void;
  onUsage: () => void;
}

export interface SessionConfig {
  key: string;
  model: string;
}

export function createSession(getConfig: () => SessionConfig) {
  let controller: AbortController | null = null;

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
          tools: [RUN_TOOL],
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
          const code = toolUse.input.code ?? "";
          handlers.onScript(code);
          handlers.onStatus("Running script");

          capture();
          const result = await runScript(code);
          handlers.onScriptResult(result);
          results.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: formatResult(result),
            is_error: !result.ok
          });
        }

        messages.push({ role: "user", content: results });
      }

      handlers.onText(`(stopped after ${MAX_ITERATIONS} script steps — ask again to continue)`);
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
