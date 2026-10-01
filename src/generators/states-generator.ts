import { mean, median, quadtree, sum } from "d3";
import { getInverseRelation, RELATIONS } from "@/data/diplomacy";
import { Emblems } from "@/generators/emblems-generator";
import type { Emblem } from "@/types/emblems";
import { requireColor } from "@/utils/colorUtils";
import { replaceWholeWord } from "@/utils/languageUtils";
import { requireName, requireOneOf } from "@/utils/validationUtils";
import {
  each,
  escapeHtml,
  gauss,
  generateSeed,
  getAdjective,
  getMixedColor,
  getPolesOfInaccessibility,
  getRandomColor,
  minmax,
  P,
  ra,
  rand,
  rn,
  rw,
  trimVowels
} from "../utils";
import { CULTURE_TYPES } from "./cultures-generator";
import type { Label } from "./labels-generator";
import type { Regiment } from "./military-generator";
import { Population } from "./population-generator";
import type { Province } from "./provinces-generator";

declare global {
  var States: StatesModule;
}

export interface State {
  i: number;
  name: string;
  expansionism: number;
  capital: number;
  type: string;
  center: number;
  culture: number;
  coa: Emblem;
  lock?: boolean;
  removed?: boolean;
  pole?: [number, number];
  neighbors?: number[];
  color?: string;
  cells?: number;
  area?: number;
  burgs?: number;
  rural?: number;
  urban?: number;
  campaigns?: Campaign[];
  diplomacy?: string[];
  formName?: string;
  fullName?: string;
  form?: string;
  military?: Regiment[];
  provinces?: number[];
  temp?: any;
  alert?: number;
  salesTax: number;
  pollTax: number;
  treasury: number;
  label?: Label;
  note?: string;
}

interface Campaign {
  attacker: number;
  defender: number;
  name: string;
  start: number;
  end?: number;
}

/** Form names by the form of government they belong to, as the State name editor lists them */
export const STATE_FORMS = {
  Monarchy: [
    "Beylik",
    "Despotate",
    "Dominion",
    "Duchy",
    "Emirate",
    "Empire",
    "Horde",
    "Grand Duchy",
    "Heptarchy",
    "Khaganate",
    "Khanate",
    "Kingdom",
    "Marches",
    "Principality",
    "Satrapy",
    "Shogunate",
    "Sultanate",
    "Tsardom",
    "Ulus",
    "Viceroyalty"
  ],
  Republic: [
    "Chancellery",
    "City-state",
    "Diarchy",
    "Federation",
    "Free City",
    "Junta",
    "Most Serene Republic",
    "Oligarchy",
    "Protectorate",
    "Republic",
    "Tetrarchy",
    "Trade Company",
    "Triumvirate"
  ],
  Union: [
    "Confederacy",
    "Confederation",
    "Conglomerate",
    "Commonwealth",
    "League",
    "Union",
    "United Hordes",
    "United Kingdom",
    "United Provinces",
    "United Republic",
    "United States",
    "United Tribes"
  ],
  Theocracy: [
    "Bishopric",
    "Brotherhood",
    "Caliphate",
    "Diocese",
    "Divine Duchy",
    "Divine Grand Duchy",
    "Divine Principality",
    "Divine Kingdom",
    "Divine Empire",
    "Eparchy",
    "Exarchate",
    "Holy State",
    "Imamah",
    "Patriarchate",
    "See",
    "Thearchy",
    "Theocracy"
  ],
  Anarchy: ["Commune", "Community", "Council", "Free Territory", "Tribes"]
} as const satisfies Record<string, readonly string[]>;
export type StateForm = keyof typeof STATE_FORMS;
const FORMS = Object.keys(STATE_FORMS) as StateForm[];

/** The form of government a listed form name belongs to */
export const getStateForm = (formName: string): StateForm | undefined =>
  FORMS.find(form => (STATE_FORMS[form] as readonly string[]).includes(formName));

type TaxBases = { salesTax: number; pollTax: number };

const DEFAULT_TAX_BY_FORM: Record<string, TaxBases> = {
  Monarchy: { salesTax: 0.15, pollTax: 0.2 },
  Theocracy: { salesTax: 0.25, pollTax: 0.1 },
  Union: { salesTax: 0.07, pollTax: 0.13 },
  Republic: { salesTax: 0.05, pollTax: 0.15 },
  Anarchy: { salesTax: 0, pollTax: 0 }
};
const DEFAULT_TAX: TaxBases = DEFAULT_TAX_BY_FORM.Monarchy;

class StatesModule {
  regenerate(): { warning?: string; error?: string } {
    const { warning, error, states } = this.recreate();
    if (error || !states) return { warning, error };

    pack.states = states;
    this.expandStates();
    this.normalize();
    this.getPoles();
    this.findNeighbors();
    this.collectStatistics();
    this.assignColors();
    this.generateCampaigns();
    this.generateDiplomacy();
    this.defineStateForms();
    Provinces.regenerate(false);
    Military.regenerate();

    return { warning, error };
  }

