import { test, expect } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

// Firefox ignores a filter set on the root svg element when the svg is rasterized through an image,
// so exports apply it to an untransformed group containing the map and viewport overlays
test("zoomed-out raster export filters the map and overlays without clipping", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 540 });
  await page.goto("/?seed=test-export-filter&width=1920&height=911");
  await waitForMap(page);

  const result = await page.evaluate(async () => {
    const app = window as unknown as {
      resetZoom(duration: number): void;
      Services: { ExportMap: { getMapURL(type: string): Promise<string> } };
    };
    app.resetZoom(0);
    document.getElementById("map")!.setAttribute("filter", "url(#filter-grayscale)");
    const scale = document.querySelector<SVGGElement>("#viewbox")!.transform.baseVal.consolidate()!.matrix.a;
    const url = await app.Services.ExportMap.getMapURL("png");
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
      pixels.push(Array.from(ctx.getImageData(Math.round(img.width * x), Math.round(img.height * y), 1, 1).data));
    }

    return {
      scale,
      rootFilter: root.getAttribute("filter"),
      wrapperFilter: doc.getElementById("viewbox")?.parentElement?.getAttribute("filter"),
      sharedWrapper: doc.getElementById("viewbox")?.parentElement === doc.getElementById("scaleBar")?.parentElement,
      viewboxFilter: doc.getElementById("viewbox")?.getAttribute("filter"),
      scaleBarFilter: doc.getElementById("scaleBar")?.getAttribute("filter"),
      hasFilterDef: Boolean(doc.getElementById("filter-grayscale")),
      pixels
    };
  });

  expect(result.scale).toBeLessThan(1);
  expect(result.rootFilter).toBeNull();
  expect(result.wrapperFilter).toBe("url(#filter-grayscale)");
  expect(result.sharedWrapper).toBe(true);
  expect(result.viewboxFilter).toBeNull();
  expect(result.scaleBarFilter).toBeNull();
  expect(result.hasFilterDef).toBe(true);
  for (const [r, g, b, a] of result.pixels) {
    expect(a).toBe(255);
    expect(Math.abs(r - g)).toBeLessThanOrEqual(1);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(1);
  }
});
