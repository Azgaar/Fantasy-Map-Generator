import { closeDialogs, confirmationDialog, destroyDialog, updateDialog } from "@/components/dialog/dialog-helpers";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/components/dialog/table";
import { tip } from "@/components/tooltips";
import { getDefaultTransportTypes } from "@/data/transport-types";
import type { Transport, TransportDomain } from "@/types/Journey";
import { ensureEl } from "@/utils";

const dialogId = "transportEditor" as const;
const position = { my: "center", at: "center", of: "svg", collision: "fit" };

const columns: EditorColumn<Transport>[] = [
  { key: "name", label: "Name", width: "7em", permanent: true },
  { key: "speed", label: "Speed", width: "5em" },
  { key: "domain", label: "Domain", width: "5em" },
  { key: "actions", width: "1.4em", permanent: true, align: "right" }
];

const typesTable = initEditorTable<Transport>({
  getData: () => pack.transports,
  onUpdate: renderTypesPage
});

const DOMAIN_LABEL: Record<TransportDomain, string> = {
  land: "Land: walks, wheels and hooves. Endpoints must be on land",
  water: "Water: boats and ships. Endpoints must be in water or on a coast touching water",
  air: "Air: flight and magic. No restrictions, travels in a straight line",
  stay: "Stay: no movement. For preparation, tavern rests and delays"
};
const DOMAINS = Object.keys(DOMAIN_LABEL) as TransportDomain[];

export const TRANSPORT_TYPES_CHANGED = "journey-transport-changed";
const emitChanged = () => document.dispatchEvent(new CustomEvent(TRANSPORT_TYPES_CHANGED));

function open(): void {
  if (customization) return;
  closeDialogs(`#${dialogId}, .stable`);

  Journeys.sync();
  renderDialog();
  typesTable.reset();

  $(`#${dialogId}`).dialog({ title: "Transport Types", position, close: onClose });
}

function renderDialog(): void {
  destroyDialog(dialogId);

  const html = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
    <div id="transportBody" class="table">${renderEditorHeader({ dialogId, columns })}</div>

    <div id="transportFooter" class="totalLine">
      <div data-tip="Transport types number" style="margin-left: 4px">Types:&nbsp;<span id="transportFooterNumber">0</span></div>
      <div style="margin-left: 12px"><i>Speed is in ${distanceUnitInput.value}/h</i></div>
    </div>

    <div id="transportBottom" class="editorToolbar">
      <button id="transportRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
      <button id="transportAdd" data-tip="Add a new transport type" class="icon-plus"></button>
      <button id="transportRestore" data-tip="Restore the default transport types, removing custom ones" class="icon-ccw"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl("transportRefresh").addEventListener("click", typesTable.refresh);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });
  ensureEl("transportAdd").addEventListener("click", addType);
  ensureEl("transportRestore").addEventListener("click", triggerDefaultsRestore);
}

function renderTypesPage(view: TableView<Transport>): void {
  const body = ensureEl("transportBody");
  body.querySelectorAll(":scope > .states").forEach(row => {
    row.remove();
  });

  const unit = distanceUnitInput.value;
  let lines = "";

  for (const type of view.rows) {
    const isStay = type.domain === "stay";
    const options = DOMAINS.map(
      domain => `<option value="${domain}" ${domain === type.domain ? "selected" : ""}>${domain}</option>`
    ).join("");

    lines += /* html */ `<div class="states" data-id="${type.i}">
      <div data-col="name"><input class="ttName" value="${type.name.replace(/"/g, "&quot;")}" data-tip="Transport type name" /></div>
      <div data-col="speed"><input class="ttSpeed" type="number" min="0" step="0.5" value="${type.speed}" ${isStay ? "disabled" : ""}
        data-tip="${isStay ? "Stay types have no speed" : `Sustained travel speed in ${unit}/h`}" /></div>
      <div data-col="domain"><select class="ttDomain" data-tip="${DOMAIN_LABEL[type.domain]}">${options}</select></div>
      <div data-col="actions"><span data-tip="Remove the transport type" class="ttDelete pointer icon-trash-empty"></span></div>
    </div>`;
  }
  body.insertAdjacentHTML("beforeend", lines);

  ensureEl("transportFooterNumber").innerHTML = String(view.all.length);

  // add listeners
  const on = (selector: string, event: string, handler: EventListener) => {
    body.querySelectorAll<HTMLElement>(selector).forEach(el => void el.addEventListener(event, handler));
  };
  on(".ttName", "change", onNameChange);
  on(".ttSpeed:not([disabled])", "input", onSpeedInput);
  on(".ttDomain", "change", onDomainChange);
  on(".ttDelete", "click", triggerTypeRemove);

  renderEditorPagination(ensureEl("transportFooter"), view, typesTable.goto);
}

