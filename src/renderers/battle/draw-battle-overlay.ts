// What stays put over the battle field while the view moves: the title and clock, the scale bar and the North arrow

import type { BattleLook } from "@/data/battle-options";
import { VIEW_ASPECT } from "@/model/political/battle/battle-scale";
import { getLengthUnit } from "@/model/units";
import { escapeHtml } from "@/utils/string-utils";

/** The overlay is drawn in points of a view 1000 wide, in the scene's proportions */
export const OVERLAY_WIDTH = 1000;
export const OVERLAY_HEIGHT = OVERLAY_WIDTH / VIEW_ASPECT;
const INK = "#3d3a33";
const HALO = `paint-order="stroke" stroke="#fbf5e9" stroke-width="3" stroke-linejoin="round"`;
const RESCALE = 0.03; // the scale bar is redrawn when the view's width changed by more than this share

export interface OverlayState {
  title: string;
  clock: string;
  viewWidth: number; // metres in sight across
  look: BattleLook;
}

const NORTH = /* html */ `<g transform="translate(${OVERLAY_WIDTH - 28} 34)" fill="none" stroke="${INK}" stroke-width="1.5">
    <path d="M0 16V-16M-5 -8L0 -16L5 -8"/><text y="30" text-anchor="middle" font-size="13" fill="${INK}" stroke="none" font-weight="bold">N</text>
  </g>`;

class BattleOverlayRenderer {
  private readonly scaled = new WeakMap<SVGSVGElement, number>(); // the view's width the scale bar was drawn for
  private readonly markups = new WeakMap<Element, string>();

  /** Each part is drawn anew only when it changes, so an animation records it as switches */
  draw(svg: SVGSVGElement, { title, clock, viewWidth, look }: OverlayState): void {
    if (!svg.childElementCount) {
      svg.setAttribute("viewBox", `0 0 ${OVERLAY_WIDTH} ${OVERLAY_HEIGHT}`);
      svg.innerHTML = ["Title", "Clock", "Scale", "North"].map(part => `<g id="battleOverlay${part}"></g>`).join("");
    }
    const drawn = this.scaled.get(svg);
    const width = drawn && Math.abs(viewWidth - drawn) < drawn * RESCALE ? drawn : viewWidth;
    this.scaled.set(svg, width);

    const text = (y: number, size: number, value: string, bold = false): string =>
      `<text x="14" y="${y}" font-size="${size}" ${bold ? `font-weight="bold"` : ""} fill="${INK}" ${HALO}>${escapeHtml(value)}</text>`;
    this.put(svg, "#battleOverlayTitle", look.title ? text(26, 16, title, true) : "");
    this.put(svg, "#battleOverlayClock", look.title ? text(44, 13, clock) : "");
    this.put(svg, "#battleOverlayScale", look.scale ? this.getScaleBar(width) : "");
    this.put(svg, "#battleOverlayNorth", look.north ? NORTH : "");
  }

  private put(svg: SVGSVGElement, selector: string, markup: string): void {
    const group = svg.querySelector(selector)!;
    if (this.markups.get(group) === markup) return;
    this.markups.set(group, markup);
    group.innerHTML = markup;
  }

  /** A round length in the user's units near a sixth of the view, ticked at its ends and middle, by the North arrow */
  private getScaleBar(viewWidth: number): string {
    const most = viewWidth / 6;
    const unit = getLengthUnit(most);
    const power = 10 ** Math.floor(Math.log10(most / unit.metres));
    const count = [5, 2, 1].map(k => k * power).find(size => size * unit.metres <= most) ?? power;
    const span = (count * unit.metres * OVERLAY_WIDTH) / viewWidth;
    return /* html */ `<g transform="translate(${(OVERLAY_WIDTH - 52 - span).toFixed(1)} 46)" fill="none" stroke="${INK}" stroke-width="1.5">
        <path d="M0 -5V0H${span.toFixed(1)}V-5M${(span / 2).toFixed(1)} 0V-3"/>
        <text x="${(span / 2).toFixed(1)}" y="-9" text-anchor="middle" font-size="12" fill="${INK}" stroke="none">${+count.toPrecision(3)} ${unit.name}</text>
      </g>`;
  }
}

export const BattleOverlayView = new BattleOverlayRenderer();
