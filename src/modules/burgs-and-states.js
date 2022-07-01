import FlatQueue from "flatqueue";

import {TIME} from "config/logging";
import {layerIsOn} from "layers";
import {Voronoi} from "/src/modules/voronoi";
import {getColors, getMixedColor, getRandomColor} from "utils/colorUtils";
import {findCell} from "utils/graphUtils";
import {getAdjective, trimVowels} from "utils/languageUtils";
import {getMiddlePoint} from "utils/lineUtils";
import {minmax, rn} from "utils/numberUtils";
import {each, gauss, generateSeed, P, ra, rand, rw} from "utils/probabilityUtils";
import {round, splitInTwo} from "utils/stringUtils";
import {aleaPRNG} from "scripts/aleaPRNG";

window.BurgsAndStates = (function () {
  const generate = function () {
    const {cells, cultures} = pack;
    const n = cells.i.length;

    cells.burg = new Uint16Array(n); // cell burg
    cells.road = new Uint16Array(n); // cell road power
    cells.crossroad = new Uint16Array(n); // cell crossroad power

    const burgs = (pack.burgs = placeCapitals());
    pack.states = createStates();
    const capitalRoutes = Routes.getRoads();

    placeTowns();
    expandStates();
    normalizeStates();
    const townRoutes = Routes.getTrails();
    specifyBurgs();

    const oceanRoutes = Routes.getSearoutes();

    collectStatistics();
    assignColors();

    generateCampaigns();
    generateDiplomacy();
    Routes.draw(capitalRoutes, townRoutes, oceanRoutes);
    drawBurgs();

    function placeCapitals() {
      TIME && console.time("placeCapitals");
      let count = +regionsOutput.value;
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

      burgs.forEach(function (b, i) {
        if (!i) return; // skip first element

        // burgs data
        b.i = b.state = i;
        b.culture = cells.culture[b.cell];
        b.name = Names.getCultureShort(b.culture);
        b.feature = cells.f[b.cell];
        b.capital = 1;

        // states data
        const expansionism = rn(Math.random() * powerInput.value + 1, 1);
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
          const cell = sorted[i],
            x = cells.p[cell][0],
            y = cells.p[cell][1];
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
  const specifyBurgs = function () {
    TIME && console.time("specifyBurgs");
    const cells = pack.cells,
      vertices = pack.vertices,
      features = pack.features,
      temp = grid.cells.temp;

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
      b.population = rn(Math.max((cells.s[i] + cells.road[i] / 2) / 8 + b.i / 1000 + (i % 100) / 1000, 0.1), 3);
      if (b.capital) b.population = rn(b.population * 1.3, 3); // increase capital population

      if (b.port) {
        b.population = b.population * 1.3; // increase port population
        const [x, y] = getMiddlePoint(i, haven);
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

  const getType = function (i, port) {
    const cells = pack.cells;
    if (port) return "Naval";
    if (cells.haven[i] && pack.features[cells.f[cells.haven[i]]].type === "lake") return "Lake";
    if (cells.h[i] > 60) return "Highland";
    if (cells.r[i] && cells.r[i].length > 100 && cells.r[i].length >= pack.rivers[0].length) return "River";

    if (!cells.burg[i] || pack.burgs[cells.burg[i]].population < 6) {
      if (population < 5 && [1, 2, 3, 4].includes(cells.biome[i])) return "Nomadic";
      if (cells.biome[i] > 4 && cells.biome[i] < 10) return "Hunting";
    }

    return "Generic";
  };

  const defineBurgFeatures = function (newburg) {
    const cells = pack.cells;
    pack.burgs
      .filter(b => (newburg ? b.i == newburg.i : b.i && !b.removed))
      .forEach(b => {
        const pop = b.population;
        b.citadel = b.capital || (pop > 50 && P(0.75)) || P(0.5) ? 1 : 0;
        b.plaza = pop > 50 || (pop > 30 && P(0.75)) || (pop > 10 && P(0.5)) || P(0.25) ? 1 : 0;
        b.walls = b.capital || pop > 30 || (pop > 20 && P(0.75)) || (pop > 10 && P(0.5)) || P(0.2) ? 1 : 0;
        b.shanty = pop > 60 || (pop > 40 && P(0.75)) || (pop > 20 && b.walls && P(0.4)) ? 1 : 0;
        const religion = cells.religion[b.cell];
        const theocracy = pack.states[b.state].form === "Theocracy";
        b.temple = (religion && theocracy) || pop > 50 || (pop > 35 && P(0.75)) || (pop > 20 && P(0.5)) ? 1 : 0;
      });
  };

  const drawBurgs = function () {
    TIME && console.time("drawBurgs");

    // remove old data
    burgIcons.selectAll("circle").remove();
    burgLabels.selectAll("text").remove();
    icons.selectAll("use").remove();

    // capitals
    const capitals = pack.burgs.filter(b => b.capital && !b.removed);
    const capitalIcons = burgIcons.select("#cities");
    const capitalLabels = burgLabels.select("#cities");
    const capitalSize = capitalIcons.attr("size") || 1;
    const capitalAnchors = anchors.selectAll("#cities");
    const caSize = capitalAnchors.attr("size") || 2;

    capitalIcons
      .selectAll("circle")
      .data(capitals)
      .enter()
      .append("circle")
      .attr("id", d => "burg" + d.i)
      .attr("data-id", d => d.i)
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", capitalSize);

    capitalLabels
      .selectAll("text")
      .data(capitals)
      .enter()
      .append("text")
      .attr("id", d => "burgLabel" + d.i)
      .attr("data-id", d => d.i)
      .attr("x", d => d.x)
      .attr("y", d => d.y)
      .attr("dy", `${capitalSize * -1.5}px`)
      .text(d => d.name);

    capitalAnchors
      .selectAll("use")
      .data(capitals.filter(c => c.port))
      .enter()
      .append("use")
      .attr("xlink:href", "#icon-anchor")
      .attr("data-id", d => d.i)
      .attr("x", d => rn(d.x - caSize * 0.47, 2))
      .attr("y", d => rn(d.y - caSize * 0.47, 2))
      .attr("width", caSize)
      .attr("height", caSize);

    // towns
    const towns = pack.burgs.filter(b => b.i && !b.capital && !b.removed);
    const townIcons = burgIcons.select("#towns");
    const townLabels = burgLabels.select("#towns");
    const townSize = townIcons.attr("size") || 0.5;
    const townsAnchors = anchors.selectAll("#towns");
    const taSize = townsAnchors.attr("size") || 1;

    townIcons
      .selectAll("circle")
      .data(towns)
      .enter()
      .append("circle")
      .attr("id", d => "burg" + d.i)
      .attr("data-id", d => d.i)
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", townSize);

    townLabels
      .selectAll("text")
      .data(towns)
      .enter()
      .append("text")
      .attr("id", d => "burgLabel" + d.i)
      .attr("data-id", d => d.i)
      .attr("x", d => d.x)
      .attr("y", d => d.y)
      .attr("dy", `${townSize * -1.5}px`)
      .text(d => d.name);

    townsAnchors
      .selectAll("use")
      .data(towns.filter(c => c.port))
      .enter()
      .append("use")
      .attr("xlink:href", "#icon-anchor")
      .attr("data-id", d => d.i)
      .attr("x", d => rn(d.x - taSize * 0.47, 2))
      .attr("y", d => rn(d.y - taSize * 0.47, 2))
      .attr("width", taSize)
      .attr("height", taSize);

    TIME && console.timeEnd("drawBurgs");
  };

  // growth algorithm to assign cells to states like we did for cultures
  const expandStates = function () {
    TIME && console.time("expandStates");
    const {cells, states, cultures, burgs} = pack;

    cells.state = new Uint16Array(cells.i.length);
    const queue = new FlatQueue();
    const cost = [];
    const neutral = (cells.i.length / 5000) * 2500 * neutralInput.value * statesNeutral; // limit cost for state growth

    states
      .filter(s => s.i && !s.removed)
      .forEach(state => {
        const capitalCell = burgs[state.capital].cell;
        cells.state[capitalCell] = state.i;
        const cultureCenter = cultures[state.culture].center;
        const biome = cells.biome[cultureCenter]; // state native biome
        queue.push({cellId: state.center, stateId: state.i, b: biome}, 0);
        cost[state.center] = 1;
      });

    while (queue.length) {
      const priority = queue.peekValue();
      const {cellId, stateId, biome} = queue.pop();
      const {type, culture} = states[stateId];

      cells.c[cellId].forEach(neibCellId => {
        if (cells.state[neibCellId] && neibCellId === states[cells.state[neibCellId]].center) return; // do not overwrite capital cells

        const cultureCost = culture === cells.culture[neibCellId] ? -9 : 100;
        const populationCost =
          cells.h[neibCellId] < 20 ? 0 : cells.s[neibCellId] ? Math.max(20 - cells.s[neibCellId], 0) : 5000;
        const biomeCost = getBiomeCost(biome, cells.biome[neibCellId], type);
        const heightCost = getHeightCost(pack.features[cells.f[neibCellId]], cells.h[neibCellId], type);
        const riverCost = getRiverCost(cells.r[neibCellId], neibCellId, type);
        const typeCost = getTypeCost(cells.t[neibCellId], type);
        const cellCost = Math.max(cultureCost + populationCost + biomeCost + heightCost + riverCost + typeCost, 0);
        const totalCost = priority + 10 + cellCost / states[stateId].expansionism;

        if (totalCost > neutral) return;

        if (!cost[neibCellId] || totalCost < cost[neibCellId]) {
          if (cells.h[neibCellId] >= 20) cells.state[neibCellId] = stateId; // assign state to cell
          cost[neibCellId] = totalCost;

          queue.push({cellId: neibCellId, stateId, biome}, totalCost);
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

  const normalizeStates = function () {
    TIME && console.time("normalizeStates");
    const cells = pack.cells,
      burgs = pack.burgs;

    for (const i of cells.i) {
      if (cells.h[i] < 20 || cells.burg[i]) continue; // do not overwrite burgs
      if (cells.c[i].some(c => burgs[cells.burg[c]].capital)) continue; // do not overwrite near capital
      const neibs = cells.c[i].filter(c => cells.h[c] >= 20);
      const adversaries = neibs.filter(c => cells.state[c] !== cells.state[i]);
      if (adversaries.length < 2) continue;
      const buddies = neibs.filter(c => cells.state[c] === cells.state[i]);
      if (buddies.length > 2) continue;
      if (adversaries.length <= buddies.length) continue;
      cells.state[i] = cells.state[adversaries[0]];
    }
    TIME && console.timeEnd("normalizeStates");
  };

  // Resets the cultures of all burgs and states to their
  // cell or center cell's (respectively) culture.
  const updateCultures = function () {
    TIME && console.time("updateCulturesForBurgsAndStates");

    // Assign the culture associated with the burgs cell.
    pack.burgs = pack.burgs.map((burg, index) => {
      // Ignore metadata burg
      if (index === 0) {
        return burg;
      }
      return {...burg, culture: pack.cells.culture[burg.cell]};
    });

    // Assign the culture associated with the states' center cell.
    pack.states = pack.states.map((state, index) => {
      // Ignore neutrals state
      if (index === 0) {
        return state;
      }
      return {...state, culture: pack.cells.culture[state.center]};
    });

    TIME && console.timeEnd("updateCulturesForBurgsAndStates");
  };

  // calculate and draw curved state labels for a list of states
  const drawStateLabels = function (list) {
    TIME && console.time("drawStateLabels");
    const {cells, features, states} = pack;
    const paths = []; // text paths

    const lineGen = d3.line().curve(d3.curveBundle.beta(1));
    const mode = options.stateLabelsMode || "auto";

    for (const s of states) {
      if (!s.i || s.removed || !s.cells || (list && !list.includes(s.i))) continue;
      const used = [];
      const visualCenter = findCell(s.pole[0], s.pole[1]);
      const start = cells.state[visualCenter] === s.i ? visualCenter : s.center;
      const hull = getHull(start, s.i, s.cells / 10);
      const points = [...hull].map(v => pack.vertices.p[v]);
      const delaunay = Delaunator.from(points);
      const voronoi = new Voronoi(delaunay, points, points.length);
      const chain = connectCenters(voronoi.vertices, s.pole[1]);
      const relaxed = chain.map(i => voronoi.vertices.p[i]).filter((p, i) => i % 15 === 0 || i + 1 === chain.length);
      paths.push([s.i, relaxed]);

      function getHull(start, state, maxLake) {
        const queue = [start];
        const hull = new Set();

        while (queue.length) {
          const q = queue.pop();
          const sameStateNeibs = cells.c[q].filter(c => cells.state[c] === state);

          cells.c[q].forEach(function (c, d) {
            const passableLake = features[cells.f[c]].type === "lake" && features[cells.f[c]].cells < maxLake;
            if (cells.b[c] || (cells.state[c] !== state && !passableLake)) return hull.add(cells.v[q][d]);

            const hasCoadjacentSameStateCells = sameStateNeibs.some(neib => cells.c[c].includes(neib));
            if (hull.size > 20 && !hasCoadjacentSameStateCells && !passableLake) return hull.add(cells.v[q][d]);

            if (used[c]) return;
            used[c] = 1;
            queue.push(c);
          });
        }

        return hull;
      }

      function connectCenters(c, y) {
        // check if vertex is inside the area
        const inside = c.p.map(function (p) {
          if (p[0] <= 0 || p[1] <= 0 || p[0] >= graphWidth || p[1] >= graphHeight) return false; // out of the screen
          return used[findCell(p[0], p[1])];
        });

        const pointsInside = d3.range(c.p.length).filter(i => inside[i]);
        if (!pointsInside.length) return [0];
        const h = c.p.length < 200 ? 0 : c.p.length < 600 ? 0.5 : 1; // power of horyzontality shift
        const end =
          pointsInside[
            d3.scan(
              pointsInside,
              (a, b) => c.p[a][0] - c.p[b][0] + (Math.abs(c.p[a][1] - y) - Math.abs(c.p[b][1] - y)) * h
            )
          ]; // left point
        const start =
          pointsInside[
            d3.scan(
              pointsInside,
              (a, b) => c.p[b][0] - c.p[a][0] - (Math.abs(c.p[b][1] - y) - Math.abs(c.p[a][1] - y)) * h
            )
          ]; // right point

        // connect leftmost and rightmost points with shortest path
        const queue = new FlatQueue();
        const cost = [];
        const from = [];
        queue.push(start, 0);

        while (queue.length) {
          const priority = queue.peekValue();
          const next = queue.pop();

          if (next === end) break;

          for (const vertex of c.v[next]) {
            if (vertex === -1) continue;
            const totalCost = priority + (inside[vertex] ? 1 : 100);
            if (from[vertex] || totalCost >= cost[vertex]) continue;
            cost[vertex] = totalCost;
            from[vertex] = next;
            queue.push(vertex, totalCost);
          }
        }

        // restore path
        const chain = [end];
        let cur = end;
        while (cur !== start) {
          cur = from[cur];
          if (inside[cur]) chain.push(cur);
        }
        return chain;
      }
    }

    void (function drawLabels() {
      const g = labels.select("#states");
      const t = defs.select("#textPaths");
      const displayed = layerIsOn("toggleLabels");
      if (!displayed) toggleLabels();

      if (!list) {
        // remove all labels and textpaths
        g.selectAll("text").remove();
        t.selectAll("path[id*='stateLabel']").remove();
      }

      const example = g.append("text").attr("x", 0).attr("x", 0).text("Average");
      const letterLength = example.node().getComputedTextLength() / 7; // average length of 1 letter

      paths.forEach(p => {
        const id = p[0];
        const state = states[p[0]];
        const {name, fullName} = state;

        if (list) {
          t.select("#textPath_stateLabel" + id).remove();
          g.select("#stateLabel" + id).remove();
        }

        const path = p[1].length > 1 ? round(lineGen(p[1])) : `M${p[1][0][0] - 50},${p[1][0][1]}h${100}`;
        const textPath = t
          .append("path")
          .attr("d", path)
          .attr("id", "textPath_stateLabel" + id);
        const pathLength = p[1].length > 1 ? textPath.node().getTotalLength() / letterLength : 0; // path length in letters

        const [lines, ratio] = getLines(mode, name, fullName, pathLength);

        // prolongate path if it's too short
        if (pathLength && pathLength < lines[0].length) {
          const points = p[1];
          const f = points[0];
          const l = points[points.length - 1];
          const [dx, dy] = [l[0] - f[0], l[1] - f[1]];
          const mod = Math.abs((letterLength * lines[0].length) / dx) / 2;
          points[0] = [rn(f[0] - dx * mod), rn(f[1] - dy * mod)];
          points[points.length - 1] = [rn(l[0] + dx * mod), rn(l[1] + dy * mod)];
          textPath.attr("d", round(lineGen(points)));
        }

        example.attr("font-size", ratio + "%");
        const top = (lines.length - 1) / -2; // y offset
        const spans = lines.map((l, d) => {
          example.text(l);
          const left = example.node().getBBox().width / -2; // x offset
          return `<tspan x=${rn(left, 1)} dy="${d ? 1 : top}em">${l}</tspan>`;
        });

        const el = g
          .append("text")
          .attr("id", "stateLabel" + id)
          .append("textPath")
          .attr("xlink:href", "#textPath_stateLabel" + id)
          .attr("startOffset", "50%")
          .attr("font-size", ratio + "%")
          .node();

        el.insertAdjacentHTML("afterbegin", spans.join(""));
        if (mode === "full" || lines.length === 1) return;

        // check whether multilined label is generally inside the state. If no, replace with short name label
        const cs = pack.cells.state;
        const b = el.parentNode.getBBox();
        const c1 = () => +cs[findCell(b.x, b.y)] === id;
        const c2 = () => +cs[findCell(b.x + b.width / 2, b.y)] === id;
        const c3 = () => +cs[findCell(b.x + b.width, b.y)] === id;
        const c4 = () => +cs[findCell(b.x + b.width, b.y + b.height)] === id;
        const c5 = () => +cs[findCell(b.x + b.width / 2, b.y + b.height)] === id;
        const c6 = () => +cs[findCell(b.x, b.y + b.height)] === id;
        if (c1() + c2() + c3() + c4() + c5() + c6() > 3) return; // generally inside => exit

        // move to one-line name
        const text = pathLength > fullName.length * 1.8 ? fullName : name;
        example.text(text);
        const left = example.node().getBBox().width / -2; // x offset
        el.innerHTML = `<tspan x="${left}px">${text}</tspan>`;

        const correctedRatio = minmax(rn((pathLength / text.length) * 60), 40, 130);
        el.setAttribute("font-size", correctedRatio + "%");
      });

      example.remove();
      if (!displayed) toggleLabels();
    })();

    function getLines(mode, name, fullName, pathLength) {
      // short name
      if (mode === "short" || (mode === "auto" && pathLength < name.length)) {
        const lines = splitInTwo(name);
        const ratio = pathLength / lines[0].length;
        return [lines, minmax(rn(ratio * 60), 50, 150)];
      }

      // full name: one line
      if (pathLength > fullName.length * 2.5) {
        const lines = [fullName];
        const ratio = pathLength / lines[0].length;
        return [lines, minmax(rn(ratio * 70), 70, 170)];
      }

      // full name: two lines
      const lines = splitInTwo(fullName);
      const ratio = pathLength / lines[0].length;
      return [lines, minmax(rn(ratio * 60), 70, 150)];
    }

    TIME && console.timeEnd("drawStateLabels");
  };

  // calculate states data like area, population etc.
  const collectStatistics = function () {
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

  const assignColors = function () {
    TIME && console.time("assignColors");
    const colors = ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f"]; // d3.schemeSet2;

    // assign basic color using greedy coloring algorithm
    pack.states.forEach(s => {
      if (!s.i || s.removed) return;
      const neibs = s.neighbors;
      s.color = colors.find(c => neibs.every(n => pack.states[n].color !== c));
      if (!s.color) s.color = getRandomColor();
      colors.push(colors.shift());
    });

    // randomize each already used color a bit
    colors.forEach(c => {
      const sameColored = pack.states.filter(s => s.color === c);
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
  const generateCampaigns = function () {
    pack.states.forEach(s => {
      if (!s.i || s.removed) return;
      s.campaigns = generateCampaign(s);
    });
  };

  // generate Diplomatic Relationships
  const generateDiplomacy = function () {
    TIME && console.time("generateDiplomacy");
    const cells = pack.cells,
      states = pack.states;
    const chronicle = (states[0].diplomacy = []);
    const valid = states.filter(s => s.i && !states.removed);

    const neibs = {Ally: 1, Friendly: 2, Neutral: 1, Suspicion: 10, Rival: 9}; // relations to neighbors
    const neibsOfNeibs = {Ally: 10, Friendly: 8, Neutral: 5, Suspicion: 1}; // relations to neighbors of neighbors
    const far = {Friendly: 1, Neutral: 12, Suspicion: 2, Unknown: 6}; // relations to other
    const navals = {Neutral: 1, Suspicion: 2, Rival: 1, Unknown: 1}; // relations of naval powers

    valid.forEach(s => (s.diplomacy = new Array(states.length).fill("x"))); // clear all relationships
    if (valid.length < 2) return; // no states to renerate relations with
    const areaMean = d3.mean(valid.map(s => s.area)); // avarage state area

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
      let ap = states[attacker].area * states[attacker].expansionism,
        dp = states[defender].area * states[defender].expansionism;
      if (ap < dp * gauss(1.6, 0.8, 0, 10, 2)) continue; // defender is too strong
      const an = states[attacker].name,
        dn = states[defender].name; // names
      const attackers = [attacker],
        defenders = [defender]; // attackers and defenders array
      const dd = states[defender].diplomacy; // defender relations;

      // start a war
      const war = [`${an}-${trimVowels(dn)}ian War`, `${an} declared a war on its rival ${dn}`];
      const end = options.year;
      const start = end - gauss(2, 2, 0, 5);
      states[attacker].campaigns.push({name: `${trimVowels(dn)}ian War`, start, end});
      states[defender].campaigns.push({name: `${trimVowels(an)}ian War`, start, end});

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
    //console.table(states.map(s => s.diplomacy));
  };

  // select a forms for listed or all valid states
  const defineStateForms = function (list) {
    TIME && console.time("defineStateForms");
    const states = pack.states.filter(s => s.i && !s.removed);
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

        if (base === 16 && (form === "Empire" || form === "Kingdom")) return "Sultanate"; // Turkic
        if (base === 5 && (form === "Empire" || form === "Kingdom")) return "Tsardom"; // Ruthenian
        if ([16, 31].includes(base) && (form === "Empire" || form === "Kingdom")) return "Khaganate"; // Turkic, Mongolian
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

  const getFullName = function (s) {
    if (!s.formName) return s.name;
    if (!s.name && s.formName) return "The " + s.formName;
    const adjName = adjForms.includes(s.formName) && !/-| /.test(s.name);
    return adjName ? `${getAdjective(s.name)} ${s.formName}` : `${s.formName} of ${s.name}`;
  };

  const generateProvinces = function (regenerate) {
    TIME && console.time("generateProvinces");
    const localSeed = regenerate ? generateSeed() : seed;
    Math.random = aleaPRNG(localSeed);

    const {cells, states, burgs} = pack;
    const provinces = (pack.provinces = [0]);
    cells.province = new Uint16Array(cells.i.length); // cell state
    const percentage = +provincesInput.value;

    if (states.length < 2 || !percentage) {
      states.forEach(s => (s.provinces = []));
      return;
    } // no provinces

    const max = percentage == 100 ? 1000 : gauss(20, 5, 5, 100) * percentage ** 0.5; // max growth

    const forms = {
      Monarchy: {County: 22, Earldom: 6, Shire: 2, Landgrave: 2, Margrave: 2, Barony: 2, Captaincy: 1, Seneschalty: 1},
      Republic: {Province: 6, Department: 2, Governorate: 2, District: 1, Canton: 1, Prefecture: 1},
      Theocracy: {Parish: 3, Deanery: 1},
      Union: {Province: 1, State: 1, Canton: 1, Republic: 1, County: 1, Council: 1},
      Anarchy: {Council: 1, Commune: 1, Community: 1, Tribe: 1},
      Wild: {Territory: 10, Land: 5, Region: 2, Tribe: 1, Clan: 1, Dependency: 1, Area: 1}
    };

    // generate provinces for a selected burgs
    states.forEach(s => {
      s.provinces = [];
      if (!s.i || s.removed) return;
      const stateBurgs = burgs
        .filter(b => b.state === s.i && !b.removed)
        .sort((a, b) => b.population * gauss(1, 0.2, 0.5, 1.5, 3) - a.population)
        .sort((a, b) => b.capital - a.capital);
      if (stateBurgs.length < 2) return; // at least 2 provinces are required
      const provincesNumber = Math.max(Math.ceil((stateBurgs.length * percentage) / 100), 2);
      const form = Object.assign({}, forms[s.form]);

      for (let i = 0; i < provincesNumber; i++) {
        const province = provinces.length;
        s.provinces.push(province);
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
        const type = getType(center, burg.port);
        const coa = COA.generate(stateBurgs[i].coa, kinship, null, type);
        coa.shield = COA.getShield(c, s.i);
        provinces.push({i: province, state: s.i, center, burg, name, formName, fullName, color, coa});
      }
    });

    // expand generated provinces
    const queue = new FlatQueue();
    const cost = [];
    provinces.forEach(province => {
      const {i, center, state, removed} = province;
      if (!i || removed) return;

      cells.province[center] = i;
      queue.push({cellId: center, provinceId: i, stateId: state}, 0);
      cost[province.center] = 1;
    });

    while (queue.length) {
      const priority = queue.peekValue();
      const {cellId, provinceId, stateId} = queue.pop();

      cells.c[cellId].forEach(neibCellId => {
        const land = cells.h[neibCellId] >= 20;
        if (!land && !cells.t[neibCellId]) return; // cannot pass deep ocean
        if (land && cells.state[neibCellId] !== stateId) return;
        const evevation =
          cells.h[neibCellId] >= 70 ? 100 : cells.h[neibCellId] >= 50 ? 30 : cells.h[neibCellId] >= 20 ? 10 : 100;
        const totalCost = priority + evevation;

        if (totalCost > max) return;
        if (!cost[neibCellId] || totalCost < cost[neibCellId]) {
          if (land) cells.province[neibCellId] = provinceId;
          cost[neibCellId] = totalCost;
          queue.push({cellId: neibCellId, provinceId, stateId}, totalCost);
        }
      });
    }

    // justify provinces shapes a bit
    for (const i of cells.i) {
      if (cells.burg[i]) continue; // do not overwrite burgs
      const neibs = cells.c[i].filter(c => cells.state[c] === cells.state[i]).map(c => cells.province[c]);
      const adversaries = neibs.filter(c => c !== cells.province[i]);
      if (adversaries.length < 2) continue;
      const buddies = neibs.filter(c => c === cells.province[i]).length;
      if (buddies.length > 2) continue;
      const competitors = adversaries.map(p => adversaries.reduce((s, v) => (v === p ? s + 1 : s), 0));
      const max = d3.max(competitors);
      if (buddies >= max) continue;
      cells.province[i] = adversaries[competitors.indexOf(max)];
    }

    // add "wild" provinces if some cells don't have a province assigned
    const noProvince = Array.from(cells.i).filter(i => cells.state[i] && !cells.province[i]); // cells without province assigned
    states.forEach(s => {
      if (!s.provinces.length) return;

      const coreProvinceNames = s.provinces.map(p => provinces[p]?.name);
      const colonyNamePool = [s.name, ...coreProvinceNames].filter(name => name && !/new/i.test(name));
      const getColonyName = () => {
        if (colonyNamePool.length < 1) return null;

        const index = rand(colonyNamePool.length - 1);
        const spliced = colonyNamePool.splice(index, 1);
        return spliced[0] ? `New ${spliced[0]}` : null;
      };

      let stateNoProvince = noProvince.filter(i => cells.state[i] === s.i && !cells.province[i]);
      while (stateNoProvince.length) {
        // add new province
        const province = provinces.length;
        const burgCell = stateNoProvince.find(i => cells.burg[i]);
        const center = burgCell ? burgCell : stateNoProvince[0];
        const burg = burgCell ? cells.burg[burgCell] : 0;
        cells.province[center] = province;

        // expand province
        const costs = [];
        costs[center] = 1;
        queue.push(center, 0);

        while (queue.length) {
          const priority = queue.peekValue();
          const next = queue.pop();

          cells.c[next].forEach(neibCellId => {
            if (cells.province[neibCellId]) return;
            const land = cells.h[neibCellId] >= 20;
            if (cells.state[neibCellId] && cells.state[neibCellId] !== s.i) return;
            const cost = land ? (cells.state[neibCellId] === s.i ? 3 : 20) : cells.t[neibCellId] ? 10 : 30;
            const totalCost = priority + cost;

            if (totalCost > max) return;
            if (!costs[neibCellId] || totalCost < costs[neibCellId]) {
              if (land && cells.state[neibCellId] === s.i) cells.province[neibCellId] = province; // assign province to a cell
              costs[neibCellId] = totalCost;
              queue.push(neibCellId, totalCost);
            }
          });
        }

        // generate "wild" province name
        const c = cells.culture[center];
        const f = pack.features[cells.f[center]];
        const color = getMixedColor(s.color);

        const provCells = stateNoProvince.filter(i => cells.province[i] === province);
        const singleIsle = provCells.length === f.cells && !provCells.find(i => cells.f[i] !== f.i);
        const isleGroup = !singleIsle && !provCells.find(i => pack.features[cells.f[i]].group !== "isle");
        const colony = !singleIsle && !isleGroup && P(0.5) && !isPassable(s.center, center);

        const name = (function () {
          const colonyName = colony && P(0.8) && getColonyName();
          if (colonyName) return colonyName;
          if (burgCell && P(0.5)) return burgs[burg].name;
          return Names.getState(Names.getCultureShort(c), c);
        })();

        const formName = (function () {
          if (singleIsle) return "Island";
          if (isleGroup) return "Islands";
          if (colony) return "Colony";
          return rw(forms["Wild"]);
        })();

        const fullName = name + " " + formName;

        const dominion = colony ? P(0.95) : singleIsle || isleGroup ? P(0.7) : P(0.3);
        const kinship = dominion ? 0 : 0.4;
        const type = getType(center, burgs[burg]?.port);
        const coa = COA.generate(s.coa, kinship, dominion, type);
        coa.shield = COA.getShield(c, s.i);

        provinces.push({i: province, state: s.i, center, burg, name, formName, fullName, color, coa});
        s.provinces.push(province);

        // check if there is a land way within the same state between two cells
        function isPassable(from, to) {
          if (cells.f[from] !== cells.f[to]) return false; // on different islands
          const queue = [from];

          const used = new Uint8Array(cells.i.length);
          const state = cells.state[from];

          while (queue.length) {
            const current = queue.pop();
            if (current === to) return true; // way is found
            cells.c[current].forEach(c => {
              if (used[c] || cells.h[c] < 20 || cells.state[c] !== state) return;
              queue.push(c);
              used[c] = 1;
            });
          }
          return false; // way is not found
        }

        // re-check
        stateNoProvince = noProvince.filter(i => cells.state[i] === s.i && !cells.province[i]);
      }
    });

    TIME && console.timeEnd("generateProvinces");
  };

  return {
    generate,
    expandStates,
    normalizeStates,
    assignColors,
    drawBurgs,
    specifyBurgs,
    defineBurgFeatures,
    getType,
    drawStateLabels,
    collectStatistics,
    generateCampaign,
    generateCampaigns,
    generateDiplomacy,
    defineStateForms,
    getFullName,
    generateProvinces,
    updateCultures
  };
})();
