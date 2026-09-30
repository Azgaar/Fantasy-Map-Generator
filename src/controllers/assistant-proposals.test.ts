// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/layers", () => ({ Layers: { draw: vi.fn() } }));
vi.mock("@/components/dialog/dialog-helpers", () => ({ refreshEditors: vi.fn() }));
vi.mock("@/controllers", () => ({ Controllers: { NotesEditor: { refresh: vi.fn() } } }));

import { Layers } from "@/components/layers";
import type { Proposal } from "@/services/assistant/chats";
import { Proposals } from "./assistant-proposals";

const { propose, discard } = Proposals;
const apply = (proposal: Proposal, mapId: number) => Proposals.run("apply", proposal, mapId);
const undo = (proposal: Proposal, mapId: number) => Proposals.run("undo", proposal, mapId);
const canApply = (proposal: Proposal, mapId: number) => Proposals.can("apply", proposal, mapId);
const MAP = 42;
const rename = (id: number, name: string) => ({ op: "Burgs.rename", args: [id, name] });
const proposeOk = (operations: unknown) => propose("Rename", operations, 1, MAP) as Proposal;

beforeAll(async () => {
  await import("@/generators/burgs-generator");
  await import("@/generators/states-generator");
  await import("@/generators/zones-generator");
  await import("@/generators/markers-generator");
});

beforeEach(() => {
  vi.mocked(Layers.draw).mockClear();
  document.body.innerHTML = "";
  globalThis.pack = {
    burgs: [0, { i: 1, name: "Vel", label: { text: "Vel" }, note: "<p>Old</p>" }, { i: 2, name: "Orn" }],
    states: [
      { i: 0, name: "Neutrals" },
      { i: 1, name: "Old", formName: "Kingdom", fullName: "United Realms of Old" }
    ]
  } as unknown as typeof pack;
});

it("previews a batch with its side effects and leaves the map untouched", () => {
  const map = JSON.stringify(pack);
  const proposal = proposeOk([rename(1, "Saltmere"), rename(2, "Gull")]);
  expect(JSON.stringify(pack)).toBe(map);
  expect(proposal.state).toBe("proposed");
  expect(proposal.change).toEqual([
    { key: "burg:1", entity: "Burg: Vel", field: "name", before: "Vel", after: "Saltmere" },
    { key: "burg:1", entity: "Burg: Vel", field: "label.text", before: "Vel", after: "Saltmere" },
    { key: "burg:2", entity: "Burg: Orn", field: "name", before: "Orn", after: "Gull" }
  ]);
});

it("records a state's rebuilt full name", () => {
  const proposal = proposeOk([{ op: "States.rename", args: [1, "New"] }]);
  expect(proposal.change.map(row => [row.field, row.after])).toEqual([
    ["name", "New"],
    ["fullName", "United Realms of New"]
  ]);
});

it("applies and undoes property edits, including a field that was absent", () => {
  pack.zones = [{ i: 1, name: "War", type: "Invasion", color: "#000000", cells: [] }] as unknown as typeof pack.zones;
  const proposal = proposeOk([
    { op: "States.recolor", args: [1, "#ff0000"] },
    { op: "Zones.setHidden", args: [1, true] }
  ]);
  expect(proposal.change.map(row => [row.key, row.field, row.before, row.after])).toEqual([
    ["state:1", "color", undefined, "#ff0000"],
    ["zone:1", "hidden", undefined, true]
  ]);
  expect(apply(proposal, MAP)).toBe(true);
  expect(pack.states[1].color).toBe("#ff0000");
  expect(pack.zones[0].hidden).toBe(true);
  expect(Layers.draw).toHaveBeenCalledWith("states", "military", "zones");
  expect(undo(proposal, MAP)).toBe(true);
  expect(pack.states[1].color).toBeUndefined();
  expect("hidden" in pack.zones[0]).toBe(false);
});

it("fails the whole batch and changes nothing when one operation fails", () => {
  const map = JSON.stringify(pack);
  expect(propose("Rename", [rename(1, "Saltmere"), rename(9, "X")], 1, MAP)).toBe("Burg 9 does not exist");
  expect(JSON.stringify(pack)).toBe(map);
});

