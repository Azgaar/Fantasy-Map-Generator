Sky Burgs and Air Routes — Implementation Guide

Overview
- Add “Sky State” for flying cities.
- Allow creating and relocating flying burgs over water.
- Add “Sky Port” and “Flying” toggles in the Burg Editor.
- Generate air routes between sky ports and show them on a distinct SVG group.
- Add style controls and preset styles for the new `#airroutes` group.
- Protect flying burgs during heightmap reapply.

Notes
- The instructions below are surgical and limited to sky burgs/air routes only.
- When exact lines are uncertain, use the shown anchors to locate code.
- After changes, regenerate routes to see air routes: Tools → Regenerate → Routes.

1) Add air routes group to the SVG scene
File: main.js
Anchor: near other route groups

Find:
  let routes = viewbox.append("g").attr("id", "routes");
  let roads = routes.append("g").attr("id", "roads");
  let trails = routes.append("g").attr("id", "trails");
  let searoutes = routes.append("g").attr("id", "searoutes");

Add immediately after:
  let airroutes = routes.append("g").attr("id", "airroutes");

2) Create a Sky State helper
File: modules/ui/editors.js
Anchor: place after function moveBurgToGroup or near other global helpers.

Add:
  // Ensure a dedicated locked Sky State exists; create if missing and return its id
  function ensureSkyState(anchorBurgId) {
    const {states, burgs, cultures, cells} = pack;
    let sky = states.find(s => s && s.i && !s.removed && s.skyRealm);
    if (sky) return sky.i;

    const b = burgs[anchorBurgId];
    const i = states.length;
    const culture = (b && b.culture) || cells.culture?.[b?.cell] || 1;
    const type = "Generic";
    const name = "Sky Realm";
    const color = "#5b8bd4";
    const coa = COA.generate(null, null, null, cultures[culture]?.type || "Generic");
    coa.shield = COA.getShield(culture, null);

    const newState = {
      i, name, type, color,
      capital: anchorBurgId,
      center: b.cell,
      culture,
      expansionism: 0.1,
      coa,
      lock: 1,
      skyRealm: 1
    };
    states.push(newState);

    if (cells && typeof b.cell === "number") cells.state[b.cell] = i;
    if (b) {
      b.state = i;
      b.capital = 1;
      moveBurgToGroup(anchorBurgId, "cities");
    }
    return i;
  }

3) Allow adding flying burgs over water (Alt to place)
File: modules/ui/burgs-overview.js
Anchor: function addBurgOnClick()

Change water check:
  if (pack.cells.h[cell] < 20 && !d3.event.altKey)
    return tip("Hold Alt to place a flying burg over water", false, "error");

After calling addBurg(point), mark and assign sky:
  const id = addBurg(point);
  if (pack.cells.h[cell] < 20) {
    const burg = pack.burgs[id];
    burg.flying = 1;
    burg.skyPort = 1;
    const skyStateId = ensureSkyState(id);
    if (burg.state !== skyStateId) burg.state = skyStateId;
    burg.port = 0; // not a sea port
  }

4) Generate air routes between sky ports
File: modules/routes-generator.js
Anchors: inside generate(lockedRoutes), within the critical phase and in createRoutesData

Add to critical phase (just after generating majorSeaRoutes and royalRoads):
  const airRoutes = generateAirRoutes();

Add to createRoutesData to push air routes first pass:
  for (const {feature, cells, merged, type} of mergeRoutes(airRoutes)) {
    if (merged) continue;
    const points = getPoints("airroutes", cells, pointsArray);
    routes.push({i: routes.length, group: "airroutes", feature, points, type: type || "air"});
  }

Define generateAirRoutes() below createRoutesData helpers:
  function generateAirRoutes() {
    TIME && console.time("generateAirRoutes");
    const air = [];
    const skyPorts = pack.burgs.filter(b => b && b.i && !b.removed && (b.skyPort || b.flying));
    if (skyPorts.length < 2) { TIME && console.timeEnd("generateAirRoutes"); return air; }
    const points = skyPorts.map(b => [b.x, b.y]);
    const edges = calculateUrquhartEdges(points);
    edges.forEach(([ai, bi]) => {
      const a = skyPorts[ai];
      const b = skyPorts[bi];
      air.push({feature: -1, cells: [a.cell, b.cell], type: "air"});
    });
    TIME && console.timeEnd("generateAirRoutes");
    return air;
  }

Notes:
- drawRoutes() and getPath already support arbitrary route groups. No extra change needed.
- Air routes use the default curve; this is acceptable. Add a custom curve if desired.

