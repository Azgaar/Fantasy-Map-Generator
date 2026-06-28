import type { BulkEntityAdapter, CascadeSummary } from "../bulk-entity-adapter";

const findRoute = (id: number) => pack.routes.find(route => route.i === id);
const isRouteDeletable = (id: number): boolean => !!findRoute(id);
const isRouteLocked = (id: number): boolean => !!findRoute(id)?.lock;

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

function describeCascade(ids: number[]): CascadeSummary {
  const deletableIds = ids.filter(id => isRouteDeletable(id) && !isRouteLocked(id));
  const skippedLocked = ids.filter(id => isRouteDeletable(id) && isRouteLocked(id)).length;
  return {
    lines: [`${plural(deletableIds.length, "route")} will be removed`],
    deletable: deletableIds.length,
    skippedLocked
  };
}

/**
 * Build the Routes bulk adapter (legacy-JS menu). Delete delegates to the trusted
 * global Routes.remove, which takes the route OBJECT (not its id) — so the adapter
 * resolves the object from the row id first. No color, no children. `redraw` is
 * injected by the menu.
 */
export function createRoutesAdapter(redraw: () => void): BulkEntityAdapter {
  return {
    type: "routes",
    containerId: "routesBody",
    footerId: "routesBottom",
    supportsColor: false,
    getRowId: row => {
      const id = Number(row.dataset.id);
      return Number.isFinite(id) ? id : null;
    },
    isDeletable: isRouteDeletable,
    isLocked: isRouteLocked,
    setLock: (id, locked) => {
      const route = findRoute(id);
      if (route) route.lock = locked;
    },
    deleteEntity: id => {
      const route = findRoute(id);
      if (route) Routes.remove(route);
    },
    describeCascade,
    redraw
  };
}
