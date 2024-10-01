"use strict";

function editBurgGroups() {
  if (customization) return;
  if (!layerIsOn("toggleBurgs")) toggleBurgs();

  addLines();

  $("#burgGroupsEditor").dialog({
    title: "Edit Burg groups",
    resizable: false,
    position: {my: "left top", at: "left+10 top+140", of: "#map"}
  });

  if (modules.editBurgGroups) return;
  modules.editBurgGroups = true;

  // add listeners
  byId("burgGroupsEditorAdd").addEventListener("click", addGroup);
  byId("burgGroupsEditorBody").on("click", ev => {
    const group = ev.target.closest(".states")?.dataset.id;
    if (ev.target.classList.contains("editStyle")) editStyle("burgs", group);
    else if (ev.target.classList.contains("removeGroup")) removeGroup(group);
  });

  function addLines() {
    byId("burgGroupsEditorBody").innerHTML = "";

    const lines = Array.from(burgs.selectAll("g")._groups[0]).map(el => {
      const count = el.children.length;
      return /* html */ `<div data-id="${el.id}" class="states" style="display: flex; justify-content: space-between;">
          <span>${el.id} (${count})</span>
          <div style="width: auto; display: flex; gap: 0.4em;">
            <span data-tip="Edit style" class="editStyle icon-brush pointer" style="font-size: smaller;"></span>
            <span data-tip="Remove group" class="removeGroup icon-trash pointer"></span>
          </div>
        </div>`;
    });

    byId("burgGroupsEditorBody").innerHTML = lines.join("");
  }

  const DEFAULT_GROUPS = ["roads", "trails", "seaburgs"];

  function addGroup() {
    prompt("Type group name", {default: "burg-group-new"}, v => {
      let group = v
        .toLowerCase()
        .replace(/ /g, "_")
        .replace(/[^\w\s]/gi, "");

      if (!group) return tip("Invalid group name", false, "error");
      if (!group.startsWith("burg-")) group = "burg-" + group;
      if (byId(group)) return tip("Element with this name already exists. Provide a unique name", false, "error");
      if (Number.isFinite(+group.charAt(0))) return tip("Group name should start with a letter", false, "error");

      burgs
        .append("g")
        .attr("id", group)
        .attr("stroke", "#000000")
        .attr("stroke-width", 0.5)
        .attr("stroke-dasharray", "1 0.5")
        .attr("stroke-linecap", "butt");
      byId("burgGroup")?.options.add(new Option(group, group));
      addLines();

      byId("burgCreatorGroupSelect").options.add(new Option(group, group));
    });
  }

  function removeGroup(group) {
    confirmationDialog({
      title: "Remove burg group",
      message:
        "Are you sure you want to remove the entire burg group? All burgs in this group will be removed.<br>This action can't be reverted",
      confirm: "Remove",
      onConfirm: () => {
        pack.burgs.filter(r => r.group === group).forEach(Burgs.remove);
        if (!DEFAULT_GROUPS.includes(group)) burgs.select(`#${group}`).remove();
        addLines();
      }
    });
  }
}
