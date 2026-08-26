import { type Selection, select } from "d3";
import { closeDialogs, confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { removeEmblem } from "@/renderers/draw-emblems";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { getHeight, openURL, speak } from "@/utils";
import { MAX_ZOOM, PAN_ZOOM_IDENTITY, type PanZoom, panBy, zoomAt } from "@/utils/panZoomUtils";
import type { Burg } from "../generators/burgs-generator";
import { convertTemperature, ensureEl, getPointer, getTemperatureLikeness, rand, rn } from "../utils";
import type { PromptOptions } from "../utils/commonUtils";

declare const prompt: (text: string, options: PromptOptions, callback: (value: string | number) => void) => void;

let selected: Selection<any, any, any, any> | null = null;
let previewTransform: PanZoom = { ...PAN_ZOOM_IDENTITY };
let previewMaxZoom = MAX_ZOOM;
let previewCommittedK = 1;
let previewSettleTimer = 0;
let previewLayoutLocked = false;

function open(id: number | string): void {
  if (customization) return;
  closeDialogs(".stable");
  Layers.show("burgIcons", "labels");

  selected = select<any, unknown>("#labels").select(`[data-label-type='burg'][data-id='${id}']`);
  if (!selected.size()) selected = select<any, unknown>("#burgIcons").select(`[data-id='${id}']`);

  renderDialog();
  updateGroupsList();
  updateBurgValues();

  $("#burgEditor").dialog({
    title: "Edit Burg",
    resizable: false,
    close: closeBurgEditor,
    position: { my: "left top", at: "left+10 top+10", of: "svg", collision: "fit" }
  });
}

function renderDialog(): void {
  destroyDialog("burgEditor");
  const editorHtml = /* html */ `<div id="burgEditor" class="dialog" data-burg-id="${getSelectedId()}">
      <div id="burgBody" style="padding-bottom: 0.3em">
        <div style="display: flex; align-items: center">
          <svg data-tip="Burg emblem. Click to edit" class="pointer" viewBox="0 0 200 200" width="13em" height="13em">
            <use id="burgEmblem"></use>
          </svg>
          <div style="display: grid; grid-auto-rows: minmax(1.6em, auto)">
            <div id="burgProvinceAndState" style="font-weight: bold; max-width: 16em"></div>
            <div>
              <div class="label">Name:</div>
              <input
                id="burgName"
                data-tip="Type to rename the burg"
                autocorrect="off"
                spellcheck="false"
                style="width: 9em"
              />
              <span id="burgNameSpeak" data-tip="Speak the name. You can change voice and language in options" class="speaker">🔊</span>
              <span
                id="burgNameReRandom"
                data-tip="Generate random name for the burg"
                class="icon-globe pointer"
              ></span>
            </div>
            <div data-tip="Select burg group. Groups defines burg icon, label size and style">
              <div class="label">Group:</div>
              <select id="burgGroup" style="width: 9em"></select>
              <span id="burgGroupConfigure" data-tip="Configure burg groups" class="icon-cog pointer"></span>
            </div>
            <div data-tip="Select burg type. Type slightly affects emblem generation">
              <div class="label">Type:</div>
              <select id="burgType" style="width: 9em">
                <option value="Generic">Generic</option>
                <option value="River">River</option>
                <option value="Lake">Lake</option>
                <option value="Naval">Naval</option>
                <option value="Nomadic">Nomadic</option>
                <option value="Hunting">Hunting</option>
                <option value="Highland">Highland</option>
              </select>
            </div>
            <div data-tip="Select dominant culture">
              <div class="label">Culture:</div>
              <select id="burgCulture" style="width: 9em"></select>
              <span
                id="burgNameReCulture"
                data-tip="Generate culture-specific name for the burg"
                class="icon-book pointer"
              ></span>
            </div>
            <div data-tip="Set burg population">
              <div class="label">Population:</div>
              <input id="burgPopulation" type="number" min="0" step="1" style="width: 9em" />
            </div>
            <div data-tip="Burg average yearly temperature" style="display: flex; justify-content: space-between">
              <div>
                <div class="label">Temperature:</div>
                <span id="burgTemperature"></span>
              </div>
              <div style="display: flex; gap: 0.5em">
                <i class="icon-info-circled" id="burgTemperatureLikeIn"></i>
                <i
                  id="burgTemperatureGraph"
                  data-tip="Show temperature graph for the burg"
                  class="icon-chart-area pointer"
                ></i>
              </div>
            </div>
            <div data-tip="Burg height above mean sea level">
              <div class="label">Elevation:</div>
              <span id="burgElevation"></span> above sea level
            </div>
            <div>
              <div class="label">Features:</div>
              <span
                id="burgCapital"
                data-tip="Shows whether the burg is a state capital. Click to toggle"
                data-feature="capital"
                class="burgFeature icon-star"
              ></span>
              <span
                id="burgPort"
                data-tip="Shows whether the burg is a port. Click to toggle"
                data-feature="port"
                class="burgFeature icon-anchor"
              ></span>
              <span
                id="burgCitadel"
                data-tip="Shows whether the burg has a citadel (castle). Click to toggle"
                data-feature="citadel"
                class="burgFeature icon-chess-rook"
                style="font-size: 1.1em"
              ></span>
              <span
                id="burgWalls"
                data-tip="Shows whether the burg is walled. Click to toggle"
                data-feature="walls"
                class="burgFeature icon-fort-awesome"
              ></span>
              <span
                id="burgPlaza"
                data-tip="Shows whether the burg is a trade center (market center). Click to toggle"
                data-feature="plaza"
                class="burgFeature icon-store"
                style="font-size: 1em"
              ></span>
              <span
                id="burgTemple"
                data-tip="Shows whether the burg is a religious center. Click to toggle"
                data-feature="temple"
                class="burgFeature icon-chess-bishop"
                style="font-size: 1.1em; margin-left: 3px"
              ></span>
              <span
                id="burgShanty"
                data-tip="Shows whether the burg has a shanty town. Click to toggle"
                data-feature="shanty"
                class="burgFeature icon-campground"
                style="font-size: 1em"
              ></span>
            </div>
            <div data-tip="Burg average daily production">
              <div class="label">Production:</div>
              <span id="burgProduction" style="display: inline-flex; flex-wrap: wrap; column-gap: 0.3em; max-width: 110px;"></span>
            </div>
            <div data-tip="Gross product per population point, daily average">
              <div class="label">Wealth</div>
              <span id="burgWealth"></span>
            </div>
            <div data-tip="Treasury balance after production, purchases, and sales">
              <div class="label">Treasury</div>
              <span id="burgTreasury"></span>
            </div>
          </div>
        </div>
        <div id="burgPreviewSection" data-tip="Burg map preview: scroll to zoom, drag to pan" style="display: flex; flex-direction: column">
          <div style="display: flex; justify-content: space-between">
            <span>Burg preview:</span>
            <div style="display: flex; gap: 0.5em">
              <i id="burgPreviewReset" data-tip="Reset preview zoom" class="icon-ccw pointer"></i>
              <i id="burgLinkOpen" data-tip="Open burg map in a new tab" class="icon-link-ext pointer"></i>
            </div>
          </div>
          <div
            id="burgPreviewObject"
            style="overflow: hidden; position: relative; touch-action: none; height: 320px; max-width: 60vw; max-height: 60vh"
          ></div>
        </div>
      </div>
      <div id="burgBottom">
        <button id="burgStyleShow" data-tip="Show style edit section" class="icon-brush"></button>
        <div id="burgStyleSection" style="display: none">
          <button id="burgStyleHide" data-tip="Hide style edit section" class="icon-brush"></button>
          <button
            id="burgEditLabelStyle"
            data-tip="Edit label style for burg group in Style Editor"
            class="icon-font"
          ></button>
          <button
            id="burgEditIconStyle"
            data-tip="Edit icon style for burg group in Style Editor"
            class="icon-dot-circled"
          ></button>
          <button
            id="burgEditAnchorStyle"
            data-tip="Edit port icon (anchor) style for burg group in Style Editor"
            class="icon-anchor"
          ></button>
        </div>
        <button id="burgEditLabel" data-tip="Edit this burg label" class="icon-font"></button>
        <button id="burgEditEmblem" data-tip="Edit emblem" class="icon-shield-alt"></button>
        <button id="burgSetPreviewLink" data-tip="Set custom burg map URL" class="icon-map-o"></button>
        <button id="burgLocate" data-tip="Zoom map and center view in the burg" class="icon-target"></button>
        <button
          id="burgProductionOverview"
          data-tip="Show production overview for this burg"
          class="icon-chart-bar"
        ></button>
        <button
          id="burgRelocate"
          data-tip="Relocate burg. Click on map to move the burg"
          class="icon-map-pin"
        ></button>
        <button id="burglLegend" data-tip="Edit free text notes (legend) for this burg" class="icon-edit"></button>
        <button id="burgLock" class="icon-lock-open" onmouseover="showElementLockTip(event)"></button>
        <button
          id="burgRemove"
          data-tip="Remove non-capital burg"
          data-shortcut="Delete"
          class="icon-trash fastDelete"
        ></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);

  ensureEl("burgName").addEventListener("input", changeName);
  ensureEl("burgNameSpeak").addEventListener("click", () => speak(ensureEl<HTMLInputElement>("burgName").value));
  ensureEl("burgNameReRandom").addEventListener("click", generateNameRandom);
  ensureEl("burgGroup").addEventListener("change", changeGroup);
  ensureEl("burgGroupConfigure").addEventListener("click", editBurgGroups);
  ensureEl("burgType").addEventListener("change", changeType);
  ensureEl("burgCulture").addEventListener("change", changeCulture);
  ensureEl("burgNameReCulture").addEventListener("click", generateNameCulture);
  ensureEl("burgPopulation").addEventListener("change", changePopulation);
  ensureEl("burgBody")
    .querySelectorAll<HTMLElement>(".burgFeature")
    .forEach(el => void el.addEventListener("click", toggleFeature));
  ensureEl("burgLinkOpen").addEventListener("click", openBurgLink);
  ensureEl("burgPreviewReset").addEventListener("click", resetPreviewZoom);
  ensureEl("burgPreviewObject").addEventListener("wheel", onPreviewWheel as EventListener, { passive: false });
  ensureEl("burgPreviewObject").addEventListener("dblclick", onPreviewDoubleClick as EventListener);
  ensureEl("burgPreviewObject").addEventListener("pointerdown", onPreviewPointerDown as EventListener);

  ensureEl("burgStyleShow").addEventListener("click", showStyleSection);
  ensureEl("burgStyleHide").addEventListener("click", hideStyleSection);
  ensureEl("burgEditLabelStyle").addEventListener("click", editGroupLabelStyle);
  ensureEl("burgEditIconStyle").addEventListener("click", editGroupIconStyle);
  ensureEl("burgEditAnchorStyle").addEventListener("click", editGroupAnchorStyle);

  ensureEl("burgEmblem").addEventListener("click", openEmblemEdit);
  ensureEl("burgSetPreviewLink").addEventListener("click", setCustomPreview);
  ensureEl("burgEditEmblem").addEventListener("click", openEmblemEdit);
  ensureEl("burgLocate").addEventListener("click", zoomIntoBurg);
  ensureEl("burgEditLabel").addEventListener("click", editBurgLabel);
  ensureEl("burgRelocate").addEventListener("click", toggleRelocateBurg);
  ensureEl("burglLegend").addEventListener("click", editBurgLegend);
  ensureEl("burgLock").addEventListener("click", toggleBurgLockButton);
  ensureEl("burgRemove").addEventListener("click", removeSelectedBurg);
  ensureEl("burgTemperatureGraph").addEventListener("click", showTemperatureGraph);
  ensureEl("burgProductionOverview").addEventListener("click", showProductionOverview);
}

function getSelectedId(): number {
  return +selected!.attr("data-id");
}

function updateGroupsList(): void {
  const groupSelect = ensureEl<HTMLSelectElement>("burgGroup");
  groupSelect.options.length = 0; // remove all options
  for (const { name } of options.burgs.groups) {
    groupSelect.options.add(new Option(name, name));
  }
}

function updateBurgValues(): void {
  const id = getSelectedId();
  const b = pack.burgs[id];
  const province = pack.cells.province[b.cell];
  const provinceName = province ? `${pack.provinces[province].fullName}, ` : "";
  const stateName = pack.states[b.state!].fullName || pack.states[b.state!].name;
  ensureEl("burgProvinceAndState").innerHTML = provinceName + stateName;

  ensureEl<HTMLInputElement>("burgName").value = b.name!;
  ensureEl<HTMLSelectElement>("burgGroup").value = b.group!;
  ensureEl<HTMLSelectElement>("burgType").value = b.type || "Generic";
  ensureEl<HTMLInputElement>("burgPopulation").value = String(rn(b.population! * populationRate * urbanization));
  ensureEl("burgWealth").innerHTML = `🟡 ${rn(b.population! > 0 ? (b.product || 0) / b.population! : 0, 2)}`;
  ensureEl("burgTreasury").innerHTML = `🟡 ${rn(b.treasury || 0, 2)}`;
  ensureEl("burgEditAnchorStyle").style.display = +b.port! ? "inline-block" : "none";

  // update list and select culture
  const cultureSelect = ensureEl<HTMLSelectElement>("burgCulture");
  cultureSelect.options.length = 0;
  const cultures = pack.cultures.filter(c => !c.removed);
  cultures.forEach(c => void cultureSelect.options.add(new Option(c.name, String(c.i), false, c.i === b.culture)));

  const temperature = grid.cells.temp[pack.cells.g[b.cell]];
  ensureEl("burgTemperature").innerHTML = convertTemperature(temperature);
  ensureEl("burgTemperatureLikeIn").dataset.tip =
    `Average yearly temperature is like in ${getTemperatureLikeness(temperature)}`;
  ensureEl("burgElevation").innerHTML = getHeight(pack.cells.h[b.cell]);

  ensureEl("burgCapital").classList.toggle("inactive", !b.capital);
  ensureEl("burgPort").classList.toggle("inactive", !b.port);
  ensureEl("burgCitadel").classList.toggle("inactive", !b.citadel);
  ensureEl("burgWalls").classList.toggle("inactive", !b.walls);
  ensureEl("burgPlaza").classList.toggle("inactive", !b.plaza);
  ensureEl("burgTemple").classList.toggle("inactive", !b.temple);
  ensureEl("burgShanty").classList.toggle("inactive", !b.shanty);
  ensureEl("burgProduction").innerHTML = getProduction(Production.getBurgProduction(b));

  updateBurgLockIcon();

  // set emblem image
  const coaID = `burgCOA${id}`;
  EmblemRenderer.trigger(coaID, b.coa);
  ensureEl("burgEmblem").setAttribute("href", `#${coaID}`);

  updateBurgPreview(b);
}

function changeName(): void {
  const id = getSelectedId();
  const value = ensureEl<HTMLInputElement>("burgName").value;
  pack.burgs[id].name = value;

  if (!pack.burgs[id].label) pack.burgs[id].label = {};
  Object.assign(pack.burgs[id].label, { text: value });
  Layers.draw("labels");
}

function generateNameRandom(): void {
  const base = rand(Names.nameBases.length - 1);
  ensureEl<HTMLInputElement>("burgName").value = Names.getBase(base);
  changeName();
}

function changeGroup(this: HTMLSelectElement): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];
  Burgs.changeGroup(burg, this.value);
  Layers.draw("burgIcons", "labels");
}

