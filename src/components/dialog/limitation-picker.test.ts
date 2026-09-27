// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { limitationTip, pickLimitation } from "./limitation-picker";

vi.mock("@/components/tooltips", () => ({ tip: vi.fn() }));

type Buttons = Record<string, () => void>;
let buttons: Buttons = {};
const items = [
  { i: 0, name: "Marine" },
  { i: 1, name: "Desert", color: "#fbe79f" },
  { i: 2, name: "Removed", removed: true },
  { i: 3, name: "Taiga" }
];
const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>("#alertMessage input"));
const pick = (allowed: number[]) => {
  const onApply = vi.fn();
  pickLimitation({ title: "Limit", heading: "Limit by biomes", items, allowed, onApply });
  return onApply;
};

beforeEach(() => {
  document.body.innerHTML = '<div id="alertMessage"></div>';
  window.$ = vi.fn(() => ({
    dialog: (options: unknown) => {
      if (typeof options === "object") buttons = (options as { buttons: Buttons }).buttons;
    }
  })) as unknown as typeof window.$;
});

describe("pickLimitation", () => {
  it("offers the entities a limitation can name, all checked when nothing is limited", () => {
    pick([]);
    expect(boxes().map(box => [box.dataset.i, box.checked])).toEqual([
      ["1", true],
      ["3", true]
    ]);
  });

  it("applies the checked ids, and an empty list when all are checked", () => {
    const onApply = pick([3]);
    expect(boxes().map(box => box.checked)).toEqual([false, true]);
    buttons.Apply();
    expect(onApply).toHaveBeenLastCalledWith([3]);

    buttons.Invert();
    buttons.Invert();
    boxes()[0].checked = true;
    buttons.Apply();
    expect(onApply).toHaveBeenLastCalledWith([]);
  });

  it("refuses an empty selection", () => {
    const onApply = pick([]);
    buttons.Invert();
    buttons.Apply();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("names the allowed entities", () => {
    expect(limitationTip(undefined, items)).toBe("all");
    expect(limitationTip([3, 1], items)).toBe("Taiga, Desert");
  });
});
