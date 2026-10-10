import { interpolateString, select, sum } from "d3";
import { closeDialogs, destroyDialog, updateDialog } from "@/components/dialog/dialog-helpers";
import { applyLineHighlighting } from "@/components/dialog/highlighting";
import { type LimitationItem, limitationTip, pickLimitation } from "@/components/dialog/limitation-picker";
import { bindColumnSorting, sortDataByColumns } from "@/components/dialog/sorting";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/components/dialog/table";
import { Icons } from "@/components/icons";
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import type { State } from "@/generators/states-generator";
import type { MilitaryUnit } from "@/types/Military";
import { downloadFile, getFileName } from "@/utils";
import { sentences, t } from "@/utils/i18n";
import { capitalize, ensureEl, escapeHtml, rn, sanitizeId, si, wiki } from "../utils";

const dialogId = "militaryOverview" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
type MilitaryRow = {
  state: State;
  forces: Record<string, number>;
  total: number;
  population: number;
  rate: number;
  alert: number;
};
let columns: EditorColumn<MilitaryRow>[] = [];

const militaryTable = initEditorTable<MilitaryRow>({
  getData: getMilitaryData,
  onUpdate: renderMilitaryPage
});

function open(): void {
  if (customization) return;
  closeDialogs("#militaryOverview, .stable");
  Layers.show("states", "borders", "military");

  renderDialog();
  militaryTable.reset();

  $("#militaryOverview").dialog({
    title: t("Military Overview"),
    resizable: false,
    width: "fit-content",
    close: closeMilitaryOverview,
    position
  });
}

function renderDialog(): void {
  columns = getMilitaryColumns();
  destroyDialog("militaryOverview");
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
  ensureEl("militaryOptionsButton").addEventListener("click", militaryCustomize);
  ensureEl("militaryRegimentsList").addEventListener("click", () => openRegimentsOverview(-1));
  ensureEl("militaryOverviewRecalculate").addEventListener("click", militaryRecalculate);
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
  $("#militaryOverview").dialog("destroy");
  ensureEl("militaryOverview").remove();
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
      sortBy: row => row.alert,
      tip: sentences(
        t("War Alert"),
        t("Modifier to military forces number, depends on political situation"),
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
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });
}

function rebuildMilitaryColumns(): void {
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
      const population = rn(
        ((state.rural || 0) + (state.urban || 0) * options.map.units.population.urbanization.rate) *
          options.map.units.population.scale
      );
      const total = options.map.military.units.reduce((sum, unit) => sum + (forces[unit.name] || 0) * unit.crew, 0);
      return {
        state,
        forces,
        total,
        population,
        rate: population ? (total / population) * 100 : 0,
        alert: state.alert ?? 0
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
      result.population += row.population;
      for (const unit of options.map.military.units)
        result.units[unit.name] = (result.units[unit.name] || 0) + row.forces[unit.name];
      return result;
    },
    { total: 0, population: 0, units: {} as Record<string, number> }
  );
  const percent = (value: number, total: number) => `${rn(total ? (value / total) * 100 : 0)}%`;
  const lines = view.rows
    .map(row => {
      const unitCells = options.map.military.units
        .map(unit => {
          const value = row.forces[unit.name] || 0;
          return `<div data-col="${`unit:${unit.name}`}" data-tip="${t("{{unit}} units number", { unit: unit.name })}">${percentage ? percent(value, totals.units[unit.name] || 0) : value}</div>`;
        })
        .join("");
      return /* html */ `<div class="states" data-id="${row.state.i}">
        <fill-box data-col="color" data-tip="${row.state.fullName}" fill="${row.state.color}" disabled></fill-box>
        <input data-col="state" data-tip="${row.state.fullName}" value="${row.state.name}" readonly />
        ${unitCells}
        <div data-col="total" data-tip="${t("Total military personnel (considering crew)")}" style="font-weight:bold">${percentage ? percent(row.total, totals.total) : si(row.total)}</div>
        <div data-col="population" data-tip="${t("State population")}">${percentage ? percent(row.population, totals.population) : si(row.population)}</div>
        <div data-col="rate" data-tip="${sentences(t("Military personnel rate (% of state population)"), t("Depends on war alert"))}">${rn(row.rate, 2)}%</div>
        <input data-col="alert" data-tip="${sentences(t("War Alert"), t("Modifier to military forces number, depends on political situation"))}" type="number" min="0" step=".01" value="${rn(row.alert, 2)}" />
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
  updateDialog(dialogId, { width: "fit-content", position });
}

function changeAlert(state: number, alert: number): void {
  if (alert >= 0) Military.setAlert(state, alert);
  for (const regiment of pack.states[state].military ?? []) {
    const text = document.querySelector(`#armies #regiment${state}-${regiment.i} > text`);
    if (text) text.textContent = String(Military.getTotal(regiment));
  }
  militaryTable.refresh();
}

