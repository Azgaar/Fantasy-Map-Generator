import { mean, min, polygonLength, type Selection, select } from "d3";
import { Controllers } from "@/controllers";
import { FEATURE_SUBTYPE_LABELS } from "@/data/id-labels";
import { type Feature, Features, LAKE_SUBTYPES } from "@/model/physical/features-generator";
import { Names } from "@/model/society/names-generator";
import { Styles } from "@/model/styles/styles";
import { Tags } from "@/model/tags";
import { getArea, getAreaUnit, getHeight } from "@/model/units";
import { Layers } from "@/renderers/layers";
import { isGroupNameFree } from "@/renderers/style-groups";
import { speak } from "@/services/speech";
import { Dialog } from "@/ui/dialog/dialog";
import { noteButton } from "@/ui/dialog/dialog-helpers";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { si } from "@/utils/number-utils";
import { rand } from "@/utils/probability-utils";

let selectedLake: Selection<SVGElement, unknown, HTMLElement, unknown>;

function open(element: SVGElement): void {
  if (options.app.mode) return;
  Dialog.closeAll(".stable");
  Layers.hide("cells");

  renderDialog();

  selectedLake = select<SVGElement, unknown>(element) as unknown as typeof selectedLake;
  updateLakeValues();
  selectLakeGroup();

  Dialog.open("lakeEditor", {
    title: t("Edit Lake"),
    position: { my: "center top+20", at: "top", of: "svg" },
    onClose: closeLakesEditor
  });
}

