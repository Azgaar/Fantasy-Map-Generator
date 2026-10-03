import { describe, expect, it, vi } from "vitest";
import type { SystemBlock } from "./context";
import { completeOpenAI, fromChatResponse, toChatMessages, toChatTools } from "./openai";
import type { Message, ToolDefinition } from "./providers";
import { complete } from "./providers";

const system: SystemBlock[] = [
  { type: "text", text: "static prefix", cache_control: { type: "ephemeral" } },
  { type: "text", text: "current map" }
];

describe("toChatMessages", () => {
  it("skips an empty assistant turn, which OpenAI rejects as null content", () => {
    const messages: Message[] = [
      { role: "user", content: [{ type: "text", text: "Pick one" }] },
      { role: "assistant", content: [] },
      { role: "user", content: [{ type: "text", text: "Where is Vel?" }] }
    ];
    expect(toChatMessages(system, messages).map(message => message.role)).toEqual(["system", "user", "user"]);
  });

  it("sends a tool's images as a user message after its text result", () => {
    const messages: Message[] = [
      { role: "assistant", content: [{ type: "tool_use", id: "call_1", name: "view_emblem", input: {} }] },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "call_1",
            content: [
              { type: "text", text: "The emblem of Orwin" },
              { type: "image", source: { type: "base64", media_type: "image/png", data: "QUJD" } }
            ]
          }
        ]
      }
    ];
    const [, , tool, images] = toChatMessages(system, messages);
    expect(tool).toEqual({ role: "tool", tool_call_id: "call_1", content: "The emblem of Orwin" });
    expect(images).toEqual({
      role: "user",
      content: [
        { type: "text", text: "Images from the tools above:" },
        { type: "image_url", image_url: { url: "data:image/png;base64,QUJD" } }
      ]
    });
  });

  it("sends an image the user attached in its place among the question's messages", () => {
    const messages: Message[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "map" },
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "SlBH" } },
          { type: "text", text: "Match this style" }
        ]
      }
    ];
    expect(toChatMessages(system, messages).slice(1)).toEqual([
      { role: "user", content: "map" },
      { role: "user", content: [{ type: "image_url", image_url: { url: "data:image/jpeg;base64,SlBH" } }] },
      { role: "user", content: "Match this style" }
    ]);
  });

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

describe("completeOpenAI", () => {
  it("uses GPT-6 Chat Completions tool parameters without changing other providers", async () => {
    const fetchStub = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(JSON.stringify({ choices: [] })));
    const request = {
      provider: "openai" as const,
      localUrl: "",
      key: "test",
      model: "gpt-6-sol",
      system,
      messages: [],
      tools: []
    };

    await completeOpenAI("https://api.openai.com/v1", request);
    await completeOpenAI("https://api.mistral.ai/v1", { ...request, model: "mistral-small-latest" });

    const openAI = JSON.parse(fetchStub.mock.calls[0][1]?.body as string);
    const mistral = JSON.parse(fetchStub.mock.calls[1][1]?.body as string);
    expect(openAI).toMatchObject({ model: "gpt-6-sol", max_completion_tokens: 4096, reasoning_effort: "none" });
    expect(openAI).not.toHaveProperty("max_tokens");
    expect(mistral).toMatchObject({ model: "mistral-small-latest", max_tokens: 4096 });
    expect(mistral).not.toHaveProperty("reasoning_effort");
    fetchStub.mockRestore();
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
  it("maps a text answer with usage", () => {
    const completion = fromChatResponse({
      choices: [{ message: { content: "42 burgs" } }],
      usage: { prompt_tokens: 1000, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 800 } }
    });
    expect(completion.content).toEqual([{ type: "text", text: "42 burgs" }]);
    expect(completion.usage).toEqual({ input: 200, output: 20, cached: 800 });
  });

  it("maps tool_calls to tool_use blocks with parsed arguments", () => {
    const completion = fromChatResponse({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [{ id: "call_9", function: { name: "run", arguments: '{"code":"return 2;"}' } }]
          }
        }
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5 }
    });
    expect(completion.content).toEqual([{ type: "tool_use", id: "call_9", name: "run", input: { code: "return 2;" } }]);
    expect(completion.usage).toEqual({ input: 10, output: 5, cached: 0 });
  });

  it("turns malformed tool arguments into an error the model is told", () => {
    const completion = fromChatResponse({
      choices: [
        {
          message: { tool_calls: [{ id: "c", function: { name: "run", arguments: "{broken" } }] }
        }
      ]
    });
    const [call] = completion.content;
    expect(call).toMatchObject({ type: "tool_use", id: "c", name: "run" });
    expect(String((call as { input: Record<string, unknown> }).input.invalidArguments)).toContain("not valid JSON");
  });

  it.each(["null", "true", "42", '"text"', "[]"])("rejects non-object tool arguments %s", argumentsText => {
    const completion = fromChatResponse({
      choices: [{ message: { tool_calls: [{ id: "c", function: { name: "run", arguments: argumentsText } }] } }]
    });
    expect(completion.content[0]).toMatchObject({
      type: "tool_use",
      input: { invalidArguments: "The arguments must be a JSON object. Send the call again with named parameters" }
    });
  });

  it("marks a reply cut off at the output limit", () => {
    expect(fromChatResponse({ choices: [{ message: { content: null }, finish_reason: "length" }] }).truncated).toBe(
      true
    );
    expect(fromChatResponse({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }).truncated).toBe(
      false
    );
  });

  it("reads DeepSeek's cache-hit token field", () => {
    const completion = fromChatResponse({
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 500, completion_tokens: 1, prompt_cache_hit_tokens: 400 }
    });
    expect(completion.usage).toEqual({ input: 100, output: 1, cached: 400 });
  });
});

describe("provider routing", () => {
  it("routes a manually entered model through the selected provider", async () => {
    const fetchStub = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(JSON.stringify({ choices: [] })));
    await complete({
      key: "test",
      provider: "mistral",
      localUrl: "",
      model: "my-custom-model",
      system,
      messages: [],
      tools: []
    });
    expect(fetchStub.mock.calls[0][0]).toBe("https://api.mistral.ai/v1/chat/completions");
    fetchStub.mockRestore();
  });
});
