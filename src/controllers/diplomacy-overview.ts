import { interpolateString, select } from "d3";
import { closeDialogs, confirmationDialog, destroyDialog, updateDialog } from "@/components/dialog/dialog-helpers";
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
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { isRelation, RELATIONS } from "@/data/diplomacy";
import type { State } from "@/generators/states-generator";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { removeRelationsMark, showRelations } from "@/renderers/overlays/diplomacy";
import { downloadFile, getFileName } from "@/utils";
import { ensureEl, findEl, getPointer } from "../utils";

const dialogId = "diplomacyOverview" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };

const columns: EditorColumn<State>[] = [
  {
    key: "name",
    label: "State",
    width: "15em",
    permanent: true,
    sortBy: state => state.fullName || state.name,
    sortType: "alpha"
  },
  {
    key: "relations",
    label: "Relations",
    width: "7em",
    permanent: true,
    sortBy: state => state.diplomacy?.[selectedDiplomacyId] ?? "",
    sortType: "alpha"
  }
];

const diplomacyTable = initEditorTable<State>({
  getData: () =>
    sortDataByColumns(
      dialogId,
      pack.states.filter(state => state.i && !state.removed && state.i !== selectedDiplomacyId),
      columns
    ),
  onUpdate: renderDiplomacyPage
});

let selectedDiplomacyId = 0;
let editing = false; // the Diplomacy Editor is open from here

function open(): void {
  if (customization) return;
  if (pack.states.filter(s => s.i && !s.removed).length < 2) {
    tip("There should be at least 2 states to edit the diplomacy", false, "error");
    return;
  }
  if (!selectedDiplomacyId || !pack.states[selectedDiplomacyId] || pack.states[selectedDiplomacyId].removed) {
    selectedDiplomacyId = pack.states.find(state => state.i && !state.removed)!.i;
  }

  closeDialogs(`#${dialogId}, .stable`);
  Layers.show("states", "borders");
  Layers.hide("provinces", "cultures", "biomes", "religions");

  renderDialog();
  refreshDiplomacyOverview();
  attachMapSelection();

  $(`#${dialogId}`).dialog({
    title: "Diplomacy Overview",
    resizable: false,
    width: "fit-content",
    close: closeDiplomacyOverview,
    position
  });
}

function renderDialog(): void {
  destroyDialog(dialogId);
  const editorHtml = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
      ${renderEditorHeader({ dialogId, columns })}
      <div id="diplomacyBodySection" class="table"></div>
      <div id="diplomacyFooter" class="totalLine"><div>States: <span id="diplomacyFooterStates">0</span></div></div>
      <div id="diplomacyBottom" class="editorToolbar">
        <button id="diplomacyOverviewRefresh" data-tip="Refresh the Overview" class="icon-cw"></button>
        <button
          id="diplomacyEditRelations"
          data-tip="Change relations: click or drag over states on the map"
          class="icon-brush"
        ></button>
        <button id="diplomacyRegenerate" data-tip="Regenerate diplomatical relations" class="icon-retweet"></button>
        <button id="diplomacyHistory" data-tip="Show relations history" class="icon-hourglass-1"></button>
        <button id="diplomacyShowMatrix" data-tip="Show relations matrix" class="icon-list-bullet"></button>
        <button
          id="diplomacyExport"
          data-tip="Save state relations matrix as a text file (.csv)"
          class="icon-download"
        ></button>
      </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  bindColumnSorting(dialogId, diplomacyTable.reset);
  applyLineHighlighting(dialogId, ({ cellId }) => pack.cells.state[cellId]);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });

  ensureEl("diplomacyOverviewRefresh").addEventListener("click", refreshDiplomacyOverview);
  ensureEl("diplomacyRegenerate").addEventListener("click", regenerateRelations);
  ensureEl("diplomacyShowMatrix").addEventListener("click", showMatrix);
  ensureEl("diplomacyHistory").addEventListener("click", showHistory);
  ensureEl("diplomacyEditRelations").addEventListener("click", editRelations);
  ensureEl("diplomacyExport").addEventListener("click", exportCsv);

  ensureEl("diplomacyBodySection").addEventListener("click", ev => {
    const el = ev.target as HTMLElement;
    const line = el.closest<HTMLElement>(".states");
    if (line && !line.classList.contains("Self")) selectState(+line.dataset.id!);
  });
}

function refreshDiplomacyOverview(): void {
  diplomacyTable.reset();
  Layers.show("states");
  showRelations(selectedDiplomacyId);
  if (findEl("diplomacyMatrix")) showMatrix();
}

function attachMapSelection(): void {
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", selectStateOnMapClick);
}

