import { expect, test, vi } from "vitest";
import { harvestAttributes, harvestStylesFromSvg, stripMigratedAttributes, stylesFromMap } from "./styles-legacy";

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
  harvestStylesFromSvg();
  expect(styles.rivers.attrs.fill).toBe("#123456");
  expect(styles.labels.groups.custom).toBeDefined();
  expect(styles.relief.options.size).toBe(0.7);
});

test("a schema attr the element omits harvests as an explicit null, not the seeded default", () => {
  document.body.innerHTML = `<svg id="map"><g id="rivers" opacity="0.9"></g></svg>`;
  const result = stylesFromMap(document);
  expect(Styles.defaults.rivers.attrs.fill).not.toBeNull();
  expect(result.rivers.attrs.fill).toBeNull();
  expect(result.rivers.attrs.opacity).toBe(0.9);
});

test("an omitted option still defaults, unlike a schema attr", () => {
  document.body.innerHTML = `<svg id="map"><g id="gridOverlay" stroke="#777"></g></svg>`;
  const result = stylesFromMap(document);
  expect(result.grid.options.type).toBe(Styles.defaults.grid.options.type);
});

test("record-less sync harvests burg/anchor groups from the DOM, size dialect included", () => {
  document.body.innerHTML = `<svg id="map">
    <g id="burgIcons"><g id="largetowns" fill="#fffff0" fill-opacity="0.7" size="0.8" stroke="#3e3e4b"></g></g>
    <g id="anchors"><g id="largetowns" fill="#fffff0" size="1.6"></g></g>
  </svg>`;
  harvestStylesFromSvg();
  // a map with no style record at all: its DOM groups are the only source of their styling
  expect(styles.burgIcons.burgIcons.groups.largetowns.attrs.fill).toBe("#fffff0");
  expect(styles.burgIcons.burgIcons.groups.largetowns.options.size).toBe(0.8);
  expect(styles.burgIcons.anchors.groups.largetowns.options.size).toBe(1.6);
  expect(styles.burgIcons.burgIcons.groups.capital).toBeDefined(); // defaults stay as fallbacks
  Styles.set(structuredClone(Styles.defaults));
});

test("a legacy style record keeps its burg/anchor groups against the DOM harvest", () => {
  document.body.innerHTML = `<svg id="map">
    <g id="burgIcons"><g id="capital" fill="#00ff00" font-size="3"></g></g>
    <g id="anchors"><g id="capital" fill="#00ff00" font-size="3"></g></g>
  </svg>`;
  styles.burgIcons.burgIcons.groups.capital.attrs.fill = "#000000";
  styles.burgIcons.burgIcons.groups.town = structuredClone(styles.burgIcons.burgIcons.groups.capital);
  harvestStylesFromSvg({ hasStyleRecord: true });
  expect(styles.burgIcons.burgIcons.groups.capital.attrs.fill).toBe("#000000");
  expect(styles.burgIcons.burgIcons.groups.town).toBeDefined();
  styles.burgIcons.burgIcons.groups.capital.attrs.fill = "#ffffff";
});

test("save sync keeps store-authoritative zoom options when the DOM lacks the attrs", () => {
  document.body.innerHTML = `<svg id="map"><g id="markers"></g><g id="regions"><g id="statesHalo"></g></g></svg>`;
  styles.markers.options.rescale = 0;
  styles.states.statesHalo.options.width = 7;
  harvestStylesFromSvg();
  expect(styles.markers.options.rescale).toBe(0);
  expect(styles.states.statesHalo.options.width).toBe(7);
});

test("save sync lets an old map's attrs win when present", () => {
  document.body.innerHTML = `<svg id="map"><g id="markers" rescale="1"></g><g id="regions"><g id="statesHalo" data-width="13"></g></g></svg>`;
  styles.markers.options.rescale = 0;
  harvestStylesFromSvg();
  expect(styles.markers.options.rescale).toBe(1);
  expect(styles.states.statesHalo.options.width).toBe(13);
});

test("save sync keeps the store's coordinates size when data-size is absent, even beside a derived font-size", () => {
  document.body.innerHTML = `<svg id="map"><g id="coordinates" font-size="6.6"></g></svg>`;
  styles.coordinates.options.fontSize = 20;
  harvestStylesFromSvg();
  expect(styles.coordinates.options.fontSize).toBe(20);
});

