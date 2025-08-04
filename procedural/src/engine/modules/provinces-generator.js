"use strict";

const forms = {
  Monarchy: {County: 22, Earldom: 6, Shire: 2, Landgrave: 2, Margrave: 2, Barony: 2, Captaincy: 1, Seneschalty: 1},
  Republic: {Province: 6, Department: 2, Governorate: 2, District: 1, Canton: 1, Prefecture: 1},
  Theocracy: {Parish: 3, Deanery: 1},
  Union: {Province: 1, State: 1, Canton: 1, Republic: 1, County: 1, Council: 1},
  Anarchy: {Council: 1, Commune: 1, Community: 1, Tribe: 1},
  Wild: {Territory: 10, Land: 5, Region: 2, Tribe: 1, Clan: 1, Dependency: 1, Area: 1}
};

export const generate = (pack, config, utils, regenerate = false, regenerateLockedStates = false) => {
  const {
    generateSeed,
    aleaPRNG,
    gauss,
    P,
    Names,
    rw,
    getMixedColor,
    BurgsAndStates,
    COA,
    FlatQueue,
    d3,
    rand
  } = utils;
  const { TIME } = config.debug;

  TIME && console.time("generateProvinces");
  const localSeed = regenerate ? generateSeed() : config.seed;
  Math.random = aleaPRNG(localSeed);

  const {cells, states, burgs} = pack;
  const provinces = [0]; // 0 index is reserved for "no province"
  const provinceIds = new Uint16Array(cells.i.length);

  const isProvinceLocked = province => province.lock || (!regenerateLockedStates && states[province.state]?.lock);
  const isProvinceCellLocked = cell => provinceIds[cell] && isProvinceLocked(provinces[provinceIds[cell]]);

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

  const provincesRatio = config.provincesRatio;
  const max = provincesRatio == 100 ? 1000 : gauss(20, 5, 5, 100) * provincesRatio ** 0.5; // max growth

  // generate provinces for selected burgs
  states.forEach(s => {
    s.provinces = [];
    if (!s.i || s.removed) return;
    if (provinces.length) s.provinces = provinces.filter(p => p.state === s.i).map(p => p.i); // locked provinces ids
    if (s.lock && !regenerateLockedStates) return; // don't regenerate provinces of a locked state

    const stateBurgs = burgs
      .filter(b => b.state === s.i && !b.removed && !provinceIds[b.cell])
      .sort((a, b) => b.population * gauss(1, 0.2, 0.5, 1.5, 3) - a.population)
      .sort((a, b) => b.capital - a.capital);
    if (stateBurgs.length < 2) return; // at least 2 provinces are required
    const provincesNumber = Math.max(Math.ceil((stateBurgs.length * provincesRatio) / 100), 2);

    const form = Object.assign({}, forms[s.form]);

    for (let i = 0; i < provincesNumber; i++) {
      const provinceId = provinces.length;
      const center = stateBurgs[i].cell;
      const burg = stateBurgs[i].i;
      const c = stateBurgs[i].culture;
      const nameByBurg = P(0.5);
      const name = nameByBurg ? stateBurgs[i].name : Names.getState(Names.getCultureShort(c), c);
      const formName = rw(form);
      form[formName] += 10;
      const fullName = name + " " + formName;
      const color = getMixedColor(s.color);
      const kinship = nameByBurg ? 0.8 : 0.4;
      const type = BurgsAndStates.getType(center, burg.port);
      const coa = COA.generate(stateBurgs[i].coa, kinship, null, type);
      coa.shield = COA.getShield(c, s.i);

      s.provinces.push(provinceId);
      provinces.push({i: provinceId, state: s.i, center, burg, name, formName, fullName, color, coa});
    }
  });

  // expand generated provinces
  const queue = new FlatQueue();
  const cost = [];

  provinces.forEach(p => {
    if (!p.i || p.removed || isProvinceLocked(p)) return;
    provinceIds[p.center] = p.i;
    queue.push({e: p.center, province: p.i, state: p.state, p: 0}, 0);
    cost[p.center] = 1;
  });

  while (queue.length) {
    const {e, p, province, state} = queue.pop();

    cells.c[e].forEach(e => {
      if (isProvinceCellLocked(e)) return; // do not overwrite cell of locked provinces

      const land = cells.h[e] >= 20;
      if (!land && !cells.t[e]) return; // cannot pass deep ocean
      if (land && cells.state[e] !== state) return;
      const evevation = cells.h[e] >= 70 ? 100 : cells.h[e] >= 50 ? 30 : cells.h[e] >= 20 ? 10 : 100;
      const totalCost = p + evevation;

      if (totalCost > max) return;
      if (!cost[e] || totalCost < cost[e]) {
        if (land) provinceIds[e] = province; // assign province to a cell
        cost[e] = totalCost;
        queue.push({e, province, state, p: totalCost}, totalCost);
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
    if (buddies.length > 2) continue;

    const competitors = adversaries.map(p => adversaries.reduce((s, v) => (v === p ? s + 1 : s), 0));
    const max = d3.max(competitors);
    if (buddies >= max) continue;

    provinceIds[i] = adversaries[competitors.indexOf(max)];
  }

  // add "wild" provinces if some cells don't have a province assigned
  const noProvince = Array.from(cells.i).filter(i => cells.state[i] && !provinceIds[i]); // cells without province assigned
  states.forEach(s => {
    if (!s.i || s.removed) return;
    if (s.lock && !regenerateLockedStates) return;
    if (!s.provinces.length) return;

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
      const cost = [];
      cost[center] = 1;
      queue.push({e: center, p: 0}, 0);
      while (queue.length) {
        const {e, p} = queue.pop();

        cells.c[e].forEach(nextCellId => {
          if (provinceIds[nextCellId]) return;
          const land = cells.h[nextCellId] >= 20;
          if (cells.state[nextCellId] && cells.state[nextCellId] !== s.i) return;
          const ter = land ? (cells.state[nextCellId] === s.i ? 3 : 20) : cells.t[nextCellId] ? 10 : 30;
          const totalCost = p + ter;

          if (totalCost > max) return;
          if (!cost[nextCellId] || totalCost < cost[nextCellId]) {
            if (land && cells.state[nextCellId] === s.i) provinceIds[nextCellId] = provinceId; // assign province to a cell
            cost[nextCellId] = totalCost;
            queue.push({e: nextCellId, p: totalCost}, totalCost);
          }
        });
      }

      // generate "wild" province name
      const c = cells.culture[center];
      const f = pack.features[cells.f[center]];
      const color = getMixedColor(s.color);

      const provCells = stateNoProvince.filter(i => provinceIds[i] === provinceId);
      const singleIsle = provCells.length === f.cells && !provCells.find(i => cells.f[i] !== f.i);
      const isleGroup = !singleIsle && !provCells.find(i => pack.features[cells.f[i]].group !== "isle");
      const colony = !singleIsle && !isleGroup && P(0.5) && !isPassable(s.center, center);

      const name = (() => {
        const colonyName = colony && P(0.8) && getColonyName();
        if (colonyName) return colonyName;
        if (burgCell && P(0.5)) return burgs[burg].name;
        return Names.getState(Names.getCultureShort(c), c);
      })();

      const formName = (() => {
        if (singleIsle) return "Island";
        if (isleGroup) return "Islands";
        if (colony) return "Colony";
        return rw(forms["Wild"]);
      })();

      const fullName = name + " " + formName;

      const dominion = colony ? P(0.95) : singleIsle || isleGroup ? P(0.7) : P(0.3);
      const kinship = dominion ? 0 : 0.4;
      const type = BurgsAndStates.getType(center, burgs[burg]?.port);
      const coa = COA.generate(s.coa, kinship, dominion, type);
      coa.shield = COA.getShield(c, s.i);

      provinces.push({i: provinceId, state: s.i, center, burg, name, formName, fullName, color, coa});
      s.provinces.push(provinceId);

      // check if there is a land way within the same state between two cells
      function isPassable(from, to) {
        if (cells.f[from] !== cells.f[to]) return false; // on different islands
        const passableQueue = [from],
          used = new Uint8Array(cells.i.length),
          state = cells.state[from];
        while (passableQueue.length) {
          const current = passableQueue.pop();
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

  TIME && console.timeEnd("generateProvinces");

  return {
    provinces,
    provinceIds
  };
};

// calculate pole of inaccessibility for each province
export const getPoles = (pack, utils) => {
  const { getPolesOfInaccessibility } = utils;

  const getType = cellId => pack.cells.province[cellId];
  const poles = getPolesOfInaccessibility(pack, getType);

  const updatedProvinces = pack.provinces.map(province => {
    if (!province.i || province.removed) return province;
    return {
      ...province,
      pole: poles[province.i] || [0, 0]
    };
  });

  return updatedProvinces;
};
