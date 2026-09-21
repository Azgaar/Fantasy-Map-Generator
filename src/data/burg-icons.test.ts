// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { BURG_ICONS, burgIcon, PORT_ICONS } from "./burg-icons";

const source = (id: string) =>
  new DOMParser().parseFromString(
    readFileSync(`src/assets/icons/burgs/${id.replace("#icon-", "")}.svg`, "utf8"),
    "image/svg+xml"
  ).documentElement;

test("every listed icon has a standalone SVG", () => {
  for (const { id } of [...BURG_ICONS, ...PORT_ICONS]) expect(source(id).tagName, id).toBe("svg");
});

test("Illustrated icons retain accent colors while their main surfaces inherit group paint", () => {
  for (const { id, name } of BURG_ICONS.filter(icon => icon.group === "Illustrated")) {
    const symbol = source(id);
    const shapes = Array.from(symbol.querySelectorAll("path, circle, rect, polygon"));
    const main = shapes.find(shape => !shape.hasAttribute("fill") && !shape.hasAttribute("stroke"));
    expect(main, `${name} has an editable main surface`).toBeDefined();
    for (let element: Element | null = main!; element; element = element.parentElement) {
      expect(element.hasAttribute("fill"), `${name} inherits fill`).toBe(false);
      expect(element.hasAttribute("stroke"), `${name} inherits stroke`).toBe(false);
      if (element === symbol) break;
    }
    expect(symbol.querySelector('[fill^="#"]'), `${name} has pre-colored details`).not.toBeNull();
  }
});

test("an unknown id still resolves to a drawable entry", () => {
  expect(burgIcon("#icon-watabou-city")).toMatchObject({ name: "city", group: "Watabou" });
  expect(burgIcon("#icon-mine")).toMatchObject({ id: "#icon-mine", name: "custom icon" });
});
