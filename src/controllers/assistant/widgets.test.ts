// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reveal: vi.fn(() => true),
  revealBox: vi.fn(() => true),
  mark: vi.fn(() => true),
  clear: vi.fn(),
  run: vi.fn(),
  openGood: vi.fn(async () => {}),
  emblem: vi.fn(async () => {}),
  image: vi.fn(async () => "data:image/png;base64,AA")
}));
vi.mock("@/components/map-commands", () => ({
  MAP_COMMANDS: [
    { id: "editHeightmapButton", name: "Edit Heightmap", run: mocks.run },
    { id: "newMap", name: "Generate New Map", run: mocks.run }
  ],
  isLinkable: ({ id }: { id: string }) => id !== "newMap"
}));
vi.mock("@/components/reveal", () => ({
  reveal: mocks.revealBox,
  revealEntity: mocks.reveal,
  markEntities: mocks.mark,
  clearEntityMarks: mocks.clear
}));
vi.mock("@/components/tooltips", () => ({ tip: vi.fn() }));
vi.mock("@/services/io/export", () => ({ ExportMap: { getRegionImage: mocks.image } }));
vi.mock("@/controllers", () => ({ Controllers: { GoodsEditor: { open: mocks.openGood } } }));

import type { Widget } from "@/services/assistant/chats";
import { renderMarkdown } from "@/utils/markdown";
import { AssistantWidgets } from "./widgets";

const answer = (text: string, live = true) => renderMarkdown(text, AssistantWidgets.links(live));
type Entities = Extract<Widget, { type: "entities" }>;
const widget = (): Entities => ({ type: "entities", title: "Ports <b>", entities: ["burg:1", "burg:2"] });
const at = (index = 0, live = true, canAsk = true) => ({ index, live, canAsk });
const dom = (html: string) => {
  document.body.innerHTML = html;
  return document.body;
};

beforeEach(() => {
  vi.clearAllMocks();
  AssistantWidgets.clearMarks();
  globalThis.pack = {
    burgs: [
      0,
      { i: 1, name: "Vel", state: 1 },
      { i: 2, name: "Orn", removed: true },
      { i: 3, name: "Twin" },
      { i: 4, name: "Twin" }
    ],
    states: [
      { i: 0, name: "Neutrals" },
      {
        i: 1,
        name: "Orwin",
        fullName: "Kingdom of Orwin",
        formName: "Kingdom",
        capital: 1,
        culture: 1,
        area: 10,
        rural: 2,
        urban: 1,
        burgs: 4,
        coa: { t1: "gules" },
        note: "<p>An <b>old</b> realm</p>"
      }
    ],
    cultures: [
      { i: 0, name: "Wildlands" },
      { i: 1, name: "Orwish" }
    ],
    religions: [
      { i: 0, name: "No religion" },
      { i: 1, name: "Sun Cult" }
    ],
    cells: { religion: [0, 1] },
    goods: [{ i: 0, name: "Salt" }]
  } as unknown as typeof pack;
  pack.burgs[1] = { ...pack.burgs[1], cell: 1 } as (typeof pack.burgs)[number];
  globalThis.options = {
    map: {
      graph: { width: 1000, height: 500 },
      units: {
        population: { scale: 1000, urbanization: { rate: 1 } },
        area: { unit: "square" },
        distance: { scale: 1, unit: "km" }
      }
    }
  } as unknown as typeof options;
  window.EmblemRenderer = { trigger: mocks.emblem } as unknown as typeof window.EmblemRenderer;
});

it("links a live entity and keeps just the label otherwise", () => {
  expect(answer("[<Vel>](burg:1)")).toContain('data-action="entity" data-id="burg:1"');
  expect(answer("[<Vel>](burg:1)")).toContain(">&lt;Vel&gt;</button>");
  expect(answer("[Vel](burg:1)", false)).toBe("<p>Vel</p>");
  expect(answer("[Orn](burg:2)")).toBe("<p>Orn</p>");
});

it("prepends the entity type's icon to a link", () => {
  expect(answer("[Vel](burg:1)")).toContain('<span class="icon-home" aria-hidden="true"></span>Vel</button>');
});

it("links a key without a usable id by its label when exactly one entity bears it", () => {
  expect(answer("[Vel](burg:?)")).toContain('data-id="burg:1"');
  expect(answer("[Orwin](state:?)")).toContain('data-id="state:1"');
  expect(answer("[Twin](burg:?)")).toBe("<p>Twin</p>");
  expect(answer("[Orn](burg:?)")).toBe("<p>Orn</p>");
  expect(answer("[Vel](burg:?)", false)).toBe("<p>Vel</p>");
});

