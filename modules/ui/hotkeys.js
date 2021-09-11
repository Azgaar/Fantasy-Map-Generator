"use strict";
// Hotkeys, see github.com/Azgaar/Fantasy-Map-Generator/wiki/Hotkeys

// prevent default browser behavior for FMG-used hotkeys
document.addEventListener("keydown", event => {
  if (event.altKey && event.keyCode !== 18) event.preventDefault(); // disallow alt key combinations
  if (event.ctrlKey && event.code === "KeyS") event.preventDefault(); // disallow CTRL + C
  if ([112, 113, 117, 120, 9].includes(event.keyCode)) event.preventDefault(); // F1, F2, F6, F9, Tab
});

document.addEventListener("keyup", event => {
  if (!window.closeDialogs) return; // not all modules are loaded
  const canvas3d = document.getElementById("canvas3d"); // check if 3d mode is active
  const active = document.activeElement.tagName;
  if (active === "INPUT" || active === "SELECT" || active === "TEXTAREA") return; // don't trigger if user inputs a text
  if (active === "DIV" && document.activeElement.contentEditable === "true") return; // don't trigger if user inputs a text
  event.stopPropagation();

  const key = event.keyCode;
  const ctrl = event.ctrlKey || event.metaKey || key === 17;
  const shift = event.shiftKey || key === 16;
  const alt = event.altKey || key === 18;

  // prettier-ignore
  if (key === 112) showInfo(); // "F1" to show info
  else if (key === 113) regeneratePrompt(); // "F2" for new map
  else if (key === 113) regeneratePrompt(); // "F2" for a new map
  else if (key === 117) quickSave(); // "F6" for quick save
  else if (key === 120) quickLoad(); // "F9" for quick load
  else if (key === 9) toggleOptions(event); // Tab to toggle options
  else if (key === 27) {closeDialogs(); hideOptions();} // Escape to close all dialogs
  else if (key === 46) removeElementOnKey(); // "Delete" to remove the selected element
  else if (key === 79 && canvas3d) toggle3dOptions(); // "O" to toggle 3d options
  else if (ctrl && key === 81) toggleSaveReminder(); // Ctrl + "Q" to toggle save reminder
  else if (ctrl && key === 83) dowloadMap(); // Ctrl + "S" to save .map file
  else if (undo.offsetParent && ctrl && key === 90) undo.click(); // Ctrl + "Z" to undo
  else if (redo.offsetParent && ctrl && key === 89) redo.click(); // Ctrl + "Y" to redo
  else if (shift && key === 72) editHeightmap(); // Shift + "H" to edit Heightmap
  else if (shift && key === 66) editBiomes(); // Shift + "B" to edit Biomes
  else if (shift && key === 83) editStates(); // Shift + "S" to edit States
  else if (shift && key === 80) editProvinces(); // Shift + "P" to edit Provinces
  else if (shift && key === 68) editDiplomacy(); // Shift + "D" to edit Diplomacy
  else if (shift && key === 67) editCultures(); // Shift + "C" to edit Cultures
  else if (shift && key === 78) editNamesbase(); // Shift + "N" to edit Namesbase
  else if (shift && key === 90) editZones(); // Shift + "Z" to edit Zones
  else if (shift && key === 82) editReligions(); // Shift + "R" to edit Religions
  else if (shift && key === 89) openEmblemEditor(); // Shift + "Y" to edit Emblems
  else if (shift && key === 81) editUnits(); // Shift + "Q" to edit Units
  else if (shift && key === 79) editNotes(); // Shift + "O" to edit Notes
  else if (shift && key === 84) overviewBurgs(); // Shift + "T" to open Burgs overview
  else if (shift && key === 86) overviewRivers(); // Shift + "V" to open Rivers overview
  else if (shift && key === 77) overviewMilitary(); // Shift + "M" to open Military overview
  else if (shift && key === 69) viewCellDetails(); // Shift + "E" to open Cell Details
  else if (shift && key === 49) toggleAddBurg(); // Shift + "1" to click to add Burg
  else if (shift && key === 50) toggleAddLabel(); // Shift + "2" to click to add Label
  else if (shift && key === 51) toggleAddRiver(); // Shift + "3" to click to add River
  else if (shift && key === 52) toggleAddRoute(); // Shift + "4" to click to add Route
  else if (shift && key === 53) toggleAddMarker();// Shift + "5" to click to add Marker
  else if (alt && key === 66) console.table(pack.burgs); // Alt + "B" to log burgs data
  else if (alt && key === 83) console.table(pack.states); // Alt + "S" to log states data
  else if (alt && key === 67) console.table(pack.cultures); // Alt + "C" to log cultures data
  else if (alt && key === 82) console.table(pack.religions); // Alt + "R" to log religions data
  else if (alt && key === 70) console.table(pack.features); // Alt + "F" to log features data
  else if (key === 88) toggleTexture(); // "X" to toggle Texture layer
  else if (key === 72) toggleHeight(); // "H" to toggle Heightmap layer
  else if (key === 66) toggleBiomes(); // "B" to toggle Biomes layer
  else if (key === 69) toggleCells(); // "E" to toggle Cells layer
  else if (key === 71) toggleGrid(); // "G" to toggle Grid layer
  else if (key === 79) toggleCoordinates(); // "O" to toggle Coordinates layer
  else if (key === 87) toggleCompass(); // "W" to toggle Compass Rose layer
  else if (key === 86) toggleRivers(); // "V" to toggle Rivers layer
  else if (key === 70) toggleRelief();// "F" to toggle Relief icons layer
  else if (key === 67) toggleCultures(); // "C" to toggle Cultures layer
  else if (key === 83) toggleStates(); // "S" to toggle States layer
  else if (key === 80) toggleProvinces(); // "P" to toggle Provinces layer
  else if (key === 90) toggleZones(); // "Z" to toggle Zones
  else if (key === 68) toggleBorders(); // "D" to toggle Borders layer
  else if (key === 82) toggleReligions(); // "R" to toggle Religions layer
  else if (key === 85) toggleRoutes(); // "U" to toggle Routes layer
  else if (key === 84) toggleTemp(); // "T" to toggle Temperature layer
  else if (key === 78) togglePopulation();  // "N" to toggle Population layer
  else if (key === 74) toggleIce(); // "J" to toggle Ice layer
  else if (key === 65) togglePrec(); // "A" to toggle Precipitation layer
  else if (key === 89) toggleEmblems(); // "Y" to toggle Emblems layer
  else if (key === 76) toggleLabels(); // "L" to toggle Labels layer
  else if (key === 73) toggleIcons(); // "I" to toggle Icons layer
  else if (key === 77) toggleMilitary(); // "M" to toggle Military layer
  else if (key === 75) toggleMarkers(); // "K" to toggle Markers layer
  else if (key === 187) toggleRulers(); // Equal (=) to toggle Rulers
  else if (key === 189) toggleScaleBar(); // Minus (-) to toggle Scale bar
  else if (key === 37) zoom.translateBy(svg, 10, 0); // Left to scroll map left
  else if (key === 39) zoom.translateBy(svg, -10, 0); // Right to scroll map right
  else if (key === 38) zoom.translateBy(svg, 0, 10); // Up to scroll map up
  else if (key === 40) zoom.translateBy(svg, 0, -10); // Up to scroll map up
  else if (key === 107 || key === 109) pressNumpadSign(key); // Numpad Plus/Minus to zoom map or change brush size
  else if (key === 48 || key === 96) resetZoom(1000); // 0 to reset zoom
  else if (key === 49 || key === 97) zoom.scaleTo(svg, 1); // 1 to zoom to 1
  else if (key === 50 || key === 98) zoom.scaleTo(svg, 2); // 2 to zoom to 2
  else if (key === 51 || key === 99) zoom.scaleTo(svg, 3); // 3 to zoom to 3
  else if (key === 52 || key === 100) zoom.scaleTo(svg, 4); // 4 to zoom to 4
  else if (key === 53 || key === 101) zoom.scaleTo(svg, 5); // 5 to zoom to 5
  else if (key === 54 || key === 102) zoom.scaleTo(svg, 6); // 6 to zoom to 6
  else if (key === 55 || key === 103) zoom.scaleTo(svg, 7); // 7 to zoom to 7
  else if (key === 56 || key === 104) zoom.scaleTo(svg, 8); // 8 to zoom to 8
  else if (key === 57 || key === 105) zoom.scaleTo(svg, 9); // 9 to zoom to 9
  else if (ctrl) pressControl(); // Control to toggle mode
});

