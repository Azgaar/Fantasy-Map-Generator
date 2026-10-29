import { describe, expect, it } from "vitest";
import type { EpochPolity, History, HistoryEpoch } from "@/types/history";
import { FIRST_SNAPSHOT_RECORD, HISTORY_RECORD, historyForJson, parseHistory, serializeHistory } from "./epochs-format";

const CELLS = 10;

const polities: EpochPolity[] = [
  { id: 0, name: "Aeloria", form: "Feudal Monarchy", capital: 1, cells: 40, color: "#ff0000", founded: 0 },
  {
    id: 1,
    name: "Branholm",
    form: "Republic",
    capital: 2,
    cells: 25,
    color: "#00ff00",
    founded: 120,
    successorOf: 0
  }
];

const epochs: HistoryEpoch[] = [
  { i: 0, from: 0, to: 500, era: "The Age of Broken Crowns", polities: [polities[0]], snapshot: 0 },
  { i: 1, from: 500, to: 1000, era: "Era", polities: polities, snapshot: 1 }
];

function historyWith(overrides: Partial<History> = {}): History {
  return {
    events: [{ i: 0, year: 120, type: "founding", actors: [{ kind: "polity", id: 1 }], text: "Branholm rose" }],
    realms: [],
    eras: [{ name: "Era", from: 500, to: 1000 }],
    polities,
    epochs,
    snapshots: [Uint16Array.from([0, 1, 1, 0, 0, 0, 0, 0, 0, 0]), Uint16Array.from([1, 1, 2, 2, 0, 0, 0, 0, 0, 1])],
    ...overrides
  };
}

function save(history: History | undefined): { record53: string; records: string[] } {
  const { json, snapshotRecords } = serializeHistory(history, CELLS);
  return { record53: json, records: snapshotRecords };
}

describe("the epochs save format", () => {
  it("reserves the planned records", () => {
    expect(HISTORY_RECORD).toBe(54);
    expect(FIRST_SNAPSHOT_RECORD).toBe(55);
  });

  it("round-trips epochs, polities and snapshots through the map records", () => {
    const history = historyWith();
    const { record53, records } = save(history);

    const mapData = Array.from({ length: HISTORY_RECORD }, () => "").concat([record53], records);
    const loaded = parseHistory(mapData[HISTORY_RECORD], mapData.slice(FIRST_SNAPSHOT_RECORD), CELLS);

    expect(loaded.epochs).toEqual(epochs);
    expect(loaded.polities).toEqual(polities);
    expect(loaded.events).toEqual(history.events);
    expect(loaded.snapshots).toHaveLength(2);
    expect(Array.from(loaded.snapshots![0])).toEqual(Array.from(history.snapshots![0]));
    expect(Array.from(loaded.snapshots![1])).toEqual(Array.from(history.snapshots![1]));
    expect(loaded.snapshots![0]).toBeInstanceOf(Uint16Array);
  });

  it("never puts the snapshots into the JSON record", () => {
    const { record53 } = save(historyWith());
    expect(record53).not.toContain("snapshots");
    expect(JSON.parse(record53).epochs).toEqual(epochs);
  });

  it("saves one comma-joined record per epoch, like cells.state", () => {
    const { records } = save(historyWith());
    expect(records).toEqual(["0,1,1,0,0,0,0,0,0,0", "1,1,2,2,0,0,0,0,0,1"]);
  });

  it("saves an epoch-free chronicle when the map has no epochs", () => {
    const history = historyWith({ epochs: undefined, snapshots: undefined });
    const { record53, records } = save(history);

    expect(records).toEqual([]);
    const parsed = JSON.parse(record53);
    expect(parsed.epochs).toBeUndefined();
    expect(parsed.polities).toEqual(polities);
    expect(parseHistory(record53, records, CELLS)).toEqual(parsed);
  });

  it("drops the epochs at save time when their snapshots are incomplete", () => {
    const history = historyWith({ snapshots: [Uint16Array.from([1, 2, 3])] });
    const { record53, records } = save(history);

    expect(records).toEqual([]); // two epochs, one wrong-length snapshot: the pair is dropped together
    expect(JSON.parse(record53).epochs).toBeUndefined();
    expect(JSON.parse(record53).polities).toEqual(polities);
  });

  it("keeps extra snapshot records harmless and reads only one per epoch", () => {
    const { record53, records } = save(historyWith());
    const loaded = parseHistory(record53, [...records, "9,9,9,9,9,9,9,9,9,9"], CELLS);
    expect(loaded.epochs).toHaveLength(2);
    expect(Array.from(loaded.snapshots![1])).toEqual([1, 1, 2, 2, 0, 0, 0, 0, 0, 1]);
  });
});