it("links only allowed commands, and leaves unknown schemes alone", () => {
  expect(answer("[Heightmap](command:editHeightmapButton)")).toContain(
    'data-action="command" data-id="editHeightmapButton"'
  );
  expect(answer("[Heightmap](command:editHeightmapButton)", false)).toContain('data-action="command"');
  expect(answer("[New](command:newMap)")).toBe("<p>New</p>");
  expect(answer("[x](other:1)")).toBe("<p>[x](other:1)</p>");
});

it("lists a widget's entities, marking the gone ones", () => {
  const html = AssistantWidgets.html(widget(), at(3));
  expect(html).toContain("Ports &lt;b&gt;");
  expect(html).toContain('data-id="burg:1"');
  expect(html).toContain('<li class="gone">burg:2</li>');
  expect(html).toContain('data-index="3" aria-pressed="false"');
});

it("keeps a widget of another map inert", () => {
  const html = AssistantWidgets.html(widget(), at(0, false));
  expect(html).not.toContain('data-action="entity"');
  expect(html).toContain("Its map is not open");
  expect(html).toMatch(/aria-pressed="false" disabled/);
});

it("rings one widget's entities at a time and clears them on the second press", () => {
  const first = widget();
  const second = widget();
  AssistantWidgets.toggleMarks(first);
  expect(mocks.mark).toHaveBeenCalledWith([{ type: "burg", id: 1 }], undefined);
  expect(AssistantWidgets.html(first, at())).toContain('aria-pressed="true"');
  AssistantWidgets.toggleMarks(second);
  expect(AssistantWidgets.html(first, at())).toContain('aria-pressed="false"');
  AssistantWidgets.toggleMarks(second);
  expect(mocks.clear).toHaveBeenCalled();
  expect(AssistantWidgets.html(second, at())).toContain('aria-pressed="false"');
});

it("reveals an entity on click, and opens the editor of one with no place on the map", () => {
  AssistantWidgets.openEntity("burg:1");
  expect(mocks.reveal).toHaveBeenCalledWith({ type: "burg", id: 1 }, undefined);
  expect(mocks.openGood).not.toHaveBeenCalled();
  AssistantWidgets.openEntity("burg:2");
  expect(mocks.reveal).toHaveBeenCalledTimes(1);
  mocks.reveal.mockReturnValueOnce(false);
  AssistantWidgets.openEntity("good:0");
  expect(mocks.openGood).toHaveBeenCalledWith(0);
});

it("runs only allowed commands", () => {
  AssistantWidgets.runCommand("newMap");
  expect(mocks.run).not.toHaveBeenCalled();
  AssistantWidgets.runCommand("editHeightmapButton");
  expect(mocks.run).toHaveBeenCalledTimes(1);
});

it("profiles a state in a card with its emblem, figures and note", () => {
  const card = dom(AssistantWidgets.html({ type: "card", entity: "state:1" }, at()));
  expect(mocks.emblem).toHaveBeenCalledWith("stateCOA1", { t1: "gules" });
  expect(card.querySelector("use")?.getAttribute("href")).toBe("#stateCOA1");
  expect(card.querySelector("strong")?.textContent).toBe("Kingdom of Orwin");
  const facts = Object.fromEntries(
    [...card.querySelectorAll("dt")].map(dt => [dt.textContent, dt.nextElementSibling?.textContent])
  );
  expect(facts).toMatchObject({
    Capital: "Vel",
    Population: "3K",
    Burgs: "4",
    Culture: "Orwish",
    Religion: "Sun Cult"
  });
  expect(card.querySelector(".assistantCardNote")?.textContent).toBe("An old realm");
  expect(card.querySelector('[data-action="command"]')?.getAttribute("data-id")).toBe("editStatesButton");
});

it("keeps a card of another map inert", () => {
  const card = dom(AssistantWidgets.html({ type: "card", entity: "state:1" }, at(0, false)));
  expect(card.querySelector("dl")).toBeNull();
  expect(card.textContent).toContain("Its map is not open");
});

it("draws a bar chart scaled to its largest value, linking entity rows", () => {
  const chart = dom(
    AssistantWidgets.html(
      {
        type: "chart",
        chart: "bar",
        title: "Population",
        unit: "people",
        rows: [
          { label: "Vel", value: 50, entity: "burg:1" },
          { label: "Other", value: 100 }
        ]
      },
      at()
    )
  );
  const widths = [...chart.querySelectorAll<HTMLElement>(".assistantBarTrack i")].map(bar => bar.style.width);
  expect(widths).toEqual(["50%", "100%"]);
  expect(chart.querySelector('[data-action="entity"]')?.getAttribute("data-id")).toBe("burg:1");
  expect(chart.textContent).toContain("100 people");
});

