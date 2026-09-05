// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/tooltips", () => ({ tip: vi.fn() }));
vi.mock("@/services/agent/providers-models", () => ({
  cachedModels: () => [],
  listModels: vi.fn().mockRejectedValue(new Error("offline")),
  mergeModels: (curated: string[]) => curated
}));
const notesApi = vi.hoisted(() => ({ label: null as string | null }));
vi.mock("./help-assistant-notes", () => ({
  noteChipLabel: async () => notesApi.label,
  noteContext: async () => (notesApi.label ? `# Notes editor\n\n${notesApi.label}` : null),
  writeNoteTool: () => ({
    definition: { name: "write_note", description: "", input_schema: {} },
    handle: async () => ({ content: "" })
  }),
  undoEdit: vi.fn(async () => {})
}));

import { current } from "@/services/agent/conversations";
import { mountMapPanel, NOTE_SUGGESTIONS, needsKey, refreshMapContext, unmountMapPanel } from "./help-assistant-map";
import { undoEdit } from "./help-assistant-notes";

const w = globalThis as unknown as Record<string, unknown>;
const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = `<div id="host"></div>`;
  w.mapId = 1;
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
    expect(el("helpMapDrawer").hidden).toBe(true);
    expect(el("helpMapStatusModel").textContent).toContain("claude-sonnet-5");
    expect(el("helpMapStatusKey").textContent).toContain("no key");
    expect(el("helpMapContext").hidden).toBe(true);
  });

  it("opens the drawer with a hint instead of sending when the key is missing", () => {
    mountMapPanel(el("host"));
    el<HTMLTextAreaElement>("helpMapInput").value = "hello";
    el<HTMLTextAreaElement>("helpMapInput").dispatchEvent(new Event("input"));
    el<HTMLButtonElement>("helpMapSend").click();
    expect(el("helpMapDrawer").hidden).toBe(false);
    expect(el("helpMapHint").hidden).toBe(false);
    expect(document.activeElement).toBe(el("helpMapKey"));
    expect(el("helpMapLog").querySelector(".helpMapUser")).toBeNull();
  });

  it("toggles the drawer from the gear and the status model button", () => {
    mountMapPanel(el("host"));
    el<HTMLButtonElement>("helpMapSettings").click();
    expect(el("helpMapDrawer").hidden).toBe(false);
    el<HTMLButtonElement>("helpMapSettings").click();
    expect(el("helpMapDrawer").hidden).toBe(true);
    el<HTMLButtonElement>("helpMapStatusModel").click();
    expect(el("helpMapDrawer").hidden).toBe(false);
  });

  it("shows the note chip and note suggestions when the notes editor is open", async () => {
    notesApi.label = "Kelmora";
    mountMapPanel(el("host"));
    refreshMapContext();
    await flush();
    expect(el("helpMapContext").hidden).toBe(false);
    expect(el("helpMapContext").textContent).toContain("Kelmora");
    const chips = [...el("helpMapLog").querySelectorAll("button")].map(button => button.textContent);
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
    const entry = el("helpMapLog").querySelector(".helpMapEdit") as HTMLElement;
    expect(entry.textContent).toContain("Updated note");
    expect(entry.textContent).toContain("Kelmora");
    (entry.querySelector("button") as HTMLButtonElement).click();
    await flush();
    expect(undoEdit).toHaveBeenCalled();
    expect((entry.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
