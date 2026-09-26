// @vitest-environment jsdom

import { beforeEach, expect, test, vi } from "vitest";
import { CustomIcons, type IconPicture, Icons } from "@/components/icons";
import { IconPicker } from ".";
import { openPositioner } from "./positioner";

const pictures = vi.hoisted(() => ({ fromLink: vi.fn(), fromFile: vi.fn(), fit: vi.fn() }));
vi.mock("./pictures", () => ({ IconPictures: pictures }));
vi.mock("@/components/icon-sets", () => ({ IconSets: { sets: () => [], setForId: () => undefined } }));

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

test("an active picker can add and replace a picture", async () => {
  pictures.fromLink.mockResolvedValue(PICTURE);
  const onPick = vi.fn();
  IconPicker.open({ current: "glyph-58", onPick });
  document.querySelector<HTMLElement>('#iconPicker [data-action="link"]')!.click();
  await vi.waitFor(() => expect(onPick).toHaveBeenCalledOnce());
  const id = onPick.mock.calls[0][0];
  expect(CustomIcons.get(id)).toEqual({ id, ...PICTURE });
  pictures.fromLink.mockResolvedValue({ ...PICTURE, content: "https://example.com/replacement.png" });
  document.querySelector<HTMLElement>(`[data-id="${id}"] [data-action="replace"]`)!.click();
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
  document.querySelector<HTMLElement>('[data-id="custom-a"] [data-action="replace"]')!.click();
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
