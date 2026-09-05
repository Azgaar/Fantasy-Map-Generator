import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  complete,
  keyStorageFor,
  LOCAL_MODEL,
  LOCAL_MODEL_STORAGE,
  LOCAL_URL_STORAGE,
  providerOf,
  registerModels
} from "./providers";
import { completeOpenAI } from "./providers-openai";

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

const reply = { choices: [{ message: { content: "ok" }, finish_reason: "stop" }], usage: {} };

function stubFetch(): ReturnType<typeof vi.fn> {
  const fetchStub = vi.fn(async () => new Response(JSON.stringify(reply), { status: 200 }));
  globals.fetch = fetchStub;
  return fetchStub;
}

const request = { key: "", model: LOCAL_MODEL, system: [], messages: [], tools: [] };

beforeEach(() => {
  globals.localStorage = memoryStorage();
});

describe("local provider", () => {
  it("registers the local sentinel with its own key slot", () => {
    expect(providerOf(LOCAL_MODEL).id).toBe("local");
    expect(keyStorageFor(LOCAL_MODEL)).toBe("fmg-ai-kl-local");
  });

  it("routes completion to the stored base URL with the stored model name", async () => {
    localStorage.setItem(LOCAL_URL_STORAGE, "http://localhost:8080/v1/");
    localStorage.setItem(LOCAL_MODEL_STORAGE, "llama3.2");
    const fetchStub = stubFetch();

    await complete(request);

    const [url, options] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/v1/chat/completions");
    expect(JSON.parse(options.body as string).model).toBe("llama3.2");
  });

  it("defaults the base URL to Ollama's endpoint", async () => {
    localStorage.setItem(LOCAL_MODEL_STORAGE, "llama3.2");
    const fetchStub = stubFetch();

    await complete(request);

    expect((fetchStub.mock.calls[0] as unknown as [string])[0]).toBe("http://localhost:11434/v1/chat/completions");
  });

  it("refuses to run without a model name", async () => {
    const fetchStub = stubFetch();
    await expect(complete(request)).rejects.toThrow(/model name/i);
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

describe("completeOpenAI auth header", () => {
  it("omits Authorization when the key is empty", async () => {
    const fetchStub = stubFetch();
    await completeOpenAI("http://localhost:11434/v1", { ...request, model: "llama3.2" });
    const headers = (fetchStub.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("sends the bearer token when a key is set", async () => {
    const fetchStub = stubFetch();
    await completeOpenAI("http://localhost:11434/v1", { ...request, model: "llama3.2", key: "sk-x" });
    const headers = (fetchStub.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-x");
  });
});

describe("discovered local models", () => {
  it("passes a discovered local model through instead of the stored name", async () => {
    registerModels("local", ["qwen2.5-coder:7b"]);
    localStorage.setItem(LOCAL_MODEL_STORAGE, "llama3.2");
    const fetchStub = stubFetch();

    await complete({ ...request, model: "qwen2.5-coder:7b" });

    expect(JSON.parse((fetchStub.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).model).toBe(
      "qwen2.5-coder:7b"
    );
  });
});
