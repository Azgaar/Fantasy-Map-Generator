// Electron main process: serves the built renderer over a custom scheme and owns the app window

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { MenuItemConstructorOptions } from "electron";
import { app, BrowserWindow, dialog, Menu, nativeImage, net, protocol, screen, shell } from "electron";
import { initUpdater } from "./updater";

const SCHEME = "app";
const HOST = "fmg";
const APP_URL = `${SCHEME}://${HOST}/index.html`;
const RENDERER_DIR = path.join(__dirname, "renderer");
const ICON_PATH = path.join(__dirname, "icon.png");
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const WIKI_URL = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki";
const DISCORD_URL = "https://discord.gg/X7E84HU";

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

// the map only reads well at size, so a first run takes the whole screen; later runs honour what the user left
const DEFAULT_STATE: WindowState = { width: 1440, height: 900, maximized: false, fullscreen: true };

const stateFile = () => path.join(app.getPath("userData"), "window-state.json");

function readState(): WindowState {
  try {
    const { width, height, x, y, maximized, fullscreen } = JSON.parse(fs.readFileSync(stateFile(), "utf8"));
    if (!width || !height) return DEFAULT_STATE;
    return fitToDisplay({ width, height, x, y, maximized: Boolean(maximized), fullscreen: Boolean(fullscreen) });
  } catch {
    return DEFAULT_STATE;
  }
}

/** A window restored onto a monitor that is no longer attached would open out of sight: keep it on a real display */
function fitToDisplay(state: WindowState): WindowState {
  if (!Number.isFinite(state.x) || !Number.isFinite(state.y)) return { ...state, x: undefined, y: undefined };

  const { x = 0, y = 0 } = state;
  const { workArea } = screen.getDisplayMatching({ x, y, width: state.width, height: state.height });
  const width = Math.min(state.width, workArea.width);
  const height = Math.min(state.height, workArea.height);

  return {
    ...state,
    width,
    height,
    x: Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - width),
    y: Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - height)
  };
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

/**
 * A .map file is shared like a document, and the app builds markup out of what is inside it, so the one
 * directive that matters is `script-src`: no origin but the build itself may supply code, save for the
 * Assistant widget the user opts into. The rest stays permissive, because maps embed data/blob images and
 * fonts and the AI providers are fetched over https. `unsafe-eval` is required by the goods distribution
 * formulas, which compile to `new Function`
 */
const ASSISTANT_ORIGINS = "https://*.openwidget.com";

const CSP = [
  "default-src 'self' data: blob:",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${ASSISTANT_ORIGINS}`,
  "style-src 'self' 'unsafe-inline' https:",
  "font-src 'self' data: https:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  "connect-src 'self' data: blob: https: wss:",
  "frame-src 'self' https:"
].join("; ");

function serveRenderer(): void {
  protocol.handle(SCHEME, async request => {
    const { host, pathname } = new URL(request.url);
    if (host !== HOST) return new Response("Not found", { status: 404 });

    let filePath: string;
    try {
      // a directory holds no file to serve: hand out the app itself, the way a web server would
      const requestedPath = decodeURIComponent(pathname);
      filePath = path.join(RENDERER_DIR, requestedPath.endsWith("/") ? `${requestedPath}index.html` : requestedPath);
    } catch {
      return new Response("Bad request", { status: 400 }); // a malformed percent-escape
    }
    if (!filePath.startsWith(RENDERER_DIR + path.sep)) return new Response("Forbidden", { status: 403 });

    try {
      const response = await net.fetch(pathToFileURL(filePath).toString());
      const headers = new Headers(response.headers);
      headers.set("Content-Security-Policy", CSP);
      return new Response(response.body, { status: response.status, headers });
    } catch {
      // net.fetch rejects on a missing file, and the rejection would reach the page as an opaque network error
      return new Response("Not found", { status: 404 });
    }
  });
}

/** Keep the app itself in the window, hand every external link to the default browser */
function routeExternalLinks(window: BrowserWindow): void {
  const openExternal = (url: string) => {
    if (/^(https?|mailto):/.test(url)) shell.openExternal(url);
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
 * The default menu offers Reload, which throws the map away without the browser's "leave site?" prompt.
 * This one drops it and keeps what the app needs: the Edit roles carry the clipboard shortcuts on macOS
 */
function buildMenu(): void {
  const isMac = process.platform === "darwin";

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([{ role: "appMenu" }] satisfies MenuItemConstructorOptions[])
      : // the app menu carries Quit on macOS; elsewhere there is otherwise no way to leave the app
        // from the UI at all, which a window manager that draws no titlebar leaves with none
        ([{ label: "File", submenu: [{ role: "quit" }] }] satisfies MenuItemConstructorOptions[])),
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { role: "toggleDevTools" }
      ]
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: "Wiki", click: () => shell.openExternal(WIKI_URL) },
        { label: "Discord", click: () => shell.openExternal(DISCORD_URL) },
        ...(isMac ? [] : ([{ type: "separator" }, { role: "about" }] satisfies MenuItemConstructorOptions[]))
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

let quitting = false; // set on Cmd+Q, where closing the window alone would leave the app running
let skipConfirmation = false; // set once the user has confirmed, and by the updater to install on restart

app.on("before-quit", () => {
  quitting = true;
});

/** Closes the window without the quit confirmation, so the installer can restart the app */
function allowClose(): void {
  skipConfirmation = true;
}

/**
 * The web app warns before navigating away via `onbeforeunload`, but Electron cancels the close
 * silently instead of prompting, which would make the window unclosable. Ask natively instead
 */
function confirmOnClose(window: BrowserWindow): void {
  let confirming = false;

  window.on("close", event => {
    saveState(window);
    if (skipConfirmation) return;
    event.preventDefault();
    // Cmd+Q reaches the window through before-quit as well as the close itself, and a window
    // manager binding can deliver it more than once; without this the dialog stacks on itself
    if (confirming) return;
    confirming = true;

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
        confirming = false;
        if (response !== 0) {
          quitting = false;
          return;
        }
        skipConfirmation = true;
        if (quitting) app.quit();
        else window.close();
      });
  });

  // on macOS the app outlives its window: the next one has to ask again
  window.on("closed", () => {
    skipConfirmation = false;
  });
}

function createWindow(): void {
  const { maximized, fullscreen, ...bounds } = readState();

  const window = new BrowserWindow({
    ...bounds,
    fullscreen, // set here rather than after: entering fullscreen on a window that is not shown yet is unreliable
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

  if (maximized && !fullscreen) window.maximize();

  window.once("ready-to-show", () => window.show());
  enableDevTools(window);
  routeExternalLinks(window);
  confirmOnClose(window);
  window.loadURL(DEV_SERVER_URL || APP_URL); // an empty variable is no dev server either
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
    buildMenu();
    createWindow();
    initUpdater(allowClose); // app-wide, so re-opening a window on macOS does not start a second updater
    app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
  });

  app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
}
