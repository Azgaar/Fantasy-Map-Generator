import {openDialog} from "dialogs";
import {toggleLayer} from "layers";
import {showAboutDialog} from "modules/ui/about";
import {byId} from "utils/shorthands";
import {closeDialogs} from "dialogs/utils";
import {minmax} from "utils/numberUtils";
// @ts-expect-error js module
import {hideOptions} from "modules/ui/options";
// @ts-expect-error js module
import {regeneratePrompt, toggle3dOptions, toggleOptions} from "modules/ui/options";
// @ts-expect-error js module
import {quickSave, saveToDropbox, dowloadMap, toggleSaveReminder} from "modules/io/save";
// @ts-expect-error js module
import {quickLoad} from "modules/io/load";

// Hotkeys, see github.com/Azgaar/Fantasy-Map-Generator/wiki/Hotkeys
export function addHotkeyListeners() {
  document.on("keydown", handleKeydown as EventListener);
  document.on("keyup", handleKeyup as EventListener);
}

function handleKeydown(event: KeyboardEvent) {
  if (!allowHotkeys()) return; // in some cases (e.g. in a textarea) hotkeys are not allowed

  const {code, ctrlKey, altKey} = event;
  if (altKey && !ctrlKey) event.preventDefault(); // disallow alt key combinations
  if (ctrlKey && ["KeyS", "KeyC"].includes(code)) event.preventDefault(); // disallow CTRL + S and CTRL + C
  if (["F1", "F2", "F6", "F9", "Tab"].includes(code)) event.preventDefault(); // disallow default Fn and Tab
}

function handleKeyup(event: KeyboardEvent) {
  if (!allowHotkeys()) return; // in some cases (e.g. in a textarea) hotkeys are not allowed

  event.stopPropagation();

  const {code, key, ctrlKey, metaKey, shiftKey, altKey} = event;
  const ctrl = ctrlKey || metaKey || key === "Control";
  const shift = shiftKey || key === "Shift";
  const alt = altKey || key === "Alt";

  const Zoom = window.Zoom;
  const $undo = byId("undo");
  const $redo = byId("redo");

  if (code === "F1") showAboutDialog();
  else if (code === "F2") regeneratePrompt();
  else if (code === "F6") quickSave();
  else if (code === "F9") quickLoad();
  else if (code === "Tab") toggleOptions(event);
  else if (code === "Escape") closeAllDialogs();
  else if (code === "Delete") removeElementOnKey();
  else if (code === "KeyO" && byId("canvas3d")) toggle3dOptions();
  else if (ctrl && code === "KeyQ") toggleSaveReminder();
  else if (ctrl && code === "KeyS") dowloadMap();
  else if (ctrl && code === "KeyC") saveToDropbox();
  else if (ctrl && code === "KeyZ" && $undo?.offsetParent) $undo.click();
  else if (ctrl && code === "KeyY" && $redo?.offsetParent) $redo.click();
  else if (shift && code === "KeyH") openDialog("heightmapEditor");
  else if (shift && code === "KeyB") editBiomes();
  else if (shift && code === "KeyS") openDialog("statesEditor");
  else if (shift && code === "KeyP") editProvinces();
  else if (shift && code === "KeyD") openDialog("diplomacyEditor");
  else if (shift && code === "KeyC") openDialog("culturesEditor");
  else if (shift && code === "KeyN") editNamesbase();
  else if (shift && code === "KeyZ") editZones();
  else if (shift && code === "KeyR") openDialog("religionsEditor");
  else if (shift && code === "KeyY") openEmblemEditor();
  else if (shift && code === "KeyQ") openDialog("unitsEditor");
  else if (shift && code === "KeyO") editNotes();
  else if (shift && code === "KeyA") openDialog("chartsOverview");
  else if (shift && code === "KeyT") openDialog("burgsOverview");
  else if (shift && code === "KeyV") overviewRivers();
  else if (shift && code === "KeyM") overviewMilitary();
  else if (shift && code === "KeyK") overviewMarkers();
  else if (shift && code === "KeyE") viewCellDetails();
  else if (key === "!") toggleAddBurg();
  else if (key === "@") toggleAddLabel();
  else if (key === "#") toggleAddRiver();
  else if (key === "$") toggleAddRoute();
  else if (key === "%") toggleAddMarker();
  else if (alt && code === "KeyB") console.table(pack.burgs);
  else if (alt && code === "KeyS") console.table(pack.states);
  else if (alt && code === "KeyC") console.table(pack.cultures);
  else if (alt && code === "KeyR") console.table(pack.religions);
  else if (alt && code === "KeyF") console.table(pack.features);
  else if (code === "KeyX") toggleLayer("toggleTexture");
  else if (code === "KeyH") toggleLayer("toggleHeight");
  else if (code === "KeyB") toggleLayer("toggleBiomes");
  else if (code === "KeyE") toggleLayer("toggleCells");
  else if (code === "KeyG") toggleLayer("toggleGrid");
  else if (code === "KeyO") toggleLayer("toggleCoordinates");
  else if (code === "KeyW") toggleLayer("toggleCompass");
  else if (code === "KeyV") toggleLayer("toggleRivers");
  else if (code === "KeyF") toggleLayer("toggleRelief");
  else if (code === "KeyC") toggleLayer("toggleCultures");
  else if (code === "KeyS") toggleLayer("toggleStates");
  else if (code === "KeyP") toggleLayer("toggleProvinces");
  else if (code === "KeyZ") toggleLayer("toggleZones");
  else if (code === "KeyD") toggleLayer("toggleBorders");
  else if (code === "KeyR") toggleLayer("toggleReligions");
  else if (code === "KeyU") toggleLayer("toggleRoutes");
  else if (code === "KeyT") toggleLayer("toggleTemp");
  else if (code === "KeyN") toggleLayer("togglePopulation");
  else if (code === "KeyJ") toggleLayer("toggleIce");
  else if (code === "KeyA") toggleLayer("togglePrec");
  else if (code === "KeyY") toggleLayer("toggleEmblems");
  else if (code === "KeyL") toggleLayer("toggleLabels");
  else if (code === "KeyI") toggleLayer("toggleBurgs");
  else if (code === "KeyM") toggleLayer("toggleMilitary");
  else if (code === "KeyK") toggleLayer("toggleMarkers");
  else if (code === "Equal") toggleLayer("toggleRulers");
  else if (code === "Slash") toggleLayer("toggleScaleBar");
  else if (code === "ArrowLeft") Zoom.translateBy(svg, 10, 0);
  else if (code === "ArrowRight") Zoom.translateBy(svg, -10, 0);
  else if (code === "ArrowUp") Zoom.translateBy(svg, 0, 10);
  else if (code === "ArrowDown") Zoom.translateBy(svg, 0, -10);
  else if (key === "+" || key === "-") pressNumpadSign(key);
  else if (key === "0") Zoom.reset(1000);
  else if (key === "1") Zoom.scaleTo(svg, 1);
  else if (key === "2") Zoom.scaleTo(svg, 2);
  else if (key === "3") Zoom.scaleTo(svg, 3);
  else if (key === "4") Zoom.scaleTo(svg, 4);
  else if (key === "5") Zoom.scaleTo(svg, 5);
  else if (key === "6") Zoom.scaleTo(svg, 6);
  else if (key === "7") Zoom.scaleTo(svg, 7);
  else if (key === "8") Zoom.scaleTo(svg, 8);
  else if (key === "9") Zoom.scaleTo(svg, 9);
  else if (ctrl) toggleMode();
}

