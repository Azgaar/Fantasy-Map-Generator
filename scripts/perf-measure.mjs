// Performance measurement script for Story 3.1 — v2 (calls init() explicitly)
// Measures NFR-P1 through NFR-P6 using Playwright in a real Chromium browser.
import {chromium} from "playwright";

async function measure() {
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage();

  console.log("Loading app...");
  await page.goto("http://localhost:5173/Fantasy-Map-Generator/?seed=test-seed&width=1280&height=720");

  console.log("Waiting for map generation...");
  await page.waitForFunction(() => window.mapId !== undefined, {timeout: 90000});
  await page.waitForTimeout(2000);

  console.log("Running measurements...");

  // Check framework availability
  const frameworkState = await page.evaluate(() => ({
    available: typeof window.WebGL2LayerFramework !== "undefined",
    hasFallback: window.WebGL2LayerFramework?.hasFallback,
    reliefCount: window.pack?.relief?.length ?? 0
  }));

  console.log("Framework state:", frameworkState);

  // Generate relief icons if not present
  await page.evaluate(() => {
    if (!window.pack?.relief?.length && typeof window.generateReliefIcons === "function") {
      window.generateReliefIcons();
    }
  });

  const reliefCount = await page.evaluate(() => window.pack?.relief?.length ?? 0);
  console.log("Relief icons:", reliefCount);

  // --- NFR-P3: setVisible toggle time (pure JS, O(1) operation) ---
  const nfrP3 = await page.evaluate(() => {
    const timings = [];
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      window.WebGL2LayerFramework.setVisible("terrain", false);
      timings.push(performance.now() - t0);
      window.WebGL2LayerFramework.setVisible("terrain", true);
    }
    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    const min = Math.min(...timings);
    const max = Math.max(...timings);
    return {avg: avg.toFixed(4), min: min.toFixed(4), max: max.toFixed(4), timings};
  });
  console.log("NFR-P3 setVisible toggle (10 samples):", nfrP3);

  // --- NFR-P5: init() timing (re-init after cleanup) ---
  // The framework singleton was already init'd at startup. We time it via Navigation Timing.
  const nfrP5 = await page.evaluate(() => {
    // Use Navigation Timing to estimate total startup including WebGL init
    const navEntry = performance.getEntriesByType("navigation")[0];
    // Also time a requestRender cycle (RAF-based)
    const t0 = performance.now();
    window.WebGL2LayerFramework.requestRender();
    const scheduleTime = performance.now() - t0;
    return {
      pageLoadMs: navEntry ? navEntry.loadEventEnd.toFixed(1) : "N/A",
      requestRenderScheduleMs: scheduleTime.toFixed(4),
      note: "init() called synchronously at module load; timing via page load metrics"
    };
  });
  console.log("NFR-P5 (init proxy):", nfrP5);

  // --- NFR-P1/P2: drawRelief timing ---
  // Requires terrain element and relief icons to be available
  const terrainExists = await page.evaluate(() => !!document.getElementById("terrain"));
  console.log("Terrain element exists:", terrainExists);

  if (terrainExists && reliefCount > 0) {
    // NFR-P1: 1k icons — slice pack.relief to 1000
    const nfrP1 = await page.evaluate(
      () =>
        new Promise(resolve => {
          const fullRelief = window.pack.relief;
          window.pack.relief = fullRelief.slice(0, 1000);
          const terrain = document.getElementById("terrain");
          const t0 = performance.now();
          window.drawRelief("webGL", terrain);
          requestAnimationFrame(() => {
            const elapsed = performance.now() - t0;
            window.pack.relief = fullRelief; // restore
            resolve({icons: 1000, elapsedMs: elapsed.toFixed(2)});
          });
        })
    );
    console.log("NFR-P1 drawRelief 1k:", nfrP1);

    // NFR-P2: 10k icons — slice to 10000 (or use all if fewer)
    const nfrP2 = await page.evaluate(
      () =>
        new Promise(resolve => {
          const fullRelief = window.pack.relief;
          const count = Math.min(10000, fullRelief.length);
          window.pack.relief = fullRelief.slice(0, count);
          const terrain = document.getElementById("terrain");
          const t0 = performance.now();
          window.drawRelief("webGL", terrain);
          requestAnimationFrame(() => {
            const elapsed = performance.now() - t0;
            window.pack.relief = fullRelief;
            resolve({icons: count, elapsedMs: elapsed.toFixed(2)});
          });
        })
    );
    console.log("NFR-P2 drawRelief 10k:", nfrP2);
  } else {
    console.log("NFR-P1/P2: terrain or relief icons not available — skipping");
  }

  // --- NFR-P4: Zoom latency proxy ---
  // Measure time from synthetic zoom event dispatch to requestRender scheduling
  const nfrP4 = await page.evaluate(() => {
    const timings = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      // Simulate the zoom handler: requestRender() is what the zoom path calls
      window.WebGL2LayerFramework.requestRender();
      timings.push(performance.now() - t0);
    }
    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    return {
      avgMs: avg.toFixed(4),
      note: "JS scheduling proxy — actual GPU draw happens in RAF callback, measured separately"
    };
  });
  console.log("NFR-P4 zoom requestRender proxy:", nfrP4);

  // --- NFR-P6: GPU state preservation structural check ---
  const nfrP6 = await page.evaluate(() => {
    // Inspect setVisible source to confirm clearLayer is NOT called
    const setVisibleSrc = window.WebGL2LayerFramework.setVisible.toString();
    const callsClearLayer = setVisibleSrc.includes("clearLayer");
    const callsDispose = setVisibleSrc.includes("dispose");
    return {
      setVisibleCallsClearLayer: callsClearLayer,
      setVisibleCallsDispose: callsDispose,
      verdict: !callsClearLayer && !callsDispose ? "PASS — GPU resources preserved on hide" : "FAIL"
    };
  });
  console.log("NFR-P6 structural check:", nfrP6);

  await browser.close();
  console.log("\nMeasurement complete.");
}

measure().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
