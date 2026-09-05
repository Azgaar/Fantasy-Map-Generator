import { expect, test } from "@playwright/test";

// a value written by an older build can be structurally valid and still leave the renderer with
// nothing to draw; it is read on boot and again in randomizeOptions, so both sites have to validate
const STALE = {
  "options-labels": '{"resizeOnZoom":true,"showAll":false,"groups":[]}',
  "burg-groups": "[]"
};

async function generateMap(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForSelector("#mapToLoad", { state: "attached", timeout: 60000 });
  await page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 120000 });
  await page.waitForTimeout(1000);

  return page.evaluate(() => {
    const labels = document.getElementById("labels");
    return {
      groups: labels?.children.length ?? 0,
      labelTexts: labels?.querySelectorAll("text").length ?? 0,
      // `options` is a global binding from main.js, not a window property
      labelGroups: (0, eval)("options.labels.groups.length"),
      burgGroups: (0, eval)("options.burgs.groups.length")
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
