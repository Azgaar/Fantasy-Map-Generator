// Background save lifecycle: the autosave timer and the periodic "remember to save" reminder
import { Services } from "@/services";
import { ensureEl, ra } from "@/utils";

const MINUTE = 60000; // minute in milliseconds

export function initiateAutosave(): void {
  let lastSavedAt = Date.now();

  async function autosave() {
    const timeoutMinutes = ensureEl<HTMLInputElement>("autosaveIntervalOutput").valueAsNumber;
    if (!timeoutMinutes) return;

    const diffInMinutes = (Date.now() - lastSavedAt) / MINUTE;
    if (diffInMinutes < timeoutMinutes) return;
    if (customization) return tip("Autosave: map cannot be saved in edit mode", false, "warn", 2000);

    try {
      tip("Autosave: saving map...", false, "warn", 3000);
      await Services.Save.saveToStorage(await Services.Save.prepareMapData());
      tip("Autosave: map is saved", false, "success", 2000);

      lastSavedAt = Date.now();
    } catch (error) {
      ERROR && console.error(error);
      tip(`Autosave failed: ${(error as Error)?.message || "Unknown error"}`, true, "error", 4000);
    }
  }

  setInterval(autosave, MINUTE / 2);
  startSaveReminder();
}

let reminderInterval: ReturnType<typeof setInterval> | undefined;
let reminderActive = false;

function startSaveReminder(): void {
  if (localStorage.getItem("noReminder")) return;
  const message = [
    "Please don't forget to save the project to desktop from time to time",
    "Please remember to save the map to your desktop",
    "Saving will ensure your data won't be lost in case of issues",
    "Safety is number one priority. Please save the map",
    "Don't forget to save your map on a regular basis!",
    "Just a gentle reminder for you to save the map",
    "Please don't forget to save your progress (saving to desktop is the best option)",
    "Don't want to get reminded about need to save? Press CTRL+Q"
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
    tip("Save reminder is turned off. Press CTRL+Q again to re-initiate", true, "warn", 2000);
    clearInterval(reminderInterval);
    localStorage.setItem("noReminder", "true");
    reminderActive = false;
  } else {
    tip("Save reminder is turned on. Press CTRL+Q to turn off", true, "warn", 2000);
    localStorage.removeItem("noReminder");
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
