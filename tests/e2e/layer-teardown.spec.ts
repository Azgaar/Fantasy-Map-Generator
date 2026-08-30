import { expect, test } from "@playwright/test";

// page globals, resolved inside page.evaluate
declare let customization: number;
declare const styles: any;

// Turning a layer off erases its content. Some sub-groups are user data rather than render output —
// custom route groups, burg icon groups — and must survive the erasure. The wind arrows are the
// counter-example: they are render output and must be rebuilt identically when the layer comes back.
test.describe("layer teardown keeps user data", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/?seed=test-seed&width=1280&height=720");
    await page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 60000 });
    await page.waitForTimeout(500);
  });

  test("routes keep custom groups and their styles across a hide/show round trip", async ({ page }) => {
    const custom = page.locator("#routes > #caravans");

    // the Route Groups editor appends a styled <g> under #routes and assigns routes to it
    await page.evaluate(() => {
      const routes = document.getElementById("routes")!;
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.id = "caravans";
      group.setAttribute("stroke", "#aa3333");
      group.setAttribute("stroke-width", "0.7");
      routes.append(group);
      for (const route of (window as any).pack.routes.slice(0, 5)) route.group = "caravans";
      (window as any).Layers.draw("routes");
    });

    await expect(custom).toBeAttached();
    expect(await page.locator("#routes > #caravans path").count()).toBe(5);

    await page.evaluate(() => (window as any).Layers.hide("routes"));

    await expect(custom).toBeAttached(); // the group is user data, only the paths are render output
    expect(await custom.getAttribute("stroke")).toBe("#aa3333");
    expect(await page.locator("#routes path").count()).toBe(0);

    await page.evaluate(() => (window as any).Layers.show("routes"));
    expect(await page.locator("#routes > #caravans path").count()).toBe(5);
  });

  test("precipitation rebuilds the wind direction group with the layer", async ({ page }) => {
    const wind = page.locator("#prec > #wind");
    await expect(wind).toHaveCount(0); // render output: generation no longer touches the DOM

    await page.evaluate(() => (window as any).Layers.show("precipitation"));
    await expect(wind).toBeAttached();
    const arrows = await page.locator("#prec > #wind text").count();
    expect(arrows).toBeGreaterThan(0);
    expect(await page.locator("#prec > circle").count()).toBeGreaterThan(0);

    await page.evaluate(() => (window as any).Layers.hide("precipitation"));
    expect(await page.locator("#prec > circle").count()).toBe(0);
    await expect(wind).toHaveCount(0);

    // Precipitation.getWinds() is free of randomness, so the redraw restores the same arrows
    await page.evaluate(() => (window as any).Layers.show("precipitation"));
    await expect(wind).toBeAttached();
    expect(await page.locator("#prec > #wind text").count()).toBe(arrows);
  });

  test("burg icons keep group styles edited while the layer is on", async ({ page }) => {
    const capitals = page.locator("#burgIcons > #capital");
    await expect(capitals).toBeAttached();

    // the Style editor writes the store; the groups fully recreate from it on every draw
    await page.evaluate(() => {
      styles.burgIcons.burgIcons.groups.capital.attrs.fill = "#123456";
      document.querySelector("#burgIcons > #capital")!.setAttribute("fill", "#123456");
    });

    await page.evaluate(() => (window as any).Layers.hide("burgIcons"));
    await page.evaluate(() => (window as any).Layers.show("burgIcons"));
    expect(await capitals.getAttribute("fill")).toBe("#123456");
    expect(await page.locator("#burgIcons > #capital use").count()).toBeGreaterThan(0);
  });

  test("showing a layer that is already on does not redraw it", async ({ page }) => {
    // a redraw rebuilds every burg <use>, so a marker set on one of them would not survive it
    await page.evaluate(() => (window as any).Layers.show("burgIcons"));
    await page.evaluate(() => document.querySelector("#burgIcons use")!.setAttribute("data-probe", "1"));

    await page.evaluate(() => (window as any).Layers.show("burgIcons", "labels"));

    expect(await page.locator("#burgIcons use[data-probe]").count()).toBe(1);
  });

  test("texture renders nothing when no image is set", async ({ page }) => {
    await page.evaluate(() => {
      styles.texture.options.href = ""; // pre-1.94 maps saved with texture off
      (window as any).Layers.show("texture");
    });

    expect(await page.locator("#texture image").count()).toBe(0);
  });

  // the heightmap editor renders into #heights and owns the heightmap while it is open
  test("the heightmap layer refuses to draw in the heightmap edit mode", async ({ page }) => {
    const landHeights = page.locator("#landHeights > *");

    await page.evaluate(() => {
      customization = 1;
      (window as any).Layers.show("heightmap");
    });

    expect(await landHeights.count()).toBe(0);
    await expect(page.locator("#tooltip")).toHaveText(/not available in the heightmap edit mode/);

    await page.evaluate(() => {
      customization = 0;
      (window as any).Layers.draw("heightmap");
    });

    expect(await landHeights.count()).toBeGreaterThan(0);
  });

  // the whole edit view is #heights: the heightmap layer stays off and the landmass is emptied.
  // the landmass is permanent, so it keeps its on state and its visibility -- only the content goes
  test("heightmap keep mode clears the landmass content and redraws it on exit", async ({ page }) => {
    await page.evaluate(() => (window as any).Controllers.HeightmapEditor.open({ mode: "keep" }));
    await expect(page.locator("#heights polygon").first()).toBeAttached();

    const state = await page.evaluate(() => ({
      landmass: (window as any).Layers.isOn("landmass"),
      heightmap: (window as any).Layers.isOn("heightmap"),
      lakes: (window as any).Layers.isOn("lakes"),
      landmassRects: document.querySelectorAll("#landmass rect").length,
      landmassDisplay: document.getElementById("landmass")!.style.display,
      lakesDisplay: document.getElementById("lakes")!.style.display
    }));

    expect(state).toEqual({
      landmass: true,
      heightmap: false,
      lakes: false,
      landmassRects: 0,
      landmassDisplay: "",
      lakesDisplay: "none"
    });
    // the edit-mode tip is not clobbered by a layer refusal
    await expect(page.locator("#tooltip")).toHaveText(/Heightmap edit mode is active/);

    await page.locator("#finalizeHeightmap").click();
    await expect(page.locator("#heights")).toHaveCount(0);

    const restored = await page.evaluate(() => ({
      landmass: (window as any).Layers.isOn("landmass"),
      landmassDisplay: document.getElementById("landmass")!.style.display,
      // the layer state and the element used to drift apart: display cleared behind the registry's back
      lakesMatchesState:
        (window as any).Layers.isOn("lakes") === (document.getElementById("lakes")!.style.display !== "none")
    }));

    expect(restored).toEqual({ landmass: true, landmassDisplay: "", lakesMatchesState: true });
    expect(await page.locator("#landmass rect").count()).toBe(1); // redrawn, exactly once
  });

  // the ocean outline is regenerated from the stored outline setting on every draw
  test("ocean outlines follow the stored outline setting and keep the base rect", async ({ page }) => {
    const rings = page.locator("#oceanLayers path");
    const base = page.locator("#oceanLayers #oceanBase");

    const drawn = await rings.count();
    expect(drawn).toBeGreaterThan(0);
    await expect(base).toBeAttached();

    await page.evaluate(() => {
      styles.ocean.oceanLayers.options.outline = "none";
      (window as any).Layers.draw("ocean");
    });
    expect(await rings.count()).toBe(0); // the renderer clears its own content, style.js no longer does
    await expect(base).toBeAttached(); // the base rect is not outline content

    await page.evaluate(() => {
      styles.ocean.oceanLayers.options.outline = "-6,-3,-1";
      (window as any).Layers.draw("ocean");
    });
    expect(await rings.count()).toBe(drawn);
  });

  // the rose is layer skeleton, so it is there before the compass is ever shown and survives an erase
  test("the compass rose exists while the layer is off and outlives eraseAll", async ({ page }) => {
    const rose = page.locator("#compass > #compassRose");

    expect(await page.evaluate(() => (window as any).Layers.isOn("compass"))).toBe(false);
    await expect(rose).toBeAttached();
    expect(await rose.getAttribute("href")).toBe("#defs-compass-rose");

    // the Style editor writes the rose transform even when the compass is hidden
    await page.evaluate(() => document.querySelector("#compass > use")!.setAttribute("transform", "scale(2)"));

    await page.evaluate(() => (window as any).Layers.eraseAll()); // what a regeneration does
    await expect(rose).toBeAttached();

    await page.evaluate(() => (window as any).Layers.show("compass"));
    await expect(page.locator("#compass")).toBeVisible();
    expect(await page.locator("#compass use").count()).toBe(1); // not duplicated by the show
  });

  // the rendered shields are cached in #coas by entity id, and regeneration reuses those ids
  test("reassigned arms replace the rendered shield, whether the layer was on or off", async ({ page }) => {
    // the shield the cached def was actually rendered from, read off its clip path id
    const renderedShield = () =>
      page.evaluate(
        () => document.querySelector("#coas > #stateCOA1")?.querySelector("clipPath")?.id.split("_")[0] ?? null
      );
    const setArms = (shield: string) =>
      page.evaluate((value: string) => {
        (window as any).pack.states[1].coa.shield = value;
        (window as any).Layers.draw("emblems");
      }, shield);

    await page.evaluate(() => (window as any).Layers.show("emblems"));
    await expect.poll(renderedShield).not.toBeNull();

    // give state 1 different arms, the way a states regeneration does
    await setArms("polish");
    await expect.poll(renderedShield).toBe("polish");
    expect(await page.locator("#coas > #stateCOA1").count()).toBe(1); // replaced, not duplicated

    // the same holds when the arms change while the layer is off: the old code skipped the purge
    // entirely in that case, so showing the layer brought the stale shield back. The teardown now frees
    // the shield outright, since with the layer down nothing references it any more
    await page.evaluate(() => (window as any).Layers.hide("emblems"));
    await setArms("swiss"); // the draw is a no-op while the layer is off
    expect(await renderedShield()).toBeNull();

    await page.evaluate(() => (window as any).Layers.show("emblems"));
    await expect.poll(renderedShield).toBe("swiss");
  });

  // style.js used to call the renderers straight, drawing into layers the user has turned off
  test("a style change does not render into a layer that is off", async ({ page }) => {
    expect(await page.evaluate(() => (window as any).Layers.isOn("goods"))).toBe(false);

    await page.evaluate(() => {
      const input = document.getElementById("styleGoodsSize") as HTMLInputElement;
      input.value = "2";
      input.dispatchEvent(new Event("change"));
    });

    expect(await page.locator("#goods > * > *").count()).toBe(0);
  });
});
