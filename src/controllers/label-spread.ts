import Alea from "alea";
import type { LabelType } from "@/generators/labels-generator";
import { getGroupStyle } from "@/renderers/labels/label-groups";
import { createLabelElements } from "@/renderers/labels/label-markup";
import type { LabelData } from "@/renderers/labels/labels";
import { getVisibleLabels } from "@/renderers/labels/labels-renderer";
import type { Point } from "@/types/global";

type PathLabelType = Extract<LabelType, "river" | "route">;
type PointLabelType = Exclude<LabelType, PathLabelType>;

export type LabelSpreadPatch =
  | { type: PathLabelType; entityId: number; startOffset: number }
  | { type: PointLabelType; entityId: number; dx?: number; dy?: number };

export interface LabelSpreadResult {
  patches: LabelSpreadPatch[];
  displayedLabels: number;
  initialOverlaps: number;
  remainingOverlaps: number;
  initialPathBurgOverlaps: number;
  remainingPathBurgOverlaps: number;
}

interface Measurement {
  bounds: LabelBounds;
  inkBounds: LabelBounds[];
  textLength: number;
  pathLength: number;
  upright: boolean;
}

interface LabelBounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface LabelPlacement {
  dx?: number;
  dy?: number;
  startOffset?: number;
}

interface LabelPlacementCandidate {
  placement: LabelPlacement;
  bounds: LabelBounds;
  collisionBounds: LabelBounds;
  collisionShapes?: LabelBounds[];
  burgCollisionShapes?: LabelBounds[];
  inkBounds?: LabelBounds[];
  preference: number;
}

interface LabelPlacementItem {
  id: string;
  kind?: "burg" | "path" | "label";
  obstacle?: boolean;
  candidates: LabelPlacementCandidate[];
}

interface LabelPlacementSolution {
  selected: Map<string, LabelPlacementCandidate>;
  initialOverlaps: number;
  remainingOverlaps: number;
  initialPathBurgOverlaps: number;
  remainingPathBurgOverlaps: number;
}

interface Cost {
  overlap: number;
  outside: number;
  preference: number;
}

interface PathGeometry {
  getTotalLength(): number;
  getPointAtLength(distance: number): { x: number; y: number };
}

