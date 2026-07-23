import { geoGraticule, geoOrthographic, geoPath, interpolateSpectral, range, scaleSequential, select } from "d3";
import { convertTemperature, destroyDialogIfExists, ensureEl, findEl, parseTransform, rn, round } from "../utils";

const projection = geoOrthographic().translate([100, 100]).scale(100);
const path = geoPath(projection);

function open(): void {
  if (customization) return;

  renderDialog();
  updateInputValues();
  updateGlobeTemperature();
  updateGlobePosition();
  updateWindDirections();

  $("#worldConfigurator").dialog({
    title: "Configure World",
    resizable: false,
    width: "minmax(40em, 85vw)",
    buttons: { "Update world": updateWorld },
    open: function (this: HTMLElement) {
      const checkbox = /* html */ `<div class="dontAsk" data-tip="Automatically update world on input changes and button clicks">
        <input id="wcAutoChange" class="checkbox" type="checkbox" checked />
        <label for="wcAutoChange" class="checkbox-label"><i>auto-apply changes</i></label>
      </div>`;
      const pane = this.parentElement?.querySelector(".ui-dialog-buttonpane");
      pane?.insertAdjacentHTML("afterbegin", checkbox);

      const button = this.parentElement?.querySelector(".ui-dialog-buttonset > button");
      button?.on("mousemove", () => tip("Apply current settings to the map"));
    },
    close: () => destroyDialogIfExists("worldConfigurator")
  });
}

function renderDialog(): void {
  destroyDialogIfExists("worldConfigurator");
  ensureEl("dialogs").insertAdjacentHTML("beforeend", createDialogHtml());
  addListeners();
}

