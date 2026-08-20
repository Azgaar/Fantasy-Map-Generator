import {expect, test} from "@playwright/test";

test.describe("controller launchers", () => {
  test.beforeEach(async ({page}) => {
    page.on("console", message => console.log(`[browser:${message.type()}] ${message.text()}`));
    page.on("pageerror", error => console.log(`[pageerror] ${error.message}`));
    await page.goto("/?seed=test-controller-launchers&width=1280&height=720");
    await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});
  });

  test("opens Markers generation settings from Markers Overview", async ({page}) => {
    await page.click("#optionsTrigger");
    await page.click("#toolsTab");
    await page.click("#overviewMarkersButton");
    await expect(page.locator("#markersOverview")).toBeVisible();
    await expect(page.locator("#chat-widget-container")).toBeVisible();

    await page.click("#markersGenerationConfig");

    await expect(page.locator("#markersSettings")).toBeVisible();
  });

  test("opens Goods Editor when some goods have no production", async ({page}) => {
    await page.evaluate(() => {
      const {Goods, pack} = window as any;
      const good = structuredClone(pack.goods[0]);
      good.i = Math.max(...pack.goods.map(({i}: {i: number}) => i)) + 1;
      good.name = "No Production";
      good.visible = false;
      delete good.distribution;
      delete good.recipes;
      pack.goods.push(good);
      Goods.sync();
    });

    await page.click("#optionsTrigger");
    await page.click("#toolsTab");
    await page.click("#editGoods");

    await expect(page.locator("#goodsEditor")).toBeVisible();
    await expect(page.locator("#goodsBody .goodName", {hasText: "No Production"})).toBeVisible();
  });

  test("opens Relief Editor by clicking a relief icon", async ({page}) => {
    await page.click("#optionsTrigger");
    await page.click("#layersTab");
    const reliefToggle = page.locator("#mapLayers > li[data-layer='relief']");
    if (await reliefToggle.evaluate(element => element.classList.contains("buttonoff"))) {
      await reliefToggle.click();
    }

    const reliefIconIndex = await page.locator("#terrain > use").evaluateAll(elements =>
      elements.findIndex(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 3 && rect.height > 3 && rect.x > 350 && rect.y > 30 && rect.right < 1100 && rect.bottom < 650;
      })
    );
    expect(reliefIconIndex).toBeGreaterThanOrEqual(0);
    const reliefIcon = page.locator("#terrain > use").nth(reliefIconIndex);
    await expect(reliefIcon).toBeAttached();
    await reliefIcon.evaluate(element => {
      element.addEventListener("click", () => console.log("selected icon click"), true);
      const rect = element.getBoundingClientRect();
      console.log(
        JSON.stringify({
          selectedRect: [rect.x, rect.y, rect.width, rect.height],
          selectedElementAtPoint: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.outerHTML.slice(0, 100)
        })
      );
    });
    await page.evaluate(() => {
      const controllers = window as any;
      const open = controllers.Controllers.ReliefEditor.open;
      controllers.Controllers.ReliefEditor.open = (...args: unknown[]) => {
        console.log("relief editor opener reached");
        return open(...args);
      };
      document.addEventListener(
        "click",
        event => {
          const target = event.target as Element;
          console.log(
            `native click ${target?.tagName} ${target?.id} / ${target?.parentElement?.tagName} ${target?.parentElement?.id}`
          );
        },
        true
      );
      document.querySelector("#terrain > use")?.addEventListener("click", () => console.log("icon click"), true);
      const icon = document.querySelector("#terrain > use") as SVGUseElement | null;
      const rect = icon?.getBoundingClientRect();
      console.log(
        JSON.stringify({
          pointerEvents: icon && getComputedStyle(icon).pointerEvents,
          terrainPointerEvents: getComputedStyle(document.querySelector("#terrain")!).pointerEvents,
          elementAtPoint: rect && document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.outerHTML.slice(0, 100)
        })
      );
      console.log(
        JSON.stringify({
          loading: getComputedStyle(document.querySelector("#loading")!).opacity,
          options: getComputedStyle(document.querySelector("#optionsContainer")!).opacity,
          handler: (document.querySelector("#viewbox") as any).__on?.click ? "d3" : "unknown",
          ancestors: document.querySelector("#terrain > use")?.parentElement?.parentElement?.parentElement?.parentElement?.tagName
        })
      );
    });
    await reliefIcon.dispatchEvent("click");

    await expect(page.locator("#reliefEditor")).toBeVisible();
  });
});
