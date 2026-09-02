import { closeDialogs, confirmationDialog, destroyDialog, updateDialog } from "@/components/dialog/dialog-helpers";
import { bindColumnSorting, sortDataByColumns } from "@/components/dialog/sorting";
import { dialogState } from "@/components/dialog/state";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/components/dialog/table";
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { calculateLabelSpread, type LabelSpreadPatch } from "@/controllers/label-spread";
import { LABEL_TYPES, type Label, type LabelType } from "@/generators/labels-generator";
import { getLabelsData } from "@/renderers/labels/label-data";
import type { LabelData } from "@/renderers/labels/labels";
import { highlightElement } from "@/renderers/overlays/highlight";
import { ensureEl, findEl } from "@/utils";

const dialogId = "labelsOverview" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
const ALL = "";
let filterState: { group: string; type: string; search: string };

const columns: EditorColumn<LabelData>[] = [
  { key: "selection", width: "1.5em", permanent: true },
  {
    key: "text",
    label: "Text",
    width: "12em",
    permanent: true,
    sortBy: label => label.text,
    sortType: "alpha"
  },
  {
    key: "type",
    label: "Type",
    width: "6em",
    sortBy: label => label.type,
    sortType: "alpha"
  },
  {
    key: "group",
    label: "Group",
    width: "8em",
    sortBy: label => label.group,
    sortType: "alpha"
  },
  { key: "actions", width: "3.4em", permanent: true, align: "right" }
];

const listedLabels = new Map<string, LabelData>(); // currently listed labels, keyed by line id
let isBulkMode = false;
const spreadPreview: SpreadPreviewState = { phase: "idle", run: 0, snapshot: null };
let totalLabels = 0;

const labelsTable = initEditorTable<LabelData>({
  getData: getFilteredLabels,
  onUpdate: renderLabelsPage
});

function open(group: string = ALL): void {
  if (customization) return;
  filterState = dialogState.get(dialogId, "filters", () => ({ group: ALL, type: ALL, search: ALL }));
  closeDialogs(`#${dialogId}, .stable`);
  Layers.show("labels");

  isBulkMode = false;
  resetSpreadPreview();
  if (group) filterState.group = group;
  dialogState.set(dialogId, "filters", filterState);

  renderDialog();
  populateGroupFilter();
  populateTypeFilter();
  ensureEl<HTMLInputElement>("labelsSearch").value = filterState.search;
  labelsTable.reset();

  $(`#${dialogId}`).dialog({
    title: "Labels Overview",
    resizable: false,
    position,
    close
  });
}

function renderDialog(): void {
  destroyDialog(dialogId);

  const html = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
    ${renderEditorHeader({ dialogId, columns })}
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
      <button
        id="labelsSpread"
        data-tip="Spread currently displayed labels to not collide"
        class="icon-resize-full"></button>
      <span id="labelsSpreadReview" style="display:none">
        <button id="labelsSpreadApply" data-tip="Keep the proposed label placement" class="icon-check"> Apply</button>
        <button id="labelsSpreadCancel" data-tip="Restore label placement from before the spread" class="icon-cancel"> Cancel</button>
      </span>
      <button id="labelsGroupsConfig" data-tip="Configure Label Groups" class="icon-cog"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  bindColumnSorting(dialogId, labelsTable.reset);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });

  ensureEl("labelsBody").addEventListener("click", onBodyClick);
  ensureEl("labelsBody").addEventListener("change", onBodyChange);
  ensureEl("labelsFilterGroup").addEventListener("change", onFilterChange);
  ensureEl("labelsFilterType").addEventListener("change", onFilterChange);
  ensureEl("labelsSearch").addEventListener("input", onSearchInput);
  ensureEl("labelsOverviewRefresh").addEventListener("click", refresh);
  ensureEl("labelsBulkToggle").addEventListener("click", toggleBulkMode);
  ensureEl("labelsSpread").addEventListener("click", () => void spreadLabels());
  ensureEl("labelsSpreadApply").addEventListener("click", applySpread);
  ensureEl("labelsSpreadCancel").addEventListener("click", cancelSpread);
  ensureEl("labelsGroupsConfig").addEventListener("click", () => void Controllers.LabelGroupsConfigurator.open());
  ensureEl("labelsSelectAll").addEventListener("click", toggleSelectAll);
  ensureEl("labelsBulkApply").addEventListener("click", applyBulkAssignment);
}