function createDialogHtml(): string {
  const temperatureControl = (param: string, label: string, dataTip: string): string => /* html */ `<div>
    <i data-locked="0" id="lock_${param}" class="icon-lock-open"></i>
    <label data-tip="${dataTip}">
      <i>${label}:</i>
      <input id="${param}Input" type="number" min="-50" max="50" />
      <span>°C<span id="${param}Converted"></span></span>
      <input id="${param}Output" type="range" min="-50" max="50" />
    </label>
  </div>`;

  return /* html */ `<div id="worldConfigurator" class="dialog stable">
    <div style="display: flex">
      <div id="worldControls">
        ${temperatureControl("temperatureEquator", "Equator", "Set temperature at equator")}
        ${temperatureControl("temperatureNorthPole", "North Pole", "Set the North Pole average yearly temperature")}
        ${temperatureControl("temperatureSouthPole", "South Pole", "Set the South Pole average yearly temperature")}
        <div>
          <i data-locked="0" id="lock_mapSize" class="icon-lock-open"></i>
          <label data-tip="Set map size relative to the world size">
            <i>Map size:</i>
            <input id="mapSizeInput" type="number" min="1" max="100" step="0.1" />%
            <input id="mapSizeOutput" type="range" min="1" max="100" step="0.1" />
          </label>
        </div>
        <div>
          <i data-locked="0" id="lock_latitude" class="icon-lock-open"></i>
          <label data-tip="Set a North-South map shift, set to 50 to make map center lie on Equator">
            <i>Latitudes:</i>
            <input id="latitudeInput" type="number" min="0" max="100" step="0.1" />
            <br /><i>N</i
            ><input
              id="latitudeOutput"
              type="range"
              min="0"
              max="100"
              step="0.1"
              style="width: 10.3em"
            /><i>S</i>
          </label>
        </div>
        <div>
          <i data-locked="0" id="lock_longitude" class="icon-lock-open"></i>
          <label data-tip="Set a West-East map shift, set to 50 to make map center lie on Prime meridian">
            <i>Longitudes:</i>
            <input id="longitudeInput" type="number" min="0" max="100" step="0.1" />
            <br /><i>W</i
            ><input
              id="longitudeOutput"
              type="range"
              min="0"
              max="100"
              step="0.1"
              style="width: 10.3em"
            /><i>E</i>
          </label>
        </div>
        <div>
          <label
            data-tip="Set precipitation - water amount clouds can bring. Defines rivers and biomes generation. Keep around 100% for default generation"
          >
            <i data-locked="0" id="lock_prec" class="icon-lock-open"></i>
            <i>Precipitation:</i>
            <input id="precInput" type="number" />%
            <input id="precOutput" type="range" min="0" max="500" />
          </label>
        </div>
        <div data-tip="Canvas size. Can be changed in general options on new map generation">
          <i>Canvas size:</i><br />
          <span id="mapSize"></span> px = <span id="mapSizeFriendly"></span>
        </div>
        <div>
          <i data-tip="Length of Meridian. Almost half of the equator length">Meridian length:</i><br />
          <span id="meridianLength" data-tip="Length of Meridian in pixels"></span> px =
          <span
            id="meridianLengthFriendly"
            data-tip="Length of Meridian is friendly units (depends on user configuration)"
          ></span>
          <span
            id="meridianLengthEarth"
            data-tip="Fantasy world Meridian length relative to real-world Earth (20k km)"
          ></span>
        </div>
        <div data-tip="Map coordinates on globe"><i>Coords:</i> <span id="mapCoordinates"></span></div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: flex-end">
        <svg id="globe" width="22em" viewBox="-20 -25 240 240">
          <defs>
            <linearGradient id="temperatureGradient" x1="0" x2="0" y1="0" y2="1">
              <stop id="grad90" offset="0%" stop-color="blue" />
              <stop id="grad60" offset="16.6%" stop-color="green" />
              <stop id="grad30" offset="33.3%" stop-color="yellow" />
              <stop id="grad0" offset="50%" stop-color="red" />
              <stop id="grad-30" offset="66.6%" stop-color="yellow" />
              <stop id="grad-60" offset="83.3%" stop-color="green" />
              <stop id="grad-90" offset="100%" stop-color="blue" />
            </linearGradient>
          </defs>
          <g id="globeNoteLines">
            <line x1="5" x2="220" y1="0" y2="0" />
            <line x1="5" x2="220" y1="13" y2="13" />
            <line x1="5" x2="220" y1="49.5" y2="49.5" />
            <line x1="-5" x2="220" y1="100" y2="100" />
            <line x1="5" x2="220" y1="150.5" y2="150.5" />
            <line x1="5" x2="220" y1="187" y2="187" />
            <line x1="5" x2="220" y1="200" y2="200" />
          </g>
          <g id="globeWindArrows" data-tip="Click to change wind direction" stroke-linejoin="round">
            <circle cx="210" cy="6" r="12" />
            <path data-tier="0" d="M210,11 v-10 l-3,3 m6,0 l-3,-3" transform="rotate(225 210 6)" />
            <circle cx="210" cy="30" r="12" />
            <path data-tier="1" d="M210,35 v-10 l-3,3 m6,0 l-3,-3" transform="rotate(45 210 30)" />
            <circle cx="210" cy="75" r="12" />
            <path data-tier="2" d="M210,80 v-10 l-3,3 m6,0 l-3,-3" transform="rotate(225 210 75)" />
            <circle cx="210" cy="130" r="12" />
            <path data-tier="3" d="M210,135 v-10 l-3,3 m6,0 l-3,-3" transform="rotate(315 210 130)" />
            <circle cx="210" cy="173" r="12" />
            <path data-tier="4" d="M210,178 v-10 l-3,3 m6,0 l-3,-3" transform="rotate(135 210 173)" />
            <circle cx="210" cy="194" r="12" />
            <path data-tier="5" d="M210,199 v-10 l-3,3 m6,0 l-3,-3" transform="rotate(315 210 194)" />
          </g>
          <g id="globaAxisLabels">
            <text x="82%" y="-4%">wind</text>
            <text x="-8%" y="-4%">latitude</text>
          </g>
          <g id="globeLatLabels">
            <text x="-15" y="5">90°</text>
            <text x="-15" y="18">60°</text>
            <text x="-15" y="53">30°</text>
            <text x="-15" y="103">0°</text>
            <text x="-15" y="153">30°</text>
            <text x="-15" y="190">60°</text>
            <text x="-15" y="204">90°</text>
          </g>
          <circle id="globeGradient" cx="100" cy="100" r="100" fill="url(#temperatureGradient)" stroke="none" />
          <line id="globePrimeMeridian" x1="100" x2="100" y1="0" y2="200" />
          <line id="globeEquator" x1="1" x2="200" y1="100" y2="100" />
          <circle id="globeOutline" cx="100" cy="100" r="100" fill="none" />
          <path id="globeGraticule" />
          <path id="globeArea" />
        </svg>
        <button id="restoreWinds" data-tip="Click to restore default (Earth-based) wind directions">
          Restore winds
        </button>
      </div>
    </div>
    <div style="margin-top: 0.3em">
      <i>Presets:</i>
      <button id="wcWholeWorld" data-tip="Click to set map size to cover the whole world">Whole world</button>
      <button id="wcNorthern" data-tip="Click to set map size to cover the Northern latitudes">Northern</button>
      <button id="wcTropical" data-tip="Click to set map size to cover the Tropical latitudes">Tropical</button>
      <button id="wcSouthern" data-tip="Click to set map size to cover the Southern latitudes">Southern</button>
    </div>
  </div>`;
}

