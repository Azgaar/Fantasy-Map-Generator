import { type D3DragEvent, drag, select } from "d3";
import { destroyDialog } from "@/components/dialog/dialog-helpers";
import { IconSets } from "@/components/icon-sets";
import { CustomIcons, Icons, IMAGE_FRAME } from "@/components/icons";
import { clearMainTip, tip } from "@/components/tooltips";
import { tinctures } from "@/data/emblems";
import type { Burg } from "@/generators/burgs-generator";
import { Emblems } from "@/generators/emblems-generator";
import type { Province } from "@/generators/provinces-generator";
import type { State } from "@/generators/states-generator";
import { type EmblemType, redrawEmblem, subscribeToEmblemReconciliation } from "@/renderers/draw-emblems";
import { colors } from "@/renderers/emblems/colors";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { highlightEmblemElement } from "@/renderers/overlays/highlight";
import { inlineLinkedImages } from "@/services/io/export";
import type { Emblem, EmblemCharge, HeraldicEmblem } from "@/types/emblems";
import { capitalize, downloadFile, escapeHtml, getFileName, openURL } from "@/utils";
import { ensureEl, rn } from "../utils";
import { ARMORIA_API, ARMORIA_GUI, armoriaRenderUrl, parseArmoria } from "./emblems/armoria";
import { ArmoriaSessions } from "./emblems/armoria-sessions";
import { isDrawable } from "./emblems/drawability";
import { IconPicker } from "./icon-picker";
import { IconPictures } from "./icon-picker/pictures";

type EmblemEntity = State | Province | Burg;

const SIZE_TIP = "Size of this emblem, 0 hides it. Change a whole category in Menu ⭢ Style ⭢ Emblems";

const STYLE = /* css */ `
  #emblemEditor { padding: .5em .7em .6em; }
  #emblemEditor > div { width: auto; }
  #emblemEditor .preview { width: 12em; height: 12em; margin: 0 auto .2em; }
  #emblemEditor .preview svg { width: 100%; height: 100%; overflow: visible; }
  #emblemArmiger { display: block; margin-bottom: .5em; text-align: center; }
  #emblemEditor .fields { display: grid; grid-template-columns: 6.4em minmax(0, 1fr); align-items: center; gap: .3em .4em; }
  #emblemEditor .fields .row { display: contents; }
  #emblemEditor .fields .row.hidden { display: none; }
  #emblemEditor .tincture { display: flex; align-items: center; gap: .35em; }
  #emblemEditor .tincture select { flex: 1; min-width: 0; }
  #emblemEditor .swatch { flex: none; width: 1.1em; height: 1.1em; border: 1px solid #0006; border-radius: 2px; }
  #emblemEditor .fields label { white-space: nowrap; padding: .15em .35em; border-radius: 3px; transition: background-color .3s ease-out; }
  #emblemEditor .fields label.active { background-color: #54ca7733; font-weight: bold; }
  #emblemEditor .fields select { width: 100%; min-width: 0; margin: 0; }
  #emblemEditor .fields hr { grid-column: 1 / -1; width: 100%; margin: .2em 0; border: 0; border-top: 1px solid #0000001f; }
  #emblemEditor .size { display: flex; align-items: center; gap: .4em; }
  #emblemEditor .size input[type="range"] { flex: 1; min-width: 0; margin: 0; }
  #emblemEditor .size input[type="number"] { width: 3.8em; margin: 0; }
  #emblemEditor .armoria { margin-top: .6em; }
  #emblemEditor .armoria button { width: 100%; margin: 0; padding: .4em; font-weight: bold; }
  #emblemEditor .armoria p { margin: .3em 0 0; font-size: .85em; opacity: .75; text-align: center; }
  #emblemEditor .toolbar { display: grid; grid-template-columns: repeat(7, 1fr); gap: .25em; margin-top: .7em; }
  #emblemEditor .control { display: flex; align-items: center; gap: .3em; margin-top: .4em; }
  #emblemEditor .control.hidden { display: none; }
  #emblemEditor .control input[type="text"] { flex: 1; min-width: 0; margin: 0; }
  #emblemEditor .control input[type="number"] { width: 4.6em; margin: 0; }
  #emblemEditor .control button { margin: 0; }
  #emblemEditor #emblemDownloadControl button { flex: 1; }
`;

interface EmblemEl {
  i: number;
  coa: Emblem;
  cell?: number;
  culture?: number;
  fullName?: string;
  name?: string;
  state?: number;
}

let currentType: EmblemType;
let currentId: string;
let currentEl: EmblemEl;
let unsubscribeFromReconciliation: (() => void) | undefined;
/** an emblem open in Armoria: its updates apply in order, and a blazon FMG cannot draw keeps one picture */
interface ArmoriaTarget {
  type: EmblemType;
  id: number;
  entity: EmblemEl;
  picture?: string;
  queue: Promise<void>;
}
const armoriaSessions = new ArmoriaSessions<ArmoriaTarget>();
const armoriaGui =
  import.meta.env.DEV && import.meta.env.VITE_ARMORIA_GUI ? import.meta.env.VITE_ARMORIA_GUI : ARMORIA_GUI;

async function openDefault(): Promise<void> {
  const firstState = pack.states.find(state => state.i && !state.removed && state.coa);
  const firstBurg = pack.burgs.find(burg => burg.i && !burg.removed && burg.coa);
  const type = firstState ? "state" : "burg";
  const element = firstState ?? firstBurg;
  if (!element?.coa) {
    tip("No emblems to edit, please generate states and burgs first", false, "error");
    return;
  }

  const id = `${type}COA${element.i}`;
  await EmblemRenderer.trigger(id, element.coa);
  open(type, id, element);
}

