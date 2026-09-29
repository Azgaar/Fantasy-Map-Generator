// @vitest-environment jsdom
import { beforeAll, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/components/layers", () => ({ Layers: { draw: vi.fn() } }));
vi.mock("@/components/dialog/dialog-helpers", () => ({ refreshEditors: vi.fn() }));
vi.mock("@/controllers", () => ({ Controllers: { NotesEditor: { refresh: vi.fn() } } }));

import { Layers } from "@/components/layers";
import type { Proposal } from "@/services/assistant/chats";
import { Proposals } from "./assistant-proposals";

const { propose, apply, undo, discard, canApply } = Proposals;
const MAP = 42;
const rename = (id: number, name: string) => ({ op: "Burgs.rename", args: [id, name] });
const proposeOk = (operations: unknown) => propose("Rename", operations, 1, MAP) as Proposal;

beforeAll(async () => {
  await import("@/generators/burgs-generator");
  await import("@/generators/states-generator");
  await import("@/generators/zones-generator");
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
    { key: "burg:1", entity: "Burg Vel", field: "name", before: "Vel", after: "Saltmere" },
    { key: "burg:1", entity: "Burg Vel", field: "label.text", before: "Vel", after: "Saltmere" },
    { key: "burg:2", entity: "Burg Orn", field: "name", before: "Orn", after: "Gull" }
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
    { key: "burg:1", entity: "Burg Vel", field: "note", before: "<p>Old</p>", after: "<p>New</p>" }
  ]);
  expect(pack.burgs[1].note).toBe("<p>Old</p>");
  expect(propose("Note", [{ op: "Notes.write", args: ["burg:1", "<script></script>"] }], 1, MAP)).toContain(
    "notes subset"
  );
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

it("makes Discard final", () => {
  const proposal = proposeOk([rename(1, "Saltmere")]);
  discard(proposal);
  expect(proposal.state).toBe("discarded");
  expect(apply(proposal, MAP)).toBe(false);
  expect(pack.burgs[1].name).toBe("Vel");
});
