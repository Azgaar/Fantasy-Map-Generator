// Browser-mode tests (vitest.browser.config.ts) for stylesFromMap/harvestAttributes: harvesting
// legacy-shaped style bags off a live SVG, through the same PRESET_ROUTES/schema presetFromLegacy uses.
import { expect, test } from "vitest";
import { harvestAttributes, stylesFromMap } from "./styles-legacy";

test("harvestAttributes derives from routes and schema", () => {
  const table = harvestAttributes();
  expect(table["#rivers"]).toEqual(expect.arrayContaining(["opacity", "fill", "filter"]));
  expect(table["#gridOverlay"]).toEqual(expect.arrayContaining(["stroke", "type", "scale", "dx", "dy"]));
  expect(table["#vignette-rect"]).not.toEqual(expect.arrayContaining(["fill"]));
});

test("stylesFromMap harvests attrs, options and dynamic groups with legacy precedence", () => {
  document.body.innerHTML = `<svg id="map">
    <g id="rivers" fill="#5d97bb" opacity="0.9"></g>
    <g id="gridOverlay" stroke="#777" type="pointyHex"></g>
    <g id="labels"><g id="labels-state" data-group="state" font-size="22" data-size="22"></g></g>
    <g id="burgIcons"><g id="capital" fill="#ffffff" font-size="2"></g></g>
  </svg>`;
  const styles = stylesFromMap(document);
  expect(styles.rivers.attrs.fill).toBe("#5d97bb");
  expect(styles.rivers.attrs.opacity).toBe(0.9);
  expect(styles.grid.options.type).toBe("pointyHex");
  expect(styles.labels.groups.state.attrs["font-size"]).toBe("22");
  expect(styles.burgIcons.burgIcons.groups.capital.options.size).toBe(2);
});

test("inline style wins over the attribute; empty attribute still counts", () => {
  document.body.innerHTML = `<svg id="map"><g id="rivers" fill="#aaa" style="fill: #bbb"></g>
    <g id="scaleBar" data-label=""></g></svg>`;
  const styles = stylesFromMap(document);
  // real browsers normalize an inline color declaration to rgb(); the fixture is real DOM
  // (browser test mode), so we pin to that rather than the literal "#bbb" spelling
  expect(styles.rivers.attrs.fill).toBe("rgb(187, 187, 187)");
  expect(styles.scaleBar.options.label).toBe("");
});
