// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { DistributionEditor } from "./goods-distribution-editor";

const message = vi.hoisted(() => vi.fn());
vi.mock("@/ui/dialog/dialog", () => ({ Dialog: { message } }));
vi.mock("@/ui/tooltips", () => ({ tip: vi.fn() }));

beforeEach(() => {
  message.mockClear();
  Object.assign(globalThis, {
    pack: { biomes: [{ i: 1, name: "Desert", color: "#fbe79f" }], cells: { i: [0, 1], biome: [1, 1], h: [20, 20] } }
  });
});

it("renders the builder before the dialog is attached to the document", () => {
  DistributionEditor.open(vi.fn());

  const popup: HTMLElement = message.mock.calls[0][0].message;
  expect(popup.querySelector("#distGroupList")!.children.length).toBeGreaterThan(0);
  expect(popup.querySelector<HTMLInputElement>("#distExprOutput")).not.toBeNull();
});
