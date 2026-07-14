import type { Burg } from "../generators/burgs-generator";
import { syncBurgIconLayers } from "./burg_icons_layers";

declare global {
  var drawBurgIcons: () => void;
  var drawBurgIcon: (burg: Burg) => void;
  var removeBurgIcon: (burgId: number) => void;
}

const burgIconsRenderer = (): void => {
  TIME && console.time("drawBurgIcons");
  syncBurgIconLayers();
  renderViewport(getViewportBounds);
  TIME && console.timeEnd("drawBurgIcons");
};

const drawBurgIconRenderer = (burg: Burg): void => {
  if (!burg.i) return;
  syncBurgIconLayers();
  renderViewport(getViewportBounds);
};

const removeBurgIconRenderer = (burgId: number): void => {
  document.getElementById(`burg${burgId}`)?.remove();
  document.getElementById(`anchor${burgId}`)?.remove();
};

window.drawBurgIcons = burgIconsRenderer;
window.drawBurgIcon = drawBurgIconRenderer;
window.removeBurgIcon = removeBurgIconRenderer;
