import { rgb } from "d3";
import type { BattleLook, BattleOptions } from "@/data/battle-options";
import { type Battle, Battles } from "@/model/political/battle/battle";
import { TICK_SECONDS } from "@/model/political/battle/battle-scale";
import type { Battlefield } from "@/model/political/battle/battlefield";
import type { BattleStart } from "@/model/political/battle/replay";
import { BattleTime } from "@/model/political/battle/time";
import { BattleCamera, type Camera, type View } from "@/renderers/battle/battle-camera";
import { LAMP } from "@/renderers/battle/draw-battle-light";
import { BattleOverlayView, OVERLAY_HEIGHT, OVERLAY_WIDTH } from "@/renderers/battle/draw-battle-overlay";
import {
  BattleSceneView,
  MOVING_LAYERS,
  type SideColors,
  type StateColors
} from "@/renderers/battle/draw-battle-scene";
import { downloadFile } from "@/utils/file-utils";
import { t } from "@/utils/i18n";
import { log } from "@/utils/logger";
import { escapeHtml } from "@/utils/string-utils";

/** What the screen hands an export: the battle from its start, and how it is drawn on screen */
export interface BattleSource {
  fileName: string;
  title: string;
  start: () => BattleStart;
  tickMs: number; // at normal speed
  screenWidth: number; // of the field on screen, in device pixels
  look: BattleLook;
  colors: SideColors;
  flags: StateColors;
}

export type ExportChoice = BattleOptions["export"];
export type Progress = (share: number, status: string) => void;
type Quality = ExportChoice["quality"];

const FRAME_MS = 50; // aimed at: GIF delays are in hundredths of a second, short ones play slower
const END_MS = 3000; // the outcome stands before the loop starts again
export const MIN_DELAY_MS = 20; // GIF viewers slow shorter frames down
const LEAST_FRONTS = 6; // the camera's narrowest view, in battalion fronts: the ground is drawn sharp enough for it
const GROUND_MOST = 4096; // pixels the ground of a GIF is drawn wide at the most
const WIDTHS: Record<Exclude<Quality, "high">, number> = { low: 600, medium: 1000 }; // high is as sharp as the screen
const MAX_WIDTH = 2000; // pixels

interface RecordOptions {
  gif: GifWriter | null; // none for an animated SVG
  width: number; // of an image
  tickMs: number; // a tick's length
  signal: AbortSignal;
  camera: ExportChoice["camera"];
  source: BattleSource;
  onTick: (tick: number) => void;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const xml = new XMLSerializer();

const SVG_WIDTH = 1000; // pixels an animated drawing opens at

/** A GIF made frame by frame: each frame keeps only what changed since the one before */
interface GifWriter {
  add(canvas: HTMLCanvasElement, delay: number): void;
  finish(endDelay: number): Blob;
}

/** A scene of the battle off screen with its camera and overlay */
export interface Stage {
  svg: SVGSVGElement;
  overlay: SVGSVGElement;
  ground: string; // the field's markup
  readonly defs: string; // the symbols and the look the battalions use
  readonly view: View;
  placeBattalions(): void;
  frame(elapsed: number): void;
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
 * numbers and transforms glide, other values switch; the camera's view box glides too */
class SvgRecorder {
  #roots: Element[];
  #camera: Element;
  #views: string[] = [];
  #times: number[] = []; // when each frame starts, ms
  #duration = 0;
  #tracks = new Map<Element, Track>();

  constructor(roots: Element[], camera: Element) {
    this.#roots = roots;
    this.#camera = camera;
  }

  capture(delay: number): void {
    const frame = this.#times.length;
    this.#times.push(this.#duration);
    this.#duration += delay;
    this.#views.push(this.#camera.getAttribute("viewBox")!);
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

  /** The camera's view box over the frames */
  writeView(endDelay: number): string {
    const views = this.#views;
    return views.every(view => view === views[0])
      ? ""
      : this.#linear("animate", `attributeName="viewBox"`, views, this.#duration + endDelay);
  }

  // a value on the straight way between its neighbours is not needed to glide
  #linear(tag: string, attributes: string, values: string[], total: number): string {
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
    const timing = `dur="${Math.round(total)}ms" repeatCount="indefinite"`;
    return `<${tag} ${attributes} ${timing} values="${kept.map(i => all[i]).join(";")}" keyTimes="${keyTimes.join(";")}"/>`;
  }

