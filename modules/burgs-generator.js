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
    shiftBurgs();

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
      let spacing = (graphWidth + graphHeight) / 150 / (burgsNumber ** 0.7 / 66); // min distance between town

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

    // define port status and shift ports and burgs on rivers
    function shiftBurgs() {
      const {cells, features} = pack;
      const temp = grid.cells.temp;

      // port is a capital with any harbor OR any burg with a safe harbor
      const featurePorts = {};
      for (const burg of burgs) {
        if (!burg.i || burg.lock) continue;
        const i = burg.cell;

        const haven = cells.haven[i];
        const harbor = cells.harbor[i];

        if (haven !== undefined && temp[cells.g[i]] > 0) {
          const featureId = cells.f[haven];
          const canBePort = features[featureId].cells > 1 && ((burg.capital && harbor) || harbor === 1);
          if (canBePort) {
            if (!featurePorts[featureId]) featurePorts[featureId] = [];
            featurePorts[featureId].push(burg);
          }
        }
      }

      // shift ports to the edge of the water body. Only bodies with 2+ ports are considered
      Object.entries(featurePorts).forEach(([featureId, burgs]) => {
        if (burgs.length < 2) return;
        burgs.forEach(burg => {
          burg.port = featureId;
          const haven = cells.haven[burg.cell];
          const [x, y] = getCloseToEdgePoint(burg.cell, haven);
          burg.x = x;
          burg.y = y;
        });
      });

      // shift non-port river burgs a bit
      for (const burg of burgs) {
        if (!burg.i || burg.lock || burg.port || !cells.r[burg.cell]) continue;
        const cellId = burg.cell;
        const shift = Math.min(cells.fl[cellId] / 150, 1);
        burg.x = cellId % 2 ? rn(burg.x + shift, 2) : rn(burg.x - shift, 2);
        burg.y = cells.r[cellId] % 2 ? rn(burg.y + shift, 2) : rn(burg.y - shift, 2);
      }

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
    }
  };

  const specify = () => {
    TIME && console.time("specifyBurgs");

    pack.burgs.forEach(burg => {
      if (!burg.i || burg.removed || burg.lock) return;
      definePopulation(burg);
      defineEmblem(burg);
      defineFeatures(burg);
    });

    const populations = pack.burgs
      .filter(b => b.i && !b.removed)
      .map(b => b.population)
      .sort((a, b) => a - b); // ascending

    pack.burgs.forEach(burg => {
      if (!burg.i || burg.removed) return;
      defineGroup(burg, populations);
    });

    TIME && console.timeEnd("specifyBurgs");
  };

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

  function definePopulation(burg) {
    const cellId = burg.cell;
    let population = pack.cells.s[cellId] / 5;
    if (burg.capital) population *= 1.5;
    const connectivityRate = Routes.getConnectivityRate(cellId);
    if (connectivityRate) population *= connectivityRate;
    population *= gauss(1, 1, 0.25, 4, 5); // randomize
    population += ((burg.i % 100) - (cellId % 100)) / 1000; // unround
    burg.population = rn(Math.max(population, 0.01), 3);
  }

  function defineEmblem(burg) {
    burg.type = getType(burg.cell, burg.port);

    const state = pack.states[burg.state];
    const stateCOA = state.coa;

    let kinship = 0.25;
    if (burg.capital) kinship += 0.1;
    else if (burg.port) kinship -= 0.1;
    if (burg.culture !== state.culture) kinship -= 0.25;

    const type = burg.capital && P(0.2) ? "Capital" : burg.type === "Generic" ? "City" : burg.type;
    burg.coa = COA.generate(stateCOA, kinship, null, type);
    burg.coa.shield = COA.getShield(burg.culture, burg.state);
  }

  function defineFeatures(burg) {
    const pop = burg.population;
    burg.citadel = Number(burg.capital || (pop > 50 && P(0.75)) || (pop > 15 && P(0.5)) || P(0.1));
    burg.plaza = Number(
      Routes.isCrossroad(burg.cell) || (Routes.hasRoad(burg.cell) && P(0.7)) || pop > 20 || (pop > 10 && P(0.8))
    );
    burg.walls = Number(burg.capital || pop > 30 || (pop > 20 && P(0.75)) || (pop > 10 && P(0.5)) || P(0.1));
    burg.shanty = Number(pop > 60 || (pop > 40 && P(0.75)) || (pop > 20 && burg.walls && P(0.4)));
    const religion = pack.cells.religion[burg.cell];
    const theocracy = pack.states[burg.state].form === "Theocracy";
    burg.temple = Number(
      (religion && theocracy && P(0.5)) || pop > 50 || (pop > 35 && P(0.75)) || (pop > 20 && P(0.5))
    );
  }

  const getDefaultGroups = () => [
    {name: "capital", active: true, order: 9, features: {capital: true}, preview: "watabou-city"},
    {name: "city", active: true, order: 8, percentile: 90, min: 5, preview: "watabou-city"},
    {
      name: "fort",
      active: true,
      features: {citadel: true, walls: false, plaza: false, port: false},
      order: 6,
      max: 1
    },
    {
      name: "monastery",
      active: true,
      features: {temple: true, walls: false, plaza: false, port: false},
      order: 5,
      max: 0.8
    },
    {
      name: "caravanserai",
      active: true,
      features: {port: false, plaza: true},
      order: 4,
      max: 0.8,
      biomes: [1, 2, 3]
    },
    {
      name: "trading_post",
      active: true,
      order: 3,
      features: {plaza: true},
      max: 0.8,
      biomes: [5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      name: "village",
      active: true,
      order: 2,
      min: 0.1,
      max: 2,
      preview: "watabou-village"
    },
    {
      name: "hamlet",
      active: true,
      order: 1,
      features: {plaza: false},
      max: 0.1,
      preview: "watabou-village"
    },
    {name: "town", active: true, order: 7, isDefault: true, preview: "watabou-city"}
  ];

  function defineGroup(burg, populations) {
    if (burg.lock && burg.group) {
      // locked burgs: don't change group if it still exists
      const group = options.burgs.groups.find(g => g.name === burg.group);
      if (group) return;
    }

    const defaultGroup = options.burgs.groups.find(g => g.isDefault);
    if (!defaultGroup) {
      ERROR & console.error("No default group defined");
      return;
    }
    burg.group = defaultGroup.name;

    for (const group of options.burgs.groups) {
      if (!group.active) continue;

      if (group.min) {
        const isFit = burg.population >= group.min;
        if (!isFit) continue;
      }

      if (group.max) {
        const isFit = burg.population <= group.max;
        if (!isFit) continue;
      }

      if (group.features) {
        const isFit = Object.entries(group.features).every(([feature, value]) => Boolean(burg[feature]) === value);
        if (!isFit) continue;
      }

      if (group.biomes) {
        const isFit = group.biomes.includes(pack.cells.biome[burg.cell]);
        if (!isFit) continue;
      }

      if (group.percentile) {
        const index = populations.indexOf(burg.population);
        const isFit = index >= Math.floor((populations.length * group.percentile) / 100);
        if (!isFit) continue;
      }

      burg.group = group.name; // apply fitting group
      return;
    }
  }

  const previewGeneratorsMap = {
    "watabou-city": createWatabouCityLinks,
    "watabou-village": createWatabouVillageLinks,
    "watabou-dwelling": createWatabouDwellingLinks
  };

  function getPreview(burg) {
    if (burg.link) return {link: burg.link, preview: burg.link};

    const group = options.burgs.groups.find(g => g.name === burg.group);
    if (!group?.preview || !previewGeneratorsMap[group.preview]) return {link: null, preview: null};

    return previewGeneratorsMap[group.preview](burg);
  }

  function createWatabouCityLinks(burg) {
    const cells = pack.cells;
    const {i, name, population: burgPopulation, cell} = burg;
    const burgSeed = burg.MFCG || seed + String(burg.i).padStart(4, 0);

    const sizeRaw = 2.13 * Math.pow((burgPopulation * populationRate) / urbanDensity, 0.385);
    const size = minmax(Math.ceil(sizeRaw), 6, 100);
    const population = rn(burgPopulation * populationRate * urbanization);

    const river = cells.r[cell] ? 1 : 0;
    const coast = Number(burg.port > 0);
    const sea = (() => {
      if (!coast || !cells.haven[cell]) return null;

      // calculate see direction: 0 = east, 0.5 = north, 1 = west, 1.5 = south
      const [x1, y1] = cells.p[cell];
      const [x2, y2] = cells.p[cells.haven[cell]];
      const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

      if (deg <= 0) return normalize(Math.abs(deg), 0, 180);
      return 2 - normalize(deg, 0, 180);
    })();

    const arableBiomes = river ? [1, 2, 3, 4, 5, 6, 7, 8] : [5, 6, 7, 8];
    const farms = +arableBiomes.includes(cells.biome[cell]);

    const citadel = +burg.citadel;
    const urban_castle = +(citadel && each(2)(i));

    const hub = Routes.isCrossroad(cell);
    const walls = +burg.walls;
    const plaza = +burg.plaza;
    const temple = +burg.temple;
    const shantytown = +burg.shanty;

    const style = "natural";

    const url = new URL("https://watabou.github.io/city-generator/");
    url.search = new URLSearchParams({
      name,
      population,
      size,
      seed: burgSeed,
      river,
      coast,
      farms,
      citadel,
      urban_castle,
      hub,
      plaza,
      temple,
      walls,
      shantytown,
      gates: -1,
      style
    });
    if (sea) url.searchParams.append("sea", sea);

    const link = url.toString();
    return {link, preview: link + "&preview=1"};
  }

  function createWatabouVillageLinks(burg) {
    const {cells, features} = pack;
    const {i, population, cell} = burg;

    const burgSeed = seed + String(i).padStart(4, 0);
    const pop = rn(population * populationRate * urbanization);
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
    url.search = new URLSearchParams({pop, name: burg.name, seed: burgSeed, width, height, style, tags});

    const link = url.toString();
    return {link, preview: link + "&preview=1"};
  }

  function createWatabouDwellingLinks(burg) {
    const burgSeed = seed + String(burg.i).padStart(4, 0);
    const pop = rn(burg.population * populationRate * urbanization);

    const tags = (() => {
      if (pop > 200) return ["large", "tall"];
      if (pop > 100) return ["large"];
      if (pop > 50) return ["tall"];
      if (pop > 20) return ["low"];
      return ["small"];
    })();

    const url = new URL("https://watabou.github.io/dwellings/");
    url.search = new URLSearchParams({pop, name: "", seed: burgSeed, tags});

    const link = url.toString();
    return {link, preview: link + "&preview=1"};
  }

  function add([x, y]) {
    const {cells} = pack;

    const burgId = pack.burgs.length;
    const cellId = findCell(x, y);
    const culture = cells.culture[cellId];
    const name = Names.getCulture(culture);
    const state = cells.state[cellId];
    const feature = cells.f[cellId];

    const burg = {
      cell: cellId,
      x,
      y,
      i: burgId,
      state,
      culture,
      name,
      feature,
      capital: 0,
      port: 0
    };
    definePopulation(burg);
    defineEmblem(burg);
    defineFeatures(burg);

    const populations = pack.burgs
      .filter(b => b.i && !b.removed)
      .map(b => b.population)
      .sort((a, b) => a - b); // ascending
    defineGroup(burg, populations);

    pack.burgs.push(burg);
    cells.burg[cellId] = burgId;

    const newRoute = Routes.connect(cellId);
    if (newRoute && layerIsOn("toggleRoutes")) drawRoute(newRoute);

    drawBurgIcon(burg);
    drawBurgLabel(burg);

    return burgId;
  }

  function changeGroup(burg, group) {
    if (group) {
      burg.group = group;
    } else {
      const validBurgs = pack.burgs.filter(b => b.i && !b.removed);
      const populations = validBurgs.map(b => b.population).sort((a, b) => a - b);
      defineGroup(burg, populations);
    }

    drawBurgIcon(burg);
    drawBurgLabel(burg);
  }

  function remove(burgId) {
    const burg = pack.burgs[burgId];
    if (!burg) return tip(`Burg ${burgId} not found`, false, "error");

    pack.cells.burg[burg.cell] = 0;
    burg.removed = true;

    const noteId = notes.findIndex(note => note.id === `burg${burgId}`);
    if (noteId !== -1) notes.splice(noteId, 1);

    if (burg.coa) {
      byId("burgCOA" + burgId)?.remove();
      emblems.select(`#burgEmblems > use[data-i='${burgId}']`).remove();
      delete burg.coa;
    }

    removeBurgIcon(burg.i);
    removeBurgLabel(burg.i);
  }

  return {generate, getDefaultGroups, specify, defineGroup, getPreview, getType, add, changeGroup, remove};
})();
