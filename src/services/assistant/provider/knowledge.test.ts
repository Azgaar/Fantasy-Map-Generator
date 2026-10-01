import { expect, it } from "vitest";
import { searchHelp } from "./knowledge";

it("returns the best-matching Knowledge Base sections and other matching headings", async () => {
  const result = await searchHelp("change the land heightmap");
  expect(result).toContain("### How can I change the land?");
  expect(result).toContain("Other matches");
});

it("returns just the section for an exact heading", async () => {
  const result = await searchHelp("How can I change the land?");
  expect(result.startsWith("### How can I change the land?")).toBe(true);
  expect(result).not.toContain("Other matches");
});

it("reports a query that matches nothing", async () => {
  expect(await searchHelp("zzqx")).toContain("No help sections match");
});

it("searches the wiki pages beside the Knowledge Base", async () => {
  expect(await searchHelp("river source width modifier")).toContain("### River Editor › Fields");
  expect(await searchHelp("River Editor › Fields")).toContain("Width modifier");
});
