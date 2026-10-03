// @vitest-environment jsdom
import Quill from "quill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/renderers/overlays/highlight", () => ({ highlightElement: () => {} }));
vi.mock("@/components/tooltips", () => ({ tip: () => {} }));

import { Notes } from "@/generators/notes";
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

  it("does nothing on refresh while the editor is closed", () => {
    Notes.set(burg, "<p>new</p>");
    NotesEditor.refresh();
    expect(document.getElementById("notesEditor")).toBeNull();
  });

  it("refreshes Quill and the note box while preserving the entity name", () => {
    NotesEditor.open(burg);
    expect(NotesEditor.current()?.id).toBe("burg:1");
    Notes.set(burg, "<p>rewritten</p>");
    NotesEditor.refresh();
    expect(document.querySelector("#notesLegend .ql-editor")?.innerHTML).toBe("<p>rewritten</p>");
    expect(document.getElementById("notesBody")?.innerHTML).toBe("<p>rewritten</p>");
    expect(document.getElementById("notesName")?.textContent).toBe("Kelmora");
  });

  it("lists newly written notes without moving the open editor", () => {
    NotesEditor.open(burg);
    Notes.set({ type: "burg", id: 2 }, "<p>b</p>");
    NotesEditor.refresh();
    const options = [...(document.getElementById("notesSelect") as HTMLSelectElement).options].map(o => o.value);
    expect(options).toEqual(["burg:1", "burg:2"]);
    expect(NotesEditor.current()?.id).toBe("burg:1");
  });

  it("shows a removed note while keeping the selected entity editable", () => {
    NotesEditor.open(burg);
    Notes.set(burg, "");
    NotesEditor.refresh();
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
    Notes.set(burg, "<p>rewritten</p>");
    NotesEditor.refresh();
    expect(source.hidden).toBe(true);
    expect(document.querySelector("#notesLegend .ql-editor")?.innerHTML).toBe("<p>rewritten</p>");
  });
});

it("keeps the selected note excerpt after focus moves to the Assistant and clears it on refresh", () => {
  NotesEditor.open(burg);
  const editor = Quill.find(document.getElementById("notesLegend")!) as Quill;
  editor.setSelection(0, 3);
  editor.blur();
  expect(NotesEditor.getSelectionHtml()).toBe("old");
  Notes.set(burg, "<p>New</p>");
  NotesEditor.refresh();
  expect(NotesEditor.getSelectionHtml()).toBeNull();
});

it("announces note context changes when selecting and closing notes", () => {
  const changed = vi.fn();
  window.addEventListener("notes:context-changed", changed);
  let close: (() => void) | undefined;
  window.$ = vi.fn(() => ({
    dialog: (options: unknown) => {
      if (options && typeof options === "object" && "close" in options) close = options.close as () => void;
    }
  })) as unknown as typeof window.$;
  NotesEditor.open(burg);
  expect(changed).toHaveBeenCalledTimes(1);
  Notes.set({ type: "burg", id: 2 }, "<p>Other</p>");
  NotesEditor.refresh();
  expect(changed).toHaveBeenCalledTimes(2);
  const select = document.getElementById("notesSelect") as HTMLSelectElement;
  select.value = "burg:2";
  select.dispatchEvent(new Event("change"));
  expect(changed).toHaveBeenCalledTimes(3);
  close!();
  expect(changed).toHaveBeenCalledTimes(4);
  expect(NotesEditor.current()).toBeNull();
  window.removeEventListener("notes:context-changed", changed);
});