function addListeners(): void {
  select("#globe").select("#globeWindArrows").on("click", handleWindChange);
  select("#globe")
    .select("#globeGraticule")
    .attr("d", round(path(geoGraticule()()) ?? "")); // globe graticule

  ensureEl("temperatureEquatorInput").on("input", changeTemperatureEquator);
  ensureEl("temperatureEquatorOutput").on("input", changeTemperatureEquator);
  ensureEl("temperatureNorthPoleInput").on("input", changeTemperatureNorthPole);
  ensureEl("temperatureNorthPoleOutput").on("input", changeTemperatureNorthPole);
  ensureEl("temperatureSouthPoleInput").on("input", changeTemperatureSouthPole);
  ensureEl("temperatureSouthPoleOutput").on("input", changeTemperatureSouthPole);
  ensureEl("mapSizeInput").on("input", changeMapSize);
  ensureEl("mapSizeOutput").on("input", changeMapSize);
  ensureEl("latitudeInput").on("input", changeLatitude);
  ensureEl("latitudeOutput").on("input", changeLatitude);
  ensureEl("longitudeInput").on("input", changeLongitude);
  ensureEl("longitudeOutput").on("input", changeLongitude);
  ensureEl("precInput").on("input", changePrecipitation);
  ensureEl("precOutput").on("input", changePrecipitation);

  ensureEl("restoreWinds").on("click", restoreDefaultWinds);
  ensureEl("wcWholeWorld").on("click", () => applyWorldPreset(100, 50));
  ensureEl("wcNorthern").on("click", () => applyWorldPreset(33, 25));
  ensureEl("wcTropical").on("click", () => applyWorldPreset(33, 50));
  ensureEl("wcSouthern").on("click", () => applyWorldPreset(33, 75));

  // lock icons: sync state from storage and toggle on click (stored == locked)
  ensureEl("worldConfigurator")
    .querySelectorAll<HTMLElement>("[data-locked]")
    .forEach(el => {
      const id = el.id.slice(5) as WorldOption; // drop "lock_" prefix
      setLockIcon(el, stored(id) !== null);

      el.on("mouseover", (event: Event) => {
        event.stopPropagation();
        if (el.className === "icon-lock")
          tip("Click to unlock the option and allow it to be randomized on new map generation");
        else tip("Click to lock the option and always use the current value on new map generation");
      });
      el.on("click", () => {
        if (el.className === "icon-lock") unlockOption(id);
        else lockOption(id);
      });
    });
}

type WorldOption =
  | "temperatureEquator"
  | "temperatureNorthPole"
  | "temperatureSouthPole"
  | "mapSize"
  | "latitude"
  | "longitude"
  | "prec";

// stored options are locked (won't be randomized on new map generation), the icon is just a mirror
function lockOption(id: WorldOption): void {
  localStorage.setItem(id, String(options[id]));
  const icon = findEl(`lock_${id}`);
  if (icon) setLockIcon(icon, true);
}

