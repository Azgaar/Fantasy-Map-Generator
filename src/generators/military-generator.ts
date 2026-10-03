import { quadtree, sum } from "d3";
import { Icons } from "@/components/icons";
import { requireName, requireOneOf } from "@/utils/validationUtils";
import { findAllInQuadtree, gauss, minmax, nth, ra, rand, rn, si } from "../utils";
import type { State } from "./states-generator";

declare global {
  var Military: MilitaryModule;
}

export interface Regiment {
  i: number;
  t: number; // total troops
  name: string;
  a: number; // regiment army
  s: number; // separate flag (for fleets)
  cell: number;
  x: number;
  y: number;
  bx: number; // base x (for movement)
  by: number; // base y (for movement)
  u: Record<string, number>; // units composition
  n: number; // naval unit flag
  type: string; // unit type
  icon: string;
  children?: Regiment[]; // merged regiments
  state: number;
  angle?: number;
  casualties?: Record<string, number>; // battle-screen: per-unit casualties while a battle is in progress
  survivors?: Record<string, number>; // battle-screen: per-unit survivors while a battle is in progress
  px?: number; // battle-screen: position before being moved into a battle, restored afterward
  py?: number;
  note?: string;
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

class MilitaryModule {
  regenerate(): void {
    this.generate();
  }

