import { test, expect } from "@playwright/test";
import fs from "fs";

declare const Services: { Save: { saveMap: (method: string) => Promise<void> } };

// a map saved with bare layer groups (the v1.145 cleanup damage) gets its style back on load
test("a map damaged by the v1.145 cleanup is healed on load", async ({ page }) => {
  await page.goto("/?seed=heal-test&width=1280&height=720");
  await page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 120000 });
  await page.waitForTimeout(500);

  const downloadPromise = page.waitForEvent("download");
  await page.evaluate(() => Services.Save.saveMap("machine"));
  const download = await downloadPromise;
  let map = fs.readFileSync(await download.path(), "utf8");

  // wound it the way the wild did
  map = map.replace(/^[0-9.]+\|/, "1.146.0|");
  for (const id of ["cults", "texture"]) {
    map = map.replace(new RegExp(`<g id="${id}"[^>]*>`), `<g id="${id}" style="display: none;">`);
  }

  await page.goto("/");
  await page.waitForSelector("#mapToLoad", { state: "attached" });
  await page.locator("#mapToLoad").setInputFiles({
    name: "damaged.map",
    mimeType: "text/plain",
    buffer: Buffer.from(map)
  });
  await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });

  const healed = await page.evaluate(() => {
    const attrs = (id: string) => {
      const el = document.getElementById(id);
      return el ? Object.fromEntries([...el.attributes].map(a => [a.name, a.value])) : null;
    };
    return { cults: attrs("cults"), texture: attrs("texture") };
  });

  expect(healed.cults).toMatchObject({ opacity: "0.6", stroke: "#777777" });
  expect(healed.texture).toMatchObject({ "data-href": expect.stringContaining("texture") });
});
