"use strict";
// Hotkeys, see github.com/Azgaar/Fantasy-Map-Generator/wiki/Hotkeys
document.addEventListener("keydown", handleKeydown);
document.addEventListener("keyup", handleKeyup);

function handleKeydown(event) {
  const {key, code, ctrlKey, altKey} = event;
  if (altKey && !ctrlKey) event.preventDefault(); // disallow alt key combinations
  if (ctrlKey && ["KeyS", "KeyC"].includes(code)) event.preventDefault(); // disallow CTRL + S and CTRL + C
  if (["F1", "F2", "F6", "F9", "Tab"].includes(key)) event.preventDefault(); // disallow default Fn and Tab
}

function handleKeyup(event) {
  if (!modules.editors) return; // if editors are not loaded, do nothing

  const {tagName, contentEditable} = document.activeElement;
  if (["INPUT", "SELECT", "TEXTAREA"].includes(tagName)) return; // don't trigger if user inputs text
  if (tagName === "DIV" && contentEditable === "true") return; // don't trigger if user inputs a text
  if (document.getSelection().toString()) return; // don't trigger if user selects text
  event.stopPropagation();

  const {ctrlKey, metaKey, shiftKey, altKey} = event;
  const key = event.key.toUpperCase();
  const ctrl = ctrlKey || metaKey || key === "Control";
  const shift = shiftKey || key === "Shift";
  const alt = altKey || key === "Alt";

  if (key === "F1") showInfo();
  else if (key === "F2") regeneratePrompt("hotkey");
  else if (key === "F6") quickSave();
  else if (key === "F9") quickLoad();
  else if (key === "TAB") toggleOptions(event);
  else if (key === "ESCAPE") closeAllDialogs();
  else if (key === "DELETE") removeElementOnKey();
  else if (key === "O" && document.getElementById("canvas3d")) toggle3dOptions();
  else if (ctrl && key === "Q") toggleSaveReminder();
  else if (ctrl && key === "S") dowloadMap();
  else if (ctrl && key === "C") saveToDropbox();
  else if (ctrl && key === "Z" && undo.offsetParent) undo.click();
  else if (ctrl && key === "Y" && redo.offsetParent) redo.click();
  else if (shift && key === "H") editHeightmap();
  else if (shift && key === "B") editBiomes();
  else if (shift && key === "S") editStates();
  else if (shift && key === "P") editProvinces();
  else if (shift && key === "D") editDiplomacy();
  else if (shift && key === "C") editCultures();
  else if (shift && key === "N") editNamesbase();
  else if (shift && key === "Z") editZones();
  else if (shift && key === "R") editReligions();
  else if (shift && key === "Y") openEmblemEditor();
  else if (shift && key === "Q") editUnits();
  else if (shift && key === "O") editNotes();
  else if (shift && key === "T") overviewBurgs();
  else if (shift && key === "V") overviewRivers();
  else if (shift && key === "M") overviewMilitary();
  else if (shift && key === "K") overviewMarkers();
  else if (shift && key === "E") viewCellDetails();
  else if (shift && key === "1") toggleAddBurg();
  else if (shift && key === "2") toggleAddLabel();
  else if (shift && key === "3") toggleAddRiver();
  else if (shift && key === "4") toggleAddRoute();
  else if (shift && key === "5") toggleAddMarker();
  else if (alt && key === "B") console.table(pack.burgs);
  else if (alt && key === "S") console.table(pack.states);
  else if (alt && key === "C") console.table(pack.cultures);
  else if (alt && key === "R") console.table(pack.religions);
  else if (alt && key === "F") console.table(pack.features);
  else if (key === "X") toggleTexture();
  else if (key === "H") toggleHeight();
  else if (key === "B") toggleBiomes();
  else if (key === "E") toggleCells();
  else if (key === "G") toggleGrid();
  else if (key === "O") toggleCoordinates();
  else if (key === "W") toggleCompass();
  else if (key === "V") toggleRivers();
  else if (key === "F") toggleRelief();
  else if (key === "C") toggleCultures();
  else if (key === "S") toggleStates();
  else if (key === "P") toggleProvinces();
  else if (key === "Z") toggleZones();
  else if (key === "D") toggleBorders();
  else if (key === "R") toggleReligions();
  else if (key === "U") toggleRoutes();
  else if (key === "T") toggleTemp();
  else if (key === "N") togglePopulation();
  else if (key === "J") toggleIce();
  else if (key === "A") togglePrec();
  else if (key === "Y") toggleEmblems();
  else if (key === "L") toggleLabels();
  else if (key === "I") toggleIcons();
  else if (key === "M") toggleMilitary();
  else if (key === "K") toggleMarkers();
  else if (key === "=") toggleRulers();
  else if (key === "/") toggleScaleBar();
  else if (key === "ARROWLEFT") zoom.translateBy(svg, 10, 0);
  else if (key === "ARROWRIGHT") zoom.translateBy(svg, -10, 0);
  else if (key === "ARROWUP") zoom.translateBy(svg, 0, 10);
  else if (key === "ARROWDOWN") zoom.translateBy(svg, 0, -10);
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

function pressNumpadSign(key) {
  const change = key === "+" ? 1 : -1;
  let brush = null;

  if (brushRadius.offsetParent) brush = document.getElementById("brushRadius");
  else if (biomesManuallyBrush.offsetParent) brush = document.getElementById("biomesManuallyBrush");
  else if (statesManuallyBrush.offsetParent) brush = document.getElementById("statesManuallyBrush");
  else if (provincesManuallyBrush.offsetParent) brush = document.getElementById("provincesManuallyBrush");
  else if (culturesManuallyBrush.offsetParent) brush = document.getElementById("culturesManuallyBrush");
  else if (zonesBrush.offsetParent) brush = document.getElementById("zonesBrush");
  else if (religionsManuallyBrush.offsetParent) brush = document.getElementById("religionsManuallyBrush");

  if (brush) {
    const value = Math.max(Math.min(+brush.value + change, +brush.max), +brush.min);
    brush.value = document.getElementById(brush.id + "Number").value = value;
    return;
  }

  const scaleBy = key === "+" ? 1.2 : 0.8;
  zoom.scaleBy(svg, scaleBy); // if no brush elements displayed, zoom map
}

function toggleMode() {
  if (zonesRemove.offsetParent) {
    zonesRemove.classList.contains("pressed") ? zonesRemove.classList.remove("pressed") : zonesRemove.classList.add("pressed");
  }
}

function removeElementOnKey() {
  const fastDelete = Array.from(document.querySelectorAll("[role='dialog'] .fastDelete")).find(dialog => dialog.style.display !== "none");
  if (fastDelete) fastDelete.click();

  const visibleDialogs = Array.from(document.querySelectorAll("[role='dialog']")).filter(dialog => dialog.style.display !== "none");
  if (!visibleDialogs.length) return;

  visibleDialogs.forEach(dialog => dialog.querySelectorAll("button").forEach(button => button.textContent === "Remove" && button.click()));
}

function closeAllDialogs() {
  closeDialogs();
  hideOptions();
}