function open(type?: EmblemType, id?: string, el?: EmblemEntity, target?: SVGElement): void {
  if (customization) return;
  if (!id && target) defineEmblemData(target);
  else {
    if (!type || !id || !el?.coa) return;
    currentType = type;
    currentId = id;
    currentEl = el as EmblemEl;
  }

  renderDialog();

  makeEmblemsDraggable();
  unsubscribeFromReconciliation?.();
  unsubscribeFromReconciliation = subscribeToEmblemReconciliation(makeEmblemsDraggable);

  updateElementSelectors();

  $("#emblemEditor").dialog({
    title: "Edit Emblem",
    resizable: true,
    width: "22em",
    height: "auto",
    position: { my: "left top", at: "left+10 top+10", of: "svg", collision: "fit" },
    close: closeEmblemEditor
  });
}

function renderDialog(): void {
  destroyDialog("emblemEditor");
  const editorHtml = /* html */ `<div id="emblemEditor" class="dialog stable">
      <style>${STYLE}</style>
      <div class="preview"><svg viewBox="0 0 200 200"><use id="emblemImage"></use></svg></div>
      <b id="emblemArmiger"></b>
      <div class="fields">
        <label for="emblemStates" data-tip="Select state">State</label>
        <select id="emblemStates" data-tip="Select state"></select>
        <label for="emblemProvinces" data-tip="Select province in state">Province</label>
        <select id="emblemProvinces" data-tip="Select province in state"></select>
        <label for="emblemBurgs" data-tip="Select burg in province or state">Burg</label>
        <select id="emblemBurgs" data-tip="Select burg in province or state"></select>
        <hr />
        <div id="emblemShapeRow" class="row">
        <label for="emblemShapeSelector" data-tip="Select shape of the emblem">Shape</label>
          <select id="emblemShapeSelector" data-tip="Select shape of the emblem">
            <option value="">None</option>
            <optgroup label="Basic">
              <option value="heater">Heater</option>
              <option value="spanish">Spanish</option>
              <option value="french">French</option>
            </optgroup>
            <optgroup label="Regional">
              <option value="horsehead">Horsehead</option>
              <option value="horsehead2">Horsehead Edgy</option>
              <option value="polish">Polish</option>
              <option value="hessen">Hessen</option>
              <option value="swiss">Swiss</option>
            </optgroup>
            <optgroup label="Historical">
              <option value="boeotian">Boeotian</option>
              <option value="roman">Roman</option>
              <option value="kite">Kite</option>
              <option value="oldFrench">Old French</option>
              <option value="renaissance">Renaissance</option>
              <option value="baroque">Baroque</option>
            </optgroup>
            <optgroup label="Specific">
              <option value="targe">Targe</option>
              <option value="targe2">Targe2</option>
              <option value="pavise">Pavise</option>
              <option value="wedged">Wedged</option>
              <option value="embowed">Embowed</option>
            </optgroup>
            <optgroup label="Banner">
              <option value="flag">Flag</option>
              <option value="pennon">Pennon</option>
              <option value="guidon">Guidon</option>
              <option value="banner">Banner</option>
              <option value="dovetail">Dovetail</option>
              <option value="gonfalon">Gonfalon</option>
              <option value="pennant">Pennant</option>
            </optgroup>
            <optgroup label="Simple">
              <option value="round">Round</option>
              <option value="oval">Oval</option>
              <option value="vesicaPiscis">Vesica Piscis</option>
              <option value="square">Square</option>
              <option value="diamond">Diamond</option>
              <option value="hexagon">Hexagon</option>
            </optgroup>
            <optgroup label="Fantasy">
              <option value="fantasy1">Fantasy1</option>
              <option value="fantasy2">Fantasy2</option>
              <option value="fantasy3">Fantasy3</option>
              <option value="fantasy4">Fantasy4</option>
              <option value="fantasy5">Fantasy5</option>
            </optgroup>
            <optgroup label="Middle Earth">
              <option value="noldor">Noldor</option>
              <option value="gondor">Gondor</option>
              <option value="easterling">Easterling</option>
              <option value="erebor">Erebor</option>
              <option value="ironHills">Iron Hills</option>
              <option value="urukHai">UrukHai</option>
              <option value="moriaOrc">Moria Orc</option>
            </optgroup>
          </select>
        </div>
        <div id="emblemFieldRow" class="row">
          <label for="emblemField" data-tip="Tincture of the field">Field</label>
          <div class="tincture"><span class="swatch"></span><select id="emblemField"></select></div>
        </div>
        <div id="emblemChargeRows" class="row">
          <label for="emblemChargeTincture" data-tip="Tincture of the main charge. A raster picture keeps its own colours">Charge</label>
          <div class="tincture"><span class="swatch"></span><select id="emblemChargeTincture"></select></div>
          <label for="emblemChargeSizeNumber" data-tip="Size of the main charge">Charge size</label>
          <div class="size" data-tip="Size of the main charge">
            <input id="emblemChargeSizeSlider" type="range" min=".2" max="3" step=".05" />
            <input id="emblemChargeSizeNumber" type="number" min=".2" max="3" step=".05" />
          </div>
        </div>
        <label for="emblemSizeNumber" data-tip="${SIZE_TIP}">Map size</label>
        <div class="size" data-tip="${SIZE_TIP}">
          <input id="emblemSizeSlider" type="range" min="0" max="5" step=".1" />
          <input id="emblemSizeNumber" type="number" min="0" max="5" step=".1" />
        </div>
      </div>
      <div class="armoria">
        <button id="emblemsArmoria" type="button" data-tip="Open the emblem in Armoria, the heraldry editor: your changes show on the map as you make them"><span class="icon-font"></span> Edit in Armoria</button>
      </div>
      <div class="toolbar">
        <button id="emblemsPaste" data-tip="Edit the COA string by hand, or paste an Armoria edit link, API link or COA string" class="icon-link"></button>
        <button id="emblemsCharge" data-tip="Set the charge: choose, link or upload a picture to place on the field" class="icon-chess-knight"></button>
        <button id="emblemsUpload" data-tip="Replace the whole emblem with a picture: choose, link or upload an image, such as a ready coat of arms" class="icon-shield-alt"></button>
        <button id="emblemsDownload" data-tip="Download the emblem as an image" class="icon-download"></button>
        <button id="emblemsGallery" data-tip="Download all emblems as an HTML gallery (open it in a browser; preparing takes a while)" class="icon-layer-group"></button>
        <button id="emblemsRegenerate" data-tip="Regenerate the emblem" class="icon-shuffle"></button>
        <button id="emblemsFocus" data-tip="Show the area or place of the emblem" class="icon-target"></button>
      </div>
      <div id="emblemPasteControl" class="control hidden">
        <input id="emblemPaste" type="text" placeholder="Armoria link or COA string" data-tip="The emblem's COA string: edit it, or replace it with an Armoria link or COA string, then Apply" />
        <button id="emblemPasteApply" type="button" data-tip="Apply the pasted emblem">Apply</button>
      </div>
      <div id="emblemDownloadControl" class="control hidden">
        <input id="emblemsDownloadSize" data-tip="Image size in pixels" type="number" value="500" step="100" min="100" max="10000" />
        <span>px</span>
        <button id="emblemsDownloadSVG" data-tip="Scalable vector image: best quality, opens in a browser or Inkscape">SVG</button>
        <button id="emblemsDownloadPNG" data-tip="Lossless raster image with a transparent background">PNG</button>
        <button id="emblemsDownloadJPG" data-tip="Compressed raster image on a white background">JPG</button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);

  ensureEl<HTMLSelectElement>("emblemStates").oninput = selectState;
  ensureEl<HTMLSelectElement>("emblemProvinces").oninput = selectProvince;
  ensureEl<HTMLSelectElement>("emblemBurgs").oninput = selectBurg;
  ensureEl<HTMLSelectElement>("emblemShapeSelector").oninput = changeShape;
  ensureEl<HTMLSelectElement>("emblemField").oninput = changeField;
  ensureEl<HTMLSelectElement>("emblemChargeTincture").oninput = changeChargeTincture;
  ensureEl("emblemChargeSizeSlider").oninput = changeChargeSize;
  ensureEl("emblemChargeSizeNumber").oninput = changeChargeSize;
  ensureEl("emblemSizeSlider").oninput = changeSize;
  ensureEl("emblemSizeNumber").oninput = changeSize;
  ensureEl("emblemsRegenerate").onclick = regenerate;
  ensureEl("emblemsArmoria").onclick = openInArmoria;
  ensureEl("emblemsCharge").onclick = () => pickPicture("charge");
  ensureEl("emblemsUpload").onclick = () => pickPicture("whole");
  ensureEl("emblemsPaste").onclick = () => toggleControl("emblemPasteControl");
  ensureEl("emblemPasteApply").onclick = () => void pasteEmblem();
  ensureEl<HTMLInputElement>("emblemPaste").onkeydown = event => {
    if (event.key === "Enter") void pasteEmblem();
  };
  ensureEl("emblemsDownload").onclick = () => toggleControl("emblemDownloadControl");
  ensureEl("emblemsDownloadSVG").onclick = () => download("svg");
  ensureEl("emblemsDownloadPNG").onclick = () => download("png");
  ensureEl("emblemsDownloadJPG").onclick = () => download("jpeg");
  ensureEl("emblemsGallery").onclick = downloadGallery;
  ensureEl("emblemsFocus").onclick = showArea;
}

function defineEmblemData(target: SVGElement): void {
  const parent = target.parentNode as SVGElement;
  const type: EmblemType =
    parent.id === "burgEmblems" ? "burg" : parent.id === "provinceEmblems" ? "province" : "state";
  const i = +target.dataset.i!;
  const entity = getEmblemEntity(type, i);
  if (!entity) throw new Error(`Cannot edit ${type} emblem ${i}`);
  currentType = type;
  currentId = `${currentType}COA${i}`;
  currentEl = entity;
}

function updateElementSelectors(): void {
  const type = currentType;
  const el = currentEl;
  const emblemStates = ensureEl<HTMLSelectElement>("emblemStates");
  const emblemProvinces = ensureEl<HTMLSelectElement>("emblemProvinces");
  const emblemBurgs = ensureEl<HTMLSelectElement>("emblemBurgs");

  let state = 0;
  let province = 0;
  let burg = 0;

  // mark the row of the emblem being edited
  for (const [select, rowType] of [
    [emblemStates, "state"],
    [emblemProvinces, "province"],
    [emblemBurgs, "burg"]
  ] as const) {
    select.previousElementSibling?.classList.toggle("active", type === rowType);
  }

  // define selected values
  if (type === "state") state = el.i;
  else if (type === "province") {
    province = el.i;
    state = pack.states[el.state!].i;
  } else {
    burg = el.i;
    province = pack.cells.province[el.cell!] ? pack.provinces[pack.cells.province[el.cell!]].i : 0;
    state = el.state ?? 0;
  }

  const validBurgs = pack.burgs.filter(b => b.i && !b.removed && b.coa);

  // update option list and select actual values
  emblemStates.options.length = 0;
  const neutralBurgs = validBurgs.filter(b => !b.state);
  if (neutralBurgs.length) emblemStates.options.add(new Option(pack.states[0].name, "0", false, !state));
  const stateList = pack.states.filter(s => s.i && !s.removed);
  stateList.forEach(s => {
    emblemStates.options.add(new Option(s.name, String(s.i), false, s.i === state));
  });

  emblemProvinces.options.length = 0;
  emblemProvinces.options.add(new Option("", "0", false, !province));
  const provinceList = pack.provinces.filter(p => !p.removed && p.state === state);
  provinceList.forEach(p => {
    emblemProvinces.options.add(new Option(p.name, String(p.i), false, p.i === province));
  });

  emblemBurgs.options.length = 0;
  emblemBurgs.options.add(new Option("", "0", false, !burg));
  const burgList = validBurgs.filter(b => (province ? pack.cells.province[b.cell] === province : b.state === state));
  burgList.forEach(b => {
    emblemBurgs.options.add(new Option(b.capital ? `👑 ${b.name}` : b.name, String(b.i), false, b.i === burg));
  });
  emblemBurgs.options[0].disabled = true;

  EmblemRenderer.trigger(currentId, el.coa);
  updateEmblemData();
}

function updateEmblemData(): void {
  const el = currentEl;
  if (!el.coa) return;
  ensureEl("emblemImage").setAttribute("href", `#${currentId}`);
  let name = el.fullName || el.name;
  if (currentType === "burg") name = `Burg of ${name}`;
  ensureEl("emblemArmiger").innerText = name ?? "";

  const emblemShapeSelector = ensureEl<HTMLSelectElement>("emblemShapeSelector");
  emblemShapeSelector.value = el.coa.shield ?? ("icon" in el.coa ? "" : "heater");

  // a coat of arms is edited in Armoria; only an emblem made from a library picture is coloured here
  const coa = el.coa;
  const main = mainCharge();
  const custom = !!main && !Emblems.chargeIcon(main.charge) && !!Icons.kind(main.charge);
  ensureEl("emblemShapeRow").classList.toggle("hidden", !custom && !("icon" in coa)); // Armoria shapes its coats of arms
  ensureEl("emblemFieldRow").classList.toggle("hidden", !custom);
  ensureEl("emblemChargeRows").classList.toggle("hidden", !custom);
  if (custom && !("icon" in coa)) showTincture("emblemField", coa.t1);
  if (custom && main) {
    showTincture("emblemChargeTincture", main.t);
    ensureEl<HTMLInputElement>("emblemChargeSizeSlider").value = String(main.size ?? 1);
    ensureEl<HTMLInputElement>("emblemChargeSizeNumber").value = String(main.size ?? 1);
  }

  // the COA string to edit by hand, kept current unless it is being edited
  const paste = ensureEl<HTMLInputElement>("emblemPaste");
  if (document.activeElement !== paste) {
    const blazon = armoriaCoa(coa);
    paste.value = blazon ? JSON.stringify(blazon) : "";
  }

  const size = el.coa.size ?? 1;
  ensureEl<HTMLInputElement>("emblemSizeSlider").value = String(size);
  ensureEl<HTMLInputElement>("emblemSizeNumber").value = String(size);
}

