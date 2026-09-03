import { tip } from "@/components/tooltips";
import { findEl } from "@/utils";
import { safeParseJSON } from "@/utils/stringUtils";

/* The options the user pinned */
export const LOCKS_KEY = "fmg-locks";

export function stored(key: string): string | null {
  return localStorage.getItem(key) || null;
}

export function store(key: string, value: string): void {
  localStorage.setItem(key, value);
}

function readLocks(): Set<string> {
  const keys = safeParseJSON(localStorage.getItem(LOCKS_KEY) ?? "");
  return new Set<string>(Array.isArray(keys) ? keys : []);
}

function writeLocks(locks: Set<string>): void {
  localStorage.setItem(LOCKS_KEY, JSON.stringify(Array.from(locks)));
}

/** Whether the option keeps its current value on new map generation */
export function isLocked(optionId: string): boolean {
  return readLocks().has(optionId);
}

/** Pin the current value of an option so it survives map regeneration */
export function lock(optionId: string): void {
  const locks = readLocks();
  locks.add(optionId);
  writeLocks(locks);
  setLockIcon(optionId, true);
}

/** Allow an option to be randomized on new map generation again */
export function unlock(optionId: string): void {
  const locks = readLocks();
  locks.delete(optionId);
  writeLocks(locks);
  setLockIcon(optionId, false);
}

/** Paint every lock icon on the page with the state of the option it stands for */
export function syncLockIcons(): void {
  const locks = readLocks();
  for (const lockEl of Array.from(document.querySelectorAll<HTMLElement>("[data-locked]"))) {
    setIcon(
      lockEl,
      lockedIds(lockEl).some(id => locks.has(id))
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
window.stored = stored;
