// Entity notes are optional HTML fields. See docs/prd/entity-notes.md.
import { ENTITY_TYPES, type EntityRef, MapEntities } from "@/components/map-entities";

export interface NoteEntry {
  ref: EntityRef;
  key: string;
  label: string;
  note: string;
}

class NotesStore {
  get(ref: EntityRef): string | undefined {
    return MapEntities.get(ref)?.note;
  }

  /** Set the note, or remove the field when the html is empty. Returns false if the entity is gone */
  set(ref: EntityRef, note: string): boolean {
    const entity = MapEntities.get(ref);
    if (!entity) return false;

    if (note) entity.note = note;
    else delete entity.note;
    return true;
  }

  /** Append to an existing note, used by the migration to collide duplicates */
  append(ref: EntityRef, note: string): boolean {
    if (!note) return true;
    const existing = this.get(ref);
    return this.set(ref, existing ? `${existing}${note}` : note);
  }

  remove(ref: EntityRef): void {
    this.set(ref, "");
  }

  /** Every note on the map, grouped by entity type in ENTITY_TYPES order */
  list(): NoteEntry[] {
    const entries: NoteEntry[] = [];

    for (const type of ENTITY_TYPES) {
      for (const { ref } of MapEntities.collect(type)) {
        const note = this.get(ref);
        if (note)
          entries.push({
            ref,
            key: MapEntities.key(ref),
            label: MapEntities.getName(ref) || MapEntities.key(ref),
            note
          });
      }
    }

    return entries;
  }

  /** The note button every entity dialog puts in its toolbar. `subject` completes "notes (legend) for ..." */
  getButton(id: string, subject: string): string {
    return `<button id="${id}" data-tip="Edit free text notes (legend) for ${subject}" class="icon-book"></button>`;
  }

  /** The same button as a table row action, in the `note` column every editor table gives it */
  getIcon(subject: string): string {
    return `<span data-col="note" data-tip="Edit free text notes (legend) for ${subject}" class="icon-book pointer"></span>`;
  }
}

export const Notes = new NotesStore();