  /** Each root with its recorded content; the last frame stays `endDelay` ms */
  write(endDelay: number): string[] {
    const total = this.#duration + endDelay;
    const keyTimes = this.#times.map(time => (time / total).toFixed(5));
    const timing = `dur="${Math.round(total)}ms" repeatCount="indefinite"`;
    const linear = (tag: string, attributes: string, values: string[]): string =>
      this.#linear(tag, attributes, values, total);
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

    return this.#roots.map(root => {
      const attributes = [...root.attributes].map(({ name, value }) => ` ${name}="${escapeHtml(value)}"`).join("");
      return `<${root.tagName}${attributes}>${(children.get(root) ?? []).map(write).join("")}</${root.tagName}>`;
    });
  }
}

class BattleAnimationExport {
  /** How many times as fast as the battle it plays at a speed */
  getPlayback(tickMs: number, speed: number): number {
    return Math.round((TICK_SECONDS * 1000 * speed) / tickMs);
  }

  /** The size of a file, as people read it */
  formatSize(size: number): string {
    return size > 1048576 ? `${(size / 1048576).toFixed(1)} MB` : `${Math.ceil(size / 1024)} KB`;
  }

  /** Record the battle from its start to the end and download it; false when stopped */
  async save(source: BattleSource, choice: ExportChoice, signal: AbortSignal, onProgress: Progress): Promise<boolean> {
    const format = choice.format === "svg" ? "svg" : "gif";
    const tickMs = Math.max(source.tickMs / (choice.speed || 1), MIN_DELAY_MS);
    const width =
      choice.quality === "high"
        ? Math.min(Math.max(Math.round(source.screenWidth), 1000), MAX_WIDTH)
        : WIDTHS[choice.quality];

    // a quick run to the end tells how long the battle is
    const probe = source.start();
    Battles.replay(probe.battle, probe.script, probe.settled, probe.until);
    const ticks = Math.max(probe.battle.tick, 1);
    const end = BattleTime.formatClock(probe.battle.hour, ticks);

    onProgress(0, "");
    const started = performance.now();
    try {
      const gif = format === "gif" ? await this.createGifWriter() : null;
      const file = await this.recordBattle(source.start(), {
        gif,
        width,
        tickMs,
        signal,
        camera: choice.camera,
        source,
        onTick: tick => onProgress(tick / ticks, `${BattleTime.formatClock(probe.battle.hour, tick)} / ${end}`)
      });
      if (!file) {
        onProgress(0, t("Cancelled"));
        return false;
      }
      downloadFile(file, `${source.fileName}.${format}`, file.type);
      const seconds = Math.round((performance.now() - started) / 100) / 10;
      onProgress(1, t("Saved: {{size}} in {{seconds}} s", { size: this.formatSize(file.size), seconds }));
      return true;
    } catch (error) {
      log.error(error);
      onProgress(0, t("Cannot make the animation"));
      return false;
    }
  }

  markup(nodes: Element[]): string {
    return nodes.map(node => xml.serializeToString(node)).join("");
  }

