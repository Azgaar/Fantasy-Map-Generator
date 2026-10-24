// The values the user pinned so a new map does not re-roll them

import { pinSchemas } from "@/model/options/options-schema";
import { safeParseJSON } from "@/utils/string-utils";

const STORAGE_KEY = "fmg-locks";

class PinStore {
  private readonly listeners = new Set<() => void>();
  /** `?options=default` asks for the map a fresh browser would make, so every pin is ignored */
  get ignored(): boolean {
    return new URL(window.location.href).searchParams.get("options") === "default";
  }

  /** Every pin, straight from `localStorage`, which is untrusted like any other stored object */
  all(): Record<string, unknown> {
    const parsed = safeParseJSON(localStorage.getItem(STORAGE_KEY) ?? "");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const pins: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Object.hasOwn(pinSchemas, key)) continue;
      const result = pinSchemas[key].safeParse(value);
      if (result.success) pins[key] = result.data;
    }
    return pins;
  }

  has(key: string): boolean {
    return Object.hasOwn(this.all(), key);
  }

  /** Whether a new map re-rolls the value, rather than keeping what the user pinned */
  rolls(key: string): boolean {
    return this.ignored || !this.has(key);
  }

  /** The value pinned, or the caller's own where nothing is pinned */
  valueOr<T>(key: string, fallback: T): T {
    if (this.ignored) return fallback;

    const pinned = this.all()[key] as T | undefined;
    return pinned === undefined ? fallback : pinned;
  }

  /** Pin a value the user set by hand, so the next map keeps it */
  set(key: string, value: unknown): void {
    if (!Object.hasOwn(pinSchemas, key)) return;
    const parsed = pinSchemas[key].safeParse(value);
    if (!parsed.success) return;
    const pins = this.all();
    pins[key] = parsed.data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
    this.changed();
  }

  /** Let a new map roll the value again */
  clear(key: string): void {
    const pins = this.all();
    delete pins[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
    this.changed();
  }

  /** Throw every pin away: a reset browser must not go on generating values nobody asked for */
  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.changed();
  }

  /** Call `listener` after every change, for the lock icons to repaint */
  subscribe(listener: () => void): void {
    this.listeners.add(listener);
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
  }
}

export const Pins = new PinStore();
