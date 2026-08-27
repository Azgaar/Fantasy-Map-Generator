import { expect, test, type Page } from "@playwright/test";

// Scenarios that exercise the registry through the paths a user actually takes — preset switching,
// map regeneration and reordering — rather than through a single layer's content. The invariant
// under test throughout: the active set and the DOM never drift apart, and no path leaves stale
// content behind or accumulates it.

declare const Layers: {
  all: readonly {
    id: string;
    params: { permanent?: boolean; keepContent?: boolean; element?: string; draw?: unknown; erase?: unknown };
  }[];
  state: { order: string[]; active: string[] };
  isOn: (id: string) => boolean;
  show: (...ids: string[]) => void;
  hide: (...ids: string[]) => void;
  move: (id: string, before?: string) => void;
  get: (id: string) => { params: { element?: string } };
};

const PRESETS = [
  "political",
  "cultural",
  "religions",
  "provinces",
  "biomes",
  "heightmap",
  "physical",
  "poi",
  "goods",
  "trade",
  "military",
  "emblems",
  "landmass"
];

const waitForMap = (page: Page) => page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 120000 });

/** console errors are the cheapest signal that a draw or teardown went wrong, so every test watches them */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", msg => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/fonts\.googleapis|google-analytics|googletagmanager|Failed to load resource/.test(text)) return;
    // the name generator logs this whenever a seed happens to yield a sub-2-character name and it
    // falls back to a random one. It is unrelated to the layers and fires on any map generation,
    // so filtering it here keeps these tests from inheriting that pre-existing flake
    if (text.includes("Name is too short")) return;
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

/** the element id of a layer differs from its layer id often enough to be worth resolving in the page */
const layerContent = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      Layers.all.map(layer => {
        const element = document.getElementById(layer.params.element ?? layer.id);
        return [layer.id, element ? element.innerHTML.length : -1];
      })
    )
  );

/** every layer's display has to agree with the active set — this is the projection the registry owns */
const visibilityDrift = (page: Page) =>
  page.evaluate(() =>
    Layers.all
      .map(layer => {
        const element = document.getElementById(layer.params.element ?? layer.id);
        if (!element) return `${layer.id}: no element`;
        const hidden = element.style.display === "none";
        const on = Layers.isOn(layer.id);
        return on === hidden ? `${layer.id}: active=${on} but display=${element.style.display || "visible"}` : null;
      })
      .filter(Boolean)
  );

/**
 * The preset select lives in the options panel, which is collapsed, so it cannot be clicked.
 * Setting the value and firing `change` still goes through the real handler.
 */
const selectPreset = (page: Page, name: string) =>
  page.evaluate(name => {
    const select = document.getElementById("layersPreset") as HTMLSelectElement;
    select.value = name;
    select.dispatchEvent(new Event("change"));
  }, name);

/**
 * `regenerateMap` is a lexical global of the classic main.js script (not a window property) and is
 * debounced, so the run has to be awaited through the event the generator emits when it finishes.
 */
async function regenerate(page: Page, seed?: string): Promise<void> {
  await page.evaluate(
    config => {
      (window as any).__regenerated = new Promise<void>(resolve =>
        window.addEventListener("map:generated", () => resolve(), { once: true })
      );
      (0, eval)(`regenerateMap(${config})`);
    },
    seed ? JSON.stringify({ seed }) : ""
  );
  await page.evaluate(() => (window as any).__regenerated);
  await page.waitForTimeout(1200); // the layers are drawn right after the event
}