function close(): void {
  clearTimeout(searchTimeout);
  cancelSpread();
  destroyDialog(dialogId);
}

function refresh(): void {
  populateGroupFilter();
  populateTypeFilter();
  labelsTable.refresh();
}

// re-listing thousands of labels on every keystroke is slow, so the search is applied once typing settles
const SEARCH_DELAY = 250;
let searchTimeout = 0;

function onSearchInput(): void {
  clearTimeout(searchTimeout);
  filterState.search = ensureEl<HTMLInputElement>("labelsSearch").value;
  dialogState.set(dialogId, "filters", filterState);
  searchTimeout = window.setTimeout(labelsTable.reset, SEARCH_DELAY);
}

function onFilterChange(): void {
  filterState.type = ensureEl<HTMLSelectElement>("labelsFilterType").value;
  filterState.group = ensureEl<HTMLSelectElement>("labelsFilterGroup").value;
  filterState.search = ensureEl<HTMLInputElement>("labelsSearch").value;
  dialogState.set(dialogId, "filters", filterState);
  labelsTable.reset();
}

function populateTypeFilter(): void {
  const select = ensureEl<HTMLSelectElement>("labelsFilterType");
  select.options.length = 0;
  select.add(new Option("all", ALL));
  for (const type of LABEL_TYPES) select.add(new Option(type, type));
  select.value = filterState.type;
}

function populateGroupFilter(): void {
  const groups = options.labels.groups.map(({ name }) => name);

  const select = ensureEl<HTMLSelectElement>("labelsFilterGroup");
  select.options.length = 0;
  select.add(new Option("all", ALL));
  for (const name of groups) select.add(new Option(name, name));
  if (filterState.group !== ALL && !groups.includes(filterState.group))
    select.add(new Option(`${filterState.group} (missing)`, filterState.group));

  select.value = filterState.group;

  // keep the bulk target selected across refreshes, it resets to none if that group is gone
  const bulkSelect = ensureEl<HTMLSelectElement>("labelsBulkGroup");
  const bulkSelected = bulkSelect.value;
  bulkSelect.options.length = 0;
  bulkSelect.add(new Option("select group", ALL));
  for (const name of groups) bulkSelect.add(new Option(name, name));
  if (groups.includes(bulkSelected)) bulkSelect.value = bulkSelected;
}

function getFilteredLabels(): LabelData[] {
  const allLabels = getLabelsData();
  totalLabels = allLabels.length;
  let labels = allLabels;
  if (filterState.group !== ALL) labels = labels.filter(({ group }) => group === filterState.group);
  if (filterState.type !== ALL) labels = labels.filter(({ type }) => type === filterState.type);
  const search = filterState.search.trim().toLowerCase();
  if (search) labels = labels.filter(({ text }) => text.replaceAll("|", "").toLowerCase().includes(search));

  return sortDataByColumns(dialogId, labels, columns);
}

function renderLabelsPage(view: TableView<LabelData>): void {
  const { rows, all } = view;

  listedLabels.clear();
  for (const label of rows) listedLabels.set(label.id, label);

  ensureEl("labelsBody").innerHTML = rows.map(createLine).join("");
  ensureEl("labelsFooterNumber").innerHTML = String(all.length);
  ensureEl("labelsFooterTotal").innerHTML = String(totalLabels);
  renderEditorPagination(ensureEl("labelsFooter"), view, labelsTable.goto);

  updateSelectedCount();
  updateDialog(dialogId, { width: "fit-content", position });
}