interface BurgLabelCandidateOptions {
  current: LabelPlacementCandidate;
  iconBounds: LabelBounds;
  gap: number;
  changePenalty?: number;
  displacementScale?: number;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const DIRECTIONS = Array.from({ length: 12 }, (_, index) => (index * Math.PI * 2) / 12);
const DEFAULT_PLACEMENT_CHANGE_PENALTY = 1_000;
const BASE_BURG_SCREEN_HEIGHT = 12.5;
const BASE_BURG_PLACEMENT_CHANGE_PENALTY = 120;
const MINIMUM_START_OFFSET = 20;
const MAXIMUM_START_OFFSET = 80;
const PREFERRED_MINIMUM_START_OFFSET = 30;
const PREFERRED_MAXIMUM_START_OFFSET = 70;
const START_OFFSET_STEP = 5;
const DIRECTION_SAMPLES = 16;
const LABEL_PADDING_SCREEN = 2;
const BURG_LABEL_PADDING_SCREEN = 4;
const MINIMUM_PENETRATION_RATIO = 0.15;
const MINIMUM_OVERLAP_RATIO = 0.4;
const MINIMUM_BURG_LABEL_OVERLAP_RATIO = 0.15;
const MINIMUM_BURG_PATH_OVERLAP_RATIO = 0.5;
const MINIMUM_OBSTACLE_OVERLAP_RATIO = 0.1;
const OVERLAP_WEIGHT = 1_000;
const OUTSIDE_WEIGHT = 1e9;
const PATH_LABEL_OVERLAP_FACTOR = 0.05;
const BURG_CONFLICT_FACTOR = 10;

export async function calculateLabelSpread(): Promise<LabelSpreadResult> {
  const visibleLabels = getVisibleLabels();
  if (!visibleLabels.length) return emptyResult();

  const sandbox = new LabelMeasurementSandbox(visibleLabels);
  try {
    const burgIconBounds = getDisplayedBurgIconBounds();
    const labelItems = visibleLabels.map(label =>
      buildPlacementItem(label, sandbox.measure(label), sandbox, burgIconBounds)
    );
    const items = [...labelItems, ...getBurgIconObstacles(burgIconBounds)];

    await nextFrame();
    const ids = items.map(item => item.id).sort();
    const solution = optimizeLabelPlacements(items, mapBounds(), `${seed}|${ids.join("|")}`);
    const patches = getPatches(visibleLabels, solution.selected);
    return {
      patches,
      displayedLabels: visibleLabels.length,
      initialOverlaps: solution.initialOverlaps,
      remainingOverlaps: solution.remainingOverlaps,
      initialPathBurgOverlaps: solution.initialPathBurgOverlaps,
      remainingPathBurgOverlaps: solution.remainingPathBurgOverlaps
    };
  } finally {
    sandbox.destroy();
  }
}

function buildPlacementItem(
  label: LabelData,
  current: Measurement,
  sandbox: LabelMeasurementSandbox,
  burgIconBounds: Map<number, LabelBounds>
): LabelPlacementItem {
  const currentCandidate = toCandidate(label, current, 0);
  const isPath = label.type === "river" || label.type === "route";
  const candidates =
    label.type === "burg"
      ? buildBurgCandidates(label, currentCandidate, burgIconBounds.get(label.entityId))
      : isPath
        ? label.pathPoints?.length
          ? buildPathCandidates(label, current, currentCandidate, sandbox)
          : [currentCandidate]
        : buildPointCandidates(label, currentCandidate);
  const kind = label.type === "burg" ? "burg" : isPath ? "path" : "label";
  return { id: label.id, kind, candidates };
}

function buildBurgCandidates(
  label: LabelData,
  current: LabelPlacementCandidate,
  iconBounds?: LabelBounds
): LabelPlacementCandidate[] {
  return getBurgLabelCandidates({
    current,
    iconBounds: iconBounds ?? pointBounds(label.anchor),
    gap: 2 / Math.max(scale, 1),
    changePenalty: getBurgChangePenalty(current.bounds),
    displacementScale: scale
  });
}

function getBurgLabelCandidates({
  current,
  iconBounds,
  gap,
  changePenalty = BASE_BURG_PLACEMENT_CHANGE_PENALTY,
  displacementScale = 1
}: BurgLabelCandidateOptions): LabelPlacementCandidate[] {
  const currentDx = current.placement.dx || 0;
  const currentDy = current.placement.dy || 0;
  const labelCenterX = (current.bounds.x1 + current.bounds.x2) / 2;
  const iconCenterX = (iconBounds.x1 + iconBounds.x2) / 2;
  const top = iconBounds.y1 - gap - current.bounds.y2;
  const bottom = iconBounds.y2 + gap - current.bounds.y1;
  const shifts = [
    [iconCenterX - current.bounds.x2, top],
    [iconCenterX - labelCenterX, top],
    [iconCenterX - current.bounds.x1, top],
    [iconCenterX - current.bounds.x2, bottom],
    [iconCenterX - labelCenterX, bottom],
    [iconCenterX - current.bounds.x1, bottom]
  ];
  const candidates = shifts
    .map(([deltaX, deltaY]) => ({
      placement: { dx: round(currentDx + deltaX), dy: round(currentDy + deltaY) },
      bounds: translateBounds(current.bounds, deltaX, deltaY),
      collisionBounds: translateBounds(current.collisionBounds, deltaX, deltaY),
      collisionShapes: translateBoundsList(current.collisionShapes, deltaX, deltaY),
      burgCollisionShapes: translateBoundsList(current.burgCollisionShapes, deltaX, deltaY),
      inkBounds: translateBoundsList(current.inkBounds, deltaX, deltaY),
      preference: changePenalty + Math.hypot(deltaX, deltaY) * displacementScale
    }))
    .sort((first, second) => first.preference - second.preference)
    .filter(
      candidate => candidate.placement.dx !== current.placement.dx || candidate.placement.dy !== current.placement.dy
    );
  return [current, ...candidates];
}

function getBurgChangePenalty(bounds: LabelBounds): number {
  const screenHeight = (bounds.y2 - bounds.y1) * Math.max(scale, 1);
  return BASE_BURG_PLACEMENT_CHANGE_PENALTY * (screenHeight / BASE_BURG_SCREEN_HEIGHT) ** 2;
}

function buildPointCandidates(label: LabelData, current: LabelPlacementCandidate): LabelPlacementCandidate[] {
  const currentDx = label.dx || 0;
  const currentDy = label.dy || 0;
  const width = current.bounds.x2 - current.bounds.x1;
  const height = current.bounds.y2 - current.bounds.y1;
  const step = Math.max(Math.min(Math.max(width, height) * 0.55, 24), 3 / Math.max(scale, 1));
  const candidates = [current];

  for (const multiplier of [0.5, 1, 1.5, 2, 3, 4]) {
    const radius = step * multiplier;
    for (const angle of DIRECTIONS) {
      const dx = currentDx + Math.cos(angle) * radius;
      const dy = currentDy + Math.sin(angle) * radius;
      const deltaX = dx - currentDx;
      const deltaY = dy - currentDy;
      const bounds = translateBounds(current.bounds, deltaX, deltaY);
      if (getOutsideArea(bounds) > 0) continue;
      candidates.push({
        placement: { dx: round(dx), dy: round(dy) },
        bounds,
        collisionBounds: translateBounds(current.collisionBounds, deltaX, deltaY),
        collisionShapes: translateBoundsList(current.collisionShapes, deltaX, deltaY),
        burgCollisionShapes: translateBoundsList(current.burgCollisionShapes, deltaX, deltaY),
        inkBounds: translateBoundsList(current.inkBounds, deltaX, deltaY),
        preference: DEFAULT_PLACEMENT_CHANGE_PENALTY + deltaX ** 2 + deltaY ** 2
      });
    }
  }
  return candidates;
}

function buildPathCandidates(
  label: LabelData,
  currentMeasurement: Measurement,
  current: LabelPlacementCandidate,
  sandbox: LabelMeasurementSandbox
): LabelPlacementCandidate[] {
  const pathPoints = label.pathPoints!;
  const currentOffset = round(label.startOffset ?? 50);
  const offsets = getPathStartOffsetCandidates(currentOffset);
  const candidates: LabelPlacementCandidate[] = [];

  for (const startOffset of offsets) {
    const isCurrent = startOffset === currentOffset;
    const measurement = isCurrent ? currentMeasurement : sandbox.measure({ ...label, pathPoints, startOffset });
    if (!measurement.upright || !fitsPath(measurement, startOffset) || getOutsideArea(measurement.bounds) > 0) continue;
    const preference = getPathStartOffsetPreference(startOffset);
    if (isCurrent) {
      candidates.push({ ...current, preference });
      continue;
    }
    candidates.push({
      placement: { startOffset: round(startOffset) },
      bounds: measurement.bounds,
      collisionBounds: getCollisionEnvelope(measurement.inkBounds),
      collisionShapes: measurement.inkBounds.map(padBounds),
      inkBounds: measurement.inkBounds,
      preference
    });
  }
  return candidates.length ? candidates : [current];
}

function getPathStartOffsetCandidates(currentOffset: number): number[] {
  const clampedCurrent = clamp(round(currentOffset), MINIMUM_START_OFFSET, MAXIMUM_START_OFFSET);
  const offsets = Array.from(
    { length: (MAXIMUM_START_OFFSET - MINIMUM_START_OFFSET) / START_OFFSET_STEP + 1 },
    (_, index) => MINIMUM_START_OFFSET + index * START_OFFSET_STEP
  );
  return [clampedCurrent, ...offsets.filter(offset => offset !== clampedCurrent)];
}

function getPathStartOffsetPreference(startOffset: number): number {
  const distance =
    startOffset < PREFERRED_MINIMUM_START_OFFSET
      ? PREFERRED_MINIMUM_START_OFFSET - startOffset
      : startOffset > PREFERRED_MAXIMUM_START_OFFSET
        ? startOffset - PREFERRED_MAXIMUM_START_OFFSET
        : 0;
  return distance ** 2;
}

function isPathTextUpright(path: PathGeometry, textLength: number, startOffset: number): boolean {
  const pathLength = path.getTotalLength();
  if (!pathLength || !textLength) return false;
  const center = (pathLength * startOffset) / 100;
  const start = center - textLength / 2;
  const end = center + textLength / 2;
  if (start < 0 || end > pathLength) return false;

  let previous = path.getPointAtLength(start);
  for (let index = 1; index <= DIRECTION_SAMPLES; index++) {
    const point = path.getPointAtLength(start + ((end - start) * index) / DIRECTION_SAMPLES);
    const dx = point.x - previous.x;
    const distance = Math.hypot(dx, point.y - previous.y);
    if (distance && dx / distance < -0.02) return false;
    previous = point;
  }
  return true;
}

function getPatches(labels: LabelData[], selected: Map<string, LabelPlacementCandidate>): LabelSpreadPatch[] {
  const patches: LabelSpreadPatch[] = [];
  for (const label of labels) {
    const candidate = selected.get(label.id);
    if (label.type === "river" || label.type === "route") {
      const startOffset = candidate?.placement.startOffset;
      if (startOffset === undefined || startOffset === round(label.startOffset ?? 50)) continue;
      patches.push({ type: label.type, entityId: label.entityId, startOffset });
      continue;
    }
    if (!candidate || !placementChanged(label, candidate.placement)) continue;
    const { dx, dy } = candidate.placement;
    patches.push({ type: label.type, entityId: label.entityId, dx, dy });
  }
  return patches;
}

function getDisplayedBurgIconBounds(): Map<number, LabelBounds> {
  const mapRect = document.querySelector<SVGSVGElement>("#map")?.getBoundingClientRect();
  const viewbox = document.querySelector<SVGGraphicsElement>("#viewbox");
  const screenMatrix = viewbox?.getScreenCTM();
  if (!mapRect || !screenMatrix) return new Map();

  const inverse = screenMatrix.inverse();
  const boundsByBurg = new Map<number, LabelBounds>();
  const icons = document.querySelectorAll<SVGGraphicsElement>("#burgIcons use[data-id], #anchors use[data-id]");
  for (const icon of icons) {
    const id = Number(icon.dataset.id);
    const rect = icon.getBoundingClientRect();
    if (!Number.isInteger(id) || !intersectsScreenRect(rect, mapRect)) continue;
    const bounds = screenRectToMapBounds(rect, inverse);
    const existing = boundsByBurg.get(id);
    boundsByBurg.set(id, existing ? unionBounds(existing, bounds) : bounds);
  }
  return boundsByBurg;
}

function getBurgIconObstacles(boundsByBurg: Map<number, LabelBounds>): LabelPlacementItem[] {
  return [...boundsByBurg].map(([id, bounds]) => ({
    id: `labelSpreadBurgIcon${id}`,
    obstacle: true,
    candidates: [{ placement: {}, bounds, collisionBounds: bounds, preference: 0 }]
  }));
}

function intersectsScreenRect(rect: DOMRect, mapRect: DOMRect): boolean {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.right > mapRect.left &&
    rect.left < mapRect.right &&
    rect.bottom > mapRect.top &&
    rect.top < mapRect.bottom
  );
}

