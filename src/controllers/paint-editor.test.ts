// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaintEditorOptions } from "./paint-editor";
import { PaintEditor } from "./paint-editor";
import "@/generators/pack-generator"; // registers the Pack global the editor finds cells with

vi.mock("@/components/viewbox-events", () => ({ applyDefaultViewboxEvents: vi.fn() }));
vi.mock("@/components/dialog/dialog-helpers", async importOriginal => ({
  ...(await importOriginal<typeof import("@/components/dialog/dialog-helpers")>()),
  closeDialogs: vi.fn()
}));

const getOptions = (overrides: Partial<PaintEditorOptions> = {}): PaintEditorOptions => ({
  title: "Paint states",
  parentDialogId: "parentDialog",
  onClose: vi.fn(),
  items: [
    { id: 2, name: "South", color: "#0000ff" },
    { id: 3, name: "West", color: "#ffffff" },
    { id: 1, name: "North", color: "#ff0000" }
  ],
  getValue: vi.fn(() => 0),
  onApply: vi.fn(),
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
    '<div id="dialogs"><div id="parentDialog" class="dialog"></div></div><div id="tooltip"></div><svg><g id="viewbox"></g><g id="debug"></g></svg>';
  globalThis.customization = 0;
  vi.spyOn(Pack, "findCell").mockReturnValue(3);
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
  const dialogOptions = new WeakMap<HTMLElement, Record<string, unknown>>();
  window.$ = vi.fn((target: string | HTMLElement) => {
    const element = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
    const dialog = vi.fn((command: unknown, key?: string, value?: unknown) => {
      if (!element) return;
      const options = dialogOptions.get(element) ?? {};
      if (typeof command === "object") {
        dialogOptions.set(element, { ...options, ...command });
        element.classList.add("ui-dialog-content");
      } else if (command === "option" && value === undefined) return options[key!];
      else if (command === "option") dialogOptions.set(element, { ...options, [key!]: value });
      else if (command === "close") {
        element.style.display = "none";
        if (typeof options.close === "function") options.close();
      } else if (command === "open") element.style.removeProperty("display");
    });
    return { dialog };
  }) as unknown as typeof window.$;
  const parentDialog = document.getElementById("parentDialog")!;
  $(parentDialog).dialog({ close: () => parentDialog.remove() });
});

