// The app window itself: the SVG layer scaffold, browser-level behaviours
import { alertDialog, closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { Pins } from "@/components/pins";
import { showDataTip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { Services } from "@/services";
import { isElectron, isLocalhost } from "@/services/platform";
import { ensureEl, findEl } from "@/utils";
import { sentences, t } from "@/utils/i18n";
import { fitMapToScreen } from "./canvas";

/** Wire the window up: the svg layer scaffold and the browser-level behaviours around it. Called by boot() */
export function initShell(): void {
  Layers.init(); // create the svg layer groups the renderers draw into
  translateShell();

  window.addEventListener("resize", onResize);
  window.addEventListener("vite:preloadError", onChunkLoadError);
  document.addEventListener("touchstart", onTitlebarButtonTouch, { capture: true, passive: true });
  addDragToUpload();
  initTourPromptButton();
  initAssistantBubble();

  if (!isLocalhost() && !isElectron()) window.onbeforeunload = () => t("Are you sure you want to navigate away?");
  if (isElectron()) removeWebOnlyControls();
}

// the page template's own text: selector, text (null keeps it) and tooltip
const SHELL_TEXT: [string, string | null, string | null][] = [
  ["#optionsTrigger", null, t("Click to show the Menu")],
  ["#regenerate", t("New Map!"), t("Click to generate a new map")],
  ["#options .drag-trigger", null, t("Drag to move the Menu")],
  ["#optionsHide", null, t("Click to hide the Menu")],
  ["#layersTab", t("Layers"), t("Click to change map layers")],
  ["#styleTab", t("Style"), t("Click to open style editor")],
  ["#optionsTab", t("Options"), t("Click to change generation and UI options")],
  ["#toolsTab", t("Tools"), t("Click to open tools menu")],
  ["#aboutTab", t("About"), t("Click to see Generator info")],
  ["#newMapButton", t("New Map"), t("Generate a new map based on options")],
  ["#exportButton", t("Export"), t("Select format to download image or export map data")],
  ["#saveButton", t("Save"), t("Save fully-functional map file")],
  ["#loadButton", t("Load"), t("Load fully-functional map (.map or .gz formats)")],
  ["#zoomReset", t("Zoom Out"), t("Reset map zoom")],
  ["#searchButton", t("Search"), t("Search map and commands")],
  ["#exitCustomization > div", null, t("Drag to move the pane")],
  ["#finalizeHeightmap", t("Exit Customization"), t("Finalize the heightmap and exit the edit mode")],
  ["#assistantBubble", null, t("Azgaar Assistant")],
  ["#mapOverlay", t("Drop a map file to open"), null],
  ["#tourPromptButton", null, t("Take an interactive tour of the map generator")]
];

function translateShell(): void {
  for (const [selector, text, tip] of SHELL_TEXT) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) continue;
    if (text !== null) element.textContent = text;
    if (tip !== null) element.dataset.tip = tip;
  }
  findEl("assistantBubble")?.setAttribute("aria-label", t("Azgaar Assistant"));
  document.querySelector("#tourPromptButton button")?.setAttribute("aria-label", t("Launch UI Tour"));
  const tooltip = findEl("tooltip");
  if (tooltip) tooltip.dataset.main = t("Click the arrow button for options. Zoom in to see the map in details");
  const loading = findEl("loading-text")?.firstChild;
  if (loading) loading.textContent = t("Loading").toUpperCase();
}

/** Keep the next unpinned map request in step with the browser window. */
function onResize(): void {
  Options.set(config => {
    if (Pins.rolls("mapWidth") && window.innerWidth > 0) config.generation.graph.width = window.innerWidth;
    if (Pins.rolls("mapHeight") && window.innerHeight > 0) config.generation.graph.height = window.innerHeight;
  });
  fitMapToScreen();
}

/** The assistant's call button: always in the markup, shown only when the preference says so */
function initAssistantBubble(): void {
  const bubble = findEl("assistantBubble");
  if (!bubble) return;

  bubble.addEventListener("click", () => Controllers.Assistant.toggle());
  bubble.addEventListener("mouseover", showDataTip);
}

/**
 * touch-punch preventDefaults touch sequences started on a dialog titlebar (the drag handle),
 * so taps on the titlebar buttons never produce a click. Stop the sequence from reaching it
 */
function onTitlebarButtonTouch(event: TouchEvent): void {
  const target = event.target as HTMLElement | null;
  if (target?.closest?.(".ui-dialog-titlebar button")) event.stopPropagation();
}

/**
 * Each release replaces the content-hashed chunk files on the server, so a page opened before
 * the release 404s when it lazy-loads a chunk it has not requested yet ("Failed to fetch
 * dynamically imported module"). Offer a reload to pick up the new build. Offline the same error
 * means the chunk was never precached (it was not in the build the worker installed), so say that
 */
function onChunkLoadError(): void {
  if (!navigator.onLine) {
    alertDialog({
      title: t("You are offline"),
      message: t("This part of the app was not downloaded before the connection was lost. Reconnect and try again")
    });
    return;
  }

  confirmationDialog({
    title: t("New version released"),
    message: `${t("This part of the app failed to load because a new version was released while the page was open.")}<br>${sentences(t("Reload the page to get the new version"), t("If you have unsaved changes, save the map first"))}`,
    confirm: t("Reload"),
    cancel: t("Not now"),
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
    if (items?.length !== 1) return; // no files, or more than one
    const file = items[0].getAsFile();
    if (!file) return;

    if (!file.name.endsWith(".map") && !file.name.endsWith(".gz")) {
      return alertDialog({
        title: t("Invalid file format"),
        message: t("Please upload a map file (.map or .gz formats) you have previously downloaded")
      });
    }

    mapOverlay.style.display = null as unknown as string;
    mapOverlay.innerHTML = `${t("Uploading")}<span>.</span><span>.</span><span>.</span>`;
    closeDialogs();
    Services.Load.uploadMap(file, () => {
      mapOverlay.style.display = "none";
      mapOverlay.innerHTML = t("Drop a map file to open");
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
    title: t("Loading error"),
    width: "28em",
    message: t(
      "Fantasy Map Generator cannot run serverless. Follow the {{- instructions}} on how you can easily run a local web-server",
      {
        instructions: `<a href="${wiki}" target="_blank">${t("instructions")}</a>`
      }
    )
  });
  return true;
}

function removeWebOnlyControls(): void {
  findEl("getAppButton")?.remove();
  findEl("saveToDropboxButton")?.remove();
  findEl("loadFromDropbox")?.remove();
}
