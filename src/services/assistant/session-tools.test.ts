import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "./conversations";
import type { Completion, Message } from "./providers";

const { complete } = vi.hoisted(() => ({ complete: vi.fn() }));
vi.mock("./providers", () => ({ complete }));
vi.mock("./snapshot", () => ({ capture: () => {} }));
vi.mock("./context", () => ({ buildSystemPrompt: () => [] }));
vi.mock("./runtime", () => ({
  runScript: async (code: string) => ({ ok: true, value: `ran:${code}`, logs: [], ms: 1 })
}));

import { type AgentTool, createSession, type SessionHandlers } from "./session";

const usage = { input: 1, output: 1, cached: 0 };
const text = (value: string): Completion => ({
  content: [{ type: "text", text: value }],
  stopReason: "end_turn",
  usage
});
const toolUse = (name: string, input: Record<string, unknown>): Completion => ({
  content: [{ type: "tool_use", id: `id-${name}`, name, input }],
  stopReason: "tool_use",
  usage
});

const conversation = (): Conversation => ({
  id: "c1",
  title: "t",
  mapId: 0,
  updated: 0,
  entries: [],
  messages: [],
  usage: { input: 0, output: 0, cached: 0 }
});

const handlers = (): SessionHandlers & { texts: string[]; tools: string[] } => {
  const texts: string[] = [];
  const tools: string[] = [];
  return {
    texts,
    tools,
    onText: value => texts.push(value),
    onScript: () => {},
    onScriptResult: () => {},
    onStatus: () => {},
    onUsage: () => {},
    onTool: name => tools.push(name)
  };
};

const toolResults = (messages: Message[]) =>
  messages.flatMap(message => message.content.filter(block => block.type === "tool_result"));

beforeEach(() => complete.mockReset());

describe("createSession tool dispatch", () => {
  it("routes a registered tool and feeds its content back to the model", async () => {
    const handle = vi.fn(async (input: Record<string, unknown>) => ({ content: `wrote ${input.html}` }));
    const tool: AgentTool = {
      definition: { name: "write_note", description: "d", input_schema: { type: "object" } },
      handle
    };
    complete.mockResolvedValueOnce(toolUse("write_note", { html: "<p>x</p>" })).mockResolvedValueOnce(text("done"));

    const session = createSession(() => ({ key: "k", model: "claude-sonnet-5" }), [tool]);
    const chat = conversation();
    const h = handlers();
    await session.ask(chat, "edit it", h);

    expect(handle).toHaveBeenCalledWith({ html: "<p>x</p>" });
    expect(h.tools).toEqual(["write_note"]);
    expect(toolResults(chat.messages)).toEqual([
      { type: "tool_result", tool_use_id: "id-write_note", content: "wrote <p>x</p>", is_error: false }
    ]);
    expect(h.texts).toEqual(["done"]);
    // both tools are offered to the model
    expect(complete.mock.calls[0][0].tools.map((t: { name: string }) => t.name)).toEqual(["run", "write_note"]);
  });

  it("marks a tool's error outcome as an error result", async () => {
    const tool: AgentTool = {
      definition: { name: "write_note", description: "d", input_schema: { type: "object" } },
      handle: async () => ({ content: "no note open", isError: true })
    };
    complete.mockResolvedValueOnce(toolUse("write_note", {})).mockResolvedValueOnce(text("sorry"));
    const chat = conversation();
    await createSession(() => ({ key: "k", model: "m" }), [tool]).ask(chat, "q", handlers());
    expect(toolResults(chat.messages)[0]).toMatchObject({ content: "no note open", is_error: true });
  });

  it("reports an unknown tool name back to the model as an error", async () => {
    complete.mockResolvedValueOnce(toolUse("delete_everything", {})).mockResolvedValueOnce(text("ok"));
    const chat = conversation();
    await createSession(() => ({ key: "k", model: "m" })).ask(chat, "q", handlers());
    const [result] = toolResults(chat.messages);
    expect(result.is_error).toBe(true);
    expect(result.content).toContain('Unknown tool "delete_everything"');
    expect(result.content).toContain("run");
  });

  it("still runs scripts through the built-in run tool", async () => {
    complete.mockResolvedValueOnce(toolUse("run", { code: "return 1" })).mockResolvedValueOnce(text("one"));
    const chat = conversation();
    await createSession(() => ({ key: "k", model: "m" })).ask(chat, "q", handlers());
    expect(toolResults(chat.messages)[0].content).toContain("ran:return 1");
  });
});
