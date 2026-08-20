import { useEffect, useRef } from "react";
import {
  createPixiRendererOverview,
  PIXI_RENDERER_SCENE_CHANGE_EVENT
} from "@/renderers/pixi/pixi-renderer-controller";
import "./map-minimap.css";

const MAX_OVERVIEW_WIDTH = 320;
const MAX_OVERVIEW_HEIGHT = 200;

export interface MinimapViewport {
  height: number;
  width: number;
  x: number;
  y: number;
}

export function getMinimapViewport(): MinimapViewport {
  const inverseScale = scale ? 1 / scale : 1;
  const x = Math.max(0, -viewX * inverseScale);
  const y = Math.max(0, -viewY * inverseScale);
  const right = Math.min(graphWidth, x + svgWidth * inverseScale);
  const bottom = Math.min(graphHeight, y + svgHeight * inverseScale);
  return { height: Math.max(0, bottom - y), width: Math.max(0, right - x), x, y };
}

export function getClampedMinimapCenter(x: number, y: number, zoomScale = scale): [number, number] {
  const viewportWidth = svgWidth / zoomScale;
  const viewportHeight = svgHeight / zoomScale;
  const clampedX = clampCenter(x, viewportWidth, graphWidth);
  const clampedY = clampCenter(y, viewportHeight, graphHeight);
  return [clampedX, clampedY];
}

function clampCenter(value: number, viewportSize: number, worldSize: number): number {
  if (viewportSize >= worldSize) return worldSize / 2;
  const halfViewport = viewportSize / 2;
  return Math.min(worldSize - halfViewport, Math.max(halfViewport, value));
}

export function MapMinimap(): React.JSX.Element {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    const updateViewport = () => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const bounds = getMinimapViewport();
      viewport.setAttribute("x", String(bounds.x));
      viewport.setAttribute("y", String(bounds.y));
      viewport.setAttribute("width", String(bounds.width));
      viewport.setAttribute("height", String(bounds.height));
    };

    const updateOverview = () => {
      const button = buttonRef.current;
      const canvas = canvasRef.current;
      const overview = createPixiRendererOverview(MAX_OVERVIEW_WIDTH, MAX_OVERVIEW_HEIGHT);
      if (!button || !canvas || !overview) return;

      canvas.width = overview.width;
      canvas.height = overview.height;
      button.style.aspectRatio = `${overview.width} / ${overview.height}`;
      canvas.getContext("2d")?.drawImage(overview.source, 0, 0, overview.width, overview.height);
      updateViewport();
    };

    const updateScaleBarPosition = () => fitScaleBar(scaleBar, svgWidth, svgHeight);
    const resizeObserver = new ResizeObserver(updateScaleBarPosition);
    if (buttonRef.current) resizeObserver.observe(buttonRef.current);

    window.updateMinimap = updateViewport;
    window.addEventListener(PIXI_RENDERER_SCENE_CHANGE_EVENT, updateOverview);
    window.addEventListener("resize", updateScaleBarPosition);
    updateOverview();
    updateViewport();
    updateScaleBarPosition();

    return () => {
      if (window.updateMinimap === updateViewport) delete window.updateMinimap;
      resizeObserver.disconnect();
      window.removeEventListener(PIXI_RENDERER_SCENE_CHANGE_EVENT, updateOverview);
      window.removeEventListener("resize", updateScaleBarPosition);
    };
  }, []);

  const recenterMap = (event: React.MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * graphWidth;
    const y = ((event.clientY - bounds.top) / bounds.height) * graphHeight;
    zoomTo(...getClampedMinimapCenter(x, y), scale, 450);
  };

  return (
    <button
      aria-label="Minimap. Click to center the map"
      className="fmg-map-minimap"
      data-tip="Click to center the map"
      onClick={recenterMap}
      ref={buttonRef}
      type="button"
    >
      <canvas aria-hidden="true" ref={canvasRef} />
      <svg aria-hidden="true" preserveAspectRatio="none" viewBox={`0 0 ${graphWidth} ${graphHeight}`}>
        <rect className="fmg-map-minimap__viewport" ref={viewportRef} />
      </svg>
    </button>
  );
}

declare global {
  interface Window {
    updateMinimap?: () => void;
  }
}
