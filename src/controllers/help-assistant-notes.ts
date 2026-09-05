// Notes editing for the assistant's "This map" panel: the per-turn context describing the note open
// in the notes editor, the write_note tool, and its undo. Writes go through the notes editor bridge
// (Controllers.NotesEditor, lazy) so an open editor stays in sync.

import type { Entry, NoteState } from "@/services/agent/conversations";
import type { ToolInput } from "@/services/agent/providers";
import type { AgentTool, ToolOutcome } from "@/services/agent/session";
import type { Note } from "./notes-editor";
import { canEditAsRichText } from "./notes-rich-text";

export type EditEntry = Extract<Entry, { kind: "edit" }>;

export const MAX_CONTEXT_CHARS = 6000;

const ALLOWED_TAGS =
  "p, br, strong, em, u, s, a, img, ul, ol, li, blockquote, h1-h6, sub, sup, span, div, table/tbody/tr/td/th";

const WRITE_NOTE = {
  name: "write_note",
  description: `Replace the HTML legend of one note, creating the note when it does not exist. Omit \`id\` to
target the note open in the notes editor. \`html\` is the whole legend, not a fragment; allowed tags: ${ALLOWED_TAGS}.
Inline styles are kept, classes and scripts are not. Notes cannot be changed any other way.`,
  input_schema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "Note id, e.g. burg12 or marker3. Defaults to the note open in the editor."
      },
      name: { type: "string", description: "New display name for the note. Omit to keep the current one." },
      html: { type: "string", description: "The complete legend as HTML." }
    },
    required: ["html"]
  }
};

const noteById = (id: string): Note | undefined => (notes as Note[]).find(note => note.id === id);

export async function noteContext(): Promise<string | null> {
  const note = await Controllers.NotesEditor.current();
  if (!note) return null;
  const selection = await Controllers.NotesEditor.getSelectionHtml();
  const lines = [
    "# Notes editor",
    "",
    `The notes editor is open on note \`${note.id}\` ("${note.name}"). \`write_note\` without an id targets it.`,
    "",
    "Current legend HTML:",
    "```html",
    clipLegend(note),
    "```"
  ];
  if (selection) lines.push("", "The user has this part selected:", "```html", selection, "```");
  return lines.join("\n");
}

function clipLegend(note: Note): string {
  if (!note.legend) return "(empty)";
  if (note.legend.length <= MAX_CONTEXT_CHARS) return note.legend;
  const rest = note.legend.length - MAX_CONTEXT_CHARS;
  const hint = `read notes.find(n => n.id === "${note.id}").legend in a script for the rest`;
  return `${note.legend.slice(0, MAX_CONTEXT_CHARS)}\n… ${rest} more characters — ${hint}`;
}

export async function noteChipLabel(): Promise<string | null> {
  const note = await Controllers.NotesEditor.current();
  return note ? note.name || note.id : null;
}

export function writeNoteTool(onEdit: (entry: EditEntry) => void): AgentTool {
  return { definition: WRITE_NOTE, handle: input => writeNote(input, onEdit) };
}

const failure = (content: string): ToolOutcome => ({ content, isError: true });

export async function writeNote(input: ToolInput, onEdit: (entry: EditEntry) => void): Promise<ToolOutcome> {
  const html = typeof input.html === "string" ? input.html : null;
  if (html === null) return failure("write_note needs an `html` string with the whole legend.");
  if (!canEditAsRichText(html)) {
    return failure(`The notes editor cannot hold that HTML. Use only ${ALLOWED_TAGS}; no iframe, hr, script or media.`);
  }

  const id = typeof input.id === "string" && input.id ? input.id : (await Controllers.NotesEditor.current())?.id;
  if (!id) {
    return failure(
      "No note is open in the notes editor and no id was given. Find the element in a script first and pass its note id (burg<i> for burgs, marker<i> for markers)."
    );
  }
  const name = typeof input.name === "string" ? input.name : undefined;

  const existing = noteById(id);
  const previous: NoteState | null = existing ? { legend: existing.legend, name: existing.name } : null;
  const note = await Controllers.NotesEditor.write(id, html, name);
  onEdit({ kind: "edit", id, name: note.name, chars: html.length, previous });
  return { content: `${previous ? "updated" : "created"} note ${id} "${note.name}" — ${html.length} chars of HTML` };
}

export async function undoEdit(entry: EditEntry): Promise<void> {
  if (entry.undone) return;
  entry.undone = true;
  if (entry.previous) await Controllers.NotesEditor.write(entry.id, entry.previous.legend, entry.previous.name);
  else await Controllers.NotesEditor.remove(entry.id);
}
