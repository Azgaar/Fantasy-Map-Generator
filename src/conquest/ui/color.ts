/**
 * color.ts — pure color/format helpers for Total War's layers.
 *
 * Behaviour-ported from the old overlay's `map/fills.js` and `ui/panels/
 * shared.js`. The overlay was Phase 5a′'s client, deleted in Phase F once the
 * fork's layers had parity — the tests in `test/tw-layers.test.ts` carry its
 * cases forward, which is the only reason this comment can describe them.
 *
 * The fill normalization is the load-bearing part: Azgaar's state palettes are
 * pastel, and pastel blue over blue water is unreadable. So a region's FILL is
 * clamped into a land band while its identity rides on the STROKE, which keeps
 * the exact faction color.
 */

/** `#rgb`/`#rrggbb` → {r,g,b} 0..1; null for anything else (e.g. rgba()). */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = [...h].map(c => c + c).join("");
  const n = parseInt(h, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h, s, l };
}

/**
 * Faction color → the wash a region is filled with. Hue is preserved (it is the
 * faction's identity across the UI); lightness is clamped into a band no FMG
 * ocean theme sits in, and saturation is floored so grey pastels still read as
 * territory. Non-hex colors (the unclaimed rgba, say) pass through untouched.
 */
export function regionWash(color: string): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const { h, s, l } = rgbToHsl(rgb);
  const lightness = Math.min(0.52, Math.max(0.32, l));
  const saturation = Math.min(0.85, Math.max(0.34, s)); // floored AND capped: no mud, no neon
  return `hsl(${Math.round(h * 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%)`;
}

/** The outline a region carries: the faction's exact, unsullied color. */
export function regionStroke(color: string): string {
  return hexToRgb(color) ? color : "rgba(12, 16, 22, 0.9)";
}

/** Troops as a compact label: `842`, `12.3k`. */
export function formatMen(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
}

/** Escape text for XML when writing innerHTML into an SVG group. */
export function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Coordinates rounded to 0.1px — keeps path strings short and diffable. */
export const r1 = (n: number): number => Math.round(n * 10) / 10;
