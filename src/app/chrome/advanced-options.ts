// Settings for experienced users: the Options tab binds these controls like its own, this dialog only shows them

import { regeneratePrompt } from "@/app/lifecycle";
import { SAMPLING_LABELS } from "@/data/id-labels";
import { DEFAULT_JITTER, MAX_JITTER, SAMPLINGS, type Sampling } from "@/model/graph/lattice";
import { Dialog } from "@/ui/dialog/dialog";
import { t } from "@/utils/i18n";
import { DEBUG_MODES, type DebugMode } from "@/utils/logger";

export const ADVANCED_OPTIONS_ID = "advancedOptions";

interface GraphPreset {
  label: string;
  sampling: Sampling;
  jitter: number;
}

// a regular board needs jitter 0, which a sampling alone does not make obvious
export const GRAPH_PRESETS: Record<string, GraphPreset> = {
  default: { label: t("Default"), sampling: "square", jitter: DEFAULT_JITTER },
  organicHexes: { label: t("Organic hexes"), sampling: "hexPointy", jitter: 0.5 },
  pointyHexBoard: { label: t("Hex board (pointy)"), sampling: "hexPointy", jitter: 0 },
  flatHexBoard: { label: t("Hex board (flat)"), sampling: "hexFlat", jitter: 0 },
  squareBoard: { label: t("Square board"), sampling: "square", jitter: 0 },
  isometricBoard: { label: t("Isometric board"), sampling: "diamond", jitter: 0 }
};

/** the preset the requested sampling and jitter amount to */
export function getGraphPreset({ sampling, jitter }: { sampling: Sampling; jitter: number }): string {
  const matches = ([, preset]: [string, GraphPreset]) => preset.sampling === sampling && preset.jitter === jitter;
  return Object.entries(GRAPH_PRESETS).find(matches)?.[0] ?? "custom";
}

interface Row {
  label: string;
  tip: string;
  control: string;
  icon?: string;
}

const row = ({ label, tip, control, icon = "" }: Row): string => /* html */ `
  <tr data-tip="${tip}">
    <td>${icon}</td>
    <td>${label}</td>
    <td>${control}</td>
  </tr>`;

/** a control with a small companion (a second input, a test button, a preview) in one cell */
const inline = (...parts: string[]) => `<div class="inline">${parts.join("")}</div>`;

const lock = (key: string) => `<i data-locked="0" id="lock_${key}" class="icon-lock-open"></i>`;
const slider = (key: string, attributes: string) =>
  `<slider-input id="${key}" data-option="${key}" ${attributes}></slider-input>`;

const option = (value: string, label: string, disabled = false) =>
  `<option value="${value}" ${disabled ? "disabled" : ""}>${label}</option>`;

const graphPresetOptions = () =>
  Object.entries(GRAPH_PRESETS)
    .map(([id, { label }]) => option(id, label))
    .join("") + option("custom", t("Custom"), true);