function changeType(this: HTMLSelectElement): void {
  const id = getSelectedId();
  pack.burgs[id].type = this.value as Burg["type"];
}

function changeCulture(this: HTMLSelectElement): void {
  const id = getSelectedId();
  pack.burgs[id].culture = +this.value;
}

function generateNameCulture(): void {
  const id = getSelectedId();
  const culture = pack.burgs[id].culture!;
  ensureEl<HTMLInputElement>("burgName").value = Names.getCulture(culture);
  changeName();
}

function changePopulation(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];

  pack.burgs[id].population = rn(
    ensureEl<HTMLInputElement>("burgPopulation").valueAsNumber / populationRate / urbanization,
    4
  );
  updateBurgPreview(burg);
}

function toggleFeature(this: HTMLElement): void {
  const burgId = getSelectedId();
  const burg = pack.burgs[burgId];

  const feature = this.dataset.feature!;
  const value = Number(this.classList.contains("inactive"));

  if (feature === "port") togglePort(burgId);
  else if (feature === "capital") toggleCapital(burgId);
  else (burg as any)[feature] = value;

  this.classList.toggle("inactive", !(burg as any)[feature]);

  ensureEl("burgEditAnchorStyle").style.display = burg.port ? "inline-block" : "none";
  updateBurgPreview(burg);
}

