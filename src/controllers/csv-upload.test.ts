import { beforeEach, describe, expect, it, vi } from "vitest";
import { alertDialog, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { CsvUpload } from "./csv-upload";

vi.mock("@/components/tooltips", () => ({ tip: vi.fn() }));
vi.mock("@/components/dialog/dialog-helpers", () => ({ alertDialog: vi.fn(), confirmationDialog: vi.fn() }));

type Entity = { i: number; name: string; tags: string; people: [number, number] };
const COLUMNS = ["Id", "Name", "Tags", "Total Population", "Rural Population", "Urban Population"];
const items = () => (globalThis.pack as unknown as { items: Entity[] }).items;
const find = (id: number) => items().find(entity => entity.i === id);
const lastAlert = () => vi.mocked(alertDialog).mock.calls.at(-1)?.[0].message;
const dialog = () => vi.mocked(confirmationDialog).mock.calls.at(-1)![0];

const rename = (text: string, options = {}) =>
  CsvUpload.update(text, COLUMNS, { find, ...options }, (id, row) => {
    const entity = find(id)!;
    row.apply("Name", name => (entity.name = name), entity.name);
    row.assign("Tags", tags => (entity.tags = tags), entity.tags);
    row.population(entity.people, (rural, urban) => (entity.people = [rural, urban]));
  });

describe("CsvUpload.update", () => {
  beforeEach(() => {
    vi.mocked(confirmationDialog).mockClear();
    globalThis.pack = {
      items: [
        { i: 1, name: "A", tags: "x", people: [74.6, 25.2] },
        { i: 2, name: 'Kin "B"', tags: "y", people: [10, 0] }
      ]
    } as unknown as typeof pack;
  });

  it("stops before any change when an id is unknown", async () => {
    expect(await rename("Id,Name\n1,Z\n9,Y\n,X")).toBe(false);
    expect(confirmationDialog).not.toHaveBeenCalled();
    expect(lastAlert()).toContain("Missing keys: 9, ?");
  });

  it("previews on a draft and changes the map only on Apply", async () => {
    const done = rename("Id,Name,Tags,Colour\n1,Z,\n2,,y");
    const { message, onConfirm } = dialog();
    expect(items()[0]).toMatchObject({ name: "A", tags: "x" });
    expect(message).toContain("Values to update: 2");
    expect(message).toContain("Unknown column: Colour");
    onConfirm!();
    expect(await done).toBe(true);
    expect(items()[0]).toMatchObject({ name: "Z", tags: "" });
    expect(items()[1].tags).toBe("y");
  });

  it("leaves the map as it is on Cancel", async () => {
    const done = rename("Id,Name\n1,Z");
    dialog().onCancel!();
    expect(await done).toBe(false);
    expect(items()[0].name).toBe("A");
  });

  it("reports nothing to change instead of a preview", async () => {
    expect(await rename('Id,Name\n1,A\n2,"Kin ""B"""')).toBe(false);
    expect(confirmationDialog).not.toHaveBeenCalled();
    expect(lastAlert()).toContain("No changes found in the file");
  });

  it("lists a changed text with markup characters as not applied", async () => {
    void rename("Id,Name\n1,<b>Z</b>", { text: ["Name"] });
    expect(dialog().message).toContain("Values that will not be applied: 1");
    expect(dialog().message).toContain("Text cannot contain &quot; &lt; &gt;");
  });

  it("reports after Apply only the failures the preview did not list", async () => {
    let runs = 0;
    vi.mocked(alertDialog).mockClear();
    const done = CsvUpload.update("Id,Name,Tags\n1,Z,t", COLUMNS, { find }, (_, row) => {
      runs++;
      row.apply("Name", () => {
        throw new Error("Bad name");
      });
      row.apply("Tags", () => {
        if (runs > 1) throw new Error("Changed meanwhile");
      });
    });
    expect(dialog().message).toContain("Values that will not be applied: 1");
    dialog().onConfirm!();
    await done;
    expect(lastAlert()).toContain("1 Tags: Changed meanwhile");
    expect(lastAlert()).not.toContain("Bad name");
  });

  it("splits a changed total by the current ratio and ignores rounding", async () => {
    const done = rename("Id,Total Population,Rural Population,Urban Population\n1,300,75,25\n2,10,10,0");
    dialog().onConfirm!();
    await done;
    const [rural, urban] = items()[0].people;
    expect(rural + urban).toBe(300);
    expect(items()[1].people).toEqual([10, 0]);
  });
});
