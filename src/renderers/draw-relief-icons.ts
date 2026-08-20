import type { ReliefIcon } from "@/generators/relief-generator";
import { invalidatePixiRendererLayer } from "@/renderers/pixi/pixi-renderer-controller";

let frameId: number | null = null;

export const drawRelief = (): void => {
  const isActive = layerIsOn("toggleRelief");
  setReliefLayerActive(isActive);
  if (!isActive) return void removeRelief();
  TIME && console.time("drawRelief");
  if (!pack.relief?.length) Relief.generate();
  removeRelief();
  invalidatePixiRendererLayer("relief");
  TIME && console.timeEnd("drawRelief");
};

export const redrawRelief = (): void => {
  if (frameId !== null) return;
  frameId = requestAnimationFrame(() => {
    frameId = null;
    drawRelief();
  });
};

export const getSceneReliefIcon = (id: string): ReliefIcon | undefined => pack.relief?.[Number(id)];

function removeRelief(): void {
  document.querySelector("#terrain")?.replaceChildren();
}

export const setReliefLayerActive = (isActive: boolean): void => {
  const terrainEl = document.querySelector<SVGAElement>("#terrain");
  if (!terrainEl) return;
  terrainEl.style.display = isActive ? "" : "none";
  if (!terrainEl.getAttribute("style")) terrainEl.removeAttribute("style");
};

window.drawRelief = drawRelief;
window.redrawRelief = redrawRelief;
