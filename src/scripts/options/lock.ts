import {store} from "../../utils/shorthands";
import {tip} from "../tooltips";

export function assignLockBehavior() {
  const $lockable = document.querySelectorAll("[data-locked]");
  $lockable.forEach($lockableEl => {
    $lockableEl.addEventListener("mouseover", showTooltip);
    $lockableEl.on("click", toggleLock);
  });
}

function toggleLock(this: Element) {
  const id = this.id.slice(5);
  const isLocked = this.className === "icon-lock";
  const toggle = isLocked ? unlock : lock;
  toggle(id);
}

const lockMessage = "Click to lock the option and always use the current value on new map generation";
const unlockMessage = "Click to unlock the option and allow it to be randomized on new map generation";

function showTooltip(this: Element, event: Event) {
  event.stopPropagation();
  const isLocked = this.className === "icon-lock";
  const message = isLocked ? unlockMessage : lockMessage;
  tip(message);
}

// lock option from regeneration on page refresh
export function lock(id: string) {
  const $input = document.querySelector('[data-stored="' + id + '"]');
  if ($input && $input instanceof HTMLInputElement) {
    store(id, $input.value);
  }

  const $lock = document.getElementById("lock_" + id);
  if ($lock) {
    $lock.dataset.locked = "1";
    $lock.className = "icon-lock";
  }
}

// unlock option
export function unlock(id: string) {
  localStorage.removeItem(id);
  const $lock = document.getElementById("lock_" + id);
  if ($lock) {
    $lock.dataset.locked = "0";
    $lock.className = "icon-lock-open";
  }
}

// check if option is locked
export function locked(id: string) {
  const $lock = document.getElementById("lock_" + id);
  return Boolean($lock && $lock.dataset.locked === "1");
}
