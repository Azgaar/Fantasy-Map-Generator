// Console output by level. Switch a level off from the console: `FMG.log.enabled.time = false`

/** Diagnostics a user can turn on in the Advanced options. They may draw or record more, never change the map */
export const DEBUG_MODES = ["economy", "temperature", "cloud"] as const;
export type DebugMode = (typeof DEBUG_MODES)[number];

class Logger {
  readonly enabled = { time: true, info: true, warn: true, error: true };
  /** Diagnostics per feature, all off until `setDebug` turns some on */
  readonly debug: Partial<Record<DebugMode, boolean>> = {};

  /** Turns the listed diagnostics on and the rest off; `options.app.debug` keeps the list */
  setDebug(modes: readonly DebugMode[]): void {
    for (const mode of DEBUG_MODES) this.debug[mode] = modes.includes(mode);
  }

  time(label: string): void {
    if (this.enabled.time) console.time(label);
  }

  timeEnd(label: string): void {
    if (this.enabled.time) console.timeEnd(label);
  }

  info(...data: unknown[]): void {
    if (this.enabled.info) console.info(...data);
  }

  group(...data: unknown[]): void {
    if (this.enabled.info) console.group(...data);
  }

  groupEnd(): void {
    if (this.enabled.info) console.groupEnd();
  }

  warn(...data: unknown[]): void {
    if (this.enabled.warn) console.warn(...data);
  }

  error(...data: unknown[]): void {
    if (this.enabled.error) console.error(...data);
  }
}

export const log = new Logger();
