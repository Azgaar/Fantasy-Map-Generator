import type { Biome } from "@/generators/biomes-generator";
import { ensureEl, getIsolines } from "@/utils";

type BiomeIsolines = ReturnType<typeof getIsolines>;

export function buildBiomePaths(biomes: Biome[], isolines: BiomeIsolines): string {
  return Object.entries(isolines)
    .map(([index, { fill, waterGap }]) => {
      const color = biomes[+index].color;
      let paths = "";
      if (fill) paths += `<path d="${fill}" fill="${color}" id="biome${index}" />`;
      if (waterGap)
        paths += `<path d="${waterGap}" fill="none" stroke="${color}" stroke-width="3" id="biome-gap${index}" />`;
      return paths;
    })
    .join("");
}

export function drawBiomes(): void {
  TIME && console.time("drawBiomes");

  const isolines = getIsolines(pack, cellId => pack.cells.biome[cellId], { fill: true, waterGap: true });
  ensureEl("biomes").innerHTML = buildBiomePaths(pack.biomes, isolines);

  TIME && console.timeEnd("drawBiomes");
}

declare global {
  interface Window {
    drawBiomes: typeof drawBiomes;
  }
}

window.drawBiomes = drawBiomes;
