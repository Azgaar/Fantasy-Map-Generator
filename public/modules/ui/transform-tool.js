"use strict";

async function openTransformTool() {
  const width = Math.min(400, window.innerWidth * 0.5);
  const previewScale = width / graphWidth;
  const height = graphHeight * previewScale;

  let mouseIsDown = false;
  let mouseX = 0;
  let mouseY = 0;

  resetInputs();
  loadPreview();

  $("#transformTool").dialog({
    title: "Transform map",
    resizable: false,
    position: {my: "center", at: "center", of: "svg"},
    buttons: {
      Transform: function () {
        closeDialogs();
        transformMap();
      },
      Cancel: function () {
        $(this).dialog("close");
      }
    }
  });

  if (modules.openTransformTool) return;
  modules.openTransformTool = true;

  // add listeners
  ensureEl("transformToolBody").on("input", handleInput);
  ensureEl("transformPreview")
    .on("mousedown", handleMousedown)
    .on("mouseup", _ => (mouseIsDown = false))
    .on("mousemove", handleMousemove)
    .on("wheel", handleWheel);

  async function loadPreview() {
    ensureEl("transformPreview").style.width = width + "px";
    ensureEl("transformPreview").style.height = height + "px";

    const options = {noWater: true, fullMap: true, noLabels: true, noScaleBar: true, noVignette: true, noIce: true};
    const url = await getMapURL("png", options);
    const SCALE = 4;

    const img = new Image();
    img.src = url;
    img.onload = function () {
      const $canvas = ensureEl("transformPreviewCanvas");
      $canvas.style.width = width + "px";
      $canvas.style.height = height + "px";
      $canvas.width = width * SCALE;
      $canvas.height = height * SCALE;
      $canvas.getContext("2d").drawImage(img, 0, 0, width * SCALE, height * SCALE);
    };
  }

  function resetInputs() {
    ensureEl("transformAngleInput").value = 0;
    ensureEl("transformAngleOutput").value = "0";
    ensureEl("transformMirrorH").checked = false;
    ensureEl("transformMirrorV").checked = false;
    ensureEl("transformScaleInput").value = 0;
    ensureEl("transformScaleResult").value = 1;
    ensureEl("transformShiftX").value = 0;
    ensureEl("transformShiftY").value = 0;
    handleInput();

    updateCellsNumber(ensureEl("pointsInput").value);
    ensureEl("transformPointsInput").oninput = e => updateCellsNumber(e.target.value);

    function updateCellsNumber(value) {
      ensureEl("transformPointsInput").value = value;
      const cells = cellsDensityMap[value];
      ensureEl("transformPointsInput").dataset.cells = cells;
      const output = ensureEl("transformPointsFormatted");
      output.value = cells / 1000 + "K";
      output.style.color = getCellsDensityColor(cells);
    }
  }

  function handleInput() {
    const angle = (+ensureEl("transformAngleInput").value / 180) * Math.PI;
    const shiftX = +ensureEl("transformShiftX").value;
    const shiftY = +ensureEl("transformShiftY").value;
    const mirrorH = ensureEl("transformMirrorH").checked;
    const mirrorV = ensureEl("transformMirrorV").checked;

    const EXP = 1.0965;
    const scale = rn(EXP ** +ensureEl("transformScaleInput").value, 2); // [0.1, 10]x
    ensureEl("transformScaleResult").value = scale;

    ensureEl("transformPreviewCanvas").style.transform = `
      translate(${shiftX * previewScale}px, ${shiftY * previewScale}px)
      scale(${mirrorH ? -scale : scale}, ${mirrorV ? -scale : scale})
      rotate(${angle}rad)
    `;
  }

  function handleMousedown(e) {
    mouseIsDown = true;
    const shiftX = +ensureEl("transformShiftX").value;
    const shiftY = +ensureEl("transformShiftY").value;
    mouseX = shiftX - e.clientX / previewScale;
    mouseY = shiftY - e.clientY / previewScale;
  }

  function handleMousemove(e) {
    if (!mouseIsDown) return;
    e.preventDefault();

    ensureEl("transformShiftX").value = Math.round(mouseX + e.clientX / previewScale);
    ensureEl("transformShiftY").value = Math.round(mouseY + e.clientY / previewScale);
    handleInput();
  }

  function handleWheel(e) {
    const $scaleInput = ensureEl("transformScaleInput");
    $scaleInput.value = $scaleInput.valueAsNumber - Math.sign(e.deltaY);
    handleInput();
  }

  function transformMap() {
    INFO && console.group("transformMap");

    const transformPointsValue = ensureEl("transformPointsInput").value;
    const globalPointsValue = ensureEl("pointsInput").value;
    if (transformPointsValue !== globalPointsValue) changeCellsDensity(transformPointsValue);

    const [projection, inverse] = getProjection();

    applyGraphSize();
    fitMapToScreen();
    resetZoom(0);
    undraw();
    Resample.process({projection, inverse, scale: 1});

    drawLayers();

    INFO && console.groupEnd("transformMap");
  }

  function getProjection() {
    const centerX = graphWidth / 2;
    const centerY = graphHeight / 2;
    const shiftX = +ensureEl("transformShiftX").value;
    const shiftY = +ensureEl("transformShiftY").value;
    const angle = (+ensureEl("transformAngleInput").value / 180) * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const scale = +ensureEl("transformScaleResult").value;
    const mirrorH = ensureEl("transformMirrorH").checked;
    const mirrorV = ensureEl("transformMirrorV").checked;

    function project(x, y) {
      // center the point
      x -= centerX;
      y -= centerY;

      // apply scale
      if (scale !== 1) {
        x *= scale;
        y *= scale;
      }

      // apply rotation
      if (angle) [x, y] = [x * cos - y * sin, x * sin + y * cos];

      // apply mirroring
      if (mirrorH) x = -x;
      if (mirrorV) y = -y;

      // uncenter the point and apply shift
      return [x + centerX + shiftX, y + centerY + shiftY];
    }

    function inverse(x, y) {
      // undo shift and center the point
      x -= centerX + shiftX;
      y -= centerY + shiftY;

      // undo mirroring
      if (mirrorV) y = -y;
      if (mirrorH) x = -x;

      // undo rotation
      if (angle !== 0) [x, y] = [x * cos + y * sin, -x * sin + y * cos];

      // undo scale
      if (scale !== 1) {
        x /= scale;
        y /= scale;
      }

      // uncenter the point
      return [x + centerX, y + centerY];
    }

    return [project, inverse];
  }
}
