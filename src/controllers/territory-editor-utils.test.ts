import { describe, expect, it } from "vitest";
import { ManualAssignmentHistory } from "./territory-editor-utils";

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
