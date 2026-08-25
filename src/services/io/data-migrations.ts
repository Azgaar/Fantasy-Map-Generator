import { compareVersions } from "@/services/version-utils";

type LegacyBiome = {
  i: number;
  name: string;
  color: string;
  habitability: number;
  iconsDensity: number;
  icons: string[];
  cost: number;
  removed?: boolean;
};

type LegacyFeature = { type?: string; shoreline?: unknown };
type LegacyState = { i: number; label?: unknown };

export type MapDataMigrationContext = {
  mapVersion: string;
  data: string[];
  pack: {
    biomes?: LegacyBiome[];
    features: Array<LegacyFeature | null | undefined>;
    states?: LegacyState[];
  };
  getDefaultBiomes: () => LegacyBiome[];
  defineLakeShoreline: (feature: LegacyFeature) => unknown;
};

type MapDataMigration = {
  version: string;
  apply: (context: MapDataMigrationContext) => void;
};

const migrations: MapDataMigration[] = [
  {
    version: "1.139.0",
    apply: ({ data, getDefaultBiomes, pack }) => {
      const [colorData = "", habitabilityData = "", nameData = ""] = data[3].split("|");
      const colors = colorData.split(",");
      const habitability = habitabilityData.split(",").map(Number);
      const names = nameData.split(",");
      const defaults = getDefaultBiomes();
      const biomesCount = Math.max(defaults.length, colors.length, habitability.length, names.length);

      pack.biomes = Array.from({ length: biomesCount }, (_, i) => {
        const defaultBiome = defaults[i];
        const name = names[i] || defaultBiome?.name || "Custom";
        return {
          i,
          name,
          color: colors[i] || defaultBiome?.color || "#999999",
          habitability: habitability[i] ?? defaultBiome?.habitability ?? 50,
          iconsDensity: defaultBiome?.iconsDensity ?? 0,
          icons: defaultBiome?.icons ?? [],
          cost: defaultBiome?.cost ?? 50,
          ...(name === "removed" && { removed: true })
        };
      });
    }
  },
  {
    version: "1.142.0",
    apply: ({ defineLakeShoreline, pack }) => {
      for (const feature of pack.features) {
        if (feature?.type === "lake" && !feature.shoreline) feature.shoreline = defineLakeShoreline(feature);
      }
    }
  }
];

/**
 * Applies state-only migrations before legacy SVG migrations. Keep this declaration order: later
 * legacy migrations rely on the normalized biome data produced by the first entry.
 */
export function applyMapDataMigrations(context: MapDataMigrationContext): void {
  // State labels are derived from the state's current name and geometry, never user-owned label data.
  for (const state of context.pack.states ?? []) delete state.label;
  for (const migration of migrations) {
    if (compareVersions(context.mapVersion, migration.version).isOlder) migration.apply(context);
  }
}
