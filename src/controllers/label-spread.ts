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
}

/** Everything the solver mutates or reads while searching for a placement */
interface SolverState {
  items: LabelPlacementItem[];
  selected: Uint16Array; // candidate index picked per item
  staticCosts: Float64Array[]; // per candidate cost that never depends on the other items
  interactions: number[][]; // items that can collide with this one under some candidate
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

// candidate generation
const DIRECTIONS = Array.from({ length: 12 }, (_, index) => (index * Math.PI * 2) / 12);
const POINT_STEP_MULTIPLIERS = [0.4, 0.8, 1.2, 1.8, 2.5, 3.5]; // in label heights
const POINT_PLACEMENT_CHANGE_PENALTY = 60;
const POINT_DISPLACEMENT_WEIGHT = 140;
const BASE_BURG_SCREEN_HEIGHT = 12.5;
const BASE_BURG_PLACEMENT_CHANGE_PENALTY = 120;
const BURG_ICON_GAP_SCREEN = 2;
const MINIMUM_START_OFFSET = 20;
const MAXIMUM_START_OFFSET = 80;
const PREFERRED_MINIMUM_START_OFFSET = 30;
const PREFERRED_MAXIMUM_START_OFFSET = 70;
const START_OFFSET_STEP = 5;
const PATH_PLACEMENT_CHANGE_PENALTY = 40;
const DIRECTION_SAMPLES = 16;
const MINIMUM_POINT_STEP_SCREEN = 3;

// collision model. Overlap is measured as the covered fraction of the smaller glyph run,
// ramped in so that grazing contact stays free while a real clash always has a gradient to follow
const LABEL_PADDING_SCREEN = 2;
const BURG_LABEL_PADDING_SCREEN = 4;
const IGNORED_OVERLAP_RATIO = 0.04;
const FULL_OVERLAP_RATIO = 0.2;
const OVERLAP_WEIGHT = 1_000; // cost of one fully covered glyph run
const OUTSIDE_WEIGHT = 1e9;
const INVALID_PLACEMENT_PENALTY = 5 * OVERLAP_WEIGHT;
const BURG_CONFLICT_WEIGHT = 2;
const OBSTACLE_CONFLICT_WEIGHT = 6; // hiding an icon costs the reader the settlement itself, not just its name
const PATH_CONFLICT_WEIGHT = 0.4;

// solver
const MINIMUM_SCALE = 0.25;
const REFINE_PASSES = 8;
const ANNEAL_ITERATIONS_PER_ITEM = 400;
const MINIMUM_ANNEAL_ITERATIONS = 2_000;
const MAXIMUM_ANNEAL_ITERATIONS = 20_000;
const START_TEMPERATURE = OVERLAP_WEIGHT * 0.4;
const END_TEMPERATURE = OVERLAP_WEIGHT * 0.01;
const CONFLICTED_ITEM_BIAS = 0.75;

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
    return {
      patches: getPatches(visibleLabels, solution.selected),
      displayedLabels: visibleLabels.length,
      initialOverlaps: solution.initialOverlaps,
      remainingOverlaps: solution.remainingOverlaps
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
    gap: toMapUnits(BURG_ICON_GAP_SCREEN),
    changePenalty: getBurgChangePenalty(current.bounds),
    displacementScale: scale
  });
}

/**
 * The six placements a Burg name can hold without hiding its icon: centred above or below with a
 * fixed gap, or tucked into one of the four diagonals, which clear the icon sideways instead.
 * Distances are measured from the text ink rather than its box, so the gap reads the same whatever
 * ascenders and descenders the name happens to have.
 */
