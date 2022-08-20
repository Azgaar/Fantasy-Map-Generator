import * as d3 from "d3";

import {tip} from "scripts/tooltips";
import {getBase64} from "utils/functionUtils";
import {isCtrlPressed} from "utils/keyboardUtils";
import {openDialog} from "dialogs";
// @ts-expect-error js module
import {calculateFriendlyGridSize, editStyle, shiftCompass} from "modules/ui/style";
import {getInputNumber, getInputValue} from "utils/nodeUtils";
import {renderLayer} from "./renderers";
import {layerIsOn, turnLayerButtonOff, turnLayerButtonOn} from "./utils";

const layerTogglesMap = {
  toggleBiomes,
  toggleBorders,
  toggleCells,
  toggleCompass,
  toggleCoordinates,
  toggleCultures,
  toggleEmblems,
  toggleGrid,
  toggleHeight,
  toggleIce,
  toggleBurgs,
  toggleLabels,
  toggleMarkers,
  toggleMilitary,
  togglePopulation,
  togglePrec,
  toggleProvinces,
  toggleRelief,
  toggleReligions,
  toggleRivers,
  toggleRoutes,
  toggleRulers,
  toggleScaleBar,
  toggleStates,
  toggleTemp,
  toggleTexture,
  toggleZones
};

type TLayerToggle = keyof typeof layerTogglesMap;

export function toggleLayer(toggleId: TLayerToggle) {
  layerTogglesMap[toggleId]();
}

export function toggleLayerOnClick(event: Event) {
  const targetId = (event.target as HTMLButtonElement)?.id;
  if (!targetId || targetId === "mapLayers" || !(targetId in layerTogglesMap)) return;
  layerTogglesMap[targetId as TLayerToggle](event as MouseEvent);
}

function toggleHeight(event?: MouseEvent) {
  if (customization === 1) {
    tip("You cannot turn off the layer when heightmap is in edit mode", false, "error");
    return;
  }

  if (!terrs.selectAll("*").size()) {
    turnLayerButtonOn("toggleHeight");
    renderLayer("heightmap");
    if (isCtrlPressed(event)) editStyle("terrs");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("terrs");
      return;
    }
    turnLayerButtonOff("toggleHeight");
    terrs.selectAll("*").remove();
  }
}

function toggleTemp(event?: MouseEvent) {
  if (!temperature.selectAll("*").size()) {
    turnLayerButtonOn("toggleTemp");
    renderLayer("temperature");
    if (isCtrlPressed(event)) editStyle("temperature");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("temperature");
      return;
    }
    turnLayerButtonOff("toggleTemp");
    temperature.selectAll("*").remove();
  }
}

function toggleBiomes(event?: MouseEvent) {
  if (!biomes.selectAll("path").size()) {
    turnLayerButtonOn("toggleBiomes");
    renderLayer("biomes");
    if (isCtrlPressed(event)) editStyle("biomes");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("biomes");
      return;
    }
    biomes.selectAll("path").remove();
    turnLayerButtonOff("toggleBiomes");
  }
}

function togglePrec(event?: MouseEvent) {
  if (!prec.selectAll("circle").size()) {
    turnLayerButtonOn("togglePrec");
    renderLayer("precipitation");
    if (isCtrlPressed(event)) editStyle("prec");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("prec");
      return;
    }
    turnLayerButtonOff("togglePrec");
    const hide = d3.transition().duration(1000).ease(d3.easeSinIn);
    prec.selectAll("text").attr("opacity", 1).transition(hide).attr("opacity", 0);
    prec.selectAll("circle").transition(hide).attr("r", 0).remove();
    prec.transition().delay(1000).style("display", "none");
  }
}

function togglePopulation(event?: MouseEvent) {
  if (!population.selectAll("line").size()) {
    turnLayerButtonOn("togglePopulation");
    renderLayer("population");
    if (isCtrlPressed(event)) editStyle("population");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("population");
      return;
    }
    turnLayerButtonOff("togglePopulation");
    const isD3data = population.select("line").datum();
    if (!isD3data) {
      // just remove
      population.selectAll("line").remove();
    } else {
      // remove with animation
      const hide = d3.transition().duration(1000).ease(d3.easeSinIn);
      population
        .select("#rural")
        .selectAll("line")
        .transition(hide)
        .attr("y2", (d: any[]) => d[1])
        .remove();
      population
        .select("#urban")
        .selectAll("line")
        .transition(hide)
        .delay(1000)
        .attr("y2", (d: any[]) => d[1])
        .remove();
    }
  }
}

function toggleCells(event?: MouseEvent) {
  if (!viewbox.select("#cells").selectAll("path").size()) {
    turnLayerButtonOn("toggleCells");
    renderLayer("cells");
    if (isCtrlPressed(event)) editStyle("cells");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("cells");
      return;
    }
    viewbox.select("#cells").selectAll("path").remove();
    turnLayerButtonOff("toggleCells");
  }
}

