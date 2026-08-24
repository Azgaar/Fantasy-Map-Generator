import { color as d3Color, select } from "d3";
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
import { clearMainTip, tip } from "@/components/tooltips";
import { showDomDialog } from "@/components/ui/dom-dialog";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import type { State } from "@/generators/states-generator";
import { getAssignmentOverlay } from "@/renderers/interaction/map-domain-overlay";
import {
  clearMapInteractionOverlay,
  getPixiMapPointAtClient,
  updateMapInteractionOverlay
} from "@/renderers/pixi/pixi-renderer-controller";
import { downloadFile, getFileName } from "@/utils";
import { ensureEl, findEl, getAdjective } from "../utils";

interface Relation {
  inText: string;
  color: string;
  tip: string;
}

const relations: Record<string, Relation> = {
  Ally: {
    inText: "is an ally of",
    color: "#00b300",
    tip: "Allies formed a defensive pact and protect each other in case of third party aggression"
  },
  Friendly: {
    inText: "is friendly to",
    color: "#d4f8aa",
    tip: "State is friendly to anouther state when they share some common interests"
  },
  Neutral: {
    inText: "is neutral to",
    color: "#edeee8",
    tip: "Neutral means states relations are neither positive nor negative"
  },
  Suspicion: {
    inText: "is suspicious of",
    color: "#eeafaa",
    tip: "Suspicion means state has a cautious distrust of another state"
  },
  Enemy: { inText: "is at war with", color: "#e64b40", tip: "Enemies are states at war with each other" },
  Unknown: {
    inText: "does not know about",
    color: "#a9a9a9",
    tip: "Relations are unknown if states do not have enough information about each other"
  },
  Rival: {
    inText: "is a rival of",
    color: "#ad5a1f",
    tip: "Rivalry is a state of competing for dominance in the region"
  },
  Vassal: { inText: "is a vassal of", color: "#87CEFA", tip: "Vassal is a state having obligation to its suzerain" },
  Suzerain: {
    inText: "is suzerain to",
    color: "#00008B",
    tip: "Suzerain is a state having some control over its vassals"
  }
};

const dialogId = "diplomacyEditor" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
let selectedDiplomacyId = 0;
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
    sortBy: state => state.diplomacy?.[selectedDiplomacyId] ?? "",
    sortType: "alpha"
  },
  { key: "actions", width: "1.4em", permanent: true }
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

// state 0 stores the diplomacy chronicle (array of [title, ...messages]) rather than relations
const getChronicle = () => pack.states[0].diplomacy as unknown as string[][];

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
  if (!window.LayerControls.isLayerOn("toggleStates")) window.LayerControls.toggleLayer("toggleStates");
  if (!window.LayerControls.isLayerOn("toggleBorders")) window.LayerControls.toggleLayer("toggleBorders");
  if (window.LayerControls.isLayerOn("toggleProvinces")) window.LayerControls.toggleLayer("toggleProvinces");
  if (window.LayerControls.isLayerOn("toggleCultures")) window.LayerControls.toggleLayer("toggleCultures");
  if (window.LayerControls.isLayerOn("toggleBiomes")) window.LayerControls.toggleLayer("toggleBiomes");
  if (window.LayerControls.isLayerOn("toggleReligions")) window.LayerControls.toggleLayer("toggleReligions");

  renderDialog();
  refreshDiplomacyEditor();
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", selectStateOnMapClick);

  showDomDialog({
    content: ensureEl(dialogId),
    onClose: closeDiplomacyEditor,
    placement: "top-right",
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Diplomacy Editor",
    width: "fit-content"
  });
}

