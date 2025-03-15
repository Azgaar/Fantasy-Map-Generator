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
    const el = ev.target;
    const line = el.closest("tr");
    if (!line) return;

    if (el.name === "biomes") {
      const biomes = Array(biomesData.i.length)
        .fill(null)
        .map((_, i) => ({i, name: biomesData.name[i], color: biomesData.color[i]}));
      return selectLimitation(el, biomes);
    }
    if (el.name === "states") return selectLimitation(el, pack.states);
    if (el.name === "cultures") return selectLimitation(el, pack.cultures);
    if (el.name === "religions") return selectLimitation(el, pack.religions);
    if (el.name === "features") return selectFeaturesLimitation(el);
    if (el.name === "up") return line.parentNode.insertBefore(line, line.previousElementSibling);
    if (el.name === "down") return line.parentNode.insertBefore(line.nextElementSibling, line);
    if (el.name === "remove") return removeLine(line);
  });

  function addLines() {
    const lines = options.burgs.groups.map(createLine);
    byId("burgGroupsBody").innerHTML = lines.join("");
  }

  function createLine(group) {
    const count = pack.burgs.filter(burg => !burg.removed && burg.group === group.name).length;
    // prettier-ignore
    return /* html */ `<tr name="${group.name}">
      <td data-tip="Rendering order: higher values are rendered on top"><input type="number" name="order" min="1" max="999" step="1" required value="${group.order || ''}" /></td>
      <td data-tip="Type group name. It can contain only text, digits and underscore"><input type="text" name="name" value="${group.name}" required pattern="\\w+" /></td>
      <td data-tip="Burg preview generator">
        <select name="preview">
          <option value="" ${!group.preview ? "selected" : ""}>no</option>
          <option value="watabou-city" ${group.preview === "watabou-city" ? "selected" : ""}>Watabou City</option>
          <option value="watabou-village" ${group.preview === "watabou-village" ? "selected" : ""}>Watabou Village</option>
          <option value="watabou-dwelling" ${group.preview === "watabou-dwellings" ? "selected" : ""}>Watabou Dwelling</option>
        </select>
      </td>
      <td data-tip="Set min population constraint"><input type="number" name="min" min="0" step="any" value="${group.min || ''}" /></td>
      <td data-tip="Set max population constraint"><input type="number" name="max" min="0" step="any" value="${group.max || ''}" /></td>
      <td data-tip="Set population percentile"><input type="number" name="percentile" min="0" max="100" step="any" value="${group.percentile || ''}" /></td>
      <td data-tip="Select allowed biomes">
        <input type="hidden" name="biomes" value="${group.biomes || ""}">
        <button type="button" name="biomes">${group.biomes ? "some" : "all"}</button>
      </td>
      <td data-tip="Select allowed states">
        <input type="hidden" name="states" value="${group.states || ""}">
        <button type="button" name="states">${group.states ? "some" : "all"}</button>
      </td>
      <td data-tip="Select allowed cultures">
        <input type="hidden" name="cultures" value="${group.cultures || ""}">
        <button type="button" name="cultures">${group.cultures ? "some" : "all"}</button>
      </td>
      <td data-tip="Select allowed religions">
        <input type="hidden" name="religions" value="${group.religions || ""}">
        <button type="button" name="religions">${group.religions ? "some" : "all"}</button>
      </td>
      <td data-tip="Select allowed features" >
        <input type="hidden" name="features" value='${JSON.stringify(group.features || {})}'>
        <button type="button" name="features">${Object.keys(group.features || {}).length ? "some" : "any"}</button>
      </td>
      <td data-tip="Number of burgs in group">${count}</td>
      <td data-tip="Activate/deactivate group"><input type="checkbox" name="active" class="native" ${group.active && "checked"} /></td>
      <td data-tip="Select group to be assigned if other groups are not passed"><input type="radio" name="isDefault" ${group.isDefault && "checked"}></td>
      <td data-tip="Assignment order: move group up"><button type="button" name="up" class="icon-up-big"></button></td>
      <td data-tip="Assignment order: move group down"><button type="button" name="down" class="icon-down-big"></button></td>
      <td data-tip="Remove group"><button type="button" name="remove" class="icon-trash"></button></td>
    </tr>`;
  }

  function selectLimitation(el, data) {
    const value = el.previousElementSibling.value;
    const initial = value ? value.split(",").map(v => +v) : [];

    const filtered = data.filter(datum => datum.i && !datum.removed);
    const lines = filtered.map(
      ({i, name, fullName, color}) => /* html */ `
        <tr data-tip="${name}">
          <td>
            <span style="color:${color}">⬤</span>
          </td>
          <td>
            <input data-i="${i}" id="el${i}" type="checkbox" class="checkbox" ${
        !initial.length || initial.includes(i) ? "checked" : ""
      } >
            <label for="el${i}" class="checkbox-label">${fullName || name}</label>
          </td>
        </tr>`
    );

    alertMessage.innerHTML = /* html */ `<b>Limit group by ${el.name}:</b>
      <table style="margin-top:.3em">
        <tbody>
          ${lines.join("")}
        </tbody>
      </table>`;

    $("#alert").dialog({
      width: fitContent(),
      title: "Limit group",
      buttons: {
        Invert: function () {
          alertMessage.querySelectorAll("input").forEach(el => (el.checked = !el.checked));
        },
        Apply: function () {
          const inputs = Array.from(alertMessage.querySelectorAll("input"));
          const selected = inputs.reduce((acc, input) => {
            if (input.checked) acc.push(input.dataset.i);
            return acc;
          }, []);

          if (!selected.length) return tip("Select at least one element", false, "error");

          const allAreSelected = selected.length === inputs.length;
          el.previousElementSibling.value = allAreSelected ? "" : selected.join(",");
          el.innerHTML = allAreSelected ? "all" : "some";
          $(this).dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function selectFeaturesLimitation(el) {
    const value = el.previousElementSibling.value;
    const initial = value ? JSON.parse(value) : {};

    const features = [
      {name: "capital", icon: "icon-star"},
      {name: "port", icon: "icon-anchor"},
      {name: "citadel", icon: "icon-chess-rook"},
      {name: "walls", icon: "icon-fort-awesome"},
      {name: "plaza", icon: "icon-store"},
      {name: "temple", icon: "icon-chess-bishop"},
      {name: "shanty", icon: "icon-campground"}
    ];

    const lines = features.map(
      // prettier-ignore
      ({name, icon}) => /* html */ `
        <tr data-tip="Select limitation for burg feature: ${name}">
          <td>
            <span class="${icon}"></span>
            <span style="margin-left:.2em">${name}</span>
          </td>
          <td>
            <input type="radio" name="${name}" value="true" ${initial[name] === true ? "checked" : ""} style="margin:0" >
          </td>
          <td>
            <input type="radio" name="${name}" value="false" ${initial[name] === false ? "checked" : ""} style="margin:0">
          </td>
          <td>
            <input type="radio" name="${name}" value="undefined" ${initial[name] === undefined ? "checked" : ""} style="margin:0">
          </td>
        </tr>`
    );

    alertMessage.innerHTML = /* html */ `
      <form id="featuresLimitationForm">
        <table>
          <thead style="font-weight:bold">
            <td style="width:6em">Features</td>
            <td style="width:3em">True</td>
            <td style="width:3em">False</td>
            <td style="width:3em">Any</td>
          </thead>
          <tbody>
            ${lines.join("")}
          </tbody>
        </table>
      </form>`;

    $("#alert").dialog({
      width: fitContent(),
      title: "Limit group by features",
      buttons: {
        Apply: function () {
          const form = byId("featuresLimitationForm");
          const values = features.reduce((acc, {name}) => {
            const value = form[name].value;
            if (value !== "undefined") acc[name] = value === "true";
            return acc;
          }, {});

          el.previousElementSibling.value = JSON.stringify(values);
          el.innerHTML = Object.keys(values).length ? "some" : "any";

          $(this).dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function removeLine(line) {
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
      if (input.name === "features") {
        const isValid = JSON.isValid(input.value);
        const parsed = isValid ? JSON.parse(input.value) : {};
        if (Object.keys(parsed).length) return parsed;
        return null;
      }
      if (input.type === "hidden") return input.value || null;
      if (input.type === "radio") return input.checked;
      if (input.type === "checkbox") return input.checked;
      if (input.type === "number") {
        const value = input.valueAsNumber;
        if (value === 0 || isNaN(value)) return null;
        return value;
      }
      return input.value || null;
    }

    options.burgs.groups = lines.map(line => {
      const inputs = line.querySelectorAll("input, select");
      const group = Array.from(inputs).reduce((obj, input) => {
        const value = parseInput(input);
        if (value !== null) obj[input.name] = value;
        return obj;
      }, {});
      return group;
    });
    localStorage.setItem("burg-groups", JSON.stringify(options.burgs.groups));

    // put burgs to new groups
    const validBurgs = pack.burgs.filter(b => b.i && !b.removed);
    const populations = validBurgs.map(b => b.population).sort((a, b) => a - b);
    validBurgs.forEach(burg => Burgs.defineGroup(burg, populations));

    if (layerIsOn("toggleBurgIcons")) drawBurgIcons();
    if (layerIsOn("toggleLabels")) drawBurgLabels();
    if (byId("burgsOverviewRefresh")?.offsetParent) burgsOverviewRefresh.click();

    $("#burgGroupsEditor").dialog("close");
  }
}
