import { interpolateString, select, sum } from "d3";
import { closeDialogs, updateDialog } from "@/components/dialog/dialog-helpers";
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
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import type { State } from "@/generators/states-generator";
import { downloadFile, getFileName } from "@/utils";
import { capitalize, ensureEl, rn, sanitizeId, si, wiki } from "../utils";

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
    title: "Military Overview",
    resizable: false,
    width: "fit-content",
    close: closeMilitaryOverview,
    position
  });
}

function renderDialog(): void {
  columns = getMilitaryColumns();
  document.getElementById("militaryOverview")?.remove();
  const editorHtml = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
      <div id="militaryBody" class="table" data-type="absolute">
        ${renderEditorHeader({ dialogId, columns })}
      </div>
      <div id="militaryFooter" class="totalLine">
        <div data-tip="States number" style="margin-left: 4px">
          States:&nbsp;<span id="militaryFooterStates">0</span>
        </div>
        <div data-tip="Total military forces" style="margin-left: 14px" data-col="total">
          Total forces:&nbsp;<span id="militaryFooterForcesTotal">0</span>
        </div>
        <div data-tip="Average military forces per state" style="margin-left: 14px" data-col="total">
          Average forces:&nbsp;<span id="militaryFooterForces">0</span>
        </div>
        <div data-tip="Average forces rate per state" style="margin-left: 14px" data-col="rate">
          Average rate:&nbsp;<span id="militaryFooterRate">0%</span>
        </div>
        <div data-tip="Average War Alert" style="margin-left: 14px" data-col="alert">
          Average alert:&nbsp;<span id="militaryFooterAlert">0</span>
        </div>
      </div>
      <div id="militaryBottom" class="editorToolbar">
        <button id="militaryOverviewRefresh" data-tip="Refresh the overview screen" class="icon-cw"></button>
        <button id="militaryOptionsButton" data-tip="Edit Military units" class="icon-cog"></button>
        <button id="militaryRegimentsList" data-tip="Show regiments list" class="icon-list-bullet"></button>
        <button
          id="militaryPercentage"
          data-tip="Toggle percentage / absolute values views"
          class="icon-percent"
        ></button>
        <button
          id="militaryOverviewRecalculate"
          data-tip="Recalculate military forces based on current options"
          class="icon-retweet"
        ></button>
        <button
          id="militaryExport"
          data-tip="Save military-related data as a text file (.csv)"
          class="icon-download"
        ></button>
        <button id="militaryWiki" data-tip="Open Military Forces Tutorial" class="icon-info"></button>
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
  const unitColumns: EditorColumn<MilitaryRow>[] = options.military.map(unit => ({
    key: `unit:${unit.name}`,
    label: capitalize(unit.name.replace(/_/g, " ")),
    width: "5em",
    mobileHidden: true,
    tip: `State ${unit.name} units number. Click to sort`,
    sortBy: row => row.forces[unit.name] || 0
  }));

  return [
    { key: "color", width: "1.2em", permanent: true },
    {
      key: "state",
      label: "State",
      width: "7em",
      permanent: true,
      sortBy: row => row.state.name || "",
      sortType: "alpha"
    },
    ...unitColumns,
    {
      key: "total",
      label: "Total",
      width: "5em",
      defaultSort: "desc",
      sortBy: row => row.total,
      tip: "Total military personnel (considering crew). Click to sort"
    },
    { key: "population", label: "Population", width: "6.5em", mobileHidden: true, sortBy: row => row.population },
    {
      key: "rate",
      label: "Rate",
      width: "5em",
      sortBy: row => row.rate,
      tip: "Military personnel rate (% of state population). Depends on war alert. Click to sort"
    },
    {
      key: "alert",
      label: "War Alert",
      width: "5.5em",
      sortBy: row => row.alert,
      tip: "War Alert. Modifier to military forces number, depends on political situation. Click to sort"
    },
    { key: "actions", width: "1.4em", permanent: true, align: "right" }
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
        options.military.map(unit => [
          unit.name,
          (state.military || []).reduce((total, regiment) => total + (regiment.u[unit.name] || 0), 0)
        ])
      );
      const population = rn(((state.rural || 0) + (state.urban || 0) * urbanization) * populationRate);
      const total = options.military.reduce((sum, unit) => sum + (forces[unit.name] || 0) * unit.crew, 0);
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
      for (const unit of options.military)
        result.units[unit.name] = (result.units[unit.name] || 0) + row.forces[unit.name];
      return result;
    },
    { total: 0, population: 0, units: {} as Record<string, number> }
  );
  const percent = (value: number, total: number) => `${rn(total ? (value / total) * 100 : 0)}%`;
  const lines = view.rows
    .map(row => {
      const unitCells = options.military
        .map(unit => {
          const value = row.forces[unit.name] || 0;
          return `<div data-col="${`unit:${unit.name}`}" data-tip="State ${unit.name} units number">${percentage ? percent(value, totals.units[unit.name] || 0) : value}</div>`;
        })
        .join("");
      return /* html */ `<div class="states" data-id="${row.state.i}">
        <fill-box data-col="color" data-tip="${row.state.fullName}" fill="${row.state.color}" disabled></fill-box>
        <input data-col="state" data-tip="${row.state.fullName}" value="${row.state.name}" readonly />
        ${unitCells}
        <div data-col="total" data-tip="Total state military personnel (considering crew)" style="font-weight:bold">${percentage ? percent(row.total, totals.total) : si(row.total)}</div>
        <div data-col="population" data-tip="State population">${percentage ? percent(row.population, totals.population) : si(row.population)}</div>
        <div data-col="rate" data-tip="Military personnel rate (% of state population). Depends on war alert">${rn(row.rate, 2)}%</div>
        <input data-col="alert" data-tip="War Alert. Editable modifier to military forces number, depends on political situation" type="number" min="0" step=".01" value="${rn(row.alert, 2)}" />
        <div data-col="actions"><span data-tip="Show regiments list" class="icon-list-bullet pointer"></span></div>
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
  const s = pack.states[state];
  const prevAlert = s.alert ?? 1;
  const dif = prevAlert ? alert / prevAlert : 0; // modifier
  s.alert = alert;
  (s.military || []).forEach(r => {
    Object.keys(r.u).forEach(u => {
      r.u[u] = rn(r.u[u] * dif);
    });
    r.a = sum(Object.values(r.u)); // change total
    select<SVGGElement, unknown>(`#armies > g > g#regiment${s.i}-${r.i} > text`).text(Military.getTotal(r)); // change icon text
  });

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
  options.military.map(unit => addUnitLine(unit));

  $("#militaryOptions").dialog({
    title: "Edit Military Units",
    resizable: false,
    width: "fit-content",
    position: { my: "center", at: "center", of: "svg" },
    close: closeMilitaryOptions,
    buttons: {
      Apply: applyMilitaryOptions,
      Add: () =>
        addUnitLine({
          icon: "🛡️",
          name: `custom${ensureEl<HTMLTableElement>("militaryOptionsTable").rows.length}`,
          rural: 0.2,
          urban: 0.5,
          crew: 1,
          power: 1,
          type: "melee",
          separate: 0
        }),
      Restore: restoreDefaultUnits,
      Cancel: function () {
        $(this).dialog("close");
      }
    },
    open: function () {
      const buttons = $(this).dialog("widget").find(".ui-dialog-buttonset > button");
      buttons[0].addEventListener("mousemove", () =>
        tip("Apply military units settings. <span style='color:#cb5858'>All forces will be recalculated!</span>")
      );
      buttons[1].addEventListener("mousemove", () => tip("Add new military unit to the table"));
      buttons[2].addEventListener("mousemove", () => tip("Restore default military units and settings"));
      buttons[3].addEventListener("mousemove", () => tip("Close the window without saving the changes"));
    }
  });

  if (modules.overviewMilitaryCustomize) return;
  modules.overviewMilitaryCustomize = true;

  tableBody.addEventListener("click", event => {
    const el = event.target as HTMLElement;
    if (el.tagName !== "BUTTON") return;
    const type = el.dataset.type;

    if (type === "icon") {
      Controllers.IconSelector.open(el.textContent || "", value => {
        el.innerHTML =
          value.startsWith("http") || value.startsWith("data:image")
            ? `<img src="${value}" style="width:1.2em;height:1.2em;pointer-events:none;">`
            : value;
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

  function getLimitTip(attr: number[] | undefined, data: { name?: string }[] | undefined): string {
    if (!attr?.length) return "";
    return attr.map(i => data?.[i]?.name || "").join(", ");
  }

  function addUnitLine(unit: MilitaryUnit): void {
    const { type, icon, name, rural, urban, power, crew, separate } = unit;
    const row = document.createElement("tr");
    const typeOptions = types.map(t => `<option ${type === t ? "selected" : ""} value="${t}">${t}</option>`).join(" ");

    const getLimitButton = (attr: "biomes" | "states" | "cultures" | "religions"): string => {
      const data = attr === "biomes" ? [] : (pack[attr] as { name?: string }[]);
      return `<button
          data-tip="Select allowed ${attr}"
          data-type="${attr}"
          title="${getLimitTip(unit[attr], data)}"
          data-value="${getLimitValue(unit[attr])}">
          ${getLimitText(unit[attr])}
        </button>`;
    };

    row.innerHTML = /* html */ `<td>
          <button data-type="icon" data-tip="Click to select unit icon">
            ${
              icon.startsWith("http") || icon.startsWith("data:image")
                ? `<img src="${icon}" style="width:1.2em;height:1.2em;pointer-events:none;">`
                : icon || ""
            }
          </button>
        </td>
        <td><input data-tip="Type unit name. If name is changed for existing unit, old unit will be replaced" value="${name}" /></td>
        <td>${getLimitButton("biomes")}</td>
        <td>${getLimitButton("states")}</td>
        <td>${getLimitButton("cultures")}</td>
        <td>${getLimitButton("religions")}</td>
        <td><input data-tip="Enter conscription percentage for rural population" type="number" min="0" max="100" step=".01" value="${rural}" /></td>
        <td><input data-tip="Enter conscription percentage for urban population" type="number" min="0" max="100" step=".01" value="${urban}" /></td>
        <td><input data-tip="Enter average number of people in crew (for total personnel calculation)" type="number" min="1" step="1" value="${crew}" /></td>
        <td><input data-tip="Enter military power (used for battle simulation)" type="number" min="0" step=".1" value="${power}" /></td>
        <td>
          <select data-tip="Select unit type to apply special rules on forces recalculation">
            ${typeOptions}
          </select>
        </td>
        <td data-tip="Check if unit is <b>separate</b> and can be stacked only with the same units">
          <input id="${name}Separate" type="checkbox" class="checkbox" ${separate ? "checked" : ""} />
          <label for="${name}Separate" class="checkbox-label"></label>
        </td>
        <td data-tip="Remove the unit">
          <span data-tip="Remove unit type" class="icon-trash-empty pointer" onclick="this.parentElement.parentElement.remove();"></span>
        </td>`;
    tableBody.appendChild(row);
  }

  function restoreDefaultUnits(): void {
    removeUnitLines();
    Military.getDefaultOptions().map((unit: MilitaryUnit) => addUnitLine(unit));
  }

  function selectLimitation(
    el: HTMLElement,
    data: { i: number; name?: string; fullName?: string; color?: string; removed?: boolean }[]
  ): void {
    const type = el.dataset.type!;
    const value = el.dataset.value;
    const initial = value ? value.split(",").map(v => +v) : [];

    const filtered = data.filter(datum => datum.i && !datum.removed);
    const lines = filtered.map(
      ({ i, name, fullName, color }) => /* html */ `
          <tr data-tip="${name}">
            <td><span style="color:${color}">⬤</span></td>
            <td>
              <input data-i="${i}" id="el${i}" type="checkbox" class="checkbox"
                ${!initial.length || initial.includes(i) ? "checked" : ""} >
              <label for="el${i}" class="checkbox-label">${fullName || name}</label>
            </td>
          </tr>`
    );

    ensureEl("alertMessage").innerHTML = /* html */ `<b>Limit unit by ${type}:</b>
        <table style="margin-top:.3em">
          <tbody>
            ${lines.join("")}
          </tbody>
        </table>`;

    $("#alert").dialog({
      width: "fit-content",
      title: "Limit unit",
      buttons: {
        Invert: () => {
          alertMessage.querySelectorAll<HTMLInputElement>("input").forEach(el => {
            el.checked = !el.checked;
          });
        },
        Apply: function () {
          const inputs = Array.from(alertMessage.querySelectorAll<HTMLInputElement>("input"));
          const selected = inputs.reduce<string[]>((acc, input) => {
            if (input.checked) acc.push(input.dataset.i!);
            return acc;
          }, []);

          if (!selected.length) {
            tip("Select at least one element", false, "error");
            return;
          }

          const allAreSelected = selected.length === inputs.length;
          el.dataset.value = allAreSelected ? "" : selected.join(",");
          el.innerHTML = allAreSelected ? "all" : "some";
          el.setAttribute("title", getLimitTip(selected.map(Number), data));
          $(this).dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function applyMilitaryOptions(): void {
    const unitLines = Array.from(tableBody.querySelectorAll("tr"));
    const names = unitLines.map(r => sanitizeId(r.querySelector("input")!.value));
    if (new Set(names).size !== names.length) {
      tip("All units should have unique names", false, "error");
      return;
    }

    $("#militaryOptions").dialog("close");

    options.military = unitLines.map((r, i) => {
      const elements = Array.from(
        r.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>("input, button, select")
      );
      const values = elements.map(el => {
        const { type, value } = (el as HTMLElement).dataset || {};
        if (type === "icon") {
          const html = el.innerHTML.trim();
          const isImage = html.startsWith("<img");
          return isImage ? html.match(/src="([^"]*)"/)![1] : html || "⠀";
        }
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
    localStorage.setItem("military", JSON.stringify(options.military));
    Military.generate();
    rebuildMilitaryColumns();
  }
}

function renderOptions(): void {
  document.getElementById("militaryOptions")?.remove();
  const optionsHtml = /* html */ `<div id="militaryOptions" class="dialog stable">
      <div class="table">
        <table id="militaryOptionsTable">
          <thead>
            <tr>
              <th data-tip="Unit icon">Icon</th>
              <th data-tip="Unit name. If name is changed for existing unit, old unit will be replaced">Unit name</th>
              <th style="width: 5em" data-tip="Select allowed biomes">Biomes</th>
              <th style="width: 5em" data-tip="Select allowed states">States</th>
              <th style="width: 5em" data-tip="Select allowed cultures">Cultures</th>
              <th style="width: 5em" data-tip="Select allowed religions">Religions</th>
              <th data-tip="Conscription percentage for rural population">Rural</th>
              <th data-tip="Conscription percentage for urban population">Urban</th>
              <th data-tip="Average number of people in crew (used for total personnel calculation)">Crew</th>
              <th data-tip="Unit military power (used for battle simulation)">Power</th>
              <th data-tip="Unit type to apply special rules on forces recalculation">Type</th>
              <th data-tip="Check if unit is separate and can be stacked only with units of the same type">
                Separate
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
    "Are you sure you want to recalculate military forces for all states?<br>Regiments for all states will be regenerated";
  $("#alert").dialog({
    resizable: false,
    title: "Recalculate military",
    buttons: {
      Recalculate: function () {
        $(this).dialog("close");
        Military.generate();
        Layers.draw("military");
        refreshMilitaryOverview();
      },
      Cancel: function () {
        $(this).dialog("close");
      }
    }
  });
}

function downloadMilitaryData(): void {
  const units = options.military.map(u => u.name);
  let data = `Id,State,${units.map(u => capitalize(u)).join(",")},Total,Population,Rate,War Alert\n`; // headers

  for (const row of getMilitaryData()) {
    data += `${row.state.i},${row.state.name},${units.map(unit => row.forces[unit] || 0).join(",")},${row.total},${row.population},${rn(row.rate, 2)}%,${row.alert}\n`;
  }

  const name = `${getFileName("Military")}.csv`;
  downloadFile(data, name);
}

export const MilitaryOverview = { open };
