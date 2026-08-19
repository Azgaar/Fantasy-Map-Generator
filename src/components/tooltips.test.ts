import { describe, expect, test } from "vitest";
import { showElementLockTip } from "./tooltips";

describe("tooltip compatibility bridge", () => {
  test("exposes the lock tooltip handler used by inline UI markup", () => {
    expect((window as unknown as Record<string, unknown>).showElementLockTip).toBe(showElementLockTip);
  });
});
