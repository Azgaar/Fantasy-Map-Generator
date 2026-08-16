export interface SvgUseItem {
  id: string;
  dataId: number;
  href: string;
  x: number;
  y: number;
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

  for (const item of items) {
    const element = existing.get(item.id) || group.ownerDocument.createElementNS(SVG_NAMESPACE, "use");
    setAttribute(element, "id", item.id);
    setAttribute(element, "data-id", item.dataId);
    setAttribute(element, "href", item.href);
    setAttribute(element, "x", item.x);
    setAttribute(element, "y", item.y);
    if (!element.parentNode) group.appendChild(element);
  }
}

function setAttribute(element: SVGUseElement, name: string, value: string | number): void {
  const next = String(value);
  if (element.getAttribute(name) !== next) element.setAttribute(name, next);
}
