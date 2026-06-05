import { convertTemperature, ensureEl, list } from "../utils";

type ParamType = "none" | "number" | "biomes" | "shore" | "featureType";

interface FnDef {
  id: string;
  label: string;
  paramType: ParamType;
  paramLabel?: string;
  defaultVal?: string;
  description: string;
  note?: string;
}

interface DistCondition {
  fnId: string;
  negate: boolean;
  biomeIds: number[];
  shoreValues: string[];
  typeValues: string[];
  numberVal: string;
}

const FN_DEFS: FnDef[] = [
  {
    id: "biome",
    label: "Biome",
    paramType: "biomes",
    description: "Cells in specific biomes"
  },
  {
    id: "minHeight",
    label: "Min Height",
    paramType: "number",
    paramLabel: "Height (0–100)",
    defaultVal: "40",
    description: "Cells at or above a height",
    note: "20: sea level, 50: highlands, 70: mountains."
  },
  {
    id: "maxHeight",
    label: "Max Height",
    paramType: "number",
    paramLabel: "Height (0–100)",
    defaultVal: "40",
    description: "Cells at or below a height",
    note: "20: sea level, 50: highlands, 70: mountains."
  },
  {
    id: "minTemp",
    label: "Min Temperature",
    paramType: "number",
    paramLabel: "Temp (°C)",
    defaultVal: "10",
    description: "Cells with average temperature at or above a value",
    note: "-18°C: polar, 18°C: tropical."
  },
  {
    id: "maxTemp",
    label: "Max Temperature",
    paramType: "number",
    paramLabel: "Temp (°C)",
    defaultVal: "5",
    description: "Cells with average temperature at or below a value",
    note: "-18°C: polar, 18°C: tropical."
  },
  {
    id: "shore",
    label: "Shore Proximity",
    paramType: "shore",
    description: "Cells by proximity to water",
    note: "-1: shallow ocean, -2: deep ocean, 1: coastal land, 2: near coast land."
  },
  {
    id: "type",
    label: "Waterbody Type",
    paramType: "featureType",
    description: "Cells by waterbody type"
  },
  {
    id: "river",
    label: "River",
    paramType: "none",
    description: "Cells that have a river flowing"
  },
  {
    id: "minHabitability",
    label: "Min Habitability",
    paramType: "number",
    paramLabel: "Habitability (0–100)",
    defaultVal: "20",
    description: "Cells where biome habitability is at or above a value"
  },
  {
    id: "habitability",
    label: "Habitability",
    paramType: "none",
    description: "Favors more habitable cells",
    note: "Higher chance in habitable biomes."
  },
  {
    id: "elevation",
    label: "Elevation",
    paramType: "none",
    description: "Favors higher elevated cells",
    note: "Higher chance at higher altitudes."
  },
  {
    id: "random",
    label: "Random Chance",
    paramType: "number",
    paramLabel: "Chance (%)",
    defaultVal: "50",
    description: "Probability to receive the good",
    note: "random(50): 50% chance per cell."
  },
  {
    id: "nth",
    label: "Every Nth Cell",
    paramType: "number",
    paramLabel: "N",
    defaultVal: "5",
    description: "Regular distribution pattern",
    note: "nth(5): 1 in 5 eligible cells."
  }
];

const SHORE_OPTIONS = [
  { value: "-2", label: "Deep Ocean" },
  { value: "-1", label: "Shallow Ocean (adjacent to land)" },
  { value: "1", label: "Coastal Land (adjacent to water)" },
  { value: "2", label: "Near Coast Land" }
];

const FEATURE_TYPE_OPTIONS = [
  { value: "ocean", label: "Ocean / Sea" },
  { value: "freshwater", label: "Freshwater Lake" },
  { value: "salt", label: "Salt Lake" },
  { value: "dry", label: "Dry Lake" },
  { value: "lava", label: "Lava Lake" },
  { value: "frozen", label: "Frozen Lake" },
  { value: "sinkhole", label: "Sinkhole" }
];

