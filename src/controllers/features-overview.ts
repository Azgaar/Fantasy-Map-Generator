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
import {
  capitalize,
  downloadFile,
  ensureEl,
  findEl,
  getArea,
  getAreaUnit,
  getFileName,
  getVertexPath,
  si
} from "@/utils";

const dialogId = "featuresOverview" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
let filterState: { search: string; type: string; subtype: string };

const columns: EditorColumn<Feature>[] = [
  { key: "locate", width: "1.4em", permanent: true },
  { key: "name", label: "Feature", width: "9em", permanent: true, sortBy: getName, sortType: "alpha" },
  { key: "type", label: "Type", width: "9em", sortBy: getTypeLabel, sortType: "alpha" },
  {
    key: "group",
    label: "Group",
    width: "8em",
    mobileHidden: true,
    tip: "Click to sort by rendering group (the group the feature is drawn in)",
    sortBy: feature => feature.group || "",
    sortType: "alpha"
  },
  { key: "area", label: "Area", width: "6em", sortBy: getCalculatedArea, defaultSort: "desc" },
  { key: "edit", width: "1.4em" },
  { key: "coastline", width: "1.4em" },
  { key: "note", width: "1.4em", permanent: true }
];

const TYPES: FeatureType[] = ["island", "lake", "ocean"];
const SUBTYPES: Record<FeatureType, readonly string[]> = { island: ISLAND_SUBTYPES, lake: LAKE_SUBTYPES, ocean: [] };

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

const UNNAMED = "Unnamed";
function getName(feature: Feature) {
  return feature.name || UNNAMED;
}

/** area inside the map borders */
function getMapArea(feature: Feature) {
  return feature.area || oceanAreas.get(feature.i) || 0;
}

// a feature cut by the map border continues beyond it: assume it keeps its share of the map over the whole globe
function getCalculatedArea(feature: Feature) {
  const mapArea = getMapArea(feature);
  return feature.border ? mapArea / getGlobeCoverage() : mapArea;
}

const getGlobeCoverage = () => options.map.geography.mapSize / 100;

function renderAreaCell(feature: Feature, unit: string): string {
  const area = `${si(getArea(getCalculatedArea(feature)))} ${unit}`;
  const estimated = feature.border && getGlobeCoverage() < 1;
  if (!estimated) return `<div data-tip="Feature area" data-col="area">${area}</div>`;

  const mapArea = `${si(getArea(getMapArea(feature)))} ${unit}`;
  const tip = `Estimated area: the feature goes beyond the map border, its area on the map is ${mapArea}`;
  return `<div data-tip="${tip}" data-col="area">~${area}</div>`;
}

function getLakeGroups() {
  return Array.from(Layers.get("lakes").getEl().children).map(group => group.id);
}

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
  const brush = feature.group
    ? `<span data-tip="Edit group style in Style Editor" class="icon-brush pointer featureGroupStyle"></span>`
    : "";
  if (feature.type !== "lake")
    return `<div data-tip="Rendering group" data-col="group">${brush}<span>${feature.group || ""}</span></div>`;

  const groups = lakeGroups.includes(feature.group) ? lakeGroups : [...lakeGroups, feature.group]; // a removed group is still the feature's
  const options = groups
    .map(group => `<option value="${group}" ${group === feature.group ? "selected" : ""}>${group}</option>`)
    .join("");
  return `<div data-col="group">${brush}<select data-tip="Rendering group: the svg group the lake is drawn in. Create groups in the Lake Editor" class="featureGroup">${options}</select></div>`;
}

// "Freshwater lake", "Isle", "Lake island", "Ocean"
function getTypeLabel(feature: Pick<Feature, "type" | "subtype">): string {
  const subtype = feature.subtype?.replace("_", " ");
  if (feature.type === "lake") return capitalize(`${subtype} ${feature.type}`);
  return capitalize(subtype || feature.type);
}

