// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";

const notesEditor = vi.hoisted(() => ({
  open: null as { id: string; name: string; legend: string } | null,
  selection: null as string | null
}));
vi.mock("@/controllers", () => ({
  Controllers: {
    NotesEditor: {
      current: async () => notesEditor.open,
      getSelectionHtml: async () => notesEditor.selection
    }
  }
}));
const propose = vi.hoisted(() => vi.fn());
vi.mock("./proposals", () => ({ Proposals: { propose } }));
vi.mock("@/services/io/emblem-image", () => ({ emblemPng: async () => "data:image/png;base64,QUJD" }));

import type { Chat, Proposal } from "@/services/assistant/chats";
import { AssistantMap } from "./map";

const mapOptions = {
  map: {
    seed: "1",
    lore: { name: "Orwin" },
    graph: { width: 100, height: 50 },
    units: {
      distance: { scale: 3, unit: "mi" },
      area: { unit: "square" },
      height: { unit: "ft" },
      temperature: { unit: "°C" }
    }
  }
};
const newChat = (): Chat => ({
  id: "1",
  title: "",
  updated: 0,
  tier: "key",
  mapId: 42,
  mapName: "Orwin",
  items: [],
  messages: [],
  usage: { input: 0, output: 0, cached: 0 }
});
const proposal = (number: number, state: Proposal["state"]): Proposal => ({
  number,
  mapId: 42,
  summary: `Change ${number}`,
  operations: [],
  change: [{ key: "burg:1", entity: "Burg Vel", field: "name", before: "Vel", after: "Saltmere" }],
  state
});
let chat: Chat;
const mapTool = (name: string) => AssistantMap.tools(chat).find(item => item.definition.name === name)!;

beforeEach(() => {
  chat = newChat();
  notesEditor.open = { id: "burg:1", name: "Old", legend: "<p>Old</p>" };
  notesEditor.selection = null;
  propose.mockReset();
  vi.stubGlobal("mapHistory", [{ created: 42 }]);
  vi.stubGlobal("options", mapOptions);
  vi.stubGlobal("pack", { cells: { i: [0] }, states: [], burgs: [0, { i: 1, name: "Vel" }, { i: 2, removed: true }] });
});

it("offers read_map, propose_change, one tool per widget and view_emblem", () => {
  expect(AssistantMap.tools(chat).map(tool => tool.definition.name)).toEqual([
    "read_map",
    "propose_change",
    "show_entities",
    "show_card",
    "show_chart",
    "show_choices",
    "show_inset",
    "show_source",
    "view_emblem"
  ]);
});

it("cites a wiki page by its title in any case or spacing, and lists the pages for an unknown one", async () => {
  const source = await mapTool("show_source").handle({ page: "river editor" });
  expect(source.item).toEqual({ kind: "widget", widget: { type: "source", page: "River-Editor" } });
  const unknown = await mapTool("show_source").handle({ page: "Nowhere" });
  expect(unknown.isError).toBe(true);
  expect(unknown.content).toContain("Knowledge Base");
});

it("shows an entities widget holding the keys", async () => {
  const outcome = await mapTool("show_entities").handle({ title: " Ports of [Vel](burg:1) ", entities: ["burg:1"] });
  expect(outcome.isError).toBeFalsy();
  expect(outcome.item).toEqual({
    kind: "widget",
    widget: { type: "entities", title: "Ports of Vel", entities: ["burg:1"] }
  });
});

it("names the first key that is not a live entity, and shows nothing", async () => {
  for (const key of ["burg:2", "burg:9", "town:1"]) {
    const outcome = await mapTool("show_entities").handle({ title: "Ports", entities: ["burg:1", key] });
    expect(outcome.isError).toBe(true);
    expect(outcome.content).toContain(key);
    expect(outcome.item).toBeUndefined();
  }
});

it("names vassals with their suzerains in per-question context", async () => {
  vi.stubGlobal("pack", {
    cells: { i: [0] },
    burgs: [0],
    states: [
      { i: 0, name: "Neutrals" },
      { i: 1, name: "Shan", diplomacy: ["x", "x", "Suzerain"] },
      { i: 2, name: "Kami", diplomacy: ["x", "Vassal", "x"] }
    ]
  });
  expect(await AssistantMap.context(chat)).toContain("- vassals: Kami (state:2) of Shan (state:1)");
});

it("includes the open note and selection in per-question context", async () => {
  notesEditor.selection = "Old text";
  const context = await AssistantMap.context(chat);
  expect(context).toContain("name: Orwin");
  expect(context).toContain("1 map unit = 3 mi; 1 map unit² = 9 mi²");
  expect(context).toContain("<p>Old</p>");
  expect(context).toContain("Old text");
  expect(context).toContain("propose `Notes.write` with the key `burg:1`");
});

