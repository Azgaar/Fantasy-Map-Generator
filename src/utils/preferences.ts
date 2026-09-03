// The options the user pinned, and the value each was pinned at. Nothing else in this browser is
// kept here: every preference and every request lives in `options`, one object under one key.
// See docs/architecture/configuration.md
import { tip } from "@/components/tooltips";
import { findEl } from "@/utils";
import { safeParseJSON } from "@/utils/stringUtils";

export const LOCKS_KEY = "fmg-locks";

/**
 * A lock keeps a value across map generation, so it stores the value and not just the key: the
 * pinned value cannot live in an object that loading a map replaces.
 * See docs/architecture/configuration.md#locks
 */
type Locks = Record<string, unknown>;

export function readLocks(): Locks {
  const parsed = safeParseJSON(localStorage.getItem(LOCKS_KEY) ?? "");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Locks;
}

function writeLocks(locks: Locks): void {
  localStorage.setItem(LOCKS_KEY, JSON.stringify(locks));
}

/** Whether the option keeps its pinned value on new map generation */
export function isLocked(optionId: string): boolean {
  return Object.hasOwn(readLocks(), optionId);
}

/** The value the option was pinned at, or undefined when it is not pinned */
export function lockedValue<T>(optionId: string): T | undefined {
  return readLocks()[optionId] as T | undefined;
}

/**
 * What a lock stores when the caller does not pass a value: the pinnable registry resolves the
 * option's current value. Registered by components/pinnable.ts, which knows both objects
 */
let resolvePin: (optionId: string) => unknown = () => undefined;

export function setPinResolver(resolver: (optionId: string) => unknown): void {
  resolvePin = resolver;
}

/**
 * Pin a value so it survives map regeneration. An option the pinnable registry cannot answer for
 * has nowhere to put the value back, so pinning it would store `undefined`, drop out of the
 * serialized locks and leave a lock icon standing for nothing
 */
export function lock(optionId: string, value: unknown = resolvePin(optionId)): void {
  if (value === undefined) {
    ERROR && console.error(`lock: "${optionId}" is not a pinnable option`);
    return;
  }

  const locks = readLocks();
  locks[optionId] = value;
  writeLocks(locks);
  setLockIcon(optionId, true);
}

/** Allow an option to be randomized on new map generation again */
export function unlock(optionId: string): void {
  const locks = readLocks();
  delete locks[optionId];
  writeLocks(locks);
  setLockIcon(optionId, false);
}

/** Apply a pinned value if there is one, otherwise the value the caller rolled or defaulted to */
export function pinned<T>(optionId: string, fallback: T): T {
  const value = lockedValue<T>(optionId);
  return value === undefined ? fallback : value;
}

/** Paint every lock icon on the page with the state of the option it stands for */
export function syncLockIcons(): void {
  const locks = readLocks();
  for (const lockEl of Array.from(document.querySelectorAll<HTMLElement>("[data-locked]"))) {
    setIcon(
      lockEl,
      lockedIds(lockEl).some(id => Object.hasOwn(locks, id))
    );
  }
}

/** One icon can stand for several options, e.g. the temperature it pins at both poles */
const lockedIds = (lockEl: HTMLElement): string[] =>
  lockEl.dataset.ids ? lockEl.dataset.ids.split(",") : [lockEl.id.slice(5)]; // drop the "lock_" prefix

function setLockIcon(optionId: string, isLocked: boolean): void {
  const lockEl = findEl(`lock_${optionId}`);
  if (lockEl) setIcon(lockEl, isLocked);
}

function setIcon(lockEl: HTMLElement, isLocked: boolean): void {
  lockEl.dataset.locked = isLocked ? "1" : "0";
  lockEl.className = isLocked ? "icon-lock" : "icon-lock-open";
}

/**
 * Wire the lock icons of a panel: paint each with the state of its option and toggle it on click.
 * Called once the markup that holds them is on the page
 */
export function bindLockIcons(root: ParentNode = document): void {
  for (const lockEl of Array.from(root.querySelectorAll<HTMLElement>("[data-locked]"))) {
    lockEl.addEventListener("mouseover", event => {
      event.stopPropagation();
      tip(
        lockEl.className === "icon-lock"
          ? "Click to unlock the option and allow it to be randomized on new map generation"
          : "Click to lock the option and always use the current value on new map generation"
      );
    });

    lockEl.addEventListener("click", () => {
      const toggle = lockEl.className === "icon-lock" ? unlock : lock;
      lockedIds(lockEl).forEach(toggle);
    });
  }

  syncLockIcons();
}

window.lock = lock;
window.unlock = unlock;
