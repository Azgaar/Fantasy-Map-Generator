import {markupPackFeatures} from "scripts/generation/markup";
import {rankCells} from "scripts/generation/pack/rankCells";
import {pick} from "utils/functionUtils";

import {generateBurgsAndStates} from "./burgsAndStates/generateBurgsAndStates";
import {expandCultures} from "./cultures/expandCultures";
import {generateCultures} from "./cultures/generateCultures";
import {generateLakeNames} from "./lakes/generateLakeNames";
import {generateMilitary} from "./military/generateMilitary";
import {generateProvinces} from "./provinces/generateProvinces";
import {generateReligions} from "./religions/generateReligions";
import {repackGrid} from "./repackGrid";
import {generateRivers} from "./rivers/generateRivers";
import {specifyRivers} from "./rivers/specifyRivers";
import {generateRoutes} from "./routes/generateRoutes";

const {Biomes} = window;

export function createPack(grid: IGrid): IPack {
  const {temp, prec} = grid.cells;
  const {vertices, cells} = repackGrid(grid);

  const {
    features: rawFeatures,
    featureIds,
    distanceField,
    haven,
    harbor
  } = markupPackFeatures(grid, vertices, pick(cells, "v", "c", "b", "p", "h"));

  const {
    heights,
    flux,
    riverIds,
    conf,
    rivers: rawRivers,
    mergedFeatures
  } = generateRivers(
    {...pick(cells, "i", "c", "b", "g", "h", "p"), f: featureIds, t: distanceField, haven},
    rawFeatures,
    prec,
    temp
  );

  const biome: Uint8Array = Biomes.define({
    temp,
    prec,
    flux,
    riverIds,
    heights,
    neighbors: cells.c,
    gridReference: cells.g
  });

  const {suitability, population} = rankCells(mergedFeatures, {
    t: distanceField,
    f: featureIds,
    fl: flux,
    conf,
    r: riverIds,
    h: heights,
    area: cells.area,
    biome,
    haven,
    harbor
  });

  const cultures = generateCultures(
    mergedFeatures,
    {
      p: cells.p,
      i: cells.i,
      g: cells.g,
      t: distanceField,
      h: heights,
      haven,
      harbor,
      f: featureIds,
      r: riverIds,
      fl: flux,
      s: suitability,
      pop: population,
      biome
    },
    temp
  );

  const cultureIds = expandCultures(cultures, mergedFeatures, {
    c: cells.c,
    area: cells.area,
    h: heights,
    t: distanceField,
    f: featureIds,
    r: riverIds,
    fl: flux,
    biome,
    pop: population
  });

  const {burgIds, stateIds, burgs, states, conflicts} = generateBurgsAndStates(
    cultures,
    mergedFeatures,
    temp,
    rawRivers,
    vertices,
    {
      ...pick(cells, "v", "c", "p", "b", "i", "g", "area"),
      h: heights,
      f: featureIds,
      t: distanceField,
      haven,
      harbor,
      r: riverIds,
      fl: flux,
      biome,
      s: suitability,
      pop: population,
      culture: cultureIds
    }
  );

  const {cellRoutes, routes} = generateRoutes(burgs, temp, {
    c: cells.c,
    p: cells.p,
    g: cells.g,
    h: heights,
    t: distanceField,
    biome,
    burg: burgIds
  });

  const {religionIds, religions} = generateReligions({
    states,
    cultures,
    burgs,
    cells: {
      i: cells.i,
      c: cells.c,
      p: cells.p,
      g: cells.g,
      h: heights,
      t: distanceField,
      biome,
      pop: population,
      culture: cultureIds,
      burg: burgIds,
      state: stateIds,
      route: cellRoutes
    }
  });

  const {provinceIds, provinces} = generateProvinces(states, burgs, cultures, mergedFeatures, vertices, {
    i: cells.i,
    c: cells.c,
    v: cells.v,
    h: heights,
    t: distanceField,
    f: featureIds,
    culture: cultureIds,
    state: stateIds,
    burg: burgIds
  });

  const rivers = specifyRivers(rawRivers, cultureIds, cultures);
  const features = generateLakeNames(mergedFeatures, cultureIds, cultures);

  generateMilitary(states);

  // Military.generate();
  // Markers.generate();
  // addZones(); // add to pack data

  const events: IEvents = {conflicts};

  const pack: IPack = {
    vertices,
    cells: {
      ...cells,
      h: heights,
      f: featureIds,
      t: distanceField,
      haven,
      harbor,
      fl: flux,
      r: riverIds,
      conf,
      biome,
      s: suitability,
      pop: population,
      culture: cultureIds,
      burg: burgIds,
      state: stateIds,
      route: cellRoutes,
      religion: religionIds,
      province: provinceIds
    },
    features,
    rivers,
    cultures,
    states,
    burgs,
    routes,
    religions,
    provinces,
    events
  };

  return pack;
}
