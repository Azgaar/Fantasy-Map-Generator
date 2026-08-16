// Global layers registry: owns layers list, order, and svg skeleton

import { drawBiomes } from "@/renderers/draw-biomes";
import { drawBorders } from "@/renderers/draw-borders";
import { drawBurgIcons } from "@/renderers/draw-burg-icons";
import { drawCells } from "@/renderers/draw-cells";
import { drawCoastline } from "@/renderers/draw-coastline";
import { drawCompass } from "@/renderers/draw-compass";
import { drawCoordinates } from "@/renderers/draw-coordinates";
import { drawCultures } from "@/renderers/draw-cultures";
import { drawEmblems } from "@/renderers/draw-emblems";
import { drawGoods } from "@/renderers/draw-goods";
import { drawGrid } from "@/renderers/draw-grid";
import { drawHeightmap } from "@/renderers/draw-heightmap";
import { drawIce } from "@/renderers/draw-ice";
import { drawLakes } from "@/renderers/draw-lakes";
import { drawLandmass } from "@/renderers/draw-landmass";
import { redrawLegend } from "@/renderers/draw-legend";
import { drawMarkers } from "@/renderers/draw-markers";
import { drawMarkets } from "@/renderers/draw-markets";
import { drawMeasurers } from "@/renderers/draw-measurers";
import { drawMilitary } from "@/renderers/draw-military";
import { drawPopulation } from "@/renderers/draw-population";
import { drawPrecipitation } from "@/renderers/draw-precipitation";
import { drawProvinces } from "@/renderers/draw-provinces";
import { drawRelief, removeRelief } from "@/renderers/draw-relief-icons";
import { drawReligions } from "@/renderers/draw-religions";
import { drawRivers } from "@/renderers/draw-rivers";
import { drawRoutes } from "@/renderers/draw-routes";
import { drawScaleBar, removeScaleBar } from "@/renderers/draw-scalebar";
import { drawStates } from "@/renderers/draw-states";
import { drawTemperature } from "@/renderers/draw-temperature";
import { drawTexture } from "@/renderers/draw-texture";
import { drawVignette } from "@/renderers/draw-vignette";
import { drawZones } from "@/renderers/draw-zones";
import { drawLabels, removeLabels } from "@/renderers/labels/labels-renderer";
import { drawOceanLayers, removeOceanLayers } from "@/renderers/ocean-layers";
import { drawFogging } from "@/renderers/overlays/fogging";
import { tradeAnimation } from "@/renderers/trade-animation";
import { ensureEl, findEl } from "@/utils/nodeUtils";

interface LayerParams<Id extends string = string> {
  id: Id; // canonical identity, persisted in the .map file
  element?: string; // id of the svg group holding the layer content
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
    this.elementId = params.element ?? params.id;
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
      const { parent, id, element, children, attrs } = layer.params;

      let group = findEl<SVGGElement>(element ?? id);
      if (!group) {
        group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.id = element ?? id;
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

  /** draw the listed layers that are ON, always in layer order */
  draw(...ids: Id[]): void {
    for (const layer of this.layers) {
      if (ids.includes(layer.id) && this.active.has(layer.id)) layer.params.draw?.(layer);
    }
  }

  drawAll(): void {
    this.draw(...this.layers.map(layer => layer.id));
  }

  eraseAll(): void {
    for (const layer of this.layers) {
      if (layer.parent !== "viewbox") continue;
      if (layer.params.erase) layer.params.erase(layer);
      else this.eraseContent(layer);
    }
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
    parent: "viewbox",
    children: ["oceanLayers", "oceanPattern"],
    permanent: true,
    keepContent: true,
    draw: drawOceanLayers,
    erase: removeOceanLayers
  }),
  new Layer({ id: "landmass", parent: "viewbox", permanent: true, keepContent: true, draw: drawLandmass }),
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
    parent: "viewbox",
    children: ["freshwater", "salt", "sinkhole", "frozen", "lava", "dry"],
    keepContent: true,
    draw: drawLakes
  }),
  new Layer({ id: "biomes", parent: "viewbox", draw: drawBiomes }),
  new Layer({ id: "cells", parent: "viewbox", draw: drawCells }),
  new Layer({ id: "grid", element: "gridOverlay", parent: "viewbox", draw: drawGrid }),
  new Layer({ id: "coordinates", parent: "viewbox", draw: drawCoordinates }),
  new Layer({ id: "compass", parent: "viewbox", keepContent: true, draw: drawCompass }),
  new Layer({ id: "rivers", parent: "viewbox", draw: drawRivers }),
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
  new Layer({ id: "zones", parent: "viewbox", draw: drawZones }),
  new Layer({ id: "borders", parent: "viewbox", children: ["stateBorders", "provinceBorders"], draw: drawBorders }),
  new Layer({ id: "routes", parent: "viewbox", children: ["roads", "trails", "searoutes"], draw: drawRoutes }),
  new Layer({ id: "temperature", parent: "viewbox", draw: drawTemperature }),
  new Layer({
    id: "coastline",
    parent: "viewbox",
    children: ["sea_island", "lake_island"],
    permanent: true,
    keepContent: true,
    draw: drawCoastline
  }),
  new Layer({ id: "ice", parent: "viewbox", draw: drawIce }),
  new Layer({ id: "goods", parent: "viewbox", children: ["goodsCells", "goodsIcons", "goodsBurgs"], draw: drawGoods }),
  new Layer({ id: "markets", parent: "viewbox", draw: drawMarkets }),
  new Layer({
    id: "trade",
    element: "tradeAnimation",
    parent: "viewbox",
    keepContent: true,
    draw: () => tradeAnimation.start(),
    erase: () => tradeAnimation.stop()
  }),
  new Layer({ id: "precipitation", element: "prec", parent: "viewbox", draw: drawPrecipitation }),
  new Layer({ id: "population", parent: "viewbox", children: ["rural", "urban"], draw: drawPopulation }),
  new Layer({
    id: "emblems",
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
    parent: "viewbox",
    attrs: { "font-size": "100px" },
    draw: drawLabels,
    erase: removeLabels
  }),
  new Layer({ id: "military", element: "armies", parent: "viewbox", draw: drawMilitary }),
  new Layer({ id: "markers", parent: "viewbox", draw: drawMarkers }),
  new Layer({ id: "fogging", parent: "viewbox", attrs: { mask: "url(#fog)" }, permanent: true, draw: drawFogging }),
  new Layer({ id: "rulers", element: "ruler", parent: "viewbox", draw: drawMeasurers }),
  new Layer({ id: "debug", parent: "viewbox", permanent: true, keepContent: true }),
  new Layer({ id: "scaleBar", parent: "map", draw: () => drawScaleBar(), erase: removeScaleBar }),
  new Layer({
    id: "vignette",
    parent: "map",
    attrs: { mask: "url(#vignette-mask)" },
    keepContent: true,
    draw: drawVignette
  }),
  new Layer({ id: "legend", parent: "map", permanent: true, keepContent: true, draw: redrawLegend })
];

export type LayerId = (typeof mapLayers)[number]["id"];

declare global {
  var Layers: LayersRegistry<LayerId>;
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam for public/modules/**/*.js
export const Layers = new LayersRegistry(mapLayers);

window.Layers = Layers;
