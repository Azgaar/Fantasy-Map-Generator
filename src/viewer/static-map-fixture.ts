import type { PackedGraph } from "@/types/PackedGraph";

export const STATIC_VIEWER_MAP_SIZE = { height: 60, width: 100 } as const;

/** Small editor-independent fixture used to prove the standalone renderer entry. */
export const STATIC_VIEWER_WORLD = {
  addedLabels: [],
  biomes: [{}, { color: "#6f9f60" }],
  burgs: [],
  cells: {
    area: Uint8Array.from([1, 1]),
    b: [true, true],
    biome: Uint8Array.from([1, 1]),
    burg: Uint8Array.from([0, 0]),
    c: [[1], [0]],
    conf: Uint8Array.from([0, 0]),
    culture: Uint8Array.from([0, 0]),
    f: Uint8Array.from([1, 1]),
    fl: Uint8Array.from([0, 0]),
    g: [0, 0],
    good: Uint16Array.from([0, 0]),
    h: Uint8Array.from([30, 30]),
    harbor: Uint8Array.from([0, 0]),
    haven: Uint8Array.from([0, 0]),
    i: [0, 1],
    market: Uint16Array.from([0, 0]),
    p: [
      [33, 30],
      [66, 30]
    ],
    pop: Uint8Array.from([0, 0]),
    province: Uint8Array.from([0, 0]),
    r: Uint8Array.from([0, 0]),
    religion: Uint8Array.from([0, 0]),
    routes: {},
    s: Uint8Array.from([0, 0]),
    state: Uint8Array.from([1, 2]),
    t: Uint8Array.from([1, 1]),
    v: [
      [0, 1, 2],
      [0, 2, 3]
    ]
  },
  cultures: [],
  deals: [],
  features: [
    {},
    {
      border: true,
      group: "continent",
      i: 1,
      land: true,
      type: "island",
      vertices: [0, 1, 2, 3]
    }
  ],
  goods: [],
  ice: [],
  markers: [],
  markets: [],
  measurers: [],
  provinces: [],
  relief: [],
  religions: [],
  rivers: [],
  routes: [],
  states: [{}, { color: "#d18b73" }, { color: "#6e8fc7" }],
  vertices: {
    c: [
      [0, 1, -1],
      [0, -1, -1],
      [0, 1, -1],
      [1, -1, -1]
    ],
    i: [0, 1, 2, 3],
    p: [
      [0, 0],
      [100, 0],
      [100, 60],
      [0, 60]
    ],
    v: [
      [1, 3, 2],
      [0, 2, 2],
      [1, 3, 0],
      [0, 2, 2]
    ],
    x: [0, 100, 100, 0],
    y: [0, 0, 60, 60]
  },
  zones: []
} as unknown as PackedGraph;