5) Style editor support and preset styles
File: modules/ui/style-presets.js
Anchor: in the attributes map within collectStyleData (search for "#searoutes")

Add a sibling line:
  "#airroutes": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],

Preset styles: add minimal entries to each preset JSON under styles/ to visibly render air routes. Example for styles/default.json:
  "#airroutes": {
    "opacity": 0.95,
    "stroke": "#8a2be2",
    "stroke-width": 0.6,
    "stroke-dasharray": "2 3",
    "stroke-linecap": "round",
    "filter": null,
    "mask": null
  }

Repeat similarly for other presets you use (light, pale, ancient, atlas, clean, darkSeas, cyberpunk, gloom, monochrome, night, watercolor). Colors can be tuned per theme, but a purple dashed route is a good default.

6) Add Burg Editor toggles for Sky Port and Flying
File: index.html
Anchor: Burg Editor → Features group (look for id="burgPort")

Insert two features after Port:
  <span id="burgSkyPort" data-tip="Shows whether the burg is a sky port (air routes). Click to toggle" data-feature="skyPort" class="burgFeature icon-rocket"></span>
  <span id="burgFlying" data-tip="Shows whether the burg is flying (can stay over water). Click to toggle" data-feature="flying" class="burgFeature icon-cloud"></span>

File: modules/ui/burg-editor.js
Anchor 1: updateBurgValues() — toggle icons active state

Add:
  if (b.skyPort) byId("burgSkyPort").classList.remove("inactive"); else byId("burgSkyPort").classList.add("inactive");
  if (b.flying) byId("burgFlying").classList.remove("inactive"); else byId("burgFlying").classList.add("inactive");

Anchor 2: toggleFeature() — handle clicks

Add cases before the generic assignment:
  if (feature === "port") togglePort(id);
  else if (feature === "skyPort") {
    burg.skyPort = +turnOn;
    if (turnOn && !burg.capital) {
      const skyId = ensureSkyState(id);
      if (burg.state !== skyId) {
        pack.cells.state[burg.cell] = skyId; // own the cell
        burg.state = skyId;
      }
    }
    regenerateRoutes();
  } else if (feature === "flying") {
    burg.flying = +turnOn;
    regenerateRoutes();
  } else if (feature === "capital") toggleCapital(id);
  else burg[feature] = +turnOn;

Keep the existing UI updates following this block.

7) Protect flying burgs during heightmap reapply
File: modules/ui/heightmap-editor.js
Anchor: function that reassigns burg cells when applying heightmap (search for "findBurgCell(b.x, b.y)")

Modify so flying burgs stay where they are (even if over water) and are not removed:
  // Keep flying burgs at their current (possibly water) cell
  if (!b.flying) { b.cell = findBurgCell(b.x, b.y); }
  b.feature = pack.cells.f[b.cell];
  pack.cells.burg[b.cell] = b.i;
  if (!b.capital && pack.cells.h[b.cell] < 20 && !b.flying) removeBurg(b.i);

8) Allow relocating flying burgs over water
File: modules/ui/burg-editor.js
Anchor: relocateBurgOnClick()

Replace water restriction with:
  const isWater = cells.h[cell] < 20;
  const allowWater = pack.burgs[id]?.flying || d3.event.altKey;
  if (isWater && !allowWater) {
    tip("Hold Alt or mark as Flying to place over water", false, "error");
    return;
  }

Adjust state assignment on relocation:
  if (isWater) {
    if (burg.skyPort) {
      const skyId = ensureSkyState(id);
      cells.state[cell] = skyId;
      burg.state = skyId;
    } else {
      burg.state = oldState; // keep previous state when only flying
    }
  } else {
    burg.state = newState;
  }

Usage
- Add flying sky port over water: enable Add Burg, hold Alt over water and click. The first flying burg creates a locked Sky Realm and becomes its capital.
- Convert an existing burg: open Burg Editor → click Cloud (Flying). Optional: click Rocket (Sky Port) to join Sky Realm and participate in air routes.
- Relocate: use Relocate in Burg Editor. Flying or Alt allows dropping onto water. Sky Port burgs on water are assigned to Sky Realm automatically.
- Style air routes: Style → element "routes" → group "airroutes".

Verification Checklist
- Routes layer shows air routes in the chosen style.
- Creating Alt-click water burg marks it as flying + sky port in the Sky Realm.
- Burg Editor shows Cloud and Rocket toggles; they update state and routes when toggled.
- Heightmap reapply keeps flying burgs; non-flying water burgs (non-capitals) are still removed.

Optional Enhancements
- Add custom curve for air routes in ROUTE_CURVES, e.g., like searoutes.
- Add a legend entry for air routes using drawLegend in modules/ui/editors.js.

