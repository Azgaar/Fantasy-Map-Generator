import { describe, expect, it, vi } from "vitest";
import { materializeSvgCompatibilityLayers, type SvgFallbackElement } from "./svg-fallback-materializer";

const createRoot = (entries: Record<string, string>) => {
  const elements = new Map<string, SvgFallbackElement>(
    Object.entries(entries).map(([selector, innerHTML]) => [selector, { innerHTML }])
  );
  return { elements, querySelector: (selector: string) => elements.get(selector) ?? null };
};

describe("SVG fallback materialization", () => {
  it("restores exact live-layer contents and ends ownership suspension once", () => {
    const root = createRoot({ "#states": "", "#terrain": "<use data-hidden='true'/>" });
    const beforeMaterialize = vi.fn();
    const stopMaterializing = vi.fn();
    const afterRestore = vi.fn();
    const restore = materializeSvgCompatibilityLayers({
      afterRestore,
      beforeMaterialize,
      draw: () => {
        root.elements.get("#states")!.innerHTML = "<path/>";
        root.elements.get("#terrain")!.innerHTML = "<use data-export='true'/>";
      },
      root,
      selectors: ["#states", "#terrain", "#missing"],
      stopMaterializing
    });

    expect(beforeMaterialize).toHaveBeenCalledOnce();
    expect(root.elements.get("#states")?.innerHTML).toBe("<path/>");
    restore();
    restore();

    expect(root.elements.get("#states")?.innerHTML).toBe("");
    expect(root.elements.get("#terrain")?.innerHTML).toBe("<use data-hidden='true'/>");
    expect(stopMaterializing).toHaveBeenCalledOnce();
    expect(afterRestore).toHaveBeenCalledOnce();
  });

  it("always releases ownership suspension when compatibility drawing fails", () => {
    const stopMaterializing = vi.fn();
    expect(() =>
      materializeSvgCompatibilityLayers({
        draw: () => {
          throw new Error("export failed");
        },
        root: createRoot({}),
        selectors: [],
        stopMaterializing
      })
    ).toThrow("export failed");
    expect(stopMaterializing).toHaveBeenCalledOnce();
  });
});
