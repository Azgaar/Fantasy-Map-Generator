import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?seed=viewport-labels-1464&width=1280&height=720");
  await page.waitForFunction(() => (window as typeof window & { mapId?: number }).mapId !== undefined, {
    timeout: 60000
  });
});

test("live labels are a viewport subset while save and full export contain the complete scene", async ({ page }) => {
  await page.evaluate(() => setMapZoom(9));
  await page.waitForFunction(() => Math.abs(scale - 9) < 0.01);
  await page.waitForTimeout(100);

  const counts = await page.evaluate(async () => {
    const live = countLabels(document);
    const mapData = await Services.Save.prepareMapData();
    const saved = new DOMParser().parseFromString(mapData.split("\r\n")[5], "image/svg+xml");
    const savedCounts = countLabels(saved);

    const url = await Services.ExportMap.getMapURL("svg", { fullMap: true });
    const exported = new DOMParser().parseFromString(await (await fetch(url)).text(), "image/svg+xml");
    URL.revokeObjectURL(url);

    return { live, saved: savedCounts, exported: countLabels(exported), expected: expectedCounts() };

    function countLabels(root: ParentNode) {
      return {
        text: root.querySelectorAll("#labels text[data-label-type]").length,
        paths: root.querySelectorAll("#textPaths path[data-label-type]").length
      };
    }

    function expectedCounts() {
      const states = pack.states.filter(entity => entity.i && !entity.removed).length;
      const provinces = pack.provinces.filter(entity => entity.i && !entity.removed).length;
      const burgs = pack.burgs.filter(entity => entity.i && !entity.removed).length;
      const rivers = pack.rivers.filter(entity => entity.cells.length > 1 && entity.name).length;
      const routes = pack.routes.filter(entity => entity.points.length > 1 && entity.name).length;
      return {
        text: states + provinces + burgs + rivers + routes + pack.labels.length,
        paths: states + rivers + routes + pack.labels.length
      };
    }
  });

  expect(counts.saved).toEqual(counts.expected);
  expect(counts.exported).toEqual(counts.expected);
  expect(counts.live.text).toBeLessThan(counts.expected.text * 0.2);
  expect(counts.live.paths).toBeLessThan(counts.expected.paths);
});

test("the editor pins an off-viewport or out-of-LOD label until the editor closes", async ({ page }) => {
  await page.evaluate(() => setMapZoom(9));
  await page.waitForFunction(() => Math.abs(scale - 9) < 0.01);
  await page.waitForTimeout(100);

  const result = await page.evaluate(() => {
    const state = pack.states.find(entity => entity.i && !entity.removed)!;
    const id = `stateLabel${state.i}`;
    const absentBefore = !document.getElementById(id);
    void Controllers.LabelsEditor.open({ type: "state", id: state.i });
    const presentWhileEditing = Boolean(document.getElementById(id));
    $("#labelEditor").dialog("close");
    const absentAfter = !document.getElementById(id);
    return { absentBefore, presentWhileEditing, absentAfter };
  });

  expect(result).toEqual({ absentBefore: true, presentWhileEditing: true, absentAfter: true });
});
