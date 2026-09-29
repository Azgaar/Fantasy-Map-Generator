// Entity notes are optional HTML fields. See docs/prd/entity-notes.md.
import { ENTITY_TYPES, type EntityRef, MapEntities } from "@/components/map-entities";

export interface NoteEntry {
  ref: EntityRef;
  key: string;
  label: string;
  note: string;
}

class NotesStore {
  // Notes render into tooltips as HTML, so writes from outside the notes editor keep to its subset
  private static readonly TAGS = new Set(
    "p div br hr span strong b em i u s strike a img ol ul li blockquote code h1 h2 h3 h4 h5 h6 sub sup table tbody tr td".split(
      " "
    )
  );
  private static readonly ATTRIBUTES = new Set(["href", "src", "alt", "title", "style", "colspan", "rowspan"]);

  private static isSafe(html: string): boolean {
    const template = document.createElement("template");
    template.innerHTML = html;
    return [...template.content.querySelectorAll("*")].every(
      element =>
        NotesStore.TAGS.has(element.localName) &&
        [...element.attributes].every(attribute => {
          const name = attribute.name.toLowerCase();
          const value = attribute.value.trim();
          if (!NotesStore.ATTRIBUTES.has(name)) return false;
          if (name === "style") return !/url\s*\(|expression\s*\(|@import/i.test(value);
          if (name !== "href" && name !== "src") return true;
          const compact = [...value].filter(character => character.charCodeAt(0) > 32).join("");
          return (
            !/^[a-z][a-z\d+.-]*:/i.test(compact) ||
            (name === "src"
              ? /^(?:https?:|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(compact)
              : /^(?:https?|mailto):/i.test(compact))
          );
        })
    );
  }

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

  /** Replace an entity's note with HTML from the notes editor's subset; empty html removes the note */
  write(key: string, html: string): void {
    const ref = typeof key === "string" ? MapEntities.parseKey(key) : undefined;
    if (!ref || !MapEntities.get(ref)) throw new Error(`Entity ${key} does not exist`);
    if (!(ENTITY_TYPES as readonly string[]).includes(ref.type)) throw new Error(`A ${ref.type} cannot have a note`);
    if (typeof html !== "string" || !NotesStore.isSafe(html))
      throw new Error(
        "Note HTML must keep to the notes subset: no event handlers, JavaScript URLs, scripts or iframes"
      );
    this.set(ref, html);
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
}

export const Notes = new NotesStore();
