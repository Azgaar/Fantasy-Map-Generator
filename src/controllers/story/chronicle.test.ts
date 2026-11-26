// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const controllers = vi.hoisted(() => ({
  BattleScreen: { watch: vi.fn(), showRecord: vi.fn() },
  NotesEditor: { open: vi.fn(), refresh: vi.fn() }
}));
// the record editor is the real one, loaded as the registry loads it
vi.mock("@/controllers", () => ({
  Controllers: {
    ...controllers,
    ChronicleRecordEditor: {
      open: async (id: number, rename?: boolean) =>
        (await import("./chronicle-record-editor")).ChronicleRecordEditor.open(id, rename),
      refresh: async () => (await import("./chronicle-record-editor")).ChronicleRecordEditor.refresh()
    }
  }
}));
vi.mock("@/renderers/emblems/renderer", () => ({ EmblemRenderer: { trigger: vi.fn() } }));
vi.mock("@/ui/tooltips", () => ({ tip: vi.fn(), clearMainTip: vi.fn(), loadingTip: { start: vi.fn(), end: vi.fn() } }));
// the map: a placement waits until the test clicks it
const placement = vi.hoisted(() => ({ click: null as ((event: MouseEvent) => void) | null, stop: () => {} }));
vi.mock("@/ui/map/map-placement", () => ({
  toggleMapPlacement: (
    _id: string,
    onClick: (event: MouseEvent) => void,
    _tip: string,
    _type: unknown,
    onStop: () => void
  ) => {
    placement.stop();
    placement.click = onClick;
    placement.stop = () => {
      placement.click = null;
      placement.stop = () => {};
      onStop();
    };
    return true;
  },
  stopMapPlacement: () => placement.stop()
}));
vi.mock("d3", async original => ({ ...(await original<object>()), pointer: () => [10, 20] }));

import { Pack } from "@/model/graph/pack-generator";
import { Events, type MapEvent } from "@/model/story/events";
import { Dialog } from "@/ui/dialog/dialog";
import { dialogButton } from "@/ui/dialog/dialog-testing";
import { dialogState } from "@/ui/dialog/state";
import { tip } from "@/ui/tooltips";
import { Chronicle } from "./chronicle";

const rows = () => Array.from(document.querySelectorAll<HTMLElement>("#chronicleBody .states"));
const row = (id: number) => document.querySelector<HTMLElement>(`#chronicleBody .states[data-id="${id}"]`)!;
const cell = (id: number, column: string) => row(id).querySelector<HTMLElement>(`[data-col="${column}"]`)!;
const control = <T extends HTMLElement = HTMLInputElement>(name: string) =>
  document.querySelector<T>(`#chronicleRecordEditor [data-control="${name}"]`)!;
const labels = () =>
  Array.from(document.querySelectorAll("#chronicleRecordBody .label"))
    .map(label => label.textContent)
    .join(" ");

function set(element: HTMLInputElement | HTMLSelectElement, value: string, type = "change"): void {
  element.value = value;
  element.dispatchEvent(new Event(type, { bubbles: true }));
}

/** Open the record of an event from its row */
async function edit(id: number): Promise<void> {
  cell(id, "edit").click();
  await vi.waitFor(() => expect(document.getElementById("chronicleRecordEditor")?.dataset.entity).toBe(`event:${id}`));
}

