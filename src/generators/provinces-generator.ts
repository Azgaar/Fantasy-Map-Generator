import Alea from "alea";
import { max } from "d3";
import { Emblems } from "@/generators/emblems-generator";
import type { Emblem } from "@/types/emblems";
import { requireColor } from "@/utils/colorUtils";
import { replaceWholeWord } from "@/utils/languageUtils";
import { requireName } from "@/utils/validationUtils";
import { gauss, generateSeed, getMixedColor, getPolesOfInaccessibility, P, rand, rw } from "../utils";
import type { Label } from "./labels-generator";
import { Population } from "./population-generator";

declare global {
  var Provinces: ProvinceModule;
}

export interface Province {
  i: number;
  removed?: boolean;
  state: number;
  lock?: boolean;
  center: number;
  burg: number;
  name: string;
  formName: string;
  fullName: string;
  color: string;
  coa: Emblem;
  pole?: [number, number];
  label?: Label;
  // statistics computed by the provinces editor
  area?: number;
  rural?: number;
  urban?: number;
  burgs?: number[];
  note?: string;
}

class ProvinceModule {
  forms: Record<string, Record<string, number>> = {
    Monarchy: {
      County: 22,
      Earldom: 6,
      Shire: 2,
      Landgrave: 2,
      Margrave: 2,
      Barony: 2,
      Captaincy: 1,
      Seneschalty: 1
    },
    Republic: {
      Province: 6,
      Department: 2,
      Governorate: 2,
      District: 1,
      Canton: 1,
      Prefecture: 1
    },
    Theocracy: { Parish: 3, Deanery: 1 },
    Union: {
      Province: 1,
      State: 1,
      Canton: 1,
      Republic: 1,
      County: 1,
      Council: 1
    },
    Anarchy: { Council: 1, Commune: 1, Community: 1, Tribe: 1 },
    Wild: {
      Territory: 10,
      Land: 5,
      Region: 2,
      Tribe: 1,
      Clan: 1,
      Dependency: 1,
      Area: 1
    }
  };

  regenerate(regenerateNames = true): void {
    this.generate(true, regenerateNames);
    this.getPoles();
  }

