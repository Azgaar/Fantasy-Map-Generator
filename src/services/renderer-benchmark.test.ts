import { describe, expect, it } from "vitest";
import { type RendererBenchmarkObservation, summarizeRendererBenchmark } from "./renderer-benchmark";

describe("renderer benchmark report", () => {
  it("summarizes each required phase independently", () => {
    const observations: RendererBenchmarkObservation[] = [
      ...[1, 2, 3, 4, 20].map((duration, sequence) => ({ duration, phase: "camera-frame" as const, sequence })),
      { duration: 40, phase: "generation", sequence: 0 }
    ];

    expect(summarizeRendererBenchmark(observations)).toEqual({
      "camera-frame": { count: 5, max: 20, mean: 6, min: 1, p50: 3, p95: 20 },
      generation: { count: 1, max: 40, mean: 40, min: 40, p50: 40, p95: 40 }
    });
  });

  it("drops invalid instrumentation samples", () => {
    expect(
      summarizeRendererBenchmark([
        { duration: Number.NaN, phase: "gpu-upload", sequence: 0 },
        { duration: -1, phase: "gpu-upload", sequence: 1 }
      ])
    ).toEqual({});
  });
});
