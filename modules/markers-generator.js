"use strict";

window.Markers = (function () {
  let config = [];

  function getDefaultConfig() {
    const culturesSet = document.getElementById("culturesSet").value;
    const isFantasy = culturesSet.includes("Fantasy");

    return [
      {type: "volcanoes", icon: "🌋", multiplier: 1, fn: addVolcanoes},
      {type: "hot-springs", icon: "♨️", multiplier: 1, fn: addHotSprings},
      {type: "mines", icon: "⛏️", multiplier: 1, fn: addMines},
      {type: "bridges", icon: "🌉", multiplier: 1, fn: addBridges},
      {type: "inns", icon: "🍻", multiplier: 1, fn: addInns},
      {type: "lighthouses", icon: "🚨", multiplier: 1, fn: addLighthouses},
      {type: "waterfalls", icon: "⟱", multiplier: 1, fn: addWaterfalls},
      {type: "battlefields", icon: "⚔️", multiplier: 1, fn: addBattlefields},
      {type: "dungeons", icon: "🗝️", multiplier: 1, fn: addDungeons},
      {type: "lake-monsters", icon: "🐉", multiplier: 1, fn: addLakeMonsters},
      {type: "sea-monsters", icon: "🦑", multiplier: 1, fn: addSeaMonsters},
      {type: "hill-monsters", icon: "👹", multiplier: 1, fn: addHillMonsters},
      {type: "sacred-mountains", icon: "🗻", multiplier: 1, fn: addSacredMountains},
      {type: "sacred-forests", icon: "🌳", multiplier: 1, fn: addSacredForests},
      {type: "sacred-pineries", icon: "🌲", multiplier: 1, fn: addSacredPineries},
      {type: "sacred-palm-groves", icon: "🌴", multiplier: 1, fn: addSacredPalmGroves},
      {type: "brigands", icon: "💰", multiplier: 1, fn: addBrigands},
      {type: "pirates", icon: "🏴‍☠️", multiplier: 1, fn: addPirates},
      {type: "statues", icon: "🗿", multiplier: 1, fn: addStatues},
      {type: "ruines", icon: "🏺", multiplier: 1, fn: addRuines},
      {type: "portals", icon: "🌀", multiplier: isFantasy, fn: addPortals}
    ];
  }

  const getConfig = () => config;

  const setConfig = newConfig => {
    config = newConfig;
  };

<<<<<<< HEAD
  const generate = requestedQtyMultiplier => {
    pack.markers = [];
    if (requestedQtyMultiplier === 0) return;
    if (requestedQtyMultiplier) multiplier = requestedQtyMultiplier;
=======
  const generate = function () {
    setConfig(getDefaultConfig());
    pack.markers = [];
    generateTypes();
  };

  const regenerate = () => {
    pack.markers = pack.markers.filter(({i, lock}) => {
      if (lock) return true;

      const id = `marker${i}`;
      document.getElementById(id)?.remove();
      const index = notes.findIndex(note => note.id === id);
      if (index != -1) notes.splice(index, 1);
      return false;
    });

    generateTypes();
  };

  function generateTypes() {
>>>>>>> 60057c5... markers - generate from config file
    TIME && console.time("addMarkers");
    // TODO: don't put multiple markers to the same cell

    config.forEach(({type, icon, multiplier, fn}) => {
      if (multiplier === 0) return;
      fn(type, icon, multiplier);
    });
    TIME && console.timeEnd("addMarkers");
  }

<<<<<<< HEAD
  const getQuantity = (array, min, each) => {
    if (array.length < min) return 0;
    return Math.ceil((array.length / each) * multiplier);
  };
=======
  function getQuantity(array, min, each, multiplier) {
    if (!array.length || array.length < min / multiplier) return 0;
    const requestQty = Math.ceil((array.length / each) * multiplier);
    return array.length < requestQty ? array.length : requestQty;
  }
>>>>>>> 60057c5... markers - generate from config file

  function extractAnyElement(array) {
    const index = Math.floor(Math.random() * array.length);
    return array.splice(index, 1);
  }

  function getMarkerCoordinates(cell) {
    const {cells, burgs} = pack;
    const burgId = cells.burg[cell];

    if (burgId) {
      const {x, y} = burgs[burgId];
      return [x, y];
    }

    return cells.p[cell];
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

  function addVolcanoes(type, icon, multiplier) {
    const {cells} = pack;

    let mountains = Array.from(cells.i.filter(i => cells.h[i] >= 70).sort((a, b) => cells.h[b] - cells.h[a]));
    let quantity = getQuantity(mountains, 10, 300, multiplier);
    if (!quantity) return;
    const highestMountains = mountains.slice(0, 20);

    while (quantity) {
      const [cell] = extractAnyElement(highestMountains);
      const id = addMarker({cell, icon, type, dx: 52, px: 13});
      const proper = Names.getCulture(cells.culture[cell]);
      const name = P(0.3) ? "Mount " + proper : Math.random() > 0.3 ? proper + " Volcano" : proper;
      notes.push({id, name, legend: `Active volcano. Height: ${getFriendlyHeight(cells.p[cell])}`});
      quantity--;
    }
  }

  function addHotSprings(type, icon, multiplier) {
    const {cells} = pack;

    let springs = Array.from(cells.i.filter(i => cells.h[i] > 50).sort((a, b) => cells.h[b] - cells.h[a]));
    let quantity = getQuantity(springs, 30, 800, multiplier);
    if (!quantity) return;
    const highestSprings = springs.slice(0, 40);

    while (quantity) {
      const [cell] = extractAnyElement(highestSprings);
      const id = addMarker({cell, icon, type, dy: 52});
      const proper = Names.getCulture(cells.culture[cell]);
      const temp = convertTemperature(gauss(35, 15, 20, 100));
      notes.push({id, name: proper + " Hot Springs", legend: `A hot springs area. Average temperature: ${temp}`});
      quantity--;
    }
  }

  function addMines(type, icon, multiplier) {
    const {cells} = pack;

    let hillyBurgs = Array.from(cells.i.filter(i => cells.h[i] > 47 && cells.burg[i]));
    let quantity = getQuantity(hillyBurgs, 1, 15, multiplier);
    if (!quantity) return;

    const resources = {salt: 5, gold: 2, silver: 4, copper: 2, iron: 3, lead: 1, tin: 1};

    while (quantity && hillyBurgs.length) {
      const [cell] = extractAnyElement(hillyBurgs);
      const id = addMarker({cell, icon, type, dx: 48, px: 13});
      const resource = rw(resources);
      const burg = pack.burgs[cells.burg[cell]];
      const name = `${burg.name} — ${resource} mining town`;
      const population = rn(burg.population * populationRate * urbanization);
      const legend = `${burg.name} is a mining town of ${population} people just nearby the ${resource} mine`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addBridges(type, icon, multiplier) {
    const {cells, burgs} = pack;

    const meanFlux = d3.mean(cells.fl.filter(fl => fl));
    let bridges = Array.from(
      cells.i.filter(i => cells.burg[i] && cells.t[i] !== 1 && burgs[cells.burg[i]].population > 20 && cells.r[i] && cells.fl[i] > meanFlux)
    );
    let quantity = getQuantity(bridges, 1, 5, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(bridges);
      const id = addMarker({cell, icon, type, px: 14});
      const burg = pack.burgs[cells.burg[cell]];
      const river = pack.rivers.find(r => r.i === pack.cells.r[cell]);
      const riverName = river ? `${river.name} ${river.type}` : "river";
      const name = river && P(0.2) ? river.name : burg.name;
      notes.push({id, name: `${name} Bridge`, legend: `A stone bridge over the ${riverName} near ${burg.name}`});
      quantity--;
    }
  }

  function addInns(type, icon, multiplier) {
    const {cells} = pack;

    let taverns = Array.from(cells.i.filter(i => cells.h[i] >= 20 && cells.road[i] > 4 && cells.pop[i] > 10));
    let quantity = getQuantity(taverns, 1, 100, multiplier);
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
    const types = ["hot", "cold", "fire", "ice", "smoky", "misty", "shiny", "sweet", "bitter", "salty", "sour", "sparkling", "smelly"];
    const drinks = [
      "wine",
      "brandy",
      "jinn",
      "whisky",
      "rom",
      "beer",
      "cider",
      "mead",
      "liquor",
      "spirit",
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
      const id = addMarker({cell, icon, type, px: 14});
      const typeName = P(0.3) ? "inn" : "tavern";
      const isAnimalThemed = P(0.7);
      const animal = ra(animals);
      const name = isAnimalThemed ? (P(0.6) ? ra(colors) + " " + animal : ra(adjectives) + " " + animal) : ra(adjectives) + " " + capitalize(type);
      const meal = isAnimalThemed && P(0.3) ? animal : ra(courses);
      const course = `${ra(methods)} ${meal}`.toLowerCase();
      const drink = `${P(0.5) ? ra(types) : ra(colors)} ${ra(drinks)}`.toLowerCase();
      const legend = `A big and famous roadside ${typeName}. Delicious ${course} with ${drink} is served here`;
      notes.push({id, name: "The " + name, legend});
      quantity--;
    }
  }

  function addLighthouses(type, icon, multiplier) {
    const {cells} = pack;

    const lighthouses = Array.from(cells.i.filter(i => cells.harbor[i] > 6 && cells.c[i].some(c => cells.h[c] < 20 && cells.road[c])));
    let quantity = getQuantity(lighthouses, 1, 2, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(lighthouses);
      const id = addMarker({cell, icon, type, px: 14});
      const proper = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name : Names.getCulture(cells.culture[cell]);
      notes.push({id, name: getAdjective(proper) + " Lighthouse" + name, legend: `A lighthouse to keep the navigation safe`});
      quantity--;
    }
  }

  function addWaterfalls(type, icon, multiplier) {
    const {cells} = pack;

    const waterfalls = Array.from(cells.i.filter(i => cells.r[i] && cells.h[i] >= 50 && cells.c[i].some(c => cells.h[c] < 40 && cells.r[c])));
    const quantity = getQuantity(waterfalls, 1, 5, multiplier);
    if (!quantity) return;

    for (let i = 0; i < waterfalls.length && i < quantity; i++) {
      const cell = waterfalls[i];
      const id = addMarker({cell, icon, type, dy: 54, px: 16});
      const proper = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name : Names.getCulture(cells.culture[cell]);
      notes.push({id, name: getAdjective(proper) + " Waterfall" + name, legend: `An extremely beautiful waterfall`});
    }
  }

  function addBattlefields(type, icon, multiplier) {
    const {cells, states} = pack;

    let battlefields = Array.from(cells.i.filter(i => cells.state[i] && cells.pop[i] > 2 && cells.h[i] < 50 && cells.h[i] > 25));
    let quantity = getQuantity(battlefields, 50, 700, multiplier);
    if (!quantity) return;

    while (quantity && battlefields.length) {
      const [cell] = extractAnyElement(battlefields);
      const id = addMarker({cell, icon, type, dy: 52});
      const campaign = ra(states[cells.state[cell]].campaigns);
      const date = generateDate(campaign.start, campaign.end);
      const name = Names.getCulture(cells.culture[cell]) + " Battlefield";
      const legend = `A historical battle of the ${campaign.name}. \r\nDate: ${date} ${options.era}`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addDungeons(type, icon, multiplier) {
    const {cells} = pack;

    let dungeons = Array.from(cells.i.filter(i => cells.pop[i] && cells.pop[i] < 3));
    let quantity = getQuantity(dungeons, 30, 200, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(dungeons);
      const id = addMarker({cell, icon, type, dy: 51, px: 13});

      const dungeonSeed = `${seed}${cell}`;
      const name = "Dungeon";
      const legend = `<div>Undiscovered dungeon. See <a href="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" target="_blank">One page dungeon</a></div><iframe src="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" frameborder="0"></iframe>`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addLakeMonsters(type, icon, multiplier) {
    const {features} = pack;

    const lakes = features.filter(feature => feature.type === "lake" && feature.group === "freshwater");
    let quantity = getQuantity(lakes, 2, 10, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [lake] = extractAnyElement(lakes);
      const cell = lake.firstCell;
      const id = addMarker({cell, icon, type, dy: 48});
      const name = `${lake.name} Monster`;
      const length = gauss(10, 5, 5, 100);
      const legend = `Rumors said a relic monster of ${length} ${heightUnit.value} long inhabits ${lake.name} Lake. Truth or lie, but folks are affraid to fish in the lake`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addSeaMonsters(type, icon, multiplier) {
    const {cells, features} = pack;

    const sea = Array.from(cells.i.filter(i => cells.h[i] < 20 && cells.road[i] && features[cells.f[i]].type === "ocean"));
    let quantity = getQuantity(sea, 50, 700, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(sea);
      const id = addMarker({cell, icon, type});
      const name = `${Names.getCultureShort(0)} Monster`;
      const length = gauss(25, 10, 10, 100);
      const legend = `Old sailors tell stories of a gigantic sea monster inhabiting these dangerous waters. Rumors say it can be ${length} ${heightUnit.value} long`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addHillMonsters(type, icon, multiplier) {
    const {cells} = pack;

    const hills = Array.from(cells.i.filter(i => cells.h[i] >= 50 && cells.pop[i]));
    let quantity = getQuantity(hills, 30, 600, multiplier);
    if (!quantity) return;

    const subjects = ["Locals", "Old folks", "Old books", "Tipplers"];
    const species = ["Ogre", "Troll", "Cyclops", "Giant", "Monster", "Beast", "Dragon", "Undead", "Ghoul", "Vampire"];
    const modusOperandi = [
      "steals their cattle",
      "doesn't mind eating children",
      "doesn't mind of human flesh",
      "keeps the region at bay",
      "eats their kids",
      "abducts young women"
    ];

    while (quantity) {
      const [cell] = extractAnyElement(hills);
      const id = addMarker({cell, icon, type, dy: 54, px: 13});
      const monster = ra(species);
      const toponym = Names.getCulture(cells.culture[cell]);
      const name = `${toponym} ${monster}`;
      const legend = `${ra(subjects)} tell tales of an old ${monster} who inhabits ${toponym} hills and ${ra(modusOperandi)}`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addSacredMountains(type, icon, multiplier) {
    const {cells, cultures} = pack;

    let lonelyMountains = Array.from(cells.i.filter(i => cells.h[i] >= 70 && cells.c[i].some(c => cells.culture[c]) && cells.c[i].every(c => cells.h[c] < 60)));
    let quantity = getQuantity(lonelyMountains, 1, 5, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(lonelyMountains);
      const id = addMarker({cell, icon, type, dy: 48});
      const culture = cells.c[cell].map(c => cells.culture[c]).find(c => c);
      const name = `${Names.getCulture(culture)} Mountain`;
      const height = getFriendlyHeight(cells.p[cell]);
      const legend = `A sacred mountain of ${cultures[culture].name} culture. Height: ${height}`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addSacredForests(type, icon, multiplier) {
    const {cells, cultures} = pack;

    let temperateForests = Array.from(cells.i.filter(i => cells.culture[i] && [6, 8].includes(cells.biome[i])));
    let quantity = getQuantity(temperateForests, 30, 1000, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(temperateForests);
      const id = addMarker({cell, icon, type});
      const culture = cells.culture[cell];
      const name = `${Names.getCulture(culture)} Forest`;
      const legend = `A sacred forest of ${cultures[culture].name} culture`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addSacredPineries(type, icon, multiplier) {
    const {cells, cultures} = pack;

    let borealForests = Array.from(cells.i.filter(i => cells.culture[i] && cells.biome[i] === 9));
    let quantity = getQuantity(borealForests, 30, 800, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(borealForests);
      const id = addMarker({cell, icon, type, px: 13});
      const culture = cells.culture[cell];
      const name = `${Names.getCulture(culture)} Pinery`;
      const legend = `A sacred pinery of ${cultures[culture].name} culture`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addSacredPalmGroves(type, icon, multiplier) {
    const {cells, cultures} = pack;

    let oasises = Array.from(cells.i.filter(i => cells.culture[i] && cells.biome[i] === 1 && cells.pop[i] > 1 && cells.road[i]));
    let quantity = getQuantity(oasises, 1, 100, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(oasises);
      const id = addMarker({cell, icon, type, px: 13});
      const culture = cells.culture[cell];
      const name = `${Names.getCulture(culture)} Palm Grove`;
      const legend = `A sacred palm grove of ${cultures[culture].name} culture`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addBrigands(type, icon, multiplier) {
    const {cells} = pack;

    let roads = Array.from(cells.i.filter(i => cells.culture[i] && cells.road[i] > 4));
    let quantity = getQuantity(roads, 50, 100, multiplier);
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
      const id = addMarker({cell, icon, type, px: 13});
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

  function addPirates(type, icon, multiplier) {
    const {cells} = pack;

    let searoutes = Array.from(cells.i.filter(i => cells.h[i] < 20 && cells.road[i]));
    let quantity = getQuantity(searoutes, 40, 300, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(searoutes);
      const id = addMarker({cell, icon, type, dx: 51});
      const name = `Pirates`;
      const legend = `Pirate ships have been spotted in these waters`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addStatues(type, icon, multiplier) {
    const {cells} = pack;
    let statues = Array.from(cells.i.filter(i => cells.h[i] >= 20 && cells.h[i] < 40));
    let quantity = getQuantity(statues, 80, 1200, multiplier);
    if (!quantity) return;

    const variants = ["Statue", "Obelisk", "Monument", "Column", "Monolith", "Pillar", "Megalith", "Stele", "Runestone"];
    const scripts = {
      cypriot: "𐠁𐠂𐠃𐠄𐠅𐠈𐠊𐠋𐠌𐠍𐠎𐠏𐠐𐠑𐠒𐠓𐠔𐠕𐠖𐠗𐠘𐠙𐠚𐠛𐠜𐠝𐠞𐠟𐠠𐠡𐠢𐠣𐠤𐠥𐠦𐠧𐠨𐠩𐠪𐠫𐠬𐠭𐠮𐠯𐠰𐠱𐠲𐠳𐠴𐠵𐠷𐠸𐠼𐠿     ",
      geez: "ሀለሐመሠረሰቀበተኀነአከወዐዘየደገጠጰጸፀፈፐ   ",
      coptic: "ⲲⲴⲶⲸⲺⲼⲾⳀⳁⳂⳃⳄⳆⳈⳊⳌⳎⳐⳒⳔⳖⳘⳚⳜⳞⳠⳢⳤ⳥⳧⳩⳪ⳫⳬⳭⳲ⳹⳾   ",
      tibetan: "ༀ༁༂༃༄༅༆༇༈༉༊་༌༐༑༒༓༔༕༖༗༘༙༚༛༜༠༡༢༣༤༥༦༧༨༩༪༫༬༭༮༯༰༱༲༳༴༵༶༷༸༹༺༻༼༽༾༿",
      mongolian: "᠀᠐᠑᠒ᠠᠡᠦᠧᠨᠩᠪᠭᠮᠯᠰᠱᠲᠳᠵᠻᠼᠽᠾᠿᡀᡁᡆᡍᡎᡏᡐᡑᡒᡓᡔᡕᡖᡗᡙᡜᡝᡞᡟᡠᡡᡭᡮᡯᡰᡱᡲᡳᡴᢀᢁᢂᢋᢏᢐᢑᢒᢓᢛᢜᢞᢟᢠᢡᢢᢤᢥᢦ"
    };

    while (quantity) {
      const [cell] = extractAnyElement(statues);
      const id = addMarker({cell, icon, type});
      const culture = cells.culture[cell];

      const variant = ra(variants);
      const name = `${Names.getCulture(culture)} ${variant}`;
      const script = scripts[ra(Object.keys(scripts))];
      const inscription = Array(rand(40, 100))
        .fill(null)
        .map(() => ra(script))
        .join("");
      const legend = `An ancient ${variant.toLowerCase()}. It has an inscription, but no one can translate it:
        <div style="font-size: 1.8em; line-break: anywhere;">${inscription}</div>`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addRuines(type, icon, multiplier) {
    const {cells} = pack;
    let ruins = Array.from(cells.i.filter(i => cells.culture[i] && cells.h[i] >= 20 && cells.h[i] < 60));
    let quantity = getQuantity(ruins, 80, 1200, multiplier);
    if (!quantity) return;

    const types = ["City", "Town", "Pyramid", "Fort"];

    while (quantity) {
      const [cell] = extractAnyElement(ruins);
      const id = addMarker({cell, icon, type});

      const ruinType = ra(types);
      const name = `Ruined ${ruinType}`;
      const legend = `Ruins of an ancient ${ruinType.toLowerCase()}. A good place for a treasures hunt`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

  function addPortals(type, icon, multiplier) {
    const {burgs} = pack;
    let portals = burgs.slice(1, rand(12, 30) + 1).map(burg => [burg.name, burg.cell]);
    let quantity = getQuantity(portals, 10, 3, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [portal] = extractAnyElement(portals);
      const [burgName, cell] = portal;
      const id = addMarker({cell, icon, type, px: 14});
      const name = `${burgName} Portal`;
      const legend = `An element of the magic portal system connecting major cities. Portals installed centuries ago, but still work fine`;
      notes.push({id, name, legend});
      quantity--;
    }
  }

<<<<<<< HEAD
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

  return {generate};
=======
  return {generate, regenerate, getConfig, setConfig};
>>>>>>> 60057c5... markers - generate from config file
})();