  generate(regenerate = false, regenerateLockedStates = false) {
    const localSeed = regenerate ? generateSeed() : options.map.seed;
    Math.random = Alea(localSeed);

    const { cells, states, burgs } = pack;
    const provinces: Province[] = [0 as unknown as Province]; // 0 index is reserved for "no province"
    const provinceIds = new Uint16Array(cells.i.length);

    const isProvinceLocked = (province: Province) =>
      province.lock || (!regenerateLockedStates && states[province.state]?.lock);
    const isProvinceCellLocked = (cell: number) => provinceIds[cell] && isProvinceLocked(provinces[provinceIds[cell]]);

    if (regenerate) {
      pack.provinces.forEach(province => {
        if (!province.i || province.removed || !isProvinceLocked(province)) return;

        const newId = provinces.length;
        for (const i of cells.i) {
          if (cells.province[i] === province.i) provinceIds[i] = newId;
        }

        province.i = newId;
        provinces.push(province);
      });
    }

    const provincesRatio = options.generation.provinces.ratio;
    const maxGrowth = provincesRatio === 100 ? 1000 : gauss(20, 5, 5, 100) * provincesRatio ** 0.5; // max growth

    // generate provinces for selected burgs
    states.forEach(s => {
      s.provinces = [];
      if (!s.i || s.removed) return;
      if (provinces.length) s.provinces = provinces.filter(p => p.state === s.i).map(p => p.i); // locked provinces ids
      if (s.lock && !regenerateLockedStates) return; // don't regenerate provinces of a locked state

      const stateBurgs = burgs
        .filter(b => b.state === s.i && !b.removed && !provinceIds[b.cell]) // burgs in this state without province assigned
        .map(burg => ({ burg: burg, score: burg.population! * gauss(1, 0.2, 0.5, 1.5, 3) }))
        .sort((a, b) => b.burg.capital! - a.burg.capital! || b.score - a.score) // capitals first, biggest population next
        .map(b => b.burg);
      if (stateBurgs.length < 2) return; // at least 2 provinces are required

      const provincesNumber = Math.max(Math.ceil((stateBurgs.length * provincesRatio) / 100), 2);
      const form = Object.assign({}, this.forms[s.form!]);

      for (let i = 0; i < provincesNumber; i++) {
        const provinceId = provinces.length;
        const center = stateBurgs[i].cell;
        const burg = stateBurgs[i];
        const c = stateBurgs[i].culture!;
        const nameByBurg = P(0.5);
        const name = nameByBurg ? stateBurgs[i].name! : Names.getState(Names.getCultureShort(c), c);
        const formName = rw(form);
        form[formName] += 10;
        const fullName = `${name} ${formName}`;
        const color = getMixedColor(s.color!);
        const kinship = nameByBurg ? 0.8 : 0.4;
        const type = Burgs.getType(center, burg.port);
        const coa = Emblems.generate(stateBurgs[i].coa, kinship, null, type);
        coa.shield = Emblems.getShield(c, s.i);

        s.provinces.push(provinceId);
        provinces.push({
          i: provinceId,
          state: s.i,
          center,
          burg: burg.i!,
          name,
          formName,
          fullName,
          color,
          coa
        });
      }
    });

    // expand generated provinces
    const queue = new FlatQueue();
    const cost: number[] = [];

    provinces.forEach(p => {
      if (!p.i || p.removed || isProvinceLocked(p)) return;
      provinceIds[p.center] = p.i;
      queue.push({ e: p.center, province: p.i, state: p.state, p: 0 }, 0);
      cost[p.center] = 1;
    });

    while (queue.length) {
      const { e, p, province, state } = queue.pop();

      cells.c[e].forEach(e => {
        if (isProvinceCellLocked(e)) return; // do not overwrite cell of locked provinces

        const land = cells.h[e] >= 20;
        if (!land && !cells.t[e]) return; // cannot pass deep ocean
        if (land && cells.state[e] !== state) return;
        const evevation = cells.h[e] >= 70 ? 100 : cells.h[e] >= 50 ? 30 : cells.h[e] >= 20 ? 10 : 100;
        const totalCost = p + evevation;

        if (totalCost > maxGrowth) return;
        if (!cost[e] || totalCost < cost[e]) {
          if (land) provinceIds[e] = province; // assign province to a cell
          cost[e] = totalCost;
          queue.push({ e, province, state, p: totalCost }, totalCost);
        }
      });
    }

    // justify provinces shapes a bit
    for (const i of cells.i) {
      if (cells.burg[i]) continue; // do not overwrite burgs
      if (isProvinceCellLocked(i)) continue; // do not overwrite cell of locked provinces

      const neibs = cells.c[i]
        .filter(c => cells.state[c] === cells.state[i] && !isProvinceCellLocked(c))
        .map(c => provinceIds[c]);
      const adversaries = neibs.filter(c => c !== provinceIds[i]);
      if (adversaries.length < 2) continue;

      const buddies = neibs.filter(c => c === provinceIds[i]).length;
      if (buddies > 2) continue;

      const competitors = adversaries.map(p => adversaries.reduce((s, v) => (v === p ? s + 1 : s), 0));
      const maxBuddies = max(competitors) as number;
      if (buddies >= maxBuddies) continue;

      provinceIds[i] = adversaries[competitors.indexOf(maxBuddies)];
    }

    // add "wild" provinces if some cells don't have a province assigned
    const noProvince = Array.from(cells.i).filter(i => cells.state[i] && !provinceIds[i]); // cells without province assigned
    states.forEach(s => {
      if (!s.i || s.removed) return;
      if (s.lock && !regenerateLockedStates) return;
      if (!s.provinces?.length) return;

      const coreProvinceNames = s.provinces.map(p => provinces[p]?.name);
      const colonyNamePool = [s.name, ...coreProvinceNames].filter(name => name && !/new/i.test(name));
      const getColonyName = () => {
        if (colonyNamePool.length < 1) return null;

        const index = rand(colonyNamePool.length - 1);
        const spliced = colonyNamePool.splice(index, 1);
        return spliced[0] ? `New ${spliced[0]}` : null;
      };

      let stateNoProvince = noProvince.filter(i => cells.state[i] === s.i && !provinceIds[i]);
      while (stateNoProvince.length) {
        // add new province
        const provinceId = provinces.length;
        const burgCell = stateNoProvince.find(i => cells.burg[i]);
        const center = burgCell ? burgCell : stateNoProvince[0];
        const burg = burgCell ? cells.burg[burgCell] : 0;
        provinceIds[center] = provinceId;

        // expand province
        const cost: number[] = [];
        cost[center] = 1;
        queue.push({ e: center, p: 0 }, 0);
        while (queue.length) {
          const { e, p } = queue.pop();

          cells.c[e].forEach(nextCellId => {
            if (provinceIds[nextCellId]) return;
            const land = cells.h[nextCellId] >= 20;
            if (cells.state[nextCellId] && cells.state[nextCellId] !== s.i) return;
            const ter = land ? (cells.state[nextCellId] === s.i ? 3 : 20) : cells.t[nextCellId] ? 10 : 30;
            const totalCost = p + ter;

            if (totalCost > maxGrowth) return;
            if (!cost[nextCellId] || totalCost < cost[nextCellId]) {
              if (land && cells.state[nextCellId] === s.i) provinceIds[nextCellId] = provinceId; // assign province to a cell
              cost[nextCellId] = totalCost;
              queue.push({ e: nextCellId, p: totalCost }, totalCost);
            }
          });
        }

        // generate "wild" province name
        const c = cells.culture[center];
        const f = pack.features[cells.f[center]];
        const color = getMixedColor(s.color!);

        const provCells = stateNoProvince.filter(i => provinceIds[i] === provinceId);
        const singleIsle = provCells.length === f.cells && !provCells.find(i => cells.f[i] !== f.i);
        const isleSubtype = !singleIsle && !provCells.find(i => pack.features[cells.f[i]].subtype !== "isle");
        const colony = !singleIsle && !isleSubtype && P(0.5) && !isPassable(s.center, center);

        const name = (() => {
          const colonyName = colony && P(0.8) && getColonyName();
          if (colonyName) return colonyName;
          if (burgCell && P(0.5)) return burgs[burg].name;
          return Names.getState(Names.getCultureShort(c), c);
        })();

        const formName = (() => {
          if (singleIsle) return "Island";
          if (isleSubtype) return "Islands";
          if (colony) return "Colony";
          return rw(this.forms.Wild);
        })();

        const fullName = `${name} ${formName}`;

        const dominion = colony ? P(0.95) : singleIsle || isleSubtype ? P(0.7) : P(0.3);
        const kinship = dominion ? 0 : 0.4;
        const type = Burgs.getType(center, burgs[burg]?.port);
        const coa = Emblems.generate(s.coa, kinship, dominion ? 1 : 0, type);
        coa.shield = Emblems.getShield(c, s.i);

        provinces.push({
          i: provinceId,
          state: s.i,
          center,
          burg,
          name: name!,
          formName,
          fullName,
          color,
          coa
        });
        s.provinces.push(provinceId);

        // check if there is a land way within the same state between two cells
        function isPassable(from: number, to: number) {
          if (cells.f[from] !== cells.f[to]) return false; // on different islands
          const passableQueue = [from],
            used = new Uint8Array(cells.i.length),
            state = cells.state[from];
          while (passableQueue.length) {
            const current = passableQueue.pop() as number;
            if (current === to) return true; // way is found
            cells.c[current].forEach(c => {
              if (used[c] || cells.h[c] < 20 || cells.state[c] !== state) return;
              passableQueue.push(c);
              used[c] = 1;
            });
          }
          return false; // way is not found
        }

        // re-check
        stateNoProvince = noProvince.filter(i => cells.state[i] === s.i && !provinceIds[i]);
      }
    });

    cells.province = provinceIds;
    pack.provinces = provinces;
  }

