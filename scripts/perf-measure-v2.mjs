// Story 3.1 - Performance Measurement v2
// Calls WebGL2LayerFramework.init() explicitly before measuring.
import {chromium} from "playwright";

async function measure() {
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage();

  await page.goto("http://localhost:5173/Fantasy-Map-Generator/?seed=test-seed&width=1280&height=720");
  await page.waitForFunction(() => window.mapId !== undefined, {timeout: 90000});
  await page.waitForTimeout(2000);
  console.log("Map ready.");

  // NFR-P5: Call init() cold and time it
  const nfrP5 = await page.evaluate(() => {
    const t0 = performance.now();
    const ok = window.WebGL2LayerFramework.init();
    const ms = performance.now() - t0;
    return {initMs: ms.toFixed(2), initSucceeded: ok, hasFallback: window.WebGL2LayerFramework.hasFallback};
  });
  console.log("NFR-P5 init():", JSON.stringify(nfrP5));
  await page.waitForTimeout(500);

  // Generate icons
  await page.evaluate(() => {
    if (window.generateReliefIcons) window.generateReliefIcons();
  });
  const reliefCount = await page.evaluate(() => window.pack?.relief?.length ?? 0);
  const terrainEl = await page.evaluate(() => !!document.getElementById("terrain"));
  console.log("icons=" + reliefCount + " terrain=" + terrainEl + " initOk=" + nfrP5.initSucceeded);

  if (terrainEl && reliefCount > 0 && nfrP5.initSucceeded) {
    // NFR-P1: drawRelief 1k icons
    const p1 = await page.evaluate(
      () =>
        new Promise(res => {
          const full = window.pack.relief;
          window.pack.relief = full.slice(0, 1000);
          const el = document.getElementById("terrain");
          const t0 = performance.now();
          window.drawRelief("webGL", el);
          requestAnimationFrame(() => {
            res({icons: 1000, ms: (performance.now() - t0).toFixed(2)});
            window.pack.relief = full;
          });
        })
    );
    console.log("NFR-P1:", JSON.stringify(p1));

    // NFR-P2: drawRelief up to 10k icons
    const p2 = await page.evaluate(
      () =>
        new Promise(res => {
          const full = window.pack.relief;
          const c = Math.min(10000, full.length);
          window.pack.relief = full.slice(0, c);
          const el = document.getElementById("terrain");
          const t0 = performance.now();
          window.drawRelief("webGL", el);
          requestAnimationFrame(() => {
            res({icons: c, ms: (performance.now() - t0).toFixed(2)});
            window.pack.relief = full;
          });
        })
    );
    console.log("NFR-P2:", JSON.stringify(p2));
  }

  // NFR-P3: setVisible toggle (O(1) group.visible flip)
  const p3 = await page.evaluate(() => {
    const t = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      window.WebGL2LayerFramework.setVisible("terrain", i % 2 === 0);
      t.push(performance.now() - t0);
    }
    t.sort((a, b) => a - b);
    return {p50: t[10].toFixed(4), max: t[t.length - 1].toFixed(4), samples: t.length};
  });
  console.log("NFR-P3 setVisible:", JSON.stringify(p3));

  // NFR-P4: requestRender scheduling latency (zoom path proxy)
  const p4 = await page.evaluate(() => {
    const t = [];
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      window.WebGL2LayerFramework.requestRender();
      t.push(performance.now() - t0);
    }
    const avg = t.reduce((a, b) => a + b, 0) / t.length;
    return {avgMs: avg.toFixed(4), maxMs: Math.max(...t).toFixed(4)};
  });
  console.log("NFR-P4 zoom proxy:", JSON.stringify(p4));

  // NFR-P6: structural check — setVisible must NOT call clearLayer/dispose
  const p6 = await page.evaluate(() => {
    const src = window.WebGL2LayerFramework.setVisible.toString();
    const ok = !src.includes("clearLayer") && !src.includes("dispose");
    return {
      verdict: ok ? "PASS" : "FAIL",
      callsClearLayer: src.includes("clearLayer"),
      callsDispose: src.includes("dispose")
    };
  });
  console.log("NFR-P6 GPU state:", JSON.stringify(p6));

  // AC7: SVG vs WebGL comparison (5k icons)
  if (terrainEl && reliefCount >= 100 && nfrP5.initSucceeded) {
    const ac7 = await page.evaluate(
      () =>
        new Promise(res => {
          const full = window.pack.relief;
          const c = Math.min(5000, full.length);
          window.pack.relief = full.slice(0, c);
          const el = document.getElementById("terrain");

          const tSvg = performance.now();
          window.drawRelief("svg", el);
          const svgMs = performance.now() - tSvg;

          el.innerHTML = "";
          if (window.undrawRelief) window.undrawRelief();

          const tW = performance.now();
          window.drawRelief("webGL", el);
          requestAnimationFrame(() => {
            const wMs = performance.now() - tW;
            window.pack.relief = full;
            const pct = svgMs > 0 ? (((svgMs - wMs) / svgMs) * 100).toFixed(1) : "N/A";
            res({
              icons: c,
              svgMs: svgMs.toFixed(2),
              webglMs: wMs.toFixed(2),
              reductionPct: pct,
              pass: Number(pct) > 80
            });
          });
        })
    );
    console.log("AC7 SVG vs WebGL:", JSON.stringify(ac7));
  }

  await browser.close();
  console.log("Done.");
}

measure().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
