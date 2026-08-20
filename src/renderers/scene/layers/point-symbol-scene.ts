import type { Burg } from "@/generators/burgs-generator";
import type { Marker } from "@/generators/markers-generator";
import type {
  PointSymbolBatchPrimitive,
  PointSymbolInstancePrimitive,
  SceneBounds,
  SceneRevision
} from "../primitives";
import type { BurgLayerStyle, MarkerLayerStyle, PointSymbolStyle } from "../styles";

export interface MarkerRenderState {
  pinnedOnly: boolean;
  visibleIds: ReadonlySet<number> | null;
}

export interface BurgPointSymbolScene {
  anchors: PointSymbolBatchPrimitive;
  icons: PointSymbolBatchPrimitive;
}

export function buildBurgPointSymbolScene(
  burgs: readonly Burg[],
  style: BurgLayerStyle,
  revision: SceneRevision
): BurgPointSymbolScene {
  const icons: PointSymbolInstancePrimitive[] = [];
  const anchors: PointSymbolInstancePrimitive[] = [];

  for (const burg of burgs) {
    if (!burg.i || burg.removed || !burg.group) continue;
    const iconStyle = style.icons.roles[burg.group] ?? style.icons.default;
    icons.push(createBurgSymbol(burg, burg.group, iconStyle, iconStyle.icon));
    if (burg.port) {
      const anchorStyle = style.anchors.roles[burg.group] ?? style.anchors.default;
      anchors.push(createBurgSymbol(burg, burg.group, anchorStyle, "anchor"));
    }
  }

  return {
    anchors: createBatch("burgIcons", anchors, `${revision}:anchors`),
    icons: createBatch("burgIcons", icons, `${revision}:icons`)
  };
}

export function buildMarkerPointSymbolScene(
  markers: readonly Marker[],
  style: MarkerLayerStyle,
  state: MarkerRenderState,
  revision: SceneRevision
): PointSymbolBatchPrimitive {
  const instances = markers
    .filter(marker => !marker.hidden)
    .filter(marker => !state.pinnedOnly || marker.pinned)
    .filter(marker => !state.visibleIds || state.visibleIds.has(marker.i))
    .map(marker => createMarkerSymbol(marker, style));
  return createBatch("markers", instances, revision);
}

function createBurgSymbol(
  burg: Burg,
  role: string,
  style: PointSymbolStyle,
  shape: string
): PointSymbolInstancePrimitive {
  return {
    anchorX: 0.5,
    anchorY: 0.5,
    domainId: burg.i,
    fill: style.fill,
    fillOpacity: style.fillOpacity,
    icon: null,
    iconOffsetX: 0.5,
    iconOffsetY: 0.5,
    iconSize: 0,
    opacity: style.opacity,
    rescale: false,
    role,
    shape: normalizeSymbolName(shape),
    size: Math.max(0.01, style.size),
    stroke: style.stroke,
    strokeWidth: Math.max(0, style.strokeWidth),
    x: burg.x,
    y: burg.y
  };
}

function createMarkerSymbol(marker: Marker, style: MarkerLayerStyle): PointSymbolInstancePrimitive {
  return {
    anchorX: 0.5,
    anchorY: 1,
    domainId: marker.i,
    fill: marker.fill ?? "#ffffff",
    fillOpacity: 1,
    icon: marker.icon,
    iconOffsetX: (marker.dx ?? 50) / 100,
    iconOffsetY: (marker.dy ?? 50) / 100,
    iconSize: marker.px ?? 12,
    opacity: style.opacity,
    rescale: style.rescale,
    role: marker.type,
    shape: marker.pin ?? "bubble",
    size: Math.max(1, marker.size ?? 30),
    stroke: marker.stroke ?? "#000000",
    strokeWidth: 1,
    x: marker.x,
    y: marker.y
  };
}

function createBatch(
  layer: "burgIcons" | "markers",
  instances: readonly PointSymbolInstancePrimitive[],
  revision: SceneRevision
): PointSymbolBatchPrimitive {
  return {
    bounds: getPointSymbolBounds(instances),
    domainIds: instances.map(({ domainId }) => domainId),
    instances,
    kind: "point-symbol-batch",
    layer,
    revision
  };
}

function getPointSymbolBounds(instances: readonly PointSymbolInstancePrimitive[]): SceneBounds | null {
  if (!instances.length) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const symbol of instances) {
    minX = Math.min(minX, symbol.x - symbol.size * symbol.anchorX);
    minY = Math.min(minY, symbol.y - symbol.size * symbol.anchorY);
    maxX = Math.max(maxX, symbol.x + symbol.size * (1 - symbol.anchorX));
    maxY = Math.max(maxY, symbol.y + symbol.size * (1 - symbol.anchorY));
  }
  return { maxX, maxY, minX, minY };
}

function normalizeSymbolName(icon: string): string {
  return icon.replace(/^#?icon-/, "").replace(/-empty$/, "");
}
