// Pick which entities (biomes, states, cultures, religions) something is limited to; an empty list allows all
import { tip } from "@/components/tooltips";
import { ensureEl, escapeHtml } from "@/utils";

export interface LimitationItem {
  i: number;
  name: string;
  fullName?: string;
  color?: string;
  removed?: boolean;
}

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
  onApply
}: {
  title: string;
  heading: string;
  items: readonly LimitationItem[];
  allowed: readonly number[] | undefined;
  onApply: (allowed: number[]) => void; // empty when every entity is checked
}): void {
  const rows = choices(items).map(
    ({ i, name, fullName, color }) => /* html */ `<tr data-tip="${escapeHtml(name)}">
      <td><span style="color:${escapeHtml(color ?? "")}">⬤</span></td>
      <td>
        <input data-i="${i}" id="limitation${i}" type="checkbox" class="checkbox" ${!allowed?.length || allowed.includes(i) ? "checked" : ""}>
        <label for="limitation${i}" class="checkbox-label">${escapeHtml(fullName || name)}</label>
      </td>
    </tr>`
  );
  const message = ensureEl("alertMessage");
  message.innerHTML = /* html */ `<b>${escapeHtml(heading)}:</b>
    <table style="margin-top:.3em"><tbody>${rows.join("")}</tbody></table>`;
  const inputs = () => Array.from(message.querySelectorAll<HTMLInputElement>("input"));

  $("#alert").dialog({
    width: "fit-content",
    title,
    close: () => $("#alert").dialog("option", "buttons", {}), // release the closure over the live pack arrays
    buttons: {
      Invert: () => {
        for (const input of inputs()) input.checked = !input.checked;
      },
      Apply: () => {
        const checked = inputs().filter(input => input.checked);
        if (!checked.length) return tip("Select at least one element", false, "error");
        onApply(checked.length === inputs().length ? [] : checked.map(input => Number(input.dataset.i)));
        $("#alert").dialog("close");
      },
      Cancel: () => $("#alert").dialog("close")
    }
  });
}
