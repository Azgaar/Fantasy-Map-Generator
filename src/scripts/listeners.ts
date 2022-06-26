import {PRODUCTION} from "../constants";
import {assignLockBehavior} from "./options/lock";
import {addTooptipListers} from "./tooltips";

export function addGlobalListeners() {
  PRODUCTION && registerServiceWorker();
  PRODUCTION && addInstallationPrompt();
  assignLockBehavior();
  addTooptipListers();
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
      // @ts-ignore
      const Installation = await import("../modules/dynamic/installation.js");
      Installation.init(event);
    },
    {once: true}
  );
}