it("refuses args that are not a list", () => {
  expect(propose("Rename", [{ op: "Burgs.rename", args: { id: 1, name: "X" } }], 1, MAP)).toBe(
    "The args of Burgs.rename must be a list, in the order of its parameters"
  );
});

it("previews, applies and undoes lore edits", () => {
  const lore = { name: "Old Map", description: "", calendar: { year: 1000, era: "Winter Era", eraShort: "WE" } };
  vi.stubGlobal("options", { map: { lore } });
  vi.stubGlobal("Options", { save: vi.fn() });
  const proposal = proposeOk([
    { op: "Lore.rename", args: ["Saltmarsh"] },
    { op: "Lore.setYear", args: [1204] }
  ]);
  expect(proposal.change).toEqual([
    { key: "lore", entity: "Map lore", field: "name", before: "Old Map", after: "Saltmarsh" },
    { key: "lore", entity: "Map lore", field: "calendar.year", before: 1000, after: 1204 }
  ]);
  expect(lore.name).toBe("Old Map");
  expect(apply(proposal, MAP)).toBe(true);
  expect(lore).toMatchObject({ name: "Saltmarsh", calendar: { year: 1204 } });
  expect(Options.save).toHaveBeenCalled();
  expect(undo(proposal, MAP)).toBe(true);
  expect(lore).toMatchObject({ name: "Old Map", calendar: { year: 1000 } });
  vi.unstubAllGlobals();
});

it("lists the registered operations for an unknown one", () => {
  const result = propose("Paint", [{ op: "Burgs.paint", args: [] }], 1, MAP);
  expect(result).toContain('Unknown operation "Burgs.paint"');
  expect(result).toContain("Burgs.rename, ");
  expect(result).toContain("Zones.setHidden");
});

it("refuses a batch that changes nothing", () => {
  expect(propose("Rename", [rename(1, "Vel")], 1, MAP)).toBe("These operations change nothing");
});

it("previews a note rewrite and rejects unsafe HTML", () => {
  const proposal = proposeOk([{ op: "Notes.write", args: ["burg:1", "<p>New</p>"] }]);
  expect(proposal.change).toEqual([
    { key: "burg:1", entity: "Burg: Vel", field: "note", before: "<p>Old</p>", after: "<p>New</p>" }
  ]);
  expect(pack.burgs[1].note).toBe("<p>Old</p>");
  expect(propose("Note", [{ op: "Notes.write", args: ["burg:1", "<script></script>"] }], 1, MAP)).toContain(
    "notes subset"
  );
});

it.each([
  ["journey", "journeys", { i: 0, name: "Quest", segments: [] }],
  ["market", "markets", { i: 3, name: "Fair" }],
  ["good", "goods", { i: 5, name: "Salt" }]
] as const)("records a note on a %s and leaves the map untouched", (type, collection, entity) => {
  (pack as unknown as Record<string, unknown[]>)[collection] = [{ ...entity }];
  const key = `${type}:${entity.i}`;
  const proposal = proposeOk([{ op: "Notes.write", args: [key, "<p>Lore</p>"] }]);
  const item = () => (pack as unknown as Record<string, { note?: string }[]>)[collection][0];
  expect(item().note).toBeUndefined();
  expect(proposal.change.map(row => [row.key, row.field, row.after])).toEqual([[key, "note", "<p>Lore</p>"]]);
  expect(apply(proposal, MAP)).toBe(true);
  expect(item().note).toBe("<p>Lore</p>");
  expect(undo(proposal, MAP)).toBe(true);
  expect(item().note).toBeUndefined();
});

it("applies the batch, redraws its layers and undoes it", () => {
  const proposal = proposeOk([rename(2, "Gull")]);
  expect(apply(proposal, MAP)).toBe(true);
  expect(pack.burgs[2]).toEqual({ i: 2, name: "Gull" });
  expect(Layers.draw).toHaveBeenCalledWith("labels");
  expect(proposal.state).toBe("applied");
  expect(undo(proposal, MAP)).toBe(true);
  expect(pack.burgs[2]).toEqual({ i: 2, name: "Orn" });
  expect(proposal.state).toBe("undone");
  expect(apply(proposal, MAP)).toBe(false);
});

