import "./coastline_layers";
import "./emblems_layers";
import "./markers_layers";
import "./ruler_layers";
import "./states_halo_layers";
import { syncBurgIconLayers } from "./burg_icons_layers";
import { syncLabelLayers } from "./labels_layers";
import { syncRouteLayers } from "./routes_layers";
import { renderAll, renderNow, scheduleRender } from "./viewport_renderer";

function syncLayers(): void {
  syncLabelLayers();
  syncBurgIconLayers();
  syncRouteLayers();
}

window.scheduleViewportRender = scheduleRender;

window.renderViewport = getBounds => {
  syncLayers();
  renderNow(getBounds);
};

window.renderAllViewportLayers = (root, getBounds) => {
  syncLayers();
  renderAll(root, getBounds);
};
