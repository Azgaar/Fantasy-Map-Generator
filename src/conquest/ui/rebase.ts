/**
 * rebase.ts — what the user sees when a structural edit meets a live campaign.
 *
 * E6's brief: non-intrusive. The map is the product, so the common path is a
 * `tip()` and nothing else. The badge appears only when commands actually
 * dropped, the report dialog opens only when the user asks for it (or when the
 * rebase escalated), and nothing here is ever modal in the common path.
 */
import type { RebaseResult } from "../store/campaign";
import { currentArchive } from "../store/session";
import { escapeHtml, fmg } from "./fmg";

/** What the last rebase did — read by `stats()`, the menu and the report dialog. */
export interface RebaseRecord {
  at: number;
  applied: number;
  dropped: number;
  /** true when the campaign could not be rebased at all and was archived */
  escalated: boolean;
  reason?: string;
  failures: { index: number; command: Record<string, unknown>; error: string }[];
}

let last: RebaseRecord | null = null;
let unacknowledged = false;

/** The last rebase, for `stats()` and the menu row's enabled state. */
export function lastRebase(): RebaseRecord | null {
  return last;
}

/**
 * Record a settled rebase and say so — once, at the edge of the user's attention.
 *
 * A clean rebase gets a passing tip. Dropped commands get an error tip and light
 * the ⚔ badge until the report is read. Escalation (campaign archived) does both
 * and says so in stronger terms. Cosmetic edits never reach this function: there
 * is nothing honest to say about them.
 */
export function recordRebase(report: RebaseResult): void {
  const escalated = !!report.error;
  last = {
    at: Date.now(),
    applied: report.applied,
    dropped: escalated ? report.dropped : report.failures.length,
    escalated,
    ...(report.error ? { reason: report.error } : {}),
    failures: report.failures as RebaseRecord["failures"]
  };
  unacknowledged = escalated || last.dropped > 0;
  setDot(unacknowledged);
  if (escalated) {
    fmTip("the map changed too much for this campaign — it was archived; see the ⚔ menu", true);
  } else if (last.dropped > 0) {
    fmTip(
      `the map changed — ${last.dropped} campaign command${last.dropped === 1 ? "" : "s"} could not be kept (⚔ for the report)`,
      true
    );
  } else {
    fmTip("the map changed — the campaign was rebased onto it");
  }
}

/** Open the rebase report — from the ⚔ menu, or automatically on escalation. */
export function showRebaseReport(): void {
  unacknowledged = false;
  setDot(false);
  const escalated = last?.escalated ?? false;
  const title = escalated ? "Campaign archived" : "Rebase report";
  const body = !last
    ? "<p>No rebase has happened this session.</p>"
    : escalated
      ? `<p>The map changed so much that this campaign could not continue under it:</p>
         <p class="tw-rebase-reason">${escapeHtml(last.reason ?? "unknown")}</p>${archiveBlock()}`
      : last.dropped > 0
        ? `<p>${last.applied} command${last.applied === 1 ? "" : "s"} kept, ${last.dropped} dropped. The campaign continues from the surviving log.</p>
           <table class="tw-units"><thead><tr><th>#</th><th>command</th><th>why</th></tr></thead><tbody>${failureRows(last)}</tbody></table>
           ${archiveBlock()}`
        : `<p>The last rebase kept every command. Nothing was dropped.</p>`;

  const host = fmg()?.$;
  const message = globalThis.document.getElementById("alertMessage");
  if (!host || !message) return;
  message.innerHTML = `<div class="tw-editor-head"><h3>${title}</h3></div>${body}`;
  const buttons: Record<string, (this: HTMLElement) => void> = {
    Close(this: HTMLElement) {
      host(this).dialog("close");
    }
  };
  host("#alert").dialog({ resizable: true, width: 560, title, buttons });
  message.classList.add("tw-dialog-body");
  const dialog = message.closest(".ui-dialog") as HTMLElement | null;
  if (dialog) {
    dialog.classList.add("tw-dialog");
    dialog.classList.add("tw-dialog-box");
    dialog.style.opacity = "1";
  }
}

function failureRows(record: RebaseRecord): string {
  return record.failures
    .map(
      failure =>
        `<tr><td class="tw-unit-id">${failure.index}</td><td>${escapeHtml(commandLabel(failure.command))}</td><td>${escapeHtml(failure.error)}</td></tr>`
    )
    .join("");
}

function archiveBlock(): string {
  const archived = currentArchive();
  if (!archived) return "";
  return `<p class="tw-rebase-archive">The old log is archived for this session — <b>${archived.commands} commands, turn ${archived.turn}</b>.
    Download it from the ⚔ menu ("Download archived campaign") before closing the tab.</p>`;
}

function commandLabel(command: Record<string, unknown>): string {
  const type = String(command.type ?? "command");
  const target = command.armyId ?? command.buildingId ?? command.techId ?? command.regionId ?? "";
  return target !== "" ? `${type} ${String(target)}` : type;
}

function fmTip(message: string, isError = false): void {
  const tip = (globalThis as unknown as { tip?: (text: string, main?: boolean, type?: string, ms?: number) => void })
    .tip;
  if (typeof tip === "function") tip(message, isError, isError ? "error" : "info", isError ? 6000 : 3500);
  else console.info(`[openconquest] ${message}`);
}

/** The ⚔ badge: a small dot while a rebase has unacknowledged losses. */
function setDot(on: boolean): void {
  for (const id of ["totalWarButton", "totalWarFallback"]) {
    const button = globalThis.document.getElementById(id);
    if (button) button.classList.toggle("tw-rebase", on);
  }
}
