import { test, expect, type Page } from "@playwright/test";
import { countMaps, waitForMap, waitForNextMap } from "./wait-for-map";

declare const options: {
  map: {
    burgs: { groups: { name: string; isDefault?: boolean; active?: boolean; features?: Record<string, boolean>; preview?: string }[] };
    labels: { groups: { name: string; type: string; zoom: { min: number; max: number | null } }[] };
  };
};
declare const regeneratePrompt: (config?: { seed?: string }) => void;

// Real-control regression for the schema-driven style editor (src/controllers/style-editor): every
// control reads/writes the store (src/generators/styles.ts) instead of DOM attributes, and
// invokeActiveZooming() re-derives the rendered value from the store on every zoom settle. Each case
// drives the actual control with a real DOM event and checks: (1) the immediate effect, (2) the typed
// store value, (3) survival across invokeActiveZooming() at a changed zoom, (4) the retired attribute
// is gone from the element.

const rn = (v: number, d = 0): number => Math.round(v * 10 ** d) / 10 ** d;

// a row of the rendered form, addressed by its store path relative to the selected element
const f = (path: string): string => `#styleForm [data-field="${path}"]`;

async function openStyleElement(page: Page, element: string): Promise<void> {
  await page.evaluate(() => (window as any).showOptions());
  await page.locator("#styleTab").click();
  await page.locator("#styleElementSelect").selectOption(element);
  await page.locator("#styleForm .row").first().waitFor({ state: "attached" }); // a gated card may hide its rows
}

async function currentScale(page: Page): Promise<number> {
  const transform = await page.locator("#viewbox").getAttribute("transform");
  const match = transform?.match(/scale\(([^)]+)\)/);
  return match ? parseFloat(match[1]) : 1;
}

