import { easeSinIn, select, sum, transition } from "d3";
import { closeDialogs, destroyDialog, updateDialog } from "@/components/dialog/dialog-helpers";
import { applyLineHighlighting } from "@/components/dialog/highlighting";
import { bindColumnSorting, sortDataByColumns } from "@/components/dialog/sorting";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/components/dialog/table";
import type { FillBoxElement } from "@/components/fill-box";
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import type { Biome } from "@/generators/biomes-generator";
import { Population } from "@/generators/population-generator";
import { clearLegend, drawLegend } from "@/renderers/draw-legend";
import type { PackedGraph } from "@/types/PackedGraph";
import { downloadFile, getArea, getAreaUnit, getFileName, openURL } from "@/utils";
import { ensureEl, getRandomColor, isLand, rn, si } from "../utils";

const dialogId = "biomesEditor" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
let currentBiomeStatistics: BiomeStatistics[] = [];
const columns: EditorColumn<Biome>[] = [
  {
    key: "name",
    label: "Biome",
    width: "15em",
    permanent: true,
    sortBy: biome => biome.name,
    sortType: "alpha"
  },
  {
    key: "habitability",
    label: "Habitability",
    width: "6.5em",
    sortBy: biome => biome.habitability
  },
  {
    key: "cells",
    label: "Cells",
    width: "5em",
    sortBy: biome => currentBiomeStatistics[biome.i]?.cells ?? 0,
    defaultSort: "desc"
  },
  {
    key: "area",
    label: "Area",
    width: "7em",
    mobileHidden: true,
    sortBy: biome => currentBiomeStatistics[biome.i]?.area ?? 0
  },
  {
    key: "population",
    label: "Population",
    width: "6.2em",
    mobileHidden: true,
    sortBy: biome => {
      const statistics = currentBiomeStatistics[biome.i];
      return statistics ? statistics.rural + statistics.urban : 0;
    }
  },
  { key: "actions", width: "2em", permanent: true }
];

const biomesTable = initEditorTable<Biome>({
  getData: () =>
    sortDataByColumns(
      dialogId,
      pack.biomes.filter(biome => biome.i && !biome.removed),
      columns
    ),
  onUpdate: view => biomesEditorAddLines(view, currentBiomeStatistics)
});

function open(): void {
  if (customization) return;
  closeDialogs(`#${dialogId}, .stable`);
  Layers.show("biomes");
  Layers.hide("states", "cultures");
  Layers.hide("religions", "provinces");

  renderDialog();
  currentBiomeStatistics = biomesCollectStatistics();
  biomesTable.reset();

  $(`#${dialogId}`).dialog({ title: "Biomes Editor", resizable: false, close: closeBiomesEditor, position });
}

