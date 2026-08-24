import { describe, expect, it } from "vitest";
import { RenderDiagnostics } from "./render-diagnostics";

describe("RenderDiagnostics", () => {
  it("reports bounded timing distributions", () => {
    const diagnostics = new RenderDiagnostics(4);
    for (const duration of [1, 2, 3, 4, 10]) diagnostics.record("camera", duration);

    expect(diagnostics.getSnapshot().camera).toEqual({
      count: 4,
      latest: 10,
      max: 10,
      mean: 4.75,
      p50: 3,
      p95: 10
    });
  });

  it("separates metrics and ignores invalid instrumentation", () => {
    const diagnostics = new RenderDiagnostics();
    diagnostics.record("build", 12);
    diagnostics.record("camera", 2);
    diagnostics.record("camera", Number.NaN);
    diagnostics.record("camera", -1);

    expect(diagnostics.getSnapshot()).toMatchObject({
      build: { count: 1, latest: 12 },
      camera: { count: 1, latest: 2 }
    });
    diagnostics.clear();
    expect(diagnostics.getSnapshot()).toEqual({});
  });

  it("rejects an unusable sample limit", () => {
    expect(() => new RenderDiagnostics(0)).toThrow("positive integer");
  });
});
