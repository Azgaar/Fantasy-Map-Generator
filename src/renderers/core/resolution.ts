import type { ViewportSize } from "./camera";

export interface RendererResolutionPolicy {
  maxCanvasPixels: number;
  maxResolution: number;
  mediumMemoryMaxResolution: number;
  mediumMemoryThresholdGb: number;
  lowMemoryMaxResolution: number;
  lowMemoryThresholdGb: number;
}

export interface RendererResolutionRequest extends ViewportSize {
  deviceMemoryGb?: number;
  devicePixelRatio: number;
}

export const DEFAULT_RENDERER_RESOLUTION_POLICY: Readonly<RendererResolutionPolicy> = {
  maxCanvasPixels: 8 * 1024 * 1024,
  maxResolution: 2,
  mediumMemoryMaxResolution: 1.5,
  mediumMemoryThresholdGb: 4,
  lowMemoryMaxResolution: 1,
  lowMemoryThresholdGb: 2
};

export function selectRendererResolution(
  request: RendererResolutionRequest,
  policy: RendererResolutionPolicy = { ...DEFAULT_RENDERER_RESOLUTION_POLICY }
): number {
  const width = normalizeDimension(request.width);
  const height = normalizeDimension(request.height);
  const pixelRatio = normalizePixelRatio(request.devicePixelRatio);
  let memoryCap = policy.maxResolution;

  if (request.deviceMemoryGb !== undefined && Number.isFinite(request.deviceMemoryGb)) {
    if (request.deviceMemoryGb <= policy.lowMemoryThresholdGb) memoryCap = policy.lowMemoryMaxResolution;
    else if (request.deviceMemoryGb <= policy.mediumMemoryThresholdGb) memoryCap = policy.mediumMemoryMaxResolution;
  }

  const pixelBudgetCap = Math.sqrt(policy.maxCanvasPixels / (width * height));
  return roundResolution(Math.max(0.5, Math.min(pixelRatio, memoryCap, policy.maxResolution, pixelBudgetCap)));
}

function normalizeDimension(value: number): number {
  return Number.isFinite(value) ? Math.max(1, value) : 1;
}

function normalizePixelRatio(value: number): number {
  return Number.isFinite(value) ? Math.max(1, value) : 1;
}

function roundResolution(value: number): number {
  return Math.round(value * 100) / 100;
}
