import { describe, expect, it } from "vitest";
import { MAP_LAYER_REGISTRY, validateLayerRegistry } from "./layer-registry";
import { RendererCoordinator } from "./renderer-coordinator";

describe("map layer registry", () => {
  it("has stable unique ordering and resolvable dependencies", () => {
    expect(() => validateLayerRegistry(MAP_LAYER_REGISTRY)).not.toThrow();
    const orders = MAP_LAYER_REGISTRY.map(layer => layer.order);
    expect(orders).toEqual([...orders].sort((left, right) => left - right));
  });

  it("rejects duplicate ids, duplicate orders, and missing dependencies", () => {
    expect(() =>
      validateLayerRegistry([
        { dependencies: [], id: "states", order: 1, persistent: true },
        { dependencies: [], id: "states", order: 2, persistent: true }
      ])
    ).toThrow("Duplicate map layer id");
    expect(() =>
      validateLayerRegistry([
        { dependencies: [], id: "states", order: 1, persistent: true },
        { dependencies: [], id: "biomes", order: 1, persistent: true }
      ])
    ).toThrow("Duplicate map layer order");
    expect(() =>
      validateLayerRegistry([{ dependencies: ["landmass"], id: "states", order: 1, persistent: true }])
    ).toThrow("Unknown dependency");
  });
});

describe("RendererCoordinator", () => {
  it("keeps exactly one owner per layer and preserves canonical order", () => {
    const coordinator = new RendererCoordinator(MAP_LAYER_REGISTRY);
    coordinator.setOwner("states", "pixi");

    expect(coordinator.isOwnedBy("states", "pixi")).toBe(true);
    expect(coordinator.isOwnedBy("states", "svg")).toBe(false);
    expect(coordinator.getLayers().map(layer => layer.order)).toEqual(MAP_LAYER_REGISTRY.map(layer => layer.order));
  });

  it("resolves dependency visibility without changing stored visibility", () => {
    const coordinator = new RendererCoordinator(MAP_LAYER_REGISTRY);
    coordinator.setVisibility("states", true);
    coordinator.setVisibility("landmass", false);

    expect(coordinator.getLayer("states").visible).toBe(true);
    expect(coordinator.isVisible("states")).toBe(false);
    coordinator.setVisibility("landmass", true);
    expect(coordinator.isVisible("states")).toBe(true);
  });
});
