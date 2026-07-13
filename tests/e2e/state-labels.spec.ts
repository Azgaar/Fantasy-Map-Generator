import {test, expect} from "@playwright/test";

test.describe("State labels", () => {
  test.beforeEach(async ({context, page}) => {
    await context.clearCookies();

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Navigate with seed parameter and wait for full load
    await page.goto("/?seed=test-state-labels&width=1280&height=720");

    // Wait for map generation to complete
    await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});

    // Additional wait for any rendering/animations to settle
    await page.waitForTimeout(500);
  });

  test("state labels are fitted and rendered from data after generation", async ({page}) => {
    const result = await page.evaluate(() => {
      const {pack} = window as any;
      const stateLabels = pack.labels.filter((l: any) => l.type === "state");
      const validLabels = stateLabels.filter((l: any) => {
        const state = pack.states[l.stateId];
        return state?.i && !state.removed;
      });
      return {
        stateLabelCount: validLabels.length,
        fittedCount: validLabels.filter((l: any) => l.pathPoints?.length && l.text && l.fontSize).length,
        domTextCount: document.querySelectorAll("g#labels > g#states > text").length,
        measurementLeftover: !!document.getElementById("labelMeasurement")
      };
    });

    expect(result.stateLabelCount).toBeGreaterThan(0);
    expect(result.fittedCount).toBe(result.stateLabelCount);
    expect(result.domTextCount).toBe(result.stateLabelCount);
    expect(result.measurementLeftover).toBe(false);
  });

  test("fitStateLabels only updates data; drawStateLabels renders it", async ({page}) => {
    const afterFit = await page.evaluate(() => {
      const {pack, fitStateLabels} = window as any;
      const label = pack.labels.find((l: any) => l.type === "state" && pack.states[l.stateId]?.i);
      const state = pack.states[label.stateId];
      state.name = "Testland";
      state.fullName = "Kingdom of Testland";

      const textElement = document.getElementById(`pathLabel${label.i}`)!;
      const domBefore = textElement.outerHTML;
      const pathBefore = document.getElementById(`textPath_pathLabel${label.i}`)!.getAttribute("d");

      fitStateLabels([label.stateId]);

      return {
        labelI: label.i,
        stateId: label.stateId,
        dataText: label.text,
        domUnchanged: document.getElementById(`pathLabel${label.i}`)!.outerHTML === domBefore,
        pathUnchanged: document.getElementById(`textPath_pathLabel${label.i}`)!.getAttribute("d") === pathBefore,
        measurementLeftover: !!document.getElementById("labelMeasurement")
      };
    });

    // fitting stored the new name in data but did not touch the rendered elements
    expect(afterFit.dataText).toContain("Testland");
    expect(afterFit.domUnchanged).toBe(true);
    expect(afterFit.pathUnchanged).toBe(true);
    expect(afterFit.measurementLeftover).toBe(false);

    const afterDraw = await page.evaluate(({labelI, stateId}: {labelI: number; stateId: number}) => {
      const {pack, drawStateLabels} = window as any;
      drawStateLabels([stateId]);
      const label = pack.labels.find((l: any) => l.i === labelI);
      const textElement = document.getElementById(`pathLabel${labelI}`)!;
      return {
        domText: textElement.textContent,
        dataText: label.text.split("|").join("")
      };
    }, afterFit);

    expect(afterDraw.domText).toBe(afterDraw.dataText);
    expect(afterDraw.domText).toContain("Testland");
  });

  test("fitting works while the labels layer is hidden", async ({page}) => {
    const result = await page.evaluate(() => {
      const {pack, fitStateLabels} = window as any;
      const label = pack.labels.filter((l: any) => l.type === "state" && pack.states[l.stateId]?.i).at(-1);
      const labelsLayer = document.getElementById("labels")!;

      labelsLayer.style.display = "none";
      fitStateLabels([label.stateId]);
      const hidden = {text: label.text, fontSize: label.fontSize, pathPoints: label.pathPoints};

      labelsLayer.style.display = "";
      fitStateLabels([label.stateId]);
      const visible = {text: label.text, fontSize: label.fontSize, pathPoints: label.pathPoints};

      return {
        hidden: JSON.parse(JSON.stringify(hidden)),
        visible: JSON.parse(JSON.stringify(visible)),
        displayRestored: labelsLayer.style.display !== "none"
      };
    });

    expect(result.hidden).toEqual(result.visible);
    expect(result.hidden.fontSize).toBeGreaterThan(0);
    expect(result.displayRestored).toBe(true);
  });

  test("regenerating state labels refits and redraws all labels", async ({page}) => {
    const result = await page.evaluate(() => {
      const {pack, Labels, drawStateLabels} = window as any;
      Labels.generateStateLabels();
      const unfittedBeforeDraw = pack.labels.filter((l: any) => l.type === "state" && !l.pathPoints?.length).length;

      drawStateLabels();

      const validLabels = pack.labels.filter((l: any) => {
        if (l.type !== "state") return false;
        const state = pack.states[l.stateId];
        return state?.i && !state.removed;
      });
      return {
        unfittedBeforeDraw,
        validCount: validLabels.length,
        fittedCount: validLabels.filter((l: any) => l.pathPoints?.length).length,
        domTextCount: document.querySelectorAll("g#labels > g#states > text").length,
        measurementLeftover: !!document.getElementById("labelMeasurement")
      };
    });

    // generateStateLabels resets fitting, drawStateLabels lazily refits everything
    expect(result.unfittedBeforeDraw).toBe(result.validCount);
    expect(result.fittedCount).toBe(result.validCount);
    expect(result.domTextCount).toBe(result.validCount);
    expect(result.measurementLeftover).toBe(false);
  });
});
