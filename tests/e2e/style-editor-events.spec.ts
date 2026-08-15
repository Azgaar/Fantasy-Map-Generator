import {test, expect, type Page} from "@playwright/test";

// The rest of the style suite drives the store API directly (page.evaluate calling
// window.setPresentation/setOptions), which cannot see a handler that never reaches the store.
// Every case here dispatches a real `input`/`change`/`click` on the actual style-editor control
// and asserts BOTH the store and the DOM, plus survival across the redraw that would revert a
// DOM-only write (and, for the map filter, across a save -> reload round trip).

async function openGeneratedMap(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => Boolean((window as any).pack?.cells?.i?.length), {timeout: 120000});
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 120000});
  await page.waitForTimeout(500);
}

// C1: applyMapFilter wrote svg.attr("data-filter"/"filter") directly. style.layers.map models both
// keys (default.json nulls them), and load.ts re-applies the map node over the restored svg root,
// so a DOM-only write is wiped on reload
test("map filter button click stores the filter and survives a redraw and a save/reload round trip", async ({
  page
}) => {
  await openGeneratedMap(page);

  const applied = await page.evaluate(() => {
    const w = window as any;
    (document.getElementById("sepia") as HTMLButtonElement).click();
    w.applyLayerStyle("map"); // a redraw of the layer must not drop it

    return {
      storeFilter: style.layers.map?.presentation?.filter,
      storeDataFilter: style.layers.map?.presentation?.["data-filter"],
      domFilter: document.getElementById("map")?.getAttribute("filter"),
      domDataFilter: document.getElementById("map")?.getAttribute("data-filter"),
      pressed: document.getElementById("sepia")?.classList.contains("pressed")
    };
  });

  expect(applied.pressed).toBe(true);
  expect(applied.storeDataFilter).toBe("sepia");
  expect(applied.storeFilter).toBe("url(#filter-sepia)");
  expect(applied.domDataFilter).toBe("sepia");
  expect(applied.domFilter).toBe("url(#filter-sepia)");

  // save -> load the saved data back: parseLoadedData replaces #map with the saved svg and then
  // re-applies style.layers over it, which is exactly where a DOM-only filter was being lost
  await page.evaluate(async () => {
    const w = window as any;
    const mapData: string = await w.Services.Save.prepareMapData();
    // marker on the live (pre-reload) #map only - it is not part of the saved svg, so it
    // disappears the moment the loader swaps the element in
    document.getElementById("map")?.setAttribute("data-roundtrip", "stale");
    await w.Services.Load.uploadMap(new Blob([mapData], {type: "text/plain"}));
  });

  await page.waitForFunction(() => !document.getElementById("map")?.hasAttribute("data-roundtrip"), {timeout: 120000});
  await page.waitForTimeout(500);

  const reloaded = await page.evaluate(() => ({
    storeDataFilter: style.layers.map?.presentation?.["data-filter"],
    domFilter: document.getElementById("map")?.getAttribute("filter"),
    domDataFilter: document.getElementById("map")?.getAttribute("data-filter"),
    pressed: document.getElementById("sepia")?.classList.contains("pressed")
  }));

  expect(reloaded.storeDataFilter).toBe("sepia");
  expect(reloaded.domDataFilter).toBe("sepia");
  expect(reloaded.domFilter).toBe("url(#filter-sepia)");
  expect(reloaded.pressed).toBe(true);

  // and unsetting it through the same control clears both keys rather than leaving residue
  const cleared = await page.evaluate(() => {
    (document.getElementById("sepia") as HTMLButtonElement).click();
    const w = window as any;
    w.applyLayerStyle("map");
    return {
      storeFilter: style.layers.map?.presentation?.filter,
      domFilter: document.getElementById("map")?.getAttribute("filter"),
      domDataFilter: document.getElementById("map")?.getAttribute("data-filter"),
      pressed: document.getElementById("sepia")?.classList.contains("pressed")
    };
  });

  expect(cleared.pressed).toBe(false);
  expect(cleared.storeFilter).toBeNull();
  expect(cleared.domFilter).toBeNull();
  expect(cleared.domDataFilter).toBeNull();
});

