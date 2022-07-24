// @ts-nocheck
import * as d3 from "d3";
import FlatQueue from "flatqueue";

import {TIME} from "config/logging";
import {findCell, getPackPolygon} from "utils/graphUtils";
import {getAdjective} from "utils/languageUtils";
import {rn} from "utils/numberUtils";
import {P, ra, rand, rw} from "utils/probabilityUtils";
import {byId} from "utils/shorthands";

// generate zones
export function addZones(number = 1) {
  TIME && console.time("addZones");
  const {cells, states, burgs} = pack;
  const used = new Uint8Array(cells.i.length); // to store used cells
  const zonesData = [];
  const randomize = modifier => rn(Math.random() * modifier * number);

  for (let i = 0; i < randomize(1.8); i++) addInvasion(); // invasion of enemy lands
  for (let i = 0; i < randomize(1.6); i++) addRebels(); // rebels along a state border
  for (let i = 0; i < randomize(1.6); i++) addProselytism(); // proselitism of organized religion
  for (let i = 0; i < randomize(1.6); i++) addCrusade(); // crusade on heresy lands
  for (let i = 0; i < randomize(1.8); i++) addDisease(); // disease starting in a random city
  for (let i = 0; i < randomize(1.4); i++) addDisaster(); // disaster starting in a random city
  for (let i = 0; i < randomize(1.4); i++) addEruption(); // volcanic eruption aroung volcano
  for (let i = 0; i < randomize(1.0); i++) addAvalanche(); // avalanche impacting highland road
  for (let i = 0; i < randomize(1.4); i++) addFault(); // fault line in elevated areas
  for (let i = 0; i < randomize(1.4); i++) addFlood(); // flood on river banks
  for (let i = 0; i < randomize(1.2); i++) addTsunami(); // tsunami starting near coast

  drawZones();

  function addInvasion() {
    const atWar = states.filter(s => s.diplomacy && s.diplomacy.some(d => d === "Enemy"));
    if (!atWar.length) return;

    const invader = ra(atWar);
    const target = invader.diplomacy.findIndex(d => d === "Enemy");

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
        if (used[e]) return;
        if (cells.state[e] !== target) return;
        used[e] = 1;
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
    zonesData.push({name, type: "Invasion", cells: cellsArray, fill: "url(#hatch1)"});
  }

  function addRebels() {
    const state = ra(states.filter(s => s.i && !s.removed && s.neighbors.some(n => n)));
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
        if (used[e]) return;
        if (cells.state[e] !== state.i) return;
        used[e] = 1;
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
    zonesData.push({name, type: "Rebels", cells: cellsArray, fill: "url(#hatch3)"});
  }

  function addProselytism() {
    const organized = ra(pack.religions.filter(r => r.type === "Organized"));
    if (!organized) return;

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
        if (used[e]) return;
        if (cells.religion[e] !== target) return;
        if (cells.h[e] < 20) return;
        used[e] = 1;
        //if (e%2 !== 0 && !cells.c[e].some(c => cells.state[c] === neib)) return;
        queue.push(e);
      });
    }

    const name = getAdjective(organized.name.split(" ")[0]) + " Proselytism";
    zonesData.push({name, type: "Proselytism", cells: cellsArray, fill: "url(#hatch6)"});
  }

  function addCrusade() {
    const heresy = ra(pack.religions.filter(r => r.type === "Heresy"));
    if (!heresy) return;

    const cellsArray = cells.i.filter(i => !used[i] && cells.religion[i] === heresy.i);
    if (!cellsArray.length) return;
    cellsArray.forEach(i => (used[i] = 1));

    const name = getAdjective(heresy.name.split(" ")[0]) + " Crusade";
    zonesData.push({name, type: "Crusade", cells: cellsArray, fill: "url(#hatch6)"});
  }

  function addDisease() {
    const burg = ra(burgs.filter(b => !used[b.cell] && b.i && !b.removed)); // random burg
    if (!burg) return;

    const cellsArray = [];
    const costs = [];
    const power = rand(20, 37);

    const queue = new FlatQueue();
    queue.push(burg.cell, 0);

    while (queue.length) {
      const priority = queue.peekValue();
      const next = queue.pop();

      if (cells.burg[next] || cells.pop[next]) cellsArray.push(next);
      used[next] = 1;

      cells.c[next].forEach(neibCellId => {
        const roadValue = cells.road[next];
        const cost = roadValue ? Math.max(10 - roadValue, 1) : 100;
        const totalPriority = priority + cost;
        if (totalPriority > power) return;

        if (!costs[neibCellId] || totalPriority < costs[neibCellId]) {
          costs[neibCellId] = totalPriority;
          queue.push(neibCellId, totalPriority);
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
    zonesData.push({name, type: "Disease", cells: cellsArray, fill: "url(#hatch12)"});
  }

  function addDisaster() {
    const burg = ra(burgs.filter(b => !used[b.cell] && b.i && !b.removed)); // random burg
    if (!burg) return;

    const cellsArray = [];
    const costs = [];
    const power = rand(5, 25);

    const queue = new FlatQueue();
    queue.push(burg.cell, 0);

    while (queue.length) {
      const priority = queue.peekValue();
      const next = queue.pop();

      if (cells.burg[next] || cells.pop[next]) cellsArray.push(next);
      used[next] = 1;

      cells.c[next].forEach(neibCellId => {
        const cost = rand(1, 10);
        const totalPriority = priority + cost;
        if (totalPriority > power) return;

        if (!costs[neibCellId] || totalPriority < costs[neibCellId]) {
          costs[neibCellId] = totalPriority;
          queue.push(neibCellId, totalPriority);
        }
      });
    }

    const type = rw({Famine: 5, Dearth: 1, Drought: 3, Earthquake: 3, Tornadoes: 1, Wildfires: 1});
    const name = getAdjective(burg.name) + " " + type;
    zonesData.push({name, type: "Disaster", cells: cellsArray, fill: "url(#hatch5)"});
  }

  function addEruption() {
    const volcano = byId("markers").querySelector("use[data-id='#marker_volcano']");
    if (!volcano) return;

    const x = +volcano.dataset.x,
      y = +volcano.dataset.y,
      cell = findCell(x, y);
    const id = volcano.id;
    const note = notes.filter(n => n.id === id);

    if (note[0]) note[0].legend = note[0].legend.replace("Active volcano", "Erupting volcano");
    const name = note[0] ? note[0].name.replace(" Volcano", "") + " Eruption" : "Volcano Eruption";

    const cellsArray = [];
    const queue = [cell];
    const power = rand(10, 30);

    while (queue.length) {
      const q = P(0.5) ? queue.shift() : queue.pop();
      cellsArray.push(q);
      if (cellsArray.length > power) break;
      cells.c[q].forEach(e => {
        if (used[e] || cells.h[e] < 20) return;
        used[e] = 1;
        queue.push(e);
      });
    }

    zonesData.push({name, type: "Disaster", cells: cellsArray, fill: "url(#hatch7)"});
  }

  function addAvalanche() {
    const roads = cells.i.filter(i => !used[i] && cells.road[i] && cells.h[i] >= 70);
    if (!roads.length) return;

    const cell = +ra(roads);
    const cellsArray = [];
    const queue = [cell];
    const power = rand(3, 15);

    while (queue.length) {
      const q = P(0.3) ? queue.shift() : queue.pop();
      cellsArray.push(q);
      if (cellsArray.length > power) break;
      cells.c[q].forEach(e => {
        if (used[e] || cells.h[e] < 65) return;
        used[e] = 1;
        queue.push(e);
      });
    }

    const proper = getAdjective(Names.getCultureShort(cells.culture[cell]));
    const name = proper + " Avalanche";
    zonesData.push({name, type: "Disaster", cells: cellsArray, fill: "url(#hatch5)"});
  }

  function addFault() {
    const elevated = cells.i.filter(i => !used[i] && cells.h[i] > 50 && cells.h[i] < 70);
    if (!elevated.length) return;

    const cell = ra(elevated);
    const cellsArray = [];
    const queue = [cell];
    const power = rand(3, 15);

    while (queue.length) {
      const q = queue.pop();
      if (cells.h[q] >= 20) cellsArray.push(q);
      if (cellsArray.length > power) break;
      cells.c[q].forEach(e => {
        if (used[e] || cells.r[e]) return;
        used[e] = 1;
        queue.push(e);
      });
    }

    const proper = getAdjective(Names.getCultureShort(cells.culture[cell]));
    const name = proper + " Fault";
    zonesData.push({name, type: "Disaster", cells: cellsArray, fill: "url(#hatch2)"});
  }

  function addFlood() {
    const fl = cells.fl.filter(fl => fl),
      meanFlux = d3.mean(fl),
      maxFlux = d3.max(fl),
      flux = (maxFlux - meanFlux) / 2 + meanFlux;
    const rivers = cells.i.filter(
      i => !used[i] && cells.h[i] < 50 && cells.r[i] && cells.fl[i] > flux && cells.burg[i]
    );
    if (!rivers.length) return;

    const cell = +ra(rivers),
      river = cells.r[cell];
    const cellsArray = [];
    const queue = [cell];
    const power = rand(5, 30);

    while (queue.length) {
      const q = queue.pop();
      cellsArray.push(q);
      if (cellsArray.length > power) break;

      cells.c[q].forEach(e => {
        if (used[e] || cells.h[e] < 20 || cells.r[e] !== river || cells.h[e] > 50 || cells.fl[e] < meanFlux) return;
        used[e] = 1;
        queue.push(e);
      });
    }

    const name = getAdjective(burgs[cells.burg[cell]].name) + " Flood";
    zonesData.push({name, type: "Disaster", cells: cellsArray, fill: "url(#hatch13)"});
  }

  function addTsunami() {
    const coastal = cells.i.filter(i => !used[i] && cells.t[i] === -1 && pack.features[cells.f[i]].type !== "lake");
    if (!coastal.length) return;

    const cell = +ra(coastal);
    const cellsArray = [];
    const queue = [cell];
    const power = rand(10, 30);

    while (queue.length) {
      const q = queue.shift();
      if (cells.t[q] === 1) cellsArray.push(q);
      if (cellsArray.length > power) break;

      cells.c[q].forEach(e => {
        if (used[e]) return;
        if (cells.t[e] > 2) return;
        if (pack.features[cells.f[e]].type === "lake") return;
        used[e] = 1;
        queue.push(e);
      });
    }

    const proper = getAdjective(Names.getCultureShort(cells.culture[cell]));
    const name = proper + " Tsunami";
    zonesData.push({name, type: "Disaster", cells: cellsArray, fill: "url(#hatch13)"});
  }

  function drawZones() {
    zones
      .selectAll("g")
      .data(zonesData)
      .enter()
      .append("g")
      .attr("id", (d, i) => "zone" + i)
      .attr("data-description", d => d.name)
      .attr("data-type", d => d.type)
      .attr("data-cells", d => d.cells.join(","))
      .attr("fill", d => d.fill)
      .selectAll("polygon")
      .data(d => d.cells)
      .enter()
      .append("polygon")
      .attr("points", d => getPackPolygon(d))
      .attr("id", function (d) {
        return this.parentNode.id + "_" + d;
      });
  }

  TIME && console.timeEnd("addZones");
}
