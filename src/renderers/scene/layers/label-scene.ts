import type { LabelGroup } from "@/generators/labels-generator";
import { estimateTextWidth } from "@/renderers/labels/fit-state-label";
import type { LabelData } from "@/renderers/labels/labels";
import type { LabelGroupStyle } from "@/types/style";
import type { MapLayerId } from "../../core/layer-registry";
import type { SceneBounds, SceneRevision } from "../primitives";

export interface LabelRenderState {
  groups: readonly LabelGroup[];
  labels: readonly LabelData[];
  resizeOnZoom: boolean;
  showAll: boolean;
  styles: Readonly<Record<string, LabelGroupStyle>>;
}

export interface LabelShadowStyle {
  blur: number;
  color: string;
  distance: number;
  offsetX: number;
  offsetY: number;
}

export interface ResolvedLabelGroupStyle {
  fill: string;
  fontFamily: string;
  fontSize: number;
  letterSpacing: number;
  offsetXEm: number;
  offsetYEm: number;
  opacity: number;
  shadow: LabelShadowStyle | null;
  stroke: string;
  strokeWidth: number;
}

export interface CurvedLabelGlyph {
  angle: number;
  character: string;
  x: number;
  y: number;
}

export interface LabelSceneItem {
  anchorX: number;
  anchorY: number;
  curvedGlyphs: readonly CurvedLabelGlyph[] | null;
  domainId: string;
  entityId: number;
  fontSize: number;
  letterSpacing: number;
  text: string;
  type: LabelData["type"];
}

export interface LabelSceneGroup {
  active: boolean;
  dependency: MapLayerId | null;
  labels: readonly LabelSceneItem[];
  maxScale: number | null;
  minScale: number | null;
  name: string;
  style: ResolvedLabelGroupStyle;
}

export interface LabelScene {
  bounds: SceneBounds | null;
  groups: readonly LabelSceneGroup[];
  resizeOnZoom: boolean;
  revision: SceneRevision;
  showAll: boolean;
  unsupportedEffects: readonly string[];
}

export function buildLabelScene(state: LabelRenderState, revision: SceneRevision): LabelScene {
  const labelsByGroup = new Map<string, LabelData[]>();
  for (const label of state.labels) {
    if (label.hidden || !label.text) continue;
    const labels = labelsByGroup.get(label.group);
    if (labels) labels.push(label);
    else labelsByGroup.set(label.group, [label]);
  }

  const unsupportedEffects: string[] = [];
  const groups = state.groups.map(group => {
    const sourceStyle = state.styles[group.name];
    const style = resolveLabelStyle(sourceStyle);
    if (sourceStyle?.filter) unsupportedEffects.push(`${group.name}:filter:${sourceStyle.filter}`);
    const labels = (labelsByGroup.get(group.name) ?? []).map(label => buildLabel(label, style));
    return {
      active: group.active !== false,
      dependency: toMapLayerDependency(group.layerDependency),
      labels,
      maxScale: group.zoom.max,
      minScale: group.zoom.min,
      name: group.name,
      style
    } satisfies LabelSceneGroup;
  });

  return {
    bounds: getLabelBounds(groups),
    groups,
    resizeOnZoom: state.resizeOnZoom,
    revision: `labels:${revision}`,
    showAll: state.showAll,
    unsupportedEffects
  };
}

export function resolveLabelStyle(style: LabelGroupStyle | undefined): ResolvedLabelGroupStyle {
  const fontSize = Number.parseFloat(String(style?.["font-size"] ?? 18)) || 18;
  return {
    fill: style?.fill || "#3e3e4b",
    fontFamily: style?.["font-family"] || "Arial",
    fontSize,
    letterSpacing: Number(style?.["letter-spacing"]) || 0,
    offsetXEm: Number(style?.["data-dx"]) || 0,
    offsetYEm: Number(style?.["data-dy"]) || 0,
    opacity: Number.isFinite(Number(style?.opacity)) ? Number(style?.opacity) : 1,
    shadow: parseTextShadow(style?.style),
    stroke: style?.stroke || "#3a3a3a",
    strokeWidth: Number(style?.["stroke-width"]) || 0
  };
}

function buildLabel(label: LabelData, style: ResolvedLabelGroupStyle): LabelSceneItem {
  const fontSize = style.fontSize * ((label.fontSize ?? 100) / 100);
  const letterSpacing = label.letterSpacing ?? style.letterSpacing;
  const anchorX = label.anchor[0] + (label.dx || 0);
  const anchorY = label.anchor[1] + (label.dy || 0);
  return {
    anchorX,
    anchorY,
    curvedGlyphs: label.pathPoints?.length
      ? layoutCurvedGlyphs(label.text, label.pathPoints, fontSize, letterSpacing, label.startOffset ?? 50)
      : null,
    domainId: label.id,
    entityId: label.entityId,
    fontSize,
    letterSpacing,
    text: label.text.replaceAll("|", "\n"),
    type: label.type
  };
}

