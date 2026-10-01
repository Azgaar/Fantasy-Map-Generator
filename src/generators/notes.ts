// Entity notes are optional HTML fields
import { ENTITY_TYPES, type EntityRef, type EntityType, isEntityType } from "@/data/entity-types";

export interface NoteEntry {
  ref: EntityRef;
  key: string;
  note: string;
}

type NoteEntity = { i: number; note?: string; removed?: boolean };
type NoteType = (typeof ENTITY_TYPES)[number];

const COLLECTIONS: Record<Exclude<NoteType, "regiment">, string> = {
  state: "states",
  province: "provinces",
  burg: "burgs",
  marker: "markers",
  river: "rivers",
  route: "routes",
  feature: "features",
  zone: "zones",
  journey: "journeys",
  market: "markets",
  addedLabel: "addedLabels",
  culture: "cultures",
  religion: "religions",
  biome: "biomes",
  good: "goods"
};

const EXCLUDE_ZERO = new Set<NoteType>([
  "state",
  "province",
  "burg",
  "river",
  "feature",
  "market",
  "addedLabel",
  "culture",
  "religion",
  "good"
]);

const byId = (items: NoteEntity[] | undefined, id: number): NoteEntity | undefined => {
  const item = items?.[id];
  return item?.i === id ? item : items?.find(entry => entry?.i === id);
};

function collection(type: Exclude<NoteType, "regiment">): NoteEntity[] | undefined {
  return (pack as unknown as Record<string, NoteEntity[] | undefined>)[COLLECTIONS[type]];
}

function entity(ref: EntityRef): NoteEntity | undefined {
  if (ref.type === "regiment") {
    const state = byId(pack.states as NoteEntity[], ref.id);
    if (!state || state.removed) return undefined;
    const regiment = byId((state as { military?: NoteEntity[] }).military, ref.sub ?? -1);
    return regiment?.removed ? undefined : regiment;
  }
  if (!(ENTITY_TYPES as readonly string[]).includes(ref.type)) return undefined;
  const item = byId(collection(ref.type as Exclude<NoteType, "regiment">), ref.id);
  return item?.removed ? undefined : item;
}

const key = (ref: EntityRef): string =>
  ref.type === "regiment" ? `regiment:${ref.id}-${ref.sub}` : `${ref.type}:${ref.id}`;

function parseKey(value: string): EntityRef | undefined {
  const match = /^(\w+):(\d+)(?:-(\d+))?$/.exec(value);
  if (!match || !isEntityType(match[1])) return undefined;
  const type: EntityType = match[1];
  if ((type === "regiment") !== (match[3] !== undefined)) return undefined;
  const id = Number(match[2]);
  const sub = match[3] === undefined ? undefined : Number(match[3]);
  if (!Number.isSafeInteger(id) || (sub !== undefined && !Number.isSafeInteger(sub))) return undefined;
  return sub === undefined ? { type, id } : { type, id, sub };
}

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
    const ref = parseKey(key);
    if (!ref) throw new Error(`Entity ${key} does not exist`);
    if (!(ENTITY_TYPES as readonly string[]).includes(ref.type)) throw new Error(`A ${ref.type} cannot have a note`);
    if (!entity(ref)) throw new Error(`Entity ${key} does not exist`);
    if (typeof html !== "string" || !this.isSafeNoteHtml(html))
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
      if (type === "regiment") {
        for (const state of pack.states ?? []) {
          if (!state?.i || state.removed) continue;
          for (const regiment of state.military ?? []) {
            if (!regiment?.note) continue;
            const ref: EntityRef = { type, id: state.i, sub: regiment.i };
            entries.push({ ref, key: key(ref), note: regiment.note });
          }
        }
        continue;
      }
      for (const item of collection(type) ?? []) {
        if (!item?.note || item.removed || !Number.isInteger(item.i) || (EXCLUDE_ZERO.has(type) && !item.i)) continue;
        const ref: EntityRef = { type, id: item.i };
        entries.push({ ref, key: key(ref), note: item.note });
      }
    }
    return entries;
  }

  private isSafeNoteHtml(html: string): boolean {
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
