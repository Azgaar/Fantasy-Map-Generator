import { describe, expect, it } from "vitest";
import { WorldSceneRevisionTracker } from "./world-scene";

describe("WorldSceneRevisionTracker", () => {
  it("keeps camera and visibility changes out of scene revisions", () => {
    const revisions = new WorldSceneRevisionTracker();
    const before = revisions.getLayerRevision("states");
    revisions.apply([{ kind: "camera" }, { kind: "visibility", layer: "states" }]);

    expect(revisions.getLayerRevision("states")).toBe(before);
    expect(revisions.getSnapshot()).toEqual({ layerRevisions: {}, topology: 0, world: 0 });
  });

  it("tracks world, topology, and individual layer changes independently", () => {
    const revisions = new WorldSceneRevisionTracker();
    revisions.apply([{ kind: "world" }]);
    const stateRevision = revisions.getLayerRevision("states");
    revisions.apply([
      { cellIds: [4], kind: "assignment", layer: "states" },
      { kind: "style", layer: "borders" }
    ]);

    expect(revisions.getLayerRevision("states")).not.toBe(stateRevision);
    expect(revisions.getSnapshot()).toEqual({
      layerRevisions: { borders: 1, states: 1 },
      topology: 1,
      world: 1
    });

    const topologyRevision = revisions.getTopologyRevision();
    revisions.apply([{ kind: "topology" }]);
    expect(revisions.getTopologyRevision()).not.toBe(topologyRevision);
  });

  it("resets all tokens for renderer disposal", () => {
    const revisions = new WorldSceneRevisionTracker();
    revisions.apply([{ kind: "world" }, { domainId: 3, kind: "entity", layer: "relief" }]);
    revisions.reset();
    expect(revisions.getSnapshot()).toEqual({ layerRevisions: {}, topology: 0, world: 0 });
  });
});
