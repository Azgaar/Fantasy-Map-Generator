import { invalidatePixiRendererLayer } from "./pixi/pixi-renderer-controller";

declare global {
  var drawEmblems: () => void;
}

export type EmblemType = "burg" | "province" | "state";

/** Remove editor/download previews and invalidate the authoritative Pixi emblem layer. */
export function clearEmblems(types: readonly EmblemType[]): void {
  for (const type of types) {
    document.querySelectorAll(`[id^=${type}COA]`).forEach(element => {
      element.remove();
    });
  }
  invalidatePixiRendererLayer("emblems");
}

const emblemsRenderer = (): void => {
  invalidatePixiRendererLayer("emblems");
};

export { emblemsRenderer as drawEmblems };

window.drawEmblems = emblemsRenderer;