/** Transport type of the row a control lives in */
const getLineId = (el: HTMLElement): number => +(el.closest<HTMLElement>(".states")?.dataset.id ?? "-1");

const getLineType = (el: HTMLElement): Transport | undefined => pack.transports.find(type => type.i === getLineId(el));

function onNameChange(this: HTMLInputElement): void {
  const type = getLineType(this);
  if (!type) return;

  const newName = this.value.trim();
  const isTaken = pack.transports.some(other => other.name === newName && other.i !== type.i);
  if (!newName || isTaken) {
    this.value = type.name;
    tip(newName ? "A transport type with that name already exists" : "Name cannot be empty", true, "error", 8000);
    return;
  }

  // segments reference the type by name, so keep them pointing at it
  for (const journey of pack.journeys ?? []) {
    for (const segment of journey.segments) if (segment.transport === type.name) segment.transport = newName;
  }
  type.name = newName;
  emitChanged();
}

function onSpeedInput(this: HTMLInputElement): void {
  const type = getLineType(this);
  if (!type) return;
  type.speed = +this.value || 0;
  emitChanged();
}

function onDomainChange(this: HTMLSelectElement): void {
  const type = getLineType(this);
  if (!type) return;
  type.domain = this.value as TransportDomain;
  if (type.domain === "stay") type.speed = 0; // stay types have no speed
  typesTable.refresh();
  emitChanged();
}

function addType(): void {
  const nextId = pack.transports.length ? Math.max(...pack.transports.map(type => type.i)) + 1 : 0;
  let name = "New Type";
  for (let n = 2; pack.transports.some(type => type.name === name); n++) name = `New Type ${n}`;

  pack.transports.push({ i: nextId, name, speed: 5, domain: "land" });
  typesTable.refresh();
  emitChanged();

  const input = document.querySelector<HTMLInputElement>(`#transportBody [data-id="${nextId}"] .ttName`);
  input?.select();
  tip("Transport type added — rename it and set the speed and domain.", true, "success", 5000);
}

function triggerTypeRemove(this: HTMLElement): void {
  const type = getLineType(this);
  if (!type) return;

  const isUsed = (pack.journeys ?? []).some(journey =>
    journey.segments.some(segment => segment.transport === type.name)
  );
  if (isUsed) {
    tip(`'${type.name}' is used by existing segments. Reassign them first.`, true, "error", 8000);
    return;
  }

  confirmationDialog({
    title: "Remove transport type",
    message: `Remove transport type <b>${type.name}</b>?`,
    confirm: "Remove",
    onConfirm: () => {
      pack.transports = pack.transports.filter(other => other.i !== type.i);
      typesTable.refresh();
      emitChanged();
    }
  });
}

function triggerDefaultsRestore(): void {
  confirmationDialog({
    title: "Restore default transport types",
    message:
      "Restore the default transport types? Custom ones will be removed. Segments referencing a removed type keep its name but will no longer resolve.",
    confirm: "Restore",
    onConfirm: () => {
      pack.transports = getDefaultTransportTypes();
      typesTable.refresh();
      emitChanged();
    }
  });
}

function onClose(): void {
  destroyDialog(dialogId);
}

export const TransportEditor = { open };
