// A relief pool: the relief types and icons a biome's lowland or a relief rule places, with their weights
import { confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import type { ReliefRule } from "@/components/options-schema";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import type { ReliefPool } from "@/generators/relief-generator";
import { redrawRelief } from "@/renderers/draw-relief-icons";
import { ensureEl, escapeHtml, minmax, rn } from "@/utils";
import { fitReliefArt, poolEntryHtml, poolEntryName } from "./relief-previews";

const DIALOG = "reliefPoolEditor";
const MAX_DENSITY = 250;

const STYLE = /* css */ `
  #${DIALOG} { padding: .4em .6em; }
  #${DIALOG} > div { width: auto; }
  #${DIALOG} .density { display: flex; align-items: center; gap: .5em; margin-bottom: .6em; }
  #${DIALOG} .density slider-input { flex: 1; }
  #${DIALOG} .density input[type=range] { flex: 1; min-width: 0; }
  #${DIALOG} .density input[type=number] { width: 4em; }
  #${DIALOG} .entries { display: grid; gap: .2em; max-height: 16em; overflow-y: auto; margin-bottom: .6em; }
  #${DIALOG} .entry { display: grid; grid-template-columns: 2em 1fr 4em 3em 1.6em; align-items: center; gap: .4em; }
  #${DIALOG} .entry .preview { display: grid; place-items: center; font-size: 1.8em; }
  #${DIALOG} .entry .preview svg { width: 1em; height: 1em; overflow: visible; }
  #${DIALOG} .entry .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #${DIALOG} .entry .share { text-align: right; opacity: .7; }
  #${DIALOG} .entry button { margin: 0; padding: 0; border: 0; background: none; box-shadow: none; cursor: pointer; }
  #${DIALOG} .empty { margin: .4em 0; font-style: italic; opacity: .7; }
  #${DIALOG} .caption { margin: .4em 0 .3em; font-size: .85em; opacity: .7; }
  #${DIALOG} .types { display: grid; grid-template-columns: repeat(7, 1fr); gap: .3em; }
  #${DIALOG} .types button { display: grid; place-items: center; aspect-ratio: 1; margin: 0; padding: 0; border: 1px solid transparent; border-radius: 4px; background: #0000000a; box-shadow: none; font-size: 1.9em; cursor: pointer; }
  #${DIALOG} .types button:hover { background: #00000017; }
  #${DIALOG} .types button svg { width: 1em; height: 1em; overflow: visible; pointer-events: none; }
  #${DIALOG} .any { margin: .5em 0 0; width: 100%; }
`;

export type ReliefPoolEditorOptions = ({ biome: number } | { rule: ReliefRule }) & {
  onApply?: () => void; // after the pool and density are written
};

/** what the dialog edits, and the cells whose relief it places */
interface PoolTarget {
  title: string;
  place: string; // where the pool's relief goes, in a sentence
  icons: ReliefPool;
  density: number;
  write: (icons: ReliefPool, density: number) => void;
  covers: (cell: number) => boolean;
  exists: () => boolean; // a removed rule or a replaced map leaves the dialog nothing to write to
}

function targetOf(request: ReliefPoolEditorOptions): PoolTarget {
  if ("rule" in request) {
    const { rule } = request;
    return {
      title: `Relief rule: ${rule.name}`,
      place: `the cells the ${rule.name} rule claims`,
      icons: rule.icons,
      density: rule.density,
      write: (icons, density) => {
        Object.assign(rule, { icons, density });
        Options.save();
      },
      covers: cell => Relief.claim(cell) === rule,
      exists: () => options.map.relief.rules.includes(rule)
    };
  }
  const biome = pack.biomes[request.biome];
  return {
    title: `Relief pool: ${biome.name}`,
    place: `${biome.name} lowland`,
    icons: biome.icons,
    density: biome.iconsDensity,
    write: (icons, density) => Object.assign(biome, { icons, iconsDensity: density }),
    covers: cell => Relief.isPoolCell(cell, request.biome),
    exists: () => pack.biomes[request.biome] === biome && !biome.removed
  };
}

function open(request: ReliefPoolEditorOptions): void {
  const target = targetOf(request);
  const { set } = styles.relief.options;
  let pool: ReliefPool = { ...target.icons };

  destroyDialog(DIALOG);
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${DIALOG}" class="dialog">
      <style>${STYLE}</style>
      <div class="density" data-tip="How packed the relief is. 0 places none">
        <span>Density</span>
        <slider-input min="0" max="${MAX_DENSITY}" step="1" value="${target.density}"></slider-input>
      </div>
      <div class="entries"></div>
      <div class="caption">Add a relief type, drawn in the style's relief set</div>
      <div class="types">${Relief.types
        .map(
          ({ type, label }) =>
            `<button type="button" data-entry="${type}" data-tip="Add ${label}">${poolEntryHtml(type, set)}</button>`
        )
        .join("")}</div>
      <button type="button" class="any" data-tip="Add your own icon, an emoji or another set's art">Add any icon…</button>
    </div>`
  );
  const dialog = ensureEl(DIALOG);
  const entries = dialog.querySelector<HTMLElement>(".entries")!;
  const density = dialog.querySelector<HTMLElement & { valueAsNumber: number }>("slider-input")!;

  const render = () => {
    const total = Object.values(pool).reduce((sum, weight) => sum + weight, 0);
    entries.innerHTML = total
      ? Object.entries(pool)
          .map(
            ([entry, weight]) => /* html */ `<div class="entry" data-entry="${escapeHtml(entry)}">
              <span class="preview">${poolEntryHtml(entry, set)}</span>
              <span class="name">${escapeHtml(poolEntryName(entry))}</span>
              <input type="number" class="weight" min="1" step="1" value="${weight}" data-tip="Weight: how often the entry is picked, relative to the others" />
              <span class="share" data-tip="Share of the pool's relief">${rn((weight / total) * 100)}%</span>
              <button type="button" class="icon-trash-empty" data-tip="Remove from the pool"></button>
            </div>`
          )
          .join("")
      : `<p class="empty">The pool is empty: ${escapeHtml(target.place)} gets no relief</p>`;
    void fitReliefArt(dialog, set);
  };
  const add = (entry: string) => {
    pool = { ...pool, [entry]: (pool[entry] ?? 0) + 1 };
    render();
  };
  const entryOf = (target: EventTarget | null) =>
    (target as Element).closest<HTMLElement>(".entry")?.dataset.entry ?? null;

  dialog.querySelector(".types")!.addEventListener("click", event => {
    const entry = (event.target as Element).closest<HTMLElement>("button[data-entry]")?.dataset.entry;
    if (entry) add(entry);
  });
  dialog.querySelector(".any")!.addEventListener("click", () => {
    const original = pool;
    Controllers.IconPicker.open({
      current: "",
      onPick: id => {
        pool = original;
        if (id) add(id);
        else render();
      }
    });
  });
  entries.addEventListener("change", event => {
    const entry = entryOf(event.target);
    const weight = Math.round(Number((event.target as HTMLInputElement).value));
    if (entry !== null) pool = { ...pool, [entry]: Math.max(1, weight || 1) };
    render();
  });
  entries.addEventListener("click", event => {
    const entry = entryOf(event.target);
    if (entry === null || !(event.target as Element).classList.contains("icon-trash-empty")) return;
    const { [entry]: _, ...rest } = pool;
    pool = rest;
    render();
  });
  render();

  const apply = () => {
    target.write(pool, minmax(Math.round(density.valueAsNumber) || 0, 0, MAX_DENSITY));
    request.onApply?.();
  };
  const close = () => $(dialog).dialog("close");
  const gone = () => tip(`${target.title} no longer exists: nothing is applied`, false, "error");

  $(dialog).dialog({
    title: target.title,
    width: "25em",
    resizable: false,
    position: { my: "center", at: "center", of: "svg" },
    close: () => destroyDialog(DIALOG),
    buttons: {
      Apply: () => {
        if (target.exists()) apply();
        else gone();
        close();
      },
      "Apply and re-place": () => {
        if (target.exists()) {
          confirmReplace(target.place, target.covers, () => {
            apply();
            close();
          });
        } else {
          gone();
          close();
        }
      },
      Cancel: close
    }
  });
}

/** place the covered cells' relief anew, once confirmed; `before` writes what the new relief follows */
export function confirmReplace(
  place: string,
  covers: (cell: number) => boolean,
  before: () => void,
  after?: () => void
): void {
  const count = pack.relief?.length ? Relief.iconsOn(covers).length : 0;
  confirmationDialog({
    title: "Re-place relief",
    message: `Replace the ${count} relief icons on ${escapeHtml(place)} with new ones? Relief elsewhere is kept`,
    confirm: "Re-place",
    onConfirm: () => {
      before();
      // an ungenerated layer places everything when it is first drawn
      if (pack.relief?.length) Relief.regenerate(covers);
      if (Layers.isOn("relief")) redrawRelief();
      else Layers.show("relief");
      after?.();
    }
  });
}

export const ReliefPoolEditor = { open };
