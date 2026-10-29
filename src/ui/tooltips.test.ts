// @vitest-environment jsdom
import { describe, expect, test } from "vitest";

describe("data tips", () => {
  test("a lock icon tells whether it is locked", async () => {
    document.body.innerHTML = '<div id="tooltip"></div><span class="icon-lock" data-lock-tip></span>';
    const { showDataTip } = await import("./tooltips");
    const lock = document.querySelector<HTMLElement>("[data-lock-tip]")!;

    showDataTip({ target: lock } as unknown as Event);
    expect(document.getElementById("tooltip")!.textContent).toMatch(/^Locked/);

    lock.className = "icon-lock-open";
    showDataTip({ target: lock } as unknown as Event);
    expect(document.getElementById("tooltip")!.textContent).toMatch(/^Unlocked/);
  });

  const cutTo = (element: HTMLElement, contentWidth: number) => {
    Object.defineProperty(element, "scrollWidth", { value: contentWidth });
    Object.defineProperty(element, "clientWidth", { value: 50 });
  };

  test("a cut value leads the tip", async () => {
    document.body.innerHTML =
      '<div id="tooltip"></div><input data-tip="Religion supreme deity" value="Ligagosh <the> Supreme" style="overflow-x: hidden" />';
    const { showDataTip } = await import("./tooltips");
    const input = document.querySelector("input")!;

    cutTo(input, 120);
    showDataTip({ target: input } as unknown as Event);
    expect(document.getElementById("tooltip")!.textContent).toBe("Ligagosh <the> Supreme. Religion supreme deity");
  });

  test("a value that fits or spills over visibly is not repeated", async () => {
    document.body.innerHTML =
      '<div id="tooltip"></div><input data-tip="Deity" value="Ra" style="overflow-x: hidden" /><div data-tip="Area">167K mi²</div>';
    const { showDataTip } = await import("./tooltips");
    const tooltip = document.getElementById("tooltip")!;

    const input = document.querySelector("input")!;
    cutTo(input, 50);
    showDataTip({ target: input } as unknown as Event);
    expect(tooltip.textContent).toBe("Deity");

    const area = document.querySelector<HTMLElement>("div[data-tip]")!;
    cutTo(area, 120);
    showDataTip({ target: area } as unknown as Event);
    expect(tooltip.textContent).toBe("Area");
  });

  test("a cut label already named by the tip is not repeated", async () => {
    document.body.innerHTML =
      '<div id="tooltip"></div><div data-tip="Click to sort by Asentamientos"><span style="overflow-x: hidden">Asentamientos</span></div>';
    const { showDataTip } = await import("./tooltips");
    const label = document.querySelector("span")!;

    cutTo(label, 120);
    showDataTip({ target: label } as unknown as Event);
    expect(document.getElementById("tooltip")!.textContent).toBe("Click to sort by Asentamientos");
  });
});

describe("pinned tips", () => {
  const tooltip = () => document.getElementById("tooltip")!;

  test("an overlay puts the covered pinned tip back", async () => {
    document.body.innerHTML = '<div id="tooltip"></div>';
    const { tip, overlayMainTip } = await import("./tooltips");
    tip("Edit mode is active", true);

    const restore = overlayMainTip("Loading…");
    expect(tooltip().textContent).toBe("Loading…");

    restore();
    expect(tooltip().textContent).toBe("Edit mode is active");
    expect(tooltip().dataset.main).toBe("Edit mode is active");
  });

  test("an overlay leaves a tip pinned after it alone", async () => {
    document.body.innerHTML = '<div id="tooltip"></div>';
    const { tip, overlayMainTip } = await import("./tooltips");
    tip("Edit mode is active", true);

    const restore = overlayMainTip("Loading…");
    tip("Click on the map to place a burg", true);
    restore();
    expect(tooltip().textContent).toBe("Click on the map to place a burg");
  });

  test("an overlay does not bring back a timed tip", async () => {
    document.body.innerHTML = '<div id="tooltip"></div>';
    const { tip, overlayMainTip } = await import("./tooltips");
    tip("Screenshot saved", true, "success", 5000);

    overlayMainTip("Loading…")();
    expect(tooltip().textContent).toBe("");
  });

  test("a lazy load keeps the pinned tip", async () => {
    document.body.innerHTML = '<div id="tooltip"></div>';
    const { tip, loadingTip } = await import("./tooltips");
    tip("Edit mode is active", true);

    loadingTip.start();
    loadingTip.end();
    expect(tooltip().textContent).toBe("Edit mode is active");
  });
});
