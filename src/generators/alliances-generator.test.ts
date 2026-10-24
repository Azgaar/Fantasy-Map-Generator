import { describe, expect, it } from "vitest";
import {
  cleanupAllianceMembers,
  createAlliance,
  dissolveAlliance,
  normalizeAlliances,
  setAllianceMembers,
  type Alliance,
  type AllianceState
} from "./alliances-generator";

const states: AllianceState[] = [
  { i: 0, name: "Neutrals" },
  { i: 1, name: "Aster" },
  { i: 2, name: "Boreal" },
  { i: 3, name: "Cinder" },
  { i: 4, name: "Removed", removed: true }
];

const makeAlliance = (id: string, members: number[]): Alliance => ({
  id,
  name: id,
  color: "#4778c7",
  type: "political",
  members,
  status: "active",
  foundedYear: null,
  dissolvedYear: null,
  description: ""
});

describe("alliances", () => {
  it("normalizes missing legacy data to no alliances", () => {
    expect(normalizeAlliances(undefined, states)).toEqual([]);
  });

  it("allows a country to belong to multiple alliances", () => {
    const alliances = [makeAlliance("North Pact", [1, 2]), makeAlliance("Trade League", [1, 3])];
    expect(alliances.filter(alliance => alliance.members.includes(1))).toHaveLength(2);
  });

  it("validates creation and requires at least two valid countries", () => {
    const alliances: Alliance[] = [];
    const alliance = createAlliance(alliances, states, {
      name: "North Pact",
      color: "#4778c7",
      type: "defensive",
      members: [1, 2, 4, 1]
    });
    expect(alliance.members).toEqual([1, 2]);
    expect(() => createAlliance(alliances, states, {
      name: "Too small",
      color: "#4778c7",
      type: "political",
      members: [1]
    })).toThrow("at least two");
    expect(() => createAlliance(alliances, states, {
      name: "Bad color",
      color: "blue",
      type: "political",
      members: [1, 2]
    })).toThrow("hex color");
  });

  it("removes invalid country references and makes short alliances dormant", () => {
    const alliances = [makeAlliance("North Pact", [1, 2, 4, 999])];
    cleanupAllianceMembers(alliances, states);
    expect(alliances[0].members).toEqual([1, 2]);
    setAllianceMembers(alliances[0], [2, 4], states);
    expect(alliances[0].members).toEqual([2]);
    expect(alliances[0].status).toBe("dormant");
  });

  it("retains members when an alliance is dissolved", () => {
    const alliance = makeAlliance("North Pact", [1, 2]);
    dissolveAlliance(alliance, 42);
    expect(alliance.status).toBe("dissolved");
    expect(alliance.dissolvedYear).toBe(42);
    expect(alliance.members).toEqual([1, 2]);
  });

  it("drops malformed saved entries without rejecting the whole save", () => {
    const alliances = normalizeAlliances([
      { id: "ok", name: "Valid", color: "#abcdef", members: [1, 2] },
      { id: "bad-color", name: "Bad", color: "red", members: [1, 2] },
      { id: "stale", name: "Stale member", color: "#123456", members: [1, 4, 999] }
    ], states);
    expect(alliances).toHaveLength(2);
    expect(alliances[1].members).toEqual([1]);
    expect(alliances[1].status).toBe("dormant");
  });
});
