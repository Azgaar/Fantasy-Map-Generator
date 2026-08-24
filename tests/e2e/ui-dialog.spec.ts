import { expect, test } from "@playwright/test";

// Covers <ui-dialog> chrome (title bar, minimize, close, resize, focus handling) via the
// Units Editor, the first dialog migrated off jQuery UI's .dialog() onto the component.
test.describe("<ui-dialog> via Units Editor", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?seed=test-ui-dialog&width=1280&height=720");
    await page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 60000 });
  });

  async function openUnitsEditor(page: import("@playwright/test").Page) {
    await page.click("#optionsTrigger");
    await page.click("#toolsTab");
    await page.click("#editUnitsButton");
    const dialog = page.locator("units-editor-dialog#unitsEditor ui-dialog");
    await expect(dialog).toBeVisible();
    return dialog;
  }

  test("opens with the correct title and accessibility attributes", async ({ page }) => {
    const dialog = await openUnitsEditor(page);

    await expect(dialog).toHaveAttribute("role", "dialog");
    await expect(dialog).toHaveAttribute("aria-label", "Units Editor");
    await expect(dialog).toHaveAttribute("aria-modal", "false");
    await expect(page.locator("#distanceUnitInput")).toBeVisible();
  });

  test("minimize collapses the content but keeps the title bar and controls visible", async ({ page }) => {
    const dialog = await openUnitsEditor(page);

    await dialog.evaluate(el => el.shadowRoot!.querySelector<HTMLButtonElement>(".ui-dialog-titlebar-collapse")!.click());
    await expect(dialog).toHaveAttribute("minimized", "");
    await expect(page.locator("#distanceUnitInput")).toBeHidden();

    await dialog.evaluate(el => el.shadowRoot!.querySelector<HTMLButtonElement>(".ui-dialog-titlebar-collapse")!.click());
    await expect(dialog).not.toHaveAttribute("minimized", "");
    await expect(page.locator("#distanceUnitInput")).toBeVisible();
  });

  test("close button hides the dialog", async ({ page }) => {
    const dialog = await openUnitsEditor(page);

    await dialog.evaluate(el => el.shadowRoot!.querySelector<HTMLButtonElement>(".ui-dialog-titlebar-close")!.click());
    await expect(dialog).not.toHaveAttribute("open", "");
    await expect(dialog).toBeHidden();
  });

  test("Escape closes the dialog via the app's global handler", async ({ page }) => {
    const dialog = await openUnitsEditor(page);

    await page.keyboard.press("Escape");
    await expect(dialog).not.toHaveAttribute("open", "");
  });

  test("resizing from the corner grows the dialog and keeps it within the viewport", async ({ page }) => {
    const dialog = await openUnitsEditor(page);

    const before = await dialog.evaluate(el => el.getBoundingClientRect());
    const handleCenter = await dialog.evaluate(el => {
      const handle = el.shadowRoot!.querySelector(".ui-resizable-se")!;
      const rect = handle.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });

    await page.mouse.move(handleCenter.x, handleCenter.y);
    await page.mouse.down();
    await page.mouse.move(handleCenter.x + 100, handleCenter.y + 100, { steps: 10 });
    await page.mouse.up();

    const after = await dialog.evaluate(el => el.getBoundingClientRect());
    expect(after.width).toBeGreaterThan(before.width);
    expect(after.height).toBeGreaterThan(before.height);
    expect(after.right).toBeLessThanOrEqual(1280);
    expect(after.bottom).toBeLessThanOrEqual(720);
  });

  test("shrinking narrower keeps content at its natural size instead of wrapping", async ({ page }) => {
    const dialog = await openUnitsEditor(page);

    const heightBefore = await dialog.evaluate(el => el.getBoundingClientRect().height);
    const handleCenter = await dialog.evaluate(el => {
      const handle = el.shadowRoot!.querySelector(".ui-resizable-e")!;
      const rect = handle.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });

    await page.mouse.move(handleCenter.x, handleCenter.y);
    await page.mouse.down();
    await page.mouse.move(handleCenter.x - 120, handleCenter.y, { steps: 10 });
    await page.mouse.up();

    // Shrinking width alone should not force content to wrap onto more lines and
    // inflate the dialog's height — that would indicate content is reflowing/squishing
    // instead of staying at its natural size and scrolling horizontally.
    const heightAfter = await dialog.evaluate(el => el.getBoundingClientRect().height);
    expect(heightAfter).toBe(heightBefore);
  });

  test("resizable=false hides the resize handles", async ({ page }) => {
    const dialog = await openUnitsEditor(page);

    await dialog.evaluate(el => el.setAttribute("resizable", "false"));
    const handleDisplay = await dialog.evaluate(
      el => getComputedStyle(el.shadowRoot!.querySelector(".ui-resizable-se")!).display
    );
    expect(handleDisplay).toBe("none");
  });

  test("Shift+Tab from the first focusable element wraps to the last one", async ({ page }) => {
    const dialog = await openUnitsEditor(page);

    await page.keyboard.press("Shift+Tab");
    const wrappedToLast = await dialog.evaluate(el => {
      const focusable = [
        ...el.shadowRoot!.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        ...el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ] as HTMLElement[];
      let active: Element | null = document.activeElement;
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      return active === focusable[focusable.length - 1];
    });
    expect(wrappedToLast).toBe(true);
  });

  test("closing restores focus to whatever had it before the dialog opened", async ({ page }) => {
    // Use a synthetic opener rather than the real toolbar button: #editUnitsButton's
    // panel auto-collapses after the click, which would make it unfocusable regardless
    // of whether <ui-dialog> restores focus correctly - this isolates the behavior under test.
    await page.evaluate(() => {
      const opener = document.createElement("button");
      opener.id = "test-opener";
      document.body.appendChild(opener);
      opener.focus();
      (document.querySelector("units-editor-dialog#unitsEditor") as any).open();
    });

    const dialog = page.locator("units-editor-dialog#unitsEditor ui-dialog");
    await expect(dialog).toBeVisible();

    await dialog.evaluate(el => el.shadowRoot!.querySelector<HTMLButtonElement>(".ui-dialog-titlebar-close")!.click());
    await expect(page.locator("#test-opener")).toBeFocused();
  });

  test("restoring defaults resets the unit selections", async ({ page }) => {
    await openUnitsEditor(page);

    await page.selectOption("#distanceUnitInput", "km");
    await expect(page.locator("#distanceUnitInput")).toHaveValue("km");

    await page.click("#unitsRestore");
    await expect(page.locator("#distanceUnitInput")).not.toHaveValue("km");
  });
});
