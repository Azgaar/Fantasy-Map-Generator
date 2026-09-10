// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/renderers/overlays/highlight", () => ({ highlightElement: () => {} }));
vi.mock("@/components/tooltips", () => ({ tip: () => {} }));
vi.mock("@/components/viewport", () => ({ viewport: { width: 1000, height: 600 } }));

import { NotesEditor } from "./notes-editor";

const w = globalThis as unknown as Record<string, unknown>;

interface Holder {
  i: number;
  name: string;
  note?: string;
}

const burgs = (): Holder[] => (w.pack as { burgs: Holder[] }).burgs;
const editorText = (): string | undefined => document.querySelector("#notesLegend .ql-editor")?.textContent;
const listed = (): string[] =>
  [...(document.getElementById("notesSelect") as HTMLSelectElement).options].map(option => option.value);

beforeEach(() => {
  document.body.innerHTML = `<div id="dialogs"></div><div id="notesHeader"></div><div id="notesBody"></div>
    <input id="legendsToLoad" type="file" />`;
  w.pack = {
    burgs: [0, { i: 1, name: "Kelmora", note: "<p>old</p>" }, { i: 2, name: "Varr" }],
    markers: [{ i: 3, name: "Old Well" }],
    states: [],
    provinces: [],
    rivers: [],
    routes: [],
    features: [],
    zones: [],
    journeys: [],
    markets: [],
    addedLabels: [],
    cultures: [],
    religions: [],
    biomes: [],
    goods: []
  };
  w.options = { app: { notesPinned: false } };
  w.fonts = [];
  window.$ = vi.fn(() => ({ dialog: vi.fn() })) as unknown as typeof window.$;
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("NotesEditor bridge", () => {
  it("has no current note or selection while the editor is closed", () => {
    expect(NotesEditor.current()).toBeNull();
    expect(NotesEditor.getSelectionHtml()).toBeNull();
  });

  it("writes to the entity only while the editor is closed", () => {
    const note = NotesEditor.write("burg1", "<p>new</p>");
    expect(note).toEqual({ id: "burg:1", name: "Kelmora", legend: "<p>new</p>" });
    expect(burgs()[1].note).toBe("<p>new</p>");
    expect(document.getElementById("notesEditor")).toBeNull();
  });

  it("accepts a note key as well as an element id, and ignores the name", () => {
    expect(NotesEditor.write("burg:2", "<p>b</p>", "Varr the Bold")).toEqual({
      id: "burg:2",
      name: "Varr",
      legend: "<p>b</p>"
    });
    expect(burgs()[2].note).toBe("<p>b</p>");
  });

  it("refuses a note for an entity that is not on the map", () => {
    expect(NotesEditor.write("burg9", "<p>x</p>")).toBeNull();
    expect(NotesEditor.write("nonsense", "<p>x</p>")).toBeNull();
  });

  it("reports and refreshes the note shown in the open editor", () => {
    NotesEditor.open({ type: "burg", id: 1 });
    expect(NotesEditor.current()?.id).toBe("burg:1");
    expect(editorText()).toBe("old");

    NotesEditor.write("burg1", "<p>rewritten</p>");
    expect(editorText()).toBe("rewritten");
    expect(document.getElementById("notesBody")?.innerHTML).toBe("<p>rewritten</p>");
    expect(document.getElementById("notesName")?.textContent).toBe("Kelmora");
    expect(NotesEditor.getSelectionHtml()).toBeNull(); // nothing selected
  });

  it("falls back to the raw editor for markup Quill cannot hold", () => {
    NotesEditor.open({ type: "burg", id: 1 });
    NotesEditor.write("burg1", "<iframe src='x'></iframe>");
    expect((document.getElementById("notesSource") as HTMLTextAreaElement).hidden).toBe(false);
    expect((document.getElementById("notesSource") as HTMLTextAreaElement).value).toBe("<iframe src='x'></iframe>");
    expect(NotesEditor.getSelectionHtml()).toBeNull();
  });

  it("adds a note created while another is open to the element list", () => {
    NotesEditor.open({ type: "burg", id: 1 });
    NotesEditor.write("marker3", "<p>w</p>");
    expect(listed()).toEqual(["burg:1", "marker:3"]);
    expect(NotesEditor.current()?.id).toBe("burg:1");
    expect(editorText()).toBe("old");
  });

  it("removes a note and moves the open editor to the next one", () => {
    burgs()[2].note = "<p>b</p>";
    NotesEditor.open({ type: "burg", id: 2 });
    NotesEditor.remove("burg2");
    expect(burgs()[2].note).toBeUndefined();
    expect(NotesEditor.current()?.id).toBe("burg:1");
  });

  it("leaves the open editor alone when another note is removed", () => {
    burgs()[2].note = "<p>b</p>";
    NotesEditor.open({ type: "burg", id: 1 });
    NotesEditor.remove("burg:2");
    expect(burgs()[2].note).toBeUndefined();
    expect(NotesEditor.current()?.id).toBe("burg:1");
    expect(editorText()).toBe("old");
  });
});
