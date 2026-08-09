import { closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { applySorting, applySortingByHeader } from "@/components/dialog/sorting";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { DEFAULT_LABEL_TYPES } from "@/generators/labels-generator";
import type { LabelData } from "@/renderers/labels/labels";
import { drawLabels, labelDataAdapters } from "@/renderers/labels/labels-renderer";
import { highlightElement } from "@/renderers/overlays/highlight";
import { destroyDialogIfExists, ensureEl, findEl } from "@/utils";

const ALL = ""; // filter value meaning "all"
const filters = { group: ALL, type: ALL, search: "" };
let isBulkMode = false;

function open(group: string): void {
  if (customization) return;
  closeDialogs("#labelsOverview, .stable");
  if (!layerIsOn("toggleLabels")) toggleLabels();

  isBulkMode = false;
  if (group) filters.group = group;

  renderDialog();
  populateGroupFilter();
  populateTypeFilter();
  ensureEl<HTMLInputElement>("labelsSearch").value = filters.search;
  addLines();

  $("#labelsOverview").dialog({
    title: "Labels Overview",
    resizable: false,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" },
    close
  });
}

function renderDialog(): void {
  destroyDialogIfExists("labelsOverview");

  const html = /* html */ `<div id="labelsOverview" class="dialog stable">
    <div id="labelsHeader" class="header" style="grid-template-columns: 0.5em 12em 5em 8em 2em">
      <div></div>
      <div data-tip="Click to sort by label text" class="sortable alphabetically" data-sortby="text">Label&nbsp;</div>
      <div data-tip="Click to sort by label type" class="sortable alphabetically" data-sortby="type">Type&nbsp;</div>
      <div data-tip="Click to sort by label group" class="sortable alphabetically" data-sortby="group">Group&nbsp;</div>
    </div>
    <div id="labelsBody" class="table"></div>
    <div
      id="labelsFilters"
      style="display:grid; grid-template-columns:1fr 3fr; gap:.2em .4em; align-items:center; padding-top:.4em; width: 100%"
    >
      <label for="labelsFilterType" data-tip="Show only labels of the selected type">Type:</label>
      <select id="labelsFilterType" data-tip="Show only labels of the selected type"></select>
      <label for="labelsFilterGroup" data-tip="Show only labels of the selected group">Group:</label>
      <select id="labelsFilterGroup" data-tip="Show only labels of the selected group"></select>
      <label for="labelsSearch" data-tip="Show only labels containing the entered text">Search:</label>
      <input id="labelsSearch" type="search" data-tip="Show only labels containing the entered text" />
    </div>
    <div id="labelsBulkBar" style="display:none; gap:.4em; align-items:center; padding-top:.4em;">
      <button id="labelsSelectAll" data-tip="Select or deselect all listed labels" class="icon-check-empty"></button>
      <span data-tip="Number of selected labels">Selected: <span id="labelsSelectedCount">0</span></span>
      <select id="labelsBulkGroup" data-tip="Group to assign the selected labels to"></select>
      <button id="labelsBulkApply" data-tip="Assign all selected labels to the selected group" class="icon-check">Assign</button>
    </div>
    <div id="labelsFooter" class="totalLine">
      <div data-tip="Number of listed labels" style="margin-left: 4px">
        Labels:&nbsp;<span id="labelsFooterNumber">0</span>&nbsp;of&nbsp;<span id="labelsFooterTotal">0</span>
      </div>
    </div>
    <div id="labelsBottom">
      <button id="labelsOverviewRefresh" data-tip="Refresh the Overview screen" class="icon-cw"></button>
      <button
        id="labelsBulkToggle"
        data-tip="Bulk assignment: select multiple labels and assign them all to one group"
        class="icon-tags"
      ></button>
      <button id="labelsGroupsConfig" data-tip="Configure Label Groups" class="icon-cog"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  applySortingByHeader("labelsHeader");

  ensureEl("labelsBody").addEventListener("click", onBodyClick);
  ensureEl("labelsBody").addEventListener("change", onBodyChange);
  ensureEl("labelsFilterGroup").addEventListener("change", addLines);
  ensureEl("labelsFilterType").addEventListener("change", addLines);
  ensureEl("labelsSearch").addEventListener("input", addLines);
  ensureEl("labelsOverviewRefresh").addEventListener("click", refresh);
  ensureEl("labelsBulkToggle").addEventListener("click", toggleBulkMode);
  ensureEl("labelsGroupsConfig").addEventListener("click", () => void Controllers.LabelGroupsConfigurator.open());
  ensureEl("labelsSelectAll").addEventListener("click", toggleSelectAll);
  ensureEl("labelsBulkApply").addEventListener("click", applyBulkAssignment);
}

function close(): void {
  destroyDialogIfExists("labelsOverview");
}

function refresh(): void {
  populateGroupFilter();
  populateTypeFilter();
  addLines();
}

function populateTypeFilter(): void {
  const select = ensureEl<HTMLSelectElement>("labelsFilterType");
  select.options.length = 0;
  select.add(new Option("all", ALL));
  for (const type of DEFAULT_LABEL_TYPES) select.add(new Option(type, type));
  select.value = filters.type;
}

function populateGroupFilter(): void {
  const groups = options.labels.groups.map(({ name }) => name);

  const select = ensureEl<HTMLSelectElement>("labelsFilterGroup");
  select.options.length = 0;
  select.add(new Option("all", ALL));
  for (const name of groups) select.add(new Option(name, name));
  select.value = filters.group;

  const bulkSelect = ensureEl<HTMLSelectElement>("labelsBulkGroup");
  bulkSelect.options.length = 0;
  for (const name of groups) bulkSelect.add(new Option(name, name));
}

function addLines(): void {
  const allLabels = Object.values(labelDataAdapters).flatMap(adapter => adapter());
  let labels = allLabels;
  if (filters.group !== ALL) labels = labels.filter(({ group }) => group === filters.group);
  if (filters.type !== ALL) labels = labels.filter(({ type }) => type === filters.type);
  const search = filters.search.trim().toLowerCase();
  if (search) labels = labels.filter(({ text }) => text.toLowerCase().includes(search));

  ensureEl("labelsBody").innerHTML = labels.map(createLine).join("");
  ensureEl("labelsFooterNumber").innerHTML = String(labels.length);
  ensureEl("labelsFooterTotal").innerHTML = String(allLabels.length);

  updateSelectedCount();
  applySorting(ensureEl("labelsHeader"));
}

function createLine(label: LabelData): string {
  const { id, text, type, group } = label;

  return /* html */ `<div class="states" data-id="${id}" data-text="${text}" data-type="${type}" data-group="${group}">
      <input class="labelsSelect native" type="checkbox" data-tip="Select the label for bulk assignment" style="margin: 0; width: 1.2em; vertical-align: bottom; margin-bottom: 0.2em; ${isBulkMode ? "" : "display:none"}">
      <div data-tip="Label text" style="width:12em">${text}</div>
      <div data-tip="Label type" style="width:5em">${type}</div>
      <select class="labelsGroup" data-tip="Label group, select to reassign the label" style="width:7em">
        ${createGroupOptions(group)}
      </select>
      <span data-tip="Locate the label" class="icon-target pointer"></span>
    </div>`;
}

function createGroupOptions(selected: string): string {
  const defined = getDefinedGroups();
  const names = defined.includes(selected) ? defined : [selected, ...defined];

  return names
    .map(name => {
      const label = defined.includes(name) ? name : `${name} (missing)`;
      const isSelected = name === selected ? "selected" : "";
      return /* html */ `<option value="${name}" ${isSelected}>${label}</option>`;
    })
    .join("");
}

function onBodyClick(event: Event): void {
  const element = event.target as HTMLElement;
  const id = element.parentElement?.dataset.id;
  if (element.classList.contains("icon-target")) highlightLabel(element, id);
}

function onBodyChange(event: Event): void {
  const element = event.target as HTMLElement;
  if (element.classList.contains("labelsSelect")) return void updateSelectedCount();
  if (!(element instanceof HTMLSelectElement) || !element.classList.contains("labelsGroup")) return;

  const label = getLineLabel(element);
  if (label) assignGroup([label], element.value);
}

function getLineLabel(element: HTMLElement): LabelData | undefined {
  const id = (element.parentElement as HTMLElement).dataset.id;
  return id ? listedLabels.get(id) : undefined;
}

function highlightLabel(element: HTMLElement, id?: string): void {
  const labelEl = id && findEl(id);
  if (labelEl) highlightElement(labelEl, 2);
  else {
    const label = getLineLabel(element);
    if (label) zoomTo(...label.anchor, 6, 2000);
  }
}

function assignGroup(labels: LabelData[], groupName: string): void {
  const group = options.labels.groups.find(({ name }) => name === groupName);
  if (!group) return;

  const apply = () => {
    for (const { type, entityId } of labels) Labels.setGroup({ type, entityId, group: groupName });
    drawLabels();
    refresh();
    tip(`${labels.length} label(s) assigned to the "${groupName}" group`, false, "success", 4000);
  };

  const crossTyped = labels.filter(({ type }) => type !== group.type);
  if (!crossTyped.length) return void apply();

  const message =
    labels.length === 1
      ? `Assign this ${labels[0].type} label to the ${group.type} group "${groupName}"? It's better to avoid such cross-type assignment`
      : `${crossTyped.length} of ${labels.length} selected labels are not of the ${group.type} type. Assign them all to the ${group.type} group "${groupName}" anyway? It's better to avoid such cross-type assignment`;

  confirmationDialog({
    title: "Assign cross-type Label Group",
    message,
    confirm: "Assign",
    onConfirm: apply,
    onCancel: addLines // re-render to restore the group shown in the line
  });
}

function toggleBulkMode(): void {
  isBulkMode = !isBulkMode;
  ensureEl("labelsBulkToggle").classList.toggle("pressed", isBulkMode);
  ensureEl("labelsBulkBar").style.display = isBulkMode ? "flex" : "none";

  for (const checkbox of getCheckboxes()) {
    checkbox.style.display = isBulkMode ? "" : "none";
    checkbox.checked = false;
  }
  updateSelectedCount();
}

function getCheckboxes(): HTMLInputElement[] {
  return Array.from(ensureEl("labelsBody").querySelectorAll<HTMLInputElement>("input.labelsSelect"));
}

function getSelectedLabels(): LabelData[] {
  const selected: LabelData[] = [];
  for (const checkbox of getCheckboxes()) {
    if (!checkbox.checked) continue;
    const label = getLineLabel(checkbox);
    if (label) selected.push(label);
  }
  return selected;
}

function updateSelectedCount(): void {
  const count = getCheckboxes().filter(checkbox => checkbox.checked).length;
  ensureEl("labelsSelectedCount").innerHTML = String(count);
}

function toggleSelectAll(): void {
  const checkboxes = getCheckboxes();
  const shouldSelectAll = !checkboxes.every(checkbox => checkbox.checked);
  for (const checkbox of checkboxes) checkbox.checked = shouldSelectAll;
  updateSelectedCount();
}

function applyBulkAssignment(): void {
  const labels = getSelectedLabels();
  if (!labels.length) return void tip("Select at least one label", false, "error");

  const group = ensureEl<HTMLSelectElement>("labelsBulkGroup").value;
  if (group === ALL) return void tip("Select the group to assign the labels to", false, "error");

  assignGroup(labels, group);
}

export const LabelsOverview = { open };
