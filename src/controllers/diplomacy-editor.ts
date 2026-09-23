import { color as d3Color, interpolateString, select } from "d3";
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
import { Layers } from "@/components/layers";
import { MapBrush } from "@/components/map-brush";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import type { State } from "@/generators/states-generator";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { downloadFile, getFileName } from "@/utils";
import { ensureEl, findEl, getAdjective, getPointer } from "../utils";

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
const relationsDialogId = "diplomacyRelations";
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
  Layers.show("states", "borders");
  Layers.hide("provinces", "cultures");
  Layers.hide("biomes", "religions");

  renderDialog();
  refreshDiplomacyEditor();
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", selectStateOnMapClick);

  $(`#${dialogId}`).dialog({
    title: "Diplomacy Editor",
    resizable: false,
    width: "fit-content",
    close: closeDiplomacyEditor,
    position
  });
}

function renderDialog(): void {
  destroyDialog(dialogId);
  const editorHtml = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
      ${renderEditorHeader({ dialogId, columns })}
      <div id="diplomacyBodySection" class="table"></div>
      <div id="diplomacyFooter" class="totalLine"><div>States: <span id="diplomacyFooterStates">0</span></div></div>
      <div class="info-line">Click on state name to see relations.<br />Click on relations name to change it</div>
      <div id="diplomacyBottom" class="editorToolbar">
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
        <button id="diplomacyEditRelations" data-tip="Open Change relations, then click a state on the map" class="icon-brush"></button>
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
  ensureEl("diplomacyEditStyle").addEventListener("click", () => editStyle("regions"));
  ensureEl("diplomacyRegenerate").addEventListener("click", regenerateRelations);
  ensureEl("diplomacyReset").addEventListener("click", resetRelations);
  ensureEl("diplomacyShowMatrix").addEventListener("click", showRelationsMatrix);
  ensureEl("diplomacyHistory").addEventListener("click", showRelationsHistory);
  ensureEl("diplomacyEditRelations").addEventListener("click", () => selectRelation(selectedDiplomacyId, 0, ""));
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

  EmblemRenderer.trigger(`stateCOA${selectedId}`, states[selectedId].coa);
  let lines = /* html */ `<div class="states Self" data-id=${selectedId} data-tip="List below shows relations to ${selectedName}">
    <div data-col="name"><svg class="coaIcon" viewBox="0 0 200 200"><use href="#stateCOA${selectedId}"></use></svg><span>${states[selectedId].fullName}</span></div>
    <div data-col="relations"></div>
  </div>`;

  for (const state of view.rows) {
    const storedRelation = state.diplomacy?.[selectedId] ?? "x";
    const relation = Object.hasOwn(relations, storedRelation) ? storedRelation : "Invalid";
    const { color, inText } = relations[relation] ?? { color: "#a9a9a9", inText: "has an invalid relation to" };

    const tipText = `${state.name} ${inText} ${selectedName}`;
    const tipSelect = `${tipText}. Click to see relations to ${state.name}`;
    const tipChange = `Click to change relations. ${tipText}`;

    const name = state.fullName!.length < 23 ? state.fullName : state.name;
    EmblemRenderer.trigger(`stateCOA${state.i}`, state.coa);

    lines += /* html */ `<div class="states" data-id=${state.i} data-name="${name}" data-relations="${relation}">
      <div data-col="name" data-tip="${tipSelect}"><svg class="coaIcon" viewBox="0 0 200 200"><use href="#stateCOA${state.i}"></use></svg><span>${name}</span></div>
      <div data-col="relations" data-tip="${tipChange}" class="changeRelations">
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

function showStateRelations(sourceId?: number): void {
  const selectedLine = ensureEl("diplomacyBodySection").querySelector<HTMLElement>("div.Self");
  const selectedId = sourceId ?? (selectedLine ? +selectedLine.dataset.id! : pack.states.find(s => s.i && !s.removed)!.i);
  if (!selectedId) return;

  Layers.show("states");

  select<SVGGElement, unknown>("#statesBody")
    .selectAll<SVGPathElement, unknown>("path")
    .each(function () {
      if (this.id.slice(0, 9) === "state-gap") return;  // exclude state gap element
      const id = +this.id.slice(5); // state id
	  
      const relation =
        (sourceId === undefined ? pack.states[id].diplomacy?.[selectedId] : pack.states[selectedId].diplomacy?.[id]) ??
        "x";

      const color = relations[relation]?.color || "#4682b4";

      this.setAttribute("fill", color);
      select<SVGGElement, unknown>("#statesBody").select(`#state-gap${id}`).attr("stroke", color);
      select<SVGGElement, unknown>("#statesHalo")
        .select(`#state-border${id}`)
        .attr("stroke", d3Color(color)!.darker().hex());
    });
}