function toggleIce(event?: MouseEvent) {
  if (!layerIsOn("toggleIce")) {
    turnLayerButtonOn("toggleIce");
    $("#ice").fadeIn();
    if (!ice.selectAll("*").size()) renderLayer("ice");
    if (isCtrlPressed(event)) editStyle("ice");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("ice");
      return;
    }
    $("#ice").fadeOut();
    turnLayerButtonOff("toggleIce");
  }
}

function toggleCultures(event?: MouseEvent) {
  const cultures = pack.cultures.filter(({i, removed}) => i && !removed);
  const empty = !cults.selectAll("path").size();
  if (empty && cultures.length) {
    turnLayerButtonOn("toggleCultures");
    renderLayer("cultures");
    if (isCtrlPressed(event)) editStyle("cults");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("cults");
      return;
    }
    cults.selectAll("path").remove();
    turnLayerButtonOff("toggleCultures");
  }
}

function toggleReligions(event?: MouseEvent) {
  const religions = pack.religions.filter(({i, removed}) => i && !removed);
  if (!relig.selectAll("path").size() && religions.length) {
    turnLayerButtonOn("toggleReligions");
    renderLayer("religions");
    if (isCtrlPressed(event)) editStyle("relig");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("relig");
      return;
    }
    relig.selectAll("path").remove();
    turnLayerButtonOff("toggleReligions");
  }
}

function toggleStates(event?: MouseEvent) {
  if (!layerIsOn("toggleStates")) {
    turnLayerButtonOn("toggleStates");
    regions.style("display", null);
    renderLayer("states");
    if (isCtrlPressed(event)) editStyle("regions");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("regions");
      return;
    }
    regions.style("display", "none").selectAll("path").remove();
    turnLayerButtonOff("toggleStates");
  }
}

function toggleBorders(event?: MouseEvent) {
  if (!layerIsOn("toggleBorders")) {
    turnLayerButtonOn("toggleBorders");
    renderLayer("borders");
    if (isCtrlPressed(event)) editStyle("borders");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("borders");
      return;
    }
    turnLayerButtonOff("toggleBorders");
    borders.selectAll("path").remove();
  }
}

function toggleProvinces(event?: MouseEvent) {
  if (!layerIsOn("toggleProvinces")) {
    turnLayerButtonOn("toggleProvinces");
    renderLayer("provinces");
    if (isCtrlPressed(event)) editStyle("provs");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("provs");
      return;
    }
    provs.selectAll("*").remove();
    turnLayerButtonOff("toggleProvinces");
  }
}

function toggleGrid(event?: MouseEvent) {
  if (!gridOverlay.selectAll("*").size()) {
    turnLayerButtonOn("toggleGrid");
    renderLayer("grid");
    calculateFriendlyGridSize();

    if (isCtrlPressed(event)) editStyle("gridOverlay");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("gridOverlay");
      return;
    }
    turnLayerButtonOff("toggleGrid");
    gridOverlay.selectAll("*").remove();
  }
}

function toggleCoordinates(event?: MouseEvent) {
  if (!coordinates.selectAll("*").size()) {
    turnLayerButtonOn("toggleCoordinates");
    renderLayer("coordinates");
    if (isCtrlPressed(event)) editStyle("coordinates");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("coordinates");
      return;
    }
    turnLayerButtonOff("toggleCoordinates");
    coordinates.selectAll("*").remove();
  }
}

function toggleCompass(event?: MouseEvent) {
  if (!layerIsOn("toggleCompass")) {
    turnLayerButtonOn("toggleCompass");
    $("#compass").fadeIn();
    if (!compass.selectAll("*").size()) {
      compass.append("use").attr("xlink:href", "#rose");
      shiftCompass();
    }
    if (isCtrlPressed(event)) editStyle("compass");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("compass");
      return;
    }
    $("#compass").fadeOut();
    turnLayerButtonOff("toggleCompass");
  }
}

function toggleRelief(event?: MouseEvent) {
  if (!layerIsOn("toggleRelief")) {
    turnLayerButtonOn("toggleRelief");
    if (!terrain.selectAll("*").size()) window.ReliefIcons();
    $("#terrain").fadeIn();
    if (isCtrlPressed(event)) editStyle("terrain");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("terrain");
      return;
    }
    $("#terrain").fadeOut();
    turnLayerButtonOff("toggleRelief");
  }
}

function toggleTexture(event?: MouseEvent) {
  if (!layerIsOn("toggleTexture")) {
    turnLayerButtonOn("toggleTexture");
    // append default texture image selected by default. Don't append on load to not harm performance
    if (!texture.selectAll("*").size()) {
      const x = getInputNumber("styleTextureShiftX");
      const y = getInputNumber("styleTextureShiftY");

      const image = texture
        .append("image")
        .attr("id", "textureImage")
        .attr("x", x)
        .attr("y", y)
        .attr("width", graphWidth - x)
        .attr("height", graphHeight - y)
        .attr("preserveAspectRatio", "xMidYMid slice");
      getBase64(getInputValue("styleTextureInput"), base64 => image.attr("xlink:href", base64));
    }
    $("#texture").fadeIn();
    window.Zoom.force;
    if (isCtrlPressed(event)) editStyle("texture");
  } else {
    if (isCtrlPressed(event)) return editStyle("texture");
    $("#texture").fadeOut();
    turnLayerButtonOff("toggleTexture");
  }
}

