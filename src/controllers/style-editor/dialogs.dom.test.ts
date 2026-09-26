// Browser-mode tests (vitest.browser.config.ts): the registry-derived lookup
import { expect, test } from "vitest";
import { elementFor } from "./dialogs";

test("a legacy svg group id resolves to its layer's style element", () => {
  expect(elementFor("regions")).toBe("states");
  expect(elementFor("terrs")).toBe("heightmap");
  expect(elementFor("cults")).toBe("cultures");
  expect(elementFor("relig")).toBe("religions");
  expect(elementFor("provs")).toBe("provinces");
  expect(elementFor("armies")).toBe("military");
  expect(elementFor("terrain")).toBe("relief");
  expect(elementFor("ruler")).toBe("rulers");
  expect(elementFor("prec")).toBe("precipitation");
  expect(elementFor("gridOverlay")).toBe("grid");
  expect(elementFor("tradeAnimation")).toBe("trade");
});

test("a declared child resolves to the layer that owns it, and ids pass through", () => {
  expect(elementFor("goodsIcons")).toBe("goods");
  expect(elementFor("burgIcons")).toBe("burgIcons");
  expect(elementFor("statesHalo")).toBe("states");
  expect(elementFor("rivers")).toBe("rivers");
  expect(elementFor("map")).toBe("map");
  expect(elementFor("nonsense")).toBe("nonsense");
});
