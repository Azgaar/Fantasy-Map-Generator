import { expect, test } from "@playwright/test";

test("auto-fitted state labels retain full names and readable sizes", async ({ page }) => {
  await page.goto("/?seed=test-seed&width=1280&height=720");
  await page.waitForFunction(() => (window as typeof window & { mapId?: number }).mapId !== undefined, {
    timeout: 60000
  });

  const labels = await page.locator("#labels > [data-group='state'] > text > textPath").evaluateAll(textPaths =>
    textPaths.map(textPath => ({
      lines: textPath.querySelectorAll("tspan").length,
      fontSize: Number.parseFloat(textPath.getAttribute("font-size") || "")
    }))
  );

  expect(labels).toHaveLength(17);
  expect(labels.filter(label => label.lines > 1)).toHaveLength(13);
  expect(labels.filter(label => label.fontSize === 50)).toHaveLength(2);
});

test("bulk redraw preserves custom State Label Groups", async ({ page }) => {
  await page.goto("/?seed=test-seed&width=1280&height=720");
  await page.waitForFunction(() => (window as typeof window & { mapId?: number }).mapId !== undefined, {
    timeout: 60000
  });

  const parentGroup = await page.evaluate(() => {
    options.labels.groups.push({
      name: "shared",
      type: "state",
      active: true,
      layerDependency: null,
      zoom: { min: null, max: null },
      mode: "auto"
    });
    style.labels.groups.shared = { ...style.labels.groups.state };
    pack.states[1].label = { ...pack.states[1].label, group: "shared" };
    drawLabels();
    return document.getElementById("stateLabel1")?.parentElement?.id;
  });

  expect(parentGroup).toBe("labels-shared");
});

test("Province labels use generic groups, preserve overrides, and follow the Provinces layer", async ({ page }) => {
  await page.goto("/?seed=test-seed&width=1280&height=720");
  await page.waitForFunction(() => (window as typeof window & { mapId?: number }).mapId !== undefined, {
    timeout: 60000
  });

  const result = await page.evaluate(() => {
    const province = pack.provinces.find(province => province.i && !province.removed)!;
    province.label = { ...province.label, text: "The Reach" };
    drawLabels();
    const label = document.getElementById(`provinceLabel${province.i}`);
    const group = label?.parentElement;
    const hasLegacyContainer = Boolean(document.getElementById("provinceLabels"));

    turnButtonOff("toggleProvinces");
    window.renderViewportLayersNow();

    return {
      text: label?.textContent?.trim(),
      type: label?.dataset.labelType,
      id: label?.dataset.id,
      group: group?.dataset.group,
      materializedWithoutProvinces: Boolean(document.getElementById(`provinceLabel${province.i}`)),
      hasLegacyContainer
    };
  });

  expect(result).toMatchObject({
    text: "The Reach",
    type: "province",
    group: "province",
    materializedWithoutProvinces: false,
    hasLegacyContainer: false
  });
  expect(Number(result.id)).toBeGreaterThan(0);
});
