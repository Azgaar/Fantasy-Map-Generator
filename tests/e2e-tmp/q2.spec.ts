import {test} from "@playwright/test";
declare const pack: any;

test("does route regeneration change geometry or only names?", async ({page}) => {
  await page.goto("/?seed=alea-check&width=1280&height=720");
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 180000});
  await page.waitForTimeout(1200);
  const out = await page.evaluate(async () => {
    const w = window as any;
    const geometry = () => JSON.stringify(pack.routes.slice(0, 3).map((r: any) => r.points.map((p: number[]) => p[2])));
    const names = () => JSON.stringify(pack.routes.slice(0, 3).map((r: any) => r.name));
    const before = {geometry: geometry(), names: names()};
    w.Routes.regenerate();
    await new Promise(r => setTimeout(r, 400));
    const after = {geometry: geometry(), names: names()};
    return {
      geometryChanged: before.geometry !== after.geometry,
      namesChanged: before.names !== after.names,
      sampleBefore: before.names.slice(0, 90),
      sampleAfter: after.names.slice(0, 90)
    };
  });
  console.log("REGEN_SCOPE", JSON.stringify(out, null, 1));
});
