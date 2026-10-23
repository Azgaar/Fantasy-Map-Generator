import { viewport } from "@/renderers/viewport/viewport";
import { closeDialogs, destroyDialog } from "@/ui/dialog/dialog-helpers";
import { onViewportChange, zoomTo } from "@/ui/map/zoom";
import { t } from "@/utils/i18n";
import { ensureEl, findEl, minmax, rn } from "../utils";

let stopFollowing: (() => void) | undefined;

function open(): void {
  closeDialogs("#minimap, .stable");
  renderDialog();
  updateMinimap();
  stopFollowing ??= onViewportChange(updateMinimap);

  $("#minimap").dialog({
    title: t("Minimap"),
    resizable: false,
    width: "auto",
    position: { my: "left bottom", at: "left+10 bottom-25", of: "svg", collision: "fit" },
    open: function (this: HTMLElement) {
      $(this).parent().addClass("minimap-dialog");
    },
    close: closeMinimap
  });
}

function renderDialog(): void {
  destroyDialog("minimap");
  const html = /* html */ `<div id="minimap" class="dialog stable">
      <div id="minimapViewportWrap">
        <svg id="minimapSurface" preserveAspectRatio="xMidYMid meet" aria-label="${t("Map minimap")}">
          <use id="minimapMapUse" href="#viewbox"></use>
          <rect id="minimapViewport"></rect>
        </svg>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  ensureEl("minimapSurface").addEventListener("click", minimapClickToPan);

  findEl("minimapStyles")?.remove();
  const style = document.createElement("style");
  style.id = "minimapStyles";
  style.textContent = /* css */ `
    .minimap-dialog .ui-dialog-content {
      padding: 0 !important;
      overflow: hidden;
    }

    #minimap {
      padding: 0 !important;
      background: transparent;
    }

    #minimapViewportWrap {
      position: relative;
      width: 20em;
      border: 0;
    }

    #minimapSurface {
      display: block;
      width: 100%;
      height: auto;
      cursor: crosshair;
    }

    #minimapMapUse {
      pointer-events: none;
    }

    #minimapViewport {
      fill: rgba(190, 255, 137, 0.1);
      stroke: #624954;
      stroke-width: 1;
      stroke-dasharray: 4;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
  `;
  document.head.append(style);
}

function closeMinimap(): void {
  stopFollowing?.();
  stopFollowing = undefined;
  $("#minimap").dialog("destroy");
  ensureEl("minimap").remove();
  findEl("minimapStyles")?.remove();
}

function minimapClickToPan(event: MouseEvent): void {
  const minimap = findEl<SVGSVGElement>("minimapSurface");
  if (!minimap) return;

  const point = minimap.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;

  const ctm = minimap.getScreenCTM();
  if (!ctm) return;

  const svgPoint = point.matrixTransform(ctm.inverse());
  const x = minmax(svgPoint.x, 0, options.map.graph.width);
  const y = minmax(svgPoint.y, 0, options.map.graph.height);
  zoomTo(x, y, viewport.scale, 450);
}

function updateMinimap(): void {
  const minimap = findEl<SVGSVGElement>("minimapSurface");
  const viewportRect = findEl<SVGRectElement>("minimapViewport");
  const mapUse = findEl<SVGUseElement>("minimapMapUse");
  if (!minimap || !viewportRect || !mapUse) return;

  minimap.setAttribute("viewBox", `0 0 ${options.map.graph.width} ${options.map.graph.height}`);

  // #viewbox already has the current transform; invert it in minimap to show the whole world map.
  const inverseScale = viewport.scale ? 1 / viewport.scale : 1;
  mapUse.setAttribute(
    "transform",
    `translate(${rn(-viewport.x * inverseScale, 3)} ${rn(-viewport.y * inverseScale, 3)}) scale(${rn(inverseScale, 6)})`
  );

  const left = Math.max(0, -viewport.x * inverseScale);
  const top = Math.max(0, -viewport.y * inverseScale);
  const right = Math.min(options.map.graph.width, left + viewport.width * inverseScale);
  const bottom = Math.min(options.map.graph.height, top + viewport.height * inverseScale);

  viewportRect.setAttribute("x", String(rn(left, 3)));
  viewportRect.setAttribute("y", String(rn(top, 3)));
  viewportRect.setAttribute("width", String(rn(Math.max(0, right - left), 3)));
  viewportRect.setAttribute("height", String(rn(Math.max(0, bottom - top), 3)));
}

export const Minimap = { open };
