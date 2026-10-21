/**
 * geometry.ts — map-space math, read out of FMG's own packed graph.
 *
 * Phase 0 ported the overlay's d3 Voronoi adapter. Phase A does not need it:
 * FMG 1.154 publishes the diagram it already built —
 *
 *   pack.cells.p[cellId]   the cell's polygon points
 *   pack.cells.c[cellId]   the cell's neighbours
 *   Pack.findCell(x, y)    the cell containing a point
 *
 * so hit-testing and cell geometry come straight from FMG instead of being
 * recomputed. That deletes a whole cache, a d3 version fork and the per-frame
 * argmin that the overlay's hit-test needed.
 *
 * What is left is the `#viewbox` transform, parsed rather than depended on: FMG
 * writes `translate(x y) scale(k)` (zoom.ts).
 */
import { type FmgPack, fmg } from "./fmg";

/** FMG's `Pack` module (pack-generator.ts), reached through its global. */
interface FmgPackModule {
  findCell(x: number, y: number, radius?: number): number | undefined;
}

function packed(): FmgPack | null {
  const pack = fmg()?.pack;
  return pack?.cells?.p ? pack : null;
}

function packModule(): FmgPackModule | null {
  return (globalThis as unknown as { Pack?: FmgPackModule }).Pack ?? null;
}

/**
 * Closed polygon [[x,y]…] of one cell, or null when the world is not loaded.
 *
 * FMG's packed graph stores the outline as vertex IDs (`cells.v`) into a shared
 * vertex table (`vertices.p`) — the same pair its own `Pack.getPolygon()` walks.
 * `cells.p` is cell *centres* (one [x,y] pair each), which is why reading the
 * polygon from there yields a 2-point "polygon" and silently renders nothing.
 */
export function cellPolygon(cellId: number): number[][] | null {
  const pack = packed();
  const ids = pack?.cells.v?.[cellId];
  const points = pack?.vertices?.p;
  if (!Array.isArray(ids) || !Array.isArray(points) || ids.length < 3) return null;
  const polygon: number[][] = [];
  for (const id of ids) {
    const point = points[id];
    if (!point) return null;
    polygon.push(point);
  }
  return polygon;
}

/** Neighbour cell ids of one cell (FMG's own adjacency, not a guess at stride). */
export function cellNeighbors(cellId: number): number[] {
  const neighbors = packed()?.cells.c?.[cellId];
  return Array.isArray(neighbors) ? neighbors : [];
}

/** The cell containing a map-space point, or -1. */
export function findCell(x: number, y: number): number {
  const found = packModule()?.findCell(x, y);
  return typeof found === "number" ? found : -1;
}

/** Map-space coordinates for a client event, or null without a map. */
export function screenToMap(clientX: number, clientY: number): [number, number] | null {
  const viewbox = document.getElementById("viewbox");
  const svg = document.getElementById("map");
  if (!viewbox || !svg) return null;
  const transform = /translate\(([-\d.eE]+)[ ,]+([-\d.eE]+)\)\s*scale\(([-\d.eE]+)\)/.exec(
    viewbox.getAttribute("transform") ?? ""
  );
  const k = transform ? Number(transform[3]) : 1;
  const tx = transform ? Number(transform[1]) : 0;
  const ty = transform ? Number(transform[2]) : 0;
  if (!k) return null;
  const rect = svg.getBoundingClientRect();
  return [(clientX - rect.left - tx) / k, (clientY - rect.top - ty) / k];
}

/** Current zoom scale from the `#viewbox` transform (1 when unzoomed). */
export function zoomScale(): number {
  const viewbox = document.getElementById("viewbox");
  if (!viewbox) return 1;
  const transform = /scale\(([-\d.eE]+)\)/.exec(viewbox.getAttribute("transform") ?? "");
  return transform ? Number(transform[1]) : 1;
}

/**
 * Observe FMG zoom changes (the `transform` attribute on `#viewbox`),
 * rAF-coalesced so a zoom gesture redraws once, not per frame.
 *
 * `#viewbox` is inside `#map`, and FMG **replaces `#map` when it loads a world** —
 * so an observer bound at boot watches a detached node forever. Hence `rebind()`:
 * the caller re-arms it whenever the world changes (see ui/layers/index.ts).
 */
export function onZoom(callback: (scale: number) => void): { dispose: () => void; rebind: () => void } {
  let frame = 0;
  let observer: MutationObserver | null = null;

  const disconnect = (): void => {
    observer?.disconnect();
    observer = null;
  };

  const rebind = (): void => {
    disconnect();
    if (typeof MutationObserver === "undefined") return;
    const viewbox = document.getElementById("viewbox");
    if (!viewbox) return;
    observer = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        callback(zoomScale());
      });
    });
    observer.observe(viewbox, { attributes: true, attributeFilter: ["transform"] });
  };

  rebind();
  return {
    dispose: () => {
      if (frame) cancelAnimationFrame(frame);
      disconnect();
    },
    rebind
  };
}
