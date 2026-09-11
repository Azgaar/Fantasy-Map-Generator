// The instrument every brush tool over the map shares
import { type D3DragEvent, drag, pointer, select } from "d3";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { moveCircle, removeCircle } from "@/renderers/overlays/brush-circle";
import type { Point } from "@/types/global";
import { ensureEl, minmax } from "@/utils";
import { createBrushStroke } from "@/utils/brushUtils";

/** what one stroke does with the points it passes over; the tool keeps its per-stroke state in the closure */
type Stamp = (point: Point) => void;

interface MapBrushOptions {
  /** id of the size input; the hotkey module finds the brush in use by it */
  id: string;
  radius?: number;
  min?: number;
  max?: number;
  /** how much the + and − keys change the radius */
  keyStep?: number;
  label?: string;
  /** distance between stamps along a stroke; 0 hands over every pointer event instead */
  spacing?: (radius: number) => number;
  /** stamp where the stroke begins, before any movement. Off for a tool whose click means something else */
  stampOnStart?: boolean;
  /** a stroke begins: return what to do with the points it covers */
  onStart?: (point: Point, radius: number) => Stamp | undefined;
  onEnd?: (radius: number) => void;
  /** the pointer moved, hovering or dragging; called at most once per animation frame */
  onMove?: (point: Point, radius: number) => void;
  /** a click that did not turn into a stroke */
  onClick?: (point: Point) => void;
  onResize?: (radius: number) => void;
}

export class MapBrush {
  readonly markup: string;

  private options: Required<Pick<MapBrushOptions, "id" | "min" | "max" | "spacing">> & MapBrushOptions;
  private currentRadius: number;
  private currentPoint: Point = [0, 0];
  private space = false; // space + drag pans the map instead of painting
  private frame = 0;
  private events: AbortController | null = null;

  constructor(options: MapBrushOptions) {
    const { id, min = 1, max = 100, keyStep = 5, label = "Radius:", spacing = (r: number) => r / 2 } = options;
    this.options = { ...options, id, min, max, spacing };
    this.currentRadius = minmax(options.radius ?? 12, min, max);

    this.markup = /* html */ `<div data-tip="Change brush size. Shortcut: Shift + drag on the map, or + and −">
      <slider-input id="${id}" min="${min}" max="${max}" step="1" value="${this.currentRadius}" data-key-step="${keyStep}"
        >${label}</slider-input>
    </div>`;
  }

  get radius(): number {
    return this.currentRadius;
  }

  get pointer(): Point {
    return this.currentPoint;
  }

  attach(): void {
    this.events = new AbortController();
    const { signal } = this.events;

    ensureEl(this.options.id).addEventListener(
      "input",
      event => {
        if (event.target === event.currentTarget) this.resize(Number((event.target as HTMLInputElement).value));
      },
      { signal }
    );
    document.addEventListener("keydown", this.trackSpace, { signal });
    document.addEventListener("keyup", this.trackSpace, { signal });
    window.addEventListener("blur", this.releaseSpace, { signal });

    const viewbox = select<SVGGElement, unknown>("#viewbox")
      .style("cursor", "crosshair")
      .on("touchmove mousemove", (event: MouseEvent | TouchEvent) => {
        this.currentPoint = this.at(event);
        this.refresh();
      })
      .call(
        drag<SVGGElement, unknown>()
          .container(() => ensureEl<SVGGElement>("viewbox"))
          .filter(event => !this.space && !event.button)
          .on("start", (event: D3DragEvent<SVGGElement, unknown, unknown>) => this.start(event))
      );

    // a brush owns the clicks over the map: either the tool handles them or nothing does
    const { onClick } = this.options;
    if (onClick) viewbox.on("click", (event: MouseEvent) => onClick(this.at(event)));
    else viewbox.on("click", null);
  }

  detach(): void {
    this.events?.abort();
    this.events = null;
    this.space = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;

    removeCircle();
    applyDefaultViewboxEvents();
  }

  resize(value: number): void {
    if (!Number.isFinite(value)) return;
    const { id, min, max } = this.options;

    this.currentRadius = minmax(Math.round(value), min, max);
    ensureEl<HTMLInputElement>(id).value = String(this.currentRadius);
    this.options.onResize?.(this.currentRadius);
    this.refresh();
  }

  /** the circle and the tool's overlay follow the pointer, at most once per animation frame */
  refresh(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      moveCircle(...this.currentPoint, this.currentRadius);
      this.options.onMove?.(this.currentPoint, this.currentRadius);
    });
  }

  private start(event: D3DragEvent<SVGGElement, unknown, unknown>): void {
    if ((event.sourceEvent as MouseEvent).shiftKey) {
      this.resizeGesture(event);
      return;
    }

    const radius = this.currentRadius; // the size is frozen for the stroke
    const origin: Point = [event.x, event.y];
    this.currentPoint = origin;

    const stamp = this.options.onStart?.(origin, radius);
    const step = this.options.spacing(radius);
    const stroke = stamp && step > 0 ? createBrushStroke(step, (x, y) => stamp([x, y])) : null;
    let started = false;

    if (stroke && this.options.stampOnStart !== false) {
      stroke.moveTo(...origin);
      started = true;
    }
    this.refresh();

    event
      .on("drag", (event: D3DragEvent<SVGGElement, unknown, unknown>) => {
        if (!event.dx && !event.dy) return;
        this.currentPoint = [event.x, event.y];

        if (stroke) {
          if (!started) {
            started = true; // a stroke held back at the start still begins where the pointer went down
            stroke.moveTo(...origin);
          }
          stroke.moveTo(...this.currentPoint);
        } else stamp?.(this.currentPoint);

        this.refresh();
      })
      .on("end", () => this.options.onEnd?.(radius));
  }

  /** shift + drag sizes the brush instead of painting: right and up grow it, left and down shrink it */
  private resizeGesture(event: D3DragEvent<SVGGElement, unknown, unknown>): void {
    const [from, origin] = [this.currentRadius, [event.x, event.y]];
    this.currentPoint = [event.x, event.y];
    event.on("drag", ({ x, y }: D3DragEvent<SVGGElement, unknown, unknown>) =>
      this.resize(from + (x - origin[0]) - (y - origin[1]))
    );
  }

  private trackSpace = (event: KeyboardEvent): void => {
    if (event.code === "Space") this.space = event.type === "keydown";
  };

  private releaseSpace = (): void => {
    this.space = false;
  };

  private at = (event: MouseEvent | TouchEvent): Point => pointer(event, ensureEl("viewbox")) as Point;
}
