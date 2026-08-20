export interface SemanticFillStyle {
  color: string;
  opacity: number;
}

export interface CellLayerStyle {
  fallbackColor: string;
  opacity: number;
}

export interface SemanticLineStyle {
  cap: CanvasLineCap;
  color: string;
  dash: string;
  opacity: number;
  width: number;
}

export interface MapStyle {
  biomes: CellLayerStyle;
  borders: {
    province: SemanticLineStyle;
    state: SemanticLineStyle;
  };
  landmass: SemanticFillStyle;
  ocean: SemanticFillStyle;
  relief: { opacity: number };
  states: CellLayerStyle;
}

export type PixiMapSemanticStyle = MapStyle;

export const DEFAULT_PIXI_MAP_STYLE: Readonly<MapStyle> = {
  biomes: { fallbackColor: "#888888", opacity: 1 },
  borders: {
    province: { cap: "butt", color: "#777777", dash: "", opacity: 1, width: 0.5 },
    state: { cap: "butt", color: "#555555", dash: "", opacity: 1, width: 1 }
  },
  landmass: { color: "#eef6fb", opacity: 1 },
  ocean: { color: "#466eab", opacity: 1 },
  relief: { opacity: 1 },
  states: { fallbackColor: "#888888", opacity: 1 }
};

export const normalizeOpacity = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