function selectState(): void {
  const state = +ensureEl<HTMLSelectElement>("emblemStates").value;
  if (state) {
    if (!setCurrentEmblem("state", state)) return;
  } else {
    // select neutral burg if state is changed to Neutrals
    const neutralBurgs = pack.burgs.filter(b => b.i && !b.removed && !b.state);
    if (!neutralBurgs.length) return;
    if (!setCurrentEmblem("burg", neutralBurgs[0].i)) return;
  }
  updateElementSelectors();
}

function selectProvince(): void {
  const province = +ensureEl<HTMLSelectElement>("emblemProvinces").value;

  if (province) {
    if (!setCurrentEmblem("province", province)) return;
  } else {
    // select state if province is changed to null value
    const state = +ensureEl<HTMLSelectElement>("emblemStates").value;
    if (!setCurrentEmblem("state", state)) return;
  }

  updateElementSelectors();
}

function selectBurg(): void {
  const burg = +ensureEl<HTMLSelectElement>("emblemBurgs").value;
  if (!setCurrentEmblem("burg", burg)) return;
  updateElementSelectors();
}

/** a shape puts a picture on a field as its charge; "None" shows the main charge alone as the whole emblem */
function changeShape(): void {
  const select = ensureEl<HTMLSelectElement>("emblemShapeSelector");
  const shield = select.value;
  const coa = currentEl.coa;
  if (shield) {
    if ("icon" in coa) currentEl.coa = pictureAsCharge(coa.icon, shield, coa);
    else coa.shield = shield;
  } else if (!("icon" in coa)) {
    const icon = coa.charges?.[0] && Emblems.chargeArt(coa.charges[0].charge);
    if (!icon) {
      select.value = coa.shield ?? "heater";
      tip("Only an emblem with a charge can show it without a shield", false, "warn");
      return;
    }
    currentEl.coa = { icon, size: coa.size, x: coa.x, y: coa.y };
  }
  document.getElementById(currentId)?.remove();
  void EmblemRenderer.trigger(currentId, currentEl.coa);
  redrawEmblem(currentType, currentEl.i);
  updateEmblemData();
}

