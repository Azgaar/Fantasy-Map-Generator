import { Icons } from "@/components/icons";
import { Layers } from "@/components/layers";
import type { ReliefIcon } from "@/generators/relief-generator";
import { ViewportLayers, type ViewportRenderContext } from "@/renderers/viewport/viewport-renderer";
import { escapeHtml } from "@/utils/stringUtils";

const layer = ViewportLayers.register({ id: "relief", render: reconcileRelief });
let isDrawn = false; // an erased layer draws nothing, an empty one still draws
let frameId: number | null = null;

export async function drawRelief(): Promise<void> {
  TIME && console.time("drawRelief");
  if (!pack.relief?.length) Relief.generate();
  isDrawn = true;
  await Icons.loadAll(Relief.requiredIconSets(pack.relief, styles.relief.options.set));
  layer.render();
  TIME && console.timeEnd("drawRelief");
}

export const redrawRelief = (): void => {
  if (frameId !== null) return;
  frameId = requestAnimationFrame(() => {
    frameId = null;
    Layers.draw("relief");
  });
};

/** the icon a rendered `<use>` stands for: `data-id` is its index in `pack.relief` as of the last draw */
export const getReliefIcon = (dataId: string): ReliefIcon | undefined => pack.relief?.[Number(dataId)];

export function removeRelief(): void {
  isDrawn = false;
  document.querySelector("#terrain")?.replaceChildren();
}

function reconcileRelief(context: ViewportRenderContext): void {
  const terrain = context.root.querySelectorAll<SVGGElement>("#terrain")[0];
  if (!terrain) return;
  if (!isDrawn || !Layers.isOn("relief")) return void terrain.replaceChildren();

  const { x0, y0, x1, y1 } = context.bounds;
  const { set, size } = styles.relief.options; // size is a render multiplier: the stored size stays as it is
  const relief = pack.relief ?? [];
  const hrefs = new Map<string, string>(); // a map draws a handful of symbols thousands of times
  const markup: string[] = [];

  for (let index = 0; index < relief.length; index++) {
    const icon = relief[index];
    const { x, y, s } = icon;
    const drawn = s * size;
    const shift = (drawn - s) / 2; // scale around the icon's anchor, so the drawn centre and the z-order hold
    const left = x - shift;
    const top = y - shift;
    if (left > x1 || top > y1 || left + drawn < x0 || top + drawn < y0) continue;
    const symbol = Relief.symbolId(icon, set);
    let href = hrefs.get(symbol);
    if (href === undefined) {
      href = escapeHtml(Icons.href(symbol));
      hrefs.set(symbol, href);
    }
    markup.push(`<use href="${href}" data-id="${index}" x="${left}" y="${top}" width="${drawn}" height="${drawn}"/>`);
  }

  terrain.innerHTML = markup.join("");
}
