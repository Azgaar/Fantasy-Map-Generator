// @vitest-environment jsdom

import { beforeEach, expect, test, vi } from "vitest";
import { CustomIcons, Icons } from "./icons";
import "@/components/options-model";
import { IconSets } from "@/components/icon-sets";
import "@/generators/relief-generator"; // the models own the icon set namespaces a new id must stay out of
import "@/generators/burgs-generator";
import "@/generators/goods-generator";
import { Styles } from "@/generators/styles";

beforeEach(() => {
  options.map.customIcons = [];
});

test("an added icon gets a fresh custom id, and an adopted one keeps its own", () => {
  const linked = CustomIcons.add({ kind: "image", content: "https://a.b/c.png", viewBox: "0 0 100 100" });
  expect(linked.id).toMatch(/^custom-[\da-f]{8}$/);
  const adopted = CustomIcons.add({ id: "custom-goods-ab12", kind: "svg", content: "<g/>", viewBox: "0 0 10 10" });
  expect(CustomIcons.get("custom-goods-ab12")).toBe(adopted);
  expect(CustomIcons.all).toEqual([linked, adopted]);
  expect(options.map.customIcons).toBe(CustomIcons.all);
});

test("adding an icon never draws from the map's seeded random sequence", () => {
  const random = vi.spyOn(Math, "random");
  CustomIcons.add({ kind: "image", content: "https://a.b/c.png", viewBox: "0 0 100 100" });
  expect(random).not.toHaveBeenCalled();
});

test("a new id is a reference no icon set owns", () => {
  const { id } = CustomIcons.add({ kind: "svg", content: "<g/>", viewBox: "0 0 1 1" });
  expect(IconSets.setForId(id)).toBeUndefined();
  expect(Icons.kind(id)).toBe("custom");
});

test("a new id never repeats one the map holds", () => {
  const uuid = vi.spyOn(crypto, "randomUUID");
  uuid.mockReturnValueOnce("aaaaaaaa-0000-4000-8000-000000000000");
  uuid.mockReturnValueOnce("aaaaaaaa-1111-4000-8000-000000000000");
  uuid.mockReturnValueOnce("bbbbbbbb-0000-4000-8000-000000000000");
  const first = CustomIcons.add({ kind: "svg", content: "<g/>", viewBox: "0 0 1 1" });
  const second = CustomIcons.add({ kind: "svg", content: "<g/>", viewBox: "0 0 1 1" });
  expect([first.id, second.id]).toEqual(["custom-aaaaaaaa", "custom-bbbbbbbb"]);
});

test("replacing keeps the id, framing edits only the frame, removing leaves references alone", () => {
  const icon = CustomIcons.add({ kind: "image", content: "https://a.b/c.png", viewBox: "0 0 100 100" });
  CustomIcons.replace(icon.id, { kind: "svg", content: "<g/>", viewBox: "0 0 10 10" });
  expect(CustomIcons.get(icon.id)).toEqual({ id: icon.id, kind: "svg", content: "<g/>", viewBox: "0 0 10 10" });

  CustomIcons.setFrame(icon.id, "1 1 8 8");
  expect(CustomIcons.get(icon.id)?.viewBox).toBe("1 1 8 8");
  expect(CustomIcons.get(icon.id)?.content).toBe("<g/>");

  CustomIcons.remove(icon.id);
  expect(CustomIcons.get(icon.id)).toBeUndefined();
  expect(options.map.customIcons).toEqual([]);
});

test("an svg becomes a picture that keeps the root's paint and frame", () => {
  const svg = new DOMParser().parseFromString(
    '<svg viewBox="0,0 1e3 1E3" fill="red" width="10"><path d="M0 0"/></svg>',
    "image/svg+xml"
  ).documentElement;
  expect(CustomIcons.fromSvg(svg)).toEqual({
    kind: "svg",
    content: '<g fill="red"><path d="M0 0"/></g>',
    viewBox: "0 0 1000 1000"
  });
});

test("any short text round-trips through its glyph reference", () => {
  for (const text of ["🏰", "XIV", "⟱", "🏴‍☠️", "💃🏽", "#️⃣", "a b"])
    expect(Icons.glyphText(Icons.glyph(text))).toBe(text);
  expect(Icons.glyph("XIV")).toBe("glyph-58-49-56");
  expect(Icons.glyph("")).toBe(""); // no icon
  expect(Icons.glyphText("goods-wood")).toBeNull();
  expect(Icons.glyphText("glyph-zz")).toBeNull();
  expect(Icons.glyphText("glyph-110000")).toBeNull(); // beyond Unicode
});

test("a reference resolves to a set, a glyph or a custom icon; anything else is not one", () => {
  expect(Icons.kind("burgs-watabou-capital")).toBe("set");
  expect(Icons.kind("glyph-58-49-56")).toBe("glyph");
  expect(Icons.kind("custom-1a2b3c4d")).toBe("custom");
  expect(Icons.kind("hq-2")).toBeNull();
  expect(Icons.kind("")).toBeNull();
});

test("an icon is named by its glyph or its file", () => {
  expect(Icons.name("burgs-watabou-capital")).toBe("capital");
  expect(Icons.name("burgs-mine")).toBe("mine");
  expect(Icons.name("relief-simple-mount-1")).toBe("mount");
  expect(Icons.name("goods-salted-fish")).toBe("salted fish");
  expect(Icons.name("glyph-58-49-56")).toBe("XIV");
  expect(Icons.name("custom-1a2b3c4d")).toBe("custom icon");
  expect(Icons.name("")).toBe("none");
});

test("a frame reads any number format and is written as plain numbers", () => {
  expect(Icons.parseFrame("0,0 1e3 1E3")).toEqual([0, 0, 1000, 1000]);
  expect(Icons.parseFrame(" -6.2 -19.3 12.6 20.8 ")).toEqual([-6.2, -19.3, 12.6, 20.8]);
  for (const bad of ["", "0 0 10", "0 0 0 10", "0 0 -1 10", "a b c d"]) expect(Icons.parseFrame(bad)).toBeNull();
  expect(Icons.formatFrame([1 / 3, -0.0001, 1e3, 12.6])).toBe("0.333 0 1000 12.6");
});

test("every slot kind's uses of an icon are counted", () => {
  globalThis.styles = Styles.parse(undefined);
  styles.markets.options.icon = "custom-a";
  styles.burgIcons.groups.city.groups.anchors.options.icon = "custom-a";
  options.map.military.units = [{ ...options.map.military.units[0], icon: "goods-wood" }];
  globalThis.pack = {
    goods: [{ icon: "goods-wood" }],
    markers: [{ icon: "custom-a" }, { icon: "custom-a" }],
    states: [{ i: 0 }, { i: 1, military: [{ icon: "custom-a" }] }]
  } as unknown as typeof pack;

  expect(Icons.uses("custom-a")).toEqual({ marker: 2, regiment: 1, burgGroup: 1, market: 1 });
  expect(Icons.uses("goods-wood")).toEqual({ good: 1, unit: 1 });
  expect(Icons.uses("custom-b")).toEqual({});
});
