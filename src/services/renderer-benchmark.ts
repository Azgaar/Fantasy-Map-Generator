export type RendererBenchmarkBackend = "pixi" | "svg";
export type RendererBenchmarkPhase =
  | "camera-frame"
  | "first-paint"
  | "generation"
  | "gpu-upload"
  | "layer-change"
  | "scene-build";

export interface RendererBenchmarkObservation {
  duration: number;
  phase: RendererBenchmarkPhase;
  sequence: number;
}

export interface RendererBenchmarkSummary {
  count: number;
  max: number;
  mean: number;
  min: number;
  p50: number;
  p95: number;
}

export interface RendererBenchmarkFixtureDescriptor {
  id: string;
  legacyMap?: string;
  requestedCells?: number;
  seed?: string;
}

export interface RendererBenchmarkEnvironment {
  browser: string;
  deviceMemoryGb?: number;
  devicePixelRatio: number;
  hardwareConcurrency: number;
  renderer: string | null;
  userAgent: string;
  viewport: { height: number; width: number };
}

export interface RendererBenchmarkReport {
  backend: RendererBenchmarkBackend;
  canvas: { height: number; resolution: number; width: number } | null;
  domNodes: number;
  environment: RendererBenchmarkEnvironment;
  fixture: RendererBenchmarkFixtureDescriptor;
  generatedAt: string;
  jsHeapBytes: number | null;
  longTasks: readonly { duration: number; timestamp: number }[];
  observations: readonly RendererBenchmarkObservation[];
  resourceBytes: number;
  resourceCount: number;
  run: number;
  schemaVersion: 1;
  summaries: Readonly<Partial<Record<RendererBenchmarkPhase, RendererBenchmarkSummary>>>;
}

export interface RendererBenchmarkReportBundle {
  generatedAt: string;
  reports: readonly RendererBenchmarkReport[];
  schemaVersion: 1;
}

export function summarizeRendererBenchmark(
  observations: readonly RendererBenchmarkObservation[]
): RendererBenchmarkReport["summaries"] {
  const byPhase = new Map<RendererBenchmarkPhase, number[]>();
  for (const { duration, phase } of observations) {
    if (!Number.isFinite(duration) || duration < 0) continue;
    const samples = byPhase.get(phase) ?? [];
    samples.push(duration);
    byPhase.set(phase, samples);
  }

  return Object.fromEntries(
    [...byPhase.entries()].map(([phase, samples]) => {
      const sorted = [...samples].sort((left, right) => left - right);
      const total = samples.reduce((sum, sample) => sum + sample, 0);
      return [
        phase,
        {
          count: samples.length,
          max: sorted.at(-1) ?? 0,
          mean: total / samples.length,
          min: sorted[0] ?? 0,
          p50: percentile(sorted, 0.5),
          p95: percentile(sorted, 0.95)
        }
      ];
    })
  );
}

function percentile(sorted: readonly number[], quantile: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.ceil(sorted.length * quantile) - 1];
}
