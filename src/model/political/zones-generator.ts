import { mean } from "d3";
import { Corruption } from "@/model/economy/corruption";
import { DEAL_KINDS } from "@/model/economy/deals";
import { Goods } from "@/model/economy/goods-generator";
import { Routes } from "@/model/economy/routes-generator";
import { Stability, type StabilityPart } from "@/model/political/stability";
import { Names } from "@/model/society/names-generator";
import { Population } from "@/model/society/population-generator";
import { requireColor } from "@/utils/color-utils";
import { FlatQueue } from "@/utils/flat-queue";
import { getAdjective } from "@/utils/language-utils";
import { gauss, P, ra, rand, rw } from "@/utils/probability-utils";
import { requireName } from "@/utils/validation-utils";

/** One of the items, each as likely as its weight; with equal weights the same pick as `ra` */
function pickWeighted<T>(items: T[], weights: number[]): T | undefined {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!total) return ra(items);
  const roll = Math.random() * total;
  let passed = 0;
  return (
    items.find((_, k) => {
      passed += weights[k];
      return roll < passed;
    }) ?? items.at(-1)
  );
}

export interface Zone {
  i: number;
  name: string;
  type: string;
  cells: number[];
  color: string;
  hidden?: boolean;
  note?: string;
  tags?: string[];
}

type ZoneGenerator = (usedCells: Uint8Array) => void;

interface ZoneConfig {
  quantity: number;
  generate: ZoneGenerator;
}

class ZonesModule {
  private config: Record<string, ZoneConfig>;

  constructor() {
    this.config = {
      invasion: { quantity: 2, generate: u => this.addInvasion(u) },
      rebels: { quantity: 1.5, generate: u => this.addRebels(u) },
      proselytism: { quantity: 1.6, generate: u => this.addProselytism(u) },
      crusade: { quantity: 1.6, generate: u => this.addCrusade(u) },
      disease: { quantity: 1.4, generate: u => this.addDisease(u) },
      disaster: { quantity: 1, generate: u => this.addDisaster(u) },
      eruption: { quantity: 1, generate: u => this.addEruption(u) },
      avalanche: { quantity: 0.8, generate: u => this.addAvalanche(u) },
      fault: { quantity: 1, generate: u => this.addFault(u) },
      flood: { quantity: 1, generate: u => this.addFlood(u) },
      tsunami: { quantity: 1, generate: u => this.addTsunami(u) },
      famine: { quantity: 1, generate: u => this.addFamine(u) }
    };
  }

  /** Rename a zone; its name is its description */
  rename(zoneId: number, name: string): void {
    this.living(zoneId).name = requireName(name);
  }

  /** Set a zone's color */
  recolor(zoneId: number, color: string): void {
    this.living(zoneId).color = requireColor(color);
  }

  /** Set a zone's type, a free label such as Invasion or Disease */
  setType(zoneId: number, type: string): void {
    this.living(zoneId).type = requireName(type);
  }

  /** Hide or show a zone */
  setHidden(zoneId: number, hidden: boolean): void {
    const zone = this.living(zoneId);
    if (hidden) zone.hidden = true;
    else delete zone.hidden;
  }

  /** Add a zone over a list of cell ids; returns its id */
  add(name: string, type: string, cells: number[]): number {
    const i = pack.zones.length ? Math.max(...pack.zones.map(zone => zone.i)) + 1 : 0;
    const zone = {
      i,
      name: requireName(name),
      type: requireName(type),
      color: `url(#hatch${i % 42})`,
      cells: [],
      tags: []
    };
    pack.zones.push(zone);
    this.setCells(i, cells);
    return i;
  }

  /** Set the cells a zone covers, as a list of cell ids */
  setCells(zoneId: number, cells: number[]): void {
    const count = pack.cells.i.length;
    if (
      !Array.isArray(cells) ||
      !cells.length ||
      cells.some(cell => !Number.isInteger(cell) || cell < 0 || cell >= count)
    )
      throw new Error(`The cells must be a non-empty list of cell ids from 0 to ${count - 1}`);
    this.living(zoneId).cells = [...new Set(cells)];
  }

  /** Set the rural and urban population of a zone's land, in people: its cells and burgs scale to the totals */
  setPopulation(zoneId: number, rural: number, urban: number): void {
    const cells = new Set(this.living(zoneId).cells);
    Population.setArea(
      Population.landCells(cell => cells.has(cell)),
      Population.burgIds(burg => cells.has(burg.cell)),
      rural,
      urban
    );
  }

