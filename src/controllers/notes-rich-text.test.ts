// @vitest-environment jsdom

import type Quill from "quill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canEditAsRichText,
  createRichTextEditor,
  getEditorHtml,
  insertSymbol,
  linkFromSelection,
  normalizeUrl,
  previewSelectionReplacement,
  runTableAction,
  setEditorHtml,
  TOOLBAR_HTML
} from "./notes-rich-text";

describe("canEditAsRichText", () => {
  it("accepts text and the markup Quill can hold", () => {
    expect(canEditAsRichText("")).toBe(true);
    expect(canEditAsRichText("A plain sentence.")).toBe(true);
    expect(
      canEditAsRichText(
        '<p style="text-align: center;">Hi <strong>there</strong> <a href="x">link</a></p>' +
          '<ul><li>one</li></ul><table><tbody><tr><td>a</td></tr></tbody></table><img src="data:,">'
      )
    ).toBe(true);
    expect(canEditAsRichText("<p>a <code>inline</code> b</p>")).toBe(true);
  });

  it("rejects markup Quill would drop or rewrite", () => {
    expect(canEditAsRichText('<div>Dungeon</div><iframe src="about:blank"></iframe>')).toBe(false);
    expect(canEditAsRichText("<p>a</p><script>alert(1)</script>")).toBe(false);
    expect(canEditAsRichText("<script>alert(1)</script>")).toBe(false);
    expect(canEditAsRichText("<style>p { color: red }</style><p>a</p>")).toBe(false);
    expect(canEditAsRichText("<table><tbody><tr><th>A</th><th>B</th></tr></tbody></table>")).toBe(false);
    // Quill holds a code block but writes it back empty, so a note with one must stay in HTML mode
    expect(canEditAsRichText("<pre>const a = 1;</pre>")).toBe(false);
  });
});

