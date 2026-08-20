import { select } from "d3";
import { invalidatePixiRendererLayer, pixiRendererOwnsLayer } from "@/renderers/pixi/pixi-renderer-controller";
import { buildBorderPaths } from "@/renderers/scene/layers/border-paths";

export { buildBorderPaths } from "@/renderers/scene/layers/border-paths";

declare global {
  var drawBorders: () => void;
}

const bordersRenderer = () => {
  TIME && console.time("drawBorders");
  if (pixiRendererOwnsLayer("borders")) {
    select("#map").select("#borders").selectAll("path").remove();
    invalidatePixiRendererLayer("borders");
    TIME && console.timeEnd("drawBorders");
    return;
  }

  const paths = buildBorderPaths(pack);
  select("#map").select("#borders").attr("fill", "none").selectAll("path").remove();
  select("#map").select("#stateBorders").append("path").attr("d", paths.state);
  select("#map").select("#provinceBorders").append("path").attr("d", paths.province);
  TIME && console.timeEnd("drawBorders");
};

window.drawBorders = bordersRenderer;

export { bordersRenderer as drawBorders };
