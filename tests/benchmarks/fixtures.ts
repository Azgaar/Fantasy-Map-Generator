export interface GeneratedRendererBenchmarkFixture {
  densityControl: 4 | 8 | 13;
  id: string;
  kind: "generated";
  requestedCells: 10_000 | 50_000 | 100_000;
  seed: string;
}

export interface LegacyRendererBenchmarkFixture {
  id: string;
  kind: "legacy";
  mapFile: string;
}

export type RendererBenchmarkFixture = GeneratedRendererBenchmarkFixture | LegacyRendererBenchmarkFixture;

export const RENDERER_BENCHMARK_FIXTURES: readonly RendererBenchmarkFixture[] = [
  {
    densityControl: 4,
    id: "generated-10k",
    kind: "generated",
    requestedCells: 10_000,
    seed: "pixi-benchmark-10k-v1"
  },
  {
    densityControl: 8,
    id: "generated-50k",
    kind: "generated",
    requestedCells: 50_000,
    seed: "pixi-benchmark-50k-v1"
  },
  {
    densityControl: 13,
    id: "generated-100k",
    kind: "generated",
    requestedCells: 100_000,
    seed: "pixi-benchmark-100k-v1"
  },
  { id: "legacy-1.139.4", kind: "legacy", mapFile: "tests/fixtures/1.139.4.map" }
];
