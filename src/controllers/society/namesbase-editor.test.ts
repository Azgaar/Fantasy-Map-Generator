// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/controllers", () => ({
  Controllers: { NamesbaseEditor: { open: vi.fn() }, NamesbasesOverview: { open: vi.fn(), refresh: vi.fn() } }
}));

import { Controllers } from "@/controllers";
import { Names } from "@/model/society/names/names-generator";
import { DIALOGS_MARKUP, dialogButton } from "@/ui/dialog/dialog-testing";
import { NamesbaseEditor } from "./namesbase-editor";
import { NamesbasesOverview } from "./namesbases-overview";

const find = <T extends HTMLElement = HTMLInputElement>(selector: string) => document.querySelector<T>(selector)!;

function change(selector: string, value: string): void {
  const input = find(selector);
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

const openTab = (tab: string) => find(`[data-tab="${tab}"]`).click();
const english = () => Names.find("english")!;

beforeEach(async () => {
  document.body.innerHTML = DIALOGS_MARKUP;
  options.app.mode = null;
  vi.stubGlobal("pack", { cultures: [{ i: 0, name: "Wildlands", base: "english" }] });
  options.map.nameBases = [];
});

describe("NamesbaseEditor", () => {
  beforeEach(async () => {
    await NamesbaseEditor.open(Names.nameBases.findIndex(({ id }) => id === "english"));
    openTab("names");
    find("#namesbaseEditAnyway").click();
    dialogButton("Edit anyway").click();
  });

  it("keeps a built-in base from being changed until the user insists", async () => {
    const isOpen = () => !find(`[data-list="male"] textarea`).readOnly && !find("#namesbaseName").readOnly;
    expect([isOpen(), find("#namesbaseLock").hidden]).toEqual([true, true]);
    expect(options.map.nameBases).toEqual([]); // nothing is stored before a change

    await NamesbaseEditor.open(Names.ids().indexOf("english"));
    expect([isOpen(), find("#namesbaseLock").hidden]).toEqual([false, false]);
    expect(find<HTMLSelectElement>("#namesbaseExtends").disabled).toBe(true);
    for (const tab of ["names", "lexicon", "patterns", "rules"]) {
      openTab(tab);
      const fields = document.querySelectorAll<HTMLInputElement>("#namesbasePane [data-field]");
      for (const field of fields) expect(field.readOnly || field.disabled, field.outerHTML).toBe(true);
    }

    find("#namesbaseEditCopy").click();
    openTab("names");
    expect([isOpen(), find("#namesbaseLock").hidden]).toEqual([true, true]);
    expect(find("#namesbaseName").value).toBe("English copy");
    expect(options.map.nameBases.map(({ id }) => id)).toEqual(["english-copy"]);
  });

  it("shows the base, its lists, cultures and samples", () => {
    expect(find("#namesbaseName").value).toBe("English");
    expect(find("#namesbaseCultures").textContent).toContain("Wildlands");
    expect(find('[data-list="places"] textarea').value.split(", ")).toEqual(english().places.names);
    expect(document.querySelectorAll("#namesbaseSamples .named").length).toBeGreaterThan(5);
    expect(find<HTMLButtonElement>("#namesbaseReset").disabled).toBe(true);
  });

  it("edits a list and drops an emptied one, but never the places", () => {
    change('[data-list="places"] textarea', "");
    expect(Names.isShipped(english())).toBe(true); // nothing is changed in the end
    change('[data-list="male"] textarea', "Adam, Bertram\nCuthbert, ");
    expect(english().people!.male!.names).toEqual(["Adam", "Bertram", "Cuthbert"]);
    change('[data-list="male"] textarea', "");
    expect(english().people!.male).toBeUndefined();
    const places = english().places.names;
    change('[data-list="places"] textarea', "");
    expect(english().places.names).toBe(places);
  });

  it("sets a list's mode", () => {
    change('[data-list="places"] [data-field="mode"]', "pick");
    expect(english().places.mode).toBe("pick");
    const burgs = Array.from(document.querySelectorAll("#namesbaseSamples .named > span"), el => el.textContent!);
    expect(english().places.names).toEqual(expect.arrayContaining(burgs.slice(0, 9)));
  });

  it("keeps a list's length only where it is not the default", () => {
    change('[data-list="male"] [data-field="max"]', "12");
    expect(english().people!.male!.length).toEqual([4, 12]);
    change('[data-list="male"] [data-field="max"]', "8");
    expect(english().people!.male!.length).toBeUndefined();
  });

  it("writes a concept, shows it on its example and restores the shipped base", async () => {
    openTab("lexicon");
    change('label[data-concept="town"] input', "+xyz 5, a+b+");
    expect(english().lexicon!.town).toEqual([{ form: "xyz", weight: 5, position: "last" }]);
    expect(find('label[data-concept="town"] input').value).toBe("+xyz 5");
    expect(find('label[data-concept="town"] [data-example]').textContent).toMatch(/xyz$/);

    find("#namesbaseReset").click();
    dialogButton("Restore").click();
    await vi.waitFor(() => expect(Names.isChanged(english())).toBe(false));
  });

  it("filters concepts by text", () => {
    openTab("lexicon");
    find("#namesbaseSearch").value = "birch";
    find("#namesbaseSearch").dispatchEvent(new Event("input", { bubbles: true }));
    const visible = document.querySelectorAll<HTMLElement>("#namesbaseConcepts > label:not([hidden])");
    expect(Array.from(visible, ({ dataset }) => dataset.concept)).toEqual(["birch"]);
  });

  it("sets a pattern and leaves nothing behind when it is cleared", () => {
    openTab("patterns");
    const { relative } = structuredClone(english().patterns!);
    change('[data-field="weight"][data-pattern="relative"]', "77");
    expect(english().patterns!.relative).toEqual({ ...relative, weight: 77 });
    change('[data-field="weight"][data-pattern="relative"]', "");
    change('[data-field="templates"][data-pattern="relative"]', "");
    expect(english().patterns!.relative).toBeUndefined();
  });

  it("refuses a minimal length over the maximal", () => {
    openTab("patterns");
    const { length } = english();
    change('#namesbasePane [data-field="min"]', "90");
    expect(english().length).toEqual(length);
    expect(find('#namesbasePane [data-field="min"]').value).toBe(String(length[0]));
  });
});

describe("NamesbasesOverview", () => {
  const row = (id: string) => find(`#namesbasesBody [data-id="${Names.nameBases.findIndex(base => base.id === id)}"]`);

  beforeEach(() => NamesbasesOverview.open());

  it("lists the bases with the cultures that use them and opens one", () => {
    expect(document.querySelectorAll("#namesbasesBody .states")).toHaveLength(Names.nameBases.length);
    expect(row("english").querySelector('[data-col="cultures"]')?.textContent).toBe("Wildlands");
    row("orc").querySelector<HTMLElement>(".icon-pencil")!.click();
    expect(Controllers.NamesbaseEditor.open).toHaveBeenCalledWith(Names.nameBases.findIndex(({ id }) => id === "orc"));
  });

  it("tells an edited and a custom base", async () => {
    await Names.load(["orc"]);
    Names.edit("orc");
    Names.copy(Names.find("orc")!, "Uruk");
    NamesbasesOverview.refresh();
    const status = (id: string) => row(id).querySelector('[data-col="status"]')?.textContent;
    expect(["english", "orc", "uruk"].map(status)).toEqual(["Built-in", "Edited", "Custom"]);
  });

  it("removes a custom base no culture uses and no base extends", async () => {
    const bin = (id: string) => row(id).querySelector<HTMLElement>(".icon-trash-empty");
    expect(bin("orc")).toBeNull(); // built in
    await Names.load(["orc"]);
    const uruk = Names.copy(Names.find("orc")!, "Uruk");
    const heir = Names.copy(uruk, "Heir");
    heir.extends = uruk.id;
    pack.cultures[0].base = uruk.id;
    NamesbasesOverview.refresh();
    bin("uruk")!.click(); // used by a culture
    pack.cultures[0].base = "english";
    NamesbasesOverview.refresh();
    bin("uruk")!.click(); // extended by another
    await Names.loadAll();
    expect(document.querySelector(".dialog-buttonset")).toBeNull();

    heir.extends = "orc";
    bin("uruk")!.click();
    await vi.waitFor(() => dialogButton("Remove").click());
    expect(Names.has("uruk")).toBe(false);
    expect(row("uruk")).toBeNull();
  });
});
