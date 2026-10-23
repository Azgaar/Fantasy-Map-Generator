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
