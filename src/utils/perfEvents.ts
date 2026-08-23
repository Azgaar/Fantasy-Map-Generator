export interface PerfStageEventDetail {
  stage: string;
  ms: number;
}

const starts = new Map<string, number>();

export function timeStart(label: string): void {
  starts.set(label, performance.now());
  console.time(label);
}

export function timeEnd(label: string): void {
  console.timeEnd(label);
  const start = starts.get(label);
  if (start === undefined) return;
  starts.delete(label);

  window.dispatchEvent(
    new CustomEvent<PerfStageEventDetail>("perf:stage", { detail: { stage: label, ms: performance.now() - start } })
  );
}

declare global {
  interface Window {
    timeStart: typeof timeStart;
    timeEnd: typeof timeEnd;
  }
}