describe("Chronicle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    placement.stop();
    for (const key of ["filters", "sorting", "columns"] as const) dialogState.remove("chronicle", key);
    document.body.innerHTML = '<div id="dialogs"></div>';
    options.app.mode = null;
    options.map.lore.calendar = { year: 120, era: "Winter Era", eraShort: "WE" };
    const state = (i: number, name: string) => ({ i, name, coa: {} });
    vi.stubGlobal("pack", {
      states: [state(0, "Neutrals"), state(1, "Angria"), state(2, "Tiria")],
      events: [
        {
          i: 0,
          type: "war",
          name: "Old Conquest",
          start: "-45",
          end: "-38",
          attackers: [1],
          defenders: [2],
          tags: ["war"]
        },
        { i: 1, type: "war", name: "Angria-Tirian War", start: "117", attackers: [1], defenders: [2], tags: ["war"] },
        {
          i: 2,
          type: "battle",
          name: "Battle of Lorn",
          start: "119-03-14",
          end: "119-03-14",
          parent: 1,
          cell: 5,
          x: 1,
          y: 2,
          attackers: [1],
          defenders: [2],
          winner: null,
          status: ["", ""],
          tags: ["battle"]
        },
        {
          i: 3,
          type: "battle",
          name: "Siege of Ashford",
          start: "120-06-02T09:00",
          end: "120-06-02T09:40",
          parent: 1,
          cell: 6,
          x: 3,
          y: 4,
          attackers: [1],
          defenders: [2],
          winner: "attackers",
          status: ["", ""],
          tags: ["battle", "siege"],
          replay: {}
        },
        { i: 4, type: "custom", name: "The long winter", start: "120", end: "120", tags: ["famine"] }
      ] as unknown as MapEvent[]
    });
    vi.spyOn(Pack, "findCell").mockReturnValue(7);
  });

  it("lists top events by time, a year before the era by the era, with the year under the list", () => {
    Chronicle.open();
    expect(rows().map(line => line.dataset.id)).toEqual(["0", "1", "4"]);
    expect(cell(0, "start").textContent).toBe("45 BWE");
    expect(cell(0, "start").dataset.tip).toBe("45 before Winter Era");
    expect(cell(0, "end").dataset.tip).toBe("38 before Winter Era (7 years)");
    expect(cell(1, "end").textContent).toBe("ongoing");
    expect(cell(4, "end").textContent).toBe("");
    expect(cell(1, "type").textContent).toBe("War");
    expect(cell(1, "name").textContent).toBe("Angria-Tirian War"); // no count of its parts
    expect(document.getElementById("chronicleFooter")!.textContent).toContain("120 WE");
  });

  it("opens a war to show its battles, a battle of one day by its start alone", () => {
    Chronicle.open();
    row(1).querySelector<HTMLElement>(".chronicleToggle")!.click();
    expect(rows().map(line => line.dataset.id)).toEqual(["0", "1", "2", "3", "4"]);
    expect(cell(3, "start").textContent).toBe("2 Jun 120");
    expect(cell(3, "end").textContent).toBe("");
    expect(cell(3, "start").dataset.tip).toBe("2 June 120 Winter Era, 09:00 – 09:40 (40 minutes)");
  });

  it("filters by type, showing a battle under its muted war", () => {
    Chronicle.open();
    set(document.getElementById("chronicleType") as HTMLSelectElement, "battle");
    expect(rows().map(line => line.dataset.id)).toEqual(["1", "2", "3"]);
    expect(row(1).classList.contains("muted")).toBe(true);
    expect(document.getElementById("chronicleCount")!.textContent).toBe("2 of 5");
  });

  it("drops a remembered state filter the map has no state for", () => {
    dialogState.set("chronicle", "filters", { search: "", type: "all", state: 9 });
    Chronicle.open();
    expect((document.getElementById("chronicleState") as HTMLSelectElement).value).toBe("all");
    expect(rows()).toHaveLength(3);
  });

  it("replays only a played battle: no button for other events, a told reason for a battle with no replay", () => {
    Chronicle.open(3);
    expect(cell(1, "replay").className).toBe("");
    cell(2, "replay").click();
    expect(controllers.BattleScreen.watch).not.toHaveBeenCalled();
    expect(tip).toHaveBeenCalledWith(expect.stringContaining("no replay"), false, "warn", 4000);
    cell(3, "replay").click();
    expect(controllers.BattleScreen.watch).toHaveBeenCalledWith(3);
  });

  it("opens the note of an event from its row", () => {
    Chronicle.open();
    cell(4, "note").click();
    expect(controllers.NotesEditor.open).toHaveBeenCalledWith({ type: "event", id: 4 });
  });

  it("edits a record in its editor and shows the change in the list", async () => {
    Chronicle.open();
    await edit(4);
    expect(row(4).classList.contains("selected")).toBe(true);
    expect(labels()).toBe("Name: Type: Start: End: Part of: Tags: States:");
    set(control("name"), "The great frost");
    expect(Events.get(4)!.name).toBe("The great frost");
    expect(cell(4, "name").textContent).toBe("The great frost");
    set(control("start.year"), "-5");
    expect(Events.get(4)).toMatchObject({ start: "-5", end: "-5" });
    expect(rows().map(line => line.dataset.id)).toEqual(["0", "4", "1"]); // moved to its place in time
    expect(control("start.day").disabled).toBe(true); // a day needs a month
  });

  it("changes the fields with the type of the event", async () => {
    Chronicle.open();
    await edit(4);
    set(control<HTMLSelectElement>("type"), "war");
    expect(Events.get(4)).toMatchObject({ type: "war", attackers: [], defenders: [], tags: ["war", "famine"] });
    expect(labels()).toContain("Attackers: Defenders:");
    expect(cell(4, "type").textContent).toBe("War");
    await edit(1);
    expect(control<HTMLSelectElement>("type").disabled).toBe(true); // an ongoing war follows the relation
  });

  it("makes a battle of the event the place was asked for, not of a record opened meanwhile", async () => {
    Chronicle.open();
    await edit(4);
    set(control<HTMLSelectElement>("type"), "battle");
    expect(placement.click).not.toBeNull();
    expect(Events.get(4)!.type).toBe("custom"); // a battle once it has a place
    await edit(0);
    expect(placement.click).toBeNull(); // the pick is dropped with the record it was for
    expect(Events.get(0)!.type).toBe("war");

    await edit(4);
    set(control<HTMLSelectElement>("type"), "battle");
    placement.click!({ currentTarget: document.body } as unknown as MouseEvent);
    expect(Events.get(4)).toMatchObject({ type: "battle", cell: 7, x: 10, y: 20 });
    expect(labels()).toContain("Winner:");
  });

  it("adds a plain event, cleared of a filter that would hide it, with its name ready to type", async () => {
    Chronicle.open();
    set(document.getElementById("chronicleType") as HTMLSelectElement, "battle");
    document.getElementById("chronicleAdd")!.click();
    const added = pack.events.find(event => event.name === "New event")!;
    expect(added).toMatchObject({ type: "custom", start: "120", end: "120" });
    expect((document.getElementById("chronicleType") as HTMLSelectElement).value).toBe("all");
    expect(row(added.i)).not.toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(control("name")));
  });

  it("removes a war with its battles, asked first, and closes the record of a removed event", async () => {
    Chronicle.open(2);
    await vi.waitFor(() => expect(document.getElementById("chronicleRecordEditor")).not.toBeNull());
    cell(1, "remove").click();
    dialogButton("Remove").click();
    expect(pack.events.map(event => event.i)).toEqual([0, 4]);
    expect(document.getElementById("chronicleRecordEditor")).toBeNull();
  });

  it("shows what changed elsewhere on refresh, and closes its record with it", async () => {
    Chronicle.open();
    await edit(4);
    Events.update(4, { name: "Renamed elsewhere" });
    options.map.lore.calendar.year = 121;
    document.getElementById("chronicleRefresh")!.click();
    expect(cell(4, "name").textContent).toBe("Renamed elsewhere");
    expect(document.getElementById("chronicleFooter")!.textContent).toContain("121 WE");
    await vi.waitFor(() => expect(control("name").value).toBe("Renamed elsewhere"));
    Dialog.close("chronicle");
    expect(document.getElementById("chronicleRecordEditor")).toBeNull();
  });
});
