// Browser-mode tests (vitest.browser.config.ts): the sources and tiles the icon picker opens with
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { IconSets } from "@/components/icon-sets";
import { CustomIcons, Icons } from "@/components/icons";
import "@/generators/relief-generator"; // the models own the set definitions the picker lists
import "@/generators/burgs-generator";
import "@/generators/goods-generator";
import { IconPicker } from ".";

const pictures = vi.hoisted(() => ({ fromLink: vi.fn(), fromFile: vi.fn(), fit: vi.fn() }));
vi.mock("./pictures", () => ({ IconPictures: pictures }));

const confirm = vi.hoisted(() => ({
  onConfirm: undefined as undefined | (() => void),
  apply: undefined as undefined | (() => void)
}));

beforeEach(() => {
  vi.spyOn(Icons, "load");
  (globalThis as Record<string, unknown>).options = { map: { customIcons: [] } };
  (globalThis as Record<string, unknown>).Options = { save: vi.fn(), iconsChanged: vi.fn() };
  document.body.innerHTML =
    '<div id="dialogs"></div><div id="alert"><p id="alertMessage"></p></div><div id="tooltip"></div><svg id="defElements"><defs></defs></svg>';
  // the dialog stub keeps a confirmation's Remove button, to press it as the author would
  (globalThis as Record<string, unknown>).$ = () => ({
    dialog: (settings: { buttons?: Record<string, () => void> }) => {
      confirm.onConfirm = settings?.buttons?.Remove;
      if (settings?.buttons?.Apply) confirm.apply = settings.buttons.Apply;
    }
  });
});

