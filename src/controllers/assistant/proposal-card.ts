import { Icons } from "@/components/icons";
import { MapEntities } from "@/components/map-entities";
import { layerLabel } from "@/data/layer-labels";
import type { ChangeRow, Proposal } from "@/services/assistant/chats";
import { rn } from "@/utils/numberUtils";
import { capitalize, escapeHtml } from "@/utils/stringUtils";
import { formatPrice, getArea, getAreaUnit, getPeople, si } from "@/utils/unitUtils";
import { isSafeHtml } from "@/utils/validationUtils";
import { CELL_FIELDS } from "./fields";
import { type Action, Proposals } from "./proposals";

const PROPOSAL_ROWS = 8;
const NEXT: Partial<Record<Proposal["state"], Action>> = { proposed: "apply", applied: "undo", undone: "redo" };
const FIELD_LABELS: Record<string, string> = { fullName: "Full name", "label.text": "Label" };
const MONEY_FIELDS = new Set(["treasury", "pollTax"]);
// bookkeeping that operations keep in sync, shown only when a change has nothing else
const DERIVED_FIELDS = new Set(["pole", "center", "cells", "neighbors"]);
// what an added entity is shown with, beside its name
const ADDED_FIELDS: Record<string, string[]> = {
  burg: ["group", "population", "port", "capital"],
  state: ["form", "culture"],
  province: ["state", "burg"],
  culture: ["type"],
  religion: ["type", "culture"],
  marker: ["type"]
};
const STYLE_BAGS = new Set(["groups", "attrs", "options"]);
const COLOR = /^#[0-9a-f]{3,8}$/i;

const plural = (count: number, noun: string) => `${si(count)} ${noun}${count === 1 ? "" : "s"}`;

/** A proposal's change as the user reads it: rows of entity, field and before → after, with the next action. The
 * model reads the same rows as text, to check its proposal does what was asked */
