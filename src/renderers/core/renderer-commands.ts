import type { PixiOwnedLayer } from "../pixi/pixi-renderer-ownership";

export interface RendererCommandTarget {
  clear: () => Promise<void>;
  invalidateLayer: (layer: PixiOwnedLayer, cellIds?: readonly number[]) => void;
  queueRebuild: () => void;
}

let target: RendererCommandTarget | null = null;

export const bindRendererCommands = (nextTarget: RendererCommandTarget): (() => void) => {
  target = nextTarget;
  return () => {
    if (target === nextTarget) target = null;
  };
};

export const rendererCommands = {
  clear: (): Promise<void> => target?.clear() ?? Promise.resolve(),
  invalidateLayer: (layer: PixiOwnedLayer, cellIds?: readonly number[]): void =>
    target?.invalidateLayer(layer, cellIds),
  queueRebuild: (): void => target?.queueRebuild()
};
