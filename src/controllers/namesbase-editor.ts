import { max as d3max, min as d3min, mean, median } from "d3";
import { ensureEl, openURL, rn, unique } from "../utils";

addListeners();

export function open(): void {
  if (customization) return;
  closeDialogs("#namesbaseEditor, .stable");

  createBasesList();
  updateInputs();

  $("#namesbaseEditor").dialog({
    title: "Namesbase Editor",
    width: "60vw",
    position: { my: "center", at: "center", of: "svg" }
  });
}

function addListeners(): void {
  const uploader = ensureEl<HTMLInputElement>("namesbaseToLoad");

  ensureEl("namesbaseSelect").on("change", updateInputs);
  ensureEl("namesbaseTextarea").on("change", updateNamesData);
  ensureEl("namesbaseUpdateExamples").on("click", updateExamples);
  ensureEl("namesbaseExamples").on("click", updateExamples);
  ensureEl("namesbaseName").on("input", e => updateBaseName((e.target as HTMLInputElement).value));
  ensureEl("namesbaseMin").on("input", e => updateBaseMin((e.target as HTMLInputElement).value));
  ensureEl("namesbaseMax").on("input", e => updateBaseMax((e.target as HTMLInputElement).value));
  ensureEl("namesbaseDouble").on("input", e => updateBaseDuplication((e.target as HTMLInputElement).value));
  ensureEl("namesbaseAdd").on("click", namesbaseAdd);
  ensureEl("namesbaseAnalyze").on("click", analyzeNamesbase);
  ensureEl("namesbaseDefault").on("click", namesbaseRestoreDefault);
  ensureEl("namesbaseDownload").on("click", namesbaseDownload);
  ensureEl("namesbaseUpload").on("click", () => {
    uploader.on("change", e => uploadFile(e.target as HTMLInputElement, d => namesbaseUpload(d, true)), { once: true });
    uploader.click();
  });
  ensureEl("namesbaseUploadExtend").on("click", () => {
    uploader.on("change", e => uploadFile(e.target as HTMLInputElement, d => namesbaseUpload(d, false)), {
      once: true
    });
    uploader.click();
  });
  ensureEl("namesbaseCA").on("click", () =>
    openURL("https://cartographyassets.com/asset-category/specific-assets/azgaars-generator/namebases/")
  );
  ensureEl("namesbaseSpeak").on("click", () => speak(ensureEl("namesbaseExamples").textContent ?? ""));
}

function createBasesList(): void {
  const select = ensureEl<HTMLSelectElement>("namesbaseSelect");
  select.innerHTML = "";
  nameBases.forEach((b, i) => {
    select.options.add(new Option(b.name, String(i)));
  });
}

function updateInputs(): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  if (!nameBases[base]) {
    tip(`Namesbase ${base} is not defined`, false, "error");
    return;
  }
  (ensureEl("namesbaseTextarea") as HTMLTextAreaElement).value = nameBases[base].b;
  (ensureEl("namesbaseName") as HTMLInputElement).value = nameBases[base].name;
  (ensureEl("namesbaseMin") as HTMLInputElement).value = String(nameBases[base].min);
  (ensureEl("namesbaseMax") as HTMLInputElement).value = String(nameBases[base].max);
  (ensureEl("namesbaseDouble") as HTMLInputElement).value = nameBases[base].d;
  updateExamples();
}

function updateExamples(): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  let examples = "";
  for (let i = 0; i < 7; i++) {
    const example = Names.getBase(base);
    if (example === undefined) {
      examples = "Cannot generate examples. Please verify the data";
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
    tip("The names data provided is too short or incorrect", false, "error");
    return;
  }
  const securedNamesData = input.value.replace(/[/|]/g, "");
  nameBases[base].b = securedNamesData;
  input.value = securedNamesData;
  Names.updateChain(base);
}

function updateBaseName(rawName: string): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  const select = ensureEl<HTMLSelectElement>("namesbaseSelect");
  const name = rawName.replace(/[/|]/g, "");
  select.options[select.selectedIndex].innerHTML = name;
  nameBases[base].name = name;
}

function updateBaseMin(value: string): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  if (+value > nameBases[base].max) {
    tip("Minimal length cannot be greater than maximal", false, "error");
    return;
  }
  nameBases[base].min = +value;
}

function updateBaseMax(value: string): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  if (+value < nameBases[base].min) {
    tip("Maximal length should be greater than minimal", false, "error");
    return;
  }
  nameBases[base].max = +value;
}

function updateBaseDuplication(value: string): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  nameBases[base].d = value;
}