  /** Rename a province; a custom full name or label keeps its pattern when the old name stands in it as a whole word */
  rename(provinceId: number, name: string): void {
    const province = pack.provinces[provinceId];
    if (!province || province.removed) throw new Error(`Province ${provinceId} does not exist`);
    const old = province.name;
    province.name = requireName(name);
    province.fullName =
      replaceWholeWord(province.fullName, old, province.name) ??
      (province.formName ? `${province.name} ${province.formName}` : province.name);
    if (province.label?.text)
      province.label.text = replaceWholeWord(province.label.text, old, province.name) ?? province.label.text;
  }

  /** Set a province's color */
  recolor(provinceId: number, color: string): void {
    this.living(provinceId).color = requireColor(color);
  }

  /** Set a province's full name, such as "County of Vel" */
  setFullName(provinceId: number, fullName: string): void {
    this.living(provinceId).fullName = requireName(fullName);
  }

  /** Set a province's form, such as County or Duchy; empty clears it. The full name is rebuilt from it */
  setForm(provinceId: number, formName: string): void {
    const province = this.living(provinceId);
    if (typeof formName !== "string") throw new Error("The form name must be text");
    province.formName = formName.trim();
    province.fullName = province.formName ? `${province.name} ${province.formName}` : province.name;
  }

