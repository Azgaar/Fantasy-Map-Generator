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

const generateSubmap = debounce(function (x, y, w, h) {
  // Create submap from the current map
  // x,y -> top left corner of desired submap
  // w,h -> width and height of the submap

  WARN && console.warn("Resampling current map");
  closeDialogs("#worldConfigurator, #options3d");
  const stageUI = document.getElementById("submapStage");
  const progressUI = document.getElementById("submapProgress");
  const monitor = {
    stage: s => stageUI.innerHTML = s,
    progress: p => progressUI.innerHTML = p,
  }

  const projection = (x, y) => {
    const [[x0, y0], [x1, y1]] = getViewBoxExtent();
    return [x * (x1-x0) / graphWidth + x0, y * (y1-y0) / graphHeight + y0]
  }

  customization = 0;
  undraw();
  resetZoom(1000);

  let oldstate = {
    grid: _.cloneDeep(grid),
    pack: _.cloneDeep(pack),
    seed,
    graphWidth,
    graphHeight,
  }

  try {
    Submap.resample(oldstate, projection, monitor);
  } catch (error) {
    generateSubmapErrorHandler(error);
  }
  oldstate = null; // destroy old state to free memory

  restoreLayers();
  if (ThreeD.options.isOn) ThreeD.redraw();
  if ($("#worldConfigurator").is(":visible")) editWorld();
}, 1000);

function generateSubmapErrorHandler(error) {
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
      "Clear data": function () {
        localStorage.clear();
        localStorage.setItem("version", version);
      },
      Regenerate: function () {
        generateSubmap();
        $(this).dialog("close");
      },
      Ignore: function () {
        $(this).dialog("close");
      }
    },
    position: {my: "center", at: "center", of: "svg"}
  });
}
