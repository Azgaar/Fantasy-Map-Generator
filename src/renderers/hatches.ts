import { findEl } from "@/utils/node-utils";

// Colored hatchings: a base pattern from #defs-hatching recolored on demand, "url(#hatch3-c0392b)"
const HATCH_FILL = /^url\(#(hatch\d+)(?:-([\da-f]{6}))?\)$/;
const BASE_ID = /^hatch\d+$/;
const BLACK = "#000000";

class HatchPatterns {
  /** The fill for a hatching in a HEX color; black is the base pattern itself */
  fill(hatch: string, color: string): string {
    return color === BLACK ? `url(#${hatch})` : `url(#${hatch}-${color.slice(1)})`;
  }

  /** The base patterns, without the recolored copies appended next to them */
  bases(): SVGPatternElement[] {
    return Array.from(document.querySelectorAll<SVGPatternElement>("#defs-hatching > pattern")).filter(({ id }) =>
      BASE_ID.test(id)
    );
  }

  /** Split a hatching fill into its base pattern id and HEX color; null for any other fill */
  parse(fill: string): { hatch: string; color: string } | null {
    const match = fill.match(HATCH_FILL);
    return match ? { hatch: match[1], color: match[2] ? `#${match[2]}` : BLACK } : null;
  }

  /** Copy a base hatching pattern drawing with `color` instead of black */
  recolor(base: SVGPatternElement, id: string, color: string): SVGPatternElement {
    const pattern = base.cloneNode(true) as SVGPatternElement;
    pattern.id = id;
    for (const element of pattern.querySelectorAll<SVGElement>("*")) {
      if (element.style.stroke) element.style.stroke = color;
      if (element.style.fill) element.style.fill = color;
    }
    return pattern;
  }

  /** Create the pattern a colored hatching fill refers to, if it is missing */
  ensure(fill: string): void {
    const parsed = this.parse(fill);
    if (!parsed || parsed.color === BLACK) return;
    const id = fill.slice(5, -1);
    const base = findEl<SVGPatternElement>(parsed.hatch);
    if (!base || findEl(id)) return;
    base.parentElement!.append(this.recolor(base, id, parsed.color));
  }

  /** Create the patterns of every colored hatching among the fills */
  ensureAll(fills: Iterable<unknown>): void {
    for (const fill of new Set(fills)) if (typeof fill === "string") this.ensure(fill);
  }
}

export const Hatches = new HatchPatterns();
