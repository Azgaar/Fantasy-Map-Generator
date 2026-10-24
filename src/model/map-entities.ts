import { FEATURE_SUBTYPE_LABELS } from "@/data/id-labels";
import { Pack } from "@/model/graph/pack-generator";
import type { Burg } from "@/model/political/burgs-generator";
import type { Regiment } from "@/model/political/military-generator";
import { Names } from "@/model/society/names-generator";
import type { LayerId } from "@/renderers/layers";
import type { Point } from "@/types/global";
import { t } from "@/utils/i18n";
import { capitalize } from "@/utils/string-utils";

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

export const RECORD_TYPES = ["cell", "ice", "relief", "measurer", "deal", "transport", "nameBase"] as const;

export type EntityType = (typeof ENTITY_TYPES)[number] | (typeof RECORD_TYPES)[number];

export const isEntityType = (value: string): value is EntityType =>
  (ENTITY_TYPES as readonly string[]).includes(value) || (RECORD_TYPES as readonly string[]).includes(value);

type EntityEditor = "GoodsEditor" | "MeasurersEditor" | "TransportEditor" | "NamesbaseEditor";

export interface EntityRef {
  type: EntityType;
  id: number;
  sub?: number;
}

interface MapEntity {
  i: number;
  name?: string;
  removed?: boolean;
  note?: string;
  tags?: string[];
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

interface EntityCollection {
  field: string;
  indexed: boolean;
  references?: Record<string, EntityType>; // fields holding the id (or ids) of another entity, by that entity's type
}

interface EntityDefinition {
  label: string;
  kind: string | ((id: number) => string);
  icon: string;
  scale: number;
  layers: LayerId[] | ((id: number) => LayerId[]);
  previewNote?: boolean;
  /** the `pack` list holding the type, keyed by `i`; an indexed list keeps `i` equal to the array index */
  collection?: EntityCollection;
  entity?: (id: number, sub?: number) => MapEntity | undefined; // for types without a collection
  name: (id: number, sub?: number) => string;
  refs: () => EntityRef[];
  element?: (id: number, sub?: number) => string;
  highlight?: (id: number, sub?: number) => string; // defaults to the element
  position?: (id: number, sub?: number) => Point | undefined;
  points?: (ref: EntityRef) => Point[];
  cells?: () => ArrayLike<number> | undefined; // per-cell assignment, the geometry of a territory
  isAt?: (ref: EntityRef, cell: number) => boolean; // whether a cell holds the entity, for types not assigned through `cells`
  context?: (ref: EntityRef) => string;
  editor?: EntityEditor; // the controller opened instead of zooming to the entity
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
/** Layers whose elements carry their entity's id in a data attribute */
const DATA_TARGETS: [layer: string, attribute: string, type: EntityType][] = [
  ["#burgIcons, #goodsBurgs", "data-id", "burg"],
  ["#burgEmblems", "data-i", "burg"],
  ["#provinceEmblems", "data-i", "province"],
  ["#stateEmblems", "data-i", "state"],
  ["#goodsIcons", "data-i", "good"],
  ["#ice", "data-id", "ice"],
  ["#terrain", "data-id", "relief"],
  ["#lakes, #coastline", "data-f", "feature"]
];
const REGIMENT_PATTERN = /^regiment(\d+)-(\d+)$/;
const SEGMENT_PATTERN = /^segment(\d+)_\d+$/; // a journey segment carries its journey's note

class EntityLookup {
  private readonly types: Record<EntityType, EntityDefinition> = {
    state: {
      label: t("States"),
      kind: t("State"),
      icon: "icon-crown",
      scale: 2,
      layers: ["states"],
      collection: {
        field: "states",
        indexed: true,
        references: { culture: "culture", capital: "burg", provinces: "province" }
      },
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
      label: t("Provinces"),
      kind: t("Province"),
      icon: "icon-flag",
      scale: 4,
      layers: ["provinces"],
      collection: { field: "provinces", indexed: true, references: { state: "state", burg: "burg" } },
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
      label: t("Burgs"),
      kind: t("Burg"),
      icon: "icon-home",
      scale: 8,
      layers: ["burgIcons", "labels"],
      collection: {
        field: "burgs",
        indexed: true,
        references: { culture: "culture", state: "state", port: "feature" }
      },
      name: id => this.byId(pack.burgs, id)?.name || "",
      refs: () => this.refsOf("burg", pack.burgs, true),
      element: id => `burg${id}`,
      isAt: (ref, cell) => pack.cells.burg[cell] === ref.id,
      position: id => {
        const burg = this.byId(pack.burgs, id);
        return burg && [burg.x, burg.y];
      },
      context: ref => this.stateName(this.byId(pack.burgs, ref.id)?.state)
    },
    marker: {
      label: t("Markers"),
      kind: t("Marker"),
      icon: "icon-map-pin",
      scale: 6,
      layers: ["markers"],
      previewNote: true,
      collection: { field: "markers", indexed: false },
      name: id => this.byId(pack.markers, id)?.name || "",
      refs: () => this.refsOf("marker", pack.markers),
      element: id => `marker${id}`,
      isAt: (ref, cell) => this.byId(pack.markers, ref.id)?.cell === cell,
      position: id => {
        const marker = this.byId(pack.markers, id);
        return marker && [marker.x, marker.y];
      }
    },
    river: {
      label: t("Rivers"),
      kind: t("River"),
      icon: "icon-bezier-curve",
      scale: 4,
      layers: ["rivers"],
      collection: { field: "rivers", indexed: false, references: { parent: "river", basin: "river" } },
      name: id => {
        const river = this.byId(pack.rivers, id);
        return river ? `${river.name} ${river.type}` : "";
      },
      refs: () => this.refsOf("river", pack.rivers, true),
      element: id => `river${id}`,
      isAt: (ref, cell) =>
        pack.cells.r[cell] === ref.id || Boolean(this.byId(pack.rivers, ref.id)?.cells?.includes(cell)), // a confluence cell holds one river
      position: id => this.chainPoint(this.byId(pack.rivers, id)?.cells),
      points: ref => (this.byId(pack.rivers, ref.id)?.cells || []).map(i => pack.cells.p[i]),
      context: ref => {
        const river = this.byId(pack.rivers, ref.id);
        const basin = this.byId(pack.rivers, river?.basin);
        return basin?.name ? `${basin.name} basin` : "";
      }
    },
    route: {
      label: t("Routes"),
      kind: t("Route"),
      icon: "icon-map-signs",
      scale: 4,
      layers: ["routes"],
      collection: { field: "routes", indexed: false },
      name: id => this.byId(pack.routes, id)?.name || "",
      refs: () => this.refsOf("route", pack.routes),
      element: id => `route${id}`,
      isAt: (ref, cell) => Object.values(pack.cells.routes?.[cell] || {}).includes(ref.id),
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
      label: t("Geographical features"),
      kind: id => {
        const type = this.byId(pack.features, id)?.type;
        return type ? (FEATURE_SUBTYPE_LABELS[type] ?? type) : t("Feature");
      },
      icon: "icon-globe",
      scale: 3,
      layers: id => [this.byId(pack.features, id)?.type === "lake" ? "lakes" : "coastline"],
      collection: { field: "features", indexed: true },
      name: id => {
        const feature = this.byId(pack.features, id);
        return feature ? feature.name || `${feature.subtype || feature.type} ${id}` : "";
      },
      refs: () => this.refsOf("feature", pack.features, true),
      element: id => `feature_${id}`,
      isAt: (ref, cell) => pack.cells.f[cell] === ref.id,
      highlight: id => `#map use[data-f='${id}']`,
      position: id => this.cellPoint(this.byId(pack.features, id)?.firstCell),
      points: ref => (this.byId(pack.features, ref.id)?.vertices || []).map(i => pack.vertices.p[i]),
      context: ref => this.byId(pack.features, ref.id)?.subtype || ""
    },
    zone: {
      label: t("Zones"),
      kind: t("Zone"),
      icon: "icon-draw-polygon",
      scale: 3,
      layers: ["zones"],
      collection: { field: "zones", indexed: false },
      name: id => this.byId(pack.zones, id)?.name || "",
      refs: () => this.refsOf("zone", pack.zones),
      element: id => `zone${id}`,
      isAt: (ref, cell) => Boolean(this.byId(pack.zones, ref.id)?.cells?.includes(cell)),
      position: id => this.chainPoint(this.byId(pack.zones, id)?.cells),
      points: ref => (this.byId(pack.zones, ref.id)?.cells || []).map(i => pack.cells.p[i]),
      context: ref => this.byId(pack.zones, ref.id)?.type || ""
    },
    journey: {
      label: t("Journeys"),
      kind: t("Journey"),
      icon: "icon-compass",
      scale: 4,
      layers: ["journeys"],
      collection: { field: "journeys", indexed: false },
      entity: (id, sub) => this.journey(id, sub),
      name: (id, sub) => {
        const journey = this.byId(pack.journeys, id);
        if (sub === undefined) return journey?.name || "";
        const segment = journey?.segments?.find(s => s.i === sub);
        if (!segment) return journey?.name || "";
        return journey?.name ? `${journey.name} — ${segment.name || `${t("Segment")} ${sub + 1}`}` : segment.name || "";
      },
      refs: () => this.refsOf("journey", pack.journeys), // the first journey is 0
      element: (id, sub) => (sub !== undefined ? `segment${id}_${sub}` : `journey${id}`),
      isAt: (ref, cell) => {
        const journey = this.byId(pack.journeys, ref.id);
        if (!journey) return false;
        const segments = ref.sub !== undefined ? journey.segments.filter(s => s.i === ref.sub) : journey.segments || [];
        return segments.some(segment => segment.points.some(p => p[2] === cell));
      },
      position: (id, sub) => {
        const journey = this.byId(pack.journeys, id);
        const segments = sub !== undefined ? journey?.segments?.filter(s => s.i === sub) : journey?.segments || [];
        const points = segments?.flatMap(segment => segment.points) || [];
        const point = points[Math.floor(points.length / 2)];
        return point && [point[0], point[1]];
      },
      points: ref => {
        const journey = this.byId(pack.journeys, ref.id);
        if (!journey) return [];
        const segments = ref.sub !== undefined ? journey.segments.filter(s => s.i === ref.sub) : journey.segments || [];
        return segments.flatMap(s => s.points.map(p => [p[0], p[1]] as Point));
      },
      context: ref => {
        if (ref.sub !== undefined) {
          const journey = this.byId(pack.journeys, ref.id);
          const segment = journey?.segments?.find(s => s.i === ref.sub);
          return segment?.name || "";
        }
        const count = this.byId(pack.journeys, ref.id)?.segments.length;
        return count ? `${count} ${count === 1 ? "segment" : "segments"}` : "";
      }
    },
    market: {
      label: t("Markets"),
      kind: t("Market"),
      icon: "icon-store",
      scale: 6,
      layers: ["markets"],
      collection: { field: "markets", indexed: false, references: { centerBurgId: "burg" } },
      name: id =>
        this.byId(pack.markets, id)?.name ||
        this.byId(pack.burgs, this.byId(pack.markets, id)?.centerBurgId ?? -1)?.name ||
        "",
      refs: () => this.refsOf("market", pack.markets, true),
      element: id => `market${id}`,
      isAt: (ref, cell) => pack.cells.market?.[cell] === ref.id,
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
      label: t("Regiments"),
      kind: t("Regiment"),
      icon: "icon-shield-alt",
      scale: 8,
      layers: ["military"],
      entity: (id, sub) => this.regiment(id, sub),
      name: (id, sub) => this.regiment(id, sub)?.name || "",
      refs: () =>
        (pack.states || []).flatMap(state =>
          state?.i && !state.removed
            ? (state.military || []).map(regiment => ({ type: "regiment" as const, id: state.i, sub: regiment.i }))
            : []
        ),
      element: (id, sub) => `regiment${id}-${sub}`,
      isAt: (ref, cell) => {
        const regiment = this.regiment(ref.id, ref.sub);
        return regiment ? Pack.findCell(regiment.x, regiment.y) === cell : false; // `cell` stays put when it moves
      },
      position: (id, sub) => {
        const regiment = this.regiment(id, sub);
        return regiment && [regiment.x, regiment.y];
      },
      context: ref => this.stateName(ref.id)
    },
    addedLabel: {
      label: t("Labels"),
      kind: t("Label"),
      icon: "icon-font",
      scale: 8,
      layers: ["labels"],
      collection: { field: "addedLabels", indexed: false },
      name: id => this.byId(pack.addedLabels, id)?.label?.text || "",
      refs: () => this.refsOf("addedLabel", pack.addedLabels, true),
      element: id => `addedLabel${id}`,
      position: id => {
        const label = this.byId(pack.addedLabels, id);
        return label && [label.x, label.y];
      },
      context: () => t("Map text")
    },
    culture: {
      label: t("Cultures"),
      kind: t("Culture"),
      icon: "icon-users",
      scale: 2,
      layers: ["cultures"],
      collection: { field: "cultures", indexed: true, references: { origins: "culture" } },
      name: id => this.byId(pack.cultures, id)?.name || "",
      refs: () => this.refsOf("culture", pack.cultures, true),
      highlight: id => `#culture${id}`,
      cells: () => pack.cells.culture,
      context: ref => this.byId(pack.cultures, ref.id)?.type || ""
    },
    religion: {
      label: t("Religions"),
      kind: t("Religion"),
      icon: "icon-place-of-worship",
      scale: 2,
      layers: ["religions"],
      collection: {
        field: "religions",
        indexed: true,
        references: { culture: "culture", origins: "religion" }
      },
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
      label: t("Biomes"),
      kind: t("Biome"),
      icon: "icon-leaf",
      scale: 2,
      layers: ["biomes"],
      collection: { field: "biomes", indexed: true },
      name: id => this.byId(pack.biomes, id)?.name || "",
      refs: () => this.refsOf("biome", pack.biomes),
      highlight: id => `#biome${id}`,
      cells: () => pack.cells.biome
    },
    good: {
      label: t("Goods"),
      kind: t("Good"),
      icon: "icon-tags",
      scale: 6,
      layers: ["goods"],
      collection: { field: "goods", indexed: false },
      name: id => this.byId(pack.goods, id)?.name || "",
      refs: () => this.refsOf("good", pack.goods, true),
      isAt: (ref, cell) =>
        pack.cells.good?.[cell] === ref.id || this.produces(this.byId(pack.burgs, pack.cells.burg?.[cell]), ref.id),
      position: id => {
        const points = this.goodPoints(id);
        return points[Math.floor(points.length / 2)];
      },
      points: ref => this.goodPoints(ref.id),
      context: ref => this.byId(pack.goods, ref.id)?.tags?.join(", ") || "",
      editor: "GoodsEditor"
    },
    cell: {
      label: t("Cells"),
      kind: t("Cell"),
      icon: "icon-dot-circled",
      scale: 8,
      layers: [],
      entity: id => (id >= 0 && id < (pack.cells?.i?.length ?? 0) ? { i: id } : undefined),
      name: id => `Cell ${id}`,
      refs: () => Array.from(pack.cells?.i ?? [], id => ({ type: "cell" as const, id })),
      position: id => this.cellPoint(id),
      context: ref => this.byId(pack.biomes, pack.cells.biome?.[ref.id])?.name || ""
    },
    ice: {
      label: t("Ice"),
      kind: id => (this.byId(pack.ice, id)?.type === "glacier" ? t("Glacier") : t("Iceberg")),
      icon: "icon-temperature-low",
      scale: 4,
      layers: ["ice"],
      entity: id => this.byId(pack.ice, id),
      name: id => {
        const ice = this.byId(pack.ice, id);
        return ice ? `${ice.type === "glacier" ? "Glacier" : "Iceberg"} ${id}` : "";
      },
      refs: () => this.refsOf("ice", pack.ice), // ice 0 is real
      highlight: id => `#ice [data-id="${id}"]`,
      points: ref => {
        const ice = this.byId(pack.ice, ref.id);
        const [dx, dy] = ice?.offset ?? [0, 0];
        return (ice?.points ?? []).map(([x, y]) => [x + dx, y + dy]);
      }
    },
    relief: {
      label: t("Relief icons"),
      kind: t("Relief icon"),
      icon: "icon-mountain",
      scale: 8,
      layers: ["relief"],
      entity: id => (pack.relief?.[id] ? { i: id } : undefined),
      name: id => {
        const icon = pack.relief?.[id];
        return icon && "type" in icon ? capitalize(icon.type) : t("Relief icon");
      },
      refs: () => (pack.relief ?? []).map((_, id) => ({ type: "relief" as const, id })),
      position: id => {
        const icon = pack.relief?.[id];
        return icon && [icon.x, icon.y];
      }
    },
    measurer: {
      label: t("Measurers"),
      kind: t("Measurer"),
      icon: "icon-ruler",
      scale: 4,
      layers: ["rulers"],
      entity: id => (pack.measurers?.[id] ? { i: id } : undefined),
      name: id => pack.measurers?.[id]?.type || "",
      refs: () => (pack.measurers ?? []).map((_, id) => ({ type: "measurer" as const, id })),
      points: ref => pack.measurers?.[ref.id]?.points ?? [],
      editor: "MeasurersEditor"
    },
    deal: {
      label: t("Deals"),
      kind: t("Deal"),
      icon: "icon-exchange",
      scale: 6,
      layers: ["markets"],
      entity: id => this.byId(pack.deals, id),
      name: id => {
        const deal = this.byId(pack.deals, id);
        return deal ? `${this.byId(pack.goods, deal.good)?.name || "Goods"} deal` : "";
      },
      refs: () => this.refsOf("deal", pack.deals),
      points: ref => {
        const deal = this.byId(pack.deals, ref.id);
        if (!deal) return [];
        const parties = [
          this.getPosition({ type: deal.sellerType, id: deal.seller }),
          this.getPosition({ type: deal.buyerType, id: deal.buyer })
        ];
        return parties.filter((point): point is Point => Boolean(point));
      },
      context: ref => {
        const deal = this.byId(pack.deals, ref.id);
        return deal
          ? `${this.getName({ type: deal.sellerType, id: deal.seller })} → ${this.getName({ type: deal.buyerType, id: deal.buyer })}`
          : "";
      }
    },
    transport: {
      label: t("Transports"),
      kind: t("Transport"),
      icon: "icon-ship",
      scale: 1,
      layers: [],
      entity: id => this.byId(options.map.transports, id),
      name: id => this.byId(options.map.transports, id)?.name || "",
      refs: () => this.refsOf("transport", options.map.transports),
      context: ref => this.byId(options.map.transports, ref.id)?.domain || "",
      editor: "TransportEditor"
    },
    nameBase: {
      label: t("Name bases"),
      kind: t("Name base"),
      icon: "icon-book",
      scale: 1,
      layers: [],
      entity: id => this.byId(Names.nameBases, id),
      name: id => this.byId(Names.nameBases, id)?.name || "",
      refs: () => this.refsOf("nameBase", Names.nameBases),
      editor: "NamesbaseEditor"
    }
  };

