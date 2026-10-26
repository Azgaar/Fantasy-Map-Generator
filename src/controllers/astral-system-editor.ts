// The System Editor: a burg read as a star system, edited in the astral vocabulary. Every write goes
// through the Burgs model, so the world stays one world; the spectral class stays a readout derived
// from population. See docs/plans/astral-system-dialog.md
import { select } from "d3";
import {
  alertDialog,
  closeDialogs,
  confirmationDialog,
  destroyDialog,
  noteButton
} from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { peopleOf, starClass } from "@/generators/astral-naming";
import type { Market } from "@/generators/markets-generator";
import { type StarClassId, starShape, writeAttrs } from "@/renderers/astral/system-markers";
import { removeEmblem } from "@/renderers/draw-emblems";
import type { StylesData } from "@/types/styles";
import { ensureEl, escapeHtml, getPointer, rand, rn, speak } from "@/utils";
import { errorText } from "@/utils/stringUtils";

type ClassStyle = StylesData["systems"]["groups"][StarClassId];
type Feature = "capital" | "port" | "citadel" | "walls" | "plaza" | "temple" | "shanty";
const FEATURES: Feature[] = ["capital", "port", "citadel", "walls", "plaza", "temple", "shanty"];

let selectedId: number | null = null;
let isCellsLayerForced = false; // the cells layer is turned on for the relocation mode

function open(id: number | string): void {
  if (customization) return;
  const burg = pack.burgs[+id];
  if (!burg || burg.removed) return;
  closeDialogs(".stable");
  Layers.show("systems", "labels");

  selectedId = +id;
  renderDialog();
  ensureEl("astralSystemEditor").dataset.entity = `burg:${selectedId}`;
  updateSystemValues();

  $("#astralSystemEditor").dialog({
    title: "Edit System",
    resizable: false,
    close: closeSystemEditor,
    position: { my: "left top", at: "left+10 top+10", of: "svg", collision: "fit" }
  });
}

