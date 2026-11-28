// One dialog to rename anything on the map: the name, what it says and how another name base would say it

import { PATTERN_LABELS } from "@/data/id-labels";
import { conceptsOf } from "@/data/name-concepts";
import { kindsOf, PATTERNS, type Slot } from "@/data/name-patterns";
import { MapEntities } from "@/model/map-entities";
import { Appropriation } from "@/model/society/names/appropriation";
import { isRoot, Meanings } from "@/model/society/names/meanings";
import { NameBases } from "@/model/society/names/name-bases";
import { Toponyms } from "@/model/society/names/toponyms-generator";
import { Layers } from "@/renderers/layers";
import { speak } from "@/services/speech";
import type { Meaning, NameBase, Named, Pattern, PlaceRef, PlaceType, Token } from "@/types/names";
import { Dialog } from "@/ui/dialog/dialog";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";
import { escapeHtml } from "@/utils/string-utils";
import { NAMED_MODELS } from "./named-places";

interface Owner {
  owner: string; // the dialog it is opened from: the editor closes with it
  full?: { name: string; edit: () => void }; // a state's or a province's full name, changed in a dialog of its own
}

interface PlaceOptions extends Owner {
  onApply: (name: string) => void; // once the place has its new name
}

interface NameEditorOptions extends Owner {
  entity?: string; // the key of what is named, such as "burg:12"
  name: string;
  meaning?: Meaning;
  culture: number; // a name with no meaning is a proper name of its base
  generate?: (baseId: string) => Named; // a new meaning that fits what is named, and its name in a base; a name with none keeps no meaning
  proper: (baseId: string) => string; // a new proper name
  onApply: (named: Required<Named>) => void;
}

type Draft = Omit<Meaning, "tokens"> & { tokens: (Token | "")[] }; // a slot not filled yet holds ""

const dialogId = "nameEditor";
const REROLLS = 12;

const STYLES = /* html */ `<style>
  #nameEditorGrid { display: grid; grid-template-columns: auto 18em auto; gap: 0.4em 0.6em; align-items: center; width: auto; }
  #nameEditorGrid input, #nameEditorGrid select { width: 100%; min-width: 0; }
  #nameEditorField { position: relative; }
  #nameEditorField > input { padding-right: 1.8em; }
  #nameEditorField > .speaker { position: absolute; right: 0.4em; top: 50%; translate: 0 -50%; opacity: 0; }
  #nameEditorField:hover > .speaker { opacity: 1; }
  @media (hover: none) { #nameEditorField > .speaker { opacity: 1; } }
  #nameEditorSlots { grid-column: 2 / -1; display: flex; gap: 0.3em; width: 18em; }
  #nameEditorSlots:empty { display: none; }
  #nameEditorSlots > select:invalid { color: #757575; }
  #nameEditorSlots option { color: initial; }
  #nameEditorIn { display: flex; align-items: center; gap: 0.6em; }
  #nameEditorIn > select { flex: 0 0 8.5em; }
  #nameEditorVariant { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>`;

let editing: { options: NameEditorOptions; draft: Draft } | undefined;

/** Rename a place that keeps a meaning */
function openPlace(type: PlaceType, id: number, { onApply, ...owner }: PlaceOptions): Promise<void> {
  const { name: was = "", meaning } = Toponyms.placeOf(type, id) ?? {};
  const culture = Toponyms.cultureOf({ type, id });
  return open({
    ...owner,
    entity: `${type}:${id}`,
    name: was,
    meaning,
    culture: culture ?? 0,
    generate: culture === undefined ? undefined : baseId => Toponyms.coinFor(type, id, baseId), // neutral lands, an ocean
    proper: baseId => Toponyms.properFor(type, id, baseId),
    onApply: ({ name, meaning }) => {
      NAMED_MODELS[type].setName(id, { name, meaning: culture === undefined ? undefined : meaning });
      onApply(name);
      offerRenamesAfter({ type, id }, was);
    }
  });
}

