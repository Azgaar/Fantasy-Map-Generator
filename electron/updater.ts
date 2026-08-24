// Self-update: asks GitHub releases for a newer build, downloads and installs it on confirmation

import type { MessageBoxOptions } from "electron";
import { app, BrowserWindow, dialog, shell } from "electron";
import { autoUpdater } from "electron-updater";

const RELEASES_URL = "https://github.com/Azgaar/Fantasy-Map-Generator/releases/latest";
const FIRST_CHECK_DELAY = 30_000;
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
const CAN_SELF_INSTALL = process.platform === "win32" || Boolean(process.env.APPIMAGE);

let reportErrors = false;
function ask(options: MessageBoxOptions): Promise<number> {
  const window = BrowserWindow.getAllWindows().find(candidate => !candidate.isDestroyed());
  const result = window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options);
  return result.then(({ response }) => response);
}

function onError(error: Error): void {
  console.error("Update failed:", error);
  if (!reportErrors) return;

  ask({
    type: "warning",
    buttons: ["Open downloads", "Close"],
    defaultId: 0,
    cancelId: 1,
    title: "Update failed",
    message: "The update could not be installed",
    detail: `${error.message}\n\nThe new version can be downloaded and installed manually`
  }).then(response => {
    if (response === 0) shell.openExternal(RELEASES_URL);
  });
}

/**
 * @param allowClose closes the window without the quit confirmation, so the installer can restart the app
 */
export function initUpdater(allowClose: () => void): void {
  if (!app.isPackaged) return; // there is nothing to update a dev build to

  autoUpdater.autoDownload = false; // downloading is the user's call, the installers are large
  autoUpdater.on("error", onError);

  autoUpdater.on("update-available", ({ version }) => {
    const question = {
      type: "info" as const,
      defaultId: 0,
      cancelId: 1,
      title: "Update available",
      message: `Fantasy Map Generator ${version} is available`
    };

    if (!CAN_SELF_INSTALL) {
      return ask({
        ...question,
        buttons: ["Open downloads", "Later"],
        detail: "Download the new version and install it over the current one"
      }).then(response => {
        if (response === 0) shell.openExternal(RELEASES_URL);
      });
    }

    ask({
      ...question,
      buttons: ["Download", "Later"],
      detail: "The download runs in the background, you can keep working on the map"
    }).then(response => {
      if (response !== 0) return;
      reportErrors = true;
      autoUpdater.downloadUpdate();
    });
  });

  autoUpdater.on("update-downloaded", ({ version }) => {
    ask({
      type: "info",
      buttons: ["Restart now", "Install on exit"],
      defaultId: 0,
      cancelId: 1,
      title: "Update ready",
      message: `Version ${version} is ready to install`,
      detail: "Save the map before restarting: the app closes to install the update"
    }).then(response => {
      if (response !== 0) return; // autoInstallOnAppQuit installs it on the next exit
      allowClose();
      autoUpdater.quitAndInstall();
    });
  });

  const check = () => {
    reportErrors = false; // a background check is silent again, whatever the previous attempt did
    autoUpdater.checkForUpdates().catch(() => {}); // the "error" event already reports it
  };

  setTimeout(check, FIRST_CHECK_DELAY);
  setInterval(check, CHECK_INTERVAL);
}