function screenRectToMapBounds(rect: DOMRect, inverse: DOMMatrix): LabelBounds {
  const topLeft = new DOMPoint(rect.left, rect.top).matrixTransform(inverse);
  const bottomRight = new DOMPoint(rect.right, rect.bottom).matrixTransform(inverse);
  return { x1: topLeft.x, y1: topLeft.y, x2: bottomRight.x, y2: bottomRight.y };
}

function unionBounds(first: LabelBounds, second: LabelBounds): LabelBounds {
  return {
    x1: Math.min(first.x1, second.x1),
    y1: Math.min(first.y1, second.y1),
    x2: Math.max(first.x2, second.x2),
    y2: Math.max(first.y2, second.y2)
  };
}

function pointBounds([x, y]: Point): LabelBounds {
  return { x1: x, y1: y, x2: x, y2: y };
}

function placementChanged(label: LabelData, placement: LabelPlacement): boolean {
  if (
    (placement.dx !== undefined && placement.dx !== round(label.dx || 0)) ||
    (placement.dy !== undefined && placement.dy !== round(label.dy || 0))
  )
    return true;
  return placement.startOffset !== undefined && placement.startOffset !== round(label.startOffset ?? 50);
}

function toCandidate(label: LabelData, measurement: Measurement, preference: number): LabelPlacementCandidate {
  const isPath = label.type === "river" || label.type === "route";
  const placement: LabelPlacement = isPath
    ? { startOffset: round(label.startOffset ?? 50) }
    : { dx: round(label.dx || 0), dy: round(label.dy || 0) };
  const collisionShapes = measurement.inkBounds.map(bounds => padBounds(bounds, LABEL_PADDING_SCREEN));
  const burgCollisionShapes =
    label.type === "burg"
      ? measurement.inkBounds.map(bounds => padBounds(bounds, BURG_LABEL_PADDING_SCREEN))
      : undefined;
  return {
    placement,
    bounds: measurement.bounds,
    collisionBounds: (burgCollisionShapes ?? collisionShapes).reduce(unionBounds),
    collisionShapes,
    burgCollisionShapes,
    inkBounds: measurement.inkBounds,
    preference
  };
}

