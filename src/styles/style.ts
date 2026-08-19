import type { Layer, LayerId } from "@/components/layers";
import { isLegacyPreset, upgradeLegacyPreset } from "./legacy";
import type { Attrs, ChildId, ChildOptions, LayerOptions, StyleData, StyleLayerId } from "./schema";
import { parseStyleData } from "./schema";

type MutableNode = {
  attrs?: Record<string, unknown>;
  options?: Record<string, unknown>;
  children?: Record<string, MutableNode>;
};
type MutableTree = Record<string, MutableNode>;

export type AttributeOp = { path: string[]; name: string; value: string | null };

function stringifyAttrValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

/** Pure flatten: a layer node's own attrs (path []) plus every descendant's, keyed by child-id chain. */
export function buildAttributeOps(node: MutableNode | undefined, path: string[] = []): AttributeOp[] {
  if (!node) return [];
  const ops: AttributeOp[] = [];
  for (const [name, value] of Object.entries(node.attrs ?? {})) {
    ops.push({ path, name, value: stringifyAttrValue(value) });
  }
  for (const [childId, child] of Object.entries(node.children ?? {})) {
    ops.push(...buildAttributeOps(child, [...path, childId]));
  }
  return ops;
}

// Ids in the style tree are user/preset-controlled data (custom burg-group names, uploaded
// presets), so they cannot be trusted as literal CSS id-selector text (`#1foo`, `#a"b` and
// `#a b` are all invalid or wrong there). An attribute-equals selector treats the id as an
// opaque string instead, so it's immune to what the id contains; only `"` and `\` need escaping.
function escapeAttrSelectorValue(id: string): string {
  return id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// The one layer whose tree keys don't match its DOM ids: label groups are keyed bare ("capital")
// everywhere in the tree and in the setters, but render as <g id="labels-capital">
// (renderers/labels/label-groups.ts). Localized here so keys stay bare everywhere else.
function elementId(layerId: string, childId: string): string {
  return layerId === "labels" ? `labels-${childId}` : childId;
}

// The registry's icons layer (<g id="icons">) is the one layer that hosts two style layers, one
// per container group it nests: #icons > #burgIcons and #icons > #anchors. Both are ordinary
// two-level style layers; only applyTo knows they share a registry layer, so the tree never has
// to go three levels deep. Same shape of mapping as labels' `labels-<name>` element ids.
const ICONS_LAYER_ID = "burgIcons";
const ICON_CONTAINERS = ["burgIcons", "anchors"] as const;

function resolveElement(root: Element | null, layerId: string, path: string[]): Element | null {
  let el: Element | null = root;
  for (const [depth, id] of path.entries()) {
    if (!el) return null;
    const domId = depth === 0 ? elementId(layerId, id) : id;
    el = el.querySelector(`:scope > [id="${escapeAttrSelectorValue(domId)}"]`);
  }
  return el;
}

function writeAttr(el: Element, name: string, value: string | null): void {
  if (value === null) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

/** Writes a node's attribute ops onto a root element and its DOM descendants. Never creates elements. */
function writeNode(root: Element | null, layerId: string, node: MutableNode | undefined): void {
  if (!node || !root) return;
  for (const op of buildAttributeOps(node)) {
    const el = resolveElement(root, layerId, op.path);
    if (!el) continue;
    writeAttr(el, op.name, op.value);
  }
}

/**
 * Batches setAttr/setOptions-triggered redraws into one requestAnimationFrame per frame, per
 * editing instance: the owner is captured at schedule time and handed back to `draw`, so the
 * flush can tell which instance the queued edits belong to. No-ops under node (tests, SSR).
 */
export function createDrawScheduler<Owner>(
  raf: ((cb: () => void) => number) | undefined,
  draw: (owner: Owner, ...ids: StyleLayerId[]) => void | Promise<void>
): (owner: Owner, id: StyleLayerId) => void {
  let pending: Map<Owner, Set<StyleLayerId>> | null = null;

  function flush(): void {
    const batches = pending ? Array.from(pending) : [];
    pending = null;
    for (const [owner, ids] of batches) {
      if (ids.size) draw(owner, ...ids);
    }
  }

  return function schedule(owner: Owner, id: StyleLayerId): void {
    if (!raf) return;
    if (!pending) {
      pending = new Map();
      raf(flush);
    }
    let ids = pending.get(owner);
    if (!ids) {
      ids = new Set();
      pending.set(owner, ids);
    }
    ids.add(id);
  };
}

/** The registry layer that renders a style layer: `anchors` shares the icons layer, the rest are 1:1. */
function registryLayerId(id: Exclude<StyleLayerId, "map">): string {
  return id === "anchors" ? ICONS_LAYER_ID : id;
}

// Nothing else pushes a live setAttr/setOptions edit to the DOM: draw() never touches attrs, so
// this scheduler applies the instance to each edited layer itself before redrawing its content.
// "map" is the svg root, not a registry layer, so it goes to applyMapStyle and never to
// Layers.draw. The registry import stays inside the callback so this module's static graph does
// not drag in components/layers.ts (and with it every renderer) for pure consumers.
const scheduleRedraw = createDrawScheduler<Style>(
  typeof requestAnimationFrame === "function" ? requestAnimationFrame : undefined,
  (style, ...ids) => {
    // The edited instance, not the current one: a preset switch or a map load can replace the
    // map style between the edit and this frame, and an edit to an instance that is no longer
    // the map's must never repaint the map with it.
    if (style !== mapStyle) return;
    return import("@/components/layers").then(({ Layers }) => {
      if (style !== mapStyle) return;
      if (ids.includes("map")) applyMapStyle(style);
      const layerIds = [...new Set(ids.filter(id => id !== "map").map(registryLayerId))];
      for (const id of layerIds) {
        if (Layers.has(id)) style.applyTo(Layers.get(id));
      }
      Layers.draw(...layerIds.filter((id): id is LayerId => Layers.has(id)));
    });
  }
);

// Per-instance tree storage, keyed off the instance rather than a class field: `applyMapStyle` is
// a free function ("map" is the svg root, not a registry layer) and needs to read one node without
// cloning the whole tree via toJSON(); a `private` field is unreachable from outside the class.
const trees = new WeakMap<Style, MutableTree>();

export class Style {
  private constructor() {}

  /** Validates; recognizes and upgrades old selector-keyed presets internally. */
  static fromJSON(json: unknown): Style {
    if (typeof json !== "object" || json === null) {
      throw new TypeError("Style.fromJSON: expected an object");
    }
    // the legacy branch also supplies the three attrs an old preset could not carry (see
    // legacy.ts). A new-format document is taken at its word - a missing attr there is the
    // author's choice, so nothing is injected.
    const data: StyleData = isLegacyPreset(json)
      ? upgradeLegacyPreset(json as Record<string, Record<string, unknown>>)
      : parseStyleData(json);
    const style = new Style();
    trees.set(style, data as MutableTree);
    return style;
  }

  /** Single serializer: map file style data and preset download. */
  toJSON(): StyleData {
    const tree = this.tree;
    return (
      typeof structuredClone === "function" ? structuredClone(tree) : JSON.parse(JSON.stringify(tree))
    ) as StyleData;
  }

  /** Write attrs onto layer.getEl() and its declared children; cheap no-op when the layer has no content. */
  applyTo(layer: Layer): void {
    const root = layer.getEl();
    if (!root) return;

    if (layer.id === ICONS_LAYER_ID) {
      for (const containerId of ICON_CONTAINERS) {
        writeNode(root.querySelector(`:scope > #${containerId}`), containerId, this.tree[containerId]);
      }
      return;
    }

    writeNode(root, layer.id, this.tree[layer.id]);
  }

  options<Id extends keyof LayerOptions>(id: Id): Readonly<LayerOptions[Id]>;
  options<Id extends keyof ChildOptions, C extends keyof ChildOptions[Id] & string>(
    id: Id,
    child: C
  ): Readonly<ChildOptions[Id][C]>;
  // shallow copy, not a deep clone or a freeze: it keeps a caller's `options.x = 1` from editing
  // the tree behind the scheduler's back at the depth options are actually written, and stays
  // cheap enough for the hot read path. Nested option objects (scaleBar.back, legend.box, ...)
  // are still shared - callers must go through setOptions to change one.
  options(id: StyleLayerId, child?: string): unknown {
    const node = child === undefined ? this.tree[id] : this.tree[id]?.children?.[child];
    return { ...(node?.options ?? {}) };
  }

  setAttr<K extends keyof Attrs>(id: StyleLayerId, name: K, value: Attrs[K] | null): void;
  setAttr<Id extends StyleLayerId, K extends keyof Attrs>(
    id: Id,
    child: ChildId<Id>,
    name: K,
    value: Attrs[K] | null
  ): void;
  setAttr(id: StyleLayerId, ...rest: unknown[]): void {
    const node = rest.length === 2 ? this.ensureLayer(id) : this.ensureChild(id, rest[0] as string);
    const [name, value] = rest.slice(-2) as [string, unknown];
    node.attrs ??= {};
    node.attrs[name] = value;
    scheduleRedraw(this, id);
  }

  setOptions<Id extends keyof LayerOptions>(id: Id, patch: Partial<LayerOptions[Id]>): void;
  setOptions<Id extends keyof ChildOptions, C extends keyof ChildOptions[Id] & string>(
    id: Id,
    child: C,
    patch: Partial<ChildOptions[Id][C]>
  ): void;
  setOptions(id: StyleLayerId, ...rest: unknown[]): void {
    const node = rest.length === 1 ? this.ensureLayer(id) : this.ensureChild(id, rest[0] as string);
    const patch = rest[rest.length - 1] as Record<string, unknown>;
    node.options = { ...(node.options ?? {}), ...patch };
    scheduleRedraw(this, id);
  }

  private get tree(): MutableTree {
    const tree = trees.get(this);
    if (!tree) throw new Error("Style: instance not initialized via Style.fromJSON");
    return tree;
  }

  private ensureLayer(id: StyleLayerId): MutableNode {
    const tree = this.tree;
    if (!tree[id]) tree[id] = {};
    return tree[id];
  }

  private ensureChild(id: StyleLayerId, child: string): MutableNode {
    const layer = this.ensureLayer(id);
    layer.children ??= {};
    if (!layer.children[child]) layer.children[child] = {};
    return layer.children[child];
  }
}

/** Covers the svg root (`document#map`), the one style node not owned by a registry layer. */
export function applyMapStyle(style: Style): void {
  const node = trees.get(style)?.map;
  if (!node) return;
  writeNode(typeof document !== "undefined" ? document.getElementById("map") : null, "map", node);
}

let mapStyle: Style | undefined;

export function getMapStyle(): Style {
  if (!mapStyle) throw new Error("getMapStyle: no Style instance set — call setMapStyle first");
  return mapStyle;
}

export function setMapStyle(style: Style): void {
  mapStyle = style;
}
