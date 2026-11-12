import { greatest, least, quadtree, sum } from "d3";
import { Accounts } from "@/model/economy/accounts";
import { Goods } from "@/model/economy/goods-generator";
import { Pack } from "@/model/graph/pack-generator";
import { Icons } from "@/model/icons";
import type { MilitaryUnit } from "@/types/military";
import { nth } from "@/utils/language-utils";
import { rn, si } from "@/utils/number-utils";
import { gauss, ra, rand } from "@/utils/probability-utils";
import { findAllInQuadtree } from "@/utils/quadtree";
import { requireName, requireOneOf } from "@/utils/validation-utils";
import { getUnitPower } from "./military-units";
import { levies, type State, States } from "./states-generator";

export interface Regiment {
  i: number;
  t: number; // total troops
  name: string;
  a: number; // regiment army, in population points
  s: number; // separate flag (for fleets)
  cell: number;
  x: number;
  y: number;
  bx: number; // base x (for movement)
  by: number; // base y (for movement)
  u: Record<string, number>; // units composition, in population points
  n: number; // naval unit flag
  type: string; // unit type
  icon: string;
  children?: Regiment[]; // merged regiments
  state: number;
  angle?: number;
  px?: number; // battle-screen: position before being moved into a battle, restored afterward
  py?: number;
  note?: string;
  hidden?: boolean;
  tags?: string[];
}

interface Platoon {
  cell: number;
  a: number; // platoon army
  t: number; // total troops in platoon
  x: number;
  y: number;
  u: string; // unit type
  n: number; // naval unit flag
  s: number; // separate flag (for fleets)
  type: string; // unit type
  children?: Platoon[]; // merged platoons
}

export const UPKEEP_COST = 20; // military spending a day that keeps troops of power 1, a population point's worth
const MIN_UPKEEP = 0.05; // unpaid troops still fight, if barely
const EQUIPMENT = 0.365; // population points of troops equipped by a unit a day a state consumes of their goods
const FRONT_DEPTH = 2; // lines of cells behind the border a state at war deploys its regiments to
const REACH = 150; // how far a platoon joins a regiment of another landmass, map units
const REGIMENT_SIZE = 3; // regiment box height at the default style, map units; layout ignores the style
// what the unit's forces are raised by: a change of any calls for raising them anew
const RAISING = ["rural", "urban", "type", "separate", "biomes", "states", "cultures", "religions", "goods"] as const;

const STATE_MODIFIER = {
  melee: {
    Nomadic: 0.5,
    Highland: 1.2,
    Lake: 1,
    Naval: 0.7,
    Hunting: 1.2,
    River: 1.1
  },
  ranged: {
    Nomadic: 0.9,
    Highland: 1.3,
    Lake: 1,
    Naval: 0.8,
    Hunting: 2,
    River: 0.8
  },
  mounted: {
    Nomadic: 2.3,
    Highland: 0.6,
    Lake: 0.7,
    Naval: 0.3,
    Hunting: 0.7,
    River: 0.8
  },
  machinery: {
    Nomadic: 0.8,
    Highland: 1.4,
    Lake: 1.1,
    Naval: 1.4,
    Hunting: 0.4,
    River: 1.1
  },
  naval: {
    Nomadic: 0.5,
    Highland: 0.5,
    Lake: 1.2,
    Naval: 1.8,
    Hunting: 0.7,
    River: 1.2
  },
  armored: {
    Nomadic: 1,
    Highland: 0.5,
    Lake: 1,
    Naval: 1,
    Hunting: 0.7,
    River: 1.1
  },
  aviation: {
    Nomadic: 0.5,
    Highland: 0.5,
    Lake: 1.2,
    Naval: 1.2,
    Hunting: 0.6,
    River: 1.2
  },
  magical: {
    Nomadic: 1,
    Highland: 2,
    Lake: 1,
    Naval: 1,
    Hunting: 1,
    River: 1
  }
};

const CELL_MODIFIER = {
  nomadic: {
    melee: 0.2,
    ranged: 0.5,
    mounted: 3,
    machinery: 0.4,
    naval: 0.3,
    armored: 1.6,
    aviation: 1,
    magical: 0.5
  },
  wetland: {
    melee: 0.8,
    ranged: 2,
    mounted: 0.3,
    machinery: 1.2,
    naval: 1.0,
    armored: 0.2,
    aviation: 0.5,
    magical: 0.5
  },
  highland: {
    melee: 1.2,
    ranged: 1.6,
    mounted: 0.3,
    machinery: 3,
    naval: 1.0,
    armored: 0.8,
    aviation: 0.3,
    magical: 2
  }
};

