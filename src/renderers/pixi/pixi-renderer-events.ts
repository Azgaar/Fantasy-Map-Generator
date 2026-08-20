import type { PixiRendererControllerApi } from "./pixi-renderer-controller";
import { isPixiOwnedLayer, type PixiOwnedLayer } from "./pixi-renderer-ownership";

export const PIXI_RENDERER_COMMAND_EVENT = "map:pixi-renderer:command";
export const PIXI_RENDERER_OWNERSHIP_REQUEST_EVENT = "map:pixi-renderer:ownership-request";

export type PixiRendererCommand =
  | { command: "clear" }
  | { command: "queue-rebuild" }
  | { cellIds?: readonly number[]; command: "invalidate-layer"; layer: PixiOwnedLayer };

export interface PixiRendererOwnershipRequest {
  layer: string;
  owner: "pixi" | "svg";
}

type RendererEventTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">;

export function registerPixiRendererEventBridge(
  controller: PixiRendererControllerApi,
  target: RendererEventTarget = window
): () => void {
  const handleCommand = (event: Event) => {
    const detail = (event as CustomEvent<PixiRendererCommand>).detail;
    if (!detail) return;
    if (detail.command === "clear") void controller.clear();
    else if (detail.command === "queue-rebuild") controller.queueRebuild();
    else if (detail.command === "invalidate-layer" && isPixiOwnedLayer(detail.layer)) {
      controller.invalidateLayer(detail.layer, detail.cellIds);
    }
  };
  const handleOwnershipRequest = (event: Event) => {
    const detail = (event as CustomEvent<PixiRendererOwnershipRequest>).detail;
    if (!detail || !isPixiOwnedLayer(detail.layer)) return;
    detail.owner = controller.ownsLayer(detail.layer) ? "pixi" : "svg";
  };

  target.addEventListener(PIXI_RENDERER_COMMAND_EVENT, handleCommand);
  target.addEventListener(PIXI_RENDERER_OWNERSHIP_REQUEST_EVENT, handleOwnershipRequest);
  return () => {
    target.removeEventListener(PIXI_RENDERER_COMMAND_EVENT, handleCommand);
    target.removeEventListener(PIXI_RENDERER_OWNERSHIP_REQUEST_EVENT, handleOwnershipRequest);
  };
}
