import { color } from "d3-color";
import type { Regiment } from "@/generators/military-generator";
import { si } from "@/utils";
import type { LineBatchPrimitive, LinePathPrimitive, SceneBounds, SceneRevision } from "../primitives";
import type { MapRenderWorld } from "../render-world";

export interface MilitarySceneItem {
  angle: number;
  color: string;
  domainId: string;
  icon: string;
  iconColor: string;
  naval: boolean;
  regimentId: number;
  stateId: number;
  text: string;
  x: number;
  y: number;
}

export interface MilitaryScene {
  bounds: SceneBounds | null;
  domainIds: readonly string[];
  regiments: readonly MilitarySceneItem[];
  revision: SceneRevision;
}

export function buildPopulationScene(
  world: MapRenderWorld,
  urbanization: number,
  revision: SceneRevision
): LineBatchPrimitive {
  const paths: LinePathPrimitive[] = [];
  for (const cellId of world.cells.i) {
    const population = world.cells.pop[cellId];
    const point = world.cells.p[cellId];
    if (!population || !point) continue;
    paths.push({
      domainId: `rural:${cellId}`,
      points: [point, [point[0], point[1] - population / 5]],
      role: "rural"
    });
  }
  for (const burg of world.burgs) {
    if (!burg.i || burg.removed || !burg.population) continue;
    paths.push({
      domainId: `urban:${burg.i}`,
      points: [
        [burg.x, burg.y],
        [burg.x, burg.y - (burg.population / 5) * urbanization]
      ],
      role: "urban"
    });
  }
  return {
    bounds: getLineBounds(paths),
    domainIds: paths.map(({ domainId }) => domainId),
    kind: "line-batch",
    layer: "population",
    paths,
    revision
  };
}

export function buildMilitaryScene(world: MapRenderWorld, revision: SceneRevision): MilitaryScene {
  const regiments: MilitarySceneItem[] = [];
  for (const state of world.states) {
    if (!state.i || state.removed || !state.military?.length) continue;
    const stateColor = state.color?.startsWith("#") ? state.color : "#999999";
    const iconColor = color(stateColor)?.darker().hex() ?? "#666666";
    for (const regiment of state.military) regiments.push(createRegiment(regiment, state.i, stateColor, iconColor));
  }
  return {
    bounds: getMilitaryBounds(regiments),
    domainIds: regiments.map(({ domainId }) => domainId),
    regiments,
    revision
  };
}

function createRegiment(regiment: Regiment, stateId: number, stateColor: string, iconColor: string): MilitarySceneItem {
  return {
    angle: regiment.angle ?? 0,
    color: stateColor,
    domainId: `${stateId}:${regiment.i}`,
    icon: regiment.icon || "🛡️",
    iconColor,
    naval: Boolean(regiment.n),
    regimentId: regiment.i,
    stateId,
    text: String(regiment.a > (regiment.n ? 999 : 99_999) ? si(regiment.a) : regiment.a),
    x: regiment.x,
    y: regiment.y
  };
}

function getLineBounds(paths: readonly LinePathPrimitive[]): SceneBounds | null {
  if (!paths.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const path of paths) {
    for (const [x, y] of path.points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { maxX, maxY, minX, minY };
}

function getMilitaryBounds(regiments: readonly MilitarySceneItem[]): SceneBounds | null {
  if (!regiments.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const regiment of regiments) {
    minX = Math.min(minX, regiment.x);
    minY = Math.min(minY, regiment.y);
    maxX = Math.max(maxX, regiment.x);
    maxY = Math.max(maxY, regiment.y);
  }
  return { maxX, maxY, minX, minY };
}