  /** Remove a zone */
  remove(zoneId: number): void {
    this.living(zoneId);
    pack.zones = pack.zones.filter(zone => zone.i !== zoneId);
  }

  private living(zoneId: number): Zone {
    const zone = pack.zones.find(({ i }) => i === zoneId);
    if (!zone) throw new Error(`Zone ${zoneId} does not exist`);
    return zone;
  }

  regenerate(globalModifier = 1): void {
    this.generate(globalModifier);
    Goods.remapEntityMultipliers("zone", new Map()); // zones are all new
  }

  generate(globalModifier = 1) {
    const usedCells = new Uint8Array(pack.cells.i.length);
    pack.zones = [];

    Object.values(this.config).forEach(type => {
      const expectedNumber = type.quantity * globalModifier;
      let number = gauss(expectedNumber, expectedNumber / 2, 0, 100);
      while (number--) type.generate(usedCells);
    });

    for (const zone of pack.zones) {
      if (!zone) continue;
      zone.tags ??= [];
      zone.cells = [...new Set(zone.cells)]; // a spreading zone can reach a cell twice
    }
  }

  private addInvasion(usedCells: Uint8Array) {
    const { cells, states } = pack;

    const ongoingConflicts = states
      .filter(s => s.i && !s.removed && s.campaigns)
      .flatMap(s => s.campaigns!)
      .filter(c => !c.end);
    if (!ongoingConflicts.length) return;
    const { defender, attacker, name: war } = ra(ongoingConflicts);

    const borderCells = cells.i.filter(cellId => {
      if (usedCells[cellId]) return false;
      if (cells.state[cellId] !== defender) return false;
      return cells.c[cellId].some(c => cells.state[c] === attacker);
    });

    // invaders strike where the land is richest
    const startCell = pickWeighted(
      borderCells,
      borderCells.map(cellId => (cells.prosperity?.[cellId] || 0) ** 2)
    );
    if (startCell === undefined) return;

    const invasionCells: number[] = [];
    const queue = [startCell];
    const maxCells = rand(5, 30);

    while (queue.length) {
      const cellId = P(0.4) ? queue.shift()! : queue.pop()!;
      invasionCells.push(cellId);
      if (invasionCells.length >= maxCells) break;

      cells.c[cellId].forEach(neibCellId => {
        if (usedCells[neibCellId]) return;
        if (cells.state[neibCellId] !== defender) return;
        usedCells[neibCellId] = 1;
        queue.push(neibCellId);
      });
    }

    const subtype = rw({
      Invasion: 5,
      Occupation: 4,
      Conquest: 3,
      Incursion: 2,
      Intervention: 2,
      Assault: 1,
      Foray: 1,
      Intrusion: 1,
      Irruption: 1,
      Offensive: 1,
      Pillaging: 1,
      Plunder: 1,
      Raid: 1,
      Skirmishes: 1
    });
    const name = `${getAdjective(states[attacker].name)} ${subtype}`;
    const note = `Troops of ${states[attacker].name} have crossed into ${states[defender].name} in the ${war}. They raid, besiege and hold the land here, the richest along the border, and its people flee before them.`;

    pack.zones.push({
      i: pack.zones.length,
      name,
      note,
      type: "Invasion",
      cells: invasionCells,
      color: "url(#hatch1)"
    });
  }