// selects the element (and group) in the style editor the way the UI does, so the handlers under
// test resolve the same styleTargetFromUI() a user would produce
async function selectStyleElement(page: Page, element: string, group?: string) {
  await page.evaluate(
    ([element, group]) => {
      const elementSelect = document.getElementById("styleElementSelect") as HTMLSelectElement;
      elementSelect.value = element;
      elementSelect.dispatchEvent(new Event("change"));
      if (group) {
        const groupSelect = document.getElementById("styleGroupSelect") as HTMLSelectElement;
        groupSelect.value = group;
        groupSelect.dispatchEvent(new Event("change"));
      }
    },
    [element, group] as const
  );
}

// I3: the ocean branch of styleFilterInput returned early with a DOM-only write, which the next
// applyLayerStyle("oceanLayers") erased (default.json carries filter: null)
test("ocean filter select reaches the store and survives a layer restyle", async ({page}) => {
  await openGeneratedMap(page);
  await selectStyleElement(page, "ocean");

  const result = await page.evaluate(() => {
    const w = window as any;
    const filterInput = document.getElementById("styleFilterInput") as HTMLSelectElement;
    const value = Array.from(filterInput.options).find(option => option.value)!.value;

    filterInput.value = value;
    filterInput.dispatchEvent(new Event("change"));

    const afterInput = document.getElementById("oceanLayers")?.getAttribute("filter");
    w.applyLayerStyle("oceanLayers"); // the restyle that used to wipe it

    return {
      value,
      afterInput,
      store: style.layers.oceanLayers?.presentation?.filter,
      afterRestyle: document.getElementById("oceanLayers")?.getAttribute("filter")
    };
  });

  expect(result.value).toBeTruthy();
  expect(result.afterInput).toBe(result.value);
  expect(result.store).toBe(result.value);
  expect(result.afterRestyle).toBe(result.value);
});

// I4/I5: both fill-opacity inputs wrote the layer group directly. The presets carry a
// fill-opacity for each, so the next applyLayerStyle (preset switch, map load) reverted the edit
const FILL_OPACITY_CASES = [
  {element: "armies", layerId: "armies", control: "styleArmiesFillOpacity", value: "0.42"},
  {element: "markets", layerId: "markets", control: "styleMarketsLayerFillOpacity", value: "0.37"}
] as const;

for (const {element, layerId, control, value} of FILL_OPACITY_CASES) {
  test(`${element} fill-opacity input reaches the store and survives a layer restyle`, async ({page}) => {
    await openGeneratedMap(page);
    await selectStyleElement(page, element);

    const result = await page.evaluate(
      ([layerId, control, value]) => {
        const w = window as any;
        const input = document.getElementById(control) as HTMLInputElement;
        input.value = value;
        input.dispatchEvent(new Event("input"));

        const afterInput = document.getElementById(layerId)?.getAttribute("fill-opacity");
        w.applyLayerStyle(layerId);

        return {
          afterInput,
          store: (style as any).layers[layerId]?.presentation?.["fill-opacity"],
          afterRestyle: document.getElementById(layerId)?.getAttribute("fill-opacity")
        };
      },
      [layerId, control, value] as const
    );

    expect(result.afterInput).toBe(value);
    expect(String(result.store)).toBe(value);
    expect(result.afterRestyle).toBe(value);
  });
}

