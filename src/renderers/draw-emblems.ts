import { forceCollide, forceSimulation, type SimulationNodeDatum, timeout } from "d3";
import type { Province } from "@/generators/provinces-generator";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { Scene, ViewportLayers, type ViewportRenderContext } from "@/renderers/viewport/viewport-renderer";
import type { Emblem } from "@/types/emblems";
import { ensureEl, minmax, rn } from "@/utils";
import type { Burg } from "../generators/burgs-generator";
import type { State } from "../generators/states-generator";

export type EmblemType = "state" | "province" | "burg";

interface EmblemData extends SimulationNodeDatum {
  id: string;
  type: EmblemType;
  i: number;
  x: number;
  y: number;
  poleX: number;
  poleY: number;
  size: number;
  shift: number;
  coa: Emblem;
}

const GROUPS: Record<EmblemType, string> = {
  burg: "burgEmblems",
  province: "provinceEmblems",
  state: "stateEmblems"
};

// sizing is tuned for a 1536x754 map: ~50px for 15 states, ~20px for 115 provinces, ~8.5px for 450 burgs
interface Sizing {
  extent: number; // map size is divided by it to get the base size
  min: number;
  max: number;
  expected: number; // number of elements the base size is tuned for
  countDivisor: number;
  deficitDivisor: number;
}

const SIZING: Record<EmblemType, Sizing> = {
  state: { extent: 40, min: 10, max: 100, expected: 15, countDivisor: 100, deficitDivisor: 200 },
  province: { extent: 100, min: 5, max: 70, expected: 115, countDivisor: 1000, deficitDivisor: 1000 },
  burg: { extent: 185, min: 2, max: 50, expected: 450, countDivisor: 1000, deficitDivisor: 1000 }
};

const TYPES: EmblemType[] = ["burg", "province", "state"];
const scenes: Record<EmblemType, Scene<EmblemData>> = {
  burg: new Scene(),
  province: new Scene(),
  state: new Scene()
};
const layer = ViewportLayers.register({ id: "emblems", render: reconcileEmblems });
const sizes: Record<EmblemType, number> = { burg: 0, province: 0, state: 0 };
const reconcileListeners = new Set<() => void>();
let drawVersion = 0;
let needsFullRedraw = false;

// emblems shrink as their number grows, so that a crowded map does not turn into a wall of shields
function getEmblemSize(type: EmblemType, count: number): number {
  const { extent, min, max, expected, countDivisor, deficitDivisor } = SIZING[type];
  const startSize = minmax((graphHeight + graphWidth) / extent, min, max);
  const countMod = 1 + count / countDivisor - (expected - count) / deficitDivisor;
  const sizeMod = Number(ensureEl(GROUPS[type]).getAttribute("data-size")) || 1;
  return rn((startSize / countMod) * sizeMod);
}

export function drawEmblems(): void {
  TIME && console.time("drawEmblems");
  const version = ++drawVersion;
  needsFullRedraw = false;
  const { states, provinces, burgs } = pack;

  const valid = {
    burg: burgs.filter(isValidEmblem),
    province: (provinces as Province[]).filter(isValidEmblem),
    state: states.filter(isValidEmblem)
  };

  for (const type of TYPES) sizes[type] = getEmblemSize(type, valid[type].length);

  const nodes = [
    ...valid.burg.map(burg => getNode("burg", burg)),
    ...valid.province.map(province => getNode("province", province)),
    ...valid.state.map(state => getNode("state", state))
  ];

  const simulation = forceSimulation(nodes)
    .alphaMin(0.6)
    .alphaDecay(0.2)
    .velocityDecay(0.6)
    .force(
      "collision",
      forceCollide<EmblemData>().radius(({ shift }) => shift)
    )
    .stop();

  // the collision pass is heavy, so it is deferred to the next frame
  timeout(() => {
    if (version !== drawVersion) return;

    const ticks = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
    for (let i = 0; i < ticks; i++) simulation.tick();

    for (const type of TYPES) ensureEl(GROUPS[type]).setAttribute("font-size", String(sizes[type]));
    for (const type of TYPES) {
      const next = nodes.filter(node => node.type === type);
      const scene = scenes[type];
      const nextIds = new Set(next.map(node => node.id));
      for (const item of scene.values()) {
        if (!nextIds.has(item.id)) EmblemRenderer.remove(item.id);
      }
      scene.replace(next);
    }
    if (needsFullRedraw) {
      needsFullRedraw = false;
      drawEmblems();
      return;
    }
    layer.render();
    TIME && console.timeEnd("drawEmblems");
  });
}

/** Reconcile an edited or newly-created emblem without rebuilding the collision scene. */
export function redrawEmblem(type: EmblemType, i: number): void {
  const scene = scenes[type];
  if (!scene.valid) {
    needsFullRedraw = true;
    return;
  }
  const entity = getEntity(type, i);
  if (entity && isValidEmblem(entity)) scene.set(getNode(type, entity));
  else {
    const id = getId(type, i);
    scene.remove(id);
    EmblemRenderer.remove(id);
  }
  layer.render();
}

/** Remove an entity from the viewport scene and its materialized output. */
export function removeEmblem(type: EmblemType, i: number): void {
  const id = getId(type, i);
  if (!scenes[type].valid) needsFullRedraw = true;
  scenes[type].remove(id);
  document.querySelector(`#${GROUPS[type]} > use[data-i="${i}"]`)?.remove();
  EmblemRenderer.remove(id);
}

export function subscribeToEmblemReconciliation(listener: () => void): () => void {
  reconcileListeners.add(listener);
  return () => void reconcileListeners.delete(listener);
}

