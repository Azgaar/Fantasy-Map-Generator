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
const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>("#limitationPicker .limitationList input"));
const all = () => document.getElementById("limitationAll") as HTMLInputElement;
const toggleAll = (checked: boolean) => {
  all().checked = checked;
  all().dispatchEvent(new Event("change"));
};
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

  it("lists the entities alphabetically", () => {
    pickLimitation({
      title: "Limit",
      heading: "Limit",
      items: [...items, { i: 4, name: "Zz", fullName: "Arctic" }],
      allowed: [],
      onApply: vi.fn()
    });
    expect(boxes().map(box => box.dataset.i)).toEqual(["4", "1", "3"]);
  });

  it("applies the checked ids, and an empty list when all are checked", () => {
    const onApply = pick([3]);
    expect(boxes().map(box => box.checked)).toEqual([false, true]);
    click("Apply");
    expect(onApply).toHaveBeenLastCalledWith([3]);
    expect(document.getElementById("limitationPicker")).toBeNull();

    const again = pick([3]);
    boxes()[0].checked = true;
    click("Apply");
    expect(again).toHaveBeenLastCalledWith([]);
  });

  it("refuses an empty selection", () => {
    const onApply = pick([]);
    toggleAll(false);
    click("Apply");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("checks all or none from the All box, which reflects the list", () => {
    pick([3]);
    expect([all().checked, all().indeterminate]).toEqual([false, true]);
    toggleAll(true);
    expect(boxes().map(box => box.checked)).toEqual([true, true]);
    toggleAll(false);
    expect(boxes().map(box => box.checked)).toEqual([false, false]);
    boxes()[0].checked = true;
    boxes()[0].dispatchEvent(new Event("change"));
    expect([all().checked, all().indeterminate]).toEqual([false, true]);
    boxes()[1].checked = true;
    boxes()[1].dispatchEvent(new Event("change"));
    expect([all().checked, all().indeterminate]).toEqual([true, false]);
  });

  it("in exact mode checks only the allowed and applies any selection, none included", () => {
    const onApply = vi.fn();
    pickLimitation({ title: "Goods", heading: "Goods", items, allowed: [], onApply, exact: true });
    expect(boxes().map(box => box.checked)).toEqual([false, false]);
    click("Apply");
    expect(onApply).toHaveBeenLastCalledWith([]);

    pickLimitation({ title: "Goods", heading: "Goods", items, allowed: [1, 3], onApply, exact: true });
    expect(boxes().map(box => box.checked)).toEqual([true, true]);
    click("Apply");
    expect(onApply).toHaveBeenLastCalledWith([1, 3]);
  });

  it("keeps a long list on screen by capping the dialog height", () => {
    pick([]);
    const content = document.getElementById("limitationPicker")!;
    expect(content.style.maxHeight).toMatch(/px$/);
  });

  it("names the allowed entities", () => {
    expect(limitationTip(undefined, items)).toBe("all");
    expect(limitationTip([3, 1], items)).toBe("Taiga, Desert");
  });
});