/** a picture as the charge of a plain field, coloured so it stands out */
function pictureAsCharge(icon: string, shield: string, { size, x, y }: Emblem): HeraldicEmblem {
  return {
    t1: "argent",
    shield,
    charges: [{ charge: Emblems.chargeOf(icon), t: "gules", p: "e", size: 1.5 }],
    size,
    x,
    y
  };
}

/** the charge the editor's tincture and size controls change: the first one */
function mainCharge(): EmblemCharge | undefined {
  const coa = currentEl.coa;
  return "icon" in coa ? undefined : coa.charges?.[0];
}

function changeField(): void {
  const coa = currentEl.coa;
  if ("icon" in coa) return;
  coa.t1 = ensureEl<HTMLSelectElement>("emblemField").value;
  rerenderEmblem();
}

function changeChargeTincture(): void {
  const main = mainCharge();
  if (!main) return;
  main.t = ensureEl<HTMLSelectElement>("emblemChargeTincture").value;
  rerenderEmblem();
}

function changeChargeSize(event: Event): void {
  const main = mainCharge();
  const size = +(event.currentTarget as HTMLInputElement).value;
  if (!main || !(size > 0)) return;
  main.size = size;
  rerenderEmblem();
}

function rerenderEmblem(): void {
  void EmblemRenderer.trigger(currentId, currentEl.coa);
  updateEmblemData();
}