it("refuses Apply after a manual edit and on another map", () => {
  const proposal = proposeOk([rename(1, "Saltmere")]);
  expect(canApply(proposal, MAP + 1)).toBe(false);
  pack.burgs[1].name = "Manual";
  expect(apply(proposal, MAP)).toBe(false);
  expect(pack.burgs[1].name).toBe("Manual");
});

it("refuses Undo after an overlapping proposal was applied", () => {
  const first = proposeOk([rename(1, "Saltmere")]);
  apply(first, MAP);
  const second = proposeOk([rename(1, "Gullhaven")]);
  apply(second, MAP);
  expect(undo(first, MAP)).toBe(false);
  expect(pack.burgs[1].name).toBe("Gullhaven");
});

it("redoes an undone proposal while the map still holds what it undid", () => {
  const proposal = proposeOk([rename(1, "Saltmere")]);
  expect(Proposals.can("redo", proposal, MAP)).toBe(false);
  apply(proposal, MAP);
  undo(proposal, MAP);
  expect(Proposals.run("redo", proposal, MAP)).toBe(true);
  expect(proposal.state).toBe("applied");
  expect(pack.burgs[1]).toMatchObject({ name: "Saltmere" });
  undo(proposal, MAP);
  pack.burgs[1].name = "Manual";
  expect(Proposals.run("redo", proposal, MAP)).toBe(false);
  expect(proposal.state).toBe("undone");
});

it("makes Discard final", () => {
  const proposal = proposeOk([rename(1, "Saltmere")]);
  discard(proposal);
  expect(proposal.state).toBe("discarded");
  expect(apply(proposal, MAP)).toBe(false);
  expect(pack.burgs[1].name).toBe("Vel");
});

