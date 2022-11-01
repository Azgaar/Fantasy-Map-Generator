"use strict";
// Hotkeys, see github.com/Azgaar/Fantasy-Map-Generator/wiki/Hotkeys
document.addEventListener("keydown", handleKeydown);
document.addEventListener("keyup", handleKeyup);

function handleKeydown(event) {
  if (!allowHotkeys()) return; // in some cases (e.g. in a textarea) hotkeys are not allowed

  const {code, ctrlKey, altKey} = event;
  if (altKey && !ctrlKey) event.preventDefault(); // disallow alt key combinations
  if (ctrlKey && ["KeyS", "KeyC"].includes(code)) event.preventDefault(); // disallow CTRL + S and CTRL + C
  if (["F1", "F2", "F6", "F9", "Tab"].includes(code)) event.preventDefault(); // disallow default Fn and Tab
}

function handleKeyup(event) {
  if (!modules.editors) return; // if editors are not loaded, do nothing
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
  else if (code === "KeyO" && document.getElementById("canvas3d")) toggle3dOptions();
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
  else if (code === "KeyX") toggleTexture();
  else if (code === "KeyH") toggleHeight();
  else if (code === "KeyB") toggleBiomes();
  else if (code === "KeyE") toggleCells();
  else if (code === "KeyG") toggleGrid();
  else if (code === "KeyO") toggleCoordinates();
  else if (code === "KeyW") toggleCompass();
  else if (code === "KeyV") toggleRivers();
  else if (code === "KeyF") toggleRelief();
  else if (code === "KeyC") toggleCultures();
  else if (code === "KeyS") toggleStates();
  else if (code === "KeyP") toggleProvinces();
  else if (code === "KeyZ") toggleZones();
  else if (code === "KeyD") toggleBorders();
  else if (code === "KeyR") toggleReligions();
  else if (code === "KeyU") toggleRoutes();
  else if (code === "KeyT") toggleTemp();
  else if (code === "KeyN") togglePopulation();
  else if (code === "KeyJ") toggleIce();
  else if (code === "KeyA") togglePrec();
  else if (code === "KeyY") toggleEmblems();
  else if (code === "KeyL") toggleLabels();
  else if (code === "KeyI") toggleIcons();
  else if (code === "KeyM") toggleMilitary();
  else if (code === "KeyK") toggleMarkers();
  else if (code === "Equal" && !customization) toggleRulers();
  else if (code === "Slash") toggleScaleBar();
  else if (code === "ArrowLeft") zoom.translateBy(svg, 10, 0);
  else if (code === "ArrowRight") zoom.translateBy(svg, -10, 0);
  else if (code === "ArrowUp") zoom.translateBy(svg, 0, 10);
  else if (code === "ArrowDown") zoom.translateBy(svg, 0, -10);
  else if (key === "+" || key === "-" || key === "=") handleSizeChange(key);
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

// "+", "-" and "=" keys on numpad. "=" is for "+" on Mac
function handleSizeChange(key) {
  let brush = null;

  if (document.getElementById("brushRadius")?.offsetParent) brush = document.getElementById("brushRadius");
  else if (document.getElementById("linePower")?.offsetParent) brush = document.getElementById("linePower");
  else if (document.getElementById("biomesManuallyBrush")?.offsetParent)
    brush = document.getElementById("biomesManuallyBrush");
  else if (document.getElementById("statesManuallyBrush")?.offsetParent)
    brush = document.getElementById("statesManuallyBrush");
  else if (document.getElementById("provincesManuallyBrush")?.offsetParent)
    brush = document.getElementById("provincesManuallyBrush");
  else if (document.getElementById("culturesManuallyBrush")?.offsetParent)
    brush = document.getElementById("culturesManuallyBrush");
  else if (document.getElementById("zonesBrush")?.offsetParent) brush = document.getElementById("zonesBrush");
  else if (document.getElementById("religionsManuallyBrush")?.offsetParent)
    brush = document.getElementById("religionsManuallyBrush");

  if (brush) {
    const change = key === "-" ? -5 : 5;
    const value = minmax(+brush.value + change, +brush.min, +brush.max);
    brush.value = document.getElementById(brush.id + "Number").value = value;
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
