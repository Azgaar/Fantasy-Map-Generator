import { IconSets } from "@/components/icon-sets";
import { escapeHtml } from "@/utils";

/**
 * An inline svg drawing an anchored symbol in its own frame; fill and stroke are inherited from the container.
 * The art sits around the `<use>` origin, so the frame is the symbol's anchor-relative viewBox. It is read from the
 * loaded symbol, so callers redraw once the set lands; until then it is the plain glyph's.
 */
export function burgIconPreview(symbolId: string): string {
  const id = symbolId.replace(/^#/, "");
  const set = IconSets.setForId(id);
  const em = (set && IconSets.get(set).em) || 10;
  const frame = document.getElementById(id)?.getAttribute("viewBox") ?? "-6 -6 12 12";
  return `<svg viewBox="${frame}" aria-hidden="true"><use href="#${escapeHtml(id)}" font-size="${em}" stroke-width="1.5"/></svg>`;
}
