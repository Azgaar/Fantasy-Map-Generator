// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import "@/model/styles/styles";
import type { Regiment } from "@/model/political/military-generator";
import { drawMilitary, drawRegiment, moveRegiment, updateRegimentIcon } from "./draw-military";

vi.mock("@/model/icons", () => ({
  Icons: { href: (id: string) => `#${id}`, kind: (id: string) => (id.startsWith("glyph-") ? "glyph" : "set") }
}));

beforeEach(() => {
  document.body.innerHTML = '<svg><g id="armies"></g></svg>';
  styles.military.options.boxSize = 5;
  globalThis.pack = { states: [{ i: 0 }, { i: 1, color: "#888888", military: [] }] } as never;
});

test("changing the selected icon updates its frame as well as its reference", () => {
  const regiment = { i: 1, state: 1, icon: "glyph-2694-fe0f", x: 50, y: 50, n: 0, a: 10 } as Regiment;
  drawRegiment(regiment, 1);
  const use = document.querySelector<SVGUseElement>("use.regimentIcon")!;
  for (const [icon, box] of [
    ["custom-image", [25, 45, 10, 10]],
    ["glyph-2694-fe0f", [26, 46, 8, 8]]
  ] as const) {
    regiment.icon = icon;
    updateRegimentIcon(use, regiment);
    expect(use.getAttribute("href")).toBe(`#${icon}`);
    expect(["x", "y", "width", "height"].map(name => Number(use.getAttribute(name)))).toEqual(box);
  }
});

test.each(["custom-image", "glyph-2694-fe0f"])(
  "%s keeps its size on bulk draw, single draw and movement",
  async icon => {
    const regiment = { i: 1, state: 1, icon, x: 50, y: 50, n: 0, a: 10 } as Regiment;
    pack.states[1].military = [regiment];
    drawMilitary();
    const check = (x: number, y: number) => {
      const box = icon.startsWith("glyph-") ? [x - 24, y - 4, 8, 8] : [x - 25, y - 5, 10, 10];
      const use = document.querySelector("use.regimentIcon")!;
      expect(["x", "y", "width", "height"].map(name => Number(use.getAttribute(name)))).toEqual(box);
    };
    check(50, 50);
    document.getElementById("armies")!.replaceChildren();
    drawRegiment(regiment, 1);
    check(50, 50);
    moveRegiment(regiment, 51, 51);
    await vi.waitFor(() => check(51, 51));
  }
);

test("keeps regiment counter compact and places regiment name as label below unit when showNames is enabled", () => {
  styles.military.options.showNames = true;
  const regiment = {
    i: 1,
    state: 1,
    name: "1st Royal Army",
    icon: "custom-image",
    x: 100,
    y: 100,
    n: 0,
    a: 10,
    u: {}
  } as Regiment;
  drawRegiment(regiment, 1);

  const rects = document.querySelectorAll<SVGRectElement>("#armies g rect");
  const baseRect = rects[0];
  const iconRect = rects[1];
  const use = document.querySelector<SVGUseElement>("use.regimentIcon")!;
  const totalText = document.querySelector<SVGTextElement>("#armies g text.regimentTotal")!;
  const nameText = document.querySelector<SVGTextElement>("#armies g text.regimentName")!;

  // Counter remains compact: land unit width is size * 6 = 30
  expect(Number(baseRect.getAttribute("width"))).toBe(30);
  expect(totalText.textContent).toBe("10");

  // Name is placed below the counter
  expect(nameText.textContent).toBe("1st Royal Army");
  expect(Number(nameText.getAttribute("y"))).toBeGreaterThan(
    Number(baseRect.getAttribute("y")) + Number(baseRect.getAttribute("height"))
  );

  const baseX = Number(baseRect.getAttribute("x"));
  const iconBoxX = Number(iconRect.getAttribute("x"));
  const iconX = Number(use.getAttribute("x"));
  const iconW = Number(use.getAttribute("width"));

  // Icon rect is strictly to the left of base rect
  expect(iconBoxX + Number(iconRect.getAttribute("width"))).toBeCloseTo(baseX, 1);
  // Icon use element is inside the icon rect, to the left of the base text rect
  expect(iconX + iconW).toBeLessThanOrEqual(baseX);
});