function createLine(label: LabelData): string {
  const { id, type, group, hidden } = label;
  const text = label.text.replaceAll("|", "");
  const hasOverride = Labels.hasOverride(type, label.entityId);

  return /* html */ `<div class="states" data-id="${id}" data-text="${text}" data-type="${type}" data-group="${group}" style="${hidden ? "opacity: 0.5" : ""}">
      <div data-col="selection"><input class="labelsSelect native" type="checkbox" data-tip="Select the label for bulk assignment" style="margin: 0; width: 1.2em; vertical-align: bottom; margin-bottom: 0.2em; ${isBulkMode ? "" : "display:none"}"></div>
      <div data-col="text" data-tip="Label text">${text}</div>
      <div data-col="type" data-tip="Label type">${type}</div>
      <select data-col="group" class="labelsGroup" data-tip="Label group, select to reassign the label">
        ${createGroupOptions(group)}
      </select>
      <div data-col="actions">
        <span data-tip="${hidden ? "Show" : "Hide"} the label" aria-label="${hidden ? "Show" : "Hide"} the label" class="icon-eye${hidden ? "-off" : ""} labelsVisibility"></span>
        <span data-tip="Restore the default label" aria-label="Restore the default label" class="icon-arrows-cw labelsReset ${hasOverride ? "" : " inactive"}"></span>
        <span data-tip="Locate the label" aria-label="Locate the label" class="icon-target"></span>
      </div>
    </div>`;
}

function createGroupOptions(selected: string): string {
  const groups = options.labels.groups.map(({ name }) => name);
  const names = groups.includes(selected) ? groups : [selected, ...groups];

  return names
    .map(name => {
      const label = groups.includes(name) ? name : `${name} (missing)`;
      const isSelected = name === selected ? "selected" : "";
      return /* html */ `<option value="${name}" ${isSelected}>${label}</option>`;
    })
    .join("");
}

function onBodyClick(event: Event): void {
  const element = event.target as HTMLElement;
  const id = element.closest<HTMLElement>(".states")?.dataset.id;
  if (element.classList.contains("labelsVisibility")) toggleLabelVisibility(element);
  else if (element.classList.contains("labelsReset")) resetLabel(element);
  else if (element.classList.contains("icon-target")) highlightLabel(element, id);
}

function onBodyChange(event: Event): void {
  const element = event.target as HTMLElement;
  if (element.classList.contains("labelsSelect")) return void updateSelectedCount();
  if (!(element instanceof HTMLSelectElement) || !element.classList.contains("labelsGroup")) return;

  const label = getLineLabel(element);
  if (label) assignGroup([label], element.value);
}