function renderDialog(): void {
  destroyDialog(dialogId);
  const editorHtml = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
      ${renderEditorHeader({ dialogId, columns })}
      <div id="diplomacyBodySection" class="table"></div>
      <div id="diplomacyFooter" class="totalLine"><div>States: <span id="diplomacyFooterStates">0</span></div></div>
      <div class="info-line">Click on state name to see relations.<br />Click on relations name to change it</div>
      <div id="diplomacyBottom" style="margin-top: 0.1em">
        <button id="diplomacyEditorRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
        <button
          id="diplomacyEditStyle"
          data-tip="Edit states (including diplomacy view) style in Style Editor"
          class="icon-adjust"
        ></button>
        <button id="diplomacyRegenerate" data-tip="Regenerate diplomatical relations" class="icon-retweet"></button>
        <button
          id="diplomacyReset"
          data-tip="Reset diplomatical relations of selected state to Neutral"
          class="icon-eraser"
        ></button>
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

  ensureEl("diplomacyEditorRefresh").addEventListener("click", refreshDiplomacyEditor);
  ensureEl("diplomacyEditStyle").addEventListener("click", () => window.StyleEditor.edit("regions"));
  ensureEl("diplomacyRegenerate").addEventListener("click", regenerateRelations);
  ensureEl("diplomacyReset").addEventListener("click", resetRelations);
  ensureEl("diplomacyShowMatrix").addEventListener("click", showRelationsMatrix);
  ensureEl("diplomacyHistory").addEventListener("click", showRelationsHistory);
  ensureEl("diplomacyExport").addEventListener("click", downloadDiplomacyData);

  ensureEl("diplomacyBodySection").addEventListener("click", ev => {
    const el = ev.target as HTMLElement;
    const line = el.closest<HTMLElement>(".states");
    if (!line || line.classList.contains("Self")) return;

    if (el.closest(".changeRelations")) {
      const subjectId = +line.dataset.id!;
      const objectId = +ensureEl("diplomacyBodySection").querySelector<HTMLElement>("div.Self")!.dataset.id!;
      const currentRelation = line.dataset.relations!;

      selectRelation(subjectId, objectId, currentRelation);
      return;
    }

    // select state of clicked line
    selectedDiplomacyId = +line.dataset.id!;
    refreshDiplomacyEditor();
  });
}

function refreshDiplomacyEditor(): void {
  diplomacyTable.reset();
  showStateRelations();
}

