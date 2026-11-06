import { easeSinIn, select, transition } from "d3";
import { Controllers } from "@/controllers";
import { Development } from "@/model/society/development-generator";
import { getArea, getAreaUnit } from "@/model/units";
import { Layers } from "@/renderers/layers";
import { LegendBoxes } from "@/renderers/legend-boxes";
import {
  drawDevelopmentOverlay,
  getEraColor,
  removeDevelopmentOverlay
} from "@/renderers/overlays/development-overlay";
import { Csv } from "@/services/io/csv";
import type { LegendItem } from "@/types/legend";
import type { PackedGraph } from "@/types/packed-graph";
import { eraLabel, eraName } from "@/ui/development-view";
import { Dialog } from "@/ui/dialog/dialog";
import { applyLineHighlighting } from "@/ui/dialog/highlighting";
import { bindColumnSorting, sortDataByColumns } from "@/ui/dialog/sorting";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  type TableView
} from "@/ui/dialog/table";
import { tip } from "@/ui/tooltips";
import { groupByValue } from "@/utils/array-utils";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";
import { rn, si } from "@/utils/number-utils";
import { escapeHtml } from "@/utils/string-utils";

const dialogId = "developmentEditor" as const;
const CSV_COLUMNS = ["Era", "From", "To", "Cells", "Area", "Population", "Burgs"];
const LEGEND_NAME = "Development";
const NO_DEVELOPMENT_COLOR = "#d3d3d3"; // the brush's color for cells it clears
const position = { my: "right top", at: "right-10 top+10", of: "svg" };

type Era = { i: number; name: string; label: string; from: number; to: number; color: string }; // name is the data's, label the interface's
type EraStatistics = { cells: number; area: number; rural: number; urban: number; burgs: number };
type DevelopmentStatistics = { eras: EraStatistics[]; cells: number; mean: number; min: number; max: number };

const NO_STATISTICS: DevelopmentStatistics = { eras: [], cells: 0, mean: 0, min: 0, max: 0 };
let statistics = NO_STATISTICS;
let percentage = false; // eras' shares of the totals instead of their values
let painting = false; // the brush is open over the overlay
let overlayShown = true; // the user's choice, kept between openings

const columns: EditorColumn<Era>[] = [
  { key: "name", label: t("Era"), width: "13em", permanent: true, sortBy: era => era.from, defaultSort: "asc" },
  { key: "levels", label: t("Levels"), width: "5em", sortBy: era => era.from },
  { key: "cells", label: t("Cells"), width: "5em", sortBy: era => statistics.eras[era.i]?.cells ?? 0 },
  { key: "area", label: t("Area"), width: "7em", mobileHidden: true, sortBy: era => statistics.eras[era.i]?.area ?? 0 },
  {
    key: "population",
    label: t("Population"),
    width: "6.2em",
    mobileHidden: true,
    sortBy: era => getPopulation(statistics.eras[era.i])
  },
  { key: "burgs", label: t("Burgs"), width: "4em", sortBy: era => statistics.eras[era.i]?.burgs ?? 0 },
  { key: "actions", width: "1.4em", permanent: true }
];

const erasTable = initEditorTable<Era>({
  dialogId,
  getData: () =>
    sortDataByColumns(
      dialogId,
      getEras().filter(era => statistics.eras[era.i]?.cells),
      columns
    ),
  onUpdate: view => addLines(view)
});

function getEras(): Era[] {
  const { eras } = Development;
  return eras.map(({ level, name }, i) => ({
    i,
    name,
    label: eraName(name),
    from: level,
    to: (eras[i + 1]?.level ?? 101) - 1,
    color: getEraColor(i)
  }));
}

function open(): void {
  if (options.app.mode) return;
  painting = false;
  Dialog.closeAll(`#${dialogId}, .stable`);
  Layers.hide("biomes", "states", "cultures", "religions", "provinces");

  renderDialog();
  statistics = collectDevelopmentStatistics();
  erasTable.reset();

  Dialog.open(dialogId, { title: t("Development Editor"), onClose: close, position });
  if (overlayShown) drawDevelopmentOverlay();
}

