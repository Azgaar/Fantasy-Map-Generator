import { alertDialog, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { World } from "@/controllers/assistant/world";
import { Csv } from "@/services/io/csv";
import { t } from "@/utils/i18n";
import { errorText, escapeHtml } from "@/utils/stringUtils";

interface UpdateOptions {
  find: (id: number) => { name?: unknown } | undefined; // the living entity with this id
  units?: readonly string[]; // columns exported with a unit, such as "Area mi2"
  text?: readonly string[]; // columns whose text the editors show; a changed value cannot hold markup characters
}

/** One uploaded row; a setter that throws is reported and the next value is applied */
interface CsvRow {
  /** Set a non-blank cell that differs from `current` */
  apply(column: string, set: (value: string) => void, current?: unknown): void;
  /** Set a present cell even when blank, for flags and lists */
  assign(column: string, set: (value: string) => void, current?: unknown): void;
  /** Set rural and urban people: changed rural and urban cells win, else a changed total keeps the current split */
  population(current: [number, number], set: (rural: number, urban: number) => void, columns?: string[]): void;
}

/** A value the upload sets, or could not set and why (markup, already escaped) */
export interface CsvOutcome {
  id: string;
  name: string;
  column: string;
  before: string;
  after: string;
  reason?: string;
}

const POPULATION = ["Total Population", "Rural Population", "Urban Population"];
// a cell equals the value as downloaded; spreadsheets may reformat numbers, such as 2.5 into 2.50
const isSame = (cell: string, current: unknown) =>
  cell === String(current ?? "") || (typeof current === "number" && cell !== "" && +cell === current);
const STYLE = /* css */ `
  .csv-preview { min-width: 28em; width: 100%; border-collapse: collapse; }
  .csv-preview th, .csv-preview td { padding: 0.25em 0.6em; text-align: left; vertical-align: top; }
  .csv-preview th { white-space: nowrap; border-bottom: 1px solid #0003; }
  .csv-preview td { max-width: 16em; overflow-wrap: break-word; }
  .csv-preview td.summary { max-width: none; padding-top: 0.8em; font-weight: bold; }
  .csv-preview tr.first td { border-top: 1px solid #0001; }
  .csv-preview td.before { color: #666; }
  .csv-preview .failed, .csv-preview .reason { color: #a32020; }
  .csv-preview .reason { font-size: 0.9em; }
`;
const changed = (value: number, current: number) => !(Math.abs(value - current) < 1); // exports round people; NaN counts as changed

/** Update existing entities by Id from an uploaded CSV. Any unknown id stops it before a change; otherwise the rows
 * are tried on a draft of the map and the user confirms the preview. Resolves to whether the map was changed */
async function update(
  text: string,
  known: readonly string[],
  options: UpdateOptions,
  update: (id: number, row: CsvRow) => void // reads the entity by id, as it runs on a draft first
): Promise<boolean> {
  let table: ReturnType<typeof Csv.read>;
  try {
    table = Csv.read(text, known, { required: ["Id"], units: options.units });
  } catch (error) {
    alertDialog({ message: errorText(error) });
    return false;
  }

  const ids = table.rows.map(row => row.Id.trim());
  const missing = ids.filter(id => !/^\d+$/.test(id) || !options.find(+id));
  if (missing.length) {
    const message = t(
      "Upload only allows to update existing entries. Missing keys: {{ids}}. Create them first and then re-download CSV to check their ids",
      { ids: missing.map(id => id || "?").join(", ") }
    );
    alertDialog({ message });
    return false;
  }

  const run = (): CsvOutcome[] => {
    const outcomes: CsvOutcome[] = [];
    table.rows.forEach((cells, index) => {
      const id = ids[index];
      const entity = options.find(+id)!;
      const name = String(entity.name ?? "");
      const get = (column: string) => cells[column]?.trim() ?? "";
      const record = (column: string, before: unknown, after: unknown, reason?: string) =>
        outcomes.push({ id, name, column, before: String(before ?? ""), after: String(after ?? ""), reason });
      const set = (column: string, setter: (value: string) => void, current: unknown) => {
        if (current !== undefined && isSame(get(column), current)) return;
        const unsafe = options.text?.includes(column) && Csv.unsafeText(get(column));
        if (unsafe) {
          record(column, current, get(column), unsafe);
          return;
        }
        try {
          setter(get(column));
          record(column, current, get(column));
        } catch (error) {
          record(column, current, get(column), escapeHtml(errorText(error)));
        }
      };
      update(+id, {
        apply: (column, setter, current) => {
          if (get(column)) set(column, setter, current);
        },
        assign: (column, setter, current) => {
          if (column in cells) set(column, setter, current);
        },
        population: ([rural, urban], setter, [total, ruralColumn, urbanColumn] = POPULATION) => {
          const [people, ruralPeople, urbanPeople] = [get(total), get(ruralColumn ?? ""), get(urbanColumn ?? "")];
          let next: [number, number] | undefined;
          if (ruralPeople && urbanPeople && (changed(+ruralPeople, rural) || changed(+urbanPeople, urban)))
            next = [+ruralPeople, +urbanPeople];
          else if (people && changed(+people, rural + urban)) {
            const ratio = rural + urban ? urban / (rural + urban) : 0;
            next = [+people * (1 - ratio), +people * ratio];
          }
          if (!next) return;
          const [before, after] = [Math.round(rural + urban), Math.round(next[0] + next[1])];
          try {
            setter(...next);
            record(t("Population"), before, after);
          } catch (error) {
            record(t("Population"), before, after, escapeHtml(errorText(error)));
          }
        }
      });
    });
    return outcomes;
  };

  const preview = World.live().draft().asLive(run);
  if (!(await review(preview, table.unknown))) return false;

  // the preview listed what cannot be applied; report only what fails on the map unexpectedly
  const key = ({ id, column }: CsvOutcome) => `${id} ${column}`;
  const expected = new Set(preview.filter(outcome => outcome.reason).map(key));
  const failed = run().filter(outcome => outcome.reason && !expected.has(key(outcome)));
  if (failed.length) {
    const lines = failed.map(({ id, column, reason }) => `${escapeHtml(id)} ${column}: ${reason}`);
    alertDialog({ message: `${t("Some values were not applied")}<br>${lines.join("<br>")}` });
  } else tip(t("Data is updated"), false, "success", 4000);
  return true;
}

/** Show what an upload changes and what it cannot; resolves to whether the user applies it. With nothing to
 * apply there is no Apply: the preview only tells why */
function review(outcomes: CsvOutcome[], unknown: string[]): Promise<boolean> {
  if (!outcomes.length && !unknown.length) {
    alertDialog({ message: t("No changes found in the file") });
    return Promise.resolve(false);
  }
  if (outcomes.every(outcome => outcome.reason)) {
    const message = `<p>${t("Nothing in the file can be applied")}</p>${previewMessage(outcomes, unknown)}`;
    alertDialog({ title: t("Upload preview"), message, width: "auto" });
    return Promise.resolve(false);
  }

  return new Promise(resolve =>
    confirmationDialog({
      title: t("Upload preview"),
      message: previewMessage(outcomes, unknown),
      confirm: t("Apply"),
      width: "auto",
      modal: true, // the map must not change between the preview and Apply
      onCancel: () => resolve(false),
      onConfirm: () => resolve(true)
    })
  );
}

/** The values the upload sets and those it cannot, in one table grouped by entity */
function previewMessage(outcomes: CsvOutcome[], unknown: string[]): string {
  const headers = ["Id", t("Name"), t("Column"), t("Current value"), t("New value")];
  const heading = (text: string, failed = false) =>
    `<tr><td colspan="${headers.length}" class="summary${failed ? " failed" : ""}">${text}</td></tr>`;
  const rows = (list: CsvOutcome[]) => {
    const groups = new Map<string, CsvOutcome[]>();
    for (const row of list) groups.get(row.id)?.push(row) ?? groups.set(row.id, [row]);
    return [...groups.values()].flatMap(group =>
      group.map((row, index) => {
        const span = `rowspan="${group.length}"`;
        const entity = index ? "" : `<td ${span}>${escapeHtml(row.id)}</td><td ${span}>${escapeHtml(row.name)}</td>`;
        const reason = row.reason ? `<div class="reason">${row.reason}</div>` : "";
        return `<tr${index ? "" : ' class="first"'}>${entity}<td>${row.column}</td><td class="before">${escapeHtml(row.before)}</td><td>${escapeHtml(row.after)}${reason}</td></tr>`;
      })
    );
  };

  const updates = outcomes.filter(outcome => !outcome.reason);
  const failures = outcomes.filter(outcome => outcome.reason);
  const body = updates.length ? [heading(`${t("Values to update")}: ${updates.length}`), ...rows(updates)] : [];
  if (failures.length)
    body.push(heading(`${t("Values that will not be applied")}: ${failures.length}`, true), ...rows(failures));
  if (unknown.length) body.push(heading(`${t("Unknown column")}: ${unknown.map(escapeHtml).join(", ")}`, true));
  const header = `<tr>${headers.map(text => `<th>${text}</th>`).join("")}</tr>`;
  return `<style>${STYLE}</style><table class="csv-preview">${header}${body.join("")}</table>`;
}

export const CsvUpload = { update };
