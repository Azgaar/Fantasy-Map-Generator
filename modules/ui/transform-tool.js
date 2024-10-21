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
  byId("transformToolBody").on("input", handleInput);
  byId("transformPointsInput").on("input", handleCellsChange);
  byId("transformPreview")
    .on("mousedown", handleMousedown)
    .on("mouseup", _ => (mouseIsDown = false))
    .on("mousemove", handleMousemove)
    .on("wheel", handleWheel);

  async function loadPreview() {
    byId("transformPreview").style.width = width + "px";
    byId("transformPreview").style.height = height + "px";

    const options = {noWater: true, fullMap: true, noLabels: true, noScaleBar: true, noVignette: true, noIce: true};
    const url = await getMapURL("png", options);
    const SCALE = 4;

    const img = new Image();
    img.src = url;
    img.onload = function () {
      const $canvas = byId("transformPreviewCanvas");
      $canvas.style.width = width + "px";
      $canvas.style.height = height + "px";
      $canvas.width = width * SCALE;
      $canvas.height = height * SCALE;
      $canvas.getContext("2d").drawImage(img, 0, 0, width * SCALE, height * SCALE);
    };
  }

  function resetInputs() {
    byId("transformAngleInput").value = 0;
    byId("transformAngleOutput").value = "0";
    byId("transformMirrorH").checked = false;
    byId("transformMirrorV").checked = false;
    byId("transformScaleInput").value = 0;
    byId("transformScaleResult").value = 1;
    byId("transformShiftX").value = 0;
    byId("transformShiftY").value = 0;
    handleInput();
  }

  function handleInput() {
    const angle = (+byId("transformAngleInput").value / 180) * Math.PI;
    const shiftX = +byId("transformShiftX").value;
    const shiftY = +byId("transformShiftY").value;
    const mirrorH = byId("transformMirrorH").checked;
    const mirrorV = byId("transformMirrorV").checked;

    const EXP = 1.0965;
    const scale = rn(EXP ** +byId("transformScaleInput").value, 2); // [0.1, 10]x
    byId("transformScaleResult").value = scale;

    byId("transformPreviewCanvas").style.transform = `
      translate(${shiftX * previewScale}px, ${shiftY * previewScale}px)
      scale(${mirrorH ? -scale : scale}, ${mirrorV ? -scale : scale})
      rotate(${angle}rad)
    `;
  }

  function handleCellsChange() {
    const cells = cellsDensityMap[+this.value] || 1000;
    this.dataset.cells = cells;
    const output = byId("transformPointsFormatted");
    output.value = getCellsDensityValue(cells);
    output.style.color = getCellsDensityColor(cells);
  }

  function handleMousedown(e) {
    mouseIsDown = true;
    const shiftX = +byId("transformShiftX").value;
    const shiftY = +byId("transformShiftY").value;
    mouseX = shiftX - e.clientX / previewScale;
    mouseY = shiftY - e.clientY / previewScale;
  }

  function handleMousemove(e) {
    if (!mouseIsDown) return;
    e.preventDefault();

    byId("transformShiftX").value = Math.round(mouseX + e.clientX / previewScale);
    byId("transformShiftY").value = Math.round(mouseY + e.clientY / previewScale);
    handleInput();
  }

  function handleWheel(e) {
    const $scaleInput = byId("transformScaleInput");
    $scaleInput.value = $scaleInput.valueAsNumber - Math.sign(e.deltaY);
    handleInput();
  }

  function transformMap() {
    INFO && console.group("transformMap");

    const cellsNumber = +byId("transformPointsInput").value;
    changeCellsDensity(cellsNumber);

    const parentMap = {grid: deepCopy(grid), pack: deepCopy(pack), notes: deepCopy(notes)};
    const [projection, inverse] = getProjection();

    resetZoom(0);
    undraw();
    Resample.process({parentMap, projection, inverse, scale: 1});
    drawLayers();

    INFO && console.groupEnd("transformMap");
  }

  function getProjection() {
    const centerX = graphWidth / 2;
    const centerY = graphHeight / 2;
    const shiftX = +byId("transformShiftX").value;
    const shiftY = +byId("transformShiftY").value;
    const angle = (+byId("transformAngleInput").value / 180) * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const scale = +byId("transformScaleResult").value;
    const mirrorH = byId("transformMirrorH").checked;
    const mirrorV = byId("transformMirrorV").checked;

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
