import { test, expect, Page } from "@playwright/test";

// Tour step titles in order — used to verify we're on the right step.
const STEP_TITLES = [
  "Welcome to Fantasy Map Generator", // 0
  "Navigate the Map",                  // 1
  "Hover Tooltips",                    // 2
  "Open the Options Menu",             // 3
  "Layers Tab",                        // 4
  "Layer Presets",                     // 5
  "Toggle Individual Layers",          // 6
  "Style Tab",                         // 7
  "Style Presets",                     // 8
  "Individual Style Settings",         // 9
  "Options Tab",                       // 10
  "Generation Options",                // 11
  "Configure World",                   // 12
  "World Configurator",                // 13
  "Tools Tab",                         // 14
  "Edit the Heightmap",                // 15
  "Heightmap Editor",                  // 16
  "About Tab",                         // 17
  "About & Resources",                 // 18
  "Export",                            // 19
  "Export Options",                    // 20
  "Save and Load Maps",                // 21
];

async function waitForMapLoad(page: Page) {
  await page.waitForFunction(() => (window as any).mapId !== undefined, {
    timeout: 60000,
  });
  await page.waitForTimeout(500);
}

async function popoverTitle(page: Page): Promise<string> {
  return (await page.locator(".driver-popover-title").innerText()).trim();
}

/** Click Next and wait for the popover title to become expectedTitle. */
async function nextStep(page: Page, expectedTitle: string) {
  await page.locator(".driver-popover-next-btn").click();
  await page.waitForFunction(
    (title: string) => document.querySelector(".driver-popover-title")?.textContent?.trim() === title,
    expectedTitle,
    { timeout: 5000 },
  );
}

/** Click Previous and wait for the popover title to become expectedTitle. */
async function prevStep(page: Page, expectedTitle: string) {
  await page.locator(".driver-popover-prev-btn").click();
  await page.waitForFunction(
    (title: string) => document.querySelector(".driver-popover-title")?.textContent?.trim() === title,
    expectedTitle,
    { timeout: 5000 },
  );
}

/** Click Next N times with a fixed delay — used for bulk advancing where we
 *  don't need to assert intermediate titles. */
async function advanceSteps(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    await page.locator(".driver-popover-next-btn").click();
    await page.waitForTimeout(400);
  }
}

