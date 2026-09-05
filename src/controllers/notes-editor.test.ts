// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/renderers/overlays/highlight", () => ({ highlightElement: () => {} }));
vi.mock("@/components/tooltips", () => ({ tip: () => {} }));

import { NotesEditor } from "./notes-editor";

const w = globalThis as unknown as Record<string, unknown>;
const notesOf = (): { id: string; name: string; legend: string }[] =>
  w.notes as { id: string; name: string; legend: string }[];
const editorText = (): string | undefined => document.querySelector("#notesLegend .ql-editor")?.textContent;

beforeEach(() => {
  document.body.innerHTML = `<div id="dialogs"></div><div id="notesHeader"></div><div id="notesBody"></div>
    <input id="legendsToLoad" type="file" />`;
  w.notes = [{ id: "burg1", name: "Kelmora", legend: "<p>old</p>" }];
  w.options = { pinNotes: false };
  w.svgWidth = 1000;
  w.svgHeight = 600;
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

  it("writes to the data only while the editor is closed", () => {
    const note = NotesEditor.write("burg1", "<p>new</p>");
    expect(note).toEqual({ id: "burg1", name: "Kelmora", legend: "<p>new</p>" });
    expect(notesOf()[0].legend).toBe("<p>new</p>");
    expect(document.getElementById("notesEditor")).toBeNull();
  });

  it("creates a missing note with the given name, defaulting to the id", () => {
    NotesEditor.write("marker3", "<p>x</p>", "Old Well");
    NotesEditor.write("marker4", "<p>y</p>");
    expect(notesOf().map(n => `${n.id}:${n.name}`)).toEqual(["burg1:Kelmora", "marker3:Old Well", "marker4:marker4"]);
  });

  it("reports and refreshes the note shown in the open editor", () => {
    NotesEditor.open("burg1");
    expect(NotesEditor.current()?.id).toBe("burg1");
    expect(editorText()).toBe("old");

    NotesEditor.write("burg1", "<p>rewritten</p>", "Kelmora the Grim");
    expect(editorText()).toBe("rewritten");
    expect(document.getElementById("notesBody")?.innerHTML).toBe("<p>rewritten</p>");
    expect((document.getElementById("notesName") as HTMLInputElement).value).toBe("Kelmora the Grim");
    expect(NotesEditor.getSelectionHtml()).toBeNull(); // nothing selected
  });

  it("falls back to the raw editor for markup Quill cannot hold", () => {
    NotesEditor.open("burg1");
    NotesEditor.write("burg1", "<iframe src='x'></iframe>");
    expect((document.getElementById("notesSource") as HTMLTextAreaElement).hidden).toBe(false);
    expect((document.getElementById("notesSource") as HTMLTextAreaElement).value).toBe("<iframe src='x'></iframe>");
    expect(NotesEditor.getSelectionHtml()).toBeNull();
  });

  it("adds a note created while another is open to the element list", () => {
    NotesEditor.open("burg1");
    NotesEditor.write("burg2", "<p>b</p>", "Varr");
    const options = [...(document.getElementById("notesSelect") as HTMLSelectElement).options].map(o => o.value);
    expect(options).toEqual(["burg1", "burg2"]);
    expect(NotesEditor.current()?.id).toBe("burg1");
    expect(editorText()).toBe("old");
  });

  it("removes a note and moves the open editor to the next one", () => {
    w.notes = [
      { id: "burg1", name: "Kelmora", legend: "<p>a</p>" },
      { id: "burg2", name: "Varr", legend: "<p>b</p>" }
    ];
    NotesEditor.open("burg2");
    NotesEditor.remove("burg2");
    expect(notesOf().map(n => n.id)).toEqual(["burg1"]);
    expect(NotesEditor.current()?.id).toBe("burg1");
  });
});
