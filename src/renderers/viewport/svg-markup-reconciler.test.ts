import { describe, expect, it } from "vitest";
import { reconcileKeyedElements } from "./svg-markup-reconciler";

class FakeElement {
  parentNode: FakeGroup | null = null;

  constructor(readonly name: string) {}

  get nextElementSibling(): FakeElement | null {
    if (!this.parentNode) return null;
    const index = this.parentNode.children.indexOf(this);
    return this.parentNode.children[index + 1] || null;
  }

  remove(): void {
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    if (index !== -1) this.parentNode.children.splice(index, 1);
    this.parentNode = null;
  }

  replaceWith(element: FakeElement): void {
    if (!this.parentNode) return;
    const parent = this.parentNode;
    const index = parent.children.indexOf(this);
    parent.children[index] = element;
    element.parentNode = parent;
    this.parentNode = null;
  }
}

class FakeGroup {
  readonly children: FakeElement[] = [];

  get firstElementChild(): FakeElement | null {
    return this.children[0] || null;
  }

  insertBefore(element: FakeElement, cursor: FakeElement | null): FakeElement {
    element.remove();
    const index = cursor ? this.children.indexOf(cursor) : this.children.length;
    this.children.splice(index, 0, element);
    element.parentNode = this;
    return element;
  }
}

const item = (id: string, key = id) => ({ id, key });

describe("reconcileKeyedElements", () => {
  it("retains unchanged nodes while adding, removing and ordering items", () => {
    const group = new FakeGroup();
    const create = ({ id }: { id: string }) => new FakeElement(id);

    reconcileKeyedElements(group as unknown as Element, [item("a"), item("b")], create as never);
    const retained = group.children[1];
    reconcileKeyedElements(group as unknown as Element, [item("b"), item("c")], create as never);

    expect(group.children.map(({ name }) => name)).toEqual(["b", "c"]);
    expect(group.children[0]).toBe(retained);
  });

  it("replaces only elements whose render key changed", () => {
    const group = new FakeGroup();
    const create = ({ id, key }: { id: string; key: string }) => new FakeElement(`${id}:${key}`);

    reconcileKeyedElements(group as unknown as Element, [item("a", "1"), item("b", "1")], create as never);
    const retained = group.children[1];
    reconcileKeyedElements(group as unknown as Element, [item("a", "2"), item("b", "1")], create as never);

    expect(group.children.map(({ name }) => name)).toEqual(["a:2", "b:1"]);
    expect(group.children[1]).toBe(retained);
  });
});