function pressNumpadSign(key) {
  // if brush sliders are displayed, decrease brush size
  let brush = null;
  const d = key === 107 ? 1 : -1;

  if (brushRadius.offsetParent) brush = document.getElementById("brushRadius");
  else if (biomesManuallyBrush.offsetParent) brush = document.getElementById("biomesManuallyBrush");
  else if (statesManuallyBrush.offsetParent) brush = document.getElementById("statesManuallyBrush");
  else if (provincesManuallyBrush.offsetParent) brush = document.getElementById("provincesManuallyBrush");
  else if (culturesManuallyBrush.offsetParent) brush = document.getElementById("culturesManuallyBrush");
  else if (zonesBrush.offsetParent) brush = document.getElementById("zonesBrush");
  else if (religionsManuallyBrush.offsetParent) brush = document.getElementById("religionsManuallyBrush");

  if (brush) {
    const value = Math.max(Math.min(+brush.value + d, +brush.max), +brush.min);
    brush.value = document.getElementById(brush.id + "Number").value = value;
    return;
  }

  const scaleBy = key === 107 ? 1.2 : 0.8;
  zoom.scaleBy(svg, scaleBy); // if no, zoom map
}

function pressControl() {
  if (zonesRemove.offsetParent) {
    zonesRemove.classList.contains("pressed") ? zonesRemove.classList.remove("pressed") : zonesRemove.classList.add("pressed");
  }
}

// trigger trash button click on "Delete" keypress
function removeElementOnKey() {
  $(".dialog:visible .fastDelete").click();
  $("button:visible:contains('Remove')").click();
}
