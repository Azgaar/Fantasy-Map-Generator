import { describe, expect, it } from "vitest";
import { BulkSelection } from "./bulk-selection";

describe("BulkSelection", () => {
  it("toggles ids on and off", () => {
    const selection = new BulkSelection();
    selection.toggle(1);
    expect(selection.isSelected(1)).toBe(true);
    expect(selection.count).toBe(1);
    selection.toggle(1);
    expect(selection.isSelected(1)).toBe(false);
    expect(selection.count).toBe(0);
  });

  it("adds and removes ids", () => {
    const selection = new BulkSelection();
    selection.add(3);
    selection.add(3); // idempotent
    expect(selection.count).toBe(1);
    selection.remove(3);
    expect(selection.isSelected(3)).toBe(false);
    expect(selection.count).toBe(0);
  });

  it("select-all selects exactly the supplied (filtered) id set", () => {
    const selection = new BulkSelection();
    selection.add(99); // pre-existing selection outside the filtered set
    selection.selectAll([1, 2, 3]);
    expect(selection.getSelected().sort((a, b) => a - b)).toEqual([1, 2, 3, 99]);
  });

  it("clear empties the selection", () => {
    const selection = new BulkSelection();
    selection.selectAll([1, 2, 3]);
    selection.clear();
    expect(selection.count).toBe(0);
    expect(selection.getSelected()).toEqual([]);
  });

  it("getSelected and count reflect current state", () => {
    const selection = new BulkSelection();
    expect(selection.count).toBe(0);
    selection.add(5);
    selection.add(7);
    expect(selection.count).toBe(2);
    expect(selection.getSelected().sort((a, b) => a - b)).toEqual([5, 7]);
  });

  it("rejects ids that are not selectable", () => {
    const selection = new BulkSelection(id => id !== 0); // neutral state 0 excluded
    selection.add(0);
    expect(selection.isSelected(0)).toBe(false);
    selection.toggle(0);
    expect(selection.isSelected(0)).toBe(false);
    selection.selectAll([0, 1, 2]);
    expect(selection.getSelected().sort((a, b) => a - b)).toEqual([1, 2]);
    expect(selection.count).toBe(2);
  });
});
