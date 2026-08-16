import { describe, expect, it } from "vitest";
import { reconcileSvgUseElements, type SvgUseItem } from "./svg-use-reconciler";

class FakeUseElement {
  readonly tagName = "use";
  readonly attributes = new Map<string, string>();
  parentNode: FakeGroupElement | null = null;
  mutations = 0;

  get id(): string {
    return this.getAttribute("id") || "";
  }

  get nextElementSibling(): FakeUseElement | null {
    if (!this.parentNode) return null;
    const index = this.parentNode.children.indexOf(this);
    return this.parentNode.children[index + 1] || null;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    this.mutations++;
  }

  remove(): void {
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    if (index !== -1) this.parentNode.children.splice(index, 1);
    this.parentNode = null;
  }
}

class FakeGroupElement {
  readonly children: FakeUseElement[] = [];
  readonly ownerDocument = {
    createElementNS: () => new FakeUseElement()
  };

  get firstElementChild(): FakeUseElement | null {
    return this.children[0] || null;
  }

  appendChild(element: FakeUseElement): FakeUseElement {
    element.parentNode = this;
    this.children.push(element);
    return element;
  }

  insertBefore(element: FakeUseElement, cursor: FakeUseElement | null): FakeUseElement {
    element.remove();
    const index = cursor ? this.children.indexOf(cursor) : this.children.length;
    this.children.splice(index, 0, element);
    element.parentNode = this;
    return element;
  }
}

const burg = (id: number, x = id): SvgUseItem => ({
  id: `burg${id}`,
  dataId: id,
  href: "#icon-circle",
  x,
  y: id
});

describe("reconcileSvgUseElements", () => {
  it("preserves unchanged SVG nodes and only mutates changed attributes", () => {
    const group = new FakeGroupElement();
    reconcileSvgUseElements(group as unknown as SVGGElement, [burg(1)]);
    const element = group.children[0];
    const initialMutations = element.mutations;

    reconcileSvgUseElements(group as unknown as SVGGElement, [burg(1)]);
    expect(group.children[0]).toBe(element);
    expect(element.mutations).toBe(initialMutations);

    reconcileSvgUseElements(group as unknown as SVGGElement, [burg(1, 42)]);
    expect(group.children[0]).toBe(element);
    expect(element.getAttribute("x")).toBe("42");
    expect(element.mutations).toBe(initialMutations + 1);
  });

  it("adds and removes only nodes that enter or leave the viewport", () => {
    const group = new FakeGroupElement();
    reconcileSvgUseElements(group as unknown as SVGGElement, [burg(1), burg(2)]);
    const retained = group.children[1];

    reconcileSvgUseElements(group as unknown as SVGGElement, [burg(2), burg(3)]);

    expect(group.children.map(({ id }) => id)).toEqual(["burg2", "burg3"]);
    expect(group.children[0]).toBe(retained);
  });

  it("preserves requested drawing order without recreating retained nodes", () => {
    const group = new FakeGroupElement();
    reconcileSvgUseElements(group as unknown as SVGGElement, [burg(1), burg(2)]);
    const [first, second] = group.children;

    reconcileSvgUseElements(group as unknown as SVGGElement, [burg(2), burg(1)]);

    expect(group.children).toEqual([second, first]);
  });

  it("sets optional dimensions for relief-style use elements", () => {
    const group = new FakeGroupElement();
    reconcileSvgUseElements(group as unknown as SVGGElement, [{ ...burg(1), width: 12, height: 14 }]);

    expect(group.children[0].getAttribute("width")).toBe("12");
    expect(group.children[0].getAttribute("height")).toBe("14");
  });
});