  private recreate(): { warning?: string; error?: string; states?: State[] } {
    Math.random = aleaPRNG(generateSeed());
    const statesCount = options.generation.states.limit;
    if (!statesCount) return { error: "<i>States Number</i> option value is zero. No counties are generated" };

    const validBurgs = pack.burgs.filter(burg => burg.i && !burg.removed);
    if (!validBurgs.length) return { error: "There are no burgs to generate states. Please create burgs first" };

    const warning =
      validBurgs.length < statesCount
        ? `Not enough burgs to generate ${statesCount} states. Will generate only ${validBurgs.length} states`
        : undefined;
    const validStates = pack.states.filter(state => state.i && !state.removed);
    const lockedStates = validStates.filter(state => state.lock);
    if (validStates.length && lockedStates.length === validStates.length) {
      return { error: "Unable to regenerate as all states are locked" };
    }

    const lockedStateIds = lockedStates.map(state => state.i);
    const lockedCapitals = lockedStates.map(state => state.capital);
    for (const burg of validBurgs) {
      if (!burg.capital || lockedCapitals.includes(burg.i)) continue;
      burg.capital = 0;
      Burgs.changeGroup(burg, null);
    }

    for (const state of pack.states) {
      if (!state.i || state.removed || state.lock) continue;
      for (const provinceId of state.provinces ?? []) {
        if (!pack.provinces[provinceId]) continue;
        pack.provinces[provinceId].removed = true;
      }
    }

    const sortedBurgs = validBurgs
      .filter(burg => !lockedStateIds.includes(burg.state ?? 0))
      .map((burg): [typeof burg, number] => [burg, (burg.population ?? 0) * Math.random()])
      .sort((a, b) => b[1] - a[1])
      .map(([burg]) => burg);
    const count = Math.min(statesCount, validBurgs.length) + 1;
    let spacing = (options.map.graph.width + options.map.graph.height) / 2 / count;
    const capitalsTree = quadtree<[number, number]>();
    const newStates: State[] = [{ ...pack.states[0], i: 0, name: pack.states[0].name }];

    for (const state of lockedStates) {
      const newId = newStates.length;
      const { x, y } = pack.burgs[state.capital];
      capitalsTree.add([x, y]);
      state.provinces?.forEach(provinceId => {
        if (pack.provinces[provinceId]) pack.provinces[provinceId].state = newId;
      });
      state.i = newId;
      newStates.push(state);
    }

    for (const cellId of pack.cells.i) {
      pack.cells.state[cellId] = lockedStateIds.indexOf(pack.cells.state[cellId]) + 1;
    }

    for (let stateId = newStates.length; stateId < count; stateId++) {
      let capital = null;
      for (const burg of sortedBurgs) {
        if (!capitalsTree.find(burg.x, burg.y, spacing)) {
          burg.capital = 1;
          capital = burg;
          capitalsTree.add([burg.x, burg.y]);
          Burgs.changeGroup(capital, null);
          break;
        }
        spacing = Math.max(spacing - 1, 1);
      }
      if (!capital) break;

      const culture = capital.culture ?? 0;
      const capitalName = capital.name ?? "";
      const basename =
        capitalName.length < 9 && capital.cell % 5 === 0 ? capitalName : Names.getCulture(culture, 3, 6, "");
      const name = Names.getState(basename, culture);
      const nomadic = [1, 2, 3, 4].includes(pack.cells.biome[capital.cell]);
      const type = nomadic
        ? "Nomadic"
        : pack.cultures[culture].type === "Nomadic"
          ? "Generic"
          : pack.cultures[culture].type;
      const expansionism = rn(Math.random() * options.generation.states.sizeVariety + 1, 1);
      const coa = Emblems.generate(capital.coa, 0.3, null, pack.cultures[culture].type);
      coa.shield = capital.coa?.shield;
      newStates.push({
        i: stateId,
        name,
        type,
        capital: capital.i,
        center: capital.cell,
        culture,
        expansionism,
        coa,
        salesTax: 0,
        pollTax: 0,
        treasury: 0
      });
    }

    return { states: newStates, warning };
  }

  private createStates() {
    const states: State[] = [{ i: 0, name: "Neutrals", salesTax: 0, pollTax: 0, treasury: 0 } as State];
    const each5th = each(5);
    const sizeVariety = options.generation.states.sizeVariety;

    pack.burgs.forEach(burg => {
      if (!burg.i || !burg.capital) return;

      const expansionism = rn(Math.random() * sizeVariety + 1, 1);
      const basename = burg.name!.length < 9 && each5th(burg.cell) ? burg.name! : Names.getCultureShort(burg.culture!);
      const name = Names.getState(basename, burg.culture!);
      const type = pack.cultures[burg.culture!].type;
      const coa = Emblems.generate(null, null, null, type);
      coa.shield = Emblems.getShield(burg.culture!);
      states.push({
        i: burg.i,
        name,
        expansionism,
        capital: burg.i,
        type: type!,
        center: burg.cell,
        culture: burg.culture!,
        coa,
        salesTax: 0,
        pollTax: 0,
        treasury: 0
      });
    });

    return states;
  }

  private getBiomeCost(b: number, biome: number, type: string) {
    if (b === biome) return 10; // tiny penalty for native biome
    if (type === "Hunting") return pack.biomes[biome].cost * 2; // non-native biome penalty for hunters
    if (type === "Nomadic" && biome > 4 && biome < 10) return pack.biomes[biome].cost * 3; // forest biome penalty for nomads
    return pack.biomes[biome].cost; // general non-native biome penalty
  }

  private getHeightCost(f: any, h: number, type: string) {
    if (type === "Lake" && f.type === "lake") return 10; // low lake crossing penalty for Lake cultures
    if (type === "Naval" && h < 20) return 300; // low sea crossing penalty for Navals
    if (type === "Nomadic" && h < 20) return 10000; // giant sea crossing penalty for Nomads
    if (h < 20) return 1000; // general sea crossing penalty
    if (type === "Highland" && h < 62) return 1100; // penalty for highlanders on lowlands
    if (type === "Highland") return 0; // no penalty for highlanders on highlands
    if (h >= 67) return 2200; // general mountains crossing penalty
    if (h >= 44) return 300; // general hills crossing penalty
    return 0;
  }

  private getRiverCost(r: any, i: number, type: string) {
    if (type === "River") return r ? 0 : 100; // penalty for river cultures
    if (!r) return 0; // no penalty for others if there is no river
    return minmax(pack.cells.fl[i] / 10, 20, 100); // river penalty from 20 to 100 based on flux
  }

  private getTypeCost(t: number, type: string) {
    if (t === 1) return type === "Naval" || type === "Lake" ? 0 : type === "Nomadic" ? 60 : 20; // penalty for coastline
    if (t === 2) return type === "Naval" || type === "Nomadic" ? 30 : 0; // low penalty for land level 2 for Navals and nomads
    if (t !== -1) return type === "Naval" || type === "Lake" ? 100 : 0; // penalty for mainland for navals
    return 0;
  }

  generate() {
    pack.states = this.createStates();
    this.expandStates();
    this.normalize();
    this.getPoles();
    this.findNeighbors();
    this.assignColors();
    this.generateCampaigns();
    this.generateDiplomacy();
  }

  expandStates() {
    TIME && console.time("expandStates");
    const { cells, states, cultures, burgs } = pack;

    cells.state = cells.state || new Uint16Array(cells.i.length);

    const queue = new FlatQueue();
    const cost: number[] = [];

    const growthRate = (cells.i.length / 2) * options.generation.states.growthRate; // limit cost for state growth

    // remove state from all cells except of locked
    for (const cellId of cells.i) {
      const state = states[cells.state[cellId]];
      if (state.lock) continue;
      cells.state[cellId] = 0;
    }

    for (const state of states) {
      if (!state.i || state.removed) continue;

      const capitalCell = burgs[state.capital].cell;
      cells.state[capitalCell] = state.i;
      const cultureCenter = cultures[state.culture].center!;
      const b = cells.biome[cultureCenter]; // state native biome
      queue.push({ e: state.center, p: 0, s: state.i, b }, 0);
      cost[state.center] = 1;
    }

    while (queue.length) {
      const next = queue.pop();

      const { e, p, s, b } = next;
      const { type, culture } = states[s];

      cells.c[e].forEach(e => {
        const state = states[cells.state[e]];
        if (state.lock) return; // do not overwrite cell of locked states
        if (cells.state[e] && e === state.center) return; // do not overwrite capital cells

        const cultureCost = culture === cells.culture[e] ? -9 : 100;
        const populationCost = cells.h[e] < 20 ? 0 : cells.s[e] ? Math.max(20 - cells.s[e], 0) : 5000;
        const biomeCost = this.getBiomeCost(b, cells.biome[e], type);
        const heightCost = this.getHeightCost(pack.features[cells.f[e]], cells.h[e], type);
        const riverCost = this.getRiverCost(cells.r[e], e, type);
        const typeCost = this.getTypeCost(cells.t[e], type);
        const cellCost = Math.max(cultureCost + populationCost + biomeCost + heightCost + riverCost + typeCost, 0);
        const totalCost = p + 10 + cellCost / states[s].expansionism;

        if (totalCost > growthRate) return;

        if (!cost[e] || totalCost < cost[e]) {
          if (cells.h[e] >= 20) cells.state[e] = s; // assign state to cell
          cost[e] = totalCost;
          queue.push({ e, p: totalCost, s, b }, totalCost);
        }
      });
    }

    burgs
      .filter(b => b.i && !b.removed)
      .forEach(b => {
        b.state = cells.state[b.cell]; // assign state to burgs
      });
    TIME && console.timeEnd("expandStates");
  }

