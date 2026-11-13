import { applyDue, type Battle, type Intervention, plan, replay, tick } from "@/model/political/battle/battle";
import { formatClock, TICK_SECONDS } from "@/model/political/battle/battle-scale";
import type { Battlefield } from "@/model/political/battle/battlefield";
import { drawBattlefield, drawBlocks, snapshot, updateBlocks } from "@/renderers/draw-battle-scene";
import { Dialog } from "@/ui/dialog/dialog";
import { downloadFile } from "@/utils/file-utils";
import { t } from "@/utils/i18n";
import { log } from "@/utils/logger";
import { ensureEl, findEl } from "@/utils/node-utils";
import { escapeHtml } from "@/utils/string-utils";

/** A battle set up anew at its start, with the changes to make on the way */
export interface BattleStart {
  battle: Battle;
  script: Intervention[];
}

interface Source {
  fileName: string;
  start: () => BattleStart;
  tickMs: number; // at normal speed
  speed: number; // chosen on the battle screen
  screenWidth: number; // of the field on screen, in device pixels
}

type Format = "gif" | "svg";
type Quality = "low" | "medium" | "high";
const FRAME_MS = 50; // aimed at: GIF delays are in hundredths of a second, short ones play slower
const END_MS = 3000; // the outcome stands before the loop starts again
const MOVING = [".battleWorks", ".battleFire", ".battleBlocks", ".battleMissiles", ".battleClashes"]; // layers above the ground
export const SPEEDS = [0.5, 1, 2, 4]; // playback, ×1 the speed a tick is drawn at

/** How many times as fast as the battle it plays at a speed */
export const getPlayback = (tickMs: number, speed: number): number =>
  Math.round((TICK_SECONDS * 1000 * speed) / tickMs);
const WIDTHS: Record<Exclude<Quality, "high">, number> = { low: 600, medium: 1000 }; // high is as sharp as the screen
const MAX_WIDTH = 2000; // pixels

const STYLE = /* css */ `
  #battleAnimationForm { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 0.4em 0.8em; margin: 0; padding: 0; border: 0; }
  #battleAnimationForm label { display: contents; }
  #battleAnimation .battleAnimationProgress { display: flex; align-items: center; gap: 0.6em; }
  #battleAnimationProgress { flex: 1; height: 1.5em; }
`;

let recording: AbortController | null = null;

function open(source: Source): void {
  findEl("battleAnimation")?.remove();
  const option = (value: string, label: string, selected = false, disabled = false): string =>
    `<option value="${value}"${selected ? " selected" : ""}${disabled ? " disabled" : ""}>${label}</option>`;

  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="battleAnimation" class="dialog">
      <style>${STYLE}</style>
      <fieldset id="battleAnimationForm">
        <label>${t("Format")}
          <select name="format">
            ${option("gif", "GIF", true)}
            ${option("svg", t("Animated SVG"))}
          </select>
        </label>
        <label>${t("Quality")}
          <select name="quality">
            ${option("low", t("Low"))}${option("medium", t("Medium"), true)}${option("high", t("High"))}
          </select>
        </label>
        <label>${t("Speed")}
          <select name="speed">
            ${SPEEDS.map(speed => option(String(speed), `×${getPlayback(source.tickMs, speed)}`, speed === source.speed)).join("")}
          </select>
        </label>
      </fieldset>
      <div class="battleAnimationProgress">
        <progress id="battleAnimationProgress" max="1" value="0"></progress>
        <span id="battleAnimationStatus"></span>
      </div>
    </div>`
  );

  Dialog.open("battleAnimation", {
    title: t("Save battle animation"),
    width: "auto",
    modal: true,
    position: { my: "center", at: "center", of: "#battleScreen" },
    buttons: [
      {
        label: t("Save"),
        className: "battleAnimationSave",
        onClick: () => (recording ? recording.abort() : save(source))
      },
      { label: t("Close"), onClick: () => Dialog.close("battleAnimation") }
    ],
    onClose: () => recording?.abort()
  });
}

const field = (name: string): HTMLSelectElement =>
  ensureEl("battleAnimationForm").querySelector<HTMLSelectElement>(`[name="${name}"]`)!;

function showProgress(share: number, status: string): void {
  const progress = findEl<HTMLProgressElement>("battleAnimationProgress");
  if (!progress) return; // closed
  progress.value = share;
  ensureEl("battleAnimationStatus").textContent = status;
}

async function save(source: Source): Promise<void> {
  const format = field("format").value as Format;
  const quality = field("quality").value as Quality;
  const tickMs = source.tickMs / +field("speed").value;
  const width =
    quality === "high" ? Math.min(Math.max(Math.round(source.screenWidth), 1000), MAX_WIDTH) : WIDTHS[quality];

  // a quick run to the end tells how long the battle is
  const probe = source.start();
  replay(probe.battle, probe.script);
  const ticks = Math.max(probe.battle.tick, 1);
  const end = formatClock(ticks);

  recording = new AbortController();
  const signal = recording.signal;
  setBusy(true);
  showProgress(0, "");
  const started = performance.now();
  try {
    const gif = format === "gif" ? await createGifWriter() : null;
    const { battle, script } = source.start();
    const file = await recordBattle(battle, script, {
      gif,
      width,
      tickMs,
      signal,
      onTick: tick => showProgress(tick / ticks, `${formatClock(tick)} / ${end}`)
    });
    if (!file) {
      showProgress(0, t("Cancelled"));
      return;
    }
    downloadFile(file, `${source.fileName}.${format}`, file.type);
    const size = file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.ceil(file.size / 1024)} KB`;
    const seconds = Math.round((performance.now() - started) / 100) / 10;
    showProgress(1, t("Saved: {{size}} in {{seconds}} s", { size, seconds }));
  } catch (error) {
    log.error(error);
    showProgress(0, t("Cannot make the animation"));
  } finally {
    if (recording?.signal === signal) recording = null;
    setBusy(false);
  }
}