/** Ensure definitions referenced by a live or exported emblem layer exist before it is serialized. */
export async function renderEmblemDefinitions(root: ParentNode): Promise<void> {
  const uses = Array.from(root.querySelectorAll<SVGUseElement>("#emblems use[data-i]"));
  await Promise.allSettled(
    uses.map(use => {
      const type = getType(use.parentElement?.id);
      const i = Number(use.dataset.i);
      if (type === null) return undefined;
      const id = getId(type, i);
      const sceneItem = scenes[type].get(id);
      const entity = getEntity(type, i);
      return renderDefinition(id, sceneItem?.coa ?? entity?.coa);
    })
  );
}

function reconcileEmblems(context: ViewportRenderContext): void {
  for (const type of TYPES) {
    const group = context.root.querySelector<SVGGElement>(`#${GROUPS[type]}`);
    if (!group) continue;
    const scene = scenes[type];
    if (!scene.valid) continue;

    const hidden = isGroupHidden(type, context.bounds.scale);
    group.classList.toggle("hidden", hidden);
    if (hidden) {
      group.replaceChildren();
      continue;
    }

    const visible: EmblemData[] = [];
    for (const stored of scene.values()) {
      const entity = getEntity(type, stored.i);
      if (!entity || !isValidEmblem(entity)) {
        scene.remove(stored.id);
        EmblemRenderer.remove(stored.id);
        continue;
      }

      const item = isCurrentNode(type, entity, stored) ? stored : getNode(type, entity);
      if (item !== stored) scene.set(item);
      if (isVisible(item, context)) visible.push(item);
    }

    const materialized = new Map(
      Array.from(group.querySelectorAll<SVGUseElement>(":scope > use[data-i]")).map(use => [use.dataset.i!, use])
    );
    const additions = group.ownerDocument.createDocumentFragment();
    for (const item of visible) {
      const key = String(item.i);
      materialize(item, group, context.root === document, materialized.get(key), additions);
      materialized.delete(key);
    }
    for (const use of materialized.values()) use.remove();
    group.append(additions);
  }

  if (context.root === document) for (const listener of reconcileListeners) listener();
}

function materialize(
  item: EmblemData,
  group: SVGGElement,
  renderCoa: boolean,
  existing: SVGUseElement | undefined,
  additions: DocumentFragment
): void {
  let use = existing;
  if (!use) {
    use = group.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "use");
    use.dataset.i = String(item.i);
    additions.append(use);
  }

  use.setAttribute("x", String(rn(item.x - item.shift, 2)));
  use.setAttribute("y", String(rn(item.y - item.shift, 2)));
  use.setAttribute("width", `${item.size}em`);
  use.setAttribute("height", `${item.size}em`);
  use.setAttribute("href", `#${item.id}`);
  if (renderCoa) void renderDefinition(item.id, item.coa);
}

function renderDefinition(id: string, emblem: Emblem | undefined): Promise<unknown> | undefined {
  if (!emblem || emblem.custom) return;
  return EmblemRenderer.trigger(id, emblem);
}

function getNode(type: EmblemType, entity: Burg | Province | State): EmblemData {
  const emblem = entity.coa;
  if (!emblem) throw new Error(`Cannot render ${getId(type, entity.i)} without a COA`);
  const size = emblem.size || 1;
  const [poleX, poleY] = getPole(type, entity);
  return {
    id: getId(type, entity.i),
    type,
    i: entity.i,
    x: emblem.x ?? poleX,
    y: emblem.y ?? poleY,
    poleX,
    poleY,
    fx: emblem.x,
    fy: emblem.y,
    size,
    shift: (sizes[type] * size) / 2,
    coa: emblem
  };
}

function isCurrentNode(type: EmblemType, entity: Burg | Province | State, stored: EmblemData): boolean {
  if (entity.coa !== stored.coa) return false;
  const [poleX, poleY] = getPole(type, entity);
  return (
    (entity.coa.x !== undefined || stored.poleX === poleX) && (entity.coa.y !== undefined || stored.poleY === poleY)
  );
}

function getPole(type: EmblemType, entity: Burg | Province | State): [number, number] {
  if (type === "burg") {
    const burg = entity as Burg;
    return [burg.x, burg.y];
  }

  const region = entity as Province | State;
  return region.pole || pack.cells.p[region.center!];
}

function getEntity(type: EmblemType, i: number): Burg | Province | State | undefined {
  if (type === "burg") return pack.burgs[i];
  if (type === "province") return pack.provinces[i] as Province | undefined;
  return pack.states[i];
}

function isValidEmblem(entity: Burg | Province | State): boolean {
  return Boolean(entity.i && !entity.removed && entity.coa && entity.coa.size !== 0);
}

function isVisible({ x, y, shift }: EmblemData, { bounds }: ViewportRenderContext): boolean {
  return x + shift >= bounds.x0 && x - shift <= bounds.x1 && y + shift >= bounds.y0 && y - shift <= bounds.y1;
}

function isGroupHidden(type: EmblemType, scale: number): boolean {
  const hideSmall = document.querySelector<HTMLInputElement>("#hideEmblems")?.checked;
  const screenSize = sizes[type] * scale;
  return Boolean(hideSmall && (screenSize < 25 || screenSize > 300));
}

function getId(type: EmblemType, i: number): string {
  return `${type}COA${i}`;
}

function getType(groupId: string | undefined): EmblemType | null {
  return TYPES.find(type => GROUPS[type] === groupId) ?? null;
}