function unlockOption(id: WorldOption): void {
  localStorage.removeItem(id);
  const icon = findEl(`lock_${id}`);
  if (icon) setLockIcon(icon, false);
}

function setLockIcon(el: HTMLElement, isLocked: boolean): void {
  el.dataset.locked = isLocked ? "1" : "0";
  el.className = isLocked ? "icon-lock" : "icon-lock-open";
}

// inputs are always in °C; show " = <value>" in user units if user units are not °C
function convertedTemperature(temperatureCelsius: number): string {
  const userUnits = ensureEl<HTMLSelectElement>("temperatureScale").value;
  if (userUnits === "°C") return "";
  return ` = ${convertTemperature(temperatureCelsius)}`;
}

function changeTemperatureEquator(this: HTMLInputElement): void {
  options.temperatureEquator = Number(this.value);
  ensureEl<HTMLInputElement>("temperatureEquatorInput").value = this.value;
  ensureEl<HTMLInputElement>("temperatureEquatorOutput").value = this.value;
  ensureEl("temperatureEquatorConverted").innerText = convertedTemperature(options.temperatureEquator);
  lockOption("temperatureEquator");
  if (ensureEl<HTMLInputElement>("wcAutoChange").checked) updateWorld();
}

function changeTemperatureNorthPole(this: HTMLInputElement): void {
  options.temperatureNorthPole = Number(this.value);
  ensureEl<HTMLInputElement>("temperatureNorthPoleInput").value = this.value;
  ensureEl<HTMLInputElement>("temperatureNorthPoleOutput").value = this.value;
  ensureEl("temperatureNorthPoleConverted").innerText = convertedTemperature(options.temperatureNorthPole);
  lockOption("temperatureNorthPole");
  if (ensureEl<HTMLInputElement>("wcAutoChange").checked) updateWorld();
}

function changeTemperatureSouthPole(this: HTMLInputElement): void {
  options.temperatureSouthPole = Number(this.value);
  ensureEl<HTMLInputElement>("temperatureSouthPoleInput").value = this.value;
  ensureEl<HTMLInputElement>("temperatureSouthPoleOutput").value = this.value;
  ensureEl("temperatureSouthPoleConverted").innerText = convertedTemperature(options.temperatureSouthPole);
  lockOption("temperatureSouthPole");
  if (ensureEl<HTMLInputElement>("wcAutoChange").checked) updateWorld();
}

function changeMapSize(this: HTMLInputElement): void {
  options.mapSize = Number(this.value);
  ensureEl<HTMLInputElement>("mapSizeInput").value = this.value;
  ensureEl<HTMLInputElement>("mapSizeOutput").value = this.value;
  lockOption("mapSize");
  if (ensureEl<HTMLInputElement>("wcAutoChange").checked) updateWorld();
}

function changeLatitude(this: HTMLInputElement): void {
  options.latitude = Number(this.value);
  ensureEl<HTMLInputElement>("latitudeInput").value = this.value;
  ensureEl<HTMLInputElement>("latitudeOutput").value = this.value;
  lockOption("latitude");
  if (ensureEl<HTMLInputElement>("wcAutoChange").checked) updateWorld();
}

function changeLongitude(this: HTMLInputElement): void {
  options.longitude = Number(this.value);
  ensureEl<HTMLInputElement>("longitudeInput").value = this.value;
  ensureEl<HTMLInputElement>("longitudeOutput").value = this.value;
  lockOption("longitude");
  if (ensureEl<HTMLInputElement>("wcAutoChange").checked) updateWorld();
}

function changePrecipitation(this: HTMLInputElement): void {
  options.prec = Number(this.value);
  ensureEl<HTMLInputElement>("precInput").value = this.value;
  ensureEl<HTMLInputElement>("precOutput").value = this.value;
  lockOption("prec");
  if (ensureEl<HTMLInputElement>("wcAutoChange").checked) updateWorld();
}

