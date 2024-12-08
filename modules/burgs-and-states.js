"use strict";

window.BurgsAndStates = (() => {
  const generate = () => {
    const {cells, cultures} = pack;
    const n = cells.i.length;

    cells.burg = new Uint16Array(n); // cell burg

    const burgs = (pack.burgs = placeCapitals());
    pack.states = createStates();

    placeTowns();
    expandStates();
    normalizeStates();
    getPoles();

    specifyBurgs();

    collectStatistics();
    assignColors();

    generateCampaigns();
    generateDiplomacy();

    function placeCapitals() {
      TIME && console.time("placeCapitals");
      let count = +byId("statesNumber").value;
      let burgs = [0];

      const rand = () => 0.5 + Math.random() * 0.5;
      const score = new Int16Array(cells.s.map(s => s * rand())); // cell score for capitals placement
      const sorted = cells.i.filter(i => score[i] > 0 && cells.culture[i]).sort((a, b) => score[b] - score[a]); // filtered and sorted array of indexes

      if (sorted.length < count * 10) {
        count = Math.floor(sorted.length / 10);
        if (!count) {
          WARN && console.warn("There is no populated cells. Cannot generate states");
          return burgs;
        } else {
          WARN && console.warn(`Not enough populated cells (${sorted.length}). Will generate only ${count} states`);
        }
      }

      let burgsTree = d3.quadtree();
      let spacing = (graphWidth + graphHeight) / 2 / count; // min distance between capitals

      for (let i = 0; burgs.length <= count; i++) {
        const cell = sorted[i];
        const [x, y] = cells.p[cell];

        if (burgsTree.find(x, y, spacing) === undefined) {
          burgs.push({cell, x, y});
          burgsTree.add([x, y]);
        }

        if (i === sorted.length - 1) {
          WARN && console.warn("Cannot place capitals with current spacing. Trying again with reduced spacing");
          burgsTree = d3.quadtree();
          i = -1;
          burgs = [0];
          spacing /= 1.2;
        }
      }

      burgs[0] = burgsTree;
      TIME && console.timeEnd("placeCapitals");
      return burgs;
    }

    // For each capital create a state
    function createStates() {
      TIME && console.time("createStates");
      const states = [{i: 0, name: "Neutrals"}];
      const colors = getColors(burgs.length - 1);
      const each5th = each(5);

      burgs.forEach((b, i) => {
        if (!i) return; // skip first element

        // burgs data
        b.i = b.state = i;
        b.culture = cells.culture[b.cell];
        b.name = Names.getCultureShort(b.culture);
        b.feature = cells.f[b.cell];
        b.capital = 1;

        // states data
        const expansionism = rn(Math.random() * byId("sizeVariety").value + 1, 1);
        const basename = b.name.length < 9 && each5th(b.cell) ? b.name : Names.getCultureShort(b.culture);
        const name = Names.getState(basename, b.culture);
        const type = cultures[b.culture].type;

        const coa = COA.generate(null, null, null, type);
        coa.shield = COA.getShield(b.culture, null);
        states.push({
          i,
          color: colors[i - 1],
          name,
          expansionism,
          capital: i,
          type,
          center: b.cell,
          culture: b.culture,
          coa
        });
        cells.burg[b.cell] = i;
      });

      TIME && console.timeEnd("createStates");
      return states;
    }

    // place secondary settlements based on geo and economical evaluation
    function placeTowns() {
      TIME && console.time("placeTowns");
      const score = new Int16Array(cells.s.map(s => s * gauss(1, 3, 0, 20, 3))); // a bit randomized cell score for towns placement
      const sorted = cells.i
        .filter(i => !cells.burg[i] && score[i] > 0 && cells.culture[i])
        .sort((a, b) => score[b] - score[a]); // filtered and sorted array of indexes

      const desiredNumber =
        manorsInput.value == 1000
          ? rn(sorted.length / 5 / (grid.points.length / 10000) ** 0.8)
          : manorsInput.valueAsNumber;
      const burgsNumber = Math.min(desiredNumber, sorted.length); // towns to generate
      let burgsAdded = 0;

      const burgsTree = burgs[0];
      let spacing = (graphWidth + graphHeight) / 150 / (burgsNumber ** 0.7 / 66); // min distance between towns

      while (burgsAdded < burgsNumber && spacing > 1) {
        for (let i = 0; burgsAdded < burgsNumber && i < sorted.length; i++) {
          if (cells.burg[sorted[i]]) continue;
          const cell = sorted[i];
          const [x, y] = cells.p[cell];
          const s = spacing * gauss(1, 0.3, 0.2, 2, 2); // randomize to make placement not uniform
          if (burgsTree.find(x, y, s) !== undefined) continue; // to close to existing burg
          const burg = burgs.length;
          const culture = cells.culture[cell];
          const name = Names.getCulture(culture);
          burgs.push({cell, x, y, state: 0, i: burg, culture, name, capital: 0, feature: cells.f[cell]});
          burgsTree.add([x, y]);
          cells.burg[cell] = burg;
          burgsAdded++;
        }
        spacing *= 0.5;
      }

      if (manorsInput.value != 1000 && burgsAdded < desiredNumber) {
        ERROR && console.error(`Cannot place all burgs. Requested ${desiredNumber}, placed ${burgsAdded}`);
      }

      burgs[0] = {name: undefined}; // do not store burgsTree anymore
      TIME && console.timeEnd("placeTowns");
    }
  };

  // define burg coordinates, coa, port status and define details
  const specifyBurgs = () => {
    TIME && console.time("specifyBurgs");
    const {cells, features} = pack;
    const temp = grid.cells.temp;

    for (const b of pack.burgs) {
      if (!b.i || b.lock) continue;
      const i = b.cell;

      // asign port status to some coastline burgs with temp > 0 °C
      const haven = cells.haven[i];
      if (haven && temp[cells.g[i]] > 0) {
        const f = cells.f[haven]; // water body id
        // port is a capital with any harbor OR town with good harbor
        const port = features[f].cells > 1 && ((b.capital && cells.harbor[i]) || cells.harbor[i] === 1);
        b.port = port ? f : 0; // port is defined by water body id it lays on
      } else b.port = 0;

      // define burg population (keep urbanization at about 10% rate)
      b.population = rn(Math.max(cells.s[i] / 8 + b.i / 1000 + (i % 100) / 1000, 0.1), 3);
      if (b.capital) b.population = rn(b.population * 1.3, 3); // increase capital population

      if (b.port) {
        b.population = b.population * 1.3; // increase port population
        const [x, y] = getCloseToEdgePoint(i, haven);
        b.x = x;
        b.y = y;
      }

      // add random factor
      b.population = rn(b.population * gauss(2, 3, 0.6, 20, 3), 3);

      // shift burgs on rivers semi-randomly and just a bit
      if (!b.port && cells.r[i]) {
        const shift = Math.min(cells.fl[i] / 150, 1);
        if (i % 2) b.x = rn(b.x + shift, 2);
        else b.x = rn(b.x - shift, 2);
        if (cells.r[i] % 2) b.y = rn(b.y + shift, 2);
        else b.y = rn(b.y - shift, 2);
      }

      // define emblem
      const state = pack.states[b.state];
      const stateCOA = state.coa;
      let kinship = 0.25;
      if (b.capital) kinship += 0.1;
      else if (b.port) kinship -= 0.1;
      if (b.culture !== state.culture) kinship -= 0.25;
      b.type = getType(i, b.port);
      const type = b.capital && P(0.2) ? "Capital" : b.type === "Generic" ? "City" : b.type;
      b.coa = COA.generate(stateCOA, kinship, null, type);
      b.coa.shield = COA.getShield(b.culture, b.state);
    }

    // de-assign port status if it's the only one on feature
    const ports = pack.burgs.filter(b => !b.removed && b.port > 0);
    for (const f of features) {
      if (!f.i || f.land || f.border) continue;
      const featurePorts = ports.filter(b => b.port === f.i);
      if (featurePorts.length === 1) featurePorts[0].port = 0;
    }

    TIME && console.timeEnd("specifyBurgs");
  };

  function getCloseToEdgePoint(cell1, cell2) {
    const {cells, vertices} = pack;

    const [x0, y0] = cells.p[cell1];

    const commonVertices = cells.v[cell1].filter(vertex => vertices.c[vertex].some(cell => cell === cell2));
    const [x1, y1] = vertices.p[commonVertices[0]];
    const [x2, y2] = vertices.p[commonVertices[1]];
    const xEdge = (x1 + x2) / 2;
    const yEdge = (y1 + y2) / 2;

    const x = rn(x0 + 0.95 * (xEdge - x0), 2);
    const y = rn(y0 + 0.95 * (yEdge - y0), 2);

    return [x, y];
  }

  const getType = (cellId, port) => {
    const {cells, features, burgs} = pack;

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

    return "Generic";
  };

  const defineBurgFeatures = burg => {
    const {cells} = pack;

    pack.burgs
      .filter(b => (burg ? b.i == burg.i : b.i && !b.removed && !b.lock))
      .forEach(b => {
        const pop = b.population;
        b.citadel = Number(b.capital || (pop > 50 && P(0.75)) || (pop > 15 && P(0.5)) || P(0.1));
        b.plaza = Number(pop > 20 || (pop > 10 && P(0.8)) || (pop > 4 && P(0.7)) || P(0.6));
        b.walls = Number(b.capital || pop > 30 || (pop > 20 && P(0.75)) || (pop > 10 && P(0.5)) || P(0.1));
        b.shanty = Number(pop > 60 || (pop > 40 && P(0.75)) || (pop > 20 && b.walls && P(0.4)));
        const religion = cells.religion[b.cell];
        const theocracy = pack.states[b.state].form === "Theocracy";
        b.temple = Number(
          (religion && theocracy && P(0.5)) || pop > 50 || (pop > 35 && P(0.75)) || (pop > 20 && P(0.5))
        );
      });
  };

  // expand cultures across the map (Dijkstra-like algorithm)
  const expandStates = () => {
    TIME && console.time("expandStates");
    const {cells, states, cultures, burgs} = pack;

    cells.state = cells.state || new Uint16Array(cells.i.length);

    const queue = new FlatQueue();
    const cost = [];

    const globalGrowthRate = byId("growthRate").valueAsNumber || 1;
    const statesGrowthRate = byId("statesGrowthRate")?.valueAsNumber || 1;
    const growthRate = (cells.i.length / 2) * globalGrowthRate * statesGrowthRate; // limit cost for state growth

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
      const cultureCenter = cultures[state.culture].center;
      const b = cells.biome[cultureCenter]; // state native biome
      queue.push({e: state.center, p: 0, s: state.i, b}, 0);
      cost[state.center] = 1;
    }

    while (queue.length) {
      const next = queue.pop();

      const {e, p, s, b} = next;
      const {type, culture} = states[s];

      cells.c[e].forEach(e => {
        const state = states[cells.state[e]];
        if (state.lock) return; // do not overwrite cell of locked states
        if (cells.state[e] && e === state.center) return; // do not overwrite capital cells

        const cultureCost = culture === cells.culture[e] ? -9 : 100;
        const populationCost = cells.h[e] < 20 ? 0 : cells.s[e] ? Math.max(20 - cells.s[e], 0) : 5000;
        const biomeCost = getBiomeCost(b, cells.biome[e], type);
        const heightCost = getHeightCost(pack.features[cells.f[e]], cells.h[e], type);
        const riverCost = getRiverCost(cells.r[e], e, type);
        const typeCost = getTypeCost(cells.t[e], type);
        const cellCost = Math.max(cultureCost + populationCost + biomeCost + heightCost + riverCost + typeCost, 0);
        const totalCost = p + 10 + cellCost / states[s].expansionism;

        if (totalCost > growthRate) return;

        if (!cost[e] || totalCost < cost[e]) {
          if (cells.h[e] >= 20) cells.state[e] = s; // assign state to cell
          cost[e] = totalCost;
          queue.push({e, p: totalCost, s, b}, totalCost);
        }
      });
    }

    burgs.filter(b => b.i && !b.removed).forEach(b => (b.state = cells.state[b.cell])); // assign state to burgs

    function getBiomeCost(b, biome, type) {
      if (b === biome) return 10; // tiny penalty for native biome
      if (type === "Hunting") return biomesData.cost[biome] * 2; // non-native biome penalty for hunters
      if (type === "Nomadic" && biome > 4 && biome < 10) return biomesData.cost[biome] * 3; // forest biome penalty for nomads
      return biomesData.cost[biome]; // general non-native biome penalty
    }

    function getHeightCost(f, h, type) {
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

    function getRiverCost(r, i, type) {
      if (type === "River") return r ? 0 : 100; // penalty for river cultures
      if (!r) return 0; // no penalty for others if there is no river
      return minmax(cells.fl[i] / 10, 20, 100); // river penalty from 20 to 100 based on flux
    }

    function getTypeCost(t, type) {
      if (t === 1) return type === "Naval" || type === "Lake" ? 0 : type === "Nomadic" ? 60 : 20; // penalty for coastline
      if (t === 2) return type === "Naval" || type === "Nomadic" ? 30 : 0; // low penalty for land level 2 for Navals and nomads
      if (t !== -1) return type === "Naval" || type === "Lake" ? 100 : 0; // penalty for mainland for navals
      return 0;
    }

    TIME && console.timeEnd("expandStates");
  };

  const normalizeStates = () => {
    TIME && console.time("normalizeStates");
    const {cells, burgs} = pack;

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
  };

  // calculate pole of inaccessibility for each state
  const getPoles = () => {
    const getType = cellId => pack.cells.state[cellId];
    const poles = getPolesOfInaccessibility(pack, getType);

    pack.states.forEach(s => {
      if (!s.i || s.removed) return;
      s.pole = poles[s.i] || [0, 0];
    });
  };

  // Resets the cultures of all burgs and states to their cell or center cell's (respectively) culture
  const updateCultures = () => {
    TIME && console.time("updateCulturesForBurgsAndStates");

    // Assign the culture associated with the burgs cell
    pack.burgs = pack.burgs.map((burg, index) => {
      if (index === 0) return burg;
      return {...burg, culture: pack.cells.culture[burg.cell]};
    });

    // Assign the culture associated with the states' center cell
    pack.states = pack.states.map((state, index) => {
      if (index === 0) return state;
      return {...state, culture: pack.cells.culture[state.center]};
    });

    TIME && console.timeEnd("updateCulturesForBurgsAndStates");
  };

  // calculate states data like area, population etc.
  const collectStatistics = () => {
    TIME && console.time("collectStatistics");
    const {cells, states} = pack;

    states.forEach(s => {
      if (s.removed) return;
      s.cells = s.area = s.burgs = s.rural = s.urban = 0;
      s.neighbors = new Set();
    });

    for (const i of cells.i) {
      if (cells.h[i] < 20) continue;
      const s = cells.state[i];

      // check for neighboring states
      cells.c[i]
        .filter(c => cells.h[c] >= 20 && cells.state[c] !== s)
        .forEach(c => states[s].neighbors.add(cells.state[c]));

      // collect stats
      states[s].cells += 1;
      states[s].area += cells.area[i];
      states[s].rural += cells.pop[i];
      if (cells.burg[i]) {
        states[s].urban += pack.burgs[cells.burg[i]].population;
        states[s].burgs++;
      }
    }

    // convert neighbors Set object into array
    states.forEach(s => {
      if (!s.neighbors) return;
      s.neighbors = Array.from(s.neighbors);
    });

    TIME && console.timeEnd("collectStatistics");
  };

  const assignColors = () => {
    TIME && console.time("assignColors");
    const colors = ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f"]; // d3.schemeSet2;

    // assign basic color using greedy coloring algorithm
    pack.states.forEach(s => {
      if (!s.i || s.removed || s.lock) return;
      const neibs = s.neighbors;
      s.color = colors.find(c => neibs.every(n => pack.states[n].color !== c));
      if (!s.color) s.color = getRandomColor();
      colors.push(colors.shift());
    });

    // randomize each already used color a bit
    colors.forEach(c => {
      const sameColored = pack.states.filter(s => s.color === c && !s.lock);
      sameColored.forEach((s, d) => {
        if (!d) return;
        s.color = getMixedColor(s.color);
      });
    });

    TIME && console.timeEnd("assignColors");
  };

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

  const generateCampaign = state => {
    const neighbors = state.neighbors.length ? state.neighbors : [0];
    return neighbors
      .map(i => {
        const name = i && P(0.8) ? pack.states[i].name : Names.getCultureShort(state.culture);
        const start = gauss(options.year - 100, 150, 1, options.year - 6);
        const end = start + gauss(4, 5, 1, options.year - start - 1);
        return {name: getAdjective(name) + " " + rw(wars), start, end};
      })
      .sort((a, b) => a.start - b.start);
  };

  // generate historical conflicts of each state
  const generateCampaigns = () => {
    pack.states.forEach(s => {
      if (!s.i || s.removed) return;
      s.campaigns = generateCampaign(s);
    });
  };

  // generate Diplomatic Relationships
  const generateDiplomacy = () => {
    TIME && console.time("generateDiplomacy");
    const {cells, states} = pack;
    const chronicle = (states[0].diplomacy = []);
    const valid = states.filter(s => s.i && !states.removed);

    const neibs = {Ally: 1, Friendly: 2, Neutral: 1, Suspicion: 10, Rival: 9}; // relations to neighbors
    const neibsOfNeibs = {Ally: 10, Friendly: 8, Neutral: 5, Suspicion: 1}; // relations to neighbors of neighbors
    const far = {Friendly: 1, Neutral: 12, Suspicion: 2, Unknown: 6}; // relations to other
    const navals = {Neutral: 1, Suspicion: 2, Rival: 1, Unknown: 1}; // relations of naval powers

    valid.forEach(s => (s.diplomacy = new Array(states.length).fill("x"))); // clear all relationships
    if (valid.length < 2) return; // no states to renerate relations with
    const areaMean = d3.mean(valid.map(s => s.area)); // average state area

    // generic relations
    for (let f = 1; f < states.length; f++) {
      if (states[f].removed) continue;

      if (states[f].diplomacy.includes("Vassal")) {
        // Vassals copy relations from their Suzerains
        const suzerain = states[f].diplomacy.indexOf("Vassal");

        for (let i = 1; i < states.length; i++) {
          if (i === f || i === suzerain) continue;
          states[f].diplomacy[i] = states[suzerain].diplomacy[i];
          if (states[suzerain].diplomacy[i] === "Suzerain") states[f].diplomacy[i] = "Ally";
          for (let e = 1; e < states.length; e++) {
            if (e === f || e === suzerain) continue;
            if (states[e].diplomacy[suzerain] === "Suzerain" || states[e].diplomacy[suzerain] === "Vassal") continue;
            states[e].diplomacy[f] = states[e].diplomacy[suzerain];
          }
        }
        continue;
      }

      for (let t = f + 1; t < states.length; t++) {
        if (states[t].removed) continue;

        if (states[t].diplomacy.includes("Vassal")) {
          const suzerain = states[t].diplomacy.indexOf("Vassal");
          states[f].diplomacy[t] = states[f].diplomacy[suzerain];
          continue;
        }

        const naval =
          states[f].type === "Naval" &&
          states[t].type === "Naval" &&
          cells.f[states[f].center] !== cells.f[states[t].center];
        const neib = naval ? false : states[f].neighbors.includes(t);
        const neibOfNeib =
          naval || neib
            ? false
            : states[f].neighbors
                .map(n => states[n].neighbors)
                .join("")
                .includes(t);

        let status = naval ? rw(navals) : neib ? rw(neibs) : neibOfNeib ? rw(neibsOfNeibs) : rw(far);

        // add Vassal
        if (
          neib &&
          P(0.8) &&
          states[f].area > areaMean &&
          states[t].area < areaMean &&
          states[f].area / states[t].area > 2
        )
          status = "Vassal";
        states[f].diplomacy[t] = status === "Vassal" ? "Suzerain" : status;
        states[t].diplomacy[f] = status;
      }
    }

    // declare wars
    for (let attacker = 1; attacker < states.length; attacker++) {
      const ad = states[attacker].diplomacy; // attacker relations;
      if (states[attacker].removed) continue;
      if (!ad.includes("Rival")) continue; // no rivals to attack
      if (ad.includes("Vassal")) continue; // not independent
      if (ad.includes("Enemy")) continue; // already at war

      // random independent rival
      const defender = ra(
        ad.map((r, d) => (r === "Rival" && !states[d].diplomacy.includes("Vassal") ? d : 0)).filter(d => d)
      );
      let ap = states[attacker].area * states[attacker].expansionism;
      let dp = states[defender].area * states[defender].expansionism;
      if (ap < dp * gauss(1.6, 0.8, 0, 10, 2)) continue; // defender is too strong

      const an = states[attacker].name;
      const dn = states[defender].name; // names
      const attackers = [attacker];
      const defenders = [defender]; // attackers and defenders array
      const dd = states[defender].diplomacy; // defender relations;

      // start an ongoing war
      const name = `${an}-${trimVowels(dn)}ian War`;
      const start = options.year - gauss(2, 3, 0, 10);
      const war = [name, `${an} declared a war on its rival ${dn}`];
      const campaign = {name, start, attacker, defender};
      states[attacker].campaigns.push(campaign);
      states[defender].campaigns.push(campaign);

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

      ap = d3.sum(attackers.map(a => states[a].area * states[a].expansionism)); // attackers joined power
      dp = d3.sum(defenders.map(d => states[d].area * states[d].expansionism)); // defender joined power

      // defender allies join
      dd.forEach((r, d) => {
        if (r !== "Ally" || states[d].diplomacy.includes("Vassal")) return;
        if (states[d].diplomacy[attacker] !== "Rival" && ap / dp > 2 * gauss(1.6, 0.8, 0, 10, 2)) {
          const reason = states[d].diplomacy.includes("Enemy") ? "Being already at war," : `Frightened by ${an},`;
          war.push(`${reason} ${states[d].name} severed the defense pact with ${dn}`);
          dd[d] = states[d].diplomacy[defender] = "Suspicion";
          return;
        }
        defenders.push(d);
        dp += states[d].area * states[d].expansionism;
        war.push(`${dn}'s ally ${states[d].name} joined the war on defenders side`);

        // ally vassals join
        states[d].diplomacy
          .map((r, d) => (r === "Suzerain" ? d : 0))
          .filter(d => d)
          .forEach(v => {
            defenders.push(v);
            dp += states[v].area * states[v].expansionism;
            war.push(`${states[d].name}'s vassal ${states[v].name} joined the war on defenders side`);
          });
      });

      // attacker allies join if the defender is their rival or joined power > defenders power and defender is not an ally
      ad.forEach((r, d) => {
        if (r !== "Ally" || states[d].diplomacy.includes("Vassal") || defenders.includes(d)) return;
        const name = states[d].name;
        if (states[d].diplomacy[defender] !== "Rival" && (P(0.2) || ap <= dp * 1.2)) {
          war.push(`${an}'s ally ${name} avoided entering the war`);
          return;
        }
        const allies = states[d].diplomacy.map((r, d) => (r === "Ally" ? d : 0)).filter(d => d);
        if (allies.some(ally => defenders.includes(ally))) {
          war.push(`${an}'s ally ${name} did not join the war as its allies are in war on both sides`);
          return;
        }

        attackers.push(d);
        ap += states[d].area * states[d].expansionism;
        war.push(`${an}'s ally ${name} joined the war on attackers side`);

        // ally vassals join
        states[d].diplomacy
          .map((r, d) => (r === "Suzerain" ? d : 0))
          .filter(d => d)
          .forEach(v => {
            attackers.push(v);
            dp += states[v].area * states[v].expansionism;
            war.push(`${states[d].name}'s vassal ${states[v].name} joined the war on attackers side`);
          });
      });

      // change relations to Enemy for all participants
      attackers.forEach(a => defenders.forEach(d => (states[a].diplomacy[d] = states[d].diplomacy[a] = "Enemy")));
      chronicle.push(war); // add a record to diplomatical history
    }

    TIME && console.timeEnd("generateDiplomacy");
  };

  // select a forms for listed or all valid states
  const defineStateForms = list => {
    TIME && console.time("defineStateForms");
    const states = pack.states.filter(s => s.i && !s.removed && !s.lock);
    if (states.length < 1) return;

    const generic = {Monarchy: 25, Republic: 2, Union: 1};
    const naval = {Monarchy: 25, Republic: 8, Union: 3};

    const median = d3.median(pack.states.map(s => s.area));
    const empireMin = states.map(s => s.area).sort((a, b) => b - a)[Math.max(Math.ceil(states.length ** 0.4) - 2, 0)];
    const expTiers = pack.states.map(s => {
      let tier = Math.min(Math.floor((s.area / median) * 2.6), 4);
      if (tier === 4 && s.area < empireMin) tier = 3;
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
    const theocracy = {Theocracy: 20, Brotherhood: 1, Thearchy: 2, See: 1, "Holy State": 1};
    const anarchy = {"Free Territory": 2, Council: 3, Commune: 1, Community: 1};

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
      s.formName = selectForm(s, tier);
      s.fullName = getFullName(s);
    }

    function selectForm(s, tier) {
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
          if (trimVowels(s.name) === trimVowels(pack.burgs[s.capital].name)) {
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
          if (P(0.1)) return "Divine " + monarchy[tier];
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
    }

    TIME && console.timeEnd("defineStateForms");
  };

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

  const getFullName = state => {
    if (!state.formName) return state.name;
    if (!state.name && state.formName) return "The " + state.formName;
    const adjName = adjForms.includes(state.formName) && !/-| /.test(state.name);
    return adjName ? `${getAdjective(state.name)} ${state.formName}` : `${state.formName} of ${state.name}`;
  };

  return {
    generate,
    expandStates,
    normalizeStates,
    getPoles,
    assignColors,
    specifyBurgs,
    defineBurgFeatures,
    getType,
    collectStatistics,
    generateCampaign,
    generateCampaigns,
    generateDiplomacy,
    defineStateForms,
    getFullName,
    updateCultures,
    getCloseToEdgePoint
  };
})();
