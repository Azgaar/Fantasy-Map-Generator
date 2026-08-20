import type { Style } from "@/types/style";
import { DEFAULT_PIXI_MAP_STYLE, type MapStyle } from "./styles";

export function getMapRendererStyle(appStyle: Pick<Style, "mapRenderer">): MapStyle {
  appStyle.mapRenderer = mergeStyle(DEFAULT_PIXI_MAP_STYLE, appStyle.mapRenderer);
  return structuredClone(appStyle.mapRenderer);
}

export function resetMapRendererStyle(appStyle: Pick<Style, "mapRenderer">): MapStyle {
  appStyle.mapRenderer = structuredClone(DEFAULT_PIXI_MAP_STYLE);
  return structuredClone(appStyle.mapRenderer);
}

function mergeStyle<T>(defaults: T, stored: unknown): T {
  if (!isRecord(defaults) || !isRecord(stored)) return structuredClone(defaults);
  const merged = structuredClone(defaults) as Record<string, unknown>;
  for (const [key, value] of Object.entries(stored)) {
    const defaultValue = (defaults as Record<string, unknown>)[key];
    merged[key] = isRecord(defaultValue) && isRecord(value) ? mergeStyle(defaultValue, value) : structuredClone(value);
  }
  return merged as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
