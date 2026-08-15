// Global layers registry: owns layers list, order, and svg skeleton
import { select } from "d3";
import { ensureEl, findEl } from "@/utils/nodeUtils";
import { drawBiomes } from "../draw-biomes";
import { drawBorders } from "../draw-borders";
import { drawBurgIcons } from "../draw-burg-icons";
import { drawCells } from "../draw-cells";
import { drawCoordinates } from "../draw-coordinates";
import { drawCultures } from "../draw-cultures";
import { drawEmblems } from "../draw-emblems";
import { drawFeatures } from "../draw-features";
import { drawGoods } from "../draw-goods";
import { drawGrid } from "../draw-grid";
import { drawHeightmap } from "../draw-heightmap";
import { drawIce } from "../draw-ice";
import { drawMarkers } from "../draw-markers";
import { drawMarkets } from "../draw-markets";
import { drawMeasurers } from "../draw-measurers";
import { drawMilitary } from "../draw-military";
import { drawPopulation } from "../draw-population";
import { drawPrecipitation } from "../draw-precipitation";
import { drawProvinces } from "../draw-provinces";
import { drawRelief, removeRelief } from "../draw-relief-icons";
import { drawReligions } from "../draw-religions";
import { drawRivers } from "../draw-rivers";
import { drawRoutes } from "../draw-routes";
import { drawStates } from "../draw-states";
import { drawTemperature } from "../draw-temperature";
import { drawTexture } from "../draw-texture";
import { drawZones } from "../draw-zones";
import { drawLabels, removeLabels } from "../labels/labels-renderer";
import { tradeAnimation } from "../trade-animation";

interface LayerParams<Id extends string = string> {
  id: Id; // canonical identity, persisted in the .map file
  element: string; // id of the svg group holding the layer content
  parent: "viewbox" | "map"; // id of the svg element the layer group is appended to
  children?: string[]; // sub-groups created inside the layer group and preserved when the content is erased
  attrs?: Record<string, string>; // static attributes applied to the layer group
  permanent?: boolean; // structural layer: on from the start and never turned off
  keepContent?: boolean; // keep the content in the DOM when the layer is turned off
  draw?: (layer: Layer) => void; // renderer function
  erase?: (layer: Layer) => void; // custom teardown, defaults to erasing the content down to the declared children
}

export interface LayersState {
  order: string[];
  active: string[];
}

/** A layer is a value: an identity and an svg group. On/off state belongs to the registry */
export class Layer<Id extends string = string> {
  readonly id: Id;
  readonly elementId: string;
  readonly parent: "viewbox" | "map";

  /** the registry reads `params`; consumers use the fields above and `getEl()` */
  constructor(readonly params: LayerParams<Id>) {
    this.id = params.id;
    this.elementId = params.element;
    this.parent = params.parent;
  }

  getEl(): SVGGElement {
    return ensureEl<SVGGElement>(this.elementId);
  }
}

export class LayersRegistry<Id extends string = string> {
  private active = new Set<Id>();
  private listeners = new Set<() => void>();

