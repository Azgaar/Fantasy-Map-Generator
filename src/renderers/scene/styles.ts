export interface SemanticFillStyle {
  color: string;
  opacity: number;
}

export interface CellLayerStyle {
  fallbackColor: string;
  opacity: number;
}

export interface PixiMapSemanticStyle {
  biomes: CellLayerStyle;
  landmass: SemanticFillStyle;
  ocean: SemanticFillStyle;
  relief: { opacity: number };
  states: CellLayerStyle;
}

export const DEFAULT_PIXI_MAP_STYLE: Readonly<PixiMapSemanticStyle> = {
  biomes: { fallbackColor: "#888888", opacity: 1 },
  landmass: { color: "#eef6fb", opacity: 1 },
  ocean: { color: "#466eab", opacity: 1 },
  relief: { opacity: 1 },
  states: { fallbackColor: "#888888", opacity: 1 }
};

export const normalizeOpacity = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
