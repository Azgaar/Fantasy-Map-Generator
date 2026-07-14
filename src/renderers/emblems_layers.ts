import { registerLayer } from "./layer_registry";

for (const groupId of ["burgEmblems", "provinceEmblems", "stateEmblems"]) {
  registerLayer({
    id: `emblems.${groupId}`,
    rootId: "emblems",
    groupId,
    enabled: () => layerIsOn("toggleEmblems"),
    update: (group, { scale }) => {
      const size = Number(group.getAttribute("font-size")) * scale;
      const hidden = hideEmblems.checked && (size < 25 || size > 300);
      group.classList.toggle("hidden", hidden);

      const firstEmblem = group.firstElementChild;
      if (!hidden && window.COArenderer && firstEmblem && !firstEmblem.getAttribute("href")) {
        renderGroupCOAs(group);
      }
    }
  });
}