// I7: anchor size is an option (createIconGroups re-projects it as font-size on every draw), but
// it fell into changeFontSize's generic branch, which wrote data-size/font-size onto the group -
// reverted by the next drawBurgIcons() and lost on reload
test("anchors size input stores the option and survives a burg icon redraw", async ({page}) => {
  await openGeneratedMap(page);
  await selectStyleElement(page, "anchors", "capital");

  const result = await page.evaluate(() => {
    const w = window as any;
    const sizeInput = document.getElementById("styleFontSize") as HTMLInputElement;
    sizeInput.value = "3.5";
    sizeInput.dispatchEvent(new Event("change"));

    const afterInput = document.querySelector("#anchors > g#capital")?.getAttribute("font-size");
    w.drawBurgIcons(); // recreates the groups from the store

    const group = document.querySelector("#anchors > g#capital");
    return {
      afterInput,
      store: w.getLayerOptions("anchors", "capital").size,
      afterRedraw: group?.getAttribute("font-size"),
      dataSize: group?.getAttribute("data-size")
    };
  });

  expect(result.afterInput).toBe("3.5");
  expect(result.store).toBe(3.5);
  expect(result.afterRedraw).toBe("3.5");
  // data-size is a dead pre-migration mirror - the option is the only source of truth now
  expect(result.dataSize).toBeNull();
});

// C2: selectStyleElement read the node with the MATERIALIZING getStyleNode, so merely selecting a
// burg group in the editor created an empty child - which createIconGroups' `children[name] ??
// fallback` then preferred over the default-group fallback, rendering the group with no attributes
test("selecting a burg group in the editor does not materialize an empty style node", async ({page}) => {
  await openGeneratedMap(page);

  const uncovered = await page.evaluate(() => {
    // dropping a covered group's node is how a custom burg group looks to the renderer
    const children = (style as any).layers.burgIcons.children;
    delete children.hamlet;
    delete (style as any).layers.anchors.children?.hamlet;
    return {fill: children.town.presentation.fill, icon: children.town.presentation["data-icon"]};
  });

  await selectStyleElement(page, "burgIcons", "hamlet");
  await selectStyleElement(page, "anchors", "hamlet");

  const result = await page.evaluate(() => {
    const w = window as any;
    w.drawBurgIcons();
    const group = document.querySelector("#burgIcons > g#hamlet");
    return {
      iconNodeMaterialized: "hamlet" in (style as any).layers.burgIcons.children,
      anchorNodeMaterialized: "hamlet" in ((style as any).layers.anchors.children ?? {}),
      fill: group?.getAttribute("fill") ?? null,
      icon: group?.getAttribute("data-icon") ?? null
    };
  });

  expect(result.iconNodeMaterialized).toBe(false);
  expect(result.anchorNodeMaterialized).toBe(false);
  // the group keeps rendering with the default group's look instead of bare
  expect(uncovered.fill).toBeTruthy();
  expect(result.fill).toBe(uncovered.fill);
  expect(result.icon).toBe(uncovered.icon);
});

// I6: the create-scheme dialog wrote getEl().attr("scheme", stops), a dead attribute since the
// terrs migration - drawHeightmap reads getLayerOptions("terrs", child).scheme, so the new scheme
// was never applied and never persisted. Drives the real dialog: open it, edit a color stop,
// press Create, then assert the store, the select and the rendered fills
test("the custom heightmap scheme dialog applies and stores the created scheme", async ({page}) => {
  await openGeneratedMap(page);
  await selectStyleElement(page, "terrs", "landHeights");

  const result = await page.evaluate(() => {
    const w = window as any;
    const button = document.getElementById("openCreateHeightmapSchemeButton") as HTMLButtonElement;
    button.click();

    // edit the first color stop through its own input, as a user would
    const stopInput = document.querySelector("#heightmapSchemeStops input.stop") as HTMLInputElement;
    stopInput.value = "#ff00ff";
    stopInput.dispatchEvent(new Event("input"));
    const stops = button.dataset.stops!;

    const dialogButtons = document.getElementById("alert")?.closest(".ui-dialog")?.querySelectorAll("button");
    const create = Array.from(dialogButtons ?? []).find(b => b.textContent?.trim() === "Create");
    create?.click();

    const readRender = () => {
      const land = document.querySelector("#terrs > g#landHeights");
      const path = land?.querySelector("path[data-height]");
      return {
        baseFill: land?.querySelector("rect")?.getAttribute("fill") ?? null,
        pathFill: path?.getAttribute("fill") ?? null,
        pathHeight: Number(path?.getAttribute("data-height"))
      };
    };

    const rendered = readRender();
    w.drawHeightmap(); // a plain redraw must reach the same colors from the store alone
    const afterRedraw = readRender();

    const scheme = w.getColorScheme(stops);
    return {
      stops,
      createFound: Boolean(create),
      store: w.getLayerOptions("terrs", "landHeights").scheme,
      selectValue: (document.getElementById("styleHeightmapScheme") as HTMLSelectElement).value,
      rendered,
      afterRedraw,
      expectedBaseFill: scheme(0.8),
      expectedPathFill: w.getColor(rendered.pathHeight, scheme)
    };
  });

  expect(result.createFound).toBe(true);
  expect(result.stops.startsWith("#ff00ff,")).toBe(true);
  expect(result.store).toBe(result.stops);
  expect(result.selectValue).toBe(result.stops);
  // the created scheme actually reaches the rendered heightmap, not just the store
  expect(result.rendered.baseFill).toBe(result.expectedBaseFill);
  expect(result.rendered.pathFill).toBe(result.expectedPathFill);
  expect(result.afterRedraw).toEqual(result.rendered);
});

