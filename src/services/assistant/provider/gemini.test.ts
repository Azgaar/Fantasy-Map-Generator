import { afterEach, expect, it, vi } from "vitest";
import { type CompletionRequest, complete, type Message } from "./providers";

afterEach(() => vi.restoreAllMocks());

const request: CompletionRequest = {
  provider: "gemini",
  key: "gemini-key",
  model: "gemini-flash-latest",
  localUrl: "",
  system: [{ type: "text", text: "Help with the map." }],
  messages: [{ role: "user", content: [{ type: "text", text: "Count the burgs and states." }] }],
  tools: [{ name: "run", description: "Read the map", input_schema: { type: "object", properties: {} } }]
};

it("preserves Gemini signatures through saved history and parallel and sequential tool turns", async () => {
  const calls = [
    {
      id: "burgs",
      type: "function",
      function: { name: "run", arguments: '{"code":"return pack.burgs.length;"}' },
      extra_content: { google: { thought_signature: "opaque-signature-A" } }
    },
    {
      id: "states",
      type: "function",
      function: { name: "run", arguments: '{"code":"return pack.states.length;"}' }
    }
  ];
  const next = {
    ...calls[0],
    id: "more",
    extra_content: { google: { thought_signature: "opaque-signature-B" } }
  };
  const fetchStub = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { tool_calls: calls } }] })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { tool_calls: [next] } }] })))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "42 burgs and 3 states." }, finish_reason: "stop" }],
          usage: { prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 80 } }
        })
      )
    );
  const first = await complete(request);
  const messages: Message[] = [
    ...request.messages,
    { role: "assistant", content: JSON.parse(JSON.stringify(first.content)) },
    {
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "burgs", content: "42" },
        { type: "tool_result", tool_use_id: "states", content: "3" }
      ]
    }
  ];
  const second = await complete({ ...request, messages });
  messages.push(
    { role: "assistant", content: second.content },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "more", content: "42" }] }
  );
  const answer = await complete({ ...request, messages });

  for (const [url, options] of fetchStub.mock.calls) {
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(options?.headers).toMatchObject({ Authorization: "Bearer gemini-key" });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  }
  const body = JSON.parse(fetchStub.mock.calls[2][1]?.body as string);
  expect(body).toMatchObject({ model: "gemini-flash-latest", max_tokens: 8192 });
  expect(body.messages[2]).toEqual({ role: "assistant", content: null, tool_calls: calls });
  expect(body.messages[3]).toEqual({ role: "tool", tool_call_id: "burgs", content: "42" });
  expect(body.messages[5]).toEqual({ role: "assistant", content: null, tool_calls: [next] });
  expect(answer.content).toEqual([{ type: "text", text: "42 burgs and 3 states." }]);
  expect(answer.usage).toEqual({ input: 20, output: 20, cached: 80 });
});

it.each(["anthropic", "openai"] as const)("omits Gemini metadata when switching to %s", async provider => {
  const fetchStub = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
  await complete({
    ...request,
    provider,
    messages: [
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "a", name: "run", input: {}, thoughtSignature: "opaque-signature" }]
      },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "a", content: "42" }] }
    ]
  });
  const body = fetchStub.mock.calls[0][1]?.body as string;
  expect(body).not.toContain("opaque-signature");
  expect(body).not.toContain("thoughtSignature");
  expect(body).not.toContain("extra_content");
});

it("surfaces Gemini's API errors", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ error: { message: "API key not valid." } }), { status: 400 })
  );
  await expect(complete(request)).rejects.toThrow("API key not valid.");
});
