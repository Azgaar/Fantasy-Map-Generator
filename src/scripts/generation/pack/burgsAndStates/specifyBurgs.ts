import {ELEVATION, NOMADIC_BIOMES, HUNTING_BIOMES} from "config/generation";
import {TIME} from "config/logging";
import {getCommonEdgePoint} from "utils/lineUtils";
import {rn} from "utils/numberUtils";
import {gauss, P} from "utils/probabilityUtils";
import {NO_BURG} from "./config";

import type {createCapitals} from "./createCapitals";
import type {TStateData} from "./createStateData";
import type {createTowns} from "./createTowns";

const {COA} = window;

type TCapitals = ReturnType<typeof createCapitals>;
type TTowns = ReturnType<typeof createTowns>;

export function specifyBurgs(
  capitals: TCapitals,
  towns: TTowns,
  stateIds: Uint16Array,
  features: TPackFeatures,
  temp: Int8Array,
  vertices: IGraphVertices,
  cultures: TCultures,
  statesData: TStateData[],
  rivers: Omit<IRiver, "name" | "basin" | "type">[],
  cells: Pick<IPack["cells"], "v" | "p" | "g" | "h" | "f" | "haven" | "harbor" | "s" | "biome" | "fl" | "r">
): TBurgs {
  TIME && console.time("specifyBurgs");

  const stateDataMap = new Map(statesData.map(data => [data.i, data]));

  const burgs = [...capitals, ...towns].map((burgData, index) => {
    const {cell, culture, capital} = burgData;
    const isCapital = Boolean(capital);
    const state = stateIds[cell];

    const port = definePort(cell, isCapital);
    const population = definePopulation(cell, isCapital, port);
    const [x, y] = defineLocation(cell, port);

    const type = defineType(cell, port, population);
    const stateData = stateDataMap.get(state)!;
    const coa: ICoa = defineEmblem(culture, port, isCapital, type, cultures, stateData);

    const features = defineFeatures(population, isCapital);

    const burg: IBurg = {i: index + 1, ...burgData, state, port, population, x, y, type, coa, ...features};
    return burg;
  });

  TIME && console.timeEnd("specifyBurgs");
  return [NO_BURG, ...burgs];

  function definePort(cellId: number, isCapital: boolean) {
    if (!cells.haven[cellId]) return 0; // must be a coastal cell
    if (temp[cells.g[cellId]] <= 0) return 0; // temperature must be above zero °C

    const havenCellId = cells.haven[cellId];
    const havenFeatureId = cells.f[havenCellId];
    const feature = features[havenFeatureId] as IPackFeatureOcean | IPackFeatureLake;
    if (feature.cells < 2) return 0; // water body must have at least 2 cells

    const isSafeHarbor = cells.harbor[cellId] === 1;
    if (!isCapital && !isSafeHarbor) return 0; // must be a capital or safe harbor

    return havenFeatureId;
  }

  // get population in points, where 1 point = 1000 people by default
  function definePopulation(cellId: number, isCapital: boolean, port: number) {
    const basePopulation = cells.s[cellId] / 4;
    const decimalPart = (cellId % 1000) / 1000;

    const capitalMultiplier = isCapital ? 1.3 : 1;
    const portMultiplier = port ? 1.3 : 1;
    const randomMultiplier = gauss(1, 1.5, 0.3, 10, 3);

    const total = (basePopulation + decimalPart) * capitalMultiplier * portMultiplier * randomMultiplier;
    return rn(Math.max(0.1, total), 3);
  }

  function defineLocation(cellId: number, port: number) {
    const [cellX, cellY] = cells.p[cellId];

    if (port) {
      // place ports on the coast
      const [x, y] = getCommonEdgePoint(cells.v, vertices, cellId, cells.haven[cellId]);
      return [rn(x, 2), rn(y, 2)];
    }

    if (cells.r[cellId]) {
      // place river burgs a bit off of the cell center
      const offset = Math.min(cells.fl[cellId] / 150, 1);
      const x = cellId % 2 ? cellX + offset : cellX - offset;
      const y = cells.r[cellId] % 2 ? cellY + offset : cellY - offset;
      return [rn(x, 2), rn(y, 2)];
    }

    return [cellX, cellY];
  }

  function defineType(cellId: number, port: number, population: number): TCultureType {
    if (port) return "Naval";

    const haven = cells.haven[cellId];
    const waterBody = features[cells.f[haven]];
    if (haven && (waterBody as TPackFeature).type === "lake") return "Lake";

    if (cells.h[cellId] > ELEVATION.FOOTHILLS) return "Highland";

    if (cells.r[cellId]) {
      const river = rivers.find(river => river.i === cellId);
      if (river && river.length > 100) return "River";
    }

    if (population < 6) {
      const biome = cells.biome[cellId];
      if (population < 5 && NOMADIC_BIOMES.includes(biome)) return "Nomadic";
      if (HUNTING_BIOMES.includes(biome)) return "Hunting";
    }

    return "Generic";
  }

  function defineEmblem(
    cultureId: number,
    port: number,
    isCapital: boolean,
    type: TCultureType,
    cultures: TCultures,
    stateData: TStateData
  ) {
    const coaType = isCapital && P(0.2) ? "Capital" : type === "Generic" ? "City" : type;
    const cultureShield = cultures[cultureId].shield;

    if (!stateData) {
      const baseCoa = COA.generate(null, 0, null, coaType);
      const shield = COA.getShield(cultureShield);
      return {...baseCoa, shield};
    }

    const {culture: stateCultureId, coa: stateCOA} = stateData;
    const kinship = defineKinshipToStateEmblem();

    const baseCoa = COA.generate(stateCOA, kinship, null, coaType);
    const stateShield = (stateData.coa as ICoa)?.shield;
    const shield = COA.getShield(cultureShield, stateShield);
    return {...baseCoa, shield};

    function defineKinshipToStateEmblem() {
      const baseKinship = 0.25;
      const capitalModifier = isCapital ? 0.1 : 0;
      const portModifier = port ? -0.1 : 0;
      const cultureModifier = cultureId === stateCultureId ? 0 : -0.25;

      return baseKinship + capitalModifier + portModifier + cultureModifier;
    }
  }

  // burg features used mainly in MFCG
  function defineFeatures(population: number, isCapital: boolean) {
    const citadel: Logical = isCapital || (population > 50 && P(0.75)) || P(0.5) ? 1 : 0;

    const plaza: Logical =
      population > 50 || (population > 30 && P(0.75)) || (population > 10 && P(0.5)) || P(0.25) ? 1 : 0;

    const walls: Logical =
      isCapital || population > 30 || (population > 20 && P(0.75)) || (population > 10 && P(0.5)) || P(0.2) ? 1 : 0;

    const shanty: Logical =
      population > 60 || (population > 40 && P(0.75)) || (population > 20 && walls && P(0.4)) ? 1 : 0;

    const temple: Logical = population > 50 || (population > 35 && P(0.75)) || (population > 20 && P(0.5)) ? 1 : 0;

    return {citadel, plaza, walls, shanty, temple};
  }
}