function editRelations(): void {
  editing = true;
  void Controllers.DiplomacyEditor.open(selectedDiplomacyId, {
    onSelect: selectState,
    onClose: () => {
      editing = false;
      if (!findEl(dialogId)) return;
      attachMapSelection();
      refreshDiplomacyOverview();
    }
  });
}

// add line for each state
function renderDiplomacyPage(view: TableView<State>): void {
  const body = ensureEl("diplomacyBodySection");
  const states = pack.states;
  const selectedId = selectedDiplomacyId;
  const selectedName = states[selectedId].name;

  EmblemRenderer.trigger(`stateCOA${selectedId}`, states[selectedId].coa);
  let lines = /* html */ `<div class="states Self" data-id=${selectedId} data-tip="List below shows relations to ${selectedName}">
    <div data-col="name"><svg class="coaIcon" viewBox="0 0 200 200"><use href="#stateCOA${selectedId}"></use></svg><span>${states[selectedId].fullName}</span></div>
    <div data-col="relations"></div>
  </div>`;

  for (const state of view.rows) {
    const storedRelation = state.diplomacy?.[selectedId] ?? "x";
    const relation = isRelation(storedRelation) ? storedRelation : "Invalid";
    const { color, inText } = RELATIONS[relation] ?? { color: "#a9a9a9", inText: "has an invalid relation to" };

    const tipText = `${state.name} ${inText} ${selectedName}`;
    const tipSelect = `${tipText}. Click to see relations to ${state.name}`;

    const name = state.fullName!.length < 23 ? state.fullName : state.name;
    EmblemRenderer.trigger(`stateCOA${state.i}`, state.coa);

    lines += /* html */ `<div class="states" data-id=${state.i} data-name="${name}" data-relations="${relation}">
      <div data-col="name" data-tip="${tipSelect}"><svg class="coaIcon" viewBox="0 0 200 200"><use href="#stateCOA${state.i}"></use></svg><span>${name}</span></div>
      <div data-col="relations" data-tip="${tipText}">
        <fill-box fill="${color}" size=".9em"></fill-box>
        ${relation}
      </div>
    </div>`;
  }
  body.innerHTML = lines;

  // add listeners
  body.querySelectorAll("div.states").forEach(el => {
    el.addEventListener("mouseenter", stateHighlightOn);
  });
  body.querySelectorAll("div.states").forEach(el => {
    el.addEventListener("mouseleave", stateHighlightOff);
  });

  ensureEl("diplomacyFooterStates").textContent = String(view.all.length + 1);
  renderEditorPagination(ensureEl("diplomacyFooter"), view, diplomacyTable.goto);
  updateDialog(dialogId, { width: "fit-content", position });
}

function stateHighlightOn(event: Event): void {
  if (!Layers.isOn("states")) return;
  const state = +(event.target as HTMLElement).dataset.id!;
  if (customization || !state) return;
  const d = select<SVGGElement, unknown>("#regions").select(`#state${state}`).attr("d");

  const path = select("#debug")
    .append("path")
    .attr("class", "highlight")
    .attr("d", d)
    .attr("fill", "none")
    .attr("stroke", "red")
    .attr("stroke-width", 1)
    .attr("opacity", 1)
    .attr("filter", "url(#blur1)");

  const l = (path.node() as SVGPathElement).getTotalLength();
  const dur = (l + 5000) / 2;
  const i = interpolateString(`0,${l}`, `${l},${l}`);
  path
    .transition()
    .duration(dur)
    .attrTween("stroke-dasharray", () => t => i(t));
}

function stateHighlightOff(): void {
  select("#debug")
    .selectAll<SVGElement, unknown>(".highlight")
    .each(function () {
      select(this).transition().duration(1000).attr("opacity", 0).remove();
    });
}

function selectStateOnMapClick(this: SVGElement, event: MouseEvent): void {
  const [x, y] = getPointer(event, this);
  const cell = Pack.findCell(x, y);
  const stateId = cell === undefined ? 0 : pack.cells.state[cell];
  if (pack.states[stateId] && !pack.states[stateId].removed) selectState(stateId);
}

function selectState(stateId: number): void {
  if (!stateId || stateId === selectedDiplomacyId) return;
  selectedDiplomacyId = stateId;
  refreshDiplomacyOverview();
  if (editing) void Controllers.DiplomacyEditor.open(stateId);
}

function regenerateRelations(): void {
  confirmationDialog({
    title: "Regenerate relations",
    message: "Are you sure you want to regenerate relations of all states? <br>This action cannot be reverted",
    confirm: "Regenerate",
    onConfirm: async () => {
      if (editing) await Controllers.DiplomacyEditor.close();
      States.generateDiplomacy();
      refreshDiplomacyOverview();
    }
  });
}