  normalize() {
    TIME && console.time("normalizeStates");
    const { cells, burgs } = pack;

    for (const i of cells.i) {
      if (cells.h[i] < 20 || cells.burg[i]) continue; // do not overwrite burgs
      if (pack.states[cells.state[i]]?.lock) continue; // do not overwrite cells of locks states
      if (cells.c[i].some(c => burgs[cells.burg[c]].capital)) continue; // do not overwrite near capital
      const neibs = cells.c[i].filter(c => cells.h[c] >= 20);
      const adversaries = neibs.filter(c => !pack.states[cells.state[c]]?.lock && cells.state[c] !== cells.state[i]);
      if (adversaries.length < 2) continue;
      const buddies = neibs.filter(c => !pack.states[cells.state[c]]?.lock && cells.state[c] === cells.state[i]);
      if (buddies.length > 2) continue;
      if (adversaries.length <= buddies.length) continue;
      cells.state[i] = cells.state[adversaries[0]];
    }
    TIME && console.timeEnd("normalizeStates");
  }

  // calculate pole of inaccessibility for each state
  getPoles() {
    const getType = (cellId: number) => pack.cells.state[cellId];
    const poles = getPolesOfInaccessibility(pack, getType);

    pack.states.forEach(s => {
      if (!s.i || s.removed) return;
      s.pole = poles[s.i] || [0, 0];
    });
  }

  findNeighbors() {
    const { cells, states } = pack;

    const stateNeighbors: Set<number>[] = [];

    states.forEach(s => {
      if (s.removed) return;
      stateNeighbors[s.i] = new Set();
      // s.neighbors = stateNeighbors[s.i];
    });

    for (const i of cells.i) {
      if (cells.h[i] < 20) continue;
      const s = cells.state[i];

      cells.c[i]
        .filter(c => cells.h[c] >= 20 && cells.state[c] !== s)
        .forEach(c => {
          stateNeighbors[s].add(cells.state[c]);
        });
    }

    // convert neighbors Set object into array
    states.forEach(s => {
      if (!stateNeighbors[s.i] || s.removed) return;
      s.neighbors = Array.from(stateNeighbors[s.i]);
    });
  }

  assignColors() {
    const colors = ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f"]; // d3.schemeSet2;
    const states = pack.states;

    // assign basic color using greedy coloring algorithm
    states.forEach(state => {
      if (!state.i || state.removed || state.lock) return;
      state.color = colors.find(color => state.neighbors!.every(neibStateId => states[neibStateId].color !== color));
      if (!state.color) state.color = getRandomColor();
      colors.push(colors.shift() as string);
    });

    // randomize each already used color a bit
    colors.forEach(c => {
      const sameColored = states.filter(state => state.color === c && state.i && !state.lock);
      sameColored.forEach((state, index) => {
        if (!index) return;
        state.color = getMixedColor(state.color!);
      });
    });
  }

  // calculate states data like area, population etc.
  collectStatistics() {
    const { cells, states } = pack;

    states.forEach(s => {
      if (s.removed) return;
      s.cells = s.area = s.burgs = s.rural = s.urban = 0;
    });

    for (const i of cells.i) {
      if (cells.h[i] < 20) continue;
      const s = cells.state[i];

      // collect stats
      states[s].cells! += 1;
      states[s].area! += cells.area[i];
      states[s].rural! += cells.pop[i];
      if (cells.burg[i]) {
        states[s].urban! += pack.burgs[cells.burg[i]].population!;
        states[s].burgs!++;
      }
    }
  }

  generateCampaign(state: State): Campaign[] {
    const wars = {
      War: 6,
      Conflict: 2,
      Campaign: 4,
      Invasion: 2,
      Rebellion: 2,
      Conquest: 2,
      Intervention: 1,
      Expedition: 1,
      Crusade: 1
    };
    const neighbors = state.neighbors?.length ? state.neighbors : [0];
    return neighbors
      .map((i: number) => {
        const name = i && P(0.8) ? pack.states[i].name : Names.getCultureShort(state.culture);
        const start = gauss(options.map.lore.calendar.year - 100, 150, 1, options.map.lore.calendar.year - 6);
        const end = start + gauss(4, 5, 1, options.map.lore.calendar.year - start - 1);
        return { name: `${getAdjective(name)} ${rw(wars)}`, start, end, attacker: state.i!, defender: i };
      })
      .sort((a, b) => a.start - b.start);
  }

  generateCampaigns() {
    pack.states.forEach(s => {
      if (!s.i || s.removed) return;
      s.campaigns = this.generateCampaign(s);
    });
  }

