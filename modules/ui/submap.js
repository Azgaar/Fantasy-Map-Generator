"use strict";

/*
UI elements for submap generation
*/

function openSubmapOptions() {
  $("#submapOptionsDialog").dialog({
    title: "Submap options",
    resizable: false,
    width: fitContent(),
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });
}

function openRemapOptions() {
  $("#remapOptionsDialog").dialog({
    title: "Resampler options",
    resizable: false,
    width: fitContent(),
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });
}

const resampleCurrentMap = debounce(async function () {
  WARN && console.warn("Resampling current map");
});

const generateSubmap = debounce(async function () {
  // Create submap from the current map
  // submap limits defined by the current window size (canvas viewport)

  WARN && console.warn("Resampling current map");
  closeDialogs("#worldConfigurator, #options3d");
  const checked = id => Boolean(document.getElementById(id).checked)
  const options = {
    lockMarkers: checked("submapLockMarkers"),
    lockBurgs: checked("submapLockBurgs"),

    depressRivers: checked("submapDepressRivers"),
    addLakesInDepressions: checked("submapAddLakeInDepression"),
    promoteTowns: checked("submapPromoteTowns"),
    smoothHeightMap: scale > 2,
  }

  // Create projection func from current zoom extents
  const [[x0, y0], [x1, y1]] = getViewBoxExtent();
  const projection = (x, y, inverse=false) => {
    return inverse
      ? [x * (x1-x0) / graphWidth + x0, y * (y1-y0) / graphHeight + y0]
      : [(x-x0) * graphWidth / (x1-x0),  (y-y0) * graphHeight / (y1-y0)];
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
    await Submap.resample(oldstate, projection, options);
    if (options.promoteTowns) {
      const groupName = 'largetowns';
      moveAllBurgsToGroup('towns', groupName);
      changeRadius(oldScale * 0.8, groupName);
      changeFontSize(svg.select(`#labels #${groupName}`), oldScale*2);
      invoceActiveZooming();
    }
  } catch (error) {
    generateSubmapErrorHandler(error, oldstate, projection, options);
  }

  oldstate = null; // destroy old state to free memory

  restoreLayers();
  turnButtonOn('toggleMarkers');
  if (ThreeD.options.isOn) ThreeD.redraw();
  if ($("#worldConfigurator").is(":visible")) editWorld();
}, 1000);

function generateSubmapErrorHandler(error, oldstate, projection, options) {
  ERROR && console.error(error);
  clearMainTip();

  alertMessage.innerHTML = `An error is occured on map resampling. Please retry.
    <br>If error is critical, clear the stored data and try again.
    <p id="errorBox">${parseError(error)}</p>`;
  $("#alert").dialog({
    resizable: false,
    title: "Generation error",
    width: "32em",
    buttons: {
      Regenerate: async function () {
        try {
          await Submap.resample(oldstate, projection, options);
        } catch (error) {
          generateSubmapErrorHandler(error, oldstate, projection, options);
        }
        $(this).dialog("close");
      },
      Ignore: function () {
        $(this).dialog("close");
      }
    },
    position: {my: "center", at: "center", of: "svg"}
  });
}