const BURG_MODIFIER = {
  nomadic: {
    melee: 0.3,
    ranged: 0.8,
    mounted: 3,
    machinery: 0.4,
    naval: 1.0,
    armored: 1.6,
    aviation: 1,
    magical: 0.5
  },
  wetland: {
    melee: 1,
    ranged: 1.6,
    mounted: 0.2,
    machinery: 1.2,
    naval: 1.0,
    armored: 0.2,
    aviation: 0.5,
    magical: 0.5
  },
  highland: {
    melee: 1.2,
    ranged: 2,
    mounted: 0.3,
    machinery: 3,
    naval: 1.0,
    armored: 0.8,
    aviation: 0.3,
    magical: 2
  }
};

class MilitaryModule {
  /** Raise every state's forces for a new map: the alerts follow the political situation */
  generate(): void {
    const states = this.livingStates();
    for (const state of states) state.alert = States.defineAlert(state);
    this.raise(states);
  }

  /** Raise forces anew at the alerts set: of the states named, or of every state */
  regenerate(stateIds?: number[]): void {
    const states = this.livingStates(stateIds);
    for (const state of states) state.alert ??= States.defineAlert(state);
    this.raise(states);
  }

  /** Raise the named units anew, and the levies their equipment leaves, in the states named or in all. Regiments keep all else: a platoon joins the nearest regiment of its landmass, those with none form new ones */
  raiseUnits(names: string[], stateIds?: number[]): void {
    const { cells } = pack;
    const roster = options.map.military.units;
    const raised = new Set(names);
    const levy = roster.find(unit => unit.type === "levies");
    if (levy && pack.deals?.length) raised.add(levy.name);
    const separate = new Set(roster.filter(unit => unit.separate).map(unit => unit.name));
    const featureOf = (cell: number, naval: number) => cells.f[naval && cells.h[cell] >= 20 ? cells.haven[cell] : cell];

    const states = this.livingStates(stateIds);
    const drafts = this.draft(states);
    for (const state of states) {
      this.recompose(state, military => {
        const held = new Map(military.map(regiment => [regiment, new Set(Object.keys(regiment.u))]));
        for (const regiment of military) for (const name of raised) delete regiment.u[name];
        const troops = (regiment: Regiment) => sum(Object.values(regiment.u));
        const platoons = drafts.get(state.i)!.filter(platoon => raised.has(platoon.u));
        const stray: Platoon[] = [];
        // separate units first, to their own regiments
        for (const platoon of platoons.sort((a, b) => b.s - a.s)) {
          const feature = featureOf(platoon.cell, platoon.n);
          const distance = (regiment: Regiment) => (regiment.bx - platoon.x) ** 2 + (regiment.by - platoon.y) ** 2;
          // on its landmass, or across the water as near as platoons merge
          const fits = (regiment: Regiment) =>
            regiment.n === platoon.n &&
            (featureOf(regiment.cell, regiment.n) === feature || distance(regiment) < REACH ** 2) &&
            Object.keys(regiment.u).every(name => name === platoon.u || (!platoon.s && !separate.has(name)));
          const fitting = military.filter(fits);
          const veterans = fitting.filter(regiment => held.get(regiment)!.has(platoon.u)); // had the unit before
          // regiments based at one point share its platoons
          const home = least(
            veterans.length ? veterans : fitting,
            (a, b) => distance(a) - distance(b) || troops(a) - troops(b)
          );
          if (home) home.u[platoon.u] = rn((home.u[platoon.u] || 0) + platoon.a, 3);
          else stray.push(platoon);
        }
        military.push(...this.form(stray, state, military));
      });
    }
  }

  /** Replace the roster; `origins` names the unit each new one was, null for an added one. Regiments follow the renames and lose the removed units' troops. Returns the units whose forces are raised differently now */
  setRoster(units: MilitaryUnit[], origins: (string | null)[]): string[] {
    const previous = options.map.military.units;
    const renamed = new Map<string, string>(); // by the old name
    const stale: string[] = [];
    units.forEach((unit, index) => {
      const old = previous.find(({ name }) => name === origins[index]);
      if (old) renamed.set(old.name, unit.name);
      const changed = old
        ? RAISING.some(key => JSON.stringify(old[key]) !== JSON.stringify(unit[key]))
        : +unit.rural > 0 || +unit.urban > 0;
      if (changed) stale.push(unit.name);
    });
    const removed = new Set(previous.map(({ name }) => name).filter(name => !renamed.has(name)));

    options.map.military.units = units;
    for (const state of pack.states ?? []) {
      if (!state.military?.length) continue;
      this.recompose(
        state,
        military => {
          for (const regiment of military) {
            const troops = Object.entries(regiment.u).filter(([name]) => !removed.has(name));
            regiment.u = Object.fromEntries(troops.map(([name, points]) => [renamed.get(name) ?? name, points]));
          }
        },
        previous
      );
    }
    return stale;
  }

