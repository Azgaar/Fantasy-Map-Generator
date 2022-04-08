"use strict";

/*
UI elements for submap generation
*/

function openSubmapOptions() {
  $("#submapOptionsDialog").dialog({
    title: "Submap options",
    resizable: false,
    width: fitContent(),
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"},
    buttons: {
      Submap: function () {
        $(this).dialog("close");
        generateSubmap();
      },
      Cancel: function () { $(this).dialog("close"); },
    }
  });
}

function openRemapOptions() {
  resetZoom(0);
  $("#remapOptionsDialog").dialog({
    title: "Resampler options",
    resizable: false,
    width: fitContent(),
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"},
    buttons: {
      Resample: function () {
        const cellNumId = Number(document.getElementById('submapPointsInput').value);
        const cells = cellsDensityConstants[cellNumId];
        $(this).dialog("close");
        if (!cells) {
          console.error('Unknown cell number!');
          return;
        }
        changeCellsDensity(cellNumId);
        resampleCurrentMap();
      },
      Cancel: function () { $(this).dialog("close"); },
    },
  });
}

/* callbacks */

const resampleCurrentMap = debounce(function () {
  // Resample the whole map to different cell resolution or shape
  WARN && console.warn("Resampling current map");
  const options = {
    lockMarkers: false,
    lockBurgs: false,
    depressRivers: false,
    addLakesInDepressions: false,
    promoteTowns: false,
    smoothHeightMap: false,
    projection: (x,y) => [x, y],
    inverse: (x,y) => [x, y],
  }

  startResample(options);
}, 1000);


const generateSubmap = debounce(function () {
  // Create submap from the current map
  // submap limits defined by the current window size (canvas viewport)

  WARN && console.warn("Resampling current map");
  closeDialogs("#worldConfigurator, #options3d");
  const checked = id => Boolean(document.getElementById(id).checked)
  // Create projection func from current zoom extents
  const [[x0, y0], [x1, y1]] = getViewBoxExtent();

  const options = {
    lockMarkers: checked("submapLockMarkers"),
    lockBurgs: checked("submapLockBurgs"),

    depressRivers: checked("submapDepressRivers"),
    addLakesInDepressions: checked("submapAddLakeInDepression"),
    promoteTowns: checked("submapPromoteTowns"),
    smoothHeightMap: scale > 2,
    inverse: (x,y) => [x * (x1-x0) / graphWidth + x0, y * (y1-y0) / graphHeight + y0],
    projection: (x, y) => [(x-x0) * graphWidth / (x1-x0),  (y-y0) * graphHeight / (y1-y0)],
  }

  // converting map position on the planet
  const mapSizeOutput = document.getElementById("mapSizeOutput");
  const latitudeOutput = document.getElementById("latitudeOutput");
  const latN = 90 - (180 - mapSizeInput.value / 100 * 180) * latitudeOutput.value / 100;
  const newLatN = latN - y0 / graphHeight * mapSizeOutput.value * 180 / 100;
  mapSizeOutput.value /= scale;
  latitudeOutput.value =  (90 - newLatN) / (180 - mapSizeOutput.value / 100 * 180) * 100;
  document.getElementById("mapSizeInput").value = mapSizeOutput.value;
  document.getElementById("latitudeInput").value = latitudeOutput.value;

  // fix scale
  distanceScaleInput.value = distanceScaleOutput.value = rn(distanceScale = distanceScaleOutput.value / scale, 2);
  populationRateInput.value = populationRateOutput.value = rn(populationRate = populationRateOutput.value / scale, 2);
  customization = 0;
  startResample(options);
}, 1000);


async function startResample(options) {
  undraw();
  resetZoom(0);
  let oldstate = {
    grid: _.cloneDeep(grid),
    pack: _.cloneDeep(pack),
    seed,
    graphWidth,
    graphHeight,
  };

  try {
    const oldScale = scale;
    await Submap.resample(oldstate, options);
    if (options.promoteTowns) {
      const groupName = 'largetowns';
      moveAllBurgsToGroup('towns', groupName);
      changeRadius(rn(oldScale * 0.8,2), groupName);
      changeFontSize(svg.select(`#labels #${groupName}`), rn(oldScale*2, 2));
      invokeActiveZooming();
    }
  } catch (error) {
    showSubmapErrorHandler(error);
  }

  oldstate = null; // destroy old state to free memory

  restoreLayers();
  turnButtonOn('toggleMarkers');
  if (ThreeD.options.isOn) ThreeD.redraw();
  if ($("#worldConfigurator").is(":visible")) editWorld();
}

function showSubmapErrorHandler(error) {
  ERROR && console.error(error);
  clearMainTip();

  alertMessage.innerHTML = `Map resampling failed :_(.
    <br>You may retry after clearing stored data or contact us at discord.
    <p id="errorBox">${parseError(error)}</p>`;
  $("#alert").dialog({
    resizable: false,
    title: "Generation error",
    width: "32em",
    buttons: {
      Ok: function () { $(this).dialog("close"); }
    },
    position: {my: "center", at: "center", of: "svg"}
  });
}
