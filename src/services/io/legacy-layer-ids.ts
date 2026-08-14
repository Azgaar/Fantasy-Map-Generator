// Pre-1.144 layer ids, as stored in saved presets, label group dependencies and map files.
// Legacy vocabulary lives here and in auto-update.ts only: the registry knows canonical ids alone.
// Kept out of auto-update.ts because that module is lazily imported, while the preset remap runs at startup.
const LEGACY_LAYER_IDS: Record<string, string> = {
  toggleTexture: "texture",
  toggleHeight: "heightmap",
  toggleLakes: "lakes",
  toggleBiomes: "biomes",
  toggleCells: "cells",
  toggleGrid: "grid",
  toggleCoordinates: "coordinates",
  toggleCompass: "compass",
  toggleRivers: "rivers",
  toggleRelief: "relief",
  toggleReligions: "religions",
  toggleCultures: "cultures",
  toggleStates: "states",
  toggleProvinces: "provinces",
  toggleZones: "zones",
  toggleBorders: "borders",
  toggleRoutes: "routes",
  toggleTemperature: "temperature",
  toggleIce: "ice",
  toggleGoods: "goods",
  toggleMarketsLayer: "markets",
  toggleTrade: "trade",
  togglePrecipitation: "precipitation",
  togglePopulation: "population",
  toggleEmblems: "emblems",
  toggleBurgIcons: "burgIcons",
  toggleLabels: "labels",
  toggleMilitary: "military",
  toggleMarkers: "markers",
  toggleRulers: "rulers",
  toggleScaleBar: "scaleBar",
  toggleVignette: "vignette"
};

/** map a possibly pre-1.144 layer id to its canonical id, leaving unknown ids untouched */
export const toCanonicalLayerId = (id: string): string => LEGACY_LAYER_IDS[id] ?? id;
