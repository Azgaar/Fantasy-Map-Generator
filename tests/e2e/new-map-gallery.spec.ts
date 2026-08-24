import {expect, test, type Page} from "@playwright/test";

async function openNewMapGallery(page: Page): Promise<void> {
  await page.click("#workspaceGenerateTrigger");
  await page.getByRole("menu", {name: "Generate"}).getByRole("menuitem", {name: "New Map"}).click();

  await expect(page.locator('[data-options-section="world-setup"]')).toBeVisible();
  await expect(page.locator("#worldPresetGalleryRoot")).toBeVisible();
}

test.describe("new map gallery", () => {
  test("keeps generation available when map history is empty", async ({page}) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));

    await page.goto("/?seed=new-map-gallery&width=1280&height=720");
    await expect(page.locator("#workspaceGenerateTrigger")).toBeVisible({timeout: 30_000});
    await page.evaluate(() => window.eval("mapHistory.length = 0"));
    pageErrors.length = 0;
    await openNewMapGallery(page);
    await page.click("#generateMapFromSetup");

    await expect(page.getByRole("dialog", {name: "Generate new map"})).toBeVisible({timeout: 5_000});
    expect(pageErrors).toEqual([]);
  });
});