describe("PaintEditor", () => {
  it("reopens its destroyed parent through the close callback", () => {
    const onClose = vi.fn(() => {
      document
        .getElementById("dialogs")!
        .insertAdjacentHTML("beforeend", '<div id="parentDialog" class="dialog"></div>');
    });
    PaintEditor.open(getOptions({ onClose }));

    expect(document.getElementById("parentDialog")).toBeNull();
    document.getElementById("paintEditorCancel")?.click();

    expect(onClose).toHaveBeenCalledOnce();
    expect(document.getElementById("parentDialog")).not.toBeNull();
  });

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
    const fillBox = document.getElementById("paintEditorFill") as HTMLElement & { fill: string };

    expect(itemSelect.value).toBe("1");
    expect(fillBox.fill).toBe("#ff0000");
    itemSelect.value = "2";
    itemSelect.dispatchEvent(new Event("change"));

    expect(itemSelect.value).toBe("2");
    expect(fillBox.fill).toBe("#0000ff");
  });

  it("sorts items alphabetically while keeping a leading special item pinned", () => {
    PaintEditor.open(
      getOptions({
        items: [
          { id: 0, name: "Neutral", color: "#ffffff" },
          { id: 2, name: "South", color: "#0000ff" },
          { id: 1, name: "North", color: "#ff0000" }
        ]
      })
    );

    const options = [...document.querySelectorAll<HTMLOptionElement>("#paintEditorSelect option")];
    expect(options.map(option => option.textContent)).toEqual(["Neutral", "North", "South"]);
  });

  it("shows the hovered item from the value getter", () => {
    PaintEditor.open(getOptions({ getValue: () => 2 }));
    document
      .getElementById("viewbox")
      ?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 2, clientY: 2 }));

    expect(document.getElementById("tooltip")?.textContent).toBe("South");
  });

  it("owns working changes and commits them through one apply callback", async () => {
    const calls: string[] = [];
    const onApply = vi.fn((_changes: ReadonlyMap<number, number>) => {
      calls.push("apply");
    });
    const onClose = vi.fn(() => calls.push("close"));
    PaintEditor.open(getOptions({ onApply, onClose }));

    await dragBrush();
    document.getElementById("paintEditorApply")?.click();

    const changes = onApply.mock.calls[0][0] as ReadonlyMap<number, number>;
    expect([...changes]).toEqual([[3, 1]]);
    expect(calls).toEqual(["apply", "close"]);
    expect(globalThis.customization).toBe(0);
  });

  it("owns stroke history", async () => {
    const onApply = vi.fn();
    PaintEditor.open(getOptions({ onApply }));
    await dragBrush();

    const undo = document.getElementById("paintEditorUndo") as HTMLButtonElement;
    expect(undo.disabled).toBe(false);
    undo.click();
    expect(undo.disabled).toBe(true);
    document.getElementById("paintEditorApply")?.click();

    expect([...(onApply.mock.calls[0][0] as ReadonlyMap<number, number>)]).toEqual([]);
  });

  it("supports overlapping values without delegating state management", async () => {
    const onApply = vi.fn();
    PaintEditor.open({
      title: "Paint zones",
      parentDialogId: "parentDialog",
      onClose: vi.fn(),
      mode: "multiple",
      items: [
        { id: 1, name: "Danger", color: "#ff0000" },
        { id: 2, name: "Magic", color: "#0000ff" }
      ],
      getValue: () => [1],
      onApply
    });
    const itemSelect = document.getElementById("paintEditorSelect") as HTMLSelectElement;
    itemSelect.value = "2";
    itemSelect.dispatchEvent(new Event("change"));

    await dragBrush();
    document.getElementById("paintEditorApply")?.click();

    const changes = onApply.mock.calls[0][0] as ReadonlyMap<number, readonly number[]>;
    expect([...changes]).toEqual([[3, [1, 2]]]);
  });

  it("enforces the universal zero-only protection toggle", async () => {
    const onApply = vi.fn();
    PaintEditor.open(getOptions({ dontOverrideControl: true, getValue: () => 1, onApply }));
    const itemSelect = document.getElementById("paintEditorSelect") as HTMLSelectElement;
    itemSelect.value = "2";
    itemSelect.dispatchEvent(new Event("change"));
    const protect = document.getElementById("paintEditorDontOverride") as HTMLInputElement;
    expect(protect.parentElement?.textContent).toContain("Do not override existing");
    protect.checked = true;

    await dragBrush();
    document.getElementById("paintEditorApply")?.click();

    expect([...(onApply.mock.calls[0][0] as ReadonlyMap<number, number>)]).toEqual([]);
  });

  it("uses the -1 item to remove all overlapping values", async () => {
    const onApply = vi.fn();
    PaintEditor.open({
      title: "Paint zones",
      parentDialogId: "parentDialog",
      onClose: vi.fn(),
      mode: "multiple",
      items: [
        { id: -1, name: "No zone", color: "#ffffff" },
        { id: 1, name: "Danger", color: "#ff0000" },
        { id: 2, name: "Magic", color: "#0000ff" }
      ],
      dontOverrideControl: true,
      landOnlyControl: true,
      getValue: () => [1, 2],
      onApply
    });
    const itemSelect = document.getElementById("paintEditorSelect") as HTMLSelectElement;
    const protect = document.getElementById("paintEditorDontOverride") as HTMLInputElement;
    const landOnly = document.getElementById("paintEditorLandOnly") as HTMLInputElement;
    expect(landOnly.checked).toBe(true);
    expect(itemSelect.value).toBe("-1");
    expect(document.getElementById("paintEditorErase")).toBeNull();
    protect.checked = true;

    await dragBrush();
    expect(document.querySelector("#paintEditorOverlay polygon")?.getAttribute("fill")).toBe("#ffffff");
    document.getElementById("paintEditorApply")?.click();

    const changes = onApply.mock.calls[0][0] as ReadonlyMap<number, readonly number[]>;
    expect([...changes]).toEqual([[3, []]]);
  });

  it("uses the default brush radius", () => {
    PaintEditor.open(getOptions());
    expect((document.getElementById("paintEditorBrush") as HTMLInputElement).getAttribute("value")).toBe("12");
  });
});
