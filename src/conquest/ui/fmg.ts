/**
 * fmg.ts — the one place that talks to FMG's globals.
 *
 * total-war.js is a *separate bundle* from FMG's, so it cannot import FMG's
 * modules; it uses the globals FMG already exposes (`window.Layers`, `window.
 * LAYER_TOGGLES`, `window.MAP_COMMANDS` — the last two via patch P3) plus the
 * `window.ModSlot` seam from patch P2. That makes this file the single boundary
 * to re-point if an FMG upgrade moves something — and the only file that needs
 * FMG type knowledge at all.
 */

import type { HistoricalFigure } from "@/types/history";
import type { ArmyUnit } from "../engine/common/types";

/** The subset of FMG's `Layer` we use. `getEl()` is the SVG group we render into. */
export interface FmgLayer {
  id: string;
  getEl(): SVGGElement;
}

/** The subset of `LayersRegistry` we use (patch P1 adds `register`). */
export interface FmgLayersRegistry {
  register(...layers: unknown[]): void;
  show(...ids: string[]): void;
  hide(...ids: string[]): void;
  toggle(id: string): void;
  /** P1 + native: replace the active set wholesale. Accepts any registered id. */
  set(ids: readonly string[]): void;
  isOn(id: string): boolean;
  has(id: string): boolean;
  /** Redraw by id — the same call FMG's own renderers use. */
  draw(...ids: string[]): void;
  all: readonly { id: string }[];
  state: { order: string[]; active: string[] };
  subscribe(listener: () => void): () => void;
}

/** One entry of FMG's `LAYER_TOGGLES` (patch P3 publishes the table). */
export interface FmgLayerButton {
  label: string; // may contain <u> markup marking the shortcut letter
  shortcut?: string; // KeyboardEvent.code
  hint?: string;
}

/** One entry of FMG's `MAP_COMMANDS` (patch P3 publishes the array). */
export interface FmgCommand {
  id: string;
  name: string;
  aliases: string;
  run: (event?: MouseEvent) => unknown;
}

/** The `ModSlot` seam (patch P2): one extra `.map` line, ours to fill. */
interface FmgModSlot {
  register(slot: { serialize(): string; restore(raw: unknown): void }): void;
}

/** The bits of FMG's `options` we read. */
interface FmgOptions {
  map: { graph: { width: number; height: number }; name?: string };
}

/** FMG stores cells struct-of-arrays; we read these columns and no more. */
export interface FmgCells {
  /** cell CENTERS, flat [x0,y0,x1,y1…] or [x,y] pairs — not the polygon */
  p: ArrayLike<number> | number[][];
  /** the cell's polygon outline as vertex ids — pair with `vertices.p`.
   *  (FMG's own type comment calls this "neighbouring vertices", but its
   *  `Pack.getPolygon` reads it as this cell's outline, and so do we.) */
  v?: number[][];
  province?: ArrayLike<number>;
  burg?: ArrayLike<number>;
  state?: ArrayLike<number>;
  /** neighbouring cells (FMG's own adjacency) */
  c?: number[][];
  pop?: ArrayLike<number>;
  f?: ArrayLike<number>; // 1 = land
}

export interface FmgProvince {
  i: number;
  name: string;
  fullName?: string;
  color?: string;
  state?: number;
  burg?: number; // the province's capital burg
  center?: number;
  /** FMG types this as boolean, but the data carries 1/0 — so treat it as truthy */
  removed?: boolean | number;
}

export interface FmgBurg {
  i: number;
  cell: number;
  x: number;
  y: number;
  name?: string;
  state?: number;
  culture?: number;
  capital?: number;
  port?: number;
  /** FMG types this as boolean, but the data carries 1/0 — so treat it as truthy */
  removed?: boolean | number;
  population?: number;
  feature?: number;
  /** fortification tier 0–3 (none / ditch / palisade / stone wall) */
  walls?: number;
  /** 1 = citadel present */
  citadel?: number;
}

export interface FmgRegiment {
  i: number;
  a: number; // total troops
  t?: number; // legacy troops
  cell: number;
  x: number;
  y: number;
  n?: number; // naval
  name?: string;
  state?: number;
  u?: Record<string, number>;
  units?: ArmyUnit[];
  rosterId?: string;
}

export interface FmgState {
  i: number;
  name: string;
  color?: string;
  capital?: number;
  culture?: number;
  rosterId?: string;
  /** FMG types this as boolean, but the data carries 1/0 — so treat it as truthy */
  removed?: boolean | number;
  military?: FmgRegiment[];
}