class LabelMeasurementSandbox {
  private readonly root: SVGSVGElement;
  private readonly groups = new Map<string, SVGGElement>();
  private counter = 0;

  constructor(labels: LabelData[]) {
    this.root = document.createElementNS(SVG_NS, "svg");
    this.root.setAttribute("width", String(graphWidth));
    this.root.setAttribute("height", String(graphHeight));
    this.root.setAttribute("viewBox", `0 0 ${graphWidth} ${graphHeight}`);
    this.root.setAttribute("aria-hidden", "true");
    this.root.style.cssText = `position:fixed;left:0;top:0;width:${graphWidth}px;height:${graphHeight}px;overflow:visible;opacity:0;pointer-events:none;z-index:-1`;
    const renderedLabels = document.querySelector<SVGGElement>("#labels");
    const fontSize =
      renderedLabels?.getAttribute("font-size") || (renderedLabels && getComputedStyle(renderedLabels).fontSize);
    if (fontSize) this.root.setAttribute("font-size", fontSize);
    document.body.appendChild(this.root);

    for (const groupName of new Set(labels.map(label => label.group)))
      this.groups.set(groupName, this.createGroup(groupName));
  }

  measure(label: LabelData): Measurement {
    const group = this.groups.get(label.group);
    if (!group) throw new Error(`Cannot measure missing Label Group: ${label.group}`);
    const measuredLabel = { ...label, id: `labelSpreadMeasurement${this.counter++}` };
    const { text, path } = createLabelElements(measuredLabel, document);
    if (path) group.appendChild(path);
    group.appendChild(text);
    const rootRect = this.root.getBoundingClientRect();
    const textRect = text.getBoundingClientRect();
    const textPath = text.querySelector<SVGTextPathElement>("textPath");
    const inkBounds = getTextInkBounds(text, rootRect);
    const textLength = textPath?.getComputedTextLength() ?? text.getComputedTextLength();
    const pathLength = path?.getTotalLength() ?? 0;
    const measurement = {
      bounds: {
        x1: textRect.left - rootRect.left,
        y1: textRect.top - rootRect.top,
        x2: textRect.right - rootRect.left,
        y2: textRect.bottom - rootRect.top
      },
      inkBounds: inkBounds.length
        ? inkBounds
        : [
            {
              x1: textRect.left - rootRect.left,
              y1: textRect.top - rootRect.top,
              x2: textRect.right - rootRect.left,
              y2: textRect.bottom - rootRect.top
            }
          ],
      textLength,
      pathLength,
      upright: path ? isPathTextUpright(path, textLength, label.startOffset ?? 50) : true
    };
    text.remove();
    path?.remove();
    return measurement;
  }

