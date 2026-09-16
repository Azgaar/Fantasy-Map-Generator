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
import {
  type Feature,
  type FeatureType,
  ISLAND_SUBTYPES,
  LAKE_SUBTYPES,
  OCEAN_SUBTYPES
} from "@/generators/features-generator";
import { highlightArea, highlightOutline } from "@/renderers/overlays/highlight";
import {
  capitalize,
  downloadFile,
  ensureEl,
  escapeHtml,
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
const SUBTYPES: Record<FeatureType, readonly string[]> = {
  island: ISLAND_SUBTYPES,
  lake: LAKE_SUBTYPES,
  ocean: OCEAN_SUBTYPES
};

const UNNAMED = "Unnamed";
function getName(feature: Feature) {
  return feature.name || UNNAMED;
}

// a feature cut by the map border continues beyond it: assume it keeps its share of the map over the whole globe
function getCalculatedArea(feature: Feature) {
  return feature.border ? feature.area / getGlobeCoverage() : feature.area;
}

const getGlobeCoverage = () => options.map.geography.mapSize / 100;

function renderAreaCell(feature: Feature, unit: string): string {
  const area = `${si(getArea(getCalculatedArea(feature)))} ${unit}`;
  const estimated = feature.border && getGlobeCoverage() < 1;
  if (!estimated) return `<div data-tip="Feature area" data-col="area">${area}</div>`;

  const mapArea = `${si(getArea(feature.area))} ${unit}`;
  const tip = `Estimated area: the feature goes beyond the map border, its area on the map is ${mapArea}`;
  return `<div data-tip="${tip}" data-col="area">~${area}</div>`;
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

  oceanPaths.clear();
  renderDialog();
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
  bindRowActions(ensureEl("featuresBody"));
}

function closeFeaturesOverview(): void {
  destroyDialog(dialogId);
  oceanPaths.clear();
  const view = featuresTable.view();
  view.rows = [];
  view.all = [];
}

function refreshOverview(): void {
  oceanPaths.clear();
  updateSubtypeFilter();
  featuresTable.reset();
}

/** Subtype options follow the selected type; "all" offers every subtype */
function updateSubtypeFilter(): void {
  const subtypes =
    filterState.type === "all"
      ? [...ISLAND_SUBTYPES, ...LAKE_SUBTYPES, ...OCEAN_SUBTYPES]
      : SUBTYPES[filterState.type as FeatureType];
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

// "Freshwater lake", "Isle", "Lake island", "Sea"
function getTypeLabel(feature: Pick<Feature, "type" | "subtype">): string {
  const subtype = feature.subtype?.replace("_", " ");
  if (feature.type === "lake") return capitalize(`${subtype} ${feature.type}`);
  return capitalize(subtype || feature.type);
}

// the subtype set is fixed per type; lake_island is geographic, so it stays put
function renderTypeCell(feature: Feature): string {
  const subtypes = SUBTYPES[feature.type];
  if (feature.subtype === "lake_island")
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
  let lines = "";

  for (const feature of view.rows) {
    lines += /* html */ `<div class="states" data-id="${feature.i}">
      <span data-tip="Locate the feature" data-col="locate" class="icon-target"></span>
      <input data-tip="Feature name" class="featureName stateName" value="${escapeHtml(feature.name || "")}" placeholder="${UNNAMED}" data-col="name" />
      ${renderTypeCell(feature)}
      ${renderGroupCell(feature, Object.keys(styles.lakes.groups))}
      ${renderAreaCell(feature, unit)}
      ${feature.type === "lake" ? `<span data-tip="Edit the lake" data-col="edit" class="icon-pencil"></span>` : `<span data-col="edit" class="placeholder"></span>`}
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

  renderEditorPagination(ensureEl("featuresFooter"), view, featuresTable.goto);
}

// one listener per event on the body serves every row
const rowActions: Record<string, Record<string, (element: HTMLElement) => void>> = {
  click: {
    "span.icon-target": zoomToFeature,
    "span.featureGroupStyle": editGroupStyle,
    "span.icon-book": editNote,
    "span.icon-pencil": openLakeEditor,
    "span.featureCoastline": openCoastlineEditor
  },
  input: { "input.featureName": changeName },
  change: { "select.featureSubtype": changeSubtype, "select.featureGroup": changeGroup }
};

function bindRowActions(body: HTMLElement): void {
  for (const [type, actions] of Object.entries(rowActions)) {
    body.addEventListener(type, event => {
      const target = event.target as HTMLElement;
      for (const [selector, action] of Object.entries(actions)) {
        if (target.matches(selector)) return action(target);
      }
    });
  }
  const rowOf = (node: EventTarget | null) => (node instanceof Element ? node.closest<HTMLElement>(".states") : null);
  body.addEventListener("mouseover", event => {
    const row = rowOf(event.target);
    if (row && row !== rowOf(event.relatedTarget)) featureHighlightOn(row);
  });
  body.addEventListener("mouseout", event => {
    const row = rowOf(event.target);
    if (row && row !== rowOf(event.relatedTarget)) featureHighlightOff();
  });
}

const getFeature = (element: HTMLElement): Feature => pack.features[getRowId(element)];
const getFeaturePath = (featureId: number) => findEl(`feature_${featureId}`)?.getAttribute("d") ?? null;
const oceanCells = (featureId: number) => Array.from(pack.cells.i).filter(cellId => pack.cells.f[cellId] === featureId);

// oceans are not drawn, so outline their cells instead; built once per dialog session
const oceanPaths = new Map<number, string>();
function getOceanPath(featureId: number): string {
  const path = oceanPaths.get(featureId) ?? getVertexPath(oceanCells(featureId), pack);
  oceanPaths.set(featureId, path);
  return path;
}

function featureHighlightOn(row: HTMLElement): void {
  const feature = getFeature(row);
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

// an ocean's vertex ring is open at the map border, so bound it by its cells
function zoomToFeature(element: HTMLElement): void {
  const feature = getFeature(element);
  const points =
    feature.type === "ocean"
      ? oceanCells(feature.i).map(cellId => pack.cells.p[cellId])
      : feature.vertices.map(vertex => pack.vertices.p[vertex]).filter(Boolean);
  if (!points.length) return;

  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  highlightArea({ x: minX, y: minY, width: maxX - minX, height: maxY - minY }, 3);
}

function changeName(input: HTMLElement): void {
  getFeature(input).name = (input as HTMLInputElement).value.trim();
}

function changeSubtype(select: HTMLElement): void {
  getFeature(select).subtype = (select as HTMLSelectElement).value; // no cascade: generators pick it up on the next run
}

function changeGroup(select: HTMLElement): void {
  getFeature(select).group = (select as HTMLSelectElement).value;
  Layers.draw("lakes");
}

// lakes are styled by #lakes > g, islands by #coastline > g
function editGroupStyle(element: HTMLElement): void {
  const feature = getFeature(element);
  editStyle(feature.type === "lake" ? "lakes" : "coastline", feature.group);
}

function editNote(element: HTMLElement): void {
  void Controllers.NotesEditor.open({ type: "feature", id: getRowId(element) });
}

function openLakeEditor(element: HTMLElement): void {
  const use = findEl("lakes")?.querySelector<SVGElement>(`use[data-f="${getRowId(element)}"]`);
  if (use) void Controllers.LakesEditor.open(use);
}

function openCoastlineEditor(element: HTMLElement): void {
  void Controllers.CoastlineEditor.open(getRowId(element));
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
      getArea(feature.area),
      feature.border
    ];
    data += `${cells.join(",")}\n`;
  }

  downloadFile(data, `${getFileName("Features")}.csv`);
}

export const FeaturesOverview = { open, refresh: () => findEl(dialogId) && featuresTable.refresh() };