  /** Make a burg inside a province its capital */
  setCapital(provinceId: number, burgId: number): void {
    const province = this.living(provinceId);
    const burg = pack.burgs[burgId];
    if (!burg || burg.removed || !burgId) throw new Error(`Burg ${burgId} does not exist`);
    if (pack.cells.province[burg.cell] !== provinceId)
      throw new Error(`Burg ${burgId} is not in province ${provinceId}`);
    province.burg = burgId;
    province.center = burg.cell;
  }

  /** Give a province, with its lands and burgs, to another state */
  setState(provinceId: number, stateId: number): void {
    const province = this.living(provinceId);
    const { cells, states, burgs } = pack;
    const [from, to] = [states[province.state], states[stateId]];
    if (!stateId || !to || to.removed) throw new Error(`State ${stateId} does not exist`);
    if (from === to) return;
    if (from?.capital && cells.province[burgs[from.capital]?.cell] === provinceId)
      throw new Error(`Province ${provinceId} holds the capital of state ${province.state}; move the capital first`);

    cells.province.forEach((owner, cell) => {
      if (owner !== provinceId) return;
      cells.state[cell] = stateId;
      if (cells.burg[cell]) burgs[cells.burg[cell]].state = stateId;
    });
    if (from?.provinces) from.provinces = from.provinces.filter(id => id !== provinceId);
    to.provinces = [...(to.provinces ?? []), provinceId];
    province.state = stateId;
    States.findNeighbors();
    States.collectStatistics();
    States.getPoles();
  }

  /** Found a province at a map point inside a state, with the cell and its neighbors in that state. Returns its id */
  add(x: number, y: number): number {
    const { cells, provinces, states, burgs } = pack;
    const center = Pack.requireCell(x, y);
    if (cells.h[center] < 20) throw new Error("A province cannot be placed in the water");
    const state = cells.state[center];
    if (!state) throw new Error("A province cannot be placed in neutral lands; give them to a state first");
    const isCenter = (cell: number) => provinces.some(p => p.i && !p.removed && p.center === cell);
    if (isCenter(center)) throw new Error(`Cell ${center} is already a province center`);

    const i = provinces.length;
    const old = provinces[cells.province[center]];
    const burg = cells.burg[center];
    const culture = cells.culture[center];
    const name = burg ? burgs[burg].name! : Names.getState(Names.getCultureShort(culture), culture);
    const formName = old?.formName || "Province";
    const coa = Emblems.generate(
      burg ? burgs[burg].coa : states[state].coa,
      burg ? 0.8 : 0.4,
      +P(0.1),
      Burgs.getType(center, burg ? burgs[burg].port : undefined)
    );
    coa.shield = Emblems.getShield(culture, state);
    const color = getMixedColor(states[state].color!, 0.2, 0);
    provinces.push({ i, state, center, burg, name, formName, fullName: `${name} ${formName}`, color, coa });
    states[state].provinces = [...(states[state].provinces ?? []), i];

    cells.province[center] = i;
    for (const cell of cells.c[center])
      if (cells.h[cell] >= 20 && cells.state[cell] === state && !isCenter(cell)) cells.province[cell] = i;
    this.getPoles();
    return i;
  }