Appendix — Name sky routes and render them curved

Goal: ensure air routes get meaningful names (e.g., “Sky route Raven–Star”) and are drawn as smooth curves.

Files and anchors
- File: modules/routes-generator.js
- Anchors: search for each block shown below (models, suffixes, generateName, ROUTE_CURVES)

1) Extend naming models for air routes
Find the models object (near the comment “// name generator data”) and add an entry for airroutes:

  const models = {
    roads: {burg_suffix: 3, prefix_suffix: 6, the_descriptor_prefix_suffix: 2, the_descriptor_burg_suffix: 1},
    secondary: {burg_suffix: 5, prefix_suffix: 4, the_descriptor_prefix_suffix: 1, the_descriptor_burg_suffix: 2},
    trails: {burg_suffix: 8, prefix_suffix: 1, the_descriptor_burg_suffix: 1},
    searoutes: {burg_suffix: 4, prefix_suffix: 2, the_descriptor_prefix_suffix: 1},
    airroutes: {burg_suffix: 3, prefix_suffix: 5, the_descriptor_prefix_suffix: 2}
  };

2) Add suffixes for air routes
Find the suffixes object and add a key for airroutes with sky-themed suffixes:

  const suffixes = {
    roads: {road: 7, route: 3, way: 2, highway: 1},
    secondary: {road: 4, route: 2, way: 3, avenue: 1, boulevard: 1},
    trails: {trail: 4, path: 1, track: 1, pass: 1},
    searoutes: {"sea route": 5, lane: 2, passage: 1, seaway: 1},
    airroutes: {"sky route": 5, "air lane": 3, skyway: 2, airway: 2, "aerial path": 1}
  };

3) Update generateName to recognize airroutes
Inside function generateName({group, points}), adjust two return paths to include a “Sky route” base when group === "airroutes":

- For short segments (when points.length < 4):

  const base = group === "searoutes"
    ? "Sea route"
    : group === "airroutes"
    ? "Sky route"
    : group === "secondary" || group === "roads"
    ? "Road"
    : "Trail";

- For the final generic fallback:

  return group === "searoutes" ? "Sea route" : group === "airroutes" ? "Sky route" : "Route";

This ensures the generator can emit: “Sky route <Adjective>–<Adjective>” or “The <Descriptor> <Prefix> skyway”, etc.

4) Make air routes curved
Find the ROUTE_CURVES object and add a curve for airroutes similar to searoutes (Catmull-Rom spline with higher alpha):

  const ROUTE_CURVES = {
    roads: d3.curveCatmullRom.alpha(0.1),
    secondary: d3.curveCatmullRom.alpha(0.1),
    trails: d3.curveCatmullRom.alpha(0.1),
    searoutes: d3.curveCatmullRom.alpha(0.5),
    airroutes: d3.curveCatmullRom.alpha(0.5),
    default: d3.curveCatmullRom.alpha(0.1)
  };

No other code changes are required: draw and UI already call Routes.generateName and use the group’s curve when building the SVG path.

Appendix — Ensure sky burgs are never Wildlands (auto Sky Realm state)

Goal: make sure sky burgs do not end up in state 0 (Wildlands/Neutrals). The first sky burg should create a dedicated Sky Realm state and become its capital; subsequent sky burgs should join the Sky Realm automatically, even if placed on land.

Files and anchors
- File: modules/ui/editors.js (Sky State helper)
- File: modules/ui/burgs-overview.js (Alt-place over water)
- File: modules/ui/burg-editor.js (feature toggles + relocation)

1) Sky State helper (create-on-first-use)
Already covered in step 2 above (ensureSkyState). This creates a locked state with the first sky burg as capital and assigns the burg/cell to this state.

2) When adding a sky burg over water (Alt), assign Sky Realm immediately
Already covered in step 3 above. The code sets `burg.flying = 1`, `burg.skyPort = 1`, and assigns to Sky Realm via `ensureSkyState(id)`.

3) When toggling Flying on any burg, assign to Sky Realm
File: modules/ui/burg-editor.js
Anchor: toggleFeature()

Replace the current Flying branch so it also assigns the burg to Sky Realm, regardless of terrain:

  else if (feature === "flying") {
    burg.flying = +turnOn;
    if (turnOn) {
      try {
        const skyId = ensureSkyState(id);
        if (burg.state !== skyId) {
          pack.cells.state[burg.cell] = skyId;
          burg.state = skyId;
        }
      } catch (e) { ERROR && console.error(e); }
    }
    regenerateRoutes();
  }