test("save sync keeps store ruler and legend sizes when data-size is absent", () => {
  document.body.innerHTML = `<svg id="map"><g id="ruler"></g><g id="legend" font-size="13" font-family="Almendra SC" data-x="88" data-columns="8"></g></svg>`;
  styles.rulers.options.fontSize = 26;
  styles.legend.options.fontSize = 17;
  styles.legend.options.x = 50;
  harvestStylesFromSvg();
  expect(styles.rulers.options.fontSize).toBe(26);
  expect(styles.legend.options.fontSize).toBe(17);
  // legend geometry is not in this family: the data-x attr stays authoritative
  expect(styles.legend.options.x).toBe(88);
});

test("save sync lets an old map's ruler and legend data-size win", () => {
  document.body.innerHTML = `<svg id="map"><g id="ruler" data-size="30" font-size="30"></g><g id="legend" data-size="11" font-size="11" font-family="Almendra SC"></g></svg>`;
  styles.rulers.options.fontSize = 26;
  styles.legend.options.fontSize = 17;
  harvestStylesFromSvg();
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
  harvestStylesFromSvg();
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
  harvestStylesFromSvg();
  expect(styles.emblems.stateEmblems.options.size).toBe(2);
  expect(styles.goods.goodsIcons.options.size).toBe(4);
  expect(styles.goods.goodsBurgs.options.size).toBe(5);
  expect(styles.markets.options.size).toBe(8);
});

test("save sync keeps store heightmap options when the scheme attr is absent", () => {
  document.body.innerHTML = `<svg id="map"><g id="terrs"><g id="landHeights"></g><g id="oceanHeights"></g></g></svg>`;
  styles.heightmap.landHeights.options.scheme = "#001122,#334455";
  styles.heightmap.landHeights.options.terracing = 4;
  styles.heightmap.oceanHeights.options.render = true;
  harvestStylesFromSvg();
  expect(styles.heightmap.landHeights.options.scheme).toBe("#001122,#334455");
  expect(styles.heightmap.landHeights.options.terracing).toBe(4);
  expect(styles.heightmap.oceanHeights.options.render).toBe(true);
});

test("save sync lets an old map's heightmap attrs win when scheme is present", () => {
  document.body.innerHTML = `<svg id="map"><g id="terrs"><g id="landHeights" scheme="olive" terracing="2" skip="1" relax="1" curve="curveLinear"></g><g id="oceanHeights" scheme="bright" terracing="0" skip="0" relax="0" curve="curveBasisClosed" data-render="1"></g></g></svg>`;
  styles.heightmap.landHeights.options.scheme = "monochrome";
  styles.heightmap.oceanHeights.options.render = false;
  harvestStylesFromSvg();
  expect(styles.heightmap.landHeights.options.scheme).toBe("olive");
  expect(styles.heightmap.landHeights.options.terracing).toBe(2);
  expect(styles.heightmap.oceanHeights.options.render).toBe(true);
});

test("save sync keeps store armies, grid, map-filter and auto-filter options when their marker attrs are absent", () => {
  document.body.innerHTML = `<svg id="map"><g id="armies" font-size="8"></g><g id="gridOverlay"></g><g id="sea_island"></g></svg>`;
  styles.military.options.boxSize = 4;
  styles.military.options.fontSize = 8;
  styles.grid.options.scale = 2;
  styles.map.options.dataFilter = "sepia";
  styles.coastline.sea_island.options.autoFilter = 0;
  harvestStylesFromSvg();
  expect(styles.military.options.boxSize).toBe(4);
  expect(styles.grid.options.scale).toBe(2);
  expect(styles.map.options.dataFilter).toBe("sepia");
  expect(styles.coastline.sea_island.options.autoFilter).toBe(0);
});

test("save sync lets an old map's armies, grid, map-filter and auto-filter attrs win", () => {
  document.body.innerHTML = `<svg id="map" data-filter="tint"><g id="armies" box-size="5" font-size="10"></g><g id="gridOverlay" type="square" scale="3" dx="1" dy="2"></g><g id="sea_island" auto-filter="1"></g></svg>`;
  styles.military.options.boxSize = 4;
  styles.grid.options.scale = 2;
  styles.map.options.dataFilter = null;
  styles.coastline.sea_island.options.autoFilter = 0;
  harvestStylesFromSvg();
  expect(styles.military.options.boxSize).toBe(5);
  expect(styles.grid.options).toEqual({ type: "square", scale: 3, dx: 1, dy: 2 });
  expect(styles.map.options.dataFilter).toBe("tint");
  expect(styles.coastline.sea_island.options.autoFilter).toBe(1);
});