afterEach(async () => {
  await Promise.all(vi.mocked(Icons.load).mock.results.map(result => result.value));
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const open = (current: string, onPick = vi.fn()) => {
  IconPicker.open({ current, onPick, live: true });
  const dialog = document.getElementById("iconPicker")!;
  return {
    dialog,
    onPick,
    source: () => dialog.querySelector<HTMLElement>("nav .active")?.dataset.source,
    show: (source: string) => dialog.querySelector<HTMLElement>(`nav [data-source="${source}"]`)!.click(),
    pressed: () => [...dialog.querySelectorAll<HTMLElement>(".choices .pressed")].map(button => button.dataset.icon)
  };
};

test("a set icon opens on its own subdirectory, with the icon pressed and named", () => {
  const { dialog, source, pressed } = open("burgs-watabou-city");
  expect(source()).toBe("burgs/watabou");
  expect(dialog.querySelector('[data-icon^="burgs-atlas-"]')).toBeNull(); // other entries draw nothing until shown
  expect(pressed()).toEqual(["burgs-watabou-city"]);
  expect(dialog.querySelector(".current .name")!.textContent).toBe("City");
  expect(dialog.querySelector(".current .from")!.textContent).toBe("Settlements · Watabou");
});

test("the sources list the map's icons, then emoji by theme and sets by subdirectory under group headings", () => {
  const { dialog } = open("");
  const items = [...dialog.querySelectorAll<HTMLElement>("nav > *")].map(item =>
    item.dataset.source ? item.dataset.source : `# ${item.textContent}`
  );
  expect(items.slice(0, 3)).toEqual(["custom", "# Emoji", "glyph/War & power"]);
  expect(items).toEqual(expect.arrayContaining(["# Settlements", "burgs/watabou", "ports", "goods", "# Relief"]));
  expect(items).not.toContain("# Goods"); // a set that is its own group stands alone
  expect(items.indexOf("relief-simple")).toBeGreaterThan(items.indexOf("# Relief"));
});

test("a slot opens where its current icon is: a glyph on Emoji, a custom icon on Custom", () => {
  options.map.customIcons = [
    { id: "custom-1a2b3c4d", kind: "image", content: "https://a.b/c.png", viewBox: "0 0 100 100" }
  ];
  const glyph = open("glyph-58-49-56");
  expect(glyph.source()).toMatch(/^glyph\//); // typed text: the first emoji theme
  expect(glyph.dialog.querySelector<HTMLInputElement>(".glyphText input")!.value).toBe("XIV");

  const custom = open("custom-1a2b3c4d");
  expect(custom.source()).toBe("custom");
  expect(custom.pressed()).toEqual(["custom-1a2b3c4d"]);

  const none = open("");
  expect(none.source()).toBe("burgs/atlas"); // no icon yet: the first built-in entry
  expect(none.dialog.querySelector(".current .name")!.textContent).toBe("None");
});

test("picking presses the tile, names it in the header and hands its reference back; typed text is a glyph", () => {
  const { dialog, onPick, pressed, show } = open("goods-wood");
  dialog.querySelector<HTMLElement>('button[data-icon="goods-iron"]')!.click();
  expect(onPick).toHaveBeenLastCalledWith("goods-iron");
  expect(pressed()).toEqual(["goods-iron"]);
  expect(dialog.querySelector(".current .name")!.textContent).toBe("Iron");

  show("glyph/War & power");
  const input = dialog.querySelector<HTMLInputElement>(".glyphText input")!;
  input.value = "XIV";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  expect(onPick).toHaveBeenLastCalledWith("glyph-58-49-56");
});

test("without live, the pick is handed back on Apply only", () => {
  const onPick = vi.fn();
  IconPicker.open({ current: "goods-wood", onPick });
  document.querySelector<HTMLElement>('#iconPicker button[data-icon="goods-iron"]')!.click();
  expect(onPick).not.toHaveBeenCalled();
  confirm.apply!();
  expect(onPick).toHaveBeenCalledExactlyOnceWith("goods-iron");
});

test("a relief set offers every variant it has art for, and no fallback slots", () => {
  const { dialog, show } = open("goods-wood");
  const tiles = (set: string) => {
    show(set);
    return [...dialog.querySelectorAll<HTMLElement>(".panel [data-icon]")].map(button => button.dataset.icon);
  };
  expect(tiles("relief-colored")).toEqual(expect.arrayContaining(["relief-colored-mount-1", "relief-colored-mount-6"]));
  const simple = tiles("relief-simple");
  expect(simple).toHaveLength(IconSets.files("relief-simple").length);
  expect(simple).toContain("relief-simple-vulcan-3");
  expect(simple).not.toContain("relief-simple-mount-6"); // an alias drawn through another file
});

test("search finds built-in icons and emoji by name across the sets, and clearing it returns to the source", () => {
  const { dialog, source } = open("goods-wood");
  const search = dialog.querySelector<HTMLInputElement>(".search")!;
  search.value = "anchor";
  search.dispatchEvent(new Event("input"));
  expect(source()).toBeUndefined();
  expect([...dialog.querySelectorAll<HTMLElement>(".panel [data-icon]")].map(b => b.dataset.icon)).toEqual([
    "glyph-2693", // ⚓, found by its emoji name
    "ports-anchor",
    "charges-seafaring-anchor"
  ]);
  search.value = "Timber"; // names keep their file's case
  search.dispatchEvent(new Event("input"));
  expect([...dialog.querySelectorAll<HTMLElement>(".panel [data-icon]")].map(b => b.dataset.icon)).toEqual([
    "goods-tropicalTimber"
  ]);
  search.value = "no such icon";
  search.dispatchEvent(new Event("input"));
  expect(dialog.querySelector(".panel .empty")).not.toBeNull();
  search.value = "";
  search.dispatchEvent(new Event("input"));
  expect(source()).toBe("goods");
});

const LINKED = { kind: "image", content: "https://a.b/c.png", viewBox: "0 0 100 100" } as const;

test("the Custom source offers the link field first, then upload; a custom icon's actions are in the header", () => {
  options.map.customIcons = [{ id: "custom-1a2b3c4d", ...LINKED }];
  const { dialog } = open("custom-1a2b3c4d");
  const controls = [...dialog.querySelectorAll(".customAdd input, .customAdd button")].map(
    element => (element as HTMLElement).dataset.action ?? element.tagName
  );
  expect(controls).toEqual(["INPUT", "link", "upload"]);
  const actions = [...dialog.querySelectorAll<HTMLElement>(".currentActions [data-action]")].map(
    button => button.dataset.action
  );
  expect(actions).toEqual(["position", "replace", "remove"]);
  expect(dialog.querySelectorAll(".note a").length).toBeGreaterThan(0);
  expect(open("goods-wood").dialog.querySelector(".currentActions")).toBeNull(); // a built-in icon has none
});

test("a linked picture becomes a new custom icon and is picked; replacing keeps the id", async () => {
  pictures.fromLink.mockResolvedValue(LINKED);
  const { dialog, onPick, show } = open("");
  show("custom");
  dialog.querySelector<HTMLInputElement>(".customAdd input")!.value = "https://a.b/c.png";
  dialog.querySelector<HTMLElement>('[data-action="link"]')!.click();
  await vi.waitFor(() => expect(onPick).toHaveBeenCalled());
  const [added] = CustomIcons.all;
  expect(onPick).toHaveBeenLastCalledWith(added.id);
  expect(document.getElementById(added.id)?.tagName).toBe("symbol");
  expect(dialog.querySelectorAll(".panel [data-icon]")).toHaveLength(1);
  expect(dialog.querySelector('nav [data-source="custom"] small')!.textContent).toBe("1");

  pictures.fromLink.mockResolvedValue({ ...LINKED, content: "https://a.b/d.png" });
  dialog.querySelector<HTMLElement>('.currentActions [data-action="replace"]')!.click();
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
  dialog.querySelector<HTMLElement>('.currentActions [data-action="remove"]')!.click();
  expect(document.getElementById("alertMessage")!.textContent).toContain("12 markers, 1 good");
  confirm.onConfirm?.();
  expect(CustomIcons.all).toEqual([]);
  expect(dialog.querySelector(".panel [data-icon]")).toBeNull();
  expect(dialog.querySelector(".currentActions")).toBeNull();
});