describe("the chronicle's figures", () => {
  it("keeps figure traits through a save and a load", () => {
    const figures = [
      {
        i: 0,
        name: "Ausa the Bold",
        culture: 1,
        birth: 940,
        roles: [{ type: "ruler" as const, target: { kind: "polity" as const, id: 1 }, from: 980 }],
        alignment: "lawful" as const,
        virtues: ["just", "loyal"],
        vices: ["harsh"]
      }
    ];
    const { record53 } = save(historyWith({ figures }));

    expect(parseHistory(record53, [], CELLS).figures).toEqual(figures);
  });

  it("loads a chronicle whose figures predate the traits layer", () => {
    const figures = [
      {
        i: 0,
        name: "Old Ruler",
        culture: 1,
        birth: 900,
        roles: [{ type: "general" as const, target: { kind: "polity" as const, id: 1 }, from: 920 }]
      }
    ];
    const { record53 } = save(historyWith({ figures }));

    const loaded = parseHistory(record53, [], CELLS).figures!;
    expect(loaded[0]).not.toHaveProperty("alignment");
    expect(loaded[0].name).toBe("Old Ruler");
  });
});

describe("the epochs load", () => {
  it("loads an old map unchanged", () => {
    const old = { events: [], realms: [], eras: [{ name: "Era", from: 0, to: 1000 }] };
    const record = JSON.stringify(old);

    expect(parseHistory(record, [], CELLS)).toEqual(old);
    expect(parseHistory(record, undefined, CELLS)).toEqual(old);
    expect(parseHistory(undefined, [], CELLS)).toEqual({ events: [], realms: [], eras: [] });
  });

  it("repairs a file whose epochs lost their snapshot records, keeping the chronicle", () => {
    const history = historyWith();
    const { record53 } = save(history);
    const repairs: string[] = [];

    const loaded = parseHistory(record53, [], CELLS, reason => repairs.push(reason));

    expect(loaded.epochs).toBeUndefined(); // the slider is disabled
    expect(loaded.snapshots).toBeUndefined();
    expect(loaded.polities).toEqual(polities); // the chronicle's refs still resolve
    expect(loaded.events).toEqual(history.events);
    expect(repairs).toHaveLength(1);
  });

  it.each([
    ["a truncated record set", ["0,1,1,0,0,0,0,0,0,0"]],
    ["a wrong-length snapshot", ["0,1,1,0,0,0,0,0,0,0", "1,1,2"]],
    ["an empty record", ["0,1,1,0,0,0,0,0,0,0", ""]],
    ["a garbled record", ["0,1,1,0,0,0,0,0,0,0", "1,x,2,2,0,0,0,0,0,1"]]
  ])("repairs %s", (_name, records) => {
    const { record53 } = save(historyWith());
    let repaired = false;

    const loaded = parseHistory(record53, records, CELLS, () => {
      repaired = true;
    });

    expect(loaded.epochs).toBeUndefined();
    expect(loaded.snapshots).toBeUndefined();
    expect(repaired).toBe(true);
  });
});

describe("historyForJson", () => {
  it("exports the snapshots as plain arrays", () => {
    const exported = historyForJson(historyWith());
    expect(exported!.snapshots).toEqual([
      [0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 2, 2, 0, 0, 0, 0, 0, 1]
    ]);
    expect(JSON.stringify(exported)).not.toContain('"0":'); // no numbered-key typed arrays
  });

  it("leaves a history without snapshots untouched", () => {
    const history = historyWith({ epochs: undefined, snapshots: undefined });
    const exported = historyForJson(history);
    expect(exported).toEqual(history);
    expect(exported).not.toHaveProperty("snapshots");
    expect(historyForJson(undefined)).toBeUndefined();
  });
});
