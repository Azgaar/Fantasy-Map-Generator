// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReliefIcon, ReliefIconType } from "@/generators/relief-generator";
import { Styles } from "@/generators/styles";
import { getReliefIcon } from "@/renderers/draw-relief-icons";
import { ReliefEditor } from "./relief-editor";
import "@/generators/pack-generator"; // registers the Pack global the editor finds cells with
import "@/generators/relief-generator"; // installs the Relief global

vi.mock("@/components/icons", () => ({
  Icons: { retry: vi.fn().mockResolvedValue(undefined), href: (id: string) => `#${id}` }
}));

// jsdom lays nothing out: the previews keep their frames
Object.assign(SVGElement.prototype, { getBBox: () => ({ x: 0, y: 0, width: 0, height: 0 }) });
vi.mock("@/components/viewbox-events", () => ({ applyDefaultViewboxEvents: vi.fn() }));
vi.mock("@/components/layers", () => ({ Layers: { show: vi.fn(), draw: vi.fn() } }));
vi.mock("@/renderers/draw-relief-icons", () => ({ redrawRelief: vi.fn(), getReliefIcon: vi.fn() }));
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

async function openBulkMode(button: "reliefBulkAdd" | "reliefBulkRemove"): Promise<ReliefIconType> {
  ReliefEditor.open(document.querySelector("#terrain")!);
  await Promise.resolve();
  document.getElementById(button)!.click();
  const icon = document.querySelector<SVGElement>("#reliefIconsDiv svg[data-type]")!;
  icon.classList.add("pressed");
  (document.getElementById("reliefRadiusNumber") as HTMLInputElement).value = "10";
  (document.getElementById("reliefSpacingNumber") as HTMLInputElement).value = "2";
  return icon.dataset.type as ReliefIconType;
}

beforeEach(() => {
  document.body.innerHTML =
    '<div id="dialogs"></div><div id="tooltip"></div><svg id="map"><g id="viewbox"><g id="terrain"></g></g><g id="debug"></g></svg>';
  globalThis.customization = 0;
  globalThis.styles = Styles.parse(undefined);
  vi.spyOn(Pack, "findCell").mockReturnValue(0);
  globalThis.pack = { cells: { h: new Uint8Array([30]) }, relief: [] } as unknown as typeof pack;
  window.$ = vi.fn(() => ({ dialog: vi.fn() })) as unknown as typeof window.$;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReliefEditor bulk brushes", () => {
  it("type-specific removal preserves explicit references to the same artwork", async () => {
    const type = await openBulkMode("reliefBulkRemove");
    const reference = { icon: Relief.symbolId({ type }, styles.relief.options.set), x: 8, y: 48, s: 4 };
    pack.relief = [{ type, x: 8, y: 48, s: 4 }, reference];

    await swipe(0, 40);

    expect(pack.relief).toEqual([reference]);
    document.querySelector("#reliefIconsDiv svg.pressed")!.classList.remove("pressed");
    document.getElementById("reliefIconsSeletionAny")!.classList.add("pressed");
    await swipe(0, 40);
    expect(pack.relief).toEqual([]);
  });

  it("type-specific delete-all preserves explicit references to the same artwork", async () => {
    const type = await openBulkMode("reliefBulkRemove");
    const reference = { icon: Relief.symbolId({ type }, styles.relief.options.set), x: 8, y: 48, s: 4 };
    pack.relief = [{ type, x: 8, y: 48, s: 4 }, reference];
    globalThis.alertMessage = document.createElement("div");
    let remove: () => void = () => {};
    window.$ = vi.fn(() => ({
      dialog: (settings: { buttons?: { Remove?: () => void } }) => {
        if (settings.buttons?.Remove) remove = settings.buttons.Remove;
      }
    })) as unknown as typeof window.$;

    document.getElementById("reliefRemove")!.click();
    remove();

    expect(pack.relief).toEqual([reference]);
  });

  it("places icons along the whole path of a fast swipe, not only where the pointer events landed", async () => {
    await openBulkMode("reliefBulkAdd");

    await swipe(0, 400);

    const centers = pack.relief.map(icon => icon.x + icon.s / 2);
    expect(centers.length).toBeGreaterThan(20);
    expect(Math.min(...centers)).toBeLessThan(100);
    expect(Math.max(...centers)).toBeGreaterThan(300);
  });

  it("removes icons along the whole path of a fast swipe", async () => {
    const type = await openBulkMode("reliefBulkRemove");
    pack.relief = Array.from({ length: 21 }, (_, i) => ({ type, variant: 1, x: i * 20 - 2, y: 48, s: 4 })); // one every 20px

    await swipe(0, 400);

    expect(pack.relief).toEqual([]);
  });

  it("brushes hit the drawn centre, which the style size scales about, not the stored box", async () => {
    styles.relief.options.size = 4;
    const type = await openBulkMode("reliefBulkRemove");
    pack.relief = Array.from({ length: 21 }, (_, i) => ({ type, variant: 1, x: i * 20 - 5, y: 45, s: 10 })); // centres on y=50

    await swipe(0, 400);

    expect(pack.relief).toEqual([]);
  });

  it("bulk add keeps its spacing from icons drawn at a larger style size", async () => {
    styles.relief.options.size = 4;
    const type = await openBulkMode("reliefBulkAdd");
    // centres every px on y=50, past both ends of the swipe so the brush never samples beside the row
    const row: ReliefIcon[] = Array.from({ length: 441 }, (_, i) => ({ type, x: i - 22, y: 48, s: 4 }));
    pack.relief = [...row];

    await swipe(0, 400);

    const added = pack.relief.filter(icon => !row.includes(icon));
    expect(added.length).toBeGreaterThan(0);
    // the spacing is 2 from the nearest row centre; the row is 1 apart in x and positions are rounded to 0.01
    for (const icon of added) expect(Math.abs(icon.y + icon.s / 2 - 50)).toBeGreaterThan(1.9);
  });
});

describe("ReliefEditor any icon", () => {
  it("restores the full type descriptor when the picker cancels its preview", () => {
    const original: ReliefIcon = { type: "mount", variant: 3, set: "gray", x: 1, y: 2, s: 3 };
    pack.relief = [original];
    vi.mocked(getReliefIcon).mockReturnValue(original);
    let pick: (id: string) => void = () => {};
    globalThis.Controllers = {
      IconPicker: {
        open: vi.fn(({ onPick }) => {
          pick = onPick;
        })
      }
    } as unknown as typeof Controllers;
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.dataset.id = "0";
    ReliefEditor.open(use);
    document.getElementById("reliefPickIcon")!.click();

    pick("custom-a");
    expect(pack.relief).toEqual([{ icon: "custom-a", x: 1, y: 2, s: 3 }]);
    pick("");

    expect(pack.relief[0]).toBe(original);
  });

  it("draws the selected icon with an icon picked from the library, in its place", async () => {
    const icon: ReliefIcon = { type: "mount", x: 1, y: 2, s: 3 };
    pack.relief = [icon];
    vi.mocked(getReliefIcon).mockReturnValue(icon);
    globalThis.Controllers = {
      IconPicker: { open: vi.fn(({ onPick }) => onPick("custom-a")) }
    } as unknown as typeof Controllers;
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.dataset.id = "0";
    ReliefEditor.open(use);

    document.getElementById("reliefPickIcon")!.click();

    expect(Controllers.IconPicker.open).toHaveBeenCalledWith(expect.objectContaining({ current: "" }));
    expect(pack.relief).toEqual([{ icon: "custom-a", x: 1, y: 2, s: 3 }]);
  });
});
