import { invalidatePixiRendererLayer, queuePixiRendererRebuild } from "@/renderers/pixi/pixi-renderer-controller";
import type { PixiOwnedLayer } from "@/renderers/pixi/pixi-renderer-ownership";
import {
  applyLegacyStylePresetToMapStyle,
  type LegacyStylePreset,
  serializeMapStyleToLegacyPreset
} from "@/renderers/scene/legacy-style-preset-adapter";
import { getMapRendererStyle } from "@/renderers/scene/map-style-state";
import type {
  CompassLayerStyle,
  CoordinateLayerStyle,
  EmblemLayerStyle,
  GoodsLayerStyle,
  GridLayerStyle,
  HeightLayerStyle,
  MapStyle,
  MarketLayerStyle,
  MilitaryLayerStyle,
  OceanLayerStyle,
  PointSymbolStyle,
  SemanticAreaStyle,
  SemanticLineStyle,
  TemperatureLayerStyle,
  TextureLayerStyle
} from "@/renderers/scene/styles";

type StyleValue = boolean | number | string | null;
type OpacityLayer =
  | "biomes"
  | "cells"
  | "compass"
  | "coordinates"
  | "cultures"
  | "emblems"
  | "grid"
  | "ice"
  | "markers"
  | "military"
  | "population"
  | "precipitation"
  | "provinces"
  | "religions"
  | "rivers"
  | "states"
  | "temperature"
  | "trade"
  | "zones";
type LineLayer = "cells" | "grid" | "precipitation" | "temperature" | "zones";

export interface MapStyleControlsApi {
  applyLegacyPreset: (preset: LegacyStylePreset) => void;
  getOceanStyle: () => OceanLayerStyle;
  getRouteGroups: () => string[];
  getRouteLineStyle: (group?: string) => SemanticLineStyle;
  getStyle: () => MapStyle;
  getTemperatureStyle: () => TemperatureLayerStyle;
  invalidateLayer: (layer: PixiOwnedLayer) => void;
  setAreaFillColor: (layer: "precipitation" | "rivers", color: string) => void;
  setBorderStyle: (role: "province" | "state", property: keyof SemanticLineStyle, value: StyleValue) => void;
  setBurgPointStyle: (
    section: "anchors" | "icons",
    role: string,
    property: keyof PointSymbolStyle,
    value: StyleValue
  ) => void;
  setCoastlineStyle: (role: string, property: keyof SemanticLineStyle, value: StyleValue) => void;
  setCoordinateLineStyle: (property: keyof SemanticLineStyle, value: StyleValue) => void;
  setCoordinateStyle: (property: keyof CoordinateLayerStyle, value: StyleValue) => void;
  setCompassStyle: (patch: Partial<CompassLayerStyle>) => void;
  setEmblemStyle: (property: keyof EmblemLayerStyle, value: StyleValue) => void;
  setGoodsStyle: (section: keyof GoodsLayerStyle, property: string, value: StyleValue) => void;
  setGridStyle: (property: Exclude<keyof GridLayerStyle, "stroke">, value: StyleValue) => void;
  setHeightBandStyle: (scope: "land" | "ocean", patch: Partial<HeightLayerStyle["land"]>) => void;
  setHeightStyle: (height: HeightLayerStyle) => void;
  setIceStyle: (section: "fill" | "stroke", property: string, value: StyleValue) => void;
  setLakeStyle: (
    role: string,
    section: "fill" | "stroke",
    property: keyof SemanticAreaStyle["fill"] | keyof SemanticAreaStyle["stroke"],
    value: StyleValue
  ) => void;
  setLandmassStyle: (property: "color" | "opacity", value: StyleValue) => void;
  setLayerOpacity: (layer: OpacityLayer, opacity: number | string) => void;
  setLineStyle: (layer: LineLayer, property: keyof SemanticLineStyle, value: StyleValue) => void;
  setMarketStyle: (property: keyof MarketLayerStyle, value: StyleValue) => void;
  setMarkerStyle: (property: "opacity" | "rescale", value: boolean | number) => void;
  setMilitaryStyle: (property: keyof MilitaryLayerStyle, value: StyleValue) => void;
  setOceanStyle: (ocean: OceanLayerStyle) => void;
  setPopulationLineStyle: (role: "rural" | "urban", property: keyof SemanticLineStyle, value: StyleValue) => void;
  setReliefOpacity: (opacity: number | string) => void;
  setRouteLineStyle: (group: string, property: keyof SemanticLineStyle, value: StyleValue) => void;
  setTemperatureStyle: (patch: Partial<TemperatureLayerStyle>) => void;
  setTextureStyle: (texture: TextureLayerStyle) => void;
  serializeLegacyPreset: () => LegacyStylePreset;
}

