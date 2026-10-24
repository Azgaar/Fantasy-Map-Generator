// The lock icons beside the options a new map would otherwise re-roll, painted from the pins
import { Pins } from "@/model/options/pins";
import { t } from "@/utils/i18n";
import { tip } from "./tooltips";

const LOCKED_TIP = t("Click to lock the option and always use the current value on new map generation");
const UNLOCKED_TIP = t("Click to unlock the option and allow it to be randomized on new map generation");

const keysOf = (icon: HTMLElement): string[] => (icon.dataset.ids ? icon.dataset.ids.split(",") : [icon.id.slice(5)]);

/** Wire the lock icons of a dialog and paint them */
export function bindPinIcons(root: Element, pinnedValue: (key: string) => unknown): void {
  for (const icon of root.querySelectorAll<HTMLElement>("[data-locked]")) {
    const keys = keysOf(icon);

    icon.addEventListener("mouseover", event => {
      event.stopPropagation();
      tip(icon.className === "icon-lock" ? UNLOCKED_TIP : LOCKED_TIP);
    });

    icon.addEventListener("click", () => {
      const pinning = icon.className !== "icon-lock";
      for (const key of keys) {
        if (pinning) Pins.set(key, pinnedValue(key));
        else Pins.clear(key);
      }
    });
  }

  paintPinIcons();
}

/** Paint every lock icon on the page with the state of the setting it stands for */
function paintPinIcons(): void {
  const pins = Pins.all();
  for (const icon of document.querySelectorAll<HTMLElement>("[data-locked]")) {
    const locked = keysOf(icon).some(key => Object.hasOwn(pins, key));
    icon.dataset.locked = locked ? "1" : "0";
    icon.className = locked ? "icon-lock" : "icon-lock-open";
  }
}

Pins.subscribe(paintPinIcons);