it("clips a long note while preserving its entity key", async () => {
  notesEditor.open = { id: "burg:2", name: "Gondesthe", legend: "a".repeat(6010) };
  const context = await AssistantMap.context(chat);
  expect(context).toContain("10 more characters");
  expect(context).toContain("entity key: burg:2");
});

it("returns a numbered proposal that waits for the user", async () => {
  chat.items.push({ kind: "proposal", proposal: proposal(1, "applied") });
  propose.mockReturnValue(proposal(2, "proposed"));
  const operations = [{ op: "Burgs.rename", args: [1, "Saltmere"] }];
  const result = await mapTool("propose_change").handle({ summary: " Rename ", operations });
  expect(propose).toHaveBeenCalledWith("Rename", operations, 2, 42);
  expect(result.content).toContain("Proposal #2 (1 change) is waiting for the user");
  expect(result.item).toEqual({ kind: "proposal", proposal: proposal(2, "proposed") });
});

it("numbers proposals of one step apart and shows the model their change", async () => {
  propose.mockImplementation((_summary, _operations, number) => proposal(number, "proposed"));
  const tool = mapTool("propose_change");
  const first = await tool.handle({ summary: "A", operations: [] });
  await tool.handle({ summary: "B", operations: [] });
  expect(propose.mock.calls.map(call => call[2])).toEqual([1, 2]);
  expect(first.content).toContain("Burg Vel · Name: Vel → Saltmere");
});

it("refuses a population leaping 100-fold, as from points given for people, until it is sent again", async () => {
  const units = { ...mapOptions.map.units, population: { scale: 1, urbanization: { rate: 1 } } };
  vi.stubGlobal("options", { map: { ...mapOptions.map, units } });
  const leap = { key: "burg:1", entity: "Burg Vel", field: "population", before: 51.325, after: 0.154 };
  propose.mockReturnValue({ ...proposal(1, "proposed"), change: [leap] });
  const tool = mapTool("propose_change");
  const refused = await tool.handle({ summary: "Triple", operations: [] });
  expect(refused).toMatchObject({ isError: true });
  expect(refused.content).toContain("Nothing proposed: these populations change 100-fold");
  expect((await tool.handle({ summary: "Triple", operations: [] })).item?.kind).toBe("proposal");
  propose.mockReturnValue({ ...proposal(1, "proposed"), change: [{ ...leap, after: 153.975 }] });
  expect((await tool.handle({ summary: "Triple", operations: [] })).isError).toBeUndefined();
});

it("returns a proposal error to the model without a card", async () => {
  propose.mockReturnValue("Unknown operation");
  expect(await mapTool("propose_change").handle({ summary: "X", operations: [] })).toEqual({
    content: "Unknown operation",
    isError: true
  });
});

it("tells the model what happened to the chat's proposals", async () => {
  chat.items.push(
    { kind: "proposal", proposal: proposal(1, "applied") },
    { kind: "proposal", proposal: proposal(2, "discarded") },
    { kind: "proposal", proposal: proposal(3, "undone") },
    { kind: "proposal", proposal: proposal(4, "proposed") }
  );
  const context = await AssistantMap.context(chat);
  expect(context).toContain("- #1 applied: Change 1");
  expect(context).toContain("- #2 discarded: Change 2");
  expect(context).toContain("- #3 applied, then undone: Change 3");
  expect(context).toContain("- #4 waiting for the user: Change 4");
});

it("leaves the current question's proposals to their tool results", async () => {
  chat.items.push(
    { kind: "question", text: "Rename Vel" },
    { kind: "proposal", proposal: proposal(1, "applied") },
    { kind: "question", text: "Rename Orwin" },
    { kind: "proposal", proposal: proposal(2, "proposed") }
  );
  const context = await AssistantMap.context(chat);
  expect(context).toContain("- #1 applied: Change 1");
  expect(context).not.toContain("#2");
});

it("gives read_map scripts the app's unit helpers", async () => {
  const result = await mapTool("read_map").handle({
    code: "return units.si(units.getArea(152000)) + ' ' + units.getAreaUnit()"
  });
  expect(result.content).toContain("1.4M mi²");
});

it("ends a read_map result with the keys of the entities it names, in order of mention", async () => {
  vi.stubGlobal("pack", {
    cells: { i: [0] },
    states: [
      { i: 0, name: "Neutrals" },
      { i: 1, name: "Shan" },
      { i: 2, name: "Kami" }
    ],
    burgs: [
      0,
      { i: 1, name: "Shan" },
      { i: 2, name: "Velport" },
      { i: 3, name: "Vel" },
      { i: 4, name: "Gone", removed: true }
    ]
  });
  const result = await mapTool("read_map").handle({ code: "return 'Kami holds Velport; Shan; Gone; Shanty'" });
  expect(result.content).toBe(
    `"Kami holds Velport; Shan; Gone; Shanty"\n\n# Keys of the names above\nKami: state:2\nVelport: burg:2\nShan: state:1, burg:1`
  );
});