export function initializeMapStyleControls(): void {
  const controls: MapStyleControlsApi = {
    applyLegacyPreset(preset) {
      const burgGroups = options.burgs.groups.map(group => group.name);
      applyLegacyStylePresetToMapStyle(style, preset, burgGroups);
      queuePixiRendererRebuild();
    },
    getOceanStyle() {
      return structuredClone(getMapRendererStyle(style).ocean);
    },
    getRouteGroups() {
      const roles = getMapRendererStyle(style).routes.roles;
      return [
        ...new Set(["roads", "trails", "searoutes", ...Object.keys(roles), ...pack.routes.map(route => route.group)])
      ];
    },
    getRouteLineStyle(group = "roads") {
      const routes = getMapRendererStyle(style).routes;
      const fallback = routes.roles.roads ?? routes.default;
      return structuredClone(routes.roles[group] ?? fallback);
    },
    getStyle() {
      return getMapRendererStyle(style);
    },
    getTemperatureStyle() {
      return structuredClone(getMapRendererStyle(style).temperature);
    },
    invalidateLayer: invalidatePixiRendererLayer,
    setAreaFillColor(layer, color) {
      updateStyle(layer, rendererStyle => {
        rendererStyle[layer].fill.color = color;
      });
    },
    setBorderStyle(role, property, value) {
      updateStyle("borders", rendererStyle => {
        assignStyleValue(rendererStyle.borders[role], property, value);
      });
    },
    setBurgPointStyle(section, role, property, value) {
      updateStyle("burgIcons", rendererStyle => {
        const styles = rendererStyle.burgIcons[section];
        const next = structuredClone(styles.roles[role] ?? styles.default);
        assignStyleValue(next, property, value);
        styles.roles[role] = next;
      });
    },
    setCoastlineStyle(role, property, value) {
      updateStyle("coastline", rendererStyle => {
        const next = structuredClone(rendererStyle.coastline.roles[role] ?? rendererStyle.coastline.default);
        assignStyleValue(next, property, value);
        rendererStyle.coastline.roles[role] = next;
      });
    },
    setCoordinateLineStyle(property, value) {
      updateStyle("coordinates", rendererStyle => {
        assignStyleValue(rendererStyle.coordinates.stroke, property, value);
      });
    },
    setCoordinateStyle(property, value) {
      updateStyle("coordinates", rendererStyle => {
        assignStyleValue(rendererStyle.coordinates, property, value);
      });
    },
    setCompassStyle(patch) {
      updateStyle("compass", rendererStyle => {
        rendererStyle.compass = { ...rendererStyle.compass, ...patch };
      });
    },
    setEmblemStyle(property, value) {
      updateStyle("emblems", rendererStyle => {
        assignStyleValue(rendererStyle.emblems, property, value);
      });
    },
    setGoodsStyle(section, property, value) {
      if (section === "opacity") return;
      updateStyle("goods", rendererStyle => {
        assignStyleValue(rendererStyle.goods[section], property, value);
      });
    },
    setGridStyle(property, value) {
      updateStyle("grid", rendererStyle => {
        assignStyleValue(rendererStyle.grid, property, value);
      });
    },
    setHeightBandStyle(scope, patch) {
      updateStyle("height", rendererStyle => {
        if (scope === "ocean") rendererStyle.height.ocean = { ...rendererStyle.height.ocean, ...patch };
        else rendererStyle.height.land = { ...rendererStyle.height.land, ...patch };
      });
    },
    setHeightStyle(height) {
      updateStyle("height", rendererStyle => {
        rendererStyle.height = structuredClone(height);
      });
    },
    setIceStyle(section, property, value) {
      updateStyle("ice", rendererStyle => {
        assignStyleValue(rendererStyle.ice.default[section], property, value);
        for (const role of Object.values(rendererStyle.ice.roles)) assignStyleValue(role[section], property, value);
      });
    },
    setLakeStyle(role, section, property, value) {
      updateStyle("lakes", rendererStyle => {
        const next = structuredClone(rendererStyle.lakes.roles[role] ?? rendererStyle.lakes.default);
        assignStyleValue(next[section], property, value);
        rendererStyle.lakes.roles[role] = next;
      });
    },
    setLandmassStyle(property, value) {
      updateStyle("landmass", rendererStyle => {
        assignStyleValue(rendererStyle.landmass, property, value);
      });
    },
    setLayerOpacity(layer, opacity) {
      updateStyle(layer, rendererStyle => {
        rendererStyle[layer].opacity = Number(opacity);
      });
    },
    setLineStyle(layer, property, value) {
      updateStyle(layer, rendererStyle => {
        const line = layer === "cells" ? rendererStyle.cells : rendererStyle[layer].stroke;
        assignStyleValue(line, property, value);
      });
    },
    setMarketStyle(property, value) {
      updateStyle("markets", rendererStyle => {
        assignStyleValue(rendererStyle.markets, property, value);
      });
    },
    setMarkerStyle(property, value) {
      updateStyle("markers", rendererStyle => {
        assignStyleValue(rendererStyle.markers, property, value);
      });
    },
    setMilitaryStyle(property, value) {
      updateStyle("military", rendererStyle => {
        assignStyleValue(rendererStyle.military, property, value);
      });
    },
    setOceanStyle(ocean) {
      updateStyle("ocean", rendererStyle => {
        rendererStyle.ocean = structuredClone(ocean);
      });
    },
    setPopulationLineStyle(role, property, value) {
      updateStyle("population", rendererStyle => {
        assignStyleValue(rendererStyle.population[role], property, value);
      });
    },
    setReliefOpacity(opacity) {
      updateStyle("relief", rendererStyle => {
        rendererStyle.relief.opacity = Number(opacity);
      });
    },
    setRouteLineStyle(group, property, value) {
      updateStyle("routes", rendererStyle => {
        const current = rendererStyle.routes.roles[group] ?? rendererStyle.routes.default;
        const next = { ...current };
        assignStyleValue(next, property, value);
        rendererStyle.routes.roles[group] = next;
      });
    },
    setTemperatureStyle(patch) {
      updateStyle("temperature", rendererStyle => {
        rendererStyle.temperature = { ...rendererStyle.temperature, ...patch };
      });
    },
    setTextureStyle(texture) {
      updateStyle("texture", rendererStyle => {
        rendererStyle.texture = structuredClone(texture);
      });
    },
    serializeLegacyPreset() {
      return serializeMapStyleToLegacyPreset(
        getMapRendererStyle(style),
        options.burgs.groups.map(group => group.name)
      );
    }
  };
  window.MapStyleControls = controls;
}

function updateStyle(
  layer: PixiOwnedLayer,
  update: (rendererStyle: ReturnType<typeof getMapRendererStyle>) => void
): void {
  const rendererStyle = getMapRendererStyle(style);
  update(rendererStyle);
  style.mapRenderer = rendererStyle;
  invalidatePixiRendererLayer(layer);
}

function assignStyleValue<T extends object>(target: T, property: string | number | symbol, value: StyleValue): void {
  (target as Record<PropertyKey, StyleValue>)[property] = value;
}