  destroy(): void {
    this.root.remove();
  }

  private createGroup(groupName: string): SVGGElement {
    const groupOptions = options.labels.groups.find(group => group.name === groupName);
    if (!groupOptions) throw new Error(`Label Group not found: ${groupName}`);
    const group = document.createElementNS(SVG_NS, "g");
    const groupStyle = getGroupStyle(groupOptions);
    for (const [attribute, value] of Object.entries(groupStyle)) {
      if (value !== null) group.setAttribute(attribute, String(value));
    }
    const dx = Number(group.dataset.dx) || 0;
    const dy = Number(group.dataset.dy) || 0;
    group.style.transform = dx || dy ? `translate(${dx}em, ${dy}em)` : "";
    this.root.appendChild(group);
    return group;
  }
}

function getTextInkBounds(text: SVGTextElement, rootRect: DOMRect): LabelBounds[] {
  const matrix = text.getScreenCTM();
  if (!matrix) return [];

  const characters = text.textContent ?? "";
  const shapes: LabelBounds[] = [];
  let run: LabelBounds | undefined;
  let runLength = 0;
  const characterCount = Math.min(text.getNumberOfChars(), characters.length);

  for (let index = 0; index < characterCount; index++) {
    if (/\s/u.test(characters[index])) {
      if (run) shapes.push(run);
      run = undefined;
      runLength = 0;
      continue;
    }

    try {
      const extent = text.getExtentOfChar(index);
      const verticalTrim = extent.height * 0.12;
      const bounds = transformRectToRootBounds(
        extent.x,
        extent.y + verticalTrim,
        extent.width,
        Math.max(extent.height - verticalTrim * 2, 0),
        matrix,
        rootRect
      );
      run = run ? unionBounds(run, bounds) : bounds;
      runLength++;
      if (runLength < 3) continue;
      shapes.push(run);
      run = undefined;
      runLength = 0;
    } catch {
      // Some browsers cannot measure a character while its font is still resolving.
    }
  }
  if (run) shapes.push(run);
  return shapes.filter(bounds => bounds.x2 > bounds.x1 && bounds.y2 > bounds.y1);
}

function transformRectToRootBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  matrix: DOMMatrix,
  rootRect: DOMRect
): LabelBounds {
  const points = [
    new DOMPoint(x, y),
    new DOMPoint(x + width, y),
    new DOMPoint(x, y + height),
    new DOMPoint(x + width, y + height)
  ].map(point => point.matrixTransform(matrix));
  return {
    x1: Math.min(...points.map(point => point.x)) - rootRect.left,
    y1: Math.min(...points.map(point => point.y)) - rootRect.top,
    x2: Math.max(...points.map(point => point.x)) - rootRect.left,
    y2: Math.max(...points.map(point => point.y)) - rootRect.top
  };
}

function padBounds(bounds: LabelBounds, screenPadding = LABEL_PADDING_SCREEN): LabelBounds {
  const padding = screenPadding / Math.max(scale, 1);
  return { x1: bounds.x1 - padding, y1: bounds.y1 - padding, x2: bounds.x2 + padding, y2: bounds.y2 + padding };
}

function translateBounds(bounds: LabelBounds, dx: number, dy: number): LabelBounds {
  return { x1: bounds.x1 + dx, y1: bounds.y1 + dy, x2: bounds.x2 + dx, y2: bounds.y2 + dy };
}

function translateBoundsList(bounds: LabelBounds[] | undefined, dx: number, dy: number): LabelBounds[] | undefined {
  return bounds?.map(bound => translateBounds(bound, dx, dy));
}

