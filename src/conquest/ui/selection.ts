/**
 * selection.ts — click-to-select, added to the map rather than imposed on it.
 *
 * The overlay used a *capture-phase* listener that stopped propagation in game
 * mode, so FMG's own tools went deaf while Total War was on screen. That is the
 * behaviour Phase A deletes (MOD-PLAN A.3): FMG stays 100% usable, always.
 *
 * So this listener is additive by construction:
 *   - bubble phase, never `stopPropagation()` — FMG's handlers still fire;
 *   - a drag is a pan, not a selection (pointerdown → click distance);
 *   - clicking an army token picks the army, clicking terrain picks the region.
 * Our selection is a *highlight layer*, not a mode.
 *
 * It listens on `document`, not on `#map`, and that is not a style choice: **FMG
 * replaces the `#map` element when it loads a world**, so a listener attached at
 * boot ends up on a detached node and silently stops working. `document` survives
 * the swap; the map is resolved per event and the target checked against it.
 */
import { findCell, screenToMap } from "./geometry";
import { select, type TwSelection } from "./session";

/** A click further than this from the press is a pan/zoom drag, not a click. */
const DRAG_SLOP_PX = 4;

/**
 * What a click resolves to. Pure, so the policy is unit-tested without a browser:
 * an army token beats the terrain under it, terrain beats nothing.
 */
export function pickSelection(cellId: number, regionId: number | null, armyId: string | null): TwSelection {
  if (armyId) return { kind: "army", armyId };
  if (cellId < 0 || regionId == null) return { kind: "none" };
  return { kind: "region", regionId };
}

/** The current map element. FMG replaces it on every world load, so it is
 *  resolved per event rather than captured once. */
function currentMap(): SVGSVGElement | null {
  return document.getElementById("map") as unknown as SVGSVGElement | null;
}

/** Is this event on the map, given the *current* map element? */
function isOnMap(event: Event, map: SVGSVGElement): boolean {
  const target = event.target as Node | null;
  return !!target && (target === map || map.contains(target));
}

/**
 * Install the selection listener.
 *
 * @param lookups how to resolve a cell to a region, and to an army standing there
 * @returns an uninstall function
 */
export function installSelection(lookups: {
  regionAt(cellId: number): number | null;
  armyAt(cellId: number): string | null;
}): () => void {
  let press: { x: number; y: number } | null = null;

  const down = (event: Event): void => {
    const map = currentMap();
    if (!map || !isOnMap(event, map)) return;
    const pointer = event as PointerEvent;
    press = { x: pointer.clientX, y: pointer.clientY };
  };

  const click = (event: Event): void => {
    const map = currentMap();
    if (!map || !isOnMap(event, map)) return;
    // Bubble phase, no stopPropagation: FMG's own click handling is untouched.
    const mouse = event as MouseEvent;
    if (press && Math.hypot(mouse.clientX - press.x, mouse.clientY - press.y) > DRAG_SLOP_PX) {
      press = null;
      return; // a pan, not a click
    }
    press = null;

    const token = (event.target as Element | null)?.closest?.("[data-tw-army]");
    const tokenArmy = token?.getAttribute("data-tw-army") ?? null;
    const at = screenToMap(mouse.clientX, mouse.clientY);
    if (!at) {
      select(pickSelection(-1, null, tokenArmy));
      return;
    }
    const cellId = findCell(at[0], at[1]);
    const regionId = cellId < 0 ? null : lookups.regionAt(cellId);
    const armyId = tokenArmy ?? (cellId < 0 ? null : lookups.armyAt(cellId));
    select(pickSelection(cellId, regionId, armyId));
  };

  document.addEventListener("pointerdown", down);
  document.addEventListener("click", click);
  return () => {
    document.removeEventListener("pointerdown", down);
    document.removeEventListener("click", click);
  };
}
