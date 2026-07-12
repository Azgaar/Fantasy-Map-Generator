import { rn } from "../utils";
import { registerLayer } from "./layer_registry";

type ZoomMarker = (typeof pack.markers)[number] & { size?: number; hidden?: boolean };

registerLayer({
  id: "markers.default",
  rootId: "viewbox",
  groupId: "markers",
  enabled: () => layerIsOn("toggleMarkers") && Boolean(Number(markers.attr("rescale"))),
  update: (group, { scale }) => {
    for (const marker of (pack.markers || []) as ZoomMarker[]) {
      const { i, x, y, size = 30, hidden } = marker;
      const element = !hidden ? group.querySelector<SVGSVGElement>(`#marker${i}`) : null;
      if (!element) continue;

      const zoomedSize = Math.max(rn(size / 5 + 24 / scale, 2), 1);
      element.setAttribute("width", String(zoomedSize));
      element.setAttribute("height", String(zoomedSize));
      element.setAttribute("x", String(rn(x - zoomedSize / 2, 1)));
      element.setAttribute("y", String(rn(y - zoomedSize, 1)));
    }
  }
});
