import { Controllers } from "@/controllers";
import { PATTERN_LABELS } from "@/data/id-labels";
import { type Concept, conceptsOf, type Kind } from "@/data/name-concepts";
import { Options } from "@/model/options/options-model";
import { Lexicon } from "@/model/society/names/lexicon";
import { Meanings } from "@/model/society/names/meanings";
import { NameBases } from "@/model/society/names/name-bases";
import { Names, PEOPLE_LENGTH } from "@/model/society/names/names-generator";
import { NameNotation } from "@/model/society/names/notation";
import { SoundRules } from "@/model/society/names/sound-rules";
import { Toponyms } from "@/model/society/names/toponyms-generator";
import { viewport } from "@/renderers/viewport/viewport";
import { getFileName } from "@/services/io/file-name";
import type { Corpus, NameBase, Pattern, PatternLayout } from "@/types/names";
import { Dialog } from "@/ui/dialog/dialog";
import { tip } from "@/ui/tooltips";
import { wiki } from "@/utils/common-utils";
import { downloadFile } from "@/utils/file-utils";
import { t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";
import { seeded } from "@/utils/probability-utils";
import { compileRegex, escapeHtml } from "@/utils/string-utils";
import { NamesbaseAnalysis } from "./namesbase-analysis";
import { NamesbaseFile } from "./namesbase-file";

const dialogId = "namesbaseEditor" as const;
const MIN_PLACES = 3;

type Tab = "names" | "lexicon" | "patterns" | "rules";
type ListKey = "places" | "waters" | "male" | "female";
type Shown = "all" | "written" | "unwritten" | Kind;

interface Pane {
  label: string;
  render: (base: NameBase) => string;
  onRender?: () => void;
  onChange: (input: Field) => void;
}

const TABS: Record<Tab, Pane> = {
  names: { label: t("Names"), render: renderNames, onRender: showLists, onChange: changeNames },
  lexicon: { label: t("Lexicon"), render: renderLexicon, onRender: filterConcepts, onChange: changeLexicon },
  patterns: { label: t("Patterns"), render: renderPatterns, onChange: changePatterns },
  rules: { label: t("Rules"), render: renderRules, onChange: changeRules }
};

const LISTS: Record<ListKey, string> = {
  places: t("Places"),
  waters: t("Rivers and lakes"),
  male: t("Male names"),
  female: t("Female names")
};

const KINDS: Record<Kind, string> = {
  settlement: t("Settlements"),
  generic: t("Places"),
  modifier: t("Modifiers"),
  numeral: t("Numerals"),
  land: t("Lands")
};

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

let baseId = "";
let isUnlocked = false; // a built-in base is edited only once the user insists
let roll = 0; // of the samples: an edit shows on the same ones
let activeTab: Tab = "names"; // kept between openings, as the lexicon's filter is
let shown: Shown = "all";

/** Open a base by its place in the list */
async function open(i: number): Promise<void> {
  if (options.app.mode) return;
  const entry = NameBases.all[i];
  if (!entry) return;
  await NameBases.load([entry.id]);
  const base = NameBases.find(entry.id);
  if (!base) {
    tip(t("Namesbase {{base}} is not defined", { base: entry.name }), false, "error");
    return;
  }

  Dialog.closeAll(`#${dialogId}, .stable`);
  findEl(dialogId)?.querySelector<HTMLElement>(":focus")?.blur(); // what is being typed goes to the base shown
  baseId = base.id;
  isUnlocked = false;
  renderDialog(base);
  Dialog.open(dialogId, {
    title: t("Namesbase Editor"),
    resizable: true,
    width: Math.min(viewport.width * 0.94, 960),
    height: Math.min(viewport.height * 0.75, 640),
    position: { my: "center", at: "center", of: "svg" },
    onClose: close
  });
}

function close(): void {
  baseId = "";
  Dialog.destroy(dialogId);
}

// the base shown: the model may have put another object under its id
const getBase = (): NameBase => NameBases.find(baseId)!;
const isLocked = () => !isUnlocked && NameBases.isShipped(getBase());

const STYLES = /* html */ `<style>
  #namesbaseLayout { display: flex; flex-direction: column; gap: 0.4em; height: 100%; width: auto; }
  #namesbaseHead { display: grid; grid-template-columns: auto 12em auto 12em 1fr; gap: 0.3em 0.5em; align-items: center; flex-shrink: 0; }
  #namesbaseHead > input, #namesbaseHead > select { width: 100%; }
  #namesbaseHead > #namesbaseDescription { grid-column: 2 / -1; }
  #namesbaseLock { display: flex; flex-wrap: wrap; gap: 0.3em 0.6em; align-items: center; flex-shrink: 0; }
  #namesbaseLock[hidden] { display: none; }
  #namesbaseCultures { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-style: italic; color: #666; }
  #namesbaseMain { display: grid; grid-template-columns: 1fr 18em; gap: 0.8em; flex: 1; min-height: 0; }
  #namesbaseWork { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  #namesbaseTabs { flex-shrink: 0; border-bottom: 0; gap: 2px; }
  #namesbaseTabs > button { padding: 0.4em; transition: none; }
  #namesbaseTabs > button:not(.active, :hover) { background: #e3dee3; color: #333; }
  #namesbasePane { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; padding-top: 0.4em; }
  #namesbasePane textarea { resize: none; line-height: 1.4; }
  #namesbasePane .notation { font-family: var(--monospace); font-size: 0.95em; }
  #namesbasePane input[type="number"] { width: 3.6em; }
  #namesbasePane h4 { margin: 0; font-size: 1em; }
  #namesbasePane .muted, #namesbaseSamples i { color: #666; }
  #namesbaseSide { display: flex; flex-direction: column; min-height: 0; padding-left: 0.8em; border-left: 1px solid #ccc; }
  #namesbaseSideHead { display: flex; justify-content: space-between; padding: 0.4em; margin-bottom: 0.4em; background: #e3dee3; }
  #namesbaseSamples { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; line-height: 1.5; padding-right: 0.3em; user-select: text; }
  #namesbaseSamples h4 { margin: 0.5em 0 0; font-size: 1em; }
  #namesbaseSamples h4:first-child { margin-top: 0; }
  #namesbaseSamples .named { display: flex; flex-wrap: wrap; justify-content: space-between; column-gap: 0.6em; }
  #namesbaseFooter { display: flex; gap: 3px; flex-shrink: 0; }
  .namesbaseLists { display: grid; grid-template: 1fr 1fr 1fr / 3fr 2fr; gap: 0.5em 0.8em; height: 100%; }
  .namesbaseLists > div { display: flex; flex-direction: column; min-height: 4.5em; }
  .namesbaseLists > div:first-child { grid-row: 1 / -1; }
  .namesbaseLists textarea { flex: 1; min-height: 0; }
  .namesbaseLists .listHead { display: flex; flex-wrap: wrap; align-items: center; gap: 0.1em 0.4em; margin-bottom: 0.2em; }
  .namesbaseLists .listHead > span:last-child { margin-left: auto; white-space: nowrap; }
  #namesbaseLexicon { display: flex; flex-direction: column; height: 100%; }
  #namesbaseFilter { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4em; margin-bottom: 0.4em; }
  #namesbaseFilter > input { flex: 0 1 12em; min-width: 6em; }
  #namesbaseFilter > span { margin-left: auto; }
  #namesbaseConcepts { flex: 1; min-height: 8em; overflow-y: auto; scrollbar-width: thin; }
  #namesbaseConcepts > label { display: grid; grid-template-columns: 6.5em 1fr 10em; gap: 0.5em; align-items: center; margin-bottom: 2px; }
  #namesbaseConcepts > [hidden] { display: none; }
  #namesbaseConcepts > h4 { position: sticky; top: 0; padding: 0.2em 0; background: #f3f4f7; }
  .namesbasePatterns { display: grid; grid-template-columns: 9em 3.6em minmax(0, 1fr) 12em; gap: 2px 0.5em; align-items: center; }
  .namesbasePatterns > input.notation { width: 100%; min-width: 0; }
  .namesbasePatterns > h4 { grid-column: 1 / -1; margin-top: 0.5em !important; }
  .namesbaseShares { display: grid; grid-template-columns: auto 1fr; gap: 0.3em 0.8em; align-items: center; margin-top: 1em; }
  #namesbaseRulesPane { display: grid; grid-template: auto 1fr auto / 1fr 1fr; gap: 0.3em 0.8em; height: 100%; }
  #namesbaseRulesPane > div:last-child { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 0.3em 1.2em; }
  #namesbaseRulesPane textarea { min-height: 8em; white-space: pre; }
  #namesbaseConcepts i, .namesbasePatterns i { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  @media (max-width: 700px) {
    #namesbaseMain { grid-template-columns: 1fr; grid-template-rows: 1fr 9em; }
    #namesbaseSide { padding: 0.3em 0 0; border-left: 0; border-top: 1px solid #ccc; }
    #namesbaseHead { grid-template-columns: auto 1fr; }
    #namesbaseHead > #namesbaseCultures { grid-column: 1 / -1; }
    .namesbaseLists { grid-template: none / 1fr; height: auto; }
    .namesbaseLists > div:first-child { grid-row: auto; }
    .namesbaseLists textarea { min-height: 6em; }
    #namesbaseConcepts > label { grid-template-columns: 5.5em 1fr; }
    #namesbaseConcepts > label > i { grid-column: 2; }
    .namesbasePatterns { grid-template-columns: 8em 3.6em minmax(0, 1fr); }
    .namesbasePatterns > i { grid-column: 3; }
    #namesbaseRulesPane { display: flex; flex-direction: column; }
  }
</style>`;

function renderDialog(base: NameBase): void {
  Dialog.destroy(dialogId);
  const tabs = Object.entries(TABS).map(
    ([tab, { label }]) => `<button class="options" data-tab="${tab}">${label}</button>`
  );

  const html = /* html */ `<div id="${dialogId}" class="dialog stable">
      ${STYLES}
      <div id="namesbaseLayout" data-no-clipped-tip>
        <div id="namesbaseHead">
          <b>${t("Name")}:</b>
          <input id="namesbaseName" autocorrect="off" spellcheck="false" />
          <b>${t("Extends")}:</b>
          <select id="namesbaseExtends" data-tip="${t("Fills in what this base lacks")}"></select>
          <div id="namesbaseCultures"></div>
          <b>${t("Description")}:</b>
          <input id="namesbaseDescription" autocorrect="off" spellcheck="false" />
        </div>
        <div id="namesbaseLock">
          <span>${t("A built-in namesbase is improved with each app update")}</span>
          <button id="namesbaseEditCopy">${t("Edit a copy")}</button>
          <button id="namesbaseEditAnyway">${t("Edit anyway")}</button>
        </div>
        <div id="namesbaseMain">
          <div id="namesbaseWork">
            <div id="namesbaseTabs" class="tab">${tabs.join("")}</div>
            <div id="namesbasePane"></div>
          </div>
          <div id="namesbaseSide">
            <div id="namesbaseSideHead"><b>${t("Examples")}</b><span id="namesbaseRoll" data-tip="${t("Examples. Click to re-generate")}" class="icon-shuffle pointer"></span></div>
            <div id="namesbaseSamples"></div>
          </div>
        </div>
        <div id="namesbaseFooter">
          <button id="namesbaseAnalyze" data-tip="${t("Analyze namesbase to get a validity and quality overview")}" class="icon-flask"></button>
          <button id="namesbaseCopy" data-tip="${t("Duplicate")}" class="icon-clone"></button>
          <button id="namesbaseDownload" data-tip="${t("Download")}" class="icon-download"></button>
          <button id="namesbaseReset" data-tip="${t("Restore default namesbase")}" class="icon-retweet"></button>
          <button id="namesbaseOverview" data-tip="${t("Namesbases Overview")}" class="icon-list-bullet"></button>
          <button id="namesbaseWiki" data-tip="${t("Open the wiki page")}" class="icon-info"></button>
        </div>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl("namesbaseName").addEventListener("change", changeName);
  ensureEl("namesbaseExtends").addEventListener("change", changeExtends);
  ensureEl("namesbaseDescription").addEventListener("change", changeDescription);
  ensureEl("namesbaseTabs").addEventListener("click", onTabClick);
  ensureEl("namesbasePane").addEventListener("change", onPaneChange);
  ensureEl("namesbasePane").addEventListener("input", onPaneInput);
  ensureEl("namesbaseRoll").addEventListener("click", rollSamples);
  ensureEl("namesbaseAnalyze").addEventListener("click", () =>
    NamesbaseAnalysis.open(getBase().name, getBase().places.names)
  );
  ensureEl("namesbaseCopy").addEventListener("click", copyBase);
  ensureEl("namesbaseEditCopy").addEventListener("click", copyBase);
  ensureEl("namesbaseEditAnyway").addEventListener("click", triggerUnlock);
  ensureEl("namesbaseDownload").addEventListener("click", downloadBase);
  ensureEl("namesbaseReset").addEventListener("click", triggerReset);
  ensureEl("namesbaseOverview").addEventListener("click", () => void Controllers.NamesbasesOverview.open());
  ensureEl("namesbaseWiki").addEventListener("click", () => wiki("Names"));

  renderBase(base);
}

function renderBase(base: NameBase): void {
  ensureEl<HTMLInputElement>("namesbaseName").value = base.name;
  ensureEl<HTMLInputElement>("namesbaseDescription").value = base.description ?? "";

  const parents = NameBases.sorted(NameBases.all.filter(({ id }) => id !== base.id));
  const select = ensureEl<HTMLSelectElement>("namesbaseExtends");
  select.replaceChildren(new Option(t("none"), ""), ...parents.map(({ id, name }) => new Option(name, id)));
  select.value = base.extends ?? "";

  const cultures = pack.cultures.filter(culture => !culture.removed && culture.base === base.id);
  const users = ensureEl("namesbaseCultures");
  users.textContent = `${t("Cultures")}: ${cultures.map(({ name }) => name).join(", ") || t("none")}`;
  users.dataset.tip = users.textContent;

  ensureEl("namesbaseLock").hidden = !isLocked();
  renderPane();
  renderSamples();
}

/** Keep the fields of a built-in base from being changed; their text can still be read and copied */
function lockFields(): void {
  const locked = isLocked();
  const fields = ensureEl(dialogId).querySelectorAll<Field>(
    "#namesbaseName, #namesbaseDescription, #namesbaseExtends, #namesbasePane [data-field]"
  );
  for (const field of fields) {
    if (!(field instanceof HTMLSelectElement)) field.readOnly = locked;
    else if (locked || field.id) field.disabled = locked; // a list's select is disabled by its list
  }
}

function onTabClick({ target }: MouseEvent): void {
  const { tab } = (target as HTMLElement).dataset;
  if (!tab) return;
  activeTab = tab as Tab;
  renderPane();
}

function renderPane(): void {
  for (const button of ensureEl("namesbaseTabs").querySelectorAll<HTMLElement>("[data-tab]"))
    button.classList.toggle("active", button.dataset.tab === activeTab);
  const { render, onRender } = TABS[activeTab];
  const pane = ensureEl("namesbasePane");
  pane.innerHTML = render(getBase());
  pane.scrollTop = 0;
  onRender?.();
  lockFields();
  renderExamples();
}

function onPaneChange({ target }: Event): void {
  const input = target as Field;
  if (!input.dataset.field) return; // a filter, not data
  NameBases.edit(baseId);
  TABS[activeTab].onChange(input);
  showChange();
}

function onPaneInput({ target }: Event): void {
  const { id } = target as HTMLElement;
  if (id === "namesbaseSearch" || id === "namesbaseShown") filterConcepts();
  else if (id === "namesbaseTry") tryRules();
}

/** Store an edit and show what it does: on the samples, on the examples of the tab, in the overview */
function showChange(): void {
  NameBases.dropUnchanged(baseId);
  Options.save();
  renderSamples();
  renderExamples();
  if (findEl("namesbasesOverview")) void Controllers.NamesbasesOverview.refresh();
}

// SAMPLES

/** A sample stays the same until the user rolls others, so that an edit shows on it */
const sampled = <T>(key: string, run: () => T): T => seeded(`${baseId}|${roll}|${key}`, run);

function renderSamples(): void {
  const base = getBase();
  const many = (number: number, key: string, run: () => string) =>
    Array.from({ length: number }, (_, i) => sampled(`${key}${i}`, run));
  const named = ({ name, meaning }: ReturnType<typeof Toponyms.sample>) =>
    `<div class="named"><span>${escapeHtml(name)}</span><i>${meaning.pattern === "simplex" ? "" : escapeHtml(Meanings.gloss(meaning))}</i></div>`;
  const plain = (run: () => string) => () => escapeHtml(run());

  const groups = [
    [t("Burgs"), many(9, "burg", () => named(Toponyms.sample(base))).join("")],
    [t("Lands"), many(4, "land", () => named(Toponyms.sampleLand(base))).join("")],
    [
      t("Rivers and lakes"),
      many(
        5,
        "water",
        plain(() => Names.getWater(base.id))
      ).join(", ")
    ],
    [
      t("Personal names"),
      many(
        5,
        "person",
        plain(() => Names.getPerson(base.id))
      ).join(", ")
    ],
    [
      t("Names without meaning"),
      many(
        5,
        "plain",
        plain(() => Names.getBase(base.id))
      ).join(", ")
    ]
  ];
  ensureEl("namesbaseSamples").innerHTML = groups.map(([label, names]) => `<h4>${label}</h4>${names}`).join("");
  ensureEl<HTMLButtonElement>("namesbaseReset").disabled = !NameBases.isChanged(base);
}

function rollSamples(): void {
  roll++;
  renderSamples();
  renderExamples();
}

/** Fill the examples beside the concepts and patterns of the open tab */
function renderExamples(): void {
  const base = getBase();
  for (const el of ensureEl("namesbasePane").querySelectorAll<HTMLElement>("[data-example]")) {
    if (el.closest("[hidden]")) continue;
    const { concept, pattern } = el.dataset as { concept?: Concept; pattern?: Pattern };
    const { name, meaning } = sampled(`${concept}|${pattern}`, () => Toponyms.sample(base, { concept, pattern }));
    el.textContent = name;
    el.dataset.tip = `${name}: ${Meanings.gloss(meaning)}`;
  }
}

// HEAD

function changeName(this: HTMLInputElement): void {
  const base = NameBases.edit(baseId);
  base.name = this.value = this.value.trim() || base.name;
  showChange();
}

function changeDescription(this: HTMLInputElement): void {
  const base = NameBases.edit(baseId);
  base.description = this.value.trim();
  if (!base.description) delete base.description;
  showChange();
}

async function changeExtends(this: HTMLSelectElement): Promise<void> {
  const base = NameBases.edit(baseId);
  if (this.value) base.extends = this.value;
  else delete base.extends;
  await NameBases.load([base.id]);
  if (!findEl(dialogId)) return;
  renderPane();
  showChange();
}

// NAMES

function getList(base: NameBase, key: ListKey): Corpus | undefined {
  return key === "places" || key === "waters" ? base[key] : base.people?.[key];
}

function setList(base: NameBase, key: ListKey, list: Corpus | undefined): void {
  if (key === "places") base.places = list!;
  else if (key === "waters") base.waters = list;
  else base.people = { ...base.people, [key]: list };

  if (!base.waters) delete base.waters;
  if (!base.people?.male) delete base.people?.male;
  if (!base.people?.female) delete base.people?.female;
  if (base.people && !Object.keys(base.people).length) delete base.people;
}

/** The lengths of a list's generated names where the list sets none */
function getDefaultLength(base: NameBase, key: ListKey): [number, number] {
  if (key === "male" || key === "female") return PEOPLE_LENGTH;
  return key === "waters" ? NameBases.placeLength(base) : base.length;
}

/** What stands in for an empty list */
function getStandIn(base: NameBase, key: ListKey): string {
  if (key === "places") return "";
  const isPeople = key !== "waters";
  if (isPeople && base.people) return "";
  const bare: NameBase = { ...base, waters: undefined, people: undefined };
  const parent = NameBases.lineage(bare).find(other => (isPeople ? other.people : other.waters));
  return parent ? t("Taken from {{- base}}", { base: parent.name }) : t("Place names stand in");
}

function renderNames(): string {
  const lists = (Object.keys(LISTS) as ListKey[]).map(key => {
    const mode = /* html */ `<select data-field="mode">
        <option value="chain">${t("Generated")}</option>
        <option value="pick">${t("Picked")}</option>
      </select>`;
    return /* html */ `<div data-list="${key}">
        <div class="listHead">
          <b>${LISTS[key]}</b> <span data-count></span>
          <span>
            ${mode}
            <input data-field="min" type="number" min="1" max="100" data-tip="${t("Min name length")}" />
            – <input data-field="max" type="number" min="1" max="100" data-tip="${t("Max name length")}" />
          </span>
        </div>
        <textarea data-field="names" autocorrect="off" spellcheck="false" data-tip="${t("Names data: a comma separated list of source names used for names generation")}"></textarea>
      </div>`;
  });
  return `<div class="namesbaseLists">${lists.join("")}</div>`;
}

/** Fill the fields of the lists, in place so that the one edited next keeps its focus */
function showLists(): void {
  const base = getBase();
  for (const card of ensureEl("namesbasePane").querySelectorAll<HTMLElement>("[data-list]")) {
    const key = card.dataset.list as ListKey;
    const list = getList(base, key);
    const [min, max] = getDefaultLength(base, key);
    for (const input of card.querySelectorAll<Field>("[data-field]")) {
      const { field } = input.dataset;
      if (field === "names") input.value = list?.names.join(", ") ?? "";
      else if (field === "mode") input.value = list?.mode ?? "chain";
      else input.value = String(list?.length?.[field === "min" ? 0 : 1] ?? "");
      if (input instanceof HTMLTextAreaElement) input.placeholder = getStandIn(base, key);
      else input.disabled = !list;
      if (input instanceof HTMLInputElement) input.placeholder = String(field === "min" ? min : max);
    }

    const count = card.querySelector<HTMLElement>("[data-count]")!;
    const verdict = list && list.mode !== "pick" ? NamesbaseAnalysis.judgeLength(list.names.length) : undefined;
    count.textContent = String(list?.names.length ?? 0);
    count.style.color = verdict?.color ?? "#666";
    count.dataset.tip = verdict?.tip ?? "";
  }
}

function changeNames(input: Field): void {
  const base = getBase();
  const card = input.closest<HTMLElement>("[data-list]")!;
  const key = card.dataset.list as ListKey;
  const list = getList(base, key);
  const field = input.dataset.field;

  if (field === "names") {
    const names = input.value
      .split(/[,\n]/)
      .map(name => name.trim())
      .filter(Boolean);
    if (key === "places" && names.length < MIN_PLACES)
      tip(t("The names data provided is too short or incorrect"), false, "error");
    else setList(base, key, names.length ? { ...list, names } : undefined);
  } else if (list && field === "mode") {
    setList(base, key, { ...list, mode: input.value as Corpus["mode"] });
  } else if (list) {
    const defaults = getDefaultLength(base, key);
    const length = getLength(card, defaults);
    const isDefault = length?.every((end, i) => end === defaults[i]);
    if (length && length[0] > length[1]) tip(t("Minimal length cannot be greater than maximal"), false, "error");
    else {
      const { length: _, ...rest } = list;
      setList(base, key, length && !isDefault ? { ...rest, length } : rest);
    }
  }
  showLists();
}

/** The lengths in the min and max fields, defaults in place of one left empty; none when both are */
function getLength(el: HTMLElement, defaults: [number, number]): [number, number] | undefined {
  const [min, max] = ["min", "max"].map(field => el.querySelector<HTMLInputElement>(`[data-field="${field}"]`)!.value);
  return min || max ? [+(min || defaults[0]), +(max || defaults[1])] : undefined;
}

// LEXICON

function renderLexicon(base: NameBase): string {
  const filters: [Shown, string][] = [
    ["all", t("All")],
    ["written", t("Written")],
    ["unwritten", t("Not written")],
    ...(Object.entries(KINDS) as [Kind, string][])
  ];
  const groups = (Object.keys(KINDS) as Kind[]).map(
    kind => `<h4 data-kind="${kind}">${KINDS[kind]}</h4>${conceptsOf(kind).map(renderConcept).join("")}`
  );

  return /* html */ `<div id="namesbaseLexicon">
      <div id="namesbaseFilter">
        <input id="namesbaseSearch" type="search" placeholder="${t("Search")}" />
        <select id="namesbaseShown">
          ${filters.map(([value, label]) => `<option value="${value}" ${value === shown ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        <span id="namesbaseCoverage" class="muted" data-tip="${t("Grey forms are inherited or generated")}">${getCoverage(base)}</span>
      </div>
      <div id="namesbaseConcepts">${groups.join("")}</div>
    </div>`;

  function renderConcept(concept: Concept): string {
    return /* html */ `<label data-concept="${concept}">
        <span>${concept}</span>
        <input class="notation" data-field="forms" value="${escapeHtml(NameNotation.formatFormants(base.lexicon?.[concept]))}"
          placeholder="${escapeHtml(NameNotation.formatFormants(Lexicon.standInForms(base, concept)))}" data-tip="${escapeHtml(getDerivedTip(base, concept))}"
          autocorrect="off" autocapitalize="off" spellcheck="false" />
        <i data-example data-concept="${concept}"></i>
      </label>`;
  }
}

function getCoverage(base: NameBase): string {
  const all = (Object.keys(KINDS) as Kind[]).flatMap(conceptsOf).length;
  return t("Concepts written: {{written}} of {{all}}", { written: Lexicon.writtenConcepts(base).size, all });
}

/** What the grammar makes of a concept's forms */
function getDerivedTip(base: NameBase, concept: Concept): string {
  const derived = Lexicon.derivedForms(base, concept, base.lexicon?.[concept] ?? []);
  return derived.length ? t("Made by the grammar: {{- forms}}", { forms: NameNotation.formatFormants(derived) }) : "";
}

function filterConcepts(): void {
  const base = getBase();
  const search = ensureEl<HTMLInputElement>("namesbaseSearch").value.trim().toLowerCase();
  shown = ensureEl<HTMLSelectElement>("namesbaseShown").value as Shown;
  const written = Lexicon.writtenConcepts(base);

  const container = ensureEl("namesbaseConcepts");
  for (const kind of Object.keys(KINDS) as Kind[]) {
    let any = false;
    for (const concept of conceptsOf(kind)) {
      const row = container.querySelector<HTMLElement>(`label[data-concept="${concept}"]`)!;
      const forms = row.querySelector("input")!.value;
      const isShown = shown === "all" || shown === kind || shown === (written.has(concept) ? "written" : "unwritten");
      row.hidden = !isShown || !`${concept} ${forms}`.toLowerCase().includes(search);
      any ||= !row.hidden;
    }
    container.querySelector<HTMLElement>(`h4[data-kind="${kind}"]`)!.hidden = !any;
  }
  renderExamples();
}

function changeLexicon(input: Field): void {
  const base = getBase();
  const concept = input.closest<HTMLElement>("[data-concept]")!.dataset.concept as Concept;
  const forms = NameNotation.parseFormants(input.value);
  base.lexicon = { ...base.lexicon, [concept]: forms };
  if (!forms.length) delete base.lexicon[concept];
  if (!Object.keys(base.lexicon).length) delete base.lexicon;

  input.value = NameNotation.formatFormants(forms); // what was understood
  input.dataset.tip = getDerivedTip(base, concept);
  ensureEl("namesbaseCoverage").textContent = getCoverage(base);
}

// PATTERNS

function renderPatterns(base: NameBase): string {
  const bare: NameBase = { ...base, patterns: {}, settled: undefined }; // what it takes where it sets nothing
  const rows = PATTERN_LABELS.map(([label, patterns]) => {
    const lines = patterns.map(([pattern, meaning]) => {
      const { weight, templates } = base.patterns?.[pattern] ?? {};
      const weightInput = /* html */ `<input data-field="weight" data-pattern="${pattern}" type="number" min="0" value="${weight ?? ""}"
          placeholder="${Lexicon.patternWeight(bare, pattern)}" data-tip="${t("Weight")}" />`;
      return /* html */ `<span data-tip="${meaning}">${pattern}</span>
        ${pattern === "simplex" || pattern === "description" ? "<span></span>" : weightInput}
        <input class="notation" data-field="templates" data-pattern="${pattern}" value="${escapeHtml(NameNotation.formatTemplates(templates))}"
          placeholder="${escapeHtml(NameNotation.formatTemplates(Lexicon.templatesOf(bare, pattern)))}" autocorrect="off" spellcheck="false"
          data-tip="${t("Templates, commas between")}" />
        <i data-example data-pattern="${pattern}"></i>`;
    });
    return `<h4>${label}</h4>${lines.join("")}`;
  });
  const percent = (share?: number) => (share === undefined ? "" : Math.round(share * 100));

  return /* html */ `<div class="namesbasePatterns">${rows.join("")}</div>
    <div class="namesbaseShares">
      <span>${t("Name length")}:</span>
      <span>
        <input data-field="min" type="number" min="1" max="100" value="${base.length[0]}" data-tip="${t("Min name length")}" />
        – <input data-field="max" type="number" min="1" max="100" value="${base.length[1]}" data-tip="${t("Max name length")}" />
      </span>
      <span>${t("Names ending in the burg's group")}:</span>
      <span><input data-field="settled" type="number" min="0" max="100" value="${percent(base.settled)}" placeholder="${percent(Toponyms.settledShare(bare))}" /> %</span>
      <span data-tip="${t("Empty: by the sizes of the two lists")}">${t("Founders who are women")}:</span>
      <span><input data-field="female" type="number" min="0" max="100" value="${percent(base.patterns?.["owner-generic"]?.female)}" placeholder="${percent(NameBases.femaleFounders(bare))}" /> %</span>
    </div>`;
}

function changePatterns(input: Field): void {
  const base = getBase();
  const { field, pattern } = input.dataset as { field: string; pattern: Pattern };
  const number = input.value === "" ? undefined : Math.max(Math.round(+input.value), 0);
  const percent = number === undefined ? undefined : Math.min(number, 100);
  const share = percent === undefined ? undefined : percent / 100;

  if (field === "min" || field === "max") {
    const length = getLength(ensureEl("namesbasePane"), base.length) ?? base.length;
    if (length[0] > length[1]) tip(t("Minimal length cannot be greater than maximal"), false, "error");
    else base.length = length;
    for (const [i, end] of ["min", "max"].entries()) setField(end, String(base.length[i]));
  } else if (field === "settled") {
    base.settled = share;
    if (share === undefined) delete base.settled;
    input.value = String(percent ?? "");
  } else if (field === "female") {
    setPattern(base, "owner-generic", { female: share });
    input.value = String(percent ?? "");
  } else if (field === "weight") {
    setPattern(base, pattern, { weight: number });
    input.value = String(number ?? "");
  } else {
    const templates = NameNotation.parseTemplates(input.value);
    setPattern(base, pattern, { templates: templates.length ? templates : undefined });
    input.value = NameNotation.formatTemplates(templates); // what was understood
  }
}

/** Change a pattern's settings; one left undefined goes */
function setPattern(base: NameBase, pattern: Pattern, change: PatternLayout): void {
  const settings = Object.entries({ ...base.patterns?.[pattern], ...change }).filter(
    ([, value]) => value !== undefined
  );
  const { [pattern]: _, ...others } = base.patterns ?? {};
  base.patterns = settings.length ? { ...base.patterns, [pattern]: Object.fromEntries(settings) } : others;
  if (!Object.keys(base.patterns).length) delete base.patterns;
}

// RULES

function renderRules(base: NameBase): string {
  const grammar = Lexicon.grammarOf({ ...base, grammar: undefined });
  const joining = NameBases.joiningOf({ ...base, joining: undefined }).join(", ");
  return /* html */ `<div id="namesbaseRulesPane">
      <h4 data-tip="${t("Regex rewrites, applied in order")}">${t("Sound rules")}</h4>
      <h4 data-tip="${t("Noun classes, endings and form rules")}">${t("Grammar")}</h4>
      <textarea class="notation" data-field="rules" autocorrect="off" spellcheck="false">${escapeHtml(NameNotation.formatRules(base.rules))}</textarea>
      <textarea class="notation" data-field="grammar" autocorrect="off" spellcheck="false" placeholder="${escapeHtml(NameNotation.formatGrammar(grammar))}">${escapeHtml(NameNotation.formatGrammar(base.grammar))}</textarea>
      <div>
        <label data-tip="${t("Populate with letters that can be used twice in a row (geminates)")}">${t("Doubled letters")}:
          <input data-field="doubled" class="notation" style="width: 10em" value="${escapeHtml(SoundRules.getDoubles(base))}" autocorrect="off" spellcheck="false" /></label>
        <label data-tip="${t("Words that stay lowercase between others, commas between: -sur- only between dashes, d' cut short before the next word")}">${t("Joining words")}:
          <input data-field="joining" class="notation" style="width: 14em" value="${escapeHtml(base.joining?.join(", ") ?? "")}" placeholder="${escapeHtml(joining)}" autocorrect="off" spellcheck="false" /></label>
        <label data-tip="${t("Put + where parts join")}">${t("Try a name")}:
          <input id="namesbaseTry" class="notation" style="width: 12em" placeholder="novo+gorod" autocorrect="off" spellcheck="false" />
          <b id="namesbaseTried"></b></label>
      </div>
    </div>`;
}

function changeRules(input: Field): void {
  const base = getBase();
  const { field } = input.dataset;
  if (field === "rules") {
    const rules = NameNotation.parseRules(input.value);
    const broken = rules.filter(({ match }) => !compileRegex(match, "gu")).map(({ match }) => match);
    if (broken.length)
      tip(t("Rules that are no valid regex are skipped: {{rules}}", { rules: broken.join(", ") }), false, "error");
    base.rules = rules;
    setField("doubled", SoundRules.getDoubles(base));
  } else if (field === "grammar") {
    base.grammar = NameNotation.parseGrammar(input.value);
    if (!base.grammar) delete base.grammar;
  } else if (field === "joining") {
    const words = input.value.split(",").flatMap(word => word.trim().toLowerCase() || []);
    if (words.length) base.joining = words;
    else delete base.joining;
  } else {
    SoundRules.setDoubles(base, input.value);
    setField("rules", NameNotation.formatRules(base.rules));
  }
  tryRules();
}

function setField(field: string, value: string): void {
  ensureEl("namesbasePane").querySelector<Field>(`[data-field="${field}"]`)!.value = value;
}

/** Show what the base's rules make of the name typed: a word, or a name made of parts where it holds a + */
function tryRules(): void {
  const base = getBase();
  const name = ensureEl<HTMLInputElement>("namesbaseTry").value.trim().toLowerCase();
  const fits = (joined: string) => joined.length <= base.length[1];
  const rules = NameBases.rulesOf(base); // inherited ones too
  const rolls = rules.map(() => 0); // every rule with a chance fires, to show what it does
  const result = name.includes("+") ? SoundRules.join(name, rules, { rolls, fits }) : SoundRules.apply(name, rules);
  ensureEl("namesbaseTried").textContent = SoundRules.capitalize(result, NameBases.joiningOf(base));
}

// ACTIONS

function copyBase(): void {
  const base = getBase();
  const copy = NameBases.copy(base, `${base.name} copy`);
  baseId = copy.id;
  renderBase(copy);
  showChange();
  ensureEl<HTMLInputElement>("namesbaseName").select();
}

function triggerUnlock(): void {
  Dialog.confirm({
    title: t("Edit anyway"),
    message: t("Your version will replace the built-in one and get no updates until restored"),
    confirm: t("Edit anyway"),
    onConfirm: () => {
      if (!findEl(dialogId)) return;
      isUnlocked = true;
      renderBase(getBase());
    }
  });
}

function downloadBase(): void {
  const base = getBase();
  downloadFile(NamesbaseFile.format([base]), `${getFileName(`Namesbase ${base.name}`)}.json`, "application/json");
}

function triggerReset(): void {
  Dialog.confirm({
    title: t("Restore default data"),
    message: t("Are you sure you want to restore default namesbase?"),
    confirm: t("Restore"),
    onConfirm: async () => {
      const id = baseId;
      await NameBases.reset(id);
      Options.save();
      if (baseId !== id) return;
      if (NameBases.isChanged(getBase())) {
        tip(t("Cannot load a namesbase"), false, "error");
        return;
      }
      isUnlocked = false;
      renderBase(getBase());
      showChange();
    }
  });
}

export const NamesbaseEditor = { open };