const TINCTURE_GROUPS = [
  ["Metals", tinctures.metals],
  ["Colours", tinctures.colours],
  ["Stains", tinctures.stains]
] as const;

/** the tincture list with the current value selected, keeping a pattern or colour it does not list */
function showTincture(id: string, current: string): void {
  const select = ensureEl<HTMLSelectElement>(id);
  const listed = TINCTURE_GROUPS.some(([, list]) => current in list);
  const own = listed ? "" : `<option value="${escapeHtml(current)}">${escapeHtml(tinctureName(current))}</option>`;
  const groups = TINCTURE_GROUPS.map(
    ([label, list]) =>
      `<optgroup label="${label}">${Object.keys(list)
        .map(tincture => `<option value="${tincture}">${capitalize(tincture)}</option>`)
        .join("")}</optgroup>`
  );
  select.innerHTML = own + groups.join("");
  select.value = current;
  (select.previousElementSibling as HTMLElement).style.background = tinctureSwatch(current);
}

/** `vair-argent-azure` → "Vair: argent and azure" */
function tinctureName(tincture: string): string {
  const [pattern, first, second] = tincture.split("-");
  if (!second) return tincture;
  return `${capitalize(
    pattern
      .replace("semy_of_", "semy of ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase()
  )}: ${first} and ${second}`;
}

function tinctureSwatch(tincture: string): string {
  const [, first, second] = tincture.split("-");
  if (second)
    return `repeating-linear-gradient(45deg, ${colors[first] ?? first} 0 3px, ${colors[second] ?? second} 3px 6px)`;
  return colors[tincture] ?? tincture;
}

function showArea(): void {
  highlightEmblemElement(currentType, currentEl);
}

function changeSize(ev: Event): void {
  const size = +(ev.currentTarget as HTMLInputElement).value;

  ensureEl<HTMLInputElement>("emblemSizeSlider").value = String(size);
  ensureEl<HTMLInputElement>("emblemSizeNumber").value = String(size);

  currentEl.coa.size = size;
  redrawEmblem(currentType, currentEl.i);
}

function regenerate(): void {
  const el = currentEl;
  let parent: EmblemEl | undefined;
  if (currentType === "province") parent = pack.states[el.state!];
  else if (currentType === "burg") {
    const province = pack.cells.province[el.cell!];
    parent = province ? pack.provinces[province] : pack.states[el.state!];
  }

  const shield = el.coa.shield || Emblems.getShield(el.culture || parent?.culture || 0, el.state);
  const { size, x, y } = el.coa;
  el.coa = { ...Emblems.generate(parent ? parent.coa : null, 0.3, 0.1, undefined), shield, size, x, y };

  EmblemRenderer.trigger(currentId, el.coa);
  redrawEmblem(currentType, currentEl.i);
  updateEmblemData();
}

/** the emblem as an Armoria COA: its blazon without the map placement, a linked Armoria picture's blazon, else none */
function armoriaCoa(emblem: Emblem): HeraldicEmblem | null {
  if ("icon" in emblem) {
    const linked = CustomIcons.get(emblem.icon);
    if (linked?.kind !== "image" || !linked.content.startsWith(ARMORIA_API)) return null;
    try {
      return parseArmoria(linked.content);
    } catch {
      return null;
    }
  }
  const { size: _size, x: _x, y: _y, ...blazon } = emblem;
  return blazon;
}

function openInArmoria(): void {
  const coa = armoriaCoa(currentEl.coa) ?? { t1: "sable" };
  if (coa.charges?.some(({ charge }) => !Emblems.chargeIcon(charge) && Icons.kind(charge)))
    tip("Armoria cannot show pictures from the icon library: those charges are missing there", false, "warn", 6000);
  const session = armoriaSessions.start(
    { type: currentType, id: currentEl.i, entity: currentEl, queue: Promise.resolve() },
    `${currentType}:${currentEl.i}`,
    options.map,
    new URL(armoriaGui).origin
  );
  const url = new URL(armoriaGui);
  url.searchParams.set("coa", JSON.stringify(coa));
  url.searchParams.set("from", "FMG");
  url.searchParams.set("session", session);
  url.searchParams.set("returnOrigin", location.origin);
  openURL(url.href);
}

