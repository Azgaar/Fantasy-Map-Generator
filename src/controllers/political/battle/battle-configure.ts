// Configure Battle: the battle screen's view, drawing, playback, simulation numbers and exports, kept per browser
import {
  BATTLE_SPEEDS,
  type BattleOptions,
  type BattleSettings,
  DEFAULT_BATTLE_OPTIONS,
  MAX_FORTUNE
} from "@/data/battle-options";
import { Options } from "@/model/options/options-model";
import { ROUND_TICKS } from "@/model/political/battle/battle";
import { TICK_SECONDS } from "@/model/political/battle/battle-scale";
import { Dialog } from "@/ui/dialog/dialog";
import { t } from "@/utils/i18n";
import { log } from "@/utils/logger";
import { ensureEl, findEl } from "@/utils/node-utils";
import { BattleAnimation, type BattleSource, MIN_DELAY_MS } from "./battle-animation";
import { BattleReport, type ReportText } from "./battle-report";

type OptionGroup = keyof BattleOptions;

/** What the battle screen lends the dialog */
export interface BattleContext {
  tickMs: number;
  onChange: (group: OptionGroup) => void;
  getSource: () => BattleSource & { report: ReportText };
  pause: () => void;
  toggleLog: () => void;
  watching: boolean;
}

interface Control {
  key: string; // the path within its group
  label: string;
  tip: string;
  choices?: [value: string, label: string][]; // a list; a checkbox when neither this nor `range`
  range?: [min: number, max: number];
  step?: number; // of a number, 1 by default
  hint?: (value: number) => string; // what a number comes to
}
type Slider = HTMLElement & { value: string; valueAsNumber: number }; // <slider-input>
type Input = HTMLInputElement | HTMLSelectElement | Slider;
const camera: [string, string][] = [
  ["follow", t("Follow the troops")],
  ["field", t("Whole field")]
];

const STYLE = /* css */ `
  #battleConfigure { display: flex; flex-direction: column; gap: 0.3em; }
  #battleConfigure details[open] { padding-bottom: 0.4em; }
  #battleConfigure .grid, #battleConfigureProgress { margin-top: 0.3em; }
  #battleConfigure summary { display: flex; align-items: center; gap: 0.4em; padding: 0.1em 0; cursor: pointer; list-style: none; }
  #battleConfigure summary::-webkit-details-marker { display: none; }
  #battleConfigure summary::before { content: "▸"; width: 0.8em; color: #666; }
  #battleConfigure details[open] > summary::before { content: "▾"; }
  #battleConfigure summary > b { flex: 1; }
  #battleConfigure summary > button { padding: 0 0.4em; font-size: 0.85em; }
  #battleConfigure .grid { display: grid; grid-template-columns: minmax(0, 1fr) 15em; align-items: center; gap: 0.1em 0.8em; }
  #battleConfigure .grid > span { display: flex; align-items: center; justify-content: end; }
  #battleConfigure .grid > span > :is(select, slider-input) { width: 100%; }
  #battleConfigure slider-input input[type="range"] { flex: 1; min-width: 0; }
  #battleConfigure slider-input input[type="number"] { width: 3.5em; }
  #battleConfigure label > small { display: block; color: #666; white-space: nowrap; }
  #battleConfigureProgress { display: flex; align-items: center; gap: 0.6em; }
  #battleConfigureProgress > progress { flex: 1; height: 1.5em; }
  #battleConfigure fieldset { display: contents; }
`;

