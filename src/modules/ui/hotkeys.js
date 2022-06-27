import {byId} from "/src/utils/shorthands";
import {toggleLayer} from "/src/modules/ui/layers";

// Hotkeys, see github.com/Azgaar/Fantasy-Map-Generator/wiki/Hotkeys
document.on("keydown", handleKeydown);
document.on("keyup", handleKeyup);

function handleKeydown(event) {
  if (!allowHotkeys()) return; // in some cases (e.g. in a textarea) hotkeys are not allowed

  const {code, ctrlKey, altKey} = event;
  if (altKey && !ctrlKey) event.preventDefault(); // disallow alt key combinations
  if (ctrlKey && ["KeyS", "KeyC"].includes(code)) event.preventDefault(); // disallow CTRL + S and CTRL + C
  if (["F1", "F2", "F6", "F9", "Tab"].includes(code)) event.preventDefault(); // disallow default Fn and Tab
}

function handleKeyup(event) {
  if (!allowHotkeys()) return; // in some cases (e.g. in a textarea) hotkeys are not allowed

  event.stopPropagation();

  const {code, key, ctrlKey, metaKey, shiftKey, altKey} = event;
  const ctrl = ctrlKey || metaKey || key === "Control";
  const shift = shiftKey || key === "Shift";
  const alt = altKey || key === "Alt";

  if (code === "F1") showInfo();
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
  else if (ctrl && code === "KeyZ" && undo?.offsetParent) undo.click();
  else if (ctrl && code === "KeyY" && redo?.offsetParent) redo.click();
  else if (shift && code === "KeyH") editHeightmap();
  else if (shift && code === "KeyB") editBiomes();
  else if (shift && code === "KeyS") editStates();
  else if (shift && code === "KeyP") editProvinces();
  else if (shift && code === "KeyD") editDiplomacy();
  else if (shift && code === "KeyC") editCultures();
  else if (shift && code === "KeyN") editNamesbase();
  else if (shift && code === "KeyZ") editZones();
  else if (shift && code === "KeyR") editReligions();
  else if (shift && code === "KeyY") openEmblemEditor();
  else if (shift && code === "KeyQ") editUnits();
  else if (shift && code === "KeyO") editNotes();
  else if (shift && code === "KeyA") overviewCharts();
  else if (shift && code === "KeyT") overviewBurgs();
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
  else if (code === "KeyI") toggleLayer("toggleIcons");
  else if (code === "KeyM") toggleLayer("toggleMilitary");
  else if (code === "KeyK") toggleLayer("toggleMarkers");
  else if (code === "Equal") toggleLayer("toggleRulers");
  else if (code === "Slash") toggleLayer("toggleScaleBar");
  else if (code === "ArrowLeft") zoom.translateBy(svg, 10, 0);
  else if (code === "ArrowRight") zoom.translateBy(svg, -10, 0);
  else if (code === "ArrowUp") zoom.translateBy(svg, 0, 10);
  else if (code === "ArrowDown") zoom.translateBy(svg, 0, -10);
  else if (key === "+" || key === "-") pressNumpadSign(key);
  else if (key === "0") resetZoom(1000);
  else if (key === "1") zoom.scaleTo(svg, 1);
  else if (key === "2") zoom.scaleTo(svg, 2);
  else if (key === "3") zoom.scaleTo(svg, 3);
  else if (key === "4") zoom.scaleTo(svg, 4);
  else if (key === "5") zoom.scaleTo(svg, 5);
  else if (key === "6") zoom.scaleTo(svg, 6);
  else if (key === "7") zoom.scaleTo(svg, 7);
  else if (key === "8") zoom.scaleTo(svg, 8);
  else if (key === "9") zoom.scaleTo(svg, 9);
  else if (ctrl) toggleMode();
}

function allowHotkeys() {
  const {tagName, contentEditable} = document.activeElement;
  if (["INPUT", "SELECT", "TEXTAREA"].includes(tagName)) return false;
  if (tagName === "DIV" && contentEditable === "true") return false;
  if (document.getSelection().toString()) return false;
  return true;
}

function pressNumpadSign(key) {
  const change = key === "+" ? 1 : -1;
  let brush = null;

  if (byId("brushRadius")?.offsetParent) brush = byId("brushRadius");
  else if (byId("biomesManuallyBrush")?.offsetParent) brush = byId("biomesManuallyBrush");
  else if (byId("statesManuallyBrush")?.offsetParent) brush = byId("statesManuallyBrush");
  else if (byId("provincesManuallyBrush")?.offsetParent) brush = byId("provincesManuallyBrush");
  else if (byId("culturesManuallyBrush")?.offsetParent) brush = byId("culturesManuallyBrush");
  else if (byId("zonesBrush")?.offsetParent) brush = byId("zonesBrush");
  else if (byId("religionsManuallyBrush")?.offsetParent) brush = byId("religionsManuallyBrush");

  if (brush) {
    const value = minmax(+brush.value + change, +brush.min, +brush.max);
    brush.value = byId(brush.id + "Number").value = value;
    return;
  }

  const scaleBy = key === "+" ? 1.2 : 0.8;
  zoom.scaleBy(svg, scaleBy); // if no brush elements displayed, zoom map
}

function toggleMode() {
  if (zonesRemove?.offsetParent) {
    zonesRemove.classList.contains("pressed")
      ? zonesRemove.classList.remove("pressed")
      : zonesRemove.classList.add("pressed");
  }
}

function removeElementOnKey() {
  const fastDelete = Array.from(document.querySelectorAll("[role='dialog'] .fastDelete")).find(
    dialog => dialog.style.display !== "none"
  );
  if (fastDelete) fastDelete.click();

  const visibleDialogs = Array.from(document.querySelectorAll("[role='dialog']")).filter(
    dialog => dialog.style.display !== "none"
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
