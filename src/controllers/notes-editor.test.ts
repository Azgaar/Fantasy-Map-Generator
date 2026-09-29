// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/renderers/overlays/highlight", () => ({ highlightElement: () => {} }));
vi.mock("@/components/tooltips", () => ({ tip: () => {} }));

import { Notes } from "@/components/notes";
import { NotesEditor } from "./notes-editor";

const w = globalThis as unknown as Record<string, unknown>;
const burg = { type: "burg", id: 1 } as const;

beforeEach(() => {
  document.body.innerHTML = `<div id="dialogs"></div><div id="notesHeader"></div><div id="notesBody"></div>`;
  w.pack = {
    burgs: [0, { i: 1, name: "Kelmora", note: "<p>old</p>" }, { i: 2, name: "Varr" }],
    markers: [{ i: 0, name: "Old Well" }]
  };
  w.fonts = [];
  window.$ = vi.fn(() => ({ dialog: vi.fn() })) as unknown as typeof window.$;
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("NotesEditor bridge", () => {
  it("has no current note while the editor is closed", () => {
    expect(NotesEditor.current()).toBeNull();
    expect(NotesEditor.getSelectionHtml()).toBeNull();
  });

  it("writes to the entity while the editor is closed", () => {
    const note = NotesEditor.write("burg:1", "<p>new</p>");
    expect(note).toEqual({ id: "burg:1", name: "Kelmora", legend: "<p>new</p>" });
    expect(Notes.get(burg)).toBe("<p>new</p>");
    expect(document.getElementById("notesEditor")).toBeNull();
  });

  it("creates a note on a zero-id entity without changing its name", () => {
    expect(NotesEditor.write("marker:0", "<p>x</p>")).toEqual({
      id: "marker:0",
      name: "Old Well",
      legend: "<p>x</p>"
    });
  });

  it("rejects missing and deleted entities instead of creating orphan notes", () => {
    expect(() => NotesEditor.write("marker:3", "<p>x</p>")).toThrow("not found");
    pack.burgs[1].removed = true;
    expect(() => NotesEditor.write("burg:1", "<p>x</p>")).toThrow("not found");
  });

  it("refreshes Quill and the note box while preserving the entity name", () => {
    NotesEditor.open(burg);
    expect(NotesEditor.current()?.id).toBe("burg:1");
    NotesEditor.write("burg:1", "<p>rewritten</p>");
    expect(document.querySelector("#notesLegend .ql-editor")?.innerHTML).toBe("<p>rewritten</p>");
    expect(document.getElementById("notesBody")?.innerHTML).toBe("<p>rewritten</p>");
    expect(document.getElementById("notesName")?.textContent).toBe("Kelmora");
  });

  it("lists newly written notes without moving the open editor", () => {
    NotesEditor.open(burg);
    NotesEditor.write("burg:2", "<p>b</p>");
    const options = [...(document.getElementById("notesSelect") as HTMLSelectElement).options].map(o => o.value);
    expect(options).toEqual(["burg:1", "burg:2"]);
    expect(NotesEditor.current()?.id).toBe("burg:1");
  });

  it("removes a note while keeping the selected entity editable", () => {
    NotesEditor.open(burg);
    NotesEditor.remove("burg:1");
    expect(Notes.get(burg)).toBeUndefined();
    expect(NotesEditor.current()).toEqual({ id: "burg:1", name: "Kelmora", legend: "" });
    expect(document.getElementById("notesBody")?.innerHTML).toBe("");
  });

  it("refreshes an HTML-mode note and reads its selection", () => {
    Notes.set(burg, '<iframe src="about:blank"></iframe>');
    NotesEditor.open(burg);
    const source = document.getElementById("notesSource") as HTMLTextAreaElement;
    expect(source.hidden).toBe(false);
    source.setSelectionRange(0, 7);
    expect(NotesEditor.getSelectionHtml()).toBe("<iframe");
    NotesEditor.write("burg:1", "<p>rewritten</p>");
    expect(source.hidden).toBe(true);
    expect(document.querySelector("#notesLegend .ql-editor")?.innerHTML).toBe("<p>rewritten</p>");
  });
});
