import { beforeEach, describe, expect, test } from "vitest";
import { AddedLabelsModule } from "./added-labels";

describe("AddedLabelsModule", () => {
  beforeEach(() => {
    globalThis.pack = {
      addedLabels: [
        { i: 1, x: 10, y: 10, label: { text: "North", group: "added" }, note: "Northern reaches" },
        { i: 2, x: 20, y: 20, label: { text: "South", group: "added" }, note: "Old legend" }
      ]
    } as unknown as typeof pack;
  });

  test("drops the note with the label, so a reused id cannot inherit it", () => {
    const addedLabels = new AddedLabelsModule();

    addedLabels.remove(2);
    const replacement = addedLabels.add({ x: 30, y: 30, label: { text: "East", group: "added" } });

    expect(replacement.i).toBe(2);
    expect(replacement.note).toBeUndefined();
    expect(pack.addedLabels.map(label => label.note)).toEqual(["Northern reaches", undefined]);
  });
});
