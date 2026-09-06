// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReliefEditor } from "./relief-editor";
import "@/generators/pack-generator"; // registers the Pack global the editor finds cells with

vi.mock("@/components/viewbox-events", () => ({ applyDefaultViewboxEvents: vi.fn() }));
vi.mock("@/components/layers", () => ({ Layers: { show: vi.fn(), draw: vi.fn() } }));
vi.mock("@/renderers/draw-relief-icons", () => ({ redrawRelief: vi.fn(), getSceneReliefIcon: vi.fn() }));
vi.mock("@/components/dialog/dialog-helpers", async importOriginal => ({
  ...(await importOriginal<typeof import("@/components/dialog/dialog-helpers")>()),
  closeDialogs: vi.fn()
}));

/** One fast swipe along y=50: mousedown at x0, a single mousemove to x1, mouseup */
async function swipe(x0: number, x1: number): Promise<void> {
  const viewbox = document.getElementById("viewbox")!;
  const eventView = document.defaultView!;
  const mouseEvent = (type: string, init: MouseEventInit) => {
    const event = new eventView.MouseEvent(type, init);
    Object.defineProperty(event, "view", { value: eventView });
    return event;
  };
  viewbox.dispatchEvent(mouseEvent("mousedown", { bubbles: true, button: 0, clientX: x0, clientY: 50 }));
  eventView.dispatchEvent(mouseEvent("mousemove", { bubbles: true, buttons: 1, clientX: x1, clientY: 50 }));
  eventView.dispatchEvent(mouseEvent("mouseup", { bubbles: true, button: 0, clientX: x1, clientY: 50 }));
  await new Promise(resolve => setTimeout(resolve, 0));
}

function openBulkMode(button: "reliefBulkAdd" | "reliefBulkRemove"): string {
  ReliefEditor.open(document.querySelector("#terrain")!);
  document.getElementById(button)!.click();
  const icon = document.querySelector<SVGElement>("#reliefIconsDiv svg[data-type]")!;
  icon.classList.add("pressed");
  (document.getElementById("reliefRadiusNumber") as HTMLInputElement).value = "10";
  (document.getElementById("reliefSpacingNumber") as HTMLInputElement).value = "2";
  return icon.dataset.type!;
}

beforeEach(() => {
  document.body.innerHTML =
    '<div id="dialogs"></div><div id="tooltip"></div><svg id="map"><g id="viewbox"><g id="terrain"></g></g><g id="debug"></g></svg>';
  globalThis.customization = 0;
  vi.spyOn(Pack, "findCell").mockReturnValue(0);
  globalThis.pack = { cells: { h: new Uint8Array([30]) }, relief: [] } as unknown as typeof pack;
  window.$ = vi.fn(() => ({ dialog: vi.fn() })) as unknown as typeof window.$;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReliefEditor bulk brushes", () => {
  it("places icons along the whole path of a fast swipe, not only where the pointer events landed", async () => {
    openBulkMode("reliefBulkAdd");

    await swipe(0, 400);

    const centers = pack.relief.map(icon => icon.x + icon.s / 2);
    expect(centers.length).toBeGreaterThan(20);
    expect(Math.min(...centers)).toBeLessThan(100);
    expect(Math.max(...centers)).toBeGreaterThan(300);
  });

  it("removes icons along the whole path of a fast swipe", async () => {
    const icon = openBulkMode("reliefBulkRemove");
    pack.relief = Array.from({ length: 21 }, (_, i) => ({ icon, x: i * 20 - 2, y: 48, s: 4 })); // one every 20px

    await swipe(0, 400);

    expect(pack.relief).toEqual([]);
  });
});
