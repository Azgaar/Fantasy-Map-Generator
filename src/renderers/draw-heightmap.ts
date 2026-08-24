declare global {
  var drawHeightmap: () => void;
}

/**
 * Compatibility entry point used by classic generation and style code.
 * Height geometry and presentation are owned by the renderer-neutral contour scene and Pixi.
 */
const heightmapRenderer = (): void => {
  invalidatePixiRendererLayer("height");
};

window.drawHeightmap = heightmapRenderer;

export { heightmapRenderer as drawHeightmap };

import { invalidatePixiRendererLayer } from "./pixi/pixi-renderer-controller";
