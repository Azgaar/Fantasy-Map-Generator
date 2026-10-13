// A relief pool: the relief types and icons a biome's lowland or a relief rule places, with their weights and sizes
import { confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import type { ReliefRule } from "@/components/options-schema";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { Biomes } from "@/generators/biomes-generator";
import type { ReliefPool } from "@/generators/relief-generator";
import { redrawRelief } from "@/renderers/draw-relief-icons";
import { ensureEl, escapeHtml, getHeight, minmax, rn } from "@/utils";
import { sentences, t } from "@/utils/i18n";
import { fitReliefArt, poolEntryHtml, poolEntryName, reliefPatchHtml } from "./relief-previews";

const DIALOG = "reliefPoolEditor";
const MAX_DENSITY = 250;
const MAX_SIZE = 5; // an entry's size, as a multiple of its pool's
const LAND = "#d8d2bb"; // under a rule that claims more than one biome

const STYLE = /* css */ `
  #${DIALOG} { padding: .4em .6em; }
  #${DIALOG} > div { width: auto; }
  #${DIALOG} .patch { position: relative; height: 7em; margin-bottom: .3em; border-radius: 4px; overflow: hidden; }
  #${DIALOG} .patch .art, #${DIALOG} .patch svg { display: block; width: 100%; height: 100%; }
  #${DIALOG} .patch .empty { display: grid; place-items: center; height: 100%; margin: 0; }
  #${DIALOG} .patch .shuffle { position: absolute; top: .3em; right: .3em; margin: 0; padding: .1em .3em; border: 0; border-radius: 3px; background: #ffffffb0; box-shadow: none; cursor: pointer; }
  #${DIALOG} .heights { display: flex; justify-content: space-between; font-size: .85em; opacity: .7; }
  #${DIALOG} .setting { display: flex; align-items: center; gap: .5em; margin: .3em 0; }
  #${DIALOG} .setting > span:first-child { width: 3.6em; }
  #${DIALOG} .setting slider-input { flex: 1; }
  #${DIALOG} .setting input[type=range] { flex: 1; min-width: 0; }
  #${DIALOG} .setting input[type=number] { width: 4em; }
  #${DIALOG} .entries { display: grid; gap: .2em; max-height: 16em; overflow-y: auto; margin: .5em 0 .6em; }
  #${DIALOG} .entry, #${DIALOG} .head { display: grid; grid-template-columns: 2em 1fr 3.8em 3.8em 3em 1.6em; align-items: center; gap: 1em; }
  #${DIALOG} .head { opacity: .7; }
  #${DIALOG} .head span:nth-child(n+3) { text-align: center; }
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
  #${DIALOG} .actions { display: flex; gap: .3em; margin: .5em 0 0; }
  #${DIALOG} .actions button { margin: 0; }
  #${DIALOG} .any { flex: 1; }
`;

export type ReliefPoolEditorOptions = ({ biome: number } | { rule: ReliefRule }) & {
  onApply?: () => void; // after the pool and density are written
};

/** what the dialog edits: a rule also has its size range */
interface PoolDraft {
  icons: ReliefPool;
  density: number;
  size?: ReliefRule["size"];
}

/** what the dialog edits, and the cells whose relief it places */
interface PoolTarget {
  title: string;
  place: string; // where the pool's relief goes, in a sentence
  draft: PoolDraft;
  rule?: ReliefRule; // the preview grows a rule's icons with its height range
  color: string; // the land the preview draws on
  write: (draft: PoolDraft) => void;
  defaults?: () => PoolDraft; // what the pool is on a new map; absent for a rule of the user's own
  covers: (cell: number) => boolean;
  exists: () => boolean; // a removed rule or a replaced map leaves the dialog nothing to write to
}

const clonePool = (pool: ReliefPool): ReliefPool => structuredClone(pool);

function targetOf(request: ReliefPoolEditorOptions): PoolTarget {
  if ("rule" in request) {
    const { rule } = request;
    const only = rule.biomes?.length === 1 ? pack.biomes[rule.biomes[0]] : undefined;
    const preset = Relief.getDefaultRules().find(({ name }) => name === rule.name);
    return {
      title: t("Relief rule: {{- rule}}", { rule: rule.name }),
      place: t("the cells the {{- rule}} rule claims", { rule: rule.name }),
      draft: { icons: clonePool(rule.icons), density: rule.density, size: { ...rule.size } },
      rule,
      color: only?.color ?? LAND,
      write: draft => {
        Object.assign(rule, draft);
        Options.save();
      },
      defaults: preset && (() => ({ icons: preset.icons, density: preset.density, size: preset.size })),
      covers: cell => Relief.claim(cell) === rule,
      exists: () => options.map.relief.rules.includes(rule)
    };
  }
  const biome = pack.biomes[request.biome];
  return {
    title: t("Relief pool: {{- biome}}", { biome: biome.name }),
    place: t("{{- biome}} lowland", { biome: biome.name }),
    draft: { icons: clonePool(biome.icons), density: biome.iconsDensity },
    color: biome.color ?? LAND,
    write: ({ icons, density }) => Object.assign(biome, { icons, iconsDensity: density }),
    defaults: () => {
      const preset = Biomes.getDefault()[request.biome]; // a custom biome starts bare
      return { icons: preset?.icons ?? {}, density: preset?.iconsDensity ?? 0 };
    },
    covers: cell => Relief.isPoolCell(cell, request.biome),
    exists: () => pack.biomes[request.biome] === biome && !biome.removed
  };
}

function open(request: ReliefPoolEditorOptions): void {
  const target = targetOf(request);
  const { set } = styles.relief.options;
  const draft = target.draft;
  const { rule } = target;
  let seed = 1;

  const sizeRange = draft.size
    ? /* html */ `<div class="setting ruleSize" data-tip="${t("Icon size at the rule's lowest height, growing with height up to the second value. Each entry's size scales it")}">
        <span>${t("Size")}</span>
        <input type="number" data-bound="min" min="0.1" step="0.1" value="${draft.size.min}" />–<input type="number" data-bound="max" min="0.1" step="0.1" value="${draft.size.max}" />
      </div>`
    : "";
  const heights = rule
    ? `<div class="heights"><span>${getHeight(rule.height.min)}</span><span>${t("Height")}</span><span>${getHeight(rule.height.max)}</span></div>`
    : "";

  destroyDialog(DIALOG);
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${DIALOG}" class="dialog">
      <style>${STYLE}</style>
      <div class="patch" style="background: color-mix(in srgb, ${escapeHtml(target.color)} 55%, white)" data-tip="${t("A sample of the relief the pool places, at the map's sizes and spacing")}">
        <div class="art"></div>
        <button type="button" class="shuffle icon-shuffle" data-tip="${t("Draw another sample")}"></button>
      </div>
      ${heights}
      <div class="setting density" data-tip="${t("How packed the relief is. 0 places none")}">
        <span>${t("Density")}</span>
        <slider-input min="0" max="${MAX_DENSITY}" step="1" value="${draft.density}"></slider-input>
      </div>
      ${sizeRange}
      <div class="entries"></div>
      <div class="caption">${t("Add a relief type, drawn in the style's relief set")}</div>
      <div class="types">${Relief.types
        .map(
          ({ type, label }) =>
            `<button type="button" data-entry="${type}" data-tip="${t("Add {{icon}}", { icon: label })}">${poolEntryHtml(type, set)}</button>`
        )
        .join("")}</div>
      <div class="actions">
        <button type="button" class="any" data-tip="${t("Add your own icon, an emoji or another set's art")}">${t("Add any icon…")}</button>
        ${target.defaults ? `<button type="button" class="restore icon-ccw" data-tip="${draft.size ? sentences(t("Restore the default pool, density and size"), t("Apply to keep it")) : sentences(t("Restore the default pool and density"), t("Apply to keep it"))}"></button>` : ""}
      </div>
    </div>`
  );
  const dialog = ensureEl(DIALOG);
  const art = dialog.querySelector<HTMLElement>(".patch .art")!;
  const entries = dialog.querySelector<HTMLElement>(".entries")!;
  const density = dialog.querySelector<HTMLElement & { value: string; valueAsNumber: number }>("slider-input")!;

  const drawPatch = () => {
    const sample = rule && draft.size ? { ...rule, size: draft.size } : undefined;
    art.innerHTML =
      reliefPatchHtml(draft.icons, draft.density, sample, seed) ||
      `<p class="empty">${t("No relief: {{place}} stays bare", { place: target.place })}</p>`;
  };
  const total = () => Object.values(draft.icons).reduce((sum, { weight }) => sum + weight, 0);
  const share = (weight: number) => `${rn((weight / total()) * 100)}%`;

  const render = () => {
    entries.innerHTML = total()
      ? /* html */ `<div class="head"><span></span><span></span><span>${t("Weight")}</span><span>${t("Size")}</span><span>${t("Share", { context: "portion" })}</span><span></span></div>` +
        Object.entries(draft.icons)
          .map(
            ([entry, { weight, size = 1 }]) => /* html */ `<div class="entry" data-entry="${escapeHtml(entry)}">
              <span class="preview">${poolEntryHtml(entry, set)}</span>
              <span class="name">${escapeHtml(poolEntryName(entry))}</span>
              <input type="number" class="weight" min="1" step="1" value="${weight}" data-tip="${t("Weight: how often the entry is picked, relative to the others")}" />
              <input type="number" class="size" min="0.1" max="${MAX_SIZE}" step="0.1" value="${size}" data-tip="${t("Size: the entry's icons as a multiple of the pool's size")}" />
              <span class="share" data-tip="${t("Share of the pool's relief")}">${share(weight)}</span>
              <button type="button" class="icon-trash-empty" data-tip="${t("Remove")}"></button>
            </div>`
          )
          .join("")
      : `<p class="empty">${t("The pool is empty: {{place}} gets no relief", { place: target.place })}</p>`;
    void fitReliefArt(dialog, set);
    drawPatch();
  };
  const add = (entry: string) => {
    const current = draft.icons[entry];
    draft.icons[entry] = { ...current, weight: (current?.weight ?? 0) + 1 };
    render();
  };
  const entryOf = (target: EventTarget | null) =>
    (target as Element).closest<HTMLElement>(".entry")?.dataset.entry ?? null;

  /** write an entry's input to the draft: a live edit takes valid values only, a committed one is clamped */
  const readEntry = (input: HTMLInputElement, committed: boolean): boolean => {
    const entry = entryOf(input);
    if (entry === null || !draft.icons[entry]) return false;
    const value = Number(input.value);
    if (!committed && !(value > 0)) return false;
    const pool = draft.icons[entry];
    if (input.classList.contains("weight")) pool.weight = Math.max(1, Math.round(value) || 1);
    else if (input.classList.contains("size")) {
      const size = minmax(rn(value || 1, 2), 0.1, MAX_SIZE);
      if (size === 1) delete pool.size;
      else pool.size = size;
    }
    return true;
  };

  dialog.querySelector(".types")!.addEventListener("click", event => {
    const entry = (event.target as Element).closest<HTMLElement>("button[data-entry]")?.dataset.entry;
    if (entry) add(entry);
  });
  dialog.querySelector(".any")!.addEventListener("click", () => {
    Controllers.IconPicker.open({ current: "", onPick: id => id && add(id) });
  });
  dialog.querySelector(".shuffle")!.addEventListener("click", () => {
    seed++;
    drawPatch();
  });
  // slider-input re-dispatches a bubbling event from its inner controls; ignore those duplicates
  density.addEventListener("input", event => {
    if (event.target !== density) return;
    draft.density = minmax(Math.round(density.valueAsNumber) || 0, 0, MAX_DENSITY);
    drawPatch();
  });
  dialog.querySelector(".ruleSize")?.addEventListener("change", event => {
    const input = event.target as HTMLInputElement;
    const bound = input.dataset.bound as "min" | "max";
    const range = draft.size!;
    range[bound] = Math.max(0.1, Number(input.value) || range[bound]);
    // a bound moved past the other one drags it along
    if (range.min > range.max) range[bound === "min" ? "max" : "min"] = range[bound];
    showSize();
    drawPatch();
  });
  const showSize = () => {
    for (const field of dialog.querySelectorAll<HTMLInputElement>(".ruleSize input"))
      field.value = String(draft.size![field.dataset.bound as "min" | "max"]);
  };
  dialog.querySelector(".restore")?.addEventListener("click", () => {
    const { icons, density: defaultDensity, size } = target.defaults!();
    Object.assign(draft, { icons: clonePool(icons), density: defaultDensity }, size && { size: { ...size } });
    density.value = String(defaultDensity);
    if (size) showSize();
    render();
  });
  entries.addEventListener("input", event => {
    const input = event.target as HTMLInputElement;
    if (!readEntry(input, false)) return;
    for (const row of entries.querySelectorAll<HTMLElement>(".entry"))
      row.querySelector(".share")!.textContent = share(draft.icons[row.dataset.entry!].weight);
    drawPatch();
  });
  entries.addEventListener("change", event => {
    if (readEntry(event.target as HTMLInputElement, true)) render();
  });
  entries.addEventListener("click", event => {
    const entry = entryOf(event.target);
    if (entry === null || !(event.target as Element).classList.contains("icon-trash-empty")) return;
    delete draft.icons[entry];
    render();
  });
  render();

  const apply = () => {
    draft.density = minmax(Math.round(density.valueAsNumber) || 0, 0, MAX_DENSITY);
    target.write(draft);
    request.onApply?.();
  };
  const close = () => $(dialog).dialog("close");
  const gone = () =>
    tip(t("{{target}} no longer exists: nothing is applied", { target: target.title }), false, "error");

  $(dialog).dialog({
    title: target.title,
    width: "28em",
    resizable: false,
    position: { my: "center", at: "center", of: "svg" },
    close: () => destroyDialog(DIALOG),
    buttons: {
      [t("Apply")]: () => {
        if (target.exists()) apply();
        else gone();
        close();
      },
      [t("Apply and re-place")]: () => {
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
      [t("Cancel")]: close
    }
  });
}

/** place the covered cells' relief anew, once confirmed; `before` writes what the new relief follows */
export function confirmReplace(place: string, covers: (cell: number) => boolean, before?: () => void): void {
  const count = pack.relief?.length ? Relief.iconsOn(covers).length : 0;
  confirmationDialog({
    title: t("Re-place relief"),
    message: sentences(
      t("Replace relief icons on {{place}} with new ones ({{icons}})?", { place, icons: count }),
      t("Relief elsewhere is kept")
    ),
    confirm: t("Re-place"),
    onConfirm: () => {
      before?.();
      // an ungenerated layer places everything when it is first drawn
      if (pack.relief?.length) Relief.regenerate(covers);
      if (Layers.isOn("relief")) redrawRelief();
      else Layers.show("relief");
    }
  });
}

export const ReliefPoolEditor = { open };