function getBurgLabelCandidates({
  current,
  iconBounds,
  gap,
  changePenalty = BASE_BURG_PLACEMENT_CHANGE_PENALTY,
  displacementScale = 1
}: BurgLabelCandidateOptions): LabelPlacementCandidate[] {
  const currentDx = current.placement.dx || 0;
  const currentDy = current.placement.dy || 0;
  const ink = getInkEnvelope(current);
  const centered = (iconBounds.x1 + iconBounds.x2) / 2 - (ink.x1 + ink.x2) / 2;
  const iconCenterY = (iconBounds.y1 + iconBounds.y2) / 2;
  const above = iconBounds.y1 - gap - ink.y2;
  const below = iconBounds.y2 + gap - ink.y1;
  const left = iconBounds.x1 - gap - ink.x2;
  const right = iconBounds.x2 + gap - ink.x1;
  const shifts = [
    [centered, above], // top
    [centered, below], // bottom
    [left, iconCenterY - ink.y2], // top-left
    [right, iconCenterY - ink.y2], // top-right
    [left, iconCenterY - ink.y1], // bottom-left
    [right, iconCenterY - ink.y1] // bottom-right
  ];
  const candidates = shifts
    .map(([deltaX, deltaY]) => ({
      ...translateCandidate(current, deltaX, deltaY),
      placement: { dx: round(currentDx + deltaX), dy: round(currentDy + deltaY) },
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

// Point labels move in rings around the current spot. Both the ring radius and its cost are
// expressed in label heights, so a tiny Burg name and a huge State name behave the same way
function buildPointCandidates(label: LabelData, current: LabelPlacementCandidate): LabelPlacementCandidate[] {
  const currentDx = label.dx || 0;
  const currentDy = label.dy || 0;
  const step = Math.max(current.bounds.y2 - current.bounds.y1, toMapUnits(MINIMUM_POINT_STEP_SCREEN));
  const map = mapBounds();
  const candidates = [current];

  for (const multiplier of POINT_STEP_MULTIPLIERS) {
    const radius = step * multiplier;
    const preference = POINT_PLACEMENT_CHANGE_PENALTY + multiplier ** 2 * POINT_DISPLACEMENT_WEIGHT;
    for (const angle of DIRECTIONS) {
      const deltaX = Math.cos(angle) * radius;
      const deltaY = Math.sin(angle) * radius;
      const translated = translateCandidate(current, deltaX, deltaY);
      if (getOutsideArea(translated.bounds, map) > 0) continue;
      candidates.push({
        ...translated,
        placement: { dx: round(currentDx + deltaX), dy: round(currentDy + deltaY) },
        preference
      });
    }
  }
  return candidates;
}

// Path labels can only slide along their own path, so every offset has to be measured separately
function buildPathCandidates(
  label: LabelData,
  currentMeasurement: Measurement,
  current: LabelPlacementCandidate,
  sandbox: LabelMeasurementSandbox
): LabelPlacementCandidate[] {
  const currentOffset = round(label.startOffset ?? 50);
  const isCurrentValid = currentMeasurement.upright && fitsPath(currentMeasurement, currentOffset);
  const candidates: LabelPlacementCandidate[] = [
    {
      ...current,
      preference: getPathStartOffsetPreference(currentOffset) + (isCurrentValid ? 0 : INVALID_PLACEMENT_PENALTY)
    }
  ];

  const offsets = getPathStartOffsetCandidates(currentOffset).filter(offset => offset !== currentOffset);
  for (const [startOffset, measurement] of sandbox.measurePathOffsets(label, offsets)) {
    if (getOutsideArea(measurement.bounds) > 0) continue;
    candidates.push({
      placement: { startOffset: round(startOffset) },
      bounds: measurement.bounds,
      collisionBounds: getCollisionEnvelope(measurement.inkBounds),
      collisionShapes: measurement.inkBounds.map(bounds => padBounds(bounds)),
      inkBounds: measurement.inkBounds,
      preference: PATH_PLACEMENT_CHANGE_PENALTY + getPathStartOffsetPreference(startOffset)
    });
  }
  return candidates;
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

    const burg = pack.burgs[id];
    if (burg?.i !== id || burg.removed) continue;
    const bounds = screenRectToMapBounds(rect, inverse);
    if (!isDrawnOn(bounds, burg.x, burg.y)) continue;

    const existing = boundsByBurg.get(id);
    boundsByBurg.set(id, existing ? unionBounds(existing, bounds) : bounds);
  }
  return boundsByBurg;
}

/**
 * The icons layer can lag behind the world state, and then a `data-id` still resolves to an icon
 * left over from an earlier map. Anchoring a name to one of those throws it clear across the map,
 * so an icon only counts as a Burg's own when it is actually drawn on that Burg. The tolerance
 * leaves room for symbols whose artwork hangs off the point they are placed at.
 */
function isDrawnOn(bounds: LabelBounds, x: number, y: number): boolean {
  const tolerance = Math.max(bounds.x2 - bounds.x1, bounds.y2 - bounds.y1);
  return (
    x >= bounds.x1 - tolerance && x <= bounds.x2 + tolerance && y >= bounds.y1 - tolerance && y <= bounds.y2 + tolerance
  );
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
  private readonly rootRect: DOMRect;
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
    this.rootRect = this.root.getBoundingClientRect(); // fixed position and size, so it never moves
  }

  measure(label: LabelData): Measurement {
    const { text, path } = this.attach(label);
    const textPath = text.querySelector<SVGTextPathElement>("textPath");
    const textLength = textPath?.getComputedTextLength() ?? text.getComputedTextLength();
    const pathLength = path?.getTotalLength() ?? 0;
    const upright = path ? isPathTextUpright(path, textLength, label.startOffset ?? 50) : true;
    const measurement = this.read(text, textLength, pathLength, upright);
    text.remove();
    path?.remove();
    return measurement;
  }

  /** Measures one path label at several offsets, reusing the same elements to avoid re-laying out the path */
  measurePathOffsets(label: LabelData, startOffsets: number[]): Map<number, Measurement> {
    const measurements = new Map<number, Measurement>();
    if (!label.pathPoints?.length || !startOffsets.length) return measurements;

    const { text, path } = this.attach(label);
    const textPath = text.querySelector<SVGTextPathElement>("textPath");
    if (path && textPath) {
      const pathLength = path.getTotalLength();
      const textLength = textPath.getComputedTextLength();
      for (const startOffset of startOffsets) {
        // reject cheaply before paying for the per-character ink measurement
        if (!fitsLength(pathLength, textLength, startOffset)) continue;
        if (!isPathTextUpright(path, textLength, startOffset)) continue;
        textPath.setAttribute("startOffset", `${startOffset}%`);
        measurements.set(startOffset, this.read(text, textLength, pathLength, true));
      }
    }
    text.remove();
    path?.remove();
    return measurements;
  }

  destroy(): void {
    this.root.remove();
  }

  private attach(label: LabelData) {
    const group = this.groups.get(label.group);
    if (!group) throw new Error(`Cannot measure missing Label Group: ${label.group}`);
    const elements = createLabelElements({ ...label, id: `labelSpreadMeasurement${this.counter++}` }, document);
    if (elements.path) group.appendChild(elements.path);
    group.appendChild(elements.text);
    return elements;
  }

  private read(text: SVGTextElement, textLength: number, pathLength: number, upright: boolean): Measurement {
    const textRect = text.getBoundingClientRect();
    const bounds = {
      x1: textRect.left - this.rootRect.left,
      y1: textRect.top - this.rootRect.top,
      x2: textRect.right - this.rootRect.left,
      y2: textRect.bottom - this.rootRect.top
    };
    const inkBounds = getTextInkBounds(text, this.rootRect);
    return { bounds, inkBounds: inkBounds.length ? inkBounds : [bounds], textLength, pathLength, upright };
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

// Glyph runs approximate the text ink far better than one box, so the solver can slot a label
// into the gap between two words instead of treating the whole line as solid
const INK_RUN_LENGTH = 3;
const INK_VERTICAL_TRIM = 0.12;

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
      const verticalTrim = extent.height * INK_VERTICAL_TRIM;
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
      if (runLength < INK_RUN_LENGTH) continue;
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
  let x1 = Number.POSITIVE_INFINITY;
  let y1 = Number.POSITIVE_INFINITY;
  let x2 = Number.NEGATIVE_INFINITY;
  let y2 = Number.NEGATIVE_INFINITY;
  for (const [cornerX, cornerY] of [
    [x, y],
    [x + width, y],
    [x, y + height],
    [x + width, y + height]
  ]) {
    const pointX = matrix.a * cornerX + matrix.c * cornerY + matrix.e;
    const pointY = matrix.b * cornerX + matrix.d * cornerY + matrix.f;
    if (pointX < x1) x1 = pointX;
    if (pointX > x2) x2 = pointX;
    if (pointY < y1) y1 = pointY;
    if (pointY > y2) y2 = pointY;
  }
  return { x1: x1 - rootRect.left, y1: y1 - rootRect.top, x2: x2 - rootRect.left, y2: y2 - rootRect.top };
}

/** Screen-space distances stay constant on screen, so convert them with the current zoom */
function toMapUnits(screenValue: number): number {
  return screenValue / Math.max(scale, MINIMUM_SCALE);
}

function padBounds(bounds: LabelBounds, screenPadding = LABEL_PADDING_SCREEN): LabelBounds {
  const padding = toMapUnits(screenPadding);
  return { x1: bounds.x1 - padding, y1: bounds.y1 - padding, x2: bounds.x2 + padding, y2: bounds.y2 + padding };
}

function translateBounds(bounds: LabelBounds, dx: number, dy: number): LabelBounds {
  return { x1: bounds.x1 + dx, y1: bounds.y1 + dy, x2: bounds.x2 + dx, y2: bounds.y2 + dy };
}

function translateBoundsList(bounds: LabelBounds[] | undefined, dx: number, dy: number): LabelBounds[] | undefined {
  return bounds?.map(bound => translateBounds(bound, dx, dy));
}

function translateCandidate(candidate: LabelPlacementCandidate, dx: number, dy: number) {
  return {
    bounds: translateBounds(candidate.bounds, dx, dy),
    collisionBounds: translateBounds(candidate.collisionBounds, dx, dy),
    collisionShapes: translateBoundsList(candidate.collisionShapes, dx, dy),
    burgCollisionShapes: translateBoundsList(candidate.burgCollisionShapes, dx, dy),
    inkBounds: translateBoundsList(candidate.inkBounds, dx, dy)
  };
}

function getCollisionEnvelope(inkBounds: LabelBounds[]): LabelBounds {
  return inkBounds.map(bounds => padBounds(bounds)).reduce(unionBounds);
}

/** What the reader actually sees, falling back to the text box when the ink was not measured */
function getInkEnvelope(candidate: LabelPlacementCandidate): LabelBounds {
  return candidate.inkBounds?.length ? candidate.inkBounds.reduce(unionBounds) : candidate.bounds;
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
  return fitsLength(measurement.pathLength, measurement.textLength, startOffset);
}

function fitsLength(pathLength: number, textLength: number, startOffset: number): boolean {
  if (!pathLength || !textLength) return false;
  const center = (pathLength * startOffset) / 100;
  return textLength / 2 <= Math.min(center, pathLength - center);
}

function optimizeLabelPlacements(
  items: LabelPlacementItem[],
  bounds: LabelBounds,
  randomSeed: string
): LabelPlacementSolution {
  const validItems = items.filter(item => item.candidates.length);
  const state: SolverState = {
    items: validItems,
    selected: new Uint16Array(validItems.length),
    staticCosts: validItems.map(item =>
      Float64Array.from(
        item.candidates,
        candidate => getOutsideArea(candidate.bounds, bounds) * OUTSIDE_WEIGHT + candidate.preference
      )
    ),
    interactions: getPotentialInteractions(validItems)
  };

  const initialPairs = getOverlapPairs(state);
  const random = Alea(randomSeed);
  for (const component of getConflictComponents(state, initialPairs)) {
    refine(state, component);
    anneal(state, component, random);
    refine(state, component); // the annealer leaves the best state it saw, not a locally optimal one
  }

  const selected = new Map<string, LabelPlacementCandidate>();
  validItems.forEach((item, index) => void selected.set(item.id, item.candidates[state.selected[index]]));
  return {
    selected,
    initialOverlaps: initialPairs.length,
    remainingOverlaps: getOverlapPairs(state).length
  };
}

/**
 * Labels that already collide seed a component, which then grows through every label they could
 * possibly reach. Direct neighbours join too, so a label with no collision of its own can still
 * step aside and let a chain of crowded labels unwind.
 */
function getConflictComponents(state: SolverState, pairs: [number, number][]): number[][] {
  const itemCount = state.items.length;
  const seeds = new Uint8Array(itemCount);
  for (const [first, second] of pairs) {
    seeds[first] = 1;
    seeds[second] = 1;
  }

  const visited = new Uint8Array(itemCount);
  const components: number[][] = [];
  for (let index = 0; index < itemCount; index++) {
    if (!seeds[index] || visited[index]) continue;
    const component: number[] = [];
    const queue = [index];
    visited[index] = 1;
    while (queue.length) {
      const current = queue.pop()!;
      component.push(current);
      if (!seeds[current]) continue; // neighbours join the component but do not drag in their own neighbours
      for (const linked of state.interactions[current]) {
        if (visited[linked]) continue;
        visited[linked] = 1;
        queue.push(linked);
      }
    }
    components.push(sortByMobility(component, state.items));
  }
  return components;
}

/** Labels with the cheapest alternatives move first, so the crowded ones still find a free slot */
function sortByMobility(component: number[], items: LabelPlacementItem[]): number[] {
  return component.sort((first, second) => {
    const difference = getMinimumMovementPreference(items[first]) - getMinimumMovementPreference(items[second]);
    return difference || items[first].id.localeCompare(items[second].id);
  });
}

function getMinimumMovementPreference(item: LabelPlacementItem): number {
  if (item.candidates.length < 2) return Number.POSITIVE_INFINITY;
  return Math.min(...item.candidates.slice(1).map(candidate => candidate.preference));
}

/** Repeatedly gives every label its cheapest candidate until nobody wants to move any more */
function refine(state: SolverState, component: number[]): void {
  for (let pass = 0; pass < REFINE_PASSES; pass++) {
    let changed = false;
    for (const itemIndex of component) {
      const candidates = state.items[itemIndex].candidates;
      if (candidates.length < 2) continue;

      let bestIndex = state.selected[itemIndex];
      let bestCost = getCandidateCost(state, itemIndex, bestIndex);
      for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
        if (candidateIndex === bestIndex) continue;
        const cost = getCandidateCost(state, itemIndex, candidateIndex);
        if (cost >= bestCost) continue;
        bestIndex = candidateIndex;
        bestCost = cost;
      }
      if (bestIndex === state.selected[itemIndex]) continue;
      state.selected[itemIndex] = bestIndex;
      changed = true;
    }
    if (!changed) return;
  }
}

function anneal(state: SolverState, component: number[], random: () => number): void {
  const movable = component.filter(index => state.items[index].candidates.length > 1);
  if (!movable.length) return;

  let conflicted = getConflictedItems(state, movable);
  if (!conflicted.length) return; // refine already cleared this component

  const iterations = clamp(
    movable.length * ANNEAL_ITERATIONS_PER_ITEM,
    MINIMUM_ANNEAL_ITERATIONS,
    MAXIMUM_ANNEAL_ITERATIONS
  );
  const cooling = (END_TEMPERATURE / START_TEMPERATURE) ** (1 / iterations);
  const bestSelection = Uint16Array.from(component, index => state.selected[index]);
  let currentCost = getComponentCost(state, component);
  let bestCost = currentCost;
  let temperature = START_TEMPERATURE;

  for (let iteration = 0; iteration < iterations; iteration++, temperature *= cooling) {
    if (iteration % movable.length === 0) conflicted = getConflictedItems(state, movable);
    const pool = conflicted.length && random() < CONFLICTED_ITEM_BIAS ? conflicted : movable;
    const itemIndex = pool[Math.floor(random() * pool.length)];
    const previousIndex = state.selected[itemIndex];
    const nextIndex = Math.floor(random() * state.items[itemIndex].candidates.length);
    if (nextIndex === previousIndex) continue;

    const previousCost = getCandidateCost(state, itemIndex, previousIndex);
    state.selected[itemIndex] = nextIndex;
    const delta = getCandidateCost(state, itemIndex, nextIndex) - previousCost;
    if (delta > 0 && random() >= Math.exp(-delta / temperature)) {
      state.selected[itemIndex] = previousIndex;
      continue;
    }

    currentCost += delta;
    if (currentCost >= bestCost) continue;
    bestCost = currentCost;
    component.forEach((index, position) => {
      bestSelection[position] = state.selected[index];
    });
  }
  component.forEach((index, position) => {
    state.selected[index] = bestSelection[position];
  });
}

/** Proposals are worth far more when aimed at a label that is actually covered by something */
function getConflictedItems(state: SolverState, movable: number[]): number[] {
  return movable.filter(itemIndex => {
    for (const otherIndex of state.interactions[itemIndex])
      if (getSelectedPairOverlap(state, itemIndex, otherIndex) > 0) return true;
    return false;
  });
}

function getCandidateCost(state: SolverState, itemIndex: number, candidateIndex: number): number {
  const item = state.items[itemIndex];
  const candidate = item.candidates[candidateIndex];
  let cost = state.staticCosts[itemIndex][candidateIndex];
  for (const otherIndex of state.interactions[itemIndex]) {
    const other = state.items[otherIndex];
    cost += getPairOverlap(item, candidate, other, other.candidates[state.selected[otherIndex]]) * OVERLAP_WEIGHT;
  }
  return cost;
}

/** Total cost of the component, counting every interacting pair exactly once */
function getComponentCost(state: SolverState, component: number[]): number {
  const inside = new Set(component);
  let cost = 0;
  for (const itemIndex of component) {
    cost += state.staticCosts[itemIndex][state.selected[itemIndex]];
    for (const otherIndex of state.interactions[itemIndex]) {
      if (inside.has(otherIndex) && otherIndex < itemIndex) continue;
      cost += getSelectedPairOverlap(state, itemIndex, otherIndex) * OVERLAP_WEIGHT;
    }
  }
  return cost;
}

function getSelectedPairOverlap(state: SolverState, firstIndex: number, secondIndex: number): number {
  const first = state.items[firstIndex];
  const second = state.items[secondIndex];
  return getPairOverlap(
    first,
    first.candidates[state.selected[firstIndex]],
    second,
    second.candidates[state.selected[secondIndex]]
  );
}

/** Items that can never touch, whatever candidate they pick, are dropped from the cost loop for good */
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

function getOverlapPairs(state: SolverState): [number, number][] {
  const ordered = state.items
    .map((item, index) => ({ index, bounds: item.candidates[state.selected[index]].collisionBounds }))
    .sort((first, second) => first.bounds.x1 - second.bounds.x1);
  const pairs: [number, number][] = [];

  for (let left = 0; left < ordered.length; left++) {
    const first = ordered[left];
    for (let right = left + 1; right < ordered.length; right++) {
      const second = ordered[right];
      if (second.bounds.x1 >= first.bounds.x2) break;
      if (getSelectedPairOverlap(state, first.index, second.index) > 0) pairs.push([first.index, second.index]);
    }
  }
  return pairs;
}

function getPairOverlap(
  firstItem: LabelPlacementItem,
  first: LabelPlacementCandidate,
  secondItem: LabelPlacementItem,
  second: LabelPlacementCandidate
): number {
  if (firstItem.obstacle && secondItem.obstacle) return 0;
  if (!boundsIntersect(first.collisionBounds, second.collisionBounds)) return 0;

  if (firstItem.obstacle || secondItem.obstacle) {
    const [obstacle, label] = firstItem.obstacle ? [first, second] : [second, first];
    return getShapesOverlap([obstacle.bounds], label.inkBounds ?? [label.bounds]) * OBSTACLE_CONFLICT_WEIGHT;
  }

  // Burg names sit in the densest part of the map, so they get both a wider gap and a heavier cost
  const isBurgToBurg = firstItem.kind === "burg" && secondItem.kind === "burg";
  const overlap = getShapesOverlap(getCollisionShapes(first, isBurgToBurg), getCollisionShapes(second, isBurgToBurg));
  return overlap * getConflictWeight(firstItem, secondItem);
}

function getCollisionShapes(candidate: LabelPlacementCandidate, useBurgPadding: boolean): LabelBounds[] {
  const padded = useBurgPadding ? candidate.burgCollisionShapes : undefined;
  return padded ?? candidate.collisionShapes ?? [candidate.collisionBounds];
}

function getConflictWeight(first: LabelPlacementItem, second: LabelPlacementItem): number {
  if (first.kind === "burg" || second.kind === "burg") return BURG_CONFLICT_WEIGHT;
  if (first.kind === "path" || second.kind === "path") return PATH_CONFLICT_WEIGHT;
  return 1;
}

function getShapesOverlap(first: LabelBounds[], second: LabelBounds[]): number {
  let overlap = 0;
  for (const firstBounds of first) {
    for (const secondBounds of second) overlap += getOverlapScore(firstBounds, secondBounds);
  }
  return overlap;
}

/**
 * Covered fraction of the smaller shape, faded in between IGNORED and FULL overlap ratios.
 * The ramp keeps hairline contact free while leaving a continuous gradient for the solver to
 * follow — a hard threshold made every partial collision look perfectly clean.
 */
function getOverlapScore(first: LabelBounds, second: LabelBounds): number {
  const width = Math.min(first.x2, second.x2) - Math.max(first.x1, second.x1);
  if (width <= 0) return 0;
  const height = Math.min(first.y2, second.y2) - Math.max(first.y1, second.y1);
  if (height <= 0) return 0;

  const smallerArea = Math.min(getArea(first), getArea(second));
  if (!smallerArea) return 0;
  const ratio = (width * height) / smallerArea;
  return ratio * clamp((ratio - IGNORED_OVERLAP_RATIO) / (FULL_OVERLAP_RATIO - IGNORED_OVERLAP_RATIO), 0, 1);
}

function getArea(bounds: LabelBounds): number {
  return Math.max(bounds.x2 - bounds.x1, 0) * Math.max(bounds.y2 - bounds.y1, 0);
}

function boundsIntersect(first: LabelBounds, second: LabelBounds): boolean {
  return first.x1 < second.x2 && first.x2 > second.x1 && first.y1 < second.y2 && first.y2 > second.y1;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function emptyResult(): LabelSpreadResult {
  return { patches: [], displayedLabels: 0, initialOverlaps: 0, remainingOverlaps: 0 };
}

// Yields once so the browser can paint the disabled controls. A hidden tab never runs an animation
// frame, so fall back to a timer instead of leaving the spread stuck forever
const NEXT_FRAME_TIMEOUT = 100;
function nextFrame(): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, NEXT_FRAME_TIMEOUT);
    requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** Internal seam for focused geometry tests. Production callers use calculateLabelSpread. */
export const labelSpreadInternals = {
  getBurgLabelCandidates,
  isDrawnOn,
  getPathStartOffsetCandidates,
  getPathStartOffsetPreference,
  isPathTextUpright,
  optimizeLabelPlacements
};
