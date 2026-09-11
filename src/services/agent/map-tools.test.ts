import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Notes } from "@/generators/notes";
import {
  applyProposal,
  executeMapTool,
  mapId,
  type NoteProposal,
  placeContext,
  proposedNoteHtml,
  safeNoteHtml,
  selectionsAt
} from "./map-tools";

vi.mock("@/controllers/notes-editor", () => ({
  NotesEditor: {
    write: (target: string, html: string) => {
      const ref = Notes.parseKey(target)!;
      Notes.set(ref, html);
      return { id: target, legend: html };
    }
  }
}));
function fixture() {
  return {
    cells: {
      i: [0, 1, 2],
      p: [
        [0, 0],
        [10, 0],
        [20, 0]
      ],
      c: [[1], [0, 2], [1]],
      h: [30, 30, 0],
      r: [0, 1, 0],
      f: [1, 1, 2],
      burg: [1, 0, 0],
      state: [1, 1, 0],
      province: [1, 1, 0],
      culture: [1, 1, 0],
      religion: [1, 1, 0],
      biome: [1, 1, 0]
    },
    burgs: [0, { i: 1, name: "Blackwater", cell: 0, x: 0, y: 0, population: 2, state: 1, note: "<p>Original</p>" }],
    states: [{ i: 0 }, { i: 1, name: "Eldan", pole: [0, 0] }],
    provinces: [{ i: 0 }, { i: 1, name: "Low March", pole: [0, 0] }],
    cultures: [{ i: 0 }, { i: 1, name: "Culture" }],
    religions: [{ i: 0 }, { i: 1, name: "Faith" }],
    biomes: [{}, { name: "Grassland" }],
    features: [{}, { type: "island" }, { type: "ocean" }],
    rivers: [{ i: 1, name: "Wending" }],
    markers: [{ i: 0, name: "Tower", type: "ruins", x: 2, y: 2, cell: 0 }]
  };
}
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("pack", fixture());
  vi.stubGlobal("Pack", { findCell: () => 0 });
  vi.stubGlobal("options", {
    map: { units: { population: { scale: 1000, urbanization: { rate: 1 } }, distance: { scale: 2, unit: "mi" } } }
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("bounded map tools", () => {
  it("removes generated HTML string wrappers without changing quotations in the note", () => {
    const html = '<h2>Aukiz</h2><p>They call it "the crown".</p>';
    expect(proposedNoteHtml(`"${html}"`)).toBe(html);
    expect(proposedNoteHtml(JSON.stringify(html))).toBe(html);
    expect(proposedNoteHtml('<p>"A quotation."</p>')).toBe('<p>"A quotation."</p>');
    expect(proposedNoteHtml('"A quotation."')).toBe('"A quotation."');
    expect(proposedNoteHtml('"<em>A phrase</em>"')).toBe("<em>A phrase</em>");
    expect(() => proposedNoteHtml('"<script>bad()</script><p>Text</p>"')).toThrow("Unsupported");
  });
  it("finds states with no active ports using either supported filter", async () => {
    const base = fixture();
    vi.stubGlobal("pack", {
      ...base,
      states: [{ i: 0 }, { i: 1, name: "Inland" }, { i: 2, name: "Coastal" }, { i: 3, name: "Removed", removed: true }],
      burgs: [
        0,
        { i: 1, state: 1, name: "Town" },
        { i: 2, state: 2, port: 8, name: "Harbour" },
        { i: 3, state: 1, port: 8, removed: true }
      ]
    });
    for (const filter of [{ port: false }, { withoutPorts: true }]) {
      const result = JSON.parse(
        await executeMapTool({ id: "s", name: "search_map", input: { kind: "state", ...filter } }, () => {})
      );
      expect(result.results).toEqual([{ target: "state:1", name: "Inland", hasPorts: false }]);
      expect(result.matches).toBe(1);
      expect(result.limited).toBe(false);
    }
    const result = JSON.parse(
      await executeMapTool({ id: "b", name: "search_map", input: { kind: "burg", port: false } }, () => {})
    );
    expect(result.results.map((b: { name: string }) => b.name)).toEqual(["Town"]);
  });
  it("resolves stable subjects without copying actions or map arrays", () => {
    const choices = selectionsAt(0, 0);
    expect(choices[0].target).toBe("burg:1");
    expect(choices.map(c => c.target)).toContain("religion:1");
    expect(JSON.stringify(choices)).not.toContain("Original");
  });
  it("collects political and nearby context together with real units and coverage", async () => {
    const text = JSON.stringify(await placeContext("burg:1"));
    expect(text).toContain("Low March");
    expect(text).toContain("Faith");
    expect(text).toContain('"unit":"mi"');
    expect(text).toContain("Wending");
    expect(text).not.toContain("Original");
    expect(text.length).toBeLessThan(3000);
  });
  it("requires a read revision and Apply before writing, then protects undo against manual edits", async () => {
    let proposal: NoteProposal | undefined;
    const read = JSON.parse(
      await executeMapTool({ id: "r", name: "read_note", input: { target: "burg:1" } }, () => {})
    ) as { revision: string };
    await executeMapTool(
      { id: "p", name: "propose_note", input: { target: "burg:1", revision: read.revision, html: "<p>New</p>" } },
      p => {
        proposal = p;
      }
    );
    expect(Notes.get({ type: "burg", id: 1 })).toBe("<p>Original</p>");
    await applyProposal(proposal!);
    expect(Notes.get({ type: "burg", id: 1 })).toBe("<p>New</p>");
    Notes.set({ type: "burg", id: 1 }, "Manual");
    await expect(applyProposal(proposal!, true)).rejects.toThrow("changed");
  });
  it("rejects stale proposals after a new map and scripts in note content", async () => {
    const p: NoteProposal = {
      id: "p",
      target: "burg:1",
      label: "Town",
      mapId: mapId(),
      before: "<p>Original</p>",
      html: "<p>New</p>",
      status: "proposed"
    };
    vi.stubGlobal("pack", fixture());
    await expect(applyProposal(p)).rejects.toThrow("another map");
    expect(() => safeNoteHtml("<script>alert(1)</script><p>hi</p>")).toThrow();
    expect(safeNoteHtml('<p onclick="bad()">Text</p>')).toBe("<p>Text</p>");
  });
  it("refuses oversized notes instead of replacing truncated text", async () => {
    Notes.set({ type: "burg", id: 1 }, "x".repeat(8001));
    await expect(executeMapTool({ id: "r", name: "read_note", input: { target: "burg:1" } }, () => {})).rejects.toThrow(
      "too long"
    );
  });
  it("keeps a synthetic 70 MB map local and returns a small context record", async () => {
    vi.stubGlobal("pack", { ...fixture(), embeddedLargeData: "x".repeat(70_000_000) });
    const text = await executeMapTool({ id: "c", name: "place_context", input: { target: "burg:1" } }, () => {});
    expect(new TextEncoder().encode(text).length).toBeLessThan(3000);
    expect(text).not.toContain("embeddedLargeData");
  });
  it("can stop a large local context scan", async () => {
    const map = fixture();
    map.cells.i = Array.from({ length: 40001 }, () => 0);
    vi.stubGlobal("pack", map);
    const controller = new AbortController();
    const result = placeContext("burg:1", controller.signal);
    controller.abort();
    await expect(result).rejects.toThrow();
  });
  it("undo restores the exact previous note and rejects a repeated operation", async () => {
    const p: NoteProposal = {
      id: "p",
      target: "burg:1",
      label: "Town",
      mapId: mapId(),
      before: "<p>Original</p>",
      html: "<p>New</p>",
      status: "proposed"
    };
    await applyProposal(p);
    await applyProposal(p, true);
    expect(Notes.get({ type: "burg", id: 1 })).toBe("<p>Original</p>");
    await expect(applyProposal(p, true)).rejects.toThrow("already");
  });
  it("never exposes the retired run tool", async () => {
    await expect(executeMapTool({ id: "x", name: "run", input: { code: "return pack" } }, () => {})).rejects.toThrow(
      "Unsupported"
    );
  });
});
