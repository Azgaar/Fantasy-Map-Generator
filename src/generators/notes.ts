// Notes (legends) live on the entity they describe, as an optional `note` field holding html. This
// module is the only place that maps between an entity, the svg element that carries its note on
// hover, and the key the editors and the csv exchange use. See docs/prd/entity-notes.md

import type { Point } from "@/types/global";

export const NOTE_ENTITY_TYPES = [
  "state",
  "province",
  "burg",
  "marker",
  "river",
  "route",
  "feature",
  "zone",
  "journey",
  "market",
  "regiment",
  "addedLabel",
  "culture",
  "religion",
  "biome",
  "good"
] as const;

export type NoteEntityType = (typeof NOTE_ENTITY_TYPES)[number];

/** A regiment is addressed by its state (`id`) and its own index (`sub`); everything else by `id` */
export interface NoteRef {
  type: NoteEntityType;
  id: number;
  sub?: number;
}

interface NoteHolder {
  note?: string;
}

export interface NoteEntry {
  ref: NoteRef;
  key: string;
  label: string;
  note: string;
}

interface NoteTypeDef {
  label: string; // human-readable type name, used to group the notes list
  entity: (id: number, sub?: number) => NoteHolder | undefined;
  name: (id: number, sub?: number) => string;
  refs: () => NoteRef[];
  element?: (id: number, sub?: number) => string;
  position?: (id: number, sub?: number) => Point | undefined; // where to zoom, for types placed on the map
}

function byId<T extends { i: number }>(collection: T[] | undefined, id: number): T | undefined {
  if (!collection) return undefined;
  const direct = collection[id];
  if (direct?.i === id) return direct;
  return collection.find(entity => entity?.i === id);
}

function cellPoint(cellId: number | undefined): Point | undefined {
  return cellId === undefined ? undefined : pack.cells?.p?.[cellId];
}

/** The middle of a cell chain: a river, a route or a zone is zoomed to its center, not to its start */
function chainPoint(cells: number[] | undefined): Point | undefined {
  if (!cells?.length) return undefined;
  return cellPoint(cells[Math.floor(cells.length / 2)]);
}

function refsOf(type: NoteEntityType, collection: { i: number; removed?: boolean }[] | undefined): NoteRef[] {
  if (!collection) return [];
  return collection.filter(entity => entity?.i && !entity.removed).map(entity => ({ type, id: entity.i }));
}