function setBusy(busy: boolean): void {
  const dialog = findEl("battleAnimation");
  if (!dialog) return;
  (ensureEl("battleAnimationForm") as HTMLFieldSetElement).disabled = busy;
  const button = dialog.closest(".dialog-window")?.querySelector(".battleAnimationSave");
  if (button) button.textContent = busy ? t("Cancel") : t("Save");
}

interface RecordOptions {
  gif: GifWriter | null; // none for an animated SVG
  width: number; // of an image
  tickMs: number; // a tick's length
  signal: AbortSignal;
  onTick: (tick: number) => void;
}

/** Play a battle set up anew from its start to the end into a looping animation */
async function recordBattle(
  battle: Battle,
  script: Intervention[],
  { gif, width, tickMs, signal, onTick }: RecordOptions
): Promise<Blob | null> {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const xml = new XMLSerializer();
  const markup = (nodes: Element[]): string => nodes.map(node => xml.serializeToString(node)).join("");

  drawBattlefield(svg, battle.field);
  const ground = markup([...svg.children]);

  applyDue(battle, script);
  plan(battle); // the first frame shows the troops as the generals drew them up
  const icons = new Set<string>();
  let defs = "";
  const placeBlocks = (): void => {
    drawBlocks(svg, battle, noop, noop);
    // the unit icons are symbols of the page, the file has to carry its own
    for (const use of svg.querySelectorAll("use")) icons.add(use.getAttribute("href")!.slice(1));
    defs = `<defs>${markup([...icons].flatMap(id => document.getElementById(id) ?? []))}</defs>`;
  };
  placeBlocks();
  updateBlocks(svg, battle, null, 1);

  const layers = MOVING.map(layer => svg.querySelector(layer)!);
  const recorder = new SvgRecorder(layers);
  const addFrame = gif
    ? await createRasterSink(gif, battle.field, width, ground, () => defs + markup(layers))
    : async (delay: number) => recorder.capture(delay);

  const frames = Math.max(1, Math.round(tickMs / FRAME_MS));
  const delay = tickMs / frames;
  await addFrame(delay);
  while (!battle.result) {
    if (signal.aborted) return null;
    const previous = snapshot(battle);
    const blocks = battle.blocks.length;
    applyDue(battle, script);
    if (battle.blocks.length !== blocks) placeBlocks(); // a recorded reinforcement
    tick(battle);
    for (let frame = 1; frame <= frames; frame++) {
      updateBlocks(svg, battle, previous, frame / frames);
      await addFrame(delay);
    }
    onTick(battle.tick);
    if (!gif) await new Promise(resolve => setTimeout(resolve)); // a drawing has no image to wait for
  }

  if (gif) return gif.finish(END_MS);
  const svgFile = `<svg xmlns="http://www.w3.org/2000/svg" ${viewBox(battle.field, SVG_WIDTH)}>${ground}${defs}${recorder.write(END_MS)}</svg>`;
  return new Blob([svgFile], { type: "image/svg+xml" });
}

const SVG_WIDTH = 1000; // pixels an animated drawing opens at
const getHeight = (field: Battlefield, width: number): number => Math.round((field.height * width) / field.width);

/** The field in metres, shown so many pixels wide */
const viewBox = (field: Battlefield, width: number): string =>
  `viewBox="0 0 ${field.width} ${field.height}" width="${width}" height="${getHeight(field, width)}" font-family="Georgia, serif"`;