  // generate Diplomatic Relationships
  generateDiplomacy() {
    TIME && console.time("generateDiplomacy");
    const { cells, states } = pack;
    states[0].diplomacy = [];
    // FIRST STATE IS ALWAYS NEUTRAL and contains the history of diplomacy
    const chronicle = states[0].diplomacy;
    const valid = states.filter(s => s.i && !s.removed); // will filter out neutral as i is 0 => false

    // Pre-Calculate state area since collectStatistics() hasn't run yet.
    const stateAreas = new Float32Array(states.length);
    for (const i of cells.i) {
      if (cells.h[i] >= 20 && cells.state[i]) {
        stateAreas[cells.state[i]] += cells.area[i];
      }
    }

    const neibs = { Ally: 1, Friendly: 2, Neutral: 1, Suspicion: 10, Rival: 9 }; // relations to neighbors
    const neibsOfNeibs = { Ally: 10, Friendly: 8, Neutral: 5, Suspicion: 1 }; // relations to neighbors of neighbors
    const far = { Friendly: 1, Neutral: 12, Suspicion: 2, Unknown: 6 }; // relations to other
    const navals = { Neutral: 1, Suspicion: 2, Rival: 1, Unknown: 1 }; // relations of naval powers

    valid.forEach(s => {
      s.diplomacy = new Array(states.length).fill("x"); // clear all relationships
    });
    if (valid.length < 2) return; // no states to generate relations with
    const areaMean: number = mean(valid.map(s => stateAreas[s.i])) as number; // average state area

    // generic relations
    for (let f = 1; f < states.length; f++) {
      if (states[f].removed) continue;
      if (states[f].diplomacy!.includes("Vassal")) {
        // Vassals copy relations from their Suzerains
        const suzerain = states[f].diplomacy!.indexOf("Vassal");

        for (let i = 1; i < states.length; i++) {
          if (i === f || i === suzerain || states[i].removed) continue;
          states[f].diplomacy![i] = states[suzerain].diplomacy![i];
          if (states[suzerain].diplomacy![i] === "Suzerain") states[f].diplomacy![i] = "Ally";
          for (let e = 1; e < states.length; e++) {
            if (e === f || e === suzerain || states[e].removed) continue;
            if (states[e].diplomacy![suzerain] === "Suzerain" || states[e].diplomacy![suzerain] === "Vassal") continue;
            states[e].diplomacy![f] = states[e].diplomacy![suzerain];
          }
        }
        continue;
      }

      for (let t = f + 1; t < states.length; t++) {
        if (states[t].removed) continue;

        if (states[t].diplomacy!.includes("Vassal")) {
          const suzerain = states[t].diplomacy!.indexOf("Vassal");
          states[f].diplomacy![t] = states[f].diplomacy![suzerain];
          continue;
        }

        const naval =
          states[f].type === "Naval" &&
          states[t].type === "Naval" &&
          cells.f[states[f].center] !== cells.f[states[t].center];
        const neib = naval ? false : states[f].neighbors!.includes(t);
        const neibOfNeib = naval || neib ? false : states[f].neighbors!.some(n => states[n].neighbors!.includes(t));

        let status = naval ? rw(navals) : neib ? rw(neibs) : neibOfNeib ? rw(neibsOfNeibs) : rw(far);

        // add Vassal
        if (neib && P(0.8) && stateAreas[f] > areaMean && stateAreas[t] < areaMean && stateAreas[f] / stateAreas[t] > 2)
          status = "Vassal";
        states[f].diplomacy![t] = status === "Vassal" ? "Suzerain" : status;
        states[t].diplomacy![f] = status;
      }
    }

    // declare wars
    for (let attacker = 1; attacker < states.length; attacker++) {
      const ad = states[attacker].diplomacy as string[]; // attacker relations;
      if (states[attacker].removed) continue;
      if (!ad.includes("Rival")) continue; // no rivals to attack
      if (ad.includes("Vassal")) continue; // not independent
      if (ad.includes("Enemy")) continue; // already at war

      // random independent rival
      const defender = ra(
        ad.map((r, d) => (r === "Rival" && !states[d].diplomacy!.includes("Vassal") ? d : 0)).filter(d => d)
      );
      let ap = stateAreas[attacker] * states[attacker].expansionism;
      let dp = stateAreas[defender] * states[defender].expansionism;
      if (ap < dp * gauss(1.6, 0.8, 0, 10, 2)) continue; // defender is too strong

      const an = states[attacker].name;
      const dn = states[defender].name; // names
      const attackers = [attacker];
      const defenders = [defender]; // attackers and defenders array
      const dd = states[defender].diplomacy as string[]; // defender relations;

      // start an ongoing war
      const name = `${an}-${trimVowels(dn)}ian War`;
      const start = options.map.lore.calendar.year - gauss(2, 3, 0, 10);
      const war = [name, `${an} declared a war on its rival ${dn}`];
      const campaign: Campaign = { name, start, attacker, defender };
      states[attacker].campaigns!.push(campaign);
      states[defender].campaigns!.push(campaign);

      // attacker vassals join the war
      ad.forEach((r, d) => {
        if (r === "Suzerain") {
          attackers.push(d);
          war.push(`${an}'s vassal ${states[d].name} joined the war on attackers side`);
        }
      });

      // defender vassals join the war
      dd.forEach((r, d) => {
        if (r === "Suzerain") {
          defenders.push(d);
          war.push(`${dn}'s vassal ${states[d].name} joined the war on defenders side`);
        }
      });

      ap = sum(attackers.map(a => stateAreas[a] * states[a].expansionism)); // attackers joined power
      dp = sum(defenders.map(d => stateAreas[d] * states[d].expansionism)); // defender joined power

      // defender allies join
      dd.forEach((r, d) => {
        if (r !== "Ally" || states[d].diplomacy!.includes("Vassal")) return;
        if (states[d].diplomacy![attacker] !== "Rival" && ap / dp > 2 * gauss(1.6, 0.8, 0, 10, 2)) {
          const reason = states[d].diplomacy!.includes("Enemy") ? "Being already at war," : `Frightened by ${an},`;
          war.push(`${reason} ${states[d].name} severed the defense pact with ${dn}`);
          dd[d] = states[d].diplomacy![defender] = "Suspicion";
          return;
        }
        defenders.push(d);
        dp += stateAreas[d] * states[d].expansionism;
        war.push(`${dn}'s ally ${states[d].name} joined the war on defenders side`);

        // ally vassals join
        states[d]
          .diplomacy!.map((r, d) => (r === "Suzerain" ? d : 0))
          .filter(d => d)
          .forEach(v => {
            defenders.push(v);
            dp += stateAreas[v] * states[v].expansionism;
            war.push(`${states[d].name}'s vassal ${states[v].name} joined the war on defenders side`);
          });
      });

      // attacker allies join if the defender is their rival or joined power > defenders power and defender is not an ally
      ad.forEach((r, d) => {
        if (r !== "Ally" || states[d].diplomacy!.includes("Vassal") || defenders.includes(d)) return;
        const name = states[d].name;
        if (states[d].diplomacy![defender] !== "Rival" && (P(0.2) || ap <= dp * 1.2)) {
          war.push(`${an}'s ally ${name} avoided entering the war`);
          return;
        }
        const allies = states[d].diplomacy!.map((r, d) => (r === "Ally" ? d : 0)).filter(d => d);
        if (allies.some(ally => defenders.includes(ally))) {
          war.push(`${an}'s ally ${name} did not join the war as its allies are in war on both sides`);
          return;
        }

        attackers.push(d);
        ap += stateAreas[d] * states[d].expansionism;
        war.push(`${an}'s ally ${name} joined the war on attackers side`);

        // ally vassals join
        states[d]
          .diplomacy!.map((r, d) => (r === "Suzerain" ? d : 0))
          .filter(d => d)
          .forEach(v => {
            attackers.push(v);
            ap += stateAreas[v] * states[v].expansionism;
            war.push(`${states[d].name}'s vassal ${states[v].name} joined the war on attackers side`);
          });
      });

      // change relations to Enemy for all participants
      attackers.forEach(a => {
        defenders.forEach((d: number) => {
          states[a].diplomacy![d] = states[d].diplomacy![a] = "Enemy";
        });
      });
      // TODO: record war in chronicle to keep state interface clean
      chronicle.push(war as any); // add a record to diplomatical history
    }
    TIME && console.timeEnd("generateDiplomacy");
  }

