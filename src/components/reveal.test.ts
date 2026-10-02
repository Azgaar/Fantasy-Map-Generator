// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";

const zoomTo = vi.hoisted(() => vi.fn());
vi.mock("@/components/zoom", () => ({ zoomTo }));
vi.mock("@/components/viewport", () => ({ viewport: { width: 1000, height: 600, scale: 1 } }));
vi.mock("@/components/layers", () => ({ Layers: { show: vi.fn() } }));
vi.mock("@/renderers/overlays/highlight", () => ({ highlightArea: vi.fn(), highlightElement: vi.fn() }));
vi.mock("@/components/map-entities", () => ({ MapEntities: {} }));

import { reveal } from "./reveal";

const show = (cover?: DOMRect) => reveal([[100, 100]], { layers: [], maxScale: 4, element: () => null, cover });

beforeEach(() => zoomTo.mockReset());

it("centres on the point when nothing covers the map", () => {
  show();
  expect(zoomTo).toHaveBeenCalledWith(100, 100, 4, 1500);
});

it("centres in the part of the map a panel on the right leaves visible", () => {
  show(new DOMRect(600, 0, 400, 600)); // visible columns 0–600, centred at 300: 200 px left of the middle
  expect(zoomTo).toHaveBeenCalledWith(150, 100, 4, 1500); // 100 + 200 px / scale 4
});

it("ignores a panel that leaves too little of the map", () => {
  show(new DOMRect(100, 0, 850, 600));
  expect(zoomTo).toHaveBeenCalledWith(100, 100, 4, 1500);
});