function getLineLabel(element: HTMLElement): LabelData | undefined {
  const id = element.closest<HTMLElement>(".states")?.dataset.id;
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

function toggleLabelVisibility(element: HTMLElement): void {
  const label = getLineLabel(element);
  if (!label) return;

  const entity = Labels.getEntity(label.type, label.entityId);
  if (!entity) return;

  if (entity.label?.hidden) delete entity.label.hidden;
  else entity.label = { ...entity.label, hidden: true };

  Layers.draw("labels");
  labelsTable.refresh();
}

function resetLabel(element: HTMLElement): void {
  const label = getLineLabel(element);
  if (!label) return;

  const hasOverride = Labels.hasOverride(label.type, label.entityId);
  if (!hasOverride) return;

  Labels.resetOverride(label.type, label.entityId);
  Layers.draw("labels");
  labelsTable.refresh();
}

function assignGroup(labels: LabelData[], groupName: string): void {
  const group = options.labels.groups.find(({ name }) => name === groupName);
  if (!group) return;

  const apply = () => {
    for (const { type, entityId } of labels) Labels.setGroup({ type, entityId, group: groupName });
    Layers.draw("labels");
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
    onCancel: labelsTable.refresh // re-render to restore the group shown in the line
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
  if (group === ALL) return void tip("Define a label group to assign the labels to", false, "error");

  assignGroup(labels, group);
}

async function spreadLabels(): Promise<void> {
  if (spreadPreview.phase !== "idle") return;
  spreadPreview.snapshot = takeLabelSnapshot();
  spreadPreview.phase = "running";
  const run = ++spreadPreview.run;
  syncSpreadControls();

  try {
    const result = await calculateLabelSpread();
    if (run !== spreadPreview.run) return;

    if (!result.patches.length) {
      finishSpreadPreview();
      syncSpreadControls();
      return;
    }

    applySpreadPatches(result.patches);
    Layers.draw("labels");
    labelsTable.refresh();
    spreadPreview.phase = "review";
    syncSpreadControls();
  } catch (error) {
    if (run !== spreadPreview.run) return;
    restoreLabelSnapshot();
    finishSpreadPreview();
    Layers.draw("labels");
    syncSpreadControls();
    ERROR && console.error(error);
  }
}

function applySpread(): void {
  if (spreadPreview.phase !== "review" || !spreadPreview.snapshot) return;
  finishSpreadPreview();
  syncSpreadControls();
}

function cancelSpread(): void {
  if (!spreadPreview.snapshot) return;
  spreadPreview.run++;
  restoreLabelSnapshot();
  finishSpreadPreview();
  Layers.draw("labels");
  if (document.getElementById("labelsOverview")) {
    labelsTable.refresh();
    syncSpreadControls();
  }
}

function takeLabelSnapshot(): LabelSnapshot[] {
  return getLabelsData().map(({ type, entityId }) => {
    const label = Labels.getEntity(type, entityId)?.label;
    return { type, entityId, label: label === undefined ? undefined : structuredClone(label) };
  });
}

function restoreLabelSnapshot(): void {
  if (!spreadPreview.snapshot) return;
  for (const snapshot of spreadPreview.snapshot) {
    const entity = Labels.getEntity(snapshot.type, snapshot.entityId);
    if (!entity) continue;
    if (snapshot.label === undefined) delete entity.label;
    else entity.label = structuredClone(snapshot.label);
  }
}

function applySpreadPatches(patches: LabelSpreadPatch[]): void {
  for (const patch of patches) {
    const entity = Labels.getEntity(patch.type, patch.entityId);
    if (!entity) continue;
    const label = { ...entity.label };
    if ("startOffset" in patch) label.startOffset = patch.startOffset;
    else {
      if (patch.dx !== undefined) label.dx = patch.dx;
      if (patch.dy !== undefined) label.dy = patch.dy;
    }
    entity.label = label;
  }
}

function resetSpreadPreview(): void {
  spreadPreview.run++;
  finishSpreadPreview();
}

function finishSpreadPreview(): void {
  spreadPreview.phase = "idle";
  spreadPreview.snapshot = null;
}

function syncSpreadControls(): void {
  const dialog = document.getElementById("labelsOverview");
  if (!dialog) return;
  const isRunning = spreadPreview.phase === "running";
  const isReview = spreadPreview.phase === "review";
  ensureEl("labelsSpreadReview").style.display = isReview ? "inline" : "none";
  ensureEl<HTMLButtonElement>("labelsSpread").style.display = isReview ? "none" : "";

  const locked = spreadPreview.phase !== "idle";
  for (const control of dialog.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>(
    "button, input, select"
  )) {
    if (control.id === "labelsSpreadApply" || control.id === "labelsSpreadCancel") control.disabled = isRunning;
    else control.disabled = locked;
  }
}

interface LabelSnapshot {
  type: LabelType;
  entityId: number;
  label?: Label;
}

interface SpreadPreviewState {
  phase: "idle" | "running" | "review";
  run: number;
  snapshot: LabelSnapshot[] | null;
}

export const LabelsOverview = { open };