  // state 0 stores the diplomacy chronicle (array of [title, ...messages])
  // TODO: move to a better place
  getChronicle(): string[][] {
    return pack.states[0].diplomacy as unknown as string[][];
  }

  // select a forms for listed or all valid states
  defineStateForms(list: number[] | null = null) {
    const states = pack.states.filter(s => s.i && !s.removed && !s.lock);
    if (states.length < 1) return;

    const generic = { Monarchy: 25, Republic: 2, Union: 1 };
    const naval = { Monarchy: 25, Republic: 8, Union: 3 };

    const medianState = median(pack.states.map(s => s.area))!;
    const empireMin = states.map(s => s.area).sort((a = 0, b = 0) => b - a)[
      Math.max(Math.ceil(states.length ** 0.4) - 2, 0)
    ]!;
    const expTiers = pack.states.map(s => {
      let tier = Math.min(Math.floor((s.area! / medianState) * 2.6), 4);
      if (tier === 4 && s.area! < empireMin) tier = 3;
      return tier;
    });

    const monarchy = ["Duchy", "Grand Duchy", "Principality", "Kingdom", "Empire"]; // per expansionism tier
    const republic = {
      Republic: 75,
      Federation: 4,
      "Trade Company": 4,
      "Most Serene Republic": 2,
      Oligarchy: 2,
      Tetrarchy: 1,
      Triumvirate: 1,
      Diarchy: 1,
      Junta: 1
    }; // weighted random
    const union = {
      Union: 3,
      League: 4,
      Confederation: 1,
      "United Kingdom": 1,
      "United Republic": 1,
      "United Provinces": 2,
      Commonwealth: 1,
      Heptarchy: 1
    }; // weighted random
    const theocracy = {
      Theocracy: 20,
      Brotherhood: 1,
      Thearchy: 2,
      See: 1,
      "Holy State": 1
    };
    const anarchy = {
      "Free Territory": 2,
      Council: 3,
      Commune: 1,
      Community: 1
    };

    for (const s of states) {
      if (list && !list.includes(s.i)) continue;
      const tier = expTiers[s.i];

      const religion = pack.cells.religion[s.center];
      const isTheocracy =
        (religion && pack.religions[religion].expansion === "state") ||
        (P(0.1) && ["Organized", "Cult"].includes(pack.religions[religion].type));
      const isAnarchy = P(0.01 - tier / 500);

      if (isTheocracy) s.form = "Theocracy";
      else if (isAnarchy) s.form = "Anarchy";
      else s.form = s.type === "Naval" ? rw(naval) : rw(generic);

      const selectForm = (s: any, tier: number) => {
        const base = pack.cultures[s.culture].base;

        if (s.form === "Monarchy") {
          const form = monarchy[tier];
          // Default name depends on exponent tier, some culture bases have special names for tiers
          if (s.diplomacy) {
            if (
              form === "Duchy" &&
              s.neighbors.length > 1 &&
              rand(6) < s.neighbors.length &&
              s.diplomacy.includes("Vassal")
            )
              return "Marches"; // some vassal duchies on borderland
            if (base === 1 && P(0.3) && s.diplomacy.includes("Vassal")) return "Dominion"; // English vassals
            if (P(0.3) && s.diplomacy.includes("Vassal")) return "Protectorate"; // some vassals
          }

          if (base === 31 && (form === "Empire" || form === "Kingdom")) return "Khanate"; // Mongolian
          if (base === 16 && form === "Principality") return "Beylik"; // Turkic
          if (base === 5 && (form === "Empire" || form === "Kingdom")) return "Tsardom"; // Ruthenian
          if (base === 16 && (form === "Empire" || form === "Kingdom")) return "Khaganate"; // Turkic
          if (base === 12 && (form === "Kingdom" || form === "Grand Duchy")) return "Shogunate"; // Japanese
          if ([18, 17].includes(base) && form === "Empire") return "Caliphate"; // Arabic, Berber
          if (base === 18 && (form === "Grand Duchy" || form === "Duchy")) return "Emirate"; // Arabic
          if (base === 7 && (form === "Grand Duchy" || form === "Duchy")) return "Despotate"; // Greek
          if (base === 31 && (form === "Grand Duchy" || form === "Duchy")) return "Ulus"; // Mongolian
          if (base === 16 && (form === "Grand Duchy" || form === "Duchy")) return "Horde"; // Turkic
          if (base === 24 && (form === "Grand Duchy" || form === "Duchy")) return "Satrapy"; // Iranian
          return form;
        }

        if (s.form === "Republic") {
          // Default name is from weighted array, special case for small states with only 1 burg
          if (tier < 2 && s.burgs === 1) {
            if (trimVowels(s.name) === trimVowels(pack.burgs[s.capital].name!)) {
              s.name = pack.burgs[s.capital].name;
              return "Free City";
            }
            if (P(0.3)) return "City-state";
          }
          return rw(republic);
        }

        if (s.form === "Union") return rw(union);
        if (s.form === "Anarchy") return rw(anarchy);

        if (s.form === "Theocracy") {
          // European
          if ([0, 1, 2, 3, 4, 6, 8, 9, 13, 15, 20].includes(base)) {
            if (P(0.1)) return `Divine ${monarchy[tier]}`;
            if (tier < 2 && P(0.5)) return "Diocese";
            if (tier < 2 && P(0.5)) return "Bishopric";
          }
          if (P(0.9) && [7, 5].includes(base)) {
            // Greek, Ruthenian
            if (tier < 2) return "Eparchy";
            if (tier === 2) return "Exarchate";
            if (tier > 2) return "Patriarchate";
          }
          if (P(0.9) && [21, 16].includes(base)) return "Imamah"; // Nigerian, Turkish
          if (tier > 2 && P(0.8) && [18, 17, 28].includes(base)) return "Caliphate"; // Arabic, Berber, Swahili
          return rw(theocracy);
        }
      };

      s.formName = selectForm(s, tier);
      s.fullName = this.getFullName(s);

      const taxes = this.defineTaxRates(s);
      s.salesTax = taxes.salesTax;
      s.pollTax = taxes.pollTax;
    }
  }

  defineTaxRates(state: State) {
    const { salesTax, pollTax } = DEFAULT_TAX_BY_FORM[state.form || ""] || DEFAULT_TAX;
    return {
      salesTax: rn(gauss(salesTax, salesTax * 0.15, salesTax * 0.5, salesTax * 1.5, 4), 2),
      pollTax: rn(gauss(pollTax, pollTax * 0.15, pollTax * 0.5, pollTax * 1.5, 4), 2)
    };
  }

