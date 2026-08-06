import { beforeEach, describe, expect, test } from "vitest";
import { AddedLabelsModule } from "./labels-generator";

describe("AddedLabelsModule", () => {
  beforeEach(() => {
    globalThis.pack = {
      labels: [
        { i: 1, text: "North", pathPoints: [], group: "added" },
        { i: 2, text: "South", pathPoints: [], group: "added" }
      ]
    } as unknown as typeof pack;
    globalThis.notes = [
      { id: "addedLabel2", name: "South", legend: "Old legend" },
      { id: "marker1", name: "Marker", legend: "Keep me" }
    ];
  });

  test("removes the dependent note before an added-label id can be reused", () => {
    const labels = new AddedLabelsModule();

    labels.remove(2);
    const replacement = labels.add({ text: "East", pathPoints: [], group: "added" });

    expect(replacement.i).toBe(2);
    expect(notes).toEqual([{ id: "marker1", name: "Marker", legend: "Keep me" }]);
  });
});
