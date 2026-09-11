import { select } from "d3";
import { closeDialogs, destroyDialog, updateDialog } from "@/components/dialog/dialog-helpers";
import { applyLineHighlighting } from "@/components/dialog/highlighting";
import { bindColumnSorting, sortDataByColumns } from "@/components/dialog/sorting";
import { dialogState } from "@/components/dialog/state";
import {
  type EditorColumn,
  getRowId,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/components/dialog/table";
import { Layers } from "@/components/layers";
import { Notes } from "@/components/notes";
import { Controllers } from "@/controllers";
import { type Feature, type FeatureType, ISLAND_SUBTYPES, LAKE_SUBTYPES } from "@/generators/features";
import { highlightArea, highlightOutline } from "@/renderers/overlays/highlight";
import { downloadFile, ensureEl, findEl, getArea, getAreaUnit, getFileName, si } from "@/utils";

const dialogId = "featuresOverview" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
let filterState: { search: string; type: string; subtype: string };

const TYPES: FeatureType[] = ["island", "lake", "ocean"];
const SUBTYPES: Record<FeatureType, readonly string[]> = {
  island: ISLAND_SUBTYPES,
  lake: LAKE_SUBTYPES,
  ocean: []
};

const getName = (feature: Feature) => feature.name || `${feature.subtype || feature.type} ${feature.i}`;

// an ocean's perimeter ring is open at the map border, so its polygon area collapses to 0
let oceanAreas = new Map<number, number>();
function measureOceans(): void {
  oceanAreas = new Map();
  const oceans = new Set(pack.features.filter(feature => feature?.type === "ocean").map(feature => feature.i));
  if (!oceans.size) return;

  for (let cellId = 0; cellId < pack.cells.i.length; cellId++) {
    const featureId = pack.cells.f[cellId];
    if (oceans.has(featureId)) oceanAreas.set(featureId, (oceanAreas.get(featureId) ?? 0) + pack.cells.area[cellId]);
  }
}

const getFeatureArea = (feature: Feature) => feature.area || oceanAreas.get(feature.i) || 0;
const getLakeGroups = () => Array.from(Layers.get("lakes").getEl().children).map(group => group.id);

const columns: EditorColumn<Feature>[] = [
  { key: "locate", width: "1.4em", permanent: true },
  { key: "name", label: "Feature", width: "9em", permanent: true, sortBy: getName, sortType: "alpha" },
  { key: "type", label: "Type", width: "5em", sortBy: feature => feature.type, sortType: "alpha" },
  { key: "subtype", label: "Subtype", width: "8em", sortBy: feature => feature.subtype || "", sortType: "alpha" },
  {
    key: "group",
    label: "Group",
    width: "8em",
    mobileHidden: true,
    tip: "Click to sort by rendering group (the svg group the feature is drawn in)",
    sortBy: feature => feature.group || "",
    sortType: "alpha"
  },
  { key: "area", label: "Area", width: "7em", sortBy: getFeatureArea, defaultSort: "desc" },
  { key: "note", width: "1.1em" },
  { key: "edit", width: "1.1em" }
];

function getFilteredFeatures(): Feature[] {
  const search = filterState.search.toLowerCase().trim();

  return pack.features.filter((feature: Feature) => {
    if (!feature?.i) return false;
    if (filterState.type !== "all" && feature.type !== filterState.type) return false;
    if (filterState.subtype !== "all" && feature.subtype !== filterState.subtype) return false;
    if (!search) return true;
    return [getName(feature), feature.type, feature.subtype].some(value => value?.toLowerCase().includes(search));
  });
}

const featuresTable = initEditorTable<Feature>({
  getData: () => sortDataByColumns(dialogId, getFilteredFeatures(), columns),
  onUpdate: renderFeaturesPage
});

function open(): void {
  if (customization) return;
  filterState = dialogState.get(dialogId, "filters", () => ({ search: "", type: "all", subtype: "all" }));
  closeDialogs(`#${dialogId}, .stable`);

  renderDialog();
  measureOceans();
  updateSubtypeFilter();
  featuresTable.reset();

  $(`#${dialogId}`).dialog({
    title: "Geographical Features Overview",
    resizable: false,
    width: "fit-content",
    position,
    close: closeFeaturesOverview
  });
}

function renderDialog(): void {
  destroyDialog(dialogId);

  const html = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
    <div id="featuresBody" class="table">${renderEditorHeader({ dialogId, columns })}</div>
    <div id="featuresFilters" class="editorFilters">
      <label for="featuresSearch" data-tip="Filter by name, type or subtype">Search: <input id="featuresSearch" type="search" /></label>
      <label for="featuresFilterType">Type:
        <select id="featuresFilterType">
          <option value="all">all</option>
          ${TYPES.map(type => `<option value="${type}">${type}</option>`).join("")}
        </select>
      </label>
      <label for="featuresFilterSubtype">Subtype: <select id="featuresFilterSubtype"></select></label>
    </div>
    <div id="featuresFooter" class="totalLine">
      <div data-tip="Features displayed" style="margin-left: 4px">Features:&nbsp;<span id="featuresFooterNumber">0</span></div>
      <div data-tip="Total area of the displayed features" style="margin-left: 12px" data-col="area">Area:&nbsp;<span id="featuresFooterArea">0</span></div>
    </div>
    <div id="featuresBottom" class="editorToolbar">
      <button id="featuresOverviewRefresh" data-tip="Refresh the Overview" class="icon-cw"></button>
      <button id="featuresHeightmapEditor" data-tip="Features are added and removed in the Heightmap Editor" class="icon-brush"></button>
      <button id="featuresExport" data-tip="Save features-related data as a text file (.csv)" class="icon-download"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl<HTMLInputElement>("featuresSearch").value = filterState.search;
  ensureEl<HTMLSelectElement>("featuresFilterType").value = filterState.type;
  bindColumnSorting(dialogId, featuresTable.reset);
  applyLineHighlighting(dialogId, ({ cellId }) => pack.cells.f[cellId] || undefined);

  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });

  ensureEl("featuresOverviewRefresh").addEventListener("click", refreshOverview);
  ensureEl("featuresHeightmapEditor").addEventListener("click", () => void Controllers.HeightmapEditor.open());
  ensureEl("featuresExport").addEventListener("click", downloadFeaturesData);
  ensureEl("featuresSearch").addEventListener("input", onFilterChange);
  ensureEl("featuresFilterType").addEventListener("change", onTypeFilterChange);
  ensureEl("featuresFilterSubtype").addEventListener("change", onFilterChange);
}

