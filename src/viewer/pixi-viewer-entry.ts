import { DEFAULT_PIXI_MAP_STYLE } from "../renderers/scene/styles";
import { installFantasyMapViewerIframeBridge } from "./iframe-bridge";
import { mountPixiMapViewer } from "./pixi-map-viewer";
import "./pixi-viewer.css";
import { STATIC_VIEWER_WORLD } from "./static-map-fixture";

const surface = document.getElementById("viewer");
if (!surface) throw new Error("Standalone Pixi viewer requires #viewer");
const credentials = parseCredentials(surface.dataset.credentials);
const rendererPreference = surface.dataset.rendererPreference === "webgpu" ? "webgpu" : "webgl";
const resolutionCap = Number(surface.dataset.resolutionCap);

void mountPixiMapViewer({
  assetPolicy: {
    baseUrl: surface.dataset.assetBaseUrl,
    credentials
  },
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  rendererPreference,
  resolutionCap: Number.isFinite(resolutionCap) && resolutionCap > 0 ? resolutionCap : undefined,
  style: structuredClone(DEFAULT_PIXI_MAP_STYLE),
  surface,
  workerUrl: surface.dataset.workerUrl,
  world: STATIC_VIEWER_WORLD
})
  .then(async viewer => {
    if (surface.dataset.snapshotUrl) await viewer.load(surface.dataset.snapshotUrl);
    const configuredOrigins = surface.dataset.allowedOrigins?.split(",").map(origin => origin.trim());
    installFantasyMapViewerIframeBridge(viewer, {
      allowedOrigins: configuredOrigins?.length ? configuredOrigins : [window.location.origin]
    });
  })
  .catch(error => {
    surface.textContent = error instanceof Error ? error.message : "Unable to start the Pixi viewer";
    throw error;
  });

function parseCredentials(value: string | undefined): RequestCredentials {
  return value === "include" || value === "omit" ? value : "same-origin";
}
