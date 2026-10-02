import { Icons } from "@/components/icons";
import { MapEntities } from "@/components/map-entities";
import { Notes } from "@/generators/notes";
import type { ChangeRow, Proposal } from "@/services/assistant/chats";
import { rn } from "@/utils/numberUtils";
import { capitalize, escapeHtml } from "@/utils/stringUtils";
import { formatPrice, getPeople, si } from "@/utils/unitUtils";
import { type Action, Proposals } from "./proposals";

// The proposal card: a Change as rows of entity, field and before → after, with the next action

const PROPOSAL_ROWS = 8;
const NEXT: Partial<Record<Proposal["state"], Action>> = { proposed: "apply", applied: "undo", undone: "redo" };
const FIELD_LABELS: Record<string, string> = { fullName: "Full name", "label.text": "Label" };
const CELL_LABELS: Record<string, string> = {
  r: "River",
  fl: "Water flux",
  conf: "Confluence",
  routes: "Route links",
  pop: "Rural population"
};

// Fields holding another entity's id, shown by its name
const ID_FIELDS = new Set(["state", "culture", "religion", "province"]);
const MONEY_FIELDS = new Set(["treasury", "pollTax"]);

const plural = (count: number, noun: string) => `${si(count)} ${noun}${count === 1 ? "" : "s"}`;
const isChronicle = ({ key, field }: ChangeRow) => key === "state:0" && field === "diplomacy";
const entityName = (key: string) => {
  const ref = globalThis.pack && MapEntities.parseKey(key); // chats render before a map exists too
  return ref ? MapEntities.getName(ref) : "";
};

