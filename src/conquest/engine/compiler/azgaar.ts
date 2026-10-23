/**
 * Raw Azgaar FMG v1.154 export shapes — only the fields the compiler reads.
 * Everything is defensive: layers may be missing between generator versions.
 */

interface AzgaarInfo {
  version: string;
  mapName: string;
  seed: string;
  mapId: number;
  width: number;
  height: number;
}

interface AzgaarSettings {
  populationRate: number;
  urbanization: number;
  distanceScale: number;
}

export interface AzgaarCell {
  i: number;
  v: number[];
  c: number[];
  p: [number, number];
  h: number;
  area: number;
  /** Water feature id. */
  f: number;
  haven: number;
  harbor: number;
  /** River flux. */
  fl: number;
  /** River id. */
  r: number;
  biome: number;
  /**
   * Goods cluster id — Azgaar's spatial index of economically-similar cells.
   * Carried for Phase 3/4 fidelity; the Phase 2 specialties pass derives from
   * `pack.goods[].biomeOutput` instead, which is structured data rather than a
   * rule expression (see ECONOMY-PLAN §3 Phase 2).
   */
  g: number;
  /** State id. */
  s: number;
  pop: number;
  culture: number;
  burg: number;
  state: number;
  religion: number;
  province: number;
}

interface AzgaarBiome {
  i: number;
  name: string;
  habitability: number;
  cost: number;
}

export interface AzgaarBurg {
  i: number;
  cell: number;
  x: number;
  y: number;
  name: string;
  state: number;
  culture: number;
  capital: 0 | 1;
  port: 0 | 1;
  population: number;
  citadel: 0 | 1;
  walls: 0 | 1;
  temple: 0 | 1;
  market: number;
}

export interface AzgaarProvince {
  i: number;
  state: number;
  center: number;
  burg: number;
  name: string;
  fullName: string;
}

export interface AzgaarState {
  i: number;
  name: string;
  fullName: string;
  form: string;
  formName: string;
  color: string;
  capital: number;
  center: number;
  culture: number;
  rosterId?: string;
  expansionism: number;
  treasury: number;
  /** Azgaar sales tax (0–1) — taken on deals this state sells. */
  salesTax: number;
  /** Azgaar poll tax — a flat per-capita levy over the state's population. */
  pollTax: number;
  neighbors: number[];
  provinces: number[];
  cells: number;
  diplomacy: (string | string[])[];
  campaigns: { name: string; start: number; end?: number; attacker: number; defender: number }[];
  military: AzgaarRegiment[];
}

interface AzgaarRegiment {
  i: number;
  a: number;
  cell: number;
  x: number;
  y: number;
  u: { infantry?: number; archers?: number; cavalry?: number; artillery?: number; fleet?: number };
  /** 0 = land regiment, 1 = fleet. */
  n: 0 | 1;
  name: string;
  state: number;
}

export interface AzgaarCulture {
  i: number;
  name: string;
  /** nameBase index used for naming. */
  base: number;
}

interface AzgaarFeature {
  i: number;
  type: "ocean" | "lake" | "island";
}

interface AzgaarRoute {
  i: number;
  group: "roads" | "trails" | "searoutes";
  points: [number, number, number][]; // [x, y, cellId]
}

interface AzgaarMarker {
  i: number;
  type: string;
  name: string;
  cell: number;
  x: number;
  y: number;
  note?: string;
}

interface AzgaarZone {
  i: number;
  name: string;
  type: string;
  cells: number[];
}

interface AzgaarNameBase {
  i: number;
  name: string;
  /** Comma-separated settlement name pool. */
  b: string;
  /** Comma-separated ruler name pool (may be empty). */
  m: string | number;
}

export interface AzgaarMap {
  info: AzgaarInfo;
  settings: AzgaarSettings;
  pack: {
    cells: Record<string, AzgaarCell>;
    features: Record<string, AzgaarFeature>;
    biomes: (AzgaarBiome | 0)[];
    cultures: (AzgaarCulture | 0)[];
    burgs: (AzgaarBurg | 0)[];
    states: (AzgaarState | 0)[];
    provinces: (AzgaarProvince | 0)[];
    religions: (AzgaarReligion | 0)[];
    routes: Record<string, AzgaarRoute>;
    markers: AzgaarMarker[];
    zones: AzgaarZone[];
    /** Azgaar's economy simulation — 71 goods on a stock map (ECONOMY-PLAN Phase 2). */
    goods: AzgaarGood[];
  };
  nameBases: AzgaarNameBase[];
}

/**
 * One trade good from `pack.goods`.
 *
 * Only a subset of goods carry `biomeOutput` — 16 of 71 on the sample world —
 * and those are the ones that say *where* the good comes from in structured
 * form. The other 55 express placement only through `distribution`, which is a
 * small rule language (`biome(3,4) && shore(1)`); parsing that is out of scope
 * for Phase 2 and would be guesswork. Those goods simply have no `biomeOutput`
 * and never become a regional specialty.
 */
export interface AzgaarGood {
  i: number;
  name: string;
  tags: string[];
  /** Base trade value. */
  value: number;
  /** Relative chance of being generated at all. */
  chance: number;
  /** Azgaar placement rule expression, e.g. `"biome(5, 6, 7, 8, 9)"`. */
  distribution?: string;
  /** biome id → output multiplier. Absent for most goods. */
  biomeOutput?: Record<string, number>;
  multipliers?: Record<string, unknown>;
}

export interface AzgaarReligion {
  i: number;
  name: string;
  type: string;
}
