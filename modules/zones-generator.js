"use strict";

window.Zones = (function () {
  const config = {
    invasion: {modifier: 1.8, generate: addInvasion}, // invasion of enemy lands
    rebels: {modifier: 1.6, generate: addRebels}, // rebels along a state border
    proselytism: {modifier: 1.6, generate: addProselytism}, // proselitism of organized religion
    crusade: {modifier: 1.6, generate: addCrusade}, // crusade on heresy lands
    disease: {modifier: 1.8, generate: addDisease}, // disease starting in a random city
    disaster: {modifier: 1.4, generate: addDisaster}, // disaster starting in a random city
    eruption: {modifier: 1.4, generate: addEruption}, // volcanic eruption aroung volcano
    avalanche: {modifier: 1.0, generate: addAvalanche}, // avalanche impacting highland road
    fault: {modifier: 1.4, generate: addFault}, // fault line in elevated areas
    flood: {modifier: 1.4, generate: addFlood}, // flood on river banks
    tsunami: {modifier: 1.2, generate: addTsunami} // tsunami starting near coast
  };

  const generate = function (globalModifier = 1) {
    TIME && console.time("generateZones");

    const usedCells = new Uint8Array(pack.cells.i.length);
    pack.zones = [];

    Object.values(config).forEach(type => {
      const count = rn(Math.random() * type.modifier * globalModifier);
      for (let i = 0; i < count; i++) {
        type.generate(usedCells);
      }
    });

    drawZones();

    function drawZones() {
      zones
        .selectAll("g")
        .data(pack.zones)
        .enter()
        .append("g")
        .attr("id", d => "zone" + d.i)
        .attr("data-description", d => d.name)
        .attr("data-type", d => d.type)
        .attr("data-cells", d => d.cells.join(","))
        .attr("fill", d => d.color)
        .selectAll("polygon")
        .data(d => d.cells)
        .enter()
        .append("polygon")
        .attr("points", d => getPackPolygon(d))
        .attr("id", function (d) {
          return this.parentNode.id + "_" + d;
        });
    }

    TIME && console.timeEnd("generateZones");
  };

  function addInvasion(usedCells) {
    const atWar = pack.states.filter(s => s.diplomacy && s.diplomacy.some(d => d === "Enemy"));
    if (!atWar.length) return;

    const invader = ra(atWar);
    const target = invader.diplomacy.findIndex(d => d === "Enemy");

    const cells = pack.cells;
    const cell = ra(
      cells.i.filter(i => cells.state[i] === target && cells.c[i].some(c => cells.state[c] === invader.i))
    );
    if (!cell) return;

    const cellsArray = [],
      queue = [cell],
      power = rand(5, 30);

    while (queue.length) {
      const q = P(0.4) ? queue.shift() : queue.pop();
      cellsArray.push(q);
      if (cellsArray.length > power) break;

      cells.c[q].forEach(e => {
        if (usedCells[e]) return;
        if (cells.state[e] !== target) return;
        usedCells[e] = 1;
        queue.push(e);
      });
    }

    const invasion = rw({
      Invasion: 4,
      Occupation: 3,
      Raid: 2,
      Conquest: 2,
      Subjugation: 1,
      Foray: 1,
      Skirmishes: 1,
      Incursion: 2,
      Pillaging: 1,
      Intervention: 1
    });
    const name = getAdjective(invader.name) + " " + invasion;
    pack.zones.push({name, type: "Invasion", cells: cellsArray, color: "url(#hatch1)"});
  }

  function addRebels(usedCells) {
    const {cells, states} = pack;
    const state = ra(states.filter(s => s.i && !s.removed && s.neighbors.some(Boolean)));
    if (!state) return;

    const neib = ra(state.neighbors.filter(n => n && !states[n].removed));
    if (!neib) return;

    const cell = cells.i.find(
      i => cells.state[i] === state.i && !state.removed && cells.c[i].some(c => cells.state[c] === neib)
    );
    const cellsArray = [];
    const queue = [];
    if (cell) queue.push(cell);

    const power = rand(10, 30);

    while (queue.length) {
      const q = queue.shift();
      cellsArray.push(q);
      if (cellsArray.length > power) break;

      cells.c[q].forEach(e => {
        if (usedCells[e]) return;
        if (cells.state[e] !== state.i) return;
        usedCells[e] = 1;
        if (e % 4 !== 0 && !cells.c[e].some(c => cells.state[c] === neib)) return;
        queue.push(e);
      });
    }

    const rebels = rw({
      Rebels: 5,
      Insurgents: 2,
      Mutineers: 1,
      Rioters: 1,
      Separatists: 1,
      Secessionists: 1,
      Insurrection: 2,
      Rebellion: 1,
      Conspiracy: 2
    });

    const name = getAdjective(states[neib].name) + " " + rebels;
    pack.zones.push({name, type: "Rebels", cells: cellsArray, color: "url(#hatch3)"});
  }

  function addProselytism(usedCells) {
    const organized = ra(pack.religions.filter(r => r.type === "Organized"));
    if (!organized) return;

    const cells = pack.cells;
    const cell = ra(
      cells.i.filter(
        i =>
          cells.religion[i] &&
          cells.religion[i] !== organized.i &&
          cells.c[i].some(c => cells.religion[c] === organized.i)
      )
    );
    if (!cell) return;
    const target = cells.religion[cell];
    const cellsArray = [],
      queue = [cell],
      power = rand(10, 30);

    while (queue.length) {
      const q = queue.shift();
      cellsArray.push(q);
      if (cellsArray.length > power) break;

      cells.c[q].forEach(e => {
        if (usedCells[e]) return;
        if (cells.religion[e] !== target) return;
        if (cells.h[e] < 20) return;
        usedCells[e] = 1;
        //if (e%2 !== 0 && !cells.c[e].some(c => cells.state[c] === neib)) return;
        queue.push(e);
      });
    }

    const name = getAdjective(organized.name.split(" ")[0]) + " Proselytism";
    pack.zones.push({name, type: "Proselytism", cells: cellsArray, color: "url(#hatch6)"});
  }

  function addCrusade(usedCells) {
    const heresy = ra(pack.religions.filter(r => r.type === "Heresy"));
    if (!heresy) return;

    const cells = pack.cells;
    const cellsArray = cells.i.filter(i => !usedCells[i] && cells.religion[i] === heresy.i);
    if (!cellsArray.length) return;
    cellsArray.forEach(i => (usedCells[i] = 1));

    const name = getAdjective(heresy.name.split(" ")[0]) + " Crusade";
    pack.zones.push({name, type: "Crusade", cells: cellsArray, color: "url(#hatch6)"});
  }

  function addDisease(usedCells) {
    const burg = ra(pack.burgs.filter(b => !usedCells[b.cell] && b.i && !b.removed)); // random burg
    if (!burg) return;

    const cells = pack.cells;
    const cellsArray = [];
    const cost = [];
    const power = rand(20, 37);

    const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
    queue.queue({e: burg.cell, p: 0});

    while (queue.length) {
      const next = queue.dequeue();
      if (cells.burg[next.e] || cells.pop[next.e]) cellsArray.push(next.e);
      usedCells[next.e] = 1;

      cells.c[next.e].forEach(nextCellId => {
        const c = Routes.getRoute(next.e, nextCellId) ? 5 : 100;
        const p = next.p + c;
        if (p > power) return;

        if (!cost[nextCellId] || p < cost[nextCellId]) {
          cost[nextCellId] = p;
          queue.queue({e: nextCellId, p});
        }
      });
    }

    const adjective = () =>
      ra(["Great", "Silent", "Severe", "Blind", "Unknown", "Loud", "Deadly", "Burning", "Bloody", "Brutal", "Fatal"]);
    const animal = () =>
      ra([
        "Ape",
        "Bear",
        "Boar",
        "Cat",
        "Cow",
        "Dog",
        "Pig",
        "Fox",
        "Bird",
        "Horse",
        "Rat",
        "Raven",
        "Sheep",
        "Spider",
        "Wolf"
      ]);
    const color = () =>
      ra([
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
      ]);

    const type = rw({
      Fever: 5,
      Pestilence: 2,
      Flu: 2,
      Pox: 2,
      Smallpox: 2,
      Plague: 4,
      Cholera: 2,
      Dropsy: 1,
      Leprosy: 2
    });
    const name = rw({[color()]: 4, [animal()]: 2, [adjective()]: 1}) + " " + type;
    pack.zones.push({name, type: "Disease", cells: cellsArray, color: "url(#hatch12)"});
  }

  function addDisaster(usedCells) {
    const burg = ra(pack.burgs.filter(b => !usedCells[b.cell] && b.i && !b.removed)); // random burg
    if (!burg) return;

    const cells = pack.cells;
    const cellsArray = [],
      cost = [],
      power = rand(5, 25);
    const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
    queue.queue({e: burg.cell, p: 0});

    while (queue.length) {
      const next = queue.dequeue();
      if (cells.burg[next.e] || cells.pop[next.e]) cellsArray.push(next.e);
      usedCells[next.e] = 1;

      cells.c[next.e].forEach(function (e) {
        const c = rand(1, 10);
        const p = next.p + c;
        if (p > power) return;

        if (!cost[e] || p < cost[e]) {
          cost[e] = p;
          queue.queue({e, p});
        }
      });
    }

    const type = rw({Famine: 5, Dearth: 1, Drought: 3, Earthquake: 3, Tornadoes: 1, Wildfires: 1});
    const name = getAdjective(burg.name) + " " + type;
    pack.zones.push({name, type: "Disaster", cells: cellsArray, color: "url(#hatch5)"});
  }

  function addEruption(usedCells) {
    const volcano = byId("markers").querySelector("use[data-id='#marker_volcano']");
    if (!volcano) return;

    const cells = pack.cells;
    const x = +volcano.dataset.x,
      y = +volcano.dataset.y,
      cell = findCell(x, y);
    const id = volcano.id;
    const note = notes.filter(n => n.id === id);

    if (note[0]) note[0].legend = note[0].legend.replace("Active volcano", "Erupting volcano");
    const name = note[0] ? note[0].name.replace(" Volcano", "") + " Eruption" : "Volcano Eruption";

    const cellsArray = [],
      queue = [cell],
      power = rand(10, 30);

    while (queue.length) {
      const q = P(0.5) ? queue.shift() : queue.pop();
      cellsArray.push(q);
      if (cellsArray.length > power) break;
      cells.c[q].forEach(e => {
        if (usedCells[e] || cells.h[e] < 20) return;
        usedCells[e] = 1;
        queue.push(e);
      });
    }

    pack.zones.push({name, type: "Disaster", cells: cellsArray, color: "url(#hatch7)"});
  }

  function addAvalanche(usedCells) {
    const cells = pack.cells;
    const routes = cells.i.filter(i => !usedCells[i] && Routes.isConnected(i) && cells.h[i] >= 70);
    if (!routes.length) return;

    const cell = +ra(routes);
    const cellsArray = [],
      queue = [cell],
      power = rand(3, 15);

    while (queue.length) {
      const q = P(0.3) ? queue.shift() : queue.pop();
      cellsArray.push(q);
      if (cellsArray.length > power) break;
      cells.c[q].forEach(e => {
        if (usedCells[e] || cells.h[e] < 65) return;
        usedCells[e] = 1;
        queue.push(e);
      });
    }

    const proper = getAdjective(Names.getCultureShort(cells.culture[cell]));
    const name = proper + " Avalanche";
    pack.zones.push({name, type: "Disaster", cells: cellsArray, color: "url(#hatch5)"});
  }

  function addFault(usedCells) {
    const cells = pack.cells;
    const elevated = cells.i.filter(i => !usedCells[i] && cells.h[i] > 50 && cells.h[i] < 70);
    if (!elevated.length) return;

    const cell = ra(elevated);
    const cellsArray = [],
      queue = [cell],
      power = rand(3, 15);

    while (queue.length) {
      const q = queue.pop();
      if (cells.h[q] >= 20) cellsArray.push(q);
      if (cellsArray.length > power) break;
      cells.c[q].forEach(e => {
        if (usedCells[e] || cells.r[e]) return;
        usedCells[e] = 1;
        queue.push(e);
      });
    }

    const proper = getAdjective(Names.getCultureShort(cells.culture[cell]));
    const name = proper + " Fault";
    pack.zones.push({name, type: "Disaster", cells: cellsArray, color: "url(#hatch2)"});
  }

  function addFlood(usedCells) {
    const cells = pack.cells;
    const fl = cells.fl.filter(fl => fl),
      meanFlux = d3.mean(fl),
      maxFlux = d3.max(fl),
      flux = (maxFlux - meanFlux) / 2 + meanFlux;
    const rivers = cells.i.filter(
      i => !usedCells[i] && cells.h[i] < 50 && cells.r[i] && cells.fl[i] > flux && cells.burg[i]
    );
    if (!rivers.length) return;

    const cell = +ra(rivers),
      river = cells.r[cell];
    const cellsArray = [],
      queue = [cell],
      power = rand(5, 30);

    while (queue.length) {
      const q = queue.pop();
      cellsArray.push(q);
      if (cellsArray.length > power) break;

      cells.c[q].forEach(e => {
        if (usedCells[e] || cells.h[e] < 20 || cells.r[e] !== river || cells.h[e] > 50 || cells.fl[e] < meanFlux)
          return;
        usedCells[e] = 1;
        queue.push(e);
      });
    }

    const name = getAdjective(burgs[cells.burg[cell]].name) + " Flood";
    pack.zones.push({name, type: "Disaster", cells: cellsArray, color: "url(#hatch13)"});
  }

  function addTsunami(usedCells) {
    const cells = pack.cells;
    const coastal = cells.i.filter(
      i => !usedCells[i] && cells.t[i] === -1 && pack.features[cells.f[i]].type !== "lake"
    );
    if (!coastal.length) return;

    const cell = +ra(coastal);
    const cellsArray = [],
      queue = [cell],
      power = rand(10, 30);

    while (queue.length) {
      const q = queue.shift();
      if (cells.t[q] === 1) cellsArray.push(q);
      if (cellsArray.length > power) break;

      cells.c[q].forEach(e => {
        if (usedCells[e]) return;
        if (cells.t[e] > 2) return;
        if (pack.features[cells.f[e]].type === "lake") return;
        usedCells[e] = 1;
        queue.push(e);
      });
    }

    const proper = getAdjective(Names.getCultureShort(cells.culture[cell]));
    const name = proper + " Tsunami";
    pack.zones.push({name, type: "Disaster", cells: cellsArray, color: "url(#hatch13)"});
  }

  return {generate};
})();
