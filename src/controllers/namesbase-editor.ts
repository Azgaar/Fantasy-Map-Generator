import { max as d3max, min as d3min, mean, median } from "d3";
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { downloadFile, escapeHtml, getFileName, speak, uploadFile } from "@/utils";
import { sentences, t } from "@/utils/i18n";
import { createFileInput, ensureEl, openURL, rn, unique } from "../utils";

let namesbaseInput: HTMLInputElement | null = null;

function open(): void {
  if (customization) return;
  closeDialogs("#namesbaseEditor, .stable");

  renderDialog();
  createBasesList();
  updateInputs();

  $("#namesbaseEditor").dialog({
    title: t("Namesbase Editor"),
    width: "60vw",
    position: { my: "center", at: "center", of: "svg" },
    close: closeNamesbaseEditor
  });
}

function renderDialog(): void {
  destroyDialog("namesbaseEditor");
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
        <button id="namesbaseAdd" data-tip="${t("Add new namesbase")}" class="icon-plus"></button>
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
  $("#namesbaseEditor").dialog("destroy");
  ensureEl("namesbaseEditor").remove();
}

function createBasesList(): void {
  const select = ensureEl<HTMLSelectElement>("namesbaseSelect");
  select.innerHTML = "";
  Names.nameBases.forEach((b, i) => {
    select.options.add(new Option(b.name, String(i)));
  });
}

function updateInputs(): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  if (!Names.nameBases[base]) {
    tip(t("Namesbase {{base}} is not defined", { base }), false, "error");
    return;
  }
  (ensureEl("namesbaseTextarea") as HTMLTextAreaElement).value = Names.nameBases[base].b;
  (ensureEl("namesbaseName") as HTMLInputElement).value = Names.nameBases[base].name;
  (ensureEl("namesbaseMin") as HTMLInputElement).value = String(Names.nameBases[base].min);
  (ensureEl("namesbaseMax") as HTMLInputElement).value = String(Names.nameBases[base].max);
  (ensureEl("namesbaseDouble") as HTMLInputElement).value = Names.nameBases[base].d;
  updateExamples();
}

function updateExamples(): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  let examples = "";
  for (let i = 0; i < 7; i++) {
    const example = Names.getBase(base);
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
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  const input = ensureEl<HTMLTextAreaElement>("namesbaseTextarea");
  if (input.value.split(",").length < 3) {
    tip(t("The names data provided is too short or incorrect"), false, "error");
    return;
  }
  const securedNamesData = input.value.replace(/[/|]/g, "");
  Names.nameBases[base].b = securedNamesData;
  input.value = securedNamesData;
  Names.updateChain(base);
}

function updateBaseName(rawName: string): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  const select = ensureEl<HTMLSelectElement>("namesbaseSelect");
  const name = rawName.replace(/[/|]/g, "");
  select.options[select.selectedIndex].innerHTML = name;
  Names.nameBases[base].name = name;
}

function updateBaseMin(value: string): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  if (+value > Names.nameBases[base].max) {
    tip(t("Minimal length cannot be greater than maximal"), false, "error");
    return;
  }
  Names.nameBases[base].min = +value;
}

function updateBaseMax(value: string): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  if (+value < Names.nameBases[base].min) {
    tip(t("Maximal length should be greater than minimal"), false, "error");
    return;
  }
  Names.nameBases[base].max = +value;
}

function updateBaseDuplication(value: string): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  Names.nameBases[base].d = value;
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

  alertMessage.innerHTML = /* html */ `<div style="line-height: 1.6em; max-width: 20em">
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
    </div>`;

  $("#alert").dialog({
    resizable: false,
    title: t("Data Analysis"),
    width: "auto",
    position: { my: "left top-30", at: "right+10 top", of: "#namesbaseEditor" },
    buttons: {
      [t("OK")]: function () {
        $(this).dialog("close");
      }
    }
  });
}

