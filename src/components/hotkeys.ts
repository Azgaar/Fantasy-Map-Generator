import { Controllers } from "@/controllers";
import { Services } from "@/services";
import { toggleSaveReminder } from "@/services/autosave";
import { findEl, minmax } from "@/utils";
import { showInfo } from "./app-info";
import { closeDialogs } from "./dialog/dialog-helpers";
import { OptionsController } from "./options/options-controller";
import { changeMapZoom, panMap, setMapZoom } from "./zoom";

// Hotkeys, see github.com/Azgaar/Fantasy-Map-Generator/wiki/Hotkeys
document.addEventListener("keydown", handleKeydown);
document.addEventListener("keyup", handleKeyup);

function handleKeydown(event: KeyboardEvent): void {
  if (!allowHotkeys()) return; // in some cases (e.g. in a textarea) hotkeys are not allowed

  const { code, ctrlKey, altKey, shiftKey } = event;
  if (altKey && !ctrlKey && !shiftKey) event.preventDefault(); // disallow plain alt key combinations
  if (ctrlKey && ["KeyS", "KeyC"].includes(code)) event.preventDefault(); // disallow CTRL + S and CTRL + C
  if (["F1", "F2", "F6", "F9", "Tab"].includes(code)) event.preventDefault(); // disallow default Fn and Tab
}

function handleKeyup(event: KeyboardEvent): void {
  if (!allowHotkeys()) return; // in some cases (e.g. in a textarea) hotkeys are not allowed

  event.stopPropagation();

  const { code, key, ctrlKey, metaKey, shiftKey, altKey } = event;
  const ctrl = ctrlKey || metaKey || key === "Control";
  const shift = (shiftKey || key === "Shift") && !altKey;
  const altShift = altKey && (shiftKey || key === "Shift") && !ctrl;

  if (code === "F1") showInfo();
  else if (code === "F2") OptionsController.regenerate();
  else if (code === "F6") Services.Save.saveMap("storage");
  else if (code === "F9") Services.Load.quickLoad();
  else if (code === "Tab") OptionsController.toggle(event);
  else if (code === "Escape") {
    if (document.activeElement instanceof Element && document.activeElement.closest(".fmg-dialog")) return;
    closeDialogs();
    OptionsController.hide();
  } else if (code === "Delete") removeElementOnKey();
  else if (code === "KeyO" && findEl("canvas3d")) Controllers.View3d.toggleOptions();
  else if (ctrl && code === "KeyQ") toggleSaveReminder();
  else if (ctrl && code === "KeyS") Services.Save.saveMap("machine");
  else if (ctrl && code === "KeyC") Services.Save.saveMap("dropbox");
  else if (ctrl && code === "KeyZ") findEl("undo")?.click();
  else if (ctrl && code === "KeyY") findEl("redo")?.click();
  else if ((shift || altShift) && code === "KeyH") Controllers.HeightmapEditor.open();
  else if ((shift || altShift) && code === "KeyB") Controllers.BiomesEditor.open();
  else if ((shift || altShift) && code === "KeyS") Controllers.StatesEditor.open();
  else if ((shift || altShift) && code === "KeyP") Controllers.ProvincesEditor.open();
  else if ((shift || altShift) && code === "KeyD") Controllers.DiplomacyEditor.open();
  else if ((shift || altShift) && code === "KeyL") Controllers.LabelsOverview.open();
  else if ((shift || altShift) && code === "KeyC") Controllers.CulturesEditor.open();
  else if ((shift || altShift) && code === "KeyN") Controllers.NamesbaseEditor.open();
  else if ((shift || altShift) && code === "KeyZ") Controllers.ZonesEditor.open();
  else if ((shift || altShift) && code === "KeyR") Controllers.ReligionsEditor.open();
  else if ((shift || altShift) && code === "KeyY") Controllers.EmblemsEditor.openDefault();
  else if ((shift || altShift) && code === "KeyQ") Controllers.UnitsEditor.open();
  else if ((shift || altShift) && code === "KeyO") Controllers.NotesEditor.open();
  else if ((shift || altShift) && code === "KeyA") Controllers.ChartsOverview.open();
  else if ((shift || altShift) && code === "KeyT") Controllers.BurgsOverview.open();
  else if ((shift || altShift) && code === "KeyU") Controllers.RoutesOverview.open();
  else if ((shift || altShift) && code === "KeyV") Controllers.RiversOverview.open();
  else if ((shift || altShift) && code === "KeyM") Controllers.MilitaryOverview.open();
  else if ((shift || altShift) && code === "KeyK") Controllers.MarkersOverview.open();
  else if ((shift || altShift) && code === "KeyE") Controllers.CellInfo.open();
  else if ((shift || altShift) && code === "KeyG") Controllers.GoodsEditor.open();
  else if ((shift || altShift) && code === "Equal") Controllers.MeasurersEditor.open();
  else if (key === "!") Controllers.BurgCreator.toggle();
  else if (key === "@") Controllers.LabelCreator.toggle();
  else if (key === "#") Controllers.MarkerCreator.toggle();
  else if (key === "$") Controllers.RiverAutoCreator.toggle();
  else if (key === "%") Controllers.RouteCreator.open();
  else if (code === "KeyH") window.LayerControls.toggleLayer("toggleHeight");
  else if (code === "KeyQ") window.LayerControls.toggleLayer("toggleLakes");
  else if (code === "KeyB") window.LayerControls.toggleLayer("toggleBiomes");
  else if (code === "KeyE") window.LayerControls.toggleLayer("toggleCells");
  else if (code === "KeyG") window.LayerControls.toggleLayer("toggleGoods");
  else if (code === "Semicolon") window.LayerControls.toggleLayer("toggleGrid");
  else if (code === "KeyO") window.LayerControls.toggleLayer("toggleCoordinates");
  else if (code === "KeyW") window.LayerControls.toggleLayer("toggleCompass");
  else if (code === "KeyV") window.LayerControls.toggleLayer("toggleRivers");
  else if (code === "KeyF") window.LayerControls.toggleLayer("toggleRelief");
  else if (code === "KeyC") window.LayerControls.toggleLayer("toggleCultures");
  else if (code === "KeyS") window.LayerControls.toggleLayer("toggleStates");
  else if (code === "KeyP") window.LayerControls.toggleLayer("toggleProvinces");
  else if (code === "KeyZ") window.LayerControls.toggleLayer("toggleZones");
  else if (code === "KeyD") window.LayerControls.toggleLayer("toggleBorders");
  else if (code === "KeyR") window.LayerControls.toggleLayer("toggleReligions");
  else if (code === "KeyU") window.LayerControls.toggleLayer("toggleRoutes");
  else if (code === "KeyT") window.LayerControls.toggleLayer("toggleTemperature");
  else if (code === "KeyN") window.LayerControls.toggleLayer("togglePopulation");
  else if (code === "KeyJ") window.LayerControls.toggleLayer("toggleIce");
  else if (code === "KeyA") window.LayerControls.toggleLayer("togglePrecipitation");
  else if (code === "KeyY") window.LayerControls.toggleLayer("toggleEmblems");
  else if (code === "KeyL") window.LayerControls.toggleLayer("toggleLabels");
  else if (code === "KeyI") window.LayerControls.toggleLayer("toggleBurgIcons");
  else if (code === "KeyM") window.LayerControls.toggleLayer("toggleMilitary");
  else if (code === "KeyK") window.LayerControls.toggleLayer("toggleMarkers");
  else if (code === "Equal" && !customization) window.LayerControls.toggleLayer("toggleRulers");
  else if (code === "Slash") window.LayerControls.toggleLayer("toggleScaleBar");
  else if (code === "BracketLeft" && !handleBracketSizeChange(code)) window.LayerControls.toggleLayer("toggleVignette");
  else if (code === "BracketRight") handleBracketSizeChange(code);
  else if (code === "Backquote") window.LayerControls.toggleLayer("toggleTrade");
  else if (code === "ArrowLeft") panMap(10, 0);
  else if (code === "ArrowRight") panMap(-10, 0);
  else if (code === "ArrowUp") panMap(0, 10);
  else if (code === "ArrowDown") panMap(0, -10);
  else if (key === "+" || key === "-" || key === "=") handleSizeChange(key);
  else if (key === "0") resetZoom(1000);
  else if (key === "1") setMapZoom(1);
  else if (key === "2") setMapZoom(2);
  else if (key === "3") setMapZoom(3);
  else if (key === "4") setMapZoom(4);
  else if (key === "5") setMapZoom(5);
  else if (key === "6") setMapZoom(6);
  else if (key === "7") setMapZoom(7);
  else if (key === "8") setMapZoom(8);
  else if (key === "9") setMapZoom(9);
  else if (ctrl) findEl("zonesRemove")?.classList.toggle("pressed");
}

