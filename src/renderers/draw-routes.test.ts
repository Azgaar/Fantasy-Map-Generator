// @vitest-environment jsdom
import { beforeEach, expect, test } from "vitest";
import "@/generators/styles";
import { drawRoute, drawRoutes } from "./draw-routes";

beforeEach(() => {
  (globalThis as Record<string, unknown>).TIME = false;
  (globalThis as { CSS?: unknown }).CSS ??= { escape: (value: string) => value }; // jsdom has no CSS.escape
  document.body.innerHTML = `<svg id="map"><g id="routes" data-layer="routes"><g id="roads" data-group="roads"></g><g id="trails" data-group="trails"></g></g></svg>`;
  globalThis.Routes = { getPath: () => "M0,0L10,10" } as never;
  globalThis.pack = {
    routes: [
      {
        i: 1,
        group: "roads",
        type: "royal",
        points: [
          [0, 0, 1],
          [10, 10, 2]
        ]
      },
      {
        i: 2,
        group: "trails",
        type: "footpath",
        points: [
          [0, 0, 1],
          [10, 10, 2]
        ]
      }
    ]
  } as never;
});

test("type sub-groups take their line style from the store, marked for Styles.write", () => {
  styles.routes.types.royal.attrs["stroke-width"] = 3.5;
  styles.routes.types.royal.attrs["stroke-dasharray"] = "9 1";
  drawRoutes();

  const royal = document.querySelector<SVGGElement>("#routes > #roads > g#royal")!;
  expect(royal.dataset.type).toBe("royal");
  expect(royal.getAttribute("stroke-width")).toBe("3.5");
  expect(royal.getAttribute("stroke-dasharray")).toBe("9 1");
  expect(royal.hasAttribute("stroke")).toBe(false); // inherits the group's colour
  expect(document.querySelector("#routes > #trails > g#footpath")?.getAttribute("stroke-linecap")).toBe("round");

  styles.routes.types.royal.attrs["stroke-width"] = 1;
  Styles.write("routes");
  expect(royal.getAttribute("stroke-width")).toBe("1");
});

test("a type the store does not know falls back to the built-in table, then the group", () => {
  pack.routes.push({
    i: 3,
    group: "roads",
    type: "mystery",
    points: [
      [0, 0, 1],
      [10, 10, 2]
    ]
  } as never);
  drawRoutes();
  const mystery = document.querySelector<SVGGElement>("#routes > #roads > g#mystery")!;
  expect(mystery.hasAttribute("stroke-width")).toBe(false);

  drawRoute({
    i: 4,
    group: "roads",
    type: "royal",
    points: [
      [0, 0, 1],
      [10, 10, 2]
    ]
  } as never);
  expect(document.querySelectorAll("#routes > #roads > g#royal > path")).toHaveLength(2);
});
