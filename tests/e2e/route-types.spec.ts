import { expect, test, type Page } from "@playwright/test";

// Routes are drawn as `#routes > <group> > <type> > path` when the route carries a type, and
// `#routes > <group> > path` when it does not. Both shapes have to behave the same.
const TYPED_ROUTE = "#routes #trails > #footpath > path";
const UNTYPED_ROUTE = "#routes #traderoutes > path";

async function generatedMap(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.waitForFunction(() => (window as any).pack?.routes?.length > 0, { timeout: 120000 });
  await page.waitForSelector(TYPED_ROUTE, { state: "attached" });
}

test.describe("route types", () => {
  test("opens the route editor for a typed route as well as an untyped one", async ({ page }) => {
    await generatedMap(page);

    for (const selector of [TYPED_ROUTE, UNTYPED_ROUTE]) {
      await page.evaluate(sel => {
        document.getElementById("routeEditor")?.setAttribute("style", "display: none");
        document.querySelector(sel)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }, selector);

      await expect(page.locator("#routeEditor")).toBeVisible();
    }
  });

  test("offers only top-level groups as the route group", async ({ page }) => {
    await generatedMap(page);

    await page.evaluate(sel => {
      document.querySelector(sel)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }, TYPED_ROUTE);
    await expect(page.locator("#routeEditor")).toBeVisible();

    const options = await page.locator("#routeGroup option").evaluateAll(els =>
      els.map(el => (el as HTMLOptionElement).value)
    );
    const groups = await page.evaluate(() =>
      [...document.querySelectorAll("#routes > g")].map(group => group.id)
    );

    expect(options).toEqual(groups);
  });

  test("keeps the type when a typed route is split", async ({ page }) => {
    await generatedMap(page);

    const splittable = await page.evaluate(() => {
      const pack = (window as any).pack;
      for (const path of document.querySelectorAll<SVGPathElement>("#routes #trails > #footpath > path")) {
        const route = pack.routes.find((r: any) => `route${r.i}` === path.id);
        if (route?.points.length >= 3) {
          path.dispatchEvent(new MouseEvent("click", { bubbles: true }));
          return route.i;
        }
      }
      return null;
    });
    expect(splittable).not.toBeNull();
    await expect(page.locator("#routeEditor")).toBeVisible();

    const before = await page.evaluate(() => (window as any).pack.routes.map((r: any) => r.i));
    await page.locator("#routeSplit").click();
    await page.evaluate(() => {
      const points = document.querySelectorAll<SVGCircleElement>("#controlPoints circle");
      points[Math.floor(points.length / 2)].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const split = await page.evaluate(ids => {
      const route = (window as any).pack.routes.find((r: any) => !ids.includes(r.i));
      return { type: route?.type, parent: document.getElementById(`route${route?.i}`)?.parentElement?.id };
    }, before);

    expect(split).toEqual({ type: "footpath", parent: "footpath" });
  });
});

test.describe("route type styles", () => {
  test("the style tab lists each type under its group and edits its line style", async ({ page }) => {
    await generatedMap(page);

    await page.evaluate(() => (window as any).editStyle("routes", "trails/footpath"));
    const options = await page.locator("#styleGroupSelect option").evaluateAll(els =>
      els.map(el => (el as HTMLOptionElement).value)
    );
    expect(options).toEqual(expect.arrayContaining(["roads", "roads/royal", "trails/footpath", "searoutes/feeder"]));
    expect(await page.locator("#styleGroupSelect").inputValue()).toBe("trails/footpath");

    // <slider-input> re-dispatches its inner input as its own "input" event, which the tab reads from e.target.value
    await page.evaluate(() => {
      const slider = document.getElementById("styleStrokeWidthInput") as HTMLInputElement;
      slider.value = "2.5";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(await page.locator("#routes #trails > #footpath").getAttribute("stroke-width")).toBe("2.5");
    expect(await page.evaluate(() => (window as any).styles.routes.types.footpath.attrs["stroke-width"])).toBe(2.5);
  });
});
