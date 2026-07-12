import { type Bounds, getLayers, type LayerEntry, type RenderContext } from "./layer_registry";

type BoundsProvider = () => Bounds;
type RenderRoot = Document | SVGSVGElement;

const svgNamespace = "http://www.w3.org/2000/svg";
let rafId: number | null = null;
let pendingBoundsProvider: BoundsProvider | null = null;

export function scheduleRender(getBounds: BoundsProvider): void {
  pendingBoundsProvider = getBounds;
  if (rafId !== null) return;

  rafId = requestAnimationFrame(() => {
    rafId = null;
    const getPendingBounds = pendingBoundsProvider;
    pendingBoundsProvider = null;
    if (getPendingBounds) renderLayers(getPendingBounds());
  });
}

export function renderNow(getBounds: BoundsProvider): void {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  pendingBoundsProvider = null;
  renderLayers(getBounds());
}

export function renderAll(root: SVGSVGElement, getBounds: BoundsProvider): void {
  renderLayers(getBounds(), root, true);
}

function renderLayers(bounds: Bounds, root: RenderRoot = document, renderAllItems = false): void {
  const context: RenderContext = { bounds, scale: bounds.scale };

  for (const layer of getLayers()) {
    const rootGroup = findElement(root, layer.rootId);
    if (!rootGroup) continue;

    const group = ensureGroup(rootGroup, layer.groupId);
    const active = layer.enabled() && (renderAllItems || isInScaleRange(bounds.scale, layer));

    if (!active) {
      if (layer.render) group.replaceChildren();
      continue;
    }

    if (layer.render && layer.getItems) {
      let items = layer.getItems();
      if (layer.filter) items = items.filter(layer.filter);
      if (!renderAllItems && layer.inViewport) items = items.filter(item => layer.inViewport!(item, bounds));
      layer.render(group, items, context);
    }

    if (!renderAllItems) layer.update?.(group, context);
  }
}

function findElement(root: RenderRoot, id: string): SVGGElement | null {
  const element = root instanceof Document ? root.getElementById(id) : root.querySelector(`#${CSS.escape(id)}`);
  return element instanceof SVGGElement ? element : null;
}

function ensureGroup(root: SVGGElement, groupId: string): SVGGElement {
  const existing = Array.from(root.children).find(child => child instanceof SVGGElement && child.id === groupId);
  if (existing instanceof SVGGElement) return existing;

  const group = document.createElementNS(svgNamespace, "g");
  group.id = groupId;
  root.appendChild(group);
  return group;
}

function isInScaleRange(scale: number, layer: LayerEntry<unknown>): boolean {
  if (layer.scaleMin !== undefined && scale < layer.scaleMin) return false;
  if (layer.scaleMax !== undefined && scale > layer.scaleMax) return false;
  return true;
}
