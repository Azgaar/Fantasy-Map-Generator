// AC7 detailed icon count comparison
import {chromium} from "playwright";

async function measure() {
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage();

  await page.goto("http://localhost:5173/Fantasy-Map-Generator/?seed=test-seed&width=1280&height=720");
  await page.waitForFunction(() => window.mapId !== undefined, {timeout: 90000});
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    window.WebGL2LayerFramework.init();
    if (window.generateReliefIcons) window.generateReliefIcons();
  });
  await page.waitForTimeout(500);

  const counts = [1000, 2000, 3000, 5000, 7000];
  for (const n of counts) {
    const result = await page.evaluate(
      count =>
        new Promise(res => {
          const full = window.pack.relief;
          const c = Math.min(count, full.length);
          if (c < count * 0.5) {
            res({skip: true, available: c});
            return;
          }
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
            res({icons: c, svgMs: svgMs.toFixed(2), webglMs: wMs.toFixed(2), reductionPct: pct});
          });
        }),
      n
    );
    if (!result.skip) console.log(`n=${n}: ${JSON.stringify(result)}`);
  }

  await browser.close();
}

measure().catch(e => {
  console.error(e.message);
  process.exit(1);
});
