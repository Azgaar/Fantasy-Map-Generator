import { registerLayer } from "./layer_registry";

registerLayer({
  id: "coastline.sea_island",
  rootId: "coastline",
  groupId: "sea_island",
  enabled: () => true,
  update: (group, { scale }) => {
    if (!Number(group.getAttribute("auto-filter"))) return;

    const filter = scale > 1.5 && scale <= 2.6 ? null : scale > 2.6 ? "url(#blurFilter)" : "url(#dropShadow)";
    if (filter) group.setAttribute("filter", filter);
    else group.removeAttribute("filter");
  }
});