it("adds no keys to a result that names no entity", async () => {
  const result = await mapTool("read_map").handle({ code: "return 42" });
  expect(result.content).toBe("42\n");
});

it("shows a card for a state only", async () => {
  pack.states = [
    { i: 0, name: "Neutrals" },
    { i: 1, name: "Orwin" }
  ] as typeof pack.states;
  const card = await mapTool("show_card").handle({ entity: "state:1" });
  expect(card.item).toEqual({ kind: "widget", widget: { type: "card", entity: "state:1" } });
  expect((await mapTool("show_card").handle({ entity: "burg:1" })).content).toBe("Cards show states for now");
});

it("shows a chart only with labelled non-negative values and live entity keys", async () => {
  const chart = await mapTool("show_chart").handle({
    chart: "bar",
    title: "Size",
    unit: "people",
    rows: [{ label: "Vel", value: 5, entity: "burg:1" }]
  });
  expect(chart.item).toEqual({
    kind: "widget",
    widget: {
      type: "chart",
      chart: "bar",
      title: "Size",
      unit: "people",
      rows: [{ label: "Vel", value: 5, entity: "burg:1" }]
    }
  });
  for (const rows of [
    [],
    [{ label: "Vel", value: -1 }],
    [{ label: "", value: 1 }],
    [{ label: "Orn", value: 1, entity: "burg:2" }]
  ])
    expect((await mapTool("show_chart").handle({ chart: "pie", rows })).isError).toBe(true);
  expect((await mapTool("show_chart").handle({ chart: "line", rows: [{ label: "a", value: 1 }] })).isError).toBe(true);
  expect(
    (await mapTool("show_chart").handle({ chart: "pie", title: "Empty", rows: [{ label: "a", value: 0 }] })).content
  ).toBe("A pie needs amounts that add up to more than 0");
});

it("validates each choice's operations by a dry run and names the failing choice", async () => {
  const operations = [{ op: "Burgs.rename", args: [1, "Saltmere"] }];
  propose.mockReturnValueOnce({ operations }).mockReturnValueOnce("Name cannot be empty");
  const failed = await mapTool("show_choices").handle({
    title: "Rename",
    choices: [
      { label: "Saltmere", operations },
      { label: "Blank", operations: [{ op: "Burgs.rename", args: [1, ""] }] }
    ]
  });
  expect(failed).toMatchObject({ isError: true, content: "Choice 2: Name cannot be empty" });

  propose.mockReturnValueOnce({ operations });
  const shown = await mapTool("show_choices").handle({
    title: "Rename",
    choices: [
      { label: "Saltmere", operations },
      { label: "Ask more", operations: [] }
    ]
  });
  expect(shown.item).toEqual({
    kind: "widget",
    widget: { type: "choices", title: "Rename", choices: [{ label: "Saltmere", operations }, { label: "Ask more" }] }
  });
  expect(shown.content).toContain("waiting for the user");
  expect((await mapTool("show_choices").handle({ choices: [{ label: "Only" }] })).isError).toBe(true);
});

it("shows an inset of a located entity or of a box within the map", async () => {
  const entity = await mapTool("show_inset").handle({ entity: "burg:1" });
  expect(entity.isError).toBe(true); // Vel has no position in this fixture
  pack.burgs[1] = { ...pack.burgs[1], x: 5, y: 5 } as (typeof pack.burgs)[number];
  expect((await mapTool("show_inset").handle({ entity: "burg:1" })).item).toEqual({
    kind: "widget",
    widget: { type: "inset", title: "Vel", entity: "burg:1" }
  });
  expect((await mapTool("show_inset").handle({ title: "North", box: [0, 0, 50, 20] })).item).toEqual({
    kind: "widget",
    widget: { type: "inset", title: "North", box: [0, 0, 50, 20] }
  });
  for (const box of [
    [0, 0, 50],
    [10, 0, 5, 20],
    [200, 0, 300, 20],
    [0, 0, 100, 50]
  ])
    expect((await mapTool("show_inset").handle({ box })).isError).toBe(true);
});

it("returns an emblem as an image for the model and shows it to the user", async () => {
  pack.states = [
    { i: 0, name: "Neutrals" },
    { i: 1, name: "Orwin", coa: { t1: "gules" } },
    { i: 2, name: "Bare" }
  ] as typeof pack.states;
  const outcome = await mapTool("view_emblem").handle({ entity: "state:1" });
  expect(outcome.content).toEqual([
    { type: "text", text: "The emblem of Orwin" },
    { type: "image", source: { type: "base64", media_type: "image/png", data: "QUJD" } }
  ]);
  expect(outcome.item).toEqual({ kind: "widget", widget: { type: "emblem", entity: "state:1" } });
  expect((await mapTool("view_emblem").handle({ entity: "state:2" })).content).toBe("state:2 has no emblem");
  expect((await mapTool("view_emblem").handle({ entity: "river:1" })).isError).toBe(true);
});
