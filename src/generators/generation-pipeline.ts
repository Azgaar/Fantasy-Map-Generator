// Canonical generation sequence, as a declared pipeline instead of a hand-written call list.
// See docs/architecture/generation-pipeline.md.

import { Pipeline, type PipelineStep } from "@/generators/pipeline";
import type { PackedGraph } from "@/types/PackedGraph";
import { generateGrid, shouldRegenerateGrid } from "@/utils";

const pipelineSteps: PipelineStep<string, GenerationContext>[] = [
  {
    id: "grid",
    run: context => {
      if (shouldRegenerateGrid(grid, context.seed, graphWidth, graphHeight)) {
        grid = context.graph ?? generateGrid(seed, graphWidth, graphHeight);
      } else {
        delete grid.cells.h;
      }
    }
  },
  {
    id: "heightmap",
    run: async () => {
      grid.cells.h = await HeightmapGenerator.generate(grid);
    }
  },
  { id: "markupGrid", run: () => Features.markupGrid() },
  { id: "depressionLakes", run: () => addLakesInDeepDepressions() },
  { id: "nearSeaLakes", run: () => openNearSeaLakes() },
  { id: "mapSize", run: () => defineMapSize() },
  { id: "mapCoordinates", run: () => calculateMapCoordinates() },
  { id: "temperatures", run: () => calculateTemperatures() },
  { id: "precipitation", run: () => generatePrecipitation() },
  { id: "clearPack", run: () => (pack = {} as PackedGraph) },
  { id: "regraph", run: () => reGraph() },
  { id: "markupPack", run: () => Features.markupPack() },
  { id: "defaultRuler", run: () => Measurers.createDefaultRuler() },
  { id: "rivers", run: () => Rivers.generate() },
  { id: "biomes", run: () => Biomes.generate() },
  { id: "featureGroups", run: () => Features.defineGroups() },
  { id: "ice", run: () => Ice.generate() },
  { id: "goods", run: () => Goods.generate() },
  { id: "rankCells", run: () => rankCells() },
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
  { id: "mapName", run: () => Names.getMapName(false) }
];

type PipelineStepId = (typeof pipelineSteps)[number]["id"];

type GenerationContext = {
  seed?: string; // requested seed, if the caller wants a specific one; undefined for "any is fine"
  graph?: unknown; // pre-created grid (e.g. loaded from a save) to use instead of generating one
};
export const GenerationPipeline = new Pipeline<PipelineStepId, GenerationContext>("Generation Pipeline", pipelineSteps);

const erasePipelineSteps: PipelineStep<PipelineStepId, EraseContext>[] = [
  { id: "markupGrid", run: () => Features.markupGrid() },
  { id: "depressionLakes", run: ({ erosion }) => erosion && addLakesInDeepDepressions() },
  { id: "nearSeaLakes", run: ({ erosion }) => erosion && openNearSeaLakes() },
  { id: "temperatures", run: () => calculateTemperatures() },
  { id: "precipitation", run: () => generatePrecipitation() },
  { id: "regraph", run: () => reGraph() },
  { id: "markupPack", run: () => Features.markupPack() },
  { id: "rivers", run: ({ erosion }) => Rivers.generate(erosion) },
  { id: "biomes", run: () => Biomes.define() },
  { id: "featureGroups", run: () => Features.defineGroups() },
  { id: "ice", run: () => Ice.generate() },
  { id: "goods", run: () => Goods.generate() },
  { id: "rankCells", run: () => rankCells() },
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
];

type EraseContext = { erosion: boolean };
export const ErasePipeline = new Pipeline<PipelineStepId, EraseContext>("Erase Heightmap", erasePipelineSteps);

declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var GenerationPipeline: import("@/generators/pipeline").Pipeline<PipelineStepId, GenerationContext>;
}
window.GenerationPipeline = GenerationPipeline;
