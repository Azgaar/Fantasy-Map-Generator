import { beforeEach, describe, expect, it } from "vitest";

// Exercises the party-marker singleton/protection logic in MarkersModule. Uses a minimal pack — enough
// for ensurePartyLocation/deleteMarker/regenerate, without the full cell arrays the placement loop needs.
describe("MarkersModule party location", () => {
  let Markers: any;

  beforeEach(async () => {
    globalThis.TIME = false;
    globalThis.window = globalThis.window || ({} as any);
    globalThis.notes = [];
    globalThis.pack = {
      markers: [],
      burgs: [{ i: 0 }, { i: 1, cell: 5, capital: 1, x: 100, y: 200, name: "Capital" }],
      cells: {
        i: [0, 1, 2, 3, 4, 5],
        burg: [0, 0, 0, 0, 0, 1],
        culture: [0, 0, 0, 0, 0, 0],
        state: [0, 0, 0, 0, 0, 0],
        p: [
          [0, 0],
          [1, 1],
          [2, 2],
          [3, 3],
          [4, 4],
          [5, 5]
        ]
      }
    } as any;
    globalThis.graphWidth = 100;
    globalThis.graphHeight = 100;
    (globalThis as any).findCell = () => 0;

    await import("./markers-generator");
    Markers = (globalThis as any).Markers;
  });

  it("creates one protected party marker at the capital, with a note", () => {
    const party = Markers.ensurePartyLocation();

    expect(pack.markers).toHaveLength(1);
    expect(party.type).toBe("party-location");
    expect(party.protected).toBe(true);
    expect(party.singleton).toBe(true);
    expect(party.cell).toBe(5);
    expect([party.x, party.y]).toEqual([100, 200]); // capital coordinates

    const note = notes.find(n => n.id === `marker${party.i}`);
    expect(note?.name).toBe("The Party");
  });

  it("is idempotent — repeated calls keep exactly one", () => {
    Markers.ensurePartyLocation();
    Markers.ensurePartyLocation();
    expect(pack.markers.filter((m: any) => m.type === "party-location")).toHaveLength(1);
  });

  it("dedupes a hand-edited file with multiple party markers, keeping the first", () => {
    pack.markers = [
      { i: 0, type: "party-location", cell: 5, x: 1, y: 2, icon: "🚩", protected: true },
      { i: 1, type: "party-location", cell: 5, x: 3, y: 4, icon: "🚩", protected: true }
    ] as any;
    globalThis.notes = [
      { id: "marker0", name: "The Party", legend: "" },
      { id: "marker1", name: "Dup", legend: "" }
    ];

    const kept = Markers.ensurePartyLocation();

    expect(pack.markers.filter((m: any) => m.type === "party-location")).toHaveLength(1);
    expect(kept.i).toBe(0);
    expect(notes.find(n => n.id === "marker1")).toBeUndefined();
  });

  it("refuses to delete the protected party marker", () => {
    const party = Markers.ensurePartyLocation();
    Markers.deleteMarker(party.i);
    expect(pack.markers.find((m: any) => m.i === party.i)).toBeTruthy();
  });

  it("preserves the party marker (and its position) across regenerate", () => {
    const party = Markers.ensurePartyLocation();
    party.x = 42;
    party.y = 43;
    pack.markers.push({ i: 99, type: "volcanoes", cell: 2, x: 0, y: 0, icon: "🌋" } as any);

    Markers.generateTypes = () => {}; // stub the heavy placement loop; we only test the keep predicate
    Markers.regenerate();

    const survivors = pack.markers.filter((m: any) => m.type === "party-location");
    expect(survivors).toHaveLength(1);
    expect([survivors[0].x, survivors[0].y]).toEqual([42, 43]);
    expect(pack.markers.find((m: any) => m.i === 99)).toBeUndefined(); // unlocked normal marker re-rolled
  });
});
