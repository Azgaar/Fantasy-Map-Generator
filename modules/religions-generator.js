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

  const methods = {
    "Random + type": 3,
    "Random + ism": 1,
    "Supreme + ism": 5,
    "Faith of + Supreme": 5,
    "Place + ism": 1,
    "Culture + ism": 2,
    "Place + ian + type": 6,
    "Culture + type": 4
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

  const generate = function () {
    TIME && console.time("generateReligions");
    const {cells, states, cultures} = pack;

    const religionIds = new Uint16Array(cells.culture); // cell religion; initially based on culture
    const religions = [];
    const codes = [];

    // add folk religions
    pack.cultures.forEach(c => {
      const newId = c.i;
      if (!newId) return religions.push({i: 0, name: "No religion"});

      if (c.removed) {
        religions.push({
          i: c.i,
          name: "Extinct religion for " + c.name,
          color: getMixedColor(c.color, 0.1, 0),
          removed: true
        });
        return;
      }

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
          codes.push(lockedFolkReligion.code);
          return;
        }
      }
      
      const newFolk = createFolk(c, codes);
      codes.push(newFolk.code);
      religions.push(newFolk);
    });

    if (religionsInput.value == 0 || pack.cultures.length < 2) {
      religions.filter(r => r.i).forEach(r => (r.code = abbreviate(r.name)));
      cells.religion = religionIds;
      pack.religions = religions;
      return;
    }

    const burgs = pack.burgs.filter(b => b.i && !b.removed);
    const sorted =
      burgs.length > +religionsInput.value
        ? burgs.sort((a, b) => b.population - a.population).map(b => b.cell)
        : cells.i.filter(i => cells.s[i] > 2).sort((a, b) => cells.s[b] - cells.s[a]);

    const religionsTree = d3.quadtree();
    const spacing = (graphWidth + graphHeight) / 6 / religionsInput.value; // base min distance between towns
    const cultsCount = Math.floor((rand(10, 40) / 100) * religionsInput.value);
    const count = +religionsInput.value - cultsCount + religions.length;

    function getReligionsInRadius({x, y, r, max}) {
      if (max === 0) return [0];
      const cellsInRadius = findAll(x, y, r);
      const religions = unique(cellsInRadius.map(i => religionIds[i]).filter(r => r));
      return religions.length ? religions.slice(0, max) : [0];
    }

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
        codes.push(religion.code);
      }
    }

    cells.religion = religionIds;

    // generate organized religions
    for (let i = 0; religions.length < count && i < 1000; i++) {
      let center = sorted[biased(0, sorted.length - 1, 5)]; // religion center
      const form = rw(forms.Organized);
      const state = cells.state[center];
      const culture = cells.culture[center];

      const deity = form === "Non-theism" ? null : getDeityName(culture);
      let [name, expansion] = getReligionName(form, deity, center);
      if (expansion === "state" && !state) expansion = "global";
      if (expansion === "culture" && !culture) expansion = "global";

      if (expansion === "state" && Math.random() > 0.5) center = states[state].center;
      if (expansion === "culture" && Math.random() > 0.5) center = cultures[culture].center;

      if (!cells.burg[center] && cells.c[center].some(c => cells.burg[c]))
        center = cells.c[center].find(c => cells.burg[c]);
      const [x, y] = cells.p[center];

      const s = spacing * gauss(1, 0.3, 0.2, 2, 2); // randomize to make the placement not uniform
      if (religionsTree.find(x, y, s) !== undefined) continue; // to close to existing religion

      // add "Old" to name of the folk religion on this culture
      const isFolkBased = expansion === "culture" || P(0.5);
      const folk = isFolkBased && religions.find(r => r.culture === culture && r.type === "Folk");
      if (folk && expansion === "culture" && folk.name.slice(0, 3) !== "Old") folk.name = "Old " + folk.name;

      const origins = folk ? [folk.i] : getReligionsInRadius({x, y, r: 150 / count, max: 2});
      const expansionism = rand(3, 8);
      const baseColor = religions[culture]?.color || states[state]?.color || getRandomColor();
      const color = getMixedColor(baseColor, 0.3, 0);
      const code = abbreviate(name, codes);

      codes.push(code);
      religions.push({
        i: religions.length,
        name,
        color,
        culture,
        type: "Organized",
        form,
        deity,
        expansion,
        expansionism,
        center,
        origins,
        code
      });
      religionsTree.add([x, y]);
    }

    // generate cults
    for (let i = 0; religions.length < count + cultsCount && i < 1000; i++) {
      const form = rw(forms.Cult);
      let center = sorted[biased(0, sorted.length - 1, 1)]; // religion center
      if (!cells.burg[center] && cells.c[center].some(c => cells.burg[c]))
        center = cells.c[center].find(c => cells.burg[c]);
      const [x, y] = cells.p[center];

      const s = spacing * gauss(2, 0.3, 1, 3, 2); // randomize to make the placement not uniform
      if (religionsTree.find(x, y, s) !== undefined) continue; // to close to existing religion

      const culture = cells.culture[center];
      const origins = getReligionsInRadius({x, y, r: 300 / count, max: rand(0, 4)});

      const deity = getDeityName(culture);
      const name = getCultName(form, center);
      const expansionism = gauss(1.1, 0.5, 0, 5);
      const color = getMixedColor(cultures[culture].color, 0.5, 0); // "url(#hatch7)";
      const code = abbreviate(name, codes);
      codes.push(code);
      religions.push({
        i: religions.length,
        name,
        color,
        culture,
        type: "Cult",
        form,
        deity,
        expansion: "global",
        expansionism,
        center,
        origins,
        code
      });
      religionsTree.add([x, y]);
    }

    pack.religions = religions;

    expandReligions();

    // generate heresies
    religions
      .filter(r => r.type === "Organized")
      .forEach(r => {
        if (r.expansionism < 3) return;
        const count = gauss(0, 1, 0, 3);
        for (let i = 0; i < count; i++) {
          let center = ra(cells.i.filter(i => religionIds[i] === r.i && cells.c[i].some(c => religionIds[c] !== r.i)));
          if (!center) continue;
          if (!cells.burg[center] && cells.c[center].some(c => cells.burg[c]))
            center = cells.c[center].find(c => cells.burg[c]);
          const [x, y] = cells.p[center];
          if (religionsTree.find(x, y, spacing / 10) !== undefined) continue; // to close to other

          const culture = cells.culture[center];
          const name = getCultName("Heresy", center);
          const expansionism = gauss(1.2, 0.5, 0, 5);
          const color = getMixedColor(r.color, 0.4, 0.2); // "url(#hatch6)";
          const code = abbreviate(name, codes);
          codes.push(code);
          pack.religions.push({
            i: pack.religions.length,
            name,
            color,
            culture,
            type: "Heresy",
            form: r.form,
            deity: r.deity,
            expansion: "global",
            expansionism,
            center,
            origins: [r.i],
            code
          });
          religionsTree.add([x, y]);
        }
      });

    expandHeresies();

    checkCenters();

    TIME && console.timeEnd("generateReligions");
  };
  
  function createFolk(c, codes) {

    const form = rw(forms.Folk);
    const name = c.name + " " + rw(types[form]);
    const deity = form === "Animism" ? null : getDeityName(c.i);
    const color = getMixedColor(c.color, 0.1, 0);
    const code = abbreviate(name, codes);
    return {
      i: c.i,
      name,
      color,
      culture: c.i,
      type: "Folk",
      form,
      deity,
      center: c.center,
      origins: [0],
      code
    };
  }

  // growth algorithm to assign cells to religions
  function expandReligions() {
    const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
    const cost = [];
    const religionIds = pack.cells.religion;
    const {cells, religions} = pack;

    religions
      .filter(r => !r.lock && (r.type === "Organized" || r.type === "Cult"))
      .forEach(r => {
        religionIds[r.center] = r.i;
        queue.queue({e: r.center, p: 0, r: r.i, s: cells.state[r.center], c: r.culture});
        cost[r.center] = 1;
      });

    const neutral = (cells.i.length / 5000) * 200 * gauss(1, 0.3, 0.2, 2, 2) * neutralInput.value; // limit cost for organized religions growth
    const popCost = d3.max(cells.pop) / 3; // enougth population to spered religion without penalty

    while (queue.length) {
      const {e, p, r, c, s} = queue.dequeue();
      const expansion = religions[r].expansion;

      cells.c[e].forEach(nextCell => {
        if (expansion === "culture" && c !== cells.culture[nextCell]) return;
        if (expansion === "state" && s !== cells.state[nextCell]) return;
        if (religions[religionIds[nextCell]]?.lock) return;

        const cultureCost = c !== cells.culture[nextCell] ? 10 : 0;
        const stateCost = s !== cells.state[nextCell] ? 10 : 0;
        const biomeCost = cells.road[nextCell] ? 1 : biomesData.cost[cells.biome[nextCell]];
        const populationCost = Math.max(rn(popCost - cells.pop[nextCell]), 0);
        const heightCost = Math.max(cells.h[nextCell], 20) - 20;
        const waterCost = cells.h[nextCell] < 20 ? (cells.road[nextCell] ? 50 : 1000) : 0;
        const totalCost =
          p +
          (cultureCost + stateCost + biomeCost + populationCost + heightCost + waterCost) / religions[r].expansionism;
        if (totalCost > neutral) return;

        if (!cost[nextCell] || totalCost < cost[nextCell]) {
          if (cells.h[nextCell] >= 20 && cells.culture[nextCell]) religionIds[nextCell] = r; // assign religion to cell
          cost[nextCell] = totalCost;
          queue.queue({e: nextCell, p: totalCost, r, c, s});
        }
      });
    }
  }

  // growth algorithm to assign cells to heresies
  function expandHeresies() {
    const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
    const cost = [];
    const religionIds = pack.cells.religion;
    const {cells, religions} = pack;

    religions
      .filter(r => !r.lock && r.type === "Heresy")
      .forEach(r => {
        const b = religionIds[r.center]; // "base" religion id
        religionIds[r.center] = r.i; // heresy id
        queue.queue({e: r.center, p: 0, r: r.i, b});
        cost[r.center] = 1;
      });

    const neutral = (cells.i.length / 5000) * 500 * neutralInput.value; // limit cost for heresies growth

    while (queue.length) {
      const {e, p, r, b} = queue.dequeue();

      cells.c[e].forEach(nextCell => {
        if (religions[religionIds[nextCell]]?.lock) return;
        const religionCost = religionIds[nextCell] === b ? 0 : 2000;
        const biomeCost = cells.road[nextCell] ? 0 : biomesData.cost[cells.biome[nextCell]];
        const heightCost = Math.max(cells.h[nextCell], 20) - 20;
        const waterCost = cells.h[nextCell] < 20 ? (cells.road[nextCell] ? 50 : 1000) : 0;
        const totalCost =
          p + (religionCost + biomeCost + heightCost + waterCost) / Math.max(religions[r].expansionism, 0.1);

        if (totalCost > neutral) return;

        if (!cost[nextCell] || totalCost < cost[nextCell]) {
          if (cells.h[nextCell] >= 20 && cells.culture[nextCell]) religionIds[nextCell] = r; // assign religion to cell
          cost[nextCell] = totalCost;
          queue.queue({e: nextCell, p: totalCost, r});
        }
      });
    }
  }

  function checkCenters() {
    const cells = pack.cells;
    pack.religions.forEach(r => {
      if (!r.i) return;
      // move religion center if it's not within religion area after expansion
      if (r.type==="Folk" || cells.religion[r.center] === r.i) return; // in area, or non-expanding
      const firstCell = cells.i.find(i => cells.religion[i] === r.i);
      if (firstCell) r.center = firstCell; // move center, othervise it's an extinct religion
    });
  }

  function recalculate() {
    const {religion, culture} = pack.cells;
    // start with the culutres map, but also keep locked religions
    for(const i of pack.cells.i){
      if( !pack.religions[religion[i]]?.lock ){
        religion[i] = culture[i];
      }
    }
    
    expandReligions();
    expandHeresies();
    
    checkCenters();
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
      type === "Heresy" ? religions[religionId].deity : form === "Non-theism" ? null : getDeityName(culture);

    let name, expansion;
    if (type === "Organized") [name, expansion] = getReligionName(form, deity, center);
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

  const addFolk = function (center) {
    const {cultures, religions, cells} = pack;

    const c = cultures.find(c => !c.removed && c.center === center);
    const codes = religions.map(r => r.code);
    const newFolk = createFolk(c, codes);

    if(c.i < religions.length){
      // move an existing organized religion to the end of the array
      const rCargo = religions[c.i];
      if(!rCargo.removed && rCargo.type != "Folk") {
        const newId = religions.length;
        rCargo.i = newId;

        for(const i of cells.i) {
          if(cells.religion[i] = c.i) {
            cells.religion[i] = newId;
          }
        }
        religions.forEach(r => {
          if (r.i === 0) return;
          for(let j = 0; j < r.origins.length; j++) {
            if(r.origins[j] === c.i) {
              r.origins[j] === newId;
              return;
            }
          }
        });
        
        religions.push(rCargo);
      }
      
      religions[c.i] = newFolk;
    } 
    else religions.push(newFolk);
  };

  function updateCultures() {
    TIME && console.time("updateCulturesForReligions");
    const {religions, cultures, cells} = pack;
    
    const tReligions = [];
    const spareCovenants = [];
    const codes = religions.filter(r => !r.removed).map(r => r.code);
    
    tReligions.push(religions[0]);
    for (let i = 1; i < cultures.length; i++) {
      const faith = religions.find(r => r.i === i);
      if (faith && !faith.removed) {
        if (faith.type === "Folk") {
          tReligions.push(faith);
          continue;
        }
        else spareCovenants.push(faith);
      }
      const newFolk = createFolk(cultures[i], codes);
      tReligions.push(newFolk);
      codes.push(newFolk.code);
    }
    for (let i = cultures.length; i < religions.length; i++) {
      const faith = religions.find(r => r.i === i);
      if (faith) {
        if (faith.type === "Folk" && !faith.lock)
          tReligions.push({...faith, removed: true});
        else tReligions.push(faith);
      }
      else tReligions.push({
          i, 
          name: "filler index",
          origins: [null],
          removed: true
        });
    }
    
    const updateMap = [];
    for (let k = 0; k < spareCovenants.length; k++) {
      const sc = spareCovenants[k];
      const newId = tReligions.length;
      
      for (const i of cells.i) {
        if (cells.religion[i] = sc.i) {
          cells.religion[i] = newId;
        }
      }
      
      updateMap.push({oldId: sc.i, newId});
      tReligions.forEach(r => {
        if (r.i === 0) return;
        for (let i = 0; i < r.origins.length; i++) {
          if (r.origins[i] === sc.i) {
            r.origins[i] === newId;
            return;
          }
        }
      });
      // update origins from other spareCovenants
      for (let i = 0; i < sc.origins.length; i++) {
        const changeRule = updateMap.find(u => u.oldId === sc.origins[i])
        if (changeRule) sc.origins[i] = changeRule.newId;
      }
      tReligions.push({...sc, i: newId});
    }
    
    pack.religions = tReligions;
    
    pack.religions.forEach(r => {
      if (r.i === 0) return;
      
      if (r.origins?.length < 1) r.origins = [0];
      
      if (r.type === "Folk" && cultures[r.i]) {
        r.center = cultures[r.i].center;
      }
      else {
        r.culture = cells.culture[r.center];
      }
    });
    TIME && console.timeEnd("updateCulturesForReligions");
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
    if (a === "Color + Animal") return ra(base.color) + " " + ra(base.animal);
    if (a === "Adjective + Animal") return ra(base.adjective) + " " + ra(base.animal);
    if (a === "Adjective + Being") return ra(base.adjective) + " " + ra(base.being);
    if (a === "Adjective + Genitive") return ra(base.adjective) + " " + ra(base.genitive);
    if (a === "Color + Being") return ra(base.color) + " " + ra(base.being);
    if (a === "Color + Genitive") return ra(base.color) + " " + ra(base.genitive);
    if (a === "Being + of + Genitive") return ra(base.being) + " of " + ra(base.genitive);
    if (a === "Being + of the + Genitive") return ra(base.being) + " of the " + ra(base.theGenitive);
    if (a === "Animal + of + Genitive") return ra(base.animal) + " of " + ra(base.genitive);
    if (a === "Adjective + Being + of + Genitive")
      return ra(base.adjective) + " " + ra(base.being) + " of " + ra(base.genitive);
    if (a === "Adjective + Animal + of + Genitive")
      return ra(base.adjective) + " " + ra(base.animal) + " of " + ra(base.genitive);
  }

  function getReligionName(form, deity, center) {
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

    const m = rw(methods);
    if (m === "Random + type") return [random() + " " + type(), "global"];
    if (m === "Random + ism") return [trimVowels(random()) + "ism", "global"];
    if (m === "Supreme + ism" && deity) return [trimVowels(supreme()) + "ism", "global"];
    if (m === "Faith of + Supreme" && deity)
      return [ra(["Faith", "Way", "Path", "Word", "Witnesses"]) + " of " + supreme(), "global"];
    if (m === "Place + ism") return [place() + "ism", "state"];
    if (m === "Culture + ism") return [trimVowels(culture()) + "ism", "culture"];
    if (m === "Place + ian + type") return [place("adj") + " " + type(), "state"];
    if (m === "Culture + type") return [culture() + " " + type(), "culture"];
    return [trimVowels(random()) + "ism", "global"]; // else
  }

  function getCultName(form, center) {
    const cells = pack.cells;
    const type = function () {
      return rw(types[form]);
    };
    const random = function () {
      return trimVowels(Names.getCulture(cells.culture[center], null, null, "", 0).split(/[ ,]+/)[0]);
    };
    const burg = function () {
      return trimVowels(pack.burgs[cells.burg[center]].name.split(/[ ,]+/)[0]);
    };
    if (cells.burg[center]) return burg() + "ian " + type();
    if (Math.random() > 0.5) return random() + "ian " + type();
    return type() + " of the " + generateMeaning();
  }

  return {generate, add, addFolk, getDeityName, updateCultures, recalculate};
})();
