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

export function applyStyleNode(root: Element, node: StyleNode): void {
  for (const { path, attr, value } of buildAttributeOps(node)) {
    let el: Element = root;
    for (const childId of path) {
      let child = el.querySelector(`:scope > [id="${childId}"]`);
      if (!child) {
        child = document.createElementNS(SVG_NS, "g");
        child.setAttribute("id", childId);
        el.appendChild(child);
      }
      el = child;
    }
    if (value === null) el.removeAttribute(attr);
    else el.setAttribute(attr, value);
  }
}

export function applyLayerStyle(layerId: LayerId): void {
  const node = style.layers[layerId];
  const root = layerId === "map" ? document.getElementById("map") : document.getElementById(layerId);
  if (!node || !root) return;
  applyStyleNode(root, node);
}

window.applyLayerStyle = applyLayerStyle;
