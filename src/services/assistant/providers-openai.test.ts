import { describe, expect, it } from "vitest";
import type { SystemBlock } from "./context";
import type { Message, ToolDefinition } from "./providers";
import { keyStorageFor, providerOf } from "./providers";
import { fromChatResponse, toChatMessages, toChatTools } from "./providers-openai";

const system: SystemBlock[] = [
  { type: "text", text: "static prefix", cache_control: { type: "ephemeral" } },
  { type: "text", text: "current map" }
];

describe("toChatMessages", () => {
  it("flattens system blocks into one system message without cache markers", () => {
    const result = toChatMessages(system, []);
    expect(result).toEqual([{ role: "system", content: "static prefix\n\ncurrent map" }]);
  });

  it("maps user and assistant text blocks to plain chat messages", () => {
    const messages: Message[] = [
      { role: "user", content: [{ type: "text", text: "how many burgs?" }] },
      { role: "assistant", content: [{ type: "text", text: "Let me check." }] }
    ];
    const [, user, assistant] = toChatMessages(system, messages);
    expect(user).toEqual({ role: "user", content: "how many burgs?" });
    expect(assistant).toEqual({ role: "assistant", content: "Let me check." });
  });

  it("maps assistant tool_use blocks to tool_calls with JSON-encoded arguments", () => {
    const messages: Message[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "Running a script." },
          { type: "tool_use", id: "call_1", name: "run", input: { code: "return 1;" } }
        ]
      }
    ];
    const [, assistant] = toChatMessages(system, messages);
    expect(assistant).toEqual({
      role: "assistant",
      content: "Running a script.",
      tool_calls: [{ id: "call_1", type: "function", function: { name: "run", arguments: '{"code":"return 1;"}' } }]
    });
  });

  it("maps tool_result blocks to one tool message each", () => {
    const messages: Message[] = [
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "call_1", content: "result (1 ms):\n1" },
          { type: "tool_result", tool_use_id: "call_2", content: "threw", is_error: true }
        ]
      }
    ];
    const [, first, second] = toChatMessages(system, messages);
    expect(first).toEqual({ role: "tool", tool_call_id: "call_1", content: "result (1 ms):\n1" });
    expect(second).toEqual({ role: "tool", tool_call_id: "call_2", content: "threw" });
  });
});

describe("toChatTools", () => {
  it("wraps tool definitions in the function envelope with parameters", () => {
    const tools: ToolDefinition[] = [
      { name: "run", description: "Run JS", input_schema: { type: "object", properties: {} } }
    ];
    expect(toChatTools(tools)).toEqual([
      {
        type: "function",
        function: { name: "run", description: "Run JS", parameters: { type: "object", properties: {} } }
      }
    ]);
  });
});

describe("toChatMessages content null", () => {
  it("sends null content when an assistant turn has only tool calls", () => {
    const messages: Message[] = [
      { role: "assistant", content: [{ type: "tool_use", id: "c", name: "run", input: {} }] }
    ];
    const [, assistant] = toChatMessages(system, messages);
    expect(assistant.content).toBeNull();
  });
});

describe("fromChatResponse", () => {
  it("maps a text answer with usage and end_turn stop reason", () => {
    const completion = fromChatResponse({
      choices: [{ message: { content: "42 burgs" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1000, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 800 } }
    });
    expect(completion.content).toEqual([{ type: "text", text: "42 burgs" }]);
    expect(completion.stopReason).toBe("end_turn");
    expect(completion.usage).toEqual({ input: 200, output: 20, cached: 800 });
  });

  it("maps tool_calls to tool_use blocks with parsed arguments", () => {
    const completion = fromChatResponse({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [{ id: "call_9", function: { name: "run", arguments: '{"code":"return 2;"}' } }]
          },
          finish_reason: "tool_calls"
        }
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5 }
    });
    expect(completion.content).toEqual([{ type: "tool_use", id: "call_9", name: "run", input: { code: "return 2;" } }]);
    expect(completion.stopReason).toBe("tool_use");
    expect(completion.usage).toEqual({ input: 10, output: 5, cached: 0 });
  });

  it("survives malformed tool arguments by passing an empty input", () => {
    const completion = fromChatResponse({
      choices: [
        {
          message: { tool_calls: [{ id: "c", function: { name: "run", arguments: "{broken" } }] },
          finish_reason: "tool_calls"
        }
      ]
    });
    expect(completion.content).toEqual([{ type: "tool_use", id: "c", name: "run", input: {} }]);
  });

  it("reads DeepSeek's cache-hit token field", () => {
    const completion = fromChatResponse({
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 500, completion_tokens: 1, prompt_cache_hit_tokens: 400 }
    });
    expect(completion.usage).toEqual({ input: 100, output: 1, cached: 400 });
  });
});

describe("provider routing", () => {
  it("resolves each model to its provider and key storage slot", () => {
    expect(providerOf("qwen-flash").id).toBe("qwen");
    expect(providerOf("mistral-small-latest").id).toBe("mistral");
    expect(providerOf("deepseek-chat").id).toBe("deepseek");
    expect(providerOf("gpt-5.6-luna").id).toBe("openai");
    expect(providerOf("claude-haiku-4-5").id).toBe("anthropic");
    expect(keyStorageFor("qwen-flash")).toBe("fmg-ai-kl-qwen");
  });

  it("throws a clear error for an unknown model", () => {
    expect(() => providerOf("gpt-2")).toThrow(/unknown model/i);
  });
});
