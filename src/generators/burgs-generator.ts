import { quadtree } from "d3-quadtree";
import { AUTO_BURG_LIMIT } from "@/components/options-schema";
import { Emblems } from "@/generators/emblems-generator";
import { buildSettlemakerUrl } from "@/services/previews/settlemaker";
import type { BurgGroup } from "@/types/burg-groups";
import type { Emblem } from "@/types/emblems";
import { safeParseJSON } from "@/utils/stringUtils";
import { each, gauss, minmax, normalize, P, rn } from "../utils";
import { buildBurgContext } from "./burg-context";
import { type CultureType, DEFAULT_CULTURE_TYPE } from "./cultures-generator";
import { NON_NAVIGABLE_LAKE_GROUPS } from "./features";
import type { Label } from "./labels-generator";
import { Population } from "./population-generator";
import type { ProductionRecord } from "./production-generator";
import type { River } from "./river-generator";
import type { Point } from "./voronoi";

export const isAutoBurgLimit = (): boolean => options.generation.burgs.limit === AUTO_BURG_LIMIT;

export interface Burg {
  cell: number;
  x: number;
  y: number;
  i: number;
  state?: number;
  culture?: number;
  name?: string;
  feature?: number;
  capital?: number;
  lock?: boolean;
  port?: number;
  removed?: boolean;
  population?: number;
  type?: CultureType;
  coa?: Emblem;
  citadel?: number;
  plaza?: number;
  walls?: number;
  shanty?: number;
  temple?: number;
  group?: string;
  link?: string;
  MFCG?: string;
  settlementType?: string;
  isLargePort?: boolean;
  isRegionalCenter?: boolean;
  basePopulation?: number;
  flying?: number;
  skyPort?: number;
  altitude?: number;
  tradeRole?: "hub" | "waystation";
  tradeRoleManual?: boolean;
  production?: ProductionRecord[]; // per-burg production/trade records from the last production run
  product?: number; // gross product from the last production run
  treasury?: number; // accumulated cash balance
  market?: number;
  label?: Label;
  note?: string;
}

// Cultural spacing modifiers for settlement placement
const CULTURE_SPACING_MODIFIERS: Record<string, number> = {
  Naval: 0.7,
  Nomadic: 1.5,
  River: 0.6,
  Lake: 0.8,
  Highland: 1.2,
  Hunting: 1.3,
  Generic: 1.0
};

export function skyburgGroupFromPopulation(population: number): string {
  if (population >= 0.8) return "skyburg";
  if (population >= 0.4) return "skyburg-mid";
  return "skyburg-small";
}

// Flying-burg altitude in feet above the local surface (ground or sea).
// Population-scaled: tiny settlements hover low, the largest sky cities ride
// high. Linear from 50 ft at the 0.1-unit floor to 500 ft at 1.5+ units,
// rounded to 10 ft.
export function skyburgAltitude(population: number): number {
  const t = Math.min(Math.max((population - 0.1) / 1.4, 0), 1);
  return Math.round((50 + 450 * t) / 10) * 10;
}

// Acceptance weight for a skyburg candidate by the cell's distance-to-coast
// field (cells.t): hug coastlines and islands, thin out over open ocean and
// deep inland.
export function skyburgPlacementWeight(t: number): number {
  const d = Math.abs(t);
  if (d === 1) return 1;
  if (d === 2) return 0.5;
  return 0.15;
}

// --- Multi-burg-per-cell slot rules ------------------------------------------
// `pack.cells.burg` holds at most ONE ground burg per cell — the "primary".
// Additional ground burgs and all flying burgs live only in pack.burgs (each
// carries its own .cell) and never own the slot. Invariant: a cell has >=1
// ground burg <=> its slot is non-zero.

// Slot value for a cell after `burg` is removed or relocated away. Only the
// slot owner releases it; a co-located ground burg (if any) is promoted.
export function cellSlotAfterRemoval(currentSlot: number, burg: Burg, burgs: Burg[]): number {
  if (currentSlot !== burg.i) return currentSlot;
  const successor = burgs.find(b => b.i && !b.removed && !b.flying && b.i !== burg.i && b.cell === burg.cell);
  return successor ? successor.i : 0;
}

// Slot value for a cell after a burg is placed on it: the first ground burg
// claims the slot; later arrivals and flying burgs leave it unchanged.
export function groundSlotOnPlacement(currentSlot: number, burgId: number, flying: boolean): number {
  if (flying) return currentSlot;
  return currentSlot || burgId;
}

// When a slot-owning burg is removed and a co-located ground burg is promoted,
// the megalopolis treasury pool moves to the promoted successor.
export function transferTreasuryOnRemoval(burg: Burg, successorId: number, burgs: Burg[]): void {
  if (!successorId || successorId === burg.i || !burg.treasury) return;
  const successor = burgs.find(b => b && b.i === successorId);
  if (!successor) return;
  successor.treasury = rn((successor.treasury || 0) + burg.treasury, 2);
  burg.treasury = 0;
}

