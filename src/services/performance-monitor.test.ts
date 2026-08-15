import { afterEach, describe, expect, it, vi } from "vitest";
import { MapPerformanceMonitor } from "./performance-monitor";

describe("MapPerformanceMonitor", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses a start mark instead of an incomplete PerformanceMeasureOptions object", () => {
    const measure = vi.spyOn(performance, "measure");
    const monitor = new MapPerformanceMonitor();

    monitor.measure("generation:grid", () => undefined);

    expect(measure).toHaveBeenCalledWith("generation:grid", expect.stringMatching(/^map-performance-/));
  });
});
