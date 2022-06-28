import {tip} from "/src/scripts/tooltips";
import {getBase64} from "/src/utils/functionUtils";
import {isCtrlClick} from "/src/utils/keyboardUtils";
import {turnLayerButtonOn, turnLayerButtonOff, layerIsOn} from "./utils";
import {renderLayer} from "./renderers";

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
  toggleIcons,
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

export function toggleLayer(toggleId) {
  layerTogglesMap[toggleId]();
}

function toggleHeight(event) {
  if (customization === 1) {
    tip("You cannot turn off the layer when heightmap is in edit mode", false, "error");
    return;
  }

  if (!terrs.selectAll("*").size()) {
    turnLayerButtonOn("toggleHeight");
    renderLayer("heightmap");
    if (event && isCtrlClick(event)) editStyle("terrs");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("terrs");
      return;
    }
    turnLayerButtonOff("toggleHeight");
    terrs.selectAll("*").remove();
  }
}

function toggleTemp(event) {
  if (!temperature.selectAll("*").size()) {
    turnLayerButtonOn("toggleTemp");
    renderLayer("temperature");
    if (event && isCtrlClick(event)) editStyle("temperature");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("temperature");
      return;
    }
    turnLayerButtonOff("toggleTemp");
    temperature.selectAll("*").remove();
  }
}

function toggleBiomes(event) {
  if (!biomes.selectAll("path").size()) {
    turnLayerButtonOn("toggleBiomes");
    renderLayer("biomes");
    if (event && isCtrlClick(event)) editStyle("biomes");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("biomes");
      return;
    }
    biomes.selectAll("path").remove();
    turnLayerButtonOff("toggleBiomes");
  }
}

function togglePrec(event) {
  if (!prec.selectAll("circle").size()) {
    turnLayerButtonOn("togglePrec");
    renderLayer("precipitation");
    if (event && isCtrlClick(event)) editStyle("prec");
  } else {
    if (event && isCtrlClick(event)) {
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

function togglePopulation(event) {
  if (!population.selectAll("line").size()) {
    turnLayerButtonOn("togglePopulation");
    renderLayer("population");
    if (event && isCtrlClick(event)) editStyle("population");
  } else {
    if (event && isCtrlClick(event)) {
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
        .attr("y2", d => d[1])
        .remove();
      population
        .select("#urban")
        .selectAll("line")
        .transition(hide)
        .delay(1000)
        .attr("y2", d => d[1])
        .remove();
    }
  }
}

function toggleCells(event) {
  if (!cells.selectAll("path").size()) {
    turnLayerButtonOn("toggleCells");
    renderLayer("cells");
    if (event && isCtrlClick(event)) editStyle("cells");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("cells");
      return;
    }
    cells.selectAll("path").remove();
    turnLayerButtonOff("toggleCells");
  }
}

function toggleIce(event) {
  if (!layerIsOn("toggleIce")) {
    turnLayerButtonOn("toggleIce");
    $("#ice").fadeIn();
    if (!ice.selectAll("*").size()) renderLayer("ice");
    if (event && isCtrlClick(event)) editStyle("ice");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("ice");
      return;
    }
    $("#ice").fadeOut();
    turnLayerButtonOff("toggleIce");
  }
}

function toggleCultures(event) {
  const cultures = pack.cultures.filter(c => c.i && !c.removed);
  const empty = !cults.selectAll("path").size();
  if (empty && cultures.length) {
    turnLayerButtonOn("toggleCultures");
    renderLayer("cultures");
    if (event && isCtrlClick(event)) editStyle("cults");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("cults");
      return;
    }
    cults.selectAll("path").remove();
    turnLayerButtonOff("toggleCultures");
  }
}

function toggleReligions(event) {
  const religions = pack.religions.filter(r => r.i && !r.removed);
  if (!relig.selectAll("path").size() && religions.length) {
    turnLayerButtonOn("toggleReligions");
    renderLayer("religions");
    if (event && isCtrlClick(event)) editStyle("relig");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("relig");
      return;
    }
    relig.selectAll("path").remove();
    turnLayerButtonOff("toggleReligions");
  }
}

