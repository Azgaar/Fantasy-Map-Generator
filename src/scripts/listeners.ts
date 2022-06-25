import {PRODUCTION} from "../constants";
import {assignLockBehavior} from "./options/lock";

export function addGlobalListeners() {
  PRODUCTION && registerServiceWorker();
  PRODUCTION && addInstallationPrompt();
  assignLockBehavior();
}

function registerServiceWorker() {
  "serviceWorker" in navigator &&
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("../../sw.js").catch(err => {
        console.error("ServiceWorker registration failed: ", err);
      });
    });
}

function addInstallationPrompt() {
  window.addEventListener(
    "beforeinstallprompt",
    async event => {
      event.preventDefault();
      const Installation = await import("../../modules/dynamic/installation.js");
      Installation.init(event);
    },
    {once: true}
  );
}
