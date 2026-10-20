import { beforeEach, describe, expect, it } from "vitest";
import { emptyHistory } from "@/types/history";
import { Chronicle } from "./history-generator";

beforeEach(() => {
  globalThis.pack = {} as unknown as typeof pack;
});

describe("Chronicle", () => {
  it("generates an empty chronicle for a fresh world", () => {
    Chronicle.generate();
    expect(pack.history).toEqual({ events: [], realms: [], eras: [] });
  });

  it("replaces a stale chronicle on regeneration", () => {
    Chronicle.generate();
    pack.history.events.push({ i: 0, year: 100, type: "war", actors: [], text: "stale" });
    Chronicle.generate();
    expect(pack.history.events).toEqual([]);
  });

  it("gives older saves an empty chronicle on sync", () => {
    const history = Chronicle.sync();
    expect(history).toEqual(emptyHistory());
    expect(pack.history).toBe(history);
  });

  it("keeps an existing chronicle on sync", () => {
    pack.history = {
      events: [{ i: 0, year: 5, type: "founding", actors: [], text: "founded" }],
      realms: [],
      eras: []
    };
    const history = Chronicle.sync();
    expect(history.events).toHaveLength(1);
  });
});
