/**
 * source.ts — the read model Total War's layers draw from.
 *
 * The layers never touch FMG's data structures. They ask a `TwSource` for
 * regions, settlements, armies and paths, and that is the whole contract — so
 * *where* the data comes from is one decision, in one file.
 *
 * Phase A ships `sourceFromFmg()`: a presentation-only projection of FMG's own
 * world (provinces → regions, burgs → settlements, FMG regiments grouped by army
 * id → armies). It is not a campaign: there is no simulation, no ownership change
 * and no men-at-arms accounting, and nothing here may pretend otherwise.
 *
 * Phase B replaces it with `sourceFromPack()` over the compiled campaign pack.
 * The renderers do not change when that happens, which is the entire reason this
 * interface exists — and the reason Phase A could ship real layers with zero
 * engine work.
 */

import { maxMinorSettlementsForCells } from "../engine/compiler/index";
import { type FmgBurg, type FmgCells, type FmgProvince, type FmgState, fmgPack, worldSize } from "./fmg";

/** A campaign region. Phase A projects FMG provinces onto this shape 1:1. */
export interface TwRegion {
  id: number;
  name: string;
  /** the owner's color; the FILL normalizes it, the STROKE keeps it exactly */
  color: string;
  cells: number[];
  population: number;
  /** id of the burg that is this region's capital, if any */
  capitalId: number | null;
  /** the state that owns the region; null when the map leaves it unclaimed */
  ownerId: number | null;
  /** that state's display name, or null — never a synthesized guess */
  ownerName: string | null;
}

export interface TwSettlement {
  id: number;
  name: string;
  x: number;
  y: number;
  regionId: number;
  /** a region capital — drawn as a star, not a dot */
  capital: boolean;
  population: number;
  /** FMG's fortification tier, 0–3 */
  walls: number;
  citadel: boolean;
  port: boolean;
  /** FMG culture id → its name, as the inspector shows it */
  cultureName: string | null;
  /** FMG feature id → its name (lake, waterfall, crater…) */
  featureName: string | null;
}

interface TwArmy {
  id: string;
  name: string;
  cell: number;
  x: number;
  y: number;
  factionId: number;
  color: string;
  troops: number;
  regiments: number;
  fleet: boolean;
  /** belongs to the player's faction — the engine knows this in Phase B */
  own: boolean;
}

/** A projected movement path between two cells. Empty in Phase A. */
interface TwMovePath {
  from: [number, number];
  to: [number, number];
  color: string;
  own: boolean;
}

export interface TwSource {
  readonly width: number;
  readonly height: number;
  /** null until a world is loaded */
  readonly empty: boolean;
  regions(): TwRegion[];
  regionById(id: number): TwRegion | null;
  regionOf(cellId: number): TwRegion | null;
  settlements(): TwSettlement[];
  armies(): TwArmy[];
  movePaths(): TwMovePath[];
  cellPoint(cellId: number): [number, number] | null;
  /** the player's faction id, once an engine owns it (Phase B) */
  playerFactionId(): number | null;
}

/** The slice of FMG's pack this file reads — narrow on purpose. */
export interface TwWorld {
  width: number;
  height: number;
  cells: FmgCells;
  provinces?: FmgProvince[];
  burgs?: FmgBurg[];
  states?: FmgState[];
  /** name-bearing id tables, read only to label a settlement's culture/feature */
  cultures?: unknown[];
  features?: unknown[];
}

/** A source with no world behind it: layers render nothing rather than throw. */
export function emptySource(): TwSource {
  return {
    width: 0,
    height: 0,
    empty: true,
    regions: () => [],
    regionById: () => null,
    regionOf: () => null,
    settlements: () => [],
    armies: () => [],
    movePaths: () => [],
    cellPoint: () => null,
    playerFactionId: () => null
  };
}

/** `cells.p` is either flat [x0,y0,…] or an array of pairs; normalize to pairs. */
export function cellPoints(cells: FmgCells): number[][] {
  const p = cells.p as ArrayLike<number> | number[][];
  if (Array.isArray(p) && Array.isArray(p[0])) return p as number[][];
  const flat = p as ArrayLike<number>;
  const n = (flat.length / 2) | 0;
  const out: number[][] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = [flat[2 * i], flat[2 * i + 1]];
  return out;
}