function togglePort(burgId: number): void {
  const burg = pack.burgs[burgId];
  if (burg.port) {
    burg.port = 0;

    const anchor = document.querySelector(`#anchors [data-id='${burgId}']`);
    if (anchor) anchor.remove();
  } else {
    const { cells, features } = pack;
    const haven = cells.haven[burg.cell];
    let portFeatureId: number | null;

    if (haven) {
      const featureId = cells.f[haven];
      const feature = features[featureId];
      portFeatureId =
        feature?.type === "lake" && feature.outlet
          ? (Rivers.resolveLakeDrainFeature(featureId) ?? featureId)
          : featureId;
    } else {
      portFeatureId = Rivers.resolveDrainFeature(burg.cell);
      if (!portFeatureId) {
        tip("No navigable water body found downstream, cannot assign port", false, "warn");
        return;
      }
    }

    burg.port = portFeatureId;

    select("#anchors")
      .select(`#${burg.group}`)
      .append("use")
      .attr("href", "#icon-anchor")
      .attr("id", `anchor${burg.i}`)
      .attr("data-id", burg.i)
      .attr("x", burg.x)
      .attr("y", burg.y);
  }
}

function toggleCapital(burgId: number): void {
  const { burgs, states } = pack;

  if (burgs[burgId].capital) {
    tip("To change capital please assign a capital status to another burg of this state", false, "error");
    return;
  }

  const stateId = burgs[burgId].state;
  if (!stateId) {
    tip("Neutral lands cannot have a capital", false, "error");
    return;
  }

  const oldCapitalId = states[stateId].capital;
  states[stateId].capital = burgId;
  states[stateId].center = burgs[burgId].cell;

  const capital = burgs[burgId];
  capital.capital = 1;
  Burgs.changeGroup(capital);

  const oldCapital = burgs[oldCapitalId];
  oldCapital.capital = 0;
  Burgs.changeGroup(oldCapital);
  Layers.draw("burgIcons", "labels");
}

