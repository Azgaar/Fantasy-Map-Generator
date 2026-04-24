"use strict";

let minimapInitialized = false;

export function openMinimapDialog() {
  closeDialogs("#minimap, .stable");
  ensureMinimapStyles();
  ensureMinimapMarkup();

  updateMinimap();

  $("#minimap").dialog({
    title: "Minimap",
    resizable: false,
    width: "auto",
    position: {my: "left bottom", at: "left+10 bottom-25", of: "svg", collision: "fit"},
    open: function () {
      $(this).parent().addClass("minimap-dialog");
    },
    close: function () {
      $(this).dialog("destroy");
    }
  });
}

function ensureMinimapStyles() {
  if (byId("minimapStyles")) return;

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

function ensureMinimapMarkup() {
  if (minimapInitialized) return;

  const container = byId("minimapContent");
  if (!container) return;

  minimapInitialized = true;
  container.innerHTML = /* html */ `
    <div id="minimapViewportWrap">
      <svg id="minimapSurface" preserveAspectRatio="xMidYMid meet" aria-label="Map minimap">
        <use id="minimapMapUse" href="#viewbox"></use>
        <rect id="minimapViewport"></rect>
      </svg>
    </div>
  `;

  byId("minimapSurface")?.addEventListener("click", minimapClickToPan);
  window.updateMinimap = updateMinimap;
}

function minimapClickToPan(event) {
  const minimap = byId("minimapSurface");
  if (!minimap) return;

  const point = minimap.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;

  const ctm = minimap.getScreenCTM();
  if (!ctm) return;

  const svgPoint = point.matrixTransform(ctm.inverse());
  const x = minmax(svgPoint.x, 0, graphWidth);
  const y = minmax(svgPoint.y, 0, graphHeight);
  zoomTo(x, y, scale, 450);
}

function updateMinimap() {
  const minimap = byId("minimapSurface");
  const viewport = byId("minimapViewport");
  const mapUse = byId("minimapMapUse");
  if (!minimap || !viewport || !mapUse) return;

  minimap.setAttribute("viewBox", `0 0 ${graphWidth} ${graphHeight}`);

  // #viewbox already has the current transform; invert it in minimap to show the whole world map.
  const inverseScale = scale ? 1 / scale : 1;
  mapUse.setAttribute(
    "transform",
    `translate(${rn(-viewX * inverseScale, 3)} ${rn(-viewY * inverseScale, 3)}) scale(${rn(inverseScale, 6)})`
  );

  const left = Math.max(0, -viewX * inverseScale);
  const top = Math.max(0, -viewY * inverseScale);
  const right = Math.min(graphWidth, left + svgWidth * inverseScale);
  const bottom = Math.min(graphHeight, top + svgHeight * inverseScale);

  viewport.setAttribute("x", rn(left, 3));
  viewport.setAttribute("y", rn(top, 3));
  viewport.setAttribute("width", rn(Math.max(0, right - left), 3));
  viewport.setAttribute("height", rn(Math.max(0, bottom - top), 3));
}