  private raise(states: State[]) {
    const drafts = this.draft(states);
    for (const state of states) state.military = this.form(drafts.get(state.i)!, state);
    this.deployToFronts(states);
  }

  /** The platoons each state's cells and burgs raise, by state: those it cannot equip turned to levies */
  private draft(valid: State[]): Map<number, Platoon[]> {
    const { cells, states } = pack;
    const { p } = cells;

    // per state: the unit modifiers and the platoons that merge into its regiments
    const drafts = new Map<number, { modifiers: Record<string, number>; platoons: Platoon[] }>();
    valid.forEach(s => {
      const draft = { modifiers: {} as Record<string, number>, platoons: [] as Platoon[] };
      drafts.set(s.i, draft);
      // apply overall state modifiers for unit types based on state features
      for (const unit of options.map.military.units) {
        let modifier =
          STATE_MODIFIER[unit.type as keyof typeof STATE_MODIFIER]?.[
            s.type as keyof (typeof STATE_MODIFIER)[keyof typeof STATE_MODIFIER]
          ] || 1;
        if (unit.type === "mounted" && s.formName?.includes("Horde")) modifier *= 2;
        else if (unit.type === "naval" && s.form === "Republic") modifier *= 1.2;
        draft.modifiers[unit.name] = modifier * (s.alert ?? 1);
      }
    });

    const getType = (cell: number) => {
      if ([1, 2, 3, 4].includes(cells.biome[cell])) return "nomadic";
      if ([7, 8, 9, 12].includes(cells.biome[cell])) return "wetland";
      if (cells.h[cell] >= 70) return "highland";
      return "generic";
    };

    function passUnitLimits(unit: MilitaryUnit, biome: number, state: number, culture: number, religion: number) {
      if (unit.biomes && !unit.biomes.includes(biome)) return false;
      if (unit.states && !unit.states.includes(state)) return false;
      if (unit.cultures && !unit.cultures.includes(culture)) return false;
      if (unit.religions && !unit.religions.includes(religion)) return false;
      return true;
    }

    // rural cells
    for (const i of cells.i) {
      if (!cells.pop[i]) continue;

      const biome = cells.biome[i];
      const state = cells.state[i];
      const culture = cells.culture[i];
      const religion = cells.religion[i];

      const stateObj = states[state];
      const draft = drafts.get(state);
      if (!state || stateObj.removed || !draft) continue;

      let modifier = cells.pop[i] / 100; // basic rural army in percentages
      if (culture !== stateObj.culture) modifier = stateObj.form === "Union" ? modifier / 1.2 : modifier / 2; // non-dominant culture
      if (religion !== cells.religion[stateObj.center])
        modifier = stateObj.form === "Theocracy" ? modifier / 2.2 : modifier / 1.4; // non-dominant religion
      if (cells.f[i] !== cells.f[stateObj.center])
        modifier = stateObj.type === "Naval" ? modifier / 1.2 : modifier / 1.8; // different landmass
      const type = getType(i);

      for (const unit of options.map.military.units) {
        const perc = +unit.rural;
        if (Number.isNaN(perc) || perc <= 0 || !draft.modifiers[unit.name]) continue;
        if (!passUnitLimits(unit, biome, state, culture, religion)) continue;
        if (unit.type === "naval" && !cells.haven[i]) continue; // only near-ocean cells create naval units

        const cellTypeMod =
          type === "generic"
            ? 1
            : (CELL_MODIFIER[type as keyof typeof CELL_MODIFIER][
                unit.type as keyof (typeof CELL_MODIFIER)[keyof typeof CELL_MODIFIER]
              ] ?? 1); // cell specific modifier
        const army = modifier * perc * cellTypeMod; // rural cell army
        const total = rn(army * draft.modifiers[unit.name], 3); // total troops
        if (!total) continue;

        let [x, y] = p[i];
        let n = 0;

        // place naval units to sea
        if (unit.type === "naval") {
          const haven = cells.haven[i];
          [x, y] = p[haven];
          n = 1;
        }

        draft.platoons.push({
          cell: i,
          a: total,
          t: total,
          x,
          y,
          u: unit.name,
          n,
          s: unit.separate,
          type: unit.type
        });
      }
    }

    // burgs
    for (const b of pack.burgs) {
      if (!b.i || b.removed || !b.state || !b.population) continue;

      const biome = cells.biome[b.cell];
      const state = b.state;
      const culture = b.culture;
      const religion = cells.religion[b.cell];

      const stateObj = states[state];
      const draft = drafts.get(state);
      if (!draft) continue;
      let m = (b.population * options.map.units.population.urbanization.rate) / 100; // basic urban army in percentages
      if (b.capital) m *= 1.2; // capital has household troops
      if (culture !== stateObj.culture) m = stateObj.form === "Union" ? m / 1.2 : m / 2; // non-dominant culture
      if (religion !== cells.religion[stateObj.center]) m = stateObj.form === "Theocracy" ? m / 2.2 : m / 1.4; // non-dominant religion
      if (cells.f[b.cell] !== cells.f[stateObj.center]) m = stateObj.type === "Naval" ? m / 1.2 : m / 1.8; // different landmass
      const type = getType(b.cell);

      for (const unit of options.map.military.units) {
        const perc = +unit.urban;
        if (Number.isNaN(perc) || perc <= 0 || !draft.modifiers[unit.name]) continue;
        if (!passUnitLimits(unit, biome, state, culture!, religion)) continue;
        if (unit.type === "naval" && (!b.port || !cells.haven[b.cell])) continue; // only ports create naval units

        const mod =
          type === "generic"
            ? 1
            : (BURG_MODIFIER[type as keyof typeof BURG_MODIFIER][
                unit.type as keyof (typeof BURG_MODIFIER)[keyof typeof BURG_MODIFIER]
              ] ?? 1); // cell specific modifier
        const army = m * perc * mod; // urban cell army
        const total = rn(army * draft.modifiers[unit.name], 3); // total troops
        if (!total) continue;

        let [x, y] = p[b.cell];
        let n = 0;

        // place naval to sea
        if (unit.type === "naval") {
          const haven = cells.haven[b.cell];
          [x, y] = p[haven];
          n = 1;
        }

        draft.platoons.push({
          cell: b.cell,
          a: total,
          t: total,
          x,
          y,
          u: unit.name,
          n,
          s: unit.separate,
          type: unit.type
        });
      }
    }

    Pack.markChanged(); // burgs may have changed hands since the run
    // conscripts the state cannot equip with their unit's goods serve as levies where they were raised
    const levyUnit = options.map.military.units.find(unit => unit.type === "levies");
    for (const [stateId, draft] of drafts) {
      const demand: Record<string, number> = {};
      for (const platoon of draft.platoons) demand[platoon.u] = (demand[platoon.u] || 0) + platoon.a;
      const equipped = this.getEquipped(stateId, demand);
      const raised = new Map<number, Platoon>(); // levies by cell
      for (const platoon of draft.platoons) {
        const share = equipped[platoon.u] ?? 1;
        if (share >= 1) continue;
        const unequipped = rn(platoon.a - platoon.a * share, 3);
        platoon.a = platoon.t = rn(platoon.a - unequipped, 3);
        if (!levyUnit || !unequipped) continue;
        const levy = raised.get(platoon.cell);
        if (levy) levy.a = levy.t = rn(levy.a + unequipped, 3);
        else {
          const [x, y] = p[platoon.cell];
          const { name: u, separate: s, type } = levyUnit;
          raised.set(platoon.cell, { cell: platoon.cell, a: unequipped, t: unequipped, x, y, u, n: 0, s, type });
        }
      }
      draft.platoons = draft.platoons.filter(platoon => platoon.a).concat([...raised.values()]);
    }

    return new Map([...drafts].map(([stateId, draft]) => [stateId, draft.platoons]));
  }

