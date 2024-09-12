"use strict";

window.Zones = (function () {
  const config = {
    invasion: {quantity: 2, generate: addInvasion}, // invasion of enemy lands
    rebels: {quantity: 1.5, generate: addRebels}, // rebels along a state border
    proselytism: {quantity: 1.6, generate: addProselytism}, // proselitism of organized religion
    crusade: {quantity: 1.6, generate: addCrusade}, // crusade on heresy lands
    disease: {quantity: 1.4, generate: addDisease}, // disease starting in a random city
    disaster: {quantity: 1, generate: addDisaster}, // disaster starting in a random city
    eruption: {quantity: 1, generate: addEruption}, // eruption aroung volcano
    avalanche: {quantity: 0.8, generate: addAvalanche}, // avalanche impacting highland road
    fault: {quantity: 1, generate: addFault}, // fault line in elevated areas
    flood: {quantity: 1, generate: addFlood}, // flood on river banks
    tsunami: {quantity: 1, generate: addTsunami} // tsunami starting near coast
  };

  const generate = function (globalModifier = 1) {
    TIME && console.time("generateZones");

    const usedCells = new Uint8Array(pack.cells.i.length);
    pack.zones = [];

    Object.values(config).forEach(type => {
      const expectedNumber = type.quantity * globalModifier;
      let number = gauss(expectedNumber, expectedNumber / 2, 0, 100);
      while (number--) type.generate(usedCells);
    });

    TIME && console.timeEnd("generateZones");
  };

  function addInvasion(usedCells) {
    const {cells, states} = pack;

    const ongoingConflicts = states
      .filter(s => s.i && !s.removed && s.campaigns)
      .map(s => s.campaigns)
      .flat()
      .filter(c => !c.end);
    if (!ongoingConflicts.length) return;
    const {defender, attacker} = ra(ongoingConflicts);

    const borderCells = cells.i.filter(cellId => {
      if (usedCells[cellId]) return false;
      if (cells.state[cellId] !== defender) return false;
      return cells.c[cellId].some(c => cells.state[c] === attacker);
    });

    const startCell = ra(borderCells);
    if (startCell === undefined) return;

    const invasionCells = [];
    const queue = [startCell];
    const maxCells = rand(5, 30);

    while (queue.length) {
      const cellId = P(0.4) ? queue.shift() : queue.pop();
      invasionCells.push(cellId);
      if (invasionCells.length >= maxCells) break;

      cells.c[cellId].forEach(neibCellId => {
        if (usedCells[neibCellId]) return;
        if (cells.state[neibCellId] !== defender) return;
        usedCells[neibCellId] = 1;
        queue.push(neibCellId);
      });
    }

    const subtype = rw({
      Invasion: 5,
      Occupation: 4,
      Conquest: 3,
      Incursion: 2,
      Intervention: 2,
      Assault: 1,
      Foray: 1,
      Intrusion: 1,
      Irruption: 1,
      Offensive: 1,
      Pillaging: 1,
      Plunder: 1,
      Raid: 1,
      Skirmishes: 1
    });
    const name = getAdjective(states[attacker].name) + " " + subtype;

    pack.zones.push({i: pack.zones.length, name, type: "Invasion", cells: invasionCells, color: "url(#hatch1)"});
  }

  function addRebels(usedCells) {
    const {cells, states} = pack;

    const state = ra(states.filter(s => s.i && !s.removed && s.neighbors.some(Boolean)));
    if (!state) return;

    const neibStateId = ra(state.neighbors.filter(n => n && !states[n].removed));
    if (!neibStateId) return;

    const cellsArray = [];
    const queue = [];
    const borderCellId = cells.i.find(
      i => cells.state[i] === state.i && cells.c[i].some(c => cells.state[c] === neibStateId)
    );
    if (borderCellId) queue.push(borderCellId);
    const maxCells = rand(10, 30);

    while (queue.length) {
      const cellId = queue.shift();
      cellsArray.push(cellId);
      if (cellsArray.length >= maxCells) break;

      cells.c[cellId].forEach(neibCellId => {
        if (usedCells[neibCellId]) return;
        if (cells.state[neibCellId] !== state.i) return;
        usedCells[neibCellId] = 1;
        if (neibCellId % 4 !== 0 && !cells.c[neibCellId].some(c => cells.state[c] === neibStateId)) return;
        queue.push(neibCellId);
      });
    }

    const rebels = rw({
      Rebels: 5,
      Insurrection: 2,
      Mutineers: 1,
      Insurgents: 1,
      Rebellion: 1,
      Renegades: 1,
      Revolters: 1,
      Revolutionaries: 1,
      Rioters: 1,
      Separatists: 1,
      Secessionists: 1,
      Conspiracy: 1
    });

    const name = getAdjective(states[neibStateId].name) + " " + rebels;
    pack.zones.push({i: pack.zones.length, name, type: "Rebels", cells: cellsArray, color: "url(#hatch3)"});
  }

  function addProselytism(usedCells) {
    const {cells, religions} = pack;

    const organizedReligions = religions.filter(r => r.i && !r.removed && r.type === "Organized");
    const religion = ra(organizedReligions);
    if (!religion) return;

    const targetBorderCells = cells.i.filter(
      i =>
        cells.h[i] < 20 &&
        cells.pop[i] &&
        cells.religion[i] !== religion.i &&
        cells.c[i].some(c => cells.religion[c] === religion.i)
    );
    const startCell = ra(targetBorderCells);
    if (!startCell) return;

    const targetReligionId = cells.religion[startCell];
    const proselytismCells = [];
    const queue = [startCell];
    const maxCells = rand(10, 30);

    while (queue.length) {
      const cellId = queue.shift();
      proselytismCells.push(cellId);
      if (proselytismCells.length >= maxCells) break;

      cells.c[cellId].forEach(neibCellId => {
        if (usedCells[neibCellId]) return;
        if (cells.religion[neibCellId] !== targetReligionId) return;
        if (cells.h[neibCellId] < 20 || !cells.pop[i]) return;
        usedCells[neibCellId] = 1;
        queue.push(neibCellId);
      });
    }

    const name = `${getAdjective(religion.name.split(" ")[0])} Proselytism`;
    pack.zones.push({i: pack.zones.length, name, type: "Proselytism", cells: proselytismCells, color: "url(#hatch6)"});
  }

  function addCrusade(usedCells) {
    const {cells, religions} = pack;

    const heresies = religions.filter(r => !r.removed && r.type === "Heresy");
    if (!heresies.length) return;

    const heresy = ra(heresies);
    const crusadeCells = cells.i.filter(i => !usedCells[i] && cells.religion[i] === heresy.i);
    if (!crusadeCells.length) return;
    crusadeCells.forEach(i => (usedCells[i] = 1));

    const name = getAdjective(heresy.name.split(" ")[0]) + " Crusade";
    pack.zones.push({
      i: pack.zones.length,
      name,
      type: "Crusade",
      cells: Array.from(crusadeCells),
      color: "url(#hatch6)"
    });
  }

  function addDisease(usedCells) {
    const {cells, burgs} = pack;

    const burg = ra(burgs.filter(b => !usedCells[b.cell] && b.i && !b.removed)); // random burg
    if (!burg) return;

    const cellsArray = [];
    const cost = [];
    const maxCells = rand(20, 40);

    const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
    queue.queue({e: burg.cell, p: 0});

    while (queue.length) {
      const next = queue.dequeue();
      if (cells.burg[next.e] || cells.pop[next.e]) cellsArray.push(next.e);
      usedCells[next.e] = 1;

      cells.c[next.e].forEach(nextCellId => {
        const c = Routes.getRoute(next.e, nextCellId) ? 5 : 100;
        const p = next.p + c;
        if (p > maxCells) return;

        if (!cost[nextCellId] || p < cost[nextCellId]) {
          cost[nextCellId] = p;
          queue.queue({e: nextCellId, p});
        }
      });
    }

    // prettier-ignore
    const name = `${(() => {
      const model = rw({color: 2, animal: 1, adjective: 1});
      if (model === "color") return ra(["Amber", "Azure", "Black", "Blue", "Brown", "Crimson", "Emerald", "Golden", "Green", "Grey", "Orange", "Pink", "Purple", "Red", "Ruby", "Scarlet", "Silver", "Violet", "White", "Yellow"]);
      if (model === "animal") return ra(["Ape", "Bear", "Bird", "Boar", "Cat", "Cow", "Deer", "Dog", "Fox", "Goat", "Horse", "Lion", "Pig", "Rat", "Raven", "Sheep", "Spider", "Tiger", "Viper", "Wolf", "Worm", "Wyrm"]);
      if (model === "adjective") return ra(["Blind", "Bloody", "Brutal", "Burning", "Deadly", "Fatal", "Furious", "Great", "Grim", "Horrible", "Invisible", "Lethal", "Loud", "Mortal", "Savage", "Severe", "Silent", "Unknown", "Venomous", "Vicious"]);
    })()} ${rw({Fever: 5, Plague: 3, Cough: 3, Flu: 2, Pox: 2, Cholera: 2, Typhoid: 2, Leprosy: 1, Smallpox: 1, Pestilence: 1, Consumption: 1, Malaria: 1, Dropsy: 1})}`;

    pack.zones.push({i: pack.zones.length, name, type: "Disease", cells: cellsArray, color: "url(#hatch12)"});
  }

  function addDisaster(usedCells) {
    const {cells, burgs} = pack;

    const burg = ra(burgs.filter(b => !usedCells[b.cell] && b.i && !b.removed));
    if (!burg) return;
    usedCells[burg.cell] = 1;

    const cellsArray = [];
    const cost = [];
    const maxCells = rand(5, 25);

    const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
    queue.queue({e: burg.cell, p: 0});

    while (queue.length) {
      const next = queue.dequeue();
      if (cells.burg[next.e] || cells.pop[next.e]) cellsArray.push(next.e);
      usedCells[next.e] = 1;

      cells.c[next.e].forEach(function (e) {
        const c = rand(1, 10);
        const p = next.p + c;
        if (p > maxCells) return;

        if (!cost[e] || p < cost[e]) {
          cost[e] = p;
          queue.queue({e, p});
        }
      });
    }

    const type = rw({
      Famine: 5,
      Drought: 3,
      Earthquake: 3,
      Dearth: 1,
      Tornadoes: 1,
      Wildfires: 1,
      Storms: 1,
      Blight: 1
    });
    const name = getAdjective(burg.name) + " " + type;
    pack.zones.push({i: pack.zones.length, name, type: "Disaster", cells: cellsArray, color: "url(#hatch5)"});
  }

  function addEruption(usedCells) {
    const {cells, markers} = pack;

    const volcanoe = markers.find(m => m.type === "volcanoes" && !usedCells[m.cell]);
    if (!volcanoe) return;
    usedCells[volcanoe.cell] = 1;

    const note = notes.find(n => n.id === "marker" + volcanoe.i);
    if (note) note.legend = note.legend.replace("Active volcano", "Erupting volcano");
    const name = note ? note.name.replace(" Volcano", "") + " Eruption" : "Volcano Eruption";

    const cellsArray = [];
    const queue = [volcanoe.cell];
    const maxCells = rand(10, 30);

    while (queue.length) {
      const cellId = P(0.5) ? queue.shift() : queue.pop();
      cellsArray.push(cellId);
      if (cellsArray.length >= maxCells) break;

      cells.c[cellId].forEach(neibCellId => {
        if (usedCells[neibCellId] || cells.h[neibCellId] < 20) return;
        usedCells[neibCellId] = 1;
        queue.push(neibCellId);
      });
    }

    pack.zones.push({i: pack.zones.length, name, type: "Eruption", cells: cellsArray, color: "url(#hatch7)"});
  }

  function addAvalanche(usedCells) {
    const {cells} = pack;

    const routeCells = cells.i.filter(i => !usedCells[i] && Routes.isConnected(i) && cells.h[i] >= 70);
    if (!routeCells.length) return;

    const startCell = ra(routeCells);
    usedCells[startCell] = 1;

    const cellsArray = [];
    const queue = [startCell];
    const maxCells = rand(3, 15);

    while (queue.length) {
      const cellId = P(0.3) ? queue.shift() : queue.pop();
      cellsArray.push(cellId);
      if (cellsArray.length >= maxCells) break;

      cells.c[cellId].forEach(neibCellId => {
        if (usedCells[neibCellId] || cells.h[neibCellId] < 65) return;
        usedCells[neibCellId] = 1;
        queue.push(neibCellId);
      });
    }

    const name = getAdjective(Names.getCultureShort(cells.culture[startCell])) + " Avalanche";
    pack.zones.push({i: pack.zones.length, name, type: "Avalanche", cells: cellsArray, color: "url(#hatch5)"});
  }

  function addFault(usedCells) {
    const cells = pack.cells;

    const elevatedCells = cells.i.filter(i => !usedCells[i] && cells.h[i] > 50 && cells.h[i] < 70);
    if (!elevatedCells.length) return;

    const startCell = ra(elevatedCells);
    usedCells[startCell] = 1;

    const cellsArray = [];
    const queue = [startCell];
    const maxCells = rand(3, 15);

    while (queue.length) {
      const cellId = queue.pop();
      if (cells.h[cellId] >= 20) cellsArray.push(cellId);
      if (cellsArray.length >= maxCells) break;

      cells.c[cellId].forEach(neibCellId => {
        if (usedCells[neibCellId] || cells.r[neibCellId]) return;
        usedCells[neibCellId] = 1;
        queue.push(neibCellId);
      });
    }

    const name = getAdjective(Names.getCultureShort(cells.culture[startCell])) + " Fault";
    pack.zones.push({i: pack.zones.length, name, type: "Fault", cells: cellsArray, color: "url(#hatch2)"});
  }

  function addFlood(usedCells) {
    const cells = pack.cells;

    const fl = cells.fl.filter(Boolean);
    const meanFlux = d3.mean(fl);
    const maxFlux = d3.max(fl);
    const fluxThreshold = (maxFlux - meanFlux) / 2 + meanFlux;

    const bigRiverCells = cells.i.filter(
      i => !usedCells[i] && cells.h[i] < 50 && cells.r[i] && cells.fl[i] > fluxThreshold && cells.burg[i]
    );
    if (!bigRiverCells.length) return;

    const startCell = ra(bigRiverCells);
    usedCells[startCell] = 1;

    const riverId = cells.r[startCell];
    const cellsArray = [];
    const queue = [startCell];
    const maxCells = rand(5, 30);

    while (queue.length) {
      const cellId = queue.pop();
      cellsArray.push(cellId);
      if (cellsArray.length >= maxCells) break;

      cells.c[cellId].forEach(neibCellId => {
        if (
          usedCells[neibCellId] ||
          cells.h[neibCellId] < 20 ||
          cells.r[neibCellId] !== riverId ||
          cells.h[neibCellId] > 50 ||
          cells.fl[neibCellId] < meanFlux
        )
          return;
        usedCells[neibCellId] = 1;
        queue.push(neibCellId);
      });
    }

    const name = getAdjective(pack.burgs[cells.burg[startCell]].name) + " Flood";
    pack.zones.push({i: pack.zones.length, name, type: "Flood", cells: cellsArray, color: "url(#hatch13)"});
  }

  function addTsunami(usedCells) {
    const {cells, features} = pack;

    const coastalCells = cells.i.filter(
      i => !usedCells[i] && cells.t[i] === -1 && features[cells.f[i]].type !== "lake"
    );
    if (!coastalCells.length) return;

    const startCell = ra(coastalCells);
    usedCells[startCell] = 1;

    const cellsArray = [];
    const queue = [startCell];
    const maxCells = rand(10, 30);

    while (queue.length) {
      const cellId = queue.shift();
      if (cells.t[cellId] === 1) cellsArray.push(cellId);
      if (cellsArray.length >= maxCells) break;

      cells.c[cellId].forEach(neibCellId => {
        if (usedCells[neibCellId]) return;
        if (cells.t[neibCellId] > 2) return;
        if (pack.features[cells.f[neibCellId]].type === "lake") return;
        usedCells[neibCellId] = 1;
        queue.push(neibCellId);
      });
    }

    const name = getAdjective(Names.getCultureShort(cells.culture[startCell])) + " Tsunami";
    pack.zones.push({i: pack.zones.length, name, type: "Tsunami", cells: cellsArray, color: "url(#hatch13)"});
  }

  return {generate};
})();
