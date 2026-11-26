import { interpolateString, select, sum } from "d3";
import { Controllers } from "@/controllers";
import { Military } from "@/model/political/military-generator";
import type { State } from "@/model/political/states-generator";
import { drawRegiment } from "@/renderers/draw-military";
import { Layers } from "@/renderers/layers";
import { Csv } from "@/services/io/csv";
import { App } from "@/ui/app-commands";
import { Dialog } from "@/ui/dialog/dialog";
import { applyLineHighlighting } from "@/ui/dialog/highlighting";
import { bindColumnSorting, sortDataByColumns } from "@/ui/dialog/sorting";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/ui/dialog/table";
import { EconomyTerms } from "@/ui/economy-view";
import { wiki } from "@/utils/common-utils";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";
import { rn, si } from "@/utils/number-utils";
import { capitalize } from "@/utils/string-utils";
import { openMilitaryUnitsEditor } from "./military-units-editor";

const dialogId = "militaryOverview" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg" };
type MilitaryRow = {
  state: State;
  forces: Record<string, number>;
  total: number;
  power: number;
  population: number;
  rate: number;
  alert: number;
  upkeep: number;
};

let columns: EditorColumn<MilitaryRow>[] = [];

const militaryTable = initEditorTable<MilitaryRow>({
  dialogId,
  getData: getMilitaryData,
  onUpdate: renderMilitaryPage
});

function open(): void {
  if (options.app.mode) return;
  Dialog.closeAll("#militaryOverview, .stable");
  Layers.show("states", "borders", "military");

  renderDialog();
  militaryTable.reset();

  Dialog.open("militaryOverview", {
    title: t("Military Overview"),
    width: "fit-content",
    onClose: closeMilitaryOverview,
    position
  });
}

function renderDialog(): void {
  columns = getMilitaryColumns();
  Dialog.destroy("militaryOverview");
  const editorHtml = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
      <div id="militaryBody" class="table" data-type="absolute">
        ${renderEditorHeader({ dialogId, columns })}
      </div>
      <div id="militaryFooter" class="totalLine">
        <div data-tip="${t("States number")}" style="margin-left: 4px">
          ${t("States")}:&nbsp;<span id="militaryFooterStates">0</span>
        </div>
        <div data-tip="${t("Total military forces")}" style="margin-left: 14px" data-col="total">
          ${t("Total forces")}:&nbsp;<span id="militaryFooterForcesTotal">0</span>
        </div>
        <div data-tip="${t("Average military forces per state")}" style="margin-left: 14px" data-col="total">
          ${t("Average forces")}:&nbsp;<span id="militaryFooterForces">0</span>
        </div>
        <div data-tip="${t("Average forces rate per state")}" style="margin-left: 14px" data-col="rate">
          ${t("Average rate")}:&nbsp;<span id="militaryFooterRate">0%</span>
        </div>
        <div data-tip="${t("Average War Alert")}" style="margin-left: 14px" data-col="alert">
          ${t("Average alert")}:&nbsp;<span id="militaryFooterAlert">0</span>
        </div>
      </div>
      <div id="militaryBottom" class="editorToolbar">
        <button id="militaryOverviewRefresh" data-tip="${t("Refresh")}" class="icon-cw"></button>
        <button id="militaryOptionsButton" data-tip="${t("Edit Military Units")}" class="icon-cog"></button>
        <button id="militaryRegimentsList" data-tip="${t("Show regiments list")}" class="icon-list-bullet"></button>
        <button
          id="militaryPercentage"
          data-tip="${t("Toggle percentage / absolute values views")}"
          class="icon-percent"
        ></button>
        <button
          id="militaryOverviewRecalculate"
          data-tip="${t("Recalculate military forces based on current options")}"
          class="icon-retweet"
        ></button>
        <button
          id="militaryExport"
          data-tip="${t("Save data as a CSV file")}"
          class="icon-download"
        ></button>
        <button id="militaryWiki" data-tip="${t("Open Military Forces Tutorial")}" class="icon-info"></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  bindMilitaryColumns();
  applyLineHighlighting("militaryOverview", ({ cellId }) => pack.cells.state[cellId]);

  const body = ensureEl("militaryBody");

  ensureEl("militaryOverviewRefresh").addEventListener("click", refreshMilitaryOverview);
  ensureEl("militaryPercentage").addEventListener("click", togglePercentageMode);
  ensureEl("militaryOptionsButton").addEventListener("click", () => openMilitaryUnitsEditor(rebuildMilitaryColumns));
  ensureEl("militaryRegimentsList").addEventListener("click", () => openRegimentsOverview(-1));
  ensureEl("militaryOverviewRecalculate").addEventListener("click", () => App.openMilitaryRegeneration());
  ensureEl("militaryExport").addEventListener("click", downloadMilitaryData);
  ensureEl("militaryWiki").addEventListener("click", () => wiki("Military-Forces"));

  body.addEventListener("change", event => {
    const el = event.target as HTMLInputElement;
    const line = el.closest<HTMLElement>(".states");
    if (!line) return;
    const state = +line.dataset.id!;
    changeAlert(state, +el.value);
  });

  body.addEventListener("click", event => {
    const el = event.target as HTMLElement;
    const line = el.closest<HTMLElement>(".states");
    if (!line) return;
    const state = +line.dataset.id!;
    if (el.tagName === "SPAN") openRegimentsOverview(state);
  });
}