function allowHotkeys() {
  if (document.activeElement) {
    const {tagName, contentEditable} = document.activeElement as HTMLElement;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(tagName)) return false;
    if (tagName === "DIV" && contentEditable === "true") return false;
  }

  if (document.getSelection()?.toString()) return false;
  return true;
}

function getActionBrushInput() {
  if (byId("brushRadius")?.offsetParent) return byId("brushRadius");
  if (byId("biomesManuallyBrush")?.offsetParent) return byId("biomesManuallyBrush");
  if (byId("statesManuallyBrush")?.offsetParent) return byId("statesManuallyBrush");
  if (byId("provincesManuallyBrush")?.offsetParent) return byId("provincesManuallyBrush");
  if (byId("culturesManuallyBrush")?.offsetParent) return byId("culturesManuallyBrush");
  if (byId("zonesBrush")?.offsetParent) return byId("zonesBrush");
  if (byId("religionsManuallyBrush")?.offsetParent) return byId("religionsManuallyBrush");
  return null;
}

function pressNumpadSign(key: "+" | "-") {
  const brush = getActionBrushInput() as HTMLInputElement | null;
  if (brush) {
    const change = key === "+" ? 1 : -1;
    const value = String(minmax(+brush.value + change, +brush.min, +brush.max));
    brush.value = value;

    const numberInput = byId(brush.id + "Number") as HTMLInputElement | null;
    if (numberInput) numberInput.value = value;
  } else {
    // if no brush inputs visible, Zoom map
    const scaleBy = key === "+" ? 1.2 : 0.8;
    window.Zoom.scaleBy(svg, scaleBy);
  }
}

function toggleMode() {
  const $zonesRemove = byId("zonesRemove");
  if ($zonesRemove?.offsetParent) {
    $zonesRemove.classList.contains("pressed")
      ? $zonesRemove.classList.remove("pressed")
      : $zonesRemove.classList.add("pressed");
  }
}

function removeElementOnKey() {
  const dialogsWithFastDelete = document.querySelectorAll("[role='dialog'] .fastDelete");
  const $fastDelete = Array.from(dialogsWithFastDelete).find(
    dialog => (dialog as HTMLElement).style.display !== "none"
  ) as HTMLElement | undefined;
  if ($fastDelete) $fastDelete.click();

  const visibleDialogs = Array.from(document.querySelectorAll("[role='dialog']")).filter(
    dialog => (dialog as HTMLElement).style.display !== "none"
  );
  if (!visibleDialogs.length) return;

  visibleDialogs.forEach(dialog =>
    dialog.querySelectorAll("button").forEach(button => button.textContent === "Remove" && button.click())
  );
}

function closeAllDialogs() {
  closeDialogs();
  hideOptions();
}