/** Draws a frame as the ground under the moving layers and adds it to the GIF */
async function createRasterSink(
  gif: GifWriter,
  field: Battlefield,
  width: number,
  ground: string,
  moving: () => string
) {
  const toImage = (content: string): Promise<HTMLImageElement> =>
    loadImage(`<svg xmlns="http://www.w3.org/2000/svg" ${viewBox(field, width)}>${content}</svg>`);
  const groundImage = await toImage(ground); // drawn once, under every frame
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = getHeight(field, width);
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  return async (delay: number): Promise<void> => {
    context.drawImage(groundImage, 0, 0);
    context.drawImage(await toImage(moving()), 0, 0);
    gif.add(canvas, delay);
  };
}

const noop = (): void => {};

async function loadImage(markup: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } finally {
    URL.revokeObjectURL(url);
  }
  return image;
}

export const BattleAnimation = { open };

type GifWriter = Awaited<ReturnType<typeof createGifWriter>>;

/** GIF in the 255 colours of the first frame; each next frame writes only the pixels that changed */
async function createGifWriter() {
  const { applyPalette, GIFEncoder, quantize } = await import("gifenc"); // loaded only when a GIF is made
  const gif = GIFEncoder();
  let palette: number[][] = [];
  let last: Uint8Array | null = null;
  let size = [0, 0];

  return {
    add(canvas: HTMLCanvasElement, delay: number): void {
      const { width, height } = canvas;
      size = [width, height];
      const { data } = canvas.getContext("2d")!.getImageData(0, 0, width, height);
      if (!last) {
        palette = quantize(data, 255); // the last colour stands for "unchanged"
        last = applyPalette(data, palette);
        gif.writeFrame(last, width, height, { palette: [...palette, [0, 0, 0]], delay });
        return;
      }
      const index = applyPalette(data, palette);
      const changes = index.map((color, i) => (color === last![i] ? palette.length : color));
      gif.writeFrame(changes, width, height, {
        delay,
        transparent: true,
        transparentIndex: palette.length,
        dispose: 1
      });
      last = index;
    },
    /** The last frame stays `endDelay` ms before the loop starts again */
    finish(endDelay: number): Blob {
      const [width, height] = size;
      const unchanged = new Uint8Array(width * height).fill(palette.length);
      gif.writeFrame(unchanged, width, height, {
        delay: endDelay,
        transparent: true,
        transparentIndex: palette.length,
        dispose: 1
      });
      gif.finish();
      return new Blob([gif.bytes()], { type: "image/gif" });
    }
  };
}

interface Track {
  element: Element;
  parent: Element;
  text: string | null; // of an element with no element children
  frames: Map<number, Record<string, string>>; // the attributes in each frame it is shown in
}

const IGNORED = new Set(["data-tip"]);
const DEFAULTS: Record<string, string> = { display: "inline", opacity: "1", "stroke-dasharray": "none" };
const NUMBER = /^-?\d+(\.\d+)?$/;
const TOLERANCE = 0.06; // a glide may miss a recorded value by less than its rounding
const TRANSFORM = /^(?:translate\((-?[\d.]+)[ ,](-?[\d.]+)\))?\s*(?:rotate\((-?[\d.]+)\))?$/;

/** Records how the elements under the roots change from frame to frame and writes it as one looping SVG animation:
 * numbers and transforms glide, other values switch */
class SvgRecorder {
  #roots: Element[];
  #times: number[] = []; // when each frame starts, ms
  #duration = 0;
  #tracks = new Map<Element, Track>();

  constructor(roots: Element[]) {
    this.#roots = roots;
  }

  capture(delay: number): void {
    const frame = this.#times.length;
    this.#times.push(this.#duration);
    this.#duration += delay;
    const walk = (parent: Element): void => {
      for (const element of parent.children) {
        let track = this.#tracks.get(element);
        if (!track) {
          const text = element.childElementCount ? null : element.textContent;
          track = { element, parent, text, frames: new Map() };
          this.#tracks.set(element, track);
        }
        const attributes: Record<string, string> = {};
        for (const { name, value } of element.attributes) if (!IGNORED.has(name)) attributes[name] = value;
        track.frames.set(frame, attributes);
        walk(element);
      }
    };
    for (const root of this.#roots) walk(root);
  }

  /** The roots with their recorded content; the last frame stays `endDelay` ms */
  write(endDelay: number): string {
    const total = this.#duration + endDelay;
    const keyTimes = this.#times.map(time => (time / total).toFixed(5));
    const timing = `dur="${Math.round(total)}ms" repeatCount="indefinite"`;
    const children = new Map<Element, Track[]>();
    for (const track of this.#tracks.values()) {
      if (!children.has(track.parent)) children.set(track.parent, []);
      children.get(track.parent)!.push(track);
    }

    // values in every frame: before and after its time an element keeps its first and last ones, unseen
    const series = (track: Track, name: string): string[] => {
      const values: (string | null)[] = this.#times.map((_, frame) => {
        const attributes = track.frames.get(frame);
        return attributes ? attributes[name] || (DEFAULTS[name] ?? "") : null; // an empty value is the default
      });
      let held = values.find(value => value !== null)!;
      return values.map(value => {
        if (value !== null) held = value;
        return held;
      });
    };

