export interface RenderTimingSummary {
  count: number;
  latest: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
}

export type RenderDiagnosticsSnapshot = Readonly<Record<string, RenderTimingSummary>>;

export class RenderDiagnostics {
  private readonly samples = new Map<string, number[]>();

  constructor(private readonly maxSamplesPerMetric = 120) {
    if (!Number.isInteger(maxSamplesPerMetric) || maxSamplesPerMetric < 1) {
      throw new Error("Renderer diagnostic sample limit must be a positive integer");
    }
  }

  record(name: string, duration: number): void {
    if (!name || !Number.isFinite(duration) || duration < 0) return;
    const samples = this.samples.get(name) ?? [];
    samples.push(duration);
    if (samples.length > this.maxSamplesPerMetric) samples.splice(0, samples.length - this.maxSamplesPerMetric);
    this.samples.set(name, samples);
  }

  clear(): void {
    this.samples.clear();
  }

  getSnapshot(): RenderDiagnosticsSnapshot {
    return Object.fromEntries(
      [...this.samples.entries()].map(([name, samples]) => {
        const sorted = [...samples].sort((left, right) => left - right);
        const sum = samples.reduce((total, sample) => total + sample, 0);
        return [
          name,
          {
            count: samples.length,
            latest: samples.at(-1) ?? 0,
            max: sorted.at(-1) ?? 0,
            mean: sum / samples.length,
            p50: percentile(sorted, 0.5),
            p95: percentile(sorted, 0.95)
          }
        ];
      })
    );
  }
}

function percentile(sorted: readonly number[], quantile: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.ceil(quantile * sorted.length) - 1];
}