test("save sync keeps store markets, goods-circle, texture and ocean-outline options when their attrs are absent", () => {
  document.body.innerHTML = `<svg id="map"><g id="markets"></g><g id="goods"><g id="goodsIcons"></g></g><g id="texture"></g><g id="oceanLayers"></g></svg>`;
  styles.markets.options.fontSize = 11;
  styles.markets.options.icon = "X";
  styles.goods.goodsIcons.options.circle = false;
  styles.texture.options.x = 40;
  styles.ocean.oceanLayers.options.outline = "-6,-4,-2";
  harvestStylesFromSvg();
  expect(styles.markets.options.fontSize).toBe(11);
  expect(styles.markets.options.icon).toBe("X");
  expect(styles.goods.goodsIcons.options.circle).toBe(false);
  expect(styles.texture.options.x).toBe(40);
  expect(styles.ocean.oceanLayers.options.outline).toBe("-6,-4,-2");
});

test("save sync lets an old map's markets, goods-circle, texture and ocean-outline attrs win", () => {
  document.body.innerHTML = `<svg id="map"><g id="markets" data-size="3" font-size="7" data-icon="Y"></g><g id="goods"><g id="goodsIcons" data-circle="1"></g></g><g id="texture" data-href="./t.jpg" data-x="5" data-y="6"></g><g id="oceanLayers" layers="-6"></g></svg>`;
  styles.markets.options.fontSize = 11;
  styles.goods.goodsIcons.options.circle = false;
  styles.texture.options.x = 40;
  styles.ocean.oceanLayers.options.outline = "-6,-4,-2";
  harvestStylesFromSvg();
  expect(styles.markets.options.fontSize).toBe(7);
  expect(styles.markets.options.icon).toBe("Y");
  expect(styles.goods.goodsIcons.options.circle).toBe(true);
  expect(styles.texture.options).toEqual({ href: "./t.jpg", x: 5, y: 6 });
  expect(styles.ocean.oceanLayers.options.outline).toBe("-6");
});

test("save sync keeps store scaleBar and label-shift styles when their attrs are absent", () => {
  document.body.innerHTML = `<svg id="map"><g id="scaleBar" font-size="10"><rect id="scaleBarBack" data-group="back" fill="#ffffff"></rect></g>
    <g id="labels"><g data-group="capital" font-size="6%" font-family="Almendra SC"></g></g></svg>`;
  styles.scaleBar.options.x = 50;
  styles.scaleBar.options.label = "here";
  styles.scaleBar.back.options.top = 12;
  styles.labels.groups.capital.attrs.style = "transform: translate(1.5em, 0em)";
  harvestStylesFromSvg();
  expect(styles.scaleBar.options.x).toBe(50);
  expect(styles.scaleBar.options.label).toBe("here");
  expect(styles.scaleBar.back.options.top).toBe(12);
  // labels are store-authoritative on save (step 4): the missing attr changes nothing
  expect(styles.labels.groups.capital.attrs.style).toBe("transform: translate(1.5em, 0em)");
  styles.labels.groups.capital.attrs.style = null;
});

test("save sync lets an old map's scaleBar and label-shift attrs win", () => {
  document.body.innerHTML = `<svg id="map"><g id="scaleBar" data-bar-size="2" data-x="40" data-y="41" data-label="old" font-size="10"><rect id="scaleBarBack" data-group="back" data-top="3" data-right="4" data-bottom="5" data-left="6" fill="#ffffff"></rect></g>
    <g id="labels"><g data-group="capital" data-dx="0.7" data-dy="-0.2" font-size="6%" font-family="Almendra SC"></g></g></svg>`;
  styles.scaleBar.options.x = 50;
  harvestStylesFromSvg();
  expect(styles.scaleBar.options).toEqual({ barSize: 2, x: 40, y: 41, label: "old" });
  expect(styles.scaleBar.back.options).toEqual({ top: 3, right: 4, bottom: 5, left: 6 });
  // the record-less LOAD path still harvests the label shift off an old map's attrs
  expect(stylesFromMap(document).labels.groups.capital.attrs.style).toBe("transform: translate(0.7em, -0.2em)");
});

