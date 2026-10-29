// @ts-expect-error jsdom does not bundle TypeScript declarations
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applySortingByHeader, bindColumnSorting, sortData, sortDataByColumns } from "./sorting";
import { dialogState } from "./state";
import { type EditorColumn, renderEditorHeader } from "./table";

const rows = () => [
  { name: "Bree", pop: 300 },
  { name: "Anor", pop: 1000 },
  { name: "Cair", pop: 50 }
];

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => dialogState.clear());

describe("sortData", () => {
  it("sorts alphabetically ascending and descending", () => {
    const accessors = { name: (r: { name: string }) => r.name };
    expect(sortData(rows(), { sortBy: "name", alphabetically: true, direction: 1 }, accessors).map(r => r.name)) //
      .toEqual(["Anor", "Bree", "Cair"]);
    expect(sortData(rows(), { sortBy: "name", alphabetically: true, direction: -1 }, accessors).map(r => r.name)) //
      .toEqual(["Cair", "Bree", "Anor"]);
  });

  it("sorts numerically", () => {
    const accessors = { pop: (r: { pop: number }) => r.pop };
    expect(sortData(rows(), { sortBy: "pop", alphabetically: false, direction: 1 }, accessors).map(r => r.pop)) //
      .toEqual([50, 300, 1000]);
  });

  it("returns data untouched for an unknown sort key", () => {
    const data = rows();
    expect(sortData(data, { sortBy: "nope", alphabetically: true, direction: 1 }, {})).toBe(data);
  });
});

describe("sorting state", () => {
  it("restores column sorting when a controller header is rebuilt", () => {
    const dom = new JSDOM(`<div id="peopleHeader">
      <div class="sortable alphabetically" data-sortby="name"></div>
      <div class="sortable icon-sort-number-down" data-sortby="pop"></div>
    </div>`);
    vi.stubGlobal("document", dom.window.document);

    bindColumnSorting("people", () => {});
    dom.window.document.querySelector<HTMLElement>('[data-sortby="name"]')!.click();

    dom.window.document.body.innerHTML = `<div id="peopleHeader">
      <div class="sortable alphabetically" data-sortby="name"></div>
      <div class="sortable icon-sort-number-down" data-sortby="pop"></div>
    </div>`;
    bindColumnSorting("people", () => {});

    expect(dom.window.document.querySelector('[data-sortby="name"]')!.classList.contains("icon-sort-name-up")).toBe(
      true
    );
    expect(dom.window.document.querySelector('[data-sortby="pop"]')!.className.includes("icon-sort")).toBe(false);
  });

  it("reset returns the header to its default sorting", () => {
    const dom = new JSDOM(`<div id="peopleHeader">
      <div class="sortable alphabetically" data-sortby="name"></div>
      <div class="sortable icon-sort-number-down" data-sortby="pop"></div>
    </div>`);
    vi.stubGlobal("document", dom.window.document);

    const onSort = vi.fn();
    bindColumnSorting("people", onSort);
    dom.window.document.querySelector<HTMLElement>('[data-sortby="name"]')!.click();
    dialogState.reset("people");

    expect(onSort).toHaveBeenCalledTimes(2);
    expect(dom.window.document.querySelector('[data-sortby="name"]')!.className.includes("icon-sort")).toBe(false);
    expect(dom.window.document.querySelector('[data-sortby="pop"]')!.classList.contains("icon-sort-number-down")).toBe(
      true
    );
    expect(dialogState.get("people", "sorting", () => null)).toBeNull();
  });

  it("restores sorting for legacy DOM-sorted tables", () => {
    const dom = new JSDOM(`<div id="legacyHeader">
      <div class="sortable alphabetically" data-sortby="name"></div>
      <div class="sortable icon-sort-number-up" data-sortby="pop"></div>
    </div><div><div data-name="Bree" data-pop="300"></div><div data-name="Anor" data-pop="1000"></div></div>`);
    vi.stubGlobal("document", dom.window.document);

    applySortingByHeader("legacy", "legacyHeader");
    dom.window.document.querySelector<HTMLElement>('[data-sortby="name"]')!.click();

    dom.window.document.body.innerHTML = `<div id="legacyHeader">
      <div class="sortable alphabetically" data-sortby="name"></div>
      <div class="sortable icon-sort-number-up" data-sortby="pop"></div>
    </div><div id="legacyBody"><div data-name="Bree" data-pop="300"></div><div data-name="Anor" data-pop="1000"></div></div>`;
    applySortingByHeader("legacy", "legacyHeader");

    expect(dom.window.document.querySelector('[data-sortby="name"]')!.classList.contains("icon-sort-name-up")).toBe(
      true
    );
    expect(
      Array.from(dom.window.document.querySelectorAll("#legacyBody > div")).map(
        row => (row as HTMLElement).dataset.name
      )
    ).toEqual(["Anor", "Bree"]);
  });
});

describe("cascading column sorting", () => {
  const places = () => [
    { name: "Zed", province: "East", state: "A", population: 20 },
    { name: "Amy", province: "West", state: "B", population: 20 },
    { name: "Ben", province: "East", state: "B", population: 20 },
    { name: "Cal", province: "West", state: "A", population: 20 }
  ];
  const columns: EditorColumn<ReturnType<typeof places>[number]>[] = [
    { key: "name", sortType: "alpha", sortBy: row => row.name },
    { key: "province", sortType: "alpha", sortBy: row => row.province },
    { key: "state", sortType: "alpha", sortBy: row => row.state },
    { key: "population", defaultSort: "desc", sortBy: row => row.population }
  ];

  function table(dialogId = "places") {
    document.body.insertAdjacentHTML("beforeend", renderEditorHeader({ dialogId, columns }));
    let names: string[] = [];
    const update = () => {
      names = sortDataByColumns(dialogId, places(), columns).map(row => row.name);
    };
    bindColumnSorting(dialogId, update);
    update();
    return {
      names: () => names,
      click: (key: string) => document.querySelector<HTMLElement>(`#${dialogId}Header [data-sortby="${key}"]`)!.click()
    };
  }

  beforeEach(() => vi.stubGlobal("document", new JSDOM("").window.document));

  it("keeps burg names alphabetical within each province, in either province direction", () => {
    const view = table();
    view.click("name");
    view.click("province");
    expect(view.names()).toEqual(["Ben", "Zed", "Amy", "Cal"]);
    view.click("province");
    expect(view.names()).toEqual(["Amy", "Cal", "Ben", "Zed"]);
  });

  it("retains multiple earlier columns when fresh row objects are built", () => {
    const view = table();
    view.click("name");
    view.click("province");
    view.click("state");
    expect(view.names()).toEqual(["Zed", "Cal", "Ben", "Amy"]);
    expect(
      sortDataByColumns(
        "places",
        places().filter(row => row.state === "B"),
        columns
      ).map(row => row.name)
    ).toEqual(["Ben", "Amy"]);
  });

  it("drops earlier sort columns when the dialog layout is reset", () => {
    const view = table();
    view.click("name");
    view.click("province");
    dialogState.reset("places");
    expect(view.names()).toEqual(["Zed", "Amy", "Ben", "Cal"]);
    view.click("province");
    expect(view.names()).toEqual(["Zed", "Ben", "Amy", "Cal"]);
  });

  it("keeps sorting history separate for different tables", () => {
    const first = table();
    first.click("name");
    const second = table("other");
    second.click("province");
    expect(second.names()).toEqual(["Zed", "Ben", "Amy", "Cal"]);
    first.click("province");
    expect(first.names()).toEqual(["Ben", "Zed", "Amy", "Cal"]);
  });
});
