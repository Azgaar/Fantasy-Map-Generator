import { max, mean, median, sum } from "d3";
import { gauss, isWater, normalize, rn } from "@/utils";
import type { Burg } from "./burgs-generator";

// suitability bonus (or penalty) for a coastal cell, by what it is coastal to
const COAST_SCORES: Record<string, number> = {
  estuary: 15,
  ocean_coast: 5,
  save_harbor: 20,
  freshwater: 30,
  salt: 10,
  frozen: 1,
  dry: -5,
  sinkhole: -5,
  lava: -30
};

class PopulationModule {
  /** assess cells suitability to calculate population and rank cells for culture center and burgs placement */
  rankCells(): void {
    const { cells, features, biomes } = pack;
    cells.s = new Int16Array(cells.i.length); // cell suitability array
    cells.pop = new Float32Array(cells.i.length); // cell population array

    const meanFlux = median(cells.fl.filter(f => f)) || 0;
    const maxFlux = max(cells.fl)! + max(cells.conf)!; // to normalize flux
    const meanArea = mean(cells.area)!; // to adjust population by cell area
    const getGoodValue = (i: number) => (cells.good?.[i] ? (Goods.get(cells.good[i])?.value ?? 0) : 0);

    for (const i of cells.i) {
      if (isWater(i, pack)) continue; // no population in water
      let score = biomes[cells.biome[i]].habitability; // base suitability derived from biome habitability
      if (!score) continue; // uninhabitable biomes has 0 suitability

      if (meanFlux) score += normalize(cells.fl[i] + cells.conf[i], meanFlux, maxFlux) * 250; // big rivers and confluences are valued
      score -= (cells.h[i] - 50) / 5; // low elevation is valued, high is not;

      if (cells.t[i] === 1) {
        if (cells.r[i]) score += COAST_SCORES.estuary;
        const feature = features[cells.f[cells.haven[i]]];
        if (feature.type === "lake") {
          score += COAST_SCORES[feature.subtype] || 0;
        } else {
          score += COAST_SCORES.ocean_coast;
          if (cells.harbor[i] === 1) score += COAST_SCORES.save_harbor;
        }
      }

      cells.s[i] = score / 5; // general population rate

      // add bonus for goods around
      if (cells.good && (cells.good[i] || cells.c[i].some(c => cells.good[c]))) {
        const cellGood = getGoodValue(i);
        const neighborGoods = mean(cells.c[i].map(c => getGoodValue(c)))!;
        cells.s[i] += (cellGood ? cellGood + 10 : 0) + neighborGoods;
      }

      // cell rural population is suitability adjusted by cell area
      cells.pop[i] = cells.s[i] > 0 ? (cells.s[i] * cells.area[i]) / meanArea : 0;
    }
  }

  /** recalculate rural and urban population, keeping locked burgs */
  regenerate(): void {
    this.rankCells();

    pack.burgs.forEach(burg => {
      if (!burg.i || burg.removed || burg.lock) return;
      const cellId = burg.cell;

      burg.population = rn(Math.max(pack.cells.s[cellId] / 8 + burg.i / 1000 + (cellId % 100) / 1000, 0.1), 3);
      if (burg.capital) burg.population *= 1.3;
      if (burg.port) burg.population *= 1.3;
      burg.population = rn(burg.population * gauss(2, 3, 0.6, 20, 3), 3);
    });
  }

  /** Land cells passing a test */
  landCells(test: (cell: number) => boolean): number[] {
    const { i, h } = pack.cells;
    return Array.from(i).filter(cell => h[cell] >= 20 && test(cell));
  }

  /** Ids of the living burgs passing a test */
  burgIds(test: (burg: Burg) => boolean): number[] {
    return pack.burgs.filter(burg => burg?.i && !burg.removed && test(burg)).map(burg => burg.i);
  }

  /** Set an area's population in people: its cells' rural population scales to `rural`, its burgs' to `urban`; an area with none spreads it evenly */
  setArea(cellIds: number[], burgIds: number[], rural: number, urban: number): void {
    for (const [label, value] of [
      ["rural", rural],
      ["urban", urban]
    ] as const)
      if (typeof value !== "number" || !(value >= 0 && Number.isFinite(value)))
        throw new Error(`The ${label} population must be a non-negative number`);
    if (rural && !cellIds.length) throw new Error("The area has no land cells to hold a rural population");
    if (urban && !burgIds.length) throw new Error("The area has no burgs to hold an urban population");

    const { cells, burgs } = pack;
    const { scale, urbanization } = options.map.units.population;
    const ruralPoints = rural / scale;
    const ruralNow = sum(cellIds, cell => cells.pop[cell]);
    for (const cell of cellIds)
      cells.pop[cell] = ruralNow ? cells.pop[cell] * (ruralPoints / ruralNow) : ruralPoints / cellIds.length;

    const urbanPoints = urban / scale / urbanization.rate;
    const urbanNow = sum(burgIds, burg => burgs[burg].population ?? 0);
    for (const burg of burgIds)
      burgs[burg].population = rn(
        urbanNow ? (burgs[burg].population ?? 0) * (urbanPoints / urbanNow) : urbanPoints / burgIds.length,
        4
      );
  }
}

export const Population = new PopulationModule();