  getFullName(state: State) {
    // state forms requiring Adjective + Name, all other forms use scheme Form + Of + Name
    const adjForms = [
      "Empire",
      "Sultanate",
      "Khaganate",
      "Shogunate",
      "Caliphate",
      "Despotate",
      "Theocracy",
      "Oligarchy",
      "Union",
      "Confederation",
      "Trade Company",
      "League",
      "Tetrarchy",
      "Triumvirate",
      "Diarchy",
      "Horde",
      "Marches"
    ];
    if (!state.formName) return state.name;
    if (!state.name && state.formName) return `The ${state.formName}`;
    const adjName = adjForms.includes(state.formName) && !/-| /.test(state.name);
    return adjName ? `${getAdjective(state.name)} ${state.formName}` : `${state.formName} of ${state.name}`;
  }

  /** Rename a state; a custom full name or label keeps its pattern when the old name stands in it as a whole word */
  rename(stateId: number, name: string): void {
    const state = pack.states[stateId];
    if (!state || state.removed) throw new Error(`State ${stateId} does not exist`);
    const old = state.name;
    state.name = requireName(name);
    state.fullName = replaceWholeWord(state.fullName, old, state.name) ?? this.getFullName(state);
    if (state.label?.text) state.label.text = replaceWholeWord(state.label.text, old, state.name) ?? state.label.text;
  }

  /** Set a state's color */
  recolor(stateId: number, color: string): void {
    this.living(stateId).color = requireColor(color);
  }

  /** Set a state's full name, such as "Grand Duchy of Orwin" */
  setFullName(stateId: number, fullName: string): void {
    this.living(stateId).fullName = requireName(fullName);
  }

  /** Set a state's form name, such as Kingdom or Free City; empty clears it. Its government (Monarchy, Republic, Union, Theocracy or Anarchy) follows a listed name, or `form` for a custom one. The full name is rebuilt */
  setForm(stateId: number, formName: string, form?: string): void {
    const state = this.living(stateId);
    if (typeof formName !== "string") throw new Error("The form name must be text");
    const name = formName.trim();
    const government = form === undefined ? getStateForm(name) : requireOneOf(form, FORMS, "The form");
    if (name) state.formName = name;
    else delete state.formName;
    if (government) state.form = government;
    state.fullName = this.getFullName(state);
  }

  /** Set a state's dominant culture */
  setCulture(stateId: number, cultureId: number): void {
    const culture = pack.cultures[cultureId];
    if (!culture || culture.removed) throw new Error(`Culture ${cultureId} does not exist`);
    this.living(stateId).culture = cultureId;
  }

  /** Set a state's type, which steers its expansion: Generic, Hunting, Highland, River, Lake, Naval or Nomadic */
  setType(stateId: number, type: string): void {
    this.living(stateId).type = requireOneOf(type, CULTURE_TYPES, "The type");
  }

  /** Set how strongly a state expands when states are recalculated, from 0 to 99 */
  setExpansionism(stateId: number, expansionism: number): void {
    if (typeof expansionism !== "number" || !(expansionism >= 0 && expansionism <= 99))
      throw new Error("The expansionism must be a number from 0 to 99");
    this.living(stateId).expansionism = expansionism;
  }

  /** Set a state's relation towards another; the other takes the inverse and the chronicle records the change */
  setRelation(stateId: number, otherId: number, relation: string): void {
    const [subject, object] = [this.living(stateId), this.living(otherId)];
    if (!subject.i || !object.i || subject === object) throw new Error("Relations are between two different states");
    requireOneOf(relation, Object.keys(RELATIONS), "The relation");
    const old = subject.diplomacy?.[otherId];
    if (old === relation) return;
    subject.diplomacy ??= [];
    object.diplomacy ??= [];
    subject.diplomacy[otherId] = relation;
    object.diplomacy[stateId] = getInverseRelation(relation);
    this.getChronicle().push(this.getRelationRecord(stateId, otherId, old, relation));
  }

  /** The chronicle record of a state taking up a relation towards another */
  getRelationRecord(subjectId: number, objectId: number, oldRelation: string | undefined, newRelation: string) {
    const subject = pack.states[subjectId].name;
    const object = pack.states[objectId].name;
    const { title, text } = RELATIONS[newRelation].event ?? {
      title: "Relations change",
      text: () => `${subject}-${getAdjective(object)} relations changed to ${newRelation.toLowerCase()}`
    };
    if (oldRelation !== "Enemy") return [title, text(subject, object)];
    return [
      "War termination",
      `${subject} and ${object} agreed to cease fire and signed a peace treaty`,
      text(subject, object)
    ];
  }

  /** Redraw state borders from their capitals, types and expansionism; provinces are regenerated */
  recalculate(): void {
    this.expandStates();
    Provinces.generate();
    Provinces.getPoles();
    this.getPoles();
    this.findNeighbors();
    this.collectStatistics();
  }

  /** Found a state at a map point with the burg there, or a new one, as its capital. It owns only that cell. Returns its id */
  add(x: number, y: number): number {
    const { cells, burgs, cultures } = pack;
    const center = Pack.requireCell(x, y);
    if (cells.h[center] < 20) throw new Error("A state cannot be placed in the water");
    const existing = cells.burg[center];
    if (existing && burgs[existing].capital) throw new Error(`Burg ${existing} is already a capital`);
    const capital = existing || Burgs.add(x, y);
    const culture = cells.culture[center];
    const basename = center % 5 === 0 ? burgs[capital].name! : Names.getCulture(culture);
    const coa = Emblems.generate(burgs[capital].coa, 0.4, null, cultures[culture].type);
    coa.shield = Emblems.getShield(culture, undefined);
    return this.found(Names.getState(basename, culture), capital, coa, [center]);
  }

  /** A new state around a capital burg, taking the given cells from their state and provinces. Returns its id */
  found(name: string, capitalId: number, coa: Emblem, stateCells: number[]): number {
    const { cells, states, burgs } = pack;
    const i = states.length;
    const capital = burgs[capitalId];
    const overlord = cells.state[capital.cell];
    const inverse: Record<string, string> = {
      Ally: "Suspicion",
      Friendly: "Suspicion",
      Suspicion: "Neutral",
      Enemy: "Friendly",
      Rival: "Friendly",
      Vassal: "Suspicion",
      Suzerain: "Enemy"
    };
    const diplomacy = states.map(state => {
      if (!state.i || state.removed) return "x";
      const old = states[overlord].diplomacy?.[state.i] ?? "Neutral";
      const relation = !overlord ? "Neutral" : state.i === overlord ? "Enemy" : (inverse[old] ?? old);
      state.diplomacy ??= [];
      state.diplomacy[i] = relation;
      return relation;
    });
    diplomacy.push("x");
    if (overlord)
      this.getChronicle().push([
        "Independence declaration",
        `${name} declared its independence from ${states[overlord].name}`
      ]);

    const owned = new Set(stateCells);
    for (const cell of owned) {
      cells.state[cell] = i;
      cells.province[cell] = 0;
    }
    for (const burg of burgs) if (burg?.i && !burg.removed && owned.has(burg.cell)) burg.state = i;
    capital.capital = 1;
    Burgs.changeGroup(capital, null);

    states.push({
      i,
      name,
      diplomacy,
      provinces: [],
      color: getRandomColor(),
      expansionism: 0.5,
      capital: capitalId,
      type: "Generic",
      center: capital.cell,
      culture: capital.culture ?? cells.culture[capital.cell],
      military: [],
      alert: 1,
      coa,
      salesTax: 0,
      pollTax: 0,
      treasury: 0
    });
    this.getPoles();
    this.findNeighbors();
    this.collectStatistics();
    this.defineStateForms([i]);
    return i;
  }

