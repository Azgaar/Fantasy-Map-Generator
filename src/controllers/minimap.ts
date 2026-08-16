import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { showDomDialog } from "@/components/ui/dom-dialog";
import { ensureEl, minmax, rn } from "../utils";
import { groupOverviewPaths } from "./minimap-overview";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
let overviewObserver: MutationObserver | null = null;
let overviewFrameId: number | null = null;

function open(): void {
  closeDialogs("#minimap, .stable");
  renderDialog();
  updateMinimap();

  showDomDialog({
    className: "minimap-dialog",
    content: ensureEl("minimap"),
    onClose: closeMinimap,
    placement: "bottom-left",
    placementOffset: { x: 10, y: 25 },
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Minimap",
    width: "fit-content"
  });
}

function renderDialog(): void {
  destroyDialog("minimap");
  const html = /* html */ `<div id="minimap" class="dialog stable">
      <div id="minimapViewportWrap">
        <svg id="minimapSurface" preserveAspectRatio="xMidYMid meet" aria-label="Map minimap">
          <g id="minimapOverview" pointer-events="none"></g>
          <rect id="minimapViewport"></rect>
        </svg>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  ensureEl("minimapSurface").addEventListener("click", minimapClickToPan);
  renderOverview();
  observeOverviewSources();

  document.getElementById("minimapStyles")?.remove();
  const style = document.createElement("style");
  style.id = "minimapStyles";
  style.textContent = /* css */ `
    .minimap-dialog .ui-dialog-content {
      padding: 0 !important;
      overflow: hidden;
    }

    .minimap-dialog .fmg-dialog__body {
      padding: 0;
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

    #minimapOverview {
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
  overviewObserver?.disconnect();
  overviewObserver = null;
  if (overviewFrameId !== null) cancelAnimationFrame(overviewFrameId);
  overviewFrameId = null;
  destroyDialog("minimap");
  document.getElementById("minimapStyles")?.remove();
}

function minimapClickToPan(event: MouseEvent): void {
  const minimap = document.getElementById("minimapSurface") as SVGSVGElement | null;
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

function updateMinimap(): void {
  const minimap = document.getElementById("minimapSurface") as SVGSVGElement | null;
  const viewport = document.getElementById("minimapViewport") as SVGRectElement | null;
  if (!minimap || !viewport) return;

  minimap.setAttribute("viewBox", `0 0 ${graphWidth} ${graphHeight}`);

  const inverseScale = scale ? 1 / scale : 1;
  const left = Math.max(0, -viewX * inverseScale);
  const top = Math.max(0, -viewY * inverseScale);
  const right = Math.min(graphWidth, left + svgWidth * inverseScale);
  const bottom = Math.min(graphHeight, top + svgHeight * inverseScale);

  viewport.setAttribute("x", String(rn(left, 3)));
  viewport.setAttribute("y", String(rn(top, 3)));
  viewport.setAttribute("width", String(rn(Math.max(0, right - left), 3)));
  viewport.setAttribute("height", String(rn(Math.max(0, bottom - top), 3)));
}

function renderOverview(): void {
  const overview = document.querySelector<SVGGElement>("#minimapOverview");
  const featurePaths = document.querySelector<SVGGElement>("#featurePaths");
  if (!overview || !featurePaths || !pack.features) return;

  const pathsByFeature = new Map(
    Array.from(featurePaths.querySelectorAll<SVGPathElement>(":scope > path[data-f]"), path => [
      Number(path.dataset.f),
      path.getAttribute("d") || ""
    ])
  );
  const { land, lakes } = groupOverviewPaths(pack.features, pathsByFeature);

  const ocean = createElement("rect", { width: graphWidth, height: graphHeight });
  copyPaint(document.getElementById("oceanBase"), ocean, { fill: "#466eab" });

  const landPath = createElement("path", { d: land.join(""), "fill-rule": "evenodd" });
  copyPaint(document.getElementById("landmass"), landPath, { fill: "#eef6fb" });
  copyStroke(document.getElementById("sea_island"), landPath);

  const elements: SVGElement[] = [ocean, landPath];
  for (const [group, paths] of lakes) {
    const lakePath = createElement("path", { d: paths.join("") });
    copyPaint(document.getElementById(group), lakePath, { fill: "#a6c1fd" });
    copyStroke(document.getElementById(group), lakePath);
    elements.push(lakePath);
  }
  overview.replaceChildren(...elements);
}

function observeOverviewSources(): void {
  overviewObserver?.disconnect();
  overviewObserver = new MutationObserver(scheduleOverviewRender);
  const featurePaths = document.getElementById("featurePaths");
  if (featurePaths) {
    overviewObserver.observe(featurePaths, {
      attributes: true,
      attributeFilter: ["d"],
      childList: true,
      subtree: true
    });
  }

  for (const id of ["lakes", "coastline"]) {
    const element = document.getElementById(id);
    if (element) overviewObserver.observe(element, { childList: true, subtree: true });
  }

  for (const id of ["oceanBase", "landmass", "sea_island", "freshwater", "salt", "sinkhole", "frozen", "lava", "dry"]) {
    const element = document.getElementById(id);
    if (element)
      overviewObserver.observe(element, {
        attributes: true,
        attributeFilter: ["fill", "stroke", "stroke-width", "opacity"]
      });
  }
}

function scheduleOverviewRender(): void {
  if (overviewFrameId !== null) return;
  overviewFrameId = requestAnimationFrame(() => {
    overviewFrameId = null;
    renderOverview();
  });
}

function createElement(tagName: string, attributes: Record<string, string | number>): SVGElement {
  const element = document.createElementNS(SVG_NAMESPACE, tagName);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

function copyPaint(source: Element | null, target: SVGElement, fallback: { fill: string }): void {
  const style = source ? getComputedStyle(source) : null;
  target.setAttribute("fill", source?.getAttribute("fill") || style?.fill || fallback.fill);
  const opacity = source?.getAttribute("opacity") || style?.opacity;
  if (opacity && opacity !== "1") target.setAttribute("opacity", opacity);
}

function copyStroke(source: Element | null, target: SVGElement): void {
  if (!source) return;
  const style = getComputedStyle(source);
  const stroke = source.getAttribute("stroke") || style.stroke;
  if (!stroke || stroke === "none") return;
  target.setAttribute("stroke", stroke);
  target.setAttribute("stroke-width", source.getAttribute("stroke-width") || style.strokeWidth || "0.5");
  target.setAttribute("vector-effect", "non-scaling-stroke");
}

declare global {
  interface Window {
    updateMinimap: () => void;
  }
}
window.updateMinimap = updateMinimap;

export const Minimap = { open };
