// Configure Battle: the battle screen's view, drawing, playback, simulation numbers and exports, kept per browser

import { BATTLE_SPEEDS, type BattleOptions, type BattleSettings, DEFAULT_BATTLE_OPTIONS } from "@/data/battle-options";
import { Options } from "@/model/options/options-model";
import { ROUND_TICKS } from "@/model/political/battle/battle";
import { TICK_SECONDS } from "@/model/political/battle/battle-scale";
import { Dialog } from "@/ui/dialog/dialog";
import { t } from "@/utils/i18n";
import { log } from "@/utils/logger";
import { ensureEl, findEl } from "@/utils/node-utils";
import { type BattleSource, getPlayback, MIN_DELAY_MS, saveAnimation } from "./battle-animation";
import { type ReportText, saveReport } from "./battle-report";

type Group = keyof BattleOptions;

/** What the battle screen lends the dialog */
export interface BattleContext {
  tickMs: number;
  onChange: (group: Group) => void;
  getSource: () => BattleSource & { report: ReportText };
  pause: () => void;
}

interface Control {
  key: string; // the path within its group
  label: string;
  tip: string;
  choices?: [value: string, label: string][]; // a list; a checkbox when neither this nor `range`
  range?: [min: number, max: number];
  hint?: (value: number) => string; // what a number comes to
}

const minutes = (ticks: number): string => `${+((ticks * TICK_SECONDS) / 60).toFixed(1)} ${t("min")}`;
const camera: [string, string][] = [
  ["follow", t("Follow the troops")],
  ["field", t("Whole field")]
];

