// The app window itself: the SVG layer scaffold, browser-level behaviours (resizing, navigating away,
// mobile input quirks) and the whole-window drop target for opening a map file
import { alertDialog, closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { syncInputs } from "@/components/options/tabs/options-tab";
import { Services } from "@/services";
import { isElectron, isLocalhost } from "@/services/platform";
import { ensureEl, findEl } from "@/utils";
import { isLocked } from "@/utils/preferences";
import { fitMapToScreen } from "./canvas";

/** Keep the map canvas in sync with the window, dimension by dimension, unless the user pinned it */
function onResize(): void {
  if (isLocked("mapWidth") && isLocked("mapHeight")) return;

  if (!isLocked("mapWidth")) options.graph.width = window.innerWidth;
  if (!isLocked("mapHeight")) options.graph.height = window.innerHeight;
  syncInputs();
  fitMapToScreen();
}

/**
 * touch-punch preventDefaults touch sequences started on a dialog titlebar (the drag handle),
 * so taps on the titlebar buttons never produce a click. Stop the sequence from reaching it
 */
function onTitlebarButtonTouch(event: TouchEvent): void {
  const target = event.target as HTMLElement | null;
  if (target?.closest?.(".ui-dialog-titlebar-close, .ui-dialog-titlebar-collapse")) event.stopPropagation();
}

/**
 * Each release replaces the content-hashed chunk files on the server, so a page opened before
 * the release 404s when it lazy-loads a chunk it has not requested yet ("Failed to fetch
 * dynamically imported module"). Offer a reload to pick up the new build
 */
function onChunkLoadError(): void {
  confirmationDialog({
    title: "New version released",
    message:
      "This part of the app failed to load because a new version was released while the page was open.<br />Reload the page to get the new version. If you have unsaved changes, save the map first",
    confirm: "Reload",
    cancel: "Not now",
    onConfirm: () => {
      window.onbeforeunload = null; // the user just confirmed the reload, don't ask again.
      location.reload();
    }
  });
}

/** Dropping a .map or .gz anywhere on the window opens it. Pull request from @evyatron */
function addDragToUpload(): void {
  const overlay = () => ensureEl("mapOverlay");

  document.addEventListener("dragover", event => {
    event.stopPropagation();
    event.preventDefault();
    overlay().style.display = null as unknown as string;
  });

  document.addEventListener("dragleave", () => {
    overlay().style.display = "none";
  });

  document.addEventListener("drop", event => {
    event.stopPropagation();
    event.preventDefault();

    const mapOverlay = overlay();
    mapOverlay.style.display = "none";

    const items = event.dataTransfer?.items;
    if (!items || items.length !== 1) return; // no files, or more than one
    const file = items[0].getAsFile();
    if (!file) return;

    if (!file.name.endsWith(".map") && !file.name.endsWith(".gz")) {
      return alertDialog({
        title: "Invalid file format",
        message: "Please upload a map file (<i>.map</i> or <i>.gz</i> formats) you have previously downloaded"
      });
    }

    mapOverlay.style.display = null as unknown as string;
    mapOverlay.innerHTML = "Uploading<span>.</span><span>.</span><span>.</span>";
    closeDialogs();
    Services.Load.uploadMap(file, () => {
      mapOverlay.style.display = "none";
      mapOverlay.innerHTML = "Drop a map file to open";
    });
  });
}

/**
 * Offer the tour to newcomers with a floating button. Shown on the first few visits only, and never
 * again once the user has taken it. The tour itself stays lazy: it is a chunk of its own
 */
function initTourPromptButton(): void {
  const MAX_SHOWS = 3;
  const STORAGE_KEY = "fmg-tour-prompt-count";

  const count = Number.parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
  if (count >= MAX_SHOWS) return;

  const button = findEl("tourPromptButton");
  if (!button) return;

  button.style.display = "flex";
  button.addEventListener("click", () => {
    Services.UiTour.start();
    localStorage.setItem(STORAGE_KEY, String(MAX_SHOWS));
  });
  localStorage.setItem(STORAGE_KEY, String(count + 1));
}

/** The app is a static site, but it fetches assets: opening index.html from disk cannot work */
export function warnIfServerless(): boolean {
  if (location.hostname) return false;

  const wiki = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Run-FMG-locally";
  alertDialog({
    title: "Loading error",
    width: "28em",
    message: /* html */ `Fantasy Map Generator cannot run serverless. Follow the <a href="${wiki}" target="_blank">instructions</a> on how you can easily run a local web-server`
  });
  return true;
}

/** Wire the window up: the svg layer scaffold and the browser-level behaviours around it. Called by boot() */
export function initShell(): void {
  Layers.init(); // create the svg layer groups the renderers draw into

  window.addEventListener("resize", onResize);
  window.addEventListener("vite:preloadError", onChunkLoadError);
  document.addEventListener("touchstart", onTitlebarButtonTouch, { capture: true, passive: true });
  addDragToUpload();
  initTourPromptButton();

  // Electron silently cancels the close on `onbeforeunload` instead of prompting, it asks natively instead
  if (!isLocalhost() && !isElectron()) window.onbeforeunload = () => "Are you sure you want to navigate away?";

  if (isElectron()) removeWebOnlyControls();
}

function removeWebOnlyControls(): void {
  findEl("getAppButton")?.remove();
  findEl("azgaarAssistant")?.closest("tr")?.remove();
  findEl("saveToDropboxButton")?.remove();
  findEl("loadFromDropbox")?.remove();
}