// Id of the burg (among `ids`) closest to (ax, ay); -1 if ids is empty.
// `ids` must not include 0 — pack.burgs[0] is the numeric placeholder slot.
export function nearestBurgId(burgs: { x: number; y: number }[], ids: number[], ax: number, ay: number): number {
  let best = -1;
  let bestD = Infinity;
  for (const id of ids) {
    const b = burgs[id];
    const d = (b.x - ax) ** 2 + (b.y - ay) ** 2;
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

// A burg that could become a port on a given water body.
type PortCandidate = {
  burg: Burg;
  haven: number | null; // adjacent water cell for coastal ports; null for river ports
  portFeatureId: number; // the water/drain feature the port trades on
  landFeature: number; // the landmass the burg sits on
  preferred: boolean; // safe harbour, capital harbour, or river port — promoted unconditionally
};

class BurgModule {
  shift() {
    const { cells, features, burgs } = pack;
    const temp = grid.cells.temp;

    // port is a capital with any harbor OR any burg with a safe harbor
    // safe harbor is a cell having just one adjacent water cell
    const featurePortCandidates: Record<number, Burg[]> = {};
    for (const burg of burgs) {
      if (!burg.i || burg.lock) continue;
      if (burg.flying) continue; // skip flying burgs
      delete burg.port; // reset port status
      const cellId = burg.cell;

      const haven = cells.haven[cellId];
      const harbor = cells.harbor[cellId];
      const featureId = cells.f[haven];
      if (!featureId) continue; // no adjacent water body

      const isMulticell = features[featureId].cells > 1;
      const isHarbor = (harbor && burg.capital) || harbor === 1;
      const isFrozen = temp[cells.g[cellId]] <= 0;

      if (isMulticell && isHarbor && !isFrozen) {
        if (!featurePortCandidates[featureId]) featurePortCandidates[featureId] = [];
        featurePortCandidates[featureId].push(burg);
      }
    }

    const getCloseToEdgePoint = (cell1: number, cell2: number) => {
      const { cells, vertices } = pack;

      const [x0, y0] = cells.p[cell1];
      const commonVertices = cells.v[cell1].filter(vertex => vertices.c[vertex].some(cell => cell === cell2));
      const [x1, y1] = vertices.p[commonVertices[0]];
      const [x2, y2] = vertices.p[commonVertices[1]];
      const xEdge = (x1 + x2) / 2;
      const yEdge = (y1 + y2) / 2;

      const x = rn(x0 + 0.95 * (xEdge - x0), 2);
      const y = rn(y0 + 0.95 * (yEdge - y0), 2);

      return [x, y];
    };

    // shift ports to the edge of the water body
    Object.entries(featurePortCandidates).forEach(([featureId, burgs]) => {
      if (burgs.length < 2) return; // only one port on water body - skip
      burgs.forEach(burg => {
        burg.port = Number(featureId);
        const haven = cells.haven[burg.cell];
        const [x, y] = getCloseToEdgePoint(burg.cell, haven);
        burg.x = x;
        burg.y = y;
      });
    });

    // shift non-port river burgs a bit
    for (const burg of burgs) {
      if (!burg.i || burg.lock || burg.port || burg.flying || !cells.r[burg.cell]) continue;
      const cellId = burg.cell;
      const shift = Math.min(cells.fl[cellId] / 150, 1);
      burg.x = cellId % 2 ? rn(burg.x + shift, 2) : rn(burg.x - shift, 2);
      burg.y = cells.r[cellId] % 2 ? rn(burg.y + shift, 2) : rn(burg.y - shift, 2);
    }
  }

  private getCultureSpacingModifier(cultureType: string): number {
    return CULTURE_SPACING_MODIFIERS[cultureType] || 1.0;
  }

  generate() {
    const { cells } = pack;

    let burgs: Burg[] = [0 as any]; // burgs array
    cells.burg = new Uint32Array(cells.i.length);

    const populatedCells = cells.i.filter(i => cells.s[i] > 0 && cells.culture[i]);
    if (!populatedCells.length) {
      ERROR && console.error("There is no populated cells with culture assigned. Cannot generate states");
      pack.burgs = burgs;
      return burgs;
    }

    let burgsQuadtree = quadtree();

    // Scratch buffers shared across all placement tiers — allocate once,
    // refill in-place per tier. Avoids 7 × O(C) JS-array + typed-array
    // allocation cycles in the GC heap.
    const score = new Float32Array(cells.s.length);
    // Array.from — populatedCells may be a typed array at runtime (despite
    // PackedGraph.cells.i: number[] in the .d.ts). Plain array gives us a
    // mutable .length for the per-pass compaction below.
    const sortedScratch: number[] = Array.from(populatedCells);

    const refillScore = (randomize: (s: number) => number) => {
      for (let i = 0; i < cells.s.length; i++) score[i] = cells.s[i] * randomize(1);
    };

    const sortByScore = () => {
      sortedScratch.sort((a, b) => score[b] - score[a]);
      return sortedScratch;
    };

    const generateCapitals = () => {
      refillScore(() => 0.5 + Math.random() * 0.5);
      const sorted = sortByScore();

      const capitalsNumber = getCapitalsNumber();
      let spacing = (options.map.graph.width + options.map.graph.height) / 2 / capitalsNumber; // min distance between capitals

      for (let i = 0; burgs.length <= capitalsNumber; i++) {
        const cell = sorted[i];
        const [x, y] = cells.p[cell];

        if (burgsQuadtree.find(x, y, spacing) === undefined) {
          burgs.push({ cell, x, y, i: burgs.length, settlementType: "capital" });
          burgsQuadtree.add([x, y]);
        }

        // reset if all cells were checked
        if (i === sorted.length - 1) {
          WARN && console.warn("Cannot place capitals with current spacing. Trying again with reduced spacing");
          burgsQuadtree = quadtree();
          i = -1;
          burgs = [0 as any];
          spacing /= 1.2;
        }
      }

      burgs.forEach((burg, burgId) => {
        if (!burgId) return;
        burg.i = burgId;
        burg.state = burgId;
        burg.culture = cells.culture[burg.cell];
        burg.name = Names.getCultureShort(burg.culture);
        burg.feature = cells.f[burg.cell];
        burg.capital = 1;
        burg.skyPort = 1; // capitals double as airroute hubs for the flying islands
        cells.burg[burg.cell] = burgId;
      });
    };

    const identifyLargePorts = () => {
      // Identify strategic harbor cities among existing capitals that are ports
      // and place additional large port burgs at key coastal locations
      const portCells = populatedCells.filter(i => {
        if (cells.burg[i]) return false; // already has a burg
        const haven = cells.haven[i];
        if (!haven) return false;
        const harbor = cells.harbor[i];
        return harbor === 1 && cells.s[i] > 3; // safe harbor with decent population
      });

      if (!portCells.length) return;

      refillScore(() => 0.6 + Math.random() * 0.4);
      const sorted = portCells.sort((a, b) => score[b] - score[a]);

      const targetCount = Math.max(2, Math.floor(getCapitalsNumber() * 0.5));
      const portSpacing = (options.map.graph.width + options.map.graph.height) / 2 / (targetCount * 2);
      let added = 0;

      for (let i = 0; i < sorted.length && added < targetCount; i++) {
        const cell = sorted[i];
        const [x, y] = cells.p[cell];

        if (burgsQuadtree.find(x, y, portSpacing) !== undefined) continue;

        const burgId = burgs.length;
        const culture = cells.culture[cell];
        const name = Names.getCulture(culture);
        const feature = cells.f[cell];
        burgs.push({
          cell,
          x,
          y,
          i: burgId,
          state: 0,
          culture,
          name,
          feature,
          capital: 0,
          settlementType: "largePort",
          isLargePort: true
        });
        burgsQuadtree.add([x, y]);
        cells.burg[cell] = burgId;
        added++;
      }
    };

    const placeRegionalCenters = () => {
      // Place regional centers between primary centers (capitals + large ports)
      refillScore(() => gauss(1, 2, 0, 10, 3));
      const sorted = sortByScore();

      const capitalsCount = getCapitalsNumber();
      const targetCount = Math.max(2, Math.floor(capitalsCount * 1.5));
      const baseSpacing = (options.map.graph.width + options.map.graph.height) / 2 / (capitalsCount * 3);
      let added = 0;

      for (let i = 0; i < sorted.length && added < targetCount; i++) {
        if (cells.burg[sorted[i]]) continue;
        const cell = sorted[i];
        const [x, y] = cells.p[cell];

        const culture = cells.culture[cell];
        const cultureType = pack.cultures[culture]?.type || "Generic";
        const spacingMod = this.getCultureSpacingModifier(cultureType);
        const spacing = baseSpacing * spacingMod * gauss(1, 0.3, 0.5, 1.5, 2);

        if (burgsQuadtree.find(x, y, spacing) !== undefined) continue;

        const burgId = burgs.length;
        const name = Names.getCulture(culture);
        const feature = cells.f[cell];
        burgs.push({
          cell,
          x,
          y,
          i: burgId,
          state: 0,
          culture,
          name,
          feature,
          capital: 0,
          settlementType: "regionalCenter",
          isRegionalCenter: true
        });
        burgsQuadtree.add([x, y]);
        cells.burg[cell] = burgId;
        added++;
      }
    };

    const placeMarketTowns = () => {
      // ~7% of settlements, 15-30km spacing equivalent
      refillScore(() => gauss(1, 3, 0, 20, 3));
      const sorted = sortByScore();

      const totalTarget = getTownsNumber();
      const targetCount = Math.floor(totalTarget * 0.07);
      const baseSpacing = (options.map.graph.width + options.map.graph.height) / 150 / (totalTarget ** 0.5 / 20);
      let added = 0;

      for (let i = 0; i < sorted.length && added < targetCount; i++) {
        if (cells.burg[sorted[i]]) continue;
        const cell = sorted[i];
        const [x, y] = cells.p[cell];

        const culture = cells.culture[cell];
        const cultureType = pack.cultures[culture]?.type || "Generic";
        const spacingMod = this.getCultureSpacingModifier(cultureType);
        const spacing = baseSpacing * spacingMod * gauss(1, 0.3, 0.5, 2, 2);

        if (burgsQuadtree.find(x, y, spacing) !== undefined) continue;

        const burgId = burgs.length;
        const name = Names.getCulture(culture);
        const feature = cells.f[cell];
        burgs.push({
          cell,
          x,
          y,
          i: burgId,
          state: 0,
          culture,
          name,
          feature,
          capital: 0,
          settlementType: "marketTown"
        });
        burgsQuadtree.add([x, y]);
        cells.burg[cell] = burgId;
        added++;
      }
    };

    const placeLargeVillages = () => {
      // ~12% of settlements, 8-12km spacing equivalent
      refillScore(() => gauss(1, 3, 0, 20, 3));
      const sorted = sortByScore();

      const totalTarget = getTownsNumber();
      const targetCount = Math.floor(totalTarget * 0.12);
      const baseSpacing = (options.map.graph.width + options.map.graph.height) / 150 / (totalTarget ** 0.6 / 30);
      let added = 0;

      for (let i = 0; i < sorted.length && added < targetCount; i++) {
        if (cells.burg[sorted[i]]) continue;
        const cell = sorted[i];
        const [x, y] = cells.p[cell];

        const culture = cells.culture[cell];
        const cultureType = pack.cultures[culture]?.type || "Generic";
        const spacingMod = this.getCultureSpacingModifier(cultureType);
        const spacing = baseSpacing * spacingMod * gauss(1, 0.3, 0.3, 1.8, 2);

        if (burgsQuadtree.find(x, y, spacing) !== undefined) continue;

        const burgId = burgs.length;
        const name = Names.getCulture(culture);
        const feature = cells.f[cell];
        burgs.push({
          cell,
          x,
          y,
          i: burgId,
          state: 0,
          culture,
          name,
          feature,
          capital: 0,
          settlementType: "largeVillage"
        });
        burgsQuadtree.add([x, y]);
        cells.burg[cell] = burgId;
        added++;
      }
    };

    const placeSmallVillages = () => {
      // ~20% of settlements, 3-6km spacing equivalent
      refillScore(() => gauss(1, 3, 0, 20, 3));
      const sorted = sortByScore();

      const totalTarget = getTownsNumber();
      const targetCount = Math.floor(totalTarget * 0.2);
      const baseSpacing = (options.map.graph.width + options.map.graph.height) / 150 / (totalTarget ** 0.65 / 15);
      let added = 0;

      for (let pass = 0; added < targetCount && pass < 3; pass++) {
        for (let i = 0; i < sorted.length && added < targetCount; i++) {
          if (cells.burg[sorted[i]]) continue;
          const cell = sorted[i];
          const [x, y] = cells.p[cell];

          const culture = cells.culture[cell];
          const cultureType = pack.cultures[culture]?.type || "Generic";
          const spacingMod = this.getCultureSpacingModifier(cultureType);
          const spacing = baseSpacing * spacingMod * gauss(1, 0.3, 0.2, 1.5, 2) * (1 / (pass + 1));

          if (burgsQuadtree.find(x, y, spacing) !== undefined) continue;

          const burgId = burgs.length;
          const name = Names.getCulture(culture);
          const feature = cells.f[cell];
          burgs.push({
            cell,
            x,
            y,
            i: burgId,
            state: 0,
            culture,
            name,
            feature,
            capital: 0,
            settlementType: "smallVillage"
          });
          burgsQuadtree.add([x, y]);
          cells.burg[cell] = burgId;
          added++;
        }

        // Compact: drop cells already assigned to a burg so the next pass
        // (and later tiers sharing sortedScratch) don't re-scan them.
        let w = 0;
        for (let r = 0; r < sorted.length; r++) {
          if (!cells.burg[sorted[r]]) sorted[w++] = sorted[r];
        }
        sorted.length = w;
      }
    };

    const placeHamlets = () => {
      // remaining ~60% of settlements, 1-3km spacing equivalent
      refillScore(() => gauss(1, 3, 0, 20, 3));
      const sorted = sortByScore();

      const totalTarget = getTownsNumber();
      const currentCount = burgs.length - 1; // subtract placeholder
      const targetCount = totalTarget - currentCount;
      if (targetCount <= 0) return;

      // For large totalTarget on typical maps the initial spacing is already
      // sub-pixel, so we bound by pass count (like placeSmallVillages) rather
      // than spacing magnitude — otherwise the loop never enters and 0 hamlets
      // are placed.
      let spacing = (options.map.graph.width + options.map.graph.height) / 150 / (totalTarget ** 0.7 / 66);
      let added = 0;

      for (let pass = 0; added < targetCount && pass < 10; pass++) {
        for (let i = 0; added < targetCount && i < sorted.length; i++) {
          if (cells.burg[sorted[i]]) continue;
          const cell = sorted[i];
          const [x, y] = cells.p[cell];

          const culture = cells.culture[cell];
          const cultureType = pack.cultures[culture]?.type || "Generic";
          const spacingMod = this.getCultureSpacingModifier(cultureType);
          const minSpacing = spacing * spacingMod * gauss(1, 0.3, 0.2, 2, 2);

          if (burgsQuadtree.find(x, y, minSpacing) !== undefined) continue;

          const burgId = burgs.length;
          const name = Names.getCulture(culture);
          const feature = cells.f[cell];
          burgs.push({
            cell,
            x,
            y,
            i: burgId,
            state: 0,
            culture,
            name,
            feature,
            capital: 0,
            settlementType: "hamlet"
          });
          added++;
          cells.burg[cell] = burgId;
        }

        // Compact: drop cells already assigned so the next spacing pass skips them.
        let w = 0;
        for (let r = 0; r < sorted.length; r++) {
          if (!cells.burg[sorted[r]]) sorted[w++] = sorted[r];
        }
        sorted.length = w;

        spacing *= 0.5;
      }
    };

    const generateSkyBurgs = () => {
      // Target 1% of total ground burgs, clustered around a random coastline
      // anchor so the archipelago straddles land and sea. Radius is capped to
      // a fixed map fraction so the cluster stays visually bounded, and the
      // count is capped by what actually fits at the target spacing.
      const requestedCount = Math.round((burgs.length - 1) * 0.01);
      if (requestedCount < 1) return;

      const coastalCells: number[] = [];
      for (let i = 0; i < cells.t.length; i++) {
        if (cells.t[i] === 1 || cells.t[i] === -1) coastalCells.push(i);
      }
      if (!coastalCells.length) return;

      const anchorCell = coastalCells[Math.floor(Math.random() * coastalCells.length)];
      const [ax, ay] = cells.p[anchorCell];

      const minSpacing = (options.map.graph.width + options.map.graph.height) / 400;
      const maxRadius = Math.min(options.map.graph.width, options.map.graph.height) * 0.1;
      // Hexagonal-pack capacity at minSpacing (≈0.9 density), so the count
      // can't exceed what physically fits in the cluster disc.
      const capacity = Math.floor((Math.PI * maxRadius * maxRadius * 0.9) / (minSpacing * minSpacing));
      const skyburgCount = Math.min(requestedCount, capacity);
      const radius = maxRadius;

      const skyQuadtree = quadtree();
      const placedIds: number[] = [];
      let added = 0;
      const maxAttempts = skyburgCount * 60; // weighted rejection needs more draws

      for (let attempts = 0; added < skyburgCount && attempts < maxAttempts; attempts++) {
        const theta = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius; // uniform within disc
        const x = ax + Math.cos(theta) * r;
        const y = ay + Math.sin(theta) * r;
        if (x < 0 || x > options.map.graph.width || y < 0 || y > options.map.graph.height) continue;
        if (skyQuadtree.find(x, y, minSpacing) !== undefined) continue;

        const cell = Pack.findCell(x, y) as number;
        // Terrain weighting: density traces coastlines and islands inside the
        // disc instead of a uniform circular blob.
        if (Math.random() > skyburgPlacementWeight(cells.t[cell])) continue;

        const culture = cells.culture[cell] || 0;
        const burgId = burgs.length;
        burgs.push({
          cell,
          x,
          y,
          i: burgId,
          state: 0,
          culture,
          name: Names.getCulture(culture),
          feature: cells.f[cell],
          capital: 0,
          port: 0,
          flying: 1,
          skyPort: 1,
          altitude: 500,
          settlementType: "regionalCenter"
        });
        skyQuadtree.add([x, y]);
        placedIds.push(burgId);
        added++;
      }

      // Cluster capital: the most central skyburg. createStates() later founds
      // the sky state from this capital flag. The double-cast is for the
      // burgs[0] numeric placeholder; placedIds never contains 0 (see
      // nearestBurgId's precondition), so the runtime access is safe.
      const capitalId = nearestBurgId(burgs as unknown as { x: number; y: number }[], placedIds, ax, ay);
      if (capitalId !== -1) {
        burgs[capitalId].capital = 1;
        burgs[capitalId].settlementType = "capital";
      }
    };

    // 6-stage hierarchical placement + skyburg cluster
    generateCapitals();
    identifyLargePorts();
    placeRegionalCenters();
    placeMarketTowns();
    placeLargeVillages();
    placeSmallVillages();
    placeHamlets();
    generateSkyBurgs();

    pack.burgs = burgs;
    this.assignPorts();

    function getCapitalsNumber() {
      let number = options.generation.states.limit;

      if (populatedCells.length < number * 10) {
        number = Math.floor(populatedCells.length / 10);
        WARN && console.warn(`Not enough populated cells. Generating only ${number} capitals/states`);
      }

      return number;
    }

    function getTownsNumber() {
      if (isAutoBurgLimit()) return rn(populatedCells.length / 5 / (grid.points.length / 10000) ** 0.8);
      return Math.min(options.generation.burgs.limit, populatedCells.length);
    }
  }

  getType(cellId: number, port?: number): CultureType {
    const { cells, features } = pack;

    if (port) return "Naval";

    const haven = cells.haven[cellId];
    if (haven !== undefined && features[cells.f[haven]].type === "lake") return "Lake";

    if (cells.h[cellId] > 60) return "Highland";

    if (cells.r[cellId] && cells.fl[cellId] >= 100) return "River";

    const biome = cells.biome[cellId];
    const population = cells.pop[cellId];
    if (!cells.burg[cellId] || population <= 5) {
      if (population < 5 && [1, 2, 3, 4].includes(biome)) return "Nomadic";
      if (biome > 4 && biome < 10) return "Hunting";
    }

    return DEFAULT_CULTURE_TYPE;
  }

  // Assign port feature ids to burgs and position them appropriately
  assignPorts() {
    const { cells, burgs } = pack;
    const riversById = new Map(pack.rivers.map(river => [river.i, river]));
    for (const burg of burgs) {
      if (burg.i && !burg.lock) delete burg.port;
    }

    const candidatesByWater = this.collectPortCandidates(burgs);
    for (const candidates of candidatesByWater.values()) {
      if (!candidates.length) continue;
      for (const candidate of this.selectPorts(candidates)) {
        this.promoteToPort(candidate, riversById);
      }
    }

    // Shift non-port river burgs slightly toward the bank
    for (const burg of burgs) {
      if (!burg.i || burg.lock || burg.port || !cells.r[burg.cell]) continue;
      const [x, y] = this.shiftTowardsRiverBank(burg.cell, riversById);
      burg.x = x;
      burg.y = y;
    }
  }

  // Collect every burg that could host a port, grouped by the water body
  private collectPortCandidates(burgs: Burg[]): Map<number, PortCandidate[]> {
    const { cells } = pack;
    const temp = grid.cells.temp;

    const byWater = new Map<number, PortCandidate[]>();
    const addCandidate = (candidate: PortCandidate) => {
      if (!byWater.has(candidate.portFeatureId)) byWater.set(candidate.portFeatureId, []);
      byWater.get(candidate.portFeatureId)!.push(candidate);
    };

    for (const burg of burgs) {
      if (!burg.i || burg.lock) continue;
      const haven = cells.haven[burg.cell];
      const landFeature = cells.f[burg.cell];

      if (haven) {
        // sea/lake port candidate
        const harbor = cells.harbor[burg.cell];
        if (!harbor) continue; // not actually adjacent to water
        const featureId = cells.f[haven];
        const feature = pack.features[featureId];
        if (!feature || feature.cells <= 1) continue; // no navigable water body
        if (NON_NAVIGABLE_LAKE_GROUPS.has(feature.group)) continue;
        if (temp[cells.g[burg.cell]] <= 0) continue; // frozen

        const portFeatureId =
          feature.type === "lake" && feature.outlet
            ? (Rivers.resolveLakeDrainFeature(featureId) ?? featureId)
            : featureId;
        const preferred = (harbor && Boolean(burg.capital)) || harbor === 1; // safe harbour or capital
        addCandidate({ burg, haven, portFeatureId, landFeature, preferred });
      } else {
        // river port candidate
        if (!Rivers.isNavigable(burg.cell)) continue;
        const portFeatureId = Rivers.resolveDrainFeature(burg.cell);
        if (!portFeatureId) continue;
        addCandidate({ burg, haven: null, portFeatureId, landFeature, preferred: true });
      }
    }

    return byWater;
  }

  private selectPorts(candidates: PortCandidate[]): PortCandidate[] {
    const { cells } = pack;
    const rank = (candidate: PortCandidate) =>
      (candidate.burg.capital ? -1000 : 0) + (candidate.haven !== null ? cells.harbor[candidate.burg.cell] : 0);

    const promoted = new Set<PortCandidate>();
    for (const c of candidates) if (c.preferred) promoted.add(c);

    const byLand = new Map<number, PortCandidate[]>();
    for (const c of candidates) {
      if (!byLand.has(c.landFeature)) byLand.set(c.landFeature, []);
      byLand.get(c.landFeature)!.push(c);
    }
    for (const group of byLand.values()) {
      if (group.some(c => promoted.has(c))) continue; // landmass already has a port here
      promoted.add(group.reduce((best, c) => (rank(c) < rank(best) ? c : best)));
    }

    if (promoted.size < 2) {
      const rest = candidates.filter(c => !promoted.has(c)).sort((a, b) => rank(a) - rank(b));
      for (const c of rest) {
        promoted.add(c);
        if (promoted.size >= 2) break;
      }
    }

    if (promoted.size < 2) return []; // a sea route needs two endpoints; a lone port is useless

    return [...promoted];
  }

  private promoteToPort(candidate: PortCandidate, riversById: Map<number, River>): void {
    const { burg, haven, portFeatureId } = candidate;
    burg.port = portFeatureId;
    const [x, y] =
      haven !== null ? this.getCloseToEdgePoint(burg.cell, haven) : this.shiftTowardsRiverBank(burg.cell, riversById);
    burg.x = x;
    burg.y = y;
  }

  private getCloseToEdgePoint(cell1: number, cell2: number): [number, number] {
    const { cells, vertices } = pack;
    const [x0, y0] = cells.p[cell1];
    const commonVertices = cells.v[cell1].filter((vertex: number) =>
      vertices.c[vertex].some((c: number) => c === cell2)
    );
    const [x1, y1] = vertices.p[commonVertices[0]];
    const [x2, y2] = vertices.p[commonVertices[1]];
    const xEdge = (x1 + x2) / 2;
    const yEdge = (y1 + y2) / 2;
    return [rn(x0 + 0.95 * (xEdge - x0), 2), rn(y0 + 0.95 * (yEdge - y0), 2)];
  }

  // Move a river burg off the river centerline onto a bank
  private shiftTowardsRiverBank(cellId: number, riversById: Map<number, River>): Point {
    const { cells } = pack;
    const [x, y] = cells.p[cellId];
    const shift = Math.min(cells.fl[cellId] / 200, 0.6);

    const tangent = this.getRiverTangent(cellId, riversById);
    if (!tangent) {
      // No usable course (single-cell river, or cell missing from river path): nudge on axes
      const xShifted = cellId % 2 ? x + shift : x - shift;
      const yShifted = cells.r[cellId] % 2 ? y + shift : y - shift;
      return [rn(xShifted, 2), rn(yShifted, 2)];
    }

    // Perpendicular to the course
    const [tx, ty] = tangent;
    const length = Math.hypot(tx, ty);
    const side = cellId % 2 ? 1 : -1;
    const xShifted = x + (-ty / length) * shift * side;
    const yShifted = y + (tx / length) * shift * side;
    return [rn(xShifted, 2), rn(yShifted, 2)];
  }

  // Local river course direction at a cell
  private getRiverTangent(cellId: number, riversById: Map<number, River>): Point | null {
    const { cells } = pack;
    const river = riversById.get(cells.r[cellId]);
    if (!river) return null;

    const idx = river.cells.indexOf(cellId);
    if (idx === -1) return null;

    const prevCell = river.cells[idx - 1];
    const nextCell = river.cells[idx + 1];
    const from = prevCell !== undefined && prevCell >= 0 ? cells.p[prevCell] : cells.p[cellId];
    const to = nextCell !== undefined && nextCell >= 0 ? cells.p[nextCell] : cells.p[cellId];

    const tx = to[0] - from[0];
    const ty = to[1] - from[1];
    if (tx === 0 && ty === 0) return null;
    return [tx, ty];
  }

  private definePopulation(burg: Burg) {
    if (burg.flying) {
      // Skyburgs: small floating settlements (~100-1500 people); the sky
      // capital is the cluster's metropolis (~2k-6k). Skip the ground-route
      // connectivity modifier — flying burgs aren't on roads.
      let population = burg.capital ? gauss(3, 1.5, 2, 6) : gauss(0.6, 0.4, 0.2, 1.5);
      population += (((burg.i as number) % 100) - (burg.cell % 100)) / 1000;
      // Hard floor: never below 100 people, whatever the map's population settings
      // (the > 0 guard also covers unset globals, where the product is NaN)
      const peoplePerUnit = options.map.units.population.scale * options.map.units.population.urbanization.rate;
      const minUnits = peoplePerUnit > 0 ? 100 / peoplePerUnit : 0.1;
      population = Math.max(population, minUnits);
      burg.basePopulation = population;
      burg.population = rn(population, 3);
      return;
    }
    const sType = burg.settlementType || "hamlet";

    // Tier-based population ranges (population units, multiply by populationRate for actual people)
    // Capitals: 10k-200k (gauss: mean=50, dev=75, min=10, max=200)
    // Large ports: 5k-50k (gauss: mean=20, dev=30, min=5, max=50)
    // Regional centers: 1k-10k (gauss: mean=5.5, dev=4.5, min=1, max=10)
    // Market towns: 1k-10k (gauss: mean=5.5, dev=4.5, min=1, max=10)
    // Large villages: 200-1k (gauss: mean=0.6, dev=0.4, min=0.2, max=1)
    // Small villages: 50-500 (gauss: mean=0.275, dev=0.225, min=0.05, max=0.5)
    // Hamlets: 10-50 (gauss: mean=0.03, dev=0.02, min=0.01, max=0.05)

    let population: number;
    switch (sType) {
      case "capital":
        population = gauss(50, 75, 10, 200);
        break;
      case "largePort":
        population = gauss(20, 30, 5, 50);
        break;
      case "regionalCenter":
        population = gauss(5.5, 4.5, 1, 10);
        break;
      case "marketTown":
        population = gauss(5.5, 4.5, 1, 10);
        break;
      case "largeVillage":
        population = gauss(0.6, 0.4, 0.2, 1);
        break;
      case "smallVillage":
        population = gauss(0.275, 0.225, 0.05, 0.5);
        break;
      // biome-ignore lint/complexity/noUselessSwitchCase: hamlet listed explicitly to document the 7-tier system
      case "hamlet":
      default:
        population = gauss(0.03, 0.02, 0.01, 0.05);
        break;
    }

    // Apply connectivity modifier
    const cellId = burg.cell;
    const connectivityRate = Routes.getConnectivityRate(cellId);
    if (connectivityRate) population *= connectivityRate;

    // Unround with small offset
    population += (((burg.i as number) % 100) - (cellId % 100)) / 1000;

    burg.basePopulation = population;
    burg.population = rn(Math.max(population, 0.01), 3);
  }

  private defineEmblem(burg: Burg) {
    burg.type = this.getType(burg.cell, burg.port);

    // Only generate COA for settlements with pop > 0.5 (500 people) or capitals/ports
    if ((burg.population as number) <= 0.5 && !burg.capital && !burg.port) {
      return;
    }

    const state = pack.states[burg.state as number];
    const stateCOA = state.coa;

    let kinship = 0.25;
    if (burg.capital) kinship += 0.1;
    else if (burg.port) kinship -= 0.1;
    if (burg.culture !== state.culture) kinship -= 0.25;

    const type = burg.capital && P(0.2) ? "Capital" : burg.type === "Generic" ? "City" : burg.type;
    burg.coa = Emblems.generate(stateCOA, kinship, null, type);
    burg.coa.shield = Emblems.getShield(burg.culture!, burg.state!);
  }

  private defineFeatures(burg: Burg) {
    const pop = burg.population as number;
    const sType = burg.settlementType || "hamlet";

    // Settlement-type-based feature probabilities
    switch (sType) {
      case "capital":
        burg.citadel = 1;
        burg.plaza = 1;
        burg.walls = 1;
        burg.shanty = Number(pop > 60 || (pop > 40 && P(0.75)));
        burg.temple = Number(pop > 20 || P(0.7));
        break;
      case "largePort":
        burg.citadel = Number(P(0.6));
        burg.plaza = 1;
        burg.walls = Number(pop > 10 || P(0.7));
        burg.shanty = Number(pop > 30 && P(0.5));
        burg.temple = Number(pop > 15 || P(0.4));
        break;
      case "regionalCenter":
        burg.citadel = Number(pop > 5 && P(0.6));
        burg.plaza = Number(P(0.8));
        burg.walls = Number(pop > 5 || P(0.5));
        burg.shanty = Number(pop > 20 && P(0.3));
        burg.temple = Number(pop > 10 || P(0.5));
        break;
      case "marketTown":
        burg.citadel = Number(pop > 5 && P(0.3));
        burg.plaza = 1; // market towns always get plaza
        burg.walls = Number(pop > 5 || P(0.3));
        burg.shanty = 0;
        burg.temple = Number(pop > 5 || P(0.3));
        break;
      case "largeVillage":
        burg.citadel = Number(P(0.15));
        burg.plaza = Number(P(0.4));
        burg.walls = Number(P(0.2));
        burg.shanty = 0;
        burg.temple = Number(P(0.3));
        break;
      case "smallVillage":
        burg.citadel = Number(P(0.05));
        burg.plaza = Number(P(0.15));
        burg.walls = Number(P(0.05));
        burg.shanty = 0;
        burg.temple = Number(P(0.15));
        break;
      // biome-ignore lint/complexity/noUselessSwitchCase: hamlet listed explicitly to document the 7-tier system
      case "hamlet":
      default:
        burg.citadel = 0;
        burg.plaza = 0;
        burg.walls = 0;
        burg.shanty = 0;
        burg.temple = Number(P(0.05));
        break;
    }
  }

  /** burg assignment needs a named, ordered group and a default to fall back on: a value persisted
   * by an older build can satisfy neither and still parse */
  parseStoredGroups(stored: string | null): BurgGroup[] {
    const parsed = stored ? safeParseJSON(stored) : null;
    const groups: BurgGroup[] = Array.isArray(parsed)
      ? parsed.filter(group => typeof group?.name === "string" && typeof group?.order === "number")
      : [];
    if (!groups.length) return this.getDefaultGroups();

    this.ensureDefaultGroup(groups);
    return groups;
  }

  /** `defineGroup` assigns every burg to the default group first: without one it assigns none */
  ensureDefaultGroup(groups: BurgGroup[]): void {
    if (groups.length && !groups.some(group => group.isDefault)) groups[0].isDefault = true;
  }

  getDefaultGroups(): BurgGroup[] {
    return [
      {
        name: "capital",
        active: true,
        order: 9,
        features: { capital: true },
        preview: "settlemaker"
      },
      {
        name: "city",
        active: true,
        order: 8,
        percentile: 90,
        min: 5,
        preview: "settlemaker"
      },
      {
        name: "fort",
        active: true,
        features: { citadel: true, walls: false, plaza: false, port: false },
        order: 6,
        max: 1
      },
      {
        name: "monastery",
        active: true,
        features: { temple: true, walls: false, plaza: false, port: false },
        order: 5,
        max: 0.8
      },
      {
        name: "caravanserai",
        active: true,
        features: { port: false, plaza: true },
        order: 4,
        max: 0.8,
        biomes: [1, 2, 3]
      },
      {
        name: "trading_post",
        active: true,
        order: 3,
        features: { plaza: true },
        max: 0.8,
        biomes: [5, 6, 7, 8, 9, 10, 11, 12]
      },
      {
        name: "village",
        active: true,
        order: 2,
        min: 0.1,
        max: 2,
        preview: "settlemaker"
      },
      {
        name: "hamlet",
        active: true,
        order: 1,
        features: { plaza: false },
        max: 0.1,
        preview: "settlemaker"
      },
      {
        name: "skyburg-capital",
        active: true,
        order: 10,
        features: { flying: true }
      },
      {
        name: "skyburg",
        active: true,
        order: 10,
        features: { flying: true }
      },
      {
        name: "skyburg-mid",
        active: true,
        order: 10,
        features: { flying: true }
      },
      {
        name: "skyburg-small",
        active: true,
        order: 10,
        features: { flying: true }
      },
      {
        name: "town",
        active: true,
        order: 7,
        isDefault: true,
        preview: "settlemaker"
      }
    ];
  }

  buildPopIndex(populations: number[]): Map<number, number> {
    const map = new Map<number, number>();
    for (let i = 0; i < populations.length; i++) {
      if (!map.has(populations[i])) map.set(populations[i], i);
    }
    return map;
  }

  /** burg groups can exist without a style entry (the Burg Groups editor, presets that don't
   * list them) - without one the renderer falls back to the default group and edits never persist */
  ensureBurgGroupStyles(): void {
    const { burgIcons, anchors } = styles.burgIcons;
    const iconTemplate = burgIcons.groups.town || Object.values(burgIcons.groups)[0];
    const anchorTemplate = anchors.groups.town || Object.values(anchors.groups)[0];
    for (const { name } of options.map.burgs.groups) {
      if (!burgIcons.groups[name] && iconTemplate) burgIcons.groups[name] = structuredClone(iconTemplate);
      if (!anchors.groups[name] && anchorTemplate) anchors.groups[name] = structuredClone(anchorTemplate);
    }
  }

  defineGroup(burg: Burg, popIndex: Map<number, number>, popCount: number) {
    if (burg.lock && burg.group) {
      // locked burgs: don't change group if it still exists
      const group = options.map.burgs.groups.find(group => group.name === burg.group);
      if (group) return;
    }

    // Flying burgs: assign group by population tier for zoom-level culling
    if (burg.flying) {
      burg.group = burg.capital ? "skyburg-capital" : skyburgGroupFromPopulation(burg.population as number);
      return;
    }

    const defaultGroup = options.map.burgs.groups.find(g => g.isDefault);
    if (!defaultGroup) {
      ERROR && console.error("No default group defined");
      return;
    }
    burg.group = defaultGroup.name;
    if (burg.label?.group) delete burg.label.group;

    for (const group of options.map.burgs.groups) {
      if (!group.active) continue;
      if (group.name.startsWith("skyburg")) continue; // skip skyburg groups for non-flying burgs

      if (group.min) {
        const isFit = (burg.population as number) >= group.min;
        if (!isFit) continue;
      }

      if (group.max) {
        const isFit = (burg.population as number) <= group.max;
        if (!isFit) continue;
      }

      if (group.features) {
        const isFit = Object.entries(group.features as Record<string, boolean>).every(
          ([feature, value]) => Boolean(burg[feature as keyof Burg]) === value
        );
        if (!isFit) continue;
      }

      if (group.biomes) {
        const isFit = group.biomes.includes(pack.cells.biome[burg.cell]);
        if (!isFit) continue;
      }

      if (group.percentile) {
        const index = popIndex.get(burg.population as number) ?? -1;
        const isFit = index >= Math.floor((popCount * group.percentile) / 100);
        if (!isFit) continue;
      }

      burg.group = group.name; // apply fitting group
      return;
    }
  }

  specify() {
    TIME && console.time("specifyBurgs");

    // Per-phase cost breakdown: specifyBurgs dominates generation on dense
    // maps (~11s at 80k burgs) and one opaque number hides where it goes.
    const diag = { population: 0, emblem: 0, features: 0, popIndex: 0, groups: 0, coas: 0 };

    pack.burgs.forEach(burg => {
      if (!burg.i || burg.removed || burg.lock) return;
      let t = TIME ? performance.now() : 0;
      this.definePopulation(burg);
      if (TIME) diag.population += performance.now() - t;
      if (burg.flying) burg.altitude = skyburgAltitude(burg.population as number);
      t = TIME ? performance.now() : 0;
      this.defineEmblem(burg);
      if (TIME) {
        diag.emblem += performance.now() - t;
        if (burg.coa) diag.coas++;
      }
      t = TIME ? performance.now() : 0;
      this.defineFeatures(burg);
      if (TIME) diag.features += performance.now() - t;
    });

    let t = TIME ? performance.now() : 0;
    const populations = pack.burgs
      .filter(b => b.i && !b.removed)
      .map(b => b.population as number)
      .sort((a: number, b: number) => a - b); // ascending

    const popIndex = this.buildPopIndex(populations);
    if (TIME) diag.popIndex = performance.now() - t;

    t = TIME ? performance.now() : 0;
    pack.burgs.forEach(burg => {
      if (!burg.i || burg.removed) return;
      this.defineGroup(burg, popIndex, populations.length);
    });
    if (TIME) diag.groups = performance.now() - t;

    TIME &&
      console.log(
        `  specifyBurgs breakdown: population=${diag.population.toFixed(0)}ms`,
        `emblem=${diag.emblem.toFixed(0)}ms (${diag.coas} coas)`,
        `features=${diag.features.toFixed(0)}ms`,
        `popIndex=${diag.popIndex.toFixed(0)}ms groups=${diag.groups.toFixed(0)}ms`
      );
    TIME && console.timeEnd("specifyBurgs");
  }

  private createWatabouCityLinks(burg: Burg) {
    const cells = pack.cells;
    const { i, name, population: burgPopulation, cell } = burg;
    const burgSeed = burg.MFCG || options.map.seed + String(burg.i).padStart(4, "0");

    const sizeRaw =
      2.13 *
      ((burgPopulation! * options.map.units.population.scale) / options.map.units.population.urbanization.density) **
        0.385;
    const size = minmax(Math.ceil(sizeRaw), 6, 100);
    const population = rn(
      burgPopulation! * options.map.units.population.scale * options.map.units.population.urbanization.rate
    );

    const river = cells.r[cell] ? 1 : 0;
    const coast = Number((burg.port || 0) > 0);
    const sea = (() => {
      if (!coast || !cells.haven[cell]) return null;

      // calculate see direction: 0 = east, 0.5 = north, 1 = west, 1.5 = south
      const [x1, y1] = cells.p[cell];
      const [x2, y2] = cells.p[cells.haven[cell]];
      const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

      if (deg <= 0) return rn(normalize(Math.abs(deg), 0, 180), 2);
      return rn(2 - normalize(deg, 0, 180), 2);
    })();

    const arableBiomes = river ? [1, 2, 3, 4, 5, 6, 7, 8] : [5, 6, 7, 8];
    const farms = +arableBiomes.includes(cells.biome[cell]);

    const citadel = Number(burg.citadel ?? 0);
    const urban_castle = Number(citadel && each(2)(i as number));

    const hub = Number(Routes.isCrossroad(cell));
    const walls = Number(burg.walls ?? 0);
    const plaza = Number(burg.plaza ?? 0);
    const temple = Number(burg.temple ?? 0);
    const shantytown = Number(burg.shanty ?? 0);

    const style = "natural";

    const url = new URL("https://watabou.github.io/city-generator/");
    url.search = new URLSearchParams({
      name: name || "",
      population: population.toString(),
      size: size.toString(),
      seed: burgSeed,
      river: river.toString(),
      coast: coast.toString(),
      farms: farms.toString(),
      citadel: citadel.toString(),
      urban_castle: urban_castle.toString(),
      hub: hub.toString(),
      plaza: plaza.toString(),
      greens: plaza ? "1" : "0",
      temple: temple.toString(),
      walls: walls.toString(),
      shantytown: shantytown.toString(),
      style
    }).toString();
    if (sea) url.searchParams.append("sea", sea.toString());

    const link = url.toString();
    return { link, preview: `${link}&preview=1` };
  }

  private createWatabouVillageLinks(burg: Burg) {
    const { cells, features } = pack;
    const { i, population, cell } = burg;

    const burgSeed = options.map.seed + String(i).padStart(4, "0");
    const pop = rn(population! * options.map.units.population.scale * options.map.units.population.urbanization.rate);
    const tags = [];

    if (cells.r[cell] && cells.haven[cell]) tags.push("estuary");
    else if (cells.haven[cell] && features[cells.f[cell]].cells === 1) tags.push("island,district");
    else if (burg.port) tags.push("coast");
    else if (cells.conf[cell]) tags.push("confluence");
    else if (cells.r[cell]) tags.push("river");
    else if (pop < 200 && each(4)(cell)) tags.push("pond");

    const connectivityRate = Routes.getConnectivityRate(cell);
    tags.push(connectivityRate > 1 ? "highway" : connectivityRate === 1 ? "dead end" : "isolated");

    const biome = cells.biome[cell];
    const arableBiomes = cells.r[cell] ? [1, 2, 3, 4, 5, 6, 7, 8] : [5, 6, 7, 8];
    if (!arableBiomes.includes(biome)) tags.push("uncultivated");
    else if (each(6)(cell)) tags.push("farmland");

    const temp = grid.cells.temp[cells.g[cell]];
    if (temp <= 0 || temp > 28 || (temp > 25 && each(3)(cell))) tags.push("no orchards");

    if (!burg.plaza) tags.push("no square");
    if (burg.walls) tags.push("palisade");

    if (pop < 100) tags.push("sparse");
    else if (pop > 300) tags.push("dense");

    const width = (() => {
      if (pop > 1500) return 1600;
      if (pop > 1000) return 1400;
      if (pop > 500) return 1000;
      if (pop > 200) return 800;
      if (pop > 100) return 600;
      return 400;
    })();
    const height = rn(width / 2.05);

    const style = (() => {
      if ([1, 2].includes(biome)) return "sand";
      if (temp <= 5 || [9, 10, 11].includes(biome)) return "snow";
      return "default";
    })();

    const url = new URL("https://watabou.github.io/village-generator/");
    url.search = new URLSearchParams({
      pop: pop.toString(),
      name: burg.name || "",
      seed: burgSeed,
      width: width.toString(),
      height: height.toString(),
      style,
      tags: tags.join(",")
    }).toString();

    const link = url.toString();
    return { link, preview: `${link}&preview=1` };
  }

  private createWatabouDwellingLinks(burg: Burg) {
    const burgSeed = options.map.seed + String(burg.i).padStart(4, "0");
    const pop = rn(
      burg.population! * options.map.units.population.scale * options.map.units.population.urbanization.rate
    );

    const tags = (() => {
      if (pop > 200) return ["large", "tall"];
      if (pop > 100) return ["large"];
      if (pop > 50) return ["tall"];
      if (pop > 20) return ["low"];
      return ["small"];
    })();

    const url = new URL("https://watabou.github.io/dwellings/");
    url.search = new URLSearchParams({
      pop: pop.toString(),
      name: "",
      seed: burgSeed,
      tags: tags.join(",")
    }).toString();

    const link = url.toString();
    return { link, preview: `${link}&preview=1` };
  }

  async getPreview(burg: Burg): Promise<{ link: string | null; preview: string | null }> {
    const previewGeneratorsMap: Record<
      string,
      (
        burg: Burg
      ) => { link: string | null; preview: string | null } | Promise<{ link: string | null; preview: string | null }>
    > = {
      "watabou-city": (burg: Burg) => this.createWatabouCityLinks(burg),
      "watabou-village": (burg: Burg) => this.createWatabouVillageLinks(burg),
      "watabou-dwelling": (burg: Burg) => this.createWatabouDwellingLinks(burg),
      settlemaker: (burg: Burg) =>
        buildSettlemakerUrl(buildBurgContext(burg), {
          urbanDensity: options.map.units.population.urbanization.density,
          trade: burg.tradeRole === "hub"
        })
    };
    if (burg.link) return { link: burg.link, preview: burg.link };

    const group = options.map.burgs.groups.find(group => group.name === burg.group);
    if (!group?.preview || !previewGeneratorsMap[group.preview]) return { link: null, preview: null };

    try {
      return await previewGeneratorsMap[group.preview](burg);
    } catch (error) {
      // Never throw into the editor: a broken preview must not take the dialog down.
      ERROR && console.error("Failed to build burg preview", error);
      return { link: null, preview: null };
    }
  }

  add([x, y]: [number, number], options?: { flying?: boolean; altitude?: number }) {
    const { cells } = pack;
    const flying = Boolean(options?.flying);

    const burgId = pack.burgs.length;
    const cellId = Pack.findCell(x, y);
    const culture = cells.culture[cellId as number];
    const name = Names.getCulture(culture);
    // Flying burgs aren't tied to ground political ownership; default to neutral.
    const state = flying ? 0 : cells.state[cellId as number];
    const feature = cells.f[cellId as number];

    const burg: Burg = {
      cell: cellId as number,
      x,
      y,
      i: burgId,
      state,
      culture,
      name,
      feature,
      capital: 0,
      port: 0,
      settlementType: flying ? "regionalCenter" : "hamlet"
    };
    if (flying) {
      burg.flying = 1;
      burg.skyPort = 1;
      burg.altitude = options?.altitude ?? 500;
    }
    this.definePopulation(burg);
    this.defineEmblem(burg);
    this.defineFeatures(burg);

    const populations = pack.burgs
      .filter(b => b.i && !b.removed)
      .map(b => b.population as number)
      .sort((a: number, b: number) => a - b); // ascending

    const popIndex = this.buildPopIndex(populations);

    this.defineGroup(burg, popIndex, populations.length);

    pack.burgs.push(burg);
    // First ground burg in a cell claims the primary slot; later arrivals and
    // flying burgs coexist in the cell without owning it.
    cells.burg[cellId as number] = groundSlotOnPlacement(cells.burg[cellId as number], burgId, flying);

    if (flying) {
      Routes.rebuildAirroutes();
    } else {
      const newRoute = Routes.connect(cellId as number);
      if (newRoute && Layers.isOn("routes")) Layers.draw("routes");
    }

    window.drawBurgIcon(burg);
    return burgId;
  }

  regenerate(): void {
    const { cells, burgs, states, provinces } = pack;
    Population.rankCells();

    const newBurgs: Burg[] = [0 as unknown as Burg];
    const burgsTree = quadtree<[number, number]>();
    cells.burg = new Uint32Array(cells.i.length);
    states
      .filter(state => state.i)
      .forEach(state => {
        state.capital = 0;
      });
    provinces
      .filter(province => province.i)
      .forEach(province => {
        province.burg = 0;
      });

    const lockedBurgs = burgs.filter(burg => burg.i && !burg.removed && burg.lock);
    for (const lockedBurg of lockedBurgs) {
      const newId = newBurgs.length;
      lockedBurg.i = newId;
      newBurgs.push(lockedBurg);
      burgsTree.add([lockedBurg.x, lockedBurg.y]);
      if (!lockedBurg.flying) cells.burg[lockedBurg.cell] = newId;

      if (lockedBurg.capital && lockedBurg.state !== undefined) {
        states[lockedBurg.state].capital = newId;
        states[lockedBurg.state].center = lockedBurg.cell;
      }
    }

    const marketCenterIds = new Set(pack.markets.map(market => market.centerBurgId));
    const unlockedMarketCenters = burgs.filter(
      burg => burg.i && !burg.removed && !burg.lock && marketCenterIds.has(burg.i)
    );
    for (const centerBurg of unlockedMarketCenters) {
      const oldId = centerBurg.i;
      const newId = newBurgs.length;
      const market = pack.markets.find(market => market.centerBurgId === oldId);
      if (market) market.centerBurgId = newId;

      centerBurg.i = newId;
      newBurgs.push(centerBurg);
      burgsTree.add([centerBurg.x, centerBurg.y]);
      if (!centerBurg.flying) cells.burg[centerBurg.cell] = newId;
    }

    const score = new Int16Array(cells.s.map(value => value * Math.random()));
    const sorted = cells.i.filter(i => score[i] > 0 && cells.culture[i]).sort((a, b) => score[b] - score[a]);
    const statesCount = states.filter(state => state.i && !state.removed).length;
    const burgsCount =
      (isAutoBurgLimit()
        ? rn(sorted.length / 5 / (grid.points.length / 10000) ** 0.8)
        : options.generation.burgs.limit) + statesCount;
    const spacing = (options.map.graph.width + options.map.graph.height) / 150 / (burgsCount ** 0.7 / 66);

    for (let index = 0; index < sorted.length && newBurgs.length < burgsCount; index++) {
      const id = newBurgs.length;
      const cell = sorted[index];
      const [x, y] = cells.p[cell];
      const minDistance = spacing * gauss(1, 0.3, 0.2, 2, 2);
      if (burgsTree.find(x, y, minDistance) !== undefined) continue;

      const stateId = cells.state[cell];
      const capital = Number(Boolean(stateId && !states[stateId].capital));
      if (capital) {
        states[stateId].capital = id;
        states[stateId].center = cell;
      }

      const culture = cells.culture[cell];
      const name = Names.getCulture(culture);
      newBurgs.push({ cell, x, y, state: stateId, i: id, culture, name, capital, feature: cells.f[cell] });
      burgsTree.add([x, y]);
      cells.burg[cell] = id;
    }

    pack.burgs = newBurgs;
    this.assignPorts();

    states
      .filter(state => state.i && !state.removed && !state.capital)
      .forEach(state => {
        const [x, y] = cells.p[state.center];
        const burgId = this.add([x, y]);
        state.capital = burgId;
        state.center = pack.burgs[burgId].cell;
        const burg = pack.burgs[burgId];
        burg.state = state.i;
        burg.capital = 1;
        this.changeGroup(burg, null);
      });

    this.specify();
    Routes.regenerate();
  }

  changeGroup(burg: Burg, group: string | null = null) {
    if (group) {
      burg.group = group;
    } else {
      const validBurgs = pack.burgs.filter(b => b.i && !b.removed);
      const populations = validBurgs.map(b => b.population as number).sort((a, b) => a - b);
      const popIndex = this.buildPopIndex(populations);
      this.defineGroup(burg, popIndex, populations.length);
    }
  }

  remove(burgId: number) {
    const burg = pack.burgs[burgId];
    if (!burg) return window.tip(`Burg ${burgId} not found`, false, "error");

    const ownedSlot = pack.cells.burg[burg.cell] === burg.i;
    const newSlot = cellSlotAfterRemoval(pack.cells.burg[burg.cell], burg, pack.burgs);
    if (ownedSlot) transferTreasuryOnRemoval(burg, newSlot, pack.burgs);
    pack.cells.burg[burg.cell] = newSlot;
    burg.removed = true;
    delete burg.note;

    if (burg.coa) {
      delete burg.coa;
    }
  }
}

declare global {
  var Burgs: BurgModule;
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const Burgs = new BurgModule();

window.Burgs = Burgs;
