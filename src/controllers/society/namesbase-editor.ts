import { max as d3max, min as d3min, mean, median } from "d3";
import { z } from "zod";
import type { NameBase } from "@/data/name-bases";
import { composeBase, Names, nameBaseSchema, uniqueBaseId } from "@/model/society/names-generator";
import { getDoubles, setDoubles } from "@/model/society/sound-rules";
import { getFileName } from "@/services/io/file-name";
import { speak } from "@/services/speech";
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

let namesbaseInput: HTMLInputElement | null = null;

function open(): void {
  if (options.app.mode) return;
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
  const editorHtml = /* html */ `<div id="namesbaseEditor" class="dialog stable textual">
      <div id="namesbaseBasesTop">
        <span>${t("Select base")}: </span>
        <select id="namesbaseSelect" data-tip="${t("Select base to edit")}" style="width: 12em" value="0"></select>
        <span style="margin-left: 2px">${t("Names data")}: </span>
      </div>
      <div id="namesbaseBody" style="margin-block: 2px; width: auto">
        <textarea
          id="namesbaseTextarea"
          data-base="0"
          rows="13"
          data-tip="${t("Names data: a comma separated list of source names used for names generation")}"
          placeholder="${t("Provide a names data: a comma separated list of source names")}"
          autocorrect="off"
          spellcheck="false"
          style="resize: none"
        ></textarea>
        <div>
          <span>${t("Name")}: </span>
          <input
            id="namesbaseName"
            data-tip="${t("Type to change a base name")}"
            placeholder="${t("Base name")}"
            autocorrect="off"
            spellcheck="false"
            style="width: 12em"
          />
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
        <fieldset>
          <legend>${t("Generated examples")}:</legend>
          <div id="namesbaseExamples" data-tip="${t("Examples. Click to re-generate")}"></div>
        </fieldset>
      </div>
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
  ensureEl("namesbaseTextarea").addEventListener("change", updateNamesData);
  ensureEl("namesbaseUpdateExamples").addEventListener("click", updateExamples);
  ensureEl("namesbaseExamples").addEventListener("click", updateExamples);
  ensureEl("namesbaseName").addEventListener("input", e => updateBaseName((e.target as HTMLInputElement).value));
  ensureEl("namesbaseMin").addEventListener("input", e => updateBaseMin((e.target as HTMLInputElement).value));
  ensureEl("namesbaseMax").addEventListener("input", e => updateBaseMax((e.target as HTMLInputElement).value));
  ensureEl("namesbaseDouble").addEventListener("input", e =>
    updateBaseDuplication((e.target as HTMLInputElement).value)
  );
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
}

function closeNamesbaseEditor(): void {
  Dialog.destroy("namesbaseEditor");
}

function createBasesList(): void {
  const select = ensureEl<HTMLSelectElement>("namesbaseSelect");
  select.innerHTML = "";
  Names.nameBases.forEach((b, i) => {
    select.options.add(new Option(b.name, String(i)));
  });
}

const selectedBase = (): NameBase | undefined => Names.nameBases[+ensureEl<HTMLSelectElement>("namesbaseSelect").value];

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
  ensureEl<HTMLInputElement>("namesbaseName").value = base.name;
  ensureEl<HTMLInputElement>("namesbaseMin").value = String(base.length[0]);
  ensureEl<HTMLInputElement>("namesbaseMax").value = String(base.length[1]);
  ensureEl<HTMLInputElement>("namesbaseDouble").value = getDoubles(base);
}

function updateExamples(): void {
  const base = selectedBase();
  if (!base) return;
  let examples = "";
  for (let i = 0; i < 7; i++) {
    const example = Names.getBase(base.id);
    if (example === undefined) {
      examples = t("Cannot generate examples. Please verify the data");
      break;
    }
    if (i) examples += ", ";
    examples += example;
  }
  ensureEl("namesbaseExamples").innerHTML = examples;
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

function updateBaseName(name: string): void {
  const base = selectedBase();
  if (!base) return;
  const select = ensureEl<HTMLSelectElement>("namesbaseSelect");
  select.options[select.selectedIndex].text = name;
  base.name = name;
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
  if (base) setDoubles(base, value);
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
      <div data-tip="${t("Percentage of names containing space character")}">${t("Multi-word names")}: ${rn(multiwordRate * 100, 2)}%</div>
    </div>`,
    title: t("Data Analysis"),
    width: "auto",
    position: { my: "left top-30", at: "right+10 top", of: "#namesbaseEditor" }
  });
}

function namesbaseAdd(): void {
  const index = Names.nameBases.length;
  const name = `Base${index}`;
  const example =
    "This,is,an,example,of,name,base,showing,correct,format,It,should,have,at,least,one,hundred,names,separated,with,comma";
  const base = composeBase(uniqueBaseId(name, baseIds()), name, [5, 12], example.split(","));
  Names.nameBases.push(base);

  const select = ensureEl<HTMLSelectElement>("namesbaseSelect");
  select.add(new Option(name, String(index)));
  select.value = String(index);
  showBase(base);
  ensureEl("namesbaseExamples").innerHTML = t("Please provide names data");
}

const baseIds = (): string[] => Names.nameBases.map(base => base.id);

function namesbaseRestoreDefault(): void {
  Dialog.confirm({
    title: t("Restore default data"),
    message: t("Are you sure you want to restore default namesbase?"),
    confirm: t("Restore"),
    onConfirm: () => {
      Names.replace(Names.getNameBases());
      createBasesList();
      updateInputs();
    }
  });
}

function namesbaseDownload(): void {
  const data = `[\n${Names.nameBases.map(base => JSON.stringify(base)).join(",\n")}\n]`; // a base a line
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
  const { data: bases } = z.array(nameBaseSchema).safeParse(Array.isArray(parsed) ? parsed : [parsed]);
  if (!bases?.length) return null;

  return bases.map(base => {
    const id = taken.includes(base.id) ? uniqueBaseId(base.name, taken) : base.id;
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
      const id = uniqueBaseId(name, taken);
      taken.push(id);
      return composeBase(id, name, [+min, +max], names.split(","), doubled);
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

export const NamesbaseEditor = { open };