function updateInputValues(): void {
  ensureEl<HTMLInputElement>("temperatureEquatorInput").value = String(options.temperatureEquator);
  ensureEl<HTMLInputElement>("temperatureEquatorOutput").value = String(options.temperatureEquator);
  ensureEl<HTMLInputElement>("temperatureNorthPoleInput").value = String(options.temperatureNorthPole);
  ensureEl<HTMLInputElement>("temperatureNorthPoleOutput").value = String(options.temperatureNorthPole);
  ensureEl<HTMLInputElement>("temperatureSouthPoleInput").value = String(options.temperatureSouthPole);
  ensureEl<HTMLInputElement>("temperatureSouthPoleOutput").value = String(options.temperatureSouthPole);
  ensureEl<HTMLInputElement>("mapSizeInput").value = String(options.mapSize);
  ensureEl<HTMLInputElement>("mapSizeOutput").value = String(options.mapSize);
  ensureEl<HTMLInputElement>("latitudeInput").value = String(options.latitude);
  ensureEl<HTMLInputElement>("latitudeOutput").value = String(options.latitude);
  ensureEl<HTMLInputElement>("longitudeInput").value = String(options.longitude);
  ensureEl<HTMLInputElement>("longitudeOutput").value = String(options.longitude);
  ensureEl<HTMLInputElement>("precInput").value = String(options.prec);
  ensureEl<HTMLInputElement>("precOutput").value = String(options.prec);
  ensureEl("temperatureEquatorConverted").innerText = convertedTemperature(options.temperatureEquator);
  ensureEl("temperatureNorthPoleConverted").innerText = convertedTemperature(options.temperatureNorthPole);
  ensureEl("temperatureSouthPoleConverted").innerText = convertedTemperature(options.temperatureSouthPole);
}

function updateWorld(): void {
  updateGlobeTemperature();
  updateGlobePosition();
  calculateTemperatures();
  generatePrecipitation();
  const heights = new Uint8Array(pack.cells.h);
  Rivers.generate();
  Rivers.specify();
  pack.cells.h = new Float32Array(heights);
  Biomes.define();
  Features.defineGroups();
  Lakes.defineNames();

  if (layerIsOn("toggleTemperature")) drawTemperature();
  if (layerIsOn("togglePrecipitation")) drawPrecipitation();
  if (layerIsOn("toggleBiomes")) drawBiomes();
  if (layerIsOn("toggleCoordinates")) drawCoordinates();
  if (layerIsOn("toggleRivers")) drawRivers();
  if (findEl("canvas3d")) setTimeout(() => window.Controllers.View3d.update(), 500);
}

function updateGlobePosition(): void {
  const eqD = ((graphHeight / 2) * 100) / options.mapSize;

  calculateMapCoordinates();
  const mc = mapCoordinates;
  const unit = distanceUnitInput.value;
  const meridian = toKilometer(eqD * 2 * distanceScale);
  ensureEl("mapSize").innerHTML = `${graphWidth}x${graphHeight}`;
  ensureEl("mapSizeFriendly").innerHTML =
    `${rn(graphWidth * distanceScale)}x${rn(graphHeight * distanceScale)} ${unit}`;
  ensureEl("meridianLength").innerHTML = String(rn(eqD * 2));
  ensureEl("meridianLengthFriendly").innerHTML = `${rn(eqD * 2 * distanceScale)} ${unit}`;
  ensureEl("meridianLengthEarth").innerHTML = meridian ? ` = ${rn(meridian / 200)}%🌏` : "";
  ensureEl("mapCoordinates").innerHTML =
    `${lat(mc.latN ?? 0)} ${Math.abs(rn(mc.lonW ?? 0))}°W; ${lat(mc.latS ?? 0)} ${rn(mc.lonE ?? 0)}°E`;

  function toKilometer(v: number): number {
    if (unit === "km") return v;
    if (unit === "mi") return v * 1.60934;
    if (unit === "lg") return v * 4.828;
    if (unit === "vr") return v * 1.0668;
    if (unit === "nmi") return v * 1.852;
    if (unit === "nlg") return v * 5.556;
    return 0; // 0 if distanceUnitInput is a custom unit
  }

  // parse latitude value
  function lat(latitude: number): string {
    return latitude > 0 ? `${Math.abs(rn(latitude))}°N` : `${Math.abs(rn(latitude))}°S`;
  }

  const area = geoGraticule().extent([
    [mc.lonW ?? 0, mc.latN ?? 0],
    [mc.lonE ?? 0, mc.latS ?? 0]
  ]);

  select("#globe")
    .select("#globeArea")
    .attr("d", round(path(area.outline()) ?? "")); // map area
}