  /** Merges a state's platoons into regiments, numbered and named after the `existing` ones */
  private form(platoons: Platoon[], s: State, existing: Regiment[] = []): Regiment[] {
    const expected = 3; // expected regiment size
    const first = Math.max(-1, ...existing.map(({ i }) => i)) + 1;
    const mergeable = (n0: { s: number; u: string }, n1: { s: number; u: string }) => (!n0.s && !n1.s) || n0.u === n1.u; // check if regiments can be merged
    const createRegiments = (nodes: Platoon[]): Regiment[] => {
      if (!nodes.length) return [];
      nodes.sort((a, b) => a.a - b.a); // form regiments starting from cells with fewest troops
      const tree = quadtree(
        nodes,
        d => d.x,
        d => d.y
      );

      // add n0 to n1's ultimate parent
      const merge = (n0: Platoon, n1: Platoon) => {
        if (!n1.children) n1.children = [n0];
        else n1.children.push(n0);
        if (n0.children)
          n0.children.forEach(n => {
            n1.children!.push(n);
          });
        n1.t = rn(n1.t + n0.t, 3);
        n0.t = 0;
      };

      nodes.forEach(node => {
        tree.remove(node);
        const overlap = tree.find(node.x, node.y, 20);
        if (overlap?.t && mergeable(node, overlap)) {
          merge(node, overlap);
          return;
        }
        if (node.t > expected) return;
        const r = (expected - node.t) * (node.s ? 25 : 50); // search radius
        const candidates = findAllInQuadtree(node.x, node.y, r, tree);
        for (const c of candidates) {
          if (c.t < expected && mergeable(node, c)) {
            merge(node, c);
            break;
          }
        }
      });

      // parse regiments data
      const regiments: Omit<Regiment, "s" | "t" | "type">[] = nodes
        .filter(n => n.t)
        .sort((a, b) => b.t - a.t)
        .map((r, i) => {
          const u: Record<string, number> = {};
          u[r.u] = r.a;
          (r.children ?? []).forEach(n => {
            u[n.u] = rn((u[n.u] ?? 0) + n.a, 3);
          });
          return {
            i: first + i,
            a: r.t,
            cell: r.cell,
            x: r.x,
            y: r.y,
            bx: r.x,
            by: r.y,
            u,
            n: r.n,
            name: "",
            icon: "",
            state: s.i,
            tags: []
          };
        });

      // generate name for regiments
      regiments.forEach((r: Omit<Regiment, "s" | "t" | "type">) => {
        r.name = this.getName(r as Regiment, [...existing, ...(regiments as Regiment[])]);
        r.icon = this.getEmblem(r as Regiment);
        this.generateNote(r as Regiment, s);
      });

      return regiments as Regiment[];
    };

    return createRegiments(platoons);
  }