function toggleBurgLockButton(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];
  burg.lock = !burg.lock;

  updateBurgLockIcon();
}

function updateBurgLockIcon(): void {
  const id = getSelectedId();
  const b = pack.burgs[id];
  if (b.lock) {
    ensureEl("burgLock").classList.remove("icon-lock-open");
    ensureEl("burgLock").classList.add("icon-lock");
  } else {
    ensureEl("burgLock").classList.remove("icon-lock");
    ensureEl("burgLock").classList.add("icon-lock-open");
  }
}

function showStyleSection(): void {
  document.querySelectorAll<HTMLElement>("#burgBottom > button").forEach(el => {
    el.style.display = "none";
  });
  ensureEl("burgStyleSection").style.display = "inline-block";
}

function hideStyleSection(): void {
  document.querySelectorAll<HTMLElement>("#burgBottom > button").forEach(el => {
    el.style.display = "inline-block";
  });
  ensureEl("burgStyleSection").style.display = "none";
}

function editGroupLabelStyle(): void {
  const g = (selected!.node() as Element).parentNode as HTMLElement;
  closeDialogs(".stable");
  editStyle("labels", g.id);
}

function editBurgLabel(): void {
  const id = getSelectedId();
  $("#burgEditor").dialog("close");
  Controllers.LabelsEditor.open("burg", id);
}

