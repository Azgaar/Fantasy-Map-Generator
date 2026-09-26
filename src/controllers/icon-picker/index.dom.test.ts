// Browser-mode tests (vitest.browser.config.ts): the tabs and tiles the icon picker opens with
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { CustomIcons, Icons } from "@/components/icons";
import "@/generators/relief-generator"; // the models own the set definitions the picker lists
import "@/generators/burgs-generator";
import "@/generators/goods-generator";
import { IconPicker } from ".";

const pictures = vi.hoisted(() => ({ fromLink: vi.fn(), fromFile: vi.fn(), fit: vi.fn() }));
vi.mock("./pictures", () => ({ IconPictures: pictures }));

const confirm = vi.hoisted(() => ({ onConfirm: undefined as undefined | (() => void) }));

beforeEach(() => {
  (globalThis as Record<string, unknown>).options = { map: { customIcons: [] } };
  (globalThis as Record<string, unknown>).Options = { save: vi.fn() };
  document.body.innerHTML =
    '<div id="dialogs"></div><div id="alert"><p id="alertMessage"></p></div><div id="tooltip"></div><svg id="defElements"><defs></defs></svg>';
  // the dialog stub keeps a confirmation's Remove button, to press it as the author would
  (globalThis as Record<string, unknown>).$ = () => ({
    dialog: (settings: { buttons?: Record<string, () => void> }) => {
      confirm.onConfirm = settings?.buttons?.Remove;
    }
  });
});

afterEach(() => document.body.replaceChildren());

const open = (current: string, onPick = vi.fn()) => {
  IconPicker.open({ current, onPick });
  const dialog = document.getElementById("iconPicker")!;
  return {
    dialog,
    onPick,
    tab: () => dialog.querySelector<HTMLElement>(".tabs .pressed")?.dataset.tab,
    pressed: () => [...dialog.querySelectorAll<HTMLElement>(".choices .pressed")].map(button => button.dataset.icon)
  };
};

test("a set icon opens Built-in on its own set, grouped by style, with the icon pressed", () => {
  const { dialog, tab, pressed } = open("burgs-watabou-city");
  expect(tab()).toBe("builtin");
  const burgs = dialog.querySelector<HTMLDetailsElement>('details[data-set="burgs"]')!;
  expect(burgs.open).toBe(true);
  expect([...burgs.querySelectorAll("h4")].map(h => h.textContent)).toEqual(["Atlas", "Illustrated", "Watabou"]);
  expect(dialog.querySelector<HTMLDetailsElement>('details[data-set="goods"]')!.open).toBe(false);
  expect(dialog.querySelector('details[data-set="goods"] .choices')).toBeNull(); // unopened sets draw nothing
  expect(pressed()).toEqual(["burgs-watabou-city"]);
});

test("a slot opens where its current icon is: a glyph on Emoji, a custom icon on Custom", () => {
  options.map.customIcons = [
    { id: "custom-1a2b3c4d", kind: "image", content: "https://a.b/c.png", viewBox: "0 0 100 100" }
  ];
  const glyph = open("glyph-58-49-56");
  expect(glyph.tab()).toBe("emoji");
  expect(glyph.dialog.querySelector<HTMLInputElement>(".glyphText input")!.value).toBe("XIV");

  const custom = open("custom-1a2b3c4d");
  expect(custom.tab()).toBe("custom");
  expect(custom.pressed()).toEqual(["custom-1a2b3c4d"]);

  expect(open("").tab()).toBe("builtin"); // no icon yet
});

test("picking presses the tile and hands its reference back; typed text is a glyph", () => {
  const { dialog, onPick, pressed } = open("goods-wood");
  dialog.querySelector<HTMLElement>('details[data-set="goods"] button[data-icon="goods-iron"]')!.click();
  expect(onPick).toHaveBeenLastCalledWith("goods-iron");
  expect(pressed()).toEqual(["goods-iron"]);

  const input = dialog.querySelector<HTMLInputElement>(".glyphText input")!;
  input.value = "XIV";
  input.dispatchEvent(new Event("input"));
  expect(onPick).toHaveBeenLastCalledWith("glyph-58-49-56");
});

test("a relief set offers one variant per type once opened", () => {
  const { dialog } = open("goods-wood");
  const relief = dialog.querySelector<HTMLDetailsElement>('details[data-set="relief-simple"]')!;
  relief.open = true;
  relief.dispatchEvent(new Event("toggle"));
  const tiles = [...relief.querySelectorAll<HTMLElement>("button[data-icon]")].map(button => button.dataset.icon);
  expect(tiles).toHaveLength(Relief.types.length);
  expect(tiles).toContain("relief-simple-mount-1");
});

const LINKED = { kind: "image", content: "https://a.b/c.png", viewBox: "0 0 100 100" } as const;

test("the Custom tab offers the link field first, then upload, and each icon its actions", () => {
  options.map.customIcons = [{ id: "custom-1a2b3c4d", ...LINKED }];
  const { dialog } = open("custom-1a2b3c4d");
  const panel = dialog.querySelector('[data-panel="custom"]')!;
  const controls = [...panel.querySelectorAll(".customAdd input, .customAdd button")].map(
    element => (element as HTMLElement).dataset.action ?? element.tagName
  );
  expect(controls).toEqual(["INPUT", "link", "upload"]);
  const actions = [...panel.querySelectorAll<HTMLElement>(".customTile [data-action]")].map(
    span => span.dataset.action
  );
  expect(actions).toEqual(["position", "replace", "remove"]);
  expect(panel.querySelectorAll(".sources a").length).toBeGreaterThan(0);
});

test("a linked picture becomes a new custom icon and is picked; replacing keeps the id", async () => {
  pictures.fromLink.mockResolvedValue(LINKED);
  const { dialog, onPick } = open("");
  dialog.querySelector<HTMLInputElement>(".customAdd input")!.value = "https://a.b/c.png";
  dialog.querySelector<HTMLElement>('[data-action="link"]')!.click();
  await vi.waitFor(() => expect(onPick).toHaveBeenCalled());
  const [added] = CustomIcons.all;
  expect(onPick).toHaveBeenLastCalledWith(added.id);
  expect(document.getElementById(added.id)?.tagName).toBe("symbol");
  expect(dialog.querySelectorAll(".customTile")).toHaveLength(1);

  pictures.fromLink.mockResolvedValue({ ...LINKED, content: "https://a.b/d.png" });
  dialog.querySelector<HTMLElement>('.customTile [data-action="replace"]')!.click();
  expect(dialog.querySelector<HTMLElement>(".replacing")!.hidden).toBe(false);
  dialog.querySelector<HTMLElement>('[data-action="link"]')!.click();
  await vi.waitFor(() => expect(CustomIcons.get(added.id)?.content).toBe("https://a.b/d.png"));
  expect(CustomIcons.all).toHaveLength(1);
  expect(dialog.querySelector<HTMLElement>(".replacing")!.hidden).toBe(true);
});

test("removing tells how many slots use the icon, and removes it once confirmed", () => {
  options.map.customIcons = [{ id: "custom-1a2b3c4d", ...LINKED }];
  vi.spyOn(Icons, "uses").mockReturnValue({ marker: 12, good: 1 });
  const { dialog } = open("custom-1a2b3c4d");
  dialog.querySelector<HTMLElement>('.customTile [data-action="remove"]')!.click();
  expect(document.getElementById("alertMessage")!.textContent).toContain("12 markers, 1 good");
  confirm.onConfirm?.();
  expect(CustomIcons.all).toEqual([]);
  expect(dialog.querySelector(".customTile")).toBeNull();
});