  generate() {
    const { cells, states } = pack;
    const { p } = cells;
    const valid = states.filter(s => s.i && !s.removed); // valid states

    const expn = sum(valid.map(s => s.expansionism)); // total expansion
    const area = sum(valid.map(s => s.area)); // total area
    const rate = {
      x: 0,
      Ally: -0.2,
      Friendly: -0.1,
      Neutral: 0,
      Suspicion: 0.1,
      Enemy: 1,
      Unknown: 0,
      Rival: 0.5,
      Vassal: 0.5,
      Suzerain: -0.5
    };

    const stateModifier = {
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

    const cellTypeModifier = {
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

    const burgTypeModifier = {
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

    valid.forEach(s => {
      s.temp = {};
      const d = s.diplomacy!;

      const expansionRate = minmax(s.expansionism / expn / (s.area! / area), 0.25, 4); // how much state expansionism is realized
      const diplomacyRate = d.some(d => d === "Enemy")
        ? 1
        : d.some(d => d === "Rival")
          ? 0.8
          : d.some(d => d === "Suspicion")
            ? 0.5
            : 0.1; // peacefulness
      const neighborsRateRaw = s
        .neighbors!.map(n => (n ? pack.states[n].diplomacy![s.i] : "Suspicion"))
        .reduce((s, r) => s + rate[r as keyof typeof rate], 0.5);
      const neighborsRate = minmax(neighborsRateRaw, 0.3, 3); // neighbors rate
      s.alert = minmax(rn(expansionRate * diplomacyRate * neighborsRate, 2), 0.1, 5); // alert rate (area modifier)
      s.temp.platoons = [];

      // apply overall state modifiers for unit types based on state features
      for (const unit of options.map.military.units) {
        if (!stateModifier[unit.type as keyof typeof stateModifier]) continue;

        let modifier =
          stateModifier[unit.type as keyof typeof stateModifier][
            s.type as keyof (typeof stateModifier)[keyof typeof stateModifier]
          ] || 1;
        if (unit.type === "mounted" && s.formName!.includes("Horde")) modifier *= 2;
        else if (unit.type === "naval" && s.form === "Republic") modifier *= 1.2;
        s.temp[unit.name] = modifier * s.alert;
      }
    });

    const getType = (cell: number) => {
      if ([1, 2, 3, 4].includes(cells.biome[cell])) return "nomadic";
      if ([7, 8, 9, 12].includes(cells.biome[cell])) return "wetland";
      if (cells.h[cell] >= 70) return "highland";
      return "generic";
    };

    function passUnitLimits(unit: any, biome: number, state: number, culture: number, religion: number) {
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
      if (!state || stateObj.removed) continue;

      let modifier = cells.pop[i] / 100; // basic rural army in percentages
      if (culture !== stateObj.culture) modifier = stateObj.form === "Union" ? modifier / 1.2 : modifier / 2; // non-dominant culture
      if (religion !== cells.religion[stateObj.center])
        modifier = stateObj.form === "Theocracy" ? modifier / 2.2 : modifier / 1.4; // non-dominant religion
      if (cells.f[i] !== cells.f[stateObj.center])
        modifier = stateObj.type === "Naval" ? modifier / 1.2 : modifier / 1.8; // different landmass
      const type = getType(i);

      for (const unit of options.map.military.units) {
        const perc = +unit.rural;
        if (Number.isNaN(perc) || perc <= 0 || !stateObj.temp[unit.name]) continue;
        if (!passUnitLimits(unit, biome, state, culture, religion)) continue;
        if (unit.type === "naval" && !cells.haven[i]) continue; // only near-ocean cells create naval units

        const cellTypeMod =
          type === "generic"
            ? 1
            : cellTypeModifier[type as keyof typeof cellTypeModifier][
                unit.type as keyof (typeof cellTypeModifier)[keyof typeof cellTypeModifier]
              ]; // cell specific modifier
        const army = modifier * perc * cellTypeMod; // rural cell army
        const total = rn(army * stateObj.temp[unit.name] * options.map.units.population.scale); // total troops
        if (!total) continue;

        let [x, y] = p[i];
        let n = 0;

        // place naval units to sea
        if (unit.type === "naval") {
          const haven = cells.haven[i];
          [x, y] = p[haven];
          n = 1;
        }

        stateObj.temp.platoons.push({
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
      let m = (b.population * options.map.units.population.urbanization.rate) / 100; // basic urban army in percentages
      if (b.capital) m *= 1.2; // capital has household troops
      if (culture !== stateObj.culture) m = stateObj.form === "Union" ? m / 1.2 : m / 2; // non-dominant culture
      if (religion !== cells.religion[stateObj.center]) m = stateObj.form === "Theocracy" ? m / 2.2 : m / 1.4; // non-dominant religion
      if (cells.f[b.cell] !== cells.f[stateObj.center]) m = stateObj.type === "Naval" ? m / 1.2 : m / 1.8; // different landmass
      const type = getType(b.cell);

      for (const unit of options.map.military.units) {
        const perc = +unit.urban;
        if (Number.isNaN(perc) || perc <= 0 || !stateObj.temp[unit.name]) continue;
        if (!passUnitLimits(unit, biome, state, culture!, religion)) continue;
        if (unit.type === "naval" && (!b.port || !cells.haven[b.cell])) continue; // only ports create naval units

        const mod =
          type === "generic"
            ? 1
            : burgTypeModifier[type as keyof typeof burgTypeModifier][
                unit.type as keyof (typeof burgTypeModifier)[keyof typeof burgTypeModifier]
              ]; // cell specific modifier
        const army = m * perc * mod; // urban cell army
        const total = rn(army * stateObj.temp[unit.name] * options.map.units.population.scale); // total troops
        if (!total) continue;

        let [x, y] = p[b.cell];
        let n = 0;

        // place naval to sea
        if (unit.type === "naval") {
          const haven = cells.haven[b.cell];
          [x, y] = p[haven];
          n = 1;
        }

        stateObj.temp.platoons.push({
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

    const expected = 3 * options.map.units.population.scale; // expected regiment size
    const mergeable = (n0: { s: number; u: string }, n1: { s: number; u: string }) => (!n0.s && !n1.s) || n0.u === n1.u; // check if regiments can be merged
    const createRegiments = (nodes: Platoon[], s: State): Regiment[] => {
      if (!nodes.length) return [];
      nodes.sort((a, b) => a.a - b.a); // form regiments starting from cells with fewest troops
      const tree = quadtree(
        nodes,
        d => d.x,
        d => d.y
      );

      // add n0 to n1's ultimate parent
      const merge = (
        n0: { s: number; u: string; t: number; children?: any[] },
        n1: { s: number; u: string; t: number; children?: any[] }
      ) => {
        if (!n1.children) n1.children = [n0];
        else n1.children.push(n0);
        if (n0.children)
          n0.children.forEach(n => {
            n1.children!.push(n);
          });
        n1.t += n0.t;
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
        const r = (expected - node.t) / (node.s ? 40 : 20); // search radius
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
            u[n.u] = (u[n.u] ?? 0) + n.a;
          });
          return {
            i,
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
            state: s.i
          };
        });

      // generate name for regiments
      regiments.forEach((r: Omit<Regiment, "s" | "t" | "type">) => {
        r.name = this.getName(r as Regiment, regiments as Regiment[]);
        r.icon = this.getEmblem(r as Regiment);
        this.generateNote(r as Regiment, s);
      });

      return regiments as Regiment[];
    };

    // get regiments for each state
    valid.forEach(s => {
      s.military = createRegiments(s.temp.platoons, s);
      delete s.temp; // do not store temp data
    });
  }

  getDefaultOptions() {
    const units = [
      {
        icon: "⚔️",
        name: "infantry",
        rural: 0.25,
        urban: 0.2,
        crew: 1,
        power: 1,
        type: "melee",
        separate: 0
      },
      {
        icon: "🏹",
        name: "archers",
        rural: 0.12,
        urban: 0.2,
        crew: 1,
        power: 1,
        type: "ranged",
        separate: 0
      },
      {
        icon: "🐴",
        name: "cavalry",
        rural: 0.12,
        urban: 0.03,
        crew: 2,
        power: 2,
        type: "mounted",
        separate: 0
      },
      {
        icon: "💣",
        name: "artillery",
        rural: 0,
        urban: 0.03,
        crew: 8,
        power: 12,
        type: "machinery",
        separate: 0
      },
      {
        icon: "🌊",
        name: "fleet",
        rural: 0,
        urban: 0.015,
        crew: 100,
        power: 50,
        type: "naval",
        separate: 1
      }
    ];
    return units.map(unit => ({ ...unit, icon: Icons.glyph(unit.icon) }));
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

  // utilize si function to make regiment total text fit regiment box
  getTotal(reg: Regiment) {
    return reg.a > (reg.n ? 999 : 99999) ? si(reg.a) : reg.a;
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
          .map(t => `— ${t}: ${r.u[t as keyof typeof r.u]}`)
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
      type: ""
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
      requireOneOf(name, names, "The unit");
      if (!Number.isInteger(count) || count < 0)
        throw new Error(`The number of ${name} must be a non-negative integer`);
    }
    regiment.u = { ...units };
    regiment.a = sum(Object.values(regiment.u));
  }

  /** Set a state's war alert, the modifier of its forces (generated from 0.1 to 5): every regiment's troops scale with it */
  setAlert(stateId: number, alert: number): void {
    const state = pack.states[stateId];
    if (!stateId || !state || state.removed) throw new Error(`State ${stateId} does not exist`);
    if (typeof alert !== "number" || !(alert >= 0 && Number.isFinite(alert)))
      throw new Error("The alert must be a non-negative number");
    const previous = state.alert ?? 1;
    const change = previous ? alert / previous : 0;
    state.alert = rn(alert, 2);
    for (const regiment of state.military ?? []) {
      for (const unit of Object.keys(regiment.u)) regiment.u[unit] = rn(regiment.u[unit] * change);
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
    const half = Object.fromEntries(Object.entries(regiment.u).map(([unit, count]) => [unit, Math.floor(count / 2)]));
    const a = sum(Object.values(half));
    if (!a) throw new Error(`Regiment ${stateId}-${regimentId} has too few troops to split`);
    regiment.u = Object.fromEntries(Object.entries(regiment.u).map(([unit, count]) => [unit, Math.ceil(count / 2)]));
    regiment.a = sum(Object.values(regiment.u));

    const shift = styles.military.options.boxSize * 2;
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
      type: regiment.type
    };
    added.name = this.getName(added, military);
    military.push(added);
    this.generateNote(added, state);
    return i;
  }

  /** Attach a regiment to another, of any state: its troops join the target and it is disbanded */
  attach(stateId: number, regimentId: number, targetStateId: number, targetId: number): void {
    const regiment = this.living(stateId, regimentId);
    const target = this.living(targetStateId, targetId);
    if (regiment === target) throw new Error("A regiment cannot attach to itself");
    for (const [unit, count] of Object.entries(regiment.u)) if (count) target.u[unit] = (target.u[unit] || 0) + count;
    target.a = sum(Object.values(target.u));
    this.remove(stateId, regimentId);
  }

  private living(stateId: number, regimentId: number): Regiment {
    const state = pack.states[stateId];
    const regiment = state && !state.removed ? state.military?.find(({ i }) => i === regimentId) : undefined;
    if (!regiment) throw new Error(`Regiment ${stateId}-${regimentId} does not exist`);
    return regiment;
  }

  // get default regiment emblem
  getEmblem(r: Regiment) {
    if (!r.n && !Object.values(r.u).length) return Icons.glyph("🔰"); // "Newbie" regiment without troops
    if (
      !r.n &&
      pack.states[r.state].form === "Monarchy" &&
      pack.cells.burg[r.cell] &&
      pack.burgs[pack.cells.burg[r.cell]].capital
    )
      return Icons.glyph("👑"); // "Royal" regiment based in capital
    const mainUnit = Object.entries(r.u).sort((a, b) => b[1] - a[1])[0][0]; // unit with more troops in regiment
    const unit = options.map.military.units.find((u: { name: string; icon: string }) => u.name === mainUnit);
    return unit ? unit.icon : Icons.glyph("⚔️");
  }
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const Military = new MilitaryModule();
window.Military = Military;
