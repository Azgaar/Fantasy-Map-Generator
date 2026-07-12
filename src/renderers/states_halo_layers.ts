import { rn } from "../utils";
import { registerLayer } from "./layer_registry";

registerLayer({
  id: "states.halo",
  rootId: "regions",
  groupId: "statesHalo",
  enabled: () => !customization && shapeRendering.value !== "optimizeSpeed",
  update: (group, { scale }) => {
    const desired = Number(group.dataset.width);
    const haloSize = rn(desired / scale ** 0.8, 2);
    group.setAttribute("stroke-width", String(haloSize));
    group.style.display = haloSize > 0.1 ? "block" : "none";
  }
});