4) On relocation, keep sky burgs in the Sky Realm
File: modules/ui/burg-editor.js
Anchor: relocateBurgOnClick()

Adjust the state assignment so Flying burgs also move into/retain the Sky Realm (not Wildlands) when placed on water or land:

  if (isWater || burg.flying) {
    const skyId = ensureSkyState(id);
    cells.state[cell] = skyId;
    burg.state = skyId;
  } else {
    burg.state = newState;
  }

Result
- The first sky burg creates a dedicated locked Sky Realm and becomes its capital.
- Any burg marked as Flying joins Sky Realm immediately and will not belong to Wildlands.
- Relocating a sky burg keeps it in Sky Realm regardless of terrain (water or land).

Appendix — Configure altitude (elevation) for sky burgs

Goal: allow setting a custom altitude for Flying burgs and show it in the Burg Editor. Do not change the map cell height; store altitude on the burg itself.

Files and anchors
- File: index.html (Burg Editor markup)
- File: modules/ui/burg-editor.js (UI bindings)
- File: modules/ui/burgs-overview.js (default altitude on Alt-place)

1) Add an Altitude input in Burg Editor
File: index.html
Anchor: inside the Burg Editor body, near the Population row (search for id="burgPopulation"). Insert after Population:

  <div id="burgAltitudeRow" data-tip="Sky altitude above mean sea level" style="display: none">
    <div class="label">Altitude:</div>
    <input id="burgAltitude" type="number" min="0" step="50" style="width: 9em" /> m
  </div>

2) Bind and show/hide altitude for Flying burgs
File: modules/ui/burg-editor.js
Anchor A: in editBurg(), after existing listeners are attached, add listener to persist altitude changes:

  byId("burgAltitude").addEventListener("change", changeAltitude);

Anchor B: in updateBurgValues(), show altitude when b.flying and set value:

  const altitudeRow = byId("burgAltitudeRow");
  if (b.flying) {
    altitudeRow.style.display = "flex";
    byId("burgAltitude").value = b.altitude ?? 1000; // default 1000 m if unset
  } else {
    altitudeRow.style.display = "none";
  }

Also tweak the Elevation display for flying burgs (optional but recommended):

  if (b.flying) byId("burgElevation").innerHTML = `${b.altitude ?? 1000} m (sky altitude)`;
  else byId("burgElevation").innerHTML = getHeight(pack.cells.h[b.cell]);

Anchor C: add the changeAltitude() handler alongside other change handlers:

  function changeAltitude() {
    const id = +elSelected.attr("data-id");
    const burg = pack.burgs[id];
    burg.altitude = Math.max(0, Math.round(+byId("burgAltitude").value));
  }

3) Set a default altitude when creating/toggling sky burgs
File: modules/ui/burgs-overview.js
Anchor: in addBurgOnClick(), when marking a water-placed burg as flying/skyPort, also initialize altitude:

  burg.altitude = burg.altitude ?? 1000;

File: modules/ui/burg-editor.js
Anchor: in toggleFeature(), in the Flying branch when turning on, also set default altitude if missing:

  if (turnOn && (burg.altitude == null)) burg.altitude = 1000;

Notes
- Altitude is stored per-burg (e.g., 1000 = 1000 meters). It does not alter `cells.h` and won’t affect terrain/temperature automatically.
- CSV/GeoJSON exports may not include `altitude` by default; add it to exporters if you need it in data outputs.

Appendix — Force Watabou (MFCG) city links for sky burgs

Goal: for any sky burg (Flying/Sky Port), open Watabou’s city generator with fixed options that suit floating cities, e.g.

  https://watabou.github.io/city-generator/?size=25&seed=588489202&citadel=1&urban_castle=1&plaza=1&temple=1&walls=1&shantytown=0&coast=0&river=0&greens=1&gates=0

Files and anchors
- File: modules/ui/editors.js
- Anchors: getBurgLink(burg), createMfcgLink(burg)

1) Prefer MFCG link for sky burgs
In getBurgLink(burg), before existing logic, short‑circuit for Flying/Sky Port burgs:

  function getBurgLink(burg) {
    if (burg.link) return burg.link;
    if (burg.flying || burg.skyPort) return createMfcgLink(burg, /*isSky*/ true);
    ... existing logic ...
  }