function getCollisionEnvelope(inkBounds: LabelBounds[]): LabelBounds {
  return inkBounds.map(padBounds).reduce(unionBounds);
}

function getOutsideArea(bounds: LabelBounds, map = mapBounds()): number {
  const width = Math.max(bounds.x2 - bounds.x1, 0);
  const height = Math.max(bounds.y2 - bounds.y1, 0);
  const insideWidth = Math.max(Math.min(bounds.x2, map.x2) - Math.max(bounds.x1, map.x1), 0);
  const insideHeight = Math.max(Math.min(bounds.y2, map.y2) - Math.max(bounds.y1, map.y1), 0);
  return width * height - insideWidth * insideHeight;
}

function mapBounds(): LabelBounds {
  return { x1: 0, y1: 0, x2: graphWidth, y2: graphHeight };
}

function fitsPath(measurement: Measurement, startOffset: number): boolean {
  if (!measurement.pathLength || !measurement.textLength) return false;
  const center = (measurement.pathLength * startOffset) / 100;
  return measurement.textLength / 2 <= Math.min(center, measurement.pathLength - center);
}

function optimizeLabelPlacements(
  items: LabelPlacementItem[],
  bounds: LabelBounds,
  randomSeed: string
): LabelPlacementSolution {
  const validItems = items.filter(item => item.candidates.length);
  const selectedIndexes = new Uint16Array(validItems.length);
  const initialPairs = getOverlapPairs(validItems, selectedIndexes);
  const components = getCollisionComponents(validItems.length, initialPairs);
  const interactions = getPotentialInteractions(validItems);
  const random = Alea(randomSeed);

  for (const component of components) {
    greedyPlace(component, validItems, selectedIndexes, bounds, interactions);
    anneal(component, validItems, selectedIndexes, bounds, interactions, random);
  }

  const selected = new Map<string, LabelPlacementCandidate>();
  validItems.forEach((item, index) => {
    selected.set(item.id, item.candidates[selectedIndexes[index]]);
  });
  const remainingPairs = getOverlapPairs(validItems, selectedIndexes);
  return {
    selected,
    initialOverlaps: initialPairs.length,
    remainingOverlaps: remainingPairs.length,
    initialPathBurgOverlaps: countPathBurgOverlaps(validItems, initialPairs),
    remainingPathBurgOverlaps: countPathBurgOverlaps(validItems, remainingPairs)
  };
}

function countPathBurgOverlaps(items: LabelPlacementItem[], pairs: [number, number][]): number {
  return pairs.filter(([firstIndex, secondIndex]) => {
    const first = items[firstIndex];
    const second = items[secondIndex];
    return (
      (first.kind === "path" && (second.kind === "burg" || second.obstacle)) ||
      (second.kind === "path" && (first.kind === "burg" || first.obstacle))
    );
  }).length;
}

function greedyPlace(
  component: number[],
  items: LabelPlacementItem[],
  selectedIndexes: Uint16Array,
  bounds: LabelBounds,
  interactions: number[][]
): void {
  const ordered = [...component].sort((first, second) => {
    const preferenceDifference =
      getMinimumMovementPreference(items[first]) - getMinimumMovementPreference(items[second]);
    return preferenceDifference || items[first].id.localeCompare(items[second].id);
  });
  for (const itemIndex of ordered) {
    const item = items[itemIndex];
    let bestIndex = selectedIndexes[itemIndex];
    let bestCost = getCandidateCost(itemIndex, bestIndex, items, selectedIndexes, bounds, interactions);

    for (let candidateIndex = 0; candidateIndex < item.candidates.length; candidateIndex++) {
      const cost = getCandidateCost(itemIndex, candidateIndex, items, selectedIndexes, bounds, interactions);
      if (!isBetter(cost, bestCost)) continue;
      bestIndex = candidateIndex;
      bestCost = cost;
    }
    selectedIndexes[itemIndex] = bestIndex;
  }
}

function anneal(
  component: number[],
  items: LabelPlacementItem[],
  selectedIndexes: Uint16Array,
  bounds: LabelBounds,
  interactions: number[][],
  random: () => number
): void {
  if (!component.some(index => items[index].candidates.length > 1)) return;

  const bestIndexes = selectedIndexes.slice();
  let currentValue = toScalar(getStateCost(component, items, selectedIndexes, bounds, interactions));
  let bestValue = currentValue;
  const iterations = Math.min(Math.max(component.length * 500, 1500), 12000);
  let temperature = Math.max(currentValue * 0.02, 10);

  for (let iteration = 0; iteration < iterations; iteration++) {
    const itemIndex = component[Math.floor(random() * component.length)];
    const candidates = items[itemIndex].candidates;
    if (candidates.length < 2) continue;

    const previousIndex = selectedIndexes[itemIndex];
    const nextIndex = Math.floor(random() * candidates.length);
    if (nextIndex === previousIndex) continue;

    const previousCost = getCandidateCost(itemIndex, previousIndex, items, selectedIndexes, bounds, interactions);
    selectedIndexes[itemIndex] = nextIndex;
    const nextCost = getCandidateCost(itemIndex, nextIndex, items, selectedIndexes, bounds, interactions);
    const delta = toScalar(nextCost) - toScalar(previousCost);
    if (delta <= 0 || random() < Math.exp(-delta / temperature)) {
      currentValue += delta;
      if (currentValue < bestValue) {
        bestValue = currentValue;
        bestIndexes.set(selectedIndexes);
      }
    } else selectedIndexes[itemIndex] = previousIndex;

    temperature *= 0.996;
  }

  selectedIndexes.set(bestIndexes);
}

