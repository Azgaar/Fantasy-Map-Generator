// @ts-ignore
import {addOnLoadListener} from "./loading";
import {assignLockBehavior} from "./options/lock";
import {addTooptipListers} from "./tooltips";
import {assignSpeakerBehavior} from "./speaker";
import {addResizeListener} from "modules/ui/options";
// @ts-ignore
import {addDragToUpload} from "modules/io/load";
import {addHotkeyListeners} from "scripts/hotkeys";
// @ts-ignore
import {addFindAll} from "scripts/findAll";

export function addGlobalListeners() {
  if (PRODUCTION) {
    registerServiceWorker();
    addInstallationPrompt();
    addBeforeunloadListener();
  }
  addOnLoadListener();
  assignLockBehavior();
  addTooptipListers();
  addResizeListener();
  addHotkeyListeners();
  assignSpeakerBehavior();
  addDragToUpload();
  addFindAll();
}

function registerServiceWorker() {
  "serviceWorker" in navigator &&
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/Fantasy-Map-Generator/sw.js", {scope: "/Fantasy-Map-Generator/"})
        .catch(err => {
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