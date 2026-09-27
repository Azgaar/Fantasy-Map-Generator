// Relief rules: which land cells take relief by elevation and temperature instead of their biome's pool
import { confirmationDialog, destroyDialog, updateDialog } from "@/components/dialog/dialog-helpers";
import { limitationTip, pickLimitation } from "@/components/dialog/limitation-picker";
import { type EditorColumn, initColumnVisibility, renderEditorHeader } from "@/components/dialog/table";
import type { ReliefRule } from "@/components/options-schema";
import { ensureEl, escapeHtml, getHeight, minmax } from "@/utils";
import { confirmReplace, ReliefPoolEditor } from "./relief-pool-editor";
import { fitReliefArt, poolPreviewHtml } from "./relief-previews";

const dialogId = "reliefRulesEditor";
const position = { my: "center", at: "center", of: "svg", collision: "fit" };

const columns: EditorColumn[] = [
  { key: "reorder", width: "1.1em", permanent: true },
  { key: "name", label: "Name", width: "10em", permanent: true },
  { key: "height", label: "Height", width: "5.5em", tip: "Height range, 20 (sea level) to 100", permanent: true },
  { key: "temperature", label: "Temperature", width: "6.5em", tip: "Temperature range in °C" },
  { key: "biomes", label: "Biomes", width: "5em", tip: "Biomes the rule claims" },
  { key: "size", label: "Size", width: "6em", tip: "Icon size at the lowest height, growing with height" },
  { key: "relief", label: "Relief", width: "8em", permanent: true },
  { key: "remove", width: "1.4em", permanent: true }
];

const STYLE = /* css */ `
  #${dialogId} .states [data-col] input { text-align: center; -moz-appearance: textfield; }
  #${dialogId} .states [data-col] input::-webkit-inner-spin-button { display: none; }
  #${dialogId} .states [data-col="name"] input { text-align: left; }
  #${dialogId} .rulePool { display: inline-flex; align-items: center; gap: .15em; font-size: 2.2em; line-height: 1; }
  #${dialogId} .rulePool svg { width: 1em; height: 1em; overflow: visible; pointer-events: none; }
  #${dialogId} .rulePool small { font-size: .35em; opacity: .7; }
  #${dialogId} .ruleBiomes { overflow: hidden; text-overflow: ellipsis; }
  #${dialogId} .empty { margin: .4em; font-style: italic; opacity: .7; }
  #${dialogId}Pending { color: #b0413e; }
`;

const rules = (): ReliefRule[] => options.map.relief.rules;
/** what a rule places, so a rename alone re-places nothing */
const placing = ({ name: _, ...rule }: ReliefRule): string => JSON.stringify(rule);

let placed: ReliefRule[] = []; // the rules the map's relief follows

function open(): void {
  placed = structuredClone(rules());
  destroyDialog(dialogId);
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${dialogId}" class="dialog editorDialog">
      <style>${STYLE}</style>
      ${renderEditorHeader({ dialogId, columns })}
      <div id="${dialogId}Body" class="table"></div>
      <div class="totalLine">
        <div style="margin-left: 4px">First match wins. Land no rule claims takes its biome's relief pool</div>
        <div id="${dialogId}Pending" style="margin-left: 4px">Not on the map yet: re-place relief to apply</div>
      </div>
      <div class="editorToolbar">
        <button id="${dialogId}Add" data-tip="Add a rule, checked last" class="icon-plus"></button>
        <button id="${dialogId}Restore" data-tip="Restore the default hills and mountains" class="icon-ccw"></button>
        <button id="${dialogId}Replace" data-tip="Re-place the relief where the rules changed it" class="icon-arrows-cw"></button>
      </div>
    </div>`
  );
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });

  const body = ensureEl(`${dialogId}Body`);
  body.addEventListener("change", event => onChange(event.target as HTMLInputElement));
  body.addEventListener("click", event => onClick(event.target as Element));
  $(body).sortable({
    items: "div.states",
    handle: ".icon-resize-vertical",
    containment: "parent",
    axis: "y",
    update: reorder
  });
  ensureEl(`${dialogId}Add`).addEventListener("click", addRule);
  ensureEl(`${dialogId}Restore`).addEventListener("click", restoreDefaults);
  ensureEl(`${dialogId}Replace`).addEventListener("click", replaceChanged);
  render();

  $(`#${dialogId}`).dialog({
    title: "Relief Rules",
    width: "fit-content",
    resizable: false,
    position,
    close: () => destroyDialog(dialogId)
  });
}

