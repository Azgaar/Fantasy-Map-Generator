"use strict";

window.Burgs = (() => {
  const generate = () => {
    TIME && console.time("generateBurgs");
    const {cells} = pack;

    let burgs = [0]; // burgs array
    cells.burg = new Uint16Array(cells.i.length);

    const populatedCells = cells.i.filter(i => cells.s[i] > 0 && cells.culture[i]);
    if (!populatedCells.length) {
      WARN && console.warn("There is no populated cells. Cannot generate states");
      return burgs;
    }

    let quadtree = d3.quadtree();
    generateCapitals();
    generateTowns();

    pack.burgs = burgs;
    TIME && console.timeEnd("generateBurgs");

    function getCapitalsNumber() {
      let number = +byId("statesNumber").value;

      if (populatedCells.length < number * 10) {
        WARN && console.warn(`Not enough populated cells. Generating only ${number} capitals/states`);
        number = Math.floor(sorted.length / 10);
      }

      return number;
    }

    function getTownsNumber() {
      const manorsInput = byId("manorsInput");
      const isAuto = manorsInput.value === "1000"; // '1000' is considered as auto
      if (isAuto) return rn(populatedCells.length / 5 / (grid.points.length / 10000) ** 0.8);

      return Math.min(manorsInput.valueAsNumber, sorted.length);
    }

    function generateCapitals() {
      const randomize = score => score * (0.5 + Math.random() * 0.5);
      const score = new Int16Array(cells.s.map(randomize));
      const sorted = populatedCells.sort((a, b) => score[b] - score[a]);

      const capitalsNumber = getCapitalsNumber();
      let spacing = (graphWidth + graphHeight) / 2 / capitalsNumber; // min distance between capitals

      for (let i = 0; burgs.length <= capitalsNumber; i++) {
        const cell = sorted[i];
        const [x, y] = cells.p[cell];

        if (quadtree.find(x, y, spacing) === undefined) {
          burgs.push({cell, x, y});
          quadtree.add([x, y]);
        }

        // reset if all cells were checked
        if (i === sorted.length - 1) {
          WARN && console.warn("Cannot place capitals with current spacing. Trying again with reduced spacing");
          quadtree = d3.quadtree();
          i = -1;
          burgs = [0];
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
        cells.burg[burg.cell] = burgId;
      });
    }

    function generateTowns() {
      const randomize = score => score * gauss(1, 3, 0, 20, 3);
      const score = new Int16Array(cells.s.map(randomize));
      const sorted = populatedCells.sort((a, b) => score[b] - score[a]);

      const burgsNumber = getTownsNumber();
      let spacing = (graphWidth + graphHeight) / 150 / (burgsNumber ** 0.7 / 66); // min distance between towns

      for (let added = 0; added < burgsNumber && spacing > 1; ) {
        for (let i = 0; added < burgsNumber && i < sorted.length; i++) {
          if (cells.burg[sorted[i]]) continue;
          const cell = sorted[i];
          const [x, y] = cells.p[cell];

          const minSpacing = spacing * gauss(1, 0.3, 0.2, 2, 2); // randomize to make placement not uniform
          if (quadtree.find(x, y, minSpacing) !== undefined) continue; // to close to existing burg

          const burgId = burgs.length;
          const culture = cells.culture[cell];
          const name = Names.getCulture(culture);
          const feature = cells.f[cell];
          burgs.push({cell, x, y, i: burgId, state: 0, culture, name, feature, capital: 0});
          added++;
          cells.burg[cell] = burgId;
        }

        spacing *= 0.5;
      }
    }
  };

  const getDefaultGroups = () => [
    {name: "capitals", active: true, features: {capital: true}, preview: "watabou-city-generator"},
    {name: "cities", active: true, percentile: 90, preview: "watabou-city-generator"},
    {
      name: "forts",
      active: true,
      features: {citadel: true, walls: false, plaza: false, port: false},
      population: [0, 1],
      preview: null
    },
    {
      name: "monasteries",
      active: true,
      features: {temple: true, walls: false, plaza: false, port: false},
      population: [0, 1],
      preview: null
    },
    {
      name: "caravanserais",
      active: true,
      features: {port: false},
      population: [0, 1],
      biomes: [1, 2, 3],
      preview: null
    },
    {
      name: "trading posts",
      active: true,
      features: {plaza: true},
      population: [0, 1],
      biomes: [1, 2, 3],
      preview: null
    },
    {name: "villages", active: true, population: [0.1, 2], preview: "watabou-village-generator"},
    {
      name: "hamlets",
      active: true,
      features: {plaza: true, walls: false, plaza: false},
      population: [0, 0.1],
      preview: "watabou-village-generator"
    },
    {name: "towns", active: true, isDefault: true, preview: "watabou-city-generator"}
  ];

  // define burg coordinates, coa, port status and define details
  const specifyBurgs = () => {
    TIME && console.time("specifyBurgs");
    const {cells, features} = pack;
    const temp = grid.cells.temp;

    for (const burg of pack.burgs) {
      if (!burg.i || burg.lock) continue;
      const i = burg.cell;

      // asign port status to some coastline burgs with temp > 0 °C
      const haven = cells.haven[i];
      if (haven && temp[cells.g[i]] > 0) {
        const f = cells.f[haven]; // water body id
        // port is a capital with any harbor OR town with good harbor
        const port = features[f].cells > 1 && ((burg.capital && cells.harbor[i]) || cells.harbor[i] === 1);
        burg.port = port ? f : 0; // port is defined by water body id it lays on
      } else burg.port = 0;

      // define burg population (keep urbanization at about 10% rate)
      burg.population = rn(Math.max(cells.s[i] / 8 + burg.i / 1000 + (i % 100) / 1000, 0.1), 3);
      if (burg.capital) burg.population = rn(burg.population * 1.3, 3); // increase capital population

      if (burg.port) {
        burg.population = burg.population * 1.3; // increase port population
        const [x, y] = getCloseToEdgePoint(i, haven);
        burg.x = x;
        burg.y = y;
      }

      // add random factor
      burg.population = rn(burg.population * gauss(2, 3, 0.6, 20, 3), 3);

      // shift burgs on rivers semi-randomly and just a bit
      if (!burg.port && cells.r[i]) {
        const shift = Math.min(cells.fl[i] / 150, 1);
        if (i % 2) burg.x = rn(burg.x + shift, 2);
        else burg.x = rn(burg.x - shift, 2);
        if (cells.r[i] % 2) burg.y = rn(burg.y + shift, 2);
        else burg.y = rn(burg.y - shift, 2);
      }

      // define emblem
      const state = pack.states[burg.state];
      const stateCOA = state.coa;
      let kinship = 0.25;
      if (burg.capital) kinship += 0.1;
      else if (burg.port) kinship -= 0.1;
      if (burg.culture !== state.culture) kinship -= 0.25;
      burg.type = getType(i, burg.port);
      const type = burg.capital && P(0.2) ? "Capital" : burg.type === "Generic" ? "City" : burg.type;
      burg.coa = COA.generate(stateCOA, kinship, null, type);
      burg.coa.shield = COA.getShield(burg.culture, burg.state);
    }

    // de-assign port status if it's the only one on feature
    const ports = pack.burgs.filter(b => !b.removed && b.port > 0);
    for (const f of features) {
      if (!f.i || f.land || f.border) continue;
      const featurePorts = ports.filter(b => b.port === f.i);
      if (featurePorts.length === 1) featurePorts[0].port = 0;
    }

    pack.burgs.filter(b => b.i && !b.removed && !b.lock).forEach(defineBurgFeatures);

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
    const {cells, features} = pack;

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
    const {cells, states} = pack;
    const pop = burg.population;
    burg.citadel = Number(burg.capital || (pop > 50 && P(0.75)) || (pop > 15 && P(0.5)) || P(0.1));
    burg.plaza = Number(pop > 20 || (pop > 10 && P(0.8)) || (pop > 4 && P(0.7)) || P(0.6));
    burg.walls = Number(burg.capital || pop > 30 || (pop > 20 && P(0.75)) || (pop > 10 && P(0.5)) || P(0.1));
    burg.shanty = Number(pop > 60 || (pop > 40 && P(0.75)) || (pop > 20 && burg.walls && P(0.4)));
    const religion = cells.religion[burg.cell];
    const theocracy = states[burg.state].form === "Theocracy";
    burg.temple = Number(
      (religion && theocracy && P(0.5)) || pop > 50 || (pop > 35 && P(0.75)) || (pop > 20 && P(0.5))
    );
  };

  return {generate, getDefaultGroups, specifyBurgs, getType, defineBurgFeatures};
})();