  private addRebels(usedCells: Uint8Array) {
    const { cells, states } = pack;

    // unstable states rise more often, in their least stable land; all alike before the run
    const instability = (stability = 0.5) => (1 - stability) ** 2;
    const candidates = states.filter(s => s.i && !s.removed && s.neighbors?.some(Boolean));
    const state = pickWeighted(
      candidates,
      candidates.map(s => instability(Stability.get(s.i)?.stability))
    );
    if (!state) return;

    const neibStateId = ra(state.neighbors!.filter((n: number) => n && !states[n].removed));
    if (!neibStateId) return;

    const provinces = Stability.getProvinces(state.i).filter(d => d.province.people);
    const unstable = provinces.length
      ? pickWeighted(
          provinces,
          provinces.map(d => instability(d.stability))
        )
      : undefined;
    const risen = unstable?.province;
    const inside = (cellId: number) =>
      cells.state[cellId] === state.i && (!risen || Corruption.ofCell(cellId) === risen);
    const atBorder = (cellId: number) => cells.c[cellId].some(c => cells.state[c] === neibStateId);

    const cellsArray: number[] = [];
    const queue: number[] = [];
    const borderCellId = cells.i.find(i => inside(i) && atBorder(i));
    // away from the neighbor, it rises around the province's capital, or anywhere when that lies outside it
    const capital = risen?.burg?.cell;
    const start =
      borderCellId ?? (risen && (capital !== undefined && inside(capital) ? capital : cells.i.find(inside)));
    if (start !== undefined) queue.push(start);
    const maxCells = rand(10, 30);

    while (queue.length) {
      const cellId = queue.shift()!;
      cellsArray.push(cellId);
      if (cellsArray.length >= maxCells) break;

      cells.c[cellId].forEach(neibCellId => {
        if (usedCells[neibCellId]) return;
        if (!inside(neibCellId)) return;
        usedCells[neibCellId] = 1;
        if (borderCellId !== undefined && neibCellId % 4 !== 0 && !atBorder(neibCellId)) return;
        queue.push(neibCellId);
      });
    }

    const parts = unstable?.parts;
    const TAX_REVOLT_BURDEN = 0.1; // stability the tax burden takes, its largest loss, for a province's rebels to be a tax revolt
    const isTaxRevolt =
      !!parts && parts.burden <= -TAX_REVOLT_BURDEN && Object.values(parts).every(part => part >= parts.burden);
    const rebels = isTaxRevolt
      ? rw({ "Tax Revolt": 3, "Tax Rebels": 2, "Tithe Riots": 1, "Peasant Revolt": 1 })
      : rw({
          Rebels: 5,
          Insurrection: 2,
          Mutineers: 1,
          Insurgents: 1,
          Rebellion: 1,
          Renegades: 1,
          Revolters: 1,
          Revolutionaries: 1,
          Rioters: 1,
          Separatists: 1,
          Secessionists: 1,
          Conspiracy: 1
        });

    const province = risen?.id ? pack.provinces[risen.id] : undefined;
    const named = isTaxRevolt
      ? (province ?? state)
      : borderCellId !== undefined || !province
        ? states[neibStateId]
        : province;
    const name = `${getAdjective(named.name)} ${rebels}`;
    const place = province?.name ?? state.name;
    const cause = parts && this.getUnrestCause(parts);
    const note = isTaxRevolt
      ? `Crushed by the taxes of ${state.name}, the people of ${place} refuse to pay and have taken up arms against the tax collectors.`
      : borderCellId !== undefined
        ? `People of ${state.name} along the border with ${states[neibStateId].name} have taken up arms against their rulers, backed by their neighbor${cause ? `. ${cause}` : ""}.`
        : `${place} has risen against the rule of ${state.name}${cause ? `. ${cause}` : ""}.`;
    pack.zones.push({
      i: pack.zones.length,
      name,
      note,
      type: "Rebels",
      cells: cellsArray,
      color: "url(#hatch3)"
    });
  }

  private addProselytism(usedCells: Uint8Array) {
    const { cells, religions } = pack;

    const organizedReligions = religions.filter(r => r.i && !r.removed && r.type === "Organized");
    const religion = ra(organizedReligions);
    if (!religion) return;

    const targetBorderCells = cells.i.filter(
      i =>
        cells.h[i] >= 20 &&
        cells.pop[i] &&
        cells.religion[i] !== religion.i &&
        cells.c[i].some(c => cells.religion[c] === religion.i)
    );
    const startCell = ra(targetBorderCells);
    if (!startCell) return;

    const targetReligionId = cells.religion[startCell];
    const proselytismCells: number[] = [];
    const queue = [startCell];
    const maxCells = rand(10, 30);

    while (queue.length) {
      const cellId = queue.shift()!;
      proselytismCells.push(cellId);
      if (proselytismCells.length >= maxCells) break;

      cells.c[cellId].forEach(neibCellId => {
        if (usedCells[neibCellId]) return;
        if (cells.religion[neibCellId] !== targetReligionId) return;
        if (cells.h[neibCellId] < 20 || !cells.pop[neibCellId]) return;
        usedCells[neibCellId] = 1;
        queue.push(neibCellId);
      });
    }

    const name = `${getAdjective(religion.name.split(" ")[0])} Proselytism`;
    const note = `Missionaries of ${religion.name} preach among the followers of ${religions[targetReligionId]?.name || "other faiths"} here, winning converts village by village.`;
    pack.zones.push({
      i: pack.zones.length,
      name,
      note,
      type: "Proselytism",
      cells: proselytismCells,
      color: "url(#hatch6)"
    });
  }

