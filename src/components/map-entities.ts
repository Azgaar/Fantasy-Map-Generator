import type { LayerId } from "@/components/layers";
import { Controllers } from "@/controllers";
import type { Point } from "@/types/global";

export const ENTITY_TYPES = [
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

export type EntityType = (typeof ENTITY_TYPES)[number];

/** A regiment is addressed by its state (`id`) and its own index (`sub`); everything else by `id` */
export interface EntityRef {
  type: EntityType;
  id: number;
  sub?: number;
}

export interface MapEntity {
  i: number;
  name?: string;
  removed?: boolean;
  note?: string;
}

export interface EntityTarget {
  ref: EntityRef;
  entity: MapEntity;
}

/** How search presents and reveals an entity: its singular kind, icon, layers to show and zoom scale */
export interface EntityDisplay {
  kind: string;
  icon: string;
  scale: number;
  layers: LayerId[];
  highlight?: string; // selector of the drawn shape to outline
  previewNote?: boolean;
}

interface EntityDefinition {
  label: string;
  kind: string | ((id: number) => string);
  icon: string;
  scale: number;
  layers: LayerId[] | ((id: number) => LayerId[]);
  previewNote?: boolean;
  entity: (id: number, sub?: number) => MapEntity | undefined;
  name: (id: number, sub?: number) => string;
  refs: () => EntityRef[];
  element?: (id: number, sub?: number) => string;
  highlight?: (id: number, sub?: number) => string; // defaults to the element
  position?: (id: number, sub?: number) => Point | undefined;
  points?: (ref: EntityRef) => Point[];
  cells?: () => ArrayLike<number> | undefined; // per-cell assignment, the geometry of a territory
  context?: (ref: EntityRef) => string;
  open?: (ref: EntityRef) => Promise<unknown>; // opens the entity's editor instead of zooming to it
}

const ELEMENT_PATTERNS: [RegExp, EntityType][] = [
  [/^burg(?:Label)?(\d+)$/, "burg"],
  [/^marker(\d+)$/, "marker"],
  [/^state(?:Label)?(\d+)$/, "state"],
  [/^province(?:Label)?(\d+)$/, "province"],
  [/^river(?:Label)?(\d+)$/, "river"],
  [/^(?:route(?:Label)?|road)(\d+)$/, "route"],
  [/^addedLabel(\d+)$/, "addedLabel"],
  [/^(?:feature|lake)_(\d+)$/, "feature"],
  [/^zone(\d+)$/, "zone"],
  [/^journey(\d+)$/, "journey"],
  [/^market(\d+)$/, "market"],
  [/^culture(\d+)$/, "culture"],
  [/^religion(\d+)$/, "religion"],
  [/^biome(\d+)$/, "biome"]
];

const REGIMENT_PATTERN = /^regiment(\d+)-(\d+)$/;
const SEGMENT_PATTERN = /^segment(\d+)_\d+$/; // a journey segment carries its journey's note

class EntityLookup {
  private readonly types: Record<EntityType, EntityDefinition> = {
    state: {
      label: "States",
      kind: "State",
      icon: "icon-crown",
      scale: 2,
      layers: ["states"],
      entity: id => this.byId(pack.states, id),
      name: id => this.byId(pack.states, id)?.fullName || this.byId(pack.states, id)?.name || "",
      refs: () => this.refsOf("state", pack.states, true),
      element: id => `stateLabel${id}`,
      highlight: id => `#state${id}`,
      position: id => {
        const state = this.byId(pack.states, id);
        return state?.pole || this.cellPoint(state?.center);
      },
      cells: () => pack.cells.state,
      context: ref => {
        const capital = this.byId(pack.states, ref.id)?.capital;
        const name = this.byId(pack.burgs, capital)?.name;
        return name ? `Capital: ${name}` : "";
      }
    },
    province: {
      label: "Provinces",
      kind: "Province",
      icon: "icon-flag",
      scale: 4,
      layers: ["provinces"],
      entity: id => this.byId(pack.provinces, id),
      name: id => this.byId(pack.provinces, id)?.fullName || this.byId(pack.provinces, id)?.name || "",
      refs: () => this.refsOf("province", pack.provinces, true),
      element: id => `provinceLabel${id}`,
      highlight: id => `#province${id}`,
      position: id => {
        const province = this.byId(pack.provinces, id);
        return province?.pole || this.cellPoint(province?.center);
      },
      cells: () => pack.cells.province,
      context: ref => this.stateName(this.byId(pack.provinces, ref.id)?.state)
    },
    burg: {
      label: "Burgs",
      kind: "Burg",
      icon: "icon-home",
      scale: 8,
      layers: ["burgIcons", "labels"],
      entity: id => this.byId(pack.burgs, id),
      name: id => this.byId(pack.burgs, id)?.name || "",
      refs: () => this.refsOf("burg", pack.burgs, true),
      element: id => `burg${id}`,
      position: id => {
        const burg = this.byId(pack.burgs, id);
        return burg && [burg.x, burg.y];
      },
      context: ref => this.stateName(this.byId(pack.burgs, ref.id)?.state)
    },
    marker: {
      label: "Markers",
      kind: "Marker",
      icon: "icon-map-pin",
      scale: 6,
      layers: ["markers"],
      previewNote: true,
      entity: id => this.byId(pack.markers, id),
      name: id => this.byId(pack.markers, id)?.name || "",
      refs: () => this.refsOf("marker", pack.markers),
      element: id => `marker${id}`,
      position: id => {
        const marker = this.byId(pack.markers, id);
        return marker && [marker.x, marker.y];
      }
    },
    river: {
      label: "Rivers",
      kind: "River",
      icon: "icon-bezier-curve",
      scale: 4,
      layers: ["rivers"],
      entity: id => this.byId(pack.rivers, id),
      name: id => {
        const river = this.byId(pack.rivers, id);
        return river ? `${river.name} ${river.type}` : "";
      },
      refs: () => this.refsOf("river", pack.rivers, true),
      element: id => `river${id}`,
      position: id => this.chainPoint(this.byId(pack.rivers, id)?.cells),
      points: ref => (this.byId(pack.rivers, ref.id)?.cells || []).map(i => pack.cells.p[i]),
      context: ref => {
        const river = this.byId(pack.rivers, ref.id);
        const basin = this.byId(pack.rivers, river?.basin);
        return basin?.name ? `${basin.name} basin` : "";
      }
    },
    route: {
      label: "Routes",
      kind: "Route",
      icon: "icon-map-signs",
      scale: 4,
      layers: ["routes"],
      entity: id => this.byId(pack.routes, id),
      name: id => this.byId(pack.routes, id)?.name || "",
      refs: () => this.refsOf("route", pack.routes),
      element: id => `route${id}`,
      position: id => {
        const points = this.byId(pack.routes, id)?.points;
        const point = points?.[Math.floor(points.length / 2)];
        return point && [point[0], point[1]];
      },
      points: ref => (this.byId(pack.routes, ref.id)?.points || []).map(p => [p[0], p[1]]),
      context: ref => {
        const route = this.byId(pack.routes, ref.id);
        const endpoints = [route?.points[0], route?.points.at(-1)]
          .map(point => {
            const burg = point && pack.cells.burg?.[point[2]];
            return burg ? this.byId(pack.burgs, burg)?.name : undefined;
          })
          .filter(Boolean);
        return [route?.group, [...new Set(endpoints)].join(" – ")].filter(Boolean).join(" · ");
      }
    },
    feature: {
      label: "Geographical features",
      kind: id => this.byId(pack.features, id)?.type || "Feature",
      icon: "icon-globe",
      scale: 3,
      layers: id => [this.byId(pack.features, id)?.type === "lake" ? "lakes" : "coastline"],
      entity: id => this.byId(pack.features, id),
      name: id => {
        const feature = this.byId(pack.features, id);
        return feature ? feature.name || `${feature.subtype || feature.type} ${id}` : "";
      },
      refs: () => this.refsOf("feature", pack.features, true),
      element: id => `feature_${id}`,
      highlight: id => `#map use[data-f='${id}']`,
      position: id => this.cellPoint(this.byId(pack.features, id)?.firstCell),
      points: ref => (this.byId(pack.features, ref.id)?.vertices || []).map(i => pack.vertices.p[i]),
      context: ref => this.byId(pack.features, ref.id)?.subtype || ""
    },
    zone: {
      label: "Zones",
      kind: "Zone",
      icon: "icon-draw-polygon",
      scale: 3,
      layers: ["zones"],
      entity: id => this.byId(pack.zones, id),
      name: id => this.byId(pack.zones, id)?.name || "",
      refs: () => this.refsOf("zone", pack.zones),
      element: id => `zone${id}`,
      position: id => this.chainPoint(this.byId(pack.zones, id)?.cells),
      points: ref => (this.byId(pack.zones, ref.id)?.cells || []).map(i => pack.cells.p[i]),
      context: ref => this.byId(pack.zones, ref.id)?.type || ""
    },
    journey: {
      label: "Journeys",
      kind: "Journey",
      icon: "icon-compass",
      scale: 4,
      layers: ["journeys"],
      entity: id => this.byId(pack.journeys, id),
      name: id => this.byId(pack.journeys, id)?.name || "",
      refs: () => this.refsOf("journey", pack.journeys), // the first journey is 0
      element: id => `journey${id}`,
      position: id => {
        const points = this.byId(pack.journeys, id)?.segments?.flatMap(segment => segment.points) || [];
        const point = points[Math.floor(points.length / 2)];
        return point && [point[0], point[1]];
      },
      points: ref =>
        (this.byId(pack.journeys, ref.id)?.segments || []).flatMap(s => s.points.map(p => [p[0], p[1]] as Point)),
      context: ref => {
        const count = this.byId(pack.journeys, ref.id)?.segments.length;
        return count ? `${count} ${count === 1 ? "segment" : "segments"}` : "";
      }
    },
    market: {
      label: "Markets",
      kind: "Market",
      icon: "icon-store",
      scale: 6,
      layers: ["markets"],
      entity: id => this.byId(pack.markets, id),
      name: id =>
        this.byId(pack.markets, id)?.name ||
        this.byId(pack.burgs, this.byId(pack.markets, id)?.centerBurgId ?? -1)?.name ||
        "",
      refs: () => this.refsOf("market", pack.markets, true),
      element: id => `market${id}`,
      position: id => {
        const center = this.byId(pack.burgs, this.byId(pack.markets, id)?.centerBurgId ?? -1);
        return center && [center.x, center.y];
      },
      context: ref => {
        const burg = this.byId(pack.markets, ref.id)?.centerBurgId;
        return this.stateName(this.byId(pack.burgs, burg)?.state);
      }
    },
    regiment: {
      label: "Regiments",
      kind: "Regiment",
      icon: "icon-shield-alt",
      scale: 8,
      layers: ["military"],
      entity: (id, sub) => this.byId(this.byId(pack.states, id)?.military, sub ?? -1),
      name: (id, sub) => this.byId(this.byId(pack.states, id)?.military, sub ?? -1)?.name || "",
      refs: () =>
        (pack.states || []).flatMap(state =>
          state?.i && !state.removed
            ? (state.military || []).map(regiment => ({ type: "regiment" as const, id: state.i, sub: regiment.i }))
            : []
        ),
      element: (id, sub) => `regiment${id}-${sub}`,
      position: (id, sub) => {
        const regiment = this.byId(this.byId(pack.states, id)?.military, sub ?? -1);
        return regiment && [regiment.x, regiment.y];
      },
      context: ref => this.stateName(ref.id)
    },
    addedLabel: {
      label: "Labels",
      kind: "Label",
      icon: "icon-font",
      scale: 8,
      layers: ["labels"],
      entity: id => this.byId(pack.addedLabels, id),
      name: id => this.byId(pack.addedLabels, id)?.label?.text || "",
      refs: () => this.refsOf("addedLabel", pack.addedLabels, true),
      element: id => `addedLabel${id}`,
      position: id => {
        const label = this.byId(pack.addedLabels, id);
        return label && [label.x, label.y];
      },
      context: () => "Map text"
    },
    culture: {
      label: "Cultures",
      kind: "Culture",
      icon: "icon-users",
      scale: 2,
      layers: ["cultures"],
      entity: id => this.byId(pack.cultures, id),
      name: id => this.byId(pack.cultures, id)?.name || "",
      refs: () => this.refsOf("culture", pack.cultures, true),
      highlight: id => `#culture${id}`,
      cells: () => pack.cells.culture,
      context: ref => this.byId(pack.cultures, ref.id)?.type || ""
    },
    religion: {
      label: "Religions",
      kind: "Religion",
      icon: "icon-place-of-worship",
      scale: 2,
      layers: ["religions"],
      entity: id => this.byId(pack.religions, id),
      name: id => this.byId(pack.religions, id)?.name || "",
      refs: () => this.refsOf("religion", pack.religions, true),
      highlight: id => `#religion${id}`,
      cells: () => pack.cells.religion,
      context: ref => {
        const religion = this.byId(pack.religions, ref.id);
        const culture = this.byId(pack.cultures, religion?.culture)?.name;
        return [religion?.type, culture].filter(Boolean).join(" · ");
      }
    },
    biome: {
      label: "Biomes",
      kind: "Biome",
      icon: "icon-leaf",
      scale: 2,
      layers: ["biomes"],
      entity: id => this.byId(pack.biomes, id),
      name: id => this.byId(pack.biomes, id)?.name || "",
      refs: () => this.refsOf("biome", pack.biomes),
      highlight: id => `#biome${id}`,
      cells: () => pack.cells.biome
    },
    good: {
      label: "Goods",
      kind: "Good",
      icon: "icon-tags",
      scale: 6,
      layers: ["goods"],
      entity: id => this.byId(pack.goods, id),
      name: id => this.byId(pack.goods, id)?.name || "",
      refs: () => this.refsOf("good", pack.goods, true),
      position: id => {
        const points = this.goodPoints(id);
        return points[Math.floor(points.length / 2)];
      },
      points: ref => this.goodPoints(ref.id),
      context: ref => this.byId(pack.goods, ref.id)?.tags?.join(", ") || "",
      open: ref => Controllers.GoodsEditor.open(ref.id)
    }
  };

  get(ref: EntityRef): MapEntity | undefined {
    const entity = this.types[ref.type].entity(ref.id, ref.sub);
    return entity && !entity.removed ? entity : undefined;
  }

  /** Every live entity of the type; `located` keeps only those with a place on the map or an editor to open */
  collect(type: EntityType, { located = false } = {}): EntityTarget[] {
    const { refs, cells, open } = this.types[type];
    const assigned = located && cells ? new Set(Array.from(cells() ?? [])) : undefined; // one pass, not one per territory
    const isLocated = (ref: EntityRef): boolean => {
      if (open) return true;
      if (assigned) return assigned.has(ref.id) || Boolean(this.getPosition(ref));
      return this.getPoints(ref).length > 0;
    };
    return refs().flatMap(ref => {
      const entity = this.get(ref);
      return entity && (!located || isLocated(ref)) ? [{ ref, entity }] : [];
    });
  }

  getName(ref: EntityRef): string {
    return this.types[ref.type].name(ref.id, ref.sub);
  }

  getTypeLabel(type: EntityType): string {
    return this.types[type].label;
  }

  getContext(ref: EntityRef): string {
    return this.types[ref.type].context?.(ref) || "";
  }

  /** The pending editor open, or undefined when the type has none and should be revealed on the map instead */
  open(ref: EntityRef): Promise<unknown> | undefined {
    return this.types[ref.type].open?.(ref);
  }

  getPosition(ref: EntityRef): Point | undefined {
    return this.types[ref.type].position?.(ref.id, ref.sub);
  }

  /** Full geometry when the type has one, otherwise its anchor point */
  getPoints(ref: EntityRef): Point[] {
    const { points, cells } = this.types[ref.type];
    const geometry = points?.(ref) ?? (cells ? this.cellPoints(cells() ?? [], ref.id) : []);
    const position = geometry.length ? undefined : this.getPosition(ref);
    return (position ? [position] : geometry).filter(point => point?.every(Number.isFinite));
  }

  getElementId(ref: EntityRef): string | undefined {
    return this.types[ref.type].element?.(ref.id, ref.sub);
  }

  getDisplay(ref: EntityRef): EntityDisplay {
    const { kind, icon, scale, layers, previewNote, element, highlight } = this.types[ref.type];
    const elementId = element?.(ref.id, ref.sub);
    return {
      kind: typeof kind === "function" ? kind(ref.id) : kind,
      icon,
      scale,
      layers: typeof layers === "function" ? layers(ref.id) : layers,
      highlight: highlight?.(ref.id, ref.sub) || (elementId ? `#${elementId}` : undefined),
      previewNote
    };
  }

  resolveElement(elementId: string | null | undefined): EntityRef | undefined {
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

  resolveTarget(target: Element | null): EntityRef | undefined {
    for (
      let element = target;
      element && element.id !== "viewbox" && element.id !== "map";
      element = element.parentElement
    ) {
      const labelType = element.getAttribute("data-label-type");
      const type = labelType === "added" ? "addedLabel" : labelType;
      const id = element.getAttribute("data-id");
      if (type && id !== null && (ENTITY_TYPES as readonly string[]).includes(type)) {
        const ref = this.parseKey(`${type}:${id}`);
        if (ref) return ref;
      }
      if (id !== null && element.closest("#burgIcons")) {
        const ref = this.parseKey(`burg:${id}`);
        if (ref) return ref;
      }
      const feature = element.getAttribute("data-f");
      if (feature !== null && element.closest("#lakes, #coastline")) {
        const ref = this.parseKey(`feature:${feature}`);
        if (ref) return ref;
      }
      const ref = this.resolveElement(element.id);
      if (ref) return ref;
    }
    return undefined;
  }

  key(ref: EntityRef): string {
    return ref.type === "regiment" ? `regiment:${ref.id}-${ref.sub}` : `${ref.type}:${ref.id}`;
  }

  parseKey(key: string): EntityRef | undefined {
    const match = /^(\w+):(\d+)(?:-(\d+))?$/.exec(key);
    if (!match || !(ENTITY_TYPES as readonly string[]).includes(match[1])) return undefined;
    const type = match[1] as EntityType;
    if ((type === "regiment") !== (match[3] !== undefined)) return undefined;
    const id = Number(match[2]);
    const sub = match[3] === undefined ? undefined : Number(match[3]);
    if (!Number.isSafeInteger(id) || (sub !== undefined && !Number.isSafeInteger(sub))) return undefined;
    return sub === undefined ? { type, id } : { type, id, sub };
  }

  private byId<T extends { i: number }>(collection: T[] | undefined, id: number | undefined): T | undefined {
    if (!collection || id === undefined) return undefined;
    const direct = collection[id];
    if (direct?.i === id) return direct;
    return collection.find(entity => entity?.i === id);
  }

  private refsOf(type: EntityType, collection: MapEntity[] | undefined, excludeZero = false): EntityRef[] {
    if (!collection) return [];
    return collection
      .filter(entity => entity && Number.isInteger(entity.i) && (!excludeZero || entity.i !== 0) && !entity.removed)
      .map(entity => ({ type, id: entity.i }));
  }

  private stateName(id?: number): string {
    if (id === 0) return "Independent";
    const state = this.byId(pack.states, id);
    return state?.fullName || state?.name || "";
  }

  private cellPoint(cellId: number | undefined): Point | undefined {
    return cellId === undefined ? undefined : pack.cells?.p?.[cellId];
  }

  /** The middle of a cell chain: a river, a route or a zone is zoomed to its center, not to its start */
  private chainPoint(cells: number[] | undefined): Point | undefined {
    if (!cells?.length) return undefined;
    return this.cellPoint(cells[Math.floor(cells.length / 2)]);
  }

  /** Raw goods sit on their resource cells; manufactured-only goods live at the burgs producing them */
  private goodPoints(id: number): Point[] {
    const cells = pack.cells.good ? this.cellPoints(pack.cells.good, id) : [];
    if (cells.length) return cells;
    return (pack.burgs || [])
      .filter(burg => burg?.i && !burg.removed && burg.production?.some(r => "goodId" in r && r.goodId === id))
      .map(burg => [burg.x, burg.y]);
  }

  private cellPoints(assignments: ArrayLike<number>, id: number): Point[] {
    return Array.from(pack.cells.i)
      .filter(i => assignments[i] === id)
      .map(i => pack.cells.p[i]);
  }
}

export const MapEntities = new EntityLookup();
