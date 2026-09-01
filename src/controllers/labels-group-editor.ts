import { closeDialogs, confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { LAYER_TOGGLES } from "@/components/layers-tab";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { LABEL_TYPES, type LabelGroup, type LabelNameMode, type LabelType } from "@/generators/labels-generator";
import { getLabelsData } from "@/renderers/labels/label-data";
import { getGroupStyle } from "@/renderers/labels/label-groups";
import { ensureEl } from "@/utils";

function open(): void {
  if (customization) return;
  closeDialogs(".stable");
  renderDialog();
  addRows();

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
      Add: () => {
        const group: LabelGroup = { name: "", type: "state", zoom: { min: null, max: null } };
        ensureEl("labelGroupsBody").insertAdjacentHTML("beforeend", createRow(group, true, 0));
      },
      Restore: () => {
        const defaults = Labels.getDefaultOptions();
        ensureEl<HTMLInputElement>("labelsResizeOnZoom").checked = defaults.resizeOnZoom;
        ensureEl<HTMLInputElement>("labelsShowAll").checked = defaults.showAll;
        addRows(defaults.groups);
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function renderDialog(): void {
  destroyDialog("labelGroupsConfigurator");
  const html = /* html */ `<div id="labelGroupsConfigurator" class="dialog stable">
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
          <col style="width:3.5em">
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
            <th data-tip="Number of labels currently assigned to this group. Click the list icon to see them">Labels</th>
            <th data-tip="Rendering order: lower groups are rendered on top">Order</th>
            <th data-tip="Edit style or remove group">Actions</th>
          </tr>
        </thead>
        <tbody id="labelGroupsBody"></tbody>
      </table>
      <div id="labelGroupsMissingWrapper" style="display:none; gap:.4em; align-items:center; margin:.6em 0 0">
        <label data-tip="Groups referenced by labels but not defined here. Such labels are not rendered until they are reassigned to an existing group"><strong>Missing groups:</strong> <span id="labelGroupsMissing"></span></label>
      </div>
      <div style="display:flex; gap:1.2em; align-items:center; margin:.6em 0 0">
        <label data-tip="Automatically scale label font size as you zoom in or out"><input id="labelsResizeOnZoom" class="checkbox" type="checkbox" ${options.labels.resizeOnZoom ? "checked" : ""}><span class="checkbox-label">Resize labels on zoom</span></label>
        <label data-tip="Ignore zoom bounds and show all labels regardless of the current zoom level"><input id="labelsShowAll" class="checkbox" type="checkbox" ${options.labels.showAll ? "checked" : ""}><span class="checkbox-label">Show all labels <small>[slow]</small></span></label>
        <div style="padding: 0.5em 0; font-style: italic;">To change Burg Groups open <a id="labelGroupsBurgGroupsLink" style="text-decoration: underline;">Burg Group Configurator</a>.</div>
      </div>
    </form>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  const form = ensureEl("labelGroupsForm");
  form.addEventListener("change", validateForm);
  form.addEventListener("submit", submitForm);
  ensureEl("labelGroupsBody").addEventListener("click", onBodyClick);
  ensureEl("labelGroupsBody").addEventListener("change", onBodyChange);
  ensureEl("labelGroupsBurgGroupsLink").addEventListener("click", () => Controllers.BurgGroupEditor.open());
  ensureEl("labelGroupsMissing").addEventListener("click", onMissingGroupsClick);
}

function addRows(groups: LabelGroup[] = options.labels.groups): void {
  const counts = countLabelsByGroup();
  ensureEl("labelGroupsBody").innerHTML = groups
    .map(group => createRow(group, false, counts.get(group.name) ?? 0))
    .join("");
  addMissingGroups(counts, groups);
}

/** List groups labels are assigned to, but which are not defined anymore, so their labels are not rendered */
function addMissingGroups(counts: Map<string, number>, groups: LabelGroup[]): void {
  const definedGroups = new Set(groups.map(({ name }) => name));
  const missingGroups = [...counts.entries()].filter(([name]) => !definedGroups.has(name)).sort();

  ensureEl("labelGroupsMissingWrapper").style.display = missingGroups.length ? "flex" : "none";
  ensureEl("labelGroupsMissing").innerHTML = missingGroups
    .map(
      ([name, count]) => /* html */ `${name} (${count})
        <button type="button" name="missing" data-group="${name}" class="icon-list-bullet"
          data-tip="Show labels of the ${name} group in Labels Overview to reassign them"></button>`
    )
    .join(", ");
}

function countLabelsByGroup(): Map<string, number> {
  const counts = new Map<string, number>();
  const increment = (name: string) => counts.set(name, (counts.get(name) ?? 0) + 1);

  const labels = getLabelsData();
  labels.forEach(label => void increment(label.group));

  return counts;
}

function createRow(group: LabelGroup, isNew = false, labelCount = 0): string {
  const modes: LabelNameMode[] = ["auto", "short", "full"];
  const isDefault = Boolean(group.isDefault);
  const nameTip = isDefault
    ? "Default group for this type, can't be renamed"
    : "Group name. Must start with a letter or underscore, followed by letters, digits, underscores, or dashes";
  const modeApplicable = isModeApplicable(group.type);
  const modeTip = modeApplicable
    ? "Name display mode: auto picks the best fit, short/full force a specific name form"
    : "Name display mode is only applicable to States and Provinces";

  const layers = [...LAYER_TOGGLES.keys()].sort();

  return /* html */ `<tr data-group="${isNew ? "" : group.name}" data-is-default="${isDefault ? "1" : ""}">
      <td data-tip="Activate/deactivate group"><input type="checkbox" name="active" class="native" ${group.active !== false ? "checked" : ""}></td>
      <td data-tip="${nameTip}"><input type="text" name="name" value="${group.name}" ${isDefault ? "disabled" : "required"}></td>
      <td data-tip="Label type, fixed after creation"><select name="type" ${isNew ? "" : "disabled"}>
        ${LABEL_TYPES.map(type => `<option value="${type}" ${group.type === type ? "selected" : ""}>${type}</option>`).join("")}
      </select></td>
      <td data-tip="${modeTip}"><select name="mode" ${modeApplicable ? "" : "disabled"}>
        ${modes.map(mode => `<option value="${mode}" ${(group.mode || "auto") === mode ? "selected" : ""}>${mode}</option>`).join("")}
      </select></td>
      <td data-tip="Minimum zoom to show the group, leave empty for no limit"><input type="number" name="zoom-min" min="0.01" max="200" step=".01" value="${group.zoom.min ?? ""}"></td>
      <td data-tip="Maximum zoom to show the group, leave empty for no limit"><input type="number" name="zoom-max" min="0.01" max="200" step=".01" value="${group.zoom.max ?? ""}"></td>
      <td data-tip="Layer that must be toggled on for this group to be shown"><select name="dependency">
        <option value="">none</option>
        ${layers.map(id => `<option value="${id}" ${group.layerDependency === id ? "selected" : ""}>${id}</option>`).join("")}
      </select></td>
      <td data-tip="Number of labels currently assigned to this group" style="text-align:center">
        <div style="min-width:2em; display:inline-block">${labelCount}</div>
        <button type="button" name="list" class="icon-list-bullet" data-tip="Show labels of this group in Labels Overview"></button>
      </td>
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

function onMissingGroupsClick(event: Event): void {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[name='missing']");
  if (button?.dataset.group) void Controllers.LabelsOverview.open(button.dataset.group);
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
  if (button.name === "list") {
    const name = row.dataset.group;
    if (name) void Controllers.LabelsOverview.open(name);
    return;
  }
  if (button.name === "remove") removeRow(row);
}

function removeRow(row: HTMLTableRowElement): void {
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

function isModeApplicable(type: LabelType) {
  return ["state", "province"].includes(type);
}

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
    if (!isValidName) message = "Group name must start with a letter or underscore and not contain special characters";
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

  const newGroupNames = new Set<string>();
  rows.forEach(row => {
    const oldName = row.dataset.group;

    const newGroup = rowToGroup(row);
    newGroupNames.add(newGroup.name);

    if (newGroup.name !== oldName) {
      if (oldName) {
        // group is renamed
        replaceGroupInEntities(oldName, newGroup.name);
        styles.labels.groups[newGroup.name] = styles.labels.groups[oldName];
        delete styles.labels.groups[oldName];
      } else {
        // group is new
        styles.labels.groups[newGroup.name] = getGroupStyle(newGroup);
      }
    }
  });

  options.labels.groups.forEach(group => {
    if (newGroupNames.has(group.name)) return;
    // group is removed
    const fallback = Labels.getFallbackGroup(group.type);
    replaceGroupInEntities(group.name, fallback.name);
    delete styles.labels.groups[group.name];
  });

  options.labels.groups = rows.map(rowToGroup);
  options.labels.resizeOnZoom = ensureEl<HTMLInputElement>("labelsResizeOnZoom").checked;
  options.labels.showAll = ensureEl<HTMLInputElement>("labelsShowAll").checked;

  for (const group of options.labels.groups) styles.labels.groups[group.name] ??= getGroupStyle(group);
  localStorage.setItem("options-labels", JSON.stringify(options.labels));

  Layers.draw("labels");
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
  if (Layers.has(dependency)) group.layerDependency = dependency;
  if (row.dataset.isDefault === "1") group.isDefault = true;
  return group;
}

function replaceGroupInEntities(oldName: string, newName: string): void {
  const labels = getLabelsData();
  for (const { type, entityId, group } of labels) {
    if (group === oldName) Labels.setGroup({ type, entityId, group: newName });
  }
}

function close(): void {
  destroyDialog("labelGroupsConfigurator");
}

export const LabelGroupsConfigurator = { open };
