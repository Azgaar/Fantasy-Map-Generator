interface MapHistoryEntry {
  seed: string;
  width: number;
  height: number;
  template: string;
  created: number;
  /** when this entry was put on screen in this session, unlike `created` never backdated to a loaded file's own timestamp */
  registeredAt: number;
}

/** Every map this session put on screen, oldest first; the last one is what is on screen now */
export const mapHistory: MapHistoryEntry[] = [];
const MAP_HISTORY_LIMIT = 100;

/** Take note of a map that is now on screen, and announce it */
export function registerMap(created: number = Date.now()): void {
  mapHistory.push({
    seed: options.map.seed,
    width: options.map.graph.width,
    height: options.map.graph.height,
    template: options.generation.template,
    created: created,
    registeredAt: Date.now()
  });
  if (mapHistory.length > MAP_HISTORY_LIMIT) mapHistory.splice(0, mapHistory.length - MAP_HISTORY_LIMIT);

  // the public seam test automation and external integrations wait on; the id is the creation date
  window.dispatchEvent(new CustomEvent("map:generated", { detail: { seed: options.map.seed, mapId: created } }));
}