  constructor(private layers: Layer<Id>[]) {
    for (const layer of layers) if (layer.params.permanent) this.active.add(layer.id);
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

      this.setVisible(group, this.active.has(layer.id));
    }
  }

  get all(): readonly Layer<Id>[] {
    return this.layers;
  }

  /** narrow an untrusted string — a dataset value, a stored preset, a map file — to a known layer id */
  has(id: string): id is Id {
    return this.layers.some(layer => layer.id === id);
  }

  get(id: Id): Layer<Id> {
    const layer = this.layers.find(layer => layer.id === id);
    if (!layer) throw new Error(`Layer ${id} is not registered`);
    return layer;
  }

  isOn(id: Id): boolean {
    return this.active.has(id);
  }

  /** turn the layers on if they are off and (re)draw them */
  show(...ids: Id[]): void {
    this.change(ids, true);
    this.draw(...ids);
    this.emit();
  }

  /** turn the layers off */
  hide(...ids: Id[]): void {
    this.change(ids, false);
    this.emit();
  }

  toggle(id: Id): void {
    this.active.has(id) ? this.hide(id) : this.show(id);
  }

  /**
   * Turn on the listed layers and turn off every other user-controlled one, drawing the ones that were off.
   * Takes plain strings and ignores the ones it does not know: the list comes from presets and snapshots
   */
  set(ids: readonly string[]): void {
    const known = this.layers.filter(layer => ids.includes(layer.id)).map(layer => layer.id);
    const drawn = known.filter(id => !this.active.has(id));

    this.change(
      this.layers.filter(layer => !layer.params.permanent && !known.includes(layer.id)).map(layer => layer.id),
      false
    );
    this.change(known, true);
    this.draw(...drawn);
    this.emit();
  }

  /** draw the listed layers that are on, always in layer order */
  draw(...ids: Id[]): void {
    for (const layer of this.layers) {
      if (ids.includes(layer.id) && this.active.has(layer.id)) layer.params.draw?.(layer);
    }
  }

  drawAll(): void {
    this.draw(...this.layers.map(layer => layer.id));
  }

  move(id: Id, before?: Id): void {
    const layer = this.get(id);
    this.layers.splice(this.layers.indexOf(layer), 1);
    this.layers.splice(before ? this.layers.indexOf(this.get(before)) : this.layers.length, 0, layer);
    this.init();
    this.emit();
  }

  get state(): LayersState {
    return {
      order: this.layers.map(layer => layer.id),
      active: this.layers.filter(layer => this.active.has(layer.id) && !layer.params.permanent).map(layer => layer.id)
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
    this.active = new Set(
      this.layers.filter(layer => layer.params.permanent || active.includes(layer.id)).map(layer => layer.id)
    );
    this.init();
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** flip the state and the visibility of the layers that are not in the requested state yet */
  private change(ids: readonly Id[], on: boolean): void {
    for (const layer of this.layers) {
      if (!ids.includes(layer.id) || this.active.has(layer.id) === on) continue;

      on ? this.active.add(layer.id) : this.active.delete(layer.id);
      this.setVisible(layer.getEl(), on);

      if (on) continue;
      if (layer.params.erase) layer.params.erase(layer);
      else if (!layer.params.keepContent) this.eraseContent(layer);
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  /** default teardown: drop the content, keeping the declared skeleton */
  private eraseContent(layer: Layer<Id>): void {
    for (const child of Array.from(layer.getEl().children)) {
      if (layer.params.children?.includes(child.id)) child.replaceChildren();
      else child.remove();
    }
  }

  /** write visibility, dropping the style attribute when it carries nothing else: keeps the saved svg clean */
  private setVisible(element: SVGGElement, visible: boolean): void {
    element.style.display = visible ? "" : "none";
    if (!element.getAttribute("style")) element.removeAttribute("style");
  }
}

// this order is the z-order, the init order and the draw order
const mapLayers = [
  new Layer({
    id: "ocean",
    element: "ocean",
    parent: "viewbox",
    children: ["oceanLayers", "oceanPattern"],
    permanent: true,
    keepContent: true
  }),

  new Layer({
    id: "landmass",
    element: "landmass",
    parent: "viewbox",
    permanent: true,
    keepContent: true,
    draw: drawFeatures
  }),

  new Layer({ id: "texture", element: "texture", parent: "viewbox", draw: drawTexture }),

  new Layer({
    id: "heightmap",
    element: "terrs",
    parent: "viewbox",
    children: ["oceanHeights", "landHeights"],
    draw: drawHeightmap
  }),

  new Layer({
    id: "lakes",
    element: "lakes",
    parent: "viewbox",
    children: ["freshwater", "salt", "sinkhole", "frozen", "lava", "dry"],
    keepContent: true
  }),

  new Layer({ id: "biomes", element: "biomes", parent: "viewbox", draw: drawBiomes }),

  new Layer({ id: "cells", element: "cells", parent: "viewbox", draw: drawCells }),

  new Layer({ id: "grid", element: "gridOverlay", parent: "viewbox", draw: drawGrid }),

  new Layer({ id: "coordinates", element: "coordinates", parent: "viewbox", draw: drawCoordinates }),

  new Layer({ id: "compass", element: "compass", parent: "viewbox", keepContent: true }),

  new Layer({ id: "rivers", element: "rivers", parent: "viewbox", draw: drawRivers }),

  new Layer({ id: "relief", element: "terrain", parent: "viewbox", draw: drawRelief, erase: removeRelief }),

  new Layer({ id: "religions", element: "relig", parent: "viewbox", draw: drawReligions }),

  new Layer({ id: "cultures", element: "cults", parent: "viewbox", draw: drawCultures }),

  new Layer({
    id: "states",
    element: "regions",
    parent: "viewbox",
    children: ["statesBody", "statesHalo"],
    draw: drawStates
  }),

  new Layer({ id: "provinces", element: "provs", parent: "viewbox", draw: drawProvinces }),

  new Layer({ id: "zones", element: "zones", parent: "viewbox", draw: drawZones }),

  new Layer({
    id: "borders",
    element: "borders",
    parent: "viewbox",
    children: ["stateBorders", "provinceBorders"],
    draw: drawBorders
  }),

  new Layer({
    id: "routes",
    element: "routes",
    parent: "viewbox",
    children: ["roads", "trails", "searoutes"],
    draw: drawRoutes
  }),

  new Layer({ id: "temperature", element: "temperature", parent: "viewbox", draw: drawTemperature }),

  new Layer({
    id: "coastline",
    element: "coastline",
    parent: "viewbox",
    children: ["sea_island", "lake_island"],
    permanent: true,
    keepContent: true
  }),

  new Layer({ id: "ice", element: "ice", parent: "viewbox", draw: drawIce }),

  new Layer({
    id: "goods",
    element: "goods",
    parent: "viewbox",
    children: ["goodsCells", "goodsIcons", "goodsBurgs"],
    draw: drawGoods
  }),

  new Layer({ id: "markets", element: "markets", parent: "viewbox", draw: drawMarkets }),

  new Layer({
    id: "trade",
    element: "tradeAnimation",
    parent: "viewbox",
    keepContent: true,
    draw: () => tradeAnimation.start(),
    erase: () => tradeAnimation.stop()
  }),

  new Layer({ id: "precipitation", element: "prec", parent: "viewbox", draw: drawPrecipitation }),

  new Layer({
    id: "population",
    element: "population",
    parent: "viewbox",
    children: ["rural", "urban"],
    draw: drawPopulation
  }),

  new Layer({
    id: "emblems",
    element: "emblems",
    parent: "viewbox",
    children: ["burgEmblems", "provinceEmblems", "stateEmblems"],
    keepContent: true,
    draw: drawEmblems
  }),

  new Layer({
    id: "burgIcons",
    element: "icons",
    parent: "viewbox",
    children: ["burgIcons", "anchors"],
    draw: drawBurgIcons
  }),

  new Layer({
    id: "labels",
    element: "labels",
    parent: "viewbox",
    attrs: { "font-size": "100px" },
    draw: drawLabels,
    erase: removeLabels
  }),

  new Layer({ id: "military", element: "armies", parent: "viewbox", draw: drawMilitary }),

  new Layer({ id: "markers", element: "markers", parent: "viewbox", draw: drawMarkers }),

  new Layer({
    id: "fogging",
    element: "fogging",
    parent: "viewbox",
    attrs: { mask: "url(#fog)" },
    keepContent: true
  }),

  new Layer({ id: "rulers", element: "ruler", parent: "viewbox", draw: drawMeasurers }),

  new Layer({ id: "debug", element: "debug", parent: "viewbox", permanent: true, keepContent: true }),

  new Layer({
    id: "scaleBar",
    element: "scaleBar",
    parent: "map",
    keepContent: true,
    draw: layer => drawScaleBar(select(layer.getEl()), scale)
  }),

  new Layer({
    id: "vignette",
    element: "vignette",
    parent: "map",
    attrs: { mask: "url(#vignette-mask)" },
    keepContent: true
  }),

  new Layer({ id: "legend", element: "legend", parent: "map", permanent: true, keepContent: true })
];

export type LayerId = (typeof mapLayers)[number]["id"];

declare global {
  var Layers: LayersRegistry<LayerId>;
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam for public/modules/**/*.js
export const Layers = new LayersRegistry(mapLayers);

window.Layers = Layers;
