"use strict";

window.Markers = (function () {
  let config = [];
  let occupied = [];

  function getDefaultConfig() {
    const culturesSet = document.getElementById("culturesSet").value;
    const isFantasy = culturesSet.includes("Fantasy");

    return [
      { type: "volcanoes", icon: "🌋", multiplier: 10, fn: addVolcanoes },
      { type: "hot-springs", icon: "♨️", multiplier: 20, fn: addHotSprings },
      { type: "mines", icon: "⛏️", multiplier: 50, fn: addMines },
      { type: "gem-mines", icon: "💎", multiplier: 3, fn: addGemMines },
      { type: "bridges", icon: "🌉", multiplier: 40, fn: addBridges },
      { type: "inns", icon: "🍻", multiplier: 20, fn: addInns },
      { type: "lighthouses", icon: "🚨", multiplier: 1, fn: addLighthouses },
      { type: "waterfalls", icon: "💦", multiplier: 1, fn: addWaterfalls },
      { type: "battlefields", icon: "⚔️", multiplier: 3, fn: addBattlefields },
      { type: "dungeons", icon: "🗝️", multiplier: 5, fn: addDungeons },
      { type: "lake-monsters", icon: "🐉", multiplier: 8, fn: addLakeMonsters },
      { type: "sea-monsters", icon: "🦑", multiplier: 150, fn: addSeaMonsters },
      {
        type: "hill-monsters",
        icon: "👹",
        multiplier: 20,
        fn: addHillMonsters,
      },
      {
        type: "sacred-mountains",
        icon: "🗻",
        multiplier: 5,
        fn: addSacredMountains,
      },
      {
        type: "sacred-forests",
        icon: "🌳",
        multiplier: 10,
        fn: addSacredForests,
      },
      {
        type: "sacred-pineries",
        icon: "🌲",
        multiplier: 10,
        fn: addSacredPineries,
      },
      {
        type: "sacred-palm-groves",
        icon: "🌴",
        multiplier: 5,
        fn: addSacredPalmGroves,
      },
      { type: "brigands", icon: "💰", multiplier: 5, fn: addBrigands },
      { type: "pirates", icon: "🏴‍☠️", multiplier: 15, fn: addPirates },
      { type: "statues", icon: "🗿", multiplier: 5, fn: addStatues },
      { type: "ruines", icon: "🏺", multiplier: 10, fn: addRuines },
      { type: "spiders", icon: "🕷️", multiplier: 45, fn: addSpiders },
      {
        type: "giant goat heard",
        icon: "🐐",
        multiplier: 25,
        fn: addGoatHeard,
      },
      { type: "citadel", icon: "🏯", multiplier: 10, fn: addSacredCitidel },
      { type: "portals", icon: "🌀", multiplier: 3, fn: addPortals },
    ];
  }

  const getConfig = () => config;

  const setConfig = (newConfig) => {
    config = newConfig;
  };

  const generate = function () {
    setConfig(getDefaultConfig());
    pack.markers = [];
    generateTypes();
  };

  const regenerate = () => {
    pack.markers = pack.markers.filter(({ i, lock, cell }) => {
      if (lock) {
        occupied[cell] = true;
        return true;
      }
      const id = `marker${i}`;
      document.getElementById(id)?.remove();
      const index = notes.findIndex((note) => note.id === id);
      if (index != -1) notes.splice(index, 1);
      return false;
    });

    generateTypes();
  };

  function generateTypes() {
    TIME && console.time("addMarkers");

    config.forEach(({ type, icon, multiplier, fn }) => {
      if (multiplier === 0) return;
      fn(type, icon, multiplier);
    });

    occupied = [];
    TIME && console.timeEnd("addMarkers");
  }

  function getQuantity(array, min, each, multiplier) {
    if (!array.length || array.length < min / multiplier) return 0;
    const requestQty = Math.ceil((array.length / each) * multiplier);
    return array.length < requestQty ? array.length : requestQty;
  }

  function extractAnyElement(array) {
    const index = Math.floor(Math.random() * array.length);
    return array.splice(index, 1);
  }

  function getMarkerCoordinates(cell) {
    const { cells, burgs } = pack;
    const burgId = cells.burg[cell];

    if (burgId) {
      const { x, y } = burgs[burgId];
      return [x, y];
    }

    return cells.p[cell];
  }

  function addMarker({ cell, type, icon, dx, dy, px }) {
    const i = pack.markers.length;
    const [x, y] = getMarkerCoordinates(cell);
    const marker = { i, icon, type, x, y, cell };
    if (dx) marker.dx = dx;
    if (dy) marker.dy = dy;
    if (px) marker.px = px;
    pack.markers.push(marker);
    occupied[cell] = true;
    return "marker" + i;
  }

  function addVolcanoes(type, icon, multiplier) {
    const { cells } = pack;

    let mountains = Array.from(
      cells.i
        .filter((i) => !occupied[i] && cells.h[i] >= 70)
        .sort((a, b) => cells.h[b] - cells.h[a])
    );
    let quantity = getQuantity(mountains, 10, 500, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(mountains);
      const id = addMarker({ cell, icon, type, dx: 52, px: 13 });
      const proper = Names.getCulture(cells.culture[cell]);
      const name = P(0.3)
        ? "Mount " + proper
        : Math.random() > 0.3
        ? proper + " Volcano"
        : proper;
      notes.push({
        id,
        name,
        legend: `Active volcano. Height: ${getFriendlyHeight(cells.p[cell])}`,
      });
      quantity--;
    }
  }

  function addHotSprings(type, icon, multiplier) {
    const { cells } = pack;

    let springs = Array.from(
      cells.i
        .filter((i) => !occupied[i] && cells.h[i] > 50)
        .sort((a, b) => cells.h[b] - cells.h[a])
    );
    let quantity = getQuantity(springs, 30, 1200, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(springs);
      const id = addMarker({ cell, icon, type, dy: 52 });
      const proper = Names.getCulture(cells.culture[cell]);
      const temp = convertTemperature(gauss(35, 15, 20, 100));
      notes.push({
        id,
        name: proper + " Hot Springs",
        legend: `A hot springs area. Average temperature: ${temp}`,
      });
      quantity--;
    }
  }

  function addMines(type, icon, multiplier) {
    const { cells } = pack;

    let hillyBurgs = Array.from(
      cells.i.filter((i) => !occupied[i] && cells.h[i] > 47 && cells.burg[i])
    );
    let quantity = getQuantity(hillyBurgs, 1, 15, multiplier);
    if (!quantity) return;

    const resources = {
      salt: 5,
      coal: 7,
      gold: 2,
      silver: 4,
      copper: 2,
      iron: 3,
      lead: 1,
      tin: 1,
    };

    while (quantity && hillyBurgs.length) {
      const [cell] = extractAnyElement(hillyBurgs);
      const id = addMarker({ cell, icon, type, dx: 48, px: 13 });
      const resource = rw(resources);
      const burg = pack.burgs[cells.burg[cell]];
      const name = `${burg.name} — ${resource} mining town`;
      const population = rn(burg.population * populationRate * urbanization);
      const legend = `${burg.name} is a mining town of ${population} people just nearby the ${resource} mine`;
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addGemMines(type, icon, multiplier) {
    const { cells } = pack;
    let hillyBurgs = Array.from(
      cells.i.filter((i) => !occupied[i] && cells.h[i] > 67)
    );
    let quantity = getQuantity(hillyBurgs, 1, 15, multiplier);
    if (!quantity) return;

    const resources = {
      Agni_mani: 1,
      Alamandine: 1,
      Alestone: 1,
      Alexandrite: 1,
      Algae: 1,
      Amaratha: 1,
      Amber: 1,
      Amethyst: 1,
      Andar: 1,
      Aquamarine: 1,
      Aradite: 1,
      Augelite: 1,
      Aventurine: 1,
      Azurite: 1,
      Banded_agate: 1,
      Beljuril: 1,
      Beryl: 1,
      Black_opal: 1,
      Black_pearl: 1,
      Black_sapphire: 1,
      Bloodstone: 1,
      Blue_quartz: 1,
      Blue_sapphire: 1,
      Blue_spinel: 1,
      Bluestone: 1,
      Boakhar: 1,
      Brandeen: 1,
      Carbuncle: 1,
      Carnelian: 1,
      Chalcedony: 1,
      Chrysoberyl: 1,
      Chrysocolla: 1,
      Chrysolite: 1,
      Chrysoprase: 1,
      Citrine: 1,
      Cleiophane: 1,
      Coral: 1,
      Corstal: 1,
      Corundum: 1,
      Crown_of_silver: 1,
      Cymophane: 1,
      Datcha: 1,
      Demontoid: 1,
      Diamond: 1,
      Diopside: 1,
      Dioptase: 1,
      Disthene: 1,
      Emerald: 1,
      Epidote: 1,
      Essonite: 1,
      Euclase: 1,
      Eye_agate: 1,
      Fire_agate: 1,
      Fire_opal: 1,
      Flamedance: 1,
      Fluorite: 1,
      Frost_agate: 1,
      Garnet: 1,
      Goldline: 1,
      Greenstone: 1,
      Hambergyle: 1,
      Hematite: 1,
      Hyacinth: 1,
      Hyaline: 1,
      Hyalite: 1,
      Hydrophane: 1,
      Hypersthene: 1,
      Idicolite: 1,
      Iolite: 1,
      Irtios: 1,
      Jacinth: 1,
      Jade: 1,
      Jargoon: 1,
      Jasmal: 1,
      Jasper: 1,
      Jet: 1,
      Kings_tears: 1,
      Kornerupine: 1,
      Kunzite: 1,
      Laerals_Tears: 1,
      Lapis_lazuli: 1,
      Luriyl: 1,
      Lynx_eye: 1,
      Malachite: 1,
      Malacon: 1,
      Mellochrysos: 1,
      Microcline: 1,
      Moonbar: 1,
      Moonstone: 1,
      Morganite: 1,
      Moss_agate: 1,
      Mykaro: 1,
      Mynteer: 1,
      Nelvine: 1,
      Nephrite: 1,
      Nune: 1,
      Obsidian: 1,
      Octel: 1,
      Olivine: 1,
      Ooline: 1,
      Onyx: 1,
      Ophealine: 1,
      Orbaline: 1,
      Orblen: 1,
      Orl: 1,
      Orprase: 1,
      Pearl: 1,
      Peridot: 1,
      Pyrope: 1,
      Quartz: 1,
      Raindrop: 1,
      Red_Tears: 1,
      Rhodochrosite: 1,
      Rhodolite: 1,
      Rhodonite: 1,
      Rosaline: 1,
      Rubellite: 1,
      Ruby: 1,
      Rusteen: 1,
      Saganite: 1,
      Samarskite: 1,
      Sanidine: 1,
      Sarbossa: 1,
      Sardonyx: 1,
      Satin_spar: 1,
      Scapra: 1,
      Serpentine: 1,
      Shandon: 1,
      Sharpstone: 1,
      Silkstone: 1,
      Sinhalite: 1,
      Skydrop: 1,
      Spessartite: 1,
      Sphene: 1,
      Spinel: 1,
      Star_rose_quarts: 1,
      Star_ruby: 1,
      Star_sapphire: 1,
      Sunstone: 1,
      Tabasheer: 1,
      Tanzanite: 1,
      Tchazar: 1,
      Thupartial: 1,
      Tiger_eye: 1,
      Topaz: 1,
      Tourmaline: 1,
      Tremair: 1,
      Turquoise: 1,
      Ulvaen: 1,
      Variscite: 1,
      Water_opal: 1,
      Waterstar: 1,
      White_opal: 1,
      Witherite: 1,
      Wonderstone: 1,
      Woodtine: 1,
      Yellow_sapphire: 1,
      Zarbrina: 1,
      Zendalure: 1,
      Ziose: 1,
      Zircon: 1,
    };

    while (quantity && hillyBurgs.length) {
      const [cell] = extractAnyElement(hillyBurgs);
      const id = addMarker({ cell, icon, type, dx: 48, px: 13 });
      const resource = rw(resources);
      const burg = pack.burgs[cells.burg[cell]];
      const name = `${burg.name} — ${resource} mining town`;
      const population = rn(burg.population * populationRate * urbanization);
      const legend = `${resource} mine`;
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addBridges(type, icon, multiplier) {
    const { cells, burgs } = pack;

    const meanFlux = d3.mean(cells.fl.filter((fl) => fl));
    let bridges = Array.from(
      cells.i.filter(
        (i) =>
          !occupied[i] &&
          cells.burg[i] &&
          cells.t[i] !== 1 &&
          burgs[cells.burg[i]].population > 20 &&
          cells.r[i] &&
          cells.fl[i] > meanFlux
      )
    );
    let quantity = getQuantity(bridges, 1, 5, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(bridges);
      const id = addMarker({ cell, icon, type, px: 14 });
      const burg = pack.burgs[cells.burg[cell]];
      const river = pack.rivers.find((r) => r.i === pack.cells.r[cell]);
      const riverName = river ? `${river.name} ${river.type}` : "river";
      const name = river && P(0.2) ? river.name : burg.name;
      const weightedAdjectives = {
        stone: 10,
        wooden: 1,
        lengthy: 2,
        formidable: 2,
        rickety: 1,
        beaten: 1,
        weathered: 1,
      };
      notes.push({
        id,
        name: `${name} Bridge`,
        legend: `A ${rw(
          weightedAdjectives
        )} bridge spans over the ${riverName} near ${burg.name}`,
      });
      quantity--;
    }
  }

  function addInns(type, icon, multiplier) {
    const { cells } = pack;

    let taverns = Array.from(
      cells.i.filter(
        (i) =>
          !occupied[i] &&
          cells.h[i] >= 20 &&
          cells.road[i] > 4 &&
          cells.pop[i] > 10
      )
    );
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
      "Grey",
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
      "Ox",
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
      "Flying",
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
      "Flame-Broiled",
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
      "pig ears",
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
      "smelly",
    ];
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
      "sap",
    ];

    while (quantity) {
      const [cell] = extractAnyElement(taverns);
      const id = addMarker({ cell, icon, type, px: 14 });
      const typeName = P(0.3) ? "inn" : "tavern";
      const isAnimalThemed = P(0.85);
      const animal = ra(animals);
      const name = isAnimalThemed
        ? P(0.6)
          ? ra(colors) + " " + animal
          : ra(adjectives) + " " + animal
        : ra(adjectives) + " " + capitalize(type);
      const meal = isAnimalThemed && P(0.3) ? animal : ra(courses);
      const course = `${ra(methods)} ${meal}`.toLowerCase();
      const drink = `${P(0.5) ? ra(types) : ra(colors)} ${ra(
        drinks
      )}`.toLowerCase();
      const legend = `A big and famous roadside ${typeName}. Delicious ${course} with ${drink} is served here`;
      notes.push({ id, name: "The " + name, legend });
      quantity--;
    }
  }

  function addLighthouses(type, icon, multiplier) {
    const { cells } = pack;

    const lighthouses = Array.from(
      cells.i.filter(
        (i) =>
          !occupied[i] &&
          cells.harbor[i] > 6 &&
          cells.c[i].some((c) => cells.h[c] < 20 && cells.road[c])
      )
    );
    let quantity = getQuantity(lighthouses, 1, 2, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(lighthouses);
      const id = addMarker({ cell, icon, type, px: 14 });
      const proper = cells.burg[cell]
        ? pack.burgs[cells.burg[cell]].name
        : Names.getCulture(cells.culture[cell]);
      notes.push({
        id,
        name: getAdjective(proper) + " Lighthouse" + name,
        legend: `A lighthouse to serve as a beacon for ships in the open sea`,
      });
      quantity--;
    }
  }

  function addWaterfalls(type, icon, multiplier) {
    const { cells } = pack;

    const waterfalls = Array.from(
      cells.i.filter(
        (i) =>
          cells.r[i] &&
          !occupied[i] &&
          cells.h[i] >= 50 &&
          cells.c[i].some((c) => cells.h[c] < 40 && cells.r[c])
      )
    );
    const quantity = getQuantity(waterfalls, 1, 5, multiplier);
    if (!quantity) return;

    const descriptions = [
      "A gorgeous waterfall flows here",
      "The rapids of an exceptionally beautiful waterfall",
      "An impressive waterfall has cut through the land",
      "The cascades of a stunning waterfall",
      "A river drops down from a great height forming a wonderous waterfall",
      "A breathtaking waterfall cuts through the landscape",
    ];
    for (let i = 0; i < waterfalls.length && i < quantity; i++) {
      const cell = waterfalls[i];
      const id = addMarker({ cell, icon, type, dy: 54, px: 16 });
      const proper = cells.burg[cell]
        ? pack.burgs[cells.burg[cell]].name
        : Names.getCulture(cells.culture[cell]);
      notes.push({
        id,
        name: getAdjective(proper) + " Waterfall" + name,
        legend: `${ra(descriptions)}`,
      });
    }
  }

  function addBattlefields(type, icon, multiplier) {
    const { cells, states } = pack;

    let battlefields = Array.from(
      cells.i.filter(
        (i) =>
          !occupied[i] &&
          cells.state[i] &&
          cells.pop[i] > 2 &&
          cells.h[i] < 50 &&
          cells.h[i] > 25
      )
    );
    let quantity = getQuantity(battlefields, 50, 700, multiplier);
    if (!quantity) return;

    while (quantity && battlefields.length) {
      const [cell] = extractAnyElement(battlefields);
      const id = addMarker({ cell, icon, type, dy: 52 });
      const state = states[cells.state[cell]];
      if (!state.campaigns)
        state.campaigns = BurgsAndStates.generateCampaign(state);
      const campaign = ra(state.campaigns);
      const date = generateDate(campaign.start, campaign.end);
      const name = Names.getCulture(cells.culture[cell]) + " Battlefield";
      const legend = `A historical battle of the ${campaign.name}. \r\nDate: ${date} ${options.era}`;
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addDungeons(type, icon, multiplier) {
    const { cells } = pack;

    let dungeons = Array.from(
      cells.i.filter((i) => !occupied[i] && cells.pop[i] && cells.pop[i] < 3)
    );
    let quantity = getQuantity(dungeons, 30, 200, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(dungeons);
      const id = addMarker({ cell, icon, type, dy: 51, px: 13 });

      const dungeonSeed = `${seed}${cell}`;
      const name = "Dungeon";
      const legend = `<div>Undiscovered dungeon. See <a href="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" target="_blank">One page dungeon</a></div><iframe style="height: 33vh" src="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" sandbox="allow-scripts allow-same-origin"></iframe>`;
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addLakeMonsters(type, icon, multiplier) {
    const { features } = pack;

    const lakes = features.filter(
      (feature) =>
        feature.type === "lake" &&
        feature.group === "freshwater" &&
        !occupied[feature.firstCell]
    );
    let quantity = getQuantity(lakes, 2, 10, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [lake] = extractAnyElement(lakes);
      const cell = lake.firstCell;
      const id = addMarker({ cell, icon, type, dy: 48 });
      const name = `${lake.name} Monster`;
      const length = gauss(10, 5, 5, 100);
      const legend = `Rumors say a relic monster of ${length} ${heightUnit.value} long inhabits ${lake.name} Lake. Truth or lie, folks are afraid to fish in the lake`;
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addSeaMonsters(type, icon, multiplier) {
    const { cells, features } = pack;

    const sea = Array.from(
      cells.i.filter(
        (i) =>
          !occupied[i] &&
          cells.h[i] < 20 &&
          features[cells.f[i]].type === "ocean"
      )
    );
    let quantity = getQuantity(sea, 50, 700, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(sea);
      const id = addMarker({ cell, icon, type });
      const name = `${Names.getCultureShort(0)} Monster`;
      const length = gauss(25, 10, 10, 100);
      const legend = `Old sailors tell stories of a gigantic sea monster inhabiting these dangerous waters. Rumors say it can be ${length} ${heightUnit.value} long`;
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addHillMonsters(type, icon, multiplier) {
    const { cells } = pack;

    const hills = Array.from(
      cells.i.filter((i) => !occupied[i] && cells.h[i] >= 50)
    );
    let quantity = getQuantity(hills, 30, 600, multiplier);
    if (!quantity) return;

    const adjectives = [
      "great",
      "big",
      "huge",
      "prime",
      "golden",
      "proud",
      "lucky",
      "fat",
      "giant",
      "hungry",
      "magical",
      "superior",
      "terrifying",
      "horrifying",
      "feared",
    ];
    const subjects = [
      "Locals",
      "Elders",
      "Inscriptions",
      "Tipplers",
      "Legends",
      "Whispers",
      "Rumors",
      "Journeying folk",
      "Tales",
    ];
    const species = [
      "Ankheg",
      "Troll",
      "Cyclops",
      "Griffon",
      "Hag",
      "Roc",
      "Warg",
      "Giant Owl",
      "Owlbear",
      "Dire bear",
      "Dire tiger",
      "Giant Lizard",
      "Hyenas",
    ];
    const modusOperandi = [
      "steals cattle at night",
      "prefers eating children",
      "doesn't mind of human flesh",
      "keeps the region at bay",
      "eats kids whole",
      "abducts young women",
      "terrorizes the region",
      "harasses travelers in the area",
      "snatches people from homes",
      "attacks anyone who dares to approach its lair",
      "attacks unsuspecting victims",
    ];

    while (quantity) {
      const [cell] = extractAnyElement(hills);
      const id = addMarker({ cell, icon, type, dy: 54, px: 13 });
      const monster = ra(species);
      const toponym = Names.getCulture(cells.culture[cell]);
      const name = `${toponym} ${monster}`;
      const legend = `${ra(subjects)} speak of a ${ra(
        adjectives
      )} ${monster} who inhabits ${toponym} hills and ${ra(modusOperandi)}`;
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addGoatHeard(type, icon, multiplier) {
    const { cells } = pack;

    const hills = Array.from(
      cells.i.filter((i) => !occupied[i] && cells.h[i] >= 20)
    );
    let quantity = getQuantity(hills, 30, 600, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(hills);
      const id = addMarker({ cell, icon, type, dy: 54, px: 13 });
      const name = `Heard of Giant Goats`;
      const legend = `Giant heard of goats`;
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addSpiders(type, icon, multiplier) {
    const { cells } = pack;

    const hills = Array.from(
      cells.i.filter((i) => !occupied[i] && cells.h[i] >= 50)
    );
    let quantity = getQuantity(hills, 30, 600, multiplier);
    if (!quantity) return;

    const adjectives = [
      "prime",
      "proud",
      "fat",
      "hungry",
      "superior",
      "terrifying",
      "horrifying",
      "feared",
    ];
    const subjects = [
      "Locals",
      "Elders",
      "Inscriptions",
      "Tipplers",
      "Legends",
      "Whispers",
      "Rumors",
      "Journeying folk",
      "Tales",
    ];
    const species = [
      "Giant Spider",
      "Giant Wolf",
      "Mammoth Spider",
      "Phase Spider",
      "Sword Spider",
      "Steeder",
    ];
    const modusOperandi = [
      "steals goats at night",
      "prefers eating children",
      "keeps the region at bay",
      "abducts young women",
      "terrorizes the region",
      "harasses travelers in the area",
      "attacks anyone who dares to approach its lair",
      "attacks unsuspecting victims",
    ];

    while (quantity) {
      const [cell] = extractAnyElement(hills);
      const id = addMarker({ cell, icon, type, dy: 54, px: 13 });
      const monster = ra(species);
      const toponym = Names.getCulture(cells.culture[cell]);
      const name = `${toponym} ${monster}`;
      const legend = `${ra(subjects)} speak of a ${ra(
        adjectives
      )} ${monster} who inhabits ${toponym} hills and ${ra(modusOperandi)}`;
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addSacredMountains(type, icon, multiplier) {
    const { cells, cultures } = pack;

    let lonelyMountains = Array.from(
      cells.i.filter(
        (i) =>
          !occupied[i] &&
          cells.h[i] >= 70 &&
          cells.c[i].some((c) => cells.culture[c]) &&
          cells.c[i].every((c) => cells.h[c] < 60)
      )
    );
    let quantity = getQuantity(lonelyMountains, 1, 5, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(lonelyMountains);
      const id = addMarker({ cell, icon, type, dy: 48 });
      const culture = cells.c[cell].map((c) => cells.culture[c]).find((c) => c);
      const name = `${Names.getCulture(culture)} Mountain`;
      const height = getFriendlyHeight(cells.p[cell]);
      const legend = `A sacred mountain of ${cultures[culture].name} culture. Height: ${height}`;
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addSacredForests(type, icon, multiplier) {
    const { cells, cultures } = pack;

    let temperateForests = Array.from(
      cells.i.filter(
        (i) =>
          !occupied[i] && cells.culture[i] && [6, 8].includes(cells.biome[i])
      )
    );
    let quantity = getQuantity(temperateForests, 30, 1000, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(temperateForests);
      const id = addMarker({ cell, icon, type });
      const culture = cells.culture[cell];
      const name = `${Names.getCulture(culture)} Forest`;
      const legend = `A sacred forest of ${cultures[culture].name} culture`;
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addSacredPineries(type, icon, multiplier) {
    const { cells, cultures } = pack;

    let borealForests = Array.from(
      cells.i.filter(
        (i) => !occupied[i] && cells.culture[i] && cells.biome[i] === 9
      )
    );
    let quantity = getQuantity(borealForests, 30, 800, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(borealForests);
      const id = addMarker({ cell, icon, type, px: 13 });
      const culture = cells.culture[cell];
      const name = `${Names.getCulture(culture)} Pinery`;
      const legend = `A sacred pinery of ${cultures[culture].name} culture`;
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addSacredPalmGroves(type, icon, multiplier) {
    const { cells, cultures } = pack;

    let borealForests = Array.from(
      cells.i.filter(
        (i) => !occupied[i] && cells.culture[i] && cells.biome[i] === 5
      )
    );
    let quantity = getQuantity(borealForests, 30, 800, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(borealForests);
      const id = addMarker({ cell, icon, type, px: 13 });
      const culture = cells.culture[cell];
      const name = `${Names.getCulture(culture)} Pinery`;
      const legend = `A sacred pinery of ${cultures[culture].name} culture`;
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addSacredCitidel(type, icon, multiplier) {
    const { cells, cultures } = pack;

    let oasises = Array.from(
      cells.i.filter((i) => !occupied[i] && cells.road[i] && cells.h[i] > 40)
    );
    let quantity = getQuantity(oasises, 1, 100, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(oasises);
      const id = addMarker({ cell, icon, type, px: 13 });
      const culture = cells.culture[cell];
      const name = `${Names.getCulture(culture)} Palm Grove`;
      const legend = `A Sacred Citidel of ${cultures[culture].name} culture`;
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addBrigands(type, icon, multiplier) {
    const { cells } = pack;

    let roads = Array.from(
      cells.i.filter(
        (i) => !occupied[i] && cells.culture[i] && cells.road[i] > 4
      )
    );
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
      "Falcons",
    ];
    const types = { brigands: 4, bandits: 3, robbers: 1, highwaymen: 1 };

    while (quantity) {
      const [cell] = extractAnyElement(roads);
      const id = addMarker({ cell, icon, type, px: 13 });
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
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addPirates(type, icon, multiplier) {
    const { cells } = pack;

    let searoutes = Array.from(
      cells.i.filter((i) => !occupied[i] && cells.h[i] < 20 && cells.road[i])
    );
    let quantity = getQuantity(searoutes, 40, 300, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [cell] = extractAnyElement(searoutes);
      const id = addMarker({ cell, icon, type, dx: 51 });
      const name = `Pirates`;
      const legend = `Pirate ships have been spotted in these waters`;
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addStatues(type, icon, multiplier) {
    const { cells } = pack;
    let statues = Array.from(
      cells.i.filter((i) => !occupied[i] && cells.h[i] >= 20 && cells.h[i] < 40)
    );
    let quantity = getQuantity(statues, 80, 1200, multiplier);
    if (!quantity) return;

    const variants = [
      "Statue",
      "Obelisk",
      "Monument",
      "Column",
      "Monolith",
      "Pillar",
      "Megalith",
      "Stele",
      "Runestone",
      "Sculpture",
      "Effigy",
      "Idol",
    ];
    const scripts = {
      cypriot: "𐠁𐠂𐠃𐠄𐠅𐠈𐠊𐠋𐠌𐠍𐠎𐠏𐠐𐠑𐠒𐠓𐠔𐠕𐠖𐠗𐠘𐠙𐠚𐠛𐠜𐠝𐠞𐠟𐠠𐠡𐠢𐠣𐠤𐠥𐠦𐠧𐠨𐠩𐠪𐠫𐠬𐠭𐠮𐠯𐠰𐠱𐠲𐠳𐠴𐠵𐠷𐠸𐠼𐠿     ",
      geez: "ሀለሐመሠረሰቀበተኀነአከወዐዘየደገጠጰጸፀፈፐ   ",
      coptic: "ⲲⲴⲶⲸⲺⲼⲾⳀⳁⳂⳃⳄⳆⳈⳊⳌⳎⳐⳒⳔⳖⳘⳚⳜⳞⳠⳢⳤ⳥⳧⳩⳪ⳫⳬⳭⳲ⳹⳾   ",
      tibetan: "ༀ༁༂༃༄༅༆༇༈༉༊་༌༐༑༒༓༔༕༖༗༘༙༚༛༜༠༡༢༣༤༥༦༧༨༩༪༫༬༭༮༯༰༱༲༳༴༵༶༷༸༹༺༻༼༽༾༿",
      mongolian:
        "᠀᠐᠑᠒ᠠᠡᠦᠧᠨᠩᠪᠭᠮᠯᠰᠱᠲᠳᠵᠻᠼᠽᠾᠿᡀᡁᡆᡍᡎᡏᡐᡑᡒᡓᡔᡕᡖᡗᡙᡜᡝᡞᡟᡠᡡᡭᡮᡯᡰᡱᡲᡳᡴᢀᢁᢂᢋᢏᢐᢑᢒᢓᢛᢜᢞᢟᢠᢡᢢᢤᢥᢦ",
    };

    while (quantity) {
      const [cell] = extractAnyElement(statues);
      const id = addMarker({ cell, icon, type });
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
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addRuines(type, icon, multiplier) {
    const { cells } = pack;
    let ruins = Array.from(
      cells.i.filter(
        (i) =>
          !occupied[i] &&
          cells.culture[i] &&
          cells.h[i] >= 20 &&
          cells.h[i] < 60
      )
    );
    let quantity = getQuantity(ruins, 80, 1200, multiplier);
    if (!quantity) return;

    const types = [
      "City",
      "Town",
      "Settlement",
      "Pyramid",
      "Fort",
      "Stronghold",
      "Temple",
      "Sacred site",
      "Mausoleum",
      "Outpost",
      "Fortification",
      "Fortress",
      "Castle",
    ];

    while (quantity) {
      const [cell] = extractAnyElement(ruins);
      const id = addMarker({ cell, icon, type });

      const ruinType = ra(types);
      const name = `Ruined ${ruinType}`;
      const legend = `Ruins of an ancient ${ruinType.toLowerCase()}. Untold riches may lie within.`;
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  function addPortals(type, icon, multiplier) {
    const { burgs } = pack;
    let portals = burgs
      .slice(1, Math.ceil(burgs.length / 10) + 1)
      .filter(({ cell }) => !occupied[cell])
      .map((burg) => [burg.name, burg.cell]);
    let quantity = getQuantity(portals, 16, 8, multiplier);
    if (!quantity) return;

    while (quantity) {
      const [portal] = extractAnyElement(portals);
      const [burgName, cell] = portal;
      const id = addMarker({ cell, icon, type, px: 14 });
      const name = `${burgName} Portal`;
      const legend = `An element of the magic portal system connecting major cities. Portals installed centuries ago, but still work fine`;
      notes.push({ id, name, legend });
      quantity--;
    }
  }

  return { generate, regenerate, getConfig, setConfig };
})();
