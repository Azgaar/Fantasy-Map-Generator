import { max as d3max, min as d3min, mean, median } from "d3";
import { z } from "zod";
import { type Concept, conceptsOf } from "@/data/name-concepts";
import { DEFAULT_TEMPLATES, DEFAULT_WEIGHTS } from "@/data/name-rules";
import { Lexicon } from "@/model/society/names/lexicon";
import { Names } from "@/model/society/names/names-generator";
import { NameNotation } from "@/model/society/names/notation";
import { SoundRules } from "@/model/society/names/sound-rules";
import { Toponyms } from "@/model/society/names/toponyms-generator";
import { localGloss } from "@/renderers/labels/name-display";
import { getFileName } from "@/services/io/file-name";
import { speak } from "@/services/speech";
import type { Corpus, NameBase, Pattern } from "@/types/names";
import { Dialog } from "@/ui/dialog/dialog";
import { tip } from "@/ui/tooltips";
import { unique } from "@/utils/array-utils";
import { openURL } from "@/utils/common-utils";
import { createFileInput, downloadFile, uploadFile } from "@/utils/file-utils";
import { sentences, t } from "@/utils/i18n";
import { log } from "@/utils/logger";
import { ensureEl } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";
import { escapeHtml, safeParseJSON } from "@/utils/string-utils";

const TABS = ["places", "people", "lexicon", "patterns", "rules"] as const;
type Tab = (typeof TABS)[number];

let namesbaseInput: HTMLInputElement | null = null;
let activeTab: Tab = "places"; // kept between openings: the tab the user works in

async function open(): Promise<void> {
  if (options.app.mode) return;
  await Names.loadAll();
  Dialog.closeAll("#namesbaseEditor, .stable");

  renderDialog();
  createBasesList();
  updateInputs();

  Dialog.open("namesbaseEditor", {
    resizable: true,
    title: t("Namesbase Editor"),
    width: "60vw",
    position: { my: "center", at: "center", of: "svg" },
    onClose: closeNamesbaseEditor
  });
}

