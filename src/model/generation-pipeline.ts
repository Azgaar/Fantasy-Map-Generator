// Canonical generation sequence, as a declared pipeline instead of a hand-written call list. See docs/architecture/generation-pipeline.md.

import { AddedLabels } from "@/model/annotations/added-labels";
import { Legends } from "@/model/annotations/legends";
import { Measurers } from "@/model/annotations/measurers-generator";
import { Goods } from "@/model/economy/goods-generator";
import { Markets } from "@/model/economy/markets-generator";
import { Production } from "@/model/economy/production-generator";
import { Routes } from "@/model/economy/routes-generator";
import { GraphOverride } from "@/model/graph/graph-override";
import { Grid } from "@/model/graph/grid-generator";
import { Pack } from "@/model/graph/pack-generator";
import { Biomes } from "@/model/physical/biomes-generator";
import { Features } from "@/model/physical/features-generator";
import { HeightmapGenerator } from "@/model/physical/heightmap-generator";
import { Ice } from "@/model/physical/ice-generator";
import { Precipitation } from "@/model/physical/precipitation-generator";
import { Rivers } from "@/model/physical/river-generator";
import { Temperature } from "@/model/physical/temperature-generator";
import { Pipeline, type PipelineStep } from "@/model/pipeline";
import { Burgs } from "@/model/political/burgs-generator";
import { Military } from "@/model/political/military-generator";
import { Provinces } from "@/model/political/provinces-generator";
import { States } from "@/model/political/states-generator";
import { Zones } from "@/model/political/zones-generator";
import { Cultures } from "@/model/society/cultures-generator";
import { Population } from "@/model/society/population-generator";
import { Religions } from "@/model/society/religions-generator";
import { Journeys } from "@/model/story/journeys/journeys-generator";
import { Markers } from "@/model/story/markers-generator";
import type { GridGraph } from "@/types/grid-graph";
import { Coordinates } from "./physical/coordinates";

const generationPipelineSteps = [
  { id: "grid", run: ({ graph }) => Grid.prepare(graph) },
  { id: "heightmap", run: () => HeightmapGenerator.generate() },
  { id: "markupGrid", run: () => Features.markupGrid() },
  { id: "depressionLakes", run: () => Grid.addDeepDepressionLakes() },
  { id: "nearSeaLakes", run: () => Grid.openNearSeaLakes() },
  { id: "mapSize", run: () => Coordinates.generate() },
  { id: "temperatures", run: () => Temperature.generate() },
  { id: "precipitation", run: () => Precipitation.generate() },
  { id: "clearPack", run: () => Pack.clear() },
  { id: "clearGraphOverride", run: () => GraphOverride.clear() },
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
  { id: "featureNames", run: () => Features.defineNames() },
  { id: "markets", run: () => Markets.generate() },
  { id: "production", run: () => Production.produce() },
  { id: "taxes", run: () => States.collectTaxes() },
  { id: "military", run: () => Military.generate() },
  { id: "markers", run: () => Markers.generate() },
  { id: "zones", run: () => Zones.generate() },
  { id: "addedLabels", run: () => AddedLabels.initiate() },
  { id: "journeys", run: () => Journeys.generate() },
  { id: "legends", run: () => Legends.initiate() }
] as const satisfies PipelineStep<string, GenerationContext>[];

type GenerationPipelineStepId = (typeof generationPipelineSteps)[number]["id"];

type GenerationContext = {
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
  { id: "featureNames", run: () => Features.defineNames() },
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