function closeMilitaryOverview(): void {
  Dialog.destroy("militaryOverview");
}

async function openRegimentsOverview(state: number): Promise<void> {
  Controllers.RegimentsOverview.open(state);
}

function getMilitaryColumns(): EditorColumn<MilitaryRow>[] {
  const unitColumns: EditorColumn<MilitaryRow>[] = options.map.military.units.map(unit => ({
    key: `unit:${unit.name}`,
    label: capitalize(unit.name.replace(/_/g, " ")),
    width: "5em",
    mobileHidden: true,
    tip: sentences(t("{{unit}} units number", { unit: unit.name }), t("Click to sort")),
    sortBy: row => row.forces[unit.name] || 0
  }));

  return [
    { key: "color", width: "1.2em", permanent: true },
    {
      key: "state",
      label: t("State"),
      width: "7em",
      permanent: true,
      sortBy: row => row.state.name || "",
      sortType: "alpha"
    },
    ...unitColumns,
    {
      key: "total",
      label: t("Total"),
      width: "5em",
      defaultSort: "desc",
      sortBy: row => row.total,
      tip: sentences(t("Total military personnel (considering crew)"), t("Click to sort"))
    },
    { key: "population", label: t("Population"), width: "6.5em", mobileHidden: true, sortBy: row => row.population },
    {
      key: "rate",
      label: t("Rate"),
      width: "5em",
      hidden: true,
      sortBy: row => row.rate,
      tip: sentences(
        t("Military personnel rate (% of state population)"),
        t("Depends on war alert"),
        t("Click to sort")
      )
    },
    {
      key: "alert",
      label: t("War Alert"),
      width: "5.5em",
      mobileHidden: true,
      sortBy: row => row.alert,
      tip: sentences(
        t("War Alert"),
        t("Modifier to military forces number, depends on political situation"),
        t("Click to sort")
      )
    },
    {
      key: "upkeep",
      label: t("Upkeep"),
      width: "5em",
      hidden: true,
      sortBy: row => row.upkeep,
      tip: sentences(EconomyTerms.upkeep(), t("Click to sort"))
    },
    {
      key: "power",
      label: t("Power"),
      width: "5em",
      sortBy: row => row.power,
      tip: sentences(
        t("Military power as the forces fight: units number multiplied by unit power and by upkeep"),
        t("Click to sort")
      )
    },
    { key: "regiments", width: "1.4em", permanent: true }
  ];
}

function bindMilitaryColumns(): void {
  bindColumnSorting(dialogId, militaryTable.reset);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => Dialog.update(dialogId, { width: "fit-content", position })
  });
}