const mapRows = () =>
  [
    row({
      label: t("Map size"),
      tip: t(
        "Coordinate extent of the next map, fixed for its life. The Viewport size in Options is only how much of it you see. For full-globe maps use aspect ratio 2:1"
      ),
      icon: `<i data-tip="${t("Reset to default")}" id="restoreDefaultMapSize" class="icon-ccw"></i>`,
      control: inline(
        `<input id="mapWidthInput" data-option="mapWidth" type="number" min="240" />`,
        "<span>x</span>",
        `<input id="mapHeightInput" data-option="mapHeight" type="number" min="135" />`
      )
    }),
    row({
      label: t("Lattice"),
      tip: t("Ready-made sampling and jitter pairs. Regular boards need jitter 0"),
      control: `<select id="graphPreset" data-option="graphPreset">${graphPresetOptions()}</select>`
    }),
    row({
      label: t("Sampling"),
      tip: t("The lattice the map cells are built on. Square with high jitter is the classic natural look"),
      control: `<select id="sampling" data-option="sampling">${SAMPLINGS.map(id => option(id, SAMPLING_LABELS[id])).join("")}</select>`
    }),
    row({
      label: t("Jitter"),
      tip: t(
        "How far cell centers move off the lattice. 0 keeps perfectly regular cells, higher values look more natural"
      ),
      control: slider("jitter", `min="0" max="${MAX_JITTER}" step="0.05"`)
    }),
    row({
      label: t("Provinces ratio"),
      tip: t(
        "Set what share of eligible burgs in each state will become province centers. Higher values create more provinces"
      ),
      icon: lock("provincesRatio"),
      control: slider("provincesRatio", `min="0" max="100"`)
    }),
    row({
      label: t("Size variety"),
      tip: t("Define how much states and cultures can vary in size. Defines expansionism value"),
      icon: lock("sizeVariety"),
      control: slider("sizeVariety", `min="0" max="10" step=".1"`)
    }),
    row({
      label: t("Growth rate"),
      tip: t("Set the growth rate of states and cultures. Determines how much land stays neutral"),
      icon: lock("growthRate"),
      control: slider("growthRate", `min=".1" max="2" step=".1"`)
    })
  ].join("");

const interfaceRows = () =>
  [
    row({
      label: t("Autosave interval"),
      tip: t("Set autosave interval in minutes. Set 0 to disable autosave. Map is saved to browser memory"),
      control: slider("autosaveInterval", `min="0" max="60" step="1"`)
    }),
    row({
      label: t("On load"),
      tip: t("Set what Generator should do on load"),
      control: /* html */ `
        <select id="onloadBehavior" data-option="onloadBehavior">
          ${option("random", t("Generate random map"))}
          ${option("lastSaved", t("Open last saved map"))}
        </select>`
    }),
    row({
      label: t("Speaker voice"),
      tip: t("Select speech synthesis voice to pronounce generated names"),
      control: inline(
        `<select id="speakerVoice" data-option="speakerVoice"></select>`,
        `<span id="speakerTest" data-tip="${t("Click to test the voice")}" style="cursor: pointer">🔊</span>`
      )
    }),
    row({
      label: t("Emblem shape"),
      tip: t("Select emblem shape. Can be changed individually in the Emblem Editor"),
      control: inline(
        `<select id="emblemShape" data-option="emblemShape">${getEmblemShapeOptions()}</select>`,
        `<svg class="emblemShapePreview" viewBox="0 0 200 210"><path id="emblemShapeImage" /></svg>`
      )
    })
  ].join("");

const DEBUG_LABELS: Record<DebugMode, { label: string; tip: string }> = {
  economy: {
    label: t("Economy"),
    tip: t(
      "The Economy Overview shows every step of the burg's run: what it weighed before making each good, every market it could have bought from with the price at its door, and the goods that could cover each need. Recorded from the next production run, about three times slower"
    )
  },
  temperature: {
    label: t("Temperature"),
    tip: t("Log sea temperatures by latitude to the console when the climate is generated")
  },
  cloud: { label: t("Cloud storage"), tip: t("Log cloud storage responses to the console") }
};

const debugRows = () =>
  DEBUG_MODES.map(mode =>
    row({
      label: DEBUG_LABELS[mode].label,
      tip: DEBUG_LABELS[mode].tip,
      control: `<input id="debug_${mode}" data-debug="${mode}" class="checkbox" type="checkbox" /><label for="debug_${mode}" class="checkbox-label"></label>`
    })
  ).join("");