function getCandidateCost(
  itemIndex: number,
  candidateIndex: number,
  items: LabelPlacementItem[],
  selectedIndexes: Uint16Array,
  bounds: LabelBounds,
  interactions: number[][]
): Cost {
  const candidate = items[itemIndex].candidates[candidateIndex];
  let overlap = 0;
  for (const otherIndex of interactions[itemIndex]) {
    const other = items[otherIndex].candidates[selectedIndexes[otherIndex]];
    overlap += getPairOverlap(items[itemIndex], candidate, items[otherIndex], other);
  }
  return { overlap, outside: getOutsideArea(candidate.bounds, bounds), preference: candidate.preference };
}

function getStateCost(
  component: number[],
  items: LabelPlacementItem[],
  selectedIndexes: Uint16Array,
  bounds: LabelBounds,
  interactions: number[][]
): Cost {
  const componentSet = new Set(component);
  let overlap = 0;
  let outside = 0;
  let preference = 0;

  for (const itemIndex of component) {
    const candidate = items[itemIndex].candidates[selectedIndexes[itemIndex]];
    outside += getOutsideArea(candidate.bounds, bounds);
    preference += candidate.preference;
    for (const otherIndex of interactions[itemIndex]) {
      if (componentSet.has(otherIndex) && otherIndex < itemIndex) continue;
      const other = items[otherIndex].candidates[selectedIndexes[otherIndex]];
      overlap += getPairOverlap(items[itemIndex], candidate, items[otherIndex], other);
    }
  }
  return { overlap, outside, preference };
}

function getPotentialInteractions(items: LabelPlacementItem[]): number[][] {
  const interactions = Array.from({ length: items.length }, () => [] as number[]);
  const ordered = items
    .map((item, index) => ({
      index,
      bounds: item.candidates.map(candidate => candidate.collisionBounds).reduce(unionBounds)
    }))
    .sort((first, second) => first.bounds.x1 - second.bounds.x1);

  for (let left = 0; left < ordered.length; left++) {
    const first = ordered[left];
    for (let right = left + 1; right < ordered.length; right++) {
      const second = ordered[right];
      if (second.bounds.x1 >= first.bounds.x2) break;
      if (second.bounds.y1 >= first.bounds.y2 || second.bounds.y2 <= first.bounds.y1) continue;
      interactions[first.index].push(second.index);
      interactions[second.index].push(first.index);
    }
  }
  return interactions;
}

function getOverlapPairs(items: LabelPlacementItem[], selectedIndexes: Uint16Array): [number, number][] {
  const ordered = items
    .map((item, index) => ({ index, bounds: item.candidates[selectedIndexes[index]].collisionBounds }))
    .sort((first, second) => first.bounds.x1 - second.bounds.x1);
  const pairs: [number, number][] = [];

  for (let left = 0; left < ordered.length; left++) {
    const first = ordered[left];
    for (let right = left + 1; right < ordered.length; right++) {
      const second = ordered[right];
      if (second.bounds.x1 >= first.bounds.x2) break;
      const firstItem = items[first.index];
      const secondItem = items[second.index];
      const firstCandidate = firstItem.candidates[selectedIndexes[first.index]];
      const secondCandidate = secondItem.candidates[selectedIndexes[second.index]];
      if (getPairOverlap(firstItem, firstCandidate, secondItem, secondCandidate) > 0)
        pairs.push([first.index, second.index]);
    }
  }
  return pairs;
}

function getMinimumMovementPreference(item: LabelPlacementItem): number {
  if (item.candidates.length < 2) return Number.POSITIVE_INFINITY;
  return Math.min(...item.candidates.slice(1).map(candidate => candidate.preference));
}

