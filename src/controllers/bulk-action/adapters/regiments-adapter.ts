import type { BulkEntityAdapter, CascadeSummary } from "../bulk-entity-adapter";
import { removeRegimentData } from "./regiments-cascade";

/**
 * A regiment is identified by (stateId, regimentId), but the bar's adapter
 * interface keys rows by a single number. Regiment `i` is only unique within its
 * owning state, so a plain regiment id is ambiguous across states. We therefore
 * encode both into one composite id (`stateId * MULTIPLIER + regimentId`) in
 * getRowId and decode it everywhere the id is consumed. The multiplier is large
 * enough that no state ever holds that many regiments.
 */
const STATE_ID_MULTIPLIER = 100000;

interface RegimentRef {
  stateId: number;
  regimentId: number;
}

function encodeId(stateId: number, regimentId: number): number {
  return stateId * STATE_ID_MULTIPLIER + regimentId;
}

function decodeId(compositeId: number): RegimentRef {
  return {
    stateId: Math.floor(compositeId / STATE_ID_MULTIPLIER),
    regimentId: compositeId % STATE_ID_MULTIPLIER
  };
}

function isRegimentDeletable(compositeId: number): boolean {
  const { stateId, regimentId } = decodeId(compositeId);
  const state = pack.states[stateId];
  if (!state || state.removed || !state.military) return false;
  return state.military.some(regiment => regiment.i === regimentId);
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

function describeCascade(ids: number[]): CascadeSummary {
  const deletableIds = ids.filter(id => isRegimentDeletable(id));
  // Regiments have no lock field, so nothing is ever skipped as locked.
  return {
    lines: [`${plural(deletableIds.length, "regiment")} will be removed`],
    deletable: deletableIds.length,
    skippedLocked: 0
  };
}

/**
 * Build the Regiments bulk adapter. `redraw` is injected by the Regiments overview
 * so the adapter stays free of the overview's module-load DOM side effects (and
 * thus unit testable); delete delegates to the shared pure cascade. Regiments have
 * no lock or color, so this adapter offers neither (no setLock, supportsColor:false).
 */
export function createRegimentsAdapter(redraw: () => void): BulkEntityAdapter {
  return {
    type: "regiments",
    containerId: "regimentsBody",
    supportsColor: false,
    getRowId: row => {
      const stateId = Number(row.dataset.s);
      const regimentId = Number(row.dataset.id);
      if (!Number.isFinite(stateId) || !Number.isFinite(regimentId)) return null;
      return encodeId(stateId, regimentId);
    },
    isDeletable: isRegimentDeletable,
    isLocked: () => false,
    deleteEntity: compositeId => {
      const { stateId, regimentId } = decodeId(compositeId);
      removeRegimentData(stateId, regimentId);
    },
    describeCascade,
    redraw
  };
}