function renderDialog(): void {
  destroyDialog(dialogId);
  const html = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
      ${renderEditorHeader({ dialogId, columns })}
      <div id="biomesBody" class="table" data-type="absolute"></div>
      <div id="biomesFooter" class="totalLine">
        <div data-tip="Number of land biomes" style="margin-left: 12px">
          Biomes:&nbsp;<span id="biomesFooterBiomes">0</span>
        </div>
        <div data-col="cells" data-tip="Total land cells number" style="margin-left: 12px">
          Cells:&nbsp;<span id="biomesFooterCells">0</span>
        </div>
        <div data-col="area" data-tip="Total land area" style="margin-left: 12px">
          Land Area:&nbsp;<span id="biomesFooterArea">0</span>
        </div>
        <div data-col="population" data-tip="Total population" style="margin-left: 12px">
          Population:&nbsp;<span id="biomesFooterPopulation">0</span>
        </div>
      </div>
      <div id="biomesBottom">
        <button id="biomesEditorRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
        <button id="biomesEditStyle" data-tip="Edit biomes style in Style Editor" class="icon-adjust"></button>
        <button id="biomesLegend" data-tip="Toggle Legend box" class="icon-list-bullet"></button>
        <button
          id="biomesPercentage"
          data-tip="Toggle percentage / absolute values views"
          class="icon-percent"
        ></button>
        <button
          id="biomesManually"
          data-tip="Manually re-assign biomes to not follow the default moisture/temperature pattern"
          class="icon-brush"
        ></button>
        <button id="biomesAdd" data-tip="Add a custom biome" class="icon-plus"></button>
        <button
          id="biomesRestore"
          data-tip="Restore the defaults and re-define biomes based on current moisture and temperature"
          class="icon-history"
        ></button>
        <button
          id="biomesExport"
          data-tip="Save biomes-related data as a text file (.csv)"
          class="icon-download"
        ></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });

  ensureEl("biomesEditorRefresh").addEventListener("click", refreshBiomesEditor);
  ensureEl("biomesEditStyle").addEventListener("click", () => editStyle("biomes"));
  ensureEl("biomesLegend").addEventListener("click", toggleLegend);
  ensureEl("biomesPercentage").addEventListener("click", togglePercentageMode);
  ensureEl("biomesManually").addEventListener("click", openPaintEditor);
  ensureEl("biomesRestore").addEventListener("click", restoreInitialBiomes);
  ensureEl("biomesAdd").addEventListener("click", addCustomBiome);
  ensureEl("biomesExport").addEventListener("click", downloadBiomesData);

  bindColumnSorting(dialogId, biomesTable.reset);
  applyLineHighlighting(dialogId, ({ cellId }) => cellId && pack.cells.biome[cellId]);

  ensureEl("biomesBody").addEventListener("click", ev => {
    const el = ev.target as HTMLElement;
    const cl = el.classList;
    if (el.tagName === "FILL-BOX") biomeChangeColor(el as FillBoxElement);
    else if (cl.contains("icon-info-circled")) openWiki(el);
    else if (cl.contains("icon-trash-empty")) removeCustomBiomeLine(el);
  });

  ensureEl("biomesBody").addEventListener("change", ev => {
    const el = ev.target as HTMLInputElement;
    const cl = el.classList;
    if (cl.contains("biomeName")) biomeChangeName(el);
    else if (cl.contains("biomeHabitability")) biomeChangeHabitability(el);
  });
}

function refreshBiomesEditor(): void {
  currentBiomeStatistics = biomesCollectStatistics();
  biomesTable.refresh();
}

export type BiomeStatistics = { cells: number; area: number; rural: number; urban: number };

type BiomeStatisticsSource = {
  biomes: Biome[];
  cells: Pick<PackedGraph["cells"], "i" | "h" | "biome" | "area" | "pop" | "burg">;
  burgs: Array<{ population?: number }>;
};

export function collectBiomeStatistics(source: BiomeStatisticsSource = pack): BiomeStatistics[] {
  const { cells } = source;
  const statistics = source.biomes.map(() => ({ cells: 0, area: 0, rural: 0, urban: 0 }));

  for (const i of cells.i) {
    if (cells.h[i] < 20) continue;
    const biomeStatistics = statistics[cells.biome[i]];
    biomeStatistics.cells++;
    biomeStatistics.area += cells.area[i];
    biomeStatistics.rural += cells.pop[i];
    const burg = cells.burg[i] ? source.burgs[cells.burg[i]] : null;
    if (burg) biomeStatistics.urban += burg.population ?? 0;
  }

  return statistics;
}

function biomesCollectStatistics(): BiomeStatistics[] {
  return collectBiomeStatistics(pack);
}