function rebuildMilitaryColumns(): void {
  if (!findEl(dialogId)) return; // the units editor outlives the overview
  columns = getMilitaryColumns();
  ensureEl(`${dialogId}Header`).outerHTML = renderEditorHeader({ dialogId, columns });
  bindMilitaryColumns();
  militaryTable.reset();
}

function getMilitaryData(): MilitaryRow[] {
  const rows = pack.states
    .filter(state => state.i && !state.removed)
    .map(state => {
      const forces = Object.fromEntries(
        options.map.military.units.map(unit => [
          unit.name,
          (state.military || []).reduce((total, regiment) => total + (regiment.u[unit.name] || 0), 0)
        ])
      );
      const points = (state.rural || 0) + (state.urban || 0) * options.map.units.population.urbanization.rate;
      const population = rn(points * options.map.units.population.scale);
      const total = options.map.military.units.reduce((sum, unit) => sum + (forces[unit.name] || 0) * unit.crew, 0);
      return {
        state,
        forces,
        total,
        power: Military.getPower(state.i),
        population,
        rate: points ? (total / points) * 100 : 0,
        alert: state.alert ?? 0,
        upkeep: Military.getUpkeep(state.i)
      };
    });
  return sortDataByColumns(dialogId, rows, columns);
}

function refreshMilitaryOverview(): void {
  militaryTable.refresh();
}

function renderMilitaryPage(view: TableView<MilitaryRow>): void {
  const body = ensureEl("militaryBody");
  const percentage = body.dataset.type === "percentage";
  const totals = view.all.reduce(
    (result, row) => {
      result.total += row.total;
      result.power += row.power;
      result.population += row.population;
      for (const unit of options.map.military.units)
        result.units[unit.name] = (result.units[unit.name] || 0) + row.forces[unit.name];
      return result;
    },
    { total: 0, power: 0, population: 0, units: {} as Record<string, number> }
  );
  const percent = (value: number, total: number) => `${rn(total ? (value / total) * 100 : 0)}%`;
  const lines = view.rows
    .map(row => {
      const unitCells = options.map.military.units
        .map(unit => {
          const value = row.forces[unit.name] || 0;
          return `<div data-col="${`unit:${unit.name}`}" data-tip="${t("{{unit}} units number", { unit: unit.name })}">${percentage ? percent(value, totals.units[unit.name] || 0) : Military.getTroops(value)}</div>`;
        })
        .join("");
      return /* html */ `<div class="states" data-id="${row.state.i}">
        <fill-box data-col="color" data-tip="${row.state.fullName}" fill="${row.state.color}" disabled></fill-box>
        <input data-col="state" data-tip="${row.state.fullName}" value="${row.state.name}" readonly />
        ${unitCells}
        <div data-col="total" data-tip="${t("Total military personnel (considering crew)")}" style="font-weight: bold">${percentage ? percent(row.total, totals.total) : si(Military.getTroops(row.total))}</div>
        <div data-col="population" data-tip="${t("State population")}">${percentage ? percent(row.population, totals.population) : si(row.population)}</div>
        <div data-col="rate" data-tip="${sentences(t("Military personnel rate (% of state population)"), t("Depends on war alert"))}">${rn(row.rate, 2)}%</div>
        <input data-col="alert" data-tip="${sentences(t("War Alert"), t("Modifier to military forces number, depends on political situation"))}" type="number" min="0" step=".01" value="${rn(row.alert, 2)}" />
        <div data-col="upkeep" data-tip="${EconomyTerms.upkeep()}">${rn(row.upkeep * 100)}%</div>
                <div data-col="power" data-tip="${t("Military power as the forces fight: units number multiplied by unit power and by upkeep")}">${percentage ? percent(row.power, totals.power) : si(Military.getTroops(row.power))}</div>
        <span data-col="regiments" data-tip="${t("Show regiments list")}" class="icon-list-bullet pointer"></span>
      </div>`;
    })
    .join("");

  body.querySelectorAll(":scope > .states").forEach(line => {
    line.remove();
  });
  body.insertAdjacentHTML("beforeend", lines);
  updateFooter(view);
  renderEditorPagination(ensureEl("militaryFooter"), view, militaryTable.goto);

  body.querySelectorAll<HTMLElement>(":scope > .states").forEach(line => {
    line.addEventListener("mouseenter", stateHighlightOn);
    line.addEventListener("mouseleave", stateHighlightOff);
  });
  Dialog.update(dialogId, { width: "fit-content", position });
}

