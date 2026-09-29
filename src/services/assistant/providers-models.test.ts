import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_URL_STORAGE, PROVIDERS, providerOf, registerModels } from "./providers";
import { cachedModels, cacheModels, filterChatModels, listModels, modelChoices } from "./providers-models";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: () => null,
    length: 0
  } as unknown as Storage;
}

const globals = globalThis as Record<string, unknown>;

function stubFetch(ids: string[]): ReturnType<typeof vi.fn> {
  const payload = { data: ids.map(id => ({ id })) };
  const fetchStub = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
  globals.fetch = fetchStub;
  return fetchStub;
}

beforeEach(() => {
  globals.localStorage = memoryStorage();
});

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

  it("asks the stored local server without an auth header", async () => {
    localStorage.setItem(LOCAL_URL_STORAGE, "http://localhost:8080/v1/");
    const fetchStub = stubFetch(["llama3.2"]);
    const models = await listModels("local", "");

    const [url, options] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/v1/models");
    expect("Authorization" in ((options.headers ?? {}) as Record<string, string>)).toBe(false);
    expect(models).toEqual(["llama3.2"]);
  });

  it("discovers a draft local endpoint without changing the saved connection", async () => {
    localStorage.setItem(LOCAL_URL_STORAGE, "http://localhost:8080/v1");
    const fetchStub = stubFetch(["llama3.2"]);
    await listModels("local", "", "http://localhost:9000/v1/");
    expect(fetchStub.mock.calls[0][0]).toBe("http://localhost:9000/v1/models");
    expect(localStorage.getItem(LOCAL_URL_STORAGE)).toBe("http://localhost:8080/v1");
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

  it("caches what it fetched", async () => {
    stubFetch(["deepseek-chat", "deepseek-reasoner"]);
    await listModels("deepseek", "sk-d");
    expect(await cachedModels("deepseek", "sk-d")).toEqual(["deepseek-chat", "deepseek-reasoner"]);
  });
});

describe("model cache", () => {
  it("only returns models discovered with the requested key", async () => {
    await cacheModels("openai", ["gpt-6-luna"], "key-one");
    expect(await cachedModels("openai", "key-one")).toEqual(["gpt-6-luna"]);
    expect(await cachedModels("openai", "key-two")).toEqual([]);
    expect(localStorage.getItem("fmg-ai-models-openai")).not.toContain("key-one");
  });

  it("only returns local models for the same endpoint", async () => {
    await cacheModels("local", ["llama3.2"], "", "http://localhost:8080/v1/");
    expect(await cachedModels("local", "", "http://localhost:8080/v1")).toEqual(["llama3.2"]);
    expect(await cachedModels("local", "", "http://localhost:9000/v1")).toEqual([]);
  });

  it("ignores legacy caches without a credential identity", async () => {
    localStorage.setItem("fmg-ai-models-openai", JSON.stringify({ time: Date.now(), models: ["gpt-6-luna"] }));
    expect(await cachedModels("openai", "key-one")).toEqual([]);
  });

  it("round-trips models through storage", async () => {
    await cacheModels("qwen", ["qwen-flash", "qwen-plus"]);
    expect(await cachedModels("qwen")).toEqual(["qwen-flash", "qwen-plus"]);
  });

  it("expires entries older than a day", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    await cacheModels("qwen", ["qwen-flash"]);
    vi.spyOn(Date, "now").mockReturnValue(1_000_000 + 25 * 60 * 60 * 1000);
    expect(await cachedModels("qwen")).toEqual([]);
  });
});

describe("modelChoices", () => {
  it("uses only the fallback before discovery and only returned models afterward", () => {
    const qwen = PROVIDERS.find(provider => provider.id === "qwen")!;
    expect(modelChoices(qwen, [])).toEqual(["qwen3.8-flash"]);
    expect(modelChoices(qwen, ["qwen3.7-flash", "qwen3.9-flash", "qwen3.8-max"])).toEqual([
      "qwen3.9-flash",
      "qwen3.7-flash",
      "qwen3.8-max"
    ]);
  });

  it("picks the latest family version and honors provider latest aliases", () => {
    const anthropic = PROVIDERS.find(provider => provider.id === "anthropic")!;
    const mistral = PROVIDERS.find(provider => provider.id === "mistral")!;
    expect(modelChoices(anthropic, ["claude-opus-5-5", "claude-sonnet-5", "claude-sonnet-5-5"])[0]).toBe(
      "claude-sonnet-5-5"
    );
    expect(modelChoices(mistral, ["mistral-small-2603", "mistral-small-latest"])[0]).toBe("mistral-small-latest");
  });
});

describe("registerModels", () => {
  it("lets providerOf resolve discovered models that are not hardcoded", () => {
    expect(() => providerOf("mistral-nemo")).toThrow(/unknown model/i);
    registerModels("mistral", ["mistral-nemo"]);
    expect(providerOf("mistral-nemo").id).toBe("mistral");
  });
});