describe("entities and cells", () => {
  beforeEach(() => {
    pack.cells = {
      i: Uint32Array.from([0, 1, 2, 3]),
      state: Uint16Array.from([0, 1, 1, 1])
    } as unknown as typeof pack.cells;
    pack.zones = [{ i: 0, name: "War", type: "Invasion", color: "#000000", cells: [1] }] as typeof pack.zones;
    pack.markers = [
      { i: 0, name: "Pit", type: "caves", icon: "🦇", x: 0, y: 0, cell: 0 },
      { i: 1, name: "Peak", type: "volcanoes", icon: "🌋", x: 0, y: 0, cell: 1 }
    ] as typeof pack.markers;
  });

  it("records a removed entity as one row and restores it in place on Undo", () => {
    const proposal = proposeOk([{ op: "Markers.remove", args: [0] }]);
    expect(pack.markers.map(({ i }) => i)).toEqual([0, 1]);
    expect(proposal.change).toEqual([
      expect.objectContaining({ key: "marker:0", entity: "Marker: Pit", field: "", after: undefined })
    ]);
    expect(apply(proposal, MAP)).toBe(true);
    expect(pack.markers.map(({ i }) => i)).toEqual([1]);
    expect(undo(proposal, MAP)).toBe(true);
    expect(pack.markers.map(({ i }) => i)).toEqual([0, 1]);
    expect(pack.markers[0].name).toBe("Pit");
  });

  it("records an added entity and removes it again on Undo", () => {
    const proposal = proposeOk([{ op: "Zones.add", args: ["Plague", "Disease", [2, 3]] }]);
    expect(pack.zones).toHaveLength(1);
    expect(proposal.change).toEqual([
      expect.objectContaining({ key: "zone:1", entity: "Zone: Plague", field: "", before: undefined })
    ]);
    apply(proposal, MAP);
    expect(pack.zones[1]).toMatchObject({ i: 1, name: "Plague", cells: [2, 3] });
    undo(proposal, MAP);
    expect(pack.zones).toHaveLength(1);
  });

  it("passes what an earlier operation returned to a later one", () => {
    const proposal = proposeOk([
      { op: "Zones.add", args: ["Plague", "Disease", [2]] },
      { op: "Zones.rename", args: [{ result: 0 }, "Red Death"] },
      { op: "Zones.setCells", args: [{ result: 0 }, [2, 3]] }
    ]);
    expect(proposal.change).toEqual([
      expect.objectContaining({ key: "zone:1", field: "", after: expect.objectContaining({ name: "Red Death" }) })
    ]);
    expect(proposal.change[0].after).toMatchObject({ cells: [2, 3] });
    expect(pack.zones).toHaveLength(1);
  });

  it("passes the key of what an earlier operation returned", () => {
    const proposal = proposeOk([
      { op: "Zones.add", args: ["Plague", "Disease", [2]] },
      { op: "Notes.write", args: [{ result: 0, type: "zone" }, "<p>Spreads by river</p>"] }
    ]);
    expect(proposal.change[0].after).toMatchObject({ i: 1, note: "<p>Spreads by river</p>" });
  });

  it("records rural population as a per-cell row", () => {
    vi.stubGlobal("options", { map: { units: { population: { scale: 1000, urbanization: { rate: 1 } } } } });
    Object.assign(pack.cells, { h: Uint8Array.from([10, 30, 30, 30]), pop: Float32Array.from([0, 2, 1, 1]) });
    pack.zones[0].cells = [0, 1, 2];
    const proposal = proposeOk([{ op: "Zones.setPopulation", args: [0, 6000, 0] }]);
    expect(proposal.change).toEqual([
      expect.objectContaining({ key: "cells", field: "pop", before: { 1: 2, 2: 1 }, after: { 1: 4, 2: 2 } })
    ]);
    expect(apply(proposal, MAP)).toBe(true);
    expect([...pack.cells.pop]).toEqual([0, 4, 2, 1]);
    expect(Layers.draw).toHaveBeenCalledWith("population");
    vi.unstubAllGlobals();
  });

  it("refuses a reference to a later operation or to one that returns nothing", () => {
    const map = JSON.stringify(pack);
    expect(propose("Zone", [{ op: "Zones.rename", args: [{ result: 0 }, "X"] }], 1, MAP)).toContain(
      "must name an earlier operation"
    );
    const nothing = [
      { op: "Zones.rename", args: [0, "Pox"] },
      { op: "Zones.rename", args: [{ result: 0 }, "X"] }
    ];
    expect(propose("Zone", nothing, 1, MAP)).toBe("Operation 0 returns nothing to refer to");
    expect(JSON.stringify(pack)).toBe(map);
  });

  it("records per-cell changes as one row per field", () => {
    const proposal = proposeOk([{ op: "Zones.setCells", args: [0, [1, 2]] }]);
    expect(proposal.change.map(row => row.field)).toEqual(["cells"]);

    const state = { key: "cells", entity: "Cells", field: "state", before: { 2: 1, 3: 1 }, after: { 2: 2, 3: 2 } };
    const manual: Proposal = {
      number: 2,
      mapId: MAP,
      summary: "Cells",
      operations: [],
      change: [state],
      state: "proposed"
    };
    expect(apply(manual, MAP)).toBe(true);
    expect([...pack.cells.state]).toEqual([0, 1, 2, 2]);
    pack.cells.state[3] = 1;
    expect(Proposals.can("undo", manual, MAP)).toBe(false);
    pack.cells.state[3] = 2;
    expect(undo(manual, MAP)).toBe(true);
    expect([...pack.cells.state]).toEqual([0, 1, 1, 1]);
  });

  it("undoes an added indexed entity only while nothing was added after it", () => {
    const added: Proposal = {
      number: 3,
      mapId: MAP,
      summary: "Add",
      operations: [],
      change: [{ key: "burg:3", entity: "Burg New", field: "", before: undefined, after: { i: 3, name: "New" } }],
      state: "proposed"
    };
    expect(apply(added, MAP)).toBe(true);
    pack.burgs.push({ i: 4, name: "Later" } as (typeof pack.burgs)[number]);
    expect(Proposals.can("undo", added, MAP)).toBe(false);
    pack.burgs.pop();
    expect(undo(added, MAP)).toBe(true);
    expect(pack.burgs).toHaveLength(3);
  });
});
