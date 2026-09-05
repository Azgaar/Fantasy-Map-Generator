import {expect, test, type Page} from "@playwright/test";

const NOTES = [
  {id: "e2eNote", name: "E2E note", legend: "<p>Hello <strong>world</strong></p>"},
  {id: "e2eEmbed", name: "E2E embed", legend: '<div>Dungeon</div><iframe src="about:blank"></iframe>'}
];

// notes is a top-level `let` in main.js: reachable by name in page code, not as a window property
const legendOf = (page: Page, id: string) => page.evaluate(`notes.find(note => note.id === "${id}").legend`);

test.describe("Notes Editor", () => {
  test.beforeEach(async ({page}) => {
    await page.goto("/?seed=test-notes&width=1280&height=720");
    await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});
    await page.evaluate(`notes.push(...${JSON.stringify(NOTES)})`);
    await page.click("#optionsTrigger");
    await page.click("#toolsTab");
    await page.click("#editNotesButton");
    await page.waitForSelector("#notesEditor", {state: "visible", timeout: 5000});
  });

  test.afterEach(async ({page}) => {
    // nothing the editor does may surface as the "new version released" reload prompt
    await expect(page.locator(".ui-dialog:has(#alert):visible")).toHaveCount(0);
  });

  test("edits a note in the bundled rich text editor", async ({page}) => {
    await page.selectOption("#notesSelect", "e2eNote");
    const editor = page.locator("#notesEditor .ql-editor");
    await expect(editor).toBeVisible();
    await expect(editor).toContainText("Hello world");

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" again");

    // typing at the end of a bold word continues the bold run, so the new text lands inside <strong>
    const legend = await legendOf(page, "e2eNote");
    expect(legend).toMatch(/<strong>world.*again<\/strong>/);
    await expect(page.locator("#notesBody")).toContainText("again");
  });

  test("inserts a table from the table menu", async ({page}) => {
    await page.selectOption("#notesSelect", "e2eNote");
    await page.locator("#notesEditor .ql-editor").click();
    await page.selectOption("#notesTable", "insert");

    await expect(page.locator("#notesEditor .ql-editor td")).toHaveCount(9);
    expect(await legendOf(page, "e2eNote")).toContain("<table");
  });

  test("opens a note with markup the editor cannot hold as HTML source", async ({page}) => {
    await page.selectOption("#notesSelect", "e2eEmbed");
    const source = page.locator("#notesSource");
    await expect(source).toBeVisible();
    await expect(source).toHaveValue(/<iframe/);
    await expect(page.locator("#notesEditor .ql-editor")).toBeHidden();

    const html = '<p>plain</p><iframe src="about:blank"></iframe>';
    await source.fill(html);
    expect(await legendOf(page, "e2eEmbed")).toBe(html);
  });
});
