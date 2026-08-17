import { expect, test } from "@playwright/test";

declare let customization: number; // page global, resolved inside page.evaluate

// Turning a layer off erases its content. Some sub-groups are user data rather than render output —
// custom route groups, burg icon groups, the wind arrows — and must survive the erasure.
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

  test("precipitation keeps the wind direction group", async ({ page }) => {
    const wind = page.locator("#prec > #wind");
    await expect(wind).toBeAttached(); // written once, by generatePrecipitation
    const arrows = await page.locator("#prec > #wind text").count();
    expect(arrows).toBeGreaterThan(0);

    await page.evaluate(() => (window as any).Layers.show("precipitation"));
    expect(await page.locator("#prec > circle").count()).toBeGreaterThan(0);

    await page.evaluate(() => (window as any).Layers.hide("precipitation"));
    expect(await page.locator("#prec > circle").count()).toBe(0);
    await expect(wind).toBeAttached();
    expect(await page.locator("#prec > #wind text").count()).toBe(arrows);
  });

  test("burg icons keep group styles edited while the layer is on", async ({ page }) => {
    const capitals = page.locator("#burgIcons > #capital");
    await expect(capitals).toBeAttached();

    // the Style editor writes straight to the DOM; the style object is only harvested at draw time
    await page.evaluate(() => document.querySelector("#burgIcons > #capital")!.setAttribute("fill", "#123456"));

    await page.evaluate(() => (window as any).Layers.hide("burgIcons"));
    await expect(capitals).toBeAttached();
    expect(await capitals.getAttribute("fill")).toBe("#123456");

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
      document.getElementById("texture")!.removeAttribute("data-href"); // pre-1.94 maps saved with texture off
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
});
