"use strict";

window.Markers = (function () {
  let config = [];
  let occupied = [];

  function getDefaultConfig() {
    const culturesSet = document.getElementById("culturesSet").value;
    const isFantasy = culturesSet.includes("Fantasy");

    /*
      Default markers config:
      type - short description (snake-case)
      icon - unicode character, make sure it's supported by most of the browsers. Source: emojipedia.org
      dx: icon offset in x direction, in pixels
      dy: icon offset in y direction, in pixels
      min: minimum number of candidates to add at least 1 marker
      each: how many of the candidates should be added as markers
      multiplier: multiply markers quantity to add
      list: function to select candidates
      add: function to add marker legend
    */
    // prettier-ignore
    return [
      {type: "volcanoes", icon: "🌋", dx: 52, px: 13, min: 10, each: 500, multiplier: 1, list: listVolcanoes, add: addVolcano},
      {type: "hot-springs", icon: "♨️", dy: 52, min: 30, each: 1200, multiplier: 1, list: listHotSprings, add: addHotSpring},
      {type: "mines", icon: "⛏️", dx: 48, px: 13, min: 1, each: 15, multiplier: 1, list: listMines, add: addMine},
      {type: "bridges", icon: "🌉", px: 14, min: 1, each: 5, multiplier: 1, list: listBridges, add: addBridge},
      {type: "inns", icon: "🍻", px: 14, min: 1, each: 100, multiplier: 1, list: listInns, add: addInn},
      {type: "lighthouses", icon: "🚨", px: 14, min: 1, each: 2, multiplier: 1, list: listLighthouses, add: addLighthouse},
      {type: "waterfalls", icon: "⟱", dy: 54, px: 16, min: 1, each: 5, multiplier: 1, list: listWaterfalls, add: addWaterfall},
      {type: "battlefields", icon: "⚔️", dy: 52, min: 50, each: 700, multiplier: 1, list: listBattlefields, add: addBattlefield},
      {type: "dungeons", icon: "🗝️", dy: 51, px: 13, min: 30, each: 200, multiplier: 1, list: listDungeons, add: addDungeon},
      {type: "lake-monsters", icon: "🐉", dy: 48, min: 2, each: 10, multiplier: 1, list: listLakeMonsters, add: addLakeMonster},
      {type: "sea-monsters", icon: "🦑", min: 50, each: 700, multiplier: 1, list: listSeaMonsters, add: addSeaMonster},
      {type: "hill-monsters", icon: "👹", dy: 54, px: 13, min: 30, each: 600, multiplier: 1, list: listHillMonsters, add: addHillMonster},
      {type: "sacred-mountains", icon: "🗻", dy: 48, min: 1, each: 5, multiplier: 1, list: listSacredMountains, add: addSacredMountain},
      {type: "sacred-forests", icon: "🌳", min: 30, each: 1000, multiplier: 1, list: listSacredForests, add: addSacredForest},
      {type: "sacred-pineries", icon: "🌲", px: 13, min: 30, each: 800, multiplier: 1, list: listSacredPineries, add: addSacredPinery},
      {type: "sacred-palm-groves", icon: "🌴", px: 13, min: 1, each: 100, multiplier: 1, list: listSacredPalmGroves, add: addSacredPalmGrove},
      {type: "brigands", icon: "💰", px: 13, min: 50, each: 100, multiplier: 1, list: listBrigands, add: addBrigands},
      {type: "pirates", icon: "🏴‍☠️", dx: 51, min: 40, each: 300, multiplier: 1, list: listPirates, add: addPirates},
      {type: "statues", icon: "🗿", min: 80, each: 1200, multiplier: 1, list: listStatues, add: addStatue},
      {type: "ruins", icon: "🏺", min: 80, each: 1200, multiplier: 1, list: listRuins, add: addRuins},
      {type: "circuses", icon: "🎪", min: 80, each: 1000, multiplier: 1, list: listCircuses, add: addCircuses},
      {type: "jousts", icon: "🤺", dx: 48, min: 5, each: 500, multiplier: 1, list: listJousts, add: addJousts},
      {type: "canoes", icon: "🛶", min: 1000, each: 2000, multiplier: 1, list: listCanoes, add: addCanoes},
      {type: "migration", icon: "🐗", min: 20, each: 1000, multiplier: 1, list: listMigrations, add: addMigrations},
      {type: "dances", icon: "💃🏽", min: 5, each: 60, multiplier: 1, list: listDances, add: addDances},
      {type: "mirage", icon: "💦", min: 10, each: 400, multiplier: 1, list: listMirage, add: addMirage},
      {type: "caves", icon:"🦇", min: 60, each: 1000, multiplier: 1, list: listCaves, add: addCaves},
      {type: "portals", icon: "🌀", px: 14, min: 16, each: 8, multiplier: +isFantasy, list: listPortals, add: addPortal},
      {type: "rifts", icon: "🎆", min: 1, each: 3000, multiplier: +isFantasy, list: listRifts, add: addRifts}
    ];
  }

  const getConfig = () => config;

  const setConfig = newConfig => {
    config = newConfig;
  };

  const generate = function () {
    setConfig(getDefaultConfig());
    pack.markers = [];
    generateTypes();
  };

  const regenerate = requestedMultiplier => {
    if (requestedMultiplier === 0) return;
    if (requestedMultiplier) multiplier = requestedMultiplier;
    generateTypes();
  };

  const generateTypes = () => {
    TIME && console.time("addMarkers");

    const culturesSet = document.getElementById("culturesSet").value;
    // TODO: don't put multiple markers to the same cell

    addVolcanoes();
    addHotSprings();
    addMines();
    addBridges();
    addInns();
    addLighthouses();
    addWaterfalls();
    addBattlefields();
    addDungeons();
    addLakeMonsters();
    addSeaMonsters();
    addHillMonsters();
    addSacredMountains();
    addSacredForests();
    addSacredPineries();
    addSacredPalmGroves();
    addBrigands();
    addPirates();
    addStatues();
    addRuines();
    if (culturesSet.includes("Fantasy")) addPortals();

    TIME && console.timeEnd("addMarkers");
  };

  const getQuantity = (array, min, each) => {
    if (!array.length || array.length < min / multiplier) return 0;
    const requestQty = Math.ceil((array.length / each) * multiplier);
    return array.length < requestQty ? array.length : requestQty;
  };

  const extractAnyElement = array => {
    const index = Math.floor(Math.random() * array.length);
    return array.splice(index, 1);
  };

  const getMarkerCoordinates = cell => {
    const {cells, burgs} = pack;
    const burgId = cells.burg[cell];

    if (burgId) {
      const {x, y} = burgs[burgId];
      return [x, y];
    }

    return cells.p[cell];
  };

<<<<<<< HEAD
  function addVolcanoes() {
=======
  function addMarker({cell, type, icon, dx, dy, px}) {
    const i = last(pack.markers)?.i + 1 || 0;
    const [x, y] = getMarkerCoordinates(cell);
    const marker = {i, icon, type, x, y, cell};
    if (dx) marker.dx = dx;
    if (dy) marker.dy = dy;
    if (px) marker.px = px;
    pack.markers.push(marker);
    occupied[cell] = true;
    return "marker" + i;
  }

  function addVolcanoes(type, icon, multiplier) {
>>>>>>> c152c2ed (ensure marker id is unique)
    const {cells} = pack;

    let mountains = Array.from(cells.i.filter(i => cells.h[i] >= 70).sort((a, b) => cells.h[b] - cells.h[a]));
    let quantity = getQuantity(mountains, 10, 300);
    if (!quantity) return;
    const highestMountains = mountains.slice(0, 20);

    while (quantity) {
      const [cell] = extractAnyElement(highestMountains);
      const id = addMarker({cell, icon: "🌋", type: "volcano", dx: 52, px: 13});
      const proper = Names.getCulture(cells.culture[cell]);
      const name = P(0.3) ? "Mount " + proper : Math.random() > 0.3 ? proper + " Volcano" : proper;
      notes.push({id, name, legend: `Active volcano. Height: ${getFriendlyHeight(cells.p[cell])}`});
      quantity--;
    }
  }

  function addHotSprings() {
    const {cells} = pack;

    let springs = Array.from(cells.i.filter(i => cells.h[i] > 50).sort((a, b) => cells.h[b] - cells.h[a]));
    let quantity = getQuantity(springs, 30, 800);
    if (!quantity) return;
    const highestSprings = springs.slice(0, 40);

    while (quantity) {
      const [cell] = extractAnyElement(highestSprings);
      const id = addMarker({cell, icon: "♨️", type: "hot_springs", dy: 52});
      const proper = Names.getCulture(cells.culture[cell]);
      const temp = convertTemperature(gauss(35, 15, 20, 100));
      notes.push({id, name: proper + " Hot Springs", legend: `A hot springs area. Average temperature: ${temp}`});
      quantity--;
    }
  }

  function addMines() {
    const {cells} = pack;

    let hillyBurgs = Array.from(cells.i.filter(i => cells.h[i] > 47 && cells.burg[i]));
    let quantity = getQuantity(hillyBurgs, 1, 15);
    if (!quantity) return;

    const resources = {salt: 5, gold: 2, silver: 4, copper: 2, iron: 3, lead: 1, tin: 1};

    while (quantity && hillyBurgs.length) {
      const [cell] = extractAnyElement(hillyBurgs);
      const id = addMarker({cell, icon: "⛏️", type: "mine", dx: 48, px: 13});
      const resource = rw(resources);
      const burg = pack.burgs[cells.burg[cell]];
      const name = `${burg.name} — ${resource} mining town`;
      const population = rn(burg.population * populationRate * urbanization);
      const legend = `${burg.name} is a mining town of ${population} people just nearby the ${resource} mine`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addBridges() {
    const {cells, burgs} = pack;

    const meanFlux = d3.mean(cells.fl.filter(fl => fl));
    return cells.i.filter(
      i =>
        !occupied[i] &&
        cells.burg[i] &&
        cells.t[i] !== 1 &&
        burgs[cells.burg[i]].population > 20 &&
        cells.r[i] &&
        cells.fl[i] > meanFlux
    );
    let quantity = getQuantity(bridges, 1, 5);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(bridges);
      const id = addMarker({cell, icon: "🌉", type: "bridge", px: 14});
      const burg = pack.burgs[cells.burg[cell]];
      const river = pack.rivers.find(r => r.i === pack.cells.r[cell]);
      const riverName = river ? `${river.name} ${river.type}` : "river";
      const name = river && P(0.2) ? river.name : burg.name;
      notes.push({id, name: `${name} Bridge`, legend: `A stone bridge over the ${riverName} near ${burg.name}`});
      quantity--;
    }
  }

  function addInns() {
    const {cells} = pack;

    let taverns = Array.from(cells.i.filter(i => cells.h[i] >= 20 && cells.road[i] > 4 && cells.pop[i] > 10));
    let quantity = getQuantity(taverns, 1, 100);
    if (!quantity) return;

    const colors = [
      "Dark",
      "Light",
      "Bright",
      "Golden",
      "White",
      "Black",
      "Red",
      "Pink",
      "Purple",
      "Blue",
      "Green",
      "Yellow",
      "Amber",
      "Orange",
      "Brown",
      "Grey"
    ];
    const animals = [
      "Antelope",
      "Ape",
      "Badger",
      "Bear",
      "Beaver",
      "Bison",
      "Boar",
      "Buffalo",
      "Cat",
      "Crane",
      "Crocodile",
      "Crow",
      "Deer",
      "Dog",
      "Eagle",
      "Elk",
      "Fox",
      "Goat",
      "Goose",
      "Hare",
      "Hawk",
      "Heron",
      "Horse",
      "Hyena",
      "Ibis",
      "Jackal",
      "Jaguar",
      "Lark",
      "Leopard",
      "Lion",
      "Mantis",
      "Marten",
      "Moose",
      "Mule",
      "Narwhal",
      "Owl",
      "Panther",
      "Rat",
      "Raven",
      "Rook",
      "Scorpion",
      "Shark",
      "Sheep",
      "Snake",
      "Spider",
      "Swan",
      "Tiger",
      "Turtle",
      "Wolf",
      "Wolverine",
      "Camel",
      "Falcon",
      "Hound",
      "Ox"
    ];
    const adjectives = [
      "New",
      "Good",
      "High",
      "Old",
      "Great",
      "Big",
      "Major",
      "Happy",
      "Main",
      "Huge",
      "Far",
      "Beautiful",
      "Fair",
      "Prime",
      "Ancient",
      "Golden",
      "Proud",
      "Lucky",
      "Fat",
      "Honest",
      "Giant",
      "Distant",
      "Friendly",
      "Loud",
      "Hungry",
      "Magical",
      "Superior",
      "Peaceful",
      "Frozen",
      "Divine",
      "Favorable",
      "Brave",
      "Sunny",
      "Flying"
    ];
    const methods = [
      "Boiled",
      "Grilled",
      "Roasted",
      "Spit-roasted",
      "Stewed",
      "Stuffed",
      "Jugged",
      "Mashed",
      "Baked",
      "Braised",
      "Poached",
      "Marinated",
      "Pickled",
      "Smoked",
      "Dried",
      "Dry-aged",
      "Corned",
      "Fried",
      "Pan-fried",
      "Deep-fried",
      "Dressed",
      "Steamed",
      "Cured",
      "Syrupped",
      "Flame-Broiled"
    ];
    const courses = [
      "beef",
      "pork",
      "bacon",
      "chicken",
      "lamb",
      "chevon",
      "hare",
      "rabbit",
      "hart",
      "deer",
      "antlers",
      "bear",
      "buffalo",
      "badger",
      "beaver",
      "turkey",
      "pheasant",
      "duck",
      "goose",
      "teal",
      "quail",
      "pigeon",
      "seal",
      "carp",
      "bass",
      "pike",
      "catfish",
      "sturgeon",
      "escallop",
      "pie",
      "cake",
      "pottage",
      "pudding",
      "onions",
      "carrot",
      "potato",
      "beet",
      "garlic",
      "cabbage",
      "eggplant",
      "eggs",
      "broccoli",
      "zucchini",
      "pepper",
      "olives",
      "pumpkin",
      "spinach",
      "peas",
      "chickpea",
      "beans",
      "rice",
      "pasta",
      "bread",
      "apples",
      "peaches",
      "pears",
      "melon",
      "oranges",
      "mango",
      "tomatoes",
      "cheese",
      "corn",
      "rat tails",
      "pig ears"
    ];
    const types = [
      "hot",
      "cold",
      "fire",
      "ice",
      "smoky",
      "misty",
      "shiny",
      "sweet",
      "bitter",
      "salty",
      "sour",
      "sparkling",
      "smelly"
    ];
    const drinks = [
      "wine",
      "brandy",
      "gin",
      "whisky",
      "rom",
      "beer",
      "cider",
      "mead",
      "liquor",
      "spirits",
      "vodka",
      "tequila",
      "absinthe",
      "nectar",
      "milk",
      "kvass",
      "kumis",
      "tea",
      "water",
      "juice",
      "sap"
    ];

    while (quantity) {
      const [cell] = extractAnyElement(taverns);
      const id = addMarker({cell, icon: "🍻", type: "inn", px: 14});
      const type = P(0.3) ? "inn" : "tavern";
      const isAnimalThemed = P(0.7);
      const animal = ra(animals);
      const name = isAnimalThemed ? (P(0.6) ? ra(colors) + " " + animal : ra(adjectives) + " " + animal) : ra(adjectives) + " " + capitalize(type);
      const meal = isAnimalThemed && P(0.3) ? animal : ra(courses);
      const course = `${ra(methods)} ${meal}`.toLowerCase();
      const drink = `${P(0.5) ? ra(types) : ra(colors)} ${ra(drinks)}`.toLowerCase();
      const legend = `A big and famous roadside ${type}. Delicious ${course} with ${drink} is served here`;
      notes.push({id, name: "The " + name, legend});
      quantity--;
    }
  }

  function addLighthouses() {
    const {cells} = pack;

    const lighthouses = Array.from(cells.i.filter(i => cells.harbor[i] > 6 && cells.c[i].some(c => cells.h[c] < 20 && cells.road[c])));
    let quantity = getQuantity(lighthouses, 1, 2);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(lighthouses);
      const id = addMarker({cell, icon: "🚨", type: "lighthouse", px: 14});
      const proper = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name : Names.getCulture(cells.culture[cell]);
      notes.push({id, name: getAdjective(proper) + " Lighthouse" + name, legend: `A lighthouse to keep the navigation safe`});
      quantity--;
    }
  }

  function addWaterfalls() {
    const {cells} = pack;

    const waterfalls = Array.from(cells.i.filter(i => cells.r[i] && cells.h[i] >= 50 && cells.c[i].some(c => cells.h[c] < 40 && cells.r[c])));
    const quantity = getQuantity(waterfalls, 1, 5);
    if (!quantity) return;

    for (let i = 0; i < waterfalls.length && i < quantity; i++) {
      const cell = waterfalls[i];
      const id = addMarker({cell, icon: "⟱", type: "waterfall", dy: 54, px: 16});
      const proper = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name : Names.getCulture(cells.culture[cell]);
      notes.push({id, name: getAdjective(proper) + " Waterfall" + name, legend: `An extremely beautiful waterfall`});
    }
  }

  function addBattlefields() {
    const {cells, states} = pack;

    let battlefields = Array.from(cells.i.filter(i => cells.state[i] && cells.pop[i] > 2 && cells.h[i] < 50 && cells.h[i] > 25));
    let quantity = getQuantity(battlefields, 50, 700);
    if (!quantity) return;

    while (quantity && battlefields.length) {
      const [cell] = extractAnyElement(battlefields);
      const id = addMarker({cell, icon: "⚔️", type: "battlefield", dy: 52});
      const campaign = ra(states[cells.state[cell]].campaigns);
      const date = generateDate(campaign.start, campaign.end);
      const name = Names.getCulture(cells.culture[cell]) + " Battlefield";
      const legend = `A historical battle of the ${campaign.name}. \r\nDate: ${date} ${options.era}`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addDungeons() {
    const {cells} = pack;

    let dungeons = Array.from(cells.i.filter(i => cells.pop[i] && cells.pop[i] < 3));
    let quantity = getQuantity(dungeons, 30, 200);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(dungeons);
      const id = addMarker({cell, icon: "🗝️", type: "dungeon", dy: 51, px: 13});

      const dungeonSeed = `${seed}${cell}`;
      const name = "Dungeon";
      const legend = `<div>Undiscovered dungeon. See <a href="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" target="_blank">One page dungeon</a></div><iframe style="height: 33vh" src="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" sandbox="allow-scripts allow-same-origin"></iframe>`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addLakeMonsters() {
    const {features} = pack;

    const lakes = features.filter(feature => feature.type === "lake" && feature.group === "freshwater");
    let quantity = getQuantity(lakes, 2, 10);
    if (!quantity) return;

    while (quantity) {
      const [lake] = extractAnyElement(lakes);
      const cell = lake.firstCell;
      const id = addMarker({cell, icon: "🐉", type: "lake_monster", dy: 48});
      const name = `${lake.name} Monster`;
      const length = gauss(10, 5, 5, 100);
      const legend = `Rumors said a relic monster of ${length} ${heightUnit.value} long inhabits ${lake.name} Lake. Truth or lie, but folks are affraid to fish in the lake`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addSeaMonsters() {
    const {cells, features} = pack;

    const sea = Array.from(cells.i.filter(i => cells.h[i] < 20 && cells.road[i] && features[cells.f[i]].type === "ocean"));
    let quantity = getQuantity(sea, 50, 700);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(sea);
      const id = addMarker({cell, icon: "🦑", type: "sea_monster"});
      const name = `${Names.getCultureShort(0)} Monster`;
      const length = gauss(25, 10, 10, 100);
      const legend = `Old sailors tell stories of a gigantic sea monster inhabiting these dangerous waters. Rumors say it can be ${length} ${heightUnit.value} long`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addHillMonsters() {
    const {cells} = pack;

    const hills = Array.from(cells.i.filter(i => cells.h[i] >= 50 && cells.pop[i]));
    let quantity = getQuantity(hills, 30, 600);
    if (!quantity) return;

    const subjects = ["Locals", "Old folks", "Old books", "Tipplers"];
    const species = ["Ogre", "Troll", "Cyclops", "Giant", "Monster", "Beast", "Dragon", "Undead", "Ghoul", "Vampire"];
    const modusOperandi = [
      "steals cattle at night",
      "prefers eating children",
      "doesn't mind human flesh",
      "keeps the region at bay",
      "eats kids whole",
      "abducts young women",
      "terrorizes the region",
      "harasses travelers in the area",
      "snatches people from homes",
      "attacks anyone who dares to approach its lair",
      "attacks unsuspecting victims"
    ];

    while (quantity) {
      const [cell] = extractAnyElement(hills);
      const id = addMarker({cell, icon: "👹", type: "hill_monster", dy: 54, px: 13});
      const monster = ra(species);
      const toponym = Names.getCulture(cells.culture[cell]);
      const name = `${toponym} ${monster}`;
      const legend = `${ra(subjects)} tell tales of an old ${monster} who inhabits ${toponym} hills and ${ra(modusOperandi)}`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addSacredMountains() {
    const {cells, cultures} = pack;

    let lonelyMountains = Array.from(cells.i.filter(i => cells.h[i] >= 70 && cells.c[i].some(c => cells.culture[c]) && cells.c[i].every(c => cells.h[c] < 60)));
    let quantity = getQuantity(lonelyMountains, 1, 5);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(lonelyMountains);
      const id = addMarker({cell, icon: "🗻", type: "sacred_mountain", dy: 48});
      const culture = cells.c[cell].map(c => cells.culture[c]).find(c => c);
      const name = `${Names.getCulture(culture)} Mountain`;
      const height = getFriendlyHeight(cells.p[cell]);
      const legend = `A sacred mountain of ${cultures[culture].name} culture. Height: ${height}`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addSacredForests() {
    const {cells, cultures} = pack;

    let temperateForests = Array.from(cells.i.filter(i => cells.culture[i] && [6, 8].includes(cells.biome[i])));
    let quantity = getQuantity(temperateForests, 30, 1000);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(temperateForests);
      const id = addMarker({cell, icon: "🌳", type: "sacred_forest"});
      const culture = cells.culture[cell];
      const name = `${Names.getCulture(culture)} Forest`;
      const legend = `A sacred forest of ${cultures[culture].name} culture`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addSacredPineries() {
    const {cells, cultures} = pack;

    let borealForests = Array.from(cells.i.filter(i => cells.culture[i] && cells.biome[i] === 9));
    let quantity = getQuantity(borealForests, 30, 800);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(borealForests);
      const id = addMarker({cell, icon: "🌲", type: "pinery", px: 13});
      const culture = cells.culture[cell];
      const name = `${Names.getCulture(culture)} Pinery`;
      const legend = `A sacred pinery of ${cultures[culture].name} culture`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addSacredPalmGroves() {
    const {cells, cultures} = pack;

    let oasises = Array.from(cells.i.filter(i => cells.culture[i] && cells.biome[i] === 1 && cells.pop[i] > 1 && cells.road[i]));
    let quantity = getQuantity(oasises, 1, 100);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(oasises);
      const id = addMarker({cell, icon: "🌴", type: "palm_grove", px: 13});
      const culture = cells.culture[cell];
      const name = `${Names.getCulture(culture)} Palm Grove`;
      const legend = `A sacred palm grove of ${cultures[culture].name} culture`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addBrigands() {
    const {cells} = pack;

    let roads = Array.from(cells.i.filter(i => cells.culture[i] && cells.road[i] > 4));
    let quantity = getQuantity(roads, 50, 100);
    if (!quantity) return;

    const animals = [
      "Apes",
      "Badgers",
      "Bears",
      "Beavers",
      "Bisons",
      "Boars",
      "Cats",
      "Crows",
      "Dogs",
      "Foxes",
      "Hares",
      "Hawks",
      "Hyenas",
      "Jackals",
      "Jaguars",
      "Leopards",
      "Lions",
      "Owls",
      "Panthers",
      "Rats",
      "Ravens",
      "Rooks",
      "Scorpions",
      "Sharks",
      "Snakes",
      "Spiders",
      "Tigers",
      "Wolfs",
      "Wolverines",
      "Falcons"
    ];
    const types = {brigands: 4, bandits: 3, robbers: 1, highwaymen: 1};

    while (quantity) {
      const [cell] = extractAnyElement(roads);
      const id = addMarker({cell, icon: "💰", type: "brigands", px: 13});
      const culture = cells.culture[cell];
      const biome = cells.biome[cell];
      const height = cells.p[cell];
      const locality =
        height >= 70
          ? "highlander"
          : [1, 2].includes(biome)
          ? "desert"
          : [3, 4].includes(biome)
          ? "mounted"
          : [5, 6, 7, 8, 9].includes(biome)
          ? "forest"
          : biome === 12
          ? "swamp"
          : "angry";
      const name = `${Names.getCulture(culture)} ${ra(animals)}`;
      const legend = `A gang of ${locality} ${rw(types)}`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addPirates() {
    const {cells} = pack;

    let searoutes = Array.from(cells.i.filter(i => cells.h[i] < 20 && cells.road[i]));
    let quantity = getQuantity(searoutes, 40, 300);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(searoutes);
      const id = addMarker({cell, type: "pirates", icon: "🏴‍☠️", dx: 51});
      const name = `Pirates`;
      const legend = `Pirate ships have been spotted in these waters`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addStatues() {
    const {cells} = pack;
    let statues = Array.from(cells.i.filter(i => cells.h[i] >= 20 && cells.h[i] < 40));
    let quantity = getQuantity(statues, 80, 1200);
    if (!quantity) return;

    const types = ["Statue", "Obelisk", "Monument", "Column", "Monolith", "Pillar", "Megalith", "Stele", "Runestone"];
    const scripts = {
      cypriot: "𐠁𐠂𐠃𐠄𐠅𐠈𐠊𐠋𐠌𐠍𐠎𐠏𐠐𐠑𐠒𐠓𐠔𐠕𐠖𐠗𐠘𐠙𐠚𐠛𐠜𐠝𐠞𐠟𐠠𐠡𐠢𐠣𐠤𐠥𐠦𐠧𐠨𐠩𐠪𐠫𐠬𐠭𐠮𐠯𐠰𐠱𐠲𐠳𐠴𐠵𐠷𐠸𐠼𐠿     ",
      geez: "ሀለሐመሠረሰቀበተኀነአከወዐዘየደገጠጰጸፀፈፐ   ",
      coptic: "ⲲⲴⲶⲸⲺⲼⲾⳀⳁⳂⳃⳄⳆⳈⳊⳌⳎⳐⳒⳔⳖⳘⳚⳜⳞⳠⳢⳤ⳥⳧⳩⳪ⳫⳬⳭⳲ⳹⳾   ",
      tibetan: "ༀ༁༂༃༄༅༆༇༈༉༊་༌༐༑༒༓༔༕༖༗༘༙༚༛༜༠༡༢༣༤༥༦༧༨༩༪༫༬༭༮༯༰༱༲༳༴༵༶༷༸༹༺༻༼༽༾༿",
      mongolian: "᠀᠐᠑᠒ᠠᠡᠦᠧᠨᠩᠪᠭᠮᠯᠰᠱᠲᠳᠵᠻᠼᠽᠾᠿᡀᡁᡆᡍᡎᡏᡐᡑᡒᡓᡔᡕᡖᡗᡙᡜᡝᡞᡟᡠᡡᡭᡮᡯᡰᡱᡲᡳᡴᢀᢁᢂᢋᢏᢐᢑᢒᢓᢛᢜᢞᢟᢠᢡᢢᢤᢥᢦ"
    };

    while (quantity) {
      const [cell] = extractAnyElement(statues);
      const id = addMarker({cell, icon: "🗿", type: "statues"});
      const culture = cells.culture[cell];

      const type = ra(types);
      const name = `${Names.getCulture(culture)} ${type}`;
      const script = scripts[ra(Object.keys(scripts))];
      const inscription = Array(rand(40, 100))
        .fill(null)
        .map(() => ra(script))
        .join("");
      const legend = `An ancient ${type.toLowerCase()}. It has an inscription, but no one can translate it:
        <div style="font-size: 1.8em; line-break: anywhere;">${inscription}</div>`;
    notes.push({id, name, legend});
  }

  function listRuins({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.culture[i] && cells.h[i] >= 20 && cells.h[i] < 60);
  }

  function addRuines() {
    const {cells} = pack;
    let ruins = Array.from(cells.i.filter(i => cells.culture[i] && cells.h[i] >= 20 && cells.h[i] < 60));
    let quantity = getQuantity(ruins, 80, 1200);
    if (!quantity) return;

    const ruinType = ra(types);
    const name = `Ruined ${ruinType}`;
    const legend = `Ruins of an ancient ${ruinType.toLowerCase()}. Untold riches may lie within.`;
    notes.push({id, name, legend});
  }

    while (quantity) {
      const [cell] = extractAnyElement(ruins);
      const id = addMarker({cell, icon: "🏺", type: "ruins"});

      const type = ra(types);
      const name = `Ruined ${type}`;
      const legend = `Ruins of an ancient ${type.toLowerCase()}. A good place for a treasures hunt`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addPortals() {
    const {burgs} = pack;

    let quantity = rand(5, 15);
    if (burgs.length < quantity + 1) return;
    let portals = burgs.slice(1, quantity + 1).map(burg => [burg.name, burg.cell]);

    while (quantity) {
      const [portal] = extractAnyElement(portals);
      const [burgName, cell] = portal;
      const id = addMarker({cell, icon: "🌀", type: "portals", px: 14});
      const name = `${burgName} Portal`;
      const legend = `An element of the magic portal system connecting major cities. Portals installed centuries ago, but still work fine`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addMarker({cell, type, icon, dx, dy, px}) {
    const i = pack.markers.length;
    const [x, y] = getMarkerCoordinates(cell);
    const marker = {i, icon, type, x, y};
    if (dx) marker.dx = dx;
    if (dy) marker.dy = dy;
    if (px) marker.px = px;
    pack.markers.push(marker);
    return "marker" + i;
  }

  return {generate, regenerate};
})();
