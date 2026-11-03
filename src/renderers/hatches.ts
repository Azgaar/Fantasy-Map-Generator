import { findEl } from "@/utils/node-utils";

// Colored hatchings: a base pattern from #defs-hatching recolored on demand, "url(#hatch3-c0392b)"
const HATCH_FILL = /^url\(#(hatch\d+)(?:-([\da-f]{6}))?(?:-s(50|[6-9]\d|1\d\d|200))?\)$/;
const BASE_ID = /^hatch\d+$/;
const BLACK = "#000000";
const DEFAULT_SIZE = 100;

class HatchPatterns {
  /** The fill for a hatching in a HEX color and tile size */
  fill(hatch: string, color: string, size = DEFAULT_SIZE): string {
    const colorId = color === BLACK ? "" : `-${color.slice(1)}`;
    const sizeId = size === DEFAULT_SIZE ? "" : `-s${size}`;
    return `url(#${hatch}${colorId}${sizeId})`;
  }

  /** The base patterns, without the recolored copies appended next to them */
  bases(): SVGPatternElement[] {
    return Array.from(document.querySelectorAll<SVGPatternElement>("#defs-hatching > pattern")).filter(({ id }) =>
      BASE_ID.test(id)
    );
  }

  /** Split a hatching fill into its base pattern id and HEX color; null for any other fill */
  parse(fill: string): { hatch: string; color: string; size: number } | null {
    const match = fill.match(HATCH_FILL);
    return match
      ? { hatch: match[1], color: match[2] ? `#${match[2]}` : BLACK, size: match[3] ? Number(match[3]) : DEFAULT_SIZE }
      : null;
  }

  /** Copy a base hatch with the requested color and tile size */
  recolor(base: SVGPatternElement, id: string, color: string, size = DEFAULT_SIZE): SVGPatternElement {
    const pattern = base.cloneNode(true) as SVGPatternElement;
    pattern.id = id;
    for (const element of pattern.querySelectorAll<SVGElement>("*")) {
      if (element.style.stroke) element.style.stroke = color;
      if (element.style.fill) element.style.fill = color;
    }
    if (size !== DEFAULT_SIZE) {
      const transform = pattern.getAttribute("patternTransform") ?? "";
      pattern.setAttribute("patternTransform", `${transform} scale(${size / DEFAULT_SIZE})`.trim());
    }
    return pattern;
  }

  /** Create the colored or scaled hatch pattern a fill refers to, if it is missing */
  ensure(fill: string): void {
    const parsed = this.parse(fill);
    if (!parsed || (parsed.color === BLACK && parsed.size === DEFAULT_SIZE)) return;
    const id = fill.slice(5, -1);
    const base = findEl<SVGPatternElement>(parsed.hatch);
    if (!base || findEl(id)) return;
    base.parentElement!.append(this.recolor(base, id, parsed.color, parsed.size));
  }

  /** Create the patterns of every colored hatching among the fills */
  ensureAll(fills: Iterable<unknown>): void {
    for (const fill of new Set(fills)) if (typeof fill === "string") this.ensure(fill);
  }
}

export const Hatches = new HatchPatterns();