function biomesEditorAddLines(view: TableView<Biome>, statistics: BiomeStatistics[]): void {
  const unit = ` ${getAreaUnit()}`;
  let lines = "";
  let totalArea = 0;
  let totalPopulation = 0;

  for (const biome of view.rows) {
    const { i, name, color, habitability } = biome;
    const { cells, area: rawArea, rural: rawRural, urban: rawUrban } = statistics[i];
    const area = getArea(rawArea);
    const rural = rawRural * populationRate;
    const urban = rawUrban * populationRate * urbanization;
    const population = rn(rural + urban);
    const populationTip = `Total population: ${si(population)}; Rural population: ${si(rural)}; Urban population: ${si(urban)}`;
    lines += /* html */ `
      <div
        class="states biomes"
        data-id="${i}"
        data-name="${name}"
        data-habitability="${habitability}"
        data-cells=${cells}
        data-area=${area}
        data-population=${population}
        data-color=${color}
      >
        <div data-col="name">
          <fill-box fill="${color}"></fill-box>
          <input data-tip="Biome name. Click and type to change" class="biomeName" value="${name}" autocorrect="off" spellcheck="false" />
        </div>
        <div data-col="habitability" class="hide">
          <span data-tip="Biome habitability percent">%</span>
          <input data-tip="Biome habitability percent. Click and set new value to change" type="number" min="0" max="9999" class="biomeHabitability" value=${habitability} />
        </div>
        <div data-col="cells" class="hide"><span data-tip="Cells count" class="icon-check-empty"></span><span data-tip="Cells count" class="biomeCells">${cells}</span></div>
        <div data-col="area" class="hide"><span data-tip="Biome area" class="icon-map-o" style="padding-right: 2px"></span><span data-tip="Biome area" class="biomeArea">${si(area) + unit}</span></div>
        <div data-col="population" class="hide"><span data-tip="${populationTip}" class="icon-male"></span><span data-tip="${populationTip}" class="biomePopulation">${si(population)}</span></div>
        <div data-col="actions" class="hide">
          <span data-tip="Open Wikipedia article about the biome" class="icon-info-circled pointer"></span>
          ${i > 12 && !cells ? '<span data-tip="Remove the custom biome" class="icon-trash-empty"></span>' : ""}
        </div>
      </div>
    `;
  }
  const body = ensureEl("biomesBody");
  body.innerHTML = lines;

  // update footer
  for (const biome of view.all) {
    const statistic = statistics[biome.i];
    totalArea += getArea(statistic.area);
    totalPopulation += rn(statistic.rural * populationRate + statistic.urban * populationRate * urbanization);
  }
  const totalMapArea = getArea(sum(pack.cells.area));
  ensureEl("biomesFooterBiomes").innerHTML = String(view.all.length);
  ensureEl("biomesFooterCells").innerHTML = String(pack.cells.h.filter(h => h >= 20).length);
  const footerArea = ensureEl("biomesFooterArea");
  footerArea.innerHTML = si(totalArea) + unit;
  ensureEl("biomesFooterPopulation").innerHTML = si(totalPopulation);
  footerArea.dataset.area = String(totalArea);
  footerArea.dataset.mapArea = String(totalMapArea);
  ensureEl("biomesFooterPopulation").dataset.population = String(totalPopulation);
  renderEditorPagination(ensureEl("biomesFooter"), view, biomesTable.goto);

  // add listeners
  body.querySelectorAll("div.biomes").forEach(el => {
    el.addEventListener("mouseenter", biomeHighlightOn);
  });
  body.querySelectorAll("div.biomes").forEach(el => {
    el.addEventListener("mouseleave", biomeHighlightOff);
  });

  if (body.dataset.type === "percentage") {
    body.dataset.type = "absolute";
    togglePercentageMode();
  }
  updateDialog(dialogId, { width: "fit-content", position });
}

function biomeHighlightOn(event: Event): void {
  if (customization === 6) return;
  const biome = +(event.target as HTMLElement).dataset.id!;
  const animate = transition().duration(2000).ease(easeSinIn);
  select(`#biomes > #biome${biome}`).raise().transition(animate).attr("stroke-width", 2).attr("stroke", "#cd4c11");
}

function biomeHighlightOff(event: Event): void {
  if (customization === 6) return;
  const biome = +(event.target as HTMLElement).dataset.id!;
  const color = pack.biomes[biome].color;
  select(`#biomes > #biome${biome}`).transition().attr("stroke-width", 0.7).attr("stroke", color);
}

