// Relief art in the interface: painted in the relief style and cropped to what it draws, since relief art
// sits small in its frame (vegetation fills a tenth to a third of it)
import { Icons } from "@/components/icons";
import type { ReliefSet } from "@/generators/relief-generator";
import { escapeHtml } from "@/utils";

/** the relief style's stroke, as the map draws it on the relief group */
function reliefPaint(): string {
  const { stroke, "stroke-width": width } = styles.relief.attrs;
  return `${stroke ? ` stroke="${escapeHtml(stroke)}"` : ""} stroke-width="${width ?? 0}"`;
}

/** a relief set symbol, to be cropped by `fitReliefArt`; `attributes` go on the svg as they are */
export function reliefArtHtml(id: string, attributes = ""): string {
  return `<svg data-fit viewBox="0 0 100 100" aria-hidden="true"${reliefPaint()}${attributes}><use href="${escapeHtml(Icons.href(id))}" width="100" height="100"/></svg>`;
}

/** a relief pool entry: a type in the given set, or any other icon as the library draws it */
export function poolEntryHtml(entry: string, set: ReliefSet): string {
  return Relief.isType(entry) ? reliefArtHtml(Relief.entrySymbol(entry, set)) : Icons.html(entry);
}

/** crop the relief art in a container to what it draws, once its set is in the page */
export async function fitReliefArt(container: Element, set: ReliefSet): Promise<void> {
  await Icons.retry(Relief.iconSetId(set));
  for (const svg of container.querySelectorAll<SVGSVGElement>("svg[data-fit]")) {
    const box = svg.querySelector("use")?.getBBox();
    if (!box?.width || !box.height) continue; // not laid out: keep the frame
    const side = Math.max(box.width, box.height) * 1.15;
    const frame = [box.x + box.width / 2 - side / 2, box.y + box.height / 2 - side / 2, side, side];
    svg.setAttribute("viewBox", Icons.formatFrame(frame));
    svg.removeAttribute("data-fit");
  }
}