function selectStateOnMapClick(this: SVGElement, event: MouseEvent): void {
  const point = getPointer(event, this);
  const i = Pack.findCell(point[0], point[1])!;
  const state = pack.cells.state[i];
  if (!state || !pack.states[state] || pack.states[state].removed || selectedDiplomacyId === state) return;

  selectedDiplomacyId = state;
  refreshDiplomacyEditor();
}

function selectRelation(subjectId: number, objectId: number, currentRelation: string): void {
  closeRelationsDialog();
  const states = pack.states;
  type RelationSnapshot = { subject: string | undefined; object: string | undefined; objectHadDiplomacy: boolean };
  type PaintStroke = {
    subjectId: number;
    relations: Map<number, RelationSnapshot>;
    history: string[][];
    subjectHadDiplomacy: boolean;
  };
  const undoStack: PaintStroke[] = [];
  let activeStroke: PaintStroke | null = null;
  let brushActive = false;
  let minimized = false;
  let strokeChanged = false;
  let paintFrame = 0;
  const brush = new MapBrush({
    id: "diplomacyBrushRadius",
    label: "Brush size:",
    radius: 12,
    onStart: (_point, radius) => {
      const relation = dialog.querySelector<HTMLInputElement>('input[name="relationSelect"]:checked')?.value;
      if (!relation || !Object.hasOwn(relations, relation)) {
        tip("Please choose a relation", false, "warn");
        return;
      }
      activeStroke = { subjectId, relations: new Map(), history: [], subjectHadDiplomacy: !!states[subjectId].diplomacy };
      return point => paintTargets(point, radius, relation);
    },
    onEnd: () => {
      if (activeStroke?.history.length) {
        undoStack.push(activeStroke);
        undoButton.disabled = false;
      }
      activeStroke = null;
      if (!strokeChanged) return;
      if (paintFrame) {
        cancelAnimationFrame(paintFrame);
        paintFrame = 0;
        refreshPaintedView();
      }
      strokeChanged = false;
      if (findEl("diplomacyMatrix")) showRelationsMatrix();
    }
  });

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

  function renderObjects(selectedId: number, checkedId = 0): string {
    return states
      .filter(s => s.i && !s.removed && s.i !== selectedId)
      .map(
        s => /* html */ `
        <div data-tip="${s.fullName}">
          <input id="selectState${s.i}" class="checkbox" type="checkbox" name="objectSelect" value="${s.i}"
          ${s.i === checkedId ? "checked" : ""} />
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
  }

  const dialog = document.createElement("div");
  dialog.id = relationsDialogId;
  dialog.className = "dialog";
  dialog.innerHTML = /* html */ `
    <form id='relationsForm' style="overflow: hidden; display: flex; flex-direction: column; gap: .3em; padding: 0.1em 0;">
      <div id="diplomacyRelationsHelp" class="info-line">Choose a relation, then select targets in the list or use the brush to visually change relations and click Apply.</div>
      <main style='display: flex; gap: 1em;'>
        <section style="display: flex; flex-direction: column; gap: .3em;">
          <header id="diplomacyRelationsHeader">
            <svg class="coaIcon" viewBox="0 0 200 200"><use href="#stateCOA${subjectId}"></use></svg>
            <b>${states[subjectId].fullName}</b>
          </header>
          ${relationsSelector}
          <div>
            <button id="diplomacyPaint" type="button" class="icon-brush" data-tip="Paint the chosen relation on states"></button>
            <button id="diplomacyUndo" type="button" class="icon-ccw" aria-label="Undo" data-tip="Undo last brush stroke" disabled></button>
          </div>
          <div id="diplomacyBrushControls" style="display: none">${brush.markup}</div>
          <div>
            <button id="diplomacyApply" type="button">Apply</button>
            <button id="diplomacyClose" type="button">Close</button>
          </div>
        </section>
        <section id="diplomacyTargets" style="display: flex; flex-direction: column; gap: .3em;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3em;">
            <label style="font-weight: 500; font-size: 0.95em;">States:</label>
            <button id="selectAllNoneBtn" type="button" style="padding: 0.3em 0.8em; cursor: pointer; font-size: 0.9em;" data-tip="Toggle selection of all states.">Select All / None</button>
          </div>
          <div id="stateSelectionContainer" style="display: flex; flex-direction: column; gap: .3em;">${renderObjects(subjectId, objectId)}</div>
        </section>
      </main>
    </form>
  `;

  ensureEl("dialogs").appendChild(dialog);
  const viewbox = select<SVGElement, unknown>("#viewbox");
  const previousClick = viewbox.on("click");
  function refreshPaintedView(): void {
    selectedDiplomacyId = subjectId;
    diplomacyTable.reset();
    showStateRelations(subjectId);
  }

  function selectSubjectOnMap([x, y]: [number, number]): void {
    const cell = Pack.findCell(x, y);
    if (cell === undefined) return;
    const stateId = pack.cells.state[cell];
    if (!stateId || !states[stateId] || states[stateId].removed) return;
    selectSubject(stateId);
  }

  function selectSubject(stateId: number): void {
    if (stateId === subjectId) return;
    subjectId = stateId;
    const header = ensureEl("diplomacyRelationsHeader");
    header.querySelector("use")!.setAttribute("href", `#stateCOA${stateId}`);
    header.querySelector("b")!.textContent = states[stateId].fullName || states[stateId].name;
    ensureEl("stateSelectionContainer").innerHTML = renderObjects(stateId);
    refreshPaintedView();
    updateButtonState();
    $(dialog).dialog("option", "width", "fit-content");
  }

  function paintTargets([x, y]: [number, number], radius: number, relation: string): void {
    const stroke = activeStroke;
    if (!stroke) return;
    const subject = states[stroke.subjectId];
    const cells = radius > 5 ? Pack.findAll(x, y, radius) : [Pack.findCell(x, y)];
    const inverse = relation === "Vassal" ? "Suzerain" : relation === "Suzerain" ? "Vassal" : relation;
    let changed = false;
    const stateIds = new Set(
      cells
        .filter((cell): cell is number => cell !== undefined)
        .map(cell => pack.cells.state[cell])
        .filter(stateId => stateId && stateId !== stroke.subjectId && !states[stateId].removed)
    );
    for (const stateId of stateIds) {
      const object = states[stateId];
      if (subject.diplomacy?.[stateId] === relation && object.diplomacy?.[stroke.subjectId] === inverse) continue;
      const original = {
        subject: subject.diplomacy?.[stateId],
        object: object.diplomacy?.[stroke.subjectId],
        objectHadDiplomacy: !!object.diplomacy
      };
      if (!stroke.relations.has(stateId)) stroke.relations.set(stateId, original);
      changeRelation(stroke.subjectId, stateId, relation);
      const historyEntry = getChronicle().at(-1)!;
      stroke.history.push(historyEntry);
      strokeChanged = true;
      changed = true;
    }
    if (changed && !paintFrame) {
      paintFrame = requestAnimationFrame(() => {
        paintFrame = 0;
        refreshPaintedView();
      });
    }
  }

  function restoreRelations(stroke: PaintStroke): void {
    const subject = states[stroke.subjectId];
    for (const [stateId, original] of stroke.relations) {
      if (original.subject === undefined) delete subject.diplomacy?.[stateId];
      else subject.diplomacy![stateId] = original.subject;
      if (original.object === undefined) delete states[stateId].diplomacy?.[stroke.subjectId];
      else states[stateId].diplomacy![stroke.subjectId] = original.object;
      if (!original.objectHadDiplomacy) Reflect.deleteProperty(states[stateId], "diplomacy");
    }
    if (!stroke.subjectHadDiplomacy) Reflect.deleteProperty(subject, "diplomacy");
  }

  function removeHistory(entries: string[][]): void {
    const chronicle = getChronicle();
    for (const entry of entries) {
      const index = chronicle.indexOf(entry);
      if (index !== -1) chronicle.splice(index, 1);
    }
  }

  function undoPaint(): void {
    const stroke = undoStack.pop();
    if (!stroke) return;
    if (paintFrame) cancelAnimationFrame(paintFrame);
    paintFrame = 0;
    restoreRelations(stroke);
    removeHistory(stroke.history);
    strokeChanged = false;
    undoButton.disabled = !undoStack.length;
    if (subjectId === stroke.subjectId) refreshPaintedView();
    else selectSubject(stroke.subjectId);
    if (findEl("diplomacyMatrix")) showRelationsMatrix();
  }

  function attachMapSelection(): void {
    viewbox.style("cursor", "crosshair").on("click", function (event: MouseEvent) {
      selectSubjectOnMap(getPointer(event, this));
    });
  }

  attachMapSelection();
  const paintButton = ensureEl("diplomacyPaint");
  const undoButton = ensureEl<HTMLButtonElement>("diplomacyUndo");
  const brushControls = ensureEl("diplomacyBrushControls");
  function setBrushActive(active: boolean): void {
    brushActive = active;
    paintButton.classList.toggle("pressed", active);
    brushControls.style.display = active ? "block" : "none";
    if (active) {
      setMinimized(true);
      brush.attach();
    } else {
      brush.detach();
      attachMapSelection();
    }
    $(dialog).dialog("option", "width", "fit-content");
  }
  paintButton.addEventListener("click", () => setBrushActive(!brushActive));
  undoButton.addEventListener("click", undoPaint);

  ensureEl("diplomacyApply").addEventListener("click", () => {
    if (brushActive) setBrushActive(false);
    setMinimized(false);
    const formData = new FormData(ensureEl<HTMLFormElement>("relationsForm"));
    const objectIds = [...formData.getAll("objectSelect")].map(Number);
    const newRelation = formData.get("relationSelect");
    if (objectIds.length) {
      if (typeof newRelation !== "string" || !Object.hasOwn(relations, newRelation)) {
        tip("Please choose a relation", false, "warn");
        return;
      }
      for (const oid of objectIds) changeRelation(subjectId, oid, newRelation);
    }
    if (paintFrame) cancelAnimationFrame(paintFrame);
    paintFrame = 0;
    undoStack.length = 0;
    undoButton.disabled = true;
    refreshPaintedView();
    if (findEl("diplomacyMatrix")) showRelationsMatrix();
  });
  ensureEl("diplomacyClose").addEventListener("click", () => $(dialog).dialog("close"));

  $(dialog).dialog({
    width: "fit-content",
    title: `Change relations`,
    close: () => {
      if (paintFrame) cancelAnimationFrame(paintFrame);
      if (brushActive) brush.detach();
      if (previousClick) viewbox.on("click", previousClick);
      else viewbox.on("click", null);
      refreshDiplomacyEditor();
      destroyDialog(relationsDialogId);
    }
  });

  const minimizeButton = $(dialog).dialog("widget")[0].querySelector<HTMLButtonElement>(".ui-dialog-titlebar-collapse");
  if (minimizeButton) minimizeButton.dataset.tip = "Show only relation choices";
  function setMinimized(value: boolean): void {
    if (minimized === value) return;
    minimized = value;
    ensureEl("diplomacyRelationsHelp").style.display = value ? "none" : "";
    ensureEl("diplomacyTargets").style.display = value ? "none" : "flex";
    if (minimizeButton) {
      minimizeButton.dataset.tip = value ? "Show full Change relations window" : "Show only relation choices";
      minimizeButton.setAttribute("aria-expanded", String(!value));
    }
    $(dialog).dialog("option", "width", "fit-content");
  }
  minimizeButton?.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      setMinimized(!minimized);
    },
    true
  );

  // Setup Select All / None toggle functionality
  const selectAllNoneBtn = ensureEl("selectAllNoneBtn");
  const stateCheckboxes = () =>
    document.querySelectorAll<HTMLInputElement>("#stateSelectionContainer input[name='objectSelect']");

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

  dialog.addEventListener("change", updateButtonState);
  updateButtonState();
}

