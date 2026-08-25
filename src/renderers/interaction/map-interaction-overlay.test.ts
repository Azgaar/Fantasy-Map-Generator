import { describe, expect, it, vi } from "vitest";
import type { MapCamera } from "../core/camera";
import {
  ensureMapInteractionSurface,
  getMapInteractionOverlayLayout,
  MAP_INTERACTION_SURFACE_ID,
  MapInteractionOverlay,
  nudgeMapInteractionPoint,
  resolveMapInteractionPointer
} from "./map-interaction-overlay";

const camera: MapCamera = { height: 600, scale: 2, width: 800, x: 40, y: -20 };

describe("map interaction overlay", () => {
  it("uses the renderer camera transform and keeps handles at a fixed screen radius", () => {
    expect(getMapInteractionOverlayLayout(camera)).toEqual({
      handleRadius: 3,
      height: 600,
      transform: "translate(40 -20) scale(2)",
      width: 800
    });
  });

  it("keeps world alignment when the viewport is resized", () => {
    const resized = getMapInteractionOverlayLayout({ ...camera, height: 900, width: 1200 });
    expect(resized.transform).toBe("translate(40 -20) scale(2)");
    expect(resized).toMatchObject({ height: 900, width: 1200 });
  });

  it("updates the overlay transform without recreating selection geometry on zoom", () => {
    const setAttribute = vi.fn();
    const replaceWith = vi.fn();
    const createElementNS = document.createElementNS;
    document.createElementNS = vi.fn(() => ({
      append: vi.fn(),
      classList: { add: vi.fn() },
      dataset: {},
      setAttribute: vi.fn(),
      style: {}
    })) as unknown as typeof document.createElementNS;
    const root = {
      querySelector: vi.fn(() => ({ replaceWith })),
      querySelectorAll: vi.fn(() => []),
      setAttribute
    } as unknown as SVGGElement;
    const overlay = new MapInteractionOverlay();
    (overlay as unknown as { root: SVGGElement }).root = root;

    try {
      overlay.setCamera(camera);

      expect(setAttribute).toHaveBeenCalledWith("transform", "translate(40 -20) scale(2)");
      expect(root.querySelectorAll).toHaveBeenCalledTimes(2);
      expect(replaceWith).toHaveBeenCalledOnce();
    } finally {
      document.createElementNS = createElementNS;
    }
  });

  it("resolves mouse and touch pointer coordinates through the shared transform", () => {
    expect(resolveMapInteractionPointer({ x: 260, y: 170 }, { left: 20, top: 10 }, camera)).toEqual({
      screenPoint: { x: 240, y: 160 },
      worldPoint: { x: 100, y: 90 }
    });
  });

  it("supports scale-independent keyboard movement for accessible handles", () => {
    expect(nudgeMapInteractionPoint({ x: 10, y: 20 }, "ArrowRight", camera)).toEqual({ x: 10.5, y: 20 });
    expect(nudgeMapInteractionPoint({ x: 10, y: 20 }, "ArrowUp", camera, { large: true })).toEqual({
      x: 10,
      y: 15
    });
    expect(nudgeMapInteractionPoint({ x: 10, y: 20 }, "Enter", camera)).toBeNull();
  });

  it("keeps a full-world pointer target behind Pixi editor overlays", () => {
    const attributes = new Map<string, string>();
    const surface = {
      dataset: {},
      id: "",
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      style: {}
    } as unknown as SVGRectElement;
    const firstChild = {} as ChildNode;
    const insertBefore = vi.fn();
    const querySelector = vi.fn<() => SVGRectElement | null>().mockReturnValueOnce(null).mockReturnValue(surface);
    const viewbox = { firstChild, insertBefore, querySelector } as unknown as SVGGElement;
    const createElementNS = document.createElementNS;
    document.createElementNS = vi.fn(() => surface) as unknown as typeof document.createElementNS;

    try {
      expect(ensureMapInteractionSurface(viewbox, 1200, 800)).toBe(surface);
      expect(surface.id).toBe(MAP_INTERACTION_SURFACE_ID);
      expect(surface.dataset.rendererOverlay).toBe("input");
      expect(surface.style.pointerEvents).toBe("all");
      expect(Object.fromEntries(attributes)).toMatchObject({
        "aria-hidden": "true",
        fill: "transparent",
        height: "800",
        width: "1200",
        x: "0",
        y: "0"
      });
      expect(insertBefore).toHaveBeenCalledWith(surface, firstChild);

      ensureMapInteractionSurface(viewbox, 1600, 900);
      expect(attributes.get("width")).toBe("1600");
      expect(attributes.get("height")).toBe("900");
      expect(insertBefore).toHaveBeenCalledOnce();
    } finally {
      document.createElementNS = createElementNS;
    }
  });

  it("updates only the changed overlay channel", () => {
    const createElementNS = document.createElementNS;
    const selectionChannel = { replaceWith: vi.fn() };
    const querySelector = vi.fn((selector: string) =>
      selector === '[data-overlay-channel="selection"]' ? selectionChannel : null
    );
    document.createElementNS = vi.fn(() => ({
      append: vi.fn(),
      classList: { add: vi.fn() },
      dataset: {},
      setAttribute: vi.fn(),
      style: { setProperty: vi.fn() }
    })) as unknown as typeof document.createElementNS;
    const overlay = new MapInteractionOverlay();
    (overlay as unknown as { root: { querySelector: typeof querySelector } }).root = { querySelector };

    try {
      overlay.update({
        selection: [
          {
            kind: "polygon",
            points: [
              { x: 0, y: 0 },
              { x: 25, y: 0 },
              { x: 10, y: 20 }
            ]
          }
        ]
      });

      expect(querySelector).toHaveBeenCalledOnce();
      expect(querySelector).toHaveBeenCalledWith('[data-overlay-channel="selection"]');
      expect(selectionChannel.replaceWith).toHaveBeenCalledOnce();
    } finally {
      document.createElementNS = createElementNS;
    }
  });

  it("allows selection outlines to scale with the map when requested", () => {
    const setAttribute = vi.fn();
    const setProperty = vi.fn();
    const createElementNS = document.createElementNS;
    document.createElementNS = vi.fn(() => ({
      append: vi.fn(),
      classList: { add: vi.fn() },
      dataset: {},
      setAttribute,
      style: { setProperty }
    })) as unknown as typeof document.createElementNS;
    const overlay = new MapInteractionOverlay();
    (overlay as unknown as { camera: MapCamera }).camera = { ...camera };
    const selectionChannel = { replaceWith: vi.fn() };
    (overlay as unknown as { root: { querySelector: () => typeof selectionChannel } }).root = {
      querySelector: () => selectionChannel
    };

    try {
      overlay.update({
        selection: [{ kind: "path", path: "M0,0", style: { strokeScaling: "map", strokeWidth: 2 } }]
      });

      expect(setAttribute).not.toHaveBeenCalledWith("vector-effect", "non-scaling-stroke");
      expect(setProperty).toHaveBeenCalledWith("stroke-width", "1.25");
    } finally {
      document.createElementNS = createElementNS;
    }
  });
});
