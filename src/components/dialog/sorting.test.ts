// @ts-expect-error jsdom does not bundle TypeScript declarations
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applySortingByHeader, bindColumnSorting, sortData } from "./sorting";
import { dialogState } from "./state";

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
