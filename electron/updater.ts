// Self-update: asks GitHub releases for a newer build, downloads and installs it on confirmation

import type { BrowserWindow } from "electron";
import { app, dialog, shell } from "electron";
import { autoUpdater } from "electron-updater";

const RELEASES_URL = "https://github.com/Azgaar/Fantasy-Map-Generator/releases/latest";
const FIRST_CHECK_DELAY = 30_000; // let the map generate before bothering the user
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;

/** Errors are only worth a dialog once the user asked for the update: a check on launch may just be offline */
let reportErrors = false;

function onError(error: Error, window: BrowserWindow): void {
  console.error("Update failed:", error);
  if (!reportErrors) return;
  reportErrors = false;

  dialog
    .showMessageBox(window, {
      type: "warning",
      buttons: ["Open downloads", "Close"],
      defaultId: 0,
      cancelId: 1,
      title: "Update failed",
      message: "The update could not be installed",
      detail: `${error.message}\n\nThe new version can be downloaded and installed manually`
    })
    .then(({ response }) => {
      if (response === 0) shell.openExternal(RELEASES_URL);
    });
}

/**
 * @param window parent for the update dialogs
 * @param allowClose closes the window without the quit confirmation, so the installer can restart the app
 */
export function initUpdater(window: BrowserWindow, allowClose: () => void): void {
  if (!app.isPackaged) return; // there is nothing to update a dev build to

  autoUpdater.autoDownload = false; // downloading is the user's call, the installers are large
  autoUpdater.on("error", error => onError(error, window));

  autoUpdater.on("update-available", ({ version }) => {
    dialog
      .showMessageBox(window, {
        type: "info",
        buttons: ["Download", "Later"],
        defaultId: 0,
        cancelId: 1,
        title: "Update available",
        message: `Fantasy Map Generator ${version} is available`,
        detail: "The download runs in the background, you can keep working on the map"
      })
      .then(({ response }) => {
        if (response !== 0) return;
        reportErrors = true;
        autoUpdater.downloadUpdate();
      });
  });

  autoUpdater.on("update-downloaded", ({ version }) => {
    dialog
      .showMessageBox(window, {
        type: "info",
        buttons: ["Restart now", "Install on exit"],
        defaultId: 0,
        cancelId: 1,
        title: "Update ready",
        message: `Version ${version} is ready to install`,
        detail: "Save the map before restarting: the app closes to install the update"
      })
      .then(({ response }) => {
        if (response !== 0) return; // autoInstallOnAppQuit installs it on the next exit
        allowClose();
        autoUpdater.quitAndInstall();
      });
  });

  const check = () => autoUpdater.checkForUpdates().catch(() => {}); // the "error" event already reports it
  setTimeout(check, FIRST_CHECK_DELAY);
  setInterval(check, CHECK_INTERVAL);
}
