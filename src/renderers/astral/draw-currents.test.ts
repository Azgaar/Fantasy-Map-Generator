// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ astral: true, subscribed: [] as (() => void)[] }));
vi.mock("@/components/options/astral-view", () => ({
  subscribeAstralView: (listener: () => void) => {
    mocks.subscribed.push(listener);
    return () => {};
  }
}));
vi.mock("@/components/options/view-mode", () => ({
  isAstralView: () => mocks.astral
}));

import { drawCurrents } from "./draw-currents";

const CURRENTS_STYLE = {
  groups: {
    currents: {
      attrs: {
        opacity: 0.7,
        stroke: "#ffd166",
        "stroke-opacity": null,
        "stroke-width": 1,
        "stroke-dasharray": "16 6",
        "stroke-linecap": "round",
        "stroke-linejoin": null,
        filter: null,
        mask: null
      }
    }
  }
};

function river(i: number, discharge: number, cells: number[] = [1, 2, 3]): unknown {
  return { i, discharge, cells, points: null, widthFactor: 1, sourceWidth: 0.1 };
}

beforeEach(() => {
  mocks.astral = true;
  document.body.innerHTML = '<svg id="map"><g id="routes"></g></svg>';
  globalThis.pack = {
    rivers: [river(1, 10), river(2, 1000), river(3, 500)],
    cells: { p: [[], [10, 10], [20, 20], [30, 30]] }
  } as never;
  globalThis.styles = { routes: CURRENTS_STYLE } as unknown as typeof styles;
  globalThis.Rivers = {
    getRiverPoints: (cells: number[], points?: [number, number][] | null) =>
      points ??
      cells.map(cell =>
        cell === -1 ? [999, 999] : (globalThis.pack as never as { cells: { p: [number, number][] } }).cells.p[cell]
      )
  } as never;
});

test("draws one path per river, styles the group and spreads widths by discharge", () => {
  drawCurrents();

  const group = document.getElementById("currents")!;
  expect(group.dataset.group).toBe("currents");
  expect(group.parentElement?.id).toBe("routes");
  expect(group.querySelectorAll("path").length).toBe(3);
  expect(group.getAttribute("stroke")).toBe("#ffd166");
  expect(document.getElementById("current1")?.getAttribute("d")).toBe("M10 10L20 20L30 30");

  const narrow = Number(document.getElementById("current1")!.getAttribute("stroke-width"));
  const broad = Number(document.getElementById("current2")!.getAttribute("stroke-width"));
  expect(broad).toBeGreaterThan(narrow); // discharge 1000 reads wider than discharge 10
});

test("a second draw replaces the paths instead of appending", () => {
  drawCurrents();
  const group = document.getElementById("currents")!;
  const drawn = group.innerHTML;

  drawCurrents();
  expect(group.innerHTML).toBe(drawn);
  expect(group.querySelectorAll("path").length).toBe(3);
});

test("a single-cell river draws no path and an empty map throws nothing", () => {
  (globalThis.pack as never as { rivers: unknown[] }).rivers = [river(9, 100, [5])];
  drawCurrents();
  expect(document.getElementById("currents")!.childElementCount).toBe(0);

  (globalThis.pack as never as { rivers: unknown[] }).rivers = [];
  expect(() => drawCurrents()).not.toThrow();
  expect(document.getElementById("currents")!.childElementCount).toBe(0);
});

test("draws with or without a currents style group", () => {
  (globalThis.styles as never as { routes: { groups: Record<string, unknown> } }).routes.groups = {};
  drawCurrents();

  const group = document.getElementById("currents")!;
  expect(group.querySelectorAll("path").length).toBe(3);
  expect(group.hasAttribute("stroke")).toBe(false); // nothing to mirror yet
  const width = Number(group.querySelector("path")!.getAttribute("stroke-width"));
  expect(Number.isFinite(width)).toBe(true); // the ladder falls back to a scale of 1
});

test("leaving Astral drops the node and standard draws never create one", () => {
  drawCurrents();
  expect(document.getElementById("currents")).not.toBeNull();

  mocks.astral = false;
  drawCurrents();
  expect(document.getElementById("currents")).toBeNull();

  drawCurrents();
  expect(document.getElementById("currents")).toBeNull();
});

test("subscribes to the mode so entering and leaving redraw the group", () => {
  expect(mocks.subscribed).toContain(drawCurrents);
});
