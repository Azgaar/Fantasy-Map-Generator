export interface SemanticFillStyle {
  color: string;
  opacity: number;
}

export interface OceanLayerStyle extends SemanticFillStyle {
  bands: {
    color: string;
    filter: string | null;
    layers: string;
    opacity: number;
  };
  pattern: {
    href: string | null;
    opacity: number;
    tileSize: number;
  };
}

export interface CellLayerStyle {
  fallbackColor: string;
  filter: string | null;
  opacity: number;
  stroke: SemanticLineStyle;
}

export interface StateLayerStyle extends CellLayerStyle {
  halo: {
    blur: number;
    opacity: number;
    width: number;
  };
}

export interface HeightBandStyle {
  curve: string;
  filter: string | null;
  opacity: number;
  relax: number;
  scheme: string;
  skip: number;
  terracing: number;
}

export interface HeightLayerStyle {
  land: HeightBandStyle;
  ocean: HeightBandStyle & { render: boolean };
}

export type TextureMask = "land" | "none" | "water";

export interface TextureLayerStyle {
  filter: string | null;
  href: string | null;
  mask: TextureMask;
  opacity: number;
  x: number;
  y: number;
}

export interface SemanticLineStyle {
  cap: CanvasLineCap;
  color: string;
  dash: string;
  join?: CanvasLineJoin;
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

export interface LabelLayerStyle {
  color: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: "bold" | "normal";
  opacity: number;
}

export interface PrecipitationLayerStyle {
  fill: SemanticFillStyle;
  opacity: number;
  stroke: SemanticLineStyle;
}

export interface TemperatureLayerStyle {
  bandOpacity: number;
  labels: LabelLayerStyle;
  opacity: number;
  stroke: SemanticLineStyle;
}

export interface RiverLayerStyle {
  fill: SemanticFillStyle;
  opacity: number;
}

export interface PointSymbolStyle {
  fill: string;
  fillOpacity: number;
  icon: string;
  opacity: number;
  size: number;
  stroke: string;
  strokeWidth: number;
}

export interface BurgLayerStyle {
  anchors: SemanticRoleStyles<PointSymbolStyle>;
  icons: SemanticRoleStyles<PointSymbolStyle>;
  opacity: number;
}

export interface MarkerLayerStyle {
  opacity: number;
  rescale: boolean;
}

export interface GoodsLayerStyle {
  burgs: {
    fill: string;
    fillOpacity: number;
    iconSize: number;
    opacity: number;
    stroke: string;
    strokeWidth: number;
    textColor: string;
  };
  cells: { opacity: number };
  icons: {
    circle: boolean;
    opacity: number;
    size: number;
    strokeWidth: number;
  };
  opacity: number;
}

export interface MarketLayerStyle {
  areaOpacity: number;
  borderOpacity: number;
  borderWidth: number;
  icon: string;
  iconSize: number;
  opacity: number;
  radius: number;
}

export interface PopulationLayerStyle {
  opacity: number;
  rural: SemanticLineStyle;
  urban: SemanticLineStyle;
}

export interface MilitaryLayerStyle {
  boxSize: number;
  fillOpacity: number;
  fontFamily: string;
  opacity: number;
  stroke: string;
  strokeWidth: number;
  textColor: string;
}

export interface CompassLayerStyle {
  opacity: number;
  scale: number;
  x: number;
  y: number;
}

export interface CoordinateLayerStyle {
  filter: string | null;
  fontColor: string;
  fontFamily: string;
  fontSize: number;
  opacity: number;
  shadowBlur: number;
  shadowColor: string;
  stroke: SemanticLineStyle;
}

export interface EmblemLayerStyle {
  automaticVisibility: boolean;
  burgSize: number;
  filter: string | null;
  opacity: number;
  provinceSize: number;
  stateSize: number;
  strokeWidth: number;
}

export interface TradeLayerStyle {
  highlight: SemanticLineStyle;
  opacity: number;
}

export interface MapStyle {
  biomes: CellLayerStyle;
  borders: {
    province: SemanticLineStyle;
    state: SemanticLineStyle;
  };
  burgIcons: BurgLayerStyle;
  coastline: SemanticRoleStyles<SemanticLineStyle>;
  compass: CompassLayerStyle;
  coordinates: CoordinateLayerStyle;
  cells: SemanticLineStyle;
  cultures: CellLayerStyle;
  emblems: EmblemLayerStyle;
  filter: string | null;
  goods: GoodsLayerStyle;
  grid: GridLayerStyle;
  height: HeightLayerStyle;
  ice: SemanticRoleStyles<SemanticAreaStyle> & { opacity: number };
  lakes: SemanticRoleStyles<SemanticAreaStyle>;
  landmass: SemanticFillStyle;
  markers: MarkerLayerStyle;
  markets: MarketLayerStyle;
  military: MilitaryLayerStyle;
  ocean: OceanLayerStyle;
  precipitation: PrecipitationLayerStyle;
  population: PopulationLayerStyle;
  provinces: CellLayerStyle;
  relief: { opacity: number };
  religions: CellLayerStyle;
  rivers: RiverLayerStyle;
  routes: SemanticRoleStyles<SemanticLineStyle>;
  states: StateLayerStyle;
  temperature: TemperatureLayerStyle;
  texture: TextureLayerStyle;
  trade: TradeLayerStyle;
  zones: ZoneLayerStyle;
}

export type PixiMapSemanticStyle = MapStyle;

export const DEFAULT_PIXI_MAP_STYLE: Readonly<MapStyle> = {
  biomes: {
    fallbackColor: "#888888",
    filter: null,
    opacity: 1,
    stroke: { cap: "round", color: "#777777", dash: "", opacity: 1, width: 0 }
  },
  borders: {
    province: { cap: "butt", color: "#777777", dash: "", opacity: 1, width: 0.5 },
    state: { cap: "butt", color: "#555555", dash: "", opacity: 1, width: 1 }
  },
  burgIcons: {
    anchors: {
      default: {
        fill: "#ffffff",
        fillOpacity: 1,
        icon: "anchor",
        opacity: 1,
        size: 1,
        stroke: "#3e3e4b",
        strokeWidth: 1.2
      },
      roles: {
        capital: {
          fill: "#ffffff",
          fillOpacity: 1,
          icon: "anchor",
          opacity: 1,
          size: 1.9,
          stroke: "#3e3e4b",
          strokeWidth: 1.2
        },
        city: {
          fill: "#ffffff",
          fillOpacity: 1,
          icon: "anchor",
          opacity: 1,
          size: 1.5,
          stroke: "#3e3e4b",
          strokeWidth: 1.2
        }
      }
    },
    icons: {
      default: {
        fill: "#ffffff",
        fillOpacity: 0.7,
        icon: "circle",
        opacity: 1,
        size: 1,
        stroke: "#3e3e4b",
        strokeWidth: 1.2
      },
      roles: {
        capital: {
          fill: "#ffffff",
          fillOpacity: 0.7,
          icon: "square",
          opacity: 1,
          size: 2,
          stroke: "#3e3e4b",
          strokeWidth: 1
        },
        caravanserai: {
          fill: "#ffffff",
          fillOpacity: 0.7,
          icon: "triangle",
          opacity: 1,
          size: 0.7,
          stroke: "#3e3e4b",
          strokeWidth: 1
        },
        city: {
          fill: "#ffffff",
          fillOpacity: 0.7,
          icon: "circle",
          opacity: 1,
          size: 1.5,
          stroke: "#3e3e4b",
          strokeWidth: 1
        },
        fort: {
          fill: "#ffffff",
          fillOpacity: 0.7,
          icon: "square",
          opacity: 1,
          size: 0.7,
          stroke: "#3e3e4b",
          strokeWidth: 1
        },
        hamlet: {
          fill: "#ffffff",
          fillOpacity: 0.7,
          icon: "circle",
          opacity: 1,
          size: 0.5,
          stroke: "#3e3e4b",
          strokeWidth: 1.2
        },
        monastery: {
          fill: "#ffffff",
          fillOpacity: 0.7,
          icon: "cross",
          opacity: 1,
          size: 0.7,
          stroke: "#3e3e4b",
          strokeWidth: 1
        },
        trading_post: {
          fill: "#ffffff",
          fillOpacity: 0.7,
          icon: "triangle",
          opacity: 1,
          size: 0.7,
          stroke: "#3e3e4b",
          strokeWidth: 1
        },
        village: {
          fill: "#ffffff",
          fillOpacity: 0.7,
          icon: "circle",
          opacity: 1,
          size: 0.7,
          stroke: "#3e3e4b",
          strokeWidth: 1.2
        }
      }
    },
    opacity: 1
  },
  coastline: {
    default: { cap: "round", color: "#1f3846", dash: "", opacity: 0.5, width: 0.5 },
    roles: {
      lake_island: { cap: "round", color: "#7c8eaf", dash: "", opacity: 1, width: 0.35 },
      sea_island: { cap: "round", color: "#1f3846", dash: "", opacity: 0.5, width: 0.5 }
    }
  },
  compass: { opacity: 0.8, scale: 0.25, x: 80, y: 80 },
  coordinates: {
    filter: null,
    fontColor: "#333333",
    fontFamily: "monospace",
    fontSize: 12,
    opacity: 1,
    shadowBlur: 4,
    shadowColor: "#ffffff",
    stroke: { cap: "butt", color: "#d4d4d4", dash: "5", opacity: 1, width: 1 }
  },
  cells: { cap: "butt", color: "#808080", dash: "", opacity: 1, width: 0.1 },
  cultures: {
    fallbackColor: "#888888",
    filter: null,
    opacity: 0.6,
    stroke: { cap: "round", color: "#777777", dash: "", opacity: 1, width: 0.5 }
  },
  emblems: {
    automaticVisibility: true,
    burgSize: 1,
    filter: null,
    opacity: 0.9,
    provinceSize: 1,
    stateSize: 1,
    strokeWidth: 1
  },
  filter: null,
  goods: {
    burgs: {
      fill: "#f5f5f5",
      fillOpacity: 1,
      iconSize: 3,
      opacity: 1,
      stroke: "#41414f",
      strokeWidth: 0.2,
      textColor: "#28282f"
    },
    cells: { opacity: 1 },
    icons: { circle: true, opacity: 1, size: 6, strokeWidth: 0.3 },
    opacity: 1
  },
  grid: {
    dx: 0,
    dy: 0,
    opacity: 0.8,
    scale: 1,
    stroke: { cap: "butt", color: "#777777", dash: "", opacity: 1, width: 0.5 },
    type: "pointyHex"
  },
  height: {
    land: {
      curve: "curveBasisClosed",
      filter: null,
      opacity: 1,
      relax: 0,
      scheme: "bright",
      skip: 5,
      terracing: 0
    },
    ocean: {
      curve: "curveBasisClosed",
      filter: null,
      opacity: 1,
      relax: 1,
      render: false,
      scheme: "bright",
      skip: 0,
      terracing: 0
    }
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
  ice: {
    default: {
      fill: { color: "#f1f8fe", opacity: 0.9 },
      stroke: { cap: "round", color: "#e8f0f6", dash: "", opacity: 1, width: 0.5 }
    },
    opacity: 1,
    roles: {
      glacier: {
        fill: { color: "#f1f8fe", opacity: 0.9 },
        stroke: { cap: "round", color: "#e8f0f6", dash: "", opacity: 1, width: 0.5 }
      },
      iceberg: {
        fill: { color: "#f1f8fe", opacity: 0.9 },
        stroke: { cap: "round", color: "#e8f0f6", dash: "", opacity: 1, width: 0.5 }
      }
    }
  },
  landmass: { color: "#eef6fb", opacity: 1 },
  markers: { opacity: 1, rescale: true },
  markets: {
    areaOpacity: 0.03,
    borderOpacity: 0.8,
    borderWidth: 1,
    icon: "⚖️",
    iconSize: 5,
    opacity: 1,
    radius: 3
  },
  military: {
    boxSize: 3,
    fillOpacity: 1,
    fontFamily: "Helvetica, Arial, sans-serif",
    opacity: 1,
    stroke: "#000000",
    strokeWidth: 0.3,
    textColor: "#ffffff"
  },
  ocean: {
    bands: { color: "#ecf2f9", filter: null, layers: "-6,-3,-1", opacity: 0.4 },
    color: "#466eab",
    opacity: 1,
    pattern: { href: null, opacity: 0.2, tileSize: 100 }
  },
  precipitation: {
    fill: { color: "#003dff", opacity: 1 },
    opacity: 1,
    stroke: { cap: "butt", color: "#000000", dash: "", opacity: 1, width: 0 }
  },
  population: {
    opacity: 1,
    rural: { cap: "butt", color: "#0000ff", dash: "", opacity: 1, width: 1.6 },
    urban: { cap: "butt", color: "#ff0000", dash: "", opacity: 1, width: 1.6 }
  },
  provinces: {
    fallbackColor: "#888888",
    filter: null,
    opacity: 0.7,
    stroke: { cap: "round", color: "#777777", dash: "", opacity: 1, width: 0 }
  },
  relief: { opacity: 1 },
  religions: {
    fallbackColor: "#888888",
    filter: null,
    opacity: 0.7,
    stroke: { cap: "round", color: "#777777", dash: "", opacity: 1, width: 0 }
  },
  rivers: { fill: { color: "#5d97bb", opacity: 1 }, opacity: 1 },
  routes: {
    default: { cap: "butt", color: "#d06324", dash: "2", opacity: 0.9, width: 0.7 },
    roles: {
      roads: { cap: "butt", color: "#d06324", dash: "2", opacity: 0.9, width: 0.7 },
      searoutes: { cap: "round", color: "#ffffff", dash: "1 2", opacity: 0.9, width: 0.35 },
      trails: { cap: "butt", color: "#d06324", dash: ".8 1.6", opacity: 0.9, width: 0.25 }
    }
  },
  states: {
    fallbackColor: "#888888",
    filter: null,
    halo: { blur: 3.5, opacity: 0.4, width: 10 },
    opacity: 0.4,
    stroke: { cap: "round", color: "#777777", dash: "", opacity: 1, width: 0 }
  },
  temperature: {
    bandOpacity: 0.3,
    labels: { color: "#000000", fontFamily: "Arial, sans-serif", fontSize: 8, fontWeight: "bold", opacity: 1 },
    opacity: 1,
    stroke: { cap: "butt", color: "#000000", dash: "", opacity: 1, width: 1.8 }
  },
  texture: {
    filter: null,
    href: null,
    mask: "land",
    opacity: 1,
    x: 0,
    y: 0
  },
  trade: {
    highlight: { cap: "round", color: "#cc1111", dash: "", opacity: 0.7, width: 0.5 },
    opacity: 1
  },
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