test("save sync lets an old map's coordinates data-size win over the store", () => {
  document.body.innerHTML = `<svg id="map"><g id="coordinates" data-size="14"></g></svg>`;
  styles.coordinates.options.fontSize = 20;
  harvestStylesFromSvg();
  expect(styles.coordinates.options.fontSize).toBe(14);
});

test("an old map omitting a non-nullable attr keeps the values it does carry", () => {
  // #provs in pre-1.148 maps carries opacity alone
  document.body.innerHTML = `<svg id="map"><g id="provs" opacity="0.6"></g></svg>`;
  const result = stylesFromMap(document);
  expect(result.provinces.attrs.opacity).toBe(0.6);
  expect(result.provinces.attrs["font-family"]).toBe(Styles.defaults.provinces.attrs["font-family"]);
});

test("harvesting an old map does not emit values the schema rejects", () => {
  document.body.innerHTML = `<svg id="map"><g id="provs" opacity="0.6"></g></svg>`;
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  stylesFromMap(document);
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test("an attr the layer registry declares survives a map that predates it", () => {
  // #fogging in old maps carries no mask; the registry stamps it after the harvest runs
  document.body.innerHTML = `<svg id="map"><g id="fogging" opacity="0.98"></g></svg>`;
  harvestStylesFromSvg({ hasStyleRecord: true });
  expect(styles.fogging.attrs.mask).toBe(Styles.defaults.fogging.attrs.mask);
});

test("a child group the map predates leaves its parent's styling in place", () => {
  // pre-1.143 maps have no #sea_island: the layer group itself is styled
  document.body.innerHTML = `<svg id="map"><g id="coastline" opacity="0.5" stroke-width="0.7"></g></svg>`;
  const result = stylesFromMap(document);
  expect(Styles.defaults.coastline.sea_island.attrs["stroke-width"]).not.toBeNull();
  expect(result.coastline.sea_island.attrs["stroke-width"]).toBeNull();
  expect(result.coastline.sea_island.attrs.opacity).toBeNull();
});

test("store-format loads strip retired option attributes from the restored svg", () => {
  document.body.innerHTML = `<svg id="map">
    <g id="markers" rescale="0"></g>
    <g id="statesHalo" data-width="7"></g>
    <g id="coordinates" data-size="55"></g>
    <g id="ruler" data-size="44" font-size="44"></g>
    <g id="legend" data-size="33" data-x="11" data-y="12" data-columns="2"></g>
    <g id="markets" data-size="66" font-size="66" data-icon="Z"></g>
  </svg>`;

  stripMigratedAttributes();

  expect(document.getElementById("markers")?.getAttribute("rescale")).toBeNull();
  expect(document.getElementById("statesHalo")?.getAttribute("data-width")).toBeNull();
  expect(document.getElementById("coordinates")?.getAttribute("data-size")).toBeNull();
  expect(document.getElementById("ruler")?.getAttribute("data-size")).toBeNull();
  expect(document.getElementById("ruler")?.getAttribute("font-size")).toBeNull();
  expect(document.getElementById("legend")?.getAttribute("data-columns")).toBeNull();
  expect(document.getElementById("markets")?.getAttribute("data-icon")).toBeNull();
});

test("opacity stranded on a layer group moves to the style groups the store keeps it on", () => {
  // the old style editor wrote to the layer group itself while the layer had no groups to pick
  document.body.innerHTML = `<svg id="map">
    <g id="coastline" opacity="0.5" stroke="#1f3846"></g>
    <g id="lakes" opacity="0.7"></g>
    <g id="routes" opacity="0.4" fill="none"><g id="roads" opacity="0.9"></g></g></svg>`;
  harvestStylesFromSvg();
  expect(styles.coastline.sea_island.attrs.opacity).toBe(0.5);
  expect(styles.coastline.lake_island.attrs.opacity).toBe(0.5);
  expect(styles.lakes.freshwater.attrs.opacity).toBe(0.7);
  expect(styles.routes.groups.roads.attrs.opacity).toBe(0.4);

  stripMigratedAttributes();
  expect(document.getElementById("coastline")?.getAttribute("opacity")).toBeNull();
  expect(document.getElementById("lakes")?.getAttribute("opacity")).toBeNull();
  expect(document.getElementById("routes")?.getAttribute("fill")).toBe("none"); // not opacity, left alone
  Styles.set(structuredClone(Styles.defaults));
});