function toggleStates(event) {
  if (!layerIsOn("toggleStates")) {
    turnLayerButtonOn("toggleStates");
    regions.style("display", null);
    renderLayer("states");
    if (event && isCtrlClick(event)) editStyle("regions");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("regions");
      return;
    }
    regions.style("display", "none").selectAll("path").remove();
    turnLayerButtonOff("toggleStates");
  }
}

function toggleBorders(event) {
  if (!layerIsOn("toggleBorders")) {
    turnLayerButtonOn("toggleBorders");
    renderLayer("borders");
    if (event && isCtrlClick(event)) editStyle("borders");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("borders");
      return;
    }
    turnLayerButtonOff("toggleBorders");
    borders.selectAll("path").remove();
  }
}

function toggleProvinces(event) {
  if (!layerIsOn("toggleProvinces")) {
    turnLayerButtonOn("toggleProvinces");
    renderLayer("provinces");
    if (event && isCtrlClick(event)) editStyle("provs");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("provs");
      return;
    }
    provs.selectAll("*").remove();
    turnLayerButtonOff("toggleProvinces");
  }
}

function toggleGrid(event) {
  if (!gridOverlay.selectAll("*").size()) {
    turnLayerButtonOn("toggleGrid");
    renderLayer("grid");
    calculateFriendlyGridSize();

    if (event && isCtrlClick(event)) editStyle("gridOverlay");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("gridOverlay");
      return;
    }
    turnLayerButtonOff("toggleGrid");
    gridOverlay.selectAll("*").remove();
  }
}

function toggleCoordinates(event) {
  if (!coordinates.selectAll("*").size()) {
    turnLayerButtonOn("toggleCoordinates");
    renderLayer("coordinates");
    if (event && isCtrlClick(event)) editStyle("coordinates");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("coordinates");
      return;
    }
    turnLayerButtonOff("toggleCoordinates");
    coordinates.selectAll("*").remove();
  }
}

function toggleCompass(event) {
  if (!layerIsOn("toggleCompass")) {
    turnLayerButtonOn("toggleCompass");
    $("#compass").fadeIn();
    if (!compass.selectAll("*").size()) {
      compass.append("use").attr("xlink:href", "#rose");
      shiftCompass();
    }
    if (event && isCtrlClick(event)) editStyle("compass");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("compass");
      return;
    }
    $("#compass").fadeOut();
    turnLayerButtonOff("toggleCompass");
  }
}

function toggleRelief(event) {
  if (!layerIsOn("toggleRelief")) {
    turnLayerButtonOn("toggleRelief");
    if (!terrain.selectAll("*").size()) ReliefIcons();
    $("#terrain").fadeIn();
    if (event && isCtrlClick(event)) editStyle("terrain");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("terrain");
      return;
    }
    $("#terrain").fadeOut();
    turnLayerButtonOff("toggleRelief");
  }
}

function toggleTexture(event) {
  if (!layerIsOn("toggleTexture")) {
    turnLayerButtonOn("toggleTexture");
    // append default texture image selected by default. Don't append on load to not harm performance
    if (!texture.selectAll("*").size()) {
      const x = +styleTextureShiftX.value;
      const y = +styleTextureShiftY.value;
      const image = texture
        .append("image")
        .attr("id", "textureImage")
        .attr("x", x)
        .attr("y", y)
        .attr("width", graphWidth - x)
        .attr("height", graphHeight - y)
        .attr("preserveAspectRatio", "xMidYMid slice");
      getBase64(styleTextureInput.value, base64 => image.attr("xlink:href", base64));
    }
    $("#texture").fadeIn();
    zoom.scaleBy(svg, 1.00001); // enforce browser re-draw
    if (event && isCtrlClick(event)) editStyle("texture");
  } else {
    if (event && isCtrlClick(event)) return editStyle("texture");
    $("#texture").fadeOut();
    turnLayerButtonOff("toggleTexture");
  }
}