const TYPES: Record<NoteEntityType, NoteTypeDef> = {
  state: {
    label: "States",
    entity: id => byId(pack.states, id),
    name: id => byId(pack.states, id)?.fullName || byId(pack.states, id)?.name || "",
    refs: () => refsOf("state", pack.states),
    element: id => `stateLabel${id}`,
    position: id => {
      const state = byId(pack.states, id);
      return state?.pole || cellPoint(state?.center);
    }
  },
  province: {
    label: "Provinces",
    entity: id => byId(pack.provinces, id),
    name: id => byId(pack.provinces, id)?.fullName || byId(pack.provinces, id)?.name || "",
    refs: () => refsOf("province", pack.provinces),
    element: id => `provinceLabel${id}`,
    position: id => {
      const province = byId(pack.provinces, id);
      return province?.pole || cellPoint(province?.center);
    }
  },
  burg: {
    label: "Burgs",
    entity: id => byId(pack.burgs, id),
    name: id => byId(pack.burgs, id)?.name || "",
    refs: () => refsOf("burg", pack.burgs),
    element: id => `burg${id}`,
    position: id => {
      const burg = byId(pack.burgs, id);
      return burg && [burg.x, burg.y];
    }
  },
  marker: {
    label: "Markers",
    entity: id => byId(pack.markers, id),
    name: id => byId(pack.markers, id)?.name || "",
    refs: () => (pack.markers || []).map(marker => ({ type: "marker" as const, id: marker.i })),
    element: id => `marker${id}`,
    position: id => {
      const marker = byId(pack.markers, id);
      return marker && [marker.x, marker.y];
    }
  },
  river: {
    label: "Rivers",
    entity: id => byId(pack.rivers, id),
    name: id => {
      const river = byId(pack.rivers, id);
      return river ? `${river.name} ${river.type}` : "";
    },
    refs: () => refsOf("river", pack.rivers),
    element: id => `river${id}`,
    position: id => chainPoint(byId(pack.rivers, id)?.cells)
  },
  route: {
    label: "Routes",
    entity: id => byId(pack.routes, id),
    name: id => byId(pack.routes, id)?.name || "",
    refs: () => refsOf("route", pack.routes),
    element: id => `route${id}`,
    position: id => {
      const points = byId(pack.routes, id)?.points;
      const point = points?.[Math.floor(points.length / 2)];
      return point && [point[0], point[1]];
    }
  },
  feature: {
    label: "Lakes and landmasses",
    entity: id => byId(pack.features, id),
    name: id => byId(pack.features, id)?.name || "",
    refs: () => refsOf("feature", pack.features),
    element: id => `feature_${id}`,
    position: id => cellPoint(byId(pack.features, id)?.firstCell)
  },
  zone: {
    label: "Zones",
    entity: id => byId(pack.zones, id),
    name: id => byId(pack.zones, id)?.name || "",
    refs: () => refsOf("zone", pack.zones),
    element: id => `zone${id}`,
    position: id => chainPoint(byId(pack.zones, id)?.cells)
  },
  journey: {
    label: "Journeys",
    entity: id => byId(pack.journeys, id),
    name: id => byId(pack.journeys, id)?.name || "",
    refs: () => refsOf("journey", pack.journeys),
    element: id => `journey${id}`,
    position: id => {
      const points = byId(pack.journeys, id)?.segments?.flatMap(segment => segment.points) || [];
      const point = points[Math.floor(points.length / 2)];
      return point && [point[0], point[1]];
    }
  },
  market: {
    label: "Markets",
    entity: id => byId(pack.markets, id),
    name: id => byId(pack.markets, id)?.name || "",
    refs: () => refsOf("market", pack.markets),
    element: id => `market${id}`,
    position: id => {
      const center = byId(pack.burgs, byId(pack.markets, id)?.centerBurgId ?? -1);
      return center && [center.x, center.y];
    }
  },
  regiment: {
    label: "Regiments",
    entity: (id, sub) => byId(byId(pack.states, id)?.military, sub ?? -1),
    name: (id, sub) => byId(byId(pack.states, id)?.military, sub ?? -1)?.name || "",
    refs: () =>
      (pack.states || []).flatMap(state =>
        state?.i && !state.removed
          ? (state.military || []).map(regiment => ({ type: "regiment" as const, id: state.i, sub: regiment.i }))
          : []
      ),
    element: (id, sub) => `regiment${id}-${sub}`,
    position: (id, sub) => {
      const regiment = byId(byId(pack.states, id)?.military, sub ?? -1);
      return regiment && [regiment.x, regiment.y];
    }
  },
  addedLabel: {
    label: "Labels",
    entity: id => byId(pack.addedLabels, id),
    name: id => byId(pack.addedLabels, id)?.label?.text || "",
    refs: () => refsOf("addedLabel", pack.addedLabels),
    element: id => `addedLabel${id}`,
    position: id => {
      const label = byId(pack.addedLabels, id);
      return label && [label.x, label.y];
    }
  },
  culture: {
    label: "Cultures",
    entity: id => byId(pack.cultures, id),
    name: id => byId(pack.cultures, id)?.name || "",
    refs: () => refsOf("culture", pack.cultures)
  },
  religion: {
    label: "Religions",
    entity: id => byId(pack.religions, id),
    name: id => byId(pack.religions, id)?.name || "",
    refs: () => refsOf("religion", pack.religions)
  },
  biome: {
    label: "Biomes",
    entity: id => byId(pack.biomes, id),
    name: id => byId(pack.biomes, id)?.name || "",
    refs: () => refsOf("biome", pack.biomes)
  },
  good: {
    label: "Goods",
    entity: id => byId(pack.goods, id),
    name: id => byId(pack.goods, id)?.name || "",
    refs: () => refsOf("good", pack.goods)
  }
};

const ELEMENT_PATTERNS: [RegExp, NoteEntityType][] = [
  [/^burg(?:Label)?(\d+)$/, "burg"],
  [/^marker(\d+)$/, "marker"],
  [/^stateLabel(\d+)$/, "state"],
  [/^provinceLabel(\d+)$/, "province"],
  [/^river(?:Label)?(\d+)$/, "river"],
  [/^route(?:Label)?(\d+)$/, "route"],
  [/^addedLabel(\d+)$/, "addedLabel"],
  [/^feature_(\d+)$/, "feature"],
  [/^zone(\d+)$/, "zone"],
  [/^journey(\d+)$/, "journey"],
  [/^market(\d+)$/, "market"]
];

