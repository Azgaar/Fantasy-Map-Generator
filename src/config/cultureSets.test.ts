import {vi, describe, it, expect} from "vitest";

vi.stubGlobal("Names", {
  getBase: () => 0,
  getBaseShort: () => "TestName"
});

vi.stubGlobal("COA", {
  getRandomShield: () => "TestShield"
});

import {cultureSets, DEFAULT_SORT_STRING} from "./cultureSets";

const supportedMethods = ["score", "temp", "biome", "oceanCoast", "coastDist", "height", "suitability"];
const sortingMethodsMock = Object.fromEntries(supportedMethods.map(method => [method, () => 0]));
const cellIdsMock = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

describe("cultureSets", () => {
  it("have executable sort function strings", () => {
    const culturesNumber = 1;
    Object.values(cultureSets).map(getCultureSet => {
      const culturesData = getCultureSet(culturesNumber);

      culturesData.forEach(cultureData => {
        const sortingString = cultureData.sort || DEFAULT_SORT_STRING;
        const allSortingMethods = `{${Object.keys(sortingMethodsMock).join(", ")}}`;
        const sortFn = new Function(allSortingMethods, "return " + sortingString);

        const comparator = () => {
          const cellA = sortFn(sortingMethodsMock);
          const cellB = sortFn(sortingMethodsMock);
          return cellB - cellA;
        };

        const sorted = Array.from(cellIdsMock).sort(comparator);
        expect(sorted).toEqual(cellIdsMock);
      });
    });
  });
});
