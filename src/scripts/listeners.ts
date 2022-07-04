// @ts-ignore
import {checkIfServerless} from "./loading";
import {assignLockBehavior} from "./options/lock";
import {addTooptipListers} from "./tooltips";
import {assignSpeakerBehavior} from "./speaker";
// @ts-ignore
import {addResizeListener} from "modules/ui/options";
// @ts-ignore
import {addDragToUpload} from "modules/io/load";

export function addGlobalListeners() {
  checkIfServerless();
  if (PRODUCTION) {
    registerServiceWorker();
    addInstallationPrompt();
    addBeforeunloadListener();
  }
  assignLockBehavior();
  addTooptipListers();
  addResizeListener();
  assignSpeakerBehavior();
  addDragToUpload();
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

function addBeforeunloadListener() {
  window.onbeforeunload = () => "Are you sure you want to navigate away?";
}
