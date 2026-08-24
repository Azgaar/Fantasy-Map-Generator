// Electron main process: serves the built renderer over a custom scheme and owns the app window

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { MenuItemConstructorOptions } from "electron";
import { app, BrowserWindow, dialog, Menu, nativeImage, net, protocol, shell } from "electron";
import { initUpdater } from "./updater";

const SCHEME = "app";
const APP_URL = `${SCHEME}://fmg/index.html`;
const RENDERER_DIR = path.join(__dirname, "renderer");
const ICON_PATH = path.join(__dirname, "icon.png");
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

/**
 * The app is named after `productName`, but its data stays in the folder the name would have
 * produced before, so a rename never strands the maps stored in localStorage and IndexedDB
 */
app.setPath("userData", path.join(app.getPath("appData"), "fantasy-map-generator"));

app.setAboutPanelOptions({
  applicationName: app.name,
  applicationVersion: app.getVersion(),
  iconPath: ICON_PATH,
  copyright: "MIT License. Azgaar and Team, 2017-2026"
});

type WindowState = { width: number; height: number; x?: number; y?: number; maximized: boolean; fullscreen: boolean };

const DEFAULT_STATE: WindowState = { width: 1440, height: 900, maximized: true, fullscreen: true };

const stateFile = () => path.join(app.getPath("userData"), "window-state.json");

function readState(): WindowState {
  try {
    const { width, height, x, y, maximized, fullscreen } = JSON.parse(fs.readFileSync(stateFile(), "utf8"));
    if (!width || !height) return DEFAULT_STATE;
    return { width, height, x, y, maximized: Boolean(maximized), fullscreen: Boolean(fullscreen) };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(window: BrowserWindow): void {
  try {
    // getNormalBounds is the un-maximized size, the one to restore to when the user unmaximizes
    const state = { ...window.getNormalBounds(), maximized: window.isMaximized(), fullscreen: window.isFullScreen() };
    fs.writeFileSync(stateFile(), JSON.stringify(state));
  } catch (error) {
    console.error("Cannot store window state:", error);
  }
}

/**
 * The renderer is an ES module app, and Chromium refuses to load modules from file://,
 * so the build is served from a privileged scheme that gives the page a real origin
 * (required by localStorage and IndexedDB the app stores maps in)
 */
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } }
]);

function serveRenderer(): void {
  protocol.handle(SCHEME, request => {
    const { pathname } = new URL(request.url);
    const filePath = path.join(RENDERER_DIR, decodeURIComponent(pathname));
    if (!filePath.startsWith(RENDERER_DIR + path.sep)) return new Response("Forbidden", { status: 403 });
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

/** Keep the app itself in the window, hand every external link to the default browser */
function routeExternalLinks(window: BrowserWindow): void {
  const openExternal = (url: string) => {
    if (url.startsWith("https:") || url.startsWith("http:")) shell.openExternal(url);
  };

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (url === window.webContents.getURL()) return; // in-app reload
    event.preventDefault();
    openExternal(url);
  });
}

/**
 * The browser console is part of how the map is debugged, so the packaged app keeps it: the View menu
 * has the toggle, and these shortcuts work even where the menu bar is hidden
 */
function enableDevTools(window: BrowserWindow): void {
  const { webContents } = window;

  webContents.on("before-input-event", (_event, input) => {
    if (input.type !== "keyDown") return;
    const isF12 = input.key === "F12";
    const isInspectCombo = (input.control || input.meta) && input.shift && input.key.toLowerCase() === "i";
    if (isF12 || isInspectCombo) webContents.toggleDevTools();
  });

  // a desktop window has no browser context menu of its own: supply editing commands and the inspector
  webContents.on("context-menu", (_event, { x, y, isEditable, selectionText }) => {
    const template: MenuItemConstructorOptions[] = [];
    if (isEditable) template.push({ role: "cut" }, { role: "copy" }, { role: "paste" }, { type: "separator" });
    else if (selectionText) template.push({ role: "copy" }, { type: "separator" });
    template.push({ label: "Inspect element", click: () => webContents.inspectElement(x, y) });

    Menu.buildFromTemplate(template).popup({ window });
  });
}

/**
 * The web app warns before navigating away via `onbeforeunload`, but Electron cancels the close
 * silently instead of prompting, which would make the window unclosable. Ask natively instead
 */
function confirmOnClose(window: BrowserWindow): () => void {
  let confirmed = false;
  let quitting = false; // set on Cmd+Q, where closing the window alone would leave the app running
  app.on("before-quit", () => {
    quitting = true;
  });

  window.on("close", event => {
    saveState(window);
    if (confirmed) return;
    event.preventDefault();

    dialog
      .showMessageBox(window, {
        type: "question",
        buttons: ["Quit", "Cancel"],
        defaultId: 1,
        cancelId: 1,
        title: "Quit",
        message: "Quit the Fantasy Map Generator?",
        detail: "The map is autosaved to the app storage, but save it to a file to be safe"
      })
      .then(({ response }) => {
        if (response !== 0) {
          quitting = false;
          return;
        }
        confirmed = true;
        if (quitting) app.quit();
        else window.close();
      });
  });

  return () => {
    confirmed = true;
  };
}

function createWindow(): void {
  const { maximized, fullscreen, ...bounds } = readState();

  const window = new BrowserWindow({
    ...bounds,
    minWidth: 800,
    minHeight: 600,
    show: false,
    icon: ICON_PATH, // Windows and Linux take the window icon from here, macOS from the app bundle
    backgroundColor: "#000000",
    autoHideMenuBar: process.platform !== "darwin",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  if (maximized) window.maximize();
  if (fullscreen) window.setFullScreen(true);

  window.once("ready-to-show", () => window.show());
  enableDevTools(window);
  routeExternalLinks(window);
  initUpdater(window, confirmOnClose(window));
  window.loadURL(DEV_SERVER_URL ?? APP_URL);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [window] = BrowserWindow.getAllWindows();
    if (!window) return createWindow();
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  app.whenReady().then(() => {
    // a dev run borrows the Electron bundle, so its dock icon has to be replaced by hand
    if (!app.isPackaged) app.dock?.setIcon(nativeImage.createFromPath(ICON_PATH));
    serveRenderer();
    createWindow();
    app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
  });

  app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
}
