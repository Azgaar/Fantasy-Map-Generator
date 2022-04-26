"use strict";

/*
UI elements for submap generation
*/

window.UISubmap = (function () {
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
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function openRemapOptions() {
    resetZoom(0);
    document.getElementById("submapRotationAngle").value = 0;
    document.getElementById("submapRotationAngleOutput").value = "0°";
    document.getElementById("submapShiftX").value = 0;
    document.getElementById("submapShiftY").value = 0;
    document.getElementById("submapMirrorH").checked = false;
    document.getElementById("submapMirrorV").checked = false;
    $("#remapOptionsDialog").dialog({
      title: "Resampler options",
      resizable: false,
      width: fitContent(),
      position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"},
      buttons: {
        Resample: function () {
          $(this).dialog("close");
          resampleCurrentMap();
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  /* callbacks */

  const resampleCurrentMap = debounce(function () {
    // Resample the whole map to different cell resolution or shape
    const cellNumId = Number(document.getElementById("submapPointsInput").value);
    const angle = Number(document.getElementById("submapRotationAngle").value) / 180 * Math.PI;
    const shiftX = Number(document.getElementById("submapShiftX").value);
    const shiftY = Number(document.getElementById("submapShiftY").value);
    const mirrorH = document.getElementById("submapMirrorH").checked;
    const mirrorV = document.getElementById("submapMirrorV").checked;
    if (!cellsDensityConstants[cellNumId]) {
      console.error("Unknown cell number!");
      return;
    }

    const [cx, cy] = [graphWidth / 2, graphHeight / 2];
    const rot = alfa  => (x, y) => [
      (x - cx) * Math.cos(alfa) - (y - cy) * Math.sin(alfa) + cx,
      (y - cy) * Math.cos(alfa) + (x - cx) * Math.sin(alfa) + cy
    ];
    const shift = (dx, dy) => (x, y) => [x + dx, y + dy];
    const flipH = (x, y) => [-x + 2 * cx, y];
    const flipV = (x, y) => [x, -y + 2 * cy];
    const app = (f, g) => (x, y) => f(...g(x, y));
    const id = (x, y) => [x, y];
    let projection = id, inverse = id;

    if (angle) [projection, inverse] = [rot(angle), rot(-angle)];
    if (shiftX || shiftY) {
      projection = app(shift(shiftX, shiftY), projection);
      inverse = app(inverse, shift(-shiftX, -shiftY));
    }
    if (mirrorH) [projection, inverse] = [app(flipH, projection), app(inverse, flipH)];
    if (mirrorV) [projection, inverse] = [app(flipV, projection), app(inverse, flipV)];

    changeCellsDensity(cellNumId);
    WARN && console.warn("Resampling current map");
    startResample({
      lockMarkers: false,
      lockBurgs: false,
      depressRivers: false,
      addLakesInDepressions: false,
      promoteTowns: false,
      smoothHeightMap: false,
      rescaleStyles: false,
      projection,
      inverse,
    });
  }, 1000);

  const generateSubmap = debounce(function () {
    // Create submap from the current map
    // submap limits defined by the current window size (canvas viewport)

    WARN && console.warn("Resampling current map");
    closeDialogs("#worldConfigurator, #options3d");
    const checked = id => Boolean(document.getElementById(id).checked);
    // Create projection func from current zoom extents
    const [[x0, y0], [x1, y1]] = getViewBoxExtent();
    const origScale = scale;

    const options = {
      lockMarkers: checked("submapLockMarkers"),
      lockBurgs: checked("submapLockBurgs"),

      depressRivers: checked("submapDepressRivers"),
      addLakesInDepressions: checked("submapAddLakeInDepression"),
      promoteTowns: checked("submapPromoteTowns"),
      rescaleStyles: checked("submapRescaleStyles"),
      smoothHeightMap: scale > 2,
      inverse: (x, y) => [x / origScale + x0, y / origScale + y0],
      projection: (x, y) => [(x - x0) * origScale, (y - y0) * origScale]
    };

    // converting map position on the planet
    const mapSizeOutput = document.getElementById("mapSizeOutput");
    const latitudeOutput = document.getElementById("latitudeOutput");
    const latN = 90 - ((180 - (mapSizeInput.value / 100) * 180) * latitudeOutput.value) / 100;
    const newLatN = latN - ((y0 / graphHeight) * mapSizeOutput.value * 180) / 100;
    mapSizeOutput.value /= scale;
    latitudeOutput.value = ((90 - newLatN) / (180 - (mapSizeOutput.value / 100) * 180)) * 100;
    document.getElementById("mapSizeInput").value = mapSizeOutput.value;
    document.getElementById("latitudeInput").value = latitudeOutput.value;

    // fix scale
    distanceScaleInput.value = distanceScaleOutput.value = rn((distanceScale = distanceScaleOutput.value / scale), 2);
    populationRateInput.value = populationRateOutput.value = rn((populationRate = populationRateOutput.value / scale), 2);
    customization = 0;
    startResample(options);
  }, 1000);

  async function startResample(options) {
    // Do model changes with Submap.resample then do view changes if needed.
    resetZoom(0);
    let oldstate = {
      grid: deepCopy(grid),
      pack: deepCopy(pack),
      notes: deepCopy(notes),
      seed,
      graphWidth,
      graphHeight
    };
    undraw();
    try {
      const oldScale = scale;
      await Submap.resample(oldstate, options);
      if (options.promoteTowns) {
        const groupName = "largetowns";
        moveAllBurgsToGroup("towns", groupName);
        changeRadius(rn(oldScale * 0.8, 2), groupName);
        changeFontSize(svg.select(`#labels #${groupName}`), rn(oldScale * 2, 2));
        invokeActiveZooming();
      }
      if (options.rescaleStyles) changeStyles(oldScale);
    } catch (error) {
      showSubmapErrorHandler(error);
    }

    oldstate = null; // destroy old state to free memory

    restoreLayers();
    turnButtonOn("toggleMarkers");
    if (ThreeD.options.isOn) ThreeD.redraw();
    if ($("#worldConfigurator").is(":visible")) editWorld();
  }

  function changeStyles(scale) {
    // resize burgIcons
    const burgIcons = [...document.getElementById("burgIcons").querySelectorAll("g")];
    for (const bi of burgIcons) {
      const newRadius = rn(minmax(bi.getAttribute("size") * scale, 0.2, 10), 2);
      changeRadius(newRadius, bi.id);
      const swAttr = bi.attributes["stroke-width"];
      swAttr.value = +swAttr.value * scale;
    }

    // burglabels
    const burgLabels = [...document.getElementById("burgLabels").querySelectorAll("g")];
    for (const bl of burgLabels) {
      const size = +bl.dataset["size"];
      bl.dataset["size"] = Math.max(rn((size + size / scale) / 2, 2), 1) * scale;
    }

    // emblems
    const emblemMod = minmax((scale - 1) * 0.3 + 1, 0.5, 5);
    emblemsStateSizeInput.value = minmax(+emblemsStateSizeInput.value * emblemMod, 0.5, 5);
    emblemsProvinceSizeInput.value = minmax(+emblemsProvinceSizeInput.value * emblemMod, 0.5, 5);
    emblemsBurgSizeInput.value = minmax(+emblemsBurgSizeInput.value * emblemMod, 0.5, 5);
    drawEmblems();
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
        Ok: function () {
          $(this).dialog("close");
        }
      },
      position: {my: "center", at: "center", of: "svg"}
    });
  }

  return {openSubmapOptions, openRemapOptions};
})();