function editGroupIconStyle(): void {
  const g = (selected!.node() as Element).parentNode as HTMLElement;
  closeDialogs(".stable");
  editStyle("burgIcons", g.id);
}

function editGroupAnchorStyle(): void {
  const g = (selected!.node() as Element).parentNode as HTMLElement;
  closeDialogs(".stable");
  editStyle("anchors", g.id);
}

function getPreviewViewport(): { width: number; height: number } {
  const container = ensureEl("burgPreviewObject");
  return { width: container.clientWidth, height: container.clientHeight };
}

// mid-gesture the frame is scaled with a cheap transform; the layout size is committed
// only once the gesture settles, as generators re-render asynchronously on resize.
// canvas-backed generators (watabou) never commit at all: resizing clears their canvas
// to transparent until the next redraw, so their layout is locked at a supersampled
// size on load and zoom stays a pure transform of it
function applyPreviewTransform(): void {
  const container = ensureEl("burgPreviewObject");
  const frame = container.querySelector<HTMLIFrameElement>("iframe");
  if (!frame) return;
  const { k, x, y } = previewTransform;
  frame.style.transformOrigin = "0 0";
  frame.style.transform = `translate(${x}px, ${y}px) scale(${k / previewCommittedK})`;
  frame.style.left = "0";
  frame.style.top = "0";
  container.style.cursor = k > 1 ? "grab" : "default";
  clearTimeout(previewSettleTimer);
  if (!previewLayoutLocked) previewSettleTimer = window.setTimeout(commitPreviewTransform, 200);
}

