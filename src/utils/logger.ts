// Console output by level. Switch a level off from the console: `FMG.log.enabled.time = false`
import { safeParseJSON } from "./string-utils";

type DebugFlags = { [feature: string]: boolean | undefined };

class Logger {
  readonly enabled = { time: true, info: true, warn: true, error: true };
  /** Diagnostics per feature, off unless set in localStorage `debug`, e.g. `{"production":true}` */
  readonly debug: DebugFlags = safeParseJSON(globalThis.localStorage?.getItem("debug") ?? "") || {};

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
