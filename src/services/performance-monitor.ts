export interface PerformanceSample {
  name: string;
  duration: number;
  timestamp: number;
}

interface LongTaskSample {
  duration: number;
  timestamp: number;
}

const MAX_SAMPLES = 200;

export class MapPerformanceMonitor {
  private samples: PerformanceSample[] = [];
  private longTasks: LongTaskSample[] = [];
  private measureSequence = 0;

  constructor() {
    if (!("PerformanceObserver" in window)) return;
    try {
      new PerformanceObserver(entries => {
        for (const entry of entries.getEntries()) {
          this.longTasks.push({ duration: entry.duration, timestamp: entry.startTime });
        }
        this.longTasks.splice(0, Math.max(0, this.longTasks.length - MAX_SAMPLES));
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // Long Task reporting is optional and unavailable in some browsers.
    }
  }

  measure<T>(name: string, action: () => T): T {
    const markName = `map-performance-${++this.measureSequence}`;
    const hasStartMark = this.mark(markName);
    const started = performance.now();
    const complete = () => {
      this.record(name, performance.now() - started);
      if (hasStartMark) this.measureFromMark(name, markName);
    };
    try {
      const result = action();
      if (result instanceof Promise) return result.finally(complete) as T;
      complete();
      return result;
    } catch (error) {
      complete();
      throw error;
    }
  }

  record(name: string, duration: number): void {
    this.samples.push({ name, duration, timestamp: performance.now() });
    this.samples.splice(0, Math.max(0, this.samples.length - MAX_SAMPLES));
  }

  private mark(markName: string): boolean {
    try {
      performance.mark(markName);
      return true;
    } catch {
      // The in-memory samples are still useful if the User Timing API is unavailable.
      return false;
    }
  }

  private measureFromMark(name: string, markName: string): void {
    try {
      performance.clearMeasures(name);
      // The start-mark overload is supported by browsers that don't accept
      // PerformanceMeasureOptions with only a duration field (notably Safari).
      performance.measure(name, markName);
    } catch {
      // Instrumentation must never interrupt map generation.
    } finally {
      try {
        performance.clearMarks(markName);
      } catch {
        // Best-effort cleanup for incomplete Performance API implementations.
      }
    }
  }

  reset(): void {
    this.samples = [];
    this.longTasks = [];
  }

  getSnapshot(): { samples: PerformanceSample[]; longTasks: LongTaskSample[]; domNodes: number } {
    return {
      samples: [...this.samples],
      longTasks: [...this.longTasks],
      domNodes: document.querySelectorAll("#map *").length
    };
  }
}

export const MapPerformance = new MapPerformanceMonitor();
window.MapPerformance = MapPerformance;