function allowHotkeys(): boolean {
  const activeElement = document.activeElement as HTMLElement | null;
  const tagName = activeElement?.tagName;
  const contentEditable = activeElement?.contentEditable;
  if (["INPUT", "SELECT", "TEXTAREA"].includes(tagName ?? "")) return false;
  if (tagName === "DIV" && contentEditable === "true") return false;
  if (document.getSelection()?.toString()) return false;
  return true;
}

// "+", "-" and "=" keys on numpad. "=" is for "+" on Mac
function handleSizeChange(key: string): void {
  let brush: HTMLInputElement | null = null;

  const brushIds = [
    "heightmapBrushRadius",
    "heightmapBrushPower",
    "heightmapLinePower",
    "biomesBrush",
    "culturesBrush",
    "statesBrush",
    "provincesBrush",
    "religionsBrush",
    "zonesBrush"
  ];
  brush = brushIds.map(id => findEl<HTMLInputElement>(id)).find(element => element?.offsetParent) ?? null;

  if (brush) {
    const change = key === "-" ? -5 : 5;
    const min = Number(brush.getAttribute("min")) || 5;
    const max = Number(brush.getAttribute("max")) || 100;
    const value = +brush.value + change;
    brush.value = String(minmax(value, min, max));
    return;
  }

  const scaleBy = key === "+" ? 1.2 : 0.8;
  changeMapZoom(scaleBy); // if no brush elements displayed, zoom map
}

function handleBracketSizeChange(code: string): boolean {
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

function removeElementOnKey(): void {
  const fastDelete = Array.from(document.querySelectorAll<HTMLElement>("[role='dialog'] .fastDelete")).find(
    dialog => dialog.style.display !== "none"
  );
  if (fastDelete) fastDelete.click();

  const visibleDialogs = Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']")).filter(
    dialog => dialog.style.display !== "none"
  );
  if (!visibleDialogs.length) return;

  visibleDialogs.forEach(dialog => {
    dialog.querySelectorAll("button").forEach(button => {
      if (button.textContent === "Remove") button.click();
    });
  });
}