it("draws a pie chart with a legend of shares", () => {
  const chart = dom(
    AssistantWidgets.html(
      {
        type: "chart",
        chart: "pie",
        title: "Faiths",
        unit: "people",
        rows: [
          { label: "A", value: 3000 },
          { label: "B", value: 1000 }
        ]
      },
      at()
    )
  );
  expect(chart.querySelectorAll("svg path")).toHaveLength(2);
  expect([...chart.querySelectorAll("li small")].map(small => small.textContent)).toEqual(["75%", "25%"]);
  expect(chart.querySelector("li")?.getAttribute("data-tip")).toBe("3000 people");
  expect(chart.querySelector(".assistantChartCaption")?.textContent).toBe("Share of 4000 people");
});

it("keeps a pie of percentages to a single share per row", () => {
  const chart = dom(
    AssistantWidgets.html(
      {
        type: "chart",
        chart: "pie",
        title: "Faiths",
        unit: "%",
        rows: [
          { label: "A", value: 60 },
          { label: "B", value: 40 }
        ]
      },
      at()
    )
  );
  expect([...chart.querySelectorAll("li small")].map(small => small.textContent)).toEqual(["60%", "40%"]);
  expect(chart.querySelector("li")?.hasAttribute("data-tip")).toBe(false);
  expect(chart.querySelector(".assistantChartCaption")?.textContent).toBe("Share of the total");
});

it("offers choices until one is picked; a proposal choice needs the map, a question needs the chat", () => {
  const choices: Widget = {
    type: "choices",
    title: "Rename Vel",
    choices: [
      { label: "Saltmere", operations: [{ op: "Burgs.rename", args: [1, "Saltmere"] }] },
      { label: "Tell me more" }
    ]
  };
  const enabled = (context: ReturnType<typeof at>) =>
    [...dom(AssistantWidgets.html(choices, context)).querySelectorAll("button")].map(button => !button.disabled);
  expect(enabled(at())).toEqual([true, true]);
  expect(enabled(at(0, true, false))).toEqual([true, false]);
  expect(enabled(at(0, false, true))).toEqual([false, true]);
  choices.picked = 1;
  const picked = dom(AssistantWidgets.html(choices, at()));
  expect(enabled(at())).toEqual([false, false]);
  expect(picked.querySelector('[aria-pressed="true"]')?.textContent).toBe("Tell me more");
});

it("draws an inset once, framed around its entity within the map, and rings the entity", async () => {
  pack.burgs[1] = { ...pack.burgs[1], x: 10, y: 250 } as (typeof pack.burgs)[number];
  const inset: Widget = { type: "inset", title: "Vel", entity: "burg:1" };
  document.body.innerHTML = AssistantWidgets.html(inset, at());
  expect(document.body.textContent).toContain("Drawing the map…");
  await vi.waitFor(() => expect(document.querySelector(".assistantInset img")).not.toBeNull());
  const [region] = mocks.image.mock.calls[0] as unknown as [
    { x0: number; x1: number; y0: number; y1: number; width: number }
  ];
  expect(region.x0).toBe(0); // pushed inside the map rather than centred off its edge
  expect((region.x1 - region.x0) / (region.y1 - region.y0)).toBeCloseTo(480 / 300);
  expect(document.querySelector(".assistantInset circle")?.getAttribute("cx")).toBe("10");
  AssistantWidgets.html(inset, at());
  expect(mocks.image).toHaveBeenCalledTimes(1);
});

it("zooms the map to an inset's entity or box", () => {
  AssistantWidgets.revealInset({ type: "inset", title: "Vel", entity: "burg:1" });
  expect(mocks.reveal).toHaveBeenCalledWith({ type: "burg", id: 1 }, undefined);
  AssistantWidgets.revealInset({ type: "inset", title: "Box", box: [1, 2, 3, 4] });
  expect(mocks.revealBox).toHaveBeenCalledWith(
    [
      [1, 2],
      [3, 4]
    ],
    expect.objectContaining({ layers: [] })
  );
});

it("shows the emblem the model looked at", () => {
  const emblem = dom(AssistantWidgets.html({ type: "emblem", entity: "state:1" }, at()));
  expect(mocks.emblem).toHaveBeenCalledWith("stateCOA1", { t1: "gules" });
  expect(emblem.querySelector(".assistantEmblem use")?.getAttribute("href")).toBe("#stateCOA1");
  expect(emblem.querySelector('[data-action="entity"]')?.textContent).toBe("Kingdom of Orwin");
});
