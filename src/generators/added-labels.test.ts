import { beforeEach, describe, expect, test } from "vitest";
import { AddedLabelsModule } from "./added-labels";

describe("AddedLabelsModule", () => {
  beforeEach(() => {
    globalThis.pack = {
      addedLabels: [
        { i: 1, x: 10, y: 10, label: { text: "North", group: "added" } },
        { i: 2, x: 20, y: 20, label: { text: "South", group: "added" } }
      ]
    } as unknown as typeof pack;
    globalThis.notes = [
      { id: "addedLabel2", name: "South", legend: "Old legend" },
      { id: "marker1", name: "Marker", legend: "Keep me" }
    ];
  });

  test("removes the dependent note before an added-label id can be reused", () => {
    const addedLabels = new AddedLabelsModule();

    addedLabels.remove(2);
    const replacement = addedLabels.add({ x: 30, y: 30, label: { text: "East", group: "added" } });

    expect(replacement.i).toBe(2);
    expect(notes).toEqual([{ id: "marker1", name: "Marker", legend: "Keep me" }]);
  });
});
