import {test, expect, type Page} from "@playwright/test";

async function openNotesEditor(page: Page) {
  await page.goto("/?seed=test-notes&width=1280&height=720");
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});
  await page.click("#optionsTrigger");
  await page.click("#toolsTab");
  await page.click("#editNotesButton");
  await page.waitForSelector("#notesEditor", {state: "visible", timeout: 5000});
}

test.describe("Notes Editor", () => {
  test("loads the rich-text editor from the bundled library", async ({page}) => {
    await openNotesEditor(page);
    await expect(page.locator("#notesEditor .tox-tinymce")).toBeVisible({timeout: 10000});
  });

  // The library is fetched at runtime and can fail (offline, blocked by the desktop CSP).
  // That failure must not surface as the "new version released" reload prompt
  test("opens as a plain editor without a reload prompt when the library cannot load", async ({page}) => {
    await page.route("**/tinymce/tinymce.min.js*", route => route.abort());
    await openNotesEditor(page);
    await page.waitForTimeout(1500);

    expect(await page.locator(".ui-dialog:has(#alert):visible").count()).toBe(0);
    expect(await page.locator("#notesEditor .tox-tinymce").count()).toBe(0);
    await expect(page.locator("#notesLegend")).not.toBeEmpty();
  });
});
