// Browser-mode test (vitest.browser.config.ts): burg icon groups are recreated from the store;
// stale DOM attrs (the old editor-writes-DOM model) must not harvest back over store edits.
import { beforeEach, expect, test } from "vitest";
import "@/generators/styles";
import { drawBurgIcons } from "./draw-burg-icons";

beforeEach(() => {
  (globalThis as Record<string, unknown>).TIME = false;
  document.body.innerHTML = `<svg id="map">
      <g id="icons"><g id="burgIcons"></g><g id="anchors"></g></svg>
    </svg>`;
  globalThis.pack = { burgs: [{}, { i: 1, group: "town", x: 10, y: 10 }] } as never;
  globalThis.options = { ...globalThis.options, burgs: { groups: [{ name: "town", order: 0 }] } } as never;
});

test("drawBurgIcons styles groups from the store, ignoring stale DOM attrs", () => {
  styles.burgIcons.burgIcons.groups.town.attrs.fill = "#123456";
  styles.burgIcons.burgIcons.groups.town.options.size = 3;

  drawBurgIcons();
  const first = document.querySelector<SVGGElement>("#burgIcons > g#town")!;
  expect(first.getAttribute("fill")).toBe("#123456");

  // simulate the retired editor-writes-DOM model leaving a stale value
  first.setAttribute("fill", "#ff0000");
  styles.burgIcons.burgIcons.groups.town.attrs.fill = "#123456";

  drawBurgIcons();
  const redrawn = document.querySelector<SVGGElement>("#burgIcons > g#town")!;
  expect(redrawn.getAttribute("fill")).toBe("#123456");
  expect(styles.burgIcons.burgIcons.groups.town.attrs.fill).toBe("#123456");
  expect(redrawn.getAttribute("font-size")).toBe("3");
});
