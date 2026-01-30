"use strict";

function editRouteGroups() {
  if (customization) return;
  if (!layerIsOn("toggleRoutes")) toggleRoutes();

  addLines();

  $("#routeGroupsEditor").dialog({
    title: "Edit Route groups",
    resizable: false,
    position: {my: "left top", at: "left+10 top+140", of: "#map"}
  });

  if (modules.editRouteGroups) return;
  modules.editRouteGroups = true;

  // add listeners
  byId("routeGroupsEditorAdd").addEventListener("click", addGroup);
  byId("routeGroupsEditorBody").on("click", ev => {
    const group = ev.target.closest(".states")?.dataset.id;
    if (ev.target.classList.contains("editStyle")) editStyle("routes", group);
    else if (ev.target.classList.contains("removeGroup")) removeGroup(group);
  });

  function addLines() {
    byId("routeGroupsEditorBody").innerHTML = "";

    const lines = Array.from(routes.selectAll("g")._groups[0]).map(el => {
      const count = el.children.length;
      return /* html */ `<div data-id="${el.id}" class="states" style="display: flex; justify-content: space-between;">
          <span>${el.id} (${count})</span>
          <div style="width: auto; display: flex; gap: 0.4em;">
            <span data-tip="Edit style" class="editStyle icon-brush pointer" style="font-size: smaller;"></span>
            <span data-tip="Remove group" class="removeGroup icon-trash pointer"></span>
          </div>
        </div>`;
    });

    byId("routeGroupsEditorBody").innerHTML = lines.join("");
  }

  const DEFAULT_GROUPS = ["roads", "trails", "searoutes"];

  function addGroup() {
    prompt("Type group name", {default: "route-group-new"}, v => {
      let group = v
        .toLowerCase()
        .replace(/ /g, "_")
        .replace(/[^\w\s]/gi, "");

      if (!group) return tip("Invalid group name", false, "error");
      if (!group.startsWith("route-")) group = "route-" + group;
      if (byId(group)) return tip("Element with this name already exists. Provide a unique name", false, "error");
      if (Number.isFinite(+group.charAt(0))) return tip("Group name should start with a letter", false, "error");

      routes
        .append("g")
        .attr("id", group)
        .attr("stroke", "#000000")
        .attr("stroke-width", 0.5)
        .attr("stroke-dasharray", "1 0.5")
        .attr("stroke-linecap", "butt");
      byId("routeGroup")?.options.add(new Option(group, group));
      addLines();

      byId("routeCreatorGroupSelect").options.add(new Option(group, group));
    });
  }

  function removeGroup(group) {
    confirmationDialog({
      title: "Remove route group",
      message:
        "Are you sure you want to remove the entire route group? All routes in this group will be removed.<br>This action can't be reverted",
      confirm: "Remove",
      onConfirm: () => {
        pack.routes.filter(r => r.group === group).forEach(Routes.remove);
        if (!DEFAULT_GROUPS.includes(group)) routes.select(`#${group}`).remove();
        addLines();
      }
    });
  }
}