function renderDialog(): void {
  Dialog.destroy("namesbaseEditor");
  const tabLabels: Record<Tab, string> = {
    places: t("Places"),
    people: t("People"),
    lexicon: t("Lexicon"),
    patterns: t("Patterns"),
    rules: t("Rules")
  };
  const tabs = TABS.map(tab => `<button data-tab="${tab}" style="flex: 1">${tabLabels[tab]}</button>`).join("");
  const notation = (text: string) => `<code>${text}</code>`;

  const editorHtml = /* html */ `<div id="namesbaseEditor" class="dialog stable textual">
      <div id="namesbaseBasesTop">
        <span>${t("Select base")}: </span>
        <select id="namesbaseSelect" data-tip="${t("Select base to edit")}" style="width: 12em" value="0"></select>
        <span>${t("Name")}: </span>
        <input
          id="namesbaseName"
          data-tip="${t("Type to change a base name")}"
          placeholder="${t("Base name")}"
          autocorrect="off"
          spellcheck="false"
          style="width: 10em"
        />
        <span>${t("Extends")}: </span>
        <select
          id="namesbaseExtends"
          data-tip="${t("A base whose lexicon, patterns and people stand in where this base has none")}"
          style="width: 10em"
        ></select>
      </div>
      <div id="namesbaseTabs" style="display: flex; gap: 2px; margin-block: 4px">${tabs}</div>
      <div id="namesbaseBody" style="margin-block: 2px; width: auto; height: 16em; overflow-y: auto">
        <div data-pane="places">
          <textarea
            id="namesbaseTextarea"
            data-base="0"
            rows="7"
            data-tip="${t("Names data: a comma separated list of source names used for names generation")}"
            placeholder="${t("Provide a names data: a comma separated list of source names")}"
            autocorrect="off"
            spellcheck="false"
            style="resize: none"
          ></textarea>
          <div>${t("Rivers and lakes")}:</div>
          <textarea id="namesbaseWaters" rows="2" autocorrect="off" spellcheck="false" style="resize: none"
            data-tip="${t("River and lake names, commas between. Place names stand in when the list is empty")}"></textarea>
          <div>
            <span>${t("Length")}: </span>
            <input id="namesbaseMin" data-tip="${t("Recommended minimum name length")}" type="number" min="2" max="100" />
            <input id="namesbaseMax" data-tip="${t("Recommended maximum name length")}" type="number" min="2" value="10" />
            <span>${t("Doubled")}: </span>
            <input
              id="namesbaseDouble"
              data-tip="${t("Populate with letters that can be used twice in a row (geminates)")}"
              autocorrect="off"
              spellcheck="false"
              style="width: 10em"
            />
          </div>
        </div>
        <div data-pane="people">
          <div>${t("Male names")}:</div>
          <textarea id="namesbaseMale" rows="5" autocorrect="off" spellcheck="false" style="resize: none"
            data-tip="${t("Personal names, commas between: the founders places are named after")}"></textarea>
          <div>${t("Female names")}:</div>
          <textarea id="namesbaseFemale" rows="5" autocorrect="off" spellcheck="false" style="resize: none"
            data-tip="${t("Personal names, commas between: the founders places are named after")}"></textarea>
          <div>
            <span>${t("Names are")}: </span>
            <select id="namesbasePeopleMode" data-tip="${t("Generate new names like the ones listed, or pick the listed names as they are")}">
              <option value="chain">${t("Generated")}</option>
              <option value="pick">${t("Picked")}</option>
            </select>
          </div>
        </div>
        <div data-pane="lexicon">
          <div data-tip="${t("How the base says each concept. A concept with no form gets a generated one, shown in grey")}">
            <span id="namesbaseCoverage"></span>.
            ${t("Forms are written as {{- notation}}, commas between", { notation: notation("form~short/class weight") })}
          </div>
          <div data-tip="${t("How a form is written says where it may stand in a name. A form written plain stands anywhere. A capital first letter or a leading ! makes a whole word. A word written -Gorodok may also follow a name after a dash")}">
            ${t("{{- word}} stands on its own, {{- first}} starts a word, {{- last}} ends one", {
              word: notation("Gorod"),
              first: notation("novo+"),
              last: notation("+grad")
            })}
          </div>
          <div data-tip="${t("A suffix ends a word after a stem or a proper name. A word with * takes the ending of the noun beside it. A noun class alone, such as /n, leaves the noun unsaid")}">
            ${t(
              "{{- suffix}} is a suffix, {{- stem}} takes one, {{- agreeing}} agrees with its noun, {{- silent}} is a noun left unsaid",
              {
                suffix: notation("^sk"),
                stem: notation("berez^"),
                agreeing: notation("nov*"),
                silent: notation("/n")
              }
            )}
          </div>
          <div id="namesbaseLexicon" style="display: grid; grid-template-columns: 7em 1fr; gap: 2px 6px; align-items: center"></div>
        </div>
        <div data-pane="patterns">
          <div data-tip="${t("How often the base coins a name of each pattern, and how it lays the pattern out")}">
            ${t("Templates are written as {{- notation}}, commas between", { notation: notation("{root}s{generic} weight") })}
          </div>
          <div id="namesbasePatterns" style="display: grid; grid-template-columns: 10em 4em 1fr; gap: 2px 6px; align-items: center"></div>
          <div style="margin-top: 4px" data-tip="${t("Share of burg names that end in what the burg is by its group: a city, a town, a village. The rest are named for what stands at the place")}">
            <span>${t("settled")}: </span>
            <input id="namesbaseSettled" type="number" min="0" max="100" step="1" placeholder="85" style="width: 4em" /> %
          </div>
          <div data-tip="${t("Share of founders that are women, in names of the owner-generic pattern. Empty: as the lists of male and female names stand to each other")}">
            <span>${t("women")}: </span>
            <input id="namesbaseFemaleFounders" type="number" min="0" max="100" step="1" style="width: 4em" /> %
          </div>
        </div>
        <div data-pane="rules">
          <div data-tip="${t("Regex rewrites of the base's names, a rule a line, applied in order")}">
            ${t("Rules are written as {{- notation}}, with any of {{- flags}} after", {
              notation: notation("match => replace"),
              flags: notation("| join | long | foreign | 30% | as class")
            })}
          </div>
          <textarea id="namesbaseRules" rows="7" autocorrect="off" spellcheck="false" style="resize: none; font-family: var(--monospace)"></textarea>
          <div data-tip="${t("Noun classes such as genders and the plural: the nouns of a class match its pattern, and a word written with * takes its ending beside one. The stem and first rules make those forms of the lexicon's words where none is written")}">
            ${t("Grammar is written a line each: {{- classes}}, {{- endings}}, {{- rules}}", {
              classes: notation("class: pattern"),
              endings: notation("*set: class ending, …"),
              rules: notation("stem: match => replace")
            })}
          </div>
          <textarea id="namesbaseGrammar" rows="8" autocorrect="off" spellcheck="false" style="resize: none; font-family: var(--monospace)"></textarea>
          <div>
            <span>${t("Try a name")}: </span>
            <input id="namesbaseRuleTest" autocorrect="off" spellcheck="false" style="width: 14em"
              data-tip="${t("Type a name to see what the rules make of it. Put + where its parts join")}" placeholder="novo+gorod" />
            <b id="namesbaseRuleResult"></b>
          </div>
        </div>
      </div>
      <fieldset>
        <legend>${t("Generated examples")}:</legend>
        <div id="namesbaseExamples" data-tip="${t("Examples. Click to re-generate")}"></div>
      </fieldset>
      <div id="namesbaseBottom">
        <button
          id="namesbaseUpdateExamples"
          data-tip="${t("Re-generate examples based on provided data")}"
          class="icon-arrows-cw"
        ></button>
        <button id="namesbaseAdd" data-tip="${t("Add")}" class="icon-plus"></button>
        <button id="namesbaseDefault" data-tip="${t("Restore default namesbase")}" class="icon-cancel"></button>
        <button id="namesbaseDownload" data-tip="${t("Download namesbase to PC")}" class="icon-download"></button>
        <button
          id="namesbaseUpload"
          data-tip="${t("Upload a namesbase from PC, replacing the current set")}"
          class="icon-upload"
        ></button>
        <button
          id="namesbaseUploadExtend"
          data-tip="${t("Upload a namesbase from PC, extending the current set")}"
          class="icon-up-circled2"
        ></button>
        <button
          id="namesbaseCA"
          data-tip="${t("Find or share custom namesbase on Cartography Assets portal")}"
          class="icon-drafting-compass"
        ></button>
        <button
          id="namesbaseAnalyze"
          data-tip="${t("Analyze namesbase to get a validity and quality overview")}"
          class="icon-flask"
        ></button>
        <button
          id="namesbaseSpeak"
          data-tip="${sentences(t("Speak the examples"), t("You can change voice and language in options"))}"
          class="icon-voice"
        ></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);

  ensureEl("namesbaseSelect").addEventListener("change", updateInputs);
  ensureEl("namesbaseTabs").addEventListener("click", e => {
    const tab = (e.target as HTMLElement).dataset.tab as Tab | undefined;
    if (tab) showTab(tab);
  });
  ensureEl("namesbaseTextarea").addEventListener("change", updateNamesData);
  ensureEl("namesbaseWaters").addEventListener("change", updateWaters);
  ensureEl("namesbaseUpdateExamples").addEventListener("click", updateExamples);
  ensureEl("namesbaseExamples").addEventListener("click", updateExamples);
  ensureEl("namesbaseName").addEventListener("input", e => updateBaseName((e.target as HTMLInputElement).value));
  ensureEl("namesbaseExtends").addEventListener("change", updateBaseExtends);
  ensureEl("namesbaseMin").addEventListener("input", e => updateBaseMin((e.target as HTMLInputElement).value));
  ensureEl("namesbaseMax").addEventListener("input", e => updateBaseMax((e.target as HTMLInputElement).value));
  ensureEl("namesbaseDouble").addEventListener("input", e =>
    updateBaseDuplication((e.target as HTMLInputElement).value)
  );
  for (const id of ["namesbaseMale", "namesbaseFemale", "namesbasePeopleMode"])
    ensureEl(id).addEventListener("change", updatePeople);
  ensureEl("namesbaseLexicon").addEventListener("change", updateLexicon);
  ensureEl("namesbasePatterns").addEventListener("change", updatePatterns);
  ensureEl("namesbaseSettled").addEventListener("change", updateSettled);
  ensureEl("namesbaseFemaleFounders").addEventListener("change", updateFemaleFounders);
  ensureEl("namesbaseRules").addEventListener("change", updateRules);
  ensureEl("namesbaseGrammar").addEventListener("change", updateGrammar);
  ensureEl("namesbaseRuleTest").addEventListener("input", testRules);
  ensureEl("namesbaseAdd").addEventListener("click", namesbaseAdd);
  ensureEl("namesbaseAnalyze").addEventListener("click", analyzeNamesbase);
  ensureEl("namesbaseDefault").addEventListener("click", namesbaseRestoreDefault);
  ensureEl("namesbaseDownload").addEventListener("click", namesbaseDownload);
  ensureEl("namesbaseUpload").addEventListener("click", () => pickNamesbaseFile(true));
  ensureEl("namesbaseUploadExtend").addEventListener("click", () => pickNamesbaseFile(false));
  ensureEl("namesbaseCA").addEventListener("click", () =>
    openURL("https://cartographyassets.com/asset-category/specific-assets/azgaars-generator/namebases/")
  );
  ensureEl("namesbaseSpeak").addEventListener("click", () => speak(ensureEl("namesbaseExamples").textContent ?? ""));
  showTab(activeTab);
}

function showTab(tab: Tab): void {
  activeTab = tab;
  const editor = ensureEl("namesbaseEditor");
  for (const button of editor.querySelectorAll<HTMLElement>("[data-tab]")) {
    const isActive = button.dataset.tab === tab;
    button.style.background = isActive ? "var(--header)" : "";
    button.style.color = isActive ? "white" : "";
  }
  for (const pane of editor.querySelectorAll<HTMLElement>("[data-pane]"))
    pane.style.display = pane.dataset.pane === tab ? "" : "none";
}

function closeNamesbaseEditor(): void {
  Dialog.destroy("namesbaseEditor");
}

function createBasesList(): void {
  const select = ensureEl<HTMLSelectElement>("namesbaseSelect");
  select.innerHTML = "";
  Names.loaded().forEach((b, i) => {
    select.options.add(new Option(b.name, String(i)));
  });
}

const selectedBase = (): NameBase | undefined => Names.loaded()[+ensureEl<HTMLSelectElement>("namesbaseSelect").value];

function updateInputs(): void {
  const base = selectedBase();
  if (!base) {
    const index = ensureEl<HTMLSelectElement>("namesbaseSelect").value;
    tip(t("Namesbase {{base}} is not defined", { base: index }), false, "error");
    return;
  }
  showBase(base);
  updateExamples();
}

function showBase(base: NameBase): void {
  ensureEl<HTMLTextAreaElement>("namesbaseTextarea").value = base.places.names.join(",");
  ensureEl<HTMLTextAreaElement>("namesbaseWaters").value = base.waters?.names.join(",") ?? "";
  ensureEl<HTMLInputElement>("namesbaseName").value = base.name;
  ensureEl<HTMLInputElement>("namesbaseMin").value = String(base.length[0]);
  ensureEl<HTMLInputElement>("namesbaseMax").value = String(base.length[1]);
  ensureEl<HTMLInputElement>("namesbaseDouble").value = SoundRules.getDoubles(base);

  const parents = Names.loaded()
    .filter(other => other !== base)
    .map(({ id, name }) => new Option(name, id));
  ensureEl<HTMLSelectElement>("namesbaseExtends").replaceChildren(new Option(t("nothing"), ""), ...parents);
  ensureEl<HTMLSelectElement>("namesbaseExtends").value = base.extends ?? "";

  ensureEl<HTMLTextAreaElement>("namesbaseMale").value = base.people?.male?.names.join(",") ?? "";
  ensureEl<HTMLTextAreaElement>("namesbaseFemale").value = base.people?.female?.names.join(",") ?? "";
  const mode = (base.people?.male ?? base.people?.female)?.mode ?? "chain";
  ensureEl<HTMLSelectElement>("namesbasePeopleMode").value = mode;

  showLexicon(base);
  showPatterns(base);
  ensureEl<HTMLTextAreaElement>("namesbaseRules").value = NameNotation.formatRules(base.rules);
  ensureEl<HTMLTextAreaElement>("namesbaseGrammar").value = NameNotation.formatGrammar(base.grammar);
  testRules();
}

function showLexicon(base: NameBase): void {
  const kinds = [
    ["settlement", t("Settlements")],
    ["generic", t("Places")],
    ["modifier", t("Modifiers")],
    ["numeral", t("Numerals")],
    ["land", t("Lands")]
  ] as const;
  const rows = kinds.flatMap(([kind, label]) => [
    `<b style="grid-column: 1 / -1; margin-top: 4px">${label}</b>`,
    ...conceptsOf(kind).map(concept => {
      const { first, last } = Lexicon.fallbackForms(base, concept);
      const value = escapeHtml(NameNotation.formatFormants(base.lexicon?.[concept]));
      return `<span>${concept}</span>
        <input data-concept="${concept}" value="${value}" placeholder="${first}-, -${last}" autocorrect="off" spellcheck="false"
          data-tip="${escapeHtml(derivedTip(base, concept))}" />`;
    })
  ]);
  ensureEl("namesbaseLexicon").innerHTML = rows.join("");
  showCoverage(base);
}

// what the grammar makes of a concept's forms, shown on its field
function derivedTip(base: NameBase, concept: Concept): string {
  const derived = Lexicon.derivedForms(base, concept, base.lexicon?.[concept] ?? []);
  return derived.length ? t("Made by the grammar: {{- forms}}", { forms: NameNotation.formatFormants(derived) }) : "";
}

function showCoverage(base: NameBase): void {
  const written = Object.values(base.lexicon ?? {}).filter(forms => forms?.length).length;
  const all = (["settlement", "generic", "modifier", "numeral", "land"] as const).flatMap(conceptsOf).length;
  ensureEl("namesbaseCoverage").textContent = t("Concepts written: {{written}} of {{all}}", { written, all });
}

function showPatterns(base: NameBase): void {
  const rows = (Object.keys(DEFAULT_TEMPLATES) as Pattern[]).map(pattern => {
    const { weight, templates } = base.patterns?.[pattern] ?? {};
    return `<span>${pattern}</span>
      <input data-pattern="${pattern}" data-field="weight" type="number" min="0" value="${weight ?? ""}"
        placeholder="${DEFAULT_WEIGHTS[pattern]}" data-tip="${t("How often the base coins such a name, against the other patterns")}" />
      <input data-pattern="${pattern}" data-field="templates" value="${escapeHtml(NameNotation.formatTemplates(templates))}"
        placeholder="${DEFAULT_TEMPLATES[pattern]}" autocorrect="off" spellcheck="false" />`;
  });
  ensureEl("namesbasePatterns").innerHTML = rows.join("");
  ensureEl<HTMLInputElement>("namesbaseSettled").value = base.settled === undefined ? "" : String(base.settled * 100);
  const female = base.patterns?.["owner-generic"]?.female;
  ensureEl<HTMLInputElement>("namesbaseFemaleFounders").value =
    female === undefined ? "" : String(Math.round(female * 100));
}

function updateExamples(): void {
  const base = selectedBase();
  if (!base) return;
  const examples = Array.from({ length: 7 }, () => {
    const { name, meaning } = Toponyms.sample(base);
    return meaning.pattern === "simplex"
      ? escapeHtml(name)
      : `${escapeHtml(name)} <i>(${escapeHtml(localGloss(meaning))})</i>`;
  });
  ensureEl("namesbaseExamples").innerHTML = examples.join(", ");
}

function updateNamesData(): void {
  const base = selectedBase();
  const names = ensureEl<HTMLTextAreaElement>("namesbaseTextarea").value.split(",");
  if (!base || names.length < 3) {
    tip(t("The names data provided is too short or incorrect"), false, "error");
    return;
  }
  base.places.names = names;
  Names.updateChain(base.id);
}

function updateWaters(): void {
  const base = selectedBase();
  if (!base) return;
  const names = listOf("namesbaseWaters");
  if (names.length) base.waters = { ...base.waters, names };
  else delete base.waters;
}

function updateBaseName(name: string): void {
  const base = selectedBase();
  if (!base) return;
  const select = ensureEl<HTMLSelectElement>("namesbaseSelect");
  select.options[select.selectedIndex].text = name;
  base.name = name;
}

function updateBaseExtends(this: HTMLSelectElement): void {
  const base = selectedBase();
  if (!base) return;
  if (this.value) base.extends = this.value;
  else delete base.extends;
  showLexicon(base);
  updateExamples();
}

function updateBaseMin(value: string): void {
  const base = selectedBase();
  if (!base) return;
  if (+value > base.length[1]) {
    tip(t("Minimal length cannot be greater than maximal"), false, "error");
    return;
  }
  base.length[0] = +value;
}

function updateBaseMax(value: string): void {
  const base = selectedBase();
  if (!base) return;
  if (+value < base.length[0]) {
    tip(t("Maximal length should be greater than minimal"), false, "error");
    return;
  }
  base.length[1] = +value;
}

function updateBaseDuplication(value: string): void {
  const base = selectedBase();
  if (!base) return;
  SoundRules.setDoubles(base, value);
  ensureEl<HTMLTextAreaElement>("namesbaseRules").value = NameNotation.formatRules(base.rules);
}

function updatePeople(): void {
  const base = selectedBase();
  if (!base) return;
  const mode = ensureEl<HTMLSelectElement>("namesbasePeopleMode").value as Corpus["mode"];
  const corpus = (id: string, old?: Corpus): Corpus | undefined => {
    const names = listOf(id);
    return names.length ? { ...old, names, mode } : undefined;
  };
  const [male, female] = [corpus("namesbaseMale", base.people?.male), corpus("namesbaseFemale", base.people?.female)];
  if (male || female) base.people = { ...(male && { male }), ...(female && { female }) };
  else delete base.people;
  updateExamples();
}

function updateLexicon(event: Event): void {
  const base = selectedBase();
  const input = event.target as HTMLInputElement;
  const concept = input.dataset.concept as Concept | undefined;
  if (!base || !concept) return;

  const forms = NameNotation.parseFormants(input.value);
  base.lexicon ??= {};
  if (forms.length) base.lexicon[concept] = forms;
  else delete base.lexicon[concept];
  input.value = NameNotation.formatFormants(forms); // what was understood
  input.dataset.tip = derivedTip(base, concept);
  showCoverage(base);
  updateExamples();
}

function updateSettled(this: HTMLInputElement): void {
  const base = selectedBase();
  if (!base) return;
  if (this.value === "") delete base.settled;
  else base.settled = Math.min(Math.max(+this.value, 0), 100) / 100;
  updateExamples();
}

function updateFemaleFounders(this: HTMLInputElement): void {
  const base = selectedBase();
  if (!base) return;
  const settings = { ...base.patterns?.["owner-generic"] };
  if (this.value === "") delete settings.female;
  else settings.female = Math.min(Math.max(+this.value, 0), 100) / 100;
  base.patterns ??= {};
  if (Object.keys(settings).length) base.patterns["owner-generic"] = settings;
  else delete base.patterns["owner-generic"];
  updateExamples();
}

function updatePatterns(event: Event): void {
  const base = selectedBase();
  const input = event.target as HTMLInputElement;
  const pattern = input.dataset.pattern as Pattern | undefined;
  if (!base || !pattern) return;

  base.patterns ??= {};
  const settings = { ...base.patterns[pattern] };
  if (input.dataset.field === "weight") {
    if (input.value === "") delete settings.weight;
    else settings.weight = Math.max(+input.value, 0);
  } else {
    const templates = NameNotation.parseTemplates(input.value);
    if (templates.length) settings.templates = templates;
    else delete settings.templates;
    input.value = NameNotation.formatTemplates(templates);
  }
  if (Object.keys(settings).length) base.patterns[pattern] = settings;
  else delete base.patterns[pattern];
  updateExamples();
}

function updateRules(): void {
  const base = selectedBase();
  if (!base) return;
  const rules = NameNotation.parseRules(ensureEl<HTMLTextAreaElement>("namesbaseRules").value);
  const broken = rules.filter(({ match }) => !isRegex(match)).map(({ match }) => match);
  if (broken.length)
    tip(t("Rules that are no valid regex are skipped: {{rules}}", { rules: broken.join(", ") }), false, "error");
  base.rules = rules;
  ensureEl<HTMLInputElement>("namesbaseDouble").value = SoundRules.getDoubles(base);
  testRules();
  updateExamples();
}

function updateGrammar(): void {
  const base = selectedBase();
  if (!base) return;
  base.grammar = NameNotation.parseGrammar(ensureEl<HTMLTextAreaElement>("namesbaseGrammar").value);
  if (!base.grammar) delete base.grammar;
  for (const input of document.querySelectorAll<HTMLInputElement>("#namesbaseLexicon input[data-concept]"))
    input.dataset.tip = derivedTip(base, input.dataset.concept as Concept);
  updateExamples();
}

function isRegex(source: string): boolean {
  try {
    new RegExp(source, "gu");
    return true;
  } catch {
    return false;
  }
}

/** Show what the base's rules make of the name typed: a word, or a name made of parts where it holds a + */
function testRules(): void {
  const base = selectedBase();
  const name = ensureEl<HTMLInputElement>("namesbaseRuleTest").value.trim().toLowerCase();
  if (!base || !name) {
    ensureEl("namesbaseRuleResult").textContent = "";
    return;
  }
  const fits = (joined: string) => joined.length <= base.length[1];
  const rolls = (base.rules ?? []).map(() => 0); // every rule with a chance fires, to show what it does
  const result = name.includes("+")
    ? SoundRules.join(name, base.rules, { rolls, fits })
    : SoundRules.apply(name, base.rules);
  ensureEl("namesbaseRuleResult").textContent = SoundRules.capitalize(result);
}

function analyzeNamesbase(): void {
  const namesSourceString = (ensureEl("namesbaseTextarea") as HTMLTextAreaElement).value;
  const namesArray = namesSourceString.toLowerCase().split(",");
  const length = namesArray.length;
  if (!namesSourceString || !length) {
    tip(t("Names data should not be empty"), false, "error");
    return;
  }

  const chain = Names.calculateChain(namesSourceString.split(","));
  const chainValues = Object.values(chain) as string[][];
  const variety = rn(mean(chainValues.map(kv => kv.length)) ?? 0);

  const wordsLength = namesArray.map(n => n.length);

  const nonLatin = namesSourceString.match(/[\u0080-\uFFFF]/gu);
  const nonBasicLatinChars = nonLatin
    ? unique(
        namesSourceString
          .match(/[\u0080-\uFFFF]/gu)!
          .join("")
          .toLowerCase()
          .split("")
      ).join("")
    : "none";

  const geminate = namesArray.flatMap(name => name.match(/[^\w\s]|(.)(?=\1)/g) ?? []);
  const doubled = unique(geminate).filter(char => geminate.filter(d => d === char).length > 3);
  const doubledStr = doubled.length ? doubled.join("") : "none";

  const duplicates = unique(namesArray.filter((e, i, a) => a.indexOf(e) !== i)).join(", ") || "none";
  const multiwordRate = mean(namesArray.map(n => +n.includes(" "))) ?? 0;

  const endings =
    Lexicon.mineEndings(namesArray)
      .slice(0, 10)
      .map(ending => `-${escapeHtml(ending)}`)
      .join(", ") || "none";

  const getLengthQuality = (): string => {
    if (length < 30)
      return `<span data-tip="${t("Namesbase contains < 30 names - not enough to generate reasonable data")}" style="color:red">[${t("not enough")}]</span>`;
    if (length < 100)
      return `<span data-tip="${t("Namesbase contains < 100 names - not enough to generate good names")}" style="color:darkred">[${t("low")}]</span>`;
    if (length <= 400)
      return `<span data-tip="${t("Namesbase contains a reasonable number of samples")}" style="color:green">[${t("good")}]</span>`;
    return `<span data-tip="${t("Namesbase contains > 400 names. That is too much, try to reduce it to ~300 names")}" style="color:darkred">[${t("overmuch")}]</span>`;
  };

  const getVarietyLevel = (): string => {
    if (variety < 15)
      return `<span data-tip="${t("Namesbase average variety < 15 - generated names will be too repetitive")}" style="color:red">[${t("low")}]</span>`;
    if (variety < 30)
      return `<span data-tip="${t("Namesbase average variety < 30 - names can be too repetitive")}" style="color:orange">[${t("mean")}]</span>`;
    return `<span data-tip="${t("Namesbase variety is good")}" style="color:green">[${t("good")}]</span>`;
  };

  Dialog.message({
    message: /* html */ `<div style="line-height: 1.6em; max-width: 20em">
      <div data-tip="${t("Number of names provided")}">${t("Namesbase length")}: ${length} ${getLengthQuality()}</div>
      <div data-tip="${t("Average number of generation variants for each key in the chain")}">${t("Namesbase variety")}: ${variety} ${getVarietyLevel()}</div>
      <hr />
      <div data-tip="${t("The shortest name length")}">${t("Min name length")}: ${d3min(wordsLength)}</div>
      <div data-tip="${t("The longest name length")}">${t("Max name length")}: ${d3max(wordsLength)}</div>
      <div data-tip="${t("Average name length")}">${t("Mean name length")}: ${rn(mean(wordsLength) ?? 0, 1)}</div>
      <div data-tip="${t("Common name length")}">${t("Median name length")}: ${median(wordsLength)}</div>
      <hr />
      <div data-tip="${t("Characters outside of Basic Latin have bad font support")}">${t("Non-basic chars")}: ${nonBasicLatinChars}</div>
      <div data-tip="${t("Characters that are frequently (more than 3 times) doubled")}">${t("Doubled chars")}: ${doubledStr}</div>
      <div data-tip="${t("Names used more than one time")}">${t("Duplicates")}: ${duplicates}</div>
      <div data-tip="${t("Endings many names share: candidates for the forms of the Lexicon tab")}">${t("Common endings")}: ${endings}</div>
      <div data-tip="${t("Percentage of names containing space character")}">${t("Multi-word names")}: ${rn(multiwordRate * 100, 2)}%</div>
    </div>`,
    title: t("Data Analysis"),
    width: "auto",
    position: { my: "left top-30", at: "right+10 top", of: "#namesbaseEditor" }
  });
}

function namesbaseAdd(): void {
  const index = Names.loaded().length;
  const name = `Base${index}`;
  const example =
    "This,is,an,example,of,name,base,showing,correct,format,It,should,have,at,least,one,hundred,names,separated,with,comma";
  const base = Names.composeBase(Names.uniqueId(name, baseIds()), name, [5, 12], example.split(","));
  Names.nameBases.push(base);

  const select = ensureEl<HTMLSelectElement>("namesbaseSelect");
  select.add(new Option(name, String(index)));
  select.value = String(index);
  showBase(base);
  showTab("places");
  ensureEl("namesbaseExamples").innerHTML = t("Please provide names data");
}

const baseIds = (): string[] => Names.nameBases.map(base => base.id);

function namesbaseRestoreDefault(): void {
  Dialog.confirm({
    title: t("Restore default data"),
    message: t("Are you sure you want to restore default namesbase?"),
    confirm: t("Restore"),
    onConfirm: async () => {
      Names.replace(Names.getNameBases());
      await Names.loadAll();
      createBasesList();
      updateInputs();
    }
  });
}

function namesbaseDownload(): void {
  const data = `[\n${Names.loaded()
    .map(base => JSON.stringify(base))
    .join(",\n")}\n]`; // a base a line
  downloadFile(data, `${getFileName("Namesbase")}.json`, "application/json");
}

/** Own the namesbase file input here so repeat opens cannot stack listeners on a shared element */
function pickNamesbaseFile(extend: boolean): void {
  namesbaseInput ??= createFileInput(".json,.txt");
  namesbaseInput.onchange = () => uploadFile(namesbaseInput!, data => namesbaseUpload(data, extend));
  namesbaseInput.click();
}

function namesbaseUpload(dataLoaded: string, override = true): void {
  const taken = override ? [] : baseIds();
  const errors: ParseError[] = [];
  const bases = /^\s*[[{]/.test(dataLoaded)
    ? parseBases(dataLoaded, taken)
    : parseLegacyBases(dataLoaded, taken, errors);
  if (errors.length > 0) showParseErrors(errors, bases?.length ?? 0);
  if (!bases?.length) {
    if (!errors.length) tip(sentences(t("Cannot load a namesbase"), t("Please check the data format")), false, "error");
    return;
  }

  Names.replace(override ? bases : [...Names.nameBases, ...bases]);
  createBasesList();
  updateInputs();
}

/** The bases of a JSON namesbase file, one or a list; a base whose id is taken gets one of its own */
function parseBases(data: string, taken: string[]): NameBase[] | null {
  const parsed: unknown = safeParseJSON(data);
  const { data: bases } = z.array(Names.schema).safeParse(Array.isArray(parsed) ? parsed : [parsed]);
  if (!bases?.length) return null;

  return bases.map(base => {
    const id = taken.includes(base.id) ? Names.uniqueId(base.name, taken) : base.id;
    taken.push(id);
    return { ...base, id };
  });
}

/** The bases of an older namesbase file: a line of name|min|max|doubled|m|names each */
function parseLegacyBases(data: string, taken: string[], errors: ParseError[]): NameBase[] | null {
  const lines = data
    .replace(/\r\n|\r/g, "\n")
    .split("\n")
    .filter(Boolean);
  if (!lines.length) return null;

  return lines.flatMap((line, index) => {
    try {
      const [name, min, max, doubled, , names] = line.split("|");
      if (!name) throw new Error(t("Name is missing"));
      if (!names) throw new Error(t("Names are missing"));
      const id = Names.uniqueId(name, taken);
      taken.push(id);
      return Names.composeBase(id, name, [+min, +max], names.split(","), doubled);
    } catch (e) {
      errors.push({ id: index + 1, line, error: (e as Error).message });
      log.error(e);
      return [];
    }
  });
}

function showParseErrors(errors: ParseError[], added: number): void {
  log.error("Namesbase upload errors", errors);
  const errorItems = errors
    .map(
      ({ id, line, error }) => /* html */ `<li style="padding:0.6em 0;border-top:1px solid #ddd;">
            <div>
              ${t("Line {{number}}", { number: id })}:
              <span style="color:#8b0000">${escapeHtml(error)}.</span> ${t("Data")}:
            </div>
            <div style="margin-top:0.35em;font-family:var(--font-monospace,monospace);line-height:1.4;word-break:break-word;color:#333;">
              ${escapeHtml(line) || `<i>${t("empty line")}</i>`}
            </div>
          </li>`
    )
    .join("");

  Dialog.message({
    message: /* html */ `<div>
        <p style="margin:0.75em;">
          <strong>${t("File parsing error. Only {{added}} out of {{total}} namebases added.", {
            added,
            total: added + errors.length
          })}</strong>
          ${t("Each namebase should be on its own line and follow the format: name|min|max|duplication|m|names. Parameters should be separated with the | character, and this character should not be used within the parameters. Another prohibited character is /. The most common issue is names and other parameters being on two separate lines.")}
          <ul style="margin:0.5em;">
            <li><code>name</code>: ${t("name of the base.")}</li>
            <li><code>min</code>: ${t("minimal recommended length of generated names. It should be a number.")}</li>
            <li><code>max</code>: ${t("maximal recommended length of generated names. It should be a number greater than minimal length.")}</li>
            <li><code>duplication</code>: ${t("characters that can be duplicated in generated names. For example lkd means names like “Kalla”, “Mikkor”, “Dalddur” are possible. This parameter can be empty.")}</li>
            <li><code>m</code>: ${t("unused parameter, populate with 0.")}</li>
            <li><code>names</code>: ${t("names data, separated with commas. It should contain at least 3 names to be valid.")}</li>
          </ul>
        </p>
        <div>
          <ul style="margin:0;padding-left:1.5em;">
            ${errorItems}
          </ul>
        </div>
      </div>`,
    title: t("Parsing error"),
    width: "min(72vw, 68em)",
    position: { my: "center center-4em", at: "center", of: "svg" },
    buttons: [{ label: t("Continue") }]
  });
}

interface ParseError {
  id: number;
  line: string;
  error: string;
}

// the names of a comma separated field
const listOf = (id: string) =>
  ensureEl<HTMLTextAreaElement>(id)
    .value.split(",")
    .map(name => name.trim())
    .filter(Boolean);

export const NamesbaseEditor = { open };
