import type { MapStyle } from "../styles";

export interface CompassScene {
  domainId: "compass";
  opacity: number;
  revision: string;
  scale: number;
  x: number;
  y: number;
}

export function buildCompassScene(style: MapStyle["compass"], revision: number | string): CompassScene {
  return {
    domainId: "compass",
    opacity: style.opacity,
    revision: `compass:${revision}`,
    scale: style.scale,
    x: style.x,
    y: style.y
  };
}
