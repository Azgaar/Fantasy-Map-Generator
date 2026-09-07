import { expect, test } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

// A value written by an older build can be structurally valid and still leave the renderer with
// nothing to draw. Boot repairs the definition sets before they seed a new map.
const STALE = {
  "options-labels": '{"resizeOnZoom":true,"showAll":false,"groups":[]}',
  "burg-groups": "[]"
};

async function generateMap(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForSelector("#mapToLoad", { state: "attached", timeout: 60000 });
  await waitForMap(page);
  await page.waitForTimeout(1000);

  return page.evaluate(() => {
    const labels = document.getElementById("labels");
    return {
      groups: labels?.children.length ?? 0,
      labelTexts: labels?.querySelectorAll("text").length ?? 0,
      labelGroups: (window as any).options.map.labels.groups.length,
      burgGroups: (window as any).options.map.burgs.groups.length
    };
  });
}

test("a stale stored group registry does not leave a new map without labels", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(stale => {
    localStorage.clear();
    for (const [key, value] of Object.entries(stale)) localStorage.setItem(key, value);
  }, STALE);

  const { groups, labelTexts, labelGroups, burgGroups } = await generateMap(page);

  expect(labelGroups).toBeGreaterThan(0);
  expect(burgGroups).toBeGreaterThan(0);
  expect(groups).toBeGreaterThan(0);
  expect(labelTexts).toBeGreaterThan(0);
});

test("a completed generation is persisted immediately", async ({ page }) => {
  await page.goto("/?seed=persisted-generation&width=900&height=600");
  await waitForMap(page);

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("fmg-options") || "null"));
  expect(persisted.map.seed).toBe("persisted-generation");
  expect(persisted.map.graph).toMatchObject({ width: 900, height: 600 });
});
