// Quality traded for speed: three independent settings, and the presets that name common combinations

import { Options } from "@/model/options/options-model";
import type { OptionsData } from "@/model/options/options-schema";
import { Layers } from "@/renderers/layers";
import { findEl } from "@/utils/node-utils";

export type PerformanceSettings = OptionsData["app"]["performance"];
type PerformancePreset = keyof typeof PERFORMANCE_PRESETS;

export const PERFORMANCE_PRESETS = {
  quality: { shapeRendering: "geometricPrecision", stateHalos: true, viewportRedraw: "continuous" },
  balance: { shapeRendering: "optimizeSpeed", stateHalos: false, viewportRedraw: "continuous" },
  speed: { shapeRendering: "optimizeSpeed", stateHalos: false, viewportRedraw: "settled" }
} as const satisfies Record<string, PerformanceSettings>;

/** The preset the settings amount to. Derived, never stored: a preset is a name for its values */
export function resolvePerformancePreset(settings: PerformanceSettings): PerformancePreset | "custom" {
  const keys = Object.keys(settings) as (keyof PerformanceSettings)[];
  for (const [name, preset] of Object.entries(PERFORMANCE_PRESETS)) {
    if (keys.every(key => preset[key] === settings[key])) return name as PerformancePreset;
  }
  return "custom";
}

const listeners = new Set<() => void>();

/** Every view of the settings syncs itself on change, so no view needs to know another exists */
export function onPerformanceChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyPerformancePreset(name: string): void {
  if (!Object.hasOwn(PERFORMANCE_PRESETS, name)) return;
  change(o => (o.app.performance = { ...PERFORMANCE_PRESETS[name as PerformancePreset] }));
}

export function setPerformanceSetting<K extends keyof PerformanceSettings>(
  key: K,
  value: PerformanceSettings[K]
): void {
  change(o => (o.app.performance[key] = value));
}

function change(write: (o: OptionsData) => void): void {
  Options.set(write);
  applyPerformanceSettings();
  for (const listener of listeners) listener();
}

/** Astral hands the halo to the Borders button; Standard leaves it on the quality setting */
let haloOwnedByBorders = false;

export function setHaloOwnedByBorders(on: boolean): void {
  haloOwnedByBorders = on;
  applyPerformanceSettings();
}

export function isStateHaloVisible(): boolean {
  return haloOwnedByBorders ? Layers.isOn("borders") : options.app.performance.stateHalos;
}

/** Put the settings onto the map on screen. `viewportRedraw` needs nothing: the zoom reads it live */
export function applyPerformanceSettings(): void {
  const { shapeRendering } = options.app.performance;
  findEl("viewbox")?.setAttribute("shape-rendering", shapeRendering);

  const halo = findEl("statesHalo");
  if (!halo) return;
  const visible = isStateHaloVisible();
  halo.style.display = visible ? "" : "none";
  if (visible && pack.cells && !halo.childElementCount) Layers.draw("states");
}
