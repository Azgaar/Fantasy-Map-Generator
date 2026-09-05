import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("wraps plain text in a paragraph and keeps single newlines as breaks", () => {
    expect(renderMarkdown("first\nsecond")).toBe("<p>first<br />second</p>");
  });

  it("renders headings shifted down so they fit inside a chat bubble", () => {
    expect(renderMarkdown("# Title")).toBe("<h3>Title</h3>");
    expect(renderMarkdown("### Deep")).toBe("<h5>Deep</h5>");
  });

  it("renders inline marks", () => {
    expect(renderMarkdown("**bold** and *slanted* and ~~gone~~")).toBe(
      "<p><strong>bold</strong> and <em>slanted</em> and <del>gone</del></p>"
    );
  });

  it("renders code spans without parsing their contents", () => {
    expect(renderMarkdown("use `pack.burgs[0]` and `a *b* c`")).toBe(
      "<p>use <code>pack.burgs[0]</code> and <code>a *b* c</code></p>"
    );
  });

  it("does not mistake a bare number for a code-span placeholder", () => {
    expect(renderMarkdown("`x` and 0 and 1")).toBe("<p><code>x</code> and 0 and 1</p>");
  });

  it("renders fenced code blocks", () => {
    expect(renderMarkdown("```js\nreturn 1 < 2;\n```")).toBe("<pre><code>return 1 &lt; 2;</code></pre>");
  });

  it("renders unordered and ordered lists", () => {
    expect(renderMarkdown("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
    expect(renderMarkdown("1. one\n2. two")).toBe("<ol><li>one</li><li>two</li></ol>");
  });

  it("nests a child list inside its parent item", () => {
    expect(renderMarkdown("- parent\n  - child\n- sibling")).toBe(
      "<ul><li>parent<ul><li>child</li></ul></li><li>sibling</li></ul>"
    );
  });

  it("renders tables with alignment", () => {
    const table = "| State | Burgs |\n| --- | ---: |\n| Kelmora | 12 |";
    expect(renderMarkdown(table)).toBe(
      '<table><thead><tr><th>State</th><th style="text-align: right">Burgs</th></tr></thead>' +
        '<tbody><tr><td>Kelmora</td><td style="text-align: right">12</td></tr></tbody></table>'
    );
  });

  it("renders blockquotes and rules", () => {
    expect(renderMarkdown("> quoted")).toBe("<blockquote><p>quoted</p></blockquote>");
    expect(renderMarkdown("---")).toBe("<hr />");
  });

  it("links only http and https targets", () => {
    expect(renderMarkdown("[wiki](https://example.com/a)")).toBe(
      '<p><a href="https://example.com/a" target="_blank" rel="noopener noreferrer">wiki</a></p>'
    );
    expect(renderMarkdown("[bad](javascript:alert(1))")).toBe("<p>[bad](javascript:alert(1))</p>");
  });

  it("cannot break out of the href attribute to inject a second attribute", () => {
    const output = renderMarkdown('[t](https://a"onmouseover=alert(1))');
    expect(output).toBe(
      '<p><a href="https://a&quot;onmouseover=alert(1" target="_blank" rel="noopener noreferrer">t</a>)</p>'
    );
    expect((output.match(/ [a-z-]+="/g) || []).length).toBe(3); // href, target, rel — no extra attribute
  });

  it("escapes markup so model output cannot inject HTML", () => {
    expect(renderMarkdown('<img src=x onerror="alert(1)">')).toBe(
      "<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>"
    );
    expect(renderMarkdown("a & b")).toBe("<p>a &amp; b</p>");
  });

  it("escapes inside code spans and blocks too", () => {
    expect(renderMarkdown("`<b>`")).toBe("<p><code>&lt;b&gt;</code></p>");
  });

  it("handles an unterminated fence without hanging", () => {
    expect(renderMarkdown("```\nunclosed")).toBe("<pre><code>unclosed</code></pre>");
  });

  it("keeps blocks separate", () => {
    expect(renderMarkdown("## Ports\n\n- Kelmora\n\nDone.")).toBe(
      "<h4>Ports</h4><ul><li>Kelmora</li></ul><p>Done.</p>"
    );
  });
});
