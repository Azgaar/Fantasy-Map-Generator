export interface SvgMarkupItem {
  id: string;
  key: string;
  markup: string;
}

interface ElementState {
  id: string;
  key: string;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const elementStates = new WeakMap<Element, ElementState>();

/** Reconcile a flat keyed SVG layer, retaining unchanged nodes and their browser paint caches. */
export function reconcileSvgMarkupElements(group: SVGElement, items: SvgMarkupItem[]): Map<string, SVGElement> {
  return reconcileKeyedElements(group, items, item => createSvgElement(group.ownerDocument, item.markup));
}

export function reconcileKeyedElements<T extends Element, I extends Pick<SvgMarkupItem, "id" | "key">>(
  group: Element,
  items: I[],
  createElement: (item: I) => T
): Map<string, T> {
  const desiredIds = new Set(items.map(({ id }) => id));
  const existing = new Map<string, T>();

  for (const child of Array.from(group.children) as T[]) {
    const state = elementStates.get(child);
    if (!state || !desiredIds.has(state.id) || existing.has(state.id)) child.remove();
    else existing.set(state.id, child);
  }

  const ordered: T[] = [];
  const result = new Map<string, T>();
  for (const item of items) {
    const current = existing.get(item.id);
    if (current && elementStates.get(current)?.key === item.key) {
      ordered.push(current);
      result.set(item.id, current);
      continue;
    }

    const element = createElement(item);
    elementStates.set(element, { id: item.id, key: item.key });
    if (current) current.replaceWith(element);
    ordered.push(element);
    result.set(item.id, element);
  }

  orderElements(group, ordered);
  return result;
}

export function orderElements(group: Element, elements: Element[]): void {
  let cursor = group.firstElementChild;
  for (const element of elements) {
    if (element === cursor) {
      cursor = cursor.nextElementSibling;
      continue;
    }
    group.insertBefore(element, cursor);
  }
}

function createSvgElement(document: Document, markup: string): SVGElement {
  const container = document.createElementNS(SVG_NAMESPACE, "g");
  container.innerHTML = markup;
  const element = container.firstElementChild;
  if (element?.namespaceURI !== SVG_NAMESPACE || element.nextElementSibling) {
    throw new Error("Viewport markup must contain exactly one SVG element");
  }
  return element as SVGElement;
}