const GROUPS: { group: Group; label: string; controls: Control[] }[] = [
  {
    group: "view",
    label: t("View"),
    controls: [
      {
        key: "camera",
        label: t("Camera"),
        tip: t(
          "What the view shows: the troops, framed as they move, or the whole field. Zoom with the wheel, drag the ground to look round, double-click it to return"
        ),
        choices: camera
      },
      {
        key: "plan",
        label: t("Battle plan"),
        tip: t("Draw each battalion's mission, place and target, and each side's tactic over the field")
      }
    ]
  },
  {
    group: "rendering",
    label: t("Rendering"),
    controls: [
      {
        key: "relief",
        label: t("Relief"),
        tip: t(
          "How the lie of the land is drawn: hachures down the slopes, contour lines fringed on their downhill side, or not at all"
        ),
        choices: [
          ["hachures", t("Hachures")],
          ["contours", t("Contours")],
          ["none", t("None")]
        ]
      },
      {
        key: "shade",
        label: t("Relief shade"),
        tip: t("Shade the slopes turned from the light, so the hills stand out")
      },
      {
        key: "heights",
        label: t("Heights"),
        tip: t("Label the contour lines and mark hilltops and hollows with their heights")
      },
      { key: "woods", label: t("Woods and marsh"), tip: t("Draw the patterns of woods and marshes") },
      { key: "labels", label: t("Place labels"), tip: t("Draw the names of burgs and rivers") },
      {
        key: "colors",
        label: t("Side colors"),
        tip: t(
          "Red attackers and blue defenders, or the colors of each side's leading state. Too alike state colors fall back to red and blue"
        ),
        choices: [
          ["sides", t("Red and blue")],
          ["states", t("States' colors")]
        ]
      },
      { key: "icons", label: t("Unit icons"), tip: t("Draw the unit icon on each battalion") },
      { key: "flags", label: t("Flags"), tip: t("Draw the state flag on battalions of allied states") },
      {
        key: "health",
        label: t("Health lines"),
        tip: t("Draw the line along a battalion's front that shows the share of its troops left")
      },
      {
        key: "fallen",
        label: t("Fallen"),
        tip: t("Destroyed battalions fade away or stay as faint outlines where they fell"),
        choices: [
          ["fade", t("Fade away")],
          ["outline", t("Keep outline")]
        ]
      },
      {
        key: "arrows",
        label: t("Movement arrows"),
        tip: t("While paused and in report keyframes, show where each battalion went since the last key moment")
      },
      { key: "fire", label: t("Fire lines"), tip: t("Draw dotted lines from shooters to their targets") },
      { key: "missiles", label: t("Missiles"), tip: t("Draw arrows and shells in flight") },
      { key: "clashes", label: t("Clash marks"), tip: t("Draw the marks of melee and bursting shells") },
      {
        key: "weather",
        label: t("Weather effects"),
        tip: t(
          "Show rain, snow, fog, heat haze, mud and ice on the battle plan. On the screen only, not in exports. The weather tells on the battle either way"
        )
      },
      {
        key: "title",
        label: t("Title and clock"),
        tip: t("Show the battle name and the time since its start in the corner of the view")
      },
      { key: "scale", label: t("Scale bar"), tip: t("Show the scale bar, measuring the view in sight") },
      { key: "north", label: t("North arrow"), tip: t("Show the North arrow") }
    ]
  },
  {
    group: "playback",
    label: t("Playback"),
    controls: [
      {
        key: "step",
        label: t("Step"),
        tip: t("What the step button advances the battle by"),
        choices: [
          ["tick", t("One tick")],
          ["round", t("One round")]
        ]
      },
      { key: "pause.clash", label: t("Pause at first clash"), tip: t("Pause the battle when the engagement starts") },
      { key: "pause.rout", label: t("Pause at a rout"), tip: t("Pause the battle when a battalion breaks and runs") },
      {
        key: "pause.surrender",
        label: t("Pause at a surrender"),
        tip: t("Pause the battle when a battalion surrenders")
      },
      { key: "pause.breach", label: t("Pause at a breach"), tip: t("Pause the battle when the walls are breached") },
      { key: "pause.broken", label: t("Pause when a side breaks"), tip: t("Pause the battle when a side turns to run") }
    ]
  },
  {
    group: "simulation",
    label: t("Simulation"),
    controls: [
      {
        key: "maxBattalions",
        label: t("Most battalions"),
        tip: t("The troops are split into no more battalions than that: fewer play faster, more show more detail"),
        range: [10, 200]
      },
      {
        key: "minBattalions",
        label: t("Fewest battalions"),
        tip: t("Smaller battalions are formed when the troops would make fewer than that"),
        range: [2, 40]
      },
      {
        key: "maxMinutes",
        label: t("Longest battle"),
        tip: t("Minutes after which a battle that neither ends nor dies down is over"),
        range: [20, 1440],
        hint: value => `${t("min")} (${Math.round(value / 6) / 10} ${t("h")})`
      },
      {
        key: "lullRounds",
        label: t("Lull that ends a battle"),
        tip: t("Rounds without losses that end a battle"),
        range: [3, 60],
        hint: value => `${t("rounds")} (${minutes(value * ROUND_TICKS)})`
      },
      {
        key: "orderRounds",
        label: t("Order stands"),
        tip: t("Rounds an order given by hand stands before the general decides again"),
        range: [1, 60],
        hint: value => `${t("rounds")} (${minutes(value * ROUND_TICKS)})`
      },
      {
        key: "planTicks",
        label: t("Generals think ahead"),
        tip: t(
          "Ticks the generals play an open battle through in their minds before the start: fewer plan faster, more plan deeper"
        ),
        range: [30, 1200],
        hint: value => `${t("ticks")} (${minutes(value)})`
      },
      {
        key: "stormPlanTicks",
        label: t("Think ahead, siege"),
        tip: t("Ticks the generals play a siege or a wagon fort through in their minds"),
        range: [30, 600],
        hint: value => `${t("ticks")} (${minutes(value)})`
      }
    ]
  },
  {
    group: "export",
    label: t("Export"),
    controls: [
      {
        key: "format",
        label: t("Format"),
        tip: t(
          "An animation played from the start to the end, or a page with keyframes of the key moments and the log"
        ),
        choices: [
          ["gif", "GIF"],
          ["svg", t("Animated SVG")],
          ["report", t("Battle report")]
        ]
      },
      {
        key: "quality",
        label: t("Quality"),
        tip: t("Image width: higher is sharper and larger"),
        choices: [
          ["low", t("Low")],
          ["medium", t("Medium")],
          ["high", t("High")]
        ]
      },
      { key: "speed", label: t("Speed"), tip: t("How fast the animation plays"), choices: [] },
      {
        key: "camera",
        label: t("Camera"),
        tip: t("Follow the troops as on screen, or show the whole field"),
        choices: camera
      }
    ]
  }
];

