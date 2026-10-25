// Biome classes: the 13 biomes collapse to four composition classes; 0 (marine) is the void

export const COMPOSITION_CLASSES = ["irradiated", "arable", "biomass", "volatiles"] as const;

// 1-2 deserts, 3-4 savanna and grassland, 5-9 forests and taiga, 10-12 tundra, glacier, wetland;
// custom biomes beyond the standard twelve fold into the last class
export function biomeClass(biomeId: number): number {
  if (biomeId < 1) return 0;
  if (biomeId < 3) return 1;
  if (biomeId < 5) return 2;
  if (biomeId < 10) return 3;
  return 4;
}