  /** Runs a change of a state's regiments' troops: those on their default emblem follow it, those it empties are disbanded */
  private recompose(state: State, change: (military: Regiment[]) => void, roster = options.map.military.units) {
    state.military ??= [];
    const military = state.military;
    const emblemed = military.filter(regiment => regiment.icon === this.getEmblem(regiment, roster));
    const manned = military.filter(regiment => regiment.a);
    change(military);
    for (const regiment of military) regiment.a = sum(Object.values(regiment.u));
    state.military = military.filter(regiment => regiment.a || !manned.includes(regiment));
    for (const regiment of emblemed) regiment.icon = this.getEmblem(regiment);
  }

  /** Moves regiments of states at war, largest first, to the foremost line's nearest free cell */
  private deployToFronts(states: State[]) {
    const { cells } = pack;
    const { p } = cells;
    const borders = new Map<number, { land: number[]; sea: Set<number> }>(); // by state; sea is water next to either side
    for (const i of cells.i) {
      const s = cells.state[i];
      if (!s || cells.h[i] < 20) continue;
      const relations = pack.states[s].diplomacy;
      if (!relations?.includes("Enemy")) continue;
      const enemies = cells.c[i].filter(n => cells.h[n] >= 20 && relations[cells.state[n]] === "Enemy");
      if (!enemies.length) continue;
      if (!borders.has(s)) borders.set(s, { land: [], sea: new Set() });
      const border = borders.get(s)!;
      border.land.push(i);
      for (const n of [i, ...enemies]) for (const w of cells.c[n]) if (cells.h[w] < 20) border.sea.add(w);
    }

    // the border line, then lines of cells behind it
    const deepen = (border: number[], fits: (cell: number) => boolean) => {
      const lines = [border];
      const seen = new Set(border);
      for (let depth = 1; depth <= FRONT_DEPTH; depth++) {
        const line = lines[depth - 1].flatMap(i => cells.c[i]).filter(n => fits(n) && !seen.has(n) && seen.add(n));
        lines.push(line);
      }
      return lines;
    };
    const fronts = new Map<number, { land: number[][]; sea: number[][] }>();
    for (const [s, { land, sea }] of borders) {
      fronts.set(s, {
        land: deepen(land, n => cells.state[n] === s && cells.h[n] >= 20),
        sea: deepen([...sea], n => cells.h[n] < 20)
      });
    }

    const width = REGIMENT_SIZE * 9; // regiment box with its icon, and a margin
    const placed = quadtree<{ x: number; y: number }>()
      .x(d => d.x)
      .y(d => d.y);
    const raised = new Set(states);
    for (const state of this.livingStates()) if (!raised.has(state)) placed.addAll(state.military ?? []);
    const blocked = (x: number, y: number) =>
      findAllInQuadtree(x, y, width, placed).some(
        o => Math.abs(o.x - x) < width && Math.abs(o.y - y) < REGIMENT_SIZE * 3
      );
    const deploy = (regiment: Regiment, lines: number[][], feature: number) => {
      const { x, y } = regiment;
      const distance = (i: number) => (p[i][0] - x) ** 2 + (p[i][1] - y) ** 2;
      for (const line of lines) {
        const target = line
          .filter(i => cells.f[i] === feature)
          .sort((a, b) => distance(a) - distance(b))
          .find(i => !blocked(p[i][0], p[i][1]));
        if (target === undefined) continue;
        [regiment.x, regiment.y] = p[target];
        placed.add({ x: regiment.x, y: regiment.y });
        return;
      }
    };

    // fleets first: few water cells reach the border, and land regiments on the coast would block them
    for (const naval of [true, false]) {
      for (const state of states) {
        const front = fronts.get(state.i);
        if (!front) continue;
        for (const regiment of state.military ?? []) {
          if (Boolean(regiment.n) !== naval) continue;
          if (naval) deploy(regiment, front.sea, cells.f[cells.haven[regiment.cell]]);
          else deploy(regiment, front.land, cells.f[regiment.cell]);
        }
      }
    }
  }

