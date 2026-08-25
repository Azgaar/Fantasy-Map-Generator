// Canonical generation sequence, as a declared pipeline instead of a hand-written call list.
// See docs/prd/generator-dependency-graph.md and docs/domain/generation_pipeline.md.

import { Pipeline, type PipelineStep } from "@/generators/pipeline";
import type { PackedGraph } from "@/types/PackedGraph";
import { generateGrid, shouldRegenerateGrid } from "@/utils";

export interface GenerationContext {
  seed?: string; // requested seed, if the caller wants a specific one; undefined for "any is fine"
  graph?: unknown; // pre-created grid (e.g. loaded from a save) to use instead of generating one
}

const pipelineSteps = [
  {
    id: "generateGrid",
    run: (context: GenerationContext) => {
      if (shouldRegenerateGrid(grid, context.seed as unknown as number, graphWidth, graphHeight)) {
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
      pack = {} as PackedGraph;
    }
  },
  { id: "markupGrid", run: () => Features.markupGrid() },
  { id: "addLakesInDeepDepressions", run: () => addLakesInDeepDepressions() },
  { id: "openNearSeaLakes", run: () => openNearSeaLakes() },
  {
    id: "mapCoordinates",
    run: () => {
      defineMapSize();
      calculateMapCoordinates();
    }
  },
  { id: "temperatures", run: () => calculateTemperatures() },
  { id: "precipitation", run: () => generatePrecipitation() },
  {
    id: "repack",
    run: () => {
      reGraph();
      Features.markupPack();
    }
  },
  { id: "defaultRuler", run: () => Measurers.createDefaultRuler() },
  { id: "rivers", run: () => Rivers.generate() },
  { id: "biomes", run: () => Biomes.generate() },
  { id: "featureGroups", run: () => Features.defineGroups() },
  { id: "ice", run: () => Ice.generate() },
  { id: "goods", run: () => Goods.generate() },
  { id: "rankCells", run: () => rankCells() },
  { id: "cultures", run: () => Cultures.generate() },
  { id: "culturesExpand", run: () => Cultures.expand() },
  {
    id: "burgs",
    run: () => {
      Burgs.generate();
    }
  },
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
  {
    id: "markets",
    run: () => {
      Markets.generate();
    }
  },
  { id: "production", run: () => Production.produce() },
  { id: "taxes", run: () => States.collectTaxes() },
  { id: "military", run: () => Military.generate() },
  { id: "markers", run: () => Markers.generate() },
  { id: "zones", run: () => Zones.generate() },
  { id: "addedLabels", run: () => AddedLabels.initiate() },
  {
    id: "mapName",
    run: () => {
      Names.getMapName(false); // no-arg call in generate() passes undefined, which is equally falsy
    }
  }
] as const satisfies readonly PipelineStep<string, GenerationContext>[];

export type PipelineStepId = (typeof pipelineSteps)[number]["id"];
export const GenerationPipeline = new Pipeline<PipelineStepId, GenerationContext>("Generation Pipeline", pipelineSteps);

export interface EraseContext {
  erosion: boolean; // whether erosion-driven river/lake behavior is allowed during a heightmap edit
}

// The heightmap-edit "erase" flow: the canonical sequence from markupGrid onward, with the
// heightmap-edit-specific differences. Map bounds and the default ruler don't change, so those
// steps are dropped; rivers and biomes need parameterized/alternate behavior instead of their
// generate()-from-scratch defaults; ice keeps its canonical position (between featureGroups and
// goods) rather than being special-cased.
const erasePipelineSteps = [
  { id: "markupGrid", run: () => Features.markupGrid() },
  {
    id: "addLakesInDeepDepressions",
    run: ({ erosion }: EraseContext) => {
      if (erosion) addLakesInDeepDepressions();
    }
  },
  {
    id: "openNearSeaLakes",
    run: ({ erosion }: EraseContext) => {
      if (erosion) openNearSeaLakes();
    }
  },
  { id: "temperatures", run: () => calculateTemperatures() },
  { id: "precipitation", run: () => generatePrecipitation() },
  {
    id: "repack",
    run: () => {
      reGraph();
      Features.markupPack();
    }
  },
  {
    id: "rivers",
    run: ({ erosion }: EraseContext) => {
      Rivers.generate(erosion);
      if (!erosion) {
        for (const i of pack.cells.i) {
          const g = pack.cells.g[i];
          if (pack.cells.h[i] !== grid.cells.h[g] && pack.cells.h[i] >= 20 === grid.cells.h[g] >= 20) {
            pack.cells.h[i] = grid.cells.h[g];
          }
        }
      }
    }
  },
  { id: "biomes", run: () => Biomes.define() }, // recompute cell biomes against the existing catalog, don't reset it
  { id: "featureGroups", run: () => Features.defineGroups() },
  { id: "ice", run: () => Ice.generate() },
  { id: "goods", run: () => Goods.generate() },
  { id: "rankCells", run: () => rankCells() },
  { id: "cultures", run: () => Cultures.generate() },
  { id: "culturesExpand", run: () => Cultures.expand() },
  {
    id: "burgs",
    run: () => {
      Burgs.generate();
    }
  },
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
  {
    id: "markets",
    run: () => {
      Markets.generate();
    }
  },
  { id: "production", run: () => Production.produce() },
  { id: "taxes", run: () => States.collectTaxes() },
  { id: "military", run: () => Military.generate() },
  { id: "markers", run: () => Markers.generate() },
  { id: "zones", run: () => Zones.generate() }
] as const satisfies readonly PipelineStep<PipelineStepId, EraseContext>[];

export const ErasePipeline = new Pipeline<PipelineStepId, EraseContext>("Erase Heightmap", erasePipelineSteps);

declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var GenerationPipeline: import("@/generators/pipeline").Pipeline<PipelineStepId, GenerationContext>;
}
window.GenerationPipeline = GenerationPipeline;
