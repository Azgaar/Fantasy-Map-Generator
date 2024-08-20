"use strict";
// UI elements for submap generation

window.UISubmap = (function () {
  byId("submapPointsInput").addEventListener("input", function () {
    const output = byId("submapPointsOutputFormatted");
    const cells = cellsDensityMap[+this.value] || 1000;
    this.dataset.cells = cells;
    output.value = getCellsDensityValue(cells);
    output.style.color = getCellsDensityColor(cells);
  });

  byId("submapScaleInput").addEventListener("input", function (event) {
    const exp = Math.pow(1.1, +event.target.value);
    byId("submapScaleOutput").value = rn(exp, 2);
  });

  byId("submapAngleInput").addEventListener("input", function (event) {
    byId("submapAngleOutput").value = event.target.value;
  });

  const $previewBox = byId("submapPreview");
  const $scaleInput = byId("submapScaleInput");
  const $shiftX = byId("submapShiftX");
  const $shiftY = byId("submapShiftY");

  function openSubmapMenu() {
    $("#submapOptionsDialog").dialog({
      title: "Create a submap",
      resizable: false,
      position: {my: "center", at: "center", of: "svg"},
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

  const getTransformInput = _ => ({
    angle: (+byId("submapAngleInput").value / 180) * Math.PI,
    shiftX: +byId("submapShiftX").value,
    shiftY: +byId("submapShiftY").value,
    ratio: +byId("submapScaleInput").value,
    mirrorH: byId("submapMirrorH").checked,
    mirrorV: byId("submapMirrorV").checked
  });

  async function openResampleMenu() {
    resetZoom(0);

    byId("submapAngleInput").value = 0;
    byId("submapAngleOutput").value = "0";
    byId("submapScaleOutput").value = 1;
    byId("submapMirrorH").checked = false;
    byId("submapMirrorV").checked = false;
    $scaleInput.value = 0;
    $shiftX.value = 0;
    $shiftY.value = 0;

    const w = Math.min(400, window.innerWidth * 0.5);
    const previewScale = w / graphWidth;
    const h = graphHeight * previewScale;
    $previewBox.style.width = w + "px";
    $previewBox.style.height = h + "px";

    // handle mouse input
    const dispatchInput = e => e.dispatchEvent(new Event("input", {bubbles: true}));

    // mouse wheel
    $previewBox.onwheel = e => {
      $scaleInput.value = $scaleInput.valueAsNumber - Math.sign(e.deltaY);
      dispatchInput($scaleInput);
    };

    // mouse drag
    let mouseIsDown = false,
      mouseX = 0,
      mouseY = 0;
    $previewBox.onmousedown = e => {
      mouseIsDown = true;
      mouseX = $shiftX.value - e.clientX / previewScale;
      mouseY = $shiftY.value - e.clientY / previewScale;
    };
    $previewBox.onmouseup = _ => (mouseIsDown = false);
    $previewBox.onmouseleave = _ => (mouseIsDown = false);
    $previewBox.onmousemove = e => {
      if (!mouseIsDown) return;
      e.preventDefault();
      $shiftX.value = Math.round(mouseX + e.clientX / previewScale);
      $shiftY.value = Math.round(mouseY + e.clientY / previewScale);
      dispatchInput($shiftX);
      // dispatchInput($shiftY); // not needed X bubbles anyway
    };

    $("#resampleDialog").dialog({
      title: "Transform map",
      resizable: false,
      position: {my: "center", at: "center", of: "svg"},
      buttons: {
        Transform: function () {
          $(this).dialog("close");
          resampleCurrentMap();
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });

    // use double resolution for PNG to get sharper image
    const $preview = await loadPreview($previewBox, w * 2, h * 2);
    // could be done with SVG. Faster to load, slower to use.
    // const $preview = await loadPreviewSVG($previewBox, w, h);
    $preview.style.position = "absolute";
    $preview.style.width = w + "px";
    $preview.style.height = h + "px";

    byId("resampleDialog").oninput = event => {
      const {angle, shiftX, shiftY, ratio, mirrorH, mirrorV} = getTransformInput();
      const scale = Math.pow(1.1, ratio);
      const transformStyle = `
        translate(${shiftX * previewScale}px, ${shiftY * previewScale}px)
        scale(${mirrorH ? -scale : scale}, ${mirrorV ? -scale : scale})
        rotate(${angle}rad)
      `;

      $preview.style.transform = transformStyle;
      $preview.style["transform-origin"] = "center";
      event.stopPropagation();
    };
  }

  async function loadPreview($container, w, h) {
    const url = await getMapURL("png", {
      globe: false,
      noWater: true,
      fullMap: true,
      noLabels: true,
      noScaleBar: true,
      noIce: true
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = w;
    canvas.height = h;
    const img = new Image();
    img.src = url;
    img.onload = function () {
      ctx.drawImage(img, 0, 0, w, h);
    };
    $container.textContent = "";
    $container.appendChild(canvas);
    return canvas;
  }

  // currently unused alternative to PNG version
  async function loadPreviewSVG($container, w, h) {
    $container.innerHTML = /*html*/ `
      <svg id="submapPreviewSVG" viewBox="0 0 ${graphWidth} ${graphHeight}">
        <rect width="100%" height="100%" fill="${byId("styleOceanFill").value}" />
        <rect fill="url(#oceanic)" width="100%" height="100%" />
        <use href="#map"></use>
      </svg>
    `;
    return byId("submapPreviewSVG");
  }

  // Resample the whole map to different cell resolution or shape
  const resampleCurrentMap = debounce(function () {
    WARN && console.warn("Resampling current map");
    const cellNumId = +byId("submapPointsInput").value;
    if (!cellsDensityMap[cellNumId]) return console.error("Unknown cell number!");

    const {angle, shiftX, shiftY, ratio, mirrorH, mirrorV} = getTransformInput();

    const [cx, cy] = [graphWidth / 2, graphHeight / 2];
    const rot = alfa => (x, y) =>
      [
        (x - cx) * Math.cos(alfa) - (y - cy) * Math.sin(alfa) + cx,
        (y - cy) * Math.cos(alfa) + (x - cx) * Math.sin(alfa) + cy
      ];
    const shift = (dx, dy) => (x, y) => [x + dx, y + dy];
    const scale = r => (x, y) => [(x - cx) * r + cx, (y - cy) * r + cy];
    const flipH = (x, y) => [-x + 2 * cx, y];
    const flipV = (x, y) => [x, -y + 2 * cy];
    const app = (f, g) => (x, y) => f(...g(x, y));
    const id = (x, y) => [x, y];

    let projection = id;
    let inverse = id;

    if (angle) [projection, inverse] = [rot(angle), rot(-angle)];
    if (ratio)
      [projection, inverse] = [
        app(scale(Math.pow(1.1, ratio)), projection),
        app(inverse, scale(Math.pow(1.1, -ratio)))
      ];
    if (mirrorH) [projection, inverse] = [app(flipH, projection), app(inverse, flipH)];
    if (mirrorV) [projection, inverse] = [app(flipV, projection), app(inverse, flipV)];
    if (shiftX || shiftY) {
      projection = app(shift(shiftX, shiftY), projection);
      inverse = app(inverse, shift(-shiftX, -shiftY));
    }

    changeCellsDensity(cellNumId);
    startResample({
      lockMarkers: false,
      lockBurgs: false,
      depressRivers: false,
      addLakesInDepressions: false,
      promoteTowns: false,
      smoothHeightMap: false,
      rescaleStyles: false,
      scale: 1,
      projection,
      inverse
    });
  }, 1000);

  // Create submap from the current map. Submap limits defined by the current window size (canvas viewport)
  const generateSubmap = debounce(function () {
    WARN && console.warn("Resampling current map");
    closeDialogs("#worldConfigurator, #options3d");
    const checked = id => Boolean(byId(id).checked);

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
      projection: (x, y) => [(x - x0) * origScale, (y - y0) * origScale],
      scale: origScale
    };

    // converting map position on the planet
    const mapSizeOutput = byId("mapSizeOutput");
    const latitudeOutput = byId("latitudeOutput");
    const latN = 90 - ((180 - (mapSizeInput.value / 100) * 180) * latitudeOutput.value) / 100;
    const newLatN = latN - ((y0 / graphHeight) * mapSizeOutput.value * 180) / 100;
    mapSizeOutput.value /= scale;
    latitudeOutput.value = ((90 - newLatN) / (180 - (mapSizeOutput.value / 100) * 180)) * 100;
    byId("mapSizeInput").value = mapSizeOutput.value;
    byId("latitudeInput").value = latitudeOutput.value;

    // fix scale
    distanceScale = distanceScaleInput.value = rn(distanceScaleInput.value / scale, 2);
    populationRate = populationRateInput.value = rn(populationRateInput.value / scale, 2);

    customization = 0;
    startResample(options);
  }, 1000);

  async function startResample(options) {
    // Do model changes with Submap.resample then do view changes if needed
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
    if (ThreeD.options.isOn) ThreeD.redraw();
    if ($("#worldConfigurator").is(":visible")) editWorld();
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

    alertMessage.innerHTML = /* html */ `Map resampling failed: <br />You may retry after clearing stored data or contact us at discord.
      <p id="errorBox">${parseError(error)}</p>`;
    $("#alert").dialog({
      resizable: false,
      title: "Resampling error",
      width: "32em",
      buttons: {
        Ok: function () {
          $(this).dialog("close");
        }
      },
      position: {my: "center", at: "center", of: "svg"}
    });
  }

  return {openSubmapMenu, openResampleMenu};
})();