/** A field's label as the user reads it */
function fieldLabel(row: ChangeRow): string {
  if (isChronicle(row)) return "Entries";
  const relation = row.key.startsWith("state:") && row.field.match(/^diplomacy\.(\d+)$/);
  if (relation) return `Relation to ${entityName(`state:${relation[1]}`) || `state ${relation[1]}`}`;
  return (
    FIELD_LABELS[row.field] ??
    capitalize(
      row.field
        .replace(/\./g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase()
    )
  );
}

/** A value as the app shows it: people, money and names rather than stored points and ids; null for none */
function valueText(row: ChangeRow, value: unknown): string | null {
  const { key, field } = row;
  if (value === undefined || value === null || value === "") return null;
  const type = key.slice(0, key.indexOf(":"));
  if (typeof value === "number") {
    if (field === "population" && type === "burg") return si(getPeople(0, value));
    if (field === "rural") return si(getPeople(value, 0));
    if (field === "urban") return si(getPeople(0, value));
    if (MONEY_FIELDS.has(field) || (field === "value" && type === "good")) return formatPrice(value);
    if (field === "salesTax") return `${rn(value * 100, 2)}%`;
    if (field === "capital" && type === "burg") return value ? "yes" : "no";
    const idType = ID_FIELDS.has(field) ? field : field === "capital" || field === "burg" ? "burg" : "";
    if (idType) return entityName(`${idType}:${value}`) || String(value);
  }
  if (Array.isArray(value)) return isChronicle(row) ? String(value.length) : plural(value.length, "item");
  const shown = typeof value === "string" ? value : JSON.stringify(value);
  return shown.length > 80 ? `${shown.slice(0, 80)}…` : shown;
}

const entityLabel = (row: ChangeRow) => (isChronicle(row) ? "Chronicle" : row.entity);

/** An added or removed entity shows as one row, not as every field it had */
function displayRows(change: ChangeRow[]): ChangeRow[] {
  const whole = new Map<string, ChangeRow>();
  for (const row of change) {
    if (!row.field) whole.set(row.key, row);
    else if (row.field === "removed" && row.after === true && !row.before)
      whole.set(row.key, { ...row, field: "", before: true, after: undefined });
  }
  const shown = new Set<string>();
  return change.flatMap(row => {
    const replacement = whole.get(row.key);
    if (!replacement) return [row];
    if (shown.has(row.key)) return [];
    shown.add(row.key);
    return [replacement];
  });
}

export function proposalHtml(proposal: Proposal, index: number, mapId: number): string {
  const { change, state } = proposal;
  const shown = displayRows(change);
  const groups: ChangeRow[][] = [];
  for (const row of shown.slice(0, PROPOSAL_ROWS)) {
    const group = groups.at(-1);
    if (group?.[0].key === row.key) group.push(row);
    else groups.push([row]);
  }
  const more = shown.length - PROPOSAL_ROWS;
  const rows = groups
    .map(
      rows => /* html */ `<div class="assistantChangeEntity">
        <div class="assistantChangeName">${escapeHtml(entityLabel(rows[0]))}${entityIcon(rows[0])}${wholeTag(rows[0])}</div>
        ${rows.map(changeHtml).join("")}
      </div>`
    )
    .join("");
  const list = `${rows}${more > 0 ? `<div class="assistantChangeMore">… ${more} more change${more === 1 ? "" : "s"}</div>` : ""}`;
  const entities = new Set(shown.map(row => row.key)).size;
  const count = `${plural(shown.length, "change")}${entities > 1 ? ` · ${entities} entities` : ""}`;

  const button = (action: string, label: string, enabled: boolean, primary = false) =>
    `<button type="button" class="assistantButton${primary ? " assistantPrimary" : ""}" data-action="${action}" data-index="${index}" ${enabled ? "" : "disabled"}>${label}</button>`;
  const next = NEXT[state];
  const enabled = Boolean(next && Proposals.can(next, proposal, mapId));
  const main = next ? button(next, enabled ? capitalize(next) : "Changed since", enabled, state === "proposed") : "";
  const proposed = state === "proposed";

  // a waiting proposal shows its changes with the actions below; a settled one folds them away
  return /* html */ `<div class="assistantItem assistantProposal ${state}">
    <div class="assistantProposalHeader">
      <span class="assistantProposalState">${capitalize(state)}</span>
      <span class="assistantProposalSummary">${escapeHtml(proposal.summary)}</span>
      ${proposed ? "" : main}
    </div>
    ${
      proposed
        ? `<div class="assistantProposalBody">${list}</div>
      <div class="assistantProposalFooter"><span>${count}</span><span class="assistantProposalActions">${button("discard", "Discard", true)}${main}</span></div>`
        : `<details class="assistantProposalBody"><summary>Show ${count}</summary>${list}</details>`
    }
  </div>`;
}

/** The icon of an entity that has one, as the row holds it or the map does */
function entityIcon({ key, field, before, after }: ChangeRow): string {
  const whole = (field ? undefined : (after ?? before)) as { icon?: unknown } | undefined;
  const ref = globalThis.pack && MapEntities.parseKey(key); // chats render before a map exists too
  const icon = typeof whole === "object" ? whole?.icon : ref && (MapEntities.get(ref) as { icon?: unknown })?.icon;
  return typeof icon === "string" && icon ? ` ${Icons.html(icon)}` : "";
}

/** An added or removed entity is tagged on its name line: the change itself, true in every card state */
function wholeTag({ field, before }: ChangeRow): string {
  if (field) return "";
  const added = before === undefined;
  return `<span class="assistantChangeTag ${added ? "add" : "remove"}">${added ? "Add" : "Remove"}</span>`;
}

const notePreview = (note: unknown): string =>
  typeof note === "string" && note
    ? `<div class="assistantNotePreview">${Notes.isSafe(note) ? note : escapeHtml(note)}</div>`
    : "";

function changeHtml(row: ChangeRow): string {
  const { key, field, before, after } = row;
  if (!field) {
    const note = before === undefined ? (after as { note?: unknown } | undefined)?.note : undefined;
    return notePreview(note);
  }
  if (key === "cells") {
    return /* html */ `<div class="assistantChangeField">
      <span>${CELL_LABELS[field] ?? capitalize(field)}</span>
      <span>${plural(Object.keys(after as object).length, "cell")}</span>
    </div>`;
  }
  const label = escapeHtml(fieldLabel(row));
  if (field === "note") {
    const size = (value: unknown) => (typeof value === "string" && value ? plural(value.length, "character") : "empty");
    return /* html */ `<div class="assistantChangeField">
      <span>${label}</span>
      <span><del>${size(before)}</del><i>→</i><ins>${size(after)}</ins></span>
      ${notePreview(after)}
    </div>`;
  }
  const value = (value: unknown) => {
    const text = valueText(row, value);
    return text === null ? `<em>none</em>` : escapeHtml(text);
  };
  return /* html */ `<div class="assistantChangeField">
    <span>${label}</span>
    <span><del>${value(before)}</del><i>→</i><ins>${value(after)}</ins></span>
  </div>`;
}

/** A change as text lines for the model, which checks that its proposal does what was asked */
export function changeText(change: ChangeRow[], limit = 20): string {
  const shown = displayRows(change);
  const lines = shown.slice(0, limit).map(row => {
    if (!row.field) return `${row.entity}: ${row.before === undefined ? "added" : "removed"}`;
    if (row.key === "cells")
      return `Cells · ${CELL_LABELS[row.field] ?? row.field}: ${plural(Object.keys(row.after as object).length, "cell")}`;
    if (row.field === "note") return `${row.entity} · Note: rewritten`;
    return `${entityLabel(row)} · ${fieldLabel(row)}: ${valueText(row, row.before) ?? "none"} → ${valueText(row, row.after) ?? "none"}`;
  });
  const more = shown.length - limit;
  return lines.join("\n") + (more > 0 ? `\n… ${more} more` : "");
}