  getName(r: Regiment, regiments: Regiment[]) {
    const cells = pack.cells;
    const proper = r.n
      ? null
      : cells.province[r.cell] && pack.provinces[cells.province[r.cell]]
        ? pack.provinces[cells.province[r.cell]].name
        : cells.burg[r.cell] && pack.burgs[cells.burg[r.cell]]
          ? pack.burgs[cells.burg[r.cell]].name
          : null;
    const number = nth(regiments.filter(reg => reg.n === r.n && reg.i < r.i).length + 1);
    const form = r.n ? "Fleet" : "Regiment";
    return `${number}${proper ? ` (${proper}) ` : ` `}${form}`;
  }

  /** Share of each unit's conscripts what the state consumes of its goods equips; 1 with no goods or before the run */
  getEquipped(stateId: number, demand: Record<string, number>): Record<string, number> {
    const units = options.map.military.units;
    const consumed = Accounts.getConsumption(stateId);
    const goodsOf = (unit: MilitaryUnit) => (unit.goods ?? []).flatMap(goodId => Goods.get(goodId) ?? []);
    const needing = (goodId: number) => sum(units, unit => (unit.goods?.includes(goodId) ? demand[unit.name] || 0 : 0));

    const equipped: Record<string, number> = {};
    for (const unit of units) {
      const troops = demand[unit.name] || 0;
      const goods = goodsOf(unit);
      if (!troops || !goods.length || !pack.deals?.length) {
        equipped[unit.name] = 1;
        continue;
      }
      const kits = sum(goods, good => {
        const stock = (consumed[good.i] || 0) * EQUIPMENT * (good.demandCoverage?.military || 1);
        return (stock * troops) / needing(good.i);
      });
      equipped[unit.name] = Math.min(1, kits / troops);
    }
    return equipped;
  }

  /** A state's upkeep, 0 (powerless) to 1 (fully kept); 1 before the run or levying nothing */
  getUpkeep(stateId: number): number {
    const state = pack.states[stateId];
    if (!state || !levies(state) || !pack.deals?.length) return 1;
    const need = this.getUpkeepNeed(stateId);
    return need ? Math.min(1, state.economy.spent.military / need) : 1;
  }

  /** The military spending a day that keeps a state's forces in full */
  getUpkeepNeed(stateId: number): number {
    return this.getNominalPower(stateId) * UPKEEP_COST;
  }

  /** How strongly a state's forces fight for their upkeep: it multiplies their power in battle */
  getBattleUpkeep(stateId: number): number {
    return Math.max(MIN_UPKEEP, this.getUpkeep(stateId));
  }

  /** The state's forces' battle power: troops × unit power × battle upkeep */
  getPower(stateId: number): number {
    return this.getNominalPower(stateId) * this.getBattleUpkeep(stateId);
  }

  /** A regiment's battle power: troops × unit power × its state's battle upkeep */
  getRegimentPower(regiment: Regiment): number {
    return this.getTroopsPower(regiment) * this.getBattleUpkeep(regiment.state);
  }

  private getNominalPower(stateId: number): number {
    return sum(pack.states[stateId]?.military ?? [], regiment => this.getTroopsPower(regiment));
  }

  private getTroopsPower(regiment: Regiment): number {
    return sum(options.map.military.units, unit => (regiment.u[unit.name] || 0) * getUnitPower(unit));
  }

  /** The troops a number of population points stands for, rounded up: there is no half of an archer */
  getTroops(points = 0): number {
    return Math.ceil(rn(points * options.map.units.population.scale, 3));
  }

  // utilize si function to make regiment total text fit regiment box
  getTotal(reg: Regiment) {
    const troops = this.getTroops(reg.a);
    return troops > (reg.n ? 999 : 99999) ? si(troops) : troops;
  }