    const discrete = (name: string, values: string[]): string => {
      const steps = values.flatMap((value, i) => (i && value === values[i - 1] ? [] : [i]));
      return `<animate attributeName="${name}" ${timing} calcMode="discrete" values="${steps.map(i => escapeHtml(values[i])).join(";")}" keyTimes="${steps.map(i => keyTimes[i]).join(";")}"/>`;
    };

    // a value on the straight way between its neighbours is not needed to glide
    const linear = (tag: string, attributes: string, values: string[]): string => {
      const all = [...values, values[values.length - 1]];
      const times = [...this.#times, total];
      const numbers = all.map(value => value.split(" ").map(Number));
      // does the glide from one value to another pass this one
      const passes = (from: number, to: number, i: number): boolean => {
        const share = (times[i] - times[from]) / (times[to] - times[from]);
        return numbers[i].every(
          (n, k) => Math.abs(numbers[from][k] + (numbers[to][k] - numbers[from][k]) * share - n) < TOLERANCE
        );
      };
      const kept = [0];
      for (let i = 1; i < all.length - 1; i++) {
        const from = kept[kept.length - 1];
        for (let j = from + 1; j <= i; j++) {
          if (passes(from, i + 1, j)) continue;
          kept.push(i);
          break;
        }
      }
      kept.push(all.length - 1);
      const keyTimes = kept.map(i => (i < all.length - 1 ? (times[i] / total).toFixed(5) : "1"));
      return `<${tag} ${attributes} ${timing} values="${kept.map(i => all[i]).join(";")}" keyTimes="${keyTimes.join(";")}"/>`;
    };

    const transform = (values: string[]): string => {
      const parts = values.map(value => TRANSFORM.exec(value.trim()));
      if (parts.some(part => !part)) return discrete("transform", values);
      const moves = parts.some(part => part![1] !== undefined);
      let animations = moves
        ? linear(
            "animateTransform",
            `attributeName="transform" type="translate"`,
            parts.map(part => `${part![1] ?? 0} ${part![2] ?? 0}`)
          )
        : "";
      // a turn takes the short way round
      let angle = 0;
      const angles = parts.map((part, i) => {
        const next = Number(part![3] ?? 0);
        angle = i ? angle + ((((next - angle) % 360) + 540) % 360) - 180 : next;
        return angle.toFixed(1);
      });
      if (parts.some(part => part![3] !== undefined)) {
        const sum = moves ? ` additive="sum"` : "";
        animations += linear("animateTransform", `attributeName="transform" type="rotate"${sum}`, angles);
      }
      return animations;
    };

    const write = (track: Track): string => {
      const shown = this.#times.map((_, frame) => track.frames.has(frame));
      const names = new Set([...track.frames.values()].flatMap(attributes => Object.keys(attributes)));
      if (shown.some(seen => !seen)) names.add("display");
      let attributes = "";
      let animations = "";
      for (const name of names) {
        let values = series(track, name);
        if (name === "display") values = values.map((value, frame) => (shown[frame] ? value : "none"));
        const constant = values.every(value => value === values[0]);
        if (constant) {
          if (values[0] !== (DEFAULTS[name] ?? "")) attributes += ` ${name}="${escapeHtml(values[0])}"`;
        } else if (name === "transform") animations += transform(values);
        else if (values.every(value => NUMBER.test(value)))
          animations += linear("animate", `attributeName="${name}"`, values);
        else animations += discrete(name, values);
      }
      const tag = track.element.tagName;
      const content = (children.get(track.element) ?? []).map(write).join("") + escapeHtml(track.text ?? "");
      return `<${tag}${attributes}>${animations}${content}</${tag}>`;
    };

    return this.#roots
      .map(root => {
        const attributes = [...root.attributes].map(({ name, value }) => ` ${name}="${escapeHtml(value)}"`).join("");
        return `<${root.tagName}${attributes}>${(children.get(root) ?? []).map(write).join("")}</${root.tagName}>`;
      })
      .join("");
  }
}
