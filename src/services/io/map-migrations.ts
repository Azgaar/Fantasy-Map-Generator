import type { Feature } from "@/generators/features";
import { applyLegacySvgMigrations } from "./auto-update";
import { applyMapDataMigrations } from "./data-migrations";

/** Runs state migrations before legacy SVG migrations that may consume the normalized state. */
export function migrateMap(mapVersion: string, data: string[]): void {
  applyMapDataMigrations({
    mapVersion,
    data,
    pack,
    getDefaultBiomes: () => Biomes.getDefault(),
    defineLakeShoreline: feature => Lakes.defineShoreline(feature as Feature)
  });
  applyLegacySvgMigrations(mapVersion, data);
}
