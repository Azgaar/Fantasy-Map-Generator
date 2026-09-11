import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "./conversations";

const mocks = vi.hoisted(() => ({ complete: vi.fn(), request: vi.fn(), execute: vi.fn(), available: vi.fn() }));
vi.mock("./providers", () => ({ complete: mocks.complete }));
vi.mock("@/services/help/api", () => ({
  request: mocks.request,
  canUseHostedAssistant: mocks.available,
  PROVIDER_SETUP_MESSAGE: "Choose your own provider in Settings"
}));
vi.mock("./map-tools", () => ({
  mapId: () => "map",
  getSelection: () => ({ target: "burg:1" }),
  executeMapTool: mocks.execute
}));

import { createSession, type SessionHandlers } from "./session";

const usage = { input: 1, output: 1, cached: 0 };
const chat = (): Conversation => ({
  id: "c",
  title: "t",
  mapId: 0,
  updated: 0,
  entries: [],
  messages: [],
  usage: { ...usage }
});
const handlers = (): SessionHandlers => ({
  onText: vi.fn(),
  onStatus: vi.fn(),
  onUsage: vi.fn(),
  onScript: vi.fn(),
  onScriptResult: vi.fn()
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.available.mockReturnValue(true);
  mocks.execute.mockResolvedValue('{"name":"Town"}');
});
describe("unified session", () => {
  it("answers after a repeated read instead of spending all eight model steps", async () => {
    mocks.complete
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "a", name: "search_map", input: { kind: "state", port: false } }],
        usage
      })
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "b", name: "search_map", input: { port: false, kind: "state" } }],
        usage
      })
      .mockResolvedValueOnce({ content: [{ type: "text", text: "Eldan has no ports." }], usage });
    await createSession(() => ({ model: "personal", key: "k" })).ask(chat(), "Which states have no ports?", handlers());
    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(mocks.complete).toHaveBeenCalledTimes(3);
    expect(mocks.complete.mock.calls[2][0].toolChoice).toBe("none");
    expect(mocks.complete.mock.calls[2][0].tools.length).toBeGreaterThan(0);
  });
  it("omits unavailable documentation from personal tools and prevents hosted attempts on an unsupported copy", async () => {
    mocks.available.mockReturnValue(false);
    await expect(createSession(() => ({ model: "hosted", key: "" })).ask(chat(), "q", handlers())).rejects.toThrow(
      "own provider"
    );
    expect(mocks.request).not.toHaveBeenCalled();
    mocks.complete.mockResolvedValue({ content: [{ type: "text", text: "Town" }], usage });
    await createSession(() => ({ model: "personal", key: "k" })).ask(chat(), "q", handlers());
    expect(mocks.complete.mock.calls[0][0].tools.map((t: { name: string }) => t.name)).not.toContain("documentation");
  });
  it("uses identical bounded tools for personal providers and never offers run", async () => {
    mocks.complete
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "r", name: "place_context", input: { target: "burg:1" } }],
        usage,
        stopReason: "tool_use"
      })
      .mockResolvedValueOnce({ content: [{ type: "text", text: "Town" }], usage, stopReason: "end_turn" });
    await createSession(() => ({ model: "personal", key: "k" })).ask(chat(), "Describe here", handlers());
    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(mocks.complete.mock.calls[0][0].tools.map((t: { name: string }) => t.name)).not.toContain("run");
  });
  it("uses the hosted session receipt for tool continuations without sending keys or system prompts", async () => {
    mocks.request
      .mockResolvedValueOnce({
        sessionId: "secret",
        text: "",
        toolCalls: [{ id: "r", name: "place_context", input: { target: "burg:1" } }]
      })
      .mockResolvedValueOnce({ sessionId: "secret", text: "Town", toolCalls: [] });
    await createSession(() => ({ model: "hosted", key: "never-send" })).ask(chat(), "Describe here", handlers());
    const first = JSON.parse(mocks.request.mock.calls[0][1].body);
    expect(first).not.toHaveProperty("key");
    expect(first).not.toHaveProperty("system");
    const next = JSON.parse(mocks.request.mock.calls[1][1].body);
    expect(next.sessionId).toBe("secret");
    expect(next.results[0].id).toBe("r");
  });
  it("rejects model requests for arbitrary script execution", async () => {
    mocks.complete.mockResolvedValue({
      content: [{ type: "tool_use", id: "r", name: "run", input: { code: "bad" } }],
      usage
    });
    await expect(createSession(() => ({ model: "personal", key: "k" })).ask(chat(), "q", handlers())).rejects.toThrow(
      "Unsupported"
    );
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("does not transfer a conversation to another provider implicitly", async () => {
    const c = chat();
    c.connection = "old";
    await expect(createSession(() => ({ model: "new", key: "k" })).ask(c, "q", handlers())).rejects.toThrow("fresh");
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
