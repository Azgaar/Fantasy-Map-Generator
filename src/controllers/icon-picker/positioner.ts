// The icon picker's positioner: zoom and pan a custom icon's picture inside its frame

import { destroyDialog } from "@/components/dialog/dialog-helpers";
import { CustomIcons, Icons } from "@/components/icons";
import { tip } from "@/components/tooltips";
import { ensureEl } from "@/utils";
import { IconPictures } from "./pictures";

const DIALOG = "iconPositioner";
const MARGIN = 0.25; // the stage shows this much of the frame's side around it, dimmed
const ZOOM_RANGE = 3; // the slider spans 2^-3 … 2^3 of the frame the dialog opened with

const STYLE = /* css */ `
  #${DIALOG} .stage { width: 16em; height: 16em; margin: 0 auto; background: repeating-conic-gradient(#e8e8e8 0 25%, #fff 0 50%) 0 0 / 1em 1em; cursor: grab; touch-action: none; }
  #${DIALOG} .stage:active { cursor: grabbing; }
  #${DIALOG} .stage svg { display: block; width: 100%; height: 100%; }
  #${DIALOG} .controls { display: flex; align-items: center; gap: .4em; margin-top: .5em; }
  #${DIALOG} .controls input { flex: 1; }
  #${DIALOG} .previews { display: flex; justify-content: center; align-items: center; gap: 1em; margin-top: .5em; }
  #${DIALOG} .previews svg { width: 2em; height: 2em; }
  #${DIALOG} .previews .circle svg { border-radius: 50%; background: #d4c7a1; }
  #${DIALOG} .previews .small svg { width: 1em; height: 1em; }
`;

/** The frame as a center and a side: the positioner keeps frames square */
type Frame = { x: number; y: number; side: number };

export function openPositioner(id: string): void {
  const icon = CustomIcons.get(id);
  const symbol = document.getElementById(id);
  if (!icon || !symbol) return;

  const original = icon.viewBox;
  const { fill, stroke } = Icons.paint;
  const reference = toFrame(original);
  let frame = { ...reference };

  const previous = document.getElementById(DIALOG);
  if (previous) $(previous).dialog("close");
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${DIALOG}" class="dialog">
      <style>${STYLE}</style>
      <div class="stage" data-tip="Drag to pan, scroll to zoom">
        <svg><g class="art" fill="${fill}" stroke="${stroke}">${symbol.innerHTML}</g><path class="shade" fill="#000" fill-opacity=".45" fill-rule="evenodd"/><rect class="edge" fill="none" stroke="#d0240f" vector-effect="non-scaling-stroke" stroke-dasharray="4 3"/></svg>
      </div>
      <div class="controls">
        <span>Zoom</span>
        <input type="range" min="${-ZOOM_RANGE}" max="${ZOOM_RANGE}" step="0.01" value="0" />
        <button type="button" class="fit" data-tip="Fit the frame to the picture's visible content">Fit</button>
      </div>
      <div class="previews" data-tip="The icon at map sizes">
        <span class="small">${Icons.html(id)}</span>
        <span>${Icons.html(id)}</span>
        <span class="circle">${Icons.html(id)}</span>
      </div>
    </div>`
  );
  const dialog = ensureEl(DIALOG);
  const stage = dialog.querySelector<SVGSVGElement>(".stage svg")!;
  const slider = dialog.querySelector<HTMLInputElement>(".controls input")!;

  // every use of the symbol, on the map and in the previews, follows as the frame moves
  const show = (next: Frame) => {
    frame = next;
    const { x, y, side } = frame;
    const margin = side * MARGIN;
    const [left, top, full] = [x - side / 2 - margin, y - side / 2 - margin, side + 2 * margin];
    stage.setAttribute("viewBox", `${left} ${top} ${full} ${full}`);
    const [frameLeft, frameTop] = [x - side / 2, y - side / 2];
    stage
      .querySelector(".shade")!
      .setAttribute(
        "d",
        `M${left},${top}h${full}v${full}h${-full}z M${frameLeft},${frameTop}v${side}h${side}v${-side}z`
      );
    const edge = stage.querySelector(".edge")!;
    for (const [name, value] of Object.entries({ x: frameLeft, y: frameTop, width: side, height: side }))
      edge.setAttribute(name, String(value));
    slider.value = String(Math.log2(reference.side / side));
    symbol.setAttribute("viewBox", toViewBox(frame));
  };
  show(frame);

  const zoomTo = (side: number) => {
    const [smallest, largest] = [reference.side / 2 ** ZOOM_RANGE, reference.side * 2 ** ZOOM_RANGE];
    show({ ...frame, side: Math.min(largest, Math.max(smallest, side)) });
  };
  slider.addEventListener("input", () => zoomTo(reference.side / 2 ** +slider.value));
  stage.addEventListener("wheel", event => {
    event.preventDefault();
    zoomTo(frame.side * 1.1 ** Math.sign(event.deltaY));
  });

  stage.addEventListener("pointerdown", event => {
    stage.setPointerCapture(event.pointerId);
    let last = { x: event.clientX, y: event.clientY };
    const move = (moved: PointerEvent) => {
      const unitsPerPixel = (frame.side * (1 + 2 * MARGIN)) / stage.clientWidth;
      show({
        ...frame,
        x: frame.x - (moved.clientX - last.x) * unitsPerPixel,
        y: frame.y - (moved.clientY - last.y) * unitsPerPixel
      });
      last = { x: moved.clientX, y: moved.clientY };
    };
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", () => stage.removeEventListener("pointermove", move), { once: true });
  });

  dialog.querySelector(".fit")!.addEventListener("click", async () => {
    const fitted = await IconPictures.fit(icon);
    if (!dialog.isConnected) return;
    show(toFrame(fitted));
    tip("The frame is fitted to the picture", false, "success", 2000);
  });

  let applied = false;
  $(dialog).dialog({
    title: "Position icon",
    width: "20em",
    position: { my: "center", at: "center", of: "svg" },
    close: () => {
      if (!applied) symbol.setAttribute("viewBox", original);
      destroyDialog(DIALOG);
    },
    buttons: {
      Apply: function (this: HTMLElement) {
        applied = true;
        CustomIcons.setFrame(id, toViewBox(frame));
        $(this).dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function toFrame(viewBox: string): Frame {
  const [x, y, width, height] = Icons.parseFrame(viewBox) ?? [0, 0, 100, 100];
  return { x: x + width / 2, y: y + height / 2, side: Math.max(width, height) };
}

function toViewBox({ x, y, side }: Frame): string {
  return Icons.formatFrame([x - side / 2, y - side / 2, side, side]);
}
