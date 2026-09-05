// @vitest-environment jsdom

import type Quill from "quill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canEditAsRichText,
  createRichTextEditor,
  getEditorHtml,
  runTableAction,
  setEditorHtml
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
  });

  it("rejects markup Quill would drop or rewrite", () => {
    expect(canEditAsRichText('<div>Dungeon</div><iframe src="about:blank"></iframe>')).toBe(false);
    expect(canEditAsRichText("<p>a</p><hr><p>b</p>")).toBe(false);
    expect(canEditAsRichText("<p>a</p><script>alert(1)</script>")).toBe(false);
    expect(canEditAsRichText("<script>alert(1)</script>")).toBe(false);
    expect(canEditAsRichText("<style>p { color: red }</style><p>a</p>")).toBe(false);
  });
});

describe("rich text editor", () => {
  let quill: Quill;
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockReset();
    document.body.innerHTML =
      '<div id="toolbar"><button class="ql-bold"></button><button class="ql-undo"></button></div><div id="host"></div>';
    quill = createRichTextEditor(document.getElementById("host")!, document.getElementById("toolbar")!, onChange);
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
  });

  it("reports an empty editor as an empty string", () => {
    setEditorHtml(quill, "<p><br></p>");
    expect(getEditorHtml(quill)).toBe("");
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
});