  generateNote(r: Regiment, s: State) {
    const cells = pack.cells;
    const base =
      cells.burg[r.cell] && pack.burgs[cells.burg[r.cell]]
        ? pack.burgs[cells.burg[r.cell]].name
        : cells.province[r.cell] && pack.provinces[cells.province[r.cell]]
          ? pack.provinces[cells.province[r.cell]].fullName
          : null;
    const station = base ? `${r.name} is ${r.n ? "based" : "stationed"} in ${base}. ` : "";

    const composition = r.a
      ? Object.keys(r.u)
          .map(t => `— ${t}: ${this.getTroops(r.u[t])}`)
          .join("\r\n")
      : null;
    const troops = composition
      ? `\r\n\r\nRegiment composition in ${options.map.lore.calendar.year} ${options.map.lore.calendar.eraShort}:\r\n${composition}.`
      : "";

    const campaign = s.campaigns ? ra(s.campaigns) : null;
    const year = campaign
      ? rand(campaign.start, campaign.end || options.map.lore.calendar.year)
      : gauss(options.map.lore.calendar.year - 100, 150, 1, options.map.lore.calendar.year - 6);
    const conflict = campaign ? ` during the ${campaign.name}` : "";
    r.note = `Regiment was formed in ${year} ${options.map.lore.calendar.era}${conflict}. ${station}${troops}`;
  }

  /** Rename a regiment, addressed by its state and its own id */
  rename(stateId: number, regimentId: number, name: string): void {
    this.living(stateId, regimentId).name = requireName(name);
  }

  /** Disband a regiment, addressed by its state and its own id */
  remove(stateId: number, regimentId: number): void {
    const regiment = this.living(stateId, regimentId);
    const military = pack.states[stateId].military!;
    military.splice(military.indexOf(regiment), 1);
  }

  /** Raise an empty regiment of a state at a map point, a fleet on water; returns its id */
  add(stateId: number, x: number, y: number): number {
    const state = pack.states[stateId];
    if (!stateId || !state || state.removed) throw new Error(`State ${stateId} does not exist`);
    const cell = Pack.requireCell(x, y);
    const [cx, cy] = pack.cells.p[cell];
    state.military ??= [];
    const military = state.military;
    const i = military.length ? Math.max(...military.map(regiment => regiment.i)) + 1 : 0;
    const regiment: Regiment = {
      a: 0,
      cell,
      i,
      n: +(pack.cells.h[cell] < 20),
      u: {},
      x: cx,
      y: cy,
      bx: cx,
      by: cy,
      state: stateId,
      icon: Icons.glyph("🛡️"),
      name: "",
      t: 0,
      s: 0,
      type: "",
      tags: []
    };
    regiment.name = this.getName(regiment, military);
    military.push(regiment);
    this.generateNote(regiment, state);
    return i;
  }

  /** Set a regiment's troops by unit name, such as { infantry: 800, archers: 200 }; the total follows */
  setUnits(stateId: number, regimentId: number, units: Record<string, number>): void {
    const regiment = this.living(stateId, regimentId);
    if (typeof units !== "object" || units === null || Array.isArray(units))
      throw new Error("Units are an object of unit names and troop numbers");
    const names = options.map.military.units.map(({ name }) => name);
    for (const [name, count] of Object.entries(units)) {
      if (!(name in regiment.u)) requireOneOf(name, names, "The unit"); // troops of a unit type since removed stay
      if (!Number.isInteger(count) || count < 0)
        throw new Error(`The number of ${name} must be a non-negative integer`);
    }
    const { scale } = options.map.units.population;
    const old = regiment.u;
    // a number left as shown keeps its exact points
    regiment.u = Object.fromEntries(
      Object.entries(units).map(([name, count]) => [
        name,
        this.getTroops(old[name]) === count ? old[name] : count / scale
      ])
    );
    regiment.a = sum(Object.values(regiment.u));
  }

  /** Set a state's war alert, the modifier of its forces (generated from 0.1 to 5): every regiment's troops scale with it */
  setAlert(stateId: number, alert: number): void {
    const state = pack.states[stateId];
    if (!stateId || !state || state.removed) throw new Error(`State ${stateId} does not exist`);
    if (typeof alert !== "number" || !(alert >= 0 && Number.isFinite(alert)))
      throw new Error("The alert must be a non-negative number");
    const previous = state.alert ?? 1;
    state.alert = rn(alert, 2);
    const change = previous ? state.alert / previous : 0; // the stored value, so the next change divides by it
    for (const regiment of state.military ?? []) {
      for (const unit of Object.keys(regiment.u)) regiment.u[unit] = rn(regiment.u[unit] * change, 3);
      regiment.a = sum(Object.values(regiment.u));
    }
  }

  /** Make a regiment a fleet or a land regiment */
  setNaval(stateId: number, regimentId: number, naval: boolean): void {
    this.living(stateId, regimentId).n = naval ? 1 : 0;
  }