function renderDialog(): void {
  destroyDialog("astralSystemEditor");
  const editorHtml = /* html */ `<div id="astralSystemEditor" class="dialog">
      <div id="astralSystemBody" style="padding-bottom: 0.3em">
        <div style="display: flex; align-items: center">
          <svg
            id="systemStar"
            data-tip="The system's star, drawn as the chart draws it"
            viewBox="0 0 140 140"
            width="9em"
            height="9em"
          >
            <g id="systemStarShape" font-size="36" transform="translate(70 70)"></g>
          </svg>
          <div style="display: grid; grid-auto-rows: minmax(1.6em, auto)">
            <div id="systemSectorAndEmpire" style="font-weight: bold; max-width: 17em"></div>
            <div>
              <div class="label">Name:</div>
              <input id="systemName" data-tip="Type to rename the system" autocorrect="off" spellcheck="false" style="width: 9em" />
              <span id="systemNameSpeak" data-tip="Speak the name. You can change voice and language in options" class="speaker">🔊</span>
              <span id="systemNameReRandom" data-tip="Generate random name for the system" class="icon-globe pointer"></span>
              <span id="systemNameReCulture" data-tip="Generate people-specific name for the system" class="icon-book pointer"></span>
            </div>
            <div data-tip="The people that holds the system">
              <div class="label">People:</div>
              <select id="systemPeople" style="width: 9em"></select>
            </div>
            <div data-tip="Set system population. The star's class follows it">
              <div class="label">Population:</div>
              <input id="systemPopulation" type="number" min="0" step="1" style="width: 9em" />
            </div>
            <div data-tip="The star's class, from how many people live in the system">
              <div class="label">Class:</div>
              <span id="systemClass"></span>
            </div>
            <div data-tip="The installations that make the system what it is. Click one to toggle">
              <div class="label">Installations:</div>
              <span id="systemCapital" data-tip="Empire capital. Click to toggle" data-feature="capital" class="burgFeature icon-star"></span>
              <span id="systemPort" data-tip="Shipyard. Click to toggle" data-feature="port" class="burgFeature icon-anchor"></span>
              <span id="systemCitadel" data-tip="Bastion. Click to toggle" data-feature="citadel" class="burgFeature icon-chess-rook" style="font-size: 1.1em"></span>
              <span id="systemWalls" data-tip="Shielding. Click to toggle" data-feature="walls" class="burgFeature icon-fort-awesome"></span>
              <span id="systemPlaza" data-tip="Civic core. Click to toggle" data-feature="plaza" class="burgFeature icon-store"></span>
              <span id="systemTemple" data-tip="Shrine. Click to toggle" data-feature="temple" class="burgFeature icon-chess-bishop" style="font-size: 1.1em; margin-left: 3px"></span>
              <span id="systemShanty" data-tip="Drift. Click to toggle" data-feature="shanty" class="burgFeature icon-campground"></span>
            </div>
            <div data-tip="Gross product per population point, daily average">
              <div class="label">Wealth</div>
              <span id="systemWealth"></span>
            </div>
            <div data-tip="Set treasury balance">
              <div class="label"><label for="systemTreasury">Treasury:</label></div>
              <input id="systemTreasury" type="number" step="0.01" style="width: 9em" /> 🟡
            </div>
          </div>
        </div>
      </div>
      <div id="astralSystemBottom">
        <button id="systemStyleShow" data-tip="Show style edit section" class="icon-brush"></button>
        <div id="systemStyleSection" style="display: none">
          <button id="systemStyleHide" data-tip="Hide style edit section" class="icon-brush"></button>
          <button id="systemEditLabelStyle" data-tip="Edit label style for the system's group in Style Editor" class="icon-font"></button>
          <button id="systemEditClassStyle" data-tip="Edit the star style for this class in Style Editor" class="icon-star"></button>
        </div>
        <button id="systemEditLabel" data-tip="Edit this system label" class="icon-font"></button>
        <button id="systemEditEmblem" data-tip="Edit emblem" class="icon-shield-alt"></button>
        <button id="systemLocate" data-tip="Zoom map and center view in the system" class="icon-target"></button>
        <button id="systemProductionOverview" data-tip="Show production overview for this system" class="icon-chart-bar"></button>
        <button id="systemRelocate" data-tip="Relocate system. Click on map to move the system" class="icon-map-pin"></button>
        ${noteButton("systemLegend", "this system")}
        <button id="systemLock" class="icon-lock-open" onmouseover="showElementLockTip(event)"></button>
        <button id="systemRemove" data-tip="Remove non-capital system" data-shortcut="Delete" class="icon-trash fastDelete"></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);

  ensureEl("systemName").addEventListener("input", changeName);
  ensureEl("systemNameSpeak").addEventListener("click", () => speak(ensureEl<HTMLInputElement>("systemName").value));
  ensureEl("systemNameReRandom").addEventListener("click", generateNameRandom);
  ensureEl("systemNameReCulture").addEventListener("click", generateNameCulture);
  ensureEl("systemPeople").addEventListener("change", changePeople);
  ensureEl("systemPopulation").addEventListener("change", changePopulation);
  ensureEl("systemTreasury").addEventListener("change", changeTreasury);
  ensureEl("astralSystemBody")
    .querySelectorAll<HTMLElement>(".burgFeature")
    .forEach(el => void el.addEventListener("click", toggleFeature));
  ensureEl("systemStyleShow").addEventListener("click", showStyleSection);
  ensureEl("systemStyleHide").addEventListener("click", hideStyleSection);
  ensureEl("systemEditLabelStyle").addEventListener("click", editLabelStyle);
  ensureEl("systemEditClassStyle").addEventListener("click", editClassStyle);
  ensureEl("systemEditLabel").addEventListener("click", editLabel);
  ensureEl("systemEditEmblem").addEventListener("click", editEmblem);
  ensureEl("systemLocate").addEventListener("click", zoomIntoSystem);
  ensureEl("systemProductionOverview").addEventListener("click", showProductionOverview);
  ensureEl("systemRelocate").addEventListener("click", toggleRelocateSystem);
  ensureEl("systemLegend").addEventListener("click", editNotes);
  ensureEl("systemLock").addEventListener("click", toggleLock);
  ensureEl("systemRemove").addEventListener("click", removeSelectedSystem);
}

function getSelectedId(): number {
  return selectedId as number;
}

function featureId(feature: Feature): string {
  return `system${feature[0].toUpperCase()}${feature.slice(1)}`;
}

function updateSystemValues(): void {
  const burg = pack.burgs[getSelectedId()];

  const province = pack.cells.province[burg.cell];
  const provinceName = province ? `${pack.provinces[province].fullName}, ` : "";
  const state = pack.states[burg.state ?? 0];
  ensureEl("systemSectorAndEmpire").innerHTML =
    `${escapeHtml(provinceName)}${escapeHtml(state.fullName || state.name)}`;

  ensureEl<HTMLInputElement>("systemName").value = burg.name ?? "";

  const peopleSelect = ensureEl<HTMLSelectElement>("systemPeople");
  peopleSelect.options.length = 0;
  const cultures = pack.cultures.filter(c => !c.removed);
  cultures.forEach(c => void peopleSelect.options.add(new Option(c.name, String(c.i), false, c.i === burg.culture)));

  ensureEl<HTMLInputElement>("systemPopulation").value = String(peopleOf(burg));
  ensureEl<HTMLInputElement>("systemTreasury").value = String(rn(burg.treasury || 0, 2));
  ensureEl("systemWealth").innerHTML = `🟡 ${rn(burg.population! > 0 ? (burg.product || 0) / burg.population! : 0, 2)}`;

  for (const feature of FEATURES) {
    ensureEl(featureId(feature)).classList.toggle("inactive", !burg[feature]);
  }

  updateStar();
  updateLockIcon();
}

/** The star preview: the marker exactly as the systems layer draws it, from the same shape code */
function updateStar(): void {
  const burg = pack.burgs[getSelectedId()];
  const population = peopleOf(burg);
  const { class: cls, name: className } = starClass(population);
  ensureEl("systemClass").innerHTML = `${cls}-class ${escapeHtml(className)}`;
  ensureEl("systemStar").dataset.tip = `${cls}-class ${className}. The star, drawn as the chart draws it`;

  const style = styles.systems.groups[cls as StarClassId] as ClassStyle | undefined;
  const glow = Boolean(styles.systems.options.glow && style?.options.glow);
  const shape = starShape(population, !!burg.capital, !!burg.port, glow);
  const attrs = writeAttrs(style?.attrs);
  ensureEl("systemStarShape").outerHTML =
    `<g id="systemStarShape" font-size="36" transform="translate(70 70)"${attrs}>${shape}</g>`;
}

function changeName(): void {
  const value = ensureEl<HTMLInputElement>("systemName").value;
  if (!value.trim()) return;
  Burgs.rename(getSelectedId(), value);
  Layers.draw("labels");
}

function generateNameRandom(): void {
  const base = Names.nameBases[rand(Names.nameBases.length - 1)].id;
  ensureEl<HTMLInputElement>("systemName").value = Names.getBase(base);
  changeName();
}

function generateNameCulture(): void {
  const culture = pack.burgs[getSelectedId()].culture!;
  ensureEl<HTMLInputElement>("systemName").value = Names.getCulture(culture);
  changeName();
}

function changePeople(this: HTMLSelectElement): void {
  if (tryEdit(() => Burgs.setCulture(getSelectedId(), +this.value))) updateSystemValues();
}

function changePopulation(): void {
  const people = ensureEl<HTMLInputElement>("systemPopulation").valueAsNumber;
  if (Number.isFinite(people) && people >= 0) Burgs.setPopulation(getSelectedId(), people);
  updateSystemValues(); // the class readout, the star and the wealth follow the people
  Layers.draw("systems");
}

function changeTreasury(this: HTMLInputElement): void {
  try {
    Burgs.setTreasury(getSelectedId(), this.valueAsNumber);
  } catch {
    tip("Enter a valid treasury amount", false, "error");
  }
  this.value = String(rn(pack.burgs[getSelectedId()].treasury || 0, 2));
}

function toggleFeature(this: HTMLElement): void {
  const burgId = getSelectedId();
  const burg = pack.burgs[burgId];
  const feature = this.dataset.feature as Feature;
  const value = Number(this.classList.contains("inactive"));

  if (feature === "plaza" && !value) {
    const market = pack.markets?.find(m => m.centerBurgId === burgId);
    if (market) {
      confirmRemoveMarket(market);
      return;
    }
  }

  if (feature === "port") togglePort(burgId);
  else if (feature === "capital") toggleCapital(burgId);
  else Burgs.setBuilding(burgId, feature, Boolean(value));

  this.classList.toggle("inactive", !burg[feature]);
  updateStar(); // a port earns its tick, a capital its ring
  Layers.draw("systems");
  if (feature === "capital") Layers.draw("burgIcons", "labels");
  else if (feature === "port") Layers.draw("burgIcons");
}

function confirmRemoveMarket(market: Market): void {
  confirmationDialog({
    title: "Remove market",
    message: `This system is the center of the market "${escapeHtml(Markets.getName(market))}". Remove the market?<br>This action cannot be reverted`,
    confirm: "Remove",
    onConfirm: () => {
      Markets.removeMarket(market.i);
      Layers.draw("markets");
      updateSystemValues();
    }
  });
}

function togglePort(burgId: number): void {
  if (tryEdit(() => Burgs.setPort(burgId, !pack.burgs[burgId].port))) Layers.draw("burgIcons");
}

function toggleCapital(burgId: number): void {
  if (pack.burgs[burgId].capital) {
    tip("To change the capital, make another system of the empire the capital first", false, "error");
    return;
  }
  if (tryEdit(() => Burgs.setCapital(burgId))) Layers.draw("burgIcons", "labels");
}

/** Run a model edit, showing its validation error as a tip; returns whether it succeeded */
function tryEdit(edit: () => void): boolean {
  try {
    edit();
    return true;
  } catch (error) {
    tip(errorText(error), false, "error");
    return false;
  }
}

function toggleLock(): void {
  const id = getSelectedId();
  Burgs.setLocked(id, !pack.burgs[id].lock);
  updateLockIcon();
}

function updateLockIcon(): void {
  const locked = pack.burgs[getSelectedId()].lock;
  const lock = ensureEl("systemLock");
  lock.classList.toggle("icon-lock-open", !locked);
  lock.classList.toggle("icon-lock", !!locked);
}

function showStyleSection(): void {
  document.querySelectorAll<HTMLElement>("#astralSystemBottom > button").forEach(el => {
    el.style.display = "none";
  });
  ensureEl("systemStyleSection").style.display = "inline-block";
}

function hideStyleSection(): void {
  document.querySelectorAll<HTMLElement>("#astralSystemBottom > button").forEach(el => {
    el.style.display = "inline-block";
  });
  ensureEl("systemStyleSection").style.display = "none";
}

function editLabelStyle(): void {
  const burg = pack.burgs[getSelectedId()];
  closeDialogs(".stable");
  void Controllers.StyleEditor.open("labels", burg.label?.group || burg.group);
}

function editClassStyle(): void {
  const burg = pack.burgs[getSelectedId()];
  closeDialogs(".stable");
  void Controllers.StyleEditor.open("systems", starClass(peopleOf(burg)).class);
}

function editLabel(): void {
  const id = getSelectedId();
  $("#astralSystemEditor").dialog("close");
  Controllers.LabelsEditor.open("burg", id);
}

function editEmblem(): void {
  const id = getSelectedId();
  void Controllers.EmblemsEditor.open("burg", `burgCOA${id}`, pack.burgs[id]);
}

function zoomIntoSystem(): void {
  const burg = pack.burgs[getSelectedId()];
  zoomTo(burg.x, burg.y, 8, 2000);
}

function toggleRelocateSystem(): void {
  ensureEl("systemRelocate").classList.toggle("pressed");
  if (ensureEl("systemRelocate").classList.contains("pressed")) {
    select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", relocateOnClick);
    tip("Click on map to relocate the system. Hold Shift for continuous move", true);
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

function relocateOnClick(this: SVGGElement, event: MouseEvent): void {
  const [x, y] = getPointer(event, this);
  if (!tryEdit(() => Burgs.move(getSelectedId(), x, y))) return;
  Layers.draw("systems", "labels", "burgIcons");
  if (event.shiftKey === false) toggleRelocateSystem();
}

function editNotes(): void {
  void Controllers.NotesEditor.open({ type: "burg", id: getSelectedId() });
}

function showProductionOverview(): void {
  Controllers.ProductionOverview.open(getSelectedId());
}

function removeSelectedSystem(): void {
  const burgId = getSelectedId();
  const burg = pack.burgs[burgId];

  if (burg.capital) {
    alertDialog({
      title: "Remove system",
      message: "You cannot remove the capital. You must change the empire capital first"
    });
  } else if (pack.markets?.some(m => m.centerBurgId === burgId)) {
    alertDialog({
      title: "Remove system",
      message: "You cannot remove a market center system. Please remove the market first"
    });
  } else {
    confirmationDialog({
      title: "Remove system",
      message: "Are you sure you want to remove the system? <br>This action cannot be reverted",
      confirm: "Remove",
      onConfirm: () => {
        Burgs.remove(burgId);
        removeEmblem("burg", burgId);
        Layers.draw("burgIcons", "labels", "systems");
        $("#astralSystemEditor").dialog("close");
      }
    });
  }
}

function closeSystemEditor(): void {
  if (ensureEl("systemRelocate").classList.contains("pressed")) toggleRelocateSystem();
  selectedId = null;
  $("#astralSystemEditor").dialog("destroy");
  ensureEl("astralSystemEditor").remove();
}

export const AstralSystemEditor = { open };
