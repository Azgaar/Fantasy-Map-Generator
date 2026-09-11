// Notes editing for the assistant's "This map" panel: the per-turn context describing the note open
// in the notes editor, the write_note tool, and its undo. Writes go through the notes editor bridge
// (Controllers.NotesEditor, lazy) so an open editor stays in sync.

import { MapEntities } from "@/components/map-entities";
import { Notes } from "@/components/notes";
import type { Entry, NoteState } from "@/services/agent/conversations";
import type { ToolInput } from "@/services/agent/providers";
import type { AgentTool, ToolOutcome } from "@/services/agent/session";
import type { Note } from "./notes-editor";
import { canEditAsRichText } from "./notes-rich-text";

export type EditEntry = Extract<Entry, { kind: "edit" }>;

export const MAX_CONTEXT_CHARS = 6000;

// mirrors RICH_TEXT_TAGS in notes-rich-text.ts; no th — Quill has no header-cell blot
const ALLOWED_TAGS =
  "p, br, strong, em, u, s, a, img, ul, ol, li, blockquote, h1-h6, sub, sup, span, div, table/tbody/tr/td";

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
        description:
          "Note key: the entity type and index, e.g. burg:12 or marker:3 (the svg element id burg12 is accepted too). Defaults to the note open in the editor."
      },
      name: {
        type: "string",
        description: "Ignored: a note is named by the entity it sits on, so rename the entity instead."
      },
      html: { type: "string", description: "The complete legend as HTML." }
    },
    required: ["html"]
  }
};

// Notes live on their entity (pack.burgs[12].note), so a note is read through the store by key or element id
function noteById(id: string): Note | undefined {
  const ref = MapEntities.parseKey(id) ?? MapEntities.resolveElement(id);
  if (!ref || !MapEntities.get(ref)) return undefined;
  return { id: MapEntities.key(ref), name: MapEntities.getName(ref), legend: Notes.get(ref) || "" };
}

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
  const hint = `read the note field of the entity ${note.id} in a script (pack.<type>s[<i>].note) for the rest`;
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
      "No note is open in the notes editor and no id was given. Find the entity in a script first and pass its note key (burg:<i> for burgs, marker:<i> for markers; the element id burg<i> works too)."
    );
  }
  const name = typeof input.name === "string" ? input.name : undefined;

  const existing = noteById(id);
  const previous: NoteState | null = existing?.legend ? { legend: existing.legend, name: existing.name } : null;
  const note = await Controllers.NotesEditor.write(id, html, name);
  if (!note) return failure(`No entity on this map answers to "${id}", so there is nothing to attach the note to.`);
  onEdit({ kind: "edit", id: note.id, name: note.name, chars: html.length, previous });
  return {
    content: `${previous ? "updated" : "created"} note ${note.id} "${note.name}" — ${html.length} chars of HTML`
  };
}

export async function undoEdit(entry: EditEntry): Promise<void> {
  if (entry.undone) return;
  entry.undone = true;
  if (entry.previous) await Controllers.NotesEditor.write(entry.id, entry.previous.legend, entry.previous.name);
  else await Controllers.NotesEditor.remove(entry.id);
}