function closeFeaturesOverview(): void {
  destroyDialog(dialogId);
  const view = featuresTable.view();
  view.rows = [];
  view.all = [];
}

function refreshOverview(): void {
  measureOceans();
  updateSubtypeFilter();
  featuresTable.reset();
}

/** Subtype options follow the selected type; "all" offers every subtype */
function updateSubtypeFilter(): void {
  const subtypes =
    filterState.type === "all" ? [...ISLAND_SUBTYPES, ...LAKE_SUBTYPES] : SUBTYPES[filterState.type as FeatureType];
  if (!subtypes.includes(filterState.subtype)) filterState.subtype = "all";

  const filter = ensureEl<HTMLSelectElement>("featuresFilterSubtype");
  filter.options.length = 0;
  filter.options.add(new Option("all", "all", false, filterState.subtype === "all"));
  for (const subtype of subtypes) {
    filter.options.add(new Option(subtype, subtype, false, subtype === filterState.subtype));
  }
  filter.disabled = subtypes.length === 0;
}

function onTypeFilterChange(this: HTMLSelectElement): void {
  filterState.type = this.value;
  updateSubtypeFilter();
  onFilterChange();
}

function onFilterChange(): void {
  filterState.search = ensureEl<HTMLInputElement>("featuresSearch").value;
  filterState.subtype = ensureEl<HTMLSelectElement>("featuresFilterSubtype").value;
  dialogState.set(dialogId, "filters", filterState);
  featuresTable.reset();
}

// islands are moved between groups by geography alone, oceans are not rendered at all
function renderGroupCell(feature: Feature, lakeGroups: string[]): string {
  if (feature.type !== "lake") return `<div data-tip="Rendering group" data-col="group">${feature.group || "—"}</div>`;

  const groups = lakeGroups.includes(feature.group) ? lakeGroups : [...lakeGroups, feature.group]; // a removed group is still the feature's
  const options = groups
    .map(group => `<option value="${group}" ${group === feature.group ? "selected" : ""}>${group}</option>`)
    .join("");
  return `<select data-tip="Rendering group: the svg group the lake is drawn in. Create groups in the Lake Editor" class="featureGroup" data-col="group">${options}</select>`;
}

// the subtype set is fixed per type; lake_island is geographic, so it stays put
function renderSubtypeCell(feature: Feature): string {
  const subtypes = SUBTYPES[feature.type];
  const fixed = !subtypes.length || feature.subtype === "lake_island";
  if (fixed) return `<div data-tip="Feature subtype" data-col="subtype">${feature.subtype || "—"}</div>`;

  const options = subtypes
    .filter(subtype => subtype !== "lake_island")
    .map(subtype => `<option value="${subtype}" ${subtype === feature.subtype ? "selected" : ""}>${subtype}</option>`)
    .join("");
  return `<select data-tip="Feature subtype. Generators read it, changing it does not regenerate them" class="featureSubtype" data-col="subtype">${options}</select>`;
}

