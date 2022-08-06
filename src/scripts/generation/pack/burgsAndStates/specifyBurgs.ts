import {ELEVATION, NOMADIC_BIOMES, HUNTING_BIOMES} from "config/generation";
import {TIME} from "config/logging";
import {getCommonEdgePoint} from "utils/lineUtils";
import {rn} from "utils/numberUtils";
import {gauss, P} from "utils/probabilityUtils";
import {NO_BURG} from "./config";

import type {createCapitals} from "./createCapitals";
import type {createStates} from "./createStates";
import type {createTowns} from "./createTowns";

const {COA} = window;

type TCapitals = ReturnType<typeof createCapitals>;
type TTowns = ReturnType<typeof createTowns>;
type TStatesReturn = ReturnType<typeof createStates>;

export function specifyBurgs(
  capitals: TCapitals,
  towns: TTowns,
  roadScores: Uint16Array,
  stateIds: Uint16Array,
  features: TPackFeatures,
  temp: Int8Array,
  vertices: IGraphVertices,
  cultures: TCultures,
  states: TStatesReturn,
  rivers: Omit<IRiver, "name" | "basin" | "type">[],
  cells: Pick<IPack["cells"], "v" | "p" | "g" | "h" | "f" | "haven" | "harbor" | "s" | "biome" | "fl" | "r">
): TBurgs {
  TIME && console.time("specifyBurgs");

  const burgs: IBurg[] = [...capitals, ...towns].map(burgData => {
    const {cell, culture, capital} = burgData;
    const state = stateIds[cell];

    const port = definePort(cell, capital);
    const population = definePopulation(cell, capital, port);
    const [x, y] = defineLocation(cell, port);

    const type = defineType(cell, port, population);
    const coa = defineEmblem(state, culture, port, capital, type, cultures, states);

    return {...burgData, state, port, population, x, y, type, coa};
  });

  TIME && console.timeEnd("specifyBurgs");
  return [NO_BURG, ...burgs];

  function definePort(cellId: number, capital: Logical) {
    if (!cells.haven[cellId]) return 0; // must be a coastal cell
    if (temp[cells.g[cellId]] <= 0) return 0; // temperature must be above zero °C

    const havenCellId = cells.haven[cellId];
    const havenFeatureId = cells.f[havenCellId];
    const feature = features[havenFeatureId] as IPackFeatureOcean | IPackFeatureLake;
    if (feature.cells < 2) return 0; // water body must have at least 2 cells

    const isSafeHarbor = cells.harbor[cellId] === 1;
    if (!capital && !isSafeHarbor) return 0; // must be a capital or safe harbor

    return havenFeatureId;
  }

  // get population in points, where 1 point = 1000 people by default
  function definePopulation(cellId: number, capital: Logical, port: number) {
    const basePopulation = (cells.s[cellId] + roadScores[cellId] / 2) / 4;
    const decimalPart = (cellId % 1000) / 1000;

    const capitalMultiplier = capital ? 1.3 : 1;
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
    stateId: number,
    cultureId: number,
    port: number,
    capital: Logical,
    type: TCultureType,
    cultures: TCultures,
    states: TStatesReturn
  ) {
    const coaType = capital && P(0.2) ? "Capital" : type === "Generic" ? "City" : type;
    const cultureShield = cultures[cultureId].shield;
    const stateShield = ((states[stateId] as IState)?.coa as ICoa)?.shield;

    if (stateId === 0) {
      const baseCoa = COA.generate(null, 0, null, coaType);
      const shield = COA.getShield(cultureShield, stateShield);
      return {...baseCoa, shield};
    }

    const {culture: stateCultureId, coa: stateCOA} = states[stateId] as IState;
    const kinship = defineKinshipToStateEmblem();

    const baseCoa = COA.generate(stateCOA, kinship, null, coaType);
    const shield = COA.getShield(cultureShield, stateShield);
    return {...baseCoa, shield};

    function defineKinshipToStateEmblem() {
      const baseKinship = 0.25;
      const capitalModifier = capital ? 0.1 : 0;
      const portModifier = port ? -0.1 : 0;
      const cultureModifier = cultureId === stateCultureId ? 0 : -0.25;

      return baseKinship + capitalModifier + portModifier + cultureModifier;
    }
  }
}
