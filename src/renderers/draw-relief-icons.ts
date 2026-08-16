import type { ReliefIcon } from "@/generators/relief-generator";
import { reconcileSvgUseElements } from "@/renderers/viewport/svg-use-reconciler";
import {
  Scene,
  SpatialIndex,
  type ViewportBounds,
  ViewportLayers,
  type ViewportRenderContext
} from "@/renderers/viewport/viewport-renderer";

interface ReliefSceneIcon {
  id: string;
  data: ReliefIcon;
}

const scene = new Scene<ReliefSceneIcon>();
const index = new SpatialIndex<ReliefSceneIcon>();
const layer = ViewportLayers.register({ id: "relief", render: reconcileRelief, clear: removeRelief });
let frameId: number | null = null;
let maximumSize = 0;

export const drawRelief = (): void => {
  const isActive = layerIsOn("toggleRelief");
  setReliefLayerActive(isActive);
  if (!isActive) return void removeRelief();

  TIME && console.time("drawRelief");
  if (!pack.relief?.length) Relief.generate();
  const items = pack.relief.map((data, i) => ({ id: String(i), data }));
  scene.replace(items);
  index.replace(items, ({ data }) => [data.x, data.y]);
  maximumSize = pack.relief.reduce((maximum, { s }) => Math.max(maximum, s), 0);
  layer.render();
  TIME && console.timeEnd("drawRelief");
};

export const redrawRelief = (): void => {
  if (frameId !== null) return;
  frameId = requestAnimationFrame(() => {
    frameId = null;
    drawRelief();
  });
};

export const getSceneReliefIcon = (id: string): ReliefIcon | undefined => scene.get(id)?.data;

function removeRelief(): void {
  scene.invalidate();
  index.clear();
  maximumSize = 0;
  document.querySelector("#terrain")?.replaceChildren();
}

export const setReliefLayerActive = (isActive: boolean): void => {
  const terrainEl = document.querySelector<SVGAElement>("#terrain");
  if (!terrainEl) return;
  terrainEl.style.display = isActive ? "" : "none";
  if (!terrainEl.getAttribute("style")) terrainEl.removeAttribute("style");
};

function reconcileRelief(context: ViewportRenderContext): void {
  const terrain = context.root.querySelector<SVGGElement>("#terrain");
  if (!terrain) return;
  if (!scene.valid || !index.valid || !layerIsOn("toggleRelief")) return void terrain.replaceChildren();

  const { x0, y0, x1, y1 } = context.bounds;
  const items = [];
  for (const { id, data } of index.values(expandBounds(context.bounds, maximumSize))) {
    const { icon, x, y, s } = data;
    if (x > x1 || y > y1 || x + s < x0 || y + s < y0) continue;
    items.push({ id: `relief${id}`, dataId: id, href: `#${icon}`, x, y, width: s, height: s });
  }

  reconcileSvgUseElements(terrain, items);
}

function expandBounds(bounds: ViewportBounds, padding: number): ViewportBounds {
  return { ...bounds, x0: bounds.x0 - padding, y0: bounds.y0 - padding };
}

window.drawRelief = drawRelief;
window.redrawRelief = redrawRelief;
