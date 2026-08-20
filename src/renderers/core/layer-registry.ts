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

/** Canonical order mirrors the classic `#viewbox` stack until renderer-independent ordering becomes serialized. */
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
  defineLayer("rivers", 100, "toggleRivers", ["landmass"]),
  defineLayer("relief", 110, "toggleRelief", ["landmass"]),
  defineLayer("religions", 120, "toggleReligions", ["landmass"]),
  defineLayer("cultures", 130, "toggleCultures", ["landmass"]),
  defineLayer("states", 140, "toggleStates", ["landmass"]),
  defineLayer("provinces", 150, "toggleProvinces", ["landmass"]),
  defineLayer("trade", 160, "toggleTrade"),
  defineLayer("zones", 170, "toggleZones"),
  defineLayer("borders", 180, "toggleBorders"),
  defineLayer("routes", 190, "toggleRoutes"),
  defineLayer("temperature", 200, "toggleTemperature"),
  defineLayer("coastline", 210, undefined, ["landmass"]),
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
