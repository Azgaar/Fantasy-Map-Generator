import { findEl } from "@/utils/nodeUtils";
import type { CascadeSummary } from "./bulk-entity-adapter";

function renderSummary(summary: CascadeSummary): string {
  const items = summary.lines.map(line => `<li>${line}</li>`).join("");
  const skipped = summary.skippedLocked
    ? `<p><i>${summary.skippedLocked} locked row${summary.skippedLocked === 1 ? "" : "s"} will be skipped.</i></p>`
    : "";
  return `<ul style="margin: 0.4em 0; padding-left: 1.2em">${items}</ul>${skipped}`;
}

/**
 * Show the bulk-delete confirmation dialog, reusing the app's confirmationDialog
 * helper. When `childKind` is set (States/Provinces), an "also delete contained
 * <childKind>" checkbox is offered and the cascade summary updates live as it is
 * toggled. `describe` recomputes the summary for the current child-delete choice;
 * `onConfirm` receives that choice. Only fires onConfirm when the user commits.
 */
export function bulkDeleteConfirm(params: {
  typeLabel: string;
  childKind?: string;
  describe: (deleteChildren: boolean) => CascadeSummary;
  onConfirm: (deleteChildren: boolean) => void;
}): void {
  const { typeLabel, childKind, describe, onConfirm } = params;

  if (!describe(false).deletable) {
    tip(`Nothing to delete — all selected ${typeLabel} are locked.`, true, "error");
    return;
  }

  const childToggle = childKind
    ? `<label class="bulkDeleteChildrenLabel" style="display:block; margin-top:0.4em">
        <input type="checkbox" id="bulkDeleteChildren" class="native" /> Also delete contained ${childKind}
      </label>`
    : "";
  const message = `<div id="bulkCascadeSummary">${renderSummary(describe(false))}</div>${childToggle}<p>This action cannot be reverted.</p>`;

  const getDeleteChildren = (): boolean => !!findEl<HTMLInputElement>("bulkDeleteChildren")?.checked;

  confirmationDialog({
    title: `Delete ${typeLabel}`,
    message,
    confirm: "Delete",
    onConfirm: () => onConfirm(getDeleteChildren())
  });

  // live-update the cascade summary when the child-delete checkbox is toggled
  if (childKind) {
    findEl<HTMLInputElement>("bulkDeleteChildren")?.addEventListener("change", () => {
      const summary = findEl("bulkCascadeSummary");
      if (summary) summary.innerHTML = renderSummary(describe(getDeleteChildren()));
    });
  }
}
