import { expect, test } from "vitest";
import { harvestAttributes, stylesFromMap, syncStylesFromMap } from "./styles-legacy";
import { DEFAULT_STYLES } from "./styles-schema";

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

test("syncStylesFromMap harvests the DOM but keeps store-authoritative domains", () => {
  document.body.innerHTML = `<svg id="map"><g id="rivers" fill="#123456"></g></svg>`;
  styles.labels.groups.custom = structuredClone(styles.labels.groups.capital);
  styles.relief.options.size = 0.7;
  syncStylesFromMap();
  expect(styles.rivers.attrs.fill).toBe("#123456");
  expect(styles.labels.groups.custom).toBeDefined();
  expect(styles.relief.options.size).toBe(0.7);
});

test("a schema attr the element omits harvests as an explicit null, not the seeded default", () => {
  document.body.innerHTML = `<svg id="map"><g id="rivers" opacity="0.9"></g></svg>`;
  const result = stylesFromMap(document);
  expect(DEFAULT_STYLES.rivers.attrs.fill).not.toBeNull();
  expect(result.rivers.attrs.fill).toBeNull();
  expect(result.rivers.attrs.opacity).toBe(0.9);
});

test("an omitted option still defaults, unlike a schema attr", () => {
  document.body.innerHTML = `<svg id="map"><g id="gridOverlay" stroke="#777"></g></svg>`;
  const result = stylesFromMap(document);
  expect(result.grid.options.type).toBe(DEFAULT_STYLES.grid.options.type);
});

test("syncStylesFromMap harvests burg/anchor groups present in the DOM over the live store", () => {
  document.body.innerHTML = `<svg id="map">
    <g id="burgIcons"><g id="capital" fill="#00ff00" font-size="3"></g></g>
    <g id="anchors"><g id="capital" fill="#00ff00" font-size="3"></g></g>
  </svg>`;
  styles.burgIcons.burgIcons.groups.capital.attrs.fill = "#000000";
  styles.burgIcons.burgIcons.groups.town = structuredClone(styles.burgIcons.burgIcons.groups.capital);
  syncStylesFromMap();
  expect(styles.burgIcons.burgIcons.groups.capital.attrs.fill).toBe("#00ff00");
  expect(styles.burgIcons.anchors.groups.capital.attrs.fill).toBe("#00ff00");
  expect(styles.burgIcons.burgIcons.groups.town).toBeDefined();
});

test("save sync keeps store-authoritative zoom options when the DOM lacks the attrs", () => {
  document.body.innerHTML = `<svg id="map"><g id="markers"></g><g id="regions"><g id="statesHalo"></g></g></svg>`;
  styles.markers.options.rescale = 0;
  styles.states.statesHalo.options.width = 7;
  syncStylesFromMap();
  expect(styles.markers.options.rescale).toBe(0);
  expect(styles.states.statesHalo.options.width).toBe(7);
});

test("save sync lets an old map's attrs win when present", () => {
  document.body.innerHTML = `<svg id="map"><g id="markers" rescale="1"></g><g id="regions"><g id="statesHalo" data-width="13"></g></g></svg>`;
  styles.markers.options.rescale = 0;
  syncStylesFromMap();
  expect(styles.markers.options.rescale).toBe(1);
  expect(styles.states.statesHalo.options.width).toBe(13);
});

test("save sync keeps the store's coordinates size when data-size is absent, even beside a derived font-size", () => {
  document.body.innerHTML = `<svg id="map"><g id="coordinates" font-size="6.6"></g></svg>`;
  styles.coordinates.options.fontSize = 20;
  syncStylesFromMap();
  expect(styles.coordinates.options.fontSize).toBe(20);
});

test("save sync keeps store ruler and legend sizes when data-size is absent", () => {
  document.body.innerHTML = `<svg id="map"><g id="ruler"></g><g id="legend" font-size="13" font-family="Almendra SC" data-x="88" data-columns="8"></g></svg>`;
  styles.rulers.options.fontSize = 26;
  styles.legend.options.fontSize = 17;
  styles.legend.options.x = 50;
  syncStylesFromMap();
  expect(styles.rulers.options.fontSize).toBe(26);
  expect(styles.legend.options.fontSize).toBe(17);
  // legend geometry is not in this family: the data-x attr stays authoritative
  expect(styles.legend.options.x).toBe(88);
});

test("save sync lets an old map's ruler and legend data-size win", () => {
  document.body.innerHTML = `<svg id="map"><g id="ruler" data-size="30" font-size="30"></g><g id="legend" data-size="11" font-size="11" font-family="Almendra SC"></g></svg>`;
  styles.rulers.options.fontSize = 26;
  styles.legend.options.fontSize = 17;
  syncStylesFromMap();
  expect(styles.rulers.options.fontSize).toBe(30);
  expect(styles.legend.options.fontSize).toBe(11);
});

test("save sync keeps store emblem, goods and market sizes when data-size is absent", () => {
  document.body.innerHTML = `<svg id="map"><g id="emblems"><g id="stateEmblems"></g><g id="provinceEmblems"></g><g id="burgEmblems"></g></g>
    <g id="goods"><g id="goodsIcons" data-circle="1"></g><g id="goodsBurgs"></g></g>
    <g id="markets" font-size="5" data-icon="X"></g></svg>`;
  styles.emblems.stateEmblems.options.size = 1.5;
  styles.goods.goodsIcons.options.size = 9;
  styles.goods.goodsIcons.options.circle = false;
  styles.goods.goodsBurgs.options.size = 7;
  styles.markets.options.size = 6;
  syncStylesFromMap();
  expect(styles.emblems.stateEmblems.options.size).toBe(1.5);
  expect(styles.goods.goodsIcons.options.size).toBe(9);
  expect(styles.goods.goodsBurgs.options.size).toBe(7);
  expect(styles.markets.options.size).toBe(6);
  // per-key: the siblings still harvest from their attrs
  expect(styles.goods.goodsIcons.options.circle).toBe(true);
  expect(styles.markets.options.fontSize).toBe(5);
});

test("save sync lets an old map's emblem, goods and market data-size win", () => {
  document.body.innerHTML = `<svg id="map"><g id="emblems"><g id="stateEmblems" data-size="2"></g><g id="provinceEmblems" data-size="2"></g><g id="burgEmblems" data-size="2"></g></g>
    <g id="goods"><g id="goodsIcons" data-size="4" data-circle="1"></g><g id="goodsBurgs" data-size="5"></g></g>
    <g id="markets" data-size="8" font-size="5" data-icon="X"></g></svg>`;
  styles.emblems.stateEmblems.options.size = 1;
  styles.goods.goodsIcons.options.size = 9;
  styles.goods.goodsBurgs.options.size = 7;
  styles.markets.options.size = 6;
  syncStylesFromMap();
  expect(styles.emblems.stateEmblems.options.size).toBe(2);
  expect(styles.goods.goodsIcons.options.size).toBe(4);
  expect(styles.goods.goodsBurgs.options.size).toBe(5);
  expect(styles.markets.options.size).toBe(8);
});

test("save sync lets an old map's coordinates data-size win over the store", () => {
  document.body.innerHTML = `<svg id="map"><g id="coordinates" data-size="14"></g></svg>`;
  styles.coordinates.options.fontSize = 20;
  syncStylesFromMap();
  expect(styles.coordinates.options.fontSize).toBe(14);
});
