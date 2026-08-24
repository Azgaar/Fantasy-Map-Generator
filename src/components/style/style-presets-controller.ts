export interface StylePresetsApi {
  add: () => void;
  applyOnLoad: () => Promise<void>;
  requestChange: (preset: string) => void;
  requestRemove: () => void;
}

let target: StylePresetsApi | null = null;

function getTarget(): StylePresetsApi {
  if (!target) throw new Error("Style presets runtime is not initialized");
  return target;
}

export function bindStylePresets(nextTarget: StylePresetsApi): () => void {
  target = nextTarget;
  return () => {
    if (target === nextTarget) target = null;
  };
}

/** Stable typed entry point for bundled callers and the legacy window alias. */
export const StylePresets: StylePresetsApi = {
  add: () => getTarget().add(),
  applyOnLoad: () => getTarget().applyOnLoad(),
  requestChange: preset => getTarget().requestChange(preset),
  requestRemove: () => getTarget().requestRemove()
};
