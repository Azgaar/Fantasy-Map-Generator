// Browser preferences: localStorage-backed UI state plus temporary legacy listeners.
// This is browser-local state, not a map service.

import { tip } from "@/components/tooltips";
import { findEl } from "@/utils";

export function stored(key: string): string | null {
  return localStorage.getItem(key) || null;
}

export function store(key: string, value: string): void {
  localStorage.setItem(key, value);
}

/** Pin the current value of an option so it survives map regeneration */
export function lock(optionId: string): void {
  const input = document.querySelector<HTMLInputElement>(`[data-stored="${optionId}"]`);
  if (input) store(optionId, input.value);

  const lockEl = findEl(`lock_${optionId}`);
  if (!lockEl) return;
  lockEl.dataset.locked = "1";
  lockEl.className = "icon-lock";
}

/** Allow an option to be randomized on new map generation again */
export function unlock(optionId: string): void {
  localStorage.removeItem(optionId);

  const lockEl = findEl(`lock_${optionId}`);
  if (!lockEl) return;
  lockEl.dataset.locked = "0";
  lockEl.className = "icon-lock-open";
}

function initialize(): void {
  for (const lockEl of Array.from(document.querySelectorAll<HTMLElement>("[data-locked]"))) {
    lockEl.addEventListener("mouseover", event => {
      event.stopPropagation();
      tip(
        lockEl.className === "icon-lock"
          ? "Click to unlock the option and allow it to be randomized on new map generation"
          : "Click to lock the option and always use the current value on new map generation"
      );
    });

    lockEl.addEventListener("click", () => {
      const ids = lockEl.dataset.ids ? lockEl.dataset.ids.split(",") : [lockEl.id.slice(5)];
      const toggle = lockEl.className === "icon-lock" ? unlock : lock;
      ids.forEach(toggle);
    });
  }
}

initialize();

window.lock = lock;
window.unlock = unlock;
window.stored = stored;
