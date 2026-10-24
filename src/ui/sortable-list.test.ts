// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { sortableList } from "./sortable-list";

const items = () => Array.from(document.querySelectorAll<HTMLElement>("#list > li")).map(li => li.id);
const pointer = (target: Element, type: string, clientY: number) =>
  target.dispatchEvent(new PointerEvent(type, { clientX: 5, clientY, pointerId: 1, button: 0, bubbles: true }));

beforeEach(() => {
  document.body.innerHTML = `<ul id="list"><li id="a"><i class="grip"></i></li><li id="b"><i class="grip"></i></li><li id="c" class="fixed"></li></ul>`;
  document.querySelectorAll("li").forEach((li, index) => {
    vi.spyOn(li, "getBoundingClientRect").mockReturnValue(new DOMRect(0, index * 20, 100, 20));
  });
});

it("moves the dragged item past the middle of another, reports it and swallows the closing click", () => {
  const onReorder = vi.fn();
  const list = document.getElementById("list")!;
  sortableList(list, { items: "li:not(.fixed)", handle: ".grip", onReorder });
  document.elementFromPoint = () => document.getElementById("b");

  const grip = document.querySelector("#a .grip")!;
  pointer(grip, "pointerdown", 10);
  pointer(list, "pointermove", 35);
  pointer(list, "pointerup", 35);

  expect(items()).toEqual(["b", "a", "c"]);
  expect(onReorder).toHaveBeenCalledExactlyOnceWith(document.getElementById("a"));
  const click = vi.fn();
  list.addEventListener("click", click);
  document.getElementById("a")!.click();
  expect(click).not.toHaveBeenCalled();
});

it("ignores presses outside the handle and items it does not sort", () => {
  const onReorder = vi.fn();
  const list = document.getElementById("list")!;
  sortableList(list, { items: "li:not(.fixed)", handle: ".grip", onReorder });
  document.elementFromPoint = () => document.getElementById("c");

  pointer(document.getElementById("a")!, "pointerdown", 10);
  pointer(list, "pointermove", 50);
  pointer(list, "pointerup", 50);
  pointer(document.querySelector("#b .grip")!, "pointerdown", 30);
  pointer(list, "pointermove", 50);
  pointer(list, "pointerup", 50);

  expect(items()).toEqual(["a", "b", "c"]);
  expect(onReorder).not.toHaveBeenCalled();
});

it("swallows the click after a drag that ends where it started, without reporting a reorder", () => {
  const onReorder = vi.fn();
  const list = document.getElementById("list")!;
  sortableList(list, { items: "li:not(.fixed)", handle: ".grip", onReorder });
  document.elementFromPoint = () => document.getElementById("a");

  const grip = document.querySelector("#a .grip")!;
  pointer(grip, "pointerdown", 10);
  pointer(list, "pointermove", 15);
  pointer(list, "pointerup", 15);

  expect(items()).toEqual(["a", "b", "c"]);
  expect(onReorder).not.toHaveBeenCalled();
  const click = vi.fn();
  list.addEventListener("click", click);
  document.getElementById("a")!.click();
  expect(click).not.toHaveBeenCalled();
});
