import { DEFAULT_PIXI_MAP_STYLE } from "../renderers/scene/styles";
import { mountPixiMapViewer } from "./pixi-map-viewer";
import { STATIC_VIEWER_MAP_SIZE, STATIC_VIEWER_WORLD } from "./static-map-fixture";

const surface = document.getElementById("viewer");
if (!surface) throw new Error("Standalone Pixi viewer requires #viewer");

const bounds = surface.getBoundingClientRect();
const scale = Math.min(bounds.width / STATIC_VIEWER_MAP_SIZE.width, bounds.height / STATIC_VIEWER_MAP_SIZE.height);

void mountPixiMapViewer({
  camera: {
    height: bounds.height,
    scale,
    width: bounds.width,
    x: (bounds.width - STATIC_VIEWER_MAP_SIZE.width * scale) / 2,
    y: (bounds.height - STATIC_VIEWER_MAP_SIZE.height * scale) / 2
  },
  style: structuredClone(DEFAULT_PIXI_MAP_STYLE),
  surface,
  world: STATIC_VIEWER_WORLD
}).catch(error => {
  surface.textContent = error instanceof Error ? error.message : "Unable to start the Pixi viewer";
  throw error;
});
