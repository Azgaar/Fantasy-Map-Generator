// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/tooltips", () => ({ tip: vi.fn() }));
vi.mock("@/services/assistant/context", () => ({ buildSystemPrompt: () => [] }));
vi.mock("@/services/assistant/providers-models", async importOriginal => ({
  ...(await importOriginal<typeof import("@/services/assistant/providers-models")>()),
  cachedModels: vi.fn(() => []),
  listModels: vi.fn().mockRejectedValue(new Error("offline"))
}));
const notesApi = vi.hoisted(() => ({ label: null as string | null }));
vi.mock("./assistant-notes", () => ({
  noteChipLabel: async () => notesApi.label,
  noteContext: async () => (notesApi.label ? `# Notes editor\n\n${notesApi.label}` : null),
  writeNoteTool: () => ({
    definition: { name: "write_note", description: "", input_schema: {} },
    handle: async () => ({ content: "" })
  }),
  undoEdit: vi.fn(async () => {})
}));

import { create, current } from "@/services/assistant/conversations";
import { cachedModels, listModels } from "@/services/assistant/providers-models";
import { mountMapPanel, NOTE_SUGGESTIONS, needsKey, refreshMapContext, unmountMapPanel } from "./assistant-map";
import { undoEdit } from "./assistant-notes";

const w = globalThis as unknown as Record<string, unknown>;
const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  vi.mocked(cachedModels).mockReturnValue([]);
  vi.mocked(listModels).mockRejectedValue(new Error("offline"));
  localStorage.clear();
  document.body.innerHTML = `<div id="host"></div>`;
  w.mapHistory = [{ created: 1 }];
  w.customization = 0;
  window.$ = vi.fn(() => ({ dialog: vi.fn() })) as unknown as typeof window.$;
  notesApi.label = null;
  create();
});

afterEach(() => {
  unmountMapPanel();
  document.body.innerHTML = "";
});

describe("needsKey", () => {
  it("is true for a cloud model without a key and false for local models", () => {
    expect(needsKey("claude-sonnet-5-5", "")).toBe(true);
    expect(needsKey("claude-sonnet-5-5", "  ")).toBe(true);
    expect(needsKey("claude-sonnet-5-5", "sk-1")).toBe(false);
    expect(needsKey("local", "")).toBe(false);
  });
});