  /** Set a regiment's icon: an emoji or an icon id */
  setIcon(stateId: number, regimentId: number, icon: string): void {
    this.living(stateId, regimentId).icon = Icons.reference(icon);
  }

  /** Move a regiment to a map point; its base stays */
  move(stateId: number, regimentId: number, x: number, y: number): void {
    const regiment = this.living(stateId, regimentId);
    Pack.requireCell(x, y);
    regiment.x = rn(x, 2);
    regiment.y = rn(y, 2);
  }

  /** Turn a regiment to an angle in degrees, from -180 to 180 */
  rotate(stateId: number, regimentId: number, angle: number): void {
    const regiment = this.living(stateId, regimentId);
    if (typeof angle !== "number" || !(angle >= -180 && angle <= 180))
      throw new Error("The angle must be a number from -180 to 180");
    regiment.angle = rn(angle, 2);
  }

  /** Move a regiment's base, where it is stationed, to a map point */
  setBase(stateId: number, regimentId: number, x: number, y: number): void {
    const regiment = this.living(stateId, regimentId);
    Pack.requireCell(x, y);
    regiment.bx = rn(x, 2);
    regiment.by = rn(y, 2);
  }

  /** Split a regiment in two halves; the new one stands just below. Returns its id */
  split(stateId: number, regimentId: number): number {
    const regiment = this.living(stateId, regimentId);
    const state = pack.states[stateId];
    const military = state.military!;
    const { scale } = options.map.units.population;
    const half = Object.fromEntries(
      Object.entries(regiment.u).map(([unit, count]) => [unit, Math.floor(this.getTroops(count) / 2) / scale])
    );
    const a = sum(Object.values(half));
    if (!a) throw new Error(`Regiment ${stateId}-${regimentId} has too few troops to split`);
    regiment.u = Object.fromEntries(Object.entries(regiment.u).map(([unit, count]) => [unit, count - half[unit]]));
    regiment.a = sum(Object.values(regiment.u));

    const shift = REGIMENT_SIZE * 2;
    let y = regiment.y + shift;
    while (military.some(other => other.x === regiment.x && other.y === y)) y += shift;
    const i = Math.max(...military.map(other => other.i)) + 1;
    const added: Regiment = {
      a,
      cell: regiment.cell,
      i,
      n: regiment.n,
      u: half,
      x: regiment.x,
      y,
      bx: regiment.bx,
      by: regiment.by,
      state: stateId,
      icon: regiment.icon,
      name: "",
      t: 0,
      s: 0,
      type: regiment.type,
      tags: [...(regiment.tags ?? [])]
    };
    added.name = this.getName(added, military);
    military.push(added);
    this.generateNote(added, state);
    return i;
  }

  /** Attach a regiment to another, of any state: its troops and note join the target and it is disbanded */
  attach(stateId: number, regimentId: number, targetStateId: number, targetId: number): void {
    const regiment = this.living(stateId, regimentId);
    const target = this.living(targetStateId, targetId);
    if (regiment === target) throw new Error("A regiment cannot attach to itself");
    for (const [unit, count] of Object.entries(regiment.u)) if (count) target.u[unit] = (target.u[unit] || 0) + count;
    target.a = sum(Object.values(target.u));

    const { year, eraShort } = options.map.lore.calendar;
    const record = regiment.note ? ` Its record: ${regiment.note}` : "";
    const merger = `${regiment.name} merged into the regiment (${year} ${eraShort}).${record}`;
    target.note = target.note ? `${target.note}<br><br>${merger}` : merger;
    this.remove(stateId, regimentId);
  }

  private livingStates(only?: number[]): State[] {
    return pack.states.filter(state => state.i && !state.removed && (!only || only.includes(state.i)));
  }

  private living(stateId: number, regimentId: number): Regiment {
    const state = pack.states[stateId];
    const regiment = state && !state.removed ? state.military?.find(({ i }) => i === regimentId) : undefined;
    if (!regiment) throw new Error(`Regiment ${stateId}-${regimentId} does not exist`);
    return regiment;
  }

  // get default regiment emblem
  getEmblem(r: Regiment, roster = options.map.military.units) {
    if (!r.n && !Object.values(r.u).length) return Icons.glyph("🔰"); // "Newbie" regiment without troops
    if (
      !r.n &&
      pack.states[r.state].form === "Monarchy" &&
      pack.cells.burg[r.cell] &&
      pack.burgs[pack.cells.burg[r.cell]].capital
    )
      return Icons.glyph("👑"); // "Royal" regiment based in capital
    const units = roster.filter(u => r.u[u.name]);
    const unit = greatest(units, u => r.u[u.name] * getUnitPower(u)); // unit with the most power in the regiment
    return unit ? unit.icon : Icons.glyph("⚔️");
  }
}

export const Military = new MilitaryModule();
