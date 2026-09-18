import { expect, type Page, test } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

// Notes live on the entity they describe, so a note is read back off pack rather than off a side table
const noteOf = (page: Page, path: string) => page.evaluate(`(window.pack.${path} || {}).note`);

/** Put a note on the first burg and on the first regiment, and return the burg the editor should show */
async function seedNotes(page: Page) {
  return page.evaluate(() => {
    const { pack } = window as any;
    const burg = pack.burgs.find((b: any) => b?.i && !b.removed);
    burg.note = "<p>Hello <strong>world</strong></p>";

    const embedBurg = pack.burgs.find((b: any) => b?.i && !b.removed && b.i !== burg.i);
    embedBurg.note = '<div>Dungeon</div><iframe src="about:blank"></iframe>';

    const state = pack.states.find((s: any) => s?.i && !s.removed && s.military?.length);
    state.military[0].note = "<p>Formed in living memory</p>";

    return { burgId: burg.i, burgName: burg.name, embedId: embedBurg.i, stateId: state.i };
  });
}

test.describe("Notes Editor", () => {
  test.beforeEach(async ({ page }) => {
    // a first visit raises the "generator was updated" window 6s in, which would stand in for any
    // alert the editor itself raises. Arriving as a returning visitor keeps the check below honest
    await page.addInitScript(() => localStorage.setItem("version", "99.0.0"));
    await page.goto("/?seed=test-notes&width=1280&height=720");
    await waitForMap(page);
  });

  test.afterEach(async ({ page }) => {
    // nothing the editor does may surface as an alert dialog
    await expect(page.locator(".ui-dialog:has(#alert):visible")).toHaveCount(0);
  });

  test("lists notes grouped by entity type and opens on the requested entity", async ({ page }) => {
    const { burgId, burgName } = await seedNotes(page);
    await page.evaluate(id => (window as any).Controllers.BurgEditor.open(id), burgId);
    await page.click("#burglLegend");
    await expect(page.locator("#notesEditor")).toBeVisible();

    await expect(page.locator("#notesSelect")).toHaveValue(`burg:${burgId}`);
    await expect(page.locator("#notesName")).toHaveText(burgName);
    const groups = await page.locator("#notesSelect optgroup").evaluateAll(els => els.map(el => el.label));
    expect(groups).toEqual(expect.arrayContaining(["Burgs", "Regiments"]));
    await expect(page.locator("#notesEditor .ql-editor")).toContainText("Hello world");
  });

  test("edits a note in the bundled rich text editor and writes it onto the entity", async ({ page }) => {
    const { burgId } = await seedNotes(page);
    await page.evaluate(id => (window as any).Controllers.BurgEditor.open(id), burgId);
    await page.click("#burglLegend");

    const editor = page.locator("#notesEditor .ql-editor");
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" again");

    // typing at the end of a bold word continues the bold run, so the new text lands inside <strong>
    expect(await noteOf(page, `burgs[${burgId}]`)).toMatch(/<strong>world again<\/strong>/);
    await expect(page.locator("#notesBody")).toContainText("again");
  });

  test("switching the selected element loads that entity's note", async ({ page }) => {
    const { burgId, stateId } = await seedNotes(page);
    await page.evaluate(id => (window as any).Controllers.BurgEditor.open(id), burgId);
    await page.click("#burglLegend");

    await page.selectOption("#notesSelect", `regiment:${stateId}-0`);
    await expect(page.locator("#notesEditor .ql-editor")).toContainText("Formed in living memory");
    await expect(page.locator("#notesName")).toHaveText(
      await page.evaluate(id => (window as any).pack.states[id].military[0].name, stateId)
    );
  });

  test("inserts a table from the table menu", async ({ page }) => {
    const { burgId } = await seedNotes(page);
    await page.evaluate(id => (window as any).Controllers.BurgEditor.open(id), burgId);
    await page.click("#burglLegend");

    await page.locator("#notesEditor .ql-editor").click();
    // Quill replaces the native select with its own picker, so the menu is driven the way a user does
    await page.locator("#notesToolbar .notes-table .ql-picker-label").click();
    await page.locator('#notesToolbar .notes-table .ql-picker-item[data-value="insert"]').click();

    await expect(page.locator("#notesEditor .ql-editor td")).toHaveCount(9);
    expect(await noteOf(page, `burgs[${burgId}]`)).toContain("<table");
  });

  test("opens a note with markup the editor cannot hold as HTML source", async ({ page }) => {
    const { burgId, embedId } = await seedNotes(page);
    await page.evaluate(id => (window as any).Controllers.BurgEditor.open(id), burgId);
    await page.click("#burglLegend");
    await page.selectOption("#notesSelect", `burg:${embedId}`);

    const source = page.locator("#notesSource");
    await expect(source).toBeVisible();
    await expect(source).toHaveValue(/<iframe/);
    await expect(page.locator("#notesEditor .ql-editor")).toBeHidden();

    const html = '<p>plain</p><iframe src="about:blank"></iframe>';
    await source.fill(html);
    expect(await noteOf(page, `burgs[${embedId}]`)).toBe(html);

    // leaving HTML mode is refused while the note still holds markup Quill cannot keep
    await page.click("#notesSourceToggle");
    await expect(source).toBeVisible();
    await expect(page.locator("#notesEditor .ql-editor")).toBeHidden();
  });

  test("removing a note clears the field on the entity", async ({ page }) => {
    const { burgId } = await seedNotes(page);
    await page.evaluate(id => (window as any).Controllers.BurgEditor.open(id), burgId);
    await page.click("#burglLegend");

    await page.click("#notesRemove");
    await page.click(".ui-dialog:visible button:has-text('Remove')");

    expect(await noteOf(page, `burgs[${burgId}]`)).toBeUndefined();
  });

  test("shows the note in the notes box when its element is hovered", async ({ page }) => {
    const { burgId } = await seedNotes(page);
    await page.locator(`#burg${burgId}`).dispatchEvent("mousemove");

    await expect(page.locator("#notesHeader")).toHaveText(
      await page.evaluate(id => (window as any).pack.burgs[id].name, burgId)
    );
    await expect(page.locator("#notesBody")).toContainText("Hello world");
  });

  test("an entity with no note is still offered, so a note can be added to it", async ({ page }) => {
    const clean = await page.evaluate(() => {
      const { pack } = window as any;
      for (const collection of ["burgs", "markers", "states"]) {
        for (const entity of pack[collection] || []) {
          if (entity?.note) delete entity.note;
          for (const regiment of entity?.military || []) delete regiment.note;
        }
      }
      return pack.burgs.find((b: any) => b?.i && !b.removed).i;
    });

    await page.evaluate(id => (window as any).Controllers.BurgEditor.open(id), clean);
    await page.click("#burglLegend");

    await expect(page.locator("#notesSelect")).toHaveValue(`burg:${clean}`);
    await page.locator("#notesEditor .ql-editor").click();
    await page.keyboard.type("A brand new note");

    expect(await noteOf(page, `burgs[${clean}]`)).toContain("A brand new note");
  });
});
