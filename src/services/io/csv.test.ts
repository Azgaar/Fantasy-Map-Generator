import { describe, expect, it, vi } from "vitest";
import { downloadFile } from "@/utils/fileUtils";
import { Csv } from "./csv";

vi.mock("@/utils/fileUtils", async importOriginal => ({
  ...(await importOriginal<typeof import("@/utils/fileUtils")>()),
  downloadFile: vi.fn()
}));

const COLUMNS = ["Id", "Name", "Area", "Tags"];

describe("Csv.download", () => {
  it("quotes only the values that need it and leaves missing ones empty", () => {
    Csv.download(
      "Test",
      ["Id", "Name"],
      [
        [1, 'Kin, of "Ash"'],
        [2, undefined],
        [3, null]
      ]
    );
    const [text, name] = vi.mocked(downloadFile).mock.calls[0];
    expect(text).toBe('\uFEFFId,Name\n1,"Kin, of ""Ash"""\n2,\n3,');
    expect(name).toMatch(/Test.*\.csv$/);
  });
});

describe("Csv.parse", () => {
  it("drops blank rows and keeps quoted commas and newlines", () => {
    expect(Csv.parse('a,b\n,\n1,"x, ""y""\nz"\n\n')).toEqual([
      ["a", "b"],
      ["1", 'x, "y"\nz']
    ]);
  });

  it("rejects an empty and a semicolon-separated text", () => {
    expect(() => Csv.parse(" \n,,\n")).toThrow("No data to upload");
    expect(() => Csv.parse("Id;Name\n1;A")).toThrow("Only comma-separated CSV files are supported");
  });
});

describe("Csv.read", () => {
  it("matches headers ignoring case, outer spaces and units, and lists unknown ones", () => {
    const table = Csv.read(" id ,NAME,Area mi2,Colour\n1,A,5,red", COLUMNS, { required: ["Id"], units: ["Area"] });
    expect(table.rows).toEqual([{ Id: "1", Name: "A", Area: "5" }]);
    expect(table.unknown).toEqual(["Colour"]);
  });

  it("requires the key column and data rows", () => {
    expect(() => Csv.read("Name\nA", COLUMNS, { required: ["Id"] })).toThrow("The file has no Id column");
    expect(() => Csv.read("Id\n1", COLUMNS, { required: ["Id", "Name"] })).toThrow("The file has no Name column");
    expect(() => Csv.read("Id,Name\n,\n", COLUMNS, { required: ["Id"] })).toThrow("No data to upload");
  });
});

describe("Csv.unsafeText", () => {
  it("explains a text with markup characters and accepts a plain one", () => {
    expect(Csv.unsafeText('Kin "A"')).toContain("Text cannot contain");
    expect(Csv.unsafeText("Kin A")).toBeUndefined();
  });
});
