// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { BurgIconPicker } from "./burg-icon-picker";

afterEach(() => document.body.replaceChildren());

test("Cinderwood illustrations retain accent colors while their main surfaces inherit group paint", () => {
  const source = new DOMParser().parseFromString(readFileSync("src/index.html", "utf8"), "text/html");
  const illustrations = ["capital", "city", "fort", "monastery", "caravanserai", "post"];
  for (const name of illustrations) {
    const symbol = source.getElementById(`icon-cinderwood-${name}`)!;
    const main = symbol.querySelector('[fill="inherit"]')!;
    expect(main, `${name} has an editable main surface`).not.toBeNull();
    for (let element: Element | null = main; element; element = element.parentElement) {
      expect([null, "inherit"], `${name} inherits fill`).toContain(element.getAttribute("fill"));
      expect([null, "inherit"], `${name} inherits stroke`).toContain(element.getAttribute("stroke"));
      if (element === symbol) break;
    }
    expect(symbol.querySelector('[fill^="#"]'), `${name} has pre-colored details`).not.toBeNull();
    expect(symbol.querySelector('[stroke^="#"]'), `${name} has independent detail outlines`).not.toBeNull();
  }
});

test("picker previews inherit paint when the selected group's colors change", () => {
  const picker = new BurgIconPicker();
  document.body.append(picker);
  picker.value = "#icon-cinderwood-capital";
  picker.style.fill = "#123456";
  picker.style.stroke = "#abcdef";
  for (const use of picker.querySelectorAll("use")) {
    expect(use.getAttribute("fill")).toBeNull();
    expect(use.getAttribute("stroke")).toBeNull();
  }
  picker.value = "#icon-cinderwood-city";
  expect(picker.querySelector("summary use")?.getAttribute("fill")).toBeNull();
  expect(picker.style.fill).toBe("rgb(18, 52, 86)");
  expect(picker.style.stroke).toBe("rgb(171, 205, 239)");
});

test("restoring a group's icon updates the preview without changing the map", () => {
  const picker = new BurgIconPicker();
  const change = vi.fn();
  picker.addEventListener("change", change);
  picker.value = "#icon-cinderwood-capital";
  document.body.append(picker);
  expect(picker.querySelector("summary use")?.getAttribute("href")).toBe(picker.value);
  expect(picker.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
  picker.value = "#icon-square";
  expect(picker.querySelector('[aria-pressed="true"]')?.getAttribute("data-icon")).toBe("#icon-square");
  expect(change).not.toHaveBeenCalled();
});

test("choosing a preview emits the select-compatible change event and closes the picker", () => {
  const picker = new BurgIconPicker();
  document.body.append(picker);
  const values: string[] = [];
  document.body.addEventListener("change", event => values.push((event.target as BurgIconPicker).value), {
    once: true
  });
  picker.querySelector("details")!.open = true;
  picker.querySelector<HTMLButtonElement>('[data-icon="#icon-watabou-city"]')!.click();
  expect(values).toEqual(["#icon-watabou-city"]);
  expect(picker.querySelector("details")!.open).toBe(false);
  expect(document.activeElement).toBe(picker.querySelector("summary"));
});

test("Escape closes the chooser without changing its selection", () => {
  const picker = new BurgIconPicker();
  document.body.append(picker);
  picker.querySelector("details")!.open = true;
  picker.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(picker.querySelector("details")!.open).toBe(false);
  expect(picker.value).toBe("#icon-circle");
});

test("port chooser offers the standard anchor and Cinderwood harbor with a selection preview", () => {
  const picker = new BurgIconPicker();
  picker.setAttribute("anchors", "");
  picker.value = "#icon-anchor";
  document.body.append(picker);
  expect(picker.querySelector("summary")?.getAttribute("aria-label")).toBe("Choose port icon");
  expect(picker.querySelectorAll("button")).toHaveLength(2);
  const change = vi.fn();
  picker.addEventListener("change", change);
  picker.querySelector<HTMLButtonElement>('[data-icon="#icon-harbor"]')!.click();
  expect(picker.value).toBe("#icon-harbor");
  expect(picker.querySelector("summary use")?.getAttribute("href")).toBe(picker.value);
  expect(change).toHaveBeenCalledOnce();
});
