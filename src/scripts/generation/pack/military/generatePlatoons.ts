import {ELEVATION, NOMADIC_BIOMES, WETLAND_BIOMES} from "config/generation";
import {burgTypeModifier, cellTypeModifier} from "config/military";
import {rn} from "utils/numberUtils";
import {isBurg, isState} from "utils/typeUtils";
import {IPlatoon, TCellsData} from "./generateMilitary";

export function generatePlatoons(states: TStates, burgs: TBurgs, unitModifiers: Dict<number>[], cells: TCellsData) {
  const platoons: {[key: number]: IPlatoon[]} = {};

  for (const i of cells.i) {
    if (!cells.pop[i]) continue; // uninhabited

    const stateId = cells.state[i];
    const state = states[stateId];
    if (!isState(state)) continue;

    const featureId = cells.f[i];
    const biomeId = cells.biome[i];
    const cultureId = cells.culture[i];
    const religionId = cells.religion[i];
    const burgId = cells.burg[i];

    const burg = isBurg(burgs[burgId]) ? (burgs[burgId] as IBurg) : null;

    const ruralBase = getRuralBase(cells.pop[i]);
    const urbanBase = getUrbanBase(burg);

    const cultureModifier = getCultureModifier(cultureId, state.culture, state.form);
    const religionModifier = getReligionModifier(religionId, cells.religion[state.center], state.form);
    const featureModifier = getFeatureModifier(featureId, cells.f[state.center], state.type);
    const cellModifier = cultureModifier * religionModifier * featureModifier;

    const stateModifiers = unitModifiers[stateId];
    const cellType = getCellType(biomeId, cells.h[i]);

    for (const unit of options.military) {
      if (!checkUnitConstrains(unit, biomeId, stateId, cultureId, religionId)) continue;
      if (unit.type === "naval" && !isNavyProducer(cells.haven[i], burg)) continue;

      const ruralUnitModifier = cellTypeModifier[cellType][unit.type];
      const urbanUnitModifier = burgTypeModifier[cellType][unit.type];

      const ruralArmy = ruralBase * unit.rural * ruralUnitModifier * cellModifier * stateModifiers[unit.name];
      const urbanArmy = urbanBase * unit.urban * urbanUnitModifier * cellModifier * stateModifiers[unit.name];

      const total = rn((ruralArmy + urbanArmy) * populationRate); // total troops
      if (!total) continue;

      const placeCell = unit.type === "naval" ? cells.haven[i] : i;
      const [x, y] = cells.p[placeCell];

      if (!platoons[stateId]) platoons[stateId] = [];
      platoons[stateId].push({unit, cell: i, a: total, t: total, x, y});
    }
  }

  return platoons;
}

function getRuralBase(population: number) {
  return population / 100;
}

function getUrbanBase(burg: IBurg | null) {
  if (!burg) return 0;
  const base = (burg.population * urbanization) / 100;
  return burg.capital ? base * 1.2 : base;
}

function getCultureModifier(cultureId: number, stateCultureId: number, stateForm: string) {
  if (cultureId === stateCultureId) return 1;
  if (stateForm === "Union") return 0.8;
  return 0.5;
}

function getReligionModifier(religionId: number, stateReligionId: number, stateForm: string) {
  if (religionId === stateReligionId) return 1;
  if (stateForm === "Theocracy") return 0.45;
  return 0.7;
}

function getFeatureModifier(featureId: number, stateFeatureId: number, stateType: string) {
  if (featureId === stateFeatureId) return 1;
  if (stateType === "Naval") return 0.83;
  return 0.55;
}

function getCellType(biomeId: number, cellHeight: number) {
  if (NOMADIC_BIOMES.includes(biomeId)) return "nomadic";
  if (WETLAND_BIOMES.includes(biomeId)) return "wetland";
  if (cellHeight >= ELEVATION.MOUNTAINS) return "highland";
  return "generic";
}

function checkUnitConstrains(unit: IMilitaryUnit, biome: number, state: number, culture: number, religion: number) {
  if (unit.biomes?.length && !unit.biomes.includes(biome)) return false;
  if (unit.states?.length && !unit.states.includes(state)) return false;
  if (unit.cultures?.length && !unit.cultures.includes(culture)) return false;
  if (unit.religions?.length && !unit.religions.includes(religion)) return false;
  return true;
}

function isNavyProducer(haven: number, burg: IBurg | null) {
  if (burg) return Boolean(burg.port);
  return Boolean(haven);
}