function analyzeNamesbase(): void {
  const namesSourceString = (ensureEl("namesbaseTextarea") as HTMLTextAreaElement).value;
  const namesArray = namesSourceString.toLowerCase().split(",");
  const length = namesArray.length;
  if (!namesSourceString || !length) {
    tip("Names data should not be empty", false, "error");
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
      return "<span data-tip='Namesbase contains < 30 names - not enough to generate reasonable data' style='color:red'>[not enough]</span>";
    if (length < 100)
      return "<span data-tip='Namesbase contains < 100 names - not enough to generate good names' style='color:darkred'>[low]</span>";
    if (length <= 400)
      return "<span data-tip='Namesbase contains a reasonable number of samples' style='color:green'>[good]</span>";
    return "<span data-tip='Namesbase contains > 400 names. That is too much, try to reduce it to ~300 names' style='color:darkred'>[overmuch]</span>";
  };

  const getVarietyLevel = (): string => {
    if (variety < 15)
      return "<span data-tip='Namesbase average variety < 15 - generated names will be too repetitive' style='color:red'>[low]</span>";
    if (variety < 30)
      return "<span data-tip='Namesbase average variety < 30 - names can be too repetitive' style='color:orange'>[mean]</span>";
    return "<span data-tip='Namesbase variety is good' style='color:green'>[good]</span>";
  };

  alertMessage.innerHTML = /* html */ `<div style="line-height: 1.6em; max-width: 20em">
      <div data-tip="Number of names provided">Namesbase length: ${length} ${getLengthQuality()}</div>
      <div data-tip="Average number of generation variants for each key in the chain">Namesbase variety: ${variety} ${getVarietyLevel()}</div>
      <hr />
      <div data-tip="The shortest name length">Min name length: ${d3min(wordsLength)}</div>
      <div data-tip="The longest name length">Max name length: ${d3max(wordsLength)}</div>
      <div data-tip="Average name length">Mean name length: ${rn(mean(wordsLength) ?? 0, 1)}</div>
      <div data-tip="Common name length">Median name length: ${median(wordsLength)}</div>
      <hr />
      <div data-tip="Characters outside of Basic Latin have bad font support">Non-basic chars: ${nonBasicLatinChars}</div>
      <div data-tip="Characters that are frequently (more than 3 times) doubled">Doubled chars: ${doubledStr}</div>
      <div data-tip="Names used more than one time">Duplicates: ${duplicates}</div>
      <div data-tip="Percentage of names containing space character">Multi-word names: ${rn(multiwordRate * 100, 2)}%</div>
    </div>`;

  $("#alert").dialog({
    resizable: false,
    title: "Data Analysis",
    width: "auto",
    position: { my: "left top-30", at: "right+10 top", of: "#namesbaseEditor" },
    buttons: {
      OK: function () {
        $(this).dialog("close");
      }
    }
  });
}

function namesbaseAdd(): void {
  const baseId = nameBases.length;
  const b =
    "This,is,an,example,of,name,base,showing,correct,format,It,should,have,at,least,one,hundred,names,separated,with,comma";
  nameBases.push({
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
  ensureEl("namesbaseExamples").innerHTML = "Please provide names data";
}

function namesbaseRestoreDefault(): void {
  alertMessage.innerHTML = /* html */ `Are you sure you want to restore default namesbase?`;
  $("#alert").dialog({
    resizable: false,
    title: "Restore default data",
    buttons: {
      Restore: function () {
        $(this).dialog("close");
        Names.clearChains();
        nameBases = Names.getNameBases();
        createBasesList();
        updateInputs();
      },
      Cancel: function () {
        $(this).dialog("close");
      }
    }
  });
}

function namesbaseDownload(): void {
  const data = nameBases.map(b => `${b.name}|${b.min}|${b.max}|${b.d}|${b.m}|${b.b}`).join("\r\n");
  const name = `${getFileName("Namesbase")}.txt`;
  downloadFile(data, name);
}

function namesbaseUpload(dataLoaded: string, override = true): void {
  const lines = dataLoaded
    .replace(/\r\n|\r/g, "\n")
    .split("\n")
    .filter(Boolean);
  if (!lines.length) {
    tip("Cannot load a namesbase. Please check the data format", false, "error");
    return;
  }

  Names.clearChains();
  if (override) nameBases = [];

  const errors: ParseError[] = [];
  lines.forEach((line, index) => {
    try {
      const [rawName, min, max, d, m, rawNames] = line.split("|");
      const name = rawName?.replace(unsafe, "");
      if (!name) throw new Error("Name is missing");
      const names = rawNames?.replace(unsafe, "");
      if (!names) throw new Error("Names are missing");
      nameBases.push({
        name,
        i: nameBases.length,
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
              Line ${id}:
              <span style="color:#8b0000">${escapeHtml(error)}.</span> Data:
            </div>
            <div style="margin-top:0.35em;font-family:var(--font-monospace,monospace);font-size:0.95em;line-height:1.4;word-break:break-word;color:#333;">
              ${escapeHtml(line) || "<empty line>"}
            </div>
          </li>`
      )
      .join("");

    alertMessage.innerHTML = /* html */ `<div>
        <p style="margin:0.75em;">
          <strong>File parsing error. Only ${lines.length - errors.length} out of ${lines.length} namebases added.</strong>
          Each namebase should be on its own line and follow the format: <code>name|min|max|duplication|m|names</code>. Parameters should be separated with the <code>|</code> character, and this character should not be used within the parameters. Another prohibited character is <code>/</code>. The most common issue is names and other parameters being on two separate lines.
          <ul style="margin:0.5em;">
            <li><code>name</code>: name of the base.</li>
            <li><code>min</code>: minimal recommended length of generated names. It should be a number.</li>
            <li><code>max</code>: maximal recommended length of generated names. It should be a number greater than minimal length.</li>
            <li><code>duplication</code>: characters that can be duplicated in generated names. For example <code>lkd</code> means names like "Kalla", "Mikkor", "Dalddur" are possible. This parameter can be empty.</li>
            <li><code>m</code>: unused parameter, populate with <code>0</code>.</li>
            <li><code>names</code>: names data, separated with commas. It should contain at least 3 names to be valid.</li>
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
      title: "Parsing error",
      width: "min(72vw, 68em)",
      position: { my: "center center-4em", at: "center", of: "svg" },
      buttons: {
        Continue: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  createBasesList();
  updateInputs();
}

const unsafe = /[|/]/g;

const escapeHtml = (str: string): string =>
  str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

interface ParseError {
  id: number;
  line: string;
  error: string;
}

declare global {
  interface Window {
    NamesbaseEditor: { open: () => void };
  }
}

window.NamesbaseEditor = { open };
