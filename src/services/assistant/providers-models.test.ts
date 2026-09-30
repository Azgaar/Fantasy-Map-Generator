import { afterEach, describe, expect, it, vi } from "vitest";
import { filterChatModels, listModels } from "./providers-models";

const globals = globalThis as Record<string, unknown>;

function stubFetch(ids: string[]): ReturnType<typeof vi.fn> {
  const payload = { data: ids.map(id => ({ id })) };
  const fetchStub = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
  globals.fetch = fetchStub;
  return fetchStub;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("filterChatModels", () => {
  it("keeps chat models and drops audio, image and embedding variants for OpenAI", () => {
    const ids = ["gpt-6-luna", "gpt-6-astra", "gpt-audio", "text-embedding-3-small", "whisper-1", "o4-mini"];
    expect(filterChatModels("openai", ids)).toEqual(["gpt-6-luna", "o4-mini"]);
  });

  it("drops embeddings, moderation and OCR models for Mistral", () => {
    const ids = [
      "mistral-small-latest",
      "mistral-embed",
      "codestral-latest",
      "mistral-moderation-latest",
      "mistral-ocr-latest"
    ];
    expect(filterChatModels("mistral", ids)).toEqual(["mistral-small-latest", "codestral-latest"]);
  });

  it("keeps everything for local servers", () => {
    expect(filterChatModels("local", ["llama3.2", "qwen2.5-coder:7b"])).toEqual(["llama3.2", "qwen2.5-coder:7b"]);
  });
});

describe("listModels", () => {
  it("shows the provider's discovery error", async () => {
    globals.fetch = vi.fn(
      async () => new Response(JSON.stringify({ error: { message: "Invalid API key" } }), { status: 401 })
    );
    await expect(listModels("openai", "wrong")).rejects.toThrow("Invalid API key");
  });

  it("fetches an OpenAI-compatible models endpoint with the bearer key", async () => {
    const fetchStub = stubFetch(["mistral-small-latest", "mistral-embed"]);
    const models = await listModels("mistral", "sk-m");

    const [url, options] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.mistral.ai/v1/models");
    expect((options.headers as Record<string, string>).Authorization).toBe("Bearer sk-m");
    expect(models).toEqual(["mistral-small-latest"]);
  });

  it("fetches Anthropic's models endpoint with its native headers", async () => {
    const fetchStub = stubFetch(["claude-sonnet-5", "claude-haiku-4-5"]);
    const models = await listModels("anthropic", "sk-a");

    const [url, options] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/models?limit=1000");
    const headers = options.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-a");
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    expect(models).toEqual(["claude-sonnet-5", "claude-haiku-4-5"]);
  });

  it("asks the given local server without an auth header", async () => {
    const fetchStub = stubFetch(["llama3.2"]);
    const models = await listModels("local", "", "http://localhost:8080/v1/");

    const [url, options] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/v1/models");
    expect("Authorization" in ((options.headers ?? {}) as Record<string, string>)).toBe(false);
    expect(models).toEqual(["llama3.2"]);
  });

  it("defaults the local server to Ollama's endpoint", async () => {
    const fetchStub = stubFetch(["llama3.2"]);
    await listModels("local", "");
    expect(fetchStub.mock.calls[0][0]).toBe("http://localhost:11434/v1/models");
  });

  it("reads Qwen's paginated model catalog", async () => {
    const fetchStub = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ output: { total: 2, models: [{ model: "qwen3.8-flash" }] } }))
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ output: { total: 2, models: [{ model: "qwen3.7-plus" }] } }))
      );
    globals.fetch = fetchStub;

    expect(await listModels("qwen", "sk-q")).toEqual(["qwen3.8-flash", "qwen3.7-plus"]);
    expect(fetchStub).toHaveBeenCalledTimes(2);
    const [url, options] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/v1/models?providers=qwen&features=function-calling");
    expect(fetchStub.mock.calls[1][0]).toContain("page_no=2");
    expect((options.headers as Record<string, string>).Authorization).toBe("Bearer sk-q");
  });
});
