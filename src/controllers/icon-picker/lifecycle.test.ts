// @vitest-environment jsdom

import { beforeEach, expect, test, vi } from "vitest";
import { ReliefPoolEditor } from "@/controllers/physical/relief/relief-pool-editor";
import { CustomIcons, type IconPicture, Icons } from "@/model/icons";
import { dialogButton } from "@/ui/dialog/dialog-testing";
import { IconPicker } from ".";
import { openPositioner } from "./positioner";
import "@/model/physical/relief-generator";
import "@/model/political/burgs-generator";
import "@/model/economy/goods-generator";
import "@/ui/elements/slider-input";

const pictures = vi.hoisted(() => ({ fromLink: vi.fn(), fromFile: vi.fn(), fit: vi.fn() }));
vi.mock("./pictures", () => ({ IconPictures: pictures }));
vi.mock("@/model/icon-sets", () => ({ IconSets: { sets: () => [], setForId: () => undefined } }));
vi.mock("@/controllers", async () => ({ Controllers: { IconPicker: (await import(".")).IconPicker } }));

const PICTURE: IconPicture = { kind: "image", content: "https://example.com/icon.png", viewBox: "0 0 100 100" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Icons, "syncCustom").mockImplementation(() => {}); // the fixture's symbols stand for the synced ones
  options.map.customIcons = ["custom-a", "custom-b"].map(id => ({ id, ...PICTURE }));
  document.body.innerHTML = `<div id="dialogs"></div><div id="tooltip"></div><svg id="defElements"><defs>
    <symbol id="custom-a" viewBox="0 0 100 100"><path d="M0 0h100v100z"/></symbol>
    <symbol id="custom-b" viewBox="0 0 100 100"><path d="M0 0h100v100z"/></symbol>
    </defs></svg>`;
});

const press = (dialogId: string, label: string) => dialogButton(label, dialogId).click();

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
  globalThis.styles = { relief: { options: { set: "simple", size: 1, density: 0.4 }, attrs: {} } } as typeof styles;
  globalThis.pack = {
    biomes: [{ i: 0, name: "Forest", iconsDensity: 120, icons: { "custom-a": { weight: 2 } } }]
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
  expect(weight("custom-b")).toBeUndefined(); // added on Apply only
  press("iconPicker", "Cancel");
  expect(weight("custom-b")).toBeUndefined();
  expect(weight("custom-a")).toBe("3");

  add();
  document.querySelector<HTMLElement>('#iconPicker nav [data-source^="glyph/"]')!.click();
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
  expect(pack.biomes[0].icons).toEqual({ "custom-a": { weight: 3 }, [Icons.glyph("XIV")]: { weight: 1 } });
});

test("an active picker can add and replace a picture", async () => {
  pictures.fromLink.mockResolvedValue(PICTURE);
  const onPick = vi.fn();
  IconPicker.open({ current: "glyph-58", onPick, live: true });
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
  IconPicker.open({ current: "glyph-58", onPick, live: true });
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
  const slider = document.querySelector<HTMLInputElement>("#iconPositioner input[type=range]")!;
  slider.value = "200";
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