function renderFeaturesPage(view: TableView<Feature>): void {
  const body = ensureEl("featuresBody");
  body.querySelectorAll(":scope > .states").forEach(row => {
    row.remove();
  });

  const unit = getAreaUnit();
  const lakeGroups = getLakeGroups();
  let lines = "";

  for (const feature of view.rows) {
    const locatable = feature.type !== "ocean";
    lines += /* html */ `<div class="states" data-id="${feature.i}">
      <span data-tip="Locate the feature" data-col="locate" class="${locatable ? "icon-target" : "placeholder"}"></span>
      <input data-tip="Feature name. Clear it to fall back to the placeholder name" class="featureName stateName" value="${getName(feature)}" data-col="name" />
      <div data-tip="Feature type, defined by the heightmap" data-col="type">${feature.type}</div>
      ${renderSubtypeCell(feature)}
      ${renderGroupCell(feature, lakeGroups)}
      <div data-tip="Feature area" data-col="area">${si(getArea(getFeatureArea(feature)))} ${unit}</div>
      ${Notes.getIcon("this feature")}
      <span data-tip="${feature.type === "lake" ? "Edit the lake" : "Only lakes have their own editor"}" data-col="edit" class="${feature.type === "lake" ? "icon-pencil" : "placeholder"}"></span>
    </div>`;
  }
  body.insertAdjacentHTML("beforeend", lines);

  ensureEl("featuresFooterNumber").innerHTML = `${view.all.length} of ${pack.features.length - 1}`;
  const totalArea = view.all.reduce((sum, feature) => sum + getFeatureArea(feature), 0);
  ensureEl("featuresFooterArea").innerHTML = `${si(getArea(totalArea))} ${unit}`;

  for (const line of Array.from(body.querySelectorAll<HTMLElement>(":scope > div.states"))) {
    line.addEventListener("mouseenter", featureHighlightOn);
    line.addEventListener("mouseleave", featureHighlightOff);
  }
  body.querySelectorAll("div > span.icon-target").forEach(el => void el.addEventListener("click", zoomToFeature));
  body.querySelectorAll("div > input.featureName").forEach(el => void el.addEventListener("input", changeName));
  body.querySelectorAll("div > select.featureSubtype").forEach(el => void el.addEventListener("change", changeSubtype));
  body.querySelectorAll("div > select.featureGroup").forEach(el => void el.addEventListener("change", changeGroup));
  body.querySelectorAll("div > span.icon-book").forEach(el => void el.addEventListener("click", editNote));
  body.querySelectorAll("div > span.icon-pencil").forEach(el => void el.addEventListener("click", openLakeEditor));

  renderEditorPagination(ensureEl("featuresFooter"), view, featuresTable.goto);
}

const getFeature = (element: HTMLElement): Feature => pack.features[getRowId(element)];
const getFeaturePath = (featureId: number) => findEl(`feature_${featureId}`)?.getAttribute("d") ?? null;

function featureHighlightOn(this: HTMLElement): void {
  const feature = getFeature(this);
  if (feature?.type !== "ocean") highlightOutline(getFeaturePath(feature.i)); // oceans are not drawn
}

function featureHighlightOff(): void {
  select("#debug")
    .selectAll<SVGPathElement, unknown>(".highlight")
    .transition()
    .duration(1000)
    .attr("opacity", 0)
    .remove();
}

function zoomToFeature(this: HTMLElement): void {
  const feature = getFeature(this);
  const points = feature.vertices.map(vertex => pack.vertices.p[vertex]).filter(Boolean);
  if (!points.length) return;

  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  highlightArea({ x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }, 3);
}

function changeName(this: HTMLInputElement): void {
  const feature = getFeature(this);
  const name = this.value.trim();
  feature.name = name === `${feature.subtype || feature.type} ${feature.i}` ? "" : name; // keep the placeholder as a placeholder
}

function changeSubtype(this: HTMLSelectElement): void {
  getFeature(this).subtype = this.value; // no cascade: generators pick it up on the next run
}

function changeGroup(this: HTMLSelectElement): void {
  getFeature(this).group = this.value;
  Layers.draw("lakes");
}

function editNote(this: HTMLElement): void {
  void Controllers.NotesEditor.open({ type: "feature", id: getRowId(this) });
}

function openLakeEditor(this: HTMLElement): void {
  const element = findEl("lakes")?.querySelector<SVGElement>(`use[data-f="${getRowId(this)}"]`);
  if (element) void Controllers.LakesEditor.open(element);
}

function downloadFeaturesData(): void {
  const unit = getAreaUnit();
  let data = `Id,Name,Type,Subtype,Group,Area (${unit})\n`;

  for (const feature of featuresTable.view().all) {
    const cells = [
      feature.i,
      getName(feature),
      feature.type,
      feature.subtype,
      feature.group,
      getArea(getFeatureArea(feature))
    ];
    data += `${cells.join(",")}\n`;
  }

  downloadFile(data, `${getFileName("Features")}.csv`);
}

export const FeaturesOverview = { open, refresh: () => featuresTable.refresh() };