  private addCrusade(usedCells: Uint8Array) {
    const { cells, religions } = pack;

    const heresies = religions.filter(r => !r.removed && r.type === "Heresy");
    if (!heresies.length) return;

    const heresy = ra(heresies);
    const crusadeCells = cells.i.filter(i => !usedCells[i] && cells.religion[i] === heresy.i);
    if (!crusadeCells.length) return;
    for (const i of crusadeCells) {
      usedCells[i] = 1;
    }

    const name = `${getAdjective(heresy.name.split(" ")[0])} Crusade`;
    const note = `${heresy.name} is condemned as heresy. Crusaders march against its followers wherever they live, burning their shrines.`;
    pack.zones.push({
      i: pack.zones.length,
      name,
      note,
      type: "Crusade",
      cells: Array.from(crusadeCells),
      color: "url(#hatch6)"
    });
  }

  private addDisease(usedCells: Uint8Array) {
    const { cells, burgs } = pack;

    // disease breaks out in the busiest markets and ports
    const candidates = burgs.filter(b => !usedCells[b.cell] && b.i && !b.removed);
    const burg = pickWeighted(
      candidates,
      this.getBurgTrade(candidates).map((trade, k) => Math.sqrt(trade) * (candidates[k].port ? 2 : 1))
    );
    if (!burg) return;

    const cellsArray: number[] = [];
    const cost: number[] = [];
    const maxCells = rand(20, 40);

    const queue = new FlatQueue<{ e: number; p: number }>();
    queue.push({ e: burg.cell, p: 0 }, 0);

    while (queue.length) {
      const next = queue.pop();
      if (cells.burg[next.e] || cells.pop[next.e]) cellsArray.push(next.e);
      usedCells[next.e] = 1;

      cells.c[next.e].forEach(nextCellId => {
        const c = Routes.getRoute(next.e, nextCellId) ? 5 : 100;
        const p = next.p + c;
        if (p > maxCells) return;

        if (!cost[nextCellId] || p < cost[nextCellId]) {
          cost[nextCellId] = p;
          queue.push({ e: nextCellId, p }, p);
        }
      });
    }

    const colorName = this.getDiseaseName("color");
    const animalName = this.getDiseaseName("animal");
    const adjectiveName = this.getDiseaseName("adjective");

    const model = rw({ color: 2, animal: 1, adjective: 1 });
    const prefix = model === "color" ? colorName : model === "animal" ? animalName : adjectiveName;

    const disease = rw({
      Fever: 5,
      Plague: 3,
      Cough: 3,
      Flu: 2,
      Pox: 2,
      Cholera: 2,
      Typhoid: 2,
      Leprosy: 1,
      Smallpox: 1,
      Pestilence: 1,
      Malaria: 1,
      Dropsy: 1
    });
    const name = `${prefix} ${disease}`;
    const origin = burg.port ? `the port of ${burg.name}, brought by ships` : `the market of ${burg.name}`;
    const note = `An outbreak of ${name.toLowerCase()} that began in ${origin}. Merchants and travelers carry it along the roads.`;

    pack.zones.push({
      i: pack.zones.length,
      name,
      note,
      type: "Disease",
      cells: cellsArray,
      color: "url(#hatch12)"
    });
  }

  /** What weakens a land most, as a sentence; none when nothing takes much */
  private getUnrestCause(parts: Record<StabilityPart, number>): string | undefined {
    const UNREST_CAUSE = 0.05; // stability a part takes from a land for the note to name it
    const causes: Partial<Record<StabilityPart, string>> = {
      remoteness: "The capital is far away, and its rule is weak here",
      diversity: "Its people are strangers to the ruling culture",
      corruption: "Corrupt officials have turned the people against their rulers",
      army: "The army goes unpaid and does not keep order"
    };
    const [part, value] = Object.entries(parts)
      .filter(([part]) => part in causes)
      .reduce((worst, entry) => (entry[1] < worst[1] ? entry : worst), ["", 0]);
    return value <= -UNREST_CAUSE ? causes[part as StabilityPart] : undefined;
  }

