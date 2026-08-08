import { closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import {
  DEFAULT_LABEL_TYPES,
  type Label,
  type LabelGroup,
  type LabelNameMode,
  type LabelType
} from "@/generators/labels-generator";
import { drawLabels } from "@/renderers/labels/labels-renderer";
import { destroyDialogIfExists, ensureEl } from "@/utils";

// TODO: replace with Layers registry data
const LAYER_TOGGLES: { id: string; label: string }[] = [
  { id: "toggleBorders", label: "Borders" },
  { id: "toggleBiomes", label: "Biomes" },
  { id: "toggleBurgIcons", label: "Burg Icons" },
  { id: "toggleCells", label: "Cells" },
  { id: "toggleCompass", label: "Wind Rose" },
  { id: "toggleCoordinates", label: "Coordinates" },
  { id: "toggleCultures", label: "Cultures" },
  { id: "toggleEmblems", label: "Emblems" },
  { id: "toggleGoods", label: "Goods" },
  { id: "toggleGrid", label: "Grid" },
  { id: "toggleHeight", label: "Heightmap" },
  { id: "toggleIce", label: "Ice" },
  { id: "toggleLabels", label: "Labels" },
  { id: "toggleLakes", label: "Lakes" },
  { id: "toggleMarketsLayer", label: "Markets" },
  { id: "toggleMarkers", label: "Markers" },
  { id: "toggleMilitary", label: "Military" },
  { id: "togglePopulation", label: "Population" },
  { id: "togglePrecipitation", label: "Precipitation" },
  { id: "toggleProvinces", label: "Provinces" },
  { id: "toggleRelief", label: "Relief" },
  { id: "toggleReligions", label: "Religions" },
  { id: "toggleRoutes", label: "Routes" },
  { id: "toggleRulers", label: "Rulers" },
  { id: "toggleScaleBar", label: "Scale Bar" },
  { id: "toggleTexture", label: "Texture" },
  { id: "toggleTemperature", label: "Temperature" },
  { id: "toggleTrade", label: "Trade" },
  { id: "toggleVignette", label: "Vignette" },
  { id: "toggleZones", label: "Zones" }
];

function open(): void {
  if (customization) return;
  closeDialogs(".stable");
  renderDialog();
  addLines();

  $("#labelGroupsConfigurator").dialog({
    title: "Configure Label Groups",
    resizable: false,
    maxHeight: Math.max(window.innerHeight - 40, 300),
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" },
    close,
    buttons: {
      Apply: () => {
        ensureEl<HTMLFormElement>("labelGroupsForm").requestSubmit();
      },
      Add: addLine,
      "Burg Groups": () => {
        void Controllers.BurgGroupEditor.open();
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function renderDialog(): void {
  destroyDialogIfExists("labelGroupsConfigurator");
  const html = /* html */ `<div id="labelGroupsConfigurator" class="dialog">
    <form id="labelGroupsForm">
      <table class="table" style="white-space:nowrap; overflow-x:auto; max-width:100%">
        <colgroup>
          <col style="width:2.5em">
          <col style="width:8em">
          <col style="width:5.5em">
          <col style="width:4em">
          <col style="width:3.5em">
          <col style="width:3.5em">
          <col style="width:8.5em">
          <col style="width:3.2em">
          <col style="width:3.2em">
        </colgroup>
        <thead>
          <tr>
            <th data-tip="Activate/deactivate group. Deactivated group labels are not visible">Active</th>
            <th data-tip="Group name. Must start with a letter or underscore, followed by letters, digits, underscores, or dashes">Group</th>
            <th data-tip="Label type, cannot be changed after creation">Type</th>
            <th data-tip="Name display mode. Only applicable to States and Provinces">Mode</th>
            <th data-tip="Minimum zoom level to show the group">Zoom min</th>
            <th data-tip="Maximum zoom level to show the group">Zoom max</th>
            <th data-tip="Layer that must be toggled on for this group to be shown">Layer dependency</th>
            <th data-tip="Rendering order: lower groups are rendered on top">Order</th>
            <th data-tip="Edit style or remove group">Actions</th>
          </tr>
        </thead>
        <tbody id="labelGroupsBody"></tbody>
      </table>
      <div style="display:flex; gap:1.2em; align-items:center; margin:.6em 0 0">
        <label data-tip="Automatically scale label font size as you zoom in or out"><input id="labelsResizeOnZoom" class="checkbox" type="checkbox" ${options.labels.resizeOnZoom ? "checked" : ""}><span class="checkbox-label">Resize labels on zoom</span></label>
        <label data-tip="Ignore zoom bounds and show all labels regardless of the current zoom level"><input id="labelsShowAll" class="checkbox" type="checkbox" ${options.labels.showAll ? "checked" : ""}><span class="checkbox-label">Show all labels <small>[slow]</small></span></label>
      </div>
    </form>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  const form = ensureEl("labelGroupsForm");
  form.addEventListener("change", validateForm);
  form.addEventListener("submit", submitForm);
  ensureEl("labelGroupsBody").addEventListener("click", onBodyClick);
  ensureEl("labelGroupsBody").addEventListener("change", onBodyChange);
}

function addLines(): void {
  ensureEl("labelGroupsBody").innerHTML = options.labels.groups.map(group => createLine(group)).join("");
}

function addLine(): void {
  ensureEl("labelGroupsBody").insertAdjacentHTML(
    "beforeend",
    createLine({ name: "", type: "state", zoom: { min: null, max: null } }, true)
  );
}

function createLine(group: LabelGroup, isNew = false): string {
  const modes: LabelNameMode[] = ["auto", "short", "full"];
  const isDefault = Boolean(group.isDefault);
  const nameTip = isDefault
    ? "Default group for this type, can't be renamed"
    : "Group name. Must start with a letter or underscore, followed by letters, digits, underscores, or dashes";
  const modeApplicable = isModeApplicable(group.type);
  const modeTip = modeApplicable
    ? "Name display mode: auto picks the best fit, short/full force a specific name form"
    : "Name display mode is only applicable to States and Provinces";

  return /* html */ `<tr data-group="${isNew ? "" : group.name}" data-is-default="${isDefault ? "1" : ""}">
      <td data-tip="Activate/deactivate group"><input type="checkbox" name="active" class="native" ${group.active !== false ? "checked" : ""}></td>
      <td data-tip="${nameTip}"><input type="text" name="name" value="${group.name}" ${isDefault ? "disabled" : "required"}></td>
      <td data-tip="Label type, fixed after creation"><select name="type" ${isNew ? "" : "disabled"}>
        ${DEFAULT_LABEL_TYPES.map(type => `<option value="${type}" ${group.type === type ? "selected" : ""}>${type}</option>`).join("")}
      </select></td>
      <td data-tip="${modeTip}"><select name="mode" ${modeApplicable ? "" : "disabled"}>
        ${modes.map(mode => `<option value="${mode}" ${(group.mode || "auto") === mode ? "selected" : ""}>${mode}</option>`).join("")}
      </select></td>
      <td data-tip="Minimum zoom to show the group, leave empty for no limit"><input type="number" name="zoom-min" min="0.01" max="200" step=".01" value="${group.zoom.min ?? ""}"></td>
      <td data-tip="Maximum zoom to show the group, leave empty for no limit"><input type="number" name="zoom-max" min="0.01" max="200" step=".01" value="${group.zoom.max ?? ""}"></td>
      <td data-tip="Layer that must be toggled on for this group to be shown"><select name="dependency">
        <option value="">None</option>
        ${LAYER_TOGGLES.map(({ id, label }) => `<option value="${id}" ${group.layerDependency === id ? "selected" : ""}>${label}</option>`).join("")}
      </select></td>
      <td data-tip="Assignment order: move group up or down"><button type="button" name="up" class="icon-up-open" data-tip="Move up"></button><button type="button" name="down" class="icon-down-open" data-tip="Move down"></button></td>
      <td><button type="button" name="style" class="icon-brush" data-tip="Edit visual style"></button><span data-tip="${isDefault ? "Default groups can't be removed" : "Remove group"}"><button type="button" name="remove" class="icon-trash-empty" ${isDefault ? "disabled" : ""}></button></span></td>
    </tr>`;
}

function onBodyChange(event: Event): void {
  const target = event.target as HTMLElement;
  if (!(target instanceof HTMLSelectElement) || target.name !== "type") return;

  const row = target.closest<HTMLTableRowElement>("tr");
  const modeSelect = row?.querySelector<HTMLSelectElement>('[name="mode"]');
  if (!modeSelect) return;

  const applicable = isModeApplicable(target.value as LabelType);
  modeSelect.disabled = !applicable;
  if (!applicable) modeSelect.value = "auto";
}

function onBodyClick(event: Event): void {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[name]");
  if (!button || button.disabled) return;
  const row = button.closest<HTMLTableRowElement>("tr");
  if (!row) return;

  if (button.name === "up") {
    const prev = row.previousElementSibling;
    if (prev) row.parentNode!.insertBefore(row, prev);
    return;
  }
  if (button.name === "down") {
    const next = row.nextElementSibling;
    if (next) row.parentNode!.insertBefore(next, row);
    return;
  }
  if (button.name === "style") {
    const name = row.querySelector<HTMLInputElement>('[name="name"]')!.value.trim();
    if (name) editStyle("labels", name);
    return;
  }
  if (button.name === "remove") removeLine(row);
}

function removeLine(row: HTMLTableRowElement): void {
  const rows = ensureEl("labelGroupsBody").children;
  if (rows.length < 2) {
    tip("At least one group should be defined", false, "error");
    return;
  }

  confirmationDialog({
    title: "Remove Label Group",
    message: "Remove the group? This won't affect labels unless the changes are applied.",
    confirm: "Remove",
    onConfirm: () => {
      row.remove();
      validateForm();
    }
  });
}

const isModeApplicable = (type: LabelType) => ["state", "province"].includes(type);

function validateForm(): boolean {
  const form = ensureEl<HTMLFormElement>("labelGroupsForm");
  const nameInputs = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="name"]'));
  const names = nameInputs.map(input => input.value.trim());
  nameInputs.forEach(input => {
    if (input.disabled) {
      input.setCustomValidity("");
      return;
    }
    let message = "";
    const value = input.value.trim();
    const GROUP_NAME_REGEXP = /^[\p{L}_][\p{L}\p{N}_-]*$/u;
    const isValidName = GROUP_NAME_REGEXP.test(value);
    const isUnique = names.filter(name => name === value).length === 1;
    if (!isValidName)
      message =
        "Group name must start with a letter or underscore and then contain only letters, digits, underscores, or dashes";
    if (!isUnique) message = "Group name should be unique";
    input.setCustomValidity(message);
  });

  const isValid = form.checkValidity();
  if (!isValid) form.reportValidity();
  return isValid;
}

function submitForm(event: Event): void {
  event.preventDefault();
  if (!validateForm()) return;

  const rows = Array.from(ensureEl("labelGroupsBody").children) as HTMLTableRowElement[];
  if (!rows.length) return void tip("At least one group should be defined", false, "error");

  const newGroups = rows.map(rowToGroup);
  const renames: [string, string][] = [];
  const survivingNames = new Set<string>();
  rows.forEach(row => {
    const originalName = row.dataset.group;
    if (!originalName) return;
    survivingNames.add(originalName);
    const currentName = row.querySelector<HTMLInputElement>('[name="name"]')!.value.trim();
    if (currentName !== originalName) renames.push([originalName, currentName]);
  });
  const removedNames = options.labels.groups.map(group => group.name).filter(name => !survivingNames.has(name));

  for (const [oldName, newName] of renames) {
    renameGroupInEntities(oldName, newName);
    const groupStyle = style.labels.groups[oldName];
    if (groupStyle) {
      style.labels.groups[newName] = groupStyle;
      delete style.labels.groups[oldName];
    }
    void Controllers.LabelsEditor.renameLastSelectedGroup(oldName, newName);
  }
  for (const name of removedNames) {
    delete style.labels.groups[name];
    resetGroupInEntities(name);
  }

  options.labels.groups = newGroups;
  options.labels.resizeOnZoom = ensureEl<HTMLInputElement>("labelsResizeOnZoom").checked;
  options.labels.showAll = ensureEl<HTMLInputElement>("labelsShowAll").checked;
  const exportShowAll = document.querySelector<HTMLInputElement>("#showLabels");
  if (exportShowAll) exportShowAll.checked = options.labels.showAll;

  localStorage.setItem("label-groups", JSON.stringify(options.labels.groups));
  drawLabels();
  $("#labelGroupsConfigurator").dialog("close");
}

function rowToGroup(row: HTMLTableRowElement): LabelGroup {
  const name = row.querySelector<HTMLInputElement>('[name="name"]')!.value.trim();
  const type = row.querySelector<HTMLSelectElement>('[name="type"]')!.value as LabelType;
  const active = row.querySelector<HTMLInputElement>('[name="active"]')!.checked;
  const mode = row.querySelector<HTMLSelectElement>('[name="mode"]')!.value as LabelNameMode;
  const minInput = row.querySelector<HTMLInputElement>('[name="zoom-min"]')!;
  const maxInput = row.querySelector<HTMLInputElement>('[name="zoom-max"]')!;
  const dependency = row.querySelector<HTMLSelectElement>('[name="dependency"]')!.value.trim();

  const min = minInput.value === "" ? null : minInput.valueAsNumber;
  const max = maxInput.value === "" ? null : maxInput.valueAsNumber;
  const group: LabelGroup = { name, type, zoom: { min, max } };

  if (!active) group.active = false;
  if (mode !== "auto") group.mode = mode;
  if (dependency) group.layerDependency = dependency;
  if (row.dataset.isDefault === "1") group.isDefault = true;
  return group;
}

function forEachLabelledEntity(callback: (entity: { label?: Label }) => void): void {
  pack.states.forEach(callback);
  pack.provinces.forEach(callback);
  pack.burgs.forEach(callback);
  pack.rivers.forEach(callback);
  pack.routes.forEach(callback);
}

function renameGroupInEntities(oldName: string, newName: string): void {
  forEachLabelledEntity(entity => {
    if (entity.label && entity.label.group === oldName) entity.label.group = newName;
  });
  pack.labels.forEach(label => {
    if (label.group === oldName) label.group = newName;
  });
}

function resetGroupInEntities(name: string): void {
  forEachLabelledEntity(entity => {
    if (entity.label && entity.label.group === name) delete entity.label.group;
  });
  const fallback = Labels.getFallbackGroup("added").name;
  pack.labels.forEach(label => {
    if (label.group === name) label.group = fallback;
  });
}

function close(): void {
  destroyDialogIfExists("labelGroupsConfigurator");
}

export const LabelGroupsConfigurator = { open };
