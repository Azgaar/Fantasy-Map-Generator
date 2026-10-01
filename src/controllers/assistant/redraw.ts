import type { LayerId } from "@/components/layers";
import type { ChangeRow } from "@/services/assistant/chats";

// The layers a Change redraws follow from the data it touched, not from the operations that made it

const TERRITORY: LayerId[] = ["states", "borders", "provinces", "burgIcons", "labels", "military", "emblems"];
const PROVINCES: LayerId[] = ["provinces", "borders", "labels", "emblems"];
const BURG_PLACE: LayerId[] = ["burgIcons", "labels", "emblems", "population"];
const NAMES = { name: ["labels"], fullName: ["labels"], formName: ["labels"], form: ["labels"] } as const;

/** By entity type, then by the changed field's first segment: "" is the entity added or removed, "*" any other field */
const ENTITY_LAYERS: Record<string, Record<string, readonly LayerId[]>> = {
  burg: {
    "": [...BURG_PLACE, "goods"],
    ...NAMES,
    group: ["burgIcons", "labels"],
    capital: ["burgIcons", "labels"],
    port: ["burgIcons"],
    x: BURG_PLACE,
    y: BURG_PLACE,
    population: ["population"],
    production: ["goods"]
  },
  state: { "": TERRITORY, ...NAMES, color: ["states", "military"], military: ["military"] },
  province: { "": PROVINCES, ...NAMES, name: ["provinces", "labels"], color: ["provinces"], center: ["emblems"] },
  culture: { "": ["cultures"], color: ["cultures"] },
  religion: { "": ["religions"], color: ["religions"] },
  biome: { "": ["biomes"], color: ["biomes"] },
  river: {
    "": ["rivers", "labels"],
    name: ["labels"],
    type: ["labels"],
    sourceWidth: ["rivers"],
    widthFactor: ["rivers"]
  },
  route: { "*": ["routes", "labels"] },
  feature: { group: ["lakes"], coastline: ["landmass", "coastline", "lakes"] },
  zone: { "*": ["zones"] },
  marker: { "*": ["markers"] },
  addedLabel: { "*": ["labels"] },
  journey: { "*": ["journeys"] },
  good: { icon: ["goods"], color: ["goods"] },
  market: { "*": ["markets"] }
};

/** Fields of any entity that always draw the same layer, or nothing */
const SHARED_FIELDS: Record<string, readonly LayerId[]> = { label: ["labels"], coa: ["emblems"], note: [], lock: [] };

const CELL_LAYERS: Record<string, readonly LayerId[]> = {
  state: TERRITORY,
  province: PROVINCES,
  culture: ["cultures"],
  religion: ["religions"],
  biome: ["biomes"],
  burg: ["burgIcons", "labels"],
  pop: ["population"],
  r: ["rivers"],
  fl: ["rivers"],
  conf: ["rivers"],
  routes: ["routes"]
};

function rowLayers({ key, field }: Pick<ChangeRow, "key" | "field">): readonly LayerId[] {
  const type = key.split(":")[0];
  if (type === "cells") return CELL_LAYERS[field] ?? [];
  const rules = ENTITY_LAYERS[type];
  if (!rules) return [];
  const name = field.split(".")[0];
  if (name === "removed" || !name) return rules[""] ?? rules["*"] ?? [];
  return rules[name] ?? SHARED_FIELDS[name] ?? rules["*"] ?? [];
}

export function layersFor(change: Pick<ChangeRow, "key" | "field">[]): LayerId[] {
  return [...new Set(change.flatMap(rowLayers))];
}
