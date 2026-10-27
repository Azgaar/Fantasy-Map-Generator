// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dialogState } from "@/components/dialog/state";
import { emptyHistory, type History } from "@/types/history";

vi.mock("@/generators/history-generator", () => ({ Chronicle: { sync: () => globalThis.pack.history } }));
vi.mock("@/generators/journeys/journey-places", () => ({
  getCellPoint: (cell: number) => (cell === 9 ? [450, 150] : undefined)
}));
vi.mock("@/components/dialog/dialog-helpers", () => ({ closeDialogs: vi.fn(), destroyDialog: vi.fn() }));
vi.mock("@/controllers", () => ({ Controllers: { BurgEditor: { open: vi.fn() } } }));

import { LegendsOverview } from "./history-overview";

const history: History = {
  eras: [
    { name: "The Vhalen Era", from: 100, to: 500 },
    { name: "Era", from: 500, to: 1000 }
  ],
  realms: [
    {
      i: 0,
      name: "Vhalen Empire",
      coa: { t1: "gules" },
      center: 9,
      capital: 2,
      founded: 100,
      fallen: 500,
      cause: "partition",
      successors: [1, 2],
      remnantCulture: 3
    }
  ],
  events: [
    {
      i: 0,
      year: 120,
      type: "founding",
      actors: [{ kind: "realm", id: 0 }],
      loc: 9,
      text: "The Vhalen Empire was proclaimed"
    },
    { i: 1, year: 300, type: "goldenAge", actors: [{ kind: "realm", id: 0 }], text: "The Empire reached its height" },
    { i: 2, year: 505, type: "founding", actors: [{ kind: "state", id: 1 }], text: "Kingdom of A was founded" },
    {
      i: 3,
      year: 700,
      type: "war",
      actors: [
        { kind: "state", id: 1 },
        { kind: "state", id: 2 }
      ],
      loc: 42,
      text: "A and B clashed over the border"
    }
  ]
};

const zoomToMock = vi.fn();

beforeEach(() => {
  dialogState.clear(); // filters persist in a module cache; a leaked filter would fail the next test
  document.body.innerHTML = '<div id="dialogs"></div>';
  vi.stubGlobal("customization", 0);
  vi.stubGlobal("zoomTo", zoomToMock);
  vi.stubGlobal("$", () => ({ dialog: vi.fn() }));
  globalThis.pack = {
    cells: {
      p: [
        [0, 0],
        [10, 10],
        [20, 20],
        [30, 30],
        [40, 40],
        [50, 60]
      ]
    },
    states: [
      { i: 0, name: "Neutrals" },
      { i: 1, name: "A", pole: [500, 400] },
      { i: 2, name: "B" }
    ],
    burgs: [0, { i: 1, name: "Town" }],
    cultures: [
      { i: 0, name: "Wildlings" },
      { i: 1, name: "Aeloran" },
      { i: 2, name: "Velic" },
      { i: 3, name: "Thornic", center: 5 }
    ],
    religions: [{ i: 0, name: "No religion" }],
    history
  } as unknown as typeof pack;
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.getElementById("legendsBrowser")?.remove();
});

const body = () => {
  const el = document.getElementById("legendsBody");
  if (!el) throw new Error("Legends browser is not open");
  return el;
};