  /** Remove a state with its provinces; its lands and burgs become neutral */
  remove(stateId: number): void {
    const state = this.living(stateId);
    if (!stateId) throw new Error("Neutral lands cannot be removed");
    const { cells, burgs, provinces } = pack;

    for (const burg of burgs) {
      if (!burg?.i || burg.state !== stateId) continue;
      burg.state = 0;
      if (burg.capital) {
        burg.capital = 0;
        Burgs.changeGroup(burg, null);
      }
    }
    const removedProvinces = new Set(state.provinces ?? []);
    for (const province of removedProvinces) provinces[province] = { i: province, removed: true } as Province;
    cells.state.forEach((owner, cell) => {
      if (owner !== stateId) return;
      cells.state[cell] = 0;
      if (removedProvinces.has(cells.province[cell])) cells.province[cell] = 0;
    });
    for (const other of pack.states)
      if (other.i && !other.removed && other.neighbors) other.neighbors = other.neighbors.filter(n => n !== stateId);
    pack.states[stateId] = { i: stateId, removed: true } as State;
  }

  /** Merge states into a ruling one, which takes their lands, burgs, provinces and regiments. With `asProvinces`, each merged state becomes one province of the ruling state instead of keeping its own provinces */
  merge(rulingStateId: number, stateIds: number[], asProvinces = false): void {
    const ruling = this.living(rulingStateId);
    if (!rulingStateId) throw new Error("Neutral lands cannot rule");
    if (!Array.isArray(stateIds) || !stateIds.length) throw new Error("Name at least one state to merge");
    const merged = stateIds.filter(id => id !== rulingStateId).map(id => this.living(id));
    if (merged.some(state => !state.i)) throw new Error("Neutral lands cannot be merged");
    const ids = new Set(merged.map(state => state.i));
    if (asProvinces) for (const state of merged) this.demoteToProvince(state, ruling);

    ruling.military ??= [];
    ruling.provinces ??= [];
    for (const state of merged) {
      state.removed = true;
      delete state.label;
      for (const regiment of state.military ?? [])
        ruling.military.push({
          ...regiment,
          i: Math.max(-1, ...ruling.military.map(({ i }) => i)) + 1,
          state: rulingStateId
        });
      ruling.provinces.push(...(state.provinces ?? []).filter(province => !pack.provinces[province]?.removed));
      state.military = [];
      state.provinces = [];
    }
    for (const burg of pack.burgs) {
      if (!burg?.i || !ids.has(burg.state ?? 0)) continue;
      burg.state = rulingStateId;
      if (burg.capital) {
        burg.capital = 0;
        Burgs.changeGroup(burg, null);
      }
    }
    for (const province of pack.provinces) if (ids.has(province.state)) province.state = rulingStateId;
    pack.cells.state.forEach((owner, cell) => {
      if (ids.has(owner)) pack.cells.state[cell] = rulingStateId;
    });
    this.findNeighbors();
    this.collectStatistics();
    this.getPoles();
    if (asProvinces) Provinces.getPoles();
  }

  /** A state's lands become one new province of the ruling state; its own provinces are removed */
  private demoteToProvince(state: State, ruling: State): void {
    const { cells, provinces, burgs } = pack;
    const provinceId = provinces.length;
    for (const province of provinces)
      if (province.state === state.i && !province.removed)
        provinces[province.i] = { i: province.i, removed: true } as Province;
    cells.state.forEach((owner, cell) => {
      if (owner === state.i) cells.province[cell] = provinceId;
    });

    const burg = state.capital;
    const formName = state.formName || "Province";
    provinces.push({
      i: provinceId,
      state: ruling.i,
      center: burg ? burgs[burg].cell : state.center,
      burg,
      name: state.name,
      formName,
      fullName: `${state.name} ${formName}`,
      color: getMixedColor(state.color!),
      coa: state.coa
    } as Province);
    ruling.provinces ??= [];
    ruling.provinces.push(provinceId);
  }

  /** Set a state's rural and urban population, in people: its cells and burgs scale to the totals */
  setPopulation(stateId: number, rural: number, urban: number): void {
    this.living(stateId);
    const { cells } = pack;
    Population.setArea(
      Population.landCells(cell => cells.state[cell] === stateId),
      Population.burgIds(burg => burg.state === stateId),
      rural,
      urban
    );
    this.collectStatistics();
  }

  /** Set a state's sales tax (0 to 1, on deals it sells) and poll tax (per person); they take effect when production is regenerated */
  setTaxes(stateId: number, salesTax: number, pollTax: number): void {
    const state = this.ruled(stateId);
    if (typeof salesTax !== "number" || !(salesTax >= 0 && salesTax <= 1))
      throw new Error("The sales tax must be a number from 0 to 1");
    if (typeof pollTax !== "number" || !(pollTax >= 0 && Number.isFinite(pollTax)))
      throw new Error("The poll tax must be a non-negative number");
    state.salesTax = rn(salesTax, 4);
    state.pollTax = rn(pollTax, 4);
  }

  /** Set a state's treasury, in the map's currency */
  setTreasury(stateId: number, amount: number): void {
    if (typeof amount !== "number" || !Number.isFinite(amount)) throw new Error("The treasury must be a number");
    this.ruled(stateId).treasury = rn(amount, 2);
  }

  /** Lock a state so regeneration keeps it, or unlock it */
  setLocked(stateId: number, locked: boolean): void {
    const state = this.ruled(stateId);
    if (locked) state.lock = true;
    else delete state.lock;
  }

  /** Replace a chronicle entry with text lines, the first being its title. Index = length adds an entry; no lines removes it */
  setChronicleEntry(index: number, lines: string[]): void {
    pack.states[0].diplomacy ??= [];
    const chronicle = this.getChronicle();
    if (!Number.isInteger(index) || index < 0 || index > chronicle.length)
      throw new Error(`Chronicle entry ${index} does not exist; entries are counted from 0`);
    if (!Array.isArray(lines) || lines.some(line => typeof line !== "string" || !line.trim()))
      throw new Error("A chronicle entry is a list of non-empty text lines");
    if (!lines.length) {
      if (index < chronicle.length) chronicle.splice(index, 1);
      return;
    }
    chronicle[index] = lines.map(line => escapeHtml(line.trim()));
  }

