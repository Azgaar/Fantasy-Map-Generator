export type MapLayerId =
  | "ocean"
  | "landmass"
  | "texture"
  | "height"
  | "lakes"
  | "biomes"
  | "cells"
  | "grid"
  | "coordinates"
  | "compass"
  | "rivers"
  | "relief"
  | "religions"
  | "cultures"
  | "states"
  | "provinces"
  | "trade"
  | "zones"
  | "borders"
  | "routes"
  | "temperature"
  | "coastline"
  | "ice"
  | "goods"
  | "markets"
  | "precipitation"
  | "population"
  | "emblems"
  | "labels"
  | "burgIcons"
  | "military"
  | "markers"
  | "fogging"
  | "rulers"
  | "scaleBar"
  | "legend"
  | "vignette"
  | "debug";

export type MapLayerOwner = "pixi" | "svg";

export interface MapLayerDefinition {
  controlId?: string;
  dependencies: readonly MapLayerId[];
  id: MapLayerId;
  order: number;
  persistent: boolean;
}

const defineLayer = (
  id: MapLayerId,
  order: number,
  controlId?: string,
  dependencies: readonly MapLayerId[] = [],
  persistent = true
): MapLayerDefinition => ({ controlId, dependencies, id, order, persistent });

/** Canonical default order. User-controlled layers can still be rearranged and serialized. */
export const MAP_LAYER_REGISTRY: readonly MapLayerDefinition[] = [
  defineLayer("ocean", 0),
  defineLayer("landmass", 10),
  defineLayer("texture", 20, "toggleTexture", ["landmass"]),
  defineLayer("height", 30, "toggleHeight", ["landmass"]),
  defineLayer("lakes", 40, "toggleLakes", ["landmass"]),
  defineLayer("biomes", 50, "toggleBiomes", ["landmass"]),
  defineLayer("cells", 60, "toggleCells"),
  defineLayer("grid", 70, "toggleGrid"),
  defineLayer("coordinates", 80, "toggleCoordinates"),
  defineLayer("compass", 90, "toggleCompass"),
  defineLayer("relief", 100, "toggleRelief", ["landmass"]),
  defineLayer("religions", 110, "toggleReligions", ["landmass"]),
  defineLayer("cultures", 120, "toggleCultures", ["landmass"]),
  defineLayer("states", 130, "toggleStates", ["landmass"]),
  defineLayer("provinces", 140, "toggleProvinces", ["landmass"]),
  defineLayer("trade", 150, "toggleTrade"),
  defineLayer("zones", 160, "toggleZones"),
  defineLayer("coastline", 170, undefined, ["landmass"]),
  defineLayer("borders", 180, "toggleBorders"),
  defineLayer("rivers", 190, "toggleRivers", ["landmass"]),
  defineLayer("routes", 200, "toggleRoutes"),
  defineLayer("temperature", 210, "toggleTemperature"),
  defineLayer("ice", 220, "toggleIce"),
  defineLayer("goods", 230, "toggleGoods"),
  defineLayer("markets", 240, "toggleMarketsLayer"),
  defineLayer("precipitation", 250, "togglePrecipitation"),
  defineLayer("population", 260, "togglePopulation"),
  defineLayer("emblems", 270, "toggleEmblems"),
  defineLayer("labels", 280, "toggleLabels"),
  defineLayer("burgIcons", 290, "toggleBurgIcons"),
  defineLayer("military", 300, "toggleMilitary"),
  defineLayer("markers", 310, "toggleMarkers"),
  defineLayer("fogging", 320, undefined, [], false),
  defineLayer("rulers", 330, "toggleRulers", [], false),
  defineLayer("scaleBar", 340, "toggleScaleBar", [], false),
  defineLayer("legend", 350, undefined, [], false),
  defineLayer("vignette", 360, "toggleVignette", [], false),
  defineLayer("debug", 370, undefined, [], false)
];

export function validateLayerRegistry(registry: readonly MapLayerDefinition[]): void {
  const ids = new Set<MapLayerId>();
  const orders = new Set<number>();
  for (const definition of registry) {
    if (ids.has(definition.id)) throw new Error(`Duplicate map layer id: ${definition.id}`);
    if (orders.has(definition.order)) throw new Error(`Duplicate map layer order: ${definition.order}`);
    ids.add(definition.id);
    orders.add(definition.order);
  }
  for (const definition of registry) {
    for (const dependency of definition.dependencies) {
      if (!ids.has(dependency)) throw new Error(`Unknown dependency ${dependency} for map layer ${definition.id}`);
    }
  }
}

validateLayerRegistry(MAP_LAYER_REGISTRY);

const MAP_LAYER_IDS = new Set<MapLayerId>(MAP_LAYER_REGISTRY.map(layer => layer.id));

export function normalizeMapLayerOrder(order: readonly string[]): MapLayerId[] {
  const requested = order.filter(
    (layer, index): layer is MapLayerId => MAP_LAYER_IDS.has(layer as MapLayerId) && order.indexOf(layer) === index
  );
  const requestedSet = new Set(requested);
  return [...requested, ...MAP_LAYER_REGISTRY.filter(layer => !requestedSet.has(layer.id)).map(layer => layer.id)];
}

export function resolveMapLayerOrder(controlOrder: readonly string[]): MapLayerId[] {
  const layerByControl = new Map(
    MAP_LAYER_REGISTRY.flatMap(layer => (layer.controlId ? [[layer.controlId, layer.id] as const] : []))
  );
  const requested = controlOrder.flatMap(controlId => {
    const layer = layerByControl.get(controlId);
    return layer ? [layer] : [];
  });
  const requestedSet = new Set(requested);
  const controlledOrder = [
    ...requested,
    ...MAP_LAYER_REGISTRY.filter(layer => layer.controlId && !requestedSet.has(layer.id)).map(layer => layer.id)
  ];
  let controlledIndex = 0;
  return MAP_LAYER_REGISTRY.map(layer => (layer.controlId ? controlledOrder[controlledIndex++] : layer.id));
}