function getPairOverlap(
  firstItem: LabelPlacementItem,
  first: LabelPlacementCandidate,
  secondItem: LabelPlacementItem,
  second: LabelPlacementCandidate
): number {
  if (firstItem.obstacle && secondItem.obstacle) return 0;
  if (firstItem.obstacle)
    return (
      getShapesOverlap([first.bounds], second.inkBounds ?? [second.bounds], MINIMUM_OBSTACLE_OVERLAP_RATIO) *
      BURG_CONFLICT_FACTOR
    );
  if (secondItem.obstacle)
    return (
      getShapesOverlap(first.inkBounds ?? [first.bounds], [second.bounds], MINIMUM_OBSTACLE_OVERLAP_RATIO) *
      BURG_CONFLICT_FACTOR
    );
  const isPathToBurg =
    (firstItem.kind === "path" && secondItem.kind === "burg") ||
    (firstItem.kind === "burg" && secondItem.kind === "path");
  const isBurgToBurg = firstItem.kind === "burg" && secondItem.kind === "burg";
  const firstShapes = isBurgToBurg
    ? (first.burgCollisionShapes ?? first.collisionShapes ?? [first.collisionBounds])
    : (first.collisionShapes ?? [first.collisionBounds]);
  const secondShapes = isBurgToBurg
    ? (second.burgCollisionShapes ?? second.collisionShapes ?? [second.collisionBounds])
    : (second.collisionShapes ?? [second.collisionBounds]);
  const overlap = getShapesOverlap(
    firstShapes,
    secondShapes,
    isPathToBurg
      ? MINIMUM_BURG_PATH_OVERLAP_RATIO
      : isBurgToBurg
        ? MINIMUM_BURG_LABEL_OVERLAP_RATIO
        : MINIMUM_OVERLAP_RATIO
  );
  if (isPathToBurg || isBurgToBurg) return overlap * BURG_CONFLICT_FACTOR;
  return firstItem.kind === "path" || secondItem.kind === "path" ? overlap * PATH_LABEL_OVERLAP_FACTOR : overlap;
}

function getShapesOverlap(first: LabelBounds[], second: LabelBounds[], minimumOverlapRatio: number): number {
  let overlap = 0;
  for (const firstBounds of first) {
    for (const secondBounds of second)
      overlap += getMeaningfulOverlapArea(firstBounds, secondBounds, minimumOverlapRatio);
  }
  return overlap;
}

function getMeaningfulOverlapArea(first: LabelBounds, second: LabelBounds, minimumOverlapRatio: number): number {
  const width = Math.min(first.x2, second.x2) - Math.max(first.x1, second.x1);
  const height = Math.min(first.y2, second.y2) - Math.max(first.y1, second.y1);
  if (width <= 0 || height <= 0) return 0;

  const minimumWidth = Math.min(first.x2 - first.x1, second.x2 - second.x1);
  const minimumHeight = Math.min(first.y2 - first.y1, second.y2 - second.y1);
  if (width < minimumWidth * MINIMUM_PENETRATION_RATIO || height < minimumHeight * MINIMUM_PENETRATION_RATIO) return 0;
  const firstArea = Math.max(first.x2 - first.x1, 0) * Math.max(first.y2 - first.y1, 0);
  const secondArea = Math.max(second.x2 - second.x1, 0) * Math.max(second.y2 - second.y1, 0);
  const smallerArea = Math.min(firstArea, secondArea);
  if (!smallerArea) return 0;
  const overlapRatio = (width * height) / smallerArea;
  return overlapRatio >= minimumOverlapRatio ? overlapRatio : 0;
}

function getCollisionComponents(itemCount: number, pairs: [number, number][]): number[][] {
  const links = Array.from({ length: itemCount }, () => [] as number[]);
  for (const [first, second] of pairs) {
    links[first].push(second);
    links[second].push(first);
  }

  const visited = new Uint8Array(itemCount);
  const components: number[][] = [];
  for (let index = 0; index < itemCount; index++) {
    if (visited[index] || !links[index].length) continue;
    const component: number[] = [];
    const stack = [index];
    visited[index] = 1;
    while (stack.length) {
      const current = stack.pop()!;
      component.push(current);
      for (const linked of links[current]) {
        if (visited[linked]) continue;
        visited[linked] = 1;
        stack.push(linked);
      }
    }
    components.push(component);
  }
  return components;
}

function isBetter(first: Cost, second: Cost): boolean {
  return toScalar(first) < toScalar(second);
}

function toScalar(cost: Cost): number {
  return cost.overlap * OVERLAP_WEIGHT + cost.outside * OUTSIDE_WEIGHT + cost.preference;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function emptyResult(): LabelSpreadResult {
  return {
    patches: [],
    displayedLabels: 0,
    initialOverlaps: 0,
    remainingOverlaps: 0,
    initialPathBurgOverlaps: 0,
    remainingPathBurgOverlaps: 0
  };
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

/** Internal seam for focused geometry tests. Production callers use calculateLabelSpread. */
export const labelSpreadInternals = {
  getBurgLabelCandidates,
  getPathStartOffsetCandidates,
  getPathStartOffsetPreference,
  isPathTextUpright,
  optimizeLabelPlacements
};
