// Background save lifecycle: the autosave timer and the periodic "remember to save" reminder

import { tip } from "@/components/tooltips";
import { Services } from "@/services";
import { ra } from "@/utils";
import { t } from "@/utils/i18n";

const MINUTE = 60000; // minute in milliseconds

export function initiateAutosave(): void {
  let lastSavedAt = Date.now();

  async function autosave() {
    const timeoutMinutes = options.app.autosave.interval;
    if (!timeoutMinutes) return;

    const diffInMinutes = (Date.now() - lastSavedAt) / MINUTE;
    if (diffInMinutes < timeoutMinutes) return;
    if (customization) return tip(t("Autosave: map cannot be saved in edit mode"), false, "warn", 2000);

    try {
      tip(t("Autosave: saving map..."), false, "warn", 3000);
      await Services.Save.writeToStorage(await Services.Save.prepareMapData());
      tip(t("Autosave: map is saved"), false, "success", 2000);

      lastSavedAt = Date.now();
    } catch (error) {
      ERROR && console.error(error);
      tip(
        t("Autosave failed: {{error}}", { error: (error as Error)?.message || t("Unknown error") }),
        true,
        "error",
        4000
      );
    }
  }

  setInterval(autosave, MINUTE / 2);
  startSaveReminder();
}

let reminderInterval: ReturnType<typeof setInterval> | undefined;
let reminderActive = false;

function startSaveReminder(): void {
  if (!options.app.autosave.remind) return;
  const message = [
    t("Please don't forget to save the project to desktop from time to time"),
    t("Please remember to save the map to your desktop"),
    t("Saving will ensure your data won't be lost in case of issues"),
    t("Safety is number one priority. Please save the map"),
    t("Don't forget to save your map on a regular basis!"),
    t("Just a gentle reminder for you to save the map"),
    t("Please don't forget to save your progress (saving to desktop is the best option)"),
    t("Don't want to get reminded about need to save? Press CTRL+Q")
  ];
  const interval = 15 * MINUTE; // remind every 15 minutes

  reminderInterval = setInterval(() => {
    if (customization) return;
    tip(ra(message), true, "warn", 2500);
  }, interval);
  reminderActive = true;
}

export function toggleSaveReminder(): void {
  if (reminderActive) {
    tip(t("Save reminder is turned off. Press CTRL+Q again to re-initiate"), true, "warn", 2000);
    clearInterval(reminderInterval);
    Options.set(o => (o.app.autosave.remind = false));
    reminderActive = false;
  } else {
    tip(t("Save reminder is turned on. Press CTRL+Q to turn off"), true, "warn", 2000);
    Options.set(o => (o.app.autosave.remind = true));
    startSaveReminder();
  }
}

declare global {
  interface Window {
    initiateAutosave: typeof initiateAutosave;
    toggleSaveReminder: typeof toggleSaveReminder;
  }
}

window.initiateAutosave = initiateAutosave;
window.toggleSaveReminder = toggleSaveReminder;
