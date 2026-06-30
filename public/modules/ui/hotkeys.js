"use strict";
// Hotkeys, see github.com/Azgaar/Fantasy-Map-Generator/wiki/Hotkeys
document.addEventListener("keydown", handleKeydown);
document.addEventListener("keyup", handleKeyup);

function handleKeydown(event) {
  if (!allowHotkeys()) return; // in some cases (e.g. in a textarea) hotkeys are not allowed

  const { code, ctrlKey, altKey, shiftKey } = event;
  if (altKey && !ctrlKey && !shiftKey) event.preventDefault(); // disallow plain alt key combinations
  if (ctrlKey && ["KeyS", "KeyC"].includes(code)) event.preventDefault(); // disallow CTRL + S and CTRL + C
  if (["F1", "F2", "F6", "F9", "Tab"].includes(code)) event.preventDefault(); // disallow default Fn and Tab
}

function handleKeyup(event) {
  if (!modules.editors) return; // if editors are not loaded, do nothing
  if (!allowHotkeys()) return; // in some cases (e.g. in a textarea) hotkeys are not allowed

  event.stopPropagation();

  const { code, key, ctrlKey, metaKey, shiftKey, altKey } = event;
  const ctrl = ctrlKey || metaKey || key === "Control";
  const shift = (shiftKey || key === "Shift") && !altKey;
  const altShift = altKey && (shiftKey || key === "Shift") && !ctrl;

  if (code === "F1") showInfo();
  else if (code === "F2") regeneratePrompt();
  else if (code === "F6") window.Services.Save.saveMap("storage");
  else if (code === "F9") window.Services.Load.quickLoad();
  else if (code === "Tab") toggleOptions(event);
  else if (code === "Escape") closeAllDialogs();
  else if (code === "Delete") removeElementOnKey();
  else if (code === "KeyO" && findEl("canvas3d")) window.Controllers.View3d.toggleOptions();
  else if (ctrl && code === "KeyQ") toggleSaveReminder();
  else if (ctrl && code === "KeyS") window.Services.Save.saveMap("machine");
  else if (ctrl && code === "KeyC") window.Services.Save.saveMap("dropbox");
  else if (ctrl && code === "KeyZ" && undo?.offsetParent) undo.click();
  else if (ctrl && code === "KeyY" && redo?.offsetParent) redo.click();
  else if ((shift || altShift) && code === "KeyH") editHeightmap();
  else if ((shift || altShift) && code === "KeyB") editBiomes();
  else if ((shift || altShift) && code === "KeyS") window.Controllers.StatesEditor.open();
  else if ((shift || altShift) && code === "KeyP") editProvinces();
  else if ((shift || altShift) && code === "KeyD") editDiplomacy();
  else if ((shift || altShift) && code === "KeyL") window.Controllers.CoastlineEditor.open();
  else if ((shift || altShift) && code === "KeyC") window.Controllers.CulturesEditor.open();
  else if ((shift || altShift) && code === "KeyN") window.Controllers.NamesbaseEditor.open();
  else if ((shift || altShift) && code === "KeyZ") editZones();
  else if ((shift || altShift) && code === "KeyR") window.Controllers.ReligionsEditor.open();
  else if ((shift || altShift) && code === "KeyY") openEmblemEditor();
  else if ((shift || altShift) && code === "KeyQ") editUnits();
  else if ((shift || altShift) && code === "KeyO") editNotes();
  else if ((shift || altShift) && code === "KeyA") window.Controllers.ChartsOverview.open();
  else if ((shift || altShift) && code === "KeyT") window.Controllers.BurgsOverview.open();
  else if ((shift || altShift) && code === "KeyU") window.Controllers.RoutesOverview.open();
  else if ((shift || altShift) && code === "KeyV") window.Controllers.RiversOverview.open();
  else if ((shift || altShift) && code === "KeyM") window.Controllers.MilitaryOverview.open();
  else if ((shift || altShift) && code === "KeyK") overviewMarkers();
  else if ((shift || altShift) && code === "KeyE") viewCellDetails();
  else if ((shift || altShift) && code === "KeyG") window.Controllers.GoodsEditor.open();
  else if (key === "!") toggleAddBurg();
  else if (key === "@") toggleAddLabel();
  else if (key === "#") toggleAddRiver();
  else if (key === "$") window.Controllers.RouteCreator.open();
  else if (key === "%") toggleAddMarker();
  else if (code === "KeyX") toggleTexture();
  else if (code === "KeyH") toggleHeight();
  else if (code === "KeyQ") toggleLakes();
  else if (code === "KeyB") toggleBiomes();
  else if (code === "KeyE") toggleCells();
  else if (code === "KeyG") toggleGoods();
  else if (code === "Semicolon") toggleGrid();
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
  else if (code === "KeyT") toggleTemperature();
  else if (code === "KeyN") togglePopulation();
  else if (code === "KeyJ") toggleIce();
  else if (code === "KeyA") togglePrecipitation();
  else if (code === "KeyY") toggleEmblems();
  else if (code === "KeyL") toggleLabels();
  else if (code === "KeyI") toggleBurgIcons();
  else if (code === "KeyM") toggleMilitary();
  else if (code === "KeyK") toggleMarkers();
  else if (code === "Equal" && !customization) toggleRulers();
  else if (code === "Slash") toggleScaleBar();
  else if (code === "BracketLeft" && !handleBracketSizeChange(code)) toggleVignette();
  else if (code === "BracketRight") handleBracketSizeChange(code);
  else if (code === "Backquote") toggleTrade();
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
  const { tagName, contentEditable } = document.activeElement;
  if (["INPUT", "SELECT", "TEXTAREA"].includes(tagName)) return false;
  if (tagName === "DIV" && contentEditable === "true") return false;
  if (document.getSelection().toString()) return false;
  return true;
}

