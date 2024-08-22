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
      "Avatar",
      "Brother",
      "Champion",
      "Chief",
      "Council",
      "Creator",
      "Deity",
      "Divine One",
      "Elder",
      "Enlightened Being",
      "Father",
      "Forebear",
      "Forefather",
      "Giver",
      "God",
      "Goddess",
      "Guardian",
      "Guide",
      "Hierach",
      "Lady",
      "Lord",
      "Maker",
      "Master",
      "Mother",
      "Numen",
      "Oracle",
      "Overlord",
      "Protector",
      "Reaper",
      "Ruler",
      "Sage",
      "Seer",
      "Sister",
      "Spirit",
      "Supreme Being",
      "Transcendent",
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
      "Cerberus",
      "Chimera",
      "Cobra",
      "Cockatrice",
      "Crane",
      "Crocodile",
      "Crow",
      "Cyclope",
      "Deer",
      "Dog",
      "Direwolf",
      "Drake",
      "Dragon",
      "Eagle",
      "Elephant",
      "Elk",
      "Falcon",
      "Fox",
      "Goat",
      "Goose",
      "Gorgon",
      "Gryphon",
      "Hare",
      "Hawk",
      "Heron",
      "Hippogriff",
      "Horse",
      "Hound",
      "Hyena",
      "Ibis",
      "Jackal",
      "Jaguar",
      "Kitsune",
      "Kraken",
      "Lark",
      "Leopard",
      "Lion",
      "Manticore",
      "Mantis",
      "Marten",
      "Minotaur",
      "Moose",
      "Mule",
      "Narwhal",
      "Owl",
      "Ox",
      "Panther",
      "Pegasus",
      "Phoenix",
      "Python",
      "Rat",
      "Raven",
      "Roc",
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
      "Wyvern",
      "Yeti"
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
      "Celestial",
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
      "Ethernal",
      "Empyreal",
      "Enigmatic",
      "Enlightened",
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
      "Illustrious",
      "Immutable",
      "Ineffable",
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
      "Mythical",
      "Mystical",
      "Naval",
      "New",
      "Noble",
      "Old",
      "Otherworldly",
      "Patient",
      "Peaceful",
      "Pregnant",
      "Prime",
      "Proud",
      "Pure",
      "Radiant",
      "Resplendent",
      "Sacred",
      "Sacrosanct",
      "Sad",
      "Scary",
      "Secret",
      "Selected",
      "Serene",
      "Severe",
      "Silent",
      "Sleeping",
      "Slumbering",
      "Sovereign",
      "Strong",
      "Sunny",
      "Superior",
      "Supernatural",
      "Sustainable",
      "Transcendent",
      "Transcendental",
      "Troubled",
      "Unearthly",
      "Unfathomable",
      "Unhappy",
      "Unknown",
      "Unseen",
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
      "Bronze",
      "Brown",
      "Coral",
      "Crimson",
      "Dark",
      "Emerald",
      "Golden",
      "Green",
      "Grey",
      "Indigo",
      "Lavender",
      "Light",
      "Magenta",
      "Maroon",
      "Orange",
      "Pink",
      "Plum",
      "Purple",
      "Red",
      "Ruby",
      "Sapphire",
      "Teal",
      "Turquoise",
      "White",
      "Yellow"
    ]
  };

  const forms = {
    Folk: {
      Shamanism: 4,
      Animism: 4,
      Polytheism: 4,
      "Ancestor Worship": 2,
      "Nature Worship": 1,
      Totemism: 1
    },
    Organized: {
      Polytheism: 7,
      Monotheism: 7,
      Dualism: 3,
      Pantheism: 2,
      "Non-theism": 2
    },
    Cult: {
      Cult: 5,
      "Dark Cult": 5,
      Sect: 1
    },
    Heresy: {
      Heresy: 1
    }
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
    Shamanism: {Beliefs: 3, Shamanism: 2, Druidism: 1, Spirits: 1},
    Animism: {Spirits: 3, Beliefs: 1},
    Polytheism: {Deities: 3, Faith: 1, Gods: 1, Pantheon: 1},
    "Ancestor Worship": {Beliefs: 1, Forefathers: 2, Ancestors: 2},
    "Nature Worship": {Beliefs: 3, Druids: 1},
    Totemism: {Beliefs: 2, Totems: 2, Idols: 1},

    Monotheism: {Religion: 2, Church: 3, Faith: 1},
    Dualism: {Religion: 3, Faith: 1, Cult: 1},
    Pantheism: {Religion: 1, Faith: 1},
    "Non-theism": {Beliefs: 3, Spirits: 1},

    Cult: {Cult: 4, Sect: 2, Arcanum: 1, Order: 1, Worship: 1},
    "Dark Cult": {Cult: 2, Blasphemy: 1, Circle: 1, Coven: 1, Idols: 1, Occultism: 1},
    Sect: {Sect: 3, Society: 1},

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

  const expansionismMap = {
    Folk: () => 0,
    Organized: () => gauss(5, 3, 0, 10, 1),
    Cult: () => gauss(0.5, 0.5, 0, 5, 1),
    Heresy: () => gauss(1, 0.5, 0, 5, 1)
  };

  function generate() {
    TIME && console.time("generateReligions");
    const lockedReligions = pack.religions?.filter(r => r.i && r.lock && !r.removed) || [];

    const folkReligions = generateFolkReligions();
    const organizedReligions = generateOrganizedReligions(+religionsNumber.value, lockedReligions);

    const namedReligions = specifyReligions([...folkReligions, ...organizedReligions]);
    const indexedReligions = combineReligions(namedReligions, lockedReligions);
    const religionIds = expandReligions(indexedReligions);
    const religions = defineOrigins(religionIds, indexedReligions);

    pack.religions = religions;
    pack.cells.religion = religionIds;

    checkCenters();

    TIME && console.timeEnd("generateReligions");
  }

  function generateFolkReligions() {
    return pack.cultures
      .filter(c => c.i && !c.removed)
      .map(culture => ({type: "Folk", form: rw(forms.Folk), culture: culture.i, center: culture.center}));
  }

  function generateOrganizedReligions(desiredReligionNumber, lockedReligions) {
    const cells = pack.cells;
    const lockedReligionCount = lockedReligions.filter(({type}) => type !== "Folk").length || 0;
    const requiredReligionsNumber = desiredReligionNumber - lockedReligionCount;
    if (requiredReligionsNumber < 1) return [];

    const candidateCells = getCandidateCells();
    const religionCores = placeReligions();

    const cultsCount = Math.floor((rand(1, 4) / 10) * religionCores.length); // 10-40%
    const heresiesCount = Math.floor((rand(0, 3) / 10) * religionCores.length); // 0-30%
    const organizedCount = religionCores.length - cultsCount - heresiesCount;

    const getType = index => {
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
      lockedReligions.forEach(({center}) => religionsTree.add(cells.p[center]));

      // min distance between religion inceptions
      const spacing = (graphWidth + graphHeight) / 2 / desiredReligionNumber;

      for (const cellId of candidateCells) {
        const [x, y] = cells.p[cellId];

        if (religionsTree.find(x, y, spacing) === undefined) {
          religionCells.push(cellId);
          religionsTree.add([x, y]);

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
      return cells.i.filter(i => cells.s[i] > 2).sort((a, b) => cells.s[b] - cells.s[a]);
    }
  }

  function specifyReligions(newReligions) {
    const {cells, cultures} = pack;

    const rawReligions = newReligions.map(({type, form, culture: cultureId, center}) => {
      const supreme = getDeityName(cultureId);
      const deity = form === "Non-theism" || form === "Animism" ? null : supreme;

      const stateId = cells.state[center];

      let [name, expansion] = generateReligionName(type, form, supreme, center);
      if (expansion === "state" && !stateId) expansion = "global";

      const expansionism = expansionismMap[type]();
      const color = getReligionColor(cultures[cultureId], type);

      return {name, type, form, culture: cultureId, center, deity, expansion, expansionism, color};
    });

    return rawReligions;

    function getReligionColor(culture, type) {
      if (!culture.i) return getRandomColor();

      if (type === "Folk") return culture.color;
      if (type === "Heresy") return getMixedColor(culture.color, 0.35, 0.2);
      if (type === "Cult") return getMixedColor(culture.color, 0.5, 0);
      return getMixedColor(culture.color, 0.25, 0.4);
    }
  }

  // indexes, conditionally renames, and abbreviates religions
  function combineReligions(namedReligions, lockedReligions) {
    const indexedReligions = [{name: "No religion", i: 0}];

    const {lockedReligionQueue, highestLockedIndex, codes, numberLockedFolk} = parseLockedReligions();
    const maxIndex = Math.max(
      highestLockedIndex,
      namedReligions.length + lockedReligions.length + 1 - numberLockedFolk
    );

    for (let index = 1, progress = 0; index < maxIndex; index = indexedReligions.length) {
      // place locked religion back at its old index
      if (index === lockedReligionQueue[0]?.i) {
        const nextReligion = lockedReligionQueue.shift();
        indexedReligions.push(nextReligion);
        continue;
      }

      // slot the new religions
      if (progress < namedReligions.length) {
        const nextReligion = namedReligions[progress];
        progress++;

        if (
          nextReligion.type === "Folk" &&
          lockedReligions.some(({type, culture}) => type === "Folk" && culture === nextReligion.culture)
        )
          continue; // when there is a locked Folk religion for this culture discard duplicate

        const newName = renameOld(nextReligion);
        const code = abbreviate(newName, codes);
        codes.push(code);
        indexedReligions.push({...nextReligion, i: index, name: newName, code});
        continue;
      }

      indexedReligions.push({i: index, type: "Folk", culture: 0, name: "Removed religion", removed: true});
    }
    return indexedReligions;

    function parseLockedReligions() {
      // copy and sort the locked religions list
      const lockedReligionQueue = lockedReligions
        .map(religion => {
          // and filter their origins to locked religions
          let newOrigin = religion.origins.filter(n => lockedReligions.some(({i: index}) => index === n));
          if (newOrigin === []) newOrigin = [0];
          return {...religion, origins: newOrigin};
        })
        .sort((a, b) => a.i - b.i);

      const highestLockedIndex = Math.max(...lockedReligions.map(r => r.i));
      const codes = lockedReligions.length > 0 ? lockedReligions.map(r => r.code) : [];
      const numberLockedFolk = lockedReligions.filter(({type}) => type === "Folk").length;

      return {lockedReligionQueue, highestLockedIndex, codes, numberLockedFolk};
    }

    // prepend 'Old' to names of folk religions which have organized competitors
    function renameOld({name, type, culture: cultureId}) {
      if (type !== "Folk") return name;

      const haveOrganized =
        namedReligions.some(
          ({type, culture, expansion}) => culture === cultureId && type === "Organized" && expansion === "culture"
        ) ||
        lockedReligions.some(
          ({type, culture, expansion}) => culture === cultureId && type === "Organized" && expansion === "culture"
        );
      if (haveOrganized && name.slice(0, 3) !== "Old") return `Old ${name}`;
      return name;
    }
  }

  // finally generate and stores origins trees
  function defineOrigins(religionIds, indexedReligions) {
    const religionOriginsParamsMap = {
      Organized: {clusterSize: 100, maxReligions: 2},
      Cult: {clusterSize: 50, maxReligions: 3},
      Heresy: {clusterSize: 50, maxReligions: 4}
    };

    const origins = indexedReligions.map(({i, type, culture: cultureId, expansion, center}) => {
      if (i === 0) return null; // no religion
      if (type === "Folk") return [0]; // folk religions originate from its parent culture only

      const folkReligion = indexedReligions.find(({culture, type}) => type === "Folk" && culture === cultureId);
      const isFolkBased = folkReligion && cultureId && expansion === "culture" && each(2)(center);
      if (isFolkBased) return [folkReligion.i];

      const {clusterSize, maxReligions} = religionOriginsParamsMap[type];
      const fallbackOrigin = folkReligion?.i || 0;
      return getReligionsInRadius(pack.cells.c, center, religionIds, i, clusterSize, maxReligions, fallbackOrigin);
    });

    return indexedReligions.map((religion, index) => ({...religion, origins: origins[index]}));
  }

  function getReligionsInRadius(neighbors, center, religionIds, religionId, clusterSize, maxReligions, fallbackOrigin) {
    const foundReligions = new Set();
    const queue = [center];
    const checked = {};

    for (let size = 0; queue.length && size < clusterSize; size++) {
      const cellId = queue.shift();
      checked[cellId] = true;

      for (const neibId of neighbors[cellId]) {
        if (checked[neibId]) continue;
        checked[neibId] = true;

        const neibReligion = religionIds[neibId];
        if (neibReligion && neibReligion < religionId) foundReligions.add(neibReligion);
        if (foundReligions.size >= maxReligions) return [...foundReligions];
        queue.push(neibId);
      }
    }

    return foundReligions.size ? [...foundReligions] : [fallbackOrigin];
  }

  // growth algorithm to assign cells to religions
  function expandReligions(religions) {
    const {cells, routes} = pack;
    const religionIds = spreadFolkReligions(religions);

    const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
    const cost = [];

    // limit cost for organized religions growth
    const maxExpansionCost = (cells.i.length / 20) * byId("growthRate").valueAsNumber;

    religions
      .filter(r => r.i && !r.lock && r.type !== "Folk" && !r.removed)
      .forEach(r => {
        religionIds[r.center] = r.i;
        queue.queue({e: r.center, p: 0, r: r.i, s: cells.state[r.center]});
        cost[r.center] = 1;
      });

    const religionsMap = new Map(religions.map(r => [r.i, r]));

    while (queue.length) {
      const {e: cellId, p, r, s: state} = queue.dequeue();
      const {culture, expansion, expansionism} = religionsMap.get(r);

      cells.c[cellId].forEach(nextCell => {
        if (expansion === "culture" && culture !== cells.culture[nextCell]) return;
        if (expansion === "state" && state !== cells.state[nextCell]) return;
        if (religionsMap.get(religionIds[nextCell])?.lock) return;

        const cultureCost = culture !== cells.culture[nextCell] ? 10 : 0;
        const stateCost = state !== cells.state[nextCell] ? 10 : 0;
        const passageCost = getPassageCost(cellId, nextCell);

        const cellCost = cultureCost + stateCost + passageCost;
        const totalCost = p + 10 + cellCost / expansionism;
        if (totalCost > maxExpansionCost) return;

        if (!cost[nextCell] || totalCost < cost[nextCell]) {
          if (cells.culture[nextCell]) religionIds[nextCell] = r; // assign religion to cell
          cost[nextCell] = totalCost;

          queue.queue({e: nextCell, p: totalCost, r, s: state});
        }
      });
    }

    return religionIds;

    function getPassageCost(cellId, nextCellId) {
      const route = Routes.getRoute(cellId, nextCellId);
      if (isWater(cellId)) return route ? 50 : 500;

      const biomePassageCost = biomesData.cost[cells.biome[nextCellId]];

      if (route) {
        if (route.group === "roads") return 1;
        return biomePassageCost / 3; // trails and other routes
      }

      return biomePassageCost;
    }
  }

  // folk religions initially get all cells of their culture, and locked religions are retained
  function spreadFolkReligions(religions) {
    const cells = pack.cells;
    const hasPrior = cells.religion && true;
    const religionIds = new Uint16Array(cells.i.length);

    const folkReligions = religions.filter(religion => religion.type === "Folk" && !religion.removed);
    const cultureToReligionMap = new Map(folkReligions.map(({i, culture}) => [culture, i]));

    for (const cellId of cells.i) {
      const oldId = (hasPrior && cells.religion[cellId]) || 0;
      if (oldId && religions[oldId]?.lock && !religions[oldId]?.removed) {
        religionIds[cellId] = oldId;
        continue;
      }
      const cultureId = cells.culture[cellId];
      religionIds[cellId] = cultureToReligionMap.get(cultureId) || 0;
    }

    return religionIds;
  }

  function checkCenters() {
    const cells = pack.cells;
    pack.religions.forEach(r => {
      if (!r.i) return;
      // move religion center if it's not within religion area after expansion
      if (cells.religion[r.center] === r.i) return; // in area
      const firstCell = cells.i.find(i => cells.religion[i] === r.i);
      const cultureHome = pack.cultures[r.culture]?.center;
      if (firstCell) r.center = firstCell; // move center, othervise it's an extinct religion
      else if (r.type === "Folk" && cultureHome) r.center = cultureHome; // reset extinct culture centers
    });
  }

  function recalculate() {
    const newReligionIds = expandReligions(pack.religions);
    pack.cells.religion = newReligionIds;

    checkCenters();
  }

  const add = function (center) {
    const {cells, cultures, religions} = pack;
    const religionId = cells.religion[center];
    const i = religions.length;

    const cultureId = cells.culture[center];
    const missingFolk =
      cultureId !== 0 &&
      !religions.some(({type, culture, removed}) => type === "Folk" && culture === cultureId && !removed);
    const color = missingFolk ? cultures[cultureId].color : getMixedColor(religions[religionId].color, 0.3, 0);

    const type = missingFolk
      ? "Folk"
      : religions[religionId].type === "Organized"
      ? rw({Organized: 4, Cult: 1, Heresy: 2})
      : rw({Organized: 5, Cult: 2});
    const form = rw(forms[type]);
    const deity =
      type === "Heresy"
        ? religions[religionId].deity
        : form === "Non-theism" || form === "Animism"
        ? null
        : getDeityName(cultureId);

    const [name, expansion] = generateReligionName(type, form, deity, center);

    const formName = type === "Heresy" ? religions[religionId].form : form;
    const code = abbreviate(
      name,
      religions.map(r => r.code)
    );
    const influences = getReligionsInRadius(cells.c, center, cells.religion, i, 25, 3, 0);
    const origins = type === "Folk" ? [0] : influences;

    religions.push({
      i,
      name,
      color,
      culture: cultureId,
      type,
      form: formName,
      deity,
      expansion,
      expansionism: expansionismMap[type](),
      center,
      cells: 0,
      area: 0,
      rural: 0,
      urban: 0,
      origins,
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
  const getDeityName = function (culture) {
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

  function generateReligionName(variety, form, deity, center) {
    const {cells, cultures, burgs, states} = pack;

    const random = () => Names.getCulture(cells.culture[center], null, null, "", 0);
    const type = rw(types[form]);
    const supreme = deity.split(/[ ,]+/)[0];
    const culture = cultures[cells.culture[center]].name;

    const place = adj => {
      const burgId = cells.burg[center];
      const stateId = cells.state[center];

      const base = burgId ? burgs[burgId].name : states[stateId].name;
      let name = trimVowels(base.split(/[ ,]+/)[0]);
      return adj ? getAdjective(name) : name;
    };

    const m = rw(namingMethods[variety]);
    if (m === "Random + type") return [random() + " " + type, "global"];
    if (m === "Random + ism") return [trimVowels(random()) + "ism", "global"];
    if (m === "Supreme + ism" && deity) return [trimVowels(supreme) + "ism", "global"];
    if (m === "Faith of + Supreme" && deity)
      return [ra(["Faith", "Way", "Path", "Word", "Witnesses"]) + " of " + supreme, "global"];
    if (m === "Place + ism") return [place() + "ism", "state"];
    if (m === "Culture + ism") return [trimVowels(culture) + "ism", "culture"];
    if (m === "Place + ian + type") return [place("adj") + " " + type, "state"];
    if (m === "Culture + type") return [culture + " " + type, "culture"];
    if (m === "Burg + ian + type") return [`${place("adj")} ${type}`, "global"];
    if (m === "Random + ian + type") return [`${getAdjective(random())} ${type}`, "global"];
    if (m === "Type + of the + meaning") return [`${type} of the ${generateMeaning()}`, "global"];
    return [trimVowels(random()) + "ism", "global"]; // else
  }

  return {generate, add, getDeityName, updateCultures, recalculate};
})();
