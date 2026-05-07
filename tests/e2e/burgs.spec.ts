import { test, expect } from "@playwright/test";

test.describe("Burgs.add", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Navigate with seed parameter and wait for full load
    await page.goto("/?seed=test-burgs&width=1280&height=720");

    // Wait for map generation to complete
    await page.waitForFunction(
      () => (window as any).mapId !== undefined,
      { timeout: 60000 }
    );

    // Additional wait for any rendering/animations to settle
    await page.waitForTimeout(500);
  });

  test("should create burg with falsy port value when not on coast", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { cells, burgs } = (window as any).pack;

      // Find a land cell that is not on the coast (no harbor)
      let inlandCellId: number | null = null;
      for (let i = 1; i < cells.i.length; i++) {
        const isLand = cells.h[i] >= 20;
        const hasNoHarbor = !cells.harbor[i];
        const hasNoBurg = !cells.burg[i];
        if (isLand && hasNoHarbor && hasNoBurg) {
          inlandCellId = i;
          break;
        }
      }

      if (!inlandCellId) {
        return { error: "No inland cell found" };
      }

      // Get coordinates for the inland cell
      const [x, y] = cells.p[inlandCellId];

      // Add a new burg at this inland location
      const Burgs = (window as any).Burgs;
      const burgId = Burgs.add([x, y]);
      const burg = burgs[burgId];

      return {
        burgId,
        port: burg.port,
        portType: typeof burg.port,
        portIsFalsy: !burg.port,
        x: burg.x,
        y: burg.y,
      };
    });

    expect(result.error).toBeUndefined();
    // Port should be 0 (number), not "0" (string)
    expect(result.port).toBe(0);
    expect(result.portType).toBe("number");
    expect(result.portIsFalsy).toBe(true);
    // Explicitly verify it's not the buggy string "0"
    expect(result.port).not.toBe("0");
  });

  test("port toggle button should be inactive for non-coastal burg", async ({
    page,
  }) => {
    // Add a burg on an inland cell
    const burgId = await page.evaluate(() => {
      const { cells } = (window as any).pack;

      // Find a land cell that is not on the coast
      for (let i = 1; i < cells.i.length; i++) {
        const isLand = cells.h[i] >= 20;
        const hasNoHarbor = !cells.harbor[i];
        const hasNoBurg = !cells.burg[i];
        if (isLand && hasNoHarbor && hasNoBurg) {
          const [x, y] = cells.p[i];
          return (window as any).Burgs.add([x, y]);
        }
      }
      return null;
    });

    expect(burgId).not.toBeNull();

    // Open the burg editor
    await page.evaluate((id: number) => {
      (window as any).editBurg(id);
    }, burgId!);

    // Wait for the editor dialog to appear
    await page.waitForSelector("#burgEditor", { state: "visible" });

    // The port toggle button should have the "inactive" class
    const portButton = page.locator("#burgPort");
    await expect(portButton).toHaveClass(/inactive/);
  });
});