function toggleRivers(event) {
  if (!layerIsOn("toggleRivers")) {
    turnLayerButtonOn("toggleRivers");
    renderLayer("rivers");
    if (event && isCtrlClick(event)) editStyle("rivers");
  } else {
    if (event && isCtrlClick(event)) return editStyle("rivers");
    rivers.selectAll("*").remove();
    turnLayerButtonOff("toggleRivers");
  }
}

function toggleRoutes(event) {
  if (!layerIsOn("toggleRoutes")) {
    turnLayerButtonOn("toggleRoutes");
    $("#routes").fadeIn();
    if (event && isCtrlClick(event)) editStyle("routes");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("routes");
      return;
    }
    $("#routes").fadeOut();
    turnLayerButtonOff("toggleRoutes");
  }
}

function toggleMilitary(event) {
  if (!layerIsOn("toggleMilitary")) {
    turnLayerButtonOn("toggleMilitary");
    $("#armies").fadeIn();
    if (event && isCtrlClick(event)) editStyle("armies");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("armies");
      return;
    }
    $("#armies").fadeOut();
    turnLayerButtonOff("toggleMilitary");
  }
}

function toggleMarkers(event) {
  if (!layerIsOn("toggleMarkers")) {
    turnLayerButtonOn("toggleMarkers");
    renderLayer("markers");
    if (event && isCtrlClick(event)) editStyle("markers");
  } else {
    if (event && isCtrlClick(event)) return editStyle("markers");
    markers.selectAll("*").remove();
    turnLayerButtonOff("toggleMarkers");
  }
}

function toggleLabels(event) {
  if (!layerIsOn("toggleLabels")) {
    turnLayerButtonOn("toggleLabels");
    labels.style("display", null);
    Zoom.invoke();
    if (event && isCtrlClick(event)) editStyle("labels");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("labels");
      return;
    }
    turnLayerButtonOff("toggleLabels");
    labels.style("display", "none");
  }
}

function toggleIcons(event) {
  if (!layerIsOn("toggleIcons")) {
    turnLayerButtonOn("toggleIcons");
    $("#icons").fadeIn();
    if (event && isCtrlClick(event)) editStyle("burgIcons");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("burgIcons");
      return;
    }
    turnLayerButtonOff("toggleIcons");
    $("#icons").fadeOut();
  }
}

function toggleRulers(event) {
  if (!layerIsOn("toggleRulers")) {
    turnLayerButtonOn("toggleRulers");
    if (event && isCtrlClick(event)) editStyle("ruler");
    rulers.draw();
    ruler.style("display", null);
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("ruler");
      return;
    }
    turnLayerButtonOff("toggleRulers");
    ruler.selectAll("*").remove();
    ruler.style("display", "none");
  }
}

function toggleScaleBar(event) {
  if (!layerIsOn("toggleScaleBar")) {
    turnLayerButtonOn("toggleScaleBar");
    $("#scaleBar").fadeIn();
    if (event && isCtrlClick(event)) editUnits();
  } else {
    if (event && isCtrlClick(event)) {
      editUnits();
      return;
    }
    $("#scaleBar").fadeOut();
    turnLayerButtonOff("toggleScaleBar");
  }
}

function toggleZones(event) {
  if (!layerIsOn("toggleZones")) {
    turnLayerButtonOn("toggleZones");
    $("#zones").fadeIn();
    if (event && isCtrlClick(event)) editStyle("zones");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("zones");
      return;
    }
    turnLayerButtonOff("toggleZones");
    $("#zones").fadeOut();
  }
}

function toggleEmblems(event) {
  if (!layerIsOn("toggleEmblems")) {
    turnLayerButtonOn("toggleEmblems");
    if (!emblems.selectAll("use").size()) renderLayer("emblems");
    $("#emblems").fadeIn();
    if (event && isCtrlClick(event)) editStyle("emblems");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("emblems");
      return;
    }
    $("#emblems").fadeOut();
    turnLayerButtonOff("toggleEmblems");
  }
}
