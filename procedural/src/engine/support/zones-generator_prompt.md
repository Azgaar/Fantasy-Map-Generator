# module_name.js

**You are an expert senior JavaScript developer specializing in refactoring legacy code into modern, modular, and environment-agnostic libraries. You have a deep understanding of design patterns like dependency injection and the separation of concerns.**

**Your Goal:**

Your task is to refactor a single JavaScript module from a legacy Fantasy Map Generator application. The goal is to migrate it from its old, browser-dependent format into a pure, headless-first ES module that will be part of a core generation engine. This engine must be able to run in any JavaScript environment, including Node.js, without any dependencies on a browser or DOM.

**Architectural Context:**

*   **Old Architecture:** The original code is wrapped in an IIFE and attaches its exports to the global `window` object. It directly reads from and mutates global state variables like `pack` and `grid`, and directly accesses the DOM via `byId()`.
*   **New Architecture (Target):**
    1.  **Core Engine:** A collection of pure ES modules. It receives all necessary data (`pack`, `grid`) and configuration as function arguments. It performs its logic and returns the newly generated data. It has **zero** knowledge of the browser.
    2.  **Viewer/Client:** The application responsible for all DOM interaction, UI, and rendering SVG based on the data object produced by the engine.

**The Golden Rules of Refactoring for the Core Engine:**

1.  **No Globals:** Remove the IIFE and the attachment to the `window` object.
2.  **Use ES Modules:** All exported functions and data must use the `export` keyword.
3.  **Dependency Injection:** Functions must not read from or mutate global state. All data they need (`pack`, `grid`) must be passed in as arguments.
4.  **Introduce a `config` Object:**
    *   **When you find code that reads a value from the DOM (e.g., `byId("statesNumber").value`), this is a configuration parameter.**
    *   **You must replace this DOM call with a property from a `config` object (e.g., `config.statesNumber`).**
    *   Add this `config` object as a new argument to the function's signature.
5.  **Return New Data:** Instead of modifying an object in place (e.g., `pack.cells.biome = ...`), functions should create the new data and return it. The calling function will be responsible for merging this data into the main state object.
6. **Pure functions:** Functions should not have side effects. They should either return a new state object or a specific piece of data.
7.  **Strict Separation of Concerns (Crucial):**
    *   **UI Input Reading:** As per Rule #4, these `byId()` calls are your guide to what properties the `config` object needs.
    *   **Rendering Logic:** Any code that **writes to the DOM or SVG** (e.g., `d3.select`, `document.getElementById(...).innerHTML = ...`, creating `<path>` elements, etc.) is considered rendering logic.
    *   **You must REMOVE all rendering logic** from the engine module.
8.  **Maintain Style:** Preserve the original code style, comments, and variable names as much as possible for consistency.
9. **Efficient Destructuring:** When passing a utils object, only destructure the specific properties needed within the scope of the function that uses them, rather than destructuring the entire object at the top of every function. This improves clarity and reduces code repetition.

---

**Concrete Example of Refactoring:**

**BEFORE (Legacy `burgs-and-states.js`):**

```javascript
// ...
function placeCapitals() {
  // Direct DOM read - THIS IS A CONFIGURATION VALUE
  let count = +byId("statesNumber").value; 
  // ...
}
// ...
```

**AFTER (Refactored `engine/modules/burgsAndStates.js`):**

```javascript
// ...
// Dependencies, including the new `config` object, are injected.
export function placeCapitals(cells, graphWidth, graphHeight, config) {
  // DOM read is replaced by a property from the `config` object.
  let count = config.statesNumber; 
  // ...
  // Returns the generated data
  return { burgs, states };
}
// ...
```

---

**Your Specific Task:**

Now, please apply these principles to refactor the following module: `module_name.js`.

**File Content:**
```javascript
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

    const queue = new FlatQueue();
    queue.push({e: burg.cell, p: 0}, 0);

    while (queue.length) {
      const next = queue.pop();
      if (cells.burg[next.e] || cells.pop[next.e]) cellsArray.push(next.e);
      usedCells[next.e] = 1;

      cells.c[next.e].forEach(nextCellId => {
        const c = Routes.getRoute(next.e, nextCellId) ? 5 : 100;
        const p = next.p + c;
        if (p > maxCells) return;

        if (!cost[nextCellId] || p < cost[nextCellId]) {
          cost[nextCellId] = p;
          queue.push({e: nextCellId, p}, p);
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

    const queue = new FlatQueue();
    queue.push({e: burg.cell, p: 0}, 0);

    while (queue.length) {
      const next = queue.pop();
      if (cells.burg[next.e] || cells.pop[next.e]) cellsArray.push(next.e);
      usedCells[next.e] = 1;

      cells.c[next.e].forEach(function (e) {
        const c = rand(1, 10);
        const p = next.p + c;
        if (p > maxCells) return;

        if (!cost[e] || p < cost[e]) {
          cost[e] = p;
          queue.push({e, p}, p);
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

```

**Instructions:**

Provide a response in three parts:

1.  **Refactored Code:** The complete JavaScript code for the new ES module in ./module_name.js
2.  **Engine Dependencies:**
    *   List the external modules the refactored code will need to `import` (e.g., `Names`, `COA`) in ./module_name_external.md
    *   **List the new `config` properties you identified and used** (e.g., `statesNumber`, `growthRate`) in module_name_config.md This is essential.
3.  **Removed Rendering/UI Logic:** List all the code blocks related to DOM manipulation or SVG rendering that you have **removed** so they can be moved to the Viewer application into module_name_render.md
