// Pick which entities (biomes, states, cultures, religions) something is limited to; an empty list allows all

import { Dialog } from "@/ui/dialog/dialog";

import { tip } from "@/ui/tooltips";
import { t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { escapeHtml } from "@/utils/string-utils";

export interface LimitationItem {
  i: number;
  name: string;
  fullName?: string;
  color?: string;
  removed?: boolean;
}

const DIALOG_ID = "limitationPicker";
const ROWS_PER_COLUMN = 20; // longer lists, such as goods, flow into up to four columns

/** the entities a limitation can name: id 0 (marine, neutrals, no religion) and removed ones never */
const choices = (items: readonly LimitationItem[]) => items.filter(item => item.i && !item.removed);

/** "all" for no limitation, else the allowed names */
export function limitationTip(allowed: readonly number[] | undefined, items: readonly LimitationItem[]): string {
  if (!allowed?.length) return "all";
  return allowed.map(i => items.find(item => item.i === i)?.name ?? "").join(", ");
}

export function pickLimitation({
  title,
  heading,
  items,
  allowed,
  onApply,
  exact = false,
  badge
}: {
  title: string;
  heading: string;
  items: readonly LimitationItem[];
  allowed: readonly number[] | undefined;
  onApply: (allowed: number[]) => void; // empty when every entity is checked
  exact?: boolean; // a selection, not a limitation: exactly the allowed are checked, and none is a valid choice
  badge?: (item: LimitationItem) => string; // markup drawn before the name instead of the color dot
}): void {
  const entries = choices(items);
  const rows = entries.map(
    item => /* html */ `<div style="break-inside: avoid; display: flex; align-items: center; gap: .2em">
      ${badge ? badge(item) : `<span style="color:${escapeHtml(item.color ?? "")}">⬤</span>`}
      <input data-i="${item.i}" id="limitation${item.i}" type="checkbox" class="checkbox" ${allowed?.includes(item.i) || (!exact && !allowed?.length) ? "checked" : ""}>
      <label for="limitation${item.i}" class="checkbox-label">${escapeHtml(item.fullName || item.name)}</label>
    </div>`
  );
  const columns = Math.min(4, Math.ceil(entries.length / ROWS_PER_COLUMN));
  Dialog.destroy(DIALOG_ID);
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${DIALOG_ID}" class="dialog"><b>${escapeHtml(heading)}:</b>
      <div style="margin-top: .3em; columns: ${columns}; column-gap: 1.5em">${rows.join("")}</div>
    </div>`
  );
  const inputs = () => Array.from(ensureEl(DIALOG_ID).querySelectorAll<HTMLInputElement>("input"));

  Dialog.open(DIALOG_ID, {
    width: "fit-content",
    title,
    position: { my: "center", at: "center", of: "svg" },
    buttons: [
      {
        label: t("Invert"),
        onClick: () => {
          for (const input of inputs()) input.checked = !input.checked;
        }
      },
      {
        label: t("Apply"),
        onClick: () => {
          const checked = inputs().filter(input => input.checked);
          const ids = checked.map(input => Number(input.dataset.i));
          if (exact) onApply(ids);
          else if (!checked.length) return tip(t("Select at least one element"), false, "error");
          else onApply(checked.length === inputs().length ? [] : ids);
          Dialog.close(DIALOG_ID);
        }
      },
      { label: t("Cancel"), onClick: () => Dialog.close(DIALOG_ID) }
    ]
  });
}