class BattleConfigureController {
  private readonly groups: { group: OptionGroup; label: string; controls: Control[] }[] = [
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
          key: "light",
          label: t("Time of day light"),
          tip: t(
            "Light the plan by the hour and the sky: the sun and the shadows of the heights on the ground, cloud, dusk and night over everything. Off, the plan is lit as a map, from the north-west"
          )
        },
        {
          key: "heights",
          label: t("Heights"),
          tip: t("Label the contour lines and mark hilltops and hollows with their heights")
        },
        {
          key: "woods",
          label: t("Woods and marsh"),
          tip: t("Draw woods and marshes, with the trees and reeds in them")
        },
        {
          key: "props",
          label: t("Ground props"),
          tip: t("Draw trees, grass, rocks, dunes, reeds and the like by the biome and the lie of the land")
        },
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
        {
          key: "pause.broken",
          label: t("Pause when a side breaks"),
          tip: t("Pause the battle when a side turns to run")
        }
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
          key: "maxRounds",
          label: t("Longest battle"),
          tip: t("Rounds after which a battle automatically ends"),
          range: [25, 1800],
          hint: value => `${t("rounds")} (${Math.round((value * ROUND_TICKS * TICK_SECONDS) / 360) / 10} ${t("h")})`
        },
        {
          key: "lullRounds",
          label: t("Lull that ends a battle"),
          tip: t("Rounds without losses that end a battle"),
          range: [3, 60],
          hint: value => `${t("rounds")} (${this.minutes(value * ROUND_TICKS)})`
        },
        {
          key: "orderRounds",
          label: t("Order stands"),
          tip: t("Rounds an order given by hand stands before the general decides again"),
          range: [1, 60],
          hint: value => `${t("rounds")} (${this.minutes(value * ROUND_TICKS)})`
        },
        {
          key: "planTicks",
          label: t("Generals think ahead"),
          tip: t("Ticks the generals play planning the battle"),
          range: [30, 1200],
          hint: value => `${t("ticks")} (${this.minutes(value)})`
        },
        {
          key: "fortune",
          label: t("Fortune"),
          tip: t("Fortune dice power. 0: no dice"),
          range: [0, MAX_FORTUNE],
          step: 0.01,
          hint: value =>
            value ? `⚀ ×${+(1 - 2.5 * value).toFixed(2)} … ⚅ ×${+(1 + 2.5 * value).toFixed(2)}` : t("no dice")
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

  private context: BattleContext | null = null;
  private recording: AbortController | null = null;

  private minutes(ticks: number): string {
    return `${+((ticks * TICK_SECONDS) / 60).toFixed(1)} ${t("min")}`;
  }

  open(screen: BattleContext): void {
    this.context = screen;
    if (Dialog.isOpen("battleConfigure")) {
      // a click on the battle screen raises it over the dialog: bring the dialog back
      findEl("battleConfigure")?.closest(".dialog-window")?.classList.remove("dialog-minimized");
      Dialog.open("battleConfigure");
      return;
    }
    findEl("battleConfigure")?.remove();
    const sections = this.groups
      .map(({ group, label, controls }) => {
        const rows = controls.map(control => this.renderControl(group, control)).join("");
        const extra =
          group === "export"
            ? `<div id="battleConfigureProgress"><progress max="1" value="0"></progress><span></span><button id="battleConfigureSave">${t("Save")}</button></div>`
            : "";
        return /* html */ `<details data-group="${group}">
          <summary><b>${label}</b><button data-reset="${group}" data-tip="${t("Restore the defaults of the group")}" class="icon-arrows-cw"></button></summary>
          <fieldset><div class="grid">${rows}</div></fieldset>${extra}
        </details>`;
      })
      .join("");
    ensureEl("dialogs").insertAdjacentHTML(
      "beforeend",
      `<div id="battleConfigure" class="dialog"><style>${STYLE}</style>${sections}</div>`
    );

    const dialog = ensureEl("battleConfigure");
    dialog.addEventListener("change", event => this.change(event.target as Input));
    dialog.addEventListener("input", event => this.showHint(event.target as Input)); // as a slider is dragged
    dialog.addEventListener("click", event => {
      const group = (event.target as HTMLElement).closest<HTMLElement>("[data-reset]")?.dataset.reset as OptionGroup;
      if (!group) return;
      event.preventDefault(); // the section stays as it is
      this.reset(group);
    });
    ensureEl("battleConfigureSave").addEventListener("click", () =>
      this.recording ? this.recording.abort() : this.save()
    );
    this.refresh();

    Dialog.open("battleConfigure", {
      title: t("Configure Battle"),
      position: { my: "right top", at: "right-10 top+10", of: "svg" },
      width: "30em",
      maxHeight: window.innerHeight * 0.9,
      buttons: [
        {
          label: "",
          tip: t("Show the battle log"),
          className: "icon-list-bullet",
          onClick: () => this.context?.toggleLog()
        }
      ],
      onClose: () => {
        this.recording?.abort();
        this.context = null;
      }
    });
    this.setLogShown(Dialog.isOpen("battleLog"));
  }

  /** The log button stays pressed while the log is open */
  setLogShown(show: boolean): void {
    const button = findEl("battleConfigure")?.closest(".dialog-window")?.querySelector(".icon-list-bullet");
    button?.classList.toggle("pressed", show);
  }

  private getGroup(group: OptionGroup): Record<string, unknown> {
    return options.app.battle[group] as Record<string, unknown>;
  }

  private getValue(group: OptionGroup, key: string): unknown {
    if (group === "view" && key === "plan") return options.app.debug.includes("battle");
    const [head, tail] = key.split(".");
    const value = this.getGroup(group)[head];
    return tail ? (value as Record<string, unknown>)[tail] : value;
  }

  private setValue(group: OptionGroup, key: string, value: unknown): void {
    if (group === "view" && key === "plan") {
      const debug = options.app.debug.filter(mode => mode !== "battle");
      Options.set(o => (o.app.debug = value ? [...debug, "battle"] : debug));
      log.setDebug(options.app.debug);
      return;
    }
    const [head, tail] = key.split(".");
    Options.set(() => {
      const data = this.getGroup(group);
      if (tail) (data[head] as Record<string, unknown>)[tail] = value;
      else data[head] = value;
    });
  }

  private renderControl(group: OptionGroup, { key, label, tip, choices, range, step = 1, hint }: Control): string {
    const id = `battleConfigure_${group}_${key.replace(".", "_")}`;
    if (range) {
      const fallback = DEFAULT_BATTLE_OPTIONS.simulation[key as keyof BattleSettings];
      const tips = `${tip}. ${t("Default")}: ${fallback}`;
      const data = `id="${id}" data-group="${group}" data-key="${key}" data-tip="${tips}"`;
      const slider = `<slider-input ${data} min="${range[0]}" max="${range[1]}" step="${step}" value="${fallback}"></slider-input>`;
      return `<label data-tip="${tips}">${label}${hint ? `<small id="${id}_hint"></small>` : ""}</label><span>${slider}</span>`;
    }
    const data = `id="${id}" data-group="${group}" data-key="${key}" data-tip="${tip}"`;
    const input = choices
      ? `<select ${data}>${choices.map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}</select>`
      : `<input ${data} type="checkbox" class="native" />`;
    return `<label for="${id}" data-tip="${tip}">${label}</label><span>${input}</span>`;
  }

  private getControl(input: Input): Control | undefined {
    const { group, key } = input.dataset;
    return this.groups.find(entry => entry.group === group)?.controls.find(entry => entry.key === key);
  }

  /** What the number of a slider comes to, under its label */
  private showHint(input: Input): void {
    const hint = this.getControl(input)?.hint;
    if (hint) ensureEl(`${input.id}_hint`).textContent = hint(+input.value);
  }

  /** The controls as the options stand */
  private refresh(): void {
    const dialog = findEl("battleConfigure");
    if (!dialog || !this.context) return;
    const speeds = BATTLE_SPEEDS.filter(speed => this.context!.tickMs / speed >= MIN_DELAY_MS);
    ensureEl("battleConfigure_export_speed").innerHTML = speeds
      .map(speed => `<option value="${speed}">×${BattleAnimation.getPlayback(this.context!.tickMs, speed)}</option>`)
      .join("");

    for (const input of dialog.querySelectorAll<Input>("[data-key]")) {
      const value = this.getValue(input.dataset.group as OptionGroup, input.dataset.key!);
      if (input instanceof HTMLInputElement && input.type === "checkbox") input.checked = Boolean(value);
      else input.value = String(value);
      if (input instanceof HTMLSelectElement && input.selectedIndex < 0) input.selectedIndex = input.length - 1; // the fastest offered
      this.showHint(input);
    }
    const report = options.app.battle.export.format === "report";
    for (const key of ["quality", "speed"])
      ensureEl<HTMLSelectElement>(`battleConfigure_export_${key}`).disabled = report; // a report has neither
    this.lockFixed();
  }

  private change(input: Input): void {
    const group = input.dataset.group as OptionGroup | undefined;
    const key = input.dataset.key;
    if (!group || !key || !this.context) return; // the inner inputs of a slider: it tells its own change
    let value: unknown = input.value;
    if (input instanceof HTMLInputElement && input.type === "checkbox") value = input.checked;
    else if (input.tagName === "SLIDER-INPUT") {
      const fallback = DEFAULT_BATTLE_OPTIONS.simulation[key as keyof BattleSettings];
      const [min, max, step] = ["min", "max", "step"].map(name => Number(input.getAttribute(name)));
      const typed = (input as Slider).valueAsNumber;
      const stepped = +(Math.round(typed / step) * step).toFixed(6);
      value = Number.isFinite(typed) ? Math.min(Math.max(stepped, min), max) : fallback;
      const { simulation } = options.app.battle;
      if (key === "minBattalions") value = Math.min(value as number, simulation.maxBattalions);
      if (key === "maxBattalions") value = Math.max(value as number, simulation.minBattalions);
    } else if (key === "speed") {
      value = +input.value;
      if (!BATTLE_SPEEDS.includes(value as number)) {
        this.refresh(); // not a speed the list offers
        return;
      }
    }
    this.setValue(group, key, value);
    this.refresh();
    this.context.onChange(group);
  }

  private reset(group: OptionGroup): void {
    if (!this.context || this.recording) return;
    Options.set(o => (o.app.battle[group] = structuredClone(DEFAULT_BATTLE_OPTIONS[group]) as never));
    if (group === "view") this.setValue("view", "plan", false);
    this.refresh();
    this.context.onChange(group);
  }

  private async save(): Promise<void> {
    if (!this.context) return;
    this.context.pause();
    const source = this.context.getSource();
    const choice = { ...options.app.battle.export };
    this.recording = new AbortController();
    const { signal } = this.recording;
    this.setBusy(true);
    const progress = (share: number, status: string): void => {
      const bar = findEl("battleConfigureProgress");
      if (!bar) return; // closed
      bar.querySelector("progress")!.value = share;
      bar.querySelector("span")!.textContent = status;
    };
    try {
      if (choice.format === "report") await BattleReport.save(source, source.report, choice, signal, progress);
      else await BattleAnimation.save(source, choice, signal, progress);
    } finally {
      if (this.recording?.signal === signal) this.recording = null;
      this.setBusy(false);
    }
  }

  /** While recording, nothing else is changed */
  private setBusy(busy: boolean): void {
    const dialog = findEl("battleConfigure");
    if (!dialog) return;
    this.lockFixed(busy);
    ensureEl("battleConfigureSave").textContent = busy ? t("Stop") : t("Save");
    if (!busy) this.refresh();
  }

  /** Nothing changes while recording; a replay's simulation stays as it was fought */
  private lockFixed(busy = Boolean(this.recording)): void {
    const dialog = findEl("battleConfigure");
    if (!dialog) return;
    for (const section of dialog.querySelectorAll<HTMLElement>("details[data-group]")) {
      const locked = busy || (section.dataset.group === "simulation" && Boolean(this.context?.watching));
      section.querySelector("fieldset")!.disabled = locked;
      section.querySelector<HTMLButtonElement>("[data-reset]")!.disabled = locked;
    }
  }

  /** The battle screen closes: so does the dialog */
  close(): void {
    this.recording?.abort();
    Dialog.destroy("battleConfigure");
    this.context = null;
  }
}

export const BattleConfigure = new BattleConfigureController();
