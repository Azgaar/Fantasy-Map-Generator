import { Grid } from "../../core/types";
import { Burg } from "./burg-generator";
import { GOODS } from "./goods-generator";

export interface BurgMarket {
  burgId: number;
  supply: Record<number, number>;
  demand: Record<number, number>;
  prices: Record<number, number>;
}

export function generateMarkets(
  grid: Grid,
  burgs: Burg[],
  cellGoods: Uint8Array
): BurgMarket[] {
  const markets: BurgMarket[] = [];

  for (const b of burgs) {
    const supply: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const demand: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const prices: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    // 1. Calculate supply from neighboring cells
    const neighbors = grid.cells.c[b.cell] || [];
    // Include the city's own cell
    const supplyCells = [b.cell, ...neighbors];

    for (const cellId of supplyCells) {
      const goodId = cellGoods[cellId];
      if (goodId > 0) {
        supply[goodId] += 5.0; // supply points
      }
    }

    // 2. Calculate demand based on city population
    const baseDemand = b.population / 1000;
    demand[1] = baseDemand * 0.8; // Wood (fuel/buildings)
    demand[2] = baseDemand * 0.5; // Stone (heavy walls)
    demand[3] = baseDemand * 1.5; // Crops (food)
    demand[4] = baseDemand * 0.3; // Iron (tools/weapons)
    demand[5] = baseDemand * 0.9; // Livestock (meat/leather)

    // 3. Dynamic price calculation based on supply/demand ratio
    for (const gIdStr of Object.keys(GOODS)) {
      const gId = parseInt(gIdStr, 10);
      const s = Math.max(supply[gId], 1.0); // avoid div by 0
      const d = demand[gId];
      const baseValue = GOODS[gId].value;

      // Price spikes if demand is high and supply is low
      prices[gId] = Number((baseValue * (d / s)).toFixed(2));
    }

    markets.push({
      burgId: b.id,
      supply,
      demand,
      prices
    });
  }

  return markets;
}
