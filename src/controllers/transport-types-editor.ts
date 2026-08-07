import { closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { getDefaultTransportTypes } from "@/data/transport-types";
import type { TransportDomain, TransportType } from "@/types/Journey";
import { destroyDialogIfExists, ensureEl } from "../utils";

const DOMAINS: TransportDomain[] = ["land", "water", "air"];
const DOMAIN_LABEL: Record<TransportDomain, string> = {
  land: "land (roads / overland; land or coastal endpoints)",
  water: "water (rivers / seas; water or coastal endpoints)",
  air: "air (unrestricted; direct line, any endpoints)"
};

/** Errors explain a rule and need time to read; confirmations only acknowledge an action. */
const ERROR_TIP_MS = 9000;
const SUCCESS_TIP_MS = 4000;

const TRANSPORT_TYPES_CHANGED = "journey-transport-types-changed";
const emitChanged = () => document.dispatchEvent(new CustomEvent(TRANSPORT_TYPES_CHANGED));

export { TRANSPORT_TYPES_CHANGED };

function open(): void {
  if (customization) return;
  closeDialogs("#transportTypesEditor, .stable");
  ensureTypes();
  renderDialog();
  refresh();

  $("#transportTypesEditor").dialog({
    title: "Transport Types",
    resizable: false,
    width: "fit-content",
    position: { my: "center", at: "center", of: "svg" },
    close: onClose
  });
}

function ensureTypes(): void {
  if (!pack.transportTypes?.length) pack.transportTypes = getDefaultTransportTypes();
}

function renderDialog(): void {
  destroyDialogIfExists("transportTypesEditor");
  const unit = distanceUnitInput.value;
  const html = /* html */ `<div id="transportTypesEditor" class="dialog stable">
    <div style="margin-bottom: 0.5em; font-size: 0.9em; color: #555;">
      Add any transport type — give it a name, speed in <b>${unit}/h</b>, a <b>domain</b>, and a color.
      Domain rules:
      <br/>&nbsp;• <b>land</b>: on-foot / wheels / hooves — endpoints must be on land (coastal is fine).
      <br/>&nbsp;• <b>water</b>: boats / ships — endpoints must be in water or on the coast.
      <br/>&nbsp;• <b>air</b>: flight / magic — no restrictions; travels in a straight line.
    </div>
    <div id="ttHeader" class="header" style="display: grid; grid-template-columns: 10em 6em 8em 4em 3em; gap: 0.4em; padding: 0.2em; font-weight: bold;">
      <div>Name</div><div>Speed (${unit}/h)</div><div>Domain</div><div>Color</div><div></div>
    </div>
    <div id="ttBody" class="table"></div>
    <div id="ttBottom" style="margin-top: 0.4em;">
      <button id="ttAdd" data-tip="Add a new transport type — you name it, set the speed and path mode" class="icon-plus">Add transport type</button>
      <button id="ttResetDefaults" data-tip="Reset to default transport types (custom ones will be removed)" class="icon-cw">Reset defaults</button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  ensureEl("ttAdd").on("click", addType);
  ensureEl("ttResetDefaults").on("click", resetDefaults);
}

function refresh(): void {
  const body = ensureEl("ttBody");
  body.innerHTML = "";
  pack.transportTypes.forEach(t => {
    const row = document.createElement("div");
    row.className = "editorLine";
    row.style.cssText =
      "display: grid; grid-template-columns: 10em 6em 8em 4em 3em; gap: 0.4em; padding: 0.2em; align-items: center;";
    row.dataset.ttId = String(t.i);
    row.innerHTML = /* html */ `
      <input class="ttName" value="${t.name}" />
      <input class="ttSpeed" type="number" min="0" step="0.5" value="${t.speed}" />
      <select class="ttDomain" data-tip="${DOMAIN_LABEL[t.domain]}">
        ${DOMAINS.map(d => `<option value="${d}" ${d === t.domain ? "selected" : ""}>${d}</option>`).join("")}
      </select>
      <input class="ttColor" type="color" value="${t.color ?? "#666666"}" />
      <span class="ttDelete pointer icon-trash-empty" data-tip="Delete this transport type"></span>`;
    body.appendChild(row);
  });

  body.querySelectorAll<HTMLInputElement>(".ttName").forEach(el => {
    el.on("change", onNameChange);
  });
  body.querySelectorAll<HTMLInputElement>(".ttSpeed").forEach(el => {
    el.on("input", onSpeedInput);
  });
  body.querySelectorAll<HTMLSelectElement>(".ttDomain").forEach(el => {
    el.on("change", onDomainChange);
  });
  body.querySelectorAll<HTMLInputElement>(".ttColor").forEach(el => {
    el.on("input", onColorInput);
  });
  body.querySelectorAll<HTMLElement>(".ttDelete").forEach(el => {
    el.on("click", onDelete);
  });
}

function getRowId(el: HTMLElement): number {
  return +(el.closest<HTMLElement>("[data-tt-id]")?.dataset.ttId ?? "-1");
}

function getType(id: number): TransportType | undefined {
  return pack.transportTypes.find(t => t.i === id);
}

function onNameChange(this: HTMLInputElement): void {
  const type = getType(getRowId(this));
  if (!type) return;
  const oldName = type.name;
  const newName = this.value.trim();
  if (!newName) {
    this.value = oldName;
    tip("Name cannot be empty", true, "error", ERROR_TIP_MS);
    return;
  }
  if (pack.transportTypes.some(t => t.name === newName && t.i !== type.i)) {
    this.value = oldName;
    tip("A transport type with that name already exists", true, "error", ERROR_TIP_MS);
    return;
  }
  type.name = newName;
  for (const j of pack.journeys ?? []) {
    for (const s of j.segments) if (s.transportType === oldName) s.transportType = newName;
  }
  emitChanged();
}

function onSpeedInput(this: HTMLInputElement): void {
  const type = getType(getRowId(this));
  if (!type) return;
  type.speed = +this.value || 0;
  emitChanged();
}

function onDomainChange(this: HTMLSelectElement): void {
  const type = getType(getRowId(this));
  if (!type) return;
  type.domain = this.value as TransportDomain;
  this.dataset.tip = DOMAIN_LABEL[type.domain];
  emitChanged();
}

function onColorInput(this: HTMLInputElement): void {
  const type = getType(getRowId(this));
  if (!type) return;
  type.color = this.value;
  emitChanged();
}

function onDelete(this: HTMLElement): void {
  const type = getType(getRowId(this));
  if (!type) return;
  const inUse = (pack.journeys ?? []).some(j => j.segments.some(s => s.transportType === type.name));
  if (inUse) {
    tip(
      `'${type.name}' is used by existing segments. Reassign them in the Journey Editor before deleting.`,
      true,
      "error",
      ERROR_TIP_MS
    );
    return;
  }
  confirmationDialog({
    title: "Delete transport type",
    message: `Delete transport type <b>${type.name}</b>?`,
    confirm: "Delete",
    onConfirm: () => {
      pack.transportTypes = pack.transportTypes.filter(t => t.i !== type.i);
      refresh();
      emitChanged();
    }
  });
}

function nextId(): number {
  return pack.transportTypes.length ? Math.max(...pack.transportTypes.map(t => t.i)) + 1 : 0;
}

function uniqueName(base: string): string {
  if (!pack.transportTypes.some(t => t.name === base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base} ${n}`;
    if (!pack.transportTypes.some(t => t.name === candidate)) return candidate;
  }
  return `${base} ${Date.now()}`;
}

function addType(): void {
  const id = nextId();
  const name = uniqueName("New Type");
  pack.transportTypes.push({ i: id, name, speed: 5, domain: "land", color: "#8a2be2" });
  refresh();
  emitChanged();
  // auto-focus the new row's name field so the user can rename immediately
  const input = document.querySelector<HTMLInputElement>(`#ttBody [data-tt-id="${id}"] .ttName`);
  if (input) {
    input.focus();
    input.select();
  }
  tip("Transport type added — rename it and set speed / path mode.", true, "success", SUCCESS_TIP_MS);
}

function resetDefaults(): void {
  confirmationDialog({
    title: "Reset transport types",
    message:
      "Reset to default transport types? Existing types will be removed. Journeys referencing removed types will keep their stored transport-type name but may no longer resolve.",
    confirm: "Reset",
    onConfirm: () => {
      pack.transportTypes = getDefaultTransportTypes();
      refresh();
      emitChanged();
    }
  });
}

function onClose(): void {
  destroyDialogIfExists("transportTypesEditor");
}

export const TransportTypesEditor = { open };
