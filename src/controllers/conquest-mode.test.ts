import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLayersState = {
  active: ["states", "borders", "burgIcons"],
  order: ["states", "borders", "burgIcons"]
};

const mockLayers = {
  state: mockLayersState,
  all: [{ id: "states" }],
  isOn: vi.fn((id: string) => mockLayersState.active.includes(id)),
  show: vi.fn((id: string) => {
    if (!mockLayersState.active.includes(id)) mockLayersState.active.push(id);
  }),
  hide: vi.fn((id: string) => {
    const idx = mockLayersState.active.indexOf(id);
    if (idx >= 0) mockLayersState.active.splice(idx, 1);
  }),
  set: vi.fn((ids: string[]) => {
    mockLayersState.active = [...ids];
  }),
  restore: vi.fn((state: { active: string[]; order?: string[] }) => {
    mockLayersState.active = [...state.active];
    if (state.order) mockLayersState.order = [...state.order];
  }),
  drawAll: vi.fn()
};

vi.mock("@/components/layers", () => ({ Layers: mockLayers }));
vi.mock("@/components/options/view-mode", () => ({
  is3dView: vi.fn(() => false),
  isAstralView: vi.fn(() => false)
}));
vi.mock("@/conquest/ui/presets", () => ({
  applyPreset: vi.fn((presetId: string) => {
    if (presetId === "campaign") {
      mockLayersState.active = ["states", "borders", "military", "burgIcons", "labels", "scaleBar", "vignette"];
    }
    return true;
  })
}));

type MockEl = {
  id: string;
  hidden: boolean;
  style: Record<string, string>;
  classList: {
    add: (c: string) => void;
    remove: (c: string) => void;
    contains: (c: string) => boolean;
  };
  hasAttribute: (attr: string) => boolean;
  setAttribute: (attr: string, val: string) => void;
  removeAttribute: (attr: string) => void;
  querySelectorAll?: (selector: string) => MockEl[];
  getBoundingClientRect?: () => {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  };
};

function createMockEl(id: string, initialClasses: string[] = []): MockEl {
  const classes = new Set(initialClasses);
  const attributes = new Map<string, string>();
  const el: MockEl = {
    id,
    hidden: false,
    style: {},
    classList: {
      add: (c: string) => void classes.add(c),
      remove: (c: string) => void classes.delete(c),
      contains: (c: string) => classes.has(c)
    },
    hasAttribute: (attr: string) => (attr === "hidden" ? el.hidden : attributes.has(attr)),
    setAttribute: (attr: string, val: string) => {
      if (attr === "hidden") el.hidden = true;
      attributes.set(attr, val);
    },
    removeAttribute: (attr: string) => {
      if (attr === "hidden") el.hidden = false;
      attributes.delete(attr);
    },
    getBoundingClientRect: () => ({ top: 0, bottom: 20, left: 0, right: 20, width: 20, height: 20 })
  };
  return el;
}

let mockElements: Record<string, MockEl> = {};

vi.spyOn(document, "getElementById").mockImplementation((id: string) => {
  return (mockElements[id] ?? null) as unknown as HTMLElement;
});

import { ConquestMode, isConquestEnabled, subscribeConquestView } from "./conquest-mode";

describe("ConquestMode controller", () => {
  beforeEach(() => {
    const viewStandard = createMockEl("viewStandard", ["pressed"]);
    const viewConquest = createMockEl("viewConquest");
    const viewMode = createMockEl("viewMode");
    viewMode.querySelectorAll = () => [viewStandard, viewConquest];

    const rail = createMockEl("tw-rail");
    rail.style.display = "none";
    rail.hidden = true;

    const fallback = createMockEl("totalWarFallback");
    fallback.hidden = true;

    mockElements = {
      viewMode,
      viewStandard,
      viewConquest,
      "tw-rail": rail,
      totalWarFallback: fallback
    };

    mockLayersState.active = ["states", "borders", "burgIcons"];
    if (isConquestEnabled()) {
      void ConquestMode.exit();
    }
  });

  it("starts in disabled state", () => {
    expect(isConquestEnabled()).toBe(false);
    expect(mockElements["tw-rail"].style.display).toBe("none");
    expect(mockElements.totalWarFallback.hidden).toBe(true);
  });

  it("enters conquest mode: unhides rail and fallback, marks button pressed", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeConquestView(listener);

    await ConquestMode.enter();

    expect(isConquestEnabled()).toBe(true);
    expect(listener).toHaveBeenCalledWith(true);

    const rail = mockElements["tw-rail"];
    expect(rail.style.display).toBe("flex");
    expect(rail.hidden).toBe(false);

    const fallback = mockElements.totalWarFallback;
    expect(fallback.hidden).toBe(false);

    const conquestBtn = mockElements.viewConquest;
    const standardBtn = mockElements.viewStandard;
    expect(conquestBtn.classList.contains("pressed")).toBe(true);
    expect(standardBtn.classList.contains("pressed")).toBe(false);

    unsubscribe();
  });

  it("exits conquest mode: hides rail and fallback, restores previous layers", async () => {
    await ConquestMode.enter();
    expect(isConquestEnabled()).toBe(true);

    await ConquestMode.exit();
    expect(isConquestEnabled()).toBe(false);

    const rail = mockElements["tw-rail"];
    expect(rail.style.display).toBe("none");
    expect(rail.hidden).toBe(true);

    const fallback = mockElements.totalWarFallback;
    expect(fallback.hidden).toBe(true);

    const conquestBtn = mockElements.viewConquest;
    const standardBtn = mockElements.viewStandard;
    expect(conquestBtn.classList.contains("pressed")).toBe(false);
    expect(standardBtn.classList.contains("pressed")).toBe(true);

    expect(mockLayers.restore).toHaveBeenCalledWith(
      expect.objectContaining({ active: ["states", "borders", "burgIcons"] })
    );
  });

  it("toggles between enabled and disabled state", async () => {
    expect(isConquestEnabled()).toBe(false);

    await ConquestMode.toggle();
    expect(isConquestEnabled()).toBe(true);

    await ConquestMode.toggle();
    expect(isConquestEnabled()).toBe(false);
  });
});
