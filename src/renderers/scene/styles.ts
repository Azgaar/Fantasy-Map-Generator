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

export interface SemanticAreaStyle {
  fill: SemanticFillStyle;
  stroke: SemanticLineStyle;
}

export interface SemanticRoleStyles<T> {
  default: T;
  roles: Record<string, T>;
}

export interface ZoneLayerStyle {
  fallbackColor: string;
  filterType: string | null;
  opacity: number;
  stroke: SemanticLineStyle;
}

export interface GridLayerStyle {
  dx: number;
  dy: number;
  opacity: number;
  scale: number;
  stroke: SemanticLineStyle;
  type: GridPatternType;
}

export interface MapStyle {
  biomes: CellLayerStyle;
  borders: {
    province: SemanticLineStyle;
    state: SemanticLineStyle;
  };
  coastline: SemanticRoleStyles<SemanticLineStyle>;
  cells: SemanticLineStyle;
  cultures: CellLayerStyle;
  grid: GridLayerStyle;
  lakes: SemanticRoleStyles<SemanticAreaStyle>;
  landmass: SemanticFillStyle;
  ocean: SemanticFillStyle;
  provinces: CellLayerStyle;
  relief: { opacity: number };
  religions: CellLayerStyle;
  states: CellLayerStyle;
  zones: ZoneLayerStyle;
}

export type PixiMapSemanticStyle = MapStyle;

export const DEFAULT_PIXI_MAP_STYLE: Readonly<MapStyle> = {
  biomes: { fallbackColor: "#888888", opacity: 1 },
  borders: {
    province: { cap: "butt", color: "#777777", dash: "", opacity: 1, width: 0.5 },
    state: { cap: "butt", color: "#555555", dash: "", opacity: 1, width: 1 }
  },
  coastline: {
    default: { cap: "round", color: "#1f3846", dash: "", opacity: 0.5, width: 0.5 },
    roles: {
      lake_island: { cap: "round", color: "#7c8eaf", dash: "", opacity: 1, width: 0.35 },
      sea_island: { cap: "round", color: "#1f3846", dash: "", opacity: 0.5, width: 0.5 }
    }
  },
  cells: { cap: "butt", color: "#808080", dash: "", opacity: 1, width: 0.1 },
  cultures: { fallbackColor: "#888888", opacity: 0.6 },
  grid: {
    dx: 0,
    dy: 0,
    opacity: 0.8,
    scale: 1,
    stroke: { cap: "butt", color: "#777777", dash: "", opacity: 1, width: 0.5 },
    type: "pointyHex"
  },
  lakes: {
    default: {
      fill: { color: "#a6c1fd", opacity: 0.5 },
      stroke: { cap: "round", color: "#5f799d", dash: "", opacity: 1, width: 0.7 }
    },
    roles: {
      dry: {
        fill: { color: "#c9bfa7", opacity: 1 },
        stroke: { cap: "round", color: "#8e816f", dash: "", opacity: 1, width: 0.7 }
      },
      freshwater: {
        fill: { color: "#a6c1fd", opacity: 0.5 },
        stroke: { cap: "round", color: "#5f799d", dash: "", opacity: 1, width: 0.7 }
      },
      frozen: {
        fill: { color: "#cdd4e7", opacity: 0.95 },
        stroke: { cap: "round", color: "#cfe0eb", dash: "", opacity: 1, width: 0 }
      },
      lava: {
        fill: { color: "#90270d", opacity: 0.7 },
        stroke: { cap: "round", color: "#f93e0c", dash: "", opacity: 1, width: 2 }
      },
      salt: {
        fill: { color: "#409b8a", opacity: 0.5 },
        stroke: { cap: "round", color: "#388985", dash: "", opacity: 1, width: 0.7 }
      },
      sinkhole: {
        fill: { color: "#5bc9fd", opacity: 1 },
        stroke: { cap: "round", color: "#53a3b0", dash: "", opacity: 1, width: 0.7 }
      }
    }
  },
  landmass: { color: "#eef6fb", opacity: 1 },
  ocean: { color: "#466eab", opacity: 1 },
  provinces: { fallbackColor: "#888888", opacity: 0.7 },
  relief: { opacity: 1 },
  religions: { fallbackColor: "#888888", opacity: 0.7 },
  states: { fallbackColor: "#888888", opacity: 0.4 },
  zones: {
    fallbackColor: "#888888",
    filterType: null,
    opacity: 0.6,
    stroke: { cap: "butt", color: "#333333", dash: "", opacity: 1, width: 0 }
  }
};

export const normalizeOpacity = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
import type { GridPatternType } from "./layers/grid-scene";
