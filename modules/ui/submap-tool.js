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

  // add listeners
  byId("submapPointsInput").on("input", handleCellsChange);

  function generateSubmap() {
    INFO && console.group("generateSubmap");

    const [x0, y0] = [Math.abs(viewX / scale), Math.abs(viewY / scale)]; // top-left corner
    recalculateMapSize(x0, y0);

    const cellsNumber = +byId("submapPointsInput").value;
    changeCellsDensity(cellsNumber);

    const projection = (x, y) => [(x - x0) * scale, (y - y0) * scale];
    const inverse = (x, y) => [x / scale + x0, y / scale + y0];

    resetZoom(0);
    undraw();
    Resample.process({projection, inverse, scale});
    rescaleBurgStyles(scale);
    drawLayers();

    INFO && console.groupEnd("generateSubmap");
  }

  function recalculateMapSize(x0, y0) {
    const mapSize = +byId("mapSizeOutput").value;
    byId("mapSizeOutput").value = byId("mapSizeInput").value = rn(mapSize / scale, 2);

    const latT = mapCoordinates.latT / scale;
    const latN = getLatitude(y0);
    const latShift = (90 - latN) / (180 - latT);
    byId("latitudeOutput").value = byId("latitudeInput").value = rn(latShift * 100, 2);

    const lotT = mapCoordinates.lonT / scale;
    const lonE = getLongitude(x0 + graphWidth / scale);
    const lonShift = (180 - lonE) / (360 - lotT);
    byId("longitudeOutput").value = byId("longitudeInput").value = rn(lonShift * 100, 2);

    distanceScale = distanceScaleInput.value = rn(distanceScale / scale, 2);
    populationRate = populationRateInput.value = rn(populationRate / scale, 2);
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

  function handleCellsChange() {
    const cells = cellsDensityMap[+this.value] || 1000;
    this.dataset.cells = cells;
    const output = byId("submapPointsFormatted");
    output.value = getCellsDensityValue(cells);
    output.style.color = getCellsDensityColor(cells);
  }
}