function renderDialog(): void {
  Dialog.destroy(dialogId);
  const html = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
      ${renderEditorHeader({ dialogId, columns })}
      <div id="developmentBody" class="table"></div>
      <div id="developmentFooter" class="totalLine">
        <div data-tip="${t("Average development of the people, rural and urban")}" style="margin-left: 12px">
          ${t("Average")}:&nbsp;<span id="developmentFooterMean">0</span>
        </div>
        <div data-tip="${t("Number of peopled cells")}" style="margin-left: 12px">
          ${t("Cells")}:&nbsp;<span id="developmentFooterCells">0</span>
        </div>
      </div>
      <div id="developmentBottom">
        <button id="developmentRefresh" data-tip="${t("Refresh")}" class="icon-cw"></button>
        <button
          id="developmentOverlayToggle"
          data-tip="${t("Show or hide the development overlay on the map")}"
          class="${overlayShown ? "icon-eye" : "icon-eye-off"}"
        ></button>
        <button id="developmentLegend" data-tip="${t("Toggle Legend box")}" class="icon-list-bullet"></button>
        <button
          id="developmentPercentage"
          data-tip="${t("Toggle percentage / absolute values views")}"
          class="icon-percent"
        ></button>
        <button id="developmentPaint" data-tip="${t("Paint development by era")}" class="icon-brush"></button>
        <button
          id="developmentRegenerate"
          data-tip="${t("Regenerate development from the cultures and land, discarding manual changes")}"
          class="icon-retweet"
        ></button>
        <button id="developmentEras" data-tip="${t("Rename the eras")}" class="icon-pencil"></button>
        <button id="developmentExport" data-tip="${t("Save data as a CSV file")}" class="icon-download"></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => Dialog.update(dialogId, { width: "fit-content", position })
  });

  ensureEl("developmentRefresh").addEventListener("click", refresh);
  ensureEl("developmentOverlayToggle").addEventListener("click", toggleOverlay);
  ensureEl("developmentPercentage").addEventListener("click", togglePercentage);
  ensureEl("developmentLegend").addEventListener("click", toggleLegend);
  ensureEl("developmentPaint").addEventListener("click", openPaintEditor);
  ensureEl("developmentRegenerate").addEventListener("click", confirmRegenerate);
  ensureEl("developmentEras").addEventListener("click", () => void Controllers.ErasEditor.open());
  ensureEl("developmentExport").addEventListener("click", downloadCsv);

  bindColumnSorting(dialogId, erasTable.reset);
  applyLineHighlighting(dialogId, ({ cellId }) => {
    const development = pack.cells.development;
    return development?.[cellId] ? Development.getEraIndex(development[cellId]) : undefined;
  });
}

function refresh(): void {
  statistics = collectDevelopmentStatistics();
  erasTable.refresh();
  if (overlayShown) drawDevelopmentOverlay();
}

type StatisticsSource = {
  cells: Pick<PackedGraph["cells"], "i" | "area" | "pop" | "burg" | "development">;
  burgs: Array<{ population?: number; removed?: boolean } | undefined>;
};

/** Peopled land by era, and the people's average development */
export function collectDevelopmentStatistics(source: StatisticsSource = pack): DevelopmentStatistics {
  const { cells, burgs } = source;
  const eras = Development.eras.map(() => ({ cells: 0, area: 0, rural: 0, urban: 0, burgs: 0 }));
  const development = cells.development;
  if (!development) return { eras, cells: 0, mean: 0, min: 0, max: 0 };

  const { scale, urbanization } = options.map.units.population;
  let land = 0;
  let people = 0;
  let total = 0;
  let min = 100;
  let max = 0;
  for (const cell of cells.i) {
    if (!development[cell]) continue; // nobody lives there
    const level = development[cell];
    const era = eras[Development.getEraIndex(level)];
    land++;
    era.cells++;
    era.area += cells.area[cell];
    min = Math.min(min, level);
    max = Math.max(max, level);

    const rural = cells.pop[cell] * scale;
    era.rural += rural;
    people += rural;
    total += rural * level;

    const burg = cells.burg[cell] ? burgs[cells.burg[cell]] : undefined;
    if (!burg || burg.removed) continue;
    const urban = (burg.population ?? 0) * scale * urbanization.rate;
    era.urban += urban;
    era.burgs++;
    people += urban;
    total += urban * level;
  }

  return { eras, cells: land, mean: people ? total / people : 0, min: land ? min : 0, max };
}

function getPopulation(era: EraStatistics | undefined): number {
  return era ? rn(era.rural + era.urban) : 0;
}