function updateFooter(view: TableView<MilitaryRow>): void {
  const statesNumber = view.all.length;
  const total = sum(view.all.map(row => row.total));
  ensureEl("militaryFooterStates").innerHTML = String(statesNumber);
  ensureEl("militaryFooterForcesTotal").innerHTML = si(total);
  ensureEl("militaryFooterForces").innerHTML = si(statesNumber ? total / statesNumber : 0);
  ensureEl("militaryFooterRate").innerHTML =
    `${rn(statesNumber ? sum(view.all.map(row => row.rate)) / statesNumber : 0, 2)}%`;
  ensureEl("militaryFooterAlert").innerHTML = String(
    rn(statesNumber ? sum(view.all.map(row => row.alert)) / statesNumber : 0, 2)
  );
}

function stateHighlightOn(event: Event): void {
  const target = event.target as HTMLElement;
  const state = +target.dataset.id!;
  if (customization || !state) return;
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

function militaryCustomize(): void {
  renderOptions();
  const types = ["melee", "ranged", "mounted", "machinery", "naval", "armored", "aviation", "magical"];
  const tableBody = ensureEl("militaryOptions").querySelector("tbody")!;
  removeUnitLines();
  options.map.military.units.map(unit => addUnitLine(unit));

  $("#militaryOptions").dialog({
    title: t("Edit Military Units"),
    resizable: false,
    width: "fit-content",
    position: { my: "center", at: "center", of: "svg" },
    close: closeMilitaryOptions,
    buttons: {
      [t("Apply")]: applyMilitaryOptions,
      [t("Add")]: () =>
        addUnitLine({
          icon: Icons.glyph("🛡️"),
          name: `custom${ensureEl<HTMLTableElement>("militaryOptionsTable").rows.length}`,
          rural: 0.2,
          urban: 0.5,
          crew: 1,
          power: 1,
          type: "melee",
          separate: 0
        }),
      [t("Restore")]: restoreDefaultUnits,
      [t("Cancel")]: function () {
        $(this).dialog("close");
      }
    },
    open: function () {
      const buttons = $(this).dialog("widget").find(".ui-dialog-buttonset > button");
      buttons[0].addEventListener("mousemove", () =>
        tip(
          `${t("Apply military units settings.")} <span style="color:#cb5858">${t("All forces will be recalculated!")}</span>`
        )
      );
      buttons[1].addEventListener("mousemove", () => tip(t("Add")));
      buttons[2].addEventListener("mousemove", () => tip(t("Restore default military units and settings")));
      buttons[3].addEventListener("mousemove", () => tip(t("Close the window without saving the changes")));
    }
  });

  // renderOptions() rebuilds the dialog markup on every open, so the listener is bound to the fresh
  // tbody each time. Do not guard this with a one-time flag: the old node is gone with its listener
  tableBody.addEventListener("click", event => {
    const el = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!el) return;
    const type = el.dataset.type;

    if (type === "icon") {
      Controllers.IconPicker.open({
        current: el.dataset.icon || "",
        onPick: icon => setIconButton(el, icon)
      });
      return;
    }

    if (type === "biomes") {
      const biomes = pack.biomes.filter(biome => !biome.removed).map(({ i, name, color }) => ({ i, name, color }));
      selectLimitation(el, biomes);
      return;
    }
    if (type === "states") return selectLimitation(el, pack.states);
    if (type === "cultures") return selectLimitation(el, pack.cultures);
    if (type === "religions") return selectLimitation(el, pack.religions);
  });

  function removeUnitLines(): void {
    tableBody.querySelectorAll("tr").forEach(el => {
      el.remove();
    });
  }

  function getLimitValue(attr?: number[]): string {
    return attr?.join(",") || "";
  }

  function getLimitText(attr?: number[]): string {
    return attr?.length ? "some" : "all";
  }

  function getLimitTip(attr: number[] | undefined, items: readonly LimitationItem[]): string {
    return attr?.length ? limitationTip(attr, items) : "";
  }

  const LIMIT_TIPS = {
    biomes: t("Select allowed biomes"),
    states: t("Select allowed states"),
    cultures: t("Select allowed cultures"),
    religions: t("Select allowed religions")
  };

  function addUnitLine(unit: MilitaryUnit): void {
    const { type, icon, name, rural, urban, power, crew, separate } = unit;
    const row = document.createElement("tr");
    const typeOptions = types.map(t => `<option ${type === t ? "selected" : ""} value="${t}">${t}</option>`).join(" ");

    const getLimitButton = (attr: "biomes" | "states" | "cultures" | "religions"): string => {
      const data = pack[attr] as LimitationItem[];
      return `<button
          data-tip="${LIMIT_TIPS[attr]}"
          data-type="${attr}"
          title="${escapeHtml(getLimitTip(unit[attr], data))}"
          data-value="${getLimitValue(unit[attr])}">
          ${getLimitText(unit[attr])}
        </button>`;
    };

    row.innerHTML = /* html */ `<td>
          <button data-type="icon" data-tip="${t("Click to select unit icon")}" translate="no"></button>
        </td>
        <td><input data-tip="${sentences(t("Name"), t("If name is changed for existing unit, old unit will be replaced"))}" value="${name}" /></td>
        <td>${getLimitButton("biomes")}</td>
        <td>${getLimitButton("states")}</td>
        <td>${getLimitButton("cultures")}</td>
        <td>${getLimitButton("religions")}</td>
        <td><input data-tip="${t("Conscription percentage for rural population")}" type="number" min="0" max="100" step=".01" value="${rural}" /></td>
        <td><input data-tip="${t("Conscription percentage for urban population")}" type="number" min="0" max="100" step=".01" value="${urban}" /></td>
        <td><input data-tip="${t("Average number of people in crew (used for total personnel calculation)")}" type="number" min="1" step="1" value="${crew}" /></td>
        <td><input data-tip="${t("Unit military power (used for battle simulation)")}" type="number" min="0" step=".1" value="${power}" /></td>
        <td>
          <select data-tip="${t("Unit type to apply special rules on forces recalculation")}">
            ${typeOptions}
          </select>
        </td>
        <td data-tip="${t("Check if unit is separate and can be stacked only with units of the same type")}">
          <input id="${name}Separate" type="checkbox" class="checkbox" ${separate ? "checked" : ""} />
          <label for="${name}Separate" class="checkbox-label"></label>
        </td>
        <td data-tip="${t("Remove")}">
          <span data-tip="${t("Remove")}" class="icon-trash-empty pointer" onclick="this.parentElement.parentElement.remove();"></span>
        </td>`;
    setIconButton(row.querySelector<HTMLButtonElement>("button[data-type='icon']")!, icon || "");
    tableBody.appendChild(row);
  }

  // the button holds the canonical icon in a dataset attribute: its content is presentation only and
  // may be rewritten by the browser or extensions (e.g. Google Translate wrapping text nodes in <font>)
  function setIconButton(button: HTMLElement, icon: string): void {
    button.dataset.icon = icon;
    button.innerHTML = Icons.html(icon);
  }

  function restoreDefaultUnits(): void {
    removeUnitLines();
    Military.getDefaultOptions().map((unit: MilitaryUnit) => addUnitLine(unit));
  }

  function selectLimitation(el: HTMLElement, items: LimitationItem[]): void {
    const type = el.dataset.type!;
    pickLimitation({
      title: t("Limit unit"),
      heading: t("Limit unit by {{type}}", { type }),
      items,
      allowed: el.dataset.value ? el.dataset.value.split(",").map(Number) : [],
      onApply: allowed => {
        el.dataset.value = allowed.join(",");
        el.innerHTML = getLimitText(allowed);
        el.setAttribute("title", getLimitTip(allowed, items));
      }
    });
  }

  function applyMilitaryOptions(): void {
    const unitLines = Array.from(tableBody.querySelectorAll("tr"));
    const names = unitLines.map(r => sanitizeId(r.querySelector("input")!.value));
    if (new Set(names).size !== names.length) {
      tip(t("All units should have unique names"), false, "error");
      return;
    }

    $("#militaryOptions").dialog("close");

    const units = unitLines.map((r, i) => {
      const elements = Array.from(
        r.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>("input, button, select")
      );
      const values = elements.map(el => {
        const { type, value } = (el as HTMLElement).dataset || {};
        if (type === "icon") return (el as HTMLElement).dataset.icon ?? "";
        if (type) return value ? value.split(",").map(v => parseInt(v, 10)) : null;
        if ((el as HTMLInputElement).type === "number") return +(el as HTMLInputElement).value || 0;
        if ((el as HTMLInputElement).type === "checkbox") return +(el as HTMLInputElement).checked || 0;
        return (el as HTMLInputElement).value;
      }) as [
        string,
        undefined,
        number[] | null,
        number[] | null,
        number[] | null,
        number[] | null,
        number,
        number,
        number,
        number,
        string,
        number
      ];
      const [icon, , biomes, states, cultures, religions, rural, urban, crew, power, type, separate] = values;

      const unit: MilitaryUnit = {
        icon,
        name: names[i],
        rural,
        urban,
        crew,
        power,
        type,
        separate
      };
      if (biomes) unit.biomes = biomes;
      if (states) unit.states = states;
      if (cultures) unit.cultures = cultures;
      if (religions) unit.religions = religions;
      return unit;
    });
    options.map.military.units = units;
    Options.save(); // the roster is this map's, and what the next map starts from
    Military.generate();
    Layers.draw("military");
    rebuildMilitaryColumns();
  }
}

