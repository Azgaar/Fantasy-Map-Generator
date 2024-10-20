"use strict";

function openSubmapTool() {
  $("#submapTool").dialog({
    title: "Create a submap",
    resizable: false,
    width: "32em",
    position: {my: "center", at: "center", of: "svg"},
    buttons: {
      Submap: function () {
        closeDialogs();
        generateSubmap();
      },
      Cancel: function () {
        $(this).dialog("close");
      }
    }
  });

  if (modules.openSubmapTool) return;
  modules.openSubmapTool = true;

  function generateSubmap() {
    INFO && console.group("generateSubmap");
    const [[x0, y0]] = getViewBoxExtent();

    // converting map position on the planet. TODO: fix, coordinates are wrong
    const mapSizeOutput = byId("mapSizeOutput");
    const latitudeOutput = byId("latitudeOutput");
    const latN = 90 - ((180 - (mapSizeInput.value / 100) * 180) * latitudeOutput.value) / 100;
    const newLatN = latN - ((y0 / graphHeight) * mapSizeOutput.value * 180) / 100;
    mapSizeOutput.value /= scale;
    latitudeOutput.value = ((90 - newLatN) / (180 - (mapSizeOutput.value / 100) * 180)) * 100;
    byId("mapSizeInput").value = mapSizeOutput.value;
    byId("latitudeInput").value = latitudeOutput.value;

    distanceScale = distanceScaleInput.value = rn(distanceScale / scale, 2);
    populationRate = populationRateInput.value = rn(populationRate / scale, 2);

    const parentMap = {grid: deepCopy(grid), pack: deepCopy(pack), notes: deepCopy(notes)};
    const smoothHeightmap = byId("submapSmoothHeightmap").checked;
    const depressRivers = byId("submapDepressRivers").checked;
    const projection = (x, y) => [(x - x0) * scale, (y - y0) * scale];
    const inverse = (x, y) => [x / scale + x0, y / scale + y0];
    const options = {smoothHeightmap, depressRivers, projection, inverse, scale};

    resetZoom(0);
    undraw();
    Resample.process(parentMap, options);
    rescaleBurgStyles(scale);
    drawLayers();

    INFO && console.groupEnd("generateSubmap");
  }

  function rescaleBurgStyles(scale) {
    const burgIcons = [...byId("burgIcons").querySelectorAll("g")];
    for (const bi of burgIcons) {
      const newRadius = rn(minmax(bi.getAttribute("size") * scale, 0.2, 10), 2);
      changeRadius(newRadius, bi.id);
      const swAttr = bi.attributes["stroke-width"];
      swAttr.value = +swAttr.value * scale;
    }

    const burgLabels = [...byId("burgLabels").querySelectorAll("g")];
    for (const bl of burgLabels) {
      const size = +bl.dataset["size"];
      bl.dataset["size"] = Math.max(rn((size + size / scale) / 2, 2), 1) * scale;
    }
  }
}
