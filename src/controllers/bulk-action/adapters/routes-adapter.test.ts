import { beforeEach, describe, expect, it } from "vitest";
import { createRoutesAdapter } from "./routes-adapter";

// Routes live in a plain array keyed by `.i`; removal filters the route out.
function makeWorld() {
  return {
    routes: [
      { i: 0, group: "roads" },
      { i: 1, group: "trails", lock: true }, // locked
      { i: 2, group: "searoutes" }
    ]
  };
}

describe("routesAdapter", () => {
  let adapter: ReturnType<typeof createRoutesAdapter>;

  beforeEach(() => {
    (globalThis as any).pack = makeWorld();
    adapter = createRoutesAdapter(() => {});
  });

  it("treats present routes as deletable and missing ones as not", () => {
    expect(adapter.isDeletable(0)).toBe(true);
    expect(adapter.isDeletable(2)).toBe(true);
    expect(adapter.isDeletable(99)).toBe(false); // missing
  });

  it("does not offer color or children", () => {
    expect(adapter.supportsColor).toBe(false);
    expect(adapter.childKind).toBeUndefined();
  });

  it("reads row ids from data-id", () => {
    const row = { dataset: { id: "2" } } as unknown as HTMLElement;
    expect(adapter.getRowId(row)).toBe(2);
  });

  it("reports and sets lock", () => {
    expect(adapter.isLocked(1)).toBe(true);
    expect(adapter.isLocked(0)).toBe(false);
    adapter.setLock?.(0, true);
    expect((globalThis as any).pack.routes.find((r: any) => r.i === 0).lock).toBe(true);
  });

  it("describeCascade counts deletable routes and reports locked rows as skipped", () => {
    const summary = adapter.describeCascade([0, 1, 2]); // 1 is locked
    expect(summary.deletable).toBe(2);
    expect(summary.skippedLocked).toBe(1);
    expect(summary.lines.join(" ").includes("2 routes")).toBe(true);
  });
});
