import { type Browser, expect, test } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

declare const Services: { Save: { prepareMapData: () => Promise<string> } };

const url = "/?seed=map-invariance&width=1280&height=720";

/** Generate the seed with the interface in `language`, in a fresh browser profile, and return the map file */
async function generateIn(browser: Browser, language: string): Promise<{ map: string; cyrillic: boolean }> {
  const context = await browser.newContext();
  await context.addInitScript(
    lang => localStorage.setItem("fmg-options", JSON.stringify({ app: { language: lang } })),
    language
  );
  const page = await context.newPage();
  await page.goto(url);
  await waitForMap(page);
  // the header's last field is the map's creation time, so it differs between any two runs
  const map = (await page.evaluate(() => Services.Save.prepareMapData())).replace(/\|\d+(\r?\n)/, "$1");
  const cyrillic = /[А-Яа-яЁё]/.test(await page.locator("body").innerText());
  await context.close();
  return { map, cyrillic };
}

test("the interface language never changes the saved map", async ({ browser }) => {
  const english = await generateIn(browser, "en");
  const russian = await generateIn(browser, "ru");

  expect(english.cyrillic).toBe(false);
  expect(russian.cyrillic).toBe(true); // the Russian interface actually rendered
  expect(russian.map).toBe(english.map);
});
