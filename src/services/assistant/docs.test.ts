import { expect, it } from "vitest";
import { readDocs } from "./docs";

it("returns data-model sections and extra topics, ignoring case and field-index suffixes", async () => {
  const result = await readDocs(["burgs", "States (regiment)", "Globals"]);
  expect(result).toContain("## Burgs");
  expect(result).toContain("## States");
  expect(result).toContain("var pack: PackedGraph;");
});

it("lists the commands a command link may name", async () => {
  expect(await readDocs(["commands"])).toContain("editHeightmapButton: Edit Heightmap");
});

it("lists the registered operations with their signatures and doc lines", async () => {
  const result = await readDocs(["Operations"]);
  expect(result).toContain("Burgs.rename(burgId: number, name: string) // Rename a burg");
  expect(result).toContain("Provinces.setState(provinceId: number, stateId: number)");
  expect(result).toContain('const LABEL_TYPES = ["state", "province", "burg", "river", "route", "added"] as const;');
  expect(result).toContain("interface EmblemCharge extends EmblemPlacement {");
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