  /** A scene of the battle off screen, drawn as on screen, with its camera and overlay */
  createStage(battle: Battle, source: BattleSource, mode: ExportChoice["camera"]): Stage {
    const svg = document.createElementNS(SVG_NS, "svg");
    const overlay = document.createElementNS(SVG_NS, "svg");
    BattleSceneView.setLook(svg, source.look, source.colors, source.flags);
    BattleSceneView.drawField(svg, battle.field, battle.scene);
    BattleSceneView.drawLight(svg, battle);
    let camera: Camera = BattleCamera.create(battle.field);
    const icons = new Set<string>();
    let defs = "";
    return {
      svg,
      overlay,
      ground: this.markup([...svg.children].filter(node => !MOVING_LAYERS.includes(node.id))), // the moving layers are recorded apart
      get defs(): string {
        return defs;
      },
      get view(): View {
        return camera.view;
      },
      /** Battalions drawn anew, with the unit icons a file has to carry: they are symbols of the page */
      placeBattalions: (): void => {
        BattleSceneView.drawBattalions(svg, battle, this.noop);
        for (const use of svg.querySelectorAll("use")) icons.add(use.getAttribute("href")!.slice(1));
        const style = svg.querySelector("#battleLook")?.outerHTML ?? "";
        defs = `${style}<defs>${this.markup([...icons].flatMap(id => document.getElementById(id) ?? []))}</defs>`;
      },
      /** The camera `elapsed` seconds on, and the overlay for the moment */
      frame: (elapsed: number): void => {
        camera = BattleCamera.move(camera, battle.field, BattleCamera.toCameraTroops(battle.battalions), mode, elapsed);
        BattleSceneView.setView(svg, battle.field, camera.view);
        BattleSceneView.drawLight(svg, battle); // the tint goes with the hour; the ground was taken at the start
        const clock = BattleTime.formatClock(battle.hour, battle.tick);
        BattleOverlayView.draw(overlay, {
          title: source.title,
          clock,
          viewWidth: camera.view.width,
          look: source.look
        });
      }
    };
  }

  /** Play a battle set up anew from its start to the end into a looping animation */
  private async recordBattle(
    { battle, script, settled, until = Infinity }: BattleStart,
    { gif, width, tickMs, signal, camera, source, onTick }: RecordOptions
  ): Promise<Blob | null> {
    Battles.applyDue(battle, script);
    Battles.plan(battle, settled); // the first frame shows the troops as the generals drew them up
    const stage = this.createStage(battle, source, camera);
    stage.placeBattalions();
    BattleSceneView.updateBattalions(stage.svg, battle, null, 1);
    stage.frame(Infinity); // framed from the first frame

    const layers = MOVING_LAYERS.map(id => stage.svg.querySelector(`#${id}`)!);
    const overlays = [...stage.overlay.children];
    const recorder = new SvgRecorder([...layers, ...overlays], stage.svg);
    const addFrame = gif
      ? await this.createRasterSink(
          gif,
          battle.field,
          width,
          camera === "field" ? 1 : this.getMostZoom(battle.field),
          stage
        )
      : async (delay: number) => recorder.capture(delay);

    const frames = Math.max(1, Math.round(tickMs / FRAME_MS));
    const delay = tickMs / frames;
    await addFrame(delay);
    while (!battle.result && battle.tick < until) {
      if (signal.aborted) return null;
      const previous = BattleSceneView.snapshot(battle);
      const battalions = battle.battalions.length;
      Battles.applyDue(battle, script);
      if (battle.battalions.length !== battalions) stage.placeBattalions(); // a recorded reinforcement
      Battles.tick(battle);
      for (let frame = 1; frame <= frames; frame++) {
        BattleSceneView.updateBattalions(stage.svg, battle, previous, frame / frames);
        stage.frame(delay / 1000);
        await addFrame(delay);
      }
      onTick(battle.tick);
      if (!gif) await new Promise(resolve => setTimeout(resolve)); // a drawing has no image to wait for
    }

    if (gif) return gif.finish(END_MS);
    const recorded = recorder.write(END_MS);
    const scene = recorded.slice(0, layers.length).join("");
    const overlay = recorded.slice(layers.length).join("");
    const svgFile = `<svg xmlns="${SVG_NS}" viewBox="0 0 ${OVERLAY_WIDTH} ${OVERLAY_HEIGHT}" width="${SVG_WIDTH}" height="${(SVG_WIDTH * OVERLAY_HEIGHT) / OVERLAY_WIDTH}" font-family="Georgia, serif"><svg viewBox="${stage.svg.getAttribute("viewBox")}" width="${OVERLAY_WIDTH}" height="${OVERLAY_HEIGHT}">${recorder.writeView(END_MS)}${stage.ground}${stage.defs}${scene}</svg>${overlay}</svg>`;
    return new Blob([svgFile], { type: "image/svg+xml" });
  }

  private getHeight(width: number): number {
    return Math.round((width * OVERLAY_HEIGHT) / OVERLAY_WIDTH);
  }

