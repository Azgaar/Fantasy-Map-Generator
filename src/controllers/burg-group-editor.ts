import { ensureEl } from "../utils";

const GROUP_NAME_REGEXP = /^[\p{L}_][\p{L}\p{N}_-]*$/u;

let isInitialized = false;

function editBurgGroups(): void {
  if (customization) return;
  addLines();

  $("#burgGroupsEditor").dialog({
    title: "Configure Burg groups",
    resizable: false,
    position: { my: "center", at: "center", of: "svg" },
    buttons: {
      Apply: () => {
        ensureEl<HTMLFormElement>("burgGroupsForm").requestSubmit();
      },
      Add: () => {
        ensureEl("burgGroupsBody").insertAdjacentHTML("beforeend", createLine({ name: "", active: true }));
      },
      Restore: () => {
        options.burgs.groups = Burgs.getDefaultGroups() as typeof options.burgs.groups;
        addLines();
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });

  if (isInitialized) return;
  isInitialized = true;

  // add listeners
  ensureEl("burgGroupsForm")
    .on("change", validateForm)
    .on("submit", submitForm as EventListener);
  ensureEl("burgGroupsBody").on("click", (ev: Event) => {
    const el = ev.target as HTMLElement;
    const line = el.closest("tr");
    if (!line) return;

    if (el.getAttribute("name") === "biomes") {
      const biomes = Array(biomesData.i.length)
        .fill(null)
        .map((_, i) => ({ i, name: biomesData.name[i], color: biomesData.color[i] }));
      return selectLimitation(el, biomes);
    }
    if (el.getAttribute("name") === "states") return selectLimitation(el, pack.states);
    if (el.getAttribute("name") === "cultures") return selectLimitation(el, pack.cultures);
    if (el.getAttribute("name") === "religions") return selectLimitation(el, pack.religions);
    if (el.getAttribute("name") === "features") return selectFeaturesLimitation(el);
    if (el.getAttribute("name") === "up") {
      const prev = line.previousElementSibling;
      if (prev) line.parentNode!.insertBefore(line, prev);
      return;
    }
    if (el.getAttribute("name") === "down") {
      const next = line.nextElementSibling;
      if (next) line.parentNode!.insertBefore(next, line);
      return;
    }
    if (el.getAttribute("name") === "remove") return removeLine(line);
  });
}

function addLines(): void {
  const lines = options.burgs.groups.map(createLine);
  ensureEl("burgGroupsBody").innerHTML = lines.join("");
}

function createLine(group: any): string {
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
  const lines = filtered.map(
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
          ${lines.join("")}
        </tbody>
      </table>`;

  $("#alert").dialog({
    width: fitContent(),
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

  const lines = features.map(
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
            ${lines.join("")}
          </tbody>
        </table>
      </form>`;

  $("#alert").dialog({
    width: fitContent(),
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

function removeLine(line: HTMLElement): void {
  const lines = ensureEl("burgGroupsBody").children;
  if (lines.length < 2) {
    tip("At least one group should be defined", false, "error");
    return;
  }

  confirmationDialog({
    title: "Remove group",
    message:
      "Are you sure you want to remove the group? <br>This WON'T change the burgs unless the changes are applied",
    confirm: "Remove",
    onConfirm: () => {
      line.remove();
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

function submitForm(event: Event): void {
  event.preventDefault();
  if (!validateForm()) return;

  const lines = Array.from(ensureEl("burgGroupsBody").children);
  if (!lines.length) {
    tip("At least one group should be defined", false, "error");
    return;
  }

  function parseInput(input: HTMLInputElement | HTMLSelectElement): unknown {
    if (input.name === "name") return input.value;
    if (input.name === "features") {
      const isValid = JSON.isValid(input.value);
      const parsed = isValid ? JSON.parse(input.value) : {};
      if (Object.keys(parsed).length) return parsed;
      return null;
    }
    if ((input as HTMLInputElement).type === "hidden") return input.value || null;
    if ((input as HTMLInputElement).type === "radio") return (input as HTMLInputElement).checked;
    if ((input as HTMLInputElement).type === "checkbox") return (input as HTMLInputElement).checked;
    if ((input as HTMLInputElement).type === "number") {
      const value = (input as HTMLInputElement).valueAsNumber;
      if (value === 0 || Number.isNaN(value)) return null;
      return value;
    }
    return input.value || null;
  }

  options.burgs.groups = lines.map(line => {
    const inputs = line.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select");
    const group = Array.from(inputs).reduce<Record<string, unknown>>((obj, input) => {
      const value = parseInput(input);
      if (value !== null) obj[input.name] = value;
      return obj;
    }, {});
    return group;
  }) as typeof options.burgs.groups;
  localStorage.setItem("burg-groups", JSON.stringify(options.burgs.groups));

  // put burgs to new groups
  const validBurgs = pack.burgs.filter(b => b.i && !b.removed);
  const populations = validBurgs.map(b => b.population!).sort((a, b) => a - b);
  validBurgs.forEach(burg => void Burgs.defineGroup(burg, populations));

  if (layerIsOn("toggleBurgIcons")) drawBurgIcons();
  if (layerIsOn("toggleLabels")) drawBurgLabels();
  const refresh = ensureEl<HTMLButtonElement>("burgsOverviewRefresh");
  if (refresh.offsetParent) refresh.click();

  $("#burgGroupsEditor").dialog("close");
}

export const BurgGroupEditor = { open: editBurgGroups };
