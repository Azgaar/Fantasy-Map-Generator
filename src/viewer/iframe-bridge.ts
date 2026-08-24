import type { MapCamera, ViewportSize } from "../renderers/core/camera";
import type { MapLayerId } from "../renderers/core/layer-registry";
import type { ScreenPoint } from "../renderers/core/map-renderer";
import type { RenderSnapshot, RenderSnapshotBounds } from "../renderers/scene/render-snapshot";
import type { PixiMapViewerHandle } from "./pixi-map-viewer";

export const FANTASY_MAP_VIEWER_MESSAGE_SOURCE = "fantasy-map-viewer" as const;
export const FANTASY_MAP_VIEWER_MESSAGE_VERSION = 1 as const;

type ViewerCommand =
  | { command: "destroy" }
  | { bounds?: RenderSnapshotBounds; command: "fitBounds"; padding?: number }
  | { command: "load"; data: RenderSnapshot | string }
  | { command: "pick"; point: ScreenPoint }
  | { camera: MapCamera; command: "setCamera" }
  | { command: "setLayers"; layers: Partial<Record<MapLayerId, boolean>> }
  | { command: "resize"; viewport?: ViewportSize };

export type FantasyMapViewerCommandMessage = ViewerCommand & {
  requestId?: number | string;
  source: typeof FANTASY_MAP_VIEWER_MESSAGE_SOURCE;
  version: typeof FANTASY_MAP_VIEWER_MESSAGE_VERSION;
};

export interface FantasyMapViewerIframeBridgeOptions {
  allowedOrigins?: readonly string[];
  messageTarget?: Window;
  postTarget?: Window;
  targetOrigin?: string;
}

export function installFantasyMapViewerIframeBridge(
  viewer: PixiMapViewerHandle,
  options: FantasyMapViewerIframeBridgeOptions = {}
): () => void {
  const messageTarget = options.messageTarget ?? window;
  const postTarget = options.postTarget ?? window.parent;
  const allowedOrigins = new Set(options.allowedOrigins ?? [window.location.origin]);
  const targetOrigin = options.targetOrigin ?? (allowedOrigins.size === 1 ? [...allowedOrigins][0] : "*");

  const post = (message: Record<string, unknown>): void => {
    postTarget.postMessage(
      {
        source: FANTASY_MAP_VIEWER_MESSAGE_SOURCE,
        version: FANTASY_MAP_VIEWER_MESSAGE_VERSION,
        ...message
      },
      targetOrigin
    );
  };
  const onMessage = (event: MessageEvent): void => {
    if (!allowedOrigins.has("*") && !allowedOrigins.has(event.origin)) return;
    const message = event.data as Partial<FantasyMapViewerCommandMessage> | null;
    if (
      !message ||
      message.source !== FANTASY_MAP_VIEWER_MESSAGE_SOURCE ||
      message.version !== FANTASY_MAP_VIEWER_MESSAGE_VERSION ||
      typeof message.command !== "string"
    )
      return;
    void runCommand(viewer, message as FantasyMapViewerCommandMessage)
      .then(result => post({ requestId: message.requestId, result, type: "response" }))
      .catch(error =>
        post({
          error: error instanceof Error ? error.message : "Viewer command failed",
          requestId: message.requestId,
          type: "error"
        })
      );
  };
  messageTarget.addEventListener("message", onMessage);
  const unsubscribe = viewer.subscribe(event =>
    post({
      event: {
        camera: event.camera,
        error: event.error?.message,
        hit: event.hit,
        layers: event.layers,
        type: event.type
      },
      type: "event"
    })
  );
  post({ type: "ready" });

  let released = false;
  return () => {
    if (released) return;
    released = true;
    unsubscribe();
    messageTarget.removeEventListener("message", onMessage);
  };
}

async function runCommand(viewer: PixiMapViewerHandle, message: FantasyMapViewerCommandMessage): Promise<unknown> {
  switch (message.command) {
    case "destroy":
      viewer.destroy();
      return null;
    case "fitBounds":
      return viewer.fitBounds(message.bounds, message.padding);
    case "load":
      await viewer.load(message.data);
      return null;
    case "pick":
      return viewer.pick(message.point);
    case "resize":
      viewer.resize(message.viewport);
      return null;
    case "setCamera":
      viewer.setCamera(message.camera);
      return null;
    case "setLayers":
      viewer.setLayers(message.layers);
      return null;
  }
}