  /** Turn a province with a burg into a new state that takes its lands and burgs. Returns the state id */
  declareIndependence(provinceId: number): number {
    const province = this.living(provinceId);
    const { cells, burgs, states } = pack;
    const provinceCells = cells.i.filter(cell => cells.province[cell] === provinceId);
    if (provinceCells.some(cell => burgs[cells.burg[cell]]?.capital))
      throw new Error(`Province ${provinceId} holds its state's capital; move the capital first`);
    const capital = burgs[province.burg];
    if (!province.burg || !capital || capital.removed)
      throw new Error(`Province ${provinceId} has no capital burg to become a state capital`);

    const owner = states[province.state];
    if (owner?.provinces) owner.provinces = owner.provinces.filter(id => id !== provinceId);
    pack.provinces[provinceId] = { i: provinceId, removed: true } as Province;
    return States.found(province.name, province.burg, province.coa, provinceCells);
  }

  /** Remove a province; its lands stay with the state */
  remove(provinceId: number): void {
    const province = this.living(provinceId);
    pack.cells.province.forEach((owner, cell) => {
      if (owner === provinceId) pack.cells.province[cell] = 0;
    });
    const state = pack.states[province.state];
    if (state?.provinces) state.provinces = state.provinces.filter(id => id !== provinceId);
    pack.provinces[provinceId] = { i: provinceId, removed: true } as Province;
  }

  /** Merge provinces of one state into a primary one, which takes their lands and burgs */
  merge(primaryId: number, provinceIds: number[]): void {
    const primary = this.living(primaryId);
    if (!Array.isArray(provinceIds) || !provinceIds.length) throw new Error("Name at least one province to merge");
    const merged = provinceIds.filter(id => id !== primaryId).map(id => this.living(id));
    const foreign = merged.find(province => province.state !== primary.state);
    if (foreign) throw new Error(`Province ${foreign.i} belongs to another state; merge provinces within one state`);
    const ids = new Set(merged.map(province => province.i));

    for (const province of merged) {
      if (!primary.burg && province.burg) primary.burg = province.burg;
      pack.provinces[province.i] = { i: province.i, removed: true } as Province;
    }
    pack.cells.province.forEach((owner, cell) => {
      if (ids.has(owner)) pack.cells.province[cell] = primaryId;
    });
    const state = pack.states[primary.state];
    if (state?.provinces) state.provinces = state.provinces.filter(id => !ids.has(id));
    this.getPoles();
  }

  /** Set a province's rural and urban population, in people: its cells and burgs scale to the totals */
  setPopulation(provinceId: number, rural: number, urban: number): void {
    this.living(provinceId);
    const { cells } = pack;
    Population.setArea(
      Population.landCells(cell => cells.province[cell] === provinceId),
      Population.burgIds(burg => cells.province[burg.cell] === provinceId),
      rural,
      urban
    );
    States.collectStatistics();
  }

  /** Lock a province so regeneration keeps it, or unlock it */
  setLocked(provinceId: number, locked: boolean): void {
    const province = this.living(provinceId);
    if (locked) province.lock = true;
    else delete province.lock;
  }

  /** Give land cells of the province's state to a province; another province's center cannot move */
  setCells(provinceId: number, cellIds: number[]): void {
    const province = this.living(provinceId);
    const { cells, provinces } = pack;
    if (!Array.isArray(cellIds) || !cellIds.length) throw new Error("Name at least one cell");
    for (const cell of cellIds) {
      if (!Number.isInteger(cell) || cell < 0 || cell >= cells.i.length) throw new Error(`Cell ${cell} does not exist`);
      if (cells.h[cell] < 20) throw new Error(`Cell ${cell} is water; provinces hold land only`);
      if (cells.state[cell] !== province.state)
        throw new Error(`Cell ${cell} is not in state ${province.state}; give it to the state first`);
      const owner = cells.province[cell];
      if (owner && owner !== provinceId && provinces[owner]?.center === cell)
        throw new Error(`Cell ${cell} is the center of province ${owner}; remove that province first`);
    }
    for (const cell of cellIds) cells.province[cell] = provinceId;
    this.getPoles();
  }

  private living(provinceId: number): Province {
    const province = pack.provinces[provinceId];
    if (!provinceId || !province || province.removed) throw new Error(`Province ${provinceId} does not exist`);
    return province;
  }

  // calculate pole of inaccessibility for each province
  getPoles() {
    const getType = (cellId: number) => pack.cells.province[cellId];
    const poles = getPolesOfInaccessibility(pack, getType);

    pack.provinces.forEach(province => {
      if (!province.i || province.removed) return;
      province.pole = poles[province.i] || [0, 0];
    });
  }
}

window.Provinces = new ProvinceModule();