  /** Give land cells to a state, or to neutral lands with id 0, with their burgs. Provinces follow: a province wholly taken changes owner, a split one is divided */
  setCells(stateId: number, cellIds: number[]): void {
    this.living(stateId);
    const { cells, states, burgs } = pack;
    if (!Array.isArray(cellIds) || !cellIds.length) throw new Error("Name at least one cell");
    const centers = new Set(states.filter(state => state.i && !state.removed).map(state => state.center));
    for (const cell of cellIds) {
      if (!Number.isInteger(cell) || cell < 0 || cell >= cells.i.length) throw new Error(`Cell ${cell} does not exist`);
      if (cells.h[cell] < 20) throw new Error(`Cell ${cell} is water; states hold land only`);
      if (centers.has(cell) && cells.state[cell] !== stateId)
        throw new Error(`Cell ${cell} is the center of state ${cells.state[cell]} and cannot change hands`);
    }

    const affectedProvinces = new Set<number>();
    for (const cell of cellIds) {
      if (cells.state[cell] === stateId) continue;
      affectedProvinces.add(cells.province[cell]);
      cells.state[cell] = stateId;
      if (cells.burg[cell]) burgs[cells.burg[cell]].state = stateId;
    }
    if (!affectedProvinces.size) return;
    this.getPoles();
    this.findNeighbors();
    this.adjustProvinces([...affectedProvinces]);
  }

  /** Provinces whose cells changed state: wholly taken ones change owner, split ones divide or join a neighbor */
  private adjustProvinces(affectedProvinces: number[]): void {
    const { cells, provinces, states, burgs } = pack;

    const changeOwner = (provinceId: number, ownerId: number, provinceCells: number[]) => {
      const province = provinces[provinceId];
      const previous = states[province.state];
      previous.provinces = (previous.provinces ?? []).filter(id => id !== provinceId);
      if (ownerId) {
        province.state = ownerId;
        states[ownerId].provinces = [...(states[ownerId].provinces ?? []), provinceId];
      } else {
        provinces[provinceId] = { i: provinceId, removed: true } as Province;
        for (const cell of provinceCells) cells.province[cell] = 0;
      }
    };

    const findClosest = (provinceId: number, stateId: number, sourceCells: number[]) => {
      const border = sourceCells.find(i =>
        cells.c[i].some(c => cells.state[c] === stateId && cells.province[c] && cells.province[c] !== provinceId)
      );
      return border && cells.c[border].map(c => cells.province[c]).find(p => p && p !== provinceId);
    };

    const create = (old: Province, stateId: number, provinceCells: number[]) => {
      const id = provinces.length;
      const burgCell = provinceCells.find(i => cells.burg[i]);
      const center = burgCell ?? provinceCells[0];
      const burgId = burgCell ? cells.burg[burgCell] : 0;
      const burg = burgId ? burgs[burgId] : null;
      const culture = cells.culture[center];
      const nameByBurg = burgCell && P(0.5);
      const name = nameByBurg ? burg!.name! : old.name || Names.getState(Names.getCultureShort(culture), culture);
      const formName = burgCell && old.formName ? old.formName : ra(["Zone", "Area", "Territory", "Province"]);
      const type = Burgs.getType(center, burg?.port);
      const coa = Emblems.generate(burg?.coa || states[stateId].coa, nameByBurg ? 0.8 : 0.4, burg ? null : 0.9, type);
      coa.shield = Emblems.getShield(culture, stateId);
      provinces.push({
        i: id,
        state: stateId,
        center,
        burg: burgId,
        name,
        formName,
        fullName: `${name} ${formName}`,
        color: getMixedColor(states[stateId].color!),
        coa
      } as Province);
      for (const cell of provinceCells) cells.province[cell] = id;
      states[stateId].provinces = [...(states[stateId].provinces ?? []), id];
    };

    const split = (provinceId: number, provinceStates: number[], provinceCells: number[]) => {
      const province = provinces[provinceId];
      const previous = states[province.state];
      const centerOwner = cells.state[province.center];
      for (const stateId of provinceStates) {
        const owned = provinceCells.filter(i => cells.state[i] === stateId);
        if (stateId === centerOwner) {
          if (stateId === previous.i) continue;
          if (!stateId) {
            provinces[provinceId] = { i: provinceId, removed: true } as Province;
            for (const cell of owned) cells.province[cell] = 0;
            continue;
          }
          previous.provinces = (previous.provinces ?? []).filter(id => id !== provinceId);
          province.state = stateId;
          province.color = getMixedColor(states[stateId].color!);
          states[stateId].provinces = [...(states[stateId].provinces ?? []), provinceId];
          continue;
        }
        if (!stateId) {
          for (const cell of owned) cells.province[cell] = 0;
          continue;
        }
        const closest = owned.length < 20 && findClosest(provinceId, stateId, owned);
        if (closest) for (const cell of owned) cells.province[cell] = closest;
        else create(province, stateId, owned);
      }
    };

    for (const provinceId of affectedProvinces) {
      if (!provinces[provinceId] || provinces[provinceId].removed) continue;
      const provinceCells = Array.from(cells.i).filter(i => cells.province[i] === provinceId);
      const provinceStates = [...new Set(provinceCells.map(i => cells.state[i]))];
      if (provinceId && provinceStates.length === 1) changeOwner(provinceId, provinceStates[0], provinceCells);
      else split(provinceId, provinceStates, provinceCells);
    }
  }

  /** A living state other than the neutral lands */
  private ruled(stateId: number): State {
    const state = this.living(stateId);
    if (!stateId) throw new Error("Neutral lands have no government");
    return state;
  }

  private living(stateId: number): State {
    const state = pack.states[stateId];
    if (!state || state.removed) throw new Error(`State ${stateId} does not exist`);
    return state;
  }

  collectTaxes() {
    const { states, burgs, deals } = pack;
    if (!states.length) return;
    for (const state of states) {
      if (!state.i || state.removed) continue;
      state.treasury = 0;
    }

    for (const deal of deals) {
      if (!deal.tax) continue;

      let sellerStateId = 0;
      if (deal.sellerType === "burg") {
        sellerStateId = burgs?.[deal.seller]?.state || 0;
      } else if (deal.sellerType === "market") {
        const market = Markets.get(deal.seller);
        const centerBurgId = market?.centerBurgId;
        sellerStateId = centerBurgId ? burgs?.[centerBurgId]?.state || 0 : 0;
      }
      if (!sellerStateId) continue;
      const state = states[sellerStateId];
      if (!state || state.removed) continue;
      state.treasury += deal.tax;
    }

    for (const state of states) {
      if (!state.i || state.removed) continue;
      const population = (state.rural || 0) + (state.urban || 0);
      state.treasury = rn(state.treasury + state.pollTax * population, 2);
    }
  }

  getSalesTax(burg: { state?: number }): number {
    const stateId = burg.state || 0;
    if (!stateId) return 0;
    return pack.states?.[stateId]?.salesTax ?? 0;
  }
}

window.States = new StatesModule();
