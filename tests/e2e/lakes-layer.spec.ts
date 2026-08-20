import { test, expect } from "@playwright/test";

test.describe("Lakes layer", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/?seed=test-seed&width=1280&height=720");

    // Wait for map generation to complete
    await page.waitForFunction(() => (window as any).mapId !== undefined, {
      timeout: 60000,
    });

    // Wait for any post-generation rendering to settle
    await page.waitForTimeout(500);
  });

  test("lakes toggle button hides and shows the #lakes SVG group", async ({
    page,
  }) => {
    const lakes = page.locator("#lakes");

    // Open the options panel (layers tab) so the toggle button is reachable
    await page.evaluate(() => (window as any).showOptions());

    // Lakes should be visible by default
    await expect(lakes).toBeVisible();

    // Click the toggle button to hide; wait for jQuery fadeOut to complete
    await page.locator("#mapLayers > li[data-layer='lakes']").click();
    await expect(lakes).toBeHidden();

    // Click again to show; wait for jQuery fadeIn to complete
    await page.locator("#mapLayers > li[data-layer='lakes']").click();
    await expect(lakes).toBeVisible();
  });

  test("KeyQ toggles the lakes layer", async ({ page }) => {
    const lakes = page.locator("#lakes");

    // Lakes should be visible by default
    await expect(lakes).toBeVisible();

    // Press Q to hide lakes; wait for jQuery fadeOut to complete
    await page.keyboard.press("q");
    await expect(lakes).toBeHidden();

    // Press Q again to show lakes; wait for jQuery fadeIn to complete
    await page.keyboard.press("q");
    await expect(lakes).toBeVisible();
  });

  test("Lakes panel entry is positioned just after Heightmap", async ({
    page,
  }) => {
    const [lakesIndex, heightmapIndex] = await page.evaluate(() => {
      const items = Array.from(
        document.querySelectorAll("#mapLayers > li")
      ) as HTMLElement[];
      return [
        items.findIndex((li) => li.dataset.layer === "lakes"),
        items.findIndex((li) => li.dataset.layer === "heightmap"),
      ];
    });

    expect(lakesIndex).toBe(heightmapIndex + 1);
  });

  test("dragging Lakes above Heightmap in panel moves #lakes before #terrs in SVG", async ({
    page,
  }) => {
    // Confirm initial SVG order: #lakes is after #terrs (rendered above heightmap by default)
    const initialOrder = await page.evaluate(() => {
      const viewbox = document.getElementById("viewbox")!;
      const ids = Array.from(viewbox.children).map((el) => el.id);
      return { lakes: ids.indexOf("lakes"), terrs: ids.indexOf("terrs") };
    });
    expect(initialOrder.lakes).toBeGreaterThanOrEqual(0);
    expect(initialOrder.terrs).toBeGreaterThanOrEqual(0);
    expect(initialOrder.lakes).toBeGreaterThan(initialOrder.terrs);

    // Simulate the drag of Lakes above Heightmap in the panel
    await page.evaluate(() => {
      const Layers = (window as any).Layers;
      Layers.move("lakes", "heightmap");
    });

    // After move: #lakes should be before #terrs in SVG → renders behind heightmap
    const newOrder = await page.evaluate(() => {
      const viewbox = document.getElementById("viewbox")!;
      const ids = Array.from(viewbox.children).map((el) => el.id);
      return { lakes: ids.indexOf("lakes"), terrs: ids.indexOf("terrs") };
    });
    expect(newOrder.lakes).toBeLessThan(newOrder.terrs);
  });

  test("a lake moved to a custom group keeps its subtype and stays there after a redraw", async ({
    page,
  }) => {
    const moved = await page.evaluate(async () => {
      const win = window as any;
      const use = document.querySelector("#lakes use") as SVGUseElement;
      const featureId = Number(use.dataset.f);
      const subtypeBefore = win.pack.features[featureId].subtype;

      await win.Controllers.LakesEditor.open(use);

      // create a custom group for the lake, as the editor's "+" flow does
      const nameInput = document.getElementById("lakeGroupName") as HTMLInputElement;
      nameInput.value = "my_lakes";
      nameInput.dispatchEvent(new Event("change"));

      const feature = win.pack.features[featureId];
      return {
        featureId,
        subtypeBefore,
        subtypeAfter: feature.subtype,
        group: feature.group,
        parentAfterMove: use.parentElement?.id,
      };
    });

    expect(moved.group).toBe("my_lakes");
    expect(moved.subtypeAfter).toBe(moved.subtypeBefore); // the lake subtype is not overwritten by the group
    expect(moved.parentAfterMove).toBe("my_lakes");

    // the placement has to survive a redraw of the layer, which is what happens on load
    const parentAfterRedraw = await page.evaluate(featureId => {
      const win = window as any;
      win.Layers.draw("lakes");
      return document.querySelector(`#lakes use[data-f="${featureId}"]`)?.parentElement?.id;
    }, moved.featureId);

    expect(parentAfterRedraw).toBe("my_lakes");
  });
});