function commitPreviewTransform(): void {
  if (previewLayoutLocked) return;
  const frame = ensureEl("burgPreviewObject").querySelector<HTMLIFrameElement>("iframe");
  if (!frame) return;
  const { k, x, y } = previewTransform;
  previewCommittedK = k;
  frame.style.width = `${k * 100}%`;
  frame.style.height = `${k * 100}%`;
  frame.style.transform = "none";
  frame.style.left = `${x}px`;
  frame.style.top = `${y}px`;
}

function resetPreviewZoom(): void {
  previewTransform = { ...PAN_ZOOM_IDENTITY };
  clearTimeout(previewSettleTimer);
  if (previewLayoutLocked) applyPreviewTransform();
  else commitPreviewTransform();
  ensureEl("burgPreviewObject").style.cursor = "default";
}

function previewPointFromEvent(event: MouseEvent): { x: number; y: number } {
  const rect = ensureEl("burgPreviewObject").getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function onPreviewWheel(event: WheelEvent): void {
  event.preventDefault();
  const factor = Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002));
  previewTransform = zoomAt(
    previewTransform,
    previewPointFromEvent(event),
    factor,
    getPreviewViewport(),
    previewMaxZoom
  );
  applyPreviewTransform();
}

function onPreviewDoubleClick(event: MouseEvent): void {
  previewTransform = zoomAt(previewTransform, previewPointFromEvent(event), 2, getPreviewViewport(), previewMaxZoom);
  applyPreviewTransform();
}

function onPreviewPointerDown(event: PointerEvent): void {
  if (previewTransform.k <= 1) return;
  event.preventDefault();
  const container = ensureEl("burgPreviewObject");
  container.setPointerCapture(event.pointerId);
  container.style.cursor = "grabbing";
  let last = { x: event.clientX, y: event.clientY };

  const move = (e: Event) => {
    const p = e as PointerEvent;
    previewTransform = panBy(previewTransform, p.clientX - last.x, p.clientY - last.y, getPreviewViewport());
    last = { x: p.clientX, y: p.clientY };
    applyPreviewTransform();
  };
  const up = () => {
    container.removeEventListener("pointermove", move);
    container.removeEventListener("pointerup", up);
    container.removeEventListener("pointercancel", up);
    container.style.cursor = "grab";
  };
  container.addEventListener("pointermove", move);
  container.addEventListener("pointerup", up);
  container.addEventListener("pointercancel", up);
}