interface FmgVertices {
  /** vertex coordinates, indexed by vertex id */
  p: number[][];
}

export interface FmgPack {
  cells: FmgCells;
  vertices?: FmgVertices;
  provinces?: FmgProvince[];
  burgs?: FmgBurg[];
  states?: FmgState[];
  /** The rest of the pack, read for the compiler. Index-addressed, slot 0 unused. */
  religions?: unknown[];
  features?: unknown[];
  biomes?: unknown[];
  cultures?: unknown[];
  markers?: unknown[];
  zones?: unknown[];
  routes?: Record<string, unknown>;
  nameBases?: unknown[];
  /** The map's chronicle; `figures` is the unified figure roster (unified-figures). */
  history?: { events?: unknown[]; realms?: unknown[]; eras?: unknown[]; figures?: HistoricalFigure[] };
}

/** FMG's page-global d3 (v5.8, `libs/d3.min.js`) — only the Voronoi bits are used. */
interface FmgD3 {
  Delaunay?: { from(points: number[][]): { voronoi(bounds: number[]): FmgDelaunay } };
  voronoi?: () => { extent(bounds: number[][]): { polygons(points: number[][]): (number[][] | null)[] } };
}

interface FmgDelaunay {
  cellPolygon(i: number): number[][];
  find(x: number, y: number): number;
}

/**
 * jQuery UI's dialog, which FMG loads globally (`libs/jquery-ui.min.js`).
 *
 * Called with options to open/configure, and with a command ("close", "open",
 * …) to act — the same overloads jQuery UI itself has.
 */
interface FmgJQueryDialog {
  /** open / configure with options */
  (options: Record<string, unknown>): void;
  /** act on an already-open dialog: "close", "open", "option", … */
  (command: string): void;
}

interface FmgGlobals {
  Layers: FmgLayersRegistry;
  ModSlot?: FmgModSlot;
  LAYER_TOGGLES?: Map<string, FmgLayerButton>;
  MAP_COMMANDS?: FmgCommand[];
  options?: FmgOptions;
  pack?: FmgPack;
  d3?: FmgD3;
  mapHistory?: { seed?: number | string; created?: number }[];
  mapName?: string;
  /** jQuery: accepts a selector or an element, exactly like the real thing. */
  $?: (target: string | HTMLElement) => { dialog: FmgJQueryDialog };
}

/**
 * Escape text for interpolation into HTML.
 *
 * Lives here, in the seam module, because three modules need it (the button's
 * About dialog, the rail, and the rule editors). Three private copies is three
 * chances to forget the `&`.
 */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** FMG's globals, or null before its module has evaluated. */
export function fmg(): FmgGlobals | null {
  const g = globalThis as unknown as FmgGlobals;
  return g.Layers ? g : null;
}

/** The world data, or null when no world is on screen. */
export function fmgPack(): FmgPack | null {
  const p = fmg()?.pack;
  return p?.cells?.p ? p : null;
}

/** The map's figure roster, creating the chronicle shell if absent. Null outside the page. */
export function fmgFigures(): HistoricalFigure[] | null {
  const pack = fmgPack();
  if (!pack) return null;
  pack.history ??= { events: [], realms: [], eras: [], figures: [] };
  pack.history.figures ??= [];
  return pack.history.figures;
}

/** Map dimensions, or null before a map is loaded. */
export function worldSize(): [number, number] | null {
  const graph = fmg()?.options?.map?.graph;
  return graph ? [graph.width, graph.height] : null;
}

/**
 * Run `callback` once FMG's globals exist.
 *
 * Our tag is appended to `</body>`, so in practice `Layers` is already there
 * (FMG's module script in `<head>` evaluates first). The DOMContentLoaded path is
 * the fallback for a slower/earlier evaluation, and it is also the right moment to
 * touch map DOM: FMG's own `boot()` runs on the same event, and module scripts
 * have all evaluated by then.
 */
export function whenFmgReady(callback: () => void): void {
  const go = (): void => {
    if (!fmg()) {
      setTimeout(go, 0);
      return;
    }
    callback();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go, { once: true });
  else go();
}

/** Log an OpenConquest problem without breaking FMG. */
export function twWarn(message: string, error?: unknown): void {
  console.warn(`[openconquest] ${message}`, error ?? "");
}
