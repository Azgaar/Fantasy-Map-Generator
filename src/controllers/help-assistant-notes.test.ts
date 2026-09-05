// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type EditEntry,
  MAX_CONTEXT_CHARS,
  noteChipLabel,
  noteContext,
  undoEdit,
  writeNote
} from "./help-assistant-notes";

const w = globalThis as unknown as Record<string, unknown>;

interface StoredNote {
  id: string;
  name: string;
  legend: string;
}

const editor = {
  current: vi.fn(),
  write: vi.fn(),
  remove: vi.fn(),
  getSelectionHtml: vi.fn()
};

beforeEach(() => {
  editor.current.mockReset().mockResolvedValue(null);
  editor.getSelectionHtml.mockReset().mockResolvedValue(null);
  editor.remove.mockReset().mockResolvedValue(undefined);
  editor.write.mockReset().mockImplementation(async (id: string, legend: string, name?: string) => {
    const list = w.notes as StoredNote[];
    const existing = list.find(note => note.id === id);
    if (existing) {
      existing.legend = legend;
      if (name !== undefined) existing.name = name;
      return existing;
    }
    const note = { id, name: name ?? id, legend };
    list.push(note);
    return note;
  });
  w.Controllers = { NotesEditor: editor };
  w.notes = [{ id: "burg1", name: "Kelmora", legend: "<p>old</p>" }];
});

describe("noteContext", () => {
  it("is null when the editor is closed", async () => {
    expect(await noteContext()).toBeNull();
    expect(await noteChipLabel()).toBeNull();
  });

  it("describes the open note and its selection", async () => {
    editor.current.mockResolvedValue({ id: "burg1", name: "Kelmora", legend: "<p>old</p>" });
    editor.getSelectionHtml.mockResolvedValue("<p>old</p>");
    const text = await noteContext();
    expect(text).toContain("# Notes editor");
    expect(text).toContain("`burg1`");
    expect(text).toContain('"Kelmora"');
    expect(text).toContain("<p>old</p>");
    expect(text).toContain("selected");
    expect(await noteChipLabel()).toBe("Kelmora");
  });

  it("truncates a long legend and points at the rest", async () => {
    const legend = "x".repeat(MAX_CONTEXT_CHARS + 500);
    editor.current.mockResolvedValue({ id: "burg1", name: "K", legend });
    const text = (await noteContext()) ?? "";
    expect(text).not.toContain("x".repeat(MAX_CONTEXT_CHARS + 1));
    expect(text).toContain("500 more characters");
    expect(text).toContain('n.id === "burg1"');
  });
});

describe("writeNote", () => {
  const collect = () => {
    const entries: EditEntry[] = [];
    return { entries, onEdit: (entry: EditEntry) => entries.push(entry) };
  };

  it("updates the open note when no id is given and records the previous state", async () => {
    editor.current.mockResolvedValue({ id: "burg1", name: "Kelmora", legend: "<p>old</p>" });
    const { entries, onEdit } = collect();
    const outcome = await writeNote({ html: "<p>new</p>" }, onEdit);
    expect(outcome.isError).toBeFalsy();
    expect(outcome.content).toContain("updated note burg1");
    expect(editor.write).toHaveBeenCalledWith("burg1", "<p>new</p>", undefined);
    expect(entries).toEqual([
      { kind: "edit", id: "burg1", name: "Kelmora", chars: 10, previous: { legend: "<p>old</p>", name: "Kelmora" } }
    ]);
  });

  it("creates a note by id when none exists", async () => {
    const { entries, onEdit } = collect();
    const outcome = await writeNote({ id: "marker2", name: "Old Well", html: "<p>w</p>" }, onEdit);
    expect(outcome.content).toContain("created note marker2");
    expect(entries[0]).toMatchObject({ id: "marker2", name: "Old Well", previous: null });
  });

  it("refuses when there is neither an id nor an open note", async () => {
    const { entries, onEdit } = collect();
    const outcome = await writeNote({ html: "<p>x</p>" }, onEdit);
    expect(outcome.isError).toBe(true);
    expect(outcome.content).toContain("burg<i>");
    expect(entries).toEqual([]);
    expect(editor.write).not.toHaveBeenCalled();
  });

  it("refuses html the editor cannot hold", async () => {
    const { onEdit } = collect();
    const outcome = await writeNote({ id: "burg1", html: "<iframe src='x'></iframe>" }, onEdit);
    expect(outcome.isError).toBe(true);
    expect(outcome.content).toContain("cannot hold");
    expect(editor.write).not.toHaveBeenCalled();
  });

  it("refuses a missing html field", async () => {
    const outcome = await writeNote({ id: "burg1" }, collect().onEdit);
    expect(outcome.isError).toBe(true);
  });
});

describe("undoEdit", () => {
  it("restores the previous legend and name once", async () => {
    const entry: EditEntry = {
      kind: "edit",
      id: "burg1",
      name: "K2",
      chars: 1,
      previous: { legend: "<p>old</p>", name: "Kelmora" }
    };
    await undoEdit(entry);
    await undoEdit(entry);
    expect(editor.write).toHaveBeenCalledTimes(1);
    expect(editor.write).toHaveBeenCalledWith("burg1", "<p>old</p>", "Kelmora");
    expect(entry.undone).toBe(true);
  });

  it("removes a note the assistant created", async () => {
    const entry: EditEntry = { kind: "edit", id: "marker2", name: "Old Well", chars: 1, previous: null };
    await undoEdit(entry);
    expect(editor.remove).toHaveBeenCalledWith("marker2");
    expect(entry.undone).toBe(true);
  });
});
