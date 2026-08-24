import { select } from "d3";
import { invalidatePixiRendererLayer } from "@/renderers/pixi/pixi-renderer-controller";

declare global {
  var drawBorders: () => void;
}

const bordersRenderer = () => {
  TIME && console.time("drawBorders");
  select("#map").select("#borders").selectAll("path").remove();
  invalidatePixiRendererLayer("borders");
  TIME && console.timeEnd("drawBorders");
};

window.drawBorders = bordersRenderer;

export { bordersRenderer as drawBorders };