  /** Each burg's trade value in the last economy run */
  private getBurgTrade(burgs: { i: number }[]): number[] {
    const trade: number[] = [];
    for (const [burgId, , , kind, units, price] of pack.deals)
      if (kind !== DEAL_KINDS.kept) trade[burgId] = (trade[burgId] || 0) + units * price;
    return burgs.map(burg => trade[burg.i] || 0);
  }

  /** A famine breaks out in the poorest countryside and spreads through the poor land around */
  private addFamine(usedCells: Uint8Array) {
    const { cells, states } = pack;
    if (!cells.prosperity) return; // a map from before the economy
    const isPoor = (cellId: number, top: number) =>
      !usedCells[cellId] && cells.pop[cellId] > 0 && cells.prosperity[cellId] > 0 && cells.prosperity[cellId] <= top;
    const FAMINE_START = 20; // rural prosperity %, at most, where a famine breaks out
    const FAMINE_SPREAD = 30; // and that it spreads through
    const poorest = cells.i.filter(cellId => isPoor(cellId, FAMINE_START));
    const start = pickWeighted(
      poorest,
      poorest.map(cellId => (FAMINE_START + 1 - cells.prosperity[cellId]) ** 2)
    );
    if (start === undefined) return;

    const famineCells: number[] = [];
    const queue = [start];
    usedCells[start] = 1;
    const maxCells = rand(10, 40);
    while (queue.length && famineCells.length < maxCells) {
      const cellId = queue.shift()!;
      famineCells.push(cellId);
      for (const neibCellId of cells.c[cellId]) {
        if (!isPoor(neibCellId, FAMINE_SPREAD)) continue;
        usedCells[neibCellId] = 1;
        queue.push(neibCellId);
      }
    }
    if (famineCells.length < 3) return;

    const state = states[cells.state[start]];
    const place = state?.i ? state.name : Names.getCulture(cells.culture[start]);
    const famine = rw({ Famine: 5, Hunger: 2, Dearth: 1, Starvation: 1 });
    pack.zones.push({
      i: pack.zones.length,
      name: `${getAdjective(place)} ${famine}`,
      note: `The poorest countryside of ${place}. The harvest has failed, and its people have no money to buy grain from the markets, so they go hungry.`,
      type: "Famine",
      cells: famineCells,
      color: "url(#hatch10)"
    });
  }

  private getDiseaseName(model: "color" | "animal" | "adjective"): string {
    if (model === "color")
      return ra([
        "Amber",
        "Azure",
        "Black",
        "Blue",
        "Brown",
        "Crimson",
        "Emerald",
        "Golden",
        "Green",
        "Grey",
        "Orange",
        "Pink",
        "Purple",
        "Red",
        "Ruby",
        "Scarlet",
        "Silver",
        "Violet",
        "White",
        "Yellow"
      ]);
    if (model === "animal")
      return ra([
        "Ape",
        "Bear",
        "Bird",
        "Boar",
        "Cat",
        "Cow",
        "Deer",
        "Dog",
        "Fox",
        "Goat",
        "Horse",
        "Lion",
        "Pig",
        "Rat",
        "Raven",
        "Sheep",
        "Spider",
        "Tiger",
        "Viper",
        "Wolf",
        "Worm",
        "Wyrm"
      ]);
    return ra([
      "Blind",
      "Bloody",
      "Brutal",
      "Burning",
      "Deadly",
      "Fatal",
      "Furious",
      "Great",
      "Grim",
      "Horrible",
      "Invisible",
      "Lethal",
      "Loud",
      "Mortal",
      "Savage",
      "Severe",
      "Silent",
      "Unknown",
      "Venomous",
      "Vicious"
    ]);
  }