async function pasteEmblem(): Promise<void> {
  try {
    await applyInput(currentType, currentEl.i, parseArmoria(ensureEl<HTMLInputElement>("emblemPaste").value));
    toggleControl("emblemPasteControl");
  } catch (error) {
    tip((error as Error).message, false, "error", 6000);
  }
}

/** A drawable COA becomes the blazon. Any other shows as Armoria's picture: its render linked, or the SVG Armoria
 * sent, stored in `picture` when given so repeated updates replace one icon. Returns the picture it shows, if any */
async function applyInput(
  type: EmblemType,
  id: number,
  coa: HeraldicEmblem,
  svg?: string,
  picture?: string
): Promise<string | undefined> {
  const entity = getEmblemEntity(type, id);
  if (!entity) return picture;
  const map = options.map;
  const { size, x, y } = entity.coa;
  let shown: string | undefined;
  if (isDrawable(coa)) {
    entity.coa = { ...coa, size, x, y };
    // the picture an earlier update needed goes once nothing shows it
    if (picture && CustomIcons.get(picture) && !Object.keys(Icons.uses(picture)).length) CustomIcons.remove(picture);
  } else {
    const reused = picture && CustomIcons.get(picture) ? picture : undefined;
    const iconId = reused ?? CustomIcons.newId();
    const art = svg
      ? await IconPictures.fromFile(new File([svg], "armoria.svg", { type: "image/svg+xml" }), iconId, "emblem")
      : { kind: "image" as const, content: armoriaRenderUrl(coa), viewBox: IMAGE_FRAME };
    if (options.map !== map || getEmblemEntity(type, entity.i) !== entity) return picture;
    if (reused) CustomIcons.update(reused, art);
    else CustomIcons.add({ id: iconId, ...art });
    entity.coa = { icon: iconId, size, x, y };
    shown = iconId;
    if (!reused) tip("This COA uses art FMG cannot draw; it shows as Armoria's picture", false, "warn", 5000);
  }
  if (currentType === type && currentEl.i === id) {
    void EmblemRenderer.trigger(currentId, entity.coa);
    updateEmblemData();
  }
  redrawEmblem(type, id);
  return shown;
}

// an Armoria tab opened from the editor sends the blazon after every edit
window.addEventListener("message", event => {
  const update = armoriaSessions.receive(event, options.map);
  if (!update) return;
  const target = update.target;
  target.queue = target.queue
    .then(async () => {
      if (getEmblemEntity(target.type, target.id) !== target.entity) return;
      target.picture = await applyInput(target.type, target.id, update.coa, update.svg, target.picture);
    })
    .catch(error => tip((error as Error).message, false, "error", 6000));
});

/** a library picture as the emblem's main charge, or as the whole emblem in place of shield and field */
function pickPicture(use: "charge" | "whole"): void {
  const entity = currentEl;
  const type = currentType;
  const id = currentId;
  const map = options.map;
  const coa = entity.coa;
  const charge = "icon" in coa ? "" : coa.charges?.[0] ? (Emblems.chargeArt(coa.charges[0].charge) ?? "") : "";
  IconPicker.open({
    current: "icon" in coa ? coa.icon : use === "charge" ? charge : "",
    preferred: "custom",
    profile: "emblem",
    onPick: icon => {
      if (!icon || options.map !== map || getEmblemEntity(type, entity.i) !== entity) return;
      const coa = entity.coa;
      if (use === "whole") {
        entity.coa = { icon, size: coa.size, x: coa.x, y: coa.y };
      } else if ("icon" in coa) {
        const shield = coa.shield ?? Emblems.getShield(entity.culture ?? 0, entity.state);
        entity.coa = pictureAsCharge(icon, shield, coa);
      } else {
        const charge = Emblems.chargeOf(icon);
        if (coa.charges?.length) coa.charges[0] = { ...coa.charges[0], charge };
        else coa.charges = [{ charge, t: /^(argent|or)$/.test(coa.t1) ? "gules" : "or", p: "e", size: 1.5 }];
      }
      void EmblemRenderer.trigger(id, entity.coa);
      redrawEmblem(type, entity.i);
      if (currentEl === entity) updateEmblemData();
    }
  });
}

/** show one row of the toolbar's extra controls, pressing its button; a second press hides it */
function toggleControl(id: "emblemPasteControl" | "emblemDownloadControl"): void {
  const controls = { emblemPasteControl: "emblemsPaste", emblemDownloadControl: "emblemsDownload" } as const;
  for (const [control, button] of Object.entries(controls)) {
    const shown = control === id && ensureEl(control).classList.contains("hidden");
    ensureEl(control).classList.toggle("hidden", !shown);
    ensureEl(button).classList.toggle("pressed", shown);
    if (shown) ensureEl(control).querySelector("input")?.focus();
  }
}

async function download(format: string): Promise<void> {
  await EmblemRenderer.trigger(currentId, currentEl.coa);
  const coa = document.getElementById(currentId)!;
  await loadEmblemIcons([coa]);
  const size = +ensureEl<HTMLInputElement>("emblemsDownloadSize").value;
  const url = await getURL(coa, size, format !== "svg");
  const link = document.createElement("a");
  link.download = `${getFileName(`Emblem ${currentEl.fullName || currentEl.name}`)}.${format}`;

  if (format === "svg") downloadSVG(url, link);
  else downloadRaster(format, url, link, size);
  toggleControl("emblemDownloadControl");
}

