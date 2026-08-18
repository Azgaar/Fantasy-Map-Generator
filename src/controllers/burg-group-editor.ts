import { closeDialogs, confirmationDialog, destroyDialog, refreshEditors } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import type { BurgGroup } from "@/types/burg-groups";
import { ensureEl } from "../utils";

const GROUP_NAME_REGEXP = /^[\p{L}_][\p{L}\p{N}_-]*$/u;

function editBurgGroups(): void {
  if (customization) return;
  closeDialogs(".stable");
  renderDialog();
  addRows();

  $("#burgGroupsEditor").dialog({
    title: "Configure Burg groups",
    resizable: false,
    position: { my: "center", at: "center", of: "svg" },
    close: closeBurgGroupsEditor,
    buttons: {
      Apply: () => {
        ensureEl<HTMLFormElement>("burgGroupsForm").requestSubmit();
      },
      Add: () => {
        const maxOrder = Math.max(0, ...options.burgs.groups.map(({ order }) => order));
        const group: BurgGroup = { name: "", order: maxOrder + 1, active: true };
        ensureEl("burgGroupsBody").insertAdjacentHTML("beforeend", createRow(group));
      },
      Restore: () => {
        // restore the form only, the changes are applied on Apply, so Cancel still discards them
        addRows(Burgs.getDefaultGroups());
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function renderDialog(): void {
  destroyDialog("burgGroupsEditor");

  const html = /* html */ `<div id="burgGroupsEditor" class="dialog stable">
    <form id="burgGroupsForm">
      <table class="table">
        <thead>
          <tr>
            <th data-tip="Rendering order: higher values are rendered on top">Order</th>
            <th data-tip="Type group name">Name</th>
            <th data-tip="Burg preview generator">Preview generator</th>
            <th data-tip="Set min and max population constraint in population points (see the multiplier in Units Editor)" colspan="3">Population</th>
            <th data-tip="Select allowed biomes">Biomes</th>
            <th data-tip="Select allowed states">States</th>
            <th data-tip="Select allowed cultures">Cultures</th>
            <th data-tip="Select allowed religions">Religions</th>
            <th data-tip="Select allowed features">Features</th>
            <th data-tip="Number of burgs in group">Count</th>
            <th data-tip="Activate/deactivate group">Active</th>
            <th data-tip="Select group to be assigned if burg doesn't pass the criteria for other groups">
              Default
            </th>
          </tr>
        </thead>
        <tbody id="burgGroupsBody"></tbody>
      </table>
    </form>
    <div style="padding: 0.5em 0; font-style: italic;">
      Burg population is calculated as <code style="font-size: smaller;">value * population_point * urbanization_rate</code>, see the <a style="text-decoration: underline;" id="burgGroupsUnitsEditorLink">Units Editor</a>.
      <br>Applying changes reclassifies Burgs, but label groups are not affected. Reconcile label groups in <a id="burgGroupsLabelGroupsLink" style="text-decoration: underline;">Label Group Configurator</a>.
    </div>
  </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  const form = ensureEl("burgGroupsForm");
  form.addEventListener("change", validateForm);
  form.addEventListener("submit", submitForm as EventListener);
  ensureEl("burgGroupsBody").addEventListener("click", (ev: Event) => {
    const el = ev.target as HTMLElement;
    const row = el.closest("tr");
    if (!row) return;

    if (el.getAttribute("name") === "biomes") {
      const biomes = pack.biomes.filter(biome => !biome.removed).map(({ i, name, color }) => ({ i, name, color }));
      return selectLimitation(el, biomes);
    }
    if (el.getAttribute("name") === "states") return selectLimitation(el, pack.states);
    if (el.getAttribute("name") === "cultures") return selectLimitation(el, pack.cultures);
    if (el.getAttribute("name") === "religions") return selectLimitation(el, pack.religions);
    if (el.getAttribute("name") === "features") return selectFeaturesLimitation(el);
    if (el.getAttribute("name") === "up") {
      const prev = row.previousElementSibling;
      if (prev) row.parentNode!.insertBefore(row, prev);
      return;
    }
    if (el.getAttribute("name") === "down") {
      const next = row.nextElementSibling;
      if (next) row.parentNode!.insertBefore(next, row);
      return;
    }
    if (el.getAttribute("name") === "remove") return removeRow(row);
  });
  ensureEl("burgGroupsUnitsEditorLink").addEventListener("click", () => Controllers.UnitsEditor.open());
  ensureEl("burgGroupsLabelGroupsLink").addEventListener("click", () => Controllers.LabelGroupsConfigurator.open());
}

function closeBurgGroupsEditor(): void {
  $("#burgGroupsEditor").dialog("destroy");
  ensureEl("burgGroupsEditor").remove();
}

function addRows(groups: BurgGroup[] = options.burgs.groups): void {
  const rows = groups.map(createRow);
  ensureEl("burgGroupsBody").innerHTML = rows.join("");
}

function createRow(group: BurgGroup): string {
  const count = pack.burgs.filter(burg => !burg.removed && burg.group === group.name).length;
  // prettier-ignore
  return /* html */ `<tr name="${group.name}">
      <td data-tip="Rendering order: higher values are rendered on top"><input type="number" name="order" min="1" max="999" step="1" required value="${group.order || ""}" /></td>
      <td data-tip="Type group name. Must start with a letter or underscore, followed by letters, digits, underscores, or dashes. Spaces are not allowed"><input type="text" name="name" value="${group.name}" required /></td>
      <td data-tip="Burg preview generator">
        <select name="preview">
          <option value="" ${!group.preview ? "selected" : ""}>no</option>
          <option value="watabou-city" ${group.preview === "watabou-city" ? "selected" : ""}>Watabou City</option>
          <option value="watabou-village" ${group.preview === "watabou-village" ? "selected" : ""}>Watabou Village</option>
          <option value="watabou-dwelling" ${group.preview === "watabou-dwelling" ? "selected" : ""}>Watabou Dwelling</option>
        </select>
      </td>
      <td data-tip="Set min population constraint in population points (see the multiplier in Units Editor)"><input type="number" name="min" min="0" step="any" value="${group.min || ""}" /></td>
      <td data-tip="Set max population constraint in population points (see the multiplier in Units Editor)"><input type="number" name="max" min="0" step="any" value="${group.max || ""}" /></td>
      <td data-tip="Set population percentile: 0-100, where 90 means the burg must have a population higher than 90% of all burgs"><input type="number" name="percentile" min="0" max="100" step="any" value="${group.percentile || ""}" /></td>
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

function selectLimitation(
  el: HTMLElement,
  data: { i: number; name: string; fullName?: string; color?: string; removed?: boolean }[]
): void {
  const value = (el.previousElementSibling as HTMLInputElement).value;
  const initial = value ? value.split(",").map(v => +v) : [];

  const filtered = data.filter(datum => datum.i && !datum.removed);
  const rows = filtered.map(
    ({ i, name, fullName, color }) => /* html */ `
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

  alertMessage.innerHTML = /* html */ `<b>Limit group by ${el.getAttribute("name")}:</b>
      <table style="margin-top:.3em">
        <tbody>
          ${rows.join("")}
        </tbody>
      </table>`;

  $("#alert").dialog({
    width: "fit-content",
    title: "Limit group",
    buttons: {
      Invert: () => {
        alertMessage.querySelectorAll<HTMLInputElement>("input").forEach(input => {
          input.checked = !input.checked;
        });
      },
      Apply: function (this: HTMLElement) {
        const inputs = Array.from(alertMessage.querySelectorAll<HTMLInputElement>("input"));
        const selected = inputs.reduce<string[]>((acc, input) => {
          if (input.checked) acc.push(input.dataset.i!);
          return acc;
        }, []);

        if (!selected.length) return tip("Select at least one element", false, "error");

        const allAreSelected = selected.length === inputs.length;
        (el.previousElementSibling as HTMLInputElement).value = allAreSelected ? "" : selected.join(",");
        el.innerHTML = allAreSelected ? "all" : "some";
        $(this).dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function selectFeaturesLimitation(el: HTMLElement): void {
  const value = (el.previousElementSibling as HTMLInputElement).value;
  const initial: Record<string, boolean> = value ? JSON.parse(value) : {};

  const features = [
    { name: "capital", icon: "icon-star" },
    { name: "port", icon: "icon-anchor" },
    { name: "citadel", icon: "icon-chess-rook" },
    { name: "walls", icon: "icon-fort-awesome" },
    { name: "plaza", icon: "icon-store" },
    { name: "temple", icon: "icon-chess-bishop" },
    { name: "shanty", icon: "icon-campground" }
  ];

  const rows = features.map(
    // prettier-ignore
    ({ name, icon }) => /* html */ `
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
            ${rows.join("")}
          </tbody>
        </table>
      </form>`;

  $("#alert").dialog({
    width: "fit-content",
    title: "Limit group by features",
    buttons: {
      Apply: function (this: HTMLElement) {
        const form = ensureEl<HTMLFormElement>("featuresLimitationForm");
        const values = features.reduce<Record<string, boolean>>((acc, { name }) => {
          const featureValue = (form[name] as RadioNodeList).value;
          if (featureValue !== "undefined") acc[name] = featureValue === "true";
          return acc;
        }, {});

        (el.previousElementSibling as HTMLInputElement).value = JSON.stringify(values);
        el.innerHTML = Object.keys(values).length ? "some" : "any";

        $(this).dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function removeRow(row: HTMLElement): void {
  const rows = ensureEl("burgGroupsBody").children;
  if (rows.length < 2) {
    tip("At least one group should be defined", false, "error");
    return;
  }

  confirmationDialog({
    title: "Remove group",
    message:
      "Are you sure you want to remove the group? <br>This WON'T change the burgs unless the changes are applied",
    confirm: "Remove",
    onConfirm: () => {
      row.remove();
      validateForm();
    }
  });
}

function validateForm(): boolean {
  const form = ensureEl<HTMLFormElement>("burgGroupsForm");

  const nameField = form.name as unknown as HTMLInputElement & RadioNodeList;
  if (nameField.length) {
    const names = Array.from(nameField).map(input => (input as HTMLInputElement).value);
    (nameField as unknown as NodeListOf<HTMLInputElement>).forEach(nameInput => {
      const value = nameInput.value;
      const isFormatValid = GROUP_NAME_REGEXP.test(value);
      const isUnique = names.filter(n => n === value).length === 1;
      const message = !isFormatValid
        ? "Group name must start with a letter or underscore and then contain only letters, digits, underscores, or dashes"
        : !isUnique
          ? "Group name should be unique"
          : "";
      nameInput.setCustomValidity(message);
    });
  } else {
    const value = nameField.value;
    const isFormatValid = GROUP_NAME_REGEXP.test(value);
    const message = isFormatValid
      ? ""
      : "Group name must start with a letter or underscore and then contain only letters, digits, underscores, or dashes";
    nameField.setCustomValidity(message);
  }

  const activeField = form.active as unknown as HTMLInputElement & RadioNodeList;
  if (activeField.length) {
    const active = Array.from(activeField).map(input => (input as HTMLInputElement).checked);
    (activeField[0] as HTMLInputElement).setCustomValidity(
      active.includes(true) ? "" : "At least one group should be active"
    );
  } else {
    activeField.setCustomValidity(activeField.checked ? "" : "At least one group should be active");
  }

  const isDefaultField = form.isDefault as unknown as HTMLInputElement & RadioNodeList;
  if (isDefaultField.length) {
    const checked = Array.from(isDefaultField).map(input => (input as HTMLInputElement).checked);
    (isDefaultField[0] as HTMLInputElement).setCustomValidity(
      checked.includes(true) ? "" : "At least one group should be default"
    );
  } else {
    isDefaultField.setCustomValidity(isDefaultField.checked ? "" : "At least one group should be default");
  }

  const isValid = form.checkValidity();
  if (!isValid) form.reportValidity();
  return isValid;
}

function rowToGroup(row: Element): BurgGroup {
  const input = (name: string) => row.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;

  // empty and zero numeric constraints mean "no constraint"
  const getConstraint = (name: string) => {
    const value = input(name).valueAsNumber;
    return Number.isNaN(value) || value === 0 ? undefined : value;
  };

  // limitation inputs keep the allowed ids as a comma-separated list, empty value means "all allowed"
  const getLimitation = (name: string) => {
    const value = input(name).value;
    return value ? value.split(",").map(Number) : undefined;
  };

  return {
    name: input("name").value,
    order: input("order").valueAsNumber,
    active: input("active").checked,
    isDefault: input("isDefault").checked,
    preview: row.querySelector<HTMLSelectElement>('select[name="preview"]')!.value || undefined,
    min: getConstraint("min"),
    max: getConstraint("max"),
    percentile: getConstraint("percentile"),
    features: getFeatures(input("features").value),
    biomes: getLimitation("biomes"),
    states: getLimitation("states"),
    cultures: getLimitation("cultures"),
    religions: getLimitation("religions")
  };
}

function getFeatures(value: string): Record<string, boolean> | undefined {
  if (!JSON.isValid(value)) return undefined;
  const features: Record<string, boolean> = JSON.parse(value);
  return Object.keys(features).length ? features : undefined;
}

function submitForm(event: Event): void {
  event.preventDefault();
  if (!validateForm()) return;

  const rows = Array.from(ensureEl("burgGroupsBody").children);
  if (!rows.length) {
    tip("At least one group should be defined", false, "error");
    return;
  }

  options.burgs.groups = rows.map(rowToGroup);
  localStorage.setItem("burg-groups", JSON.stringify(options.burgs.groups));

  // put burgs to new groups
  const validBurgs = pack.burgs.filter(b => b.i && !b.removed);
  const populations = validBurgs.map(b => b.population!).sort((a, b) => a - b);
  validBurgs.forEach(burg => void Burgs.defineGroup(burg, populations));

  Layers.draw("burgIcons");
  Layers.draw("labels");
  refreshEditors();

  $("#burgGroupsEditor").dialog("close");
}

export const BurgGroupEditor = { open: editBurgGroups };
