// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import type { Proposal } from "@/services/assistant/chats";

vi.mock("./proposals", () => ({ Proposals: { ready: () => true } }));
vi.mock("@/components/icons", () => ({ Icons: { html: () => "" } }));
vi.mock("@/components/map-entities", () => ({
  MapEntities: {
    parseKey: (key: string) => ({ type: key.split(":")[0], id: Number(key.split(":")[1]) }),
    get: () => undefined,
    referenceType: (type: string, field: string) => (type === "state" && field === "capital" ? "burg" : undefined),
    getName: ({ type, id }: { type: string; id: number }) =>
      (({ "state:7": "Orwin", "burg:3": "Vel" }) as Record<string, string>)[`${type}:${id}`] ?? ""
  }
}));
vi.stubGlobal("pack", {});
vi.stubGlobal("options", {
  map: {
    units: {
      population: { scale: 1000, urbanization: { rate: 1 } },
      distance: { unit: "mi", scale: 3 },
      area: { unit: "square" }
    }
  }
});

const { ProposalCard } = await import("./proposal-card");

const card = (change: Proposal["change"]) => {
  const proposal: Proposal = { number: 1, mapId: 1, summary: "Notes", operations: [], change, state: "proposed" };
  const host = document.createElement("div");
  host.innerHTML = ProposalCard.html(proposal, 0, 1);
  return host;
};

it("renders a note in the notes subset as HTML", () => {
  const host = card([
    { key: "marker:1", entity: "Marker", field: "note", before: "", after: "<p><b>Old</b> ruin</p>" }
  ]);
  expect(host.querySelector(".assistantNotePreview b")?.textContent).toBe("Old");
});

it("escapes a note outside the notes subset, also on an added entity", () => {
  const unsafe = `<img src="x" onerror="alert(1)">`;
  const host = card([
    { key: "marker:1", entity: "Marker", field: "note", before: "", after: unsafe },
    { key: "burg:2", entity: "Burg", field: "", before: undefined, after: { i: 2, note: unsafe } }
  ]);
  const previews = [...host.querySelectorAll(".assistantNotePreview")];
  expect(previews).toHaveLength(2);
  for (const preview of previews) {
    expect(preview.querySelector("img")).toBeNull();
    expect(preview.textContent).toBe(unsafe);
  }
});

it("loads no remote image before the note is applied", () => {
  const host = card([
    {
      key: "marker:1",
      entity: "Marker",
      field: "note",
      before: "",
      after: `<p>Map <img src="https://x.test/a.png" alt="sketch"></p>`
    }
  ]);
  const preview = host.querySelector(".assistantNotePreview")!;
  expect(preview.querySelector("img")).toBeNull();
  expect(preview.textContent).toBe("Map [sketch]");
});

it("shows values as the app does: people, money, names and the chronicle", () => {
  const text = ProposalCard.text([
    { key: "burg:2", entity: "Burg: Sarester", field: "population", before: 49.968, after: 0.0999 },
    { key: "burg:2", entity: "Burg: Sarester", field: "treasury", before: 10, after: 12.5 },
    { key: "state:5", entity: "State: Kahor", field: "diplomacy.7", before: "Unknown", after: "Ally" },
    { key: "state:5", entity: "State: Kahor", field: "capital", before: 3, after: 9 },
    { key: "state:0", entity: "State: Neutrals", field: "diplomacy", before: [[], [], []], after: [[], [], [], []] },
    { key: "state:0", entity: "State: Neutrals", field: "diplomacy", after: [["Peace", "Signed"]], append: true }
  ]);
  expect(text.split("\n")).toEqual([
    "Burg: Sarester · Population: 50K → 100",
    "Burg: Sarester · Treasury: 🟡 10 → 🟡 12.5",
    "State: Kahor · Relation to Orwin: Unknown → Ally",
    "State: Kahor · Capital: Vel → 9",
    "Chronicle · Entries: 3 → 4",
    "Chronicle · Entries: + Peace"
  ]);
  expect(
    card([{ key: "state:0", entity: "State: Neutrals", field: "diplomacy", before: [], after: [[]] }]).textContent
  ).toContain("Chronicle");
});

it("lists at most the limit of rows for the model", () => {
  const rows = [1, 2, 3].map(id => ({ key: `burg:${id}`, entity: "Burg", field: "name", before: "A", after: "B" }));
  expect(ProposalCard.text(rows, 2).split("\n")).toEqual(["Burg · Name: A → B", "Burg · Name: A → B", "… 1 more"]);
});

it("hides bookkeeping fields beside real changes, formats areas and shows an emblem as one row", () => {
  const state = { key: "state:5", entity: "State: Kahor" };
  const text = ProposalCard.text([
    { ...state, field: "pole.0", before: 929, after: 932 },
    { ...state, field: "center", before: 1127, after: 1065 },
    { ...state, field: "area", before: 1000, after: 2000 },
    { ...state, field: "coa.charges.0.charge", before: "plaice", after: "dragonRampant" },
    { ...state, field: "coa.t1", before: "argent", after: "or" }
  ]);
  expect(text.split("\n")).toEqual(["State: Kahor · Area: 9K mi² → 18K mi²", "State: Kahor · Emblem: redrawn"]);
  expect(ProposalCard.text([{ ...state, field: "center", before: 1, after: 2 }])).toBe("State: Kahor · Center: 1 → 2");
});

it("shows an added burg with its main fields", () => {
  const added = { i: 9, name: "Ravenhold", group: "town", population: 5, port: 1, capital: 0 };
  const row = { key: "burg:9", entity: "Burg: Ravenhold", field: "", before: undefined, after: added };
  expect(ProposalCard.text([row])).toBe("Burg: Ravenhold: added · Group: town · Population: 5K · Port: yes");
  expect(card([row]).textContent).toContain("5K");
});

it("names style values by layer and group, with a color swatch", () => {
  const row = {
    key: "style",
    entity: "Style",
    field: "ocean.groups.base.attrs.fill",
    before: "#466eab",
    after: "#0d2240"
  };
  expect(ProposalCard.text([row])).toBe("Style · Ocean · Base · Fill: #466eab → #0d2240");
  expect(card([row]).querySelectorAll(".assistantSwatch")).toHaveLength(2);
});
