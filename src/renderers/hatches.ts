import { HATCH_FILL } from "@/utils/color-utils";
import { findEl } from "@/utils/node-utils";

// Derived hatchings: a base pattern from #defs-hatching recolored and scaled on demand, "url(#hatch3-c0392b-s150)"
const BASE_ID = /^hatch\d+$/;
const BLACK = "#000000";
const DEFAULT_SIZE = 100;

class HatchPatterns {
  /** The fill for a hatching in a HEX color and tile size in %; black at 100% is the base pattern itself */
  fill(hatch: string, color: string, size = DEFAULT_SIZE): string {
    const colorId = color === BLACK ? "" : `-${color.slice(1)}`;
    const sizeId = size === DEFAULT_SIZE ? "" : `-s${size}`;
    return `url(#${hatch}${colorId}${sizeId})`;
  }

  /** The base patterns, without the derived copies appended next to them */
  bases(): SVGPatternElement[] {
    return this.#patterns().filter(({ id }) => BASE_ID.test(id));
  }

  /** Split a hatching fill into its base pattern id, HEX color and tile size; null for any other fill */
  parse(fill: string): { hatch: string; color: string; size: number } | null {
    const match = fill.match(HATCH_FILL);
    if (!match) return null;
    return { hatch: match[1], color: match[2] ? `#${match[2]}` : BLACK, size: match[3] ? +match[3] : DEFAULT_SIZE };
  }

  /** Copy a base hatching pattern drawing with `color` instead of black, its tile scaled to `size` % */
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

  /** Create the pattern a derived hatching fill refers to, if it is missing */
  ensure(fill: string): void {
    const parsed = this.parse(fill);
    if (!parsed) return;
    const id = fill.slice(5, -1);
    const base = findEl<SVGPatternElement>(parsed.hatch);
    if (!base || findEl(id)) return;
    base.parentElement!.append(this.recolor(base, id, parsed.color, parsed.size));
  }

  /** Create the derived patterns the map data uses and remove the ones it no longer does */
  sync(): void {
    const used = new Set(getMapFills());
    for (const fill of used) this.ensure(fill);
    for (const pattern of this.#patterns()) {
      if (!BASE_ID.test(pattern.id) && !used.has(`url(#${pattern.id})`)) pattern.remove();
    }
  }

  #patterns(): SVGPatternElement[] {
    return Array.from(document.querySelectorAll<SVGPatternElement>("#defs-hatching > pattern"));
  }
}

export const Hatches = new HatchPatterns();

// read from data, not the svg: hidden layers draw no paths
function getMapFills(): string[] {
  const { biomes, cultures, states, religions, provinces, zones, markets, legends } = pack;
  const entities = [biomes, cultures, states, religions, provinces, zones, markets].flat();
  const colors = [
    ...entities.map(entity => entity?.color),
    ...legends.flatMap(({ items }) => items.map(item => item[1]))
  ];
  return colors.filter((color): color is string => typeof color === "string");
}
