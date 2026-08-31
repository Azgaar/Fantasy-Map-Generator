import { closeDialogs, confirmationDialog, destroyDialog, updateDialog } from "@/components/dialog/dialog-helpers";
import {
  type EditorColumn,
  getRowId,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/components/dialog/table";
import { tip } from "@/components/tooltips";
import { MAX_HOURS_PER_DAY, type Transport, type TransportDomain } from "@/generators/transports-generator";
import { convertSpeed, ensureEl, escapeHtml, getDistanceUnit, parseSpeed } from "@/utils";

const dialogId = "transportEditor" as const;
const position = { my: "center", at: "center", of: "svg", collision: "fit" };

const columns: EditorColumn<Transport>[] = [
  { key: "name", label: "Name", width: "14em", permanent: true },
  { key: "speed", label: "Speed", width: "5em" },
  { key: "hoursPerDay", label: "h/day", width: "4em", tip: "Hours of travel a day sustains with this transport" },
  { key: "domain", label: "Domain", width: "5em" },
  { key: "actions", width: "1.4em", permanent: true, align: "right" }
];

const typesTable = initEditorTable<Transport>({
  getData: () => Transports.all,
  onUpdate: renderTypesPage
});

const DOMAIN_LABEL: Record<TransportDomain, string> = {
  land: "Land: walks, wheels and hooves. Endpoints must be on land",
  water: "Water: boats and ships. Endpoints must be in water or on a coast touching water",
  air: "Air: flight and magic. No restrictions, travels in a straight line",
  stay: "Stay: no movement. For preparation, tavern rests and delays"
};
const DOMAINS = Object.keys(DOMAIN_LABEL) as TransportDomain[];

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
      <div style="margin-left: 12px"><i>Speed is in ${getDistanceUnit()}/h</i></div>
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

  const unit = getDistanceUnit();
  let lines = "";

  for (const type of view.rows) {
    const isStay = type.domain === "stay";
    const options = DOMAINS.map(
      domain => `<option value="${domain}" ${domain === type.domain ? "selected" : ""}>${domain}</option>`
    ).join("");

    lines += /* html */ `<div class="states" data-id="${type.i}">
      <div data-col="name"><input class="ttName" value="${escapeHtml(type.name)}" data-tip="Transport type name" /></div>
      <div data-col="speed"><input class="ttSpeed" type="number" min="0" step="0.5" value="${convertSpeed(type.speed)}" ${isStay ? "disabled" : ""}
        data-tip="${isStay ? "Stay types have no speed" : `Sustained travel speed in ${unit}/h`}" /></div>
      <div data-col="hoursPerDay"><input class="ttHours" type="number" min="1" max="${MAX_HOURS_PER_DAY}" step="1" value="${Transports.resolveHoursPerDay(type)}"
        data-tip="${isStay ? "Hours a day of waiting covers: 24 means a full day passes" : "Hours of travel a day sustains: a caravan walks ~8 h/day, a ship sails 24"}" /></div>
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
  on(".ttHours", "change", onHoursChange);
  on(".ttDomain", "change", onDomainChange);
  on(".ttDelete", "click", triggerTypeRemove);

  renderEditorPagination(ensureEl("transportFooter"), view, typesTable.goto);
}

const getLineType = (el: HTMLElement): Transport | undefined => Transports.all.find(type => type.i === getRowId(el));

function onNameChange(this: HTMLInputElement): void {
  const type = getLineType(this);
  if (!type) return;

  const newName = this.value.trim();
  const isTaken = Transports.all.some(other => other.name === newName && other.i !== type.i);
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
  Transports.save();
}

function onSpeedInput(this: HTMLInputElement): void {
  const type = getLineType(this);
  if (!type) return;
  type.speed = parseSpeed(+this.value || 0); // stored in km/h, typed in the user distance unit
  Transports.save();
}

function onHoursChange(this: HTMLInputElement): void {
  const type = getLineType(this);
  if (!type) return;

  const hours = Math.round(+this.value);
  if (!Number.isFinite(hours) || hours < 1 || hours > MAX_HOURS_PER_DAY) {
    this.value = String(Transports.resolveHoursPerDay(type));
    tip(`Travel hours per day must be between 1 and ${MAX_HOURS_PER_DAY}`, true, "error", 6000);
    return;
  }

  type.hoursPerDay = hours;
  this.value = String(hours);
  Transports.save();
}

function onDomainChange(this: HTMLSelectElement): void {
  const type = getLineType(this);
  if (!type) return;
  type.domain = this.value as TransportDomain;
  if (type.domain === "stay") type.speed = 0; // stay types have no speed
  Transports.save();
  typesTable.refresh();
}

function addType(): void {
  const nextId = Transports.getNextId();
  let name = "New Type";
  for (let n = 2; Transports.all.some(type => type.name === name); n++) name = `New Type ${n}`;

  // hoursPerDay is left out on purpose: the domain fallback defines the default travel day
  Transports.all.push({ i: nextId, name, speed: 5, domain: "land" });
  Transports.save();
  typesTable.refresh();

  const input = document.querySelector<HTMLInputElement>(`#transportBody [data-id="${nextId}"] .ttName`);
  input?.select();
  tip("Transport type added — rename it and set the speed, travel hours and domain.", true, "success", 5000);
}

function triggerTypeRemove(this: HTMLElement): void {
  const type = getLineType(this);
  if (!type) return;

  const isUsed = (pack.journeys ?? []).some(journey =>
    journey.segments.some(segment => segment.transport === type.name)
  );
  if (isUsed) {
    tip(`'${escapeHtml(type.name)}' is used by existing segments. Reassign them first.`, true, "error", 8000);
    return;
  }

  confirmationDialog({
    title: "Remove transport type",
    message: `Remove transport type <b>${escapeHtml(type.name)}</b>?`,
    confirm: "Remove",
    onConfirm: () => {
      Transports.set(Transports.all.filter(other => other.i !== type.i));
      typesTable.refresh();
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
      Transports.set(Transports.getDefaults());
      typesTable.refresh();
    }
  });
}

function onClose(): void {
  destroyDialog(dialogId);
}

export const TransportEditor = { open };