function biomeChangeColor(fillBox: FillBoxElement): void {
  const currentFill = fillBox.getAttribute("fill")!;
  const biomeId = +fillBox.closest<HTMLElement>(".biomes")!.dataset.id!;

  const callback = (newFill: string): void => {
    (fillBox as any).fill = newFill;
    pack.biomes[biomeId].color = newFill;
    Layers.draw("biomes");
  };

  void Controllers.ColorPicker.open(currentFill, callback);
}

function biomeChangeName(el: HTMLInputElement): void {
  const line = el.closest<HTMLElement>(".biomes")!;
  const biome = +line.dataset.id!;
  line.dataset.name = el.value;
  pack.biomes[biome].name = el.value;
}

function biomeChangeHabitability(el: HTMLInputElement): void {
  const line = el.closest<HTMLElement>(".biomes")!;
  const biome = +line.dataset.id!;
  const failed = Number.isNaN(+el.value) || +el.value < 0 || +el.value > 9999;
  if (failed) {
    el.value = String(pack.biomes[biome].habitability);
    tip("Please provide a valid number in range 0-9999", false, "error");
    return;
  }
  pack.biomes[biome].habitability = +el.value;
  line.dataset.habitability = el.value;
  regeneratePopulation();
  refreshBiomesEditor();
}

function openWiki(el: HTMLElement): void {
  const biomeName = el.closest<HTMLElement>(".biomes")?.dataset.name;
  if (biomeName === "Custom" || !biomeName) {
    tip("Please fill in the biome name", false, "error");
    return;
  }

  const wikiBase = "https://en.wikipedia.org/wiki/";
  const pages: Record<string, string> = {
    "Hot desert": "Desert_climate#Hot_desert_climates",
    "Cold desert": "Desert_climate#Cold_desert_climates",
    Savanna: "Tropical_and_subtropical_grasslands,_savannas,_and_shrublands",
    Grassland: "Temperate_grasslands,_savannas,_and_shrublands",
    "Tropical seasonal forest": "Seasonal_tropical_forest",
    "Temperate deciduous forest": "Temperate_deciduous_forest",
    "Tropical rainforest": "Tropical_rainforest",
    "Temperate rainforest": "Temperate_rainforest",
    Taiga: "Taiga",
    Tundra: "Tundra",
    Glacier: "Glacier",
    Wetland: "Wetland"
  };
  const customBiomeLink = `https://en.wikipedia.org/w/index.php?search=${biomeName}`;
  const link = pages[biomeName] ? wikiBase + pages[biomeName] : customBiomeLink;
  openURL(link);
}

function toggleLegend(): void {
  if (select("#legend").selectAll("*").size()) {
    clearLegend();
    return;
  } // hide legend
  const statistics = biomesCollectStatistics();
  const data = pack.biomes
    .filter(({ i }) => statistics[i].cells)
    .sort((a, b) => statistics[b.i].area - statistics[a.i].area)
    .map(({ i, color, name }) => [i, color, name]);
  drawLegend("Biomes", data);
}

function togglePercentageMode(): void {
  const body = ensureEl("biomesBody");
  if (body.dataset.type === "absolute") {
    body.dataset.type = "percentage";
    const totalCells = +ensureEl("biomesFooterCells").innerHTML;
    const footerArea = ensureEl("biomesFooterArea");
    const totalArea = +footerArea.dataset.area!;
    const totalMapArea = +footerArea.dataset.mapArea!;
    const totalPopulation = +ensureEl("biomesFooterPopulation").dataset.population!;

    body.querySelectorAll<HTMLElement>(":scope > div").forEach(el => {
      el.querySelector(".biomeCells")!.innerHTML = `${rn((+el.dataset.cells! / totalCells) * 100)}%`;
      el.querySelector(".biomeArea")!.innerHTML = `${rn((+el.dataset.area! / totalArea) * 100)}%`;
      el.querySelector(".biomePopulation")!.innerHTML = `${rn((+el.dataset.population! / totalPopulation) * 100)}%`;
    });

    // update footer to show land percentage of total map
    footerArea.innerHTML = `${rn((totalArea / totalMapArea) * 100)}%`;
  } else {
    body.dataset.type = "absolute";
    biomesTable.refresh();
  }
}