// add line for each state
function renderDiplomacyPage(view: TableView<State>): void {
  const body = ensureEl("diplomacyBodySection");
  const states = pack.states;
  const selectedId = selectedDiplomacyId;
  const selectedName = states[selectedId].name;

  COArenderer.trigger(`stateCOA${selectedId}`, states[selectedId].coa);
  let lines = /* html */ `<div class="states Self" data-id=${selectedId} data-tip="List below shows relations to ${selectedName}">
    <div data-col="name"><svg class="coaIcon" viewBox="0 0 200 200"><use href="#stateCOA${selectedId}"></use></svg><span>${states[selectedId].fullName}</span></div>
    <div data-col="relations"></div>
    <div data-col="actions"></div>
  </div>`;

  for (const state of view.rows) {
    const relation = state.diplomacy![selectedId];
    const { color, inText } = relations[relation];

    const tipText = `${state.name} ${inText} ${selectedName}`;
    const tipSelect = `${tipText}. Click to see relations to ${state.name}`;
    const tipChange = `Click to change relations. ${tipText}`;

    const name = state.fullName!.length < 23 ? state.fullName : state.name;
    COArenderer.trigger(`stateCOA${state.i}`, state.coa);

    lines += /* html */ `<div class="states" data-id=${state.i} data-name="${name}" data-relations="${relation}">
      <div data-col="name" data-tip="${tipSelect}"><svg class="coaIcon" viewBox="0 0 200 200"><use href="#stateCOA${state.i}"></use></svg><span>${name}</span></div>
      <div data-col="relations" data-tip="${tipChange}" class="changeRelations">
        <fill-box fill="${color}" size=".9em"></fill-box>
        ${relation}
      </div>
      <div data-col="actions"></div>
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
  if (!window.LayerControls.isLayerOn("toggleStates")) return;
  const stateId = Number((event.currentTarget as HTMLElement).dataset.id);
  if (customization || !stateId) return;
  updateMapInteractionOverlay({
    highlight: getAssignmentOverlay(pack.cells.state, stateId, {
      fill: "none",
      stroke: "red",
      strokeWidth: 1
    })
  });
}

function stateHighlightOff(): void {
  updateMapInteractionOverlay({ highlight: null });
}

function showStateRelations(): void {
  const selectedLine = ensureEl("diplomacyBodySection").querySelector<HTMLElement>("div.Self");
  const sel = selectedLine ? +selectedLine.dataset.id! : pack.states.find(s => s.i && !s.removed)!.i;
  if (!sel) return;
  if (!window.LayerControls.isLayerOn("toggleStates")) window.LayerControls.toggleLayer("toggleStates");

  const selection = pack.states
    .filter(state => state.i && !state.removed)
    .flatMap(state => {
      const relation = state.i === sel ? null : state.diplomacy?.[sel];
      const color = relation ? relations[relation]?.color || "#4682b4" : "#4682b4";
      return getAssignmentOverlay(pack.cells.state, state.i, {
        fill: color,
        fillOpacity: 0.75,
        stroke: d3Color(color)?.darker().hex() ?? color,
        strokeWidth: 0.5
      });
    });
  updateMapInteractionOverlay({ selection });
}

function selectStateOnMapClick(this: SVGElement, event: MouseEvent): void {
  const point = getPixiMapPointAtClient(event.clientX, event.clientY);
  if (!point) return;
  const i = findCell(point.x, point.y);
  if (i === undefined) return;
  const state = pack.cells.state[i];
  if (!state) return;
  if (selectedDiplomacyId === state) return;
  selectedDiplomacyId = state;
  refreshDiplomacyEditor();
}

function selectRelation(subjectId: number, objectId: number, currentRelation: string): void {
  const states = pack.states;
  const subject = states[subjectId];

  const relationsSelector = Object.entries(relations)
    .map(
      ([relation, { color, inText, tip }]) => /* html */ `
        <div data-tip="${tip}">
          <label class="pointer">
            <input type="radio" name="relationSelect" value="${relation}"
            ${currentRelation === relation ? "checked" : ""} >
            <fill-box fill="${color}" size=".8em"></fill-box>
            ${inText}
        </label>
        </div>
      `
    )
    .join("");

  const objectsSelector = states
    .filter(s => s.i && !s.removed && s.i !== subjectId)
    .map(
      s => /* html */ `
        <div data-tip="${s.fullName}">
          <input id="selectState${s.i}" class="checkbox" type="checkbox" name="objectSelect" value="${s.i}"
          ${s.i === objectId ? "checked" : ""} />
          <label for="selectState${s.i}" class="checkbox-label">
            <svg class="coaIcon" viewBox="0 0 200 200">
              <use href="#stateCOA${s.i}"></use>
            </svg>
            ${s.fullName}
          </label>
        </div>
      `
    )
    .join("");

  destroyDialog("relationsSelectionDialog");
  const content = document.createElement("div");
  content.id = "relationsSelectionDialog";
  content.innerHTML = /* html */ `
    <form id='relationsForm' style="overflow: hidden; display: flex; flex-direction: column; gap: .3em; padding: 0.1em 0;">
      <header>
        <svg class="coaIcon" viewBox="0 0 200 200">
          <use href="#stateCOA${subject.i}"></use>
        </svg>
        <b>${subject.fullName}</b>
      </header>

      <main style='display: flex; gap: 1em;'>
        <section style="display: flex; flex-direction: column; gap: .3em;">${relationsSelector}</section>
        <section style="display: flex; flex-direction: column; gap: .3em;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3em;">
            <label style="font-weight: 500; font-size: 0.95em;">States:</label>
            <button id="selectAllNoneBtn" type="button" style="padding: 0.3em 0.8em; cursor: pointer; font-size: 0.9em;" data-tip="Toggle selection of all states. Also supports Ctrl+A.">Select All / None</button>
          </div>
          <div id="stateSelectionContainer" style="display: flex; flex-direction: column; gap: .3em;">${objectsSelector}</div>
        </section>
      </main>
    </form>
  `;
  ensureEl("dialogs").appendChild(content);

  showDomDialog({
    actions: [
      {
        label: "Apply",
        onClick: () => {
          const formData = new FormData(content.querySelector<HTMLFormElement>("#relationsForm")!);
          const newRelation = formData.get("relationSelect") as string;
          const objectIds = [...formData.getAll("objectSelect")].map(Number);

          for (const oid of objectIds) changeRelation(subjectId, oid, currentRelation, newRelation);
        }
      },
      { label: "Cancel" }
    ],
    content,
    isModal: true,
    placement: "center",
    placementTarget: document.getElementById("map"),
    title: `Change relations`,
    width: "fit-content"
  });

  // Setup Select All / None toggle functionality
  const selectAllNoneBtn = content.querySelector<HTMLElement>("#selectAllNoneBtn")!;
  const stateCheckboxes = () =>
    content.querySelectorAll<HTMLInputElement>("#stateSelectionContainer input[name='objectSelect']");

  function updateButtonState(): void {
    const checkboxes = stateCheckboxes();
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    if (allChecked && checkboxes.length > 0) selectAllNoneBtn.classList.add("pressed");
    else selectAllNoneBtn.classList.remove("pressed");
  }

  function toggleSelectAll(): void {
    const checkboxes = stateCheckboxes();
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    const newState = !allChecked;
    checkboxes.forEach(cb => {
      cb.checked = newState;
    });
    updateButtonState();
  }

  selectAllNoneBtn.addEventListener("click", e => {
    e.preventDefault();
    toggleSelectAll();
  });

  updateButtonState();
}

function changeRelation(subjectId: number, objectId: number, oldRelation: string, newRelation: string): void {
  if (newRelation === oldRelation) return;
  const states = pack.states;
  const chronicle = getChronicle();

  const subjectName = states[subjectId].name;
  const objectName = states[objectId].name;

  states[subjectId].diplomacy![objectId] = newRelation;
  states[objectId].diplomacy![subjectId] =
    newRelation === "Vassal" ? "Suzerain" : newRelation === "Suzerain" ? "Vassal" : newRelation;

  // update relation history
  const change = (): string[] => [
    `Relations change`,
    `${subjectName}-${getAdjective(objectName)} relations changed to ${newRelation.toLowerCase()}`
  ];
  const ally = (): string[] => [`Defence pact`, `${subjectName} entered into defensive pact with ${objectName}`];
  const vassal = (): string[] => [`Vassalization`, `${subjectName} became a vassal of ${objectName}`];
  const suzerain = (): string[] => [`Vassalization`, `${subjectName} vassalized ${objectName}`];
  const rival = (): string[] => [`Rivalization`, `${subjectName} and ${objectName} became rivals`];
  const unknown = (): string[] => [
    `Relations severance`,
    `${subjectName} recalled their ambassadors and wiped all the records about ${objectName}`
  ];
  const war = (): string[] => [`War declaration`, `${subjectName} declared a war on its enemy ${objectName}`];
  const peace = (): string[] => {
    const treaty = `${subjectName} and ${objectName} agreed to cease fire and signed a peace treaty`;
    const changed =
      newRelation === "Ally"
        ? ally()
        : newRelation === "Vassal"
          ? vassal()
          : newRelation === "Suzerain"
            ? suzerain()
            : newRelation === "Unknown"
              ? unknown()
              : change();
    return [`War termination`, treaty, changed[1]];
  };

  if (oldRelation === "Enemy") chronicle.push(peace());
  else if (newRelation === "Enemy") chronicle.push(war());
  else if (newRelation === "Vassal") chronicle.push(vassal());
  else if (newRelation === "Suzerain") chronicle.push(suzerain());
  else if (newRelation === "Ally") chronicle.push(ally());
  else if (newRelation === "Unknown") chronicle.push(unknown());
  else if (newRelation === "Rival") chronicle.push(rival());
  else chronicle.push(change());

  refreshDiplomacyEditor();
  if (findEl("diplomacyMatrix")) showRelationsMatrix();
}

function regenerateRelations(): void {
  States.generateDiplomacy();
  refreshDiplomacyEditor();
}

function resetRelations(): void {
  const selectedId = +ensureEl("diplomacyBodySection").querySelector<HTMLElement>("div.Self")!.dataset.id!;
  if (!selectedId) return;
  const states = pack.states;

  states[selectedId].diplomacy!.forEach((relation, index) => {
    if (relation !== "x") {
      states[selectedId].diplomacy![index] = "Neutral";
      states[index].diplomacy![selectedId] = "Neutral";
    }
  });

  refreshDiplomacyEditor();
}

function showRelationsHistory(): void {
  const chronicle = getChronicle();

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

  destroyDialog("relationsHistoryDialog");
  const content = document.createElement("div");
  content.id = "relationsHistoryDialog";
  content.innerHTML = `${message}</div><div class="info-line">Type to edit. Press Enter to add a new line, empty the element to remove it</div>`;
  ensureEl("dialogs").appendChild(content);
  content.querySelectorAll("div[contenteditable='true']").forEach(el => {
    el.addEventListener("input", changeReliationsHistory);
  });

  showDomDialog({
    actions: [
      {
        close: false,
        label: "Save",
        onClick: () => {
          const data = content.querySelector<HTMLElement>(":scope > div")!.innerText.split("\n").join("\r\n");
          const name = `${getFileName("Relations history")}.txt`;
          downloadFile(data, name);
        }
      },
      {
        label: "Clear",
        onClick: () => {
          pack.states[0].diplomacy = [] as unknown as string[];
        }
      },
      { label: "Close" }
    ],
    content,
    placement: "center",
    placementTarget: document.getElementById("map"),
    title: "Relations history"
  });
}

function changeReliationsHistory(this: HTMLElement): void {
  const i = this.dataset.id!.split("-");
  const group = getChronicle()[+i[0]];
  if (this.innerHTML === "") {
    group.splice(+i[1], 1);
    this.remove();
  } else group[+i[1]] = this.innerHTML;
}

function showRelationsMatrix(): void {
  renderMatrix();
  const states = pack.states.filter(s => s.i && !s.removed);
  const valid = states.map(state => state.i);
  const diplomacyMatrixBody = ensureEl("diplomacyMatrixBody");

  let table = `<table><thead><tr><th data-tip='&#8205;'></th>`;
  table += `${states.map(state => `<th data-tip='Relations to ${state.fullName}'>${state.name}</th>`).join("")}</tr>`;
  table += `<tbody>`;

  states.forEach(state => {
    table += `<tr data-id=${state.i}><th data-tip='Relations of ${state.fullName}'>${state.name}</th>${state
      .diplomacy!.filter((_v, i) => valid.includes(i))
      .map((relation, index) => {
        const relationObj = relations[relation];
        if (!relationObj) return `<td class='${relation}'>${relation}</td>`;

        const objectState = pack.states[valid[index]];
        const t = `${state.fullName} ${relationObj.inText} ${objectState.fullName}`;
        return `<td data-id=${objectState.i} data-tip='${t}' class='${relation}'>${relation}</td>`;
      })
      .join("")}</tr>`;
  });

  table += `</tbody></table>`;
  diplomacyMatrixBody.innerHTML = table;

  const tableEl = diplomacyMatrixBody.querySelector("table")!;
  tableEl.addEventListener("click", event => {
    const el = event.target as HTMLElement;
    if (el.tagName !== "TD") return;

    const currentRelation = el.innerText;
    if (!relations[currentRelation]) return;

    const subjectId = +el.closest<HTMLElement>("tr")!.dataset.id!;
    const objectId = +el.dataset.id!;

    selectRelation(subjectId, objectId, currentRelation);
  });

  showDomDialog({
    content: ensureEl("diplomacyMatrix"),
    onClose: closeDiplomacyMatrix,
    placement: "center",
    placementTarget: document.getElementById("map"),
    resizable: true,
    title: "Relations matrix"
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
  destroyDialog("diplomacyMatrix");
}

function downloadDiplomacyData(): void {
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

function closeDiplomacyEditor(): void {
  applyDefaultViewboxEvents();
  clearMainTip();
  const selected = ensureEl("diplomacyBodySection").querySelector("div.Self");
  if (selected) selected.classList.remove("Self");
  if (window.LayerControls.isLayerOn("toggleStates")) window.LayerControls.redrawLayer("toggleStates");
  else window.LayerControls.toggleLayer("toggleStates");
  clearMapInteractionOverlay();
  destroyDialog(dialogId);
}

export const DiplomacyEditor = { open };