function closeRelationsDialog(): void {
  if (findEl(relationsDialogId)) $(`#${relationsDialogId}`).dialog("close");
}

function changeRelation(subjectId: number, objectId: number, newRelation: string): void {
  const states = pack.states;
  if (!objectId || subjectId === objectId || !states[objectId] || states[objectId].removed) return;
  const oldRelation = states[subjectId].diplomacy?.[objectId];
  const inverse = newRelation === "Vassal" ? "Suzerain" : newRelation === "Suzerain" ? "Vassal" : newRelation;
  if (newRelation === oldRelation && states[objectId].diplomacy?.[subjectId] === inverse) return;
  const chronicle = getChronicle();

  const subjectName = states[subjectId].name;
  const objectName = states[objectId].name;

  states[subjectId].diplomacy ??= [];
  states[objectId].diplomacy ??= [];
  states[subjectId].diplomacy[objectId] = newRelation;
  states[objectId].diplomacy[subjectId] = inverse;

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
}

function regenerateRelations(): void {
  States.generateDiplomacy();
  refreshDiplomacyEditor();
}

function resetRelations(): void {
  const selectedId = +ensureEl("diplomacyBodySection").querySelector<HTMLElement>("div.Self")!.dataset.id!;
  if (!selectedId) return;
  const states = pack.states;

  for (const state of states) {
    if (!state.i || state.i === selectedId || state.removed) continue;
    states[selectedId].diplomacy ??= [];
    state.diplomacy ??= [];
    states[selectedId].diplomacy[state.i] = "Neutral";
    state.diplomacy[selectedId] = "Neutral";
  }

  refreshDiplomacyEditor();
  if (findEl("diplomacyMatrix")) showRelationsMatrix();
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
  const group = getChronicle()[+i[0]];
  if (this.innerHTML === "") {
    group.splice(+i[1], 1);
    this.remove();
  } else group[+i[1]] = this.innerHTML;
}

function showRelationsMatrix(): void {
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
        if (!Object.hasOwn(relations, relation)) {
          return `<td data-id=${objectState.i} data-tip="Invalid relation. Click to choose a replacement" class="Unknown">Invalid</td>`;
        }
        const t = `${state.fullName} ${relations[relation].inText} ${objectState.fullName}`;
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

    if (!el.dataset.id) return;
    const currentRelation = el.textContent ?? "";

    const subjectId = +el.closest<HTMLElement>("tr")!.dataset.id!;
    const objectId = +el.dataset.id!;

    selectRelation(subjectId, objectId, currentRelation);
  });

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
  closeRelationsDialog();
  applyDefaultViewboxEvents();
  clearMainTip();
  const selected = ensureEl("diplomacyBodySection").querySelector("div.Self");
  if (selected) selected.classList.remove("Self");
  Layers.show("states");
  select("#debug").selectAll(".highlight").remove();
  $(`#${dialogId}`).dialog("destroy");
  ensureEl(dialogId).remove();
}

export const DiplomacyEditor = { open, showHistory: showRelationsHistory, exportCsv: downloadDiplomacyData };
