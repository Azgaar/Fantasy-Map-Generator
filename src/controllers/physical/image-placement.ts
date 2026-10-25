// The Image Converter's placement step: fit, zoom and pan an uploaded image onto the map before converting it

import { Dialog } from "@/ui/dialog/dialog";
import { t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";

const DIALOG = "imagePlacement";
const [MIN_ZOOM, MAX_ZOOM] = [10, 400]; // percent
const PREVIEW_WIDTH = 320; // px

const STYLE = /* css */ `
  #${DIALOG} > div { width: auto; }
  #${DIALOG} canvas { display: block; width: 100%; cursor: grab; touch-action: none; }
  #${DIALOG} canvas:active { cursor: grabbing; }
  #${DIALOG} .controls { display: flex; align-items: center; gap: .4em; margin-top: .5em; }
  #${DIALOG} .controls slider-input { flex: 1; min-width: 0; }
  #${DIALOG} .controls input[type=range] { flex: 1; min-width: 0; }
  #${DIALOG} .controls input[type=number] { width: 4em; }
`;

type Fit = "contain" | "cover" | "stretch";
/** Zoom is in percent, the shift in fractions of the map size */
type Placement = { fit: Fit; zoom: number; x: number; y: number };

/** Ask how the image covers the map: resolves with the map-sized picture, or null when cancelled */
export function placeImage(image: HTMLImageElement): Promise<HTMLCanvasElement | null> {
  const { width, height } = options.map.graph;
  const placement: Placement = { fit: "contain", zoom: 100, x: 0, y: 0 };

  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${DIALOG}" class="dialog">
      <style>${STYLE}</style>
      <canvas data-tip="${t("Drag to pan, scroll to zoom. Black area becomes ocean")}"></canvas>
      <div class="controls" data-tip="${t("Set how the image fits the map")}">
        <span>${t("Fit")}</span>
        <select class="fit">
          <option value="contain">${t("Whole image")}</option>
          <option value="cover">${t("Fill map")}</option>
          <option value="stretch">${t("Stretch")}</option>
        </select>
        <button type="button" class="center" data-tip="${t("Center the image")}">${t("Center")}</button>
      </div>
      <div class="controls" data-tip="${t("Scale the image, in percent")}">
        <span>${t("Zoom")}</span>
        <slider-input min="${MIN_ZOOM}" max="${MAX_ZOOM}" value="100"></slider-input>
      </div>
    </div>`
  );
  const dialog = ensureEl(DIALOG);
  const preview = dialog.querySelector("canvas")!;
  preview.width = PREVIEW_WIDTH;
  preview.height = Math.round((PREVIEW_WIDTH * height) / width);
  const fitSelect = dialog.querySelector<HTMLSelectElement>(".fit")!;
  const slider = dialog.querySelector<HTMLInputElement>("slider-input")!;

  const show = () => {
    slider.value = String(Math.round(placement.zoom));
    draw(preview, image, placement);
  };
  show();

  const zoomTo = (zoom: number) => {
    placement.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    show();
  };
  fitSelect.addEventListener("change", () => {
    placement.fit = fitSelect.value as Fit;
    show();
  });
  dialog.querySelector(".center")!.addEventListener("click", () => {
    placement.x = placement.y = 0;
    show();
  });
  // slider-input re-dispatches a bubbling event from its inner controls; ignore those duplicates
  slider.addEventListener("input", event => {
    if (event.target === slider && slider.valueAsNumber) zoomTo(slider.valueAsNumber);
  });
  preview.addEventListener("wheel", event => {
    event.preventDefault();
    zoomTo(placement.zoom * 1.1 ** -Math.sign(event.deltaY));
  });

  preview.addEventListener("pointerdown", event => {
    preview.setPointerCapture(event.pointerId);
    let last = { x: event.clientX, y: event.clientY };
    const move = (moved: PointerEvent) => {
      const { width: shownWidth, height: shownHeight } = preview.getBoundingClientRect();
      placement.x += (moved.clientX - last.x) / shownWidth;
      placement.y += (moved.clientY - last.y) / shownHeight;
      last = { x: moved.clientX, y: moved.clientY };
      show();
    };
    const end = () => {
      preview.removeEventListener("pointermove", move);
      preview.removeEventListener("pointerup", end);
      preview.removeEventListener("pointercancel", end);
    };
    preview.addEventListener("pointermove", move);
    preview.addEventListener("pointerup", end);
    preview.addEventListener("pointercancel", end);
  });

  return new Promise(resolve => {
    let placed: HTMLCanvasElement | null = null;
    Dialog.open(DIALOG, {
      title: t("Place image"),
      width: "22em",
      modal: true,
      position: { my: "center", at: "center", of: "svg" },
      onClose: () => {
        Dialog.destroy(DIALOG);
        resolve(placed);
      },
      buttons: [
        {
          label: t("Apply"),
          onClick: () => {
            placed = document.createElement("canvas");
            placed.width = width;
            placed.height = height;
            draw(placed, image, placement);
            Dialog.close(DIALOG);
          }
        },
        { label: t("Cancel"), onClick: () => Dialog.close(DIALOG) }
      ]
    });
  });
}

/** Paint the placed image over black, the ocean color of every auto-assign scheme */
function draw(canvas: HTMLCanvasElement, image: HTMLImageElement, { fit, zoom, x, y }: Placement): void {
  const { width, height } = canvas;
  const ratio = (fit === "contain" ? Math.min : Math.max)(width / image.width, height / image.height);
  const w = (fit === "stretch" ? width : image.width * ratio) * (zoom / 100);
  const h = (fit === "stretch" ? height : image.height * ratio) * (zoom / 100);

  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, (width - w) / 2 + x * width, (height - h) / 2 + y * height, w, h);
}