test.describe("layer scenarios", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  for (const preset of PRESETS) {
    test(`the ${preset} preset applies without errors and matches the dom`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`/?seed=preset-${preset}&width=1280&height=720`);
      await waitForMap(page);

      await selectPreset(page, preset);
      await page.waitForTimeout(400);

      const active = await page.evaluate(() => Layers.state.active.slice().sort());
      expect(active.length).toBeGreaterThan(0);

      // the picker falls back to "custom" whenever the active set stops matching a known preset,
      // so it still reading the preset name is the proof that the set applied exactly
      await expect(page.locator("#layersPreset")).toHaveValue(preset);

      expect(await visibilityDrift(page)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test("switching to another preset and back restores identical content", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/?seed=preset-round-trip&width=1280&height=720");
    await waitForMap(page);

    await selectPreset(page, "political");
    await page.waitForTimeout(500);
    const before = await layerContent(page);

    // biomes and political overlap barely at all, so this erases and redraws most of the map
    await selectPreset(page, "biomes");
    await page.waitForTimeout(500);
    await selectPreset(page, "political");
    await page.waitForTimeout(500);
    const after = await layerContent(page);

    expect(after).toEqual(before);
    expect(await visibilityDrift(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("a preset switch leaves no content behind in the layers it turns off", async ({ page }) => {
    await page.goto("/?seed=preset-teardown&width=1280&height=720");
    await waitForMap(page);

    await selectPreset(page, "political");
    await page.waitForTimeout(500);

    // landmass is the narrowest preset, so nearly every user layer gets torn down
    await selectPreset(page, "landmass");
    await page.waitForTimeout(500);

    // only the layers on the default teardown are asserted here: `keepContent` layers hold their
    // content by design, and a custom `erase` defines its own contract (the wind rose and custom
    // burg icon groups outlive it on purpose), each covered in layer-teardown.spec.ts
    const leftovers = await page.evaluate(() =>
      Layers.all
        .filter(
          layer =>
            !layer.params.permanent &&
            !layer.params.keepContent &&
            !layer.params.erase &&
            !Layers.isOn(layer.id)
        )
        .map(layer => {
          const element = document.getElementById(layer.params.element ?? layer.id);
          // declared children are the skeleton and are meant to survive; their content is not
          const content = Array.from(element?.children ?? []).filter(child => child.innerHTML.length);
          return content.length ? `${layer.id}: ${content.map(c => c.id || c.tagName).join(",")}` : null;
        })
        .filter(Boolean)
    );

    expect(leftovers).toEqual([]);
  });

  test("regeneration keeps the active layer set and redraws its content", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/?seed=regen-state&width=1280&height=720");
    await waitForMap(page);

    // a set that differs from the preset the regeneration will re-apply
    await page.evaluate(() => Layers.show("biomes", "cells", "temperature"));
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => Layers.state.active.slice().sort());

    await regenerate(page);

    const after = await page.evaluate(() => Layers.state.active.slice().sort());
    expect(after).toEqual(before);

    // and the layers that stayed on actually hold content again after the eraseAll/drawAll cycle
    const empty = await page.evaluate(() =>
      ["biomes", "cells", "temperature"].filter(id => {
        const element = document.getElementById(id);
        return !element || element.innerHTML.length === 0;
      })
    );
    expect(empty).toEqual([]);
    expect(await visibilityDrift(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("repeated regeneration does not accumulate content", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/?seed=regen-leak&width=1280&height=720");
    await waitForMap(page);
    await page.waitForTimeout(800);

    // regenerating the same seed rebuilds an identical map, so the content of every layer has to
    // come out byte for byte the same. Anything that grows is content the teardown did not drop
    const sizes: Record<string, number>[] = [];
    for (let i = 0; i < 3; i++) {
      await regenerate(page, "regen-leak-fixed");
      sizes.push(await layerContent(page));
    }

    expect(sizes[1]).toEqual(sizes[0]);
    expect(sizes[2]).toEqual(sizes[0]);
    expect(errors).toEqual([]);
  });

  test("a layer moved while it is off keeps its new slot when shown again", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/?seed=layer-move&width=1280&height=720");
    await waitForMap(page);

    await page.evaluate(() => {
      Layers.hide("biomes");
      Layers.move("biomes", "rivers"); // re-slot it while it is off and holds no content
    });

    const orderWhileOff = await page.evaluate(() =>
      Array.from(document.querySelectorAll("#viewbox > *"), node => node.id)
    );
    expect(orderWhileOff.indexOf("biomes")).toBeLessThan(orderWhileOff.indexOf("rivers"));

    await page.evaluate(() => Layers.show("biomes"));
    await page.waitForTimeout(500);

    const orderAfterShow = await page.evaluate(() =>
      Array.from(document.querySelectorAll("#viewbox > *"), node => node.id)
    );
    expect(orderAfterShow.indexOf("biomes")).toBeLessThan(orderAfterShow.indexOf("rivers"));

    // the registry order and the document order have to agree
    const registryOrder = await page.evaluate(() => Layers.state.order);
    expect(registryOrder.indexOf("biomes")).toBeLessThan(registryOrder.indexOf("rivers"));

    const content = await page.evaluate(() => document.getElementById("biomes")!.innerHTML.length);
    expect(content).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("hidden layers stay hidden in the exported svg", async ({ page }) => {
    await page.goto("/?seed=export-hidden&width=1280&height=720");
    await waitForMap(page);

    await page.evaluate(() => {
      Layers.show("biomes");
      Layers.hide("rivers", "borders");
    });
    await page.waitForTimeout(500);

    const svg = await page.evaluate(async () => {
      const url = await (window as any).Services.ExportMap.getMapURL("svg", { fullMap: true });
      return await (await fetch(url)).text();
    });

    // an svg export drops every group that is empty or display:none, so a layer that is off
    // must not reach the file at all — neither as markup nor as leftover content
    expect(svg).not.toMatch(/<g[^>]*id="rivers"/);
    expect(svg).not.toMatch(/<g[^>]*id="borders"/);
    expect(svg).toMatch(/<g[^>]*id="biomes"/);
  });

  test("a preset URL param applies that preset on load", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/?seed=url-preset&width=1280&height=720&preset=religions");
    await waitForMap(page);

    await expect(page.locator("#layersPreset")).toHaveValue("religions");
    const active = await page.evaluate(() => Layers.state.active.slice().sort());
    expect(active).toEqual(
      ["borders", "burgIcons", "labels", "lakes", "religions", "rivers", "routes", "scaleBar", "vignette"].sort()
    );
    expect(await page.evaluate(() => localStorage.getItem("preset"))).toBe("religions");
    expect(await visibilityDrift(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("a preset URL param matches the select display name", async ({ page }) => {
    await page.goto("/?seed=url-preset-name&width=1280&height=720&preset=Religions%20map");
    await waitForMap(page);
    await expect(page.locator("#layersPreset")).toHaveValue("religions");
  });

  test("a layers URL param shows only the listed layers", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/?seed=url-layers&width=1280&height=720&layers=provinces,borders,lakes,rivers");
    await waitForMap(page);

    await expect(page.locator("#layersPreset")).toHaveValue("custom");
    const active = await page.evaluate(() => Layers.state.active.slice().sort());
    expect(active).toEqual(["borders", "lakes", "provinces", "rivers"]);
    expect(await visibilityDrift(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("layers wins over preset, ignores unknown ids and clears the set when none are known", async ({ page }) => {
    await page.goto(
      "/?seed=url-layers-override&width=1280&height=720&preset=religions&layers=provinces,nope,borders"
    );
    await waitForMap(page);

    await expect(page.locator("#layersPreset")).toHaveValue("custom");
    const active = await page.evaluate(() => Layers.state.active.slice().sort());
    expect(active).toEqual(["borders", "provinces"]);

    await page.evaluate(() => {
      const params = new URLSearchParams({ layers: "nope,missing" });
      (window as any).applyURLLayers(params);
    });
    expect(await page.evaluate(() => Layers.state.active)).toEqual([]);
  });
});