test.describe("UI Tour", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/?seed=test-tour&width=1280&height=720");
    await waitForMapLoad(page);
  });

  // ── Static registration ────────────────────────────────────────────────────

  test("UITour global is registered with a start method", async ({ page }) => {
    const ok = await page.evaluate(
      () =>
        typeof (window as any).UITour === "object" &&
        typeof (window as any).UITour.start === "function",
    );
    expect(ok).toBe(true);
  });

  test("tour trigger button is present and labelled in the About tab", async ({
    page,
  }) => {
    await page.locator("#optionsTrigger").click();
    await page.locator("#aboutTab").click();
    const btn = page.locator("#startTourButton");
    await expect(btn).toBeVisible();
    await expect(btn).toContainText("Tour");
  });

  // ── Tour start ─────────────────────────────────────────────────────────────

  test("starting the tour closes options panel and shows first step", async ({
    page,
  }) => {
    // Open options panel first, then verify the tour closes it.
    await page.locator("#optionsTrigger").click();
    await expect(page.locator("#options")).toBeVisible();

    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // driver.js marks body with driver-active while tour is running.
    await expect(page.locator("body")).toHaveClass(/driver-active/);

    // First step.
    expect(await popoverTitle(page)).toBe(STEP_TITLES[0]);

    // Tour start should close the options panel.
    await expect(page.locator("#options")).toBeHidden();
  });

  // ── Tooltip step free-roam ─────────────────────────────────────────────────

  test("tooltip step adds tour-free-roam class and removes it on advance", async ({
    page,
  }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    await nextStep(page, STEP_TITLES[1]); // → Navigate the Map
    await nextStep(page, STEP_TITLES[2]); // → Hover Tooltips

    // free-roam class disables driver.js overlay so map hover events fire.
    await expect(page.locator("body")).toHaveClass(/tour-free-roam/);

    await nextStep(page, STEP_TITLES[3]); // → Open the Options Menu

    // onHighlightStarted on the options trigger step removes the class synchronously.
    await expect(page.locator("body")).not.toHaveClass(/tour-free-roam/);
  });

  // ── Options panel ──────────────────────────────────────────────────────────

  test("options panel opens when advancing past the options trigger step", async ({
    page,
  }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    await nextStep(page, STEP_TITLES[1]); // Navigate
    await nextStep(page, STEP_TITLES[2]); // Tooltip
    await nextStep(page, STEP_TITLES[3]); // Open the Options Menu

    // Panel is still closed while on the trigger step itself.
    await expect(page.locator("#options")).toBeHidden();

    // Clicking Next triggers openOptionsPanel() then moveNext().
    await nextStep(page, STEP_TITLES[4]); // → Layers Tab

    await expect(page.locator("#options")).toBeVisible();
  });

  // ── Tab switching ──────────────────────────────────────────────────────────

  test("layers tab content is visible on layers tab steps", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Advance to Layers Tab (step index 4 → 4 clicks).
    await advanceSteps(page, 4);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[4]);

    await expect(page.locator("#layersContent")).toBeVisible();
  });

  test("style tab content is visible on style tab steps", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Advance to Style Tab (step index 7 → 7 clicks).
    await advanceSteps(page, 7);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[7]);

    await expect(page.locator("#styleContent")).toBeVisible();
  });

  test("options tab content is visible on options tab step", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Advance to Options Tab (step index 10 → 10 clicks).
    await advanceSteps(page, 10);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[10]);

    await expect(page.locator("#optionsContent")).toBeVisible();
  });

  test("layers tab remains active on Layer Presets and Toggle Individual Layers steps", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    await advanceSteps(page, 5);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[5]);
    await expect(page.locator("#layersContent")).toBeVisible();

    await nextStep(page, STEP_TITLES[6]);
    await expect(page.locator("#layersContent")).toBeVisible();
  });

  test("style tab remains active on Style Presets and Individual Style Settings steps", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    await advanceSteps(page, 8);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[8]);
    await expect(page.locator("#styleContent")).toBeVisible();

    await nextStep(page, STEP_TITLES[9]);
    await expect(page.locator("#styleContent")).toBeVisible();
  });

  test("options tab remains active on Generation Options and Configure World steps", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    await advanceSteps(page, 11);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[11]);
    await expect(page.locator("#optionsContent")).toBeVisible();

    await nextStep(page, STEP_TITLES[12]);
    await expect(page.locator("#optionsContent")).toBeVisible();
  });

  test("tools tab content is visible on Tools Tab and Edit the Heightmap steps", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // advanceSteps(14): click 14 fires World Configurator's onNextClick (closeDialogs + clickTab toolsTab).
    await advanceSteps(page, 14);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[14]);
    await expect(page.locator("#toolsContent")).toBeVisible();

    await nextStep(page, STEP_TITLES[15]);
    await expect(page.locator("#toolsContent")).toBeVisible();
  });

  test("about tab content is visible on About Tab and About & Resources steps", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    await advanceSteps(page, 17);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[17]);
    await expect(page.locator("#aboutContent")).toBeVisible();

    await nextStep(page, STEP_TITLES[18]);
    await expect(page.locator("#aboutContent")).toBeVisible();
  });

  // ── Configure World dialog ─────────────────────────────────────────────────

  test("World Configurator dialog opens on the configure world step", async ({
    page,
  }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Advance to "Configure World" button step (index 12 → 12 clicks).
    await advanceSteps(page, 12);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[12]);

    // Dialog not yet open.
    await expect(page.locator("#worldConfigurator")).toBeHidden();

    // Clicking Next calls editWorld() then moveNext().
    await nextStep(page, STEP_TITLES[13]);

    // Dialog must be visible and tour must be on the World Configurator step.
    await expect(page.locator("#worldConfigurator")).toBeVisible();
  });

  test("World Configurator dialog closes and tools tab activates when advancing from World Configurator step", async ({
    page,
  }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // advanceSteps(13): click 13 fires Configure World's onNextClick (editWorld + moveNext).
    await advanceSteps(page, 13);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[13]);
    await expect(page.locator("#worldConfigurator")).toBeVisible();

    // Clicking Next fires closeDialogs() + clickTab("toolsTab") + moveNext().
    await nextStep(page, STEP_TITLES[14]);

    await expect(page.locator("#worldConfigurator")).toBeHidden();
    await expect(page.locator("#toolsContent")).toBeVisible();
  });

  // ── Heightmap customization panel ──────────────────────────────────────────

  test("heightmap customization panel appears on the heightmap editor step", async ({
    page,
  }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Advance to "Edit the Heightmap" button step (index 15 → 15 clicks).
    await advanceSteps(page, 15);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[15]);

    // Customization panel is not yet visible.
    await expect(page.locator("#customizationMenu")).toBeHidden();

    // Clicking Next calls showHeightmapCustomizationPanel() then moveNext().
    await nextStep(page, STEP_TITLES[16]);

    await expect(page.locator("#customizationMenu")).toBeVisible();
    // toolsContent should be hidden while the heightmap panel is shown.
    await expect(page.locator("#toolsContent")).toBeHidden();
  });

  test("heightmap panel is restored when advancing past the heightmap editor step", async ({
    page,
  }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Get to Heightmap Editor (index 16 → 16 clicks).
    await advanceSteps(page, 16);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[16]);
    await expect(page.locator("#customizationMenu")).toBeVisible();

    // Advance to About Tab — onDeselected hides the customization panel.
    await nextStep(page, STEP_TITLES[17]);

    await expect(page.locator("#customizationMenu")).toBeHidden();
    // onHighlightStarted of the About Tab step calls clickTab("aboutTab"),
    // which hides all tab content including toolsContent, so verify the
    // about content is now active rather than toolsContent.
    await expect(page.locator("#aboutContent")).toBeVisible();
  });

  // ── Export dialog ──────────────────────────────────────────────────────────

  test("export dialog opens on the export step", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Advance to "Export" button step (index 19 → 19 clicks).
    await advanceSteps(page, 19);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[19]);

    await expect(page.locator("#exportMapData")).toBeHidden();

    // Clicking Next calls showExportPane() then moveNext().
    await nextStep(page, STEP_TITLES[20]);

    await expect(page.locator("#exportMapData")).toBeVisible();
  });

  test("export dialog closes when advancing from Export Options step", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // advanceSteps(20): click 20 fires Export's onNextClick (showExportPane + moveNext).
    await advanceSteps(page, 20);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[20]);
    await expect(page.locator("#exportMapData")).toBeVisible();

    // Clicking Next fires closeDialogs() + moveNext().
    await nextStep(page, STEP_TITLES[21]);

    await expect(page.locator("#exportMapData")).toBeHidden();
  });

  // ── Back navigation ────────────────────────────────────────────────────────

  test("back to Hover Tooltips step restores tour-free-roam class", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Advance past Navigate the Map so tour-free-roam is added, then to Open
    // the Options Menu where onHighlightStarted removes it.
    await nextStep(page, STEP_TITLES[1]); // → Navigate the Map
    await nextStep(page, STEP_TITLES[2]); // → Hover Tooltips (free-roam added by onNextClick)
    await nextStep(page, STEP_TITLES[3]); // → Open the Options Menu (free-roam removed)
    await expect(page.locator("body")).not.toHaveClass(/tour-free-roam/);

    // Go back: onHighlightStarted on Hover Tooltips must re-add the class.
    await prevStep(page, STEP_TITLES[2]);
    await expect(page.locator("body")).toHaveClass(/tour-free-roam/);
  });

  test("back to Open the Options Menu step closes the options panel", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Advance to Layers Tab so the options panel is open.
    await advanceSteps(page, 4);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[4]);
    await expect(page.locator("#options")).toBeVisible();

    // Go back to Open the Options Menu: onHighlightStarted must close the panel.
    await prevStep(page, STEP_TITLES[3]);
    await expect(page.locator("#options")).toBeHidden();
  });

  test("back from World Configurator to Configure World closes the dialog", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Advance to World Configurator step — dialog is open.
    await advanceSteps(page, 13);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[13]);
    await expect(page.locator("#worldConfigurator")).toBeVisible();

    // Go back: onHighlightStarted on Configure World must close the dialog.
    await prevStep(page, STEP_TITLES[12]);
    await expect(page.locator("#worldConfigurator")).toBeHidden();
    await expect(page.locator("#optionsContent")).toBeVisible();
  });

  test("back from Tools Tab to World Configurator reopens the dialog", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Advance to Tools Tab — World Configurator dialog is closed.
    await advanceSteps(page, 14);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[14]);
    await expect(page.locator("#worldConfigurator")).toBeHidden();

    // Go back: onHighlightStarted on World Configurator must reopen the dialog.
    await prevStep(page, STEP_TITLES[13]);
    await expect(page.locator("#worldConfigurator")).toBeVisible();
  });

  test("back from About Tab to Heightmap Editor shows the customization panel", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Advance to About Tab — customization panel was hidden when leaving step 16.
    await advanceSteps(page, 17);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[17]);
    await expect(page.locator("#customizationMenu")).toBeHidden();

    // Go back: onHighlightStarted on Heightmap Editor must show the panel.
    await prevStep(page, STEP_TITLES[16]);
    await expect(page.locator("#customizationMenu")).toBeVisible();
    await expect(page.locator("#toolsContent")).toBeHidden();
  });

  test("back from Heightmap Editor to Edit the Heightmap hides the customization panel", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Arrive at Heightmap Editor from About Tab backward (panel visible).
    await advanceSteps(page, 17);
    await prevStep(page, STEP_TITLES[16]);
    await expect(page.locator("#customizationMenu")).toBeVisible();

    // Go back one more: onDeselected on Heightmap Editor must hide the panel.
    await prevStep(page, STEP_TITLES[15]);
    await expect(page.locator("#customizationMenu")).toBeHidden();
    await expect(page.locator("#toolsContent")).toBeVisible();
  });

  test("back from Export Options to Export closes the export dialog", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Advance to Export Options — export dialog is open.
    await advanceSteps(page, 20);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[20]);
    await expect(page.locator("#exportMapData")).toBeVisible();

    // Go back: onHighlightStarted on Export must close the dialog.
    await prevStep(page, STEP_TITLES[19]);
    await expect(page.locator("#exportMapData")).toBeHidden();
  });

  test("back from Save and Load Maps to Export Options reopens the export dialog", async ({ page }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Advance to the final step — export dialog was closed by step 20's onNextClick.
    await advanceSteps(page, 21);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[21]);
    await expect(page.locator("#exportMapData")).toBeHidden();

    // Go back: onHighlightStarted on Export Options must reopen the dialog.
    await prevStep(page, STEP_TITLES[20]);
    await expect(page.locator("#exportMapData")).toBeVisible();
  });

  // ── Cleanup ────────────────────────────────────────────────────────────────

  test("dismissing the tour removes driver-active and closes the options panel", async ({
    page,
  }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Advance far enough that the options panel is open.
    await advanceSteps(page, 4); // lands on Layers Tab, panel is open
    await expect(page.locator("#options")).toBeVisible();

    // Click the driver.js close (×) button to cancel the tour.
    await page.locator(".driver-popover-close-btn").click();
    await page.waitForSelector(".driver-popover", { state: "hidden" });

    // driver-active class should be gone.
    await expect(page.locator("body")).not.toHaveClass(/driver-active/);

    // onDestroyStarted hook must close the options panel.
    await expect(page.locator("#options")).toBeHidden();
  });

  test("completing the tour on the final step removes driver-active and closes the options panel", async ({
    page,
  }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // advanceSteps(21): click 21 fires Export Options' onNextClick (closeDialogs + moveNext).
    await advanceSteps(page, 21);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[21]);
    await expect(page.locator("#options")).toBeVisible();

    // Clicking Next on the last step fires tour.destroy() + closeOptionsPanel() with no moveNext.
    await page.locator(".driver-popover-next-btn").click();
    await page.waitForSelector(".driver-popover", { state: "hidden" });

    await expect(page.locator("body")).not.toHaveClass(/driver-active/);
    await expect(page.locator("#options")).toBeHidden();
  });

  test("dismissing the tour while World Configurator is open closes the dialog and options panel", async ({
    page,
  }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Arrive at World Configurator step with dialog open.
    await advanceSteps(page, 13);
    await expect(page.locator("#worldConfigurator")).toBeVisible();

    await page.locator(".driver-popover-close-btn").click();
    await page.waitForSelector(".driver-popover", { state: "hidden" });

    // onDestroyStarted calls closeDialogs() then closeOptionsPanel().
    await expect(page.locator("#worldConfigurator")).toBeHidden();
    await expect(page.locator("#options")).toBeHidden();
  });

  test("dismissing the tour while heightmap panel is visible hides it and closes the options panel", async ({
    page,
  }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Arrive at Heightmap Editor step with customization panel visible.
    await advanceSteps(page, 16);
    await expect(page.locator("#customizationMenu")).toBeVisible();

    await page.locator(".driver-popover-close-btn").click();
    await page.waitForSelector(".driver-popover", { state: "hidden" });

    // onDestroyStarted calls hideHeightmapCustomizationPanel() then closeOptionsPanel().
    await expect(page.locator("#customizationMenu")).toBeHidden();
    await expect(page.locator("#options")).toBeHidden();
  });

  // ── Regression: toolsContent must not leak when closing early (bug #1421) ──

  test("closing tour on Layers tab step does not show toolsContent when menu is reopened", async ({
    page,
  }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Advance to Layers Tab step — options panel is open, Layers tab is active.
    await advanceSteps(page, 4);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[4]);

    await page.locator(".driver-popover-close-btn").click();
    await page.waitForSelector(".driver-popover", { state: "hidden" });

    // Reopen the options panel.
    await page.locator("#optionsTrigger").click();
    await expect(page.locator("#options")).toBeVisible();

    // Only the Layers tab content should be visible — not toolsContent.
    await expect(page.locator("#layersContent")).toBeVisible();
    await expect(page.locator("#toolsContent")).toBeHidden();
  });

  test("closing tour on Style tab step does not show toolsContent when menu is reopened", async ({
    page,
  }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Advance to Style Tab step — options panel is open, Style tab is active.
    await advanceSteps(page, 7);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[7]);

    await page.locator(".driver-popover-close-btn").click();
    await page.waitForSelector(".driver-popover", { state: "hidden" });

    // Reopen the options panel.
    await page.locator("#optionsTrigger").click();
    await expect(page.locator("#options")).toBeVisible();

    // Only the Style tab content should be visible — not toolsContent.
    await expect(page.locator("#styleContent")).toBeVisible();
    await expect(page.locator("#toolsContent")).toBeHidden();
  });

  test("closing tour on Options tab step does not show toolsContent when menu is reopened", async ({
    page,
  }) => {
    await page.evaluate(() => (window as any).UITour.start());
    await page.waitForSelector(".driver-popover", { state: "visible" });

    // Advance to Options Tab step — options panel is open, Options tab is active.
    await advanceSteps(page, 10);
    expect(await popoverTitle(page)).toBe(STEP_TITLES[10]);

    await page.locator(".driver-popover-close-btn").click();
    await page.waitForSelector(".driver-popover", { state: "hidden" });

    // Reopen the options panel.
    await page.locator("#optionsTrigger").click();
    await expect(page.locator("#options")).toBeVisible();

    // Only the Options tab content should be visible — not toolsContent.
    await expect(page.locator("#optionsContent")).toBeVisible();
    await expect(page.locator("#toolsContent")).toBeHidden();
  });
});