  /** How many times the camera may zoom in on the field at the most */
  private getMostZoom(field: Battlefield): number {
    return Math.max(field.width / (field.front * LEAST_FRONTS), 1);
  }

  /** The scene as an image in the view's part of the field, the overlay over it */
  private getFrameMarkup(view: View, width: number, content: string, overlay: string): string {
    return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${OVERLAY_WIDTH} ${OVERLAY_HEIGHT}" width="${width}" height="${this.getHeight(width)}" font-family="Georgia, serif"><svg viewBox="${view.x} ${view.y} ${view.width} ${view.height}" width="${OVERLAY_WIDTH}" height="${OVERLAY_HEIGHT}">${content}</svg>${overlay}</svg>`;
  }

  /** Draws a frame as the part of the ground in view under the moving layers and the overlay, and adds it to the GIF */
  private async createRasterSink(gif: GifWriter, field: Battlefield, width: number, zoom: number, stage: Stage) {
    // drawn once, sharp enough for the closest view, under every frame
    const groundWidth = Math.min(Math.round(width * zoom), Math.max(GROUND_MOST, width));
    const scene = BattleCamera.getSceneBox(field);
    const ground = await this.loadImage(
      `<svg xmlns="${SVG_NS}" viewBox="${scene.x} ${scene.y} ${scene.width} ${scene.height}" width="${groundWidth}" height="${Math.round((groundWidth * scene.height) / scene.width)}">${stage.ground}</svg>`
    );
    const scale = ground.width / scene.width;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = this.getHeight(width);
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    // the light multiplies what lies under it, which an image of its own would not have: it is laid on the canvas
    const moving = MOVING_LAYERS.filter(id => id !== "battleLight").map(id => stage.svg.querySelector(`#${id}`)!);
    const light = document.createElement("canvas");
    [light.width, light.height] = [canvas.width, canvas.height];
    return async (delay: number): Promise<void> => {
      const { view } = stage;
      const [x, y, w, h] = [view.x - scene.x, view.y - scene.y, view.width, view.height].map(value => value * scale);
      context.drawImage(ground, x, y, w, h, 0, 0, canvas.width, canvas.height);
      const frame = this.getFrameMarkup(view, width, stage.defs + this.markup(moving), "");
      context.drawImage(await this.loadImage(frame), 0, 0);
      this.drawLight(light, stage.svg, view);
      context.globalCompositeOperation = "multiply";
      context.drawImage(light, 0, 0);
      context.globalCompositeOperation = "source-over";
      const overlay = this.getFrameMarkup(view, width, "", this.markup([...stage.overlay.children]));
      context.drawImage(await this.loadImage(overlay), 0, 0);
      gif.add(canvas, delay);
    };
  }

  /** The tint of the hour with the battalions' glows over it, as the scene's light layer has them, in view */
  private drawLight(canvas: HTMLCanvasElement, svg: SVGSVGElement, view: View): void {
    const context = canvas.getContext("2d")!;
    context.fillStyle = svg.querySelector("#battleTint")!.getAttribute("fill")!;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = canvas.width / view.width;
    for (const lamp of svg.querySelectorAll("#battleLamps circle")) {
      const [cx, cy, r, opacity] = ["cx", "cy", "r", "opacity"].map(name => +lamp.getAttribute(name)!);
      const [x, y, radius] = [(cx - view.x) * scale, (cy - view.y) * scale, r * scale];
      const glow = context.createRadialGradient(x, y, 0, x, y, radius);
      for (const [offset, color, alpha] of LAMP.stops) {
        const { r: red, g, b } = rgb(color);
        glow.addColorStop(offset, `rgba(${red}, ${g}, ${b}, ${alpha * opacity})`);
      }
      context.fillStyle = glow;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  }

  private readonly noop = (): void => {};

  private async loadImage(markup: string): Promise<HTMLImageElement> {
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

  /** GIF in the 255 colours of the first frame; each next frame writes only the pixels that changed */
  private async createGifWriter(): Promise<GifWriter> {
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
}

export const BattleAnimation = new BattleAnimationExport();
