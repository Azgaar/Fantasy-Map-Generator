import { expect, it, vi } from "vitest";

vi.mock("@/components/map-commands", () => ({
  // its import touches the DOM
  MAP_COMMANDS: [
    { id: "editHeightmapButton", name: "Edit Heightmap" },
    { id: "newMap", name: "New map" }
  ],
  isLinkable: ({ name }: { name: string }) => name.startsWith("Edit ")
}));

vi.mock("@/controllers/assistant/style-reference", () => ({
  styleOverview: () => "overview",
  styleFields: (elements: string[]) => `fields of ${elements}`
}));

import { readDocs } from "./docs";

it("returns data-model sections and extra topics, ignoring case and field-index suffixes", async () => {
  const result = await readDocs(["burgs", "States (regiment)", "Globals"]);
  expect(result).toContain("## Burgs");
  expect(result).toContain("## States");
  expect(result).toContain("var pack: PackedGraph;");
});

it("serves the style overview, or the fields of the elements named", async () => {
  expect(await readDocs(["styles"])).toBe("overview");
  expect(await readDocs(["Styles: ocean, labels"])).toBe("fields of ocean,labels");
});

it("lists the commands a command link may name", async () => {
  const commands = await readDocs(["commands"]);
  expect(commands).toContain("editHeightmapButton: Edit Heightmap");
  expect(commands).not.toContain("newMap");
});

it("lists the registered operations with their signatures and doc lines", async () => {
  const result = await readDocs(["Operations"]);
  expect(result).toContain("Burgs.rename(burgId: number, name: string) // Rename a burg");
  expect(result).toContain("Provinces.setState(provinceId: number, stateId: number)");
  expect(result).toContain('const LABEL_TYPES = ["state", "province", "burg", "river", "route", "added"] as const;');
  expect(result).toContain("interface EmblemCharge extends EmblemPlacement {");
});

it("lists only the asked models' operations, with types only when they name one", async () => {
  const rivers = await readDocs(["Operations: Rivers, lore"]);
  expect(rivers).toContain("Rivers.setWidth(riverId: number");
  expect(rivers).toContain("Lore.setYear(year: number)");
  expect(rivers).not.toContain("Burgs.rename");
  expect(rivers).not.toContain("interface EmblemCharge");
  expect(await readDocs(["Operations: Markers"])).toContain("type MarkerDetails");
  expect(await readDocs(["Operations: Dragons"])).toContain("Unknown topics: Operations: Dragons");
});

it("lists the heraldry the emblem generator knows", async () => {
  const result = await readDocs(["Emblems"]);
  expect(result).toContain("Metals: argent, or.");
  expect(result).toMatch(/^- beasts: .*lion/m);
  expect(result).toContain("perPale");
});

it("lists the available topics for an unknown one", async () => {
  const result = await readDocs(["pack.cells"]);
  expect(result).toContain("Unknown topics: pack.cells");
  expect(result).toContain("Specific cells data");
  expect(result).toContain("Configuration");
});
