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

  if (modules.openSubmapMenu) return;
  modules.openSubmapMenu = true;

  async function generateSubmap() {
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

    distanceScale = distanceScaleInput.value = rn(distanceScaleInput.value / scale, 2);
    populationRate = populationRateInput.value = rn(populationRateInput.value / scale, 2);

    const parentMap = {grid: deepCopy(grid), pack: deepCopy(pack), notes: deepCopy(notes)};
    const options = {
      lockMarkers: byId("submapLockMarkers").checked,
      lockBurgs: byId("submapLockBurgs").checked,
      depressRivers: byId("submapDepressRivers").checked,
      addLakesInDepressions: byId("submapAddLakeInDepression").checked,
      smoothHeightMap: scale > 2,
      inverse: (x, y) => [x / scale + x0, y / scale + y0],
      projection: (x, y) => [(x - x0) * scale, (y - y0) * scale],
      scale
    };

    resetZoom(0);
    undraw();

    const oldScale = scale;
    await Submap.resample(parentMap, options);

    if (byId("submapPromoteTowns").checked) {
      const groupName = "largetowns";
      moveAllBurgsToGroup("towns", groupName);
      changeRadius(rn(oldScale * 0.8, 2), groupName);
      changeFontSize(svg.select(`#labels #${groupName}`), rn(oldScale * 2, 2));
      invokeActiveZooming();
    }

    if (byId("submapRescaleStyles").checked) changeStyles(oldScale);

    drawLayers();

    INFO && console.groupEnd("generateSubmap");
  }

  function changeStyles(scale) {
    // resize burgIcons
    const burgIcons = [...byId("burgIcons").querySelectorAll("g")];
    for (const bi of burgIcons) {
      const newRadius = rn(minmax(bi.getAttribute("size") * scale, 0.2, 10), 2);
      changeRadius(newRadius, bi.id);
      const swAttr = bi.attributes["stroke-width"];
      swAttr.value = +swAttr.value * scale;
    }

    // burglabels
    const burgLabels = [...byId("burgLabels").querySelectorAll("g")];
    for (const bl of burgLabels) {
      const size = +bl.dataset["size"];
      bl.dataset["size"] = Math.max(rn((size + size / scale) / 2, 2), 1) * scale;
    }

    drawEmblems();
  }
}
