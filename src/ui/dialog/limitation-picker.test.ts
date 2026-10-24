// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { limitationTip, pickLimitation } from "./limitation-picker";

vi.mock("@/ui/tooltips", () => ({ tip: vi.fn(), loadingTip: { start: vi.fn(), end: vi.fn() } }));

const click = (label: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>(".dialog-buttonset > button"))
    .find(button => button.textContent === label)!
    .click();
const items = [
  { i: 0, name: "Marine" },
  { i: 1, name: "Desert", color: "#fbe79f" },
  { i: 2, name: "Removed", removed: true },
  { i: 3, name: "Taiga" }
];
const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>("#limitationPicker input"));
const pick = (allowed: number[]) => {
  const onApply = vi.fn();
  pickLimitation({ title: "Limit", heading: "Limit by biomes", items, allowed, onApply });
  return onApply;
};

beforeEach(() => {
  document.body.innerHTML = '<div id="dialogs"></div>';
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
    click("Apply");
    expect(onApply).toHaveBeenLastCalledWith([3]);
    expect(document.getElementById("limitationPicker")).toBeNull();

    const again = pick([3]);
    click("Invert");
    click("Invert");
    boxes()[0].checked = true;
    click("Apply");
    expect(again).toHaveBeenLastCalledWith([]);
  });

  it("refuses an empty selection", () => {
    const onApply = pick([]);
    click("Invert");
    click("Apply");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("names the allowed entities", () => {
    expect(limitationTip(undefined, items)).toBe("all");
    expect(limitationTip([3, 1], items)).toBe("Taiga, Desert");
  });
});
