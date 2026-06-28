import type { BulkEntityAdapter, CascadeSummary } from "../bulk-entity-adapter";

// NB: distinct from the Markers adapter (markers-adapter.ts). Markets live in
// pack.markets, have a color but no lock and no children; id 0 is the synthetic
// "No market" row and is never deletable.
const findMarket = (id: number) => pack.markets.find(market => market.i === id);
const isMarketDeletable = (id: number): boolean => id !== 0 && !!findMarket(id);

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

function describeCascade(ids: number[]): CascadeSummary {
  const deletableIds = ids.filter(isMarketDeletable);
  return {
    lines: [`${plural(deletableIds.length, "market")} will be removed`],
    deletable: deletableIds.length,
    skippedLocked: 0
  };
}

/**
 * Build the Markets bulk adapter (markets-overview, a migrated-TS menu — attaches
 * directly, not via the legacy bridge). Delete delegates to Markets.removeMarket
 * (data only); the injected redraw redraws the markets layer + list once.
 */
export function createMarketsAdapter(redraw: () => void): BulkEntityAdapter {
  return {
    type: "markets",
    containerId: "marketsOverviewBody",
    supportsColor: true,
    getRowId: row => {
      const id = Number(row.dataset.id);
      return Number.isFinite(id) ? id : null;
    },
    isDeletable: isMarketDeletable,
    isLocked: () => false,
    setColor: (id, color) => {
      const market = findMarket(id);
      if (market) market.color = color;
    },
    deleteEntity: id => Markets.removeMarket(id),
    describeCascade,
    redraw
  };
}
