import fs from "fs";
import { expect, test } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

// The mode flag, the layer state and the chart style all live in the saved file: a map saved in
// Astral reloads as the same chart, hydrated without re-applying anything, and can still leave
// the mode through the cross-reload profile store.

declare const options: { map: { astral: boolean; style: { preset: string } } };
declare const styles: { texture: { options: { href: string } } };
declare const Layers: { state: { order: string[]; active: string[] } };
declare const Services: { Save: { toMachine: () => Promise<void> } };

async function openLayersTab(page: import("@playwright/test").Page): Promise<void> {
  if (await page.locator("#layersContent").isVisible().catch(() => false)) return;
  await page.click("#optionsTrigger");
  await page.click("#layersTab");
  await expect(page.locator("#layersContent")).toBeVisible();
}

test.describe("Astral round trip", () => {
  test.setTimeout(180_000);

  test("a map saved in Astral reloads with its mode, layers and style", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/?seed=astral-round-trip&width=1280&height=720");
    await waitForMap(page);

    const before = await page.evaluate(() => ({
      preset: options.map.style.preset,
      href: styles.texture.options.href
    }));

    // enter through the button, then wait for the async preset fetch before capturing anything
    await openLayersTab(page);
    await page.click("#viewAstral");
    await expect.poll(() => page.evaluate(() => options.map.style.preset)).toBe("astral");
    await expect.poll(() => page.evaluate(() => styles.texture.options.href)).toContain("starfield");

    const charted = await page.evaluate(() => ({
      astral: options.map.astral,
      active: [...Layers.state.active].sort(),
      order: [...Layers.state.order]
    }));
    expect(charted.astral).toBe(true);
    expect(charted.active).toContain("nebulae");
    expect(charted.active).toContain("systems");

    const downloadPromise = page.waitForEvent("download");
    await page.evaluate(() => {
      // This round trip captures a download, not the native file picker.
      Object.defineProperty(window, "showSaveFilePicker", { value: undefined, configurable: true });
      return Services.Save.toMachine();
    });
    const download = await downloadPromise;
    const buffer = fs.readFileSync(await download.path());

    // a fresh session without the mode in memory: only the file can bring it back
    await page.goto("/?seed=astral-round-trip-other&width=1280&height=720");
    await waitForMap(page);
    await page.locator("#mapToLoad").setInputFiles({ name: "astral-round-trip.map", mimeType: "text/plain", buffer });
    await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });

    const after = await page.evaluate(() => ({
      astral: options.map.astral,
      preset: options.map.style.preset,
      href: styles.texture.options.href,
      active: [...Layers.state.active].sort(),
      order: [...Layers.state.order],
      buttonPressed: document.getElementById("viewAstral")!.classList.contains("pressed"),
      listItem: Boolean(document.querySelector('#mapLayers li[data-layer="nebulae"]')),
      standardItem: Boolean(document.querySelector('#mapLayers li[data-layer="heightmap"]')),
      markers: document.querySelectorAll("#systems [data-id]").length,
      clouds: document.querySelectorAll("#nebulae ellipse").length
    }));
    expect(after.astral).toBe(true);
    expect(after.preset).toBe("astral");
    expect(after.href).toContain("starfield");
    expect(after.active).toEqual(charted.active);
    expect(after.order).toEqual(charted.order);
    expect(after.buttonPressed).toBe(true); // hydrate adopts the flag without re-applying
    expect(after.listItem).toBe(true);
    expect(after.standardItem).toBe(false);
    expect(after.markers).toBeGreaterThan(0);
    expect(after.clouds).toBeGreaterThan(0);

    // leaving after the reload reads the cross-reload profile store and restores the standard world
    await openLayersTab(page);
    await page.click("#viewStandard");
    await expect.poll(() => page.evaluate(() => options.map.astral)).toBe(false);
    await expect.poll(() => page.evaluate(() => options.map.style.preset)).toBe(before.preset);
    await expect.poll(() => page.evaluate(() => styles.texture.options.href)).toBe(before.href);
    const restored = await page.evaluate(() => [...Layers.state.active].sort());
    expect(restored).not.toContain("nebulae");
  });
});