function toggleRivers(event?: MouseEvent) {
  if (!layerIsOn("toggleRivers")) {
    turnLayerButtonOn("toggleRivers");
    renderLayer("rivers", pack);
    if (isCtrlPressed(event)) editStyle("rivers");
  } else {
    if (isCtrlPressed(event)) return editStyle("rivers");
    rivers.selectAll("*").remove();
    turnLayerButtonOff("toggleRivers");
  }
}

function toggleRoutes(event?: MouseEvent) {
  if (!layerIsOn("toggleRoutes")) {
    turnLayerButtonOn("toggleRoutes");
    $("#routes").fadeIn();
    if (isCtrlPressed(event)) editStyle("routes");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("routes");
      return;
    }
    $("#routes").fadeOut();
    turnLayerButtonOff("toggleRoutes");
  }
}

function toggleMilitary(event?: MouseEvent) {
  if (!layerIsOn("toggleMilitary")) {
    turnLayerButtonOn("toggleMilitary");
    $("#armies").fadeIn();
    if (isCtrlPressed(event)) editStyle("armies");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("armies");
      return;
    }
    $("#armies").fadeOut();
    turnLayerButtonOff("toggleMilitary");
  }
}

function toggleMarkers(event?: MouseEvent) {
  if (!layerIsOn("toggleMarkers")) {
    turnLayerButtonOn("toggleMarkers");
    renderLayer("markers");
    if (isCtrlPressed(event)) editStyle("markers");
  } else {
    if (isCtrlPressed(event)) return editStyle("markers");
    markers.selectAll("*").remove();
    turnLayerButtonOff("toggleMarkers");
  }
}

function toggleLabels(event?: MouseEvent) {
  if (!layerIsOn("toggleLabels")) {
    turnLayerButtonOn("toggleLabels");
    renderLayer("labels");
    if (isCtrlPressed(event)) editStyle("labels");
  } else {
    if (isCtrlPressed(event)) return editStyle("labels");
    labels.selectAll("text").remove();
    // TODO: remove text paths
    turnLayerButtonOff("toggleLabels");
  }
}

function toggleBurgs(event?: MouseEvent) {
  if (!layerIsOn("toggleBurgs")) {
    turnLayerButtonOn("toggleBurgs");
    renderLayer("burgs");
    if (isCtrlPressed(event)) editStyle("burgIcons");
  } else {
    if (isCtrlPressed(event)) return editStyle("burgIcons");
    burgIcons.selectAll("circle").remove();
    icons.selectAll("use").remove();
    turnLayerButtonOff("toggleBurgs");
  }
}

function toggleRulers(event?: MouseEvent) {
  if (!layerIsOn("toggleRulers")) {
    turnLayerButtonOn("toggleRulers");
    if (isCtrlPressed(event)) editStyle("ruler");
    rulers.draw();
    ruler.style("display", null);
  } else {
    if (isCtrlPressed(event)) {
      editStyle("ruler");
      return;
    }
    turnLayerButtonOff("toggleRulers");
    ruler.selectAll("*").remove();
    ruler.style("display", "none");
  }
}

function toggleScaleBar(event?: MouseEvent) {
  if (!layerIsOn("toggleScaleBar")) {
    turnLayerButtonOn("toggleScaleBar");
    $("#scaleBar").fadeIn();
    if (isCtrlPressed(event)) openDialog("unitsEditor");
  } else {
    if (isCtrlPressed(event)) openDialog("unitsEditor");
    else {
      $("#scaleBar").fadeOut();
      turnLayerButtonOff("toggleScaleBar");
    }
  }
}

function toggleZones(event?: MouseEvent) {
  if (!layerIsOn("toggleZones")) {
    turnLayerButtonOn("toggleZones");
    $("#zones").fadeIn();
    if (isCtrlPressed(event)) editStyle("zones");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("zones");
      return;
    }
    turnLayerButtonOff("toggleZones");
    $("#zones").fadeOut();
  }
}

function toggleEmblems(event?: MouseEvent) {
  if (!layerIsOn("toggleEmblems")) {
    turnLayerButtonOn("toggleEmblems");
    if (!emblems.selectAll("use").size()) renderLayer("emblems");
    $("#emblems").fadeIn();
    if (isCtrlPressed(event)) editStyle("emblems");
  } else {
    if (isCtrlPressed(event)) {
      editStyle("emblems");
      return;
    }
    $("#emblems").fadeOut();
    turnLayerButtonOff("toggleEmblems");
  }
}