function render(): void {
  const body = ensureEl(`${dialogId}Body`);
  const bound = (field: string, value: number | null, attributes: string) =>
    `<input type="number" data-field="${field}" value="${value ?? ""}" ${attributes} />`;
  const range = (key: string, { min, max }: { min: number | null; max: number | null }, attributes: string) =>
    `${bound(`${key}.min`, min, attributes)}–${bound(`${key}.max`, max, attributes)}`;

  body.innerHTML =
    rules()
      .map(
        (rule, index) => /* html */ `<div class="states" data-index="${index}">
      <span data-col="reorder" data-tip="Drag to check the rule earlier or later" class="icon-resize-vertical"></span>
      <div data-col="name"><input data-field="name" value="${escapeHtml(rule.name)}" data-tip="Rule name" /></div>
      <div data-col="height" data-tip="Height range: ${getHeight(rule.height.min)} to ${getHeight(rule.height.max)}">${range("height", rule.height, 'min="20" max="100" step="1"')}</div>
      <div data-col="temperature" data-tip="Temperature range in °C. An empty bound is open">${range("temperature", rule.temperature, 'step="1" placeholder="any"')}</div>
      <div data-col="biomes"><span class="ruleBiomes pointer" data-tip="${escapeHtml(`Biomes: ${limitationTip(rule.biomes, pack.biomes)}. Click to change`)}">${biomesLabel(rule)}</span></div>
      <div data-col="size" data-tip="Icon size at the lowest height, growing with height up to the second value">${range("size", rule.size, 'min="0.1" step="0.1"')}</div>
      <div data-col="relief">${poolPreviewHtml(rule.icons, rule.density, "rulePool")}</div>
      <span data-col="remove" data-tip="Remove the rule" class="icon-trash-empty"></span>
    </div>`
      )
      .join("") || `<p class="empty">No rules: all land takes its biome's relief pool</p>`;

  const pending = rules().map(placing).join() !== placed.map(placing).join();
  ensureEl(`${dialogId}Pending`).style.display = pending ? "" : "none"; // .totalLine rows override [hidden]
  void fitReliefArt(body, styles.relief.options.set);
}

const biomesLabel = ({ biomes }: ReliefRule) =>
  !biomes?.length
    ? "all"
    : biomes.length === 1
      ? (pack.biomes[biomes[0]]?.name ?? "1 biome")
      : `${biomes.length} biomes`;

const ruleOf = (element: Element): ReliefRule | undefined =>
  rules()[Number(element.closest<HTMLElement>(".states")?.dataset.index)];

const commit = () => {
  Options.save();
  render();
};

function onChange(input: HTMLInputElement): void {
  const rule = ruleOf(input);
  const field = input.dataset.field;
  if (!rule || !field) return;

  if (field === "name") rule.name = input.value.trim() || rule.name;
  else {
    const [key, bound] = field.split(".") as ["height" | "temperature" | "size", "min" | "max"];
    const value = input.value === "" ? null : Number(input.value);
    if (key === "temperature") rule.temperature[bound] = value === null ? null : Math.round(value);
    else if (key === "height" && value !== null) rule.height[bound] = minmax(Math.round(value), 20, 100);
    else if (key === "size" && value) rule.size[bound] = Math.max(0.1, value);
  }
  commit();
}

function onClick(target: Element): void {
  const rule = ruleOf(target);
  if (!rule) return;
  if (target.closest(".rulePool")) ReliefPoolEditor.open({ rule, onApply: render });
  else if (target.closest(".ruleBiomes")) pickBiomes(rule);
  else if (target.classList.contains("icon-trash-empty")) {
    rules().splice(rules().indexOf(rule), 1);
    commit();
  }
}

function pickBiomes(rule: ReliefRule): void {
  pickLimitation({
    title: "Limit rule",
    heading: `Biomes the ${rule.name} rule claims`,
    items: pack.biomes,
    allowed: rule.biomes,
    onApply: allowed => {
      if (allowed.length) rule.biomes = allowed;
      else delete rule.biomes;
      commit();
    }
  });
}

/** take the order the rows were dragged into */
function reorder(): void {
  const all = rules();
  const rows = ensureEl(`${dialogId}Body`).querySelectorAll<HTMLElement>(".states");
  options.map.relief.rules = Array.from(rows, row => all[Number(row.dataset.index)]);
  commit();
}

function addRule(): void {
  rules().push({
    name: "New rule",
    height: { min: 50, max: 100 },
    temperature: { min: null, max: null },
    icons: { hill: 1 },
    density: 100,
    size: { min: 8, max: 12 }
  });
  commit();
}

function restoreDefaults(): void {
  confirmationDialog({
    title: "Restore relief rules",
    message: "Replace the relief rules with the default hills and mountains?",
    confirm: "Restore",
    onConfirm: () => {
      options.map.relief.rules = Relief.getDefaultRules();
      commit();
    }
  });
}

/** re-place only the cells whose relief the edits changed: claimed by another rule, or by an edited one */
function replaceChanged(): void {
  const keys = new Map<ReliefRule | undefined, string>([[undefined, ""]]);
  const key = (rule: ReliefRule | undefined) => {
    if (!keys.has(rule)) keys.set(rule, placing(rule!));
    return keys.get(rule)!;
  };
  const previous = placed;
  const covers = (cell: number) => key(Relief.claim(cell, previous)) !== key(Relief.claim(cell));
  confirmReplace("cells whose rule changed", covers, () => {
    placed = structuredClone(rules());
    render();
  });
}

export const ReliefRulesEditor = { open };
