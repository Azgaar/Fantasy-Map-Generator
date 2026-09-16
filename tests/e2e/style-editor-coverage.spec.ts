import { expect, test } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

// The schema-driven editor renders every style element and every group of the grouped ones without
// a console error and without a field it has no control for
test("every style element and group renders a complete form", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", error => errors.push(error.message));

  await page.goto("/?seed=style-editor-coverage&width=1280&height=720");
  await waitForMap(page);
  await page.evaluate(() => (window as any).showOptions());
  await page.locator("#styleTab").click();
  await page.locator("#styleForm .row").first().waitFor();

  const report = await page.evaluate(async () => {
    const elementSelect = document.getElementById("styleElementSelect") as HTMLSelectElement;
    const groupSelect = document.getElementById("styleGroupSelect") as HTMLSelectElement;
    const settle = () => new Promise(resolve => setTimeout(resolve, 30));
    const inspect = () => ({
      rows: document.querySelectorAll("#styleForm .row").length,
      unknown: [...document.querySelectorAll("#styleForm .ctl")]
        .filter(ctl => ctl.textContent?.startsWith("unknown control"))
        .map(ctl => ctl.closest<HTMLElement>("[data-field]")?.dataset.field)
    });

    const result: Record<string, { rows: number; unknown: (string | undefined)[] }> = {};
    for (const option of [...elementSelect.options]) {
      elementSelect.value = option.value;
      elementSelect.dispatchEvent(new Event("change"));
      await settle();
      result[option.value] = inspect();
      for (const group of [...groupSelect.options].map(o => o.value).slice(1)) {
        groupSelect.value = group;
        groupSelect.dispatchEvent(new Event("change"));
        await settle();
        result[`${option.value}/${group}`] = inspect();
      }
    }
    return result;
  });

  expect(Object.keys(report).length).toBeGreaterThan(40);
  for (const [selection, { rows, unknown }] of Object.entries(report)) {
    expect(rows, `${selection} renders rows`).toBeGreaterThan(0);
    expect(unknown, `${selection} has no unknown control`).toEqual([]);
  }
  expect(errors).toEqual([]);
});
