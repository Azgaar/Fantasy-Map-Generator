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

describe("timed tips", () => {
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const line = () => document.getElementById("tooltip")!.textContent;

  test("a timed tip clears itself when nothing replaced it", async () => {
    document.body.innerHTML = '<div id="tooltip"></div>';
    const { tip } = await import("./tooltips");
    tip("Apply Astral naming under Tools", false, "info", 10);
    await wait(40);
    expect(line()).toBe("");
  });

  test("a hover tip that replaced a timed one survives its expiry", async () => {
    document.body.innerHTML = '<div id="tooltip"></div>';
    const { tip } = await import("./tooltips");
    tip("Apply Astral naming under Tools", false, "info", 10);
    tip("G-class yellow dwarf. Click to edit"); // a transient hover tip takes over the line
    await wait(40);
    expect(line()).toContain("G-class");
  });
});
