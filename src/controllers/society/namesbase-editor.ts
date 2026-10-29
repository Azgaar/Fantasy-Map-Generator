import { max as d3max, min as d3min, mean, median } from "d3";
import { BASE_ID_PATTERN, deriveBaseId } from "@/data/name-bases";
import { Names } from "@/model/society/names-generator";
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
import { escapeHtml } from "@/utils/string-utils";

let namesbaseInput: HTMLInputElement | null = null;

const selectedId = (): string => ensureEl<HTMLSelectElement>("namesbaseSelect").value;
const takenIds = (): Set<string> => new Set(Names.nameBases.map(base => base.id));

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
  Names.reindex();
  Names.nameBases.forEach(base => {
    select.options.add(new Option(base.name, base.id));
  });
}

function updateInputs(): void {
const base = Names.getNameBase(selectedId());
  if (!base) {
    tip(t("Namesbase {{base}} is not defined", { base: selectedId() }), false, "error");
    return;
  }
  (ensureEl("namesbaseTextarea") as HTMLTextAreaElement).value = base.b;
  (ensureEl("namesbaseName") as HTMLInputElement).value = base.name;
  (ensureEl("namesbaseMin") as HTMLInputElement).value = String(base.min);
  (ensureEl("namesbaseMax") as HTMLInputElement).value = String(base.max);
  (ensureEl("namesbaseDouble") as HTMLInputElement).value = base.d;
  updateExamples();
}

