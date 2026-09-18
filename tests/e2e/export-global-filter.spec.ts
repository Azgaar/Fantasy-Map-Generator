import { test, expect } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

// Firefox ignores a filter set on the root svg element when the svg is rasterized through an image,
// so the raster export has to carry the global filter on #viewbox like the svg export does
test("raster export carries the global filter on #viewbox", async ({ page }) => {
  await page.goto("/?seed=test-export-filter&width=1280&height=720");
  await waitForMap(page);

  const result = await page.evaluate(async () => {
    document.getElementById("map")!.setAttribute("filter", "url(#filter-grayscale)");
    const url = await (window as any).Services.ExportMap.getMapURL("png");
    const text = await (await fetch(url)).text();
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    const root = doc.documentElement;

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const pixels: number[][] = [];
    for (const [x, y] of [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]]) {
      const [r, g, b] = ctx.getImageData(Math.round(img.width * x), Math.round(img.height * y), 1, 1).data;
      pixels.push([r, g, b]);
    }

    return {
      rootFilter: root.getAttribute("filter"),
      viewboxFilter: doc.getElementById("viewbox")?.getAttribute("filter"),
      scaleBarFilter: doc.getElementById("scaleBar")?.getAttribute("filter"),
      hasFilterDef: Boolean(doc.getElementById("filter-grayscale")),
      pixels
    };
  });

  expect(result.rootFilter).toBeNull();
  expect(result.viewboxFilter).toBe("url(#filter-grayscale)");
  expect(result.scaleBarFilter).toBe("url(#filter-grayscale)");
  expect(result.hasFilterDef).toBe(true);
  for (const [r, g, b] of result.pixels) {
    expect(Math.abs(r - g)).toBeLessThanOrEqual(1);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(1);
  }
});
