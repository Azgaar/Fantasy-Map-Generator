// Browser-level behaviours of the app window: resizing, navigating away and mobile input quirks
import { stored } from "@/utils/preferences";

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

function initialize(): void {
  window.addEventListener("resize", onResize);
  document.addEventListener("touchstart", onTitlebarButtonTouch, { capture: true, passive: true });

  if (!isLocalhost()) window.onbeforeunload = () => "Are you sure you want to navigate away?";
}

initialize();