function downloadSVG(url: string, link: HTMLAnchorElement): void {
  link.href = url;
  link.click();
}

function downloadRaster(format: string, url: string, link: HTMLAnchorElement, size: number): void {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = size;
  canvas.height = size;

  const img = new Image();
  img.src = url;
  img.onload = () => {
    if (format === "jpeg") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataURL = canvas.toDataURL(`image/${format}`, 0.92);
    link.href = dataURL;
    link.click();
    window.setTimeout(() => window.URL.revokeObjectURL(dataURL), 6000);
  };
}

async function getURL(svg: Element, size: number, raster: boolean): Promise<string> {
  const clone = cloneEmblem(svg, size);
  if (raster) await inlineLinkedImages(clone);
  const serialized = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 6000);
  return url;
}

function getSVG(svg: Element, size: number): string {
  return new XMLSerializer().serializeToString(cloneEmblem(svg, size));
}

function cloneEmblem(svg: Element, size: number): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(size));
  clone.setAttribute("height", String(size));
  const defs =
    clone.querySelector("defs") ??
    clone.insertBefore(document.createElementNS("http://www.w3.org/2000/svg", "defs"), clone.firstChild);
  const visited = new Set<string>();
  const follow = (id: string): void => {
    if (visited.has(id)) return;
    visited.add(id);
    let definition = clone.querySelector(`[id="${CSS.escape(id)}"]`);
    if (!definition) {
      const original = document.getElementById(id);
      if (!original) return; // removed art draws nothing on the map either
      definition = defs.appendChild(original.cloneNode(true) as Element);
    }
    for (const use of definition.querySelectorAll("use")) {
      const href = use.getAttribute("href") ?? use.getAttribute("xlink:href");
      if (href?.startsWith("#")) follow(href.slice(1));
    }
  };
  for (const use of [...clone.querySelectorAll("use")]) {
    const href = use.getAttribute("href") ?? use.getAttribute("xlink:href");
    if (href?.startsWith("#")) follow(href.slice(1));
  }
  return clone;
}

function loadEmblemIcons(emblems: Element[]): Promise<void> {
  const sets = emblems.flatMap(emblem =>
    [...emblem.querySelectorAll("use")].flatMap(use => {
      const href = use.getAttribute("href") ?? use.getAttribute("xlink:href");
      const set = href?.startsWith("#") ? IconSets.setForId(href.slice(1)) : null;
      return set ? [set] : [];
    })
  );
  return Icons.require(sets);
}

async function downloadGallery(): Promise<void> {
  const name = getFileName("Emblems Gallery");
  const validStates = pack.states.filter(s => s.i && !s.removed && s.coa);
  const validProvinces = pack.provinces.filter(p => p.i && !p.removed && p.coa);
  const validBurgs = pack.burgs.filter(b => b.i && !b.removed && b.coa);
  await renderAllEmblems(validStates, validProvinces, validBurgs);
  await loadEmblemIcons([...document.querySelectorAll("#coas > svg")]);

  const back = `<a href="javascript:history.back()">Go Back</a>`;

  const stateSection = `<div><h2>States</h2>${validStates
    .map(state => {
      const el = document.getElementById(`stateCOA${state.i}`)!;
      return `<figure id="state_${state.i}"><a href="#provinces_${state.i}"><figcaption>${state.fullName}</figcaption>${getSVG(el, 200)}</a></figure>`;
    })
    .join("")}</div>`;

  const provinceSections = validStates
    .map(state => {
      const stateProvinces = validProvinces.filter(p => p.state === state.i);
      const figures = stateProvinces
        .map(province => {
          const el = document.getElementById(`provinceCOA${province.i}`)!;
          return `<figure id="province_${province.i}"><a href="#burgs_${province.i}"><figcaption>${province.fullName}</figcaption>${getSVG(el, 200)}</a></figure>`;
        })
        .join("");
      return stateProvinces.length
        ? `<div id="provinces_${state.i}">${back}<h2>${state.fullName} provinces</h2>${figures}</div>`
        : "";
    })
    .join("");

  const burgSections = validStates
    .map(state => {
      const stateBurgs = validBurgs.filter(b => b.state === state.i);
      let stateBurgSections = validProvinces
        .filter(p => p.state === state.i)
        .map(province => {
          const provinceBurgs = stateBurgs.filter(b => pack.cells.province[b.cell] === province.i);
          const provinceBurgFigures = provinceBurgs
            .map(burg => {
              const el = document.getElementById(`burgCOA${burg.i}`);
              if (!el) return "";
              return `<figure id="burg_${burg.i}"><figcaption>${burg.name}</figcaption>${getSVG(el, 200)}</figure>`;
            })
            .join("");
          return provinceBurgs.length
            ? `<div id="burgs_${province.i}">${back}<h2>${province.fullName} burgs</h2>${provinceBurgFigures}</div>`
            : "";
        })
        .join("");

      const stateBurgOutOfProvinces = stateBurgs.filter(b => !pack.cells.province[b.cell]);
      const stateBurgOutOfProvincesFigures = stateBurgOutOfProvinces
        .map(burg => {
          const el = document.getElementById(`burgCOA${burg.i}`);
          if (!el) return "";
          return `<figure id="burg_${burg.i}"><figcaption>${burg.name}</figcaption>${getSVG(el, 200)}</figure>`;
        })
        .join("");
      if (stateBurgOutOfProvincesFigures)
        stateBurgSections += `<div><h2>${state.fullName} burgs under direct control</h2>${stateBurgOutOfProvincesFigures}</div>`;
      return stateBurgSections;
    })
    .join("");

  const neutralBurgs = validBurgs.filter(b => !b.state);
  const neutralsSection = neutralBurgs.length
    ? `<div><h2>Independent burgs</h2>${neutralBurgs
        .map(burg => {
          const el = document.getElementById(`burgCOA${burg.i}`);
          if (!el) return "";
          return `<figure id="burg_${burg.i}"><figcaption>${burg.name}</figcaption>${getSVG(el, 200)}</figure>`;
        })
        .join("")}</div>`
    : "";

  const FMG = `<a href="https://azgaar.github.io/Fantasy-Map-Generator" target="_blank">Azgaar's Fantasy Map Generator</a>`;
  const license = `<a target="_blank" href="https://github.com/Azgaar/Armoria#license">the license</a>`;
  const html = /* html */ `<!DOCTYPE html>
    <html>
      <head>
        <title>${options.map.lore.name} Emblems Gallery</title>
      </head>
      <style type="text/css">
        body { margin: 0; padding: 1em; font-family: serif; }
        h1, h2 { font-family: "Forum"; }
        div { width: 100%; max-width: 1018px; margin: 0 auto; border-bottom: 1px solid #ddd; }
        figure { margin: 0 0 2em; display: inline-block; transition: 0.2s; }
        figure:hover { background-color: #f6f6f6; }
        figcaption { text-align: center; margin: 0.4em 0; width: 200px; font-family: "Overlock SC"; }
        address { width: 100%; max-width: 1018px; margin: 0 auto; }
        a { color: black; }
        figure > a { text-decoration: none; }
        div > a { float: right; font-family: var(--monospace); margin-top: 0.8em; }
      </style>
      <link href="https://fonts.googleapis.com/css2?family=Forum&family=Overlock+SC" rel="stylesheet" />
      <body>
        <div><h1>${options.map.lore.name} Emblems Gallery</h1></div>
        ${stateSection} ${provinceSections} ${burgSections} ${neutralsSection}
        <address>Generated by ${FMG}. The tool is free, but images may be copyrighted, see ${license}</address>
      </body>
    </html>`;
  downloadFile(html, `${name}.html`, "text/plain");
}

