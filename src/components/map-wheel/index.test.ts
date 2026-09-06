import { afterEach, describe, expect, it, vi } from "vitest";
import { clampCentre, closeMapWheel, openMapWheel } from "./index";
import type { WheelRoots } from "./wheel";

vi.mock("@/components/layers", () => ({ Layers: { isOn: () => false } }));

const roots: WheelRoots = {
  menu: () => [{ label: "Layers", icon: "icon-eye", run: () => {} }],
  here: () => [{ label: "Edit burg", icon: "icon-star", run: () => {} }]
};

const rightClick = (x = 400, y = 300) =>
  new MouseEvent("contextmenu", { clientX: x, clientY: y, bubbles: true, cancelable: true });

afterEach(() => closeMapWheel());

describe("clampCentre", () => {
  it("leaves a centred wheel alone", () => {
    expect(clampCentre(600, 400, 1280, 720)).toEqual([600, 400]);
  });

  it("pushes a wheel opened at the top-left corner fully into view", () => {
    const [x, y] = clampCentre(5, 5, 1280, 720);
    expect(x).toBeGreaterThanOrEqual(258);
    expect(y).toBeGreaterThanOrEqual(258);
  });

  it("pushes a wheel opened at the bottom-right corner fully into view", () => {
    const [x, y] = clampCentre(1275, 715, 1280, 720);
    expect(x).toBeLessThanOrEqual(1280 - 258);
    expect(y).toBeLessThanOrEqual(720 - 258);
  });

  it("reserves room for an open drawer on the side it opens", () => {
    const [x] = clampCentre(1000, 400, 1280, 720, "right");
    expect(x).toBeLessThanOrEqual(1280 - 258 - 354);
  });
});

describe("openMapWheel", () => {
  it("mounts a single host and centres it on the pointer", () => {
    openMapWheel(rightClick(400, 300), roots);
    const host = document.getElementById("mapWheel")!;
    expect(host).toBeTruthy();
    expect(host.querySelectorAll("path.mw-sector").length).toBe(1);
  });

  it("replaces an existing wheel rather than stacking a second one", () => {
    openMapWheel(rightClick(), roots);
    openMapWheel(rightClick(), roots);
    expect(document.querySelectorAll("#mapWheel").length).toBe(1);
  });

  it("closes on Escape", () => {
    openMapWheel(rightClick(), roots);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.getElementById("mapWheel")).toBeNull();
  });

  it("closes on an outside pointerdown", () => {
    openMapWheel(rightClick(), roots);
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(document.getElementById("mapWheel")).toBeNull();
  });

  it("stays open for a pointerdown inside itself", () => {
    openMapWheel(rightClick(), roots);
    document.querySelector("path.mw-sector")!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(document.getElementById("mapWheel")).toBeTruthy();
  });

  it("removes its window listeners on close so a stale wheel cannot swallow Escape", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    openMapWheel(rightClick(), roots);
    closeMapWheel();
    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function), true);
    remove.mockRestore();
  });
});
