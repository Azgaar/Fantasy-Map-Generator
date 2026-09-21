import { Layers } from "@/components/layers";
import type { ReliefIcon } from "@/generators/relief-generator";
import { Scene, ViewportLayers, type ViewportRenderContext } from "@/renderers/viewport/viewport-renderer";
import { IconSets } from "../components/icon-sets";

interface ReliefSceneIcon {
  id: string;
  data: ReliefIcon;
}

const scene = new Scene<ReliefSceneIcon>();
const layer = ViewportLayers.register({ id: "relief", render: reconcileRelief });
let frameId: number | null = null;

export async function drawRelief(): Promise<void> {
  TIME && console.time("drawRelief");
  if (!pack.relief?.length) Relief.generate();
  scene.replace(pack.relief.map((data, i) => ({ id: String(i), data })));
  await IconSets.ensureAll(IconSets.reliefSets(pack.relief ?? [], styles.relief.options.set));
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

export const getSceneReliefIcon = (id: string): ReliefIcon | undefined => scene.get(id)?.data;

export function removeRelief(): void {
  scene.invalidate();
  document.querySelector("#terrain")?.replaceChildren();
}

function reconcileRelief(context: ViewportRenderContext): void {
  const terrain = context.root.querySelectorAll<SVGGElement>("#terrain")[0];
  if (!terrain) return;
  if (!scene.valid || !Layers.isOn("relief")) return void terrain.replaceChildren();

  const { x0, y0, x1, y1 } = context.bounds;
  const scale = styles.relief.options.size; // a render multiplier: the stored size stays as it is
  const markup: string[] = [];

  for (const [index, data] of (pack.relief ?? []).entries()) {
    const id = String(index);
    const { x, y, s } = data;
    const icon = Relief.symbolId(data, styles.relief.options.set);
    const drawn = s * scale;
    const shift = (drawn - s) / 2; // scale around the icon's anchor, so the drawn centre and the z-order hold
    const left = x - shift;
    const top = y - shift;
    if (left > x1 || top > y1 || left + drawn < x0 || top + drawn < y0) continue;
    markup.push(`<use href="#${icon}" data-id="${id}" x="${left}" y="${top}" width="${drawn}" height="${drawn}"/>`);
  }

  terrain.innerHTML = markup.join("");
}
