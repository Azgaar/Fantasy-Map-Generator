// @vitest-environment jsdom

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { StylesData } from "@/types/styles";
import { fonts } from "./fonts";

let getUsedFonts: typeof import("./fonts").getUsedFonts;

beforeAll(async () => {
  vi.stubGlobal("FontFace", class {});
  Object.defineProperty(document, "fonts", { configurable: true, value: { add: vi.fn() } });
  ({ getUsedFonts } = await import("./fonts"));
  fonts.push(
    { family: "Note Font", src: "url(https://example.com/note.woff2)", unicodeRange: "U+0000-00FF" },
    { family: "Note Font", src: "url(https://example.com/note-ext.woff2)", unicodeRange: "U+0100-017F" }
  );
});

afterAll(() => vi.unstubAllGlobals());

const stylesWith = (labelFont: string) =>
  ({ labels: { groups: { town: { attrs: { "font-family": labelFont } } } } }) as unknown as StylesData;

describe("fonts used in notes", () => {
  it("includes all font ranges for a custom font used only in a note", () => {
    const notes = ['<p><span style="font-family: &quot;Note Font&quot;, serif">Lore</span></p>'];
    expect(getUsedFonts(stylesWith("None"), notes).map(font => font.unicodeRange)).toEqual([
      "U+0000-00FF",
      "U+0100-017F"
    ]);
    expect(getUsedFonts(stylesWith("None"))).toEqual([]);
  });

  it("includes fonts from legacy HTML and keeps collecting style fonts", () => {
    const notes = ['<font face="Note Font">Legacy note</font>', '<p style="font-family: Arial">Another note</p>'];
    expect(getUsedFonts(stylesWith("Arial"), notes).map(font => font.family)).toEqual([
      "Arial",
      "Note Font",
      "Note Font"
    ]);
  });
});

describe("fonts used in styles", () => {
  it("takes every font family in the style record, drawn or not", () => {
    const styles = {
      labels: { groups: { town: { attrs: { "font-family": "Note Font" } } } }, // the labels layer may be off
      legend: { attrs: { "font-family": "Arial" } }
    } as unknown as StylesData;
    expect(getUsedFonts(styles).map(font => font.family)).toEqual(["Arial", "Note Font", "Note Font"]);
  });
});
