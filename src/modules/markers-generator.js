import * as d3 from "d3";

import {TIME} from "config/logging";
import {last} from "utils/arrayUtils";
import {rn} from "utils/numberUtils";
import {rand, P, gauss, ra, rw} from "utils/probabilityUtils";
import {capitalize} from "utils/stringUtils";
import {convertTemperature, getFriendlyHeight, getBurgPopulation} from "utils/unitUtils";
import {getAdjective} from "utils/languageUtils";

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

  const regenerate = () => {
    pack.markers = pack.markers.filter(({i, lock, cell}) => {
      if (lock) {
        occupied[cell] = true;
        return true;
      }
      const id = `marker${i}`;
      document.getElementById(id)?.remove();
      const index = notes.findIndex(note => note.id === id);
      if (index != -1) notes.splice(index, 1);
      return false;
    });

    generateTypes();
  };

  const add = marker => {
    const base = config.find(c => c.type === marker.type);
    if (base) {
      const {icon, type, dx, dy, px} = base;
      marker = addMarker({icon, type, dx, dy, px}, marker);
      base.add("marker" + marker.i, marker.cell);
      return marker;
    }

    const i = last(pack.markers)?.i + 1 || 0;
    pack.markers.push({...marker, i});
    occupied[marker.cell] = true;
    return {...marker, i};
  };

  function generateTypes() {
    TIME && console.time("addMarkers");

    config.forEach(({type, icon, dx, dy, px, min, each, multiplier, list, add}) => {
      if (multiplier === 0) return;

      let candidates = Array.from(list(pack));
      let quantity = getQuantity(candidates, min, each, multiplier);
      // uncomment for debugging:
      // console.log(`${icon} ${type}: each ${each} of ${candidates.length}, min ${min} candidates. Got ${quantity}`);

      while (quantity && candidates.length) {
        const [cell] = extractAnyElement(candidates);
        const marker = addMarker({icon, type, dx, dy, px}, {cell});
        add("marker" + marker.i, cell);
        quantity--;
      }
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
    const {cells, burgs} = pack;
    const burgId = cells.burg[cell];

    if (burgId) {
      const {x, y} = burgs[burgId];
      return [x, y];
    }

    return cells.p[cell];
  }

  function addMarker(base, marker) {
    const i = last(pack.markers)?.i + 1 || 0;
    const [x, y] = getMarkerCoordinates(marker.cell);
    marker = {...base, x, y, ...marker, i};
    pack.markers.push(marker);
    occupied[marker.cell] = true;
    return marker;
  }

  function deleteMarker(markerId) {
    const noteId = "marker" + markerId;
    notes = notes.filter(note => note.id !== noteId);
    pack.markers = pack.markers.filter(m => m.i !== markerId);
  }

  function listVolcanoes({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] >= 70);
  }

  function addVolcano(id, cell) {
    const {cells} = pack;

    const proper = Names.getCulture(cells.culture[cell]);
    const name = P(0.3) ? "Mount " + proper : Math.random() > 0.3 ? proper + " Volcano" : proper;
    notes.push({id, name, legend: `Active volcano. Height: ${getFriendlyHeight(cells.p[cell])}`});
  }

  function listHotSprings({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] > 50);
  }

  function addHotSpring(id, cell) {
    const {cells} = pack;

    const proper = Names.getCulture(cells.culture[cell]);
    const temp = convertTemperature(gauss(35, 15, 20, 100));
    notes.push({id, name: proper + " Hot Springs", legend: `A hot springs area. Average temperature: ${temp}`});
  }

  function listMines({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] > 47 && cells.burg[i]);
  }

  function addMine(id, cell) {
    const {cells} = pack;

    const resources = {salt: 5, gold: 2, silver: 4, copper: 2, iron: 3, lead: 1, tin: 1};
    const resource = rw(resources);
    const burg = pack.burgs[cells.burg[cell]];
    const name = `${burg.name} — ${resource} mining town`;
    const population = getBurgPopulation(burg.population);
    const legend = `${burg.name} is a mining town of ${population} people just nearby the ${resource} mine`;
    notes.push({id, name, legend});
  }

  function listBridges({cells, burgs}) {
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
  }

  function addBridge(id, cell) {
    const {cells} = pack;

    const burg = pack.burgs[cells.burg[cell]];
    const river = pack.rivers.find(r => r.i === pack.cells.r[cell]);
    const riverName = river ? `${river.name} ${river.type}` : "river";
    const name = river && P(0.2) ? `${river.name} Bridge` : `${burg.name} Bridge`;
    const weightedAdjectives = {
      stone: 10,
      wooden: 1,
      lengthy: 2,
      formidable: 2,
      rickety: 1,
      beaten: 1,
      weathered: 1
    };
    const barriers = [
      "collapse during the flood",
      "being rumoured to attract trolls",
      "the drying up of local trade",
      "banditry infested the area",
      "the old waypoints crumbled"
    ];
    const legend = P(0.7)
      ? `A ${rw(weightedAdjectives)} bridge spans over the ${riverName} near ${burg.name}`
      : `An old crossing of the ${riverName}, rarely used since ${ra(barriers)}`;

    notes.push({id, name, legend});
  }

  function listInns({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] >= 20 && cells.road[i] > 4 && cells.pop[i] > 10);
  }

  function addInn(id, cell) {
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

    const typeName = P(0.3) ? "inn" : "tavern";
    const isAnimalThemed = P(0.7);
    const animal = ra(animals);
    const name = isAnimalThemed
      ? P(0.6)
        ? ra(colors) + " " + animal
        : ra(adjectives) + " " + animal
      : ra(adjectives) + " " + capitalize(typeName);
    const meal = isAnimalThemed && P(0.3) ? animal : ra(courses);
    const course = `${ra(methods)} ${meal}`.toLowerCase();
    const drink = `${P(0.5) ? ra(types) : ra(colors)} ${ra(drinks)}`.toLowerCase();
    const legend = `A big and famous roadside ${typeName}. Delicious ${course} with ${drink} is served here`;
    notes.push({id, name: "The " + name, legend});
  }

  function listLighthouses({cells}) {
    return cells.i.filter(
      i => !occupied[i] && cells.harbor[i] > 6 && cells.c[i].some(c => cells.h[c] < 20 && cells.road[c])
    );
  }

  function addLighthouse(id, cell) {
    const {cells} = pack;

    const proper = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name : Names.getCulture(cells.culture[cell]);
    notes.push({
      id,
      name: getAdjective(proper) + " Lighthouse" + name,
      legend: `A lighthouse to serve as a beacon for ships in the open sea`
    });
  }

  function listWaterfalls({cells}) {
    return cells.i.filter(
      i => cells.r[i] && !occupied[i] && cells.h[i] >= 50 && cells.c[i].some(c => cells.h[c] < 40 && cells.r[c])
    );
  }

  function addWaterfall(id, cell) {
    const {cells} = pack;

    const descriptions = [
      "A gorgeous waterfall flows here",
      "The rapids of an exceptionally beautiful waterfall",
      "An impressive waterfall has cut through the land",
      "The cascades of a stunning waterfall",
      "A river drops down from a great height forming a wonderous waterfall",
      "A breathtaking waterfall cuts through the landscape"
    ];

    const proper = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name : Names.getCulture(cells.culture[cell]);
    notes.push({id, name: getAdjective(proper) + " Waterfall" + name, legend: `${ra(descriptions)}`});
  }

  function listBattlefields({cells}) {
    return cells.i.filter(
      i => !occupied[i] && cells.state[i] && cells.pop[i] > 2 && cells.h[i] < 50 && cells.h[i] > 25
    );
  }

  function addBattlefield(id, cell) {
    const {cells, states} = pack;

    const state = states[cells.state[cell]];
    if (!state.campaigns) state.campaigns = BurgsAndStates.generateCampaign(state);
    const campaign = ra(state.campaigns);
    const date = generateDate(campaign.start, campaign.end);
    const name = Names.getCulture(cells.culture[cell]) + " Battlefield";
    const legend = `A historical battle of the ${campaign.name}. \r\nDate: ${date} ${options.era}`;
    notes.push({id, name, legend});
  }

  function generateDate(from = 100, to = 1000) {
    return new Date(rand(from, to), rand(12), rand(31)).toLocaleDateString("en", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function listDungeons({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.pop[i] && cells.pop[i] < 3);
  }

  function addDungeon(id, cell) {
    const dungeonSeed = `${seed}${cell}`;
    const name = "Dungeon";
    const legend = `<div>Undiscovered dungeon. See <a href="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" target="_blank">One page dungeon</a></div><iframe src="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" sandbox="allow-scripts allow-same-origin"></iframe>`;
    notes.push({id, name, legend});
  }

  function listLakeMonsters({features}) {
    return features
      .filter(feature => feature.type === "lake" && feature.group === "freshwater" && !occupied[feature.firstCell])
      .map(feature => feature.firstCell);
  }

  function addLakeMonster(id, cell) {
    const lake = pack.features[pack.cells.f[cell]];

    // Check that the feature is a lake in case the user clicked on a wrong
    // square
    if (lake.type !== "lake") return;

    const name = `${lake.name} Monster`;
    const length = gauss(10, 5, 5, 100);
    const legend = `Rumors say a relic monster of ${length} ${heightUnit.value} long inhabits ${lake.name} Lake. Truth or lie, folks are afraid to fish in the lake`;
    notes.push({id, name, legend});
  }

  function listSeaMonsters({cells, features}) {
    return cells.i.filter(
      i => !occupied[i] && cells.h[i] < 20 && cells.road[i] && features[cells.f[i]].type === "ocean"
    );
  }

  function addSeaMonster(id, cell) {
    const name = `${Names.getCultureShort(0)} Monster`;
    const length = gauss(25, 10, 10, 100);
    const legend = `Old sailors tell stories of a gigantic sea monster inhabiting these dangerous waters. Rumors say it can be ${length} ${heightUnit.value} long`;
    notes.push({id, name, legend});
  }

  function listHillMonsters({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] >= 50 && cells.pop[i]);
  }

  function addHillMonster(id, cell) {
    const {cells} = pack;

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
      "feared"
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
      "Tales"
    ];
    const species = [
      "Ogre",
      "Troll",
      "Cyclops",
      "Giant",
      "Monster",
      "Beast",
      "Dragon",
      "Undead",
      "Ghoul",
      "Vampire",
      "Hag",
      "Banshee",
      "Bearded Devil",
      "Roc",
      "Hydra",
      "Warg"
    ];
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

    const monster = ra(species);
    const toponym = Names.getCulture(cells.culture[cell]);
    const name = `${toponym} ${monster}`;
    const legend = `${ra(subjects)} speak of a ${ra(adjectives)} ${monster} who inhabits ${toponym} hills and ${ra(
      modusOperandi
    )}`;
    notes.push({id, name, legend});
  }

  // Sacred mountains spawn on lonely mountains
  function listSacredMountains({cells}) {
    return cells.i.filter(
      i =>
        !occupied[i] &&
        cells.h[i] >= 70 &&
        cells.c[i].some(c => cells.culture[c]) &&
        cells.c[i].every(c => cells.h[c] < 60)
    );
  }

  function addSacredMountain(id, cell) {
    const {cells, cultures} = pack;

    const culture = cells.c[cell].map(c => cells.culture[c]).find(c => c);
    const name = `${Names.getCulture(culture)} Mountain`;
    const height = getFriendlyHeight(cells.p[cell]);
    const legend = `A sacred mountain of ${cultures[culture].name} culture. Height: ${height}`;
    notes.push({id, name, legend});
  }

  // Sacred forests spawn on temperate forests
  function listSacredForests({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.culture[i] && [6, 8].includes(cells.biome[i]));
  }

  function addSacredForest(id, cell) {
    const {cells, cultures} = pack;

    const culture = cells.culture[cell];
    const name = `${Names.getCulture(culture)} Forest`;
    const legend = `A sacred forest of ${cultures[culture].name} culture`;
    notes.push({id, name, legend});
  }

  // Sacred pineries spawn on boreal forests
  function listSacredPineries({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.culture[i] && cells.biome[i] === 9);
  }

  function addSacredPinery(id, cell) {
    const {cells, cultures} = pack;

    const culture = cells.culture[cell];
    const name = `${Names.getCulture(culture)} Pinery`;
    const legend = `A sacred pinery of ${cultures[culture].name} culture`;
    notes.push({id, name, legend});
  }

  // Sacred palm groves spawn on oasises
  function listSacredPalmGroves({cells}) {
    return cells.i.filter(
      i => !occupied[i] && cells.culture[i] && cells.biome[i] === 1 && cells.pop[i] > 1 && cells.road[i]
    );
  }

  function addSacredPalmGrove(id, cell) {
    const {cells, cultures} = pack;

    const culture = cells.culture[cell];
    const name = `${Names.getCulture(culture)} Palm Grove`;
    const legend = `A sacred palm grove of ${cultures[culture].name} culture`;
    notes.push({id, name, legend});
  }

  function listBrigands({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.culture[i] && cells.road[i] > 4);
  }

  function addBrigands(id, cell) {
    const {cells} = pack;

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
  }

  // Pirates spawn on sea routes
  function listPirates({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] < 20 && cells.road[i]);
  }

  function addPirates(id, cell) {
    const name = `Pirates`;
    const legend = `Pirate ships have been spotted in these waters`;
    notes.push({id, name, legend});
  }

  function listStatues({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] >= 20 && cells.h[i] < 40);
  }

  function addStatue(id, cell) {
    const {cells} = pack;

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
      "Idol"
    ];
    const scripts = {
      cypriot: "𐠁𐠂𐠃𐠄𐠅𐠈𐠊𐠋𐠌𐠍𐠎𐠏𐠐𐠑𐠒𐠓𐠔𐠕𐠖𐠗𐠘𐠙𐠚𐠛𐠜𐠝𐠞𐠟𐠠𐠡𐠢𐠣𐠤𐠥𐠦𐠧𐠨𐠩𐠪𐠫𐠬𐠭𐠮𐠯𐠰𐠱𐠲𐠳𐠴𐠵𐠷𐠸𐠼𐠿     ",
      geez: "ሀለሐመሠረሰቀበተኀነአከወዐዘየደገጠጰጸፀፈፐ   ",
      coptic: "ⲲⲴⲶⲸⲺⲼⲾⳀⳁⳂⳃⳄⳆⳈⳊⳌⳎⳐⳒⳔⳖⳘⳚⳜⳞⳠⳢⳤ⳥⳧⳩⳪ⳫⳬⳭⳲ⳹⳾   ",
      tibetan: "ༀ༁༂༃༄༅༆༇༈༉༊་༌༐༑༒༓༔༕༖༗༘༙༚༛༜༠༡༢༣༤༥༦༧༨༩༪༫༬༭༮༯༰༱༲༳༴༵༶༷༸༹༺༻༼༽༾༿",
      mongolian: "᠀᠐᠑᠒ᠠᠡᠦᠧᠨᠩᠪᠭᠮᠯᠰᠱᠲᠳᠵᠻᠼᠽᠾᠿᡀᡁᡆᡍᡎᡏᡐᡑᡒᡓᡔᡕᡖᡗᡙᡜᡝᡞᡟᡠᡡᡭᡮᡯᡰᡱᡲᡳᡴᢀᢁᢂᢋᢏᢐᢑᢒᢓᢛᢜᢞᢟᢠᢡᢢᢤᢥᢦ"
    };

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
  }

  function listRuins({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.culture[i] && cells.h[i] >= 20 && cells.h[i] < 60);
  }

  function addRuins(id, cell) {
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
      "Castle"
    ];

    const ruinType = ra(types);
    const name = `Ruined ${ruinType}`;
    const legend = `Ruins of an ancient ${ruinType.toLowerCase()}. Untold riches may lie within`;
    notes.push({id, name, legend});
  }

  function listCircuses({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.culture[i] && cells.h[i] >= 20 && pack.cells.road[i]);
  }

  function addCircuses(id, cell) {
    const adjectives = [
      "Fantastical",
      "Wonderous",
      "Incomprehensible",
      "Magical",
      "Extraordinary",
      "Unmissable",
      "World-famous",
      "Breathtaking"
    ];

    const adjective = ra(adjectives);
    const name = `Travelling ${adjective} Circus`;
    const legend = `Roll up, roll up, this ${adjective.toLowerCase()} circus is here for a limited time only`;
    notes.push({id, name, legend});
  }

  function listJousts({cells, burgs}) {
    return cells.i.filter(i => !occupied[i] && cells.burg[i] && burgs[cells.burg[i]].population > 20);
  }

  function addJousts(id, cell) {
    const {cells, burgs} = pack;
    const types = ["Joust", "Competition", "Melee", "Tournament", "Contest"];
    const virtues = ["cunning", "might", "speed", "the greats", "acumen", "brutality"];

    if (!cells.burg[cell]) return;
    const burgName = burgs[cells.burg[cell]].name;
    const type = ra(types);
    const virtue = ra(virtues);

    const name = `${burgName} ${type}`;
    const legend = `Warriors from around the land gather for a ${type.toLowerCase()} of ${virtue} in ${burgName}, with fame, fortune and favour on offer to the victor`;
    notes.push({id, name, legend});
  }

  function listCanoes({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.r[i]);
  }

  function addCanoes(id, cell) {
    const river = pack.rivers.find(r => r.i === pack.cells.r[cell]);

    const name = `Minor Jetty`;
    const riverName = river ? `${river.name} ${river.type}` : "river";
    const legend = `A small location along the ${riverName} to launch boats from sits here, along with a weary looking owner, willing to sell passage along the river`;
    notes.push({id, name, legend});
  }

  function listMigrations({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] >= 20 && cells.pop[i] <= 2);
  }

  function addMigrations(id, cell) {
    const animals = [
      "Antelopes",
      "Apes",
      "Badgers",
      "Bears",
      "Beavers",
      "Bisons",
      "Boars",
      "Buffalo",
      "Cats",
      "Cranes",
      "Crocodiles",
      "Crows",
      "Deer",
      "Dogs",
      "Eagles",
      "Elk",
      "Foxes",
      "Goats",
      "Geese",
      "Hares",
      "Hawks",
      "Herons",
      "Horses",
      "Hyenas",
      "Ibises",
      "Jackals",
      "Jaguars",
      "Larks",
      "Leopards",
      "Lions",
      "Mantises",
      "Martens",
      "Mooses",
      "Mules",
      "Owls",
      "Panthers",
      "Rats",
      "Ravens",
      "Rooks",
      "Scorpions",
      "Sharks",
      "Sheep",
      "Snakes",
      "Spiders",
      "Tigers",
      "Wolves",
      "Wolverines",
      "Camels",
      "Falcons",
      "Hounds",
      "Oxen"
    ];
    const animalChoice = ra(animals);

    const name = `${animalChoice} migration`;
    const legend = `A huge group of ${animalChoice.toLowerCase()} are migrating, whether part of their annual routine, or something more extraordinary`;
    notes.push({id, name, legend});
  }

  function listDances({cells, burgs}) {
    return cells.i.filter(i => !occupied[i] && cells.burg[i] && burgs[cells.burg[i]].population > 15);
  }

  function addDances(id, cell) {
    const {cells, burgs} = pack;
    const burgName = burgs[cells.burg[cell]].name;
    const socialTypes = [
      "gala",
      "dance",
      "performance",
      "ball",
      "soiree",
      "jamboree",
      "exhibition",
      "carnival",
      "festival",
      "jubilee"
    ];
    const people = [
      "great and the good",
      "nobility",
      "local elders",
      "foreign dignitaries",
      "spiritual leaders",
      "suspected revolutionaries"
    ];
    const socialType = ra(socialTypes);

    const name = `${burgName} ${socialType}`;
    const legend = `A ${socialType} has been organised at ${burgName} as a chance to gather the ${ra(
      people
    )} of the area together to be merry, make alliances and scheme around the crisis`;
    notes.push({id, name, legend});
  }

  function listMirage({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.biome[i] === 1);
  }

  function addMirage(id, cell) {
    const adjectives = ["Entrancing", "Diaphanous", "Illusory", "Distant", "Perculiar"];

    const mirageAdjective = ra(adjectives);
    const name = `${mirageAdjective} mirage`;
    const legend = `This ${mirageAdjective.toLowerCase()} mirage has been luring travellers out of their way for eons`;
    notes.push({id, name, legend});
  }
  function listPortals({burgs}) {
    return burgs
      .slice(1, Math.ceil(burgs.length / 10) + 1)
      .filter(({cell}) => !occupied[cell])
      .map(burg => burg.cell);
  }

  function addPortal(id, cell) {
    const {cells, burgs} = pack;

    if (!cells.burg[cell]) return;
    const burgName = burgs[cells.burg[cell]].name;

    const name = `${burgName} Portal`;
    const legend = `An element of the magic portal system connecting major cities. The portals were installed centuries ago, but still work fine`;
    notes.push({id, name, legend});
  }

  function listRifts({cells}) {
    return cells.i.filter(i => !occupied[i] && pack.cells.pop[i] <= 3 && biomesData.habitability[pack.cells.biome[i]]);
  }

  function addRifts(id, cell) {
    const types = ["Demonic", "Interdimensional", "Abyssal", "Cosmic", "Cataclysmic", "Subterranean", "Ancient"];

    const descriptions = [
      "all known nearby beings to flee in terror",
      "cracks in reality itself to form",
      "swarms of foes to spill forth",
      "the life of nearby plants to wither and decay",
      "an emmissary to step through with an all-powerful relic"
    ];

    const riftType = ra(types);
    const name = `${riftType} Rift`;
    const legend = `A rumoured ${riftType.toLowerCase()} rift in this area is causing ${ra(descriptions)}.`;
    notes.push({id, name, legend});
  }

  return {add, generate, regenerate, getConfig, setConfig, deleteMarker};
})();