async function renderAllEmblems(states: State[], provinces: Province[], burgs: Burg[]): Promise<void> {
  tip("Preparing for download...", true, "warn");

  const statePromises = states.map(state => EmblemRenderer.trigger(`stateCOA${state.i}`, state.coa));
  const provincePromises = provinces.map(province => EmblemRenderer.trigger(`provinceCOA${province.i}`, province.coa));
  const burgPromises = burgs.map(burg => EmblemRenderer.trigger(`burgCOA${burg.i}`, burg.coa));
  const promises = [...statePromises, ...provincePromises, ...burgPromises];

  await Promise.allSettled(promises);
  clearMainTip();
}

type EmblemDragEvent = D3DragEvent<SVGUseElement, unknown, unknown>;

function dragEmblem(this: SVGUseElement, event: EmblemDragEvent): void {
  const x = Number(this.getAttribute("x")) - event.x;
  const y = Number(this.getAttribute("y")) - event.y;

  event.on("drag", function (this: SVGUseElement, dragEvent: EmblemDragEvent) {
    this.setAttribute("x", String(x + dragEvent.x));
    this.setAttribute("y", String(y + dragEvent.y));
  });

  event.on("end", function (this: SVGUseElement, endEvent: EmblemDragEvent) {
    const categotySize = Number((this.parentNode as SVGElement).getAttribute("font-size"));
    const size = Number.parseFloat(this.getAttribute("width") || "1");
    const shift = (categotySize * size) / 2;

    const type = getEmblemType(this.parentElement?.id);
    const i = Number(this.dataset.i);
    const entity = type && Number.isInteger(i) ? getEmblemEntity(type, i) : undefined;
    if (!type || !entity) return;

    entity.coa.x = rn(x + endEvent.x + shift, 2);
    entity.coa.y = rn(y + endEvent.y + shift, 2);
    redrawEmblem(type, i);
  });
}

function getEmblemType(groupId: string | undefined): EmblemType | undefined {
  if (groupId === "burgEmblems") return "burg";
  if (groupId === "provinceEmblems") return "province";
  if (groupId === "stateEmblems") return "state";
  return undefined;
}

function getEmblemEntity(type: EmblemType, i: number): EmblemEl | undefined {
  const entity = type === "burg" ? pack.burgs[i] : type === "province" ? pack.provinces[i] : pack.states[i];
  return entity?.coa ? (entity as EmblemEl) : undefined;
}

function setCurrentEmblem(type: EmblemType, i: number): boolean {
  const entity = getEmblemEntity(type, i);
  if (!entity) return false;
  currentType = type;
  currentId = `${type}COA${i}`;
  currentEl = entity;
  return true;
}

function makeEmblemsDraggable(): void {
  select<SVGElement, unknown>("#emblems")
    .selectAll<SVGUseElement, unknown>("use")
    .call(drag<SVGUseElement, unknown>().on("drag", dragEmblem))
    .classed("draggable", true);
}

function closeEmblemEditor(): void {
  unsubscribeFromReconciliation?.();
  unsubscribeFromReconciliation = undefined;
  select<SVGElement, unknown>("#emblems")
    .selectAll<SVGUseElement, unknown>("use")
    .on(".drag", null)
    .attr("class", null);
  $("#emblemEditor").dialog("destroy");
  ensureEl("emblemEditor").remove();
}

export const EmblemsEditor = { open, openDefault };
