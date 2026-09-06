// The values the user pinned so a new map does not re-roll them
import { tip } from "@/components/tooltips";
import { safeParseJSON } from "@/utils/stringUtils";

const STORAGE_KEY = "fmg-locks";
const LOCKED_TIP = "Click to lock the option and always use the current value on new map generation";
const UNLOCKED_TIP = "Click to unlock the option and allow it to be randomized on new map generation";

class PinStore {
  /** `?options=default` asks for the map a fresh browser would make, so every pin is ignored */
  get ignored(): boolean {
    return new URL(window.location.href).searchParams.get("options") === "default";
  }

  /** Every pin, straight from `localStorage`, which is untrusted like any other stored object */
  all(): Record<string, unknown> {
    const parsed = safeParseJSON(localStorage.getItem(STORAGE_KEY) ?? "");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  }

  has(key: string): boolean {
    return Object.hasOwn(this.all(), key);
  }

  /** Whether a new map re-rolls the value, rather than keeping what the user pinned */
  rolls(key: string): boolean {
    return this.ignored || !this.has(key);
  }

  /**
   * The value pinned, or the caller's own where nothing is pinned. The one way a pin is read.
   * `localStorage` is untrusted, so a pin of a different type than the value it stands for is a
   * corrupt store rather than a choice, and is ignored instead of written into the map
   */
  valueOr<T>(key: string, fallback: T): T {
    if (this.ignored) return fallback;

    const pinned = this.all()[key] as T | undefined;
    if (pinned === undefined) return fallback;
    if (typeof pinned !== typeof fallback || Array.isArray(pinned) !== Array.isArray(fallback)) {
      ERROR && console.error(`Pins: "${key}" is pinned to a ${typeof pinned}, ignored`);
      return fallback;
    }
    return pinned;
  }

  /** Pin a value the user set by hand, so the next map keeps it */
  set(key: string, value: unknown): void {
    if (value === undefined) return;
    const pins = this.all();
    pins[key] = value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
    this.paintIcons();
  }

  /** Let a new map roll the value again */
  clear(key: string): void {
    const pins = this.all();
    delete pins[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
    this.paintIcons();
  }

  /** Throw every pin away: a reset browser must not go on generating values nobody asked for */
  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.paintIcons();
  }

  /**
   * Wire the lock icons of a dialog and paint them: an icon's id names its setting after the
   * "lock_" prefix, or `data-ids` names several at once - the temperature icon pins both poles.
   * `pinnedValue` is how this dialog reads the value the icon stands for.
   */
  bindIcons(root: Element, pinnedValue: (key: string) => unknown): void {
    for (const icon of root.querySelectorAll<HTMLElement>("[data-locked]")) {
      const keys = icon.dataset.ids ? icon.dataset.ids.split(",") : [icon.id.slice(5)];

      icon.addEventListener("mouseover", event => {
        event.stopPropagation();
        tip(icon.className === "icon-lock" ? UNLOCKED_TIP : LOCKED_TIP);
      });

      icon.addEventListener("click", () => {
        const pinning = icon.className !== "icon-lock";
        for (const key of keys) {
          if (pinning) this.set(key, pinnedValue(key));
          else this.clear(key);
        }
      });
    }

    this.paintIcons();
  }

  /** Paint every lock icon on the page with the state of the setting it stands for */
  paintIcons(): void {
    const pins = this.all();
    for (const icon of document.querySelectorAll<HTMLElement>("[data-locked]")) {
      const keys = icon.dataset.ids ? icon.dataset.ids.split(",") : [icon.id.slice(5)];
      const locked = keys.some(key => Object.hasOwn(pins, key));
      icon.dataset.locked = locked ? "1" : "0";
      icon.className = locked ? "icon-lock" : "icon-lock-open";
    }
  }
}

export const Pins = new PinStore();
