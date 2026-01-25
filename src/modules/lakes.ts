import { PackedGraphFeature } from "./features";
import { min, mean } from "d3";
import { byId,
rn } from "../utils";

declare global {
  var Lakes: LakesModule;
}

export class LakesModule {
  private LAKE_ELEVATION_DELTA = 0.1;

  getHeight(feature: PackedGraphFeature) {
    const heights = pack.cells.h;
    const minShoreHeight = min(feature.shoreline.map(cellId => heights[cellId])) || 20;
    return rn(minShoreHeight - this.LAKE_ELEVATION_DELTA, 2);
  };

  defineNames() {
    pack.features.forEach((feature: PackedGraphFeature) => {
      if (feature.type !== "lake") return;
      feature.name = this.getName(feature);
    });
  };

  getName(feature: PackedGraphFeature): string {
    const landCell = feature.shoreline[0];
    const culture = pack.cells.culture[landCell];
    return Names.getCulture(culture);
  };

  cleanupLakeData = function () {
    for (const feature of pack.features) {
      if (feature.type !== "lake") continue;
      delete feature.river;
      delete feature.enteringFlux;
      delete feature.outCell;
      delete feature.closed;
      feature.height = rn(feature.height, 3);

      const inlets = feature.inlets?.filter(r => pack.rivers.find(river => river.i === r));
      if (!inlets || !inlets.length) delete feature.inlets;
      else feature.inlets = inlets;

      const outlet = feature.outlet && pack.rivers.find(river => river.i === feature.outlet);
      if (!outlet) delete feature.outlet;
    }
  };

  defineClimateData(heights: number[] | Uint8Array) {
    const {cells, features} = pack;
    const lakeOutCells = new Uint16Array(cells.i.length);
    
    const getFlux = (lake: PackedGraphFeature) => {
      return lake.shoreline.reduce((acc, c) => acc + grid.cells.prec[cells.g[c]], 0);
    }

    const getLakeTemp = (lake: PackedGraphFeature) => {
      if (lake.cells < 6) return grid.cells.temp[cells.g[lake.firstCell]];
      return rn(mean(lake.shoreline.map(c => grid.cells.temp[cells.g[c]])) as number, 1);
    }

    const getLakeEvaporation = (lake: PackedGraphFeature) => {
      const height = (lake.height - 18) ** Number(heightExponentInput.value); // height in meters
      const evaporation = ((700 * (lake.temp + 0.006 * height)) / 50 + 75) / (80 - lake.temp); // based on Penman formula, [1-11]
      return rn(evaporation * lake.cells);
    }

    const getLowestShoreCell = (lake: PackedGraphFeature) => {
      return lake.shoreline.sort((a, b) => heights[a] - heights[b])[0];
    }

    features.forEach(feature => {
      if (feature.type !== "lake") return;
      feature.flux = getFlux(feature);
      feature.temp = getLakeTemp(feature);
      feature.evaporation = getLakeEvaporation(feature);
      if (feature.closed) return; // no outlet for lakes in depressed areas

      feature.outCell = getLowestShoreCell(feature);
      lakeOutCells[feature.outCell as number] = feature.i;
    });

    return lakeOutCells;
  };

  // check if lake can be potentially open (not in deep depression)
  detectCloseLakes(h: number[] | Uint8Array) {
    const {cells} = pack;
    const ELEVATION_LIMIT = +(byId("lakeElevationLimitOutput") as HTMLInputElement)?.value;

    pack.features.forEach(feature => {
      if (feature.type !== "lake") return;
      delete feature.closed;

      const MAX_ELEVATION = feature.height + ELEVATION_LIMIT;
      if (MAX_ELEVATION > 99) {
        feature.closed = false;
        return;
      }

      let isDeep = true;
      const lowestShorelineCell = feature.shoreline.sort((a, b) => h[a] - h[b])[0];
      const queue = [lowestShorelineCell];
      const checked = [];
      checked[lowestShorelineCell] = true;

      while (queue.length && isDeep) {
        const cellId: number = queue.pop() as number;

        for (const neibCellId of cells.c[cellId]) {
          if (checked[neibCellId]) continue;
          if (h[neibCellId] >= MAX_ELEVATION) continue;

          if (h[neibCellId] < 20) {
            const nFeature = pack.features[cells.f[neibCellId]];
            if (nFeature.type === "ocean" || feature.height > nFeature.height) isDeep = false;
          }

          checked[neibCellId] = true;
          queue.push(neibCellId);
        }
      }

      feature.closed = isDeep;
    });
  };
}

window.Lakes = new LakesModule();