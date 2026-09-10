import { waitForMap } from "./wait-for-map";
import { expect, test } from "@playwright/test";

// renderGoodsPage ran applyTagVisibilityFilter, whose goodsTable.reset() re-invoked
// renderGoodsPage: opening the editor recursed to stack overflow, with a full production
// scan and a table render per level - minutes of 100% CPU on large maps. The dialog still
// became visible, so a visibility assertion alone cannot catch it.
test("goods editor opens without runaway re-rendering", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", err => errors.push(String(err)));

  await page.goto("/?seed=test-controller-launchers&width=1280&height=720");
  await waitForMap(page);

  await page.click("#optionsTrigger");
  await page.click("#toolsTab");
  await page.click("#editGoods");

  await expect(page.locator("#goodsEditor")).toBeVisible();
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});
