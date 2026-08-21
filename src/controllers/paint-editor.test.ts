// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaintEditorOptions } from "./paint-editor";
import { PaintEditor } from "./paint-editor";

vi.mock("@/components/viewbox-events", () => ({ applyDefaultViewboxEvents: vi.fn() }));
vi.mock("@/components/dialog/dialog-helpers", async importOriginal => ({
  ...(await importOriginal<typeof import("@/components/dialog/dialog-helpers")>()),
  closeDialogs: vi.fn()
}));

let dialogOptions: unknown[];

const getOptions = (overrides: Partial<PaintEditorOptions> = {}): PaintEditorOptions => ({
  title: "Paint states",
  items: [
    { id: 1, name: "North", color: "#ff0000" },
    { id: 2, name: "South", color: "#0000ff" },
    { id: 0, name: "Neutral", color: "#ffffff" }
  ],
  getValue: vi.fn(() => 0),
  apply: vi.fn(),
  ...overrides
});

async function dragBrush(): Promise<void> {
  const viewbox = document.getElementById("viewbox")!;
  const eventView = document.defaultView!;
  const MouseEvent = eventView.MouseEvent;
  const mouseEvent = (type: string, init: MouseEventInit) => {
    const event = new MouseEvent(type, init);
    Object.defineProperty(event, "view", { value: eventView });
    return event;
  };
  viewbox.dispatchEvent(mouseEvent("mousedown", { bubbles: true, button: 0, clientX: 1, clientY: 1 }));
  eventView.dispatchEvent(mouseEvent("mousemove", { bubbles: true, buttons: 1, clientX: 2, clientY: 2 }));
  eventView.dispatchEvent(mouseEvent("mouseup", { bubbles: true, button: 0, clientX: 2, clientY: 2 }));
  await new Promise(resolve => setTimeout(resolve, 0));
}

beforeEach(() => {
  document.body.innerHTML =
    '<div id="dialogs"></div><div id="tooltip"></div><svg><g id="viewbox"></g><g id="debug"></g></svg>';
  dialogOptions = [];
  globalThis.customization = 0;
  globalThis.findCell = vi.fn(() => 3);
  globalThis.pack = {
    cells: {
      h: new Uint8Array(4).fill(30),
      v: [[], [], [], [0, 1, 2]],
      p: [
        [100, 100],
        [100, 101],
        [101, 100],
        [2, 2]
      ]
    },
    vertices: {
      p: [
        [0, 0],
        [1, 0],
        [0, 1]
      ]
    }
  } as unknown as typeof pack;
  window.$ = vi.fn((element: HTMLElement) => ({
    dialog: vi.fn((options: unknown) => {
      if (typeof options === "object") element.classList.add("ui-dialog-content");
      dialogOptions.push(options);
    })
  })) as unknown as typeof window.$;
});

describe("PaintEditor", () => {
  it("owns customization and clears it when cancelled", () => {
    PaintEditor.open(getOptions());
    expect(globalThis.customization).toBe(2);

    document.getElementById("paintEditorCancel")?.click();

    expect(globalThis.customization).toBe(0);
    expect(document.getElementById("paintEditor")).toBeNull();
    expect(document.getElementById("paintEditorOverlay")).toBeNull();
  });

  it("owns selection independently of the calling editor", () => {
    PaintEditor.open(getOptions());
    const itemSelect = document.getElementById("paintEditorSelect") as HTMLSelectElement;

    expect(itemSelect.value).toBe("1");
    itemSelect.value = "2";
    itemSelect.dispatchEvent(new Event("change"));

    expect(itemSelect.value).toBe("2");
  });

  it("shows the hovered item from the value getter", () => {
    PaintEditor.open(getOptions({ getValue: () => 2 }));
    document
      .getElementById("viewbox")
      ?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 2, clientY: 2 }));

    expect(document.getElementById("tooltip")?.textContent).toBe("South");
  });

  it("owns working changes and commits them through one apply callback", async () => {
    const apply = vi.fn();
    PaintEditor.open(getOptions({ apply }));

    await dragBrush();
    document.getElementById("paintEditorApply")?.click();

    const changes = apply.mock.calls[0][0] as ReadonlyMap<number, number>;
    expect([...changes]).toEqual([[3, 1]]);
    expect(globalThis.customization).toBe(0);
  });

  it("owns stroke history", async () => {
    const apply = vi.fn();
    PaintEditor.open(getOptions({ apply }));
    await dragBrush();

    const undo = document.getElementById("paintEditorUndo") as HTMLButtonElement;
    expect(undo.disabled).toBe(false);
    undo.click();
    expect(undo.disabled).toBe(true);
    document.getElementById("paintEditorApply")?.click();

    expect([...(apply.mock.calls[0][0] as ReadonlyMap<number, number>)]).toEqual([]);
  });

  it("supports overlapping values without delegating state management", async () => {
    const apply = vi.fn();
    PaintEditor.open({
      title: "Paint zones",
      mode: "multiple",
      items: [
        { id: 1, name: "Danger", color: "#ff0000" },
        { id: 2, name: "Magic", color: "#0000ff" }
      ],
      getValue: () => [1],
      apply
    });
    const itemSelect = document.getElementById("paintEditorSelect") as HTMLSelectElement;
    itemSelect.value = "2";
    itemSelect.dispatchEvent(new Event("change"));

    await dragBrush();
    document.getElementById("paintEditorApply")?.click();

    const changes = apply.mock.calls[0][0] as ReadonlyMap<number, readonly number[]>;
    expect([...changes]).toEqual([[3, [1, 2]]]);
  });

  it("enforces the universal zero-only protection toggle", async () => {
    const apply = vi.fn();
    PaintEditor.open(getOptions({ dontOverrideControl: true, getValue: () => 1, apply }));
    const itemSelect = document.getElementById("paintEditorSelect") as HTMLSelectElement;
    itemSelect.value = "2";
    itemSelect.dispatchEvent(new Event("change"));
    const protect = document.getElementById("paintEditorDontOverride") as HTMLInputElement;
    expect(protect.parentElement?.textContent).toContain("Do not override existing");
    protect.checked = true;

    await dragBrush();
    document.getElementById("paintEditorApply")?.click();

    expect([...(apply.mock.calls[0][0] as ReadonlyMap<number, number>)]).toEqual([]);
  });

  it("previews and applies removal from an overlapping value", async () => {
    const apply = vi.fn();
    PaintEditor.open({
      title: "Paint zones",
      mode: "multiple",
      items: [{ id: 1, name: "Danger", color: "#ff0000" }],
      landOnlyControl: true,
      getValue: () => [1],
      apply
    });
    const erase = document.getElementById("paintEditorErase") as HTMLButtonElement;
    const landOnly = document.getElementById("paintEditorLandOnly") as HTMLInputElement;
    expect(landOnly.checked).toBe(true);
    erase.click();

    await dragBrush();
    expect(document.querySelector("#paintEditorOverlay polygon")?.getAttribute("fill")).toBe("#ffffff");
    document.getElementById("paintEditorApply")?.click();

    const changes = apply.mock.calls[0][0] as ReadonlyMap<number, readonly number[]>;
    expect([...changes]).toEqual([[3, []]]);
  });

  it("uses a stable compact dialog width", () => {
    PaintEditor.open(getOptions());
    expect((document.getElementById("paintEditorBrush") as HTMLInputElement).getAttribute("value")).toBe("12");
    expect(dialogOptions).toContainEqual(expect.objectContaining({ width: 300 }));
  });
});