function showHistory(): void {
  const chronicle = States.getChronicle();

  let message = /* html */ `<div autocorrect="off" spellcheck="false">`;
  chronicle.forEach((entry, index) => {
    message += `<div>`;
    entry.forEach((line, entryIndex) => {
      message += /* html */ `<div contenteditable="true" data-id="${index}-${entryIndex}"
        ${entryIndex ? "" : "style='font-weight:bold'"}>${line}</div>`;
    });
    message += `&#8205;</div>`;
  });

  if (!chronicle.length) {
    pack.states[0].diplomacy = [[]] as unknown as string[];
    message += /* html */ `<div><div contenteditable="true" data-id="0-0">No historical records</div>&#8205;</div>`;
  }

  alertMessage.innerHTML = `${message}</div><div class="info-line">Type to edit. Press Enter to add a new line, empty the element to remove it</div>`;
  alertMessage.querySelectorAll("div[contenteditable='true']").forEach(el => {
    el.addEventListener("input", changeReliationsHistory);
  });

  $("#alert").dialog({
    title: "Relations history",
    position: { my: "center", at: "center", of: "svg" },
    buttons: {
      Save: function (this: HTMLElement) {
        const data = this.querySelector("div")!.innerText.split("\n").join("\r\n");
        const name = `${getFileName("Relations history")}.txt`;
        downloadFile(data, name);
      },
      Clear: function (this: HTMLElement) {
        pack.states[0].diplomacy = [] as unknown as string[];
        $(this).dialog("close");
      },
      Close: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function changeReliationsHistory(this: HTMLElement): void {
  const i = this.dataset.id!.split("-");
  const group = States.getChronicle()[+i[0]];
  if (this.innerHTML === "") {
    group.splice(+i[1], 1);
    this.remove();
  } else group[+i[1]] = this.innerHTML;
}

function showMatrix(): void {
  renderMatrix();
  const states = pack.states.filter(s => s.i && !s.removed);
  const diplomacyMatrixBody = ensureEl("diplomacyMatrixBody");

  let table = `<table><thead><tr><th data-tip='&#8205;'></th>`;
  table += `${states.map(state => `<th data-tip='Relations to ${state.fullName}'>${state.name}</th>`).join("")}</tr>`;
  table += `<tbody>`;

  states.forEach(state => {
    table += `<tr data-id=${state.i}><th data-tip='Relations of ${state.fullName}'>${state.name}</th>${states
      .map(objectState => {
        if (state.i === objectState.i) return `<td class="x">x</td>`;
        const relation = state.diplomacy?.[objectState.i] ?? "x";
        if (!isRelation(relation)) {
          return `<td data-tip="Invalid relation" class="Unknown">Invalid</td>`;
        }
        const t = `${state.fullName} ${RELATIONS[relation].inText} ${objectState.fullName}`;
        return `<td data-tip='${t}' class='${relation}'>${relation}</td>`;
      })
      .join("")}</tr>`;
  });

  table += `</tbody></table>`;
  diplomacyMatrixBody.innerHTML = table;

  $("#diplomacyMatrix").dialog({
    title: "Relations matrix",
    position: { my: "center", at: "center", of: "svg" },
    close: closeDiplomacyMatrix,
    buttons: {}
  });
}

function renderMatrix(): void {
  destroyDialog("diplomacyMatrix");
  const matrixHtml = /* html */ `<div id="diplomacyMatrix" class="dialog">
      <div id="diplomacyMatrixBody" class="matrix-table"></div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", matrixHtml);
}

function closeDiplomacyMatrix(): void {
  $("#diplomacyMatrix").dialog("destroy");
  ensureEl("diplomacyMatrix").remove();
}

function exportCsv(): void {
  const states = pack.states.filter(s => s.i && !s.removed);
  const valid = states.map(s => s.i);

  let data = `,${states.map(s => s.name).join(",")}\n`; // headers
  states.forEach(s => {
    const rels = s.diplomacy!.filter((_v, i) => valid.includes(i));
    data += `${s.name},${rels.join(",")}\n`;
  });

  const name = `${getFileName("Relations")}.csv`;
  downloadFile(data, name);
}

function closeDiplomacyOverview(): void {
  if (editing) void Controllers.DiplomacyEditor.close();
  editing = false;
  applyDefaultViewboxEvents();
  clearMainTip();
  const selected = ensureEl("diplomacyBodySection").querySelector("div.Self");
  if (selected) selected.classList.remove("Self");
  select("#debug").selectAll(".highlight").remove();
  removeRelationsMark();
  Layers.draw("states");
  $(`#${dialogId}`).dialog("destroy");
  ensureEl(dialogId).remove();
}

export const DiplomacyOverview = { open, showHistory, exportCsv };