// Selecting a layer whose store node genuinely lacks a key fed `undefined` into the inputs.
// The pre-migration reads used d3 .attr(), which yields null for a missing attribute, and
// `input.value = null` is coerced to "" - undefined is not, it stringifies to "undefined", which
// a colour input rejects (resetting itself to #000000 and warning). The assignment is the only
// observable: the rejected value never survives on the element
test("selecting a layer with no stored fill or stroke never assigns undefined to an input", async ({page}) => {
  await openGeneratedMap(page);

  const assigned = await page.evaluate(() => {
    const ids = ["styleFillInput", "styleFillOutput", "styleStrokeInput", "styleStrokeOutput", "styleSelectFont"];
    const seen: {id: string; element: string; value: string}[] = [];
    const select = document.getElementById("styleElementSelect") as HTMLSelectElement;
    let current = "";

    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      const proto = Object.getPrototypeOf(el);
      const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      if (!descriptor?.set || !descriptor.get) continue;
      Object.defineProperty(el, "value", {
        configurable: true,
        get() {
          return descriptor.get!.call(this);
        },
        set(value) {
          seen.push({id, element: current, value: String(value)});
          descriptor.set!.call(this, value);
        }
      });
    }

    for (const option of Array.from(select.options)) {
      current = option.value;
      select.value = option.value;
      select.dispatchEvent(new Event("change"));
    }

    return seen.filter(entry => entry.value === "undefined");
  });

  expect(assigned).toEqual([]);
});

// goodsCells is a child of the goods layer in the store and a child <g> in the dom, but only
// goodsIcons/goodsBurgs were mapped, so its edits were written to a top-level "goodsCells" layer
// that parseStyle drops as an unknown id on the next load
test("goods cells edits are stored under the goods layer and survive a style round trip", async ({page}) => {
  await openGeneratedMap(page);

  const result = await page.evaluate(() => {
    const w = window as any;
    const select = document.getElementById("styleElementSelect") as HTMLSelectElement;
    select.value = "goodsCells";
    select.dispatchEvent(new Event("change"));

    const input = document.getElementById("styleFillInput") as HTMLInputElement;
    input.value = "#123456";
    input.dispatchEvent(new Event("input"));

    // a save/load of the style object drops layer ids the schema does not know
    const roundTripped = w.parseStyle(JSON.parse(JSON.stringify(style)));

    return {
      child: style.layers.goods?.children?.goodsCells?.presentation?.fill,
      strayLayer: (style.layers as Record<string, unknown>).goodsCells,
      afterRoundTrip: roundTripped.layers.goods?.children?.goodsCells?.presentation?.fill,
      dom: document.querySelector("#goods > #goodsCells")?.getAttribute("fill")
    };
  });

  expect(result.child).toBe("#123456");
  expect(result.strayLayer).toBeUndefined();
  expect(result.dom).toBe("#123456");
  expect(result.afterRoundTrip).toBe("#123456");
});
