import { BurgMarket } from "./markets-generator";

export interface ProductionReport {
  burgId: number;
  producedGoods: Record<string, number>;
}

export function runProductionCycles(markets: BurgMarket[]): ProductionReport[] {
  const reports: ProductionReport[] = [];

  for (const m of markets) {
    const producedGoods: Record<string, number> = {
      Furniture: 0,
      Tools: 0
    };

    // Recipe 1: Furniture requires Wood (id: 1)
    const woodSupply = m.supply[1] || 0;
    if (woodSupply > 2.0) {
      producedGoods.Furniture = Math.floor(woodSupply / 2.0);
    }

    // Recipe 2: Tools requires Wood (id: 1) and Iron (id: 4)
    const ironSupply = m.supply[4] || 0;
    if (woodSupply > 1.0 && ironSupply > 1.0) {
      producedGoods.Tools = Math.floor(Math.min(woodSupply, ironSupply));
    }

    reports.push({
      burgId: m.burgId,
      producedGoods
    });
  }

  return reports;
}