describe("map panel", () => {
  it("mounts with the drawer closed and the model named in the status line", () => {
    mountMapPanel(el("host"));
    expect(el("assistantMapDrawer").hidden).toBe(true);
    expect(el("assistantMapStatusModel").textContent).toContain("claude-sonnet-5-5");
    expect(el("assistantMapStatusKey").textContent).toContain("no key");
    expect(el("assistantMapContext").hidden).toBe(true);
  });

  it("opens the drawer with a hint instead of sending when the key is missing", () => {
    mountMapPanel(el("host"));
    el<HTMLTextAreaElement>("assistantMapInput").value = "hello";
    el<HTMLTextAreaElement>("assistantMapInput").dispatchEvent(new Event("input"));
    el<HTMLButtonElement>("assistantMapSend").click();
    expect(el("assistantMapDrawer").hidden).toBe(false);
    expect(el("assistantMapHint").hidden).toBe(false);
    expect(document.activeElement).toBe(el("assistantMapKey"));
    expect(el("assistantMapLog").querySelector(".assistantMapUser")).toBeNull();
  });

  it("lists providers separately and narrows the model list to the one chosen", () => {
    mountMapPanel(el("host"));
    const provider = el<HTMLSelectElement>("assistantMapProvider");
    const model = el<HTMLSelectElement>("assistantMapModel");

    // the stored model decides which provider starts selected
    expect(provider.value).toBe("anthropic");
    expect([...model.options].map(option => option.value)).toEqual(["claude-sonnet-5-5", "__custom_model__"]);
    expect(model.value).toBe("claude-sonnet-5-5");
    expect([...provider.options].map(option => option.value)).toContain("mistral");

    provider.value = "mistral";
    provider.dispatchEvent(new Event("change"));
    expect([...model.options].map(option => option.value)).toEqual(["mistral-small-latest", "__custom_model__"]);
    expect(model.value).toBe("mistral-small-latest");
    expect(el("assistantMapStatusModel").textContent).toContain("mistral-small-latest");
  });

  it("selects the newest discovered family model", async () => {
    vi.mocked(listModels).mockImplementation(async () => {
      vi.mocked(cachedModels).mockReturnValue(["claude-sonnet-5-5", "claude-sonnet-5-6", "claude-opus-5-5"]);
      return ["claude-sonnet-5-5", "claude-sonnet-5-6", "claude-opus-5-5"];
    });
    mountMapPanel(el("host"));
    localStorage.setItem("fmg-ai-kl-anthropic", "sk-test");
    const key = el<HTMLInputElement>("assistantMapKey");
    key.value = "sk-test";
    key.dispatchEvent(new Event("change"));
    await flush();

    const model = el<HTMLSelectElement>("assistantMapModel");
    expect(model.value).toBe("claude-sonnet-5-6");
    expect([...model.options].map(option => option.value)).toEqual([
      "claude-sonnet-5-6",
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "__custom_model__"
    ]);
  });

  it("updates a previously automatic choice when a newer family model is cached", () => {
    localStorage.setItem("fmg-ai-chat-model", "claude-sonnet-5-5");
    localStorage.setItem("fmg-ai-chat-provider", "anthropic");
    localStorage.setItem("fmg-ai-chat-auto-model", "true");
    vi.mocked(cachedModels).mockReturnValue(["claude-sonnet-5-5", "claude-sonnet-5-6"]);
    mountMapPanel(el("host"));
    expect(el<HTMLSelectElement>("assistantMapModel").value).toBe("claude-sonnet-5-6");
  });

  it("lets a user type a model ID and restore it with its provider", () => {
    localStorage.setItem("fmg-ai-chat-model", "my-model-v2");
    localStorage.setItem("fmg-ai-chat-provider", "openai");
    mountMapPanel(el("host"));

    expect(el<HTMLSelectElement>("assistantMapProvider").value).toBe("openai");
    expect(el<HTMLSelectElement>("assistantMapModel").value).toBe("__custom_model__");
    expect(el<HTMLInputElement>("assistantMapCustomModel").value).toBe("my-model-v2");
    expect(el("assistantMapStatusModel").textContent).toContain("my-model-v2 · OpenAI");
  });

  it("keeps a typed key while switching to a manual model", () => {
    mountMapPanel(el("host"));
    const key = el<HTMLInputElement>("assistantMapKey");
    key.value = "sk-new";
    const model = el<HTMLSelectElement>("assistantMapModel");
    model.value = "__custom_model__";
    model.dispatchEvent(new Event("change"));
    const custom = el<HTMLInputElement>("assistantMapCustomModel");
    custom.value = "claude-private-v2";
    custom.dispatchEvent(new Event("input"));

    expect(custom.hidden).toBe(false);
    expect(key.value).toBe("sk-new");
    expect(el("assistantMapStatusModel").textContent).toContain("claude-private-v2 · Anthropic");
  });

  it("sends and saves a manually entered model for its selected provider", async () => {
    const fetchStub = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] })));
    mountMapPanel(el("host"));
    const provider = el<HTMLSelectElement>("assistantMapProvider");
    provider.value = "openai";
    provider.dispatchEvent(new Event("change"));
    const model = el<HTMLSelectElement>("assistantMapModel");
    model.value = "__custom_model__";
    model.dispatchEvent(new Event("change"));
    el<HTMLInputElement>("assistantMapCustomModel").value = "my-openai-model";
    el<HTMLInputElement>("assistantMapKey").value = "sk-test";
    const input = el<HTMLTextAreaElement>("assistantMapInput");
    input.value = "hello";
    input.dispatchEvent(new Event("input"));
    el<HTMLButtonElement>("assistantMapSend").click();
    await vi.waitFor(() => expect(fetchStub).toHaveBeenCalled());

    expect(fetchStub.mock.calls[0][0]).toBe("https://api.openai.com/v1/chat/completions");
    expect(JSON.parse(fetchStub.mock.calls[0][1]?.body as string).model).toBe("my-openai-model");
    expect(localStorage.getItem("fmg-ai-chat-model")).toBe("my-openai-model");
    expect(localStorage.getItem("fmg-ai-chat-provider")).toBe("openai");
    expect(localStorage.getItem("fmg-ai-chat-auto-model")).toBe("false");
    await vi.waitFor(() => expect(el("assistantMapLog").textContent).toContain("ok"));
    fetchStub.mockRestore();
  });

  it("moves a saved retired model to its current replacement", () => {
    localStorage.setItem("fmg-ai-chat-model", "deepseek-chat");
    mountMapPanel(el("host"));
    expect(el<HTMLSelectElement>("assistantMapProvider").value).toBe("deepseek");
    expect(el<HTMLSelectElement>("assistantMapModel").value).toBe("deepseek-flash");
  });

  it("shows the local server fields only for the local provider", () => {
    mountMapPanel(el("host"));
    expect(el("assistantMapLocal").hidden).toBe(true);

    const provider = el<HTMLSelectElement>("assistantMapProvider");
    provider.value = "local";
    provider.dispatchEvent(new Event("change"));
    expect(el("assistantMapLocal").hidden).toBe(false);
    expect(el("assistantMapStatusModel").textContent).toContain("local model");
  });

  it("toggles the drawer from the gear and the status model button", () => {
    mountMapPanel(el("host"));
    el<HTMLButtonElement>("assistantMapSettings").click();
    expect(el("assistantMapDrawer").hidden).toBe(false);
    el<HTMLButtonElement>("assistantMapSettings").click();
    expect(el("assistantMapDrawer").hidden).toBe(true);
    el<HTMLButtonElement>("assistantMapStatusModel").click();
    expect(el("assistantMapDrawer").hidden).toBe(false);
  });

  it("shows the note chip and note suggestions when the notes editor is open", async () => {
    notesApi.label = "Kelmora";
    mountMapPanel(el("host"));
    refreshMapContext();
    await flush();
    expect(el("assistantMapContext").hidden).toBe(false);
    expect(el("assistantMapContext").textContent).toContain("Kelmora");
    const chips = [...el("assistantMapLog").querySelectorAll("button")].map(button => button.textContent);
    expect(chips).toEqual(NOTE_SUGGESTIONS);
  });

  it("renders an edit entry with a working undo", async () => {
    mountMapPanel(el("host"));
    // reach the renderer through the conversation store: push an entry and re-render by remounting
    current().entries.push({
      kind: "edit",
      id: "burg1",
      name: "Kelmora",
      chars: 1200,
      previous: { legend: "<p>o</p>", name: "Kelmora" }
    });
    unmountMapPanel();
    mountMapPanel(el("host"));
    const entry = el("assistantMapLog").querySelector(".assistantMapEdit") as HTMLElement;
    expect(entry.textContent).toContain("Updated note");
    expect(entry.textContent).toContain("Kelmora");
    (entry.querySelector("button") as HTMLButtonElement).click();
    await flush();
    expect(undoEdit).toHaveBeenCalled();
    expect((entry.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
