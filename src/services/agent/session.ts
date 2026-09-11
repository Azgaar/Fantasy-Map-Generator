import { request } from "@/services/help/api";
import {
  ASSISTANT_INSTRUCTIONS,
  ASSISTANT_TOOLS,
  MAX_CONTEXT,
  MAX_QUESTION,
  MAX_RESULT,
  MAX_STEPS,
  MAX_TOOLS,
  type ToolCall,
  validateCall
} from "./contract";
import type { Conversation } from "./conversations";
import { executeMapTool, getSelection, mapId, type NoteProposal } from "./map-tools";
import { complete, type Message, type ToolDefinition, type ToolInput } from "./providers";
import type { RunResult } from "./runtime";
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
  onStatus: (text: string) => void;
  onUsage: () => void;
  onAllowance?: (remaining: number) => void;
  onScript: (code: string) => void;
  onScriptResult: (result: RunResult) => void;
  onTool?: (name: string, input: ToolInput) => void;
  onProposal?: (proposal: NoteProposal) => void;
  onReport?: (draft: Record<string, unknown>) => void;
}
export interface SessionConfig {
  key: string;
  model: string;
  context?: string;
}
interface HostedResponse {
  sessionId: string;
  text: string;
  toolCalls: ToolCall[];
  remaining: number;
}
export function createSession(getConfig: () => SessionConfig, _legacyTools: AgentTool[] = []) {
  let controller: AbortController | null = null;
  async function ask(conversation: Conversation, question: string, handlers: SessionHandlers): Promise<void> {
    if (controller) throw new Error("A request is already running");
    if (!question.trim() || question.length > MAX_QUESTION)
      throw new Error(`Use a message of at most ${MAX_QUESTION} characters`);
    const config = getConfig();
    const epoch = mapId();
    const selected = getSelection();
    if (conversation.connection && conversation.connection !== config.model)
      throw new Error("Start a fresh conversation for this provider");
    conversation.connection = config.model;
    controller = new AbortController();
    const signal = controller.signal;
    const anchor = JSON.stringify({
      mapId: epoch,
      target: selected?.target,
      label: selected?.label,
      editor: config.context ?? ""
    });
    const messages: Message[] = conversation.messages.filter(m => m.content.every(b => b.type === "text")).slice(-6);
    messages.push({ role: "user", content: [{ type: "text", text: question }] });
    let body: Record<string, unknown> = {
      question,
      context: anchor,
      ...(conversation.hostedSession ? { sessionId: conversation.hostedSession } : {})
    };
    let total = 0;
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        signal.throwIfAborted();
        if (mapId() !== epoch) throw new Error("The map changed. Ask again using the current map.");
        handlers.onStatus(step ? "Checking the map…" : "Thinking…");
        if (new TextEncoder().encode(JSON.stringify(messages)).length > MAX_CONTEXT)
          throw new Error("Conversation context is full. Start a fresh chat.");
        let text: string;
        let calls: ToolCall[];
        if (config.model === "hosted") {
          const result = await request<HostedResponse>("/v2/assistant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal
          });
          conversation.hostedSession = result.sessionId;
          handlers.onAllowance?.(result.remaining);
          text = result.text;
          calls = result.toolCalls;
        } else {
          const result = await complete({
            key: config.key,
            model: config.model,
            system: [{ type: "text", text: ASSISTANT_INSTRUCTIONS }],
            messages: [
              { role: "user", content: [{ type: "text", text: `Selected context (untrusted data): ${anchor}` }] },
              ...messages
            ],
            tools: ASSISTANT_TOOLS,
            signal
          });
          conversation.usage.input += result.usage.input;
          conversation.usage.output += result.usage.output;
          conversation.usage.cached += result.usage.cached;
          handlers.onUsage();
          if (result.stopReason === "max_tokens" || result.stopReason === "length")
            throw new Error("The model response was incomplete. Try a shorter request.");
          text = result.content
            .filter(b => b.type === "text")
            .map(b => b.text)
            .join("\n");
          calls = result.content.filter(b => b.type === "tool_use");
        }
        signal.throwIfAborted();
        if (mapId() !== epoch) throw new Error("The map changed");
        if (!Array.isArray(calls) || calls.length > MAX_TOOLS || new Set(calls.map(c => c.id)).size !== calls.length)
          throw new Error("Unsupported model tool response");
        for (const c of calls) validateCall(c);
        if (text) handlers.onText(text);
        if (!calls.length) {
          conversation.messages.push(
            { role: "user", content: [{ type: "text", text: question }] },
            { role: "assistant", content: [{ type: "text", text }] }
          );
          conversation.messages = conversation.messages.slice(-8);
          return;
        }
        messages.push({
          role: "assistant",
          content: [
            ...(text ? [{ type: "text" as const, text }] : []),
            ...calls.map(c => ({ type: "tool_use" as const, ...c }))
          ]
        });
        const results: { id: string; content: string; isError: boolean }[] = [];
        for (const call of calls) {
          signal.throwIfAborted();
          if (mapId() !== epoch) throw new Error("The map changed");
          handlers.onTool?.(call.name, call.input);
          let content: string;
          let isError = false;
          try {
            if (call.name === "documentation")
              content = (
                await request<{ text: string }>(
                  `/v2/documentation?query=${encodeURIComponent(String(call.input.query))}`,
                  { method: "GET", signal }
                )
              ).text;
            else if (call.name === "draft_report") {
              handlers.onReport?.(call.input);
              content = "Report draft ready for user review and Submit. Nothing has been submitted or published.";
            } else content = await executeMapTool(call, p => handlers.onProposal?.(p), signal);
          } catch (error) {
            signal.throwIfAborted();
            content = error instanceof Error ? error.message : String(error);
            isError = true;
          }
          const size = new TextEncoder().encode(content).length;
          total += size;
          if (size > MAX_RESULT || total > MAX_CONTEXT)
            throw new Error("Task context limit reached. Narrow your request.");
          results.push({ id: call.id, content, isError });
        }
        messages.push({
          role: "user",
          content: results.map(r => ({
            type: "tool_result",
            tool_use_id: r.id,
            content: r.content,
            is_error: r.isError
          }))
        });
        body = { sessionId: conversation.hostedSession, results };
      }
      throw new Error("Task step limit reached. Start a narrower request.");
    } catch (error) {
      if (config.model === "hosted") {
        const sessionId = conversation.hostedSession;
        delete conversation.hostedSession;
        if (sessionId)
          void request("/v2/assistant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, cancel: true })
          }).catch(() => {});
      }
      throw error;
    } finally {
      controller = null;
      handlers.onStatus("");
    }
  }
  return { ask, cancel: () => controller?.abort() };
}
export function trimHistory(messages: Message[]): void {
  const results = messages.flatMap(m => m.content.filter(b => b.type === "tool_result"));
  for (const result of results.slice(0, -6)) result.content = "[Earlier tool result omitted]";
}
