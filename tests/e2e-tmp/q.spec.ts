import {test, expect} from "@playwright/test";

declare const options: any;
declare const style: any;
declare const pack: any;
declare const drawLabels: () => void;

const NOISE = /fonts.googleapis|google-analytics|googletagmanager|Failed to load resource|Name is too short|net::ERR/;
function watch(page: any, errors: string[]) {
  page.on("pageerror", (e: any) => errors.push("pageerror: " + e.message));
  page.on("console", (m: any) => { if (m.type() === "error" && !NOISE.test(m.text())) errors.push("console.error: " + m.text()); });
}
async function fresh(page: any, seed = "labels-test") {
  await page.goto(`/?seed=${seed}&width=1280&height=720`);
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 180000});
  await page.waitForTimeout(1200);
}

test("Q1: submap keeps icon stroke proportional", async ({page}) => {
  const errors: string[] = [];
  watch(page, errors);
  await fresh(page);

  const out = await page.evaluate(async () => {
    const w = window as any;
    const read = () => {
      const g = document.querySelector("#burgIcons > g#capital") as SVGGElement;
      const fs = Number(g.getAttribute("font-size"));
      const sw = Number(g.getAttribute("stroke-width"));
      return {fontSize: fs, strokeWidth: sw, visualStroke: +(sw * fs / 10).toFixed(4)};
    };
    const before = read();
    w.zoomTo(400, 300, 3, 0);
    await new Promise(r => setTimeout(r, 900));
    const usedScale = Number((0, eval)("scale"));
    await w.Controllers.SubmapTool.open();
    await new Promise(r => setTimeout(r, 600));
    const buttons = [...document.querySelectorAll(".ui-dialog:has(#submapTool) .ui-dialog-buttonpane button")] as HTMLElement[];
    buttons.find(b => b.textContent!.trim() === "Submap")!.click();
    await new Promise(r => setTimeout(r, 14000));
    return {before, after: read(), usedScale};
  });

  const ratio = (v: number, w: number) => +(v / w).toFixed(2);
  console.log("SUBMAP_STROKE", JSON.stringify({...out, fontSizeFactor: ratio(out.after.fontSize, out.before.fontSize), strokeFactor: ratio(out.after.strokeWidth, out.before.strokeWidth), visualFactor: ratio(out.after.visualStroke, out.before.visualStroke)}));
  // the map grew by usedScale: icon size scales with it, stroke-width stays, so the visual stroke grows once
  expect(ratio(out.after.fontSize, out.before.fontSize)).toBeCloseTo(out.usedScale, 1);
  expect(out.after.strokeWidth).toBeCloseTo(out.before.strokeWidth, 5);
  expect(ratio(out.after.visualStroke, out.before.visualStroke)).toBeCloseTo(out.usedScale, 1);
  expect(errors).toEqual([]);
});

test("Q2a: same seed reproduces the same map", async ({page}) => {
  const errors: string[] = [];
  watch(page, errors);
  const fingerprint = async () => {
    await fresh(page, "alea-check");
    return page.evaluate(() => {
      const burgs = pack.burgs.filter((b: any) => b.i && !b.removed);
      const states = pack.states.filter((s: any) => s.i && !s.removed);
      return {
        burgs: burgs.length,
        routes: pack.routes.length,
        namedRoutes: pack.routes.filter((r: any) => r.name).length,
        nameableRoutes: pack.routes.filter((r: any) => r.points.length >= 4).length,
        routeNames: pack.routes.slice(0, 5).map((r: any) => r.name),
        stateForms: states.slice(0, 4).map((s: any) => s.fullName),
        groupTally: burgs.reduce((acc: any, b: any) => ((acc[b.group] = (acc[b.group] || 0) + 1), acc), {}),
        markers: pack.markers?.length,
        zones: pack.zones?.length,
        religions: pack.religions?.filter((r: any) => r.i && !r.removed).length
      };
    });
  };
  const first = await fingerprint();
  const second = await fingerprint();
  console.log("REPRO_1", JSON.stringify(first));
  console.log("REPRO_2", JSON.stringify(second));
  expect(second).toEqual(first);
  expect(first.namedRoutes).toBeGreaterThan(0); // names are assigned at creation time
  expect(first.nameableRoutes).toBe(first.namedRoutes); // every route that can be named, is
  expect(errors).toEqual([]);
});

