// Entity notes are optional HTML fields
import { ENTITY_TYPES, type EntityRef, MapEntities } from "@/components/map-entities";

export interface NoteEntry {
  ref: EntityRef;
  key: string;
  note: string;
}

const canHaveNote = (ref: EntityRef) => (ENTITY_TYPES as readonly string[]).includes(ref.type);
const entity = (ref: EntityRef) => (canHaveNote(ref) ? MapEntities.get(ref) : undefined);

class NotesStore {
  get(ref: EntityRef): string | undefined {
    return entity(ref)?.note;
  }

  /** Set the note, or remove the field when the html is empty. Returns false if the entity is gone */
  set(ref: EntityRef, note: string): boolean {
    const item = entity(ref);
    if (!item) return false;
    if (note) item.note = note;
    else delete item.note;
    return true;
  }

  /** Replace an entity's note with HTML from the notes editor's subset; empty html removes the note */
  write(key: string, html: string): void {
    const ref = MapEntities.parseKey(key);
    if (!ref) throw new Error(`Entity ${key} does not exist`);
    if (!canHaveNote(ref)) throw new Error(`A ${ref.type} cannot have a note`);
    if (!entity(ref)) throw new Error(`Entity ${key} does not exist`);
    if (typeof html !== "string" || !this.isSafe(html))
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
    return ENTITY_TYPES.flatMap(type =>
      MapEntities.collect(type).flatMap(({ ref, entity: { note } }) =>
        note ? [{ ref, key: MapEntities.key(ref), note }] : []
      )
    );
  }

  /** Whether html keeps to the notes editor's subset: no event handlers, JavaScript URLs, scripts or iframes */
  isSafe(html: string): boolean {
    const TAGS = new Set(
      "p div br hr span strong b em i u s strike a img ol ul li blockquote code h1 h2 h3 h4 h5 h6 sub sup table tbody tr td".split(
        " "
      )
    );
    const ATTRIBUTES = new Set(["href", "src", "alt", "title", "style", "colspan", "rowspan"]);

    const template = document.createElement("template");
    template.innerHTML = html;
    return [...template.content.querySelectorAll("*")].every(
      element =>
        TAGS.has(element.localName) &&
        [...element.attributes].every(attribute => {
          const name = attribute.name.toLowerCase();
          const value = attribute.value.trim();
          if (!ATTRIBUTES.has(name)) return false;
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
}

export const Notes = new NotesStore();
