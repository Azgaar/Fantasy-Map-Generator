// Canonical generation sequence, as a declared pipeline instead of a hand-written call list.
// See docs/prd/generator-dependency-graph.md and docs/domain/generation_pipeline.md.

import { Pipeline, type PipelineStep } from "@/generators/pipeline";
import type { PackedGraph } from "@/types/PackedGraph";

const pipelineSteps = [
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
] as const satisfies readonly PipelineStep[];

export type PipelineStepId = (typeof pipelineSteps)[number]["id"];
export const GenerationPipeline = new Pipeline<PipelineStepId>(pipelineSteps);

// The heightmap-edit "erase" flow: the canonical sequence from markupGrid onward, with the
// heightmap-edit-specific differences. Map bounds and the default ruler don't change, so those
// steps are dropped; rivers and biomes need parameterized/alternate behavior instead of their
// generate()-from-scratch defaults; ice keeps its canonical position (between featureGroups and
// goods) rather than being special-cased.
export function createErasePipeline(erosionAllowed: boolean): Pipeline<PipelineStepId> {
  const steps: PipelineStep<PipelineStepId>[] = [{ id: "markupGrid", run: () => Features.markupGrid() }];

  if (erosionAllowed) {
    steps.push(
      { id: "addLakesInDeepDepressions", run: () => addLakesInDeepDepressions() },
      { id: "openNearSeaLakes", run: () => openNearSeaLakes() }
    );
  }

  steps.push(
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
      run: () => {
        Rivers.generate(erosionAllowed);
        if (!erosionAllowed) {
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
  );

  return new Pipeline<PipelineStepId>(steps);
}

declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var GenerationPipeline: import("@/generators/pipeline").Pipeline<PipelineStepId>;
}
window.GenerationPipeline = GenerationPipeline;