function renderOptions(): void {
  destroyDialog("militaryOptions");
  const optionsHtml = /* html */ `<div id="militaryOptions" class="dialog stable">
      <div class="table">
        <table id="militaryOptionsTable">
          <thead>
            <tr>
              <th data-tip="${t("Unit icon")}">${t("Icon")}</th>
              <th data-tip="${sentences(t("Name"), t("If name is changed for existing unit, old unit will be replaced"))}">${t("Name")}</th>
              <th style="width: 5em" data-tip="${t("Select allowed biomes")}">${t("Biomes")}</th>
              <th style="width: 5em" data-tip="${t("Select allowed states")}">${t("States")}</th>
              <th style="width: 5em" data-tip="${t("Select allowed cultures")}">${t("Cultures")}</th>
              <th style="width: 5em" data-tip="${t("Select allowed religions")}">${t("Religions")}</th>
              <th data-tip="${t("Conscription percentage for rural population")}">${t("Rural")}</th>
              <th data-tip="${t("Conscription percentage for urban population")}">${t("Urban")}</th>
              <th data-tip="${t("Average number of people in crew (used for total personnel calculation)")}">${t("Crew")}</th>
              <th data-tip="${t("Unit military power (used for battle simulation)")}">${t("Power")}</th>
              <th data-tip="${t("Unit type to apply special rules on forces recalculation")}">${t("Type")}</th>
              <th data-tip="${t("Check if unit is separate and can be stacked only with units of the same type")}">
                ${t("Separate")}
              </th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", optionsHtml);
}

function closeMilitaryOptions(): void {
  $("#militaryOptions").dialog("destroy");
  ensureEl("militaryOptions").remove();
}

function militaryRecalculate(): void {
  ensureEl("alertMessage").innerHTML =
    `${t("Are you sure you want to recalculate military forces for all states?")}<br>${t("Regiments for all states will be regenerated")}`;
  $("#alert").dialog({
    resizable: false,
    title: t("Recalculate military"),
    buttons: {
      [t("Recalculate")]: function () {
        $(this).dialog("close");
        Military.generate();
        Layers.draw("military");
        refreshMilitaryOverview();
      },
      [t("Cancel")]: function () {
        $(this).dialog("close");
      }
    }
  });
}

function downloadMilitaryData(): void {
  const units = options.map.military.units.map(u => u.name);
  let data = `Id,State,${units.map(u => capitalize(u)).join(",")},Total,Population,Rate,War Alert\n`; // headers

  for (const row of getMilitaryData()) {
    data += `${row.state.i},${row.state.name},${units.map(unit => row.forces[unit] || 0).join(",")},${row.total},${row.population},${rn(row.rate, 2)}%,${row.alert}\n`;
  }

  const name = `${getFileName("Military")}.csv`;
  downloadFile(data, name);
}

export const MilitaryOverview = { open, exportCsv: downloadMilitaryData };