function updateExamples(): void {
  let examples = "";
  for (let i = 0; i < 7; i++) {
    const example = Names.getBase(selectedId());
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
  const base = Names.getNameBase(selectedId());
  const input = ensureEl<HTMLTextAreaElement>("namesbaseTextarea");
  if (!base) return;
  if (input.value.split(",").length < 3) {
    tip(t("The names data provided is too short or incorrect"), false, "error");
    return;
  }
  const securedNamesData = input.value.replace(/[/|]/g, "");
  base.b = securedNamesData;
  input.value = securedNamesData;
  Names.updateChain(base.id);
}

function updateBaseName(rawName: string): void {
  const base = Names.getNameBase(selectedId());
  if (!base) return;
  const select = ensureEl<HTMLSelectElement>("namesbaseSelect");
  const name = rawName.replace(/[/|]/g, "");
  select.options[select.selectedIndex].innerHTML = name;
  base.name = name;
}

function updateBaseMin(value: string): void {
const base = Names.getNameBase(selectedId());
  if (!base) return;
  if (+value > base.max) {
    tip(t("Minimal length cannot be greater than maximal"), false, "error");
    return;
  }
  base.min = +value;
}

function updateBaseMax(value: string): void {
const base = Names.getNameBase(selectedId());
  if (!base) return;
  if (+value < base.min) {
    tip(t("Maximal length should be greater than minimal"), false, "error");
    return;
  }
  base.max = +value;
}

function updateBaseDuplication(value: string): void {
  const base = Names.getNameBase(selectedId());
  if (base) base.d = value;
}

function analyzeNamesbase(): void {
  const namesSourceString = (ensureEl("namesbaseTextarea") as HTMLTextAreaElement).value;
  const namesArray = namesSourceString.toLowerCase().split(",");
  const length = namesArray.length;
  if (!namesSourceString || !length) {
    tip(t("Names data should not be empty"), false, "error");
    return;
  }

  const chain = Names.calculateChain(namesSourceString);
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
  const serial = Names.nameBases.length;
  const name = `Base${serial}`;
  const id = deriveBaseId(name, takenIds());
  const b =
    "This,is,an,example,of,name,base,showing,correct,format,It,should,have,at,least,one,hundred,names,separated,with,comma";
  Names.nameBases.push({
    id,
    name,
    i: serial,
    min: 5,
    max: 12,
    d: "",
    m: 0,
    b
  });
  Names.reindex();
  ensureEl<HTMLSelectElement>("namesbaseSelect").add(new Option(name, id));
  (ensureEl("namesbaseSelect") as HTMLSelectElement).value = id;
  (ensureEl("namesbaseTextarea") as HTMLTextAreaElement).value = b;
  (ensureEl("namesbaseName") as HTMLInputElement).value = name;
  (ensureEl("namesbaseMin") as HTMLInputElement).value = "5";
  (ensureEl("namesbaseMax") as HTMLInputElement).value = "12";
  (ensureEl("namesbaseDouble") as HTMLInputElement).value = "";
  ensureEl("namesbaseExamples").innerHTML = t("Please provide names data");
}

function namesbaseRestoreDefault(): void {
Dialog.confirm({
    title: t("Restore default data"),
    message: t("Are you sure you want to restore default namesbase?"),
    confirm: t("Restore"),
    onConfirm: () => {
      Names.clearChains();
      Names.nameBases = Names.getNameBases();
      Names.reindex();
      createBasesList();
      updateInputs();
    }
  });
}

function namesbaseDownload(): void {
  const data = Names.nameBases.map(b => `${b.id}|${b.name}|${b.min}|${b.max}|${b.d}|${b.m}|${b.b}`).join("\r\n");
  const name = `${getFileName("Namesbase")}.txt`;
  downloadFile(data, name);
}

/** Own the namesbase file input here so repeat opens cannot stack listeners on a shared element */
function pickNamesbaseFile(extend: boolean): void {
  namesbaseInput ??= createFileInput(".txt");
  namesbaseInput.onchange = () => uploadFile(namesbaseInput!, data => namesbaseUpload(data, extend));
  namesbaseInput.click();
}

function namesbaseUpload(dataLoaded: string, override = true): void {
  const lines = dataLoaded
    .replace(/\r\n|\r/g, "\n")
    .split("\n")
    .filter(Boolean);
  if (!lines.length) {
    tip(sentences(t("Cannot load a namesbase"), t("Please check the data format")), false, "error");
    return;
  }

  Names.clearChains();
  if (override) Names.nameBases = [];
  const taken = takenIds();

  const errors: ParseError[] = [];
  lines.forEach((line, index) => {
    try {
      const fields = line.split("|");
      // A well-formed id marks the new seven-column layout; anything else is legacy
      const hasId = fields.length === 7 && BASE_ID_PATTERN.test(fields[0].trim().toUpperCase());
      const [rawId, rawName = "", min = "5", max = "12", d = "", m = "0", rawNames = ""] = hasId
        ? fields
        : [undefined, ...fields.slice(0, 6)];
      const name = rawName?.replace(unsafe, "");
      if (!name) throw new Error(t("Name is missing"));
      const names = rawNames?.replace(unsafe, "");
if (!names) throw new Error(t("Names are missing"));

      const candidate = rawId?.trim().toUpperCase();
      const id =
        candidate && BASE_ID_PATTERN.test(candidate) && !taken.has(candidate) ? candidate : deriveBaseId(name, taken);
      taken.add(id);
      Names.nameBases.push({
        id,
        name,
        i: Names.nameBases.length,
        min: +min,
        max: +max,
        d,
        m: +m,
        b: names
      });
    } catch (e) {
      errors.push({ id: index + 1, line, error: (e as Error).message });
      log.error(e);
    }
  });
  Names.reindex();

  if (errors.length > 0) {
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
            added: lines.length - errors.length,
            total: lines.length
          })}</strong>
          ${t("Each namebase should be on its own line and follow the format: id|name|min|max|duplication|m|names. Files without the id column are still accepted; ids are then derived from the name. Parameters should be separated with the | character, and this character should not be used within the parameters. Another prohibited character is /. The most common issue is names and other parameters being on two separate lines.")}
          <ul style="margin:0.5em;">
            <li><code>id</code>: ${t("stable identity of the base, five uppercase letters. It stays the same when the base is renamed.")}</li>
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

  createBasesList();
  updateInputs();
}

const unsafe = /[|/]/g;

interface ParseError {
  id: number;
  line: string;
  error: string;
}

export const NamesbaseEditor = { open };
