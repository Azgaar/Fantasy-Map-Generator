import type { LayerId, StyleNode } from "./schema";

export interface AttributeOp {
  path: string[];
  attr: string;
  value: string | null;
}

export function buildAttributeOps(node: StyleNode, path: string[] = []): AttributeOp[] {
  const ops: AttributeOp[] = [];
  for (const [attr, raw] of Object.entries(node.presentation ?? {})) {
    ops.push({ path, attr, value: raw === null ? null : String(raw) });
  }
  for (const [childId, child] of Object.entries(node.children ?? {})) {
    ops.push(...buildAttributeOps(child, [...path, childId]));
  }
  return ops;
}

const SVG_NS = "http://www.w3.org/2000/svg";

export interface ApplyStyleOptions {
  // some containers (currently "labels") own their children's lifecycle themselves - the
  // renderer creates/destroys groups by its own id scheme (e.g. "labels-<name>"), so the
  // applier must never create a placeholder child there, only write attrs onto a match it finds
  createMissing?: boolean;
}

export function applyStyleNode(root: Element, node: StyleNode, options: ApplyStyleOptions = {}): void {
  const createMissing = options.createMissing ?? true;

  for (const { path, attr, value } of buildAttributeOps(node)) {
    let el: Element | null = root;
    for (const childId of path) {
      if (!el) break;
      // id match first (current convention); data-group covers renderers that prefix the id
      // (e.g. label groups: id="labels-<name>" data-group="<name>") to avoid id collisions
      let child: Element | null =
        el.querySelector(`:scope > [id="${childId}"]`) ?? el.querySelector(`:scope > [data-group="${childId}"]`);
      if (!child) {
        if (!createMissing) {
          el = null;
          break;
        }
        child = document.createElementNS(SVG_NS, "g");
        child.setAttribute("id", childId);
        el.appendChild(child);
      }
      el = child;
    }
    if (!el) continue;
    if (value === null) el.removeAttribute(attr);
    else el.setAttribute(attr, value);
  }
}

export function applyLayerStyle(layerId: LayerId): void {
  const node = style.layers[layerId];
  const root = layerId === "map" ? document.getElementById("map") : document.getElementById(layerId);
  if (!node || !root) return;
  // labels groups are renderer-owned (drawLabels/renderLabelGroup) until Task 12 re-homes them;
  // never create a stray id="<name>" group alongside the renderer's id="labels-<name>"
  applyStyleNode(root, node, { createMissing: layerId !== "labels" });
}

window.applyLayerStyle = applyLayerStyle;