test("Q2b: route regeneration is randomized and keeps names", async ({page}) => {
  const errors: string[] = [];
  watch(page, errors);
  await fresh(page, "alea-check");
  const out = await page.evaluate(async () => {
    const w = window as any;
    const snapshot = () => ({
      count: pack.routes.length,
      named: pack.routes.filter((r: any) => r.name).length,
      nameable: pack.routes.filter((r: any) => r.points.length >= 4).length,
      firstNames: pack.routes.slice(0, 4).map((r: any) => r.name),
      pointsHash: pack.routes.reduce((sum: number, r: any) => sum + r.points.length, 0)
    });
    const before = snapshot();
    w.Routes.regenerate();
    await new Promise(r => setTimeout(r, 500));
    const firstRegen = snapshot();
    w.Routes.regenerate();
    await new Promise(r => setTimeout(r, 500));
    const secondRegen = snapshot();
    return {before, firstRegen, secondRegen};
  });
  console.log("REGEN", JSON.stringify(out, null, 1));
  expect(out.firstRegen.named).toBe(out.firstRegen.nameable); // names assigned on creation
  expect(out.secondRegen.named).toBe(out.secondRegen.nameable);
  // two regenerations must not produce identical route sets
  expect(JSON.stringify(out.secondRegen)).not.toBe(JSON.stringify(out.firstRegen));
  expect(errors).toEqual([]);
});

test("Q2c: route generation no longer shifts the downstream stream", async ({page}) => {
  const errors: string[] = [];
  watch(page, errors);
  await fresh(page, "alea-check");
  const out = await page.evaluate(async () => {
    const w = window as any;
    // what does the global Math.random look like after generation, and is the stream position stable?
    const draw = () => Math.random();
    const a = [draw(), draw(), draw()];
    w.Routes.generate(); // same call the generation flow makes
    const afterGenerate = [draw(), draw(), draw()];
    w.Routes.generate();
    const afterSecondGenerate = [draw(), draw(), draw()];
    return {a, afterGenerate, afterSecondGenerate, streamStableAcrossCalls: JSON.stringify(afterGenerate) === JSON.stringify(afterSecondGenerate)};
  });
  console.log("STREAM", JSON.stringify(out, null, 1));
  // generation reseeds, so the position after it is fixed - this is the stabilization working
  expect(out.streamStableAcrossCalls).toBe(true);
  expect(errors).toEqual([]);
});

test("Q3: preset without font-size and with a legacy absolute size", async ({page}) => {
  const errors: string[] = [];
  watch(page, errors);
  await fresh(page);
  const out = await page.evaluate(async () => {
    const w = window as any;
    const measure = (name: string) => {
      const el = document.getElementById(`labels-${name}`) as SVGGElement | null;
      const text = el?.querySelector("text");
      return {
        groupAttr: el?.getAttribute("font-size") ?? null,
        computedPx: text ? Number.parseFloat(getComputedStyle(text).fontSize) : null,
        stored: style.labels.groups[name]?.["font-size"] ?? null
      };
    };
    const baseline = measure("state");

    // a preset that omits font-size for the group
    w.applyStylePreset({"#labels > #state": {opacity: 1, fill: "#3e3e4b", "font-family": "Almendra SC"}});
    drawLabels();
    await new Promise(r => setTimeout(r, 400));
    const missing = measure("state");

    // a preset saved before v1.140.0: absolute data-size/font-size
    w.applyStylePreset({"#labels > #state": {opacity: 1, fill: "#3e3e4b", "data-size": 22, "font-size": 22, "font-family": "Almendra SC"}});
    drawLabels();
    await new Promise(r => setTimeout(r, 400));
    const legacy = measure("state");

    return {baseline, missing, legacy, labelsFontSize: document.getElementById("labels")?.getAttribute("font-size")};
  });
  console.log("PRESET", JSON.stringify(out, null, 1));
  expect(out.missing.groupAttr).toBe("22%"); // falls back to the state type default
  expect(out.missing.computedPx).toBeCloseTo(out.baseline.computedPx!, 0);
  expect(errors).toEqual([]);
});