  private addDisaster(usedCells: Uint8Array) {
    const { cells, burgs } = pack;

    const burg = ra(burgs.filter(b => !usedCells[b.cell] && b.i && !b.removed));
    if (!burg) return;
    usedCells[burg.cell] = 1;

    const cellsArray: number[] = [];
    const cost: number[] = [];
    const maxCells = rand(5, 25);

    const queue = new FlatQueue<{ e: number; p: number }>();
    queue.push({ e: burg.cell, p: 0 }, 0);

    while (queue.length) {
      const next = queue.pop();
      if (cells.burg[next.e] || cells.pop[next.e]) cellsArray.push(next.e);
      usedCells[next.e] = 1;

      cells.c[next.e].forEach(e => {
        const c = rand(1, 10);
        const p = next.p + c;
        if (p > maxCells) return;

        if (!cost[e] || p < cost[e]) {
          cost[e] = p;
          queue.push({ e, p }, p);
        }
      });
    }

    const type = rw({
      Drought: 3,
      Earthquake: 3,
      Tornadoes: 1,
      Wildfires: 1,
      Storms: 1,
      Blight: 1
    });
    const name = `${getAdjective(burg.name!)} ${type}`;
    const note = {
      Drought: `No rain has fallen around ${burg.name} for months. Wells run dry and the crops wither in the fields.`,
      Earthquake: `An earthquake has struck ${burg.name} and the land around, toppling houses and blocking roads.`,
      Tornadoes: `Tornadoes have torn through the land around ${burg.name}, leaving a trail of wrecked farms.`,
      Wildfires: `Wildfires burn around ${burg.name}, and smoke hangs over the burnt fields and woods.`,
      Storms: `Storms batter ${burg.name} and the land around, flattening crops and tearing off roofs.`,
      Blight: `A blight rots the crops around ${burg.name}, and the harvest is lost.`
    }[type];
    pack.zones.push({
      i: pack.zones.length,
      name,
      note,
      type: "Disaster",
      cells: cellsArray,
      color: "url(#hatch5)"
    });
  }

  private addEruption(usedCells: Uint8Array) {
    const { cells, markers } = pack;

    const volcanoe = markers.find(m => m.type === "volcanoes" && !usedCells[m.cell]);
    if (!volcanoe) return;
    usedCells[volcanoe.cell] = 1;

    if (volcanoe.note) volcanoe.note = volcanoe.note.replace("Active volcano", "Erupting volcano");
    const name = volcanoe.name ? `${volcanoe.name.replace(" Volcano", "")} Eruption` : "Volcano Eruption";

    const cellsArray: number[] = [];
    const queue = [volcanoe.cell];
    const maxCells = rand(10, 30);

    while (queue.length) {
      const cellId = P(0.5) ? queue.shift()! : queue.pop()!;
      cellsArray.push(cellId);
      if (cellsArray.length >= maxCells) break;

      cells.c[cellId].forEach(neibCellId => {
        if (usedCells[neibCellId] || cells.h[neibCellId] < 20) return;
        usedCells[neibCellId] = 1;
        queue.push(neibCellId);
      });
    }

    pack.zones.push({
      i: pack.zones.length,
      name,
      note: `${volcanoe.name || "The volcano"} is erupting. Ash and lava cover the land around it, and people flee its slopes.`,
      type: "Eruption",
      cells: cellsArray,
      color: "url(#hatch7)"
    });
  }

  private addAvalanche(usedCells: Uint8Array) {
    const { cells } = pack;

    const routeCells = cells.i.filter(i => !usedCells[i] && Routes.isConnected(i) && cells.h[i] >= 70);
    if (!routeCells.length) return;

    const startCell = ra(routeCells);
    usedCells[startCell] = 1;

    const cellsArray: number[] = [];
    const queue = [startCell];
    const maxCells = rand(3, 15);

    while (queue.length) {
      const cellId = P(0.3) ? queue.shift()! : queue.pop()!;
      cellsArray.push(cellId);
      if (cellsArray.length >= maxCells) break;

      cells.c[cellId].forEach(neibCellId => {
        if (usedCells[neibCellId] || cells.h[neibCellId] < 65) return;
        usedCells[neibCellId] = 1;
        queue.push(neibCellId);
      });
    }

    const name = `${getAdjective(Names.getCultureShort(cells.culture[startCell]))} Avalanche`;
    pack.zones.push({
      i: pack.zones.length,
      name,
      note: "Avalanches have buried the mountain road here. The pass is closed until the snow is cleared.",
      type: "Avalanche",
      cells: cellsArray,
      color: "url(#hatch5)"
    });
  }

