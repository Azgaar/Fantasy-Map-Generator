import { describe, expect, it } from "vitest";
import type { LogEntry, LogEvent } from "./battle";
import { Keyframes } from "./keyframes";

const entry = (tick: number, event: LogEvent): LogEntry => ({ tick, event });

describe("selectKeyframes", () => {
  it("takes the start, the moment after each event of the kinds, and the end", () => {
    const log = [entry(0, "tactic"), entry(20, "clash"), entry(40, "rally"), entry(60, "rout"), entry(90, "end")];
    expect(Keyframes.select(log, ["clash", "rout"])).toEqual([0, 21, 61, 90]);
  });

  it("merges events of one round into a keyframe", () => {
    const log = [entry(0, "tactic"), entry(13, "rout"), entry(15, "rout"), entry(30, "end")];
    expect(Keyframes.select(log, ["rout"])).toEqual([0, 16, 30]);
  });

  it("takes the first clash, routs and a side broken when no kinds are chosen", () => {
    const log = [entry(0, "tactic"), entry(20, "clash"), entry(40, "breach"), entry(60, "broken"), entry(90, "end")];
    expect(Keyframes.select(log, [])).toEqual([0, 21, 61, 90]);
  });

  it("keeps the moments with the most losses within the cap, the start and the end always", () => {
    const routs = Array.from({ length: 30 }, (_, i) => entry(6 + i * 6, "rout"));
    const heavy = [entry(61, "destroyed"), entry(62, "destroyed"), entry(121, "surrender")];
    const log = [entry(0, "tactic"), ...routs, ...heavy, entry(400, "end")];
    const frames = Keyframes.select(log, ["rout"], 5);
    expect(frames).toHaveLength(5);
    expect(frames[0]).toBe(0);
    expect(frames.at(-1)).toBe(400);
    expect(frames).toContain(61);
    expect(frames).toContain(121);
  });
});
