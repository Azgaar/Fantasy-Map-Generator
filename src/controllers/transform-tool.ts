import { destroyDialogIfExists, ensureEl, rn } from "../utils";

function open(): void {
  const width = Math.min(400, window.innerWidth * 0.5);
  const previewScale = width / graphWidth;
  const height = graphHeight * previewScale;

  let mouseIsDown = false;
  let mouseX = 0;
  let mouseY = 0;

  renderDialog();
  resetInputs();
  void loadPreview();

  $("#transformTool").dialog({
    title: "Transform map",
    resizable: false,
    position: { my: "center", at: "center", of: "svg" },
    close: () => destroyDialogIfExists("transformTool"),
    buttons: {
      Transform: () => {
        closeDialogs();
        transformMap();
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });

  ensureEl("transformToolBody").on("input", handleInput);
  const preview = ensureEl("transformPreview");
  preview.addEventListener("mousedown", handleMousedown);
  preview.addEventListener("mouseup", () => {
    mouseIsDown = false;
  });
  preview.addEventListener("mousemove", handleMousemove);
  preview.addEventListener("wheel", handleWheel);

  async function loadPreview(): Promise<void> {
    ensureEl("transformPreview").style.width = `${width}px`;
    ensureEl("transformPreview").style.height = `${height}px`;

    const options = { noWater: true, fullMap: true, noLabels: true, noScaleBar: true, noVignette: true, noIce: true };
    const url = await window.Services.ExportMap.getMapURL("png", options);
    const SCALE = 4;

    const img = new Image();
    img.src = url;
    img.onload = () => {
      const $canvas = ensureEl<HTMLCanvasElement>("transformPreviewCanvas");
      $canvas.style.width = `${width}px`;
      $canvas.style.height = `${height}px`;
      $canvas.width = width * SCALE;
      $canvas.height = height * SCALE;
      $canvas.getContext("2d")?.drawImage(img, 0, 0, width * SCALE, height * SCALE);
    };
  }

  function resetInputs(): void {
    ensureEl<HTMLInputElement>("transformAngleInput").value = "0";
    ensureEl<HTMLOutputElement>("transformAngleOutput").value = "0";
    ensureEl<HTMLInputElement>("transformMirrorH").checked = false;
    ensureEl<HTMLInputElement>("transformMirrorV").checked = false;
    ensureEl<HTMLInputElement>("transformScaleInput").value = "0";
    ensureEl<HTMLOutputElement>("transformScaleResult").value = "1";
    ensureEl<HTMLInputElement>("transformShiftX").value = "0";
    ensureEl<HTMLInputElement>("transformShiftY").value = "0";
    handleInput();

    updateCellsNumber(ensureEl<HTMLInputElement>("pointsInput").value);
    ensureEl<HTMLInputElement>("transformPointsInput").oninput = e =>
      updateCellsNumber((e.target as HTMLInputElement).value);

    function updateCellsNumber(value: string): void {
      const input = ensureEl<HTMLInputElement>("transformPointsInput");
      input.value = value;
      const cells = cellsDensityMap[+value];
      input.dataset.cells = String(cells);
      const output = ensureEl<HTMLOutputElement>("transformPointsFormatted");
      output.value = `${cells / 1000}K`;
      output.style.color = getCellsDensityColor(cells);
    }
  }

  function handleInput(): void {
    const angle = (+ensureEl<HTMLInputElement>("transformAngleInput").value / 180) * Math.PI;
    const shiftX = +ensureEl<HTMLInputElement>("transformShiftX").value;
    const shiftY = +ensureEl<HTMLInputElement>("transformShiftY").value;
    const mirrorH = ensureEl<HTMLInputElement>("transformMirrorH").checked;
    const mirrorV = ensureEl<HTMLInputElement>("transformMirrorV").checked;

    const EXP = 1.0965;
    const scale = rn(EXP ** +ensureEl<HTMLInputElement>("transformScaleInput").value, 2); // [0.1, 10]x
    ensureEl<HTMLOutputElement>("transformScaleResult").value = String(scale);

    ensureEl<HTMLCanvasElement>("transformPreviewCanvas").style.transform = `
      translate(${shiftX * previewScale}px, ${shiftY * previewScale}px)
      scale(${mirrorH ? -scale : scale}, ${mirrorV ? -scale : scale})
      rotate(${angle}rad)
    `;
  }

  function handleMousedown(e: MouseEvent): void {
    mouseIsDown = true;
    const shiftX = +ensureEl<HTMLInputElement>("transformShiftX").value;
    const shiftY = +ensureEl<HTMLInputElement>("transformShiftY").value;
    mouseX = shiftX - e.clientX / previewScale;
    mouseY = shiftY - e.clientY / previewScale;
  }

  function handleMousemove(e: MouseEvent): void {
    if (!mouseIsDown) return;
    e.preventDefault();

    ensureEl<HTMLInputElement>("transformShiftX").value = String(Math.round(mouseX + e.clientX / previewScale));
    ensureEl<HTMLInputElement>("transformShiftY").value = String(Math.round(mouseY + e.clientY / previewScale));
    handleInput();
  }

  function handleWheel(e: WheelEvent): void {
    const $scaleInput = ensureEl<HTMLInputElement>("transformScaleInput");
    $scaleInput.value = String($scaleInput.valueAsNumber - Math.sign(e.deltaY));
    handleInput();
  }

  function transformMap(): void {
    INFO && console.group("transformMap");

    const transformPointsValue = ensureEl<HTMLInputElement>("transformPointsInput").value;
    const globalPointsValue = ensureEl<HTMLInputElement>("pointsInput").value;
    if (transformPointsValue !== globalPointsValue) changeCellsDensity(transformPointsValue);

    const [projection, inverse] = getProjection();

    applyGraphSize();
    fitMapToScreen();
    resetZoom(0);
    undraw();
    Resample.process({ projection, inverse, scale: 1 });

    drawLayers();

    INFO && console.groupEnd();
  }

  function getProjection(): [(x: number, y: number) => [number, number], (x: number, y: number) => [number, number]] {
    const centerX = graphWidth / 2;
    const centerY = graphHeight / 2;
    const shiftX = +ensureEl<HTMLInputElement>("transformShiftX").value;
    const shiftY = +ensureEl<HTMLInputElement>("transformShiftY").value;
    const angle = (+ensureEl<HTMLInputElement>("transformAngleInput").value / 180) * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const scale = +ensureEl<HTMLOutputElement>("transformScaleResult").value;
    const mirrorH = ensureEl<HTMLInputElement>("transformMirrorH").checked;
    const mirrorV = ensureEl<HTMLInputElement>("transformMirrorV").checked;

    function project(x: number, y: number): [number, number] {
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

    function inverse(x: number, y: number): [number, number] {
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

function renderDialog(): void {
  destroyDialogIfExists("transformTool");

  const html = /* html */ `<div id="transformTool" class="dialog">
    <div style="padding-top: 0.5em; width: 40em; font-weight: bold">
      This operation is destructive and irreversible. It will create a completely new map based on the current one.
      Don't forget to save the .map file to your machine first!
    </div>
    <div
      id="transformToolBody"
      style="
        padding: 0.5em 0;
        width: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: repeat(5, 1fr);
        align-items: center;
      "
    >
      <div>Points number</div>
      <div>
        <input id="transformPointsInput" type="range" min="1" max="13" value="4" />
        <output id="transformPointsFormatted" style="color: #053305">10K</output>
      </div>
      <div>Shift</div>
      <div>
        <label>X: <input id="transformShiftX" type="number" size="4" value="0" /></label>
        <label>Y: <input id="transformShiftY" type="number" size="4" value="0" /></label>
      </div>
      <div>Rotate</div>
      <div>
        <input id="transformAngleInput" type="range" min="0" max="359" value="0" />
        <output id="transformAngleOutput">0</output>°
      </div>
      <div>Scale</div>
      <div>
        <input id="transformScaleInput" type="range" min="-25" max="25" value="0" />
        <output id="transformScaleResult">1</output>x
      </div>
      <div>Mirror</div>
      <div style="display: flex; gap: 0.5em">
        <input type="checkbox" class="checkbox" id="transformMirrorH" />
        <label for="transformMirrorH" class="checkbox-label">horizontally</label>
        <input type="checkbox" class="checkbox" id="transformMirrorV" />
        <label for="transformMirrorV" class="checkbox-label">vertically</label>
      </div>
    </div>
    <div id="transformPreview" style="position: relative; overflow: hidden; outline: 1px solid #666">
      <canvas id="transformPreviewCanvas" style="position: absolute; transform-origin: center"></canvas>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
}

export const TransformTool = { open };
