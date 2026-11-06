// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Armoria } from "./armoria";

const coa = { t1: "gules", charges: [{ charge: "lionRampant", t: "or", p: "e" }] };

describe("Armoria input", () => {
  it.each([
    `https://azgaar.github.io/Armoria/?coa=${encodeURIComponent(JSON.stringify(coa))}`,
    `https://armoria.vercel.app/api?size=500&format=png&coa=${encodeURIComponent(JSON.stringify(coa))}`,
    `https://armoria.herokuapp.com/?size=500&format=png&coa=${encodeURIComponent(JSON.stringify(coa))}`,
    `https://armoria.herokuapp.com/?size=500&format=svg&coa=${encodeURIComponent(JSON.stringify(coa))}`,
    JSON.stringify(coa),
    encodeURIComponent(JSON.stringify(coa))
  ])("reads a COA from %s", input => {
    expect(Armoria.parse(input)).toEqual(coa);
  });

  it.each([
    "https://example.com/emblem.svg",
    "https://armoria.herokuapp.com/svg/500/seed",
    "https://armoria.vercel.app/api?format=svg&seed=123",
    "https://azgaar.github.io/Armoria/?seed=123",
    ""
  ])("refuses %s, which names no COA", input => {
    expect(() => Armoria.parse(input)).toThrow("picture button");
  });

  it("rejects malformed COAs with an author-facing error", () => {
    expect(() => Armoria.parse("https://azgaar.github.io/Armoria/?coa=%7Bbad")).toThrow("not valid JSON");
    expect(() => Armoria.parse('{"t1":"gules","charges":{}}')).toThrow("not valid JSON");
  });

  it("reads exact hex colours, plain and inside patterns, as the API accepts them", () => {
    const hex = { t1: "vair-#228833-or", charges: [{ charge: "lionRampant", t: "#f00", p: "e" }] };
    expect(Armoria.parse(`https://azgaar.github.io/Armoria/?coa=${encodeURIComponent(JSON.stringify(hex))}`)).toEqual(
      hex
    );
  });

  it("reads the COA of an Armoria API picture, on either host", () => {
    const query = `size=500&format=png&coa=${encodeURIComponent(JSON.stringify(coa))}`;
    const linked = (content: string) => ({ id: "custom-1", kind: "image" as const, content, viewBox: "0 0 100 100" });
    expect(Armoria.pictureCoa(linked(`${Armoria.API}?${query}`))).toEqual(coa);
    expect(Armoria.pictureCoa(linked(`https://armoria.herokuapp.com/?${query}`))).toEqual(coa);
    expect(Armoria.pictureCoa(linked("https://armoria.herokuapp.com/png/500/seed"))).toBeNull();
    expect(Armoria.pictureCoa(linked(`https://azgaar.github.io/Armoria/?${query}`))).toBeNull();
  });

  it("moves links of the retired Heroku API to the current one", () => {
    expect(Armoria.migrateLink("https://armoria.herokuapp.com/?size=500&format=png&coa=x")).toBe(
      `${Armoria.API}?size=500&format=png&coa=x`
    );
    expect(Armoria.migrateLink("https://armoria.herokuapp.com/png/500/seed")).toBe(`${Armoria.API}/png/500/seed`);
    expect(Armoria.migrateLink("https://example.com/armoria.herokuapp.com/")).toBe(
      "https://example.com/armoria.herokuapp.com/"
    );
  });

  it("reads the COA an Armoria picture keeps, or the one its API link names", () => {
    const frame = { viewBox: "0 0 100 100" };
    expect(Armoria.pictureCoa({ id: "custom-1", kind: "svg", content: "<g/>", ...frame, coa })).toBe(coa);
    const link = `${Armoria.API}?coa=${encodeURIComponent(JSON.stringify(coa))}`;
    expect(Armoria.pictureCoa({ id: "custom-2", kind: "image", content: link, ...frame })).toEqual(coa);
    expect(
      Armoria.pictureCoa({ id: "custom-3", kind: "image", content: "https://example.com/a.png", ...frame })
    ).toBeNull();
    expect(Armoria.pictureCoa(undefined)).toBeNull();
  });
});

const fileCoa = {
  t1: "azure",
  charges: [{ charge: "lionRampant", t: "or", p: "e" }],
  inscriptions: [{ text: "Ünï ✓", path: "M0 0" }]
};
const encode = (text: string) => new TextEncoder().encode(text);
const bytes = (...values: number[]) => new Uint8Array(values);
const join = (...parts: Uint8Array[]) => new Uint8Array(parts.flatMap(part => [...part]));
const uint32 = (n: number) => bytes(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const chunk = (type: string, data: Uint8Array) => join(uint32(data.length), encode(type), data, uint32(0)); // CRC unread

const png = (...chunks: Uint8Array[]) =>
  new Blob([
    join(
      bytes(0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10),
      chunk("IHDR", new Uint8Array(13)),
      ...chunks,
      chunk("IEND", bytes())
    )
  ]);
const itxt = (keyword: string, text: string) =>
  chunk("iTXt", join(encode(keyword), bytes(0, 0, 0, 0, 0), encode(text)));

const segment = (marker: number, data: Uint8Array) =>
  join(bytes(0xff, marker, (data.length + 2) >> 8, (data.length + 2) & 255), data);
const jpeg = (...segments: Uint8Array[]) =>
  new Blob([
    join(bytes(0xff, 0xd8), segment(0xe0, encode("JFIF\0")), ...segments, segment(0xda, bytes(0)), bytes(1, 2, 3))
  ]);

const svg = (inner: string) => new Blob([`<svg xmlns="http://www.w3.org/2000/svg">${inner}<rect/></svg>`]);

describe("COA kept in an Armoria download", () => {
  it("reads it from SVG metadata, a PNG text chunk and a JPEG comment", async () => {
    const json = JSON.stringify(fileCoa);
    const escaped = json.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
    expect(await Armoria.fileCoa(svg(`<metadata class="armoria-coa">${escaped}</metadata>`))).toEqual(fileCoa);
    expect(await Armoria.fileCoa(png(chunk("tEXt", encode("Software\0x")), itxt("armoria-coa", json)))).toEqual(
      fileCoa
    );
    expect(
      await Armoria.fileCoa(jpeg(segment(0xfe, encode("other")), segment(0xfe, encode(`armoria-coa:${json}`))))
    ).toEqual(fileCoa);
  });

  it("finds none in other images, other keywords, or text that is not a COA", async () => {
    expect(await Armoria.fileCoa(svg("<metadata>{}</metadata>"))).toBeNull();
    expect(await Armoria.fileCoa(png())).toBeNull();
    expect(await Armoria.fileCoa(png(itxt("Comment", JSON.stringify(fileCoa))))).toBeNull();
    expect(await Armoria.fileCoa(jpeg(segment(0xfe, encode("armoria-coa:{bad"))))).toBeNull();
    expect(await Armoria.fileCoa(jpeg(segment(0xfe, encode('armoria-coa:{"charges":[]}'))))).toBeNull(); // no field
  });
});
