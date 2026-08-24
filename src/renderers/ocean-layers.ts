declare global {
  var OceanLayers: () => void;
}

/** Compatibility command for generation code; Pixi owns the retained ocean depth scene. */
const drawOceanLayers = (): void => {
  invalidatePixiRendererLayer("ocean");
};

window.OceanLayers = drawOceanLayers;

export { drawOceanLayers as OceanLayers };

import { invalidatePixiRendererLayer } from "./pixi/pixi-renderer-controller";