// update temperatures on globe (visual-only)
function updateGlobeTemperature(): void {
  const tEq = options.temperatureEquator;
  const tNP = options.temperatureNorthPole;
  const tSP = options.temperatureSouthPole;

  const scale = scaleSequential(interpolateSpectral);
  const getColor = (value: number): string => scale(1 - value);
  const [tMin, tMax] = [-25, 30]; // temperature extremes
  const tDelta = tMax - tMin;

  select("#globe")
    .select("#grad90")
    .attr("stop-color", getColor((tNP - tMin) / tDelta));
  select("#globe")
    .select("#grad60")
    .attr("stop-color", getColor((tEq - ((tEq - tNP) * 2) / 3 - tMin) / tDelta));
  select("#globe")
    .select("#grad30")
    .attr("stop-color", getColor((tEq - ((tEq - tNP) * 1) / 4 - tMin) / tDelta));
  select("#globe")
    .select("#grad0")
    .attr("stop-color", getColor((tEq - tMin) / tDelta));
  select("#globe")
    .select("#grad-30")
    .attr("stop-color", getColor((tEq - ((tEq - tSP) * 1) / 4 - tMin) / tDelta));
  select("#globe")
    .select("#grad-60")
    .attr("stop-color", getColor((tEq - ((tEq - tSP) * 2) / 3 - tMin) / tDelta));
  select("#globe")
    .select("#grad-90")
    .attr("stop-color", getColor((tSP - tMin) / tDelta));
}

function updateWindDirections(): void {
  select("#globe")
    .select("#globeWindArrows")
    .selectAll<SVGPathElement, unknown>("path")
    .each(function (_d, i) {
      const tr = parseTransform(this.getAttribute("transform") ?? "");
      this.setAttribute("transform", `rotate(${options.winds[i]} ${tr[1]} ${tr[2]})`);
    });
}

function handleWindChange(event: Event): void {
  const target = event.target as SVGElement;
  // each arrow is a circle followed by a path; the click can land on either
  const arrow = (target.tagName === "path" ? target : target.nextElementSibling) as SVGPathElement | null;
  if (!arrow?.dataset.tier) return;
  const tier = +arrow.dataset.tier;
  options.winds[tier] = (options.winds[tier] + 45) % 360;
  const tr = parseTransform(arrow.getAttribute("transform") ?? "");
  arrow.setAttribute("transform", `rotate(${options.winds[tier]} ${tr[1]} ${tr[2]})`);
  localStorage.setItem("winds", String(options.winds));

  const mapTiers = range(mapCoordinates.latN ?? 0, mapCoordinates.latS ?? 0, -30).map(c => ((90 - c) / 30) | 0);
  if (ensureEl<HTMLInputElement>("wcAutoChange").checked && mapTiers.includes(tier)) updateWorld();
}

function restoreDefaultWinds(): void {
  const defaultWinds = [225, 45, 225, 315, 135, 315];
  const mapTiers = range(mapCoordinates.latN ?? 0, mapCoordinates.latS ?? 0, -30).map(c => ((90 - c) / 30) | 0);
  const shouldUpdate =
    ensureEl<HTMLInputElement>("wcAutoChange").checked && mapTiers.some(t => options.winds[t] !== defaultWinds[t]);
  options.winds = defaultWinds;
  updateWindDirections();
  if (shouldUpdate) updateWorld();
}

function applyWorldPreset(size: number, latitude: number): void {
  options.mapSize = size;
  options.latitude = latitude;
  updateInputValues();
  lockOption("mapSize");
  lockOption("latitude");
  if (ensureEl<HTMLInputElement>("wcAutoChange").checked) updateWorld();
}

export const WorldConfigurator = { open };