class ProposalCardView {
  html(proposal: Proposal, index: number, mapId: number): string {
    const { change, state } = proposal;
    const shown = this.displayRows(change);
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
          <div class="assistantChangeName">${escapeHtml(this.entityLabel(rows[0]))}${this.entityIcon(rows[0])}${this.wholeTag(rows[0])}</div>
          ${rows.map(row => this.rowHtml(row)).join("")}
        </div>`
      )
      .join("");
    const list = `${rows}${more > 0 ? `<div class="assistantChangeMore">… ${more} more change${more === 1 ? "" : "s"}</div>` : ""}`;
    const entities = new Set(shown.map(row => row.key)).size;
    const count = `${plural(shown.length, "change")}${entities > 1 ? ` · ${entities} entities` : ""}`;

    const button = (action: string, label: string, enabled: boolean, primary = false) =>
      `<button type="button" class="assistantButton${primary ? " assistantPrimary" : ""}" data-action="${action}" data-index="${index}" ${enabled ? "" : "disabled"}>${label}</button>`;
    const next = NEXT[state];
    const enabled = Boolean(next && Proposals.ready(next, proposal, mapId));
    const main = next ? button(next, enabled ? capitalize(next) : "Stale", enabled, state === "proposed") : "";
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

  text(change: ChangeRow[], limit = 20): string {
    const shown = this.displayRows(change);
    const lines = shown.slice(0, limit).map(row => {
      if (!row.field && row.before === undefined)
        return [`${row.entity}: added`, ...this.addedFields(row).map(([label, text]) => `${label}: ${text}`)].join(
          " · "
        );
      if (!row.field) return `${row.entity}: removed`;
      if (row.field === "coa") return `${row.entity} · Emblem: redrawn`;
      if (row.key === "cells")
        return `Cells · ${CELL_FIELDS[row.field]?.label ?? row.field}: ${plural(Object.keys(row.after as object).length, "cell")}`;
      if (row.field === "note") return `${row.entity} · Note: rewritten`;
      if (row.append) return `${this.entityLabel(row)} · ${this.fieldLabel(row)}: + ${this.addedText(row)}`;
      const [before, after] = [this.valueText(row, row.before), this.valueText(row, row.after)];
      return `${this.entityLabel(row)} · ${this.fieldLabel(row)}: ${before ?? "none"} → ${after ?? "none"}`;
    });
    const more = shown.length - limit;
    return lines.join("\n") + (more > 0 ? `\n… ${more} more` : "");
  }

  /** An added or removed entity shows as one row, not as every field it had, and so does an emblem; bookkeeping
   * fields only when nothing else changed */
  private displayRows(change: ChangeRow[]): ChangeRow[] {
    const rows = this.wholeRows(change);
    const emblems = new Set<string>();
    const shown = rows.flatMap(row => {
      if (row.field !== "coa" && !row.field.startsWith("coa.")) return [row];
      if (emblems.has(row.key)) return [];
      emblems.add(row.key);
      return [{ ...row, field: "coa", before: undefined, after: undefined }];
    });
    const visible = shown.filter(row => !(row.key.includes(":") && DERIVED_FIELDS.has(row.field.split(".")[0])));
    return visible.length ? visible : shown;
  }

  private wholeRows(change: ChangeRow[]): ChangeRow[] {
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

  private rowHtml(row: ChangeRow): string {
    const { key, field, before, after } = row;
    const line = (label: string, value: string, extra = "") => /* html */ `<div class="assistantChangeField">
      <span>${label}</span>
      <span>${value}</span>
      ${extra}
    </div>`;
    if (!field) {
      const note = this.notePreview(before === undefined ? (after as { note?: unknown })?.note : undefined);
      const fields = before === undefined ? this.addedFields(row) : [];
      return fields.map(([label, text]) => line(escapeHtml(label), escapeHtml(text))).join("") + note;
    }
    if (field === "coa") return line("Emblem", "redrawn");
    if (key === "cells")
      return line(CELL_FIELDS[field]?.label ?? capitalize(field), plural(Object.keys(after as object).length, "cell"));
    const label = escapeHtml(this.fieldLabel(row));
    if (row.append) return line(label, `<ins>+ ${escapeHtml(this.addedText(row))}</ins>`);
    if (field === "note") {
      const size = (value: unknown) =>
        typeof value === "string" && value ? plural(value.length, "character") : "empty";
      return line(label, `<del>${size(before)}</del><i>→</i><ins>${size(after)}</ins>`, this.notePreview(after));
    }
    const value = (value: unknown) => {
      const text = this.valueText(row, value);
      if (text === null) return `<em>none</em>`;
      const swatch = COLOR.test(text) ? `<span class="assistantSwatch" style="background:${text}"></span>` : "";
      return swatch + escapeHtml(text);
    };
    return line(label, `<del>${value(before)}</del><i>→</i><ins>${value(after)}</ins>`);
  }

  /** A field's label as the user reads it */
  private fieldLabel(row: ChangeRow): string {
    if (this.isChronicle(row)) return "Entries";
    if (row.key === "style") {
      // "ocean.groups.base.attrs.fill" → "Ocean · Base · Fill"
      const [element, ...rest] = row.field.split(".");
      const words = (key: string) =>
        capitalize(
          key
            .replace(/[-_]/g, " ")
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .toLowerCase()
        );
      return [layerLabel(element), ...rest.filter(key => !STYLE_BAGS.has(key)).map(words)].join(" · ");
    }
    const relation = row.key.startsWith("state:") && row.field.match(/^diplomacy\.(\d+)$/);
    if (relation) return `Relation to ${this.entityName(`state:${relation[1]}`) || `state ${relation[1]}`}`;
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
  private valueText(row: ChangeRow, value: unknown): string | null {
    const { key, field } = row;
    if (value === undefined || value === null || value === "") return null;
    const type = key.slice(0, key.indexOf(":"));
    if (typeof value === "number") {
      if (field === "population" && type === "burg") return si(getPeople(0, value));
      if (field === "rural") return si(getPeople(value, 0));
      if (field === "urban") return si(getPeople(0, value));
      if (MONEY_FIELDS.has(field) || (field === "value" && type === "good")) return formatPrice(value);
      if (field === "salesTax") return `${rn(value * 100, 2)}%`;
      if ((field === "capital" || field === "port") && type === "burg") return value ? "yes" : "no";
      if (field === "area") return `${si(getArea(value))} ${getAreaUnit()}`;
      const idType = MapEntities.referenceType(type, field);
      if (idType) return this.entityName(`${idType}:${value}`) || String(value);
    }
    if (Array.isArray(value)) return this.isChronicle(row) ? String(value.length) : plural(value.length, "item");
    const shown = typeof value === "string" ? value : JSON.stringify(value);
    return shown.length > 80 ? `${shown.slice(0, 80)}…` : shown;
  }

  private entityLabel(row: ChangeRow): string {
    return this.isChronicle(row) ? "Chronicle" : row.entity;
  }

  /** The main fields of an added entity, as [label, value] */
  private addedFields(row: ChangeRow): [string, string][] {
    const entity = row.after as Record<string, unknown> | undefined;
    const fields = ADDED_FIELDS[row.key.split(":")[0]] ?? [];
    return fields.flatMap(field => {
      const value = entity?.[field];
      const text = value ? this.valueText({ ...row, field }, value) : null;
      return text === null ? [] : [[this.fieldLabel({ ...row, field }), text] as [string, string]];
    });
  }

  /** Items an append row adds: chronicle entries by their titles */
  private addedText(row: ChangeRow): string {
    const items = row.after as unknown[];
    return this.isChronicle(row) ? items.map(entry => (entry as string[])[0]).join(", ") : plural(items.length, "item");
  }

  /** The icon of an entity that has one, as the row holds it or the map does */
  private entityIcon({ key, field, before, after }: ChangeRow): string {
    const whole = (field ? undefined : (after ?? before)) as { icon?: unknown } | undefined;
    const ref = this.refOf(key);
    const icon = typeof whole === "object" ? whole?.icon : ref && (MapEntities.get(ref) as { icon?: unknown })?.icon;
    return typeof icon === "string" && icon ? ` ${Icons.html(icon)}` : "";
  }

  /** An added or removed entity is tagged on its name line: the change itself, true in every card state */
  private wholeTag({ field, before }: ChangeRow): string {
    if (field) return "";
    const added = before === undefined;
    return `<span class="assistantChangeTag ${added ? "add" : "remove"}">${added ? "Add" : "Remove"}</span>`;
  }

  /** A proposed note stays inert until applied: no remote images load, and its styles stay inside the box */
  private notePreview(note: unknown): string {
    if (typeof note !== "string" || !note) return "";
    if (!isSafeHtml(note)) return `<div class="assistantNotePreview">${escapeHtml(note)}</div>`;
    const template = document.createElement("template");
    template.innerHTML = note;
    for (const image of template.content.querySelectorAll("img")) image.replaceWith(`[${image.alt || "image"}]`);
    return `<div class="assistantNotePreview">${template.innerHTML}</div>`;
  }

  private isChronicle({ key, field }: ChangeRow): boolean {
    return key === "state:0" && field === "diplomacy";
  }

  /** Chats render before a map exists too */
  private refOf(key: string) {
    return globalThis.pack ? MapEntities.parseKey(key) : undefined;
  }

  private entityName(key: string): string {
    const ref = this.refOf(key);
    return ref ? MapEntities.getName(ref) : "";
  }
}

export const ProposalCard = new ProposalCardView();
