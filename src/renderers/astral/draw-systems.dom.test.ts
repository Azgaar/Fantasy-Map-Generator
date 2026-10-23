// Browser-mode test (vitest.browser.config.ts): drawSystems draws one class-coloured marker per
// live burg, styles each class group from its record, and culls to the viewport bounds.
import { beforeEach, expect, test } from "vitest";
import { Layers } from "@/components/layers";
import "@/components/options-model"; // installs the options global
import "@/generators/styles";
import "@/services/logging"; // installs the TIME/INFO globals the renderers gate their timers on
import { drawSystems } from "./draw-systems";

beforeEach(() => {
  document.body.innerHTML = `<svg id="map"><g id="viewbox"><g id="systems" data-layer="systems"></g></g></svg>`;
  globalThis.pack = {
    burgs: [
      0,
      { i: 1, name: "Gant", x: 10, y: 10, population: 2_000_000, capital: true, port: 1 },
      { i: 2, name: "Fallen", x: 20, y: 20, population: 500, removed: true },
      { i: 3, name: "Kess", x: 30, y: 40, population: 500 },
      { i: 4, name: "Far", x: 500, y: 500, population: 500 }
    ]
  } as unknown as typeof pack;
  options.map.units.population = { scale: 1, urbanization: { rate: 1 } } as typeof options.map.units.population;
  styles.systems.options.glow = true;
  Layers.show("systems"); // the reconcile only draws for an active layer
});

const root = () => document.getElementById("systems")!;
const markers = () => root().querySelectorAll("[data-id]");
const draw = () => drawSystems();

test("draws one marker per live burg into its class group", () => {
  draw();
  expect(root().querySelectorAll("[data-group]").length).toBe(6); // one group per spectral class
  expect(markers().length).toBe(2); // the removed burg draws nothing and the far one is culled
  expect(root().querySelector('[data-group="G"] #system1')).not.toBeNull();
  expect(root().querySelector('[data-group="M"] #system3')).not.toBeNull();
  expect(document.getElementById("system2")).toBeNull();
});

test("styles each class group from its record", () => {
  draw();
  const group = root().querySelector<SVGGElement>('[data-group="G"]')!;
  expect(group.getAttribute("fill")).toBe(styles.systems.groups.G.attrs.fill);
  expect(group.getAttribute("font-size")).toBe(`${styles.systems.groups.G.options.size}%`);
});

test("a capital wears a ring and a port an orbit tick", () => {
  draw();
  const capital = document.querySelector("#system1 circle.capital")!;
  expect(capital.getAttribute("fill")).toBe("none");
  expect(document.querySelector("#system1 circle.port")).not.toBeNull();
  expect(document.querySelector("#system3 circle.capital")).toBeNull();
  expect(document.querySelector("#system3 circle.port")).toBeNull();
});

test("the glow draws a halo, and the flag turns it off", () => {
  draw();
  expect(document.querySelectorAll("#system1 .glow").length).toBe(1);
  styles.systems.options.glow = false;
  draw();
  expect(root().querySelector(".glow")).toBeNull();
});

test("culls markers outside the viewport bounds", () => {
  draw();
  expect(document.getElementById("system4")).toBeNull();
});

test("replaces instead of appends on a second draw", () => {
  draw();
  const first = markers().length;
  draw();
  expect(markers().length).toBe(first);
});

test("the registry erase clears the markers with the layer", () => {
  Layers.hide("systems");
  Layers.show("systems"); // off → on draws the markers through the registry
  expect(markers().length).toBeGreaterThan(0);
  Layers.hide("systems");
  expect(markers().length).toBe(0);
});