let glMaxTextureSize = 0;
function getGlMaxTextureSize(): number {
  if (!glMaxTextureSize) {
    const gl = document.createElement("canvas").getContext("webgl");
    glMaxTextureSize = gl ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) : 4096;
  }
  return glMaxTextureSize;
}

// half the reported limit: the generator's internal render textures pad past the raw canvas size
function getPreviewTextureBudgetK(): number {
  const { width, height } = getPreviewViewport();
  const paneMax = Math.max(width, height, 1);
  return getGlMaxTextureSize() / 2 / (devicePixelRatio * paneMax);
}

function updateBurgPreview(burg: Burg): void {
  const preview = Burgs.getPreview(burg).preview;
  if (!preview) {
    ensureEl("burgPreviewSection").style.display = "none";
    return;
  }

  ensureEl("burgPreviewSection").style.display = "block";

  // recreate the element to force reload (Chrome bug)
  const container = ensureEl("burgPreviewObject");
  container.innerHTML = "";
  const frame = document.createElement("iframe");
  frame.style.position = "absolute";
  frame.style.border = "none";
  frame.style.pointerEvents = "none";
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
  frame.src = preview;
  container.insertBefore(frame, null);

  previewLayoutLocked = preview.includes("watabou.github.io");
  if (previewLayoutLocked) {
    const supersample = Math.max(1, Math.min(4, getPreviewTextureBudgetK()));
    previewCommittedK = supersample;
    frame.style.width = `${supersample * 100}%`;
    frame.style.height = `${supersample * 100}%`;
    previewMaxZoom = Math.min(MAX_ZOOM, supersample * 2.5);
  } else {
    previewCommittedK = 1;
    previewMaxZoom = MAX_ZOOM;
  }
  resetPreviewZoom();
}

function openBurgLink(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];
  const link = Burgs.getPreview(burg).link;
  if (link) openURL(link);
}

function setCustomPreview(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];

  prompt(
    "Provide custom URL to the burg map. It can be a link to a generator or just an image. Leave empty to use the default map preview",
    { default: Burgs.getPreview(burg).link || "", required: false },
    link => {
      if (link) burg.link = String(link);
      else delete burg.link;
      updateBurgPreview(burg);
    }
  );
}

function openEmblemEdit(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];
  void Controllers.EmblemsEditor.open("burg", `burgCOA${id}`, burg);
}

function zoomIntoBurg(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];
  zoomTo(burg.x, burg.y, 8, 2000);
}

let isCellsLayerForced = false; // the cells layer is turned on for the relocation mode

function toggleRelocateBurg(): void {
  ensureEl("burgRelocate").classList.toggle("pressed");
  if (ensureEl("burgRelocate").classList.contains("pressed")) {
    select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", relocateBurgOnClick);
    tip("Click on map to relocate burg. Hold Shift for continuous move", true);
    if (!Layers.isOn("cells")) {
      Layers.show("cells");
      isCellsLayerForced = true;
    }
  } else {
    clearMainTip();
    applyDefaultViewboxEvents();
    if (isCellsLayerForced) {
      Layers.hide("cells");
      isCellsLayerForced = false;
    }
  }
}