  get(ref: EntityRef): MapEntity | undefined {
    const { collection, entity: find } = this.types[ref.type];
    const entity =
      ref.sub !== undefined && find
        ? find(ref.id, ref.sub)
        : collection
          ? this.byId(this.list(collection.field), ref.id)
          : find?.(ref.id, ref.sub);
    return entity && !entity.removed ? entity : undefined;
  }

  /** The types kept in a `pack` list, with that list */
  collections(): ({ type: EntityType } & EntityCollection)[] {
    return Object.entries(this.types).flatMap(([type, { collection }]) =>
      collection ? [{ type: type as EntityType, ...collection }] : []
    );
  }

  /** The type of entity a field of the type refers to, such as a burg's `state` */
  referenceType(type: string, field: string): EntityType | undefined {
    return isEntityType(type) ? this.types[type].collection?.references?.[field] : undefined;
  }

  /** A `pack` list by its field, of the live map or another one such as a proposal's draft */
  list(field: string, map = pack): MapEntity[] | undefined {
    return (map as unknown as Record<string, MapEntity[] | undefined>)[field];
  }

  /** Every live entity of the type; `located` keeps only those with a place on the map or an editor to open */
  collect(type: EntityType, { located = false } = {}): EntityTarget[] {
    const { refs, cells, editor } = this.types[type];
    const assigned = located && cells ? new Set(Array.from(cells() ?? [])) : undefined; // one pass, not one per territory
    const isLocated = (ref: EntityRef): boolean => {
      if (editor) return true;
      if (assigned) return assigned.has(ref.id) || Boolean(this.getPosition(ref));
      return this.getPoints(ref).length > 0;
    };
    return refs().flatMap(ref => {
      const entity = this.get(ref);
      return entity && (!located || isLocated(ref)) ? [{ ref, entity }] : [];
    });
  }

