import { afterEach, describe, expect, it } from "vitest";
import { type Bounds, registerLayer, unregisterLayer } from "./layer_registry";
import { renderNow, scheduleRender } from "./viewport_renderer";

const svgNamespace = "http://www.w3.org/2000/svg";
const bounds: Bounds = { x0: 0, y0: 0, x1: 100, y1: 100, scale: 2 };
const registeredIds: string[] = [];
const hasSvgDom = typeof document !== "undefined" && typeof document.createElementNS === "function";

afterEach(() => {
  for (const id of registeredIds.splice(0)) unregisterLayer(id);
  document.querySelectorAll("svg[data-viewport-renderer-test]").forEach(svg => {
    svg.remove();
  });
});

describe.runIf(hasSvgDom)("viewport renderer", () => {
  it("isolates subgroups and filters items to the viewport", () => {
    createRoot("features");
    registerTestLayer({
      id: "test.visible",
      rootId: "features",
      groupId: "visible",
      enabled: () => true,
      getItems: () => [25, 125],
      inViewport: item => item <= bounds.x1,
      render: (group, items) => renderValues(group, items)
    });
    registerTestLayer({
      id: "test.sibling",
      rootId: "features",
      groupId: "sibling",
      enabled: () => true,
      getItems: () => [75],
      render: (group, items) => renderValues(group, items)
    });

    renderNow(() => bounds);

    expect(getValues("visible")).toEqual(["25"]);
    expect(getValues("sibling")).toEqual(["75"]);
  });

  it("clears a materialized group when its toggle or scale range disables it", () => {
    createRoot("scaled");
    let enabled = true;
    registerTestLayer({
      id: "test.scaled",
      rootId: "scaled",
      groupId: "items",
      enabled: () => enabled,
      scaleMin: 2,
      scaleMax: 4,
      getItems: () => [1],
      render: (group, items) => renderValues(group, items)
    });

    renderNow(() => bounds);
    expect(getValues("items")).toEqual(["1"]);

    enabled = false;
    renderNow(() => bounds);
    expect(getValues("items")).toEqual([]);

    enabled = true;
    renderNow(() => ({ ...bounds, scale: 1.99 }));
    expect(getValues("items")).toEqual([]);
  });

  it("coalesces repeated camera updates into one animation frame", async () => {
    createRoot("batched");
    let renders = 0;
    registerTestLayer({
      id: "test.batched",
      rootId: "batched",
      groupId: "items",
      enabled: () => true,
      getItems: () => [1],
      render: group => {
        renders++;
        group.dataset.scale = String(bounds.scale);
      }
    });

    scheduleRender(() => ({ ...bounds, scale: 1 }));
    scheduleRender(() => ({ ...bounds, scale: 1.5 }));
    scheduleRender(() => bounds);
    await nextPaint();

    expect(renders).toBe(1);
    expect(document.getElementById("items")?.dataset.scale).toBe("2");
  });

  it("skips missing roots without throwing", () => {
    registerTestLayer({
      id: "test.missing",
      rootId: "missing",
      groupId: "items",
      enabled: () => true,
      getItems: () => [1],
      render: () => {
        throw new Error("render should not run");
      }
    });

    expect(() => renderNow(() => bounds)).not.toThrow();
  });
});

function registerTestLayer<T>(entry: Parameters<typeof registerLayer<T>>[0]): void {
  registeredIds.push(entry.id);
  registerLayer(entry);
}

function createRoot(id: string): void {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.dataset.viewportRendererTest = "";
  const root = document.createElementNS(svgNamespace, "g");
  root.id = id;
  svg.appendChild(root);
  document.body.appendChild(svg);
}

function renderValues(group: SVGGElement, values: number[]): void {
  group.replaceChildren(
    ...values.map(value => {
      const element = document.createElementNS(svgNamespace, "use");
      element.dataset.value = String(value);
      return element;
    })
  );
}

function getValues(groupId: string): string[] {
  return Array.from(document.querySelectorAll(`#${groupId} > use`)).map(
    element => (element as SVGUseElement).dataset.value!
  );
}

function nextPaint(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
