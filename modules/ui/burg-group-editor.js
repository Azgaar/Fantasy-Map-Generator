"use strict";

function editBurgGroups() {
  if (customization) return;
  addLines();

  $("#burgGroupsEditor").dialog({
    title: "Configure Burg groups",
    resizable: false,
    position: {my: "center", at: "center", of: "svg"},
    buttons: {
      Apply: () => {
        byId("burgGroupsForm").requestSubmit();
      },
      Add: () => {
        byId("burgGroupsBody").innerHTML += createLine({name: "", active: true, preview: null});
      },
      Restore: () => {
        options.burgs.groups = Burgs.getDefaultGroups();
        addLines();
      },
      Cancel: function () {
        $(this).dialog("close");
      }
    }
  });

  if (modules.editBurgGroups) return;
  modules.editBurgGroups = true;

  // add listeners
  byId("burgGroupsForm").on("change", validateForm).on("submit", submitForm);
  byId("burgGroupsBody").on("click", ev => {
    const line = ev.target.closest("tr");
    if (line && ev.target.classList.contains("removeGroup")) {
      const lines = byId("burgGroupsBody").children;
      if (lines.length < 2) return tip("At least one group should be defined", false, "error");

      confirmationDialog({
        title: this.dataset.tip,
        message:
          "Are you sure you want to remove the group? <br>This WON'T change the burgs unless the changes are applied",
        confirm: "Remove",
        onConfirm: () => {
          line.remove();
          validateForm();
        }
      });
    }
  });

  function addLines() {
    const lines = options.burgs.groups.map(createLine);
    byId("burgGroupsBody").innerHTML = lines.join("");
  }

  function createLine(group) {
    const count = pack.burgs.filter(burg => !burg.removed && burg.group === group.name).length;
    // prettier-ignore
    return /* html */ `<tr name="${group.name}">
      <td data-tip="Type group name. It can contain only text, digits and underscore"><input type="text" name="name" value="${group.name}" required pattern="\\w+" /></td>
      <td data-tip="Set min population constraint"><input type="number" name="min" min="0" step="any" value="${group.min || ''}" /></td>
      <td data-tip="Set max population constraint"><input type="number" name="max" min="0" step="any" value="${group.max || ''}" /></td>
      <td data-tip="Set population percentile"><input type="number" name="percentile" min="0" max="100" step="any" value="${group.percentile || ''}" /></td>
      <td data-tip="Select allowed biomes"><button type="button" name="biomes">${group.biomes ? "some" : "all"}</button></td>
      <td data-tip="Select allowed states"><button type="button" name="states">${group.states ? "some" : "all"}</button></td>
      <td data-tip="Select allowed cultures"><button type="button" name="cultures">${group.cultures ? "some" : "all"}</button></td>
      <td data-tip="Select allowed religions"><button type="button" name="religions">${group.religions ? "some" : "all"}</button></td>
      <td data-tip="Select allowed features" ><button type="button" name="features">${group.features ? "some" : "all"}</button></td>
      <td data-tip="Number of burgs in group">${count}</td>
      <td data-tip="Activate/deactivate group"><input type="checkbox" name="active" class="native" ${group.active && "checked"} /></td>
      <td data-tip="Select group to be assigned if other groups are not passed"><input type="radio" name="isDefault" ${group.isDefault && "checked"}></td>
      <td data-tip="Remove group"><button type="button" class="icon-trash-empty removeGroup"></button></td>
    </tr>`;
  }

  function validateForm() {
    const form = byId("burgGroupsForm");

    if (form.name.length) {
      const names = Array.from(form.name).map(input => input.value);
      form.name.forEach(nameInput => {
        const value = nameInput.value;
        const isUnique = names.filter(n => n === value).length === 1;
        nameInput.setCustomValidity(isUnique ? "" : "Group name should be unique");
        nameInput.reportValidity();
      });
    }

    if (form.active.length) {
      const active = Array.from(form.active).map(input => input.checked);
      form.active[0].setCustomValidity(active.includes(true) ? "" : "At least one group should be active");
      form.active[0].reportValidity();
    } else {
      const active = form.active.checked;
      form.active.setCustomValidity(active ? "" : "At least one group should be active");
      form.active.reportValidity();
    }

    if (form.isDefault.length) {
      const checked = Array.from(form.isDefault).map(input => input.checked);
      form.isDefault[0].setCustomValidity(checked.includes(true) ? "" : "At least one group should be default");
      form.isDefault[0].reportValidity();
    } else {
      const checked = form.isDefault.checked;
      form.isDefault.setCustomValidity(checked ? "" : "At least one group should be default");
      form.isDefault.reportValidity();
    }
  }

  function submitForm(event) {
    event.preventDefault();

    const lines = Array.from(byId("burgGroupsBody").children);
    if (!lines.length) return tip("At least one group should be defined", false, "error");

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