function changeAlert(state: number, alert: number): void {
  if (alert >= 0) Military.setAlert(state, alert);
  for (const regiment of pack.states[state].military ?? []) {
    drawRegiment(regiment, state);
  }
  militaryTable.refresh();
}

function updateFooter(view: TableView<MilitaryRow>): void {
  const statesNumber = view.all.length;
  const total = sum(view.all.map(row => row.total));
  ensureEl("militaryFooterStates").innerHTML = String(statesNumber);
  ensureEl("militaryFooterForcesTotal").innerHTML = si(Military.getTroops(total));
  ensureEl("militaryFooterForces").innerHTML = si(statesNumber ? Military.getTroops(total / statesNumber) : 0);
  ensureEl("militaryFooterRate").innerHTML =
    `${rn(statesNumber ? sum(view.all.map(row => row.rate)) / statesNumber : 0, 2)}%`;
  ensureEl("militaryFooterAlert").innerHTML = String(
    rn(statesNumber ? sum(view.all.map(row => row.alert)) / statesNumber : 0, 2)
  );
}

function stateHighlightOn(event: Event): void {
  const target = event.target as HTMLElement;
  const state = +target.dataset.id!;
  if (options.app.mode || !state) return;
  select<SVGGElement, unknown>(`#armies > g > g#army${state}`).transition().duration(2000).style("fill", "#ff0000");

  if (!Layers.isOn("states")) return;
  const d = select<SVGGElement, unknown>("#regions").select(`#state${state}`).attr("d");

  const path = select<SVGGElement, unknown>("#debug")
    .append("path")
    .attr("class", "highlight")
    .attr("d", d)
    .attr("fill", "none")
    .attr("stroke", "red")
    .attr("stroke-width", 1)
    .attr("opacity", 1)
    .attr("filter", "url(#blur1)");

  const l = path.node()!.getTotalLength();
  const dur = (l + 5000) / 2;
  const i = interpolateString(`0,${l}`, `${l},${l}`);
  path
    .transition()
    .duration(dur)
    .attrTween("stroke-dasharray", () => t => i(t));
}

function stateHighlightOff(event: Event): void {
  select<SVGGElement, unknown>("#debug")
    .selectAll(".highlight")
    .each(function () {
      select(this).transition().duration(1000).attr("opacity", 0).remove();
    });

  const target = event.target as HTMLElement;
  const state = +target.dataset.id!;
  select<SVGGElement, unknown>(`#armies > g > g#army${state}`).transition().duration(1000).style("fill", null);
}

function togglePercentageMode(): void {
  const body = ensureEl("militaryBody");
  body.dataset.type = body.dataset.type === "absolute" ? "percentage" : "absolute";
  militaryTable.refresh();
}

function downloadMilitaryData(): void {
  const units = options.map.military.units.map(u => u.name);
  const headers = [
    "Id",
    "State",
    ...units.map(u => capitalize(u)),
    "Total",
    "Power",
    "Population",
    "Rate",
    "War Alert"
  ];
  const rows = getMilitaryData().map(row => [
    row.state.i,
    row.state.name,
    ...units.map(unit => Military.getTroops(row.forces[unit])),
    Military.getTroops(row.total),
    Military.getTroops(row.power),
    row.population,
    `${rn(row.rate, 2)}%`,
    row.alert
  ]);
  Csv.download("Military", headers, rows);
}

export const MilitaryOverview = { open, exportCsv: downloadMilitaryData };
