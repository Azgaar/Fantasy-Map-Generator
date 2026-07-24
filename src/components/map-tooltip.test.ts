import { expect, test, vi } from "vitest";

vi.mock("@/utils", async importOriginal => ({
  ...(await importOriginal<typeof import("@/utils")>()),
  getPointer: () => [0, 0]
}));

import { onMouseMove } from "./map-tooltip";

test("ignores hover events while pack cells are being rebuilt", () => {
  globalThis.pack = {} as typeof pack;

  expect(() => onMouseMove({ currentTarget: {} } as MouseEvent)).not.toThrow();
});