export function createCustomBiome(biomes: Biome[], color: string): Biome | null {
  const i = biomes.length;
  if (i > 254) return null;

  const biome = {
    i,
    name: "Custom",
    color,
    habitability: 50,
    iconsDensity: 0,
    icons: [],
    cost: 50
  };
  biomes.push(biome);
  return biome;
}

export function removeCustomBiome(biomes: Biome[], cellBiomes: ArrayLike<number>, biomeId: number): boolean {
  const biome = biomes[biomeId];
  if (biomeId <= 12 || !biome || biome.removed) return false;

  for (let cellId = 0; cellId < cellBiomes.length; cellId++) {
    if (cellBiomes[cellId] === biomeId) return false;
  }

  biome.removed = true;
  return true;
}

function addCustomBiome(): void {
  const biome = createCustomBiome(pack.biomes, getRandomColor());
  if (!biome) {
    tip("Maximum number of biomes reached (255), data cleansing is required", false, "error");
    return;
  }

  currentBiomeStatistics = biomesCollectStatistics();
  biomesTable.refresh();
}

function removeCustomBiomeLine(el: HTMLElement): void {
  const line = el.closest<HTMLElement>(".biomes")!;
  const biome = +line.dataset.id!;
  if (!removeCustomBiome(pack.biomes, pack.cells.biome, biome)) return;
  currentBiomeStatistics = biomesCollectStatistics();
  biomesTable.refresh();
}

function downloadBiomesData(): void {
  const unit = areaUnit.value === "square" ? `${distanceUnitInput.value}2` : areaUnit.value;
  let data = `Id,Biome,Color,Habitability,Cells,Area ${unit},Population\n`; // headers
  const statistics = biomesCollectStatistics();
  for (const biome of pack.biomes) {
    if (!biome.i || biome.removed) continue;
    const { cells, area, rural, urban } = statistics[biome.i];
    const population = rn(rural * populationRate + urban * populationRate * urbanization);
    data += `${biome.i},${biome.name},${biome.color},${biome.habitability}%,${cells},${getArea(area)},${population}\n`;
  }

  const name = `${getFileName("Biomes")}.csv`;
  downloadFile(data, name);
}

function openPaintEditor(): void {
  Layers.show("biomes");
  void Controllers.PaintEditor.open({
    title: "Paint Biomes",
    parentDialogId: dialogId,
    onClose: open,
    items: pack.biomes
      .filter(biome => biome.i && !biome.removed)
      .map(biome => ({ id: biome.i, name: biome.name, color: biome.color })),
    getValue: cell => pack.cells.biome[cell],
    filterCell: cell => isLand(cell, pack),
    onApply: applyBiomesChange
  });
}

function applyBiomesChange(changes: ReadonlyMap<number, number>): void {
  for (const [cell, biome] of changes) pack.cells.biome[cell] = biome;
  if (changes.size) {
    Layers.draw("biomes");
    if (document.getElementById(dialogId)) refreshBiomesEditor();
  }
}

function restoreInitialBiomes(): void {
  pack.biomes = Biomes.getDefault();
  Biomes.define();
  Layers.draw("biomes");
  regeneratePopulation();
  refreshBiomesEditor();
}

function closeBiomesEditor(): void {
  $("#biomesEditor").dialog("destroy");
  ensureEl("biomesEditor").remove();
}

function regeneratePopulation(): void {
  Population.regenerate();
  Layers.draw("population", "goods");
}

export const BiomesEditor = { open };
