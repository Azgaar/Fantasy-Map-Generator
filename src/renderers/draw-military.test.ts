// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import "@/generators/styles";
import type { Regiment } from "@/generators/military-generator";
import { drawMilitary, drawRegiment, moveRegiment, updateRegimentIcon } from "./draw-military";

vi.mock("@/components/icons", () => ({
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