function createDefaultCondition(): DistCondition {
  return { fnId: "biome", negate: false, biomeIds: [], shoreValues: [], typeValues: [], numberVal: "" };
}

function open(onApply: (distribution: string) => void, initialExpression = "") {
  const groups: DistCondition[][] = parseExpression(initialExpression) ?? [[createDefaultCondition()]];

  function conditionToExpr(c: DistCondition): string {
    const def = FN_DEFS.find(f => f.id === c.fnId);
    if (!def) return "";
    let inner: string;
    switch (def.paramType) {
      case "none":
        inner = `${c.fnId}()`;
        break;
      case "number":
        if (!c.numberVal) return "";
        inner = `${c.fnId}(${c.numberVal})`;
        break;
      case "biomes":
        if (!c.biomeIds.length) return "";
        inner = `biome(${c.biomeIds.join(", ")})`;
        break;
      case "shore":
        if (!c.shoreValues.length) return "";
        inner = `shore(${c.shoreValues.join(", ")})`;
        break;
      case "featureType":
        if (!c.typeValues.length) return "";
        inner = `type(${c.typeValues.map(v => `"${v}"`).join(", ")})`;
        break;
      default:
        return "";
    }
    return c.negate ? `!${inner}` : inner;
  }

  function generateExpression(): string {
    const groupExprs = groups
      .map(group => {
        const parts = group.map(conditionToExpr).filter(Boolean);
        if (!parts.length) return "";
        return parts.length === 1 ? parts[0] : parts.join(" && ");
      })
      .filter(Boolean);
    if (!groupExprs.length) return "";
    if (groupExprs.length === 1) return groupExprs[0];
    return groupExprs.map(g => (g.includes(" && ") ? `(${g})` : g)).join(" || ");
  }

  const popupEl = document.createElement("div");
  document.body.appendChild(popupEl);

  function updateOutput() {
    const expr = generateExpression();
    ensureEl<HTMLInputElement>("distExprOutput").value = expr;
    ensureEl<HTMLElement>("distCellCount").textContent = countMatchingCells(expr) || "";
    ensureEl<HTMLElement>("distHumanPreview").textContent = interpretDistribution(expr);
  }

  function openBiomePicker(cond: DistCondition, onApplied: () => void) {
    const pickerEl = document.createElement("div");
    document.body.appendChild(pickerEl);

    const grid = document.createElement("div");
    grid.style.cssText =
      "display:grid; grid-template-columns:1fr 1fr; gap:3px 16px; padding:2px 0; max-height:260px; overflow-y:auto;";

    const entries: { id: number; cb: HTMLInputElement }[] = [];
    (biomesData.i as number[]).forEach((id: number) => {
      const label = document.createElement("label");
      label.style.cssText = "display:flex; align-items:center; gap:5px; cursor:pointer;";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "native";
      cb.checked = cond.biomeIds.includes(id);
      entries.push({ id, cb });
      const dot = document.createElement("span");
      dot.style.cssText = `display:inline-block; width:.7em; height:.7em; border-radius:50%;
        flex-shrink:0; border:1px solid rgba(0,0,0,.15); background:${biomesData.color[id] || "#ccc"};`;
      label.appendChild(cb);
      label.appendChild(dot);
      label.appendChild(document.createTextNode(biomesData.name[id] || `Biome ${id}`));
      grid.appendChild(label);
    });
    pickerEl.appendChild(grid);

    $(pickerEl).dialog({
      title: "Select Biomes",
      width: "34em",
      resizable: false,
      buttons: {
        Cancel: function () {
          $(this).dialog("close");
        },
        Apply: function () {
          cond.biomeIds = entries.filter(e => e.cb.checked).map(e => e.id);
          onApplied();
          $(this).dialog("close");
        }
      },
      close: () => {
        $(pickerEl).dialog("destroy");
        pickerEl.remove();
      }
    });
  }

  function openFeatureTypePicker(cond: DistCondition, onApplied: () => void) {
    const pickerEl = document.createElement("div");
    document.body.appendChild(pickerEl);

    const list = document.createElement("div");
    list.style.cssText = "display:flex; flex-direction:column; gap:5px; padding:2px 0;";

    const entries: { value: string; cb: HTMLInputElement }[] = [];
    FEATURE_TYPE_OPTIONS.forEach(opt => {
      const label = document.createElement("label");
      label.style.cssText = "display:flex; align-items:center; gap:6px; cursor:pointer;";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "native";
      cb.checked = cond.typeValues.includes(opt.value);
      entries.push({ value: opt.value, cb });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(opt.label));
      list.appendChild(label);
    });
    pickerEl.appendChild(list);

    $(pickerEl).dialog({
      title: "Select Feature Types",
      width: "18em",
      resizable: false,
      buttons: {
        Cancel: function () {
          $(this).dialog("close");
        },
        Apply: function () {
          cond.typeValues = entries.filter(e => e.cb.checked).map(e => e.value);
          onApplied();
          $(this).dialog("close");
        }
      },
      close: () => {
        $(pickerEl).dialog("destroy");
        pickerEl.remove();
      }
    });
  }

  function openShorePicker(cond: DistCondition, onApplied: () => void) {
    const pickerEl = document.createElement("div");
    document.body.appendChild(pickerEl);

    const list = document.createElement("div");
    list.style.cssText = "display:flex; flex-direction:column; gap:5px; padding:2px 0;";

    const entries: { value: string; cb: HTMLInputElement }[] = [];
    SHORE_OPTIONS.forEach(opt => {
      const label = document.createElement("label");
      label.style.cssText = "display:flex; align-items:center; gap:6px; cursor:pointer;";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "native";
      cb.checked = cond.shoreValues.includes(opt.value);
      entries.push({ value: opt.value, cb });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(opt.label));
      list.appendChild(label);
    });
    pickerEl.appendChild(list);

    $(pickerEl).dialog({
      title: "Select Shore Proximity",
      width: "18em",
      resizable: false,
      buttons: {
        Cancel: function () {
          $(this).dialog("close");
        },
        Apply: function () {
          cond.shoreValues = entries.filter(e => e.cb.checked).map(e => e.value);
          onApplied();
          $(this).dialog("close");
        }
      },
      close: () => {
        $(pickerEl).dialog("destroy");
        pickerEl.remove();
      }
    });
  }

  function buildParamsArea(cond: DistCondition): HTMLElement {
    const container = document.createElement("div");
    container.className = "ded-params";
    const def = FN_DEFS.find(f => f.id === cond.fnId)!;

    if (def.paramType === "none") {
      const span = document.createElement("span");
      span.className = "ded-no-params";
      span.textContent = "no parameters";
      container.appendChild(span);
    } else if (def.paramType === "number") {
      const wrap = document.createElement("div");
      wrap.className = "ded-num-wrap";
      const input = document.createElement("input");
      input.type = "number";
      input.value = cond.numberVal;
      input.placeholder = def.paramLabel || "value";
      input.className = "ded-num-input";
      input.addEventListener("input", () => {
        cond.numberVal = input.value;
        updateOutput();
      });
      const lbl = document.createElement("span");
      lbl.className = "ded-num-label";
      lbl.textContent = def.paramLabel || "";
      wrap.appendChild(input);
      wrap.appendChild(lbl);
      container.appendChild(wrap);
    } else if (def.paramType === "biomes") {
      const summary = document.createElement("span");
      summary.className = "ded-picker-summary";
      const refreshBiomeSummary = () => {
        summary.textContent = cond.biomeIds.length
          ? cond.biomeIds.map(id => biomesData.name[id] || `Biome ${id}`).join(", ")
          : "none";
      };
      refreshBiomeSummary();
      const editBtn = document.createElement("button");
      editBtn.className = "icon-pencil ded-row-edit-btn";
      editBtn.title = "Select biomes";
      editBtn.addEventListener("click", () =>
        openBiomePicker(cond, () => {
          refreshBiomeSummary();
          updateOutput();
        })
      );
      const row = document.createElement("div");
      row.className = "ded-picker-row";
      row.appendChild(summary);
      row.appendChild(editBtn);
      container.appendChild(row);
    } else if (def.paramType === "shore") {
      const summary = document.createElement("span");
      summary.className = "ded-picker-summary";
      const refreshShoreSummary = () => {
        if (!cond.shoreValues.length) {
          summary.textContent = "none";
        } else {
          const LABELS: Record<string, string> = {
            "-2": "Deep Ocean",
            "-1": "Shallow Ocean",
            "1": "Coastal Land",
            "2": "Near Coast"
          };
          summary.textContent = cond.shoreValues.map(v => LABELS[v] ?? v).join(", ");
        }
      };
      refreshShoreSummary();
      const editBtn = document.createElement("button");
      editBtn.className = "icon-pencil ded-row-edit-btn";
      editBtn.title = "Select shore proximity";
      editBtn.addEventListener("click", () =>
        openShorePicker(cond, () => {
          refreshShoreSummary();
          updateOutput();
        })
      );
      const row = document.createElement("div");
      row.className = "ded-picker-row";
      row.appendChild(summary);
      row.appendChild(editBtn);
      container.appendChild(row);
    } else if (def.paramType === "featureType") {
      const summary = document.createElement("span");
      summary.className = "ded-picker-summary";
      const refreshTypeSummary = () => {
        summary.textContent = cond.typeValues.length ? cond.typeValues.join(", ") : "none";
      };
      refreshTypeSummary();
      const editBtn = document.createElement("button");
      editBtn.className = "icon-pencil ded-row-edit-btn";
      editBtn.title = "Select feature types";
      editBtn.addEventListener("click", () =>
        openFeatureTypePicker(cond, () => {
          refreshTypeSummary();
          updateOutput();
        })
      );
      const row = document.createElement("div");
      row.className = "ded-picker-row";
      row.appendChild(summary);
      row.appendChild(editBtn);
      container.appendChild(row);
    }

    return container;
  }

  function buildConditionRow(cond: DistCondition, groupIdx: number, condIdx: number): HTMLElement {
    const row = document.createElement("div");
    row.className = "ded-cond-row";

    const notLabel = document.createElement("label");
    notLabel.className = "ded-not-label";
    const notCb = document.createElement("input");
    notCb.type = "checkbox";
    notCb.className = "native";
    notCb.checked = cond.negate;
    notCb.title = "Negate — match cells where this condition is FALSE";
    notCb.addEventListener("change", () => {
      cond.negate = notCb.checked;
      updateOutput();
    });
    notLabel.appendChild(notCb);
    notLabel.appendChild(document.createTextNode("NOT"));
    row.appendChild(notLabel);

    const fnSel = document.createElement("select");
    fnSel.className = "ded-fn-sel";
    FN_DEFS.forEach(def => {
      const opt = document.createElement("option");
      opt.value = def.id;
      opt.textContent = def.label;
      opt.selected = def.id === cond.fnId;
      fnSel.appendChild(opt);
    });

    let paramsArea = buildParamsArea(cond);
    row.appendChild(fnSel);
    row.appendChild(paramsArea);

    fnSel.addEventListener("change", () => {
      cond.fnId = fnSel.value;
      cond.biomeIds = [];
      cond.shoreValues = [];
      cond.typeValues = [];
      const newDef = FN_DEFS.find(f => f.id === cond.fnId);
      cond.numberVal = newDef?.defaultVal ?? "";
      const newParamsArea = buildParamsArea(cond);
      row.replaceChild(newParamsArea, paramsArea);
      paramsArea = newParamsArea;
      updateOutput();
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = "icon-trash-empty ded-remove-btn";
    removeBtn.title = "Remove this condition";
    removeBtn.addEventListener("click", () => {
      groups[groupIdx].splice(condIdx, 1);
      if (!groups[groupIdx].length) {
        groups.splice(groupIdx, 1);
        if (!groups.length) groups.push([createDefaultCondition()]);
      }
      renderGroupList();
      updateOutput();
    });
    row.appendChild(removeBtn);

    return row;
  }

  function renderGroupList() {
    const groupList = ensureEl<HTMLElement>("distGroupList")!;
    groupList.innerHTML = "";

    groups.forEach((group, groupIdx) => {
      if (groupIdx > 0) {
        const orSep = document.createElement("div");
        orSep.className = "ded-or-sep";
        orSep.textContent = "— OR —";
        groupList.appendChild(orSep);
      }

      const groupBox = document.createElement("div");
      groupBox.className = "ded-group";

      group.forEach((cond, condIdx) => {
        if (condIdx > 0) {
          const andLabel = document.createElement("div");
          andLabel.className = "ded-and-label";
          andLabel.textContent = "AND";
          groupBox.appendChild(andLabel);
        }
        groupBox.appendChild(buildConditionRow(cond, groupIdx, condIdx));
      });

      const footer = document.createElement("div");
      footer.className = "ded-group-footer";

      const addCondBtn = document.createElement("button");
      addCondBtn.textContent = "+ Add condition";
      addCondBtn.addEventListener("click", () => {
        group.push(createDefaultCondition());
        renderGroupList();
        updateOutput();
      });
      footer.appendChild(addCondBtn);

      if (groups.length > 1) {
        const removeGroupBtn = document.createElement("button");
        removeGroupBtn.className = "icon-trash-empty";
        removeGroupBtn.addEventListener("click", () => {
          groups.splice(groupIdx, 1);
          if (!groups.length) groups.push([createDefaultCondition()]);
          renderGroupList();
          updateOutput();
        });
        footer.appendChild(removeGroupBtn);
      }

      groupBox.appendChild(footer);
      groupList.appendChild(groupBox);
    });
  }

  // ---- reference panel ----------------------------------------------------

  const refHtml = FN_DEFS.map(def => {
    const paramSig =
      def.paramType === "none"
        ? ""
        : def.paramType === "biomes"
          ? "id, ..."
          : def.paramType === "shore"
            ? "ring, ..."
            : def.paramType === "featureType"
              ? '"type", ...'
              : "value";
    return /*html*/ `
      <div class="ded-ref-card">
        <code class="ded-ref-code">${def.id}(${paramSig})</code>
        <div class="ded-ref-desc">${def.description}</div>
        ${def.note ? `<div class="ded-ref-note">${def.note}</div>` : ""}
      </div>`;
  }).join("");

  popupEl.innerHTML = /*html*/ `
    <style>
      .ded-wrap            { display:flex; flex-direction:column; gap:8px; height: 60vh; }
      .ded-info            { border:1px solid var(--dark-solid); padding:6px 10px; border-radius:3px; }
      .ded-body            { display:flex; gap:12px; flex:1; overflow:hidden; }

      .ded-builder         { flex:1; display:flex; flex-direction:column; gap:6px; overflow:hidden; min-width:0; }
      .ded-group-footer    { display:flex; justify-content: space-between; margin-top: 6px; }
      .ded-group-list      { flex:1; overflow-y:auto; padding-right:4px; }
      .ded-group           { border:1px solid var(--light-solid); border-radius:4px; padding:6px 8px 8px; margin-bottom:2px; }
      .ded-group-label     { font-weight:bold; color:var(--dark-solid); }
      .ded-or-sep          { text-align:center; font-weight:bold; color:#555; padding:3px 0; letter-spacing:.05em; }
      .ded-and-label       { font-weight:bold; color:#555; padding:3px 0 3px 4px; }
      .ded-cond-row        { display:flex; align-items:flex-start; gap:6px; padding:5px 7px; border:1px solid #d0d0d0; border-radius:3px; }
      .ded-not-label       { display: flex; align-items: center; cursor: pointer; }
      .ded-fn-sel          { flex-shrink:0; min-width:7em; }
      .ded-params          { flex:1; display:flex; flex-direction:column; gap:3px; min-width:12em; }
      .ded-no-params       { color:#aaa; font-style:italic; padding-top:3px; }
      .ded-num-wrap        { display:flex; align-items:center; gap:5px; }
      .ded-num-input       { width:5.5em; }
      .ded-num-label       { color:#555; }
      .ded-picker-row      { display:flex; align-items:center; gap:4px; }
      .ded-row-edit-btn    { align-self:flex-start; }
      .ded-picker-summary  { flex:1; color:#555; }
      .ded-check-label     { display:flex; align-items:center; gap:4px; line-height:1.5; }
      .ded-remove-btn      { flex-shrink:0; align-self:flex-start; }
      .ded-add-or-btn      { align-self:flex-start; }

      .ded-output          { display:flex; align-items:center; gap:6px; flex-shrink:0; padding-top:6px; border-top:1px solid #e0e0e0; }
      .ded-output-label    { font-weight:bold; color:#555; margin-bottom:3px; }
      .ded-output-row      { display:flex; align-items:center; gap:6px; }
      .ded-expr-input      { flex:1; font-family:monospace; min-width:16em; }
      .ded-cell-count      { color:#555; white-space:nowrap; flex-shrink:0; min-width:9em; text-align:right; }
      .ded-human-preview   { color:#555; min-height:1.2em; margin-top:3px; }

      .ded-ref             { width:16em; flex-shrink:0; border-left:1px solid var(--light-solid); padding-left:10px; overflow-y:auto; }
      .ded-ref-title       { font-weight:bold; color:var(--dark-solid); margin-bottom:5px; position:sticky; top:0; padding-bottom:4px; border-bottom:1px solid #e8e8e8; }
      .ded-ref-card        { margin-bottom:7px; padding:5px 7px; border:1px solid #e4e4e4; border-radius:3px; }
      .ded-ref-code        { color:var(--dark-solid); font-weight:bold; }
      .ded-ref-desc        { color:#555; margin-top:2px; }
      .ded-ref-note        { color:#555; margin-top:2px; font-style:italic; }
    </style>

    <div class="ded-wrap">
      <div class="ded-info">
        Distribution controls where this raw good spawns. Leave empty for manufactured-only goods.
      </div>
      <div class="ded-body">
        <div class="ded-builder">
          <div id="distGroupList" class="ded-group-list"></div>
          <button id="distAddGroup" class="ded-add-or-btn">+ Add OR group</button>
          <div class="ded-output">
            <div class="ded-output-label">Distribution</div>
            <div class="ded-output-row">
              <input id="distExprOutput" class="ded-expr-input" readonly value="" />
              <span id="distCellCount" class="ded-cell-count">0 cells (0%)</span>
            </div>
          </div>
          <div id="distHumanPreview" class="ded-human-preview"></div>
        </div>
        <div class="ded-ref">
          <div class="ded-ref-title">Function Reference</div>
          ${refHtml}
        </div>
      </div>
    </div>
  `;

  renderGroupList();
  updateOutput();

  ensureEl<HTMLButtonElement>("distAddGroup").on("click", () => {
    groups.push([createDefaultCondition()]);
    renderGroupList();
    updateOutput();
  });

  $(popupEl).dialog({
    title: "Distribution Editor",
    width: "60em",
    resizable: true,
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      Apply: function () {
        const expr = generateExpression();
        onApply(expr);
        $(this).dialog("close");
      }
    },
    close: () => {
      $(popupEl).dialog("destroy");
      popupEl.remove();
    }
  });
}

