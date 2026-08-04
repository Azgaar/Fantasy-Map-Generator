import { describe, expect, it } from "vitest";
import { getLabelAnchor, LabelScene } from "./label-scene";
import type { LabelData } from "./types";

describe("LabelScene", () => {
  it("interpolates path anchors at startOffset and includes label offsets", () => {
    expect(getLabelAnchor(pathLabel("stateLabel1", "states", 75, 3, -2))).toEqual([13, 3]);
  });

  it("updates one type without rebuilding unrelated labels", () => {
    const scene = new LabelScene();
    const burg: LabelData = { id: "burgLabel2", type: "burg", group: "town", text: "Old", x: 1, y: 1 };
    const state = pathLabel("stateLabel1", "state");
    scene.replaceAll([state, burg]);
    const stateRevision = scene.get(state.id)!.revision;

    scene.updateType("burg", [{ ...burg, text: "New" }], [2]);
    expect(scene.get(state.id)!.revision).toBe(stateRevision);
    expect(scene.get(burg.id)!.data.text).toBe("New");
  });

  it("keeps deterministic order across targeted updates", () => {
    const scene = new LabelScene();
    const first = pathLabel("stateLabel1", "mixed");
    const second: LabelData = { id: "burgLabel2", type: "burg", group: "mixed", text: "B", x: 1, y: 1 };
    scene.replaceAll([first, second]);
    scene.updateType("state", [{ ...first, text: "Updated" }], [1]);
    expect(scene.getGroup("mixed").map(label => label.data.id)).toEqual(["stateLabel1", "burgLabel2"]);
  });

  it("tracks forced labels independently of scene membership", () => {
    const scene = new LabelScene();
    scene.replaceAll([pathLabel("stateLabel1", "state")]);
    scene.force("stateLabel1");
    expect(scene.isForced("stateLabel1")).toBe(true);
    scene.release("stateLabel1");
    expect(scene.isForced("stateLabel1")).toBe(false);
  });
});

function pathLabel(id: string, group: string, startOffset = 50, dx = 0, dy = 0): LabelData {
  return {
    id,
    type: "state",
    group,
    text: "A",
    pathPoints: [
      [0, 0],
      [10, 0],
      [10, 10]
    ],
    startOffset,
    dx,
    dy
  };
}
