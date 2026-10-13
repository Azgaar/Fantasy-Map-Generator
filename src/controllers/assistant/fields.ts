import type { LayerId } from "@/components/layers";
import type { EntityType } from "@/components/map-entities";
import { t } from "@/utils/i18n";

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
  burg: { label: t("Burg"), layers: ["burgIcons", "labels"], references: "burg" },
  state: { label: t("State"), layers: TERRITORY, references: "state" },
  province: { label: t("Province"), layers: PROVINCES, references: "province" },
  culture: { label: t("Culture"), layers: ["cultures"], references: "culture" },
  religion: { label: t("Religion"), layers: ["religions"], references: "religion" },
  biome: { label: t("Biome"), layers: ["biomes"], references: "biome" },
  pop: { label: t("Rural population"), layers: ["population"] },
  r: { label: t("River"), layers: ["rivers"], references: "river" },
  fl: { label: t("Water flux"), layers: ["rivers"] },
  conf: { label: t("Confluence"), layers: ["rivers"] },
  routes: { label: t("Route links"), layers: ["routes"] }
};
