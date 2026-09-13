import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import {
  onPerformanceChange,
  PERFORMANCE_PRESETS,
  resolvePerformancePreset,
  type PerformanceSettings as Settings,
  setPerformanceSetting
} from "@/components/performance";
import { ensureEl } from "@/utils/nodeUtils";

const DIALOG_ID = "performanceSettings";
const DEFAULTS = PERFORMANCE_PRESETS.balance;

interface Choice {
  value: string;
  label: string;
}

interface Setting {
  key: keyof Settings;
  label: string;
  tip: string;
  choices: Choice[];
}

// one row per field of options.app.performance; the choices are the field's values, nothing derived
const SETTINGS: Setting[] = [
  {
    key: "shapeRendering",
    label: "Shape rendering",
    tip: "SVG shape-rendering hint for the map. Crisp edges drops anti-aliasing. Chromium-based browsers rasterize on the GPU and ignore the hint for speed purposes, so it makes no difference there",
    choices: [
      { value: "geometricPrecision", label: "Geometric precision" },
      { value: "auto", label: "Auto" },
      { value: "optimizeSpeed", label: "Optimize speed" },
      { value: "crispEdges", label: "Crisp edges" }
    ]
  },
  {
    key: "stateHalos",
    label: "State halos",
    tip: "Blurred glow along state borders. It is an SVG blur filter, which is costly on big maps",
    choices: [
      { value: "true", label: "Shown" },
      { value: "false", label: "Hidden" }
    ]
  },
  {
    key: "viewportRedraw",
    label: "Redraw on zoom",
    tip: "When labels, icons and relief are redrawn during a zoom or pan. 'After zoom' redraws once per gesture: faster on big maps, but new content appears all at once",
    choices: [
      { value: "continuous", label: "While zooming" },
      { value: "settled", label: "After zoom" }
    ]
  }
];

const PRESET_LABELS: Record<string, string> = {
  quality: "Quality",
  balance: "Balance",
  speed: "Speed",
  custom: "Custom"
};

function open(): void {
  closeDialogs(`#${DIALOG_ID}, .stable`);
  render();
  const unsubscribe = onPerformanceChange(sync); // a preset picked on the Options tab shows here too

  $(`#${DIALOG_ID}`).dialog({
    title: "Performance Settings",
    resizable: false,
    position: { my: "right top", at: "right-10 top+10", of: "svg" },
    close: () => {
      unsubscribe();
      destroyDialog(DIALOG_ID);
    }
  });
}

function render(): void {
  destroyDialog(DIALOG_ID);
  ensureEl("dialogs").insertAdjacentHTML("beforeend", buildDialogHTML());

  for (const { key } of SETTINGS) {
    const select = ensureEl<HTMLSelectElement>(`${DIALOG_ID}_${key}`);
    select.addEventListener("change", () => update(key, select.value));
    ensureEl(`${DIALOG_ID}_${key}Reset`).addEventListener("click", () => update(key, String(DEFAULTS[key])));
  }
}

/** A select carries strings; the field decides what the string means */
function update(key: keyof Settings, raw: string): void {
  if (key === "stateHalos") setPerformanceSetting(key, raw === "true");
  else setPerformanceSetting(key, raw as Settings[typeof key]);
}

/** The dialog is a view of options.app.performance, whoever wrote it */
function sync(): void {
  const current = options.app.performance;
  for (const { key } of SETTINGS) ensureEl<HTMLSelectElement>(`${DIALOG_ID}_${key}`).value = String(current[key]);
  ensureEl(`${DIALOG_ID}Preset`).textContent = presetLabel();
}

const presetLabel = (): string => PRESET_LABELS[resolvePerformancePreset(options.app.performance)];

function buildDialogHTML(): string {
  const current = options.app.performance;
  const rows = SETTINGS.map(({ key, label, tip, choices }) => {
    const value = String(current[key]);
    const optionsHtml = choices
      .map(
        choice => `<option value="${choice.value}" ${choice.value === value ? "selected" : ""}>${choice.label}</option>`
      )
      .join("");
    return /* html */ `
      <tr data-tip="${tip}">
        <td>${label}</td>
        <td><select id="${DIALOG_ID}_${key}" style="width: 100%">${optionsHtml}</select></td>
        <td>
          <button id="${DIALOG_ID}_${key}Reset" data-tip="Reset to the Balance preset value"
            style="font-size: .85em; padding: 1px 5px; margin-left: .3em">↺</button>
        </td>
      </tr>`;
  }).join("");

  return /* html */ `
    <div id="${DIALOG_ID}" class="dialog" style="display: none">
      <p data-tip="The preset on the Options tab these settings amount to" style="margin: 0 0 .5em">
        Preset: <b id="${DIALOG_ID}Preset">${presetLabel()}</b>
      </p>
      <table style="border-collapse: collapse; width: 100%">
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export const PerformanceSettings = { open };