/** FMG stores cells struct-of-arrays; a settlement's position is its burg's. */
function pointAt(points: number[][], cellId: number): [number, number] | null {
  const point = points[cellId];
  return point ? [point[0], point[1]] : null;
}

/** FMG's id-addressed name tables (cultures, features) are opaque here. */
interface FmgNamed {
  name?: string;
}

/** `list[id].name`, or null — a missing name is shown as missing, not invented. */
function nameAt(list: unknown[] | undefined, id: number | undefined | null): string | null {
  if (!list || !id) return null;
  const name = (list[id] as FmgNamed | undefined)?.name;
  return typeof name === "string" && name ? name : null;
}

/**
 * Build a `TwSource` from a world. Pure: no globals, no DOM — which is what makes
 * it unit-testable against fixtures (`test/tw-layers.test.ts`) and what lets
 * Phase B swap in a different producer without touching a renderer.
 */
export function buildSource(
  world: TwWorld,
  playerFactionId: number | null = null,
  playerFactionIds?: number[]
): TwSource {
  const points = cellPoints(world.cells);
  const provinces = (world.provinces ?? []).filter(p => p?.i && !p.removed);

  // province id → its cells and their population, from the SoA columns in one pass
  const cellsByProvince = new Map<number, number[]>();
  const popByProvince = new Map<number, number>();
  const owner = world.cells.province;
  const pop = world.cells.pop;
  if (owner) {
    for (let cell = 0; cell < owner.length; cell++) {
      const id = owner[cell];
      if (!id) continue;
      let bucket = cellsByProvince.get(id);
      if (!bucket) {
        bucket = [];
        cellsByProvince.set(id, bucket);
      }
      bucket.push(cell);
      if (pop) popByProvince.set(id, (popByProvince.get(id) ?? 0) + (pop[cell] || 0));
    }
  }

  // The owning state, resolved once: a province names its owner by id, and the
  // inspector shows that owner beside the region's name.
  const stateNames = new Map<number, string>();
  for (const state of world.states ?? []) {
    if (state?.i && !state.removed && state.name) stateNames.set(state.i, state.name);
  }

  const regionIndex = new Map<number, TwRegion>();
  const regions: TwRegion[] = provinces.map(province => {
    const ownerId = province.state && stateNames.has(province.state) ? province.state : null;
    const region: TwRegion = {
      id: province.i,
      name: province.fullName || province.name || `Province ${province.i}`,
      color: province.color || "#94a3b8",
      cells: cellsByProvince.get(province.i) ?? [],
      population: popByProvince.get(province.i) ?? 0,
      capitalId: typeof province.burg === "number" && province.burg ? province.burg : null,
      ownerId,
      ownerName: ownerId == null ? null : (stateNames.get(ownerId) ?? null)
    };
    regionIndex.set(region.id, region);
    return region;
  });

  const rankBurg = (a: FmgBurg, b: FmgBurg): number =>
    (b.population ?? 0) - (a.population ?? 0) ||
    (b.walls ?? 0) + (b.citadel ?? 0) - ((a.walls ?? 0) + (a.citadel ?? 0)) ||
    (b.port ?? 0) - (a.port ?? 0) ||
    a.i - b.i;

  const burgsByProvince = new Map<number, FmgBurg[]>();
  for (const burg of world.burgs ?? []) {
    if (!burg?.i || burg.removed) continue;
    const provId = world.cells.province?.[burg.cell] ?? 0;
    if (!provId) continue;
    let list = burgsByProvince.get(provId);
    if (!list) {
      list = [];
      burgsByProvince.set(provId, list);
    }
    list.push(burg);
  }

  const settlements: TwSettlement[] = [];
  for (const province of provinces) {
    const pBurgs = (burgsByProvince.get(province.i) ?? []).slice().sort(rankBurg);
    if (pBurgs.length === 0) continue;

    const capitalBurg =
      pBurgs.find(b => b.i === province.burg) ??
      pBurgs.find(b => isCapital(world, b)) ??
      (province.burg && province.burg > 0 ? pBurgs[0] : null);

    // One projection of a burg, whichever role it plays: the inspector reads the
    // same stats off a capital and a minor, so both must be built the same way.
    const project = (burg: FmgBurg, capital: boolean): TwSettlement => {
      const point =
        pointAt(points, burg.cell) ?? (Number.isFinite(burg.x) && Number.isFinite(burg.y) ? [burg.x, burg.y] : null);
      return {
        id: burg.i,
        name: burg.name || `Burg ${burg.i}`,
        x: point ? point[0] : 0,
        y: point ? point[1] : 0,
        regionId: province.i,
        capital,
        population: burg.population ?? 0,
        walls: burg.walls ?? 0,
        citadel: !!burg.citadel,
        port: !!burg.port,
        cultureName: nameAt(world.cultures, burg.culture),
        featureName: nameAt(world.features, burg.feature)
      };
    };

    if (capitalBurg) settlements.push(project(capitalBurg, true));

    const cellCount = cellsByProvince.get(province.i)?.length ?? 0;
    const maxMinors = maxMinorSettlementsForCells(cellCount);
    const minors = pBurgs.filter(b => b !== capitalBurg).slice(0, maxMinors);

    for (const b of minors) settlements.push(project(b, false));
  }

  const armies = armiesFromRegiments(world, points, playerFactionId, playerFactionIds);

  return {
    width: world.width,
    height: world.height,
    empty: regions.length === 0,
    regions: () => regions,
    regionById: id => regionIndex.get(id) ?? null,
    regionOf: cellId => (cellId < 0 ? null : (regionIndex.get(world.cells.province?.[cellId] ?? 0) ?? null)),
    settlements: () => settlements,
    armies: () => armies,
    // Phase A has no campaign, so nothing is moving. The layer is registered and
    // toggleable now so the wiring is proven before there is anything to draw.
    movePaths: () => [],
    cellPoint: cellId => pointAt(points, cellId),
    playerFactionId: () => playerFactionId
  };
}