const REGIMENT_PATTERN = /^regiment(\d+)-(\d+)$/;
const SEGMENT_PATTERN = /^segment(\d+)_\d+$/; // a journey segment carries its journey's note

class NotesStore {
  /** Map an svg element id to the entity it belongs to. Types with no element of their own never match */
  resolveElement(elementId: string | null | undefined): NoteRef | undefined {
    if (!elementId) return undefined;

    const regiment = REGIMENT_PATTERN.exec(elementId);
    if (regiment) return { type: "regiment", id: +regiment[1], sub: +regiment[2] };

    const segment = SEGMENT_PATTERN.exec(elementId);
    if (segment) return { type: "journey", id: +segment[1] };

    for (const [pattern, type] of ELEMENT_PATTERNS) {
      const match = pattern.exec(elementId);
      if (match) return { type, id: +match[1] };
    }

    return undefined;
  }

  /** The svg element to highlight for a note. Undefined for entities that are not drawn on their own */
  getElementId(ref: NoteRef): string | undefined {
    return TYPES[ref.type].element?.(ref.id, ref.sub);
  }

  /** Where on the map the entity sits. Undefined for entities that are not placed on the map */
  getPosition(ref: NoteRef): Point | undefined {
    return TYPES[ref.type].position?.(ref.id, ref.sub);
  }

  /** Whether the entity the note belongs to is still on the map */
  exists(ref: NoteRef): boolean {
    return Boolean(TYPES[ref.type].entity(ref.id, ref.sub));
  }

  getTypeLabel(type: NoteEntityType): string {
    return TYPES[type].label;
  }

  getEntityName(ref: NoteRef): string {
    return TYPES[ref.type].name(ref.id, ref.sub);
  }

  get(ref: NoteRef): string | undefined {
    return TYPES[ref.type].entity(ref.id, ref.sub)?.note;
  }

  /** Set the note, or remove the field when the html is empty. Returns false if the entity is gone */
  set(ref: NoteRef, note: string): boolean {
    const entity = TYPES[ref.type].entity(ref.id, ref.sub);
    if (!entity) return false;

    if (note) entity.note = note;
    else delete entity.note;
    return true;
  }

  /** Append to an existing note, used by the migration to collide duplicates */
  append(ref: NoteRef, note: string): boolean {
    if (!note) return true;
    const existing = this.get(ref);
    return this.set(ref, existing ? `${existing}${note}` : note);
  }

  remove(ref: NoteRef): void {
    this.set(ref, "");
  }

  key(ref: NoteRef): string {
    return ref.type === "regiment" ? `regiment:${ref.id}-${ref.sub}` : `${ref.type}:${ref.id}`;
  }

  parseKey(key: string): NoteRef | undefined {
    const [type, id] = key.split(":");
    if (!(NOTE_ENTITY_TYPES as readonly string[]).includes(type) || !id) return undefined;

    if (type === "regiment") {
      const [stateId, regimentId] = id.split("-");
      if (!regimentId) return undefined;
      return { type: "regiment", id: +stateId, sub: +regimentId };
    }

    return { type: type as NoteEntityType, id: +id };
  }

  /** Every note on the map, grouped by entity type in NOTE_ENTITY_TYPES order */
  list(): NoteEntry[] {
    const entries: NoteEntry[] = [];

    for (const type of NOTE_ENTITY_TYPES) {
      for (const ref of TYPES[type].refs()) {
        const note = this.get(ref);
        if (note) entries.push({ ref, key: this.key(ref), label: this.getEntityName(ref) || this.key(ref), note });
      }
    }

    return entries;
  }

  getTexts(): string[] {
    return this.list().map(entry => entry.note);
  }

  /** The note button every entity dialog puts in its toolbar. `subject` completes "notes (legend) for ..." */
  getButton(id: string, subject: string): string {
    return `<button id="${id}" data-tip="${this.getTip(subject)}" class="icon-book"></button>`;
  }

  /** The same button as a table row action, in the `note` column every editor table gives it */
  getIcon(subject: string): string {
    return `<span data-col="note" data-tip="${this.getTip(subject)}" class="icon-book pointer"></span>`;
  }

  private getTip(subject: string): string {
    return `Edit free text notes (legend) for ${subject}`;
  }
}

export const Notes = new NotesStore();
