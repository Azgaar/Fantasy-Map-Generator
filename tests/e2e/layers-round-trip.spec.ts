import fs from "fs";
import { expect, test } from "@playwright/test";

// data[50] exists so that the layers the user had enabled — and the order they put them in —
// come back exactly as they were. Save the state, reload it, assert nothing drifted.

declare const Layers: {
  state: { order: string[]; active: string[] };
  get: (id: string) => { id: string } | undefined;
  show: (...layers: unknown[]) => void;
  hide: (...layers: unknown[]) => void;
  move: (layer: unknown, before?: unknown) => void;
};
declare const Services: { Save: { saveMap: (method: string) => Promise<void> } };

const waitForMap = (page: import("@playwright/test").Page) =>
  page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 60000 });

test.describe("layers round-trip", () => {
  test("saved layer state and custom order survive a save and load", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/?seed=layers-round-trip&width=1280&height=720");
    await waitForMap(page);

    // a state that differs from the default preset in both membership and order
    const before = await page.evaluate(() => {
      Layers.show("biomes", "cells");
      Layers.hide("labels");
      Layers.move("texture", "relief"); // texture is no longer in its registration slot
      return Layers.state;
    });

    expect(before.active).toContain("biomes");
    expect(before.active).not.toContain("labels");
    expect(before.order.indexOf("texture")).toBeGreaterThan(before.order.indexOf("rivers"));

    const downloadPromise = page.waitForEvent("download");
    await page.evaluate(() => Services.Save.saveMap("machine"));
    const download = await downloadPromise;
    const buffer = fs.readFileSync(await download.path());

    // reload the generator from scratch, then load the saved file back. The fresh map has to finish
    // generating first: it applies the default preset, which would otherwise land after the restore.
    await page.goto("/?seed=other-seed&width=1280&height=720");
    await waitForMap(page);
    await page.locator("#mapToLoad").setInputFiles({ name: "round-trip.map", mimeType: "text/plain", buffer });
    await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });

    const after = await page.evaluate(() => Layers.state);
    expect(after).toEqual(before);

    // the registry order is the document order of the svg groups
    const svgOrder = await page.evaluate(() =>
      Array.from(document.querySelectorAll("#viewbox > *"), node => node.id)
    );
    expect(svgOrder.indexOf("texture")).toBeGreaterThan(svgOrder.indexOf("rivers"));

    // and the state is projected onto the dom
    const visibility = await page.evaluate(() => ({
      biomes: document.getElementById("biomes")!.style.display,
      labels: document.getElementById("labels")!.style.display
    }));
    expect(visibility).toEqual({ biomes: "", labels: "none" });

    // URL state is applied after a saved map is restored, using canonical layer ids.
    await page.evaluate(() => history.replaceState(null, "", "?layers=scaleBar,burgIcons"));
    await page.locator("#mapToLoad").setInputFiles([]);
    await page.locator("#mapToLoad").setInputFiles({ name: "round-trip.map", mimeType: "text/plain", buffer });
    await page.waitForFunction(
      () => JSON.stringify(Layers.state.active.slice().sort()) === JSON.stringify(["burgIcons", "scaleBar"])
    );

    expect(await page.evaluate(() => Layers.state.active.slice().sort())).toEqual(["burgIcons", "scaleBar"]);
    await expect(page.locator("#layersPreset")).toHaveValue("custom");
  });
});