describe("LegendsOverview", () => {
  it("renders the timeline grouped by era", () => {
    LegendsOverview.open();
    const headers = [...body().querySelectorAll(".legendsEra")].map(el => el.textContent);
    expect(headers).toEqual(["The Vhalen Era (100–500)", "Era (500–1000)"]);
    expect(body().querySelectorAll(".legendsEvent")).toHaveLength(4);
    expect(document.getElementById("legendsCount")!.textContent).toBe("4");
  });

  it("filters events by type, actor kind and text", () => {
    LegendsOverview.open();
    const type = document.getElementById("legendsType") as HTMLSelectElement;
    type.value = "war";
    type.dispatchEvent(new Event("change"));
    expect(body().querySelectorAll(".legendsEvent")).toHaveLength(1);

    const actor = document.getElementById("legendsActor") as HTMLSelectElement;
    actor.value = "realm";
    actor.dispatchEvent(new Event("change"));
    expect(body().querySelectorAll(".legendsEvent")).toHaveLength(0); // the war has no realm actor

    const search = document.getElementById("legendsSearch") as HTMLInputElement;
    search.value = "clashed";
    search.dispatchEvent(new Event("input"));
    expect(body().querySelectorAll(".legendsEvent")).toHaveLength(0); // actor filter still on
    actor.value = "";
    actor.dispatchEvent(new Event("change"));
    expect(body().querySelectorAll(".legendsEvent")).toHaveLength(1);
    expect(document.getElementById("legendsCount")!.textContent).toBe("1");
  });

  it("zooms to where an event happened", () => {
    LegendsOverview.open();
    const locate = body().querySelector<HTMLElement>(".legendLocate")!;
    locate.click();
    expect(zoomToMock).toHaveBeenCalledWith(450, 150, 8, 2000);
  });

  it("jumps to an actor's place on the map, or opens a burg's editor", () => {
    LegendsOverview.open();
    const stateChip = body().querySelector<HTMLElement>('.legendActor[data-kind="state"][data-id="1"]')!;
    stateChip.click();
    expect(zoomToMock).toHaveBeenCalledWith(500, 400, 4, 2000); // the state's pole

    // the remnant culture chip lives on the realm card
    (document.getElementById("legendsTabRealms") as HTMLElement).click();
    const cultureChip = body().querySelector<HTMLElement>('.legendActor[data-kind="culture"][data-id="3"]')!;
    cultureChip.click();
    expect(zoomToMock).toHaveBeenLastCalledWith(50, 60, 4, 2000); // the culture's center cell
  });

  it("shows the fallen realms with their stories", () => {
    LegendsOverview.open();
    (document.getElementById("legendsTabRealms") as HTMLElement).click();
    expect(body().querySelectorAll(".legendsRealm")).toHaveLength(1);
    const realmCard = body().querySelector(".legendsRealm")!.textContent!;
    expect(realmCard).toContain("Vhalen Empire");
    expect(realmCard).toContain("100–500");
    expect(realmCard).toContain("partition");
    expect(body().querySelectorAll('.legendActor[data-kind="state"]')).toHaveLength(2); // successors
    expect(body().querySelectorAll('.legendActor[data-kind="culture"]')).toHaveLength(1); // the remnant
    expect(realmCard).toContain("was proclaimed"); // the realm's own events are listed
    expect(body().querySelectorAll(".legendsEvent")).toHaveLength(2);
  });

  it("opens the realms tab from a realm chip", () => {
    LegendsOverview.open();
    const chip = body().querySelector<HTMLElement>('.legendActor[data-kind="realm"]')!;
    chip.click();
    expect(document.getElementById("legendsTabRealms")!.classList.contains("active")).toBe(true);
  });

  it("reads a culture's ethos on its actor chip", () => {
    pack.cultures[3].alignment = "lawful";
    pack.cultures[3].values = ["truth", "justice"];

    LegendsOverview.open();
    (document.getElementById("legendsTabRealms") as HTMLElement).click();
    const chip = body().querySelector<HTMLElement>('.legendActor[data-kind="culture"][data-id="3"]')!;

    expect(chip.dataset.tip).toContain("A lawful people prizing truth and justice");
    expect(chip.dataset.tip).toContain("Open it on the map");
  });

  it("reads a dominant value as held above all, and says nothing when the culture is untyped", () => {
    pack.cultures[3].alignment = "chaotic";
    pack.cultures[3].values = ["passion"];

    LegendsOverview.open();
    (document.getElementById("legendsTabRealms") as HTMLElement).click();
    const chip = () => body().querySelector<HTMLElement>('.legendActor[data-kind="culture"][data-id="3"]')!;
    expect(chip().dataset.tip).toContain("prizing passion above all");

    // an old map, or the traits layer turned off: the chip reads exactly as it did before
    delete pack.cultures[3].alignment;
    delete pack.cultures[3].values;
    LegendsOverview.open();
    (document.getElementById("legendsTabRealms") as HTMLElement).click();
    expect(chip().dataset.tip).toBe("Open it on the map");
  });

  it("shows a figure's alignment, virtues and vices", () => {
    globalThis.pack.history = {
      ...history,
      figures: [
        {
          i: 0,
          name: "Ausa the Bold",
          culture: 1,
          birth: 940,
          roles: [{ type: "ruler", target: { kind: "state", id: 1 }, from: 980 }],
          alignment: "lawful",
          virtues: ["just", "loyal"],
          vices: ["harsh"]
        }
      ]
    };
    LegendsOverview.open();
    (document.getElementById("legendsTabFigures") as HTMLElement).click();

    const row = body().querySelector(".legendsEvent")!;
    const alignment = row.querySelector(".legendsAlignment")!;
    expect(alignment.textContent).toBe("lawful");
    expect(alignment.getAttribute("style")).toContain("#3d6db5");
    expect(row.textContent).toContain("just, loyal");
    expect(row.querySelector(".legendsVice")!.textContent).toBe("harsh");
  });

  it("shows a figure without traits as before", () => {
    globalThis.pack.history = {
      ...history,
      figures: [
        {
          i: 0,
          name: "Old Ruler",
          culture: 1,
          birth: 900,
          roles: [{ type: "ruler", target: { kind: "state", id: 1 }, from: 950 }]
        }
      ]
    };
    LegendsOverview.open();
    (document.getElementById("legendsTabFigures") as HTMLElement).click();

    const row = body().querySelector(".legendsEvent")!;
    expect(row.querySelector(".legendsTraits")).toBeNull();
    expect(row.textContent).toContain("Old Ruler");
  });

  it("shows an empty state without a chronicle", () => {
    globalThis.pack.history = emptyHistory();
    LegendsOverview.open();
    expect(body().querySelector(".legendsEmpty")).toBeTruthy();
    expect(document.getElementById("legendsCount")!.textContent).toBe("0");
  });

  it("does not open in customization mode", () => {
    vi.stubGlobal("customization", 1);
    LegendsOverview.open();
    expect(document.getElementById("legendsBrowser")).toBeNull();
  });
});
