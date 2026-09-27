// @vitest-environment jsdom

import { beforeEach, expect, test, vi } from "vitest";
import { CustomIcons, type IconPicture, Icons } from "@/components/icons";
import { ReliefPoolEditor } from "@/controllers/relief-pool-editor";
import { IconPicker } from ".";
import { openPositioner } from "./positioner";
import "@/generators/relief-generator";
import "@/generators/burgs-generator";
import "@/generators/goods-generator";
import "@/components/shared/slider-input";

const pictures = vi.hoisted(() => ({ fromLink: vi.fn(), fromFile: vi.fn(), fit: vi.fn() }));
vi.mock("./pictures", () => ({ IconPictures: pictures }));
vi.mock("@/components/icon-sets", () => ({ IconSets: { sets: () => [], setForId: () => undefined } }));
vi.mock("@/controllers", async () => ({ Controllers: { IconPicker: (await import(".")).IconPicker } }));

type DialogSettings = { close?: () => void; buttons?: Record<string, (this: HTMLElement) => void> };
const dialogs = new Map<HTMLElement, DialogSettings>();
const PICTURE: IconPicture = { kind: "image", content: "https://example.com/icon.png", viewBox: "0 0 100 100" };

beforeEach(() => {
  dialogs.clear();
  vi.clearAllMocks();
  vi.spyOn(Icons, "syncCustom").mockImplementation(() => {}); // the fixture's symbols stand for the synced ones
  options.map.customIcons = ["custom-a", "custom-b"].map(id => ({ id, ...PICTURE }));
  document.body.innerHTML = `<div id="dialogs"></div><div id="tooltip"></div><svg id="defElements"><defs>
    <symbol id="custom-a" viewBox="0 0 100 100"><path d="M0 0h100v100z"/></symbol>
    <symbol id="custom-b" viewBox="0 0 100 100"><path d="M0 0h100v100z"/></symbol>
    </defs></svg>`;
  (globalThis as Record<string, unknown>).$ = (element: HTMLElement) => ({
    dialog(settings: DialogSettings | string) {
      if (settings === "close") dialogs.get(element)?.close?.();
      else if (settings === "destroy") dialogs.delete(element);
      else if (typeof settings !== "string") {
        element.classList.add("ui-dialog-content");
        dialogs.set(element, settings);
      }
    }
  });
});