function addLines(view: TableView<Era>): void {
  const unit = ` ${getAreaUnit()}`;
  const totals = statistics.eras.reduce(
    (sum, era) => ({
      cells: sum.cells + era.cells,
      area: sum.area + era.area,
      population: sum.population + getPopulation(era),
      burgs: sum.burgs + era.burgs
    }),
    { cells: 0, area: 0, population: 0, burgs: 0 }
  );
  const share = (value: number, total: number) => `${total ? rn((value / total) * 100, 1) : 0}%`;
  let lines = "";
  for (const era of view.rows) {
    const { cells, area, rural, urban, burgs } = statistics.eras[era.i];
    const population = getPopulation(statistics.eras[era.i]);
    const shown = percentage
      ? {
          cells: share(cells, totals.cells),
          area: share(area, totals.area),
          population: share(population, totals.population),
          burgs: share(burgs, totals.burgs)
        }
      : { cells: String(cells), area: si(getArea(area)) + unit, population: si(population), burgs: String(burgs) };
    const populationTip = sentences(
      `${t("Total population")}: ${si(population)}`,
      `${t("Rural population")}: ${si(rural)}`,
      `${t("Urban population")}: ${si(urban)}`
    );

    lines += /* html */ `
      <div class="states development" data-id="${era.i}">
        <div data-col="name">
          <fill-box fill="${era.color}" disabled></fill-box>
          <span class="developmentEra">${escapeHtml(era.label)}</span>
        </div>
        <div data-col="levels" class="hide" data-tip="${t("Development levels of the era")}">${era.from === era.to ? era.from : `${era.from}-${era.to}`}</div>
        <div data-col="cells" class="hide"><span data-tip="${t("Number of cells")}" class="icon-check-empty"></span><span data-tip="${t("Number of cells")}">${shown.cells}</span></div>
        <div data-col="area" class="hide"><span data-tip="${t("Area")}" class="icon-map-o" style="padding-right: 2px"></span><span data-tip="${t("Area")}">${shown.area}</span></div>
        <div data-col="population" class="hide"><span data-tip="${populationTip}" class="icon-male"></span><span data-tip="${populationTip}">${shown.population}</span></div>
        <div data-col="burgs" class="hide"><span data-tip="${t("Number of burgs")}" class="icon-dot-circled"></span><span data-tip="${t("Number of burgs")}">${shown.burgs}</span></div>
      </div>`;
  }

  const body = ensureEl("developmentBody");
  body.innerHTML = lines || `<div style="padding: 0.5em 12px">${t("No development on the map")}</div>`;
  const mean = rn(statistics.mean);
  ensureEl("developmentFooterMean").textContent = `${mean}, ${eraLabel(mean)}`;
  ensureEl("developmentFooterCells").textContent = String(statistics.cells);

  body.querySelectorAll<HTMLElement>("div.development").forEach(line => {
    line.addEventListener("mouseenter", () => highlightEra(+line.dataset.id!, true));
    line.addEventListener("mouseleave", () => highlightEra(+line.dataset.id!, false));
  });
  Dialog.update(dialogId, { width: "fit-content", position });
}

function highlightEra(index: number, on: boolean): void {
  const path = select(`#developmentOverlay > #era${index + 1}`);
  if (on)
    path
      .raise()
      .transition(transition().duration(2000).ease(easeSinIn))
      .attr("stroke-width", 2)
      .attr("stroke", "#cd4c11");
  else path.transition().attr("stroke-width", 0).attr("stroke", null);
}

function toggleLegend(): void {
  const getItems = () =>
    getEras()
      .filter(era => statistics.eras[era.i]?.cells)
      .map(({ i, color, label }): LegendItem => [i, color, label]);
  LegendBoxes.toggle(LEGEND_NAME, getItems, t("No development on the map"));
}

function openPaintEditor(): void {
  const development = pack.cells.development;
  if (!development || options.app.mode) return;
  painting = true; // the overlay stays under the brush
  void Controllers.PaintEditor.open({
    title: t("Paint Development"),
    parentDialogId: dialogId,
    onClose: open,
    keepOrder: true,
    items: [
      { id: 0, name: t("No development"), color: NO_DEVELOPMENT_COLOR },
      ...getEras().map(era => ({ id: era.from, name: `${era.from} ${era.label}`, color: era.color }))
    ],
    getValue: cell => (development[cell] ? Development.eras[Development.getEraIndex(development[cell])].level : 0),
    filterCell: cell => Development.isPeopled(cell),
    onApply: applyChanges
  });
}

/** A painted cell takes its era's first level, or 0; a cell already in the era keeps its own */
function applyChanges(changes: ReadonlyMap<number, number>): void {
  for (const [level, cells] of groupByValue(changes)) Development.setCells(level, cells);
  if (!changes.size) return;
  if (findEl(dialogId)) refresh();
  tip(t("Regenerate the economy to see the effect on production"), false, "info");
}

function confirmRegenerate(): void {
  Dialog.confirm({
    title: t("Regenerate development"),
    message: t("Regenerate development from the cultures and land? Manual changes will be lost"),
    confirm: t("Regenerate"),
    onConfirm: () => {
      Development.generate();
      refresh();
    }
  });
}

function downloadCsv(): void {
  const unit =
    options.map.units.area.unit === "square" ? `${options.map.units.distance.unit}2` : options.map.units.area.unit;
  const rows = getEras()
    .filter(era => statistics.eras[era.i]?.cells)
    .map(era => {
      const { cells, area, burgs } = statistics.eras[era.i];
      return [era.name, era.from, era.to, cells, getArea(area), getPopulation(statistics.eras[era.i]), burgs];
    });
  Csv.download(
    "Development",
    CSV_COLUMNS.map(column => (column === "Area" ? `Area ${unit}` : column)),
    rows
  );
}

function close(): void {
  statistics = NO_STATISTICS;
  Dialog.destroy(dialogId);
  if (!painting) removeDevelopmentOverlay();
}

function toggleOverlay(): void {
  overlayShown = !overlayShown;
  if (overlayShown) drawDevelopmentOverlay();
  else removeDevelopmentOverlay();
  ensureEl("developmentOverlayToggle").className = overlayShown ? "icon-eye" : "icon-eye-off";
}

function togglePercentage(): void {
  percentage = !percentage;
  erasTable.refresh();
}

export const DevelopmentEditor = { open, refreshNames: () => erasTable.refresh() };