function splitTopLevel(expr: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === "(") depth++;
    else if (expr[i] === ")") depth--;
    else if (depth === 0 && expr.startsWith(sep, i)) {
      parts.push(expr.slice(start, i).trim());
      i += sep.length - 1;
      start = i + 1;
    }
  }
  parts.push(expr.slice(start).trim());
  return parts.filter(Boolean);
}

function stripOuterParens(s: string): string {
  if (!s.startsWith("(") || !s.endsWith(")")) return s;
  let depth = 0;
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") {
      if (--depth === 0) return s; // closing paren found before the last char — don't strip
    }
  }
  return s.slice(1, -1).trim();
}

function parseConditionStr(s: string): DistCondition | null {
  let rest = s.trim();
  let negate = false;
  if (rest.startsWith("!")) {
    negate = true;
    rest = rest.slice(1).trim();
  }

  const m = rest.match(/^(\w+)\(([^)]*)\)$/);
  if (!m) return null;
  const [, fnId, rawArgs] = m;
  if (!FN_DEFS.find(f => f.id === fnId)) return null;

  const cond = createDefaultCondition();
  cond.fnId = fnId;
  cond.negate = negate;

  const args = rawArgs
    .split(",")
    .map(a => a.trim())
    .filter(Boolean);
  const def = FN_DEFS.find(f => f.id === fnId)!;

  switch (def.paramType) {
    case "number":
      cond.numberVal = args[0] ?? "";
      break;
    case "biomes":
      cond.biomeIds = args.map(Number).filter(n => !Number.isNaN(n));
      break;
    case "shore":
      cond.shoreValues = args;
      break;
    case "featureType":
      cond.typeValues = args.map(a => a.replace(/['"]/g, ""));
      break;
    case "none":
      break;
  }
  return cond;
}

function parseExpression(expr: string): DistCondition[][] | null {
  if (!expr) return null;

  const groups: DistCondition[][] = [];
  for (const orPart of splitTopLevel(expr, " || ")) {
    const groupStr = stripOuterParens(orPart.trim());
    const group: DistCondition[] = [];
    for (const andPart of splitTopLevel(groupStr, " && ")) {
      const cond = parseConditionStr(andPart.trim());
      if (!cond) return null; // unparseable
      group.push(cond);
    }
    if (group.length) groups.push(group);
  }
  return groups.length ? groups : null;
}

function interpretDistribution(dist: string): string {
  if (!dist) return "";

  return dist
    .replace(/biome\(([^)]+)\)/g, (_, args) => {
      const names = args.split(",").map((a: string) => biomesData.name[parseInt(a.trim(), 10)]);
      return names.length === 1 ? names[0] : `${list(names)}`;
    })
    .replace(/minHeight\((-?\d+(?:\.\d+)?)\)/g, (_, h) => `min height ${getHeight(+h)}`)
    .replace(/maxHeight\((-?\d+(?:\.\d+)?)\)/g, (_, h) => `max height ${getHeight(+h)}`)
    .replace(/minTemp\((-?\d+(?:\.\d+)?)\)/g, (_, t) => `min temp ${convertTemperature(+t)}`)
    .replace(/maxTemp\((-?\d+(?:\.\d+)?)\)/g, (_, t) => `max temp ${convertTemperature(+t)}`)
    .replace(/shore\(([^)]+)\)/g, (_, args) =>
      args
        .split(",")
        .map((a: string) => SHORE_OPTIONS.find(opt => opt.value === a.trim())?.label || a.trim())
        .join("/")
    )
    .replace(/type\(([^)]+)\)/g, (_, args) => {
      const types = args
        .replace(/["']/g, "")
        .split(",")
        .map((a: string) => a.trim());
      return `type: ${types.join("/")}`;
    })
    .replace(/river\(\)/g, "river presence")
    .replace(/minHabitability\((\d+)\)/g, (_, n) => `habitability ≥ ${n}%`)
    .replace(/habitability\(\)/g, "more habitable areas")
    .replace(/elevation\(\)/g, "more elevated areas")
    .replace(/nth\((\d+)\)/g, (_, n) => `1 in ${n} cells`)
    .replace(/random\((\d+)\)/g, (_, n) => `${n}% chance`)
    .replace(/\s*&&\s*/g, " AND ")
    .replace(/\s*\|\|\s*/g, " OR ")
    .replace(/!\s*/g, "NOT ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMatchingCells(distribution: string): string {
  if (!distribution) return "";
  let cells = 0;

  try {
    const methods = Goods.getMethods();
    const allMethods = `{${Object.keys(methods).join(", ")}}`;
    const spread = new Function(allMethods, `return ${distribution}`);
    for (const cellId of pack.cells.i) {
      const eligible = spread(Goods.getMethods(cellId));
      if (eligible) cells++;
    }
  } catch {
    return "invalid";
  }

  return `${cells.toLocaleString()} cells (${rn((cells / pack.cells.i.length) * 100, 1)}%)`;
}

export const DistributionEditor = { open };
