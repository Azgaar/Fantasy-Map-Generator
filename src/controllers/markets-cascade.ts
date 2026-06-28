import { plural } from "../utils/stringUtils";
import type { CascadeSummary } from "./bulk-action/bulk-entity-adapter";

/**
 * Markets bulk logic, kept in the Markets controller's domain (not in the generic
 * bulk-action fixture). Markets have no destructive data cascade of their own — bulk
 * delete delegates to the global Markets.removeMarket — so this module is just the
 * pure predicates and summary the Markets editor needs to assemble its bulk adapter.
 *
 * NB: distinct from the Markers menu. Markets live in pack.markets, have a color but
 * no lock and no children; id 0 is the synthetic "No market" row and is never deletable.
 */

const findMarket = (id: number) => pack.markets.find(market => market.i === id);

export const isMarketDeletable = (id: number): boolean => id !== 0 && !!findMarket(id);
/** Summarize the effect of bulk-deleting the given markets, for the confirmation dialog. */
export function describeMarketsCascade(ids: number[]): CascadeSummary {
  const deletableIds = ids.filter(isMarketDeletable);
  return {
    lines: [`${plural(deletableIds.length, "market")} will be removed`],
    deletable: deletableIds.length,
    skippedLocked: 0
  };
}