// the subtype set is fixed per type; lake_island is geographic, so it stays put
function renderTypeCell(feature: Feature): string {
  const subtypes = SUBTYPES[feature.type];
  const fixed = !subtypes.length || feature.subtype === "lake_island";
  if (fixed)
    return `<div data-tip="Feature type, defined by the heightmap" data-col="type">${getTypeLabel(feature)}</div>`;

  const options = subtypes
    .filter(subtype => subtype !== "lake_island")
    .map(subtype => {
      const label = getTypeLabel({ type: feature.type, subtype });
      return `<option value="${subtype}" ${subtype === feature.subtype ? "selected" : ""}>${label}</option>`;
    })
    .join("");
  return `<select data-tip="Feature type. Generators read it, changing it does not regenerate them" class="featureSubtype" data-col="type">${options}</select>`;
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
      <input data-tip="Feature name" class="featureName stateName" value="${feature.name || ""}" placeholder="${UNNAMED}" data-col="name" />
      ${renderTypeCell(feature)}
      ${renderGroupCell(feature, lakeGroups)}
      ${renderAreaCell(feature, unit)}
      <span data-tip="${feature.type === "lake" && "Edit the lake"}" data-col="edit" class="${feature.type === "lake" ? "icon-pencil" : "placeholder"}"></span>
      ${
        feature.type === "ocean"
          ? `<span data-col="coastline" class="placeholder"></span>`
          : `<span data-tip="Edit the feature's own coastline settings" data-col="coastline" class="icon-draw-polygon pointer featureCoastline" style="${feature.coastline ? "" : "opacity:.7"}"></span>`
      }
      ${Notes.getIcon("this feature")}
    </div>`;
  }
  body.insertAdjacentHTML("beforeend", lines);

  ensureEl("featuresFooterNumber").innerHTML = `${view.all.length} of ${pack.features.length - 1}`;
  const totalArea = view.all.reduce((sum, feature) => sum + getCalculatedArea(feature), 0);
  ensureEl("featuresFooterArea").innerHTML = `${si(getArea(totalArea))} ${unit}`;

  for (const line of Array.from(body.querySelectorAll<HTMLElement>(":scope > div.states"))) {
    line.addEventListener("mouseenter", featureHighlightOn);
    line.addEventListener("mouseleave", featureHighlightOff);
  }
  body.querySelectorAll("div > span.icon-target").forEach(el => void el.addEventListener("click", zoomToFeature));
  body.querySelectorAll("div > input.featureName").forEach(el => void el.addEventListener("input", changeName));
  body.querySelectorAll("div > select.featureSubtype").forEach(el => void el.addEventListener("change", changeSubtype));
  body.querySelectorAll("div select.featureGroup").forEach(el => void el.addEventListener("change", changeGroup));
  body.querySelectorAll("div span.featureGroupStyle").forEach(el => void el.addEventListener("click", editGroupStyle));
  body.querySelectorAll("div > span.icon-book").forEach(el => void el.addEventListener("click", editNote));
  body.querySelectorAll("div > span.icon-pencil").forEach(el => void el.addEventListener("click", openLakeEditor));
  body
    .querySelectorAll("div > span.featureCoastline")
    .forEach(el => void el.addEventListener("click", openCoastlineEditor));

  renderEditorPagination(ensureEl("featuresFooter"), view, featuresTable.goto);
}

const getFeature = (element: HTMLElement): Feature => pack.features[getRowId(element)];
const getFeaturePath = (featureId: number) => findEl(`feature_${featureId}`)?.getAttribute("d") ?? null;
// oceans are not drawn, so outline their cells instead
const getOceanPath = (featureId: number) => {
  const cellIds = Array.from(pack.cells.i).filter(cellId => pack.cells.f[cellId] === featureId);
  return getVertexPath(cellIds, pack);
};

function featureHighlightOn(this: HTMLElement): void {
  const feature = getFeature(this);
  if (!feature) return;
  highlightOutline(feature.type === "ocean" ? getOceanPath(feature.i) : getFeaturePath(feature.i));
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
  getFeature(this).name = this.value.trim();
}

function changeSubtype(this: HTMLSelectElement): void {
  getFeature(this).subtype = this.value; // no cascade: generators pick it up on the next run
}

function changeGroup(this: HTMLSelectElement): void {
  getFeature(this).group = this.value;
  Layers.draw("lakes");
}

// lakes are styled by #lakes > g, islands by #coastline > g
function editGroupStyle(this: HTMLElement): void {
  const feature = getFeature(this);
  editStyle(feature.type === "lake" ? "lakes" : "coastline", feature.group);
}

function editNote(this: HTMLElement): void {
  void Controllers.NotesEditor.open({ type: "feature", id: getRowId(this) });
}

function openLakeEditor(this: HTMLElement): void {
  const element = findEl("lakes")?.querySelector<SVGElement>(`use[data-f="${getRowId(this)}"]`);
  if (element) void Controllers.LakesEditor.open(element);
}

function openCoastlineEditor(this: HTMLElement): void {
  void Controllers.CoastlineEditor.open(getRowId(this));
}

function downloadFeaturesData(): void {
  const unit = getAreaUnit();
  let data = `Id,Name,Type,Subtype,Group,Area (${unit}),Map area (${unit}),Cut by border\n`;

  for (const feature of featuresTable.view().all) {
    const cells = [
      feature.i,
      getName(feature),
      feature.type,
      feature.subtype,
      feature.group,
      getArea(getCalculatedArea(feature)),
      getArea(getMapArea(feature)),
      feature.border
    ];
    data += `${cells.join(",")}\n`;
  }

  downloadFile(data, `${getFileName("Features")}.csv`);
}

export const FeaturesOverview = { open, refresh: () => findEl(dialogId) && featuresTable.refresh() };
