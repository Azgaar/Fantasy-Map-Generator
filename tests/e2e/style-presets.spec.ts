import {test, expect, type Page, type ConsoleMessage} from "@playwright/test";
import fs from "fs";
import path from "path";

const PRESETS = [
  "default", "ancient", "gloom", "pale", "light", "watercolor",
  "clean", "atlas", "darkSeas", "cyberpunk", "night", "monochrome"
];

function oceanBaseFill(preset: string): string {
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, `../../public/styles/${preset}.json`), "utf8"));
  return json.ocean.base.attrs.fill;
}

async function switchTo(page: Page, preset: string) {
  await page.evaluate(async name => {
    await (window as any).changeStyle(name);
  }, preset);
}

test("every shipped preset applies through the store with no console errors", async ({page}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    // openwidget.min.js pulls a third-party chat widget from cdn.openwidget.com; this test
    // environment has no route to it, so it always fails to load - unrelated to preset styling
    if (msg.type() === "error" && !msg.text().includes("ERR_CONNECTION_REFUSED")) consoleErrors.push(msg.text());
  });
  page.on("pageerror", err => pageErrors.push(err.message));

  await page.goto("/?seed=test-seed&width=1280&height=720");
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});
  await page.waitForSelector("#burgIcons > g", {state: "attached", timeout: 60000});
  await page.waitForSelector("#labels > g", {state: "attached", timeout: 60000});
  await page.waitForTimeout(500);

  await page.evaluate(() => sessionStorage.setItem("styleChangeConfirmed", "true"));

  for (const preset of PRESETS) {
    await switchTo(page, preset);
    await page.waitForTimeout(100);

    const fill = await page.locator("#oceanBase").getAttribute("fill");
    expect(fill, preset).toBe(oceanBaseFill(preset));
  }

  await switchTo(page, "default");
  const revertedFill = await page.locator("#oceanBase").getAttribute("fill");
  expect(revertedFill).toBe(oceanBaseFill("default"));

  expect(consoleErrors, "console errors during preset switching").toEqual([]);
  expect(pageErrors, "page errors during preset switching").toEqual([]);
});