describe("rich text editor", () => {
  let quill: Quill;
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockReset();
    document.body.innerHTML = `${TOOLBAR_HTML}<div id="host"></div>`;
    quill = createRichTextEditor(document.getElementById("host")!, document.getElementById("notesToolbar")!, onChange, [
      "Arial",
      "Almendra SC",
      "Almendra SC"
    ]);
  });

  it("round-trips a note as self-contained HTML", () => {
    setEditorHtml(
      quill,
      '<p style="text-align: center;">Centered <strong>bold</strong> <span style="font-size: 12pt;">legacy</span></p>' +
        "<ul><li>one</li><li>two</li></ul><table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>"
    );
    const html = getEditorHtml(quill);
    expect(html).toContain('<p style="text-align: center;">');
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("font-size: 12pt;");
    expect(html).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(html.match(/<td/g)).toHaveLength(2);
    expect(html).not.toContain("ql-");
    expect(html).toContain("Centered <strong>bold</strong> <span");
    expect(html).not.toContain("&nbsp;");
  });

  it("previews a selected passage without changing the original or surrounding formatting", () => {
    setEditorHtml(quill, "<p>Before <strong>old</strong> after</p><p><em>Untouched</em></p>");
    const before = getEditorHtml(quill);
    const result = previewSelectionReplacement(quill, { index: 7, length: 3 }, "<strong>new</strong>");
    expect(getEditorHtml(quill)).toBe(before);
    expect(result).toContain("Before <strong>new</strong> after");
    expect(result).toContain("<em>Untouched</em>");
  });

  it("keeps the next paragraph separate when replacing a selection ending in a line break", () => {
    setEditorHtml(quill, "<p>Old</p><p><em>Untouched</em></p>");
    const result = previewSelectionReplacement(quill, { index: 0, length: 4 }, "<p>New</p>");
    expect(result).toContain("<p>New</p><p><em>Untouched</em></p>");
  });
  it("reports an empty editor as an empty string", () => {
    setEditorHtml(quill, "<p><br></p>");
    expect(getEditorHtml(quill)).toBe("");
  });

  it("keeps the line breaks and the entities of a generated plain text note", () => {
    setEditorHtml(quill, "A battle of the Campaign. \r\nDate: 100 AD.\n\nSpoils: gold &amp; silver");
    expect(quill.getText()).toBe("A battle of the Campaign. \nDate: 100 AD.\n\nSpoils: gold & silver\n");
    expect(getEditorHtml(quill)).toContain("<p>Date: 100 AD.</p>");
  });

  it("keeps inline code", () => {
    setEditorHtml(quill, "<p>a <code>inline</code> b</p>");
    expect(getEditorHtml(quill)).toBe("<p>a <code>inline</code> b</p>");
  });

  it("inserts a rule between text, preserves it on reload, and undoes it in one step", () => {
    setEditorHtml(quill, "<p>beforeafter</p>");
    quill.setSelection(6, 0, "silent");
    document.querySelector<HTMLButtonElement>(".ql-divider")!.click();
    const html = getEditorHtml(quill);
    expect(html).toContain("<p>before</p><hr>");
    expect(html).toContain("after");
    expect(canEditAsRichText(html)).toBe(true);
    quill.history.undo();
    expect(getEditorHtml(quill)).toBe("<p>beforeafter</p>");
    setEditorHtml(quill, html);
    expect(getEditorHtml(quill)).toBe(html);
    setEditorHtml(quill, "<hr>");
    expect(getEditorHtml(quill)).toContain("<hr>");
  });

  it("replaces the saved selection with a symbol and preserves formatting and undo", () => {
    setEditorHtml(quill, "<p><strong>abc</strong></p>");
    insertSymbol(quill, { index: 1, length: 1 }, "⚔️");
    expect(getEditorHtml(quill)).toBe("<p><strong>a⚔️c</strong></p>");
    expect(quill.getSelection()?.index).toBe(3);
    quill.history.undo();
    expect(getEditorHtml(quill)).toBe("<p><strong>abc</strong></p>");
  });

  it("preserves the preceding paragraph's formatting when inserting a rule", () => {
    setEditorHtml(quill, '<p class="ql-indent-1" style="text-align: center">before</p>');
    quill.setSelection(6, 0, "silent");
    document.querySelector<HTMLButtonElement>(".ql-divider")!.click();
    expect(quill.getFormat(0, 1)).toMatchObject({ indent: 1, align: "center" });
  });

  it("keeps paragraph indentation visible after reload and removes it on outdent", () => {
    setEditorHtml(quill, "<p>paragraph</p>");
    quill.formatLine(0, 1, "indent", "+1", "user");
    const html = getEditorHtml(quill);
    expect(html).toContain("padding-left: 3em;");
    setEditorHtml(quill, html);
    expect(quill.getFormat(0, 1).indent).toBe(1);
    quill.formatLine(0, 1, "indent", "-1", "user");
    expect(getEditorHtml(quill)).toBe("<p>paragraph</p>");
  });

  it("preserves nested list semantics without adding paragraph padding to list items", () => {
    setEditorHtml(quill, "<ul><li>outer<ul><li>inner</li></ul></li></ul>");
    const html = getEditorHtml(quill);
    expect(html).toContain("<ul><li>outer<ul><li>inner</li></ul></li></ul>");
    expect(html).not.toContain("padding-left");
    setEditorHtml(quill, html);
    expect(getEditorHtml(quill)).toBe(html);
  });

  it("offers each FMG font once and preserves the selected font in HTML", () => {
    expect(document.querySelectorAll('.ql-font option[value="Almendra SC"]')).toHaveLength(1);
    setEditorHtml(quill, "<p>font</p>");
    quill.setSelection(0, 4, "silent");
    const select = document.querySelector<HTMLSelectElement>("select.ql-font")!;
    select.value = "Almendra SC";
    select.dispatchEvent(new Event("change"));
    const html = getEditorHtml(quill);
    expect(html).toContain("font-family:");
    setEditorHtml(quill, html);
    expect(quill.getFormat(0, 4).font).toBe("Almendra SC");
  });

  it("keeps ordinary spaces wrapping and preserves intentional nonbreaking spaces", () => {
    quill.setText("ordinary space; nonbreaking\u00a0space; literal &nbsp;\n");
    const template = document.createElement("template");
    template.innerHTML = getEditorHtml(quill);
    expect(template.content.textContent).toBe("ordinary space; nonbreaking\u00a0space; literal &nbsp;");
  });

  it("reports user edits only", () => {
    setEditorHtml(quill, "<p>loaded</p>");
    expect(onChange).not.toHaveBeenCalled();
    quill.insertText(0, "x", "user");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("inserts a 3x3 table at the cursor", () => {
    setEditorHtml(quill, "<p>x</p>");
    quill.setSelection(0, 0, "silent");
    runTableAction(quill, "insert");
    expect(getEditorHtml(quill).match(/<td/g)).toHaveLength(9);
  });

  // Quill borders the table itself but draws the cell gridlines from .ql-editor, which no note box has
  it("saves a table with its own gridlines and reloads it unchanged", () => {
    setEditorHtml(quill, "<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>");
    const html = getEditorHtml(quill);
    expect(html).toContain("border-collapse: collapse;");
    expect(html.match(/border: 1px solid rgb\(0, 0, 0\); padding: 2px 5px;/g)).toHaveLength(2);
    setEditorHtml(quill, html);
    expect(getEditorHtml(quill)).toBe(html);
  });

  it("clears the undo history when a note is loaded", () => {
    setEditorHtml(quill, "<p>first</p>");
    quill.insertText(0, "x", "user");
    setEditorHtml(quill, "<p>second</p>");
    expect(quill.history.stack.undo).toHaveLength(0);
  });

  it("ignores an unknown table action", () => {
    setEditorHtml(quill, "<p>x</p>");
    runTableAction(quill, "nonsense");
    expect(getEditorHtml(quill)).toBe("<p>x</p>");
  });
});

describe("link urls", () => {
  it("keeps what already resolves on its own", () => {
    expect(normalizeUrl("https://azgaar.github.io/map")).toBe("https://azgaar.github.io/map");
    expect(normalizeUrl("mailto:me@example.com")).toBe("mailto:me@example.com");
    expect(normalizeUrl("#anchor")).toBe("#anchor");
    expect(normalizeUrl("/local/page")).toBe("/local/page");
    expect(normalizeUrl("")).toBe("");
  });

  it("completes a bare host and an email", () => {
    expect(normalizeUrl("  example.com  ")).toBe("https://example.com");
    expect(normalizeUrl("www.example.co.uk/wiki/Bridge?a=1")).toBe("https://www.example.co.uk/wiki/Bridge?a=1");
    expect(normalizeUrl("azgaar@example.com")).toBe("mailto:azgaar@example.com");
  });

  it("leaves prose alone", () => {
    expect(normalizeUrl("the old bridge")).toBe("the old bridge");
  });

  it("prefills the link box only from text that reads like a url", () => {
    expect(linkFromSelection("example.com")).toBe("https://example.com");
    expect(linkFromSelection("azgaar@example.com")).toBe("mailto:azgaar@example.com");
    expect(linkFromSelection("bridge")).toBe("");
    expect(linkFromSelection("the old bridge")).toBe("");
  });
});
