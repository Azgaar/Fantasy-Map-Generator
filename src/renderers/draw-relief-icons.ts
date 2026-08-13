import type { ReliefIcon } from "@/generators/relief-generator";
import { Scene, ViewportLayers, type ViewportRenderContext } from "@/renderers/viewport/viewport-renderer";

interface ReliefSceneIcon extends ReliefIcon {
  id: string;
}

const scene = new Scene<ReliefSceneIcon>();
const layer = ViewportLayers.register({ id: "relief", render: reconcileRelief });
let frameId: number | null = null;

export const drawRelief = (): void => {
  const isActive = layerIsOn("toggleRelief");
  setReliefLayerActive(isActive);
  if (!isActive) return void removeRelief();

  TIME && console.time("drawRelief");
  if (!pack.relief?.length) Relief.generate();
  const icons = pack.relief.map((icon, i) => ({ ...icon, id: `reliefIcon${i}` }));
  scene.replace(icons);
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

function removeRelief(): void {
  scene.invalidate();
  document.querySelector("#terrain")?.replaceChildren();
}

export const setReliefLayerActive = (isActive: boolean): void => {
  const terrainEl = document.querySelector<SVGAElement>("#terrain");
  if (!terrainEl) return;
  terrainEl.style.display = isActive ? "" : "none";
  if (!terrainEl.getAttribute("style")) terrainEl.removeAttribute("style");
};

function reconcileRelief(context: ViewportRenderContext): void {
  const terrain = context.root.querySelector("#terrain");
  if (!terrain) return;
  if (!scene.valid || !layerIsOn("toggleRelief")) return void terrain.replaceChildren();

  const { x0, y0, x1, y1 } = context.bounds;
  const markup: string[] = [];

  for (const { id, icon, x, y, s } of scene.values()) {
    if (x > x1 || y > y1 || x + s < x0 || y + s < y0) continue;
    markup.push(`<use href="#${icon}" data-i="${id}" x="${x}" y="${y}" width="${s}" height="${s}"/>`);
  }

  terrain.innerHTML = markup.join("");
}

window.drawRelief = drawRelief;
window.redrawRelief = redrawRelief;