const EMBLEM_SHAPE_GROUPS: [group: string, shapes: [id: string, label: string][]][] = [
  [
    t("Diversiform"),
    [
      ["culture", t("Culture-specific")],
      ["random", t("Culture-random")],
      ["state", t("State-specific")]
    ]
  ],
  [
    t("Basic"),
    [
      ["heater", t("Heater")],
      ["spanish", t("Spanish")],
      ["french", t("French")]
    ]
  ],
  [
    t("Regional"),
    [
      ["horsehead", t("Horsehead")],
      ["horsehead2", t("Horsehead Edgy")],
      ["polish", t("Polish")],
      ["hessen", t("Hessen")],
      ["swiss", t("Swiss")]
    ]
  ],
  [
    t("Historical"),
    [
      ["boeotian", t("Boeotian")],
      ["roman", t("Roman")],
      ["kite", t("Kite")],
      ["oldFrench", t("Old French")],
      ["renaissance", t("Renaissance")],
      ["baroque", t("Baroque")]
    ]
  ],
  [
    t("Specific"),
    [
      ["targe", t("Targe")],
      ["targe2", `${t("Targe")} 2`],
      ["pavise", t("Pavise")],
      ["wedged", t("Wedged")],
      ["embowed", t("Embowed")]
    ]
  ],
  [
    t("Banner"),
    [
      ["flag", t("Flag")],
      ["pennon", t("Pennon")],
      ["guidon", t("Guidon")],
      ["banner", t("Banner")],
      ["dovetail", t("Dovetail")],
      ["gonfalon", t("Gonfalon")],
      ["pennant", t("Pennant")]
    ]
  ],
  [
    t("Simple"),
    [
      ["round", t("Round")],
      ["oval", t("Oval")],
      ["vesicaPiscis", t("Vesica Piscis")],
      ["square", t("Square")],
      ["diamond", t("Diamond")],
      ["hexagon", t("Hexagon")]
    ]
  ],
  [t("Fantasy"), [1, 2, 3, 4, 5].map(n => [`fantasy${n}`, `${t("Fantasy")} ${n}`])],
  [
    t("Middle Earth"),
    [
      ["noldor", t("Noldor")],
      ["gondor", t("Gondor")],
      ["easterling", t("Easterling")],
      ["erebor", t("Erebor")],
      ["ironHills", t("Iron Hills")],
      ["urukHai", t("UrukHai")],
      ["moriaOrc", t("Moria Orc")]
    ]
  ]
];

function getEmblemShapeOptions(): string {
  return EMBLEM_SHAPE_GROUPS.map(
    ([group, shapes]) =>
      `<optgroup label="${group}">${shapes.map(([id, label]) => option(id, label)).join("")}</optgroup>`
  ).join("");
}

export function getAdvancedOptionsHTML(): string {
  const id = ADVANCED_OPTIONS_ID;
  return /* html */ `
    <div id="${id}" class="dialog" style="display: none">
      <style>
        #${id} table { border-collapse: collapse; }
        #${id} th { text-align: left; font-style: italic; padding-top: 0.5em; }
        #${id} td:last-child { width: 13em; }
        #${id} td:last-child > *, #${id} .inline > :is(select, input) { width: 100%; }
        #${id} .inline { display: flex; align-items: center; gap: 0.3em; }
        #${id} slider-input input[type="range"] { flex: 1; }
        #${id} slider-input input[type="number"] { width: 3.5em; }
        #${id} i { cursor: pointer; }
      </style>
      <table>
        <tr><th colspan="3">${t("Map settings (apply to new maps)")}</th></tr>
        ${mapRows()}
        <tr><th colspan="3">${t("Interface settings")}</th></tr>
        ${interfaceRows()}
        <tr data-tip="${t("Diagnostics for checking how the generator works. They may change the view and record more, but never what is saved in the map file")}"><th colspan="3">${t("Debugging")}</th></tr>
        ${debugRows()}
      </table>
    </div>`;
}

function open(): void {
  Dialog.closeAll(`#${ADVANCED_OPTIONS_ID}, .stable`);
  Dialog.open(ADVANCED_OPTIONS_ID, {
    title: t("Advanced Options"),
    width: "auto",
    position: { my: "right top", at: "right-10 top+10", of: "svg" },
    buttons: [{ label: t("New Map"), onClick: () => regeneratePrompt() }],
    persistent: true
  });
}

export const AdvancedOptions = { open };