function renderDialog(): void {
  Dialog.destroy("lakeEditor");

  const html = /* html */ `<div id="lakeEditor" class="dialog">
    <div id="lakeBody" style="padding-bottom: 0.3em">
      <div>
        <div class="label" style="width: 4.8em">${t("Name")}:</div>
        <span id="lakeNameCulture" data-tip="${t("Generate culture-specific name")}" class="icon-book pointer"></span>
        <span id="lakeNameRandom" data-tip="${t("Generate random name")}" class="icon-globe pointer"></span>
        <input id="lakeName" data-tip="${t("Type to rename")}" autocorrect="off" spellcheck="false" />
        <span id="lakeNameSpeak" data-tip="${sentences(t("Speak the name"), t("You can change voice and language in options"))}" class="speaker">🔊</span>
      </div>
      <div data-tip="${t("Lake subtype. Generators read it: burgs cannot port on dry, frozen or lava lakes")}">
        <div class="label" style="width: 7em">${t("Subtype")}:</div>
        <select id="lakeSubtype" data-tip="${t("Select lake subtype")}">
          ${LAKE_SUBTYPES.map(subtype => `<option value="${subtype}">${FEATURE_SUBTYPE_LABELS[subtype] ?? subtype}</option>`).join("")}
        </select>
      </div>
      <div data-tip="${sentences(t("Rendering group: the svg group the lake is drawn in"), t("Does not affect generation"))}">
        <div class="label" style="width: 4.8em">${t("Group")}:</div>
        <span id="lakeGroupRemove" data-tip="${t("Remove")}" class="icon-trash-empty pointer"></span>
        <span id="lakeGroupAdd" data-tip="${t("Create a new group for the lake")}" class="icon-plus pointer"></span>
        <select id="lakeGroup" data-tip="${t("Select lake rendering group")}"></select>
        <input id="lakeGroupName" placeholder="${t("Group name")}" data-tip="${t("Provide a name for the new group")}" style="display: none" />
        <span id="lakeEditStyle" data-tip="${t("Edit style in Style Editor")}" class="icon-brush pointer"></span>
      </div>
      <div data-tip="${t("Lake tags (comma-separated)")}">
        <div class="label" style="width: 4.8em">${t("Tags")}:</div>
        <input
          id="lakeTags"
          placeholder="${t("Tags")}"
          autocorrect="off"
          spellcheck="false"
        />
      </div>
      <div data-tip="${t("Lake area in selected units")}">
        <div class="label">${t("Area")}:</div>
        <input id="lakeArea" disabled />
      </div>
      <div data-tip="${t("Lake shore length in selected units")}">
        <div class="label">${t("Shore length")}:</div>
        <input id="lakeShoreLength" disabled />
      </div>
      <div data-tip="${t("Lake elevation in selected units")}">
        <div class="label">${t("Elevation")}:</div>
        <input id="lakeElevation" disabled />
      </div>
      <div data-tip="${t("Lake average depth in selected units")}">
        <div class="label">${t("Average depth")}:</div>
        <input id="lakeAverageDepth" disabled />
      </div>
      <div data-tip="${t("Lake maximum depth in selected units")}">
        <div class="label">${t("Max depth")}:</div>
        <input id="lakeMaxDepth" disabled />
      </div>
      <div data-tip="${t("Lake water supply. If supply > evaporation and there is an outlet, the lake water is fresh. If supply is very low, the lake becomes dry")}">
        <div class="label">${t("Supply")}:</div>
        <input id="lakeFlux" disabled />
      </div>
      <div data-tip="${t("Evaporation from lake surface. If evaporation > supply, the lake water is saline. If difference is high, the lake becomes dry")}">
        <div class="label">${t("Evaporation")}:</div>
        <input id="lakeEvaporation" disabled />
      </div>
      <div data-tip="${t("Number of lake inlet rivers")}">
        <div class="label">${t("Inlets")}:</div>
        <input id="lakeInlets" disabled />
      </div>
      <div data-tip="${t("Lake outlet river")}">
        <div class="label">${t("Outlet")}:</div>
        <input id="lakeOutlet" disabled />
      </div>
    </div>
    <div id="lakeBottom">
      ${noteButton("lakeLegend", t("Edit free text notes (legend)"))}
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("lakeName").addEventListener("input", changeName);
  ensureEl("lakeNameSpeak").addEventListener("click", () => speak(ensureEl<HTMLInputElement>("lakeName").value));
  ensureEl("lakeNameCulture").addEventListener("click", generateNameCulture);
  ensureEl("lakeNameRandom").addEventListener("click", generateNameRandom);
  ensureEl("lakeSubtype").addEventListener("change", changeLakeSubtype);
  ensureEl("lakeGroup").addEventListener("change", changeLakeGroup);
  ensureEl("lakeGroupAdd").addEventListener("click", toggleNewGroupInput);
  ensureEl("lakeGroupName").addEventListener("change", createNewGroup);
  ensureEl("lakeGroupRemove").addEventListener("click", removeLakeGroup);
  ensureEl("lakeEditStyle").addEventListener("click", editGroupStyle);
  ensureEl("lakeTags").addEventListener("change", changeLakeTags);
  ensureEl("lakeLegend").addEventListener("click", editLakeLegend);
}

function getLake(): Feature {
  const lakeId = +selectedLake.attr("data-f");
  return pack.features.find(feature => feature.i === lakeId) as Feature;
}

function updateLakeValues(): void {
  const { cells, vertices, rivers } = pack;

  const l = getLake();
  ensureEl<HTMLInputElement>("lakeName").value = l.name;
  ensureEl<HTMLSelectElement>("lakeSubtype").value = l.subtype || "freshwater";
  ensureEl<HTMLInputElement>("lakeTags").value = Tags.format(l.tags);
  ensureEl<HTMLInputElement>("lakeArea").value = `${si(getArea(l.area))} ${getAreaUnit()}`;

  const length = polygonLength(l.vertices.map(v => vertices.p[v] as [number, number]));
  ensureEl<HTMLInputElement>("lakeShoreLength").value =
    `${si(length * options.map.units.distance.scale)} ${options.map.units.distance.unit}`;

  const lakeCells = Array.from(cells.i.filter(i => cells.f[i] === l.i));
  const heights = lakeCells.map(i => cells.h[i]);

  ensureEl<HTMLInputElement>("lakeElevation").value = getHeight(l.height);
  ensureEl<HTMLInputElement>("lakeAverageDepth").value = getHeight(mean(heights) ?? 0, true);
  ensureEl<HTMLInputElement>("lakeMaxDepth").value = getHeight(min(heights) ?? 0, true);

  ensureEl<HTMLInputElement>("lakeFlux").value = String(l.flux);
  ensureEl<HTMLInputElement>("lakeEvaporation").value = String(l.evaporation);

  const inlets = l.inlets?.map(inlet => rivers.find(river => river.i === inlet)?.name);
  const outlet = l.outlet ? rivers.find(river => river.i === l.outlet)?.name : "no";
  const inletsInput = ensureEl<HTMLInputElement>("lakeInlets");
  inletsInput.value = inlets ? String(inlets.length) : "no";
  inletsInput.title = inlets ? inlets.join(", ") : "";
  ensureEl<HTMLInputElement>("lakeOutlet").value = outlet ?? "no";
}

function changeName(this: HTMLInputElement): void {
  getLake().name = this.value;
}

function generateNameCulture(): void {
  const lake = getLake();
  lake.name = ensureEl<HTMLInputElement>("lakeName").value = Features.getName(lake);
}

function generateNameRandom(): void {
  const lake = getLake();
  lake.name = ensureEl<HTMLInputElement>("lakeName").value = Names.getBase(
    Names.nameBases[rand(Names.nameBases.length - 1)].id
  );
}

function changeLakeSubtype(this: HTMLSelectElement): void {
  Features.setSubtype(getLake().i, this.value); // subtype is domain data, the rendering group is left alone
}

const isStockGroup = (group: string) => group in Styles.defaults.lakes.groups;
const lakesOf = (group: string) => pack.features.filter(feature => feature?.type === "lake" && feature.group === group);

function selectLakeGroup(): void {
  const lake = getLake();
  const currentGroup = lake.group;

  const groupSelect = ensureEl<HTMLSelectElement>("lakeGroup");
  groupSelect.options.length = 0; // remove all options
  for (const group of Object.keys(styles.lakes.groups)) {
    groupSelect.options.add(new Option(group, group, false, group === currentGroup));
  }
}

function changeLakeGroup(this: HTMLSelectElement): void {
  getLake().group = this.value;
  Layers.draw("lakes");
}

function toggleNewGroupInput(): void {
  const lakeGroupName = ensureEl("lakeGroupName");
  const lakeGroup = ensureEl("lakeGroup");
  if (lakeGroupName.style.display === "none") {
    lakeGroupName.style.display = "inline-block";
    lakeGroupName.focus();
    lakeGroup.style.display = "none";
  } else {
    lakeGroupName.style.display = "none";
    lakeGroup.style.display = "inline-block";
  }
}

function createNewGroup(this: HTMLInputElement): void {
  if (!this.value) {
    tip(t("Invalid group name"));
    return;
  }
  const group = this.value
    .toLowerCase()
    .replace(/ /g, "_")
    .replace(/[^\w\s]/gi, "");

  if (!isGroupNameFree(styles.lakes.groups, group)) {
    tip(t("Element with this name already exists. Provide a unique name"), false, "error");
    return;
  }

  if (Number.isFinite(+group.charAt(0))) {
    tip(t("Group name should start with a letter"), false, "error");
    return;
  }

  // the store is the only record of a group: a new one starts with the style of the lake's current group
  const lake = getLake();
  const oldGroup = lake.group;
  const groups = styles.lakes.groups;
  const groupSelect = ensureEl<HTMLSelectElement>("lakeGroup");
  if (!isStockGroup(oldGroup) && lakesOf(oldGroup).length === 1) {
    // a group renamed keeps its place in the store, and so in the drawing order
    const entries = Object.entries(groups);
    for (const [name] of entries) delete groups[name];
    for (const [name, entry] of entries) groups[name === oldGroup ? group : name] = entry;
    groupSelect.selectedOptions[0].remove();
  } else {
    groups[group] = structuredClone(groups[oldGroup] || groups.freshwater);
  }
  groupSelect.options.add(new Option(group, group, false, true));
  lake.group = group;
  Layers.draw("lakes"); // the layer makes the group element from the store and moves the lake into it

  toggleNewGroupInput();
  ensureEl<HTMLInputElement>("lakeGroupName").value = "";
}

function removeLakeGroup(): void {
  const group = getLake().group;
  if (isStockGroup(group)) {
    tip(t("This is one of the default groups, it cannot be removed"), false, "error");
    return;
  }

  const count = lakesOf(group).length;
  Dialog.confirm({
    title: t("Remove"),
    message: sentences(
      t("Are you sure you want to remove the group?"),
      t("All lakes of the group ({{lakes}}) will be turned into Freshwater", { lakes: count })
    ),
    confirm: t("Remove"),
    onConfirm: () => {
      for (const lake of lakesOf(group)) lake.group = "freshwater";
      delete styles.lakes.groups[group];
      Layers.draw("lakes");
      ensureEl<HTMLSelectElement>("lakeGroup").selectedOptions[0].remove();
      ensureEl<HTMLSelectElement>("lakeGroup").value = "freshwater";
    }
  });
}

function editGroupStyle(): void {
  void Controllers.StyleEditor.open("lakes", getLake().group);
}

function changeLakeTags(this: HTMLInputElement): void {
  const lake = getLake();
  if (!lake) return;
  Tags.set(lake, this.value);
  this.value = Tags.format(lake.tags);
}

function editLakeLegend(): void {
  void Controllers.NotesEditor.open({ type: "feature", id: getLake().i });
}

function closeLakesEditor(): void {
  Dialog.destroy("lakeEditor");
  selectedLake = null!;
}

export const LakesEditor = { open };
