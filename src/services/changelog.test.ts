import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseChangelog, renderChanges } from "./changelog";

describe("parseChangelog", () => {
  it("reads releases newest first with their date and changes", () => {
    const markdown = [
      "- intro bullet before any release",
      "**[1.157.0](https://github.com/x/releases/tag/v1.157.0) - 2026-10-30**:",
      "",
      "- Heightmap: elevation labels",
      "- Editors: cut too long column names",
      "",
      "# Releases",
      "",
      "**[1.156.0](https://github.com/x/releases/tag/v1.156.0) - 2026-10-25**:",
      "- Legend boxes are saved as map data"
    ].join("\n");

    expect(parseChangelog(markdown)).toEqual([
      {
        version: "1.157.0",
        date: "2026-10-30",
        changes: ["Heightmap: elevation labels", "Editors: cut too long column names"]
      },
      { version: "1.156.0", date: "2026-10-25", changes: ["Legend boxes are saved as map data"] }
    ]);
  });

  it("accepts headers without a date and two-part versions", () => {
    const markdown =
      "**[1.152.0](https://x/v1.152.0.zip)**:\n- a\n**[1.140](https://x/v1.140.zip) - 2026-06-12**:\n- b";
    expect(parseChangelog(markdown)).toEqual([
      { version: "1.152.0", date: undefined, changes: ["a"] },
      { version: "1.140.0", date: "2026-06-12", changes: ["b"] }
    ]);
  });

  it("parses the real changelog, the current version first", () => {
    const markdown = readFileSync(new URL("../../docs/wiki/Changelog.md", import.meta.url), "utf8");
    const releases = parseChangelog(markdown);
    expect(releases.length).toBeGreaterThan(10);
    expect(releases[0]!.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(releases.every(({ changes }) => changes.length > 0)).toBe(true);
  });
});

describe("renderChanges", () => {
  it("renders a list with links and code", () => {
    expect(renderChanges(["Use `F1` to see [the wiki](https://example.com/wiki)"])).toBe(
      '<ul><li>Use <code>F1</code> to see <a href="https://example.com/wiki" target="_blank" rel="noopener noreferrer">the wiki</a></li></ul>'
    );
  });

  it("turns underscore credits into italics without touching the link markup", () => {
    expect(renderChanges(["Population layer by _[inviktos](https://github.com/inviktos)_"])).toBe(
      '<ul><li>Population layer by <em><a href="https://github.com/inviktos" target="_blank" rel="noopener noreferrer">inviktos</a></em></li></ul>'
    );
    expect(renderChanges(["An _old_ map, snake_case stays"])).toBe(
      "<ul><li>An <em>old</em> map, snake_case stays</li></ul>"
    );
  });

  it("escapes markup", () => {
    expect(renderChanges(["<b>x</b>"])).toBe("<ul><li>&lt;b&gt;x&lt;/b&gt;</li></ul>");
  });
});