/** Offer the places named after a renamed one its new name */
function offerRenamesAfter(after: PlaceRef, was: string): void {
  const renamings = Toponyms.renamedAfter(after, was);
  if (!renamings.length) return;
  const now = Toponyms.placeOf(after.type, after.id)?.name ?? "";
  const list = renamings.map(({ type, id, named }) => {
    const old = Toponyms.placeOf(type, id)?.name ?? "";
    const { kind } = MapEntities.getDisplay({ type, id });
    return `${escapeHtml(kind)}: ${escapeHtml(old)} → ${escapeHtml(named.name)}`;
  });
  Dialog.confirm({
    title: t("Rename"),
    message: `${t("{{count}} places are named after {{name}}. Rename them too?", { count: renamings.length, name: now })}<br>${list.join("<br>")}`,
    confirm: t("Rename"),
    onConfirm: () => {
      for (const { type, id, named } of renamings) NAMED_MODELS[type].setName(id, named);
      Layers.draw("labels");
    }
  });
}

async function open(options: NameEditorOptions): Promise<void> {
  const baseId = NameBases.entry(pack.cultures[options.culture]?.base).id;
  await NameBases.load([baseId]);

  close();
  Dialog.destroy(dialogId);
  const draft = structuredClone(options.meaning ?? Meanings.simplex(options.name, baseId));
  editing = { options, draft };

  const patterns = PATTERN_LABELS.map(
    ([group, list]) =>
      `<optgroup label="${group}">${list.map(([pattern, label]) => `<option value="${pattern}">${label}</option>`).join("")}</optgroup>`
  );
  const bases = NameBases.sorted(NameBases.all).map(
    ({ id, name }) => `<option value="${id}" ${id === baseId ? "selected" : ""}>${escapeHtml(name)}</option>`
  );

  const meaningRows = /* html */ `<label for="nameEditorPattern">${t("Meaning")}</label>
      <select id="nameEditorPattern">${patterns.join("")}</select>
      <span id="nameEditorGenerate" data-tip="${t("Generate a new meaning and its name")}" class="icon-arrows-cw pointer"></span>
      <div id="nameEditorSlots"></div>`;
  const fullRow = /* html */ `<span>${t("Full name")}</span>
      <span id="nameEditorFull">${escapeHtml(options.full?.name ?? "")}</span>
      <span id="nameEditorFullEdit" data-tip="${t("Form and full name")}" class="icon-pencil pointer"></span>`;

  const html = /* html */ `<div id="${dialogId}" class="dialog" data-entity="${options.entity ?? ""}">
    ${STYLES}
    <div id="nameEditorGrid">
      <label for="nameEditorName">${t("Name")}</label>
      <div id="nameEditorField">
        <input id="nameEditorName" value="${escapeHtml(options.name)}" data-tip="${t("Type to rename")}" autocorrect="off" spellcheck="false" />
        <span id="nameEditorSpeak" data-tip="${sentences(t("Speak the name"), t("You can change voice and language in options"))}" class="speaker">🔊</span>
      </div>
      <span id="nameEditorReroll" data-tip="${t("Generate another name")}" class="icon-shuffle pointer"></span>
      ${options.generate ? meaningRows : ""}
      <label for="nameEditorBase">${t("Name base")}</label>
      <div id="nameEditorIn">
        <select id="nameEditorBase" data-tip="${t("Select a name base to see the name in it")}">${bases.join("")}</select>
        <i id="nameEditorVariant"></i>
      </div>
      <span id="nameEditorTake" data-tip="${t("Use this name")}" class="icon-ok pointer"></span>
      ${options.full ? fullRow : ""}
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  if (options.generate) {
    getPattern().value = draft.pattern;
    renderSlots();
    getPattern().addEventListener("change", changePattern);
    ensureEl("nameEditorSlots").addEventListener("input", changeWord);
    ensureEl("nameEditorGenerate").addEventListener("click", generate);
  }
  showVariant();

  getName().addEventListener("input", changeName);
  getBase().addEventListener("change", changeBase);
  ensureEl("nameEditorSpeak").addEventListener("click", () => speak(getName().value));
  ensureEl("nameEditorReroll").addEventListener("click", rerollName);
  ensureEl("nameEditorTake").addEventListener("click", takeVariant);
  findEl("nameEditorFullEdit")?.addEventListener("click", editFull);
  ensureEl(options.owner).addEventListener("dialog:close", closeWithOwner);

  Dialog.open(dialogId, {
    title: t("Rename"),
    resizable: false,
    position: { my: "center", at: "center", of: "svg" },
    buttons: [
      { label: t("Apply"), onClick: () => void apply() },
      { label: t("Cancel"), onClick: () => Dialog.close(dialogId) }
    ],
    onClose: close
  });
}

function close(): void {
  if (editing) findEl(editing.options.owner)?.removeEventListener("dialog:close", closeWithOwner);
  editing = undefined;
}

const closeWithOwner = () => Dialog.close(dialogId);

const getName = () => ensureEl<HTMLInputElement>("nameEditorName");
const getPattern = () => ensureEl<HTMLSelectElement>("nameEditorPattern");
const getBase = () => ensureEl<HTMLSelectElement>("nameEditorBase");

/** The fields of the meaning's words, in the order the pattern names them */
function renderSlots(): void {
  const { pattern } = editing!.draft;
  const fields = pattern === "simplex" ? [] : PATTERNS[pattern].slots;
  ensureEl("nameEditorSlots").innerHTML = fields.map((_, order) => fieldOf(order)).join("");
}

/** A word's field: a proper name is typed, a concept is selected from the words of its slot */
function fieldOf(order: number): string {
  const { pattern, tokens } = editing!.draft;
  const slot = PATTERNS[pattern].slots[order];
  const token = tokens[order] ?? "";
  const placeholder = placeholderOf(pattern, slot);
  if (slot === "root")
    return `<input data-order="${order}" value="${escapeHtml(token.slice(1))}" placeholder="${placeholder}" autocorrect="off" spellcheck="false" />`;

  const words: string[] = kindsOf(pattern, slot).flatMap(conceptsOf).toSorted();
  const listed = !token || words.includes(token) ? words : [token, ...words]; // a word from elsewhere stays selectable
  const choices = listed.map(
    word =>
      `<option value="${escapeHtml(word)}" ${word === token ? "selected" : ""}>${escapeHtml(wordOf(word))}</option>`
  );
  return `<select data-order="${order}" required><option value="" disabled hidden ${token ? "" : "selected"}>${placeholder}</option>${choices.join("")}</select>`;
}

/** Show what the selected base makes of the name, once it is loaded: the meaning's own name in the base it is coined in,
 * the whole name as its people say it in any other */
function showVariant(): void {
  const { draft } = editing!;
  const base = NameBases.find(getBase().value);
  const isOwn = base?.id === draft.origin;
  const say = (base: NameBase) =>
    isOwn ? Meanings.render(draft as Meaning, base.id) : Appropriation.adopt(getName().value.trim(), base);
  const name = base && (!isOwn || isWhole(draft)) ? say(base) : "";
  ensureEl("nameEditorVariant").textContent = name;
  ensureEl("nameEditorTake").style.visibility = name ? "visible" : "hidden";
}

// a proper name says itself: its meaning follows what is typed
function changeName(): void {
  const { draft } = editing!;
  if (draft.pattern === "simplex") {
    Object.assign(draft, Meanings.simplex(getName().value.trim(), getBase().value));
    delete draft.after; // the name typed is no other place's
  }
  showVariant();
}

// a meaning edited is said anew in the selected base
function recoin(): void {
  const { draft } = editing!;
  const base = NameBases.find(getBase().value);
  if (base && base.id !== draft.origin) Object.assign(draft, Meanings.coinedIn(draft as Meaning, base));
  delete draft.salt;
  delete draft.own;
}

/** Lay the meaning out in another pattern: a word stays in its slot, a proper name becomes the root */
function changePattern(): void {
  const { draft } = editing!;
  recoin();
  const pattern = getPattern().value as Pattern;
  const name = getName().value.trim();
  const words = new Map(PATTERNS[draft.pattern].slots.map((slot, order) => [slot, draft.tokens[order]]));
  if (draft.pattern === "simplex" || pattern === "simplex") {
    words.set("root", name ? `~${name}` : "");
    delete draft.after;
  }
  Object.assign(draft, { pattern, tokens: PATTERNS[pattern].slots.map(slot => words.get(slot) ?? "") });
  if (pattern === "simplex") draft.origin = getBase().value;
  renderSlots();
  showVariant();
}

function changeWord(event: Event): void {
  const field = event.target as HTMLInputElement | HTMLSelectElement;
  const { draft } = editing!;
  const order = Number(field.dataset.order);
  const word = field.value.trim();
  recoin();
  const base = NameBases.find(draft.origin);
  const root = (name: string): Token => (base ? Meanings.rootIn(name, base) : `~${name}`); // as its people say it
  draft.tokens[order] = field instanceof HTMLSelectElement ? (word as Token) : word ? root(word) : "";
  if (!(field instanceof HTMLSelectElement)) delete draft.after; // a root typed names no place of the map
  // the other words may have been said anew; the field in use stays as it is
  for (const other of ensureEl("nameEditorSlots").querySelectorAll<HTMLElement>("[data-order]"))
    if (other !== field) other.outerHTML = fieldOf(Number(other.dataset.order));
  showVariant();
}

async function changeBase(): Promise<void> {
  const select = getBase();
  ensureEl("nameEditorVariant").textContent = "…";
  await NameBases.load([select.value]);
  if (!editing || !select.isConnected) return; // closed meanwhile
  if (!NameBases.find(select.value))
    tip(t("Namesbase {{base}} is not defined", { base: select.selectedOptions[0].text }), false, "error");
  showVariant();
}

function takeVariant(): void {
  getName().value = ensureEl("nameEditorVariant").textContent;
}

/** Say the same meaning another way; a proper name gives way to a new one */
function rerollName(): void {
  const { options, draft } = editing!;
  const base = NameBases.find(getBase().value);
  if (!base) return;

  if (draft.pattern === "simplex") {
    getName().value = options.proper(base.id);
    changeName();
    return;
  }
  if (!isWhole(draft)) {
    tip(t("Fill in the meaning or select a proper name"), false, "error");
    return;
  }

  if (draft.origin !== base.id) {
    recoin();
    renderSlots();
  }
  const from = draft.salt ?? 0;
  const drawn = Array.from({ length: REROLLS }, (_, roll) => {
    const salt = from + roll + 1;
    return { salt, ...Meanings.compose({ ...draft, salt } as Meaning, base) };
  }).filter(({ name }) => name !== getName().value);
  const next = drawn.find(({ whole }) => whole) ?? drawn[0];
  if (!next) {
    tip(t("The name base has no other way to say it"), false, "warn");
    return;
  }
  draft.salt = next.salt;
  getName().value = next.name;
  showVariant();
}

function generate(): void {
  const { options } = editing!;
  if (!NameBases.find(getBase().value)) return;
  const { name, meaning } = options.generate!(getBase().value);
  editing!.draft = structuredClone(meaning ?? Meanings.simplex(name, getBase().value));
  getName().value = name;
  getPattern().value = editing!.draft.pattern;
  renderSlots();
  showVariant();
}

/** Store the name and close; false when the name or its meaning is not whole yet */
function apply(): boolean {
  const { options, draft } = editing!;
  const name = getName().value.trim();
  const problem = !name
    ? t("Name cannot be empty")
    : !isWhole(draft) && t("Fill in the meaning or select a proper name");
  if (problem) {
    tip(problem, false, "error");
    return false;
  }
  if (name !== options.name) delete draft.own; // the own name of the old one
  options.onApply({ name, meaning: structuredClone(draft) as Meaning });
  Dialog.close(dialogId);
  return true;
}

// the full name follows the name: the name is stored before its dialog opens
function editFull(): void {
  const { full } = editing!.options;
  if (apply()) full?.edit();
}

const isWhole = ({ tokens }: Draft) => tokens.every(token => token.length > 1); // "~" alone is a name not typed yet
const wordOf = (token: string) => (isRoot(token) ? token.slice(1) : token);

function placeholderOf(pattern: Pattern, slot: Slot): string {
  if (slot === "modifier") return t("Description");
  if (slot === "settlement") return t("Settlements");
  if (slot === "generic") return kindsOf(pattern, slot).includes("land") ? t("Lands") : t("Place");
  return pattern === "owner-generic" ? t("Owner") : t("Name");
}

export const NameEditor = { open, openPlace };