function relocateBurgOnClick(this: SVGGElement, event: any): void {
  const cells = pack.cells;
  const point = getPointer(event, this);
  const cellId = Pack.findCell(point[0], point[1])!;
  const id = getSelectedId();
  const burg = pack.burgs[id];

  if (cells.h[cellId] < 20) {
    tip("Cannot place burg into the water! Select a land cell", false, "error");
    return;
  }
  if (cells.burg[cellId] && cells.burg[cellId] !== id) {
    tip("There is already a burg in this cell. Please select a free cell", false, "error");
    return;
  }

  const newState = cells.state[cellId];
  const oldState = burg.state;
  if (newState !== oldState && burg.capital) {
    tip("Capital cannot be relocated into another state!", false, "error");
    return;
  }

  // change UI
  const x = rn(point[0], 2);
  const y = rn(point[1], 2);

  select("#burgIcons").select(`#burg${id}`).attr("x", x).attr("y", y);

  const anchor = select("#anchors").select(`use[data-id='${id}']`);
  if (anchor.size()) {
    const size = +anchor.attr("width");
    const xa = rn(x - size * 0.47, 2);
    const ya = rn(y - size * 0.47, 2);
    anchor.attr("transform", null).attr("x", xa).attr("y", ya);
  }

  // change data
  cells.burg[burg.cell] = 0;
  cells.burg[cellId] = id;
  burg.cell = cellId;
  burg.state = newState;
  burg.x = x;
  burg.y = y;
  if (burg.capital) pack.states[newState].center = burg.cell;

  // the label snaps back to the relocated burg, so its custom path is no longer valid
  if (burg.label) Object.assign(burg.label, { dx: 0, dy: 0, pathPoints: undefined });
  Layers.draw("labels");

  if (event.shiftKey === false) toggleRelocateBurg();
}

function editBurgLegend(): void {
  const id = selected!.attr("data-id");
  const name = selected!.text();
  void Controllers.NotesEditor.open(`burg${id}`, name);
}

function showTemperatureGraph(): void {
  const id = +selected!.attr("data-id");
  void Controllers.TemperatureGraph.open(id);
}

function showProductionOverview(): void {
  const id = getSelectedId();
  Controllers.ProductionOverview.open(id);
}

function removeSelectedBurg(): void {
  const burgId = getSelectedId();
  const burg = pack.burgs[burgId];

  if (burg.capital) {
    alertMessage.innerHTML = /* html */ `You cannot remove the capital. You must change the state capital first`;
    $("#alert").dialog({
      resizable: false,
      title: "Remove burg",
      buttons: {
        Ok: function (this: HTMLElement) {
          $(this).dialog("close");
        }
      }
    });
  } else if (pack.markets?.some(m => m.centerBurgId === burgId)) {
    alertMessage.innerHTML = /* html */ `You cannot remove a market center burg. Please remove the market first`;
    $("#alert").dialog({
      resizable: false,
      title: "Remove burg",
      buttons: {
        Ok: function (this: HTMLElement) {
          $(this).dialog("close");
        }
      }
    });
  } else {
    confirmationDialog({
      title: "Remove burg",
      message: "Are you sure you want to remove the burg? <br>This action cannot be reverted",
      confirm: "Remove",
      onConfirm: () => {
        Burgs.remove(burgId);
        removeEmblem("burg", burgId);
        Layers.draw("burgIcons", "labels");
        $("#burgEditor").dialog("close");
      }
    });
  }
}

function editBurgGroups(): void {
  Controllers.BurgGroupEditor.open();
}

function closeBurgEditor(): void {
  if (ensureEl("burgRelocate").classList.contains("pressed")) toggleRelocateBurg();
  selected = null;
  $("#burgEditor").dialog("destroy");
  ensureEl("burgEditor").remove();
}

function getProduction(pool: Record<number, number>): string {
  if (!pool) return "";
  let html = "";
  const sorted = Object.entries(pool).sort(([, a], [, b]) => b - a);
  for (const [resourceId, production] of sorted) {
    const resource = Goods.get(+resourceId);
    if (!resource) continue;
    const { name, unit, icon } = resource;
    const unitName = production === 1 ? unit : `${unit}s`;
    html += `<span data-tip="${name}: ${production} ${unitName} per day">
      <svg class="resIcon" width="1em" height="1em"><use href="#${icon}"></use></svg>
      <span style="margin: 0 0.2em 0 -0.2em">${production}</span>
    </span>`;
  }
  return html;
}

export const BurgEditor = { open };
