// @vitest-environment jsdom

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let getUsedFonts: typeof import("./fonts").getUsedFonts;

beforeAll(async () => {
  document.body.innerHTML = '<select id="styleSelectFont"></select><svg id="map"><g id="provs"></g></svg>';
  vi.stubGlobal("FontFace", class {});
  Object.defineProperty(document, "fonts", { configurable: true, value: { add: vi.fn() } });
  ({ getUsedFonts } = await import("./fonts"));
  fonts.push(
    { family: "Note Font", src: "url(https://example.com/note.woff2)", unicodeRange: "U+0000-00FF" },
    { family: "Note Font", src: "url(https://example.com/note-ext.woff2)", unicodeRange: "U+0100-017F" }
  );
});

afterAll(() => vi.unstubAllGlobals());

describe("fonts used in notes", () => {
  it("includes all font ranges for a custom font used only in a note", () => {
    const svg = document.querySelector("svg")!;
    const legends = ['<p><span style="font-family: &quot;Note Font&quot;, serif">Lore</span></p>'];
    expect(getUsedFonts(svg, legends).map(font => font.unicodeRange)).toEqual(["U+0000-00FF", "U+0100-017F"]);
    expect(getUsedFonts(svg)).toEqual([]);
  });

  it("includes fonts from legacy HTML and keeps collecting map fonts", () => {
    const svg = document.querySelector("svg")!;
    svg.innerHTML = '<g id="provs"></g><g id="labels"><g font-family="Arial"></g></g>';
    const legends = ['<font face="Note Font">Legacy note</font>', '<p style="font-family: Arial">Another note</p>'];
    expect(getUsedFonts(svg, legends).map(font => font.family)).toEqual(["Arial", "Note Font", "Note Font"]);
  });
});
