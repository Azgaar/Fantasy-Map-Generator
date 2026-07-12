import { rn } from "../utils";
import { registerLayer } from "./layer_registry";

registerLayer({
  id: "ruler.default",
  rootId: "viewbox",
  groupId: "ruler",
  enabled: () => layerIsOn("toggleRulers"),
  update: (group, { scale }) => {
    const size = rn((10 / scale ** 0.3) * 2, 2);
    group.querySelectorAll("text").forEach(text => {
      text.setAttribute("font-size", String(size));
    });
  }
});
