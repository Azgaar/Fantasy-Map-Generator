import { orderElements } from "./svg-markup-reconciler";

export interface SvgUseItem {
  id: string;
  dataId: string | number;
  href: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/** Reconcile a flat SVG use layer without detaching nodes whose data did not change. */
export function reconcileSvgUseElements(group: SVGGElement, items: SvgUseItem[]): void {
  const desiredIds = new Set(items.map(({ id }) => id));
  const existing = new Map<string, SVGUseElement>();

  for (const child of Array.from(group.children)) {
    if (child.tagName.toLowerCase() !== "use") continue;
    if (!desiredIds.has(child.id)) child.remove();
    else existing.set(child.id, child as SVGUseElement);
  }

  const ordered: SVGUseElement[] = [];
  for (const item of items) {
    const element = existing.get(item.id) || group.ownerDocument.createElementNS(SVG_NAMESPACE, "use");
    setAttribute(element, "id", item.id);
    setAttribute(element, "data-id", item.dataId);
    setAttribute(element, "href", item.href);
    setAttribute(element, "x", item.x);
    setAttribute(element, "y", item.y);
    setOptionalAttribute(element, "width", item.width);
    setOptionalAttribute(element, "height", item.height);
    ordered.push(element);
  }
  orderElements(group, ordered);
}

function setAttribute(element: SVGUseElement, name: string, value: string | number): void {
  const next = String(value);
  if (element.getAttribute(name) !== next) element.setAttribute(name, next);
}

function setOptionalAttribute(element: SVGUseElement, name: string, value: number | undefined): void {
  if (value !== undefined) setAttribute(element, name, value);
}