test.describe("style editor events drive the store", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?seed=style-editor-events&width=1280&height=720");
    await waitForMap(page);
    await page.waitForSelector("#burgIcons > g", { state: "attached", timeout: 60000 });
    await page.waitForSelector("#labels > g", { state: "attached", timeout: 60000 });
    await page.waitForTimeout(500);
  });

  test("markers are sized in em, so the layer font size scales them with the zoom", async ({ page }) => {
    // deterministic marker: don't depend on the generator having placed one for this seed. The
    // markers layer is off by default, so turn it on through the real registry API. It sits at the
    // map centre, which the viewport renderer keeps drawn at every zoom level this test uses
    const markerId = await page.evaluate(() => {
      const i = (window as any).pack.markers.length;
      (window as any).pack.markers.push({
        i,
        icon: "X",
        x: (window as any).options.map.graph.width / 2,
        y: (window as any).options.map.graph.height / 2,
        cell: 0
      });
      (window as any).Layers.show("markers");
      return i;
    });

    const marker = page.locator(`#marker${markerId}`);
    await expect(marker).toHaveAttribute("width", "0.3em");
    const before = await marker.evaluate(el => el.getBoundingClientRect().width);

    await page.evaluate(() => (window as any).setMapZoom(4));
    await page.waitForTimeout(50);
    await page.evaluate(() => (window as any).invokeActiveZooming());
    await expect(page.locator("#markers")).toHaveAttribute("font-size", "50px"); // 100 / sqrt(4)
    const after = await marker.evaluate(el => el.getBoundingClientRect().width);
    expect(after / before).toBeCloseTo(4 * 0.5, 1); // the map scaled 4x, the em 0.5x

    expect(await page.locator("#markers").getAttribute("rescale")).toBeNull();
  });

  test("states halo width slider writes the store and re-derives stroke-width on zoom", async ({ page }) => {
    // invokeActiveZooming only re-derives the halo width when the halos are on, which the default
    // "balance" preset leaves off - switch to "quality" through the real Options tab
    await page.evaluate(() => (window as any).showOptions());
    await page.locator("#optionsTab").click();
    await page.locator("#performancePreset").selectOption("quality");

    await openStyleElement(page, "states");

    const numberInput = page.locator(`${f("groups.statesHalo.attrs.stroke-width")} input[type=number]`);
    await expect(numberInput).toHaveValue("10");

    // real control: type into the number half of <slider-input>, which re-dispatches a real
    // "input" CustomEvent on the host element the form listens for
    await numberInput.fill("5");

    // (1) immediate effect: the zoom re-derives the halo width from the store base at the current scale
    await expect(page.locator("#statesHalo")).toHaveAttribute("stroke-width", /^\d/);

    // (2) typed store value
    const storeWidth = await page.evaluate(() => (window as any).styles.states.groups.statesHalo.attrs["stroke-width"]);
    expect(storeWidth).toBe(5);
    expect(typeof storeWidth).toBe("number");

    // (3) survival across invokeActiveZooming() at a changed zoom: re-derived from the store
    // base (5), not from the stroke-width attribute the handler just wrote
    await page.evaluate(() => (window as any).setMapZoom(4));
    await page.waitForTimeout(50);
    await page.evaluate(() => (window as any).invokeActiveZooming());

    const scale = await currentScale(page);
    const expected = String(rn(5 / scale ** 0.8, 2));
    await expect(page.locator("#statesHalo")).toHaveAttribute("stroke-width", expected);

    // (4) the retired attribute never lands on the element
    expect(await page.locator("#statesHalo").getAttribute("data-width")).toBeNull();
  });

  test("coordinates size input writes the store and the renderer derives from it", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("coordinates"));
    await openStyleElement(page, "coordinates");

    await page.locator(`${f("attrs.font-size")} input[type=number]`).fill("24");

    // (2) typed store value
    const stored = await page.evaluate(() => (window as any).styles.coordinates.attrs["font-size"]);
    expect(stored).toBe("24px");

    // (1)+(3) rendered size re-derived from the store base on redraw at a changed zoom
    await page.evaluate(() => (window as any).setMapZoom(4));
    await page.waitForTimeout(50);
    await page.evaluate(() => (window as any).Layers.draw("coordinates"));
    const scale = await currentScale(page);
    const fontSize = await page.locator("#coordinates").getAttribute("font-size");
    expect(parseFloat(fontSize!)).toBeCloseTo(rn(24 / scale ** 0.8, 2), 1);

    // (4) the retired attribute is gone from the element
    expect(await page.locator("#coordinates").getAttribute("data-size")).toBeNull();
  });

  test("ruler size input writes the store and sizes drawn rulers", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).Measurers.createDefaultRuler();
      (window as any).Layers.show("rulers");
    });
    await openStyleElement(page, "rulers");

    await page.locator(`${f("attrs.font-size")} input[type=number]`).fill("26");

    const stored = await page.evaluate(() => (window as any).styles.rulers.attrs["font-size"]);
    expect(stored).toBe("26px");

    // the rulers size by inheritance from the layer
    await expect(page.locator("#ruler")).toHaveAttribute("font-size", "26px");
    expect(await page.locator("#ruler > .ruler").first().getAttribute("font-size")).toBeNull();
    expect(await page.locator("#ruler").getAttribute("data-size")).toBeNull();
  });

  test("legend size input writes the store", async ({ page }) => {
    await openStyleElement(page, "legend");

    await page.locator(`${f("attrs.font-size")} input[type=number]`).fill("17");

    const stored = await page.evaluate(() => (window as any).styles.legend.attrs["font-size"]);
    expect(stored).toBe("17px");
    await expect(page.locator("#legend")).toHaveAttribute("font-size", "17px");

    expect(await page.locator("#legend").getAttribute("data-size")).toBeNull();
  });

  test("emblem size inputs write the store per group", async ({ page }) => {
    await openStyleElement(page, "emblems");

    for (const [input, value] of [
      [f("groups.stateEmblems.options.size"), "1.5"],
      [f("groups.provinceEmblems.options.size"), "0.5"],
      [f("groups.burgEmblems.options.size"), "2"]
    ] as const) {
      await page.locator(`${input} input[type=number]`).fill(value);
    }

    const stored = await page.evaluate(() => ({
      state: (window as any).styles.emblems.groups.stateEmblems.options.size,
      province: (window as any).styles.emblems.groups.provinceEmblems.options.size,
      burg: (window as any).styles.emblems.groups.burgEmblems.options.size
    }));
    expect(stored).toEqual({ state: 1.5, province: 0.5, burg: 2 });

    for (const id of ["#stateEmblems", "#provinceEmblems", "#burgEmblems"]) {
      expect(await page.locator(id).getAttribute("data-size")).toBeNull();
    }
  });

  test("goods size inputs write the store and size the drawn icons", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("goods"));
    await openStyleElement(page, "goods");

    await page.locator(`${f("groups.goodsIcons.options.size")} input[type=number]`).fill("9");
    await page.locator(`${f("groups.goodsBurgs.options.size")} input[type=number]`).fill("7");

    const stored = await page.evaluate(() => ({
      icons: (window as any).styles.goods.groups.goodsIcons.options.size,
      burgs: (window as any).styles.goods.groups.goodsBurgs.options.size
    }));
    expect(stored).toEqual({ icons: 9, burgs: 7 });

    expect(await page.locator("#goodsIcons").getAttribute("data-size")).toBeNull();
    expect(await page.locator("#goodsBurgs").getAttribute("data-size")).toBeNull();
  });

  test("markets size input writes the store and sizes the drawn plates", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("markets"));
    await openStyleElement(page, "markets");

    await page.locator(`${f("options.size")} input[type=number]`).fill("6");

    const stored = await page.evaluate(() => (window as any).styles.markets.options.size);
    expect(stored).toBe(6);
    expect(typeof stored).toBe("number");

    // the whole markets option family is off the DOM now
    for (const attr of ["data-size", "font-size", "data-icon"]) {
      expect(await page.locator("#markets").getAttribute(attr), attr).toBeNull();
    }
  });

  test("heightmap controls write the store per group and the renderer derives from it", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("heightmap"));
    await openStyleElement(page, "heightmap");

    // ocean subsection: the render-ocean gate in its header, then scheme select and terracing slider
    await page.locator(`${f("groups.oceanHeights.options.render")} label.checkbox-label`).click();
    await page.locator(`${f("groups.oceanHeights.options.scheme")} select`).selectOption("monochrome");
    await page.locator(`${f("groups.oceanHeights.options.terracing")} input[type=number]`).fill("3");

    // land subsection: skip, relax, curve
    await page.locator(`${f("groups.landHeights.options.skip")} input[type=number]`).fill("2");
    await page.locator(`${f("groups.landHeights.options.relax")} input[type=number]`).fill("1");
    await page.locator(`${f("groups.landHeights.options.curve")} select`).selectOption("curveLinear");

    const stored = await page.evaluate(() => ({
      oceanScheme: (window as any).styles.heightmap.groups.oceanHeights.options.scheme,
      oceanTerracing: (window as any).styles.heightmap.groups.oceanHeights.options.terracing,
      oceanRender: (window as any).styles.heightmap.groups.oceanHeights.options.render,
      landSkip: (window as any).styles.heightmap.groups.landHeights.options.skip,
      landRelax: (window as any).styles.heightmap.groups.landHeights.options.relax,
      landCurve: (window as any).styles.heightmap.groups.landHeights.options.curve
    }));
    expect(stored).toEqual({
      oceanScheme: "monochrome",
      oceanTerracing: 3,
      oceanRender: true,
      landSkip: 2,
      landRelax: 1,
      landCurve: "curveLinear"
    });

    // renderer derives from the store: render=true draws the ocean base rect
    expect(await page.locator("#oceanHeights rect").count()).toBeGreaterThan(0);

    // the retired attrs are gone from both groups
    for (const id of ["#landHeights", "#oceanHeights"]) {
      for (const attr of ["scheme", "terracing", "skip", "relax", "curve", "data-render"]) {
        expect(await page.locator(id).getAttribute(attr), `${id} ${attr}`).toBeNull();
      }
    }
  });

  test("armies size input writes the store and the renderer derives from it", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("military"));
    await openStyleElement(page, "military");

    await page.locator(`${f("options.boxSize")} input[type=number]`).fill("4");

    expect(await page.evaluate(() => (window as any).styles.military.options)).toEqual({ boxSize: 4 });

    // renderer derives from the store: a regiment box is 2x boxSize tall
    const boxHeight = await page.locator("#armies > g > g rect").first().getAttribute("height");
    expect(Number(boxHeight)).toBe(8);

    expect(await page.locator("#armies").getAttribute("box-size")).toBeNull();
    // the regiment font follows the box: no attr of its own
    expect(await page.locator("#armies").getAttribute("font-size")).toBe("8");
  });

  test("grid controls write the store and restyle the pattern", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("grid"));
    await openStyleElement(page, "grid");

    await page.locator(`${f("options.type")} select`).selectOption("pointyHex");
    for (const [input, value] of [
      [f("options.scale"), "2"],
      [f("options.dx"), "10"],
      [f("options.dy"), "5"]
    ] as const) {
      await page.locator(`${input} input[type=number]`).fill(value);
    }

    const stored = await page.evaluate(() => (window as any).styles.grid.options);
    expect(stored).toEqual({ type: "pointyHex", scale: 2, dx: 10, dy: 5 });

    await expect(page.locator("#pattern_pointyHex")).toHaveAttribute("patternTransform", "scale(2) translate(10 5)");

    for (const attr of ["type", "scale", "dx", "dy"]) {
      expect(await page.locator("#gridOverlay").getAttribute(attr), attr).toBeNull();
    }
  });

  test("the map filter select writes the attr and only the filter attr lands on #map", async ({ page }) => {
    await openStyleElement(page, "map");
    await page.locator(`${f("attrs.filter")} select`).selectOption("url(#filter-sepia)");

    expect(await page.evaluate(() => (window as any).styles.map.attrs.filter)).toBe("url(#filter-sepia)");
    expect(await page.locator("#map").getAttribute("filter")).toBe("url(#filter-sepia)");
    expect(await page.locator("#map").getAttribute("data-filter")).toBeNull();

    // clearing unsets the attr
    await page.locator(`${f("attrs.filter")} select`).selectOption("");
    expect(await page.evaluate(() => (window as any).styles.map.attrs.filter)).toBeNull();
    expect(await page.locator("#map").getAttribute("filter")).toBeNull();
  });

  test("markets icon size and goods circle write the store and drive the renderer", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).Layers.show("goods");
      (window as any).Layers.show("markets");
    });

    await openStyleElement(page, "markets");
    await page.locator(`${f("options.iconSize")} input[type=number]`).fill("11");

    expect(await page.evaluate(() => (window as any).styles.markets.options.iconSize)).toBe(11);
    // drawn glyphs derive from the store base plus the zoom term (baseFont + 1/scale)
    const scale = await currentScale(page);
    const expectedFont = `${rn(11 + 1 / scale, 2)}px`;
    await expect(page.locator("#markets text").first()).toHaveAttribute("font-size", expectedFont);
    for (const attr of ["font-size", "data-icon", "data-size"]) {
      expect(await page.locator("#markets").getAttribute(attr), attr).toBeNull();
    }

    await openStyleElement(page, "goods");
    const before = await page.evaluate(() => (window as any).styles.goods.groups.goodsIcons.options.circle);
    await page.locator(`${f("groups.goodsIcons.options.circle")} label.checkbox-label`).click();
    expect(await page.evaluate(() => (window as any).styles.goods.groups.goodsIcons.options.circle)).toBe(!before);
    expect(typeof (await page.evaluate(() => (window as any).styles.goods.groups.goodsIcons.options.circle))).toBe("boolean");
    expect(await page.locator("#goodsIcons").getAttribute("data-circle")).toBeNull();
  });

  test("texture controls write the store and the renderer rebuilds the image", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("texture"));
    await openStyleElement(page, "texture");

    await page.locator(`${f("options.x")} input[type=number]`).fill("40");

    const stored = await page.evaluate(() => (window as any).styles.texture.options);
    expect(stored.x).toBe(40);
    expect(typeof stored.href).toBe("string");

    await expect(page.locator("#texture image")).toHaveAttribute("x", "40");
    for (const attr of ["data-href", "data-x", "data-y"]) {
      expect(await page.locator("#texture").getAttribute(attr), attr).toBeNull();
    }
  });

  test("ocean outline select writes the store and redraws the layers", async ({ page }) => {
    await openStyleElement(page, "ocean");

    await page.locator(`${f("groups.oceanLayers.options.outline")} select`).selectOption("-6,-4,-2");

    expect(await page.evaluate(() => (window as any).styles.ocean.groups.oceanLayers.options.outline)).toBe("-6,-4,-2");
    expect(await page.locator("#oceanLayers").getAttribute("layers")).toBeNull();
    expect(await page.evaluate(() => document.querySelectorAll("#oceanLayers > path").length)).toBe(3);
  });

  test("scale bar controls write the store and the renderer derives from them", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("scaleBar"));
    await openStyleElement(page, "scaleBar");

    for (const [input, value] of [
      [f("options.barSize"), "2.5"],
      [f("options.x"), "50"],
      [f("groups.back.options.top"), "12"]
    ] as const) {
      await page.locator(`${input} input[type=number]`).fill(value);
    }
    await page.locator(`${f("options.label")} input`).fill("here be dragons");

    const stored = await page.evaluate(() => ({
      barSize: (window as any).styles.scaleBar.options.barSize,
      x: (window as any).styles.scaleBar.options.x,
      label: (window as any).styles.scaleBar.options.label,
      top: (window as any).styles.scaleBar.groups.back.options.top
    }));
    expect(stored).toEqual({ barSize: 2.5, x: 50, label: "here be dragons", top: 12 });

    // renderer derives from the store: bar line stroke-width equals barSize, label text drawn
    await expect(page.locator("#scaleBarContent line").first()).toHaveAttribute("stroke-width", "2.5");
    await expect(page.locator("#scaleBarContent text").last()).toHaveText("here be dragons");
    await expect(page.locator("#scaleBarBack")).toHaveAttribute("y", "-12");

    for (const attr of ["data-bar-size", "data-x", "data-y", "data-label"]) {
      expect(await page.locator("#scaleBar").getAttribute(attr), attr).toBeNull();
    }
    for (const attr of ["data-top", "data-right", "data-bottom", "data-left"]) {
      expect(await page.locator("#scaleBarBack").getAttribute(attr), attr).toBeNull();
    }
  });

  // regression: these five were DOM-only writes, so the store kept the preset's values and
  // Styles.write restored them over the edit on the next load
  test("scale bar background paint writes the store and survives a store write", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("scaleBar"));
    await openStyleElement(page, "scaleBar");

    await page.locator(`${f("groups.back.attrs.opacity")} input[type=number]`).fill("0.65");
    await page.locator(`${f("groups.back.attrs.stroke-width")} input[type=number]`).fill("2.5");
    for (const [input, value] of [
      [f("groups.back.attrs.fill"), "#123456"],
      [f("groups.back.attrs.stroke"), "#654321"]
    ] as const) {
      await page.locator(`${input} input[type=color]`).fill(value);
      await page.locator(`${input} input[type=color]`).dispatchEvent("input");
    }

    const expected = { opacity: 0.65, fill: "#123456", stroke: "#654321", "stroke-width": 2.5 };
    expect(await page.evaluate(() => (window as any).styles.scaleBar.groups.back.attrs)).toMatchObject(expected);

    // a preset apply rewrites every element from the store, the way a load does: the edit must survive it
    await page.evaluate(() => (window as any).Controllers.StylePresetsEditor.applyPreset((window as any).styles));
    const back = page.locator("#scaleBarBack");
    await expect(back).toHaveAttribute("opacity", "0.65");
    await expect(back).toHaveAttribute("fill", "#123456");
    await expect(back).toHaveAttribute("stroke", "#654321");
    await expect(back).toHaveAttribute("stroke-width", "2.5");
  });

  test("label shift inputs write the store and apply the em transform", async ({ page }) => {
    await openStyleElement(page, "labels");
    const group = await page.evaluate(() => (window as any).styleGroupSelect.value);

    const shift = page.locator(`${f("attrs.style")} input[type=number]`);
    await shift.nth(0).fill("1.5");
    await shift.nth(1).fill("-0.5");

    const stored = await page.evaluate(g => (window as any).styles.labels.groups[g].attrs.style, group);
    expect(stored).toContain("transform: translate(1.5em, -0.5em)");

    const el = page.locator(`#labels > [data-group="${group}"]`);
    expect(await el.evaluate(node => (node as SVGElement).style.transform)).toBe("translate(1.5em, -0.5em)");
    expect(await el.getAttribute("data-dx")).toBeNull();
    expect(await el.getAttribute("data-dy")).toBeNull();
  });

  test("legend column input writes the store", async ({ page }) => {
    await openStyleElement(page, "legend");
    await page.locator(`${f("options.columns")} input[type=number]`).fill("3");

    expect(await page.evaluate(() => (window as any).styles.legend.options.columns)).toBe(3);
    expect(await page.locator("#legend").getAttribute("data-columns")).toBeNull();
  });

  test("generic attr controls write the store for any selection", async ({ page }) => {
    // nested group selection: lakes > freshwater
    await openStyleElement(page, "lakes");
    await page.locator("#styleGroupSelect").selectOption("freshwater");
    await page.locator(`${f("attrs.fill")} input[type=color]`).fill("#123456");
    await page.locator(`${f("attrs.fill")} input[type=color]`).dispatchEvent("input");
    await page.locator(`${f("attrs.stroke-width")} input[type=number]`).fill("3");

    // flat element selection: rivers
    await openStyleElement(page, "rivers");
    await page.locator(`${f("attrs.opacity")} input[type=number]`).fill("0.4");

    const stored = await page.evaluate(() => ({
      lakeFill: (window as any).styles.lakes.groups.freshwater.attrs.fill,
      lakeStrokeWidth: (window as any).styles.lakes.groups.freshwater.attrs["stroke-width"],
      riversOpacity: (window as any).styles.rivers.attrs.opacity
    }));
    expect(stored).toEqual({ lakeFill: "#123456", lakeStrokeWidth: 3, riversOpacity: 0.4 });
    expect(typeof stored.lakeStrokeWidth).toBe("number");
    expect(typeof stored.riversOpacity).toBe("number");

    // the DOM presentation is written identically
    await expect(page.locator('#lakes [data-group="freshwater"], #freshwater').first()).toHaveAttribute(
      "fill",
      "#123456"
    );
    await expect(page.locator("#rivers")).toHaveAttribute("opacity", "0.4");
  });

  test("label group dropdown counts come from the label data, not the culled DOM", async ({ page }) => {
    // zoom in so some label tiers are culled from the DOM while their data still exists
    await page.evaluate(() => (window as any).setMapZoom(6));
    await page.waitForTimeout(200);
    await openStyleElement(page, "labels");

    const { optionCounts, dataCounts } = await page.evaluate(() => {
      const dataCounts: Record<string, number> = {};
      for (const label of (window as any).getLabelsData()) {
        dataCounts[label.group] = (dataCounts[label.group] || 0) + 1;
      }
      const optionCounts: Record<string, number> = {};
      for (const option of (document.getElementById("styleGroupSelect") as HTMLSelectElement).options) {
        const match = option.text.match(/^(.*) \((\d+)\)$/);
        if (match) optionCounts[match[1]] = Number(match[2]);
      }
      return { optionCounts, dataCounts };
    });

    expect(Object.keys(optionCounts).length).toBeGreaterThan(0);
    for (const [group, count] of Object.entries(optionCounts)) {
      expect(count, `dropdown count for ${group}`).toBe(dataCounts[group] || 0);
    }
    // at least one group must have labels in data at all, or the test proves nothing
    expect(Object.values(dataCounts).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  test("editing one label group leaves sibling groups' derived DOM values untouched", async ({ page }) => {
    await openStyleElement(page, "labels");
    const groups = await page.evaluate(() =>
      Array.from(document.querySelectorAll("#labels > [data-group]")).map(el => (el as HTMLElement).dataset.group)
    );
    const target = groups[0]!;
    const sibling = groups.find(g => g !== target)!;
    expect(sibling).toBeTruthy();

    // simulate a zoom-derived sibling value living only on the DOM
    await page.evaluate(g => {
      document.querySelector(`#labels > [data-group="${g}"]`)!.setAttribute("stroke-width", "7.77");
    }, sibling);

    await page.locator("#styleGroupSelect").selectOption(target);
    await page.locator(`${f("attrs.stroke-width")} input[type=number]`).fill("2.5");

    const after = await page.evaluate(
      ([t, s]) => ({
        target: document.querySelector(`#labels > [data-group="${t}"]`)!.getAttribute("stroke-width"),
        sibling: document.querySelector(`#labels > [data-group="${s}"]`)!.getAttribute("stroke-width"),
        stored: (window as any).styles.labels.groups[t as string].attrs["stroke-width"]
      }),
      [target, sibling]
    );
    expect(after.stored).toBe(2.5);
    expect(after.target).toBe("2.5");
    expect(after.sibling, "sibling derived DOM value must survive").toBe("7.77");
  });

  test("burg icon controls write the store and the redraw derives from it", async ({ page }) => {
    await openStyleElement(page, "burgIcons");
    const group = await page.evaluate(() => (window as any).styleGroupSelect.value);

    await page.locator(`${f("groups.icons.options.size")} input[type=number]`).fill("2.5");
    await page.locator(`${f("groups.icons.attrs.fill-opacity")} input[type=number]`).fill("0.6");
    await page.locator(`${f("groups.icons.attrs.stroke-linejoin")} select`).selectOption("round");

    const stored = await page.evaluate(
      g => ({
        size: (window as any).styles.burgIcons.groups[g].groups.icons.options.size,
        fillOpacity: (window as any).styles.burgIcons.groups[g].groups.icons.attrs["fill-opacity"],
        linejoin: (window as any).styles.burgIcons.groups[g].groups.icons.attrs["stroke-linejoin"]
      }),
      group
    );
    expect(stored).toEqual({ size: 2.5, fillOpacity: 0.6, linejoin: "round" });

    // the live group part carries the presentation; a full redraw keeps the store values
    await page.evaluate(() => (window as any).Layers.draw("burgIcons"));
    const el = page.locator(`#burgIcons > g#${group} > [data-group="icons"]`);
    await expect(el).toHaveAttribute("font-size", "2.5%");
    await expect(el).toHaveAttribute("fill-opacity", "0.6");

    // anchors size writes its own store node without minting data-size
    const anchorGroup = group;
    await page.locator(`${f("groups.anchors.options.size")} input[type=number]`).fill("1.8");
    const anchorStored = await page.evaluate(
      g => (window as any).styles.burgIcons.groups[g].groups.anchors.options.size,
      anchorGroup
    );
    expect(anchorStored).toBe(1.8);
    const anchors = page.locator(`#burgIcons > g#${anchorGroup} > [data-group="anchors"]`);
    expect(await anchors.getAttribute("data-size")).toBeNull();
  });

  test("a new map starts from the previous definition sets, repaired so nothing is undrawable", async ({ page }) => {
    // what an old map's migration leaves behind: one burg group, and a label registry with only that type
    await page.evaluate(() => {
      options.map.burgs.groups = [{ name: "cities", isDefault: true, active: true, features: {}, preview: "" }];
      options.map.labels.groups = [{ name: "cities", type: "burg", zoom: { min: 1, max: 25 } }];
    });

    const mapsBefore = await countMaps(page);
    await page.evaluate(() => regeneratePrompt({ seed: "registry-reset-test" }));
    await waitForNextMap(page, mapsBefore);
    await page.waitForTimeout(500);

    const after = await page.evaluate(() => ({
      burgGroupNames: options.map.burgs.groups.map(group => group.name),
      labelTypes: [...new Set(options.map.labels.groups.map(group => group.type))],
      labelGroupNames: options.map.labels.groups.map(group => group.name),
      defaultBurgGroups: options.map.burgs.groups.filter(group => group.isDefault).length,
      unassignedBurgs: (window as any).pack.burgs.filter((b: any) => b?.i && !b.group).length
    }));

    // the sets are the user's own: the next map starts from them rather than resetting to defaults
    expect(after.burgGroupNames).toEqual(["cities"]);
    expect(after.labelGroupNames).toContain("cities");

    // but a repair keeps them usable: every label type has a group and burgs still have a default
    for (const type of ["river", "route", "state", "province", "added"])
      expect(after.labelTypes).toContain(type);
    expect(after.defaultBurgGroups).toBe(1);
    expect(after.unassignedBurgs).toBe(0);
  });

  test("ocean pattern attrs write the store and land on the pattern image", async ({ page }) => {
    await openStyleElement(page, "ocean");

    await page.locator(`${f("groups.pattern.attrs.href")} select`).selectOption({ index: 2 });
    const chosen = await page.locator(`${f("groups.pattern.attrs.href")} select`).inputValue();
    await page.locator(`${f("groups.pattern.attrs.opacity")} input[type=number]`).fill("0.55");

    const stored = await page.evaluate(() => (window as any).styles.ocean.groups.pattern.attrs);
    expect(stored).toEqual({ href: chosen, opacity: 0.55 });
    await expect(page.locator("#oceanicPattern")).toHaveAttribute("opacity", "0.55");
    await expect(page.locator("#oceanicPattern")).toHaveAttribute("href", chosen);
    expect(await page.locator("#oceanPattern > pattern#oceanic > image").count()).toBe(1); // lives in its layer
  });

  test("vignette controls write the store and shape the mask rect", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("vignette"));
    await openStyleElement(page, "vignette");

    await page.locator(`${f("options.x")} input[type=number]`).fill("7");
    await page.locator(`${f("options.filter")} input[type=number]`).fill("12");

    const stored = await page.evaluate(() => (window as any).styles.vignette.options);
    expect(stored.x).toBe("7%");
    expect(stored.filter).toBe("blur(12px)");
    await expect(page.locator("#vignette-rect")).toHaveAttribute("x", "7%");

    // a vignette preset moves both the display attrs and the mask geometry through the store
    await page.locator(`${f("preset")} select`).selectOption("spotlight");
    const preset = await page.evaluate(() => ({
      fill: (window as any).styles.vignette.attrs.fill,
      rx: (window as any).styles.vignette.options.rx
    }));
    expect(preset).toEqual({ fill: "#000000", rx: "50%" });
    await expect(page.locator("#vignette-rect")).toHaveAttribute("rx", "50%");
  });

  test("a preset switch keeps the zoom-derived layer font sizes", async ({ page }) => {
    const layers = ["labels", "markers", "burgIcons"];
    const fontSizes = () =>
      page.evaluate(ids => ids.map(id => document.getElementById(id)?.getAttribute("font-size")), layers);
    await page.evaluate(() => (window as any).setMapZoom(4));
    await page.waitForTimeout(300);
    const zoomed = await fontSizes();
    expect(zoomed).not.toContain("100px");

    await page.evaluate(async () => {
      sessionStorage.setItem("fmg-style-change-confirmed", "true");
      await (window as any).Controllers.StylePresetsEditor.change("pale");
    });
    await page.waitForTimeout(200);

    // the zoom owns these fonts: the preset apply leaves them in place
    expect(await fontSizes()).toEqual(zoomed);
  });

  test("compass shift writes the rose transform through the store", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("compass"));
    await openStyleElement(page, "compass");

    await page.locator(`${f("groups.compassRose.attrs.transform")} input[type=number]`).first().fill("30");

    const stored = await page.evaluate(() => (window as any).styles.compass.groups.compassRose.attrs.transform);
    expect(stored).toContain("translate(30");
    await expect(page.locator("#compass use")).toHaveAttribute("transform", stored);
  });
});