const STYLE = /* css */ `
  #battleConfigure { display: flex; flex-direction: column; gap: 0.3em; width: 24em; }
  #battleConfigure details[open] { padding-bottom: 0.4em; }
  #battleConfigure .grid, #battleConfigureProgress { margin-top: 0.3em; }
  #battleConfigure summary { display: flex; align-items: center; gap: 0.4em; padding: 0.15em 0; border-bottom: 1px solid #ccc; cursor: pointer; list-style: none; }
  #battleConfigure summary::-webkit-details-marker { display: none; }
  #battleConfigure summary::before { content: "▸"; width: 0.8em; color: #666; }
  #battleConfigure details[open] > summary::before { content: "▾"; }
  #battleConfigure summary > b { flex: 1; }
  #battleConfigure summary > button { padding: 0 0.4em; font-size: 0.85em; }
  #battleConfigure .grid { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 0 0.8em; }
  #battleConfigure .grid > span { display: flex; align-items: center; gap: 0.4em; justify-content: end; }
  #battleConfigure select { width: 9.5em; }
  #battleConfigure input[type="number"] { width: 4.5em; }
  #battleConfigure small { min-width: 6.5em; color: #666; white-space: nowrap; }
  #battleConfigureProgress { display: flex; align-items: center; gap: 0.6em; }
  #battleConfigureProgress > progress { flex: 1; height: 1.5em; }
  #battleConfigure fieldset { display: contents; }
`;

let context: BattleContext | null = null;
let recording: AbortController | null = null;

function open(screen: BattleContext): void {
  context = screen;
  if (Dialog.isOpen("battleConfigure")) {
    // a click on the battle screen raises it over the dialog: bring the dialog back
    findEl("battleConfigure")?.closest(".dialog-window")?.classList.remove("dialog-minimized");
    Dialog.open("battleConfigure");
    return;
  }
  findEl("battleConfigure")?.remove();
  const sections = GROUPS.map(({ group, label, controls }) => {
    const rows = controls.map(control => renderControl(group, control)).join("");
    const extra =
      group === "export"
        ? `<div id="battleConfigureProgress"><progress max="1" value="0"></progress><span></span><button id="battleConfigureSave">${t("Save")}</button></div>`
        : "";
    return /* html */ `<details data-group="${group}">
        <summary><b>${label}</b><button data-reset="${group}" data-tip="${t("Restore the defaults of the group")}">${t("Restore defaults")}</button></summary>
        <fieldset><div class="grid">${rows}</div></fieldset>${extra}
      </details>`;
  }).join("");
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    `<div id="battleConfigure" class="dialog"><style>${STYLE}</style>${sections}</div>`
  );

  const dialog = ensureEl("battleConfigure");
  dialog.addEventListener("change", event => change(event.target as HTMLInputElement | HTMLSelectElement));
  dialog.addEventListener("click", event => {
    const group = (event.target as HTMLElement).closest<HTMLElement>("[data-reset]")?.dataset.reset as Group;
    if (!group) return;
    event.preventDefault(); // the section stays as it is
    reset(group);
  });
  ensureEl("battleConfigureSave").addEventListener("click", () => (recording ? recording.abort() : save()));
  refresh();

  Dialog.open("battleConfigure", {
    title: t("Configure Battle"),
    position: { my: "right top", at: "right-10 top+10", of: "#battleScreen" },
    maxHeight: window.innerHeight * 0.9,
    onClose: () => {
      recording?.abort();
      context = null;
    }
  });
}

const getGroup = (group: Group): Record<string, unknown> => options.app.battle[group] as Record<string, unknown>;

function getValue(group: Group, key: string): unknown {
  if (group === "view" && key === "plan") return options.app.debug.includes("battle");
  const [head, tail] = key.split(".");
  const value = getGroup(group)[head];
  return tail ? (value as Record<string, unknown>)[tail] : value;
}

function setValue(group: Group, key: string, value: unknown): void {
  if (group === "view" && key === "plan") {
    const debug = options.app.debug.filter(mode => mode !== "battle");
    Options.set(o => (o.app.debug = value ? [...debug, "battle"] : debug));
    log.setDebug(options.app.debug);
    return;
  }
  const [head, tail] = key.split(".");
  Options.set(() => {
    const data = getGroup(group);
    if (tail) (data[head] as Record<string, unknown>)[tail] = value;
    else data[head] = value;
  });
}

function renderControl(group: Group, { key, label, tip, choices, range, hint }: Control): string {
  const id = `battleConfigure_${group}_${key.replace(".", "_")}`;
  const data = `id="${id}" data-group="${group}" data-key="${key}" data-tip="${tip}"`;
  let input = `<input ${data} type="checkbox" class="native" />`;
  if (choices)
    input = `<select ${data}>${choices.map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}</select>`;
  if (range) {
    const fallback = DEFAULT_BATTLE_OPTIONS.simulation[key as keyof BattleSettings];
    const bounds = `min="${range[0]}" max="${range[1]}" step="1" placeholder="${fallback}"`;
    const tips = `${tip}. ${t("Default")}: ${fallback}`;
    input = `<input id="${id}" data-group="${group}" data-key="${key}" data-tip="${tips}" type="number" ${bounds} />${hint ? `<small></small>` : ""}`;
  }
  return `<label for="${id}" data-tip="${tip}">${label}</label><span>${input}</span>`;
}

