import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/components/tooltips", () => ({ tip: vi.fn() }));

beforeAll(() => {
  vi.stubGlobal(
    "FontFace",
    class {
      constructor(
        public family: string,
        public source: string
      ) {}
    }
  );
  Object.defineProperty(document, "fonts", { configurable: true, value: { add: vi.fn() } });
  document.createElement = vi.fn(() => ({ style: {} })) as unknown as typeof document.createElement;
  document.getElementById = vi.fn(() => ({
    addEventListener: vi.fn(),
    append: vi.fn()
  })) as unknown as typeof document.getElementById;
  vi.stubGlobal("style", {
    labels: { groups: { states: { "font-family": "Cinzel" } } }
  });
});

describe("getUsedFonts", () => {
  it("collects map fonts when the legacy provinces SVG group is absent", async () => {
    const { getUsedFonts } = await import("./fonts");
    const svg = {
      querySelector: vi.fn((selector: string) => (selector === "#legend" ? { getAttribute: () => "Georgia" } : null)),
      querySelectorAll: vi.fn(() => [{ getAttribute: () => "Arial" }])
    } as unknown as SVGSVGElement;

    expect(getUsedFonts(svg).map(font => font.family)).toEqual(["Arial", "Georgia", "Cinzel"]);
    expect(svg.querySelector).toHaveBeenCalledWith("#provs");
  });
});
