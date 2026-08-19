import { describe, expect, it } from "vitest";
import { sortData } from "./sorting";

const rows = () => [
  { name: "Bree", pop: 300 },
  { name: "Anor", pop: 1000 },
  { name: "Cair", pop: 50 }
];

describe("sortData", () => {
  it("sorts alphabetically ascending and descending", () => {
    const accessors = { name: (r: { name: string }) => r.name };
    expect(sortData(rows(), { sortby: "name", alphabetically: true, direction: 1 }, accessors).map(r => r.name)) //
      .toEqual(["Anor", "Bree", "Cair"]);
    expect(sortData(rows(), { sortby: "name", alphabetically: true, direction: -1 }, accessors).map(r => r.name)) //
      .toEqual(["Cair", "Bree", "Anor"]);
  });

  it("sorts numerically", () => {
    const accessors = { pop: (r: { pop: number }) => r.pop };
    expect(sortData(rows(), { sortby: "pop", alphabetically: false, direction: 1 }, accessors).map(r => r.pop)) //
      .toEqual([50, 300, 1000]);
  });

  it("returns data untouched for an unknown sort key", () => {
    const data = rows();
    expect(sortData(data, { sortby: "nope", alphabetically: true, direction: 1 }, {})).toBe(data);
  });
});