export function layoutCurvedGlyphs(
  text: string,
  pathPoints: readonly (readonly [number, number])[],
  fontSize: number,
  letterSpacing: number,
  startOffset: number
): CurvedLabelGlyph[] {
  const curve = sampleCurve(pathPoints);
  if (curve.length < 2) return [];
  const cumulative = [0];
  for (let index = 1; index < curve.length; index++) {
    cumulative.push(
      cumulative[index - 1] + Math.hypot(curve[index][0] - curve[index - 1][0], curve[index][1] - curve[index - 1][1])
    );
  }
  const pathLength = cumulative.at(-1) ?? 0;
  if (!pathLength) return [];

  const lines = text.split("|");
  const glyphs: CurvedLabelGlyph[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const characters = [...lines[lineIndex]];
    const widths = characters.map(character => Math.max(estimateTextWidth(character) * fontSize, fontSize * 0.2));
    const textLength =
      widths.reduce((sum, width) => sum + width, 0) + Math.max(characters.length - 1, 0) * letterSpacing;
    let distance = (pathLength * startOffset) / 100 - textLength / 2;
    const normalOffset = (lineIndex - (lines.length - 1) / 2) * fontSize;
    for (let index = 0; index < characters.length; index++) {
      const width = widths[index];
      const sample = samplePolyline(curve, cumulative, distance + width / 2);
      glyphs.push({
        angle: sample.angle,
        character: characters[index],
        x: sample.x - Math.sin(sample.angle) * normalOffset,
        y: sample.y + Math.cos(sample.angle) * normalOffset
      });
      distance += width + letterSpacing;
    }
  }
  return glyphs;
}

function sampleCurve(points: readonly (readonly [number, number])[]): [number, number][] {
  if (points.length < 3) return points.map(([x, y]) => [x, y]);
  const sampled: [number, number][] = [];
  for (let segment = 0; segment < points.length - 1; segment++) {
    const p0 = points[Math.max(0, segment - 1)];
    const p1 = points[segment];
    const p2 = points[segment + 1];
    const p3 = points[Math.min(points.length - 1, segment + 2)];
    for (let step = 0; step < 12; step++) {
      const t = step / 12;
      const t2 = t * t;
      const t3 = t2 * t;
      sampled.push([
        0.5 *
          (2 * p1[0] +
            (-p0[0] + p2[0]) * t +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 *
          (2 * p1[1] +
            (-p0[1] + p2[1]) * t +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      ]);
    }
  }
  sampled.push([points.at(-1)![0], points.at(-1)![1]]);
  return sampled;
}

function samplePolyline(
  points: readonly (readonly [number, number])[],
  cumulative: readonly number[],
  requestedDistance: number
): { angle: number; x: number; y: number } {
  const distance = Math.max(0, Math.min(cumulative.at(-1) ?? 0, requestedDistance));
  let index = 1;
  while (index < cumulative.length - 1 && cumulative[index] < distance) index++;
  const start = points[index - 1];
  const end = points[index];
  const segmentLength = cumulative[index] - cumulative[index - 1];
  const progress = segmentLength ? (distance - cumulative[index - 1]) / segmentLength : 0;
  return {
    angle: Math.atan2(end[1] - start[1], end[0] - start[0]),
    x: start[0] + (end[0] - start[0]) * progress,
    y: start[1] + (end[1] - start[1]) * progress
  };
}

function parseTextShadow(value: string | null | undefined): LabelShadowStyle | null {
  if (!value) return null;
  const match = value.match(/^(.+?)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px$/);
  if (!match) return null;
  const offsetX = Number(match[2]);
  const offsetY = Number(match[3]);
  return {
    blur: Number(match[4]),
    color: match[1],
    distance: Math.hypot(offsetX, offsetY),
    offsetX,
    offsetY
  };
}

function toMapLayerDependency(value: string | null | undefined): MapLayerId | null {
  const controls: Record<string, MapLayerId> = {
    toggleBurgIcons: "burgIcons",
    toggleProvinces: "provinces",
    toggleRivers: "rivers",
    toggleRoutes: "routes",
    toggleStates: "states"
  };
  return value ? (controls[value] ?? null) : null;
}

function getLabelBounds(groups: readonly LabelSceneGroup[]): SceneBounds | null {
  const labels = groups.flatMap(group => group.labels);
  if (!labels.length) return null;
  return {
    maxX: Math.max(...labels.map(label => label.anchorX)),
    maxY: Math.max(...labels.map(label => label.anchorY)),
    minX: Math.min(...labels.map(label => label.anchorX)),
    minY: Math.min(...labels.map(label => label.anchorY))
  };
}
