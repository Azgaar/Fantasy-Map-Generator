import { forceCollide, forceSimulation, type SimulationNodeDatum } from "d3";
import type { Emblem } from "@/generators/emblems/generator";
import type { SceneBounds, SceneRevision } from "../primitives";
import type { MapRenderWorld } from "../render-world";
import type { EmblemLayerStyle } from "../styles";

export type EmblemDomainType = "burg" | "province" | "state";

export interface EmblemSceneItem {
  coa: Emblem;
  domainId: string;
  entityId: number;
  size: number;
  svgId: string;
  textureKey: string;
  type: EmblemDomainType;
  x: number;
  y: number;
}

export interface EmblemSceneGroup {
  baseSize: number;
  items: readonly EmblemSceneItem[];
  type: EmblemDomainType;
}

export interface EmblemScene {
  automaticVisibility: boolean;
  bounds: SceneBounds | null;
  domainIds: readonly string[];
  groups: readonly EmblemSceneGroup[];
  opacity: number;
  revision: SceneRevision;
  unsupportedEffects: readonly string[];
}

interface EmblemNode extends SimulationNodeDatum {
  coa: Emblem;
  entityId: number;
  radius: number;
  type: EmblemDomainType;
  x: number;
  y: number;
}

interface MapBounds {
  height: number;
  width: number;
}

export function buildEmblemScene(
  world: Pick<MapRenderWorld, "burgs" | "cells" | "provinces" | "states">,
  mapBounds: MapBounds,
  style: EmblemLayerStyle,
  revision: SceneRevision
): EmblemScene {
  const validBurgs = world.burgs.filter(entity => entity.i && !entity.removed && entity.coa && entity.coa.size !== 0);
  const validProvinces = world.provinces.filter(
    entity => entity.i && !entity.removed && entity.coa && entity.coa.size !== 0
  );
  const validStates = world.states.filter(entity => entity.i && !entity.removed && entity.coa && entity.coa.size !== 0);
  const baseSizes = {
    burg: getBurgSize(mapBounds, validBurgs.length, style.burgSize),
    province: getProvinceSize(mapBounds, validProvinces.length, style.provinceSize),
    state: getStateSize(mapBounds, validStates.length, style.stateSize)
  };
  const nodes: EmblemNode[] = [];

  for (const burg of validBurgs) {
    const coa = burg.coa as Emblem;
    nodes.push(createNode("burg", burg.i, coa, burg.x, burg.y, baseSizes.burg));
  }
  for (const province of validProvinces) {
    const coa = province.coa as Emblem;
    const [x, y] = province.pole ?? world.cells.p[province.center] ?? [0, 0];
    nodes.push(createNode("province", province.i, coa, x, y, baseSizes.province));
  }
  for (const state of validStates) {
    const coa = state.coa as Emblem;
    const [x, y] = state.pole ?? world.cells.p[state.center] ?? [0, 0];
    nodes.push(createNode("state", state.i, coa, x, y, baseSizes.state));
  }

  settleCollisions(nodes);
  const items = nodes.map(node => createItem(node, style.strokeWidth));
  const groups = (["burg", "province", "state"] as const).map(type => ({
    baseSize: baseSizes[type],
    items: items.filter(item => item.type === type),
    type
  }));

  return {
    automaticVisibility: style.automaticVisibility,
    bounds: getBounds(items),
    domainIds: items.map(item => item.domainId),
    groups,
    opacity: style.opacity,
    revision,
    unsupportedEffects: style.filter ? [`emblems:${style.filter}`] : []
  };
}

function createNode(
  type: EmblemDomainType,
  entityId: number,
  coa: Emblem,
  fallbackX: number,
  fallbackY: number,
  baseSize: number
): EmblemNode {
  const multiplier = Number.isFinite(coa.size) ? Math.max(0, coa.size ?? 1) : 1;
  return {
    coa: structuredClone(coa),
    entityId,
    radius: (baseSize * multiplier) / 2,
    type,
    x: Number.isFinite(coa.x) ? (coa.x as number) : fallbackX,
    y: Number.isFinite(coa.y) ? (coa.y as number) : fallbackY
  };
}

function settleCollisions(nodes: EmblemNode[]): void {
  if (nodes.length < 2) return;
  let seed = 0x9e3779b9;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  const simulation = forceSimulation(nodes)
    .randomSource(random)
    .alphaMin(0.6)
    .alphaDecay(0.2)
    .velocityDecay(0.6)
    .force(
      "collision",
      forceCollide<EmblemNode>().radius(node => node.radius)
    )
    .stop();
  const ticks = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
  for (let index = 0; index < ticks; index++) simulation.tick();
}

function createItem(node: EmblemNode, strokeWidth: number): EmblemSceneItem {
  const domainId = `${node.type}:${node.entityId}`;
  const heraldryRevision = hashString(JSON.stringify(node.coa));
  return {
    coa: node.coa,
    domainId,
    entityId: node.entityId,
    size: node.radius * 2,
    svgId: `${node.type}COA${node.entityId}_${heraldryRevision}`,
    textureKey: `emblem:${domainId}:${heraldryRevision}:stroke:${strokeWidth}`,
    type: node.type,
    x: round(node.x),
    y: round(node.y)
  };
}

function getStateSize(bounds: MapBounds, count: number, multiplier: number): number {
  const startSize = clamp((bounds.height + bounds.width) / 40, 10, 100);
  const countModifier = 1 + count / 100 - (15 - count) / 200;
  return round((startSize / countModifier) * multiplier);
}

function getProvinceSize(bounds: MapBounds, count: number, multiplier: number): number {
  const startSize = clamp((bounds.height + bounds.width) / 100, 5, 70);
  const countModifier = 1 + count / 1000 - (115 - count) / 1000;
  return round((startSize / countModifier) * multiplier);
}

function getBurgSize(bounds: MapBounds, count: number, multiplier: number): number {
  const startSize = clamp((bounds.height + bounds.width) / 185, 2, 50);
  const countModifier = 1 + count / 1000 - (450 - count) / 1000;
  return round((startSize / countModifier) * multiplier);
}

function getBounds(items: readonly EmblemSceneItem[]): SceneBounds | null {
  if (!items.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    const radius = item.size / 2;
    minX = Math.min(minX, item.x - radius);
    minY = Math.min(minY, item.y - radius);
    maxX = Math.max(maxX, item.x + radius);
    maxY = Math.max(maxY, item.y + radius);
  }
  return { maxX, maxY, minX, minY };
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
