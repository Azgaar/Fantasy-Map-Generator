import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeOpenAI } from "./openai";
import { type CompletionRequest, complete, type Message, markCached } from "./providers";

const globals = globalThis as Record<string, unknown>;

const reply = { choices: [{ message: { content: "ok" } }], usage: {} };

let fetchStub: ReturnType<typeof vi.fn>;

const request: CompletionRequest = {
  provider: "local",
  model: "llama3.2",
  key: "",
  localUrl: "",
  system: [],
  messages: [],
  tools: []
};

const sent = () => fetchStub.mock.calls[0] as unknown as [string, RequestInit];

beforeEach(() => {
  fetchStub = vi.fn(async () => new Response(JSON.stringify(reply), { status: 200 }));
  globals.fetch = fetchStub;
});

describe("local provider", () => {
  it("routes completion to the given server address with the given model name", async () => {
    await complete({ ...request, localUrl: "http://localhost:8080/v1/" });
    expect(sent()[0]).toBe("http://localhost:8080/v1/chat/completions");
    expect(JSON.parse(sent()[1].body as string).model).toBe("llama3.2");
  });

  it("defaults the server address to Ollama's endpoint", async () => {
    await complete(request);
    expect(sent()[0]).toBe("http://localhost:11434/v1/chat/completions");
  });

  it("refuses to run without a model name", async () => {
    await expect(complete({ ...request, model: "" })).rejects.toThrow(/model name/i);
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

describe("completeOpenAI auth header", () => {
  it("omits Authorization when the key is empty", async () => {
    await completeOpenAI("http://localhost:11434/v1", request);
    expect((sent()[1].headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("sends the bearer token when a key is set", async () => {
    await completeOpenAI("http://localhost:11434/v1", { ...request, key: "sk-x" });
    expect((sent()[1].headers as Record<string, string>).Authorization).toBe("Bearer sk-x");
  });
});

describe("markCached", () => {
  it("marks only the last block of the last message, leaving the history untouched", () => {
    const messages: Message[] = [
      { role: "user", content: [{ type: "text", text: "Q" }] },
      { role: "assistant", content: [{ type: "tool_use", id: "a", name: "read_map", input: {} }] },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "a", content: "1" },
          { type: "tool_result", tool_use_id: "b", content: "2" }
        ]
      }
    ];
    const marked = markCached(messages);
    expect(marked[2].content[1]).toMatchObject({ cache_control: { type: "ephemeral" } });
    expect(marked[2].content[0]).not.toHaveProperty("cache_control");
    expect(marked[0]).toBe(messages[0]);
    expect(messages[2].content[1]).not.toHaveProperty("cache_control");
  });
});
