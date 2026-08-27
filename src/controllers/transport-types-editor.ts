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
import type { TransportDomain, TransportType } from "@/types/Journey";
import { ensureEl } from "@/utils";

export const TRANSPORT_TYPES_CHANGED = "journey-transport-types-changed";

const dialogId = "transportTypesEditor" as const;
const position = { my: "center", at: "center", of: "svg", collision: "fit" };

const ERROR_TIP_MS = 9000;
const SUCCESS_TIP_MS = 4000;

const DOMAIN_LABEL: Record<TransportDomain, string> = {
  land: "land — walks, wheels and hooves; endpoints must be on land (coastal is fine)",
  water: "water — boats and ships; endpoints must be in water or on a coast touching water",
  air: "air — flight and magic; no restrictions, travels in a straight line",
  stay: "stay — no movement; time comes from the segment's own duration, for tavern rests and delays"
};
const DOMAINS = Object.keys(DOMAIN_LABEL) as TransportDomain[];

const columns: EditorColumn<TransportType>[] = [
  { key: "name", label: "Name", width: "10em", permanent: true },
  { key: "speed", label: "Speed", width: "5.5em" },
  { key: "domain", label: "Domain", width: "7em" },
  { key: "actions", width: "2.2em", permanent: true, align: "right" }
];

const typesTable = initEditorTable<TransportType>({
  getData: () => pack.transportTypes,
  onUpdate: renderTypesPage
});

const emitChanged = () => document.dispatchEvent(new CustomEvent(TRANSPORT_TYPES_CHANGED));

function open(): void {
  if (customization) return;
  closeDialogs(`#${dialogId}, .stable`);

  Journeys.sync();
  renderDialog();
  typesTable.reset();

  $(`#${dialogId}`).dialog({
    title: "Transport Types",
    resizable: false,
    width: "fit-content",
    position,
    close: onClose
  });
}

function renderDialog(): void {
  destroyDialog(dialogId);

  const html = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
    <div id="transportTypesBody" class="table">${renderEditorHeader({ dialogId, columns })}</div>

    <div id="transportTypesFooter" class="totalLine">
      <div data-tip="Transport types number" style="margin-left: 4px">Types:&nbsp;<span id="transportTypesFooterNumber">0</span></div>
      <div style="margin-left: 12px"><i>speed is in ${distanceUnitInput.value}/h</i></div>
    </div>

    <div id="transportTypesBottom" class="editorToolbar">
      <button id="transportTypesRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
      <button id="transportTypesAdd" data-tip="Add a new transport type" class="icon-plus"></button>
      <button id="transportTypesRestore" data-tip="Restore the default transport types, removing custom ones" class="icon-ccw"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl("transportTypesRefresh").addEventListener("click", typesTable.refresh);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });
  ensureEl("transportTypesAdd").addEventListener("click", addType);
  ensureEl("transportTypesRestore").addEventListener("click", triggerDefaultsRestore);
}

function renderTypesPage(view: TableView<TransportType>): void {
  const body = ensureEl("transportTypesBody");
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

  ensureEl("transportTypesFooterNumber").innerHTML = String(view.all.length);

  // add listeners
  const on = (selector: string, event: string, handler: EventListener) => {
    body.querySelectorAll<HTMLElement>(selector).forEach(el => void el.addEventListener(event, handler));
  };
  on(".ttName", "change", onNameChange);
  on(".ttSpeed:not([disabled])", "input", onSpeedInput);
  on(".ttDomain", "change", onDomainChange);
  on(".ttDelete", "click", triggerTypeRemove);

  renderEditorPagination(ensureEl("transportTypesFooter"), view, typesTable.goto);
}

/** Transport type of the row a control lives in */
const getLineId = (el: HTMLElement): number => +(el.closest<HTMLElement>(".states")?.dataset.id ?? "-1");

const getLineType = (el: HTMLElement): TransportType | undefined =>
  pack.transportTypes.find(type => type.i === getLineId(el));

function onNameChange(this: HTMLInputElement): void {
  const type = getLineType(this);
  if (!type) return;

  const newName = this.value.trim();
  const isTaken = pack.transportTypes.some(other => other.name === newName && other.i !== type.i);
  if (!newName || isTaken) {
    this.value = type.name;
    tip(
      newName ? "A transport type with that name already exists" : "Name cannot be empty",
      true,
      "error",
      ERROR_TIP_MS
    );
    return;
  }

  // segments reference the type by name, so keep them pointing at it
  for (const journey of pack.journeys ?? []) {
    for (const segment of journey.segments) if (segment.transportType === type.name) segment.transportType = newName;
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
  const nextId = pack.transportTypes.length ? Math.max(...pack.transportTypes.map(type => type.i)) + 1 : 0;
  let name = "New Type";
  for (let n = 2; pack.transportTypes.some(type => type.name === name); n++) name = `New Type ${n}`;

  pack.transportTypes.push({ i: nextId, name, speed: 5, domain: "land" });
  typesTable.refresh();
  emitChanged();

  const input = document.querySelector<HTMLInputElement>(`#transportTypesBody [data-id="${nextId}"] .ttName`);
  input?.select();
  tip("Transport type added — rename it and set the speed and domain.", true, "success", SUCCESS_TIP_MS);
}

function triggerTypeRemove(this: HTMLElement): void {
  const type = getLineType(this);
  if (!type) return;

  const isUsed = (pack.journeys ?? []).some(journey =>
    journey.segments.some(segment => segment.transportType === type.name)
  );
  if (isUsed) {
    tip(`'${type.name}' is used by existing segments. Reassign them first.`, true, "error", ERROR_TIP_MS);
    return;
  }

  confirmationDialog({
    title: "Remove transport type",
    message: `Remove transport type <b>${type.name}</b>?`,
    confirm: "Remove",
    onConfirm: () => {
      pack.transportTypes = pack.transportTypes.filter(other => other.i !== type.i);
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
      pack.transportTypes = getDefaultTransportTypes();
      typesTable.refresh();
      emitChanged();
    }
  });
}

function onClose(): void {
  destroyDialog(dialogId);
}

export const TransportTypesEditor = { open };