function press(dialogId: string, button: string): void {
  const dialog = document.getElementById(dialogId)!;
  dialogs.get(dialog)!.buttons![button].call(dialog);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

test("a pool picker previews one addition, applies a double click once and undoes cancellation", () => {
  vi.spyOn(Icons, "retry").mockResolvedValue(undefined);
  Object.assign(SVGElement.prototype, { getBBox: () => ({ x: 0, y: 0, width: 0, height: 0 }) });
  globalThis.styles = { relief: { options: { set: "simple" }, attrs: {} } } as typeof styles;
  globalThis.pack = {
    biomes: [{ i: 0, name: "Forest", iconsDensity: 120, icons: { "custom-a": 2 } }]
  } as unknown as typeof pack;
  ReliefPoolEditor.open({ biome: 0 });
  const add = () => {
    document.querySelector<HTMLElement>("#reliefPoolEditor .any")!.click();
    document.querySelector<HTMLElement>('#iconPicker nav [data-source="custom"]')!.click();
  };
  const weight = (id: string) =>
    document.querySelector<HTMLInputElement>(`#reliefPoolEditor [data-entry="${id}"] .weight`)?.value;
  add();
  const tile = document.querySelector<HTMLElement>('#iconPicker .choices [data-icon="custom-a"]')!;
  tile.click();
  tile.click();
  tile.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  expect(weight("custom-a")).toBe("3");

  add();
  document.querySelector<HTMLElement>('#iconPicker .choices [data-icon="custom-b"]')!.click();
  expect(weight("custom-b")).toBe("1");
  press("iconPicker", "Cancel");
  expect(weight("custom-b")).toBeUndefined();
  expect(weight("custom-a")).toBe("3");

  add();
  document.querySelector<HTMLElement>('#iconPicker nav [data-source="glyph"]')!.click();
  const input = document.querySelector<HTMLInputElement>("#iconPicker .glyphText input")!;
  for (const text of ["X", "XI", "XIV"]) {
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  press("iconPicker", "Apply");
  expect(weight(Icons.glyph("X"))).toBeUndefined();
  expect(weight(Icons.glyph("XI"))).toBeUndefined();
  expect(weight(Icons.glyph("XIV"))).toBe("1");
  press("reliefPoolEditor", "Apply");
  expect(pack.biomes[0].icons).toEqual({ "custom-a": 3, [Icons.glyph("XIV")]: 1 });
});

test("an active picker can add and replace a picture", async () => {
  pictures.fromLink.mockResolvedValue(PICTURE);
  const onPick = vi.fn();
  IconPicker.open({ current: "glyph-58", onPick });
  document.querySelector<HTMLElement>('#iconPicker nav [data-source="custom"]')!.click();
  document.querySelector<HTMLElement>('#iconPicker [data-action="link"]')!.click();
  await vi.waitFor(() => expect(onPick).toHaveBeenCalledOnce());
  const id = onPick.mock.calls[0][0];
  expect(CustomIcons.get(id)).toEqual({ id, ...PICTURE });
  pictures.fromLink.mockResolvedValue({ ...PICTURE, content: "https://example.com/replacement.png" });
  document.querySelector<HTMLElement>('#iconPicker .currentActions [data-action="replace"]')!.click();
  document.querySelector<HTMLElement>('#iconPicker [data-action="link"]')!.click();
  await vi.waitFor(() => expect(CustomIcons.get(id)?.content).toBe("https://example.com/replacement.png"));
  expect(CustomIcons.all).toHaveLength(3);
  press("iconPicker", "Cancel");
  expect(onPick).toHaveBeenLastCalledWith("glyph-58");
});

test.each(["cancel", "reopen", "load map"])("a pending link cannot update the map after %s", async action => {
  const pending = deferred<typeof PICTURE>();
  pictures.fromLink.mockReturnValue(pending.promise);
  const onPick = vi.fn();
  IconPicker.open({ current: "glyph-58", onPick });
  document.querySelector<HTMLElement>('#iconPicker nav [data-source="custom"]')!.click();
  document.querySelector<HTMLElement>('#iconPicker [data-action="link"]')!.click();
  if (action === "cancel") press("iconPicker", "Cancel");
  else if (action === "reopen") IconPicker.open({ current: "glyph-59", onPick: vi.fn() });
  else options.map = { ...options.map, customIcons: [] };
  const icons = [...CustomIcons.all];
  pending.resolve(PICTURE);
  await pending.promise;
  expect(CustomIcons.all).toEqual(icons);
  expect(onPick).not.toHaveBeenCalled();
});

test("a pending replacement cannot change an icon after cancellation", async () => {
  const pending = deferred<typeof PICTURE>();
  pictures.fromLink.mockReturnValue(pending.promise);
  IconPicker.open({ current: "custom-a", onPick: vi.fn() });
  document.querySelector<HTMLElement>('#iconPicker .currentActions [data-action="replace"]')!.click();
  document.querySelector<HTMLElement>('#iconPicker [data-action="link"]')!.click();
  press("iconPicker", "Cancel");
  pending.resolve({ ...PICTURE, content: "https://example.com/replacement.png" });
  await pending.promise;
  expect(CustomIcons.get("custom-a")?.content).toBe(PICTURE.content);
});

function zoom(): void {
  const slider = document.querySelector<HTMLInputElement>("#iconPositioner input")!;
  slider.value = "1";
  slider.dispatchEvent(new Event("input"));
}

test("opening another positioner restores the unapplied frame", () => {
  openPositioner("custom-a");
  zoom();
  expect(document.getElementById("custom-a")!.getAttribute("viewBox")).toBe("25 25 50 50");
  openPositioner("custom-b");
  expect(document.getElementById("custom-a")!.getAttribute("viewBox")).toBe(PICTURE.viewBox);
  zoom();
  press("iconPositioner", "Cancel");
  expect(document.getElementById("custom-b")!.getAttribute("viewBox")).toBe(PICTURE.viewBox);
});

test("an applied frame survives reopening and cancelling", () => {
  openPositioner("custom-a");
  zoom();
  press("iconPositioner", "Apply");
  openPositioner("custom-a");
  zoom();
  press("iconPositioner", "Cancel");
  expect(CustomIcons.get("custom-a")?.viewBox).toBe("25 25 50 50");
  expect(document.getElementById("custom-a")!.getAttribute("viewBox")).toBe("25 25 50 50");
});

test("a pending fit cannot change a frame after its positioner closes", async () => {
  const pending = deferred<string>();
  pictures.fit.mockReturnValue(pending.promise);
  openPositioner("custom-a");
  document.querySelector<HTMLElement>("#iconPositioner .fit")!.click();
  openPositioner("custom-b");
  pending.resolve("10 10 80 80");
  await pending.promise;
  expect(document.getElementById("custom-a")!.getAttribute("viewBox")).toBe(PICTURE.viewBox);
});
