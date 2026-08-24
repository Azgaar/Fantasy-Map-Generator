import { describe, expect, it } from "vitest";
import { ManualAssignmentHistory, TerritoryAssignmentSession, ZoneAssignmentSession } from "./territory-editor-utils";

describe("ManualAssignmentHistory", () => {
  it("keeps only the most recent snapshots", () => {
    const history = new ManualAssignmentHistory(2);
    history.push("first");
    history.push("second");
    history.push("third");

    expect(history.pop()).toBe("third");
    expect(history.pop()).toBe("second");
    expect(history.hasSnapshots).toBe(false);
  });
});

describe("TerritoryAssignmentSession", () => {
  it("previews, undoes, commits, and cancels domain assignments", () => {
    const target = new Uint16Array([1, 1, 2]);
    const session = new TerritoryAssignmentSession("states", target);
    session.beginStroke();
    expect(session.paint([0, 2], 3)).toMatchObject({ affectedCellIds: [0, 2], changed: true });
    expect(Array.from(target)).toEqual([3, 1, 3]);
    expect(session.undo()).toBe(true);
    expect(Array.from(target)).toEqual([1, 1, 2]);
    session.paint([1], 4);
    expect(session.commit()).toMatchObject({ affectedCellIds: [1], affectedDomainIds: [1, 4], changed: true });
    expect(Array.from(target)).toEqual([1, 4, 2]);

    const canceled = new TerritoryAssignmentSession("states", target);
    canceled.paint([0], 5);
    canceled.cancel();
    expect(Array.from(target)).toEqual([1, 4, 2]);
  });
});

describe("ZoneAssignmentSession", () => {
  it("previews, commits, and cancels overlapping memberships", () => {
    const zones = [
      { cells: [1, 2], color: "#fff", i: 3, name: "A", type: "test" },
      { cells: [2, 4], color: "#000", i: 4, name: "B", type: "test" }
    ];
    const session = new ZoneAssignmentSession(zones, [3, 4]);
    session.paint(3, [5], false);
    session.paint(4, [2], true);
    expect(zones.map(zone => zone.cells)).toEqual([[1, 2, 5], [4]]);
    expect(session.getZoneIdsAtCell(2)).toEqual([3]);
    expect(session.commit()).toMatchObject({ affectedCellIds: [5, 2], changed: true });

    const canceled = new ZoneAssignmentSession(zones, [3, 4]);
    canceled.paint(3, [1], true);
    canceled.cancel();
    expect(zones[0].cells).toEqual([1, 2, 5]);
  });
});
