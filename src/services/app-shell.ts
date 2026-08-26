// Browser-level behaviours of the app window: resizing, navigating away and mobile input quirks
import { confirmationDialog } from "@/components/dialog/dialog-helpers";
import { findEl } from "@/utils";
import { stored } from "@/utils/preferences";
import { isElectron } from "./platform";

const isLocalhost = () => location.hostname === "localhost" || location.hostname === "127.0.0.1";

/** Keep the map canvas in sync with the window unless the user pinned a map size */
function onResize(): void {
  if (stored("mapWidth") && stored("mapHeight")) return;

  (document.getElementById("mapWidthInput") as HTMLInputElement).value = String(window.innerWidth);
  (document.getElementById("mapHeightInput") as HTMLInputElement).value = String(window.innerHeight);
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

function initialize(): void {
  window.addEventListener("resize", onResize);
  window.addEventListener("vite:preloadError", onChunkLoadError);
  document.addEventListener("touchstart", onTitlebarButtonTouch, { capture: true, passive: true });

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

initialize();