  /** Every live entity a cell holds or belongs to, in type order */
  at(cell: number): EntityRef[] {
    return Object.values(this.types).flatMap(({ cells, isAt, refs }) => {
      const assigned = cells?.()?.[cell];
      const holds = cells ? (ref: EntityRef) => ref.id === assigned : isAt;
      return holds ? refs().filter(ref => holds(ref, cell)) : [];
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

  getEditor(type: EntityType): EntityEditor | undefined {
    return this.types[type].editor;
  }

  getPosition(ref: EntityRef): Point | undefined {
    return this.types[ref.type].position?.(ref.id, ref.sub);
  }

  /** One point to mark the entity by: its position, or the first point of its geometry */
  getAnchor(ref: EntityRef): Point | undefined {
    return this.getPosition(ref) ?? this.getPoints(ref)[0];
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
      for (const [layer, attribute, type] of DATA_TARGETS) {
        const value = element.getAttribute(attribute);
        const ref = value !== null && element.closest(layer) ? this.parseKey(`${type}:${value}`) : undefined;
        if (ref) return ref;
      }
      const ruler = element.parentElement?.id === "ruler" ? element.parentElement : null; // measurers are drawn in order
      if (ruler) return { type: "measurer", id: Array.from(ruler.children).indexOf(element) };
      const ref = this.resolveElement(element.id);
      if (ref) return ref;
    }
    return undefined;
  }

  key(ref: EntityRef): string {
    return ref.sub !== undefined ? `${ref.type}:${ref.id}-${ref.sub}` : `${ref.type}:${ref.id}`;
  }

  parseKey(key: string): EntityRef | undefined {
    const match = /^(\w+):(\d+)(?:-(\d+))?$/.exec(key);
    if (!match || !isEntityType(match[1])) return undefined;
    const type: EntityType = match[1];
    const hasSub = match[3] !== undefined;
    if (type === "regiment" && !hasSub) return undefined;
    if (type !== "regiment" && type !== "journey" && hasSub) return undefined;
    const id = Number(match[2]);
    const sub = match[3] === undefined ? undefined : Number(match[3]);
    if (!Number.isSafeInteger(id) || (sub !== undefined && !Number.isSafeInteger(sub))) return undefined;
    return sub === undefined ? { type, id } : { type, id, sub };
  }

  /** The ref of a key whose entity is on the map */
  resolveKey(key: unknown): EntityRef | undefined {
    const ref = typeof key === "string" ? this.parseKey(key) : undefined;
    return ref && this.get(ref) ? ref : undefined;
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
    return (pack.burgs || []).filter(burg => this.produces(burg, id)).map(burg => [burg.x, burg.y]);
  }

  private produces(burg: Burg | undefined, goodId: number): boolean {
    return Boolean(burg?.i && !burg.removed && burg.production?.some(r => "goodId" in r && r.goodId === goodId));
  }

  private regiment(stateId: number, regimentId?: number): Regiment | undefined {
    return this.byId(this.byId(pack.states, stateId)?.military, regimentId ?? -1);
  }

  private journey(journeyId: number, segmentId?: number): MapEntity | undefined {
    const journey = this.byId(pack.journeys, journeyId);
    if (!journey) return undefined;
    if (segmentId === undefined) return journey;
    return journey.segments?.find(s => s.i === segmentId);
  }

  private cellPoints(assignments: ArrayLike<number>, id: number): Point[] {
    return Array.from(pack.cells.i)
      .filter(i => assignments[i] === id)
      .map(i => pack.cells.p[i]);
  }
}

export const MapEntities = new EntityLookup();
