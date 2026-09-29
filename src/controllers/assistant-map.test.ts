// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/tooltips", () => ({ tip: vi.fn() }));
vi.mock("@/services/assistant/providers-models", () => ({
  cachedModels: () => [],
  listModels: vi.fn().mockRejectedValue(new Error("offline")),
  mergeModels: (curated: string[]) => curated
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

import { current } from "@/services/assistant/conversations";
import { mountMapPanel, NOTE_SUGGESTIONS, needsKey, refreshMapContext, unmountMapPanel } from "./assistant-map";
import { undoEdit } from "./assistant-notes";

const w = globalThis as unknown as Record<string, unknown>;
const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = `<div id="host"></div>`;
  w.mapHistory = [{ created: 1 }];
  w.customization = 0;
  window.$ = vi.fn(() => ({ dialog: vi.fn() })) as unknown as typeof window.$;
  notesApi.label = null;
});

afterEach(() => {
  unmountMapPanel();
  document.body.innerHTML = "";
});

describe("needsKey", () => {
  it("is true for a cloud model without a key and false for local models", () => {
    expect(needsKey("claude-sonnet-5", "")).toBe(true);
    expect(needsKey("claude-sonnet-5", "  ")).toBe(true);
    expect(needsKey("claude-sonnet-5", "sk-1")).toBe(false);
    expect(needsKey("local", "")).toBe(false);
  });
});

describe("map panel", () => {
  it("mounts with the drawer closed and the model named in the status line", () => {
    mountMapPanel(el("host"));
    expect(el("assistantMapDrawer").hidden).toBe(true);
    expect(el("assistantMapStatusModel").textContent).toContain("claude-sonnet-5");
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
    expect([...model.options].map(option => option.value)).toEqual([
      "claude-sonnet-5",
      "claude-opus-4-8",
      "claude-haiku-4-5"
    ]);
    expect(model.value).toBe("claude-sonnet-5");
    expect([...provider.options].map(option => option.value)).toContain("mistral");

    provider.value = "mistral";
    provider.dispatchEvent(new Event("change"));
    expect([...model.options].map(option => option.value)).toEqual(["mistral-small-latest", "mistral-medium-latest"]);
    expect(model.value).toBe("mistral-small-latest");
    expect(el("assistantMapStatusModel").textContent).toContain("mistral-small-latest");
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