  private addFault(usedCells: Uint8Array) {
    const cells = pack.cells;

    const elevatedCells = cells.i.filter(i => !usedCells[i] && cells.h[i] > 50 && cells.h[i] < 70);
    if (!elevatedCells.length) return;

    const startCell = ra(elevatedCells);
    usedCells[startCell] = 1;

    const cellsArray: number[] = [];
    const queue = [startCell];
    const maxCells = rand(3, 15);

    while (queue.length) {
      const cellId = queue.pop()!;
      if (cells.h[cellId] >= 20) cellsArray.push(cellId);
      if (cellsArray.length >= maxCells) break;

      cells.c[cellId].forEach(neibCellId => {
        if (usedCells[neibCellId] || cells.r[neibCellId]) return;
        usedCells[neibCellId] = 1;
        queue.push(neibCellId);
      });
    }

    const name = `${getAdjective(Names.getCultureShort(cells.culture[startCell]))} Fault`;
    pack.zones.push({
      i: pack.zones.length,
      name,
      note: "A fault line where the ground cracks and shakes with frequent tremors. Few dare to build here.",
      type: "Fault",
      cells: cellsArray,
      color: "url(#hatch2)"
    });
  }

  private addFlood(usedCells: Uint8Array) {
    const cells = pack.cells;
    const FLOOD_BANK = 3; // height over the river a bank may stand and still flood

    const meanFlux = mean(cells.fl.filter(Boolean)) ?? 0;
    const isBigRiver = (cellId: number) => cells.r[cellId] && cells.fl[cellId] >= meanFlux;

    // a lowland burg on a bigger river than most, the bigger the likelier
    const riverBurgCells = cells.i.filter(i => !usedCells[i] && cells.h[i] < 50 && cells.burg[i] && isBigRiver(i));
    const startCell = pickWeighted(
      riverBurgCells,
      riverBurgCells.map(i => cells.fl[i])
    );
    if (startCell === undefined) return;
    usedCells[startCell] = 1;

    // the water spreads up and down the river and over its low banks
    const riverId = cells.r[startCell];
    const cellsArray: number[] = [];
    const queue = [startCell];
    const maxCells = rand(5, 30);

    while (queue.length && cellsArray.length < maxCells) {
      const cellId = queue.shift()!;
      cellsArray.push(cellId);
      if (!isBigRiver(cellId)) continue; // a flooded bank spreads no further

      for (const neibCellId of cells.c[cellId]) {
        if (usedCells[neibCellId] || cells.h[neibCellId] < 20 || cells.h[neibCellId] >= 50) continue;
        if (!isBigRiver(neibCellId) && cells.h[neibCellId] > cells.h[cellId] + FLOOD_BANK) continue;
        usedCells[neibCellId] = 1;
        queue.push(neibCellId);
      }
    }

    const burgName = pack.burgs[cells.burg[startCell]].name!;
    const name = `${getAdjective(burgName)} Flood`;
    const river = pack.rivers.find(river => river.i === riverId);
    pack.zones.push({
      i: pack.zones.length,
      name,
      note: `The ${river ? `${river.name} ${river.type.toLowerCase()}` : "river"} has burst its banks at ${burgName}, flooding the streets and the fields along it.`,
      type: "Flood",
      cells: cellsArray,
      color: "url(#hatch13)"
    });
  }

  private addTsunami(usedCells: Uint8Array) {
    const { cells, features } = pack;

    const coastalCells = cells.i.filter(
      i => !usedCells[i] && cells.t[i] === -1 && features[cells.f[i]].type !== "lake"
    );
    if (!coastalCells.length) return;

    const startCell = ra(coastalCells);
    usedCells[startCell] = 1;

    const cellsArray: number[] = [];
    const queue = [startCell];
    const maxCells = rand(10, 30);

    while (queue.length) {
      const cellId = queue.shift()!;
      if (cells.t[cellId] === 1) cellsArray.push(cellId);
      if (cellsArray.length >= maxCells) break;

      cells.c[cellId].forEach(neibCellId => {
        if (usedCells[neibCellId]) return;
        if (cells.t[neibCellId] > 2) return;
        if (pack.features[cells.f[neibCellId]].type === "lake") return;
        usedCells[neibCellId] = 1;
        queue.push(neibCellId);
      });
    }

    const name = `${getAdjective(Names.getCultureShort(cells.culture[startCell]))} Tsunami`;
    pack.zones.push({
      i: pack.zones.length,
      name,
      note: "A great wave from the sea has struck this coast, wrecking harbors and drowning the villages along the shore.",
      type: "Tsunami",
      cells: cellsArray,
      color: "url(#hatch13)"
    });
  }
}

export const Zones = new ZonesModule();
