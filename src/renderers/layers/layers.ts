// Global layers registry: owns layer state, layer order and the svg skeleton the layers are rendered into.
// The DOM is written from here and never read back — the only source of truth is the registry itself.
import { ensureEl, findEl } from "@/utils/nodeUtils";

export interface LayerParams {
  /** canonical identity, persisted in the map file */
  id: string;
  /** id of the svg group holding the layer content */
  element: string;
  /** id of the svg element the layer group is appended to */
  parent: "viewbox" | "map";
  /** sub-groups created inside the layer group and preserved when the content is erased */
  children?: string[];
  /** static attributes applied to the layer group */
  attrs?: Record<string, string>;
  /** structural layer: on from the start and never turned off by a preset */
  alwaysOn?: boolean;
  /** keep the content in the DOM when the layer is turned off */
  keepContent?: boolean;
  draw?: (layer: Layer) => void;
  /** custom teardown, defaults to erasing the content down to the declared children */
  erase?: (layer: Layer) => void;
}

export interface LayersState {
  order: string[];
  active: string[];
}

export class Layer {
  readonly id: string;
  readonly elementId: string;

  constructor(readonly params: LayerParams) {
    this.id = params.id;
    this.elementId = params.element;
  }

  get isOn(): boolean {
    return Layers.isOn(this);
  }

  getEl(): SVGGElement {
    return ensureEl<SVGGElement>(this.elementId);
  }
}

class LayersRegistry {
  private layers: Layer[] = [];
  private active = new Set<Layer>();
  private listeners = new Set<() => void>();

  register(...layers: Layer[]): void {
    this.layers.push(...layers);
    for (const layer of layers) if (layer.params.alwaysOn) this.active.add(layer);
  }

  /** create missing layer groups, order them by registration order and apply the current state */
  init(): void {
    for (const layer of this.layers) {
      const { parent, element, children, attrs } = layer.params;

      let group = findEl<SVGGElement>(element);
      if (!group) {
        group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.id = element;
      }
      for (const [name, value] of Object.entries(attrs ?? {})) group.setAttribute(name, value);
      ensureEl(parent).append(group);

      for (const child of children ?? []) {
        if (group.querySelector(`#${child}`)) continue;
        const childGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        childGroup.id = child;
        group.append(childGroup);
      }

      setVisible(group, this.active.has(layer));
    }
  }

  get all(): Layer[] {
    return this.layers;
  }

  /** lookup by id: for deserialization and legacy js only, prefer the layer references */
  get(id: string): Layer | undefined {
    return this.layers.find(layer => layer.id === id);
  }

  isOn(layer: Layer): boolean {
    return this.active.has(layer);
  }

  /** turn the layers on if they are off and (re)draw them */
  show(...layers: Layer[]): void {
    this.change(layers, true);
    this.draw(...layers);
    this.emit();
  }

  hide(...layers: Layer[]): void {
    this.change(layers, false);
    this.emit();
  }

  toggle(layer: Layer): void {
    this.active.has(layer) ? this.hide(layer) : this.show(layer);
  }

  /** turn on the listed layers and turn off every other user-controlled one, drawing the ones that were off */
  setActive(active: Layer[]): void {
    const drawn = this.layers.filter(layer => active.includes(layer) && !this.active.has(layer));
    this.change(
      this.layers.filter(layer => !layer.params.alwaysOn && !active.includes(layer)),
      false
    );
    this.change(active, true);
    this.draw(...drawn);
    this.emit();
  }

  /** draw the listed layers that are on, always in layer order */
  draw(...layers: Layer[]): void {
    for (const layer of this.layers) {
      if (layers.includes(layer) && this.active.has(layer)) layer.params.draw?.(layer);
    }
  }

  drawAll(): void {
    this.draw(...this.layers);
  }

  move(layer: Layer, before?: Layer): void {
    this.layers.splice(this.layers.indexOf(layer), 1);
    this.layers.splice(before ? this.layers.indexOf(before) : this.layers.length, 0, layer);
    this.init();
    this.emit();
  }

  get state(): LayersState {
    return {
      order: this.layers.map(layer => layer.id),
      active: this.layers.filter(layer => this.active.has(layer) && !layer.params.alwaysOn).map(layer => layer.id)
    };
  }

  /** apply stored state: the content is already in the DOM, so nothing is drawn or erased */
  restore({ order, active }: LayersState): void {
    // layers missing from the stored order keep their registration-order neighbours
    const ranks = new Map<string, number>();
    let previous = -1;
    for (const layer of this.layers) {
      const index = order.indexOf(layer.id);
      previous = index === -1 ? previous + 1e-3 : index;
      ranks.set(layer.id, previous);
    }

    this.layers.sort((a, b) => ranks.get(a.id)! - ranks.get(b.id)!);
    this.active = new Set(this.layers.filter(layer => layer.params.alwaysOn || active.includes(layer.id)));
    this.init();
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** flip the state and the visibility of the layers that are not in the requested state yet */
  private change(layers: Layer[], on: boolean): void {
    for (const layer of this.layers) {
      if (!layers.includes(layer) || this.active.has(layer) === on) continue;

      on ? this.active.add(layer) : this.active.delete(layer);
      setVisible(layer.getEl(), on);

      if (on) continue;
      if (layer.params.erase) layer.params.erase(layer);
      else if (!layer.params.keepContent) eraseContent(layer);
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

/** default teardown: drop the content, keeping the declared skeleton */
function eraseContent(layer: Layer): void {
  for (const child of Array.from(layer.getEl().children)) {
    if (layer.params.children?.includes(child.id)) child.replaceChildren();
    else child.remove();
  }
}

/** write visibility, dropping the style attribute when it carries nothing else: keeps the saved svg clean */
function setVisible(element: SVGGElement, visible: boolean): void {
  element.style.display = visible ? "" : "none";
  if (!element.getAttribute("style")) element.removeAttribute("style");
}

export const Layers = new LayersRegistry();

declare global {
  // biome-ignore lint/suspicious/noRedeclare: legacy seam
  var Layers: LayersRegistry;
}

window.Layers = Layers;
