import type { Layer } from "./layer.ts";
import { SvgLayer } from "./layer.ts";

export type LayerKind = "svg" | "webgl";

export interface LayerRecord {
  readonly id: string;
  readonly kind: LayerKind;
  order: number;
  visible: boolean;
  readonly surface: Element | null;
  readonly owner: Layer | null;
}

const TOGGLE_TO_LAYER_ID: Readonly<Record<string, string>> = {
  toggleHeight: "terrs",
  toggleBiomes: "biomes",
  toggleCells: "cells",
  toggleGrid: "gridOverlay",
  toggleCoordinates: "coordinates",
  toggleCompass: "compass",
  toggleRivers: "rivers",
  toggleRelief: "terrain",
  toggleReligions: "relig",
  toggleCultures: "cults",
  toggleStates: "regions",
  toggleProvinces: "provs",
  toggleBorders: "borders",
  toggleRoutes: "routes",
  toggleTemperature: "temperature",
  togglePrecipitation: "prec",
  togglePopulation: "population",
  toggleIce: "ice",
  toggleTexture: "texture",
  toggleEmblems: "emblems",
  toggleLabels: "labels",
  toggleBurgIcons: "icons",
  toggleMarkers: "markers",
  toggleRulers: "ruler",
};

export class LayersModule {
  private readonly records = new Map<string, LayerRecord>();
  private nextOrder = 0;

  register(
    id: string,
    kind: LayerKind,
    visible: boolean,
    surface: Element | null,
  ) {
    const owner: Layer | null =
      kind === "svg" && surface ? new SvgLayer(id, surface) : null;
    this.records.set(id, {
      id,
      kind,
      order: this.nextOrder++,
      visible,
      surface,
      owner,
    });
  }

  get(id: string): LayerRecord | undefined {
    return this.records.get(id);
  }

  getAll(): LayerRecord[] {
    return Array.from(this.records.values()).sort((a, b) => a.order - b.order);
  }

  layerIdForToggle(toggleId: string): string | null {
    return TOGGLE_TO_LAYER_ID[toggleId] ?? null;
  }

  reorder(id: string, afterId: string | null) {
    const rec = this.records.get(id);
    if (!rec || rec.kind !== "svg") return;

    const without = this.getAll().filter(
      (r) => r.kind === "svg" && r.id !== id,
    );

    const insertIdx =
      afterId === null ? 0 : without.findIndex((r) => r.id === afterId) + 1;
    if (afterId !== null && insertIdx === 0) return;

    without.splice(insertIdx, 0, rec);
    without.forEach((r, i) => {
      r.order = i;
    });
    this.nextOrder = without.length;

    if (rec.surface) {
      const afterSurface =
        afterId !== null ? (this.records.get(afterId)?.surface ?? null) : null;
      if (afterSurface) {
        afterSurface.after(rec.surface);
      } else {
        const parent = rec.surface.parentElement;
        const first = parent?.firstElementChild ?? null;
        if (first && first !== rec.surface)
          parent!.insertBefore(rec.surface, first);
      }
    }
  }

  setVisible(id: string, visible: boolean) {
    const rec = this.records.get(id);
    if (!rec) return;
    rec.visible = visible;
    rec.owner?.setVisible(visible);
  }
}

declare global {
  var Layers: LayersModule;
}

if (typeof window !== "undefined") {
  window.Layers = new LayersModule();
}
