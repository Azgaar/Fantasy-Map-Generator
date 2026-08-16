import { destroyDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { Resample } from "@/generators/resample";
import { getLatitude, getLongitude } from "@/utils";
import { ensureEl, minmax, rn } from "../utils";

function open(): void {
  renderDialog();
  addListeners();

  $("#submapTool").dialog({
    title: "Create a submap",
    resizable: false,
    width: "32em",
    position: { my: "center", at: "center", of: "svg" },
    close: cleanup,
    buttons: {
      Submap: function (this: HTMLElement) {
        generateSubmap();
        $(this).dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function renderDialog(): void {
  destroyDialog("submapTool");

  const pointsValue = ensureEl<HTMLInputElement>("pointsInput").value;
  const cells = cellsDensityMap[+pointsValue];

  const html = /* html */ `<div id="submapTool" class="dialog">
    <p style="font-weight: bold">
      This operation is destructive and irreversible. It will create a completely new map based on the current one.
      Don't forget to save the .map file to your machine first!
    </p>
    <div style="display: flex; flex-direction: column; gap: 0.5em">
      <div data-tip="Set points (cells) number of the submap" style="display: flex; gap: 1em">
        <div>Points number</div>
        <div>
          <input id="submapPointsInput" type="range" min="1" max="13" value="${pointsValue}" />
          <output id="submapPointsFormatted" style="color: ${getCellsDensityColor(cells)}">${cells / 1000}K</output>
        </div>
      </div>
      <div data-tip="Check to fit burg styles (icon and label size) to the submap scale">
        <input type="checkbox" class="checkbox" id="submapRescaleBurgStyles" checked />
        <label for="submapRescaleBurgStyles" class="checkbox-label">Rescale burg styles</label>
      </div>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
}

function addListeners(): void {
  ensureEl<HTMLInputElement>("submapPointsInput").oninput = handlePointsInput;
}

function cleanup(): void {
  destroyDialog("submapTool");
}

function handlePointsInput(e: Event): void {
  const cells = cellsDensityMap[+(e.target as HTMLInputElement).value];
  const output = ensureEl<HTMLOutputElement>("submapPointsFormatted");
  output.value = `${cells / 1000}K`;
  output.style.color = getCellsDensityColor(cells);
}

function generateSubmap(): void {
  INFO && console.group("generateSubmap");

  const [x0, y0] = [Math.abs(viewX / scale), Math.abs(viewY / scale)]; // top-left corner
  recalculateMapSize(x0, y0);

  const submapPointsValue = ensureEl<HTMLInputElement>("submapPointsInput").value;
  const globalPointsValue = ensureEl<HTMLInputElement>("pointsInput").value;
  if (submapPointsValue !== globalPointsValue) changeCellsDensity(submapPointsValue);

  const projection = (x: number, y: number): [number, number] => [(x - x0) * scale, (y - y0) * scale];
  const inverse = (x: number, y: number): [number, number] => [x / scale + x0, y / scale + y0];

  applyGraphSize();
  fitMapToScreen();
  resetZoom(0);
  undraw();
  Resample.process({ projection, inverse, scale });

  if (ensureEl<HTMLInputElement>("submapRescaleBurgStyles").checked) rescaleBurgStyles(scale);
  Layers.drawAll();

  INFO && console.groupEnd();
}

function recalculateMapSize(x0: number, y0: number): void {
  options.mapSize = rn(options.mapSize / scale, 2);

  const latT = (mapCoordinates.latT ?? 0) / scale;
  const latN = getLatitude(y0, mapCoordinates, graphHeight);
  options.latitude = rn(((90 - latN) / (180 - latT)) * 100, 2);

  const lotT = (mapCoordinates.lonT ?? 0) / scale;
  const lonE = getLongitude(x0 + graphWidth / scale, mapCoordinates, graphWidth);
  options.longitude = rn(((180 - lonE) / (360 - lotT)) * 100, 2);

  distanceScale = rn(distanceScale / scale, 2);
  ensureEl<HTMLInputElement>("distanceScaleInput").value = String(distanceScale);
  populationRate = rn(populationRate / scale, 2);
  ensureEl<HTMLInputElement>("populationRateInput").value = String(populationRate);
}

function rescaleBurgStyles(scale: number): void {
  for (const group of ensureEl("burgIcons").querySelectorAll<SVGGElement>(":scope > g")) {
    const iconStyle: Record<string, string> = { ...style.burgIcons[group.id] };
    for (const { name, value } of group.attributes) iconStyle[name] = value;

    const size = Number(iconStyle["font-size"]) || 1;
    iconStyle["font-size"] = String(rn(minmax(size * scale, 0.2, 10), 2));

    style.burgIcons[group.id] = iconStyle;
    group.remove();
  }

  const burgLabelGroups = new Set(
    pack.burgs.filter(burg => burg.i && !burg.removed).map(burg => burg.label?.group || burg.group || "burg")
  );

  for (const groupName of burgLabelGroups) {
    const groupStyle = style.labels.groups[groupName];
    if (!groupStyle) continue;

    const size = Number.parseFloat(groupStyle["font-size"]) || 0;
    const rescaledSize = Math.max(rn((size + size / scale) / 2, 2), 1) * scale;
    groupStyle["font-size"] = `${rn(rescaledSize, 2)}%`;
  }
}

export const SubmapTool = { open };