/** The controls as the options stand */
function refresh(): void {
  const dialog = findEl("battleConfigure");
  if (!dialog || !context) return;
  const speeds = BATTLE_SPEEDS.filter(speed => context!.tickMs / speed >= MIN_DELAY_MS);
  ensureEl("battleConfigure_export_speed").innerHTML = speeds
    .map(speed => `<option value="${speed}">×${getPlayback(context!.tickMs, speed)}</option>`)
    .join("");

  for (const input of dialog.querySelectorAll<HTMLInputElement>("[data-key]")) {
    const group = input.dataset.group as Group;
    const key = input.dataset.key!;
    const value = getValue(group, key);
    if (input.type === "checkbox") input.checked = Boolean(value);
    else input.value = String(value);
    if (input instanceof HTMLSelectElement && input.selectedIndex < 0) input.selectedIndex = input.length - 1; // the fastest offered
    const control = GROUPS.find(entry => entry.group === group)!.controls.find(entry => entry.key === key)!;
    if (control.hint) input.nextElementSibling!.textContent = control.hint(+input.value);
  }
  const report = options.app.battle.export.format === "report";
  for (const key of ["quality", "speed"])
    ensureEl<HTMLSelectElement>(`battleConfigure_export_${key}`).disabled = report; // a report has neither
}

function change(input: HTMLInputElement | HTMLSelectElement): void {
  const group = input.dataset.group as Group | undefined;
  const key = input.dataset.key;
  if (!group || !key || !context) return;
  let value: unknown = input.value;
  if (input instanceof HTMLInputElement && input.type === "checkbox") value = input.checked;
  else if (input instanceof HTMLInputElement && input.type === "number") {
    const fallback = DEFAULT_BATTLE_OPTIONS.simulation[key as keyof BattleSettings];
    const [min, max] = [+input.min, +input.max];
    value = Number.isFinite(input.valueAsNumber)
      ? Math.min(Math.max(Math.round(input.valueAsNumber), min), max)
      : fallback;
    const { simulation } = options.app.battle;
    if (key === "minBattalions") value = Math.min(value as number, simulation.maxBattalions);
    if (key === "maxBattalions") value = Math.max(value as number, simulation.minBattalions);
  } else if (key === "speed") {
    value = +input.value;
    if (!BATTLE_SPEEDS.includes(value as number)) {
      refresh(); // not a speed the list offers
      return;
    }
  }
  setValue(group, key, value);
  refresh();
  context.onChange(group);
}

function reset(group: Group): void {
  if (!context || recording) return;
  Options.set(o => (o.app.battle[group] = structuredClone(DEFAULT_BATTLE_OPTIONS[group]) as never));
  if (group === "view") setValue("view", "plan", false);
  refresh();
  context.onChange(group);
}

async function save(): Promise<void> {
  if (!context) return;
  context.pause();
  const source = context.getSource();
  const choice = { ...options.app.battle.export };
  recording = new AbortController();
  const { signal } = recording;
  setBusy(true);
  const progress = (share: number, status: string): void => {
    const bar = findEl("battleConfigureProgress");
    if (!bar) return; // closed
    bar.querySelector("progress")!.value = share;
    bar.querySelector("span")!.textContent = status;
  };
  try {
    if (choice.format === "report") await saveReport(source, source.report, choice, signal, progress);
    else await saveAnimation(source, choice, signal, progress);
  } finally {
    if (recording?.signal === signal) recording = null;
    setBusy(false);
  }
}

/** While recording, nothing else is changed */
function setBusy(busy: boolean): void {
  const dialog = findEl("battleConfigure");
  if (!dialog) return;
  for (const set of dialog.querySelectorAll("fieldset")) set.disabled = busy;
  for (const button of dialog.querySelectorAll<HTMLButtonElement>("[data-reset]")) button.disabled = busy;
  ensureEl("battleConfigureSave").textContent = busy ? t("Stop") : t("Save");
  if (!busy) refresh();
}

/** The battle screen closes: so does the dialog */
function close(): void {
  recording?.abort();
  Dialog.destroy("battleConfigure");
  context = null;
}

export const BattleConfigure = { open, close };