function namesbaseAdd(): void {
  const baseId = Names.nameBases.length;
  const b =
    "This,is,an,example,of,name,base,showing,correct,format,It,should,have,at,least,one,hundred,names,separated,with,comma";
  Names.nameBases.push({
    name: `Base${baseId}`,
    i: baseId,
    min: 5,
    max: 12,
    d: "",
    m: 0,
    b
  });
  ensureEl<HTMLSelectElement>("namesbaseSelect").add(new Option(`Base${baseId}`, String(baseId)));
  (ensureEl("namesbaseSelect") as HTMLSelectElement).value = String(baseId);
  (ensureEl("namesbaseTextarea") as HTMLTextAreaElement).value = b;
  (ensureEl("namesbaseName") as HTMLInputElement).value = `Base${baseId}`;
  (ensureEl("namesbaseMin") as HTMLInputElement).value = "5";
  (ensureEl("namesbaseMax") as HTMLInputElement).value = "12";
  (ensureEl("namesbaseDouble") as HTMLInputElement).value = "";
  ensureEl("namesbaseExamples").innerHTML = t("Please provide names data");
}

function namesbaseRestoreDefault(): void {
  alertMessage.innerHTML = /* html */ `${t("Are you sure you want to restore default namesbase?")}`;
  $("#alert").dialog({
    resizable: false,
    title: t("Restore default data"),
    buttons: {
      [t("Restore")]: function () {
        $(this).dialog("close");
        Names.clearChains();
        Names.nameBases = Names.getNameBases();
        createBasesList();
        updateInputs();
      },
      [t("Cancel")]: function () {
        $(this).dialog("close");
      }
    }
  });
}

function namesbaseDownload(): void {
  const data = Names.nameBases.map(b => `${b.name}|${b.min}|${b.max}|${b.d}|${b.m}|${b.b}`).join("\r\n");
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

  const errors: ParseError[] = [];
  lines.forEach((line, index) => {
    try {
      const [rawName, min, max, d, m, rawNames] = line.split("|");
      const name = rawName?.replace(unsafe, "");
      if (!name) throw new Error("Name is missing");
      const names = rawNames?.replace(unsafe, "");
      if (!names) throw new Error("Names are missing");
      Names.nameBases.push({
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
      ERROR && console.error(e);
    }
  });

  if (errors.length > 0) {
    ERROR && console.error("Namesbase upload errors", errors);
    const errorItems = errors
      .map(
        ({ id, line, error }) => /* html */ `<li style="padding:0.6em 0;border-top:1px solid #ddd;">
            <div>
              ${t("Line {{number}}", { number: id })}:
              <span style="color:#8b0000">${escapeHtml(error)}.</span> ${t("Data")}:
            </div>
            <div style="margin-top:0.35em;font-family:var(--font-monospace,monospace);line-height:1.4;word-break:break-word;color:#333;">
              ${escapeHtml(line) || "<empty line>"}
            </div>
          </li>`
      )
      .join("");

    alertMessage.innerHTML = /* html */ `<div>
        <p style="margin:0.75em;">
          <strong>${t("File parsing error. Only {{added}} out of {{total}} namebases added.", {
            added: lines.length - errors.length,
            total: lines.length
          })}</strong>
          ${t("Each namebase should be on its own line and follow the format: <code>name|min|max|duplication|m|names</code>. Parameters should be separated with the <code>|</code> character, and this character should not be used within the parameters. Another prohibited character is <code>/</code>. The most common issue is names and other parameters being on two separate lines.")}
          <ul style="margin:0.5em;">
            <li><code>name</code>: ${t("name of the base.")}</li>
            <li><code>min</code>: ${t("minimal recommended length of generated names. It should be a number.")}</li>
            <li><code>max</code>: ${t("maximal recommended length of generated names. It should be a number greater than minimal length.")}</li>
            <li><code>duplication</code>: ${t("characters that can be duplicated in generated names. For example <code>lkd</code> means names like “Kalla”, “Mikkor”, “Dalddur” are possible. This parameter can be empty.")}</li>
            <li><code>m</code>: ${t("unused parameter, populate with <code>0</code>.")}</li>
            <li><code>names</code>: ${t("names data, separated with commas. It should contain at least 3 names to be valid.")}</li>
          </ul>
        </p>
        <div>
          <ul style="margin:0;padding-left:1.5em;">
            ${errorItems}
          </ul>
        </div>
      </div>`;

    $("#alert").dialog({
      resizable: false,
      title: t("Parsing error"),
      width: "min(72vw, 68em)",
      position: { my: "center center-4em", at: "center", of: "svg" },
      buttons: {
        [t("Continue")]: function () {
          $(this).dialog("close");
        }
      }
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
