"use strict";

window.Religions = (function () {
  // name generation approach and relative chance to be selected
  const approach = {
    Number: 1,
    Being: 3,
    Adjective: 5,
    "Color + Animal": 5,
    "Adjective + Animal": 5,
    "Adjective + Being": 5,
    "Adjective + Genitive": 1,
    "Color + Being": 3,
    "Color + Genitive": 3,
    "Being + of + Genitive": 2,
    "Being + of the + Genitive": 1,
    "Animal + of + Genitive": 1,
    "Adjective + Being + of + Genitive": 2,
    "Adjective + Animal + of + Genitive": 2
  };

  // turn weighted array into simple array
  const approaches = [];
  for (const a in approach) {
    for (let j = 0; j < approach[a]; j++) {
      approaches.push(a);
    }
  }

  const base = {
    number: ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"],
    being: [
      "Ancestor",
      "Ancient",
      "Brother",
      "Chief",
      "Council",
      "Creator",
      "Deity",
      "Elder",
      "Father",
      "Forebear",
      "Forefather",
      "Giver",
      "God",
      "Goddess",
      "Guardian",
      "Lady",
      "Lord",
      "Maker",
      "Master",
      "Mother",
      "Numen",
      "Overlord",
      "Reaper",
      "Ruler",
      "Sister",
      "Spirit",
      "Virgin"
    ],
    animal: [
      "Antelope",
      "Ape",
      "Badger",
      "Basilisk",
      "Bear",
      "Beaver",
      "Bison",
      "Boar",
      "Buffalo",
      "Camel",
      "Cat",
      "Centaur",
      "Chimera",
      "Cobra",
      "Crane",
      "Crocodile",
      "Crow",
      "Cyclope",
      "Deer",
      "Dog",
      "Dragon",
      "Eagle",
      "Elk",
      "Falcon",
      "Fox",
      "Goat",
      "Goose",
      "Hare",
      "Hawk",
      "Heron",
      "Horse",
      "Hound",
      "Hyena",
      "Ibis",
      "Jackal",
      "Jaguar",
      "Kraken",
      "Lark",
      "Leopard",
      "Lion",
      "Mantis",
      "Marten",
      "Moose",
      "Mule",
      "Narwhal",
      "Owl",
      "Ox",
      "Panther",
      "Pegasus",
      "Phoenix",
      "Rat",
      "Raven",
      "Rook",
      "Scorpion",
      "Serpent",
      "Shark",
      "Sheep",
      "Snake",
      "Sphinx",
      "Spider",
      "Swan",
      "Tiger",
      "Turtle",
      "Unicorn",
      "Viper",
      "Vulture",
      "Walrus",
      "Wolf",
      "Wolverine",
      "Worm",
      "Wyvern"
    ],
    adjective: [
      "Aggressive",
      "Almighty",
      "Ancient",
      "Beautiful",
      "Benevolent",
      "Big",
      "Blind",
      "Blond",
      "Bloody",
      "Brave",
      "Broken",
      "Brutal",
      "Burning",
      "Calm",
      "Cheerful",
      "Crazy",
      "Cruel",
      "Dead",
      "Deadly",
      "Devastating",
      "Distant",
      "Disturbing",
      "Divine",
      "Dying",
      "Eternal",
      "Evil",
      "Explicit",
      "Fair",
      "Far",
      "Fat",
      "Fatal",
      "Favorable",
      "Flying",
      "Friendly",
      "Frozen",
      "Giant",
      "Good",
      "Grateful",
      "Great",
      "Happy",
      "High",
      "Holy",
      "Honest",
      "Huge",
      "Hungry",
      "Immutable",
      "Infallible",
      "Inherent",
      "Last",
      "Latter",
      "Lost",
      "Loud",
      "Lucky",
      "Mad",
      "Magical",
      "Main",
      "Major",
      "Marine",
      "Naval",
      "New",
      "Old",
      "Patient",
      "Peaceful",
      "Pregnant",
      "Prime",
      "Proud",
      "Pure",
      "Sacred",
      "Sad",
      "Scary",
      "Secret",
      "Selected",
      "Severe",
      "Silent",
      "Sleeping",
      "Slumbering",
      "Strong",
      "Sunny",
      "Superior",
      "Sustainable",
      "Troubled",
      "Unhappy",
      "Unknown",
      "Waking",
      "Wild",
      "Wise",
      "Worried",
      "Young"
    ],
    genitive: [
      "Cold",
      "Day",
      "Death",
      "Doom",
      "Fate",
      "Fire",
      "Fog",
      "Frost",
      "Gates",
      "Heaven",
      "Home",
      "Ice",
      "Justice",
      "Life",
      "Light",
      "Lightning",
      "Love",
      "Nature",
      "Night",
      "Pain",
      "Snow",
      "Springs",
      "Summer",
      "Thunder",
      "Time",
      "Victory",
      "War",
      "Winter"
    ],
    theGenitive: [
      "Abyss",
      "Blood",
      "Dawn",
      "Earth",
      "East",
      "Eclipse",
      "Fall",
      "Harvest",
      "Moon",
      "North",
      "Peak",
      "Rainbow",
      "Sea",
      "Sky",
      "South",
      "Stars",
      "Storm",
      "Sun",
      "Tree",
      "Underworld",
      "West",
      "Wild",
      "Word",
      "World"
    ],
    color: [
      "Amber",
      "Black",
      "Blue",
      "Bright",
      "Brown",
      "Dark",
      "Golden",
      "Green",
      "Grey",
      "Light",
      "Orange",
      "Pink",
      "Purple",
      "Red",
      "White",
      "Yellow"
    ]
  };

  const forms = {
    Folk: {Shamanism: 2, Animism: 2, "Ancestor worship": 1, Polytheism: 2},
    Organized: {Polytheism: 5, Dualism: 1, Monotheism: 4, "Non-theism": 1},
    Cult: {Cult: 1, "Dark Cult": 1},
    Heresy: {Heresy: 1}
  };

  const namingMethods = {
    Folk: {
      "Culture + type": 1
    },

    Organized: {
      "Random + type": 3,
      "Random + ism": 1,
      "Supreme + ism": 5,
      "Faith of + Supreme": 5,
      "Place + ism": 1,
      "Culture + ism": 2,
      "Place + ian + type": 6,
      "Culture + type": 4
    },

    Cult: {
      "Burg + ian + type": 2,
      "Random + ian + type": 1,
      "Type + of the + meaning": 2
    },

    Heresy: {
      "Burg + ian + type": 3,
      "Random + ism": 3,
      "Random + ian + type": 2,
      "Type + of the + meaning": 1
    }
  };

  const types = {
    Shamanism: {Beliefs: 3, Shamanism: 2, Spirits: 1},
    Animism: {Spirits: 1, Beliefs: 1},
    "Ancestor worship": {Beliefs: 1, Forefathers: 2, Ancestors: 2},
    Polytheism: {Deities: 3, Faith: 1, Gods: 1, Pantheon: 1},

    Dualism: {Religion: 3, Faith: 1, Cult: 1},
    Monotheism: {Religion: 1, Church: 1},
    "Non-theism": {Beliefs: 3, Spirits: 1},

    Cult: {Cult: 4, Sect: 4, Arcanum: 1, Coterie: 1, Order: 1, Worship: 1},
    "Dark Cult": {Cult: 2, Sect: 2, Blasphemy: 1, Circle: 1, Coven: 1, Idols: 1, Occultism: 1},

    Heresy: {
      Heresy: 3,
      Sect: 2,
      Apostates: 1,
      Brotherhood: 1,
      Circle: 1,
      Dissent: 1,
      Dissenters: 1,
      Iconoclasm: 1,
      Schism: 1,
      Society: 1
    }
  };

  function generate() {
    TIME && console.time("generateReligions");
    // const {cells, states, cultures, burgs} = pack;

    const folkReligions = generateFolkReligions();
    const {lockedReligions, lockedReligionCount} = restoreLockedReligions();
    const basicReligions = generateOrganizedReligions(+religionsInput.value, lockedReligionCount);

    const {religions, religionIds} = specifyReligions([...folkReligions, ...basicReligions], lockedReligions);
    
    pack.religions = religions;
    pack.cells.religion = religionIds;

    TIME && console.timeEnd("generateReligions");
  };

  function generateFolkReligions() {
    return pack.cultures.filter(c => c.i && !c.removed).map(culture => {
      const {i: culutreId, center} = culture;
      const form = rw(forms.Folk);

      return {type:"Folk", form, culture: culutreId, center};
    });
  }

  function restoreLockedReligions() {
    //TODO
    return {lockedReligions: [], lockedReligionCount: 0};
  }

  function generateOrganizedReligions(desiredReligionNumber, lockedReligionCount) {
    const requiredReligionsNumber = desiredReligionNumber - lockedReligionCount;
    if (requiredReligionsNumber < 1) return [];

    const candidateCells = getCandidateCells();
    const religionCores = placeReligions();

    const cultsCount = Math.floor((rand(1, 4) / 10) * religionCores.length); // 10 - 40%
    const heresiesCount = Math.floor((rand(0, 2) / 10) * religionCores.length); // 0 - 20%, was gauss(0,1, 0,3) per organized with expansionism >= 3
    const organizedCount = religionCores.length - cultsCount - heresiesCount;

    const getType = (index) => {
      if (index < organizedCount) return "Organized";
      if (index < organizedCount + cultsCount) return "Cult";
      return "Heresy";
    };

    return religionCores.map((cellId, index) => {
      const type = getType(index);
      const form = rw(forms[type]);
      const cultureId = cells.culture[cellId];

      return {type, form, culture: cultureId, center: cellId};
    });

    function placeReligions() {
      const religionCells = [];
      const religionsTree = d3.quadtree();

      // pre-populate with locked centers
      // TODO

      // min distance between religion inceptions
      const spacing = (graphWidth + graphHeight) / 2 / desiredReligionNumber; // was major gauss(1,0.3, 0.2,2, 2) / 6; cult gauss(2,0.3, 1,3, 2) /6; heresy /60

      for (const cellId of candidateCells) { // was biased random major ^5, cult ^1
        const [x, y] = cells.p[cellId];

        if (religionsTree.find(x, y, spacing) === undefined) {
          religionCells.push(cellId);
          religionsTree.add([x,y]);

          if (religionCells.length === requiredReligionsNumber) return religionCells;
        }
      }

      WARN && console.warn(`Placed only ${religionCells.length} of ${requiredReligionsNumber} religions`);
      return religionCells;
    }

    function getCandidateCells() {
      const validBurgs = pack.burgs.filter(b => b.i && !b.removed);

      if (validBurgs.length >= requiredReligionsNumber)
        return validBurgs.sort((a, b) => b.population - a.population).map(burg => burg.cell);
      return cells.i.filter(i=> cells.s[i] > 2).sort((a, b) => cells.s[b] - cells.s[a]);
    }
  }

  function specifyReligions(newReligions, lockedReligions) {
    const {cells, cultures} = pack;

    const expansionismMap = {
      Folk: () => 0,
      Organized: () => gauss(5, 3, 0, 10, 1), // was rand(3, 8)
      Cult: () => gauss(0.5, 0.5, 0, 5, 1), // was gauss(1.1, 0.5, 0, 5)
      Heresy: () => gauss(1, 0.5, 0, 5, 1) // was gauss(1.2, 0.5, 0, 5)
    };
    const religionOriginsParamsMap = {
      Organized: {clusterSize: 100, maxReligions: 2}, // was 150/count, 2
      Cult: {clusterSize: 50, maxReligions: 3}, // was 300/count, rand(0,4)
      Heresy: {clusterSize: 50, maxReligions: 4}
    };
    
    const rawReligions = newReligions.map(({type, form, culture: cultureId, center}, index) => {
      const supreme = generateDeityName(cultures[cultureId]);
      const deity = form === "Non-theism" || form === "Animism" ? null : supreme;

      const stateId = cells.state[center];

      let {name, expansion} = generateReligionName(form, supreme, center);
      if (expansion === "state" && !stateId) expansion = "global";

      const expansionism = expansionismMap[type]();

      const color = getReligionColor(cultures[cultureId], type);

      return {i: index + 1, name, type, form, culture: cultureId, center, deity, expansion, expansionism, color};
    });

    const religionIds = expandReligions(rawReligions);
    const names = renameOldReligions(rawReligions);
    const origins = defineOrigins(religionIds, rawReligions, cells.c);

    return {religions: combineReligionsData(), religionIds};

    function getReligionColor(culture, type) {
      if (!culture.i) throw new Error(`Culture ${culture.i} is not a valid culture`);

      if (type === "Folk") return culture.color;
      if (type === "Heresy") return getMixedColor(culture.color, 0.35, 0.2);
      if (type === "Cult") return getMixedColor(culture.color, 0.5, 0);
      return getMixedColor(culture.color, 0.25, 0.4);
    }

    function combineReligionsData() {
      const noReligion = {i: 0, name: "No religion"};

      const religions = rawReligions.map((religion, index) => ({
        ...religion,
        name: names[index],
        origins: origins[index]
      }));

      return [noReligion, ...religions];
    }

    // prepend 'Old' to names of folk religions which have organized competitors
    function renameOldReligions(rawReligions) {
      return rawReligions.map(({name, type, culture: cultureId}) => {
        if (type !== "Folk") return name;

        const haveOrganized = rawReligions.some(({type, culture, expansion}) => culture === cultureId && type === "Organized" && expansion === "culture");
        if (haveOrganized && name.slice(0, 3) !== "Old") return `Old ${name}`;
        return name;
      });
    }

    function defineOrigins(religionIds, rawReligions, neighbors) {
      return rawReligions.map(religion => {
        if (religion.type === "Folk") return [0];

        const {i, type, culture: cultureId, expansion, center} = religion;

        const folkReligion = rawReligions.find(({culture, type}) => type === "Folk" && culture === cultureId);
        const isFolkBased = folkReligion && cultureId && expansion === "culture" && each(2)(center); // P(0.5) -> isEven cellId

        if (isFolkBased) return [folkReligion.i];

        const {clusterSize, maxReligions} = religionOriginsParamsMap[type];
        const origins = getReligionsInRadius(neighbors, center, religionIds, i, clusterSize, maxReligions);
        return origins;
      });
    }

    function getReligionsInRadius(neighbors, center, religionIds, religionId, clusterSize, maxReligions) {
      const foundReligions = new Set();
      const queue = [center];
      const checked = {};

      for (let size = 0; queue.length && size < clusterSize; size++) {
        const cellId = queue.pop();
        checked[cellId] = true;

        for (const neibId of neighbors[cellId]) {
          if (checked[neibId]) continue;
          checked[neibId] = true;

          const neibReligion = religionIds[neibId];
          if (neibReligion && neibReligion !== religionId) foundReligions.add(neibReligion);
          queue.push(neibId);
        }
      }

      return foundReligions.size ? [...foundReligions].slice(0, maxReligions) : [0];
    }
  }

/*
    // add folk religions
    cultures.forEach(c => {
      if (!c.i) return religions.push({i: 0, name: "No religion"});

      if (pack.religions) {
        const lockedFolkReligion = pack.religions.find(
          r => r.culture === c.i && !r.removed && r.lock && r.type === "Folk"
        );

        if (lockedFolkReligion) {
          for (const i of cells.i) {
            if (cells.religion[i] === lockedFolkReligion.i) religionIds[i] = newId;
          }

          lockedFolkReligion.i = newId;
          religions.push(lockedFolkReligion);
          return;
        }
      }

    });

    // restore locked non-folk religions
    if (pack.religions) {
      const lockedNonFolkReligions = pack.religions.filter(r => r.lock && !r.removed && r.type !== "Folk");
      for (const religion of lockedNonFolkReligions) {
        const newId = religions.length;
        for (const i of cells.i) {
          if (cells.religion[i] === religion.i) religionIds[i] = newId;
        }

        religion.i = newId;
        religion.origins = religion.origins.filter(origin => origin < newId);
        religionsTree.add(cells.p[religion.center]);
        religions.push(religion);
      }
    }
*/
  // growth algorithm to assign cells to religions
  function expandReligions(religions) {
    const religionIds = spreadFolkReligions(religions);

    const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
    const cost = [];

    const maxExpansionCost = (cells.i.length / 20) * gauss(1, 0.3, 0.2, 2, 2) * neutralInput.value; // limit cost for organized religions growth (was /25)

    const biomePassageCost = (cellId) => biomesData.cost[cells.biome[cellId]];

    religions
      .filter(r => r.i && !r.lock && r.type !== "Folk")
      .forEach(r => {
        religionIds[r.center] = r.i;
        queue.queue({e: r.center, p: 0, r: r.i, s: cells.state[r.center]});
        cost[r.center] = 1;
      });
    
    const religionsMap = new Map(religions.map(r => [r.i, r]));

    const isMainRoad = (cellId) => (cells.road[cellId] - cells.crossroad[cellId]) > 4;
    const isTrail = (cellId) => cells.h > 19 && (cells.road[cellId] - cells.crossroad[cellId]) === 1;
    const isSeaRoute = (cellId) => cells.h < 20 && cells.road;
    const isWater = (cellId) => cells.h < 20;
    // const popCost = d3.max(cells.pop) / 3; // enougth population to spered religion without penalty

    while (queue.length) {
      const {e: cellId, p, r, s: state} = queue.dequeue();
      const {culture, expansion, expansionism} = religionsMap.get(r);

      cells.c[cellId].forEach(nextCell => {
        if (expansion === "culture" && culture !== cells.culture[nextCell]) return;
        if (expansion === "state" && state !== cells.state[nextCell]) return;
        if (religionsMap.get(religionIds[nextCell])?.lock) return;

        const cultureCost = culture !== cells.culture[nextCell] ? 10 : 0;
        const stateCost = state !== cells.state[nextCell] ? 10 : 0;
        const passageCost = getPassageCost(nextCell);
        // const populationCost = Math.max(rn(popCost - cells.pop[nextCell]), 0);
        // const heightCost = Math.max(cells.h[nextCell], 20) - 20;

        const cellCost = cultureCost + stateCost + passageCost;
        const totalCost = p + 10 + cellCost / expansionism;
        if (totalCost > maxExpansionCost) return;

        if (!cost[nextCell] || totalCost < cost[nextCell]) {
          if (cells.culture[nextCell]) religionIds[nextCell] = r; // assign religion to cell
          cost[nextCell] = totalCost;

          queue.queue({e: nextCell, p: totalCost, r, s});
        }
      });
    }

    return religionIds;

    function getPassageCost(cellId) {
      if (isWater(cellId)) return isSeaRoute ? 50 : 500; // was 50 : 1000
      if (isMainRoad(cellId)) return 1;
      const biomeCost = biomePassageCost(cellId);
      return (isTrail(cellId)) ? biomeCost / 1.5 : biomeCost; // was same as main road
    }
  }

  // folk religions initially get all cells of their culture
  function spreadFolkReligions(religions) {
    const religionIds = new Uint16Array(cells.i.length);

    const folkReligions = religions.filter(({type}) => type === "Folk");
    const cultureToReligionMap = new Map(folkReligions.map(({i, culture}) => [culture, i]));

    for (const cellId of cells.i) {
      const cultureId = cells.culture[cellId];
      religionIds[cellId] = cultureToReligionMap.get(cultureId) || 0;
    }

    return religionIds;
  }

    function checkCenters() {
      const codes = religions.map(r => r.code);
      religions.forEach(r => {
        if (!r.i) return;
        r.code = abbreviate(r.name, codes);

        // move religion center if it's not within religion area after expansion
        if (religionIds[r.center] === r.i) return; // in area
        const firstCell = cells.i.find(i => religionIds[i] === r.i);
        if (firstCell) r.center = firstCell; // move center, othervise it's an extinct religion
      });
    }

  const add = function (center) {
    const {cells, religions} = pack;
    const religionId = cells.religion[center];

    const culture = cells.culture[center];
    const color = getMixedColor(religions[religionId].color, 0.3, 0);

    const type =
      religions[religionId].type === "Organized" ? rw({Organized: 4, Cult: 1, Heresy: 2}) : rw({Organized: 5, Cult: 2});
    const form = rw(forms[type]);
    const deity =
      type === "Heresy" ? religions[religionId].deity : form === "Non-theism" ? null : generateDeityName(culture);

    let name, expansion;
    if (type === "Organized") [name, expansion] = generateReligionName(form, deity, center);
    else {
      name = getCultName(form, center);
      expansion = "global";
    }

    const formName = type === "Heresy" ? religions[religionId].form : form;
    const code = abbreviate(
      name,
      religions.map(r => r.code)
    );

    const i = religions.length;
    religions.push({
      i,
      name,
      color,
      culture,
      type,
      form: formName,
      deity,
      expansion,
      expansionism: 0,
      center,
      cells: 0,
      area: 0,
      rural: 0,
      urban: 0,
      origins: [religionId],
      code
    });
    cells.religion[center] = i;
  };

  function updateCultures() {
    pack.religions = pack.religions.map((religion, index) => {
      if (index === 0) return religion;
      return {...religion, culture: pack.cells.culture[religion.center]};
    });
  }

  // get supreme deity name
  const generateDeityName = function (culture) {
    if (culture === undefined) {
      ERROR && console.error("Please define a culture");
      return;
    }
    const meaning = generateMeaning();
    const cultureName = Names.getCulture(culture, null, null, "", 0.8);
    return cultureName + ", The " + meaning;
  };

  function generateMeaning() {
    const a = ra(approaches); // select generation approach
    if (a === "Number") return ra(base.number);
    if (a === "Being") return ra(base.being);
    if (a === "Adjective") return ra(base.adjective);
    if (a === "Color + Animal") return `${ra(base.color)} ${ra(base.animal)}`;
    if (a === "Adjective + Animal") return `${ra(base.adjective)} ${ra(base.animal)}`;
    if (a === "Adjective + Being") return `${ra(base.adjective)} ${ra(base.being)}`;
    if (a === "Adjective + Genitive") return `${ra(base.adjective)} ${ra(base.genitive)}`;
    if (a === "Color + Being") return `${ra(base.color)} ${ra(base.being)}`;
    if (a === "Color + Genitive") return `${ra(base.color)} ${ra(base.genitive)}`;
    if (a === "Being + of + Genitive") return `${ra(base.being)} of ${ra(base.genitive)}`;
    if (a === "Being + of the + Genitive") return `${ra(base.being)} of the ${ra(base.theGenitive)}`;
    if (a === "Animal + of + Genitive") return `${ra(base.animal)} of ${ra(base.genitive)}`;
    if (a === "Adjective + Being + of + Genitive")
      return `${ra(base.adjective)} ${ra(base.being)} of ${ra(base.genitive)}`;
    if (a === "Adjective + Animal + of + Genitive")
      return `${ra(base.adjective)} ${ra(base.animal)} of ${ra(base.genitive)}`;

    ERROR && console.error("Unkown generation approach");
  }

  function generateReligionName(form, deity, center) {
    const {cells, cultures, burgs, states} = pack;

    const random = () => Names.getCulture(cells.culture[center], null, null, "", 0);
    const type = () => rw(types[form]);
    const supreme = () => deity.split(/[ ,]+/)[0];
    const culture = () => cultures[cells.culture[center]].name;
    const place = adj => {
      const burgId = cells.burg[center];
      const stateId = cells.state[center];

      const base = burgId ? burgs[burgId].name : states[stateId].name;
      let name = trimVowels(base.split(/[ ,]+/)[0]);
      return adj ? getAdjective(name) : name;
    };

    const m = rw(namingMethods);
    if (m === "Random + type") return [random() + " " + type(), "global"];
    if (m === "Random + ism") return [trimVowels(random()) + "ism", "global"];
    if (m === "Supreme + ism" && deity) return [trimVowels(supreme()) + "ism", "global"];
    if (m === "Faith of + Supreme" && deity)
      return [ra(["Faith", "Way", "Path", "Word", "Witnesses"]) + " of " + supreme(), "global"];
    if (m === "Place + ism") return [place() + "ism", "state"];
    if (m === "Culture + ism") return [trimVowels(culture()) + "ism", "culture"];
    if (m === "Place + ian + type") return [place("adj") + " " + type(), "state"];
    if (m === "Culture + type") return [culture() + " " + type(), "culture"];
    if (m === "Burg + ian + type") return [`${place("adj")} ${type()}`, "global"];
    if (m === "Random + ian + type") return [`${getAdjective(random())} ${type()}`, "global"];
    if (m === "Type + of the + meaning") return [`${type()} of the ${generateMeaning()}`, "global"];
    return [trimVowels(random()) + "ism", "global"]; // else
  }

  return {generate, add, getDeityName: generateDeityName, updateCultures};
})();
