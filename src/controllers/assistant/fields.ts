import type { LayerId } from "@/components/layers";
import type { EntityType } from "@/components/map-entities";

// The layers a territory's edits redraw, shared by its entity and its cells
export const TERRITORY: LayerId[] = ["states", "borders", "provinces", "burgIcons", "labels", "military", "emblems"];
export const PROVINCES: LayerId[] = ["provinces", "borders", "labels", "emblems"];

interface CellField {
  label: string;
  layers: readonly LayerId[];
  references?: EntityType; // the type of entity the field holds the id of
}

/** Per-cell data a proposal records, in the order its rows are listed; a change is one row per field */
export const CELL_FIELDS: Record<string, CellField> = {
  burg: { label: "Burg", layers: ["burgIcons", "labels"], references: "burg" },
  state: { label: "State", layers: TERRITORY, references: "state" },
  province: { label: "Province", layers: PROVINCES, references: "province" },
  culture: { label: "Culture", layers: ["cultures"], references: "culture" },
  religion: { label: "Religion", layers: ["religions"], references: "religion" },
  biome: { label: "Biome", layers: ["biomes"], references: "biome" },
  pop: { label: "Rural population", layers: ["population"] },
  r: { label: "River", layers: ["rivers"], references: "river" },
  fl: { label: "Water flux", layers: ["rivers"] },
  conf: { label: "Confluence", layers: ["rivers"] },
  routes: { label: "Route links", layers: ["routes"] }
};