2) Add sky mode to createMfcgLink and override parameters
Change the function signature and branch overrides:

  function createMfcgLink(burg, isSky = false) {
    const {cells} = pack;
    const {i, name, population: burgPopulation, cell} = burg;
    const burgSeed = burg.MFCG || seed + String(burg.i).padStart(4, 0);

    const sizeRaw = 2.13 * Math.pow((burgPopulation * populationRate) / urbanDensity, 0.385);
    const size = isSky ? 25 : minmax(Math.ceil(sizeRaw), 6, 100);
    const population = rn(burgPopulation * populationRate * urbanization);

    const river = isSky ? 0 : (cells.r[cell] ? 1 : 0);
    const coast = isSky ? 0 : Number(burg.port > 0);

    // Only compute sea direction for non-sky cities
    const sea = !isSky && coast && cells.haven[cell]
      ? (() => { const p1 = cells.p[cell], p2 = cells.p[cells.haven[cell]];
                 let deg = (Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180) / Math.PI - 90;
                 if (deg < 0) deg += 360; return rn(normalize(deg, 0, 360) * 2, 2); })()
      : null;

    const farms = isSky ? 0 : +([5,6,7,8].includes(cells.biome[cell]));

    // Force features for sky cities
    const citadel = isSky ? 1 : +burg.citadel;
    const urban_castle = isSky ? 1 : +(citadel && each(2)(i));
    const hub = isSky ? 0 : Routes.isCrossroad(cell);
    const walls = isSky ? 1 : +burg.walls;
    const plaza = isSky ? 1 : +burg.plaza;
    const temple = isSky ? 1 : +burg.temple;
    const shantytown = isSky ? 0 : +burg.shanty;
    const greens = isSky ? 1 : undefined; // optional MFCG param for parks/greens
    const gates = isSky ? 0 : -1; // per request: no city gates for sky cities

    const params = {
      name, population, size, seed: burgSeed,
      river, coast, farms, citadel, urban_castle, hub, plaza, temple, walls, shantytown,
      // Watabou accepts extra flags; only append when defined
    };
    if (greens !== undefined) params.greens = greens;
    if (gates !== undefined) params.gates = gates;

  const url = new URL("https://watabou.github.io/city-generator/");
  url.search = new URLSearchParams(params);
  if (sea) url.searchParams.append("sea", sea);
  return url.toString();
  }

Appendix — Style sky burg icons as a separate group

Goal: render Flying/Sky Port burg icons in their own SVG subgroup so you can size/color them independently via the Style editor.

Files and anchors
- File: main.js (add a group under `#burgIcons`)
- File: modules/renderers/draw-burg-icons.js (render sky burg icons into the new group)
- File: modules/ui/style-presets.js (expose style controls for the group)

1) Add the `#skyburgs` icon group in the DOM
File: main.js
Anchor: where `#burgIcons` is created (near `let burgIcons = icons.append("g").attr("id", "burgIcons");`).

Add:
  burgIcons.append("g").attr("id", "skyburgs");

2) Render sky burgs into `#skyburgs`
File: modules/renderers/draw-burg-icons.js
Anchors: top-level filters that compute `capitals` and `towns`, and the draw pass where circles are appended.

- Exclude sky burgs from capitals/towns:
  const capitals = pack.burgs.filter(b => b.capital && !b.removed && !(b.flying || b.skyPort));
  const towns = pack.burgs.filter(b => b.i && !b.capital && !b.removed && !(b.flying || b.skyPort));

- After drawing towns, add a new pass:

  // Sky burgs (flying or sky port)
  const sky = pack.burgs.filter(b => b.i && !b.removed && (b.flying || b.skyPort));
  const skyIcons = burgIcons.select("#skyburgs");
  const skySize = skyIcons.attr("size") || 0.6;
  skyIcons
    .selectAll("circle")
    .data(sky)
    .enter()
    .append("circle")
    .attr("id", d => "burg" + d.i)
    .attr("data-id", d => d.i)
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", skySize);

3) Expose `#skyburgs` in the Style editor
File: modules/ui/style-presets.js
Anchor: in the attributes map alongside `#burgIcons > #cities` and `#burgIcons > #towns`.

Add an entry:
  "#burgIcons > #skyburgs": [
    "opacity","fill","fill-opacity","size","stroke","stroke-width","stroke-dasharray","stroke-linecap"
  ],

Usage
- Open Style → element `burgIcons` → group `skyburgs` and set `size`, `fill`, `stroke`, etc.
- Defaults: if no size is set, `draw-burg-icons` uses `0.6` as a fallback.
- Optional: add preset defaults for `#burgIcons > #skyburgs` in your styles/*.json if you want consistent theme styling.

Notes
- This keeps existing behavior for non‑sky burgs.
- If you want a different default size for sky cities, adjust `size = isSky ? 25 : ...`.
- The “roads” control in MFCG is indirect; setting `hub=0` and `gates=0` reduces road/gate features. There is no direct `roads=0` flag.