/** A burg is a capital when it is a state's or its province's. */
function isCapital(world: TwWorld, burg: FmgBurg): boolean {
  if (burg.capital) return true;
  return (world.provinces ?? []).some(province => province && province.burg === burg.i);
}

/**
 * FMG 1.154 keeps regiments on their state (`states[i].military`), tagged with an
 * army id (`a`) and troop count (`t`), with `n` marking naval regiments. Grouping
 * them by `a` gives the same "an army sits on a cell with N men" shape the
 * campaign engine will produce in Phase B — from the editor's own data, with no
 * simulation and no engine.
 */
function armiesFromRegiments(
  world: TwWorld,
  points: number[][],
  playerFactionId: number | null,
  playerFactionIds?: number[]
): TwArmy[] {
  const armies: TwArmy[] = [];
  const isOwn = (fid: number): boolean => {
    if (playerFactionIds && playerFactionIds.length > 0) return playerFactionIds.includes(fid);
    if (playerFactionIds && playerFactionIds.length === 0) return false;
    return playerFactionId != null && fid === playerFactionId;
  };

  for (const state of world.states ?? []) {
    if (!state || state.removed) continue;
    for (const regiment of state.military ?? []) {
      const troops = regiment.a || regiment.t || 0;
      const point = pointAt(points, regiment.cell);
      const regId = regiment.i ?? 0;
      armies.push({
        id: `fm-${state.i}-${regId}`,
        name: regiment.name || `${state.name || "State"} regiment ${regId}`,
        cell: regiment.cell,
        x: point ? point[0] : regiment.x,
        y: point ? point[1] : regiment.y,
        factionId: state.i,
        color: state.color || "#94a3b8",
        troops,
        regiments: 1,
        fleet: !!regiment.n,
        own: isOwn(state.i)
      });
    }
  }
  return armies.sort((a, b) => a.id.localeCompare(b.id));
}

import { currentSession } from "../store/session";

/** The live projection of whatever world FMG currently has loaded. */
export function sourceFromFmg(): TwSource {
  const pack = fmgPack();
  const size = worldSize();
  if (!pack || !size) return emptySource();
  const live = currentSession();
  const campaign = live?.store?.state;
  return buildSource(
    {
      width: size[0],
      height: size[1],
      cells: pack.cells,
      provinces: pack.provinces,
      burgs: pack.burgs,
      states: pack.states,
      cultures: pack.cultures,
      features: pack.features
    },
    campaign?.factionId ?? null,
    campaign?.playerFactionIds
  );
}
