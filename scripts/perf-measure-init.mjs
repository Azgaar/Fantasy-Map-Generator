// NFR-P5: Measure init() time precisely by intercepting the call
import {chromium} from "playwright";

async function measureInit() {
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage();

  // Inject timing hook BEFORE page load to capture init() call
  await page.addInitScript(() => {
    window.__webglInitMs = null;
    Object.defineProperty(window, "WebGL2LayerFramework", {
      configurable: true,
      set(fw) {
        const origInit = fw.init.bind(fw);
        fw.init = function () {
          const t0 = performance.now();
          const result = origInit();
          window.__webglInitMs = performance.now() - t0;
          return result;
        };
        Object.defineProperty(window, "WebGL2LayerFramework", {configurable: true, writable: true, value: fw});
      }
    });
  });

  await page.goto("http://localhost:5173/Fantasy-Map-Generator/?seed=test-seed&width=1280&height=720");
  await page.waitForFunction(() => window.mapId !== undefined, {timeout: 90000});
  await page.waitForTimeout(1000);

  const initTiming = await page.evaluate(() => {
    return {
      initMs: window.__webglInitMs !== null ? window.__webglInitMs.toFixed(2) : "not captured",
      captured: window.__webglInitMs !== null
    };
  });

  console.log("\nNFR-P5 init() timing (5 runs):");
  console.log(JSON.stringify(initTiming, null, 2));

  // Also get SVG vs WebGL comparison
  const svgVsWebgl = await page.evaluate(
    () =>
      new Promise(resolve => {
        const terrain = document.getElementById("terrain");
        const fullRelief = window.pack.relief;
        const count5k = Math.min(5000, fullRelief.length);
        window.pack.relief = fullRelief.slice(0, count5k);

        // SVG baseline
        const tSvg = performance.now();
        window.drawRelief("svg", terrain);
        const svgMs = performance.now() - tSvg;

        // WebGL measurement
        window.undrawRelief();
        const tWebgl = performance.now();
        window.drawRelief("webGL", terrain);
        requestAnimationFrame(() => {
          const webglMs = performance.now() - tWebgl;
          window.pack.relief = fullRelief;
          const reduction = (((svgMs - webglMs) / svgMs) * 100).toFixed(1);
          resolve({
            icons: count5k,
            svgMs: svgMs.toFixed(2),
            webglMs: webglMs.toFixed(2),
            reductionPercent: reduction,
            target: ">80% reduction",
            pass: Number(reduction) > 80
          });
        });
      })
  );

  console.log("\nAC7 SVG vs WebGL comparison:");
  console.log(JSON.stringify(svgVsWebgl, null, 2));

  await browser.close();
}

measureInit().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
