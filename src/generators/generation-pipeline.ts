// Canonical generation sequence, as a declared pipeline instead of a hand-written call list. See docs/architecture/generation-pipeline.md.
import { Pipeline, type PipelineStep } from "@/generators/pipeline";
import { Population } from "@/generators/population-generator";
import type { GridGraph } from "@/types/GridGraph";

const generationPipelineSteps = [
  { id: "grid", run: ({ seed: expectedSeed, graph }) => Grid.prepare(expectedSeed, graph) },
  { id: "heightmap", run: () => HeightmapGenerator.generate() },
  { id: "markupGrid", run: () => Features.markupGrid() },
  { id: "depressionLakes", run: () => Grid.addDeepDepressionLakes() },
  { id: "nearSeaLakes", run: () => Grid.openNearSeaLakes() },
  { id: "mapSize", run: () => Coordinates.defineMapSize() },
  { id: "mapCoordinates", run: () => Coordinates.calculate() },
  { id: "temperatures", run: () => Temperature.generate() },
  { id: "precipitation", run: () => Precipitation.generate() },
  { id: "clearPack", run: () => Pack.clear() },
  { id: "regraph", run: () => Pack.generate() },
  { id: "markupPack", run: () => Features.markupPack() },
  { id: "defaultRuler", run: () => Measurers.createDefaultRuler() },
  { id: "rivers", run: () => Rivers.generate() },
  { id: "biomes", run: () => Biomes.generate() },
  { id: "featureGroups", run: () => Features.defineGroups() },
  { id: "ice", run: () => Ice.generate() },
  { id: "goods", run: () => Goods.generate() },
  { id: "rankCells", run: () => Population.rankCells() },
  { id: "cultures", run: () => Cultures.generate() },
  { id: "culturesExpand", run: () => Cultures.expand() },
  { id: "burgs", run: () => Burgs.generate() },
  { id: "states", run: () => States.generate() },
  { id: "routes", run: () => Routes.generate() },
  { id: "religions", run: () => Religions.generate() },
  { id: "burgsSpecify", run: () => Burgs.specify() },
  { id: "stateStatistics", run: () => States.collectStatistics() },
  { id: "stateForms", run: () => States.defineStateForms() },
  { id: "provinces", run: () => Provinces.generate() },
  { id: "provincePoles", run: () => Provinces.getPoles() },
  { id: "riversSpecify", run: () => Rivers.specify() },
  { id: "lakeNames", run: () => Lakes.defineNames() },
  { id: "markets", run: () => Markets.generate() },
  { id: "production", run: () => Production.produce() },
  { id: "taxes", run: () => States.collectTaxes() },
  { id: "military", run: () => Military.generate() },
  { id: "markers", run: () => Markers.generate() },
  { id: "zones", run: () => Zones.generate() },
  { id: "addedLabels", run: () => AddedLabels.initiate() },
  { id: "mapName", run: () => Names.getMapName(false) },
  { id: "journeys", run: () => Journeys.generate() } // last: it draws from the PRNG, so it must not shift the steps above
] as const satisfies PipelineStep<string, GenerationContext>[];

type GenerationPipelineStepId = (typeof generationPipelineSteps)[number]["id"];

type GenerationContext = {
  seed?: string; // seed if the caller wants a specific one
  graph?: GridGraph; // pre-created grid to use instead of generating one
};
export const GenerationPipeline = new Pipeline<GenerationPipelineStepId, GenerationContext>(
  "Generation Pipeline",
  generationPipelineSteps
);

const erasePipelineSteps = [
  { id: "markupGrid", run: () => Features.markupGrid() },
  { id: "depressionLakes", run: ({ erosion }) => erosion && Grid.addDeepDepressionLakes() },
  { id: "nearSeaLakes", run: ({ erosion }) => erosion && Grid.openNearSeaLakes() },
  { id: "temperatures", run: () => Temperature.generate() },
  { id: "precipitation", run: () => Precipitation.generate() },
  { id: "regraph", run: () => Pack.generate() },
  { id: "markupPack", run: () => Features.markupPack() },
  { id: "rivers", run: ({ erosion }) => Rivers.generate(erosion) },
  { id: "biomes", run: () => Biomes.define() },
  { id: "featureGroups", run: () => Features.defineGroups() },
  { id: "ice", run: () => Ice.generate() },
  { id: "goods", run: () => Goods.generate() },
  { id: "rankCells", run: () => Population.rankCells() },
  { id: "cultures", run: () => Cultures.generate() },
  { id: "culturesExpand", run: () => Cultures.expand() },
  { id: "burgs", run: () => Burgs.generate() },
  { id: "states", run: () => States.generate() },
  { id: "routes", run: () => Routes.generate() },
  { id: "religions", run: () => Religions.generate() },
  { id: "burgsSpecify", run: () => Burgs.specify() },
  { id: "stateStatistics", run: () => States.collectStatistics() },
  { id: "stateForms", run: () => States.defineStateForms() },
  { id: "provinces", run: () => Provinces.generate() },
  { id: "provincePoles", run: () => Provinces.getPoles() },
  { id: "riversSpecify", run: () => Rivers.specify() },
  { id: "lakeNames", run: () => Lakes.defineNames() },
  { id: "markets", run: () => Markets.generate() },
  { id: "production", run: () => Production.produce() },
  { id: "taxes", run: () => States.collectTaxes() },
  { id: "military", run: () => Military.generate() },
  { id: "markers", run: () => Markers.generate() },
  { id: "zones", run: () => Zones.generate() }
] as const satisfies PipelineStep<GenerationPipelineStepId, EraseContext>[];

type EraseContext = { erosion: boolean };
export const ErasePipeline = new Pipeline<GenerationPipelineStepId, EraseContext>(
  "Erase Heightmap",
  erasePipelineSteps
);

declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var GenerationPipeline: import("@/generators/pipeline").Pipeline<GenerationPipelineStepId, GenerationContext>;
}
window.GenerationPipeline = GenerationPipeline;
