// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Notes } from "@/generators/notes";
import { mapId, type NoteProposal } from "@/services/agent/map-tools";

vi.mock("@/controllers/notes-editor", () => ({
  NotesEditor: {
    write: (target: string, html: string) => {
      Notes.set(Notes.parseKey(target)!, html);
      return { id: target, legend: html };
    }
  }
}));
vi.mock("@/components/tooltips", () => ({ tip: vi.fn() }));
vi.mock("@/services/agent/providers-models", () => ({
  cachedModels: () => [],
  listModels: vi.fn().mockRejectedValue(new Error("offline")),
  mergeModels: (curated: string[]) => curated
}));
const availability = vi.hoisted(() => ({ allowed: true }));
vi.mock("@/services/help/api", async importOriginal => ({
  ...(await importOriginal<typeof import("@/services/help/api")>()),
  canUseHostedAssistant: () => availability.allowed
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
  availability.allowed = true;
  document.body.innerHTML = `<div id="host"></div>`;
  w.mapId = 1;
  w.customization = 0;
  window.$ = vi.fn(() => ({ dialog: vi.fn() })) as unknown as typeof window.$;
  notesApi.label = null;
});

afterEach(() => {
  unmountMapPanel();
  vi.unstubAllGlobals();
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
  it("keeps Apply and Undo outcomes visible and writes the same cleaned content as the preview", async () => {
    vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal("pack", { cells: {}, burgs: [{ i: 0 }, { i: 1, name: "Aukiz", note: "<p>Original</p>" }] });
    mountMapPanel(el("host"));
    const proposal: NoteProposal = {
      id: "status-test",
      target: "burg:1",
      label: "Aukiz",
      mapId: mapId(),
      before: "<p>Original</p>",
      html: '"<h2>Aukiz</h2><p>The capital.</p>"',
      status: "proposed"
    };
    current().entries.push({ kind: "proposal", proposal });
    unmountMapPanel();
    mountMapPanel(el("host"));
    const card = () => el("helpMapLog").querySelector<HTMLElement>('[data-proposal-id="status-test"]')!;
    expect(card().textContent).not.toContain('"');
    card().querySelector<HTMLButtonElement>('[data-action="apply"]')!.click();
    await flush();
    expect(Notes.get({ type: "burg", id: 1 })).toBe("<h2>Aukiz</h2><p>The capital.</p>");
    expect(card().querySelector('[role="status"]')?.textContent).toBe("✓ Applied");
    const undo = card().querySelector<HTMLButtonElement>('[data-action="undo"]')!;
    expect(undo.disabled).toBe(false);
    undo.click();
    await flush();
    expect(card().querySelector('[role="status"]')?.textContent).toBe("↶ Undone");
    expect(card().textContent).toContain("Original note restored");
    expect(card().querySelector("button")).toBeNull();
    expect(Notes.get({ type: "burg", id: 1 })).toBe("<p>Original</p>");
  });
  it("does not show the setup notice for an already configured personal provider", () => {
    availability.allowed = false;
    localStorage.setItem("fmg-ai-chat-model", "claude-sonnet-5");
    localStorage.setItem("fmg-ai-kl-anthropic", "test-key");
    mountMapPanel(el("host"));
    expect(el("helpMapSetup").hidden).toBe(true);
  });
  it("explains setup on an unsupported origin before the user tries to send", () => {
    availability.allowed = false;
    mountMapPanel(el("host"));
    expect(el("helpMapSetup").hidden).toBe(false);
    expect(el("helpMapSetupText").textContent).toContain("your own AI provider");
    expect(el("helpMapDrawer").hidden).toBe(false);
    expect(el<HTMLSelectElement>("helpMapProvider").value).toBe("anthropic");
    expect(
      el<HTMLSelectElement>("helpMapProvider").querySelector<HTMLOptionElement>('option[value="hosted"]')!.disabled
    ).toBe(true);
  });
  it("mounts with the drawer closed and the model named in the status line", () => {
    mountMapPanel(el("host"));
    expect(el("helpMapDrawer").hidden).toBe(true);
    expect(el("helpMapStatusModel").textContent).toBe("FMG provided");
    expect(el("helpMapContext").hidden).toBe(true);
  });

  it("opens the drawer with a hint instead of sending when a personal key is missing", () => {
    localStorage.setItem("fmg-ai-chat-model", "claude-sonnet-5");
    mountMapPanel(el("host"));
    el<HTMLTextAreaElement>("helpMapInput").value = "hello";
    el<HTMLTextAreaElement>("helpMapInput").dispatchEvent(new Event("input"));
    el<HTMLButtonElement>("helpMapSend").click();
    expect(el("helpMapDrawer").hidden).toBe(false);
    expect(el("helpMapHint").hidden).toBe(false);
    expect(document.activeElement).toBe(el("helpMapKey"));
    expect(el("helpMapLog").querySelector(".helpAssistantMsg.user")).toBeNull();
  });

  it("lists providers separately and narrows the model list to the one chosen", () => {
    localStorage.setItem("fmg-ai-chat-model", "claude-sonnet-5");
    mountMapPanel(el("host"));
    const provider = el<HTMLSelectElement>("helpMapProvider");
    const model = el<HTMLSelectElement>("helpMapModel");

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
    expect(el("helpMapStatusModel").textContent).toContain("mistral-small-latest");
  });

  it("shows the local server fields only for the local provider", () => {
    mountMapPanel(el("host"));
    expect(el("helpMapLocal").hidden).toBe(true);

    const provider = el<HTMLSelectElement>("helpMapProvider");
    provider.value = "local";
    provider.dispatchEvent(new Event("change"));
    expect(el("helpMapLocal").hidden).toBe(false);
    expect(el("helpMapStatusModel").textContent).toContain("local model");
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
    const chips = [...el("helpMapLog").querySelectorAll(".helpMapEmpty button")].map(button => button.textContent);
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
