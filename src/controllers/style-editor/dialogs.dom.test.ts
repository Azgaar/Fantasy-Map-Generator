// Browser-mode tests (vitest.browser.config.ts): the icon picker's choices and the registry-derived lookup
import { afterEach, expect, test } from "vitest";
import "@/generators/relief-generator"; // the models own the set definitions the picker lists
import "@/generators/burgs-generator";
import "@/generators/goods-generator";
import { elementFor, paintBurgIconDialog, renderChoices } from "./dialogs";

afterEach(() => document.body.replaceChildren());

const render = (set: "burgs" | "ports", selected: string) => {
  const content = document.createElement("div");
  content.innerHTML = renderChoices(set, selected);
  return content;
};

test("the burg set is listed by directory with the current icon pressed", () => {
  const content = render("burgs", "#burgs-watabou-city");
  expect([...content.querySelectorAll("h4")].map(h => h.textContent)).toEqual(["Atlas", "Illustrated", "Watabou"]);
  expect(content.querySelectorAll("button[data-icon]").length).toBeGreaterThan(20);
  const pressed = content.querySelectorAll("button.pressed");
  expect(pressed).toHaveLength(1);
  expect(pressed[0].getAttribute("data-icon")).toBe("#burgs-watabou-city");
  expect(pressed[0].getAttribute("title")).toBe("city");
});

test("the port set offers the anchor and the harbor without a heading", () => {
  const content = render("ports", "#ports-anchor");
  expect(content.querySelector("h4")).toBeNull();
  expect([...content.querySelectorAll<HTMLElement>("button[data-icon]")].map(b => b.dataset.icon)).toEqual([
    "#ports-anchor",
    "#ports-harbor"
  ]);
});

test("the previews inherit the paint set on the dialog, never their own", () => {
  const dialog = document.createElement("div");
  dialog.append(render("burgs", "#burgs-atlas-circle"));
  document.body.append(dialog);
  paintBurgIconDialog("#123456", "#abcdef", dialog);
  for (const use of dialog.querySelectorAll("use")) {
    expect(use.getAttribute("fill")).toBeNull();
    expect(use.getAttribute("stroke")).toBeNull();
    expect(getComputedStyle(use).fill).toBe("rgb(18, 52, 86)");
  }
});

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
