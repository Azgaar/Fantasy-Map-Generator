"use strict";

function editBurgGroups() {
  if (customization) return;
  addLines();

  $("#burgGroupsEditor").dialog({
    title: "Configure Burg groups",
    resizable: false,
    position: {my: "center", at: "center", of: "svg"},
    buttons: {
      Apply: () => byId("burgGroupsForm").requestSubmit(),
      Cancel: function () {
        $(this).dialog("close");
      }
    }
  });

  if (modules.editBurgGroups) return;
  modules.editBurgGroups = true;

  // add listeners
  byId("burgGroupsForm").on("submit", submitForm);
  byId("burgGroupsForm").on("change", validateForm);
  byId("burgGroupsEditorAdd").on("click", addGroup);
  byId("burgGroupsEditStyle").on("click", () => editStyle("burgIcons"));
  byId("burgGroupsBody").on("click", ev => {
    const group = ev.target.closest(".states")?.dataset.id;
    if (ev.target.classList.contains("editStyle")) editStyle("burgs", group);
    else if (ev.target.classList.contains("removeGroup")) removeGroup(group);
  });

  function addLines() {
    byId("burgGroupsBody").innerHTML = "";

    const lines = options.burgs.groups.map(group => {
      const count = pack.burgs.filter(burg => !burg.removed && burg.group === group.name).length;
      // prettier-ignore
      return /* html */ `<tr name="${group.name}">
        <td data-tip="Select group to be assigned if other groups are not passed"><input type="radio" name="isDefault" ${group.isDefault && "checked"}></td>
        <td data-tip="Type group name. It can contain only text, digits and underscore"><input type="text" name="name" value="${group.name}" required pattern="\\w+" /></td>
        <td data-tip="Set min population constraint"><input type="number" name="min" min="0" step="any" value="${group.min || ''}" /></td>
        <td data-tip="Set max population constraint"><input type="number" name="max" min="0" step="any" value="${group.max || ''}" /></td>
        <td data-tip="Set population percentile"><input type="number" name="percentile" min="0" max="100" step="any" value="${group.percentile || ''}" /></td>
        <td data-tip="Select allowed biomes"><button name="biomes">${group.biomes ? "some" : "all"}</button></td>
        <td data-tip="Select allowed states"><button name="states">${group.states ? "some" : "all"}</button></td>
        <td data-tip="Select allowed cultures"><button name="cultures">${group.cultures ? "some" : "all"}</button></td>
        <td data-tip="Select allowed religions"><button name="religions">${group.religions ? "some" : "all"}</button></td>
        <td data-tip="Select allowed features" ><button name="features">${group.features ? "some" : "all"}</button></td>
        <td data-tip="Number of burgs in group">${count}</td>
        <td data-tip="Activate/deactivate group"><input type="checkbox" name="active" class="native" ${group.active && "checked"} /></td>
      </tr>`;
    });

    byId("burgGroupsBody").innerHTML = lines.join("");
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

  function validateForm(event) {
    const form = event.target.form;

    const names = Array.from(form.name).map(input => input.value);
    form.name.forEach(nameInput => {
      const value = nameInput.value;
      const isUnique = names.filter(n => n === value).length === 1;
      nameInput.setCustomValidity(isUnique ? "" : "Group name should be unique");
      nameInput.reportValidity();
    });

    const active = Array.from(form.active).map(input => input.checked);
    form.active[0].setCustomValidity(active.includes(true) ? "" : "At least one group should be active");
    form.active[0].reportValidity();
  }

  function submitForm(event) {
    event.preventDefault();

    function parseInput(input) {
      if (input.name === "name") return sanitizeId(input.value);
      if (input.type === "radio") return input.checked;
      if (input.type === "checkbox") return input.checked;
      if (input.type === "number") {
        const value = input.valueAsNumber;
        if (value === 0 || isNaN(value)) return null;
        return value;
      }
      return input.value;
    }

    const lines = Array.from(byId("burgGroupsBody").children);
    options.burgs.groups = lines.map(line => {
      const inputs = line.querySelectorAll("input");
      const group = Array.from(inputs).reduce((obj, input) => {
        const value = parseInput(input);
        if (value !== null) obj[input.name] = value;
        return obj;
      }, {});
      return group;
    });

    $("#burgGroupsEditor").dialog("close");
  }
}