// "+", "-" and "=" keys on numpad. "=" is for "+" on Mac
function handleSizeChange(key) {
  let brush = null;

  if (findEl("heightmapBrushRadius")?.offsetParent) brush = findEl("heightmapBrushRadius");
  else if (findEl("heightmapBrushPower")?.offsetParent) brush = findEl("heightmapBrushPower");
  else if (findEl("heightmapLinePower")?.offsetParent) brush = findEl("heightmapLinePower");
  else if (findEl("biomesBrush")?.offsetParent) brush = findEl("biomesBrush");
  else if (findEl("culturesBrush")?.offsetParent) brush = findEl("culturesBrush");
  else if (findEl("statesBrush")?.offsetParent) brush = findEl("statesBrush");
  else if (findEl("provincesBrush")?.offsetParent) brush = findEl("provincesBrush");
  else if (findEl("religionsBrush")?.offsetParent) brush = findEl("religionsBrush");
  else if (findEl("zonesBrush")?.offsetParent) brush = findEl("zonesBrush");

  if (brush) {
    const change = key === "-" ? -5 : 5;
    const min = +brush.getAttribute("min") || 5;
    const max = +brush.getAttribute("max") || 100;
    const value = +brush.value + change;
    brush.value = minmax(value, min, max);
    return;
  }

  const scaleBy = key === "+" ? 1.2 : 0.8;
  zoom.scaleBy(svg, scaleBy); // if no brush elements displayed, zoom map
}

function handleBracketSizeChange(code) {
  const isHeightmapBrushPressed = Boolean(findEl("brushesButtons")?.querySelector("button.pressed"));
  const hasActiveBrush =
    isHeightmapBrushPressed ||
    findEl("heightmapBrushRadius")?.offsetParent ||
    findEl("heightmapBrushPower")?.offsetParent ||
    findEl("heightmapLinePower")?.offsetParent ||
    findEl("biomesBrush")?.offsetParent ||
    findEl("culturesBrush")?.offsetParent ||
    findEl("statesBrush")?.offsetParent ||
    findEl("provincesBrush")?.offsetParent ||
    findEl("religionsBrush")?.offsetParent ||
    findEl("zonesBrush")?.offsetParent;

  if (!hasActiveBrush) return false;

  handleSizeChange(code === "BracketLeft" ? "-" : "+");
  return true;
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
