import { closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import {
  assignLabelGroup,
  countLabelAssignments,
  createLabelGroup,
  deleteLabelGroup,
  type LabelWorld,
  renameLabelGroup
} from "@/controllers/label-group-transactions";
import {
  getDefaultLabelGroupName,
  isProtectedLabelGroup,
  validateLabelGroupName,
  validateLabelZoom
} from "@/controllers/label-policy";
import { DEFAULT_LABEL_TYPES, type LabelType } from "@/generators/labels-generator";
import { renderLabelGroups } from "@/renderers/labels/label-groups";
import { drawLabels, drawLabelsByType, renderLabelsNow } from "@/renderers/labels/labels-renderer";
import { destroyDialogIfExists, ensureEl } from "@/utils";

const TYPES = DEFAULT_LABEL_TYPES;
const TYPE_LABELS: Record<LabelType, string> = {
  state: "States",
  province: "Provinces",
  burg: "Burgs",
  river: "Rivers",
  route: "Routes",
  added: "Added"
};

function open(): void {
  if (customization) return;
  closeDialogs("#labelsConfigurator, .stable");
  renderDialog();
  $("#labelsConfigurator").dialog({
    title: "Configure Labels",
    width: "fit-content",
    maxHeight: Math.max(window.innerHeight - 40, 300),
    position: { my: "center top+10", at: "center top", of: "svg", collision: "fit" },
    close: close
  });
}

function renderDialog(): void {
  destroyDialogIfExists("labelsConfigurator");
  const html = /* html */ `<div id="labelsConfigurator" class="dialog stable">
    <div style="display:flex; gap:1.2em; align-items:center; margin:.3em">
      <label><input id="labelsResizeOnZoom" class="checkbox" type="checkbox" ${
        options.labels.resizeOnZoom ? "checked" : ""
      }><span class="checkbox-label">Resize labels on zoom</span></label>
      <label><input id="labelsShowAll" class="checkbox" type="checkbox" ${
        options.labels.showAll ? "checked" : ""
      }><span class="checkbox-label">Show all labels</span></label>
      <button id="labelsAssign" class="icon-tags">Assign Labels</button>
    </div>
    <div class="header" style="display:grid; grid-template-columns:4.5em 11em 6em 7em 5em 5em 12em 4em 5em 7em; align-items:center">
      <div>Active</div><div>Group</div><div>Type</div><div>Name mode</div><div>Zoom min</div><div>Zoom max</div>
      <div>Layer dependency</div><div>Labels</div><div>Order</div><div>Actions</div>
    </div>
    <div id="labelsGroupsBody" class="table" style="max-height:60vh; overflow-y:auto"></div>
    <div style="display:flex; gap:.4em; align-items:center; margin-top:.5em">
      <select id="labelsNewType">${DEFAULT_LABEL_TYPES.map(type => `<option value="${type}">${type}</option>`).join("")}</select>
      <input id="labelsNewName" placeholder="new group name" style="width:11em">
      <button id="labelsCreateGroup" class="icon-plus">Create group</button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  renderRows();

  ensureEl("labelsResizeOnZoom").addEventListener("change", changeGlobalOption);
  ensureEl("labelsShowAll").addEventListener("change", changeGlobalOption);
  ensureEl("labelsAssign").addEventListener("click", openAssignmentDialog);
  ensureEl("labelsCreateGroup").addEventListener("click", createGroup);
  ensureEl("labelsGroupsBody").addEventListener("change", changeRow);
  ensureEl("labelsGroupsBody").addEventListener("click", clickRow);
}

function renderRows(): void {
  const dependencies = getLayerDependencies();
  ensureEl("labelsGroupsBody").innerHTML = options.labels.groups
    .map((group, index) => {
      const protectedGroup = isProtectedLabelGroup(group.name, options.burgs.groups);
      const dependencyMissing =
        Boolean(group.layerDependency) && !dependencies.some(dependency => dependency.id === group.layerDependency);
      const count = getResolvedCount(group.name);
      return /* html */ `<div data-group="${group.name}" style="display:grid; grid-template-columns:4.5em 11em 6em 7em 5em 5em 12em 4em 5em 7em; align-items:center; min-height:2em">
        <div><input name="active" class="checkbox" type="checkbox" ${group.active !== false ? "checked" : ""}></div>
        <div title="${protectedGroup ? "Protected group identity" : "Custom group"}">${protectedGroup ? "🔒 " : ""}${group.name}</div>
        <div>${TYPE_LABELS[group.type]}</div>
        <div><select name="mode">
          ${["auto", "short", "full"].map(mode => `<option value="${mode}" ${group.mode === mode ? "selected" : ""}>${mode}</option>`).join("")}
        </select></div>
        <div><input name="zoom-min" type="number" min=".01" max="200" step=".01" value="${group.zoom.min ?? ""}" style="width:4.3em"></div>
        <div><input name="zoom-max" type="number" min=".01" max="200" step=".01" value="${group.zoom.max ?? ""}" style="width:4.3em"></div>
        <div><select name="dependency" class="${dependencyMissing ? "invalid" : ""}" title="${dependencyMissing ? "Unknown dependency; labels fail closed" : ""}">
          <option value="">None</option>
          ${dependencies.map(dependency => `<option value="${dependency.id}" ${group.layerDependency === dependency.id ? "selected" : ""}>${dependency.name}</option>`).join("")}
          ${dependencyMissing ? `<option value="${group.layerDependency}" selected>Unknown: ${group.layerDependency}</option>` : ""}
        </select></div>
        <div>${count}</div>
        <div><button data-action="up" class="icon-up-open" ${index === 0 ? "disabled" : ""}></button><button data-action="down" class="icon-down-open" ${
          index === options.labels.groups.length - 1 ? "disabled" : ""
        }></button></div>
        <div><button data-action="style" class="icon-brush" data-tip="Edit visual style"></button><button data-action="rename" class="icon-pencil" ${
          protectedGroup ? "disabled" : ""
        }></button><button data-action="delete" class="icon-trash-empty" ${protectedGroup ? "disabled" : ""}></button></div>
      </div>`;
    })
    .join("");
}

function changeGlobalOption(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  if (input.id === "labelsResizeOnZoom") options.labels.resizeOnZoom = input.checked;
  else options.labels.showAll = input.checked;
  persistAndRender(false);
  const exportShowAll = document.querySelector<HTMLInputElement>("#showLabels");
  if (exportShowAll) exportShowAll.checked = options.labels.showAll;
}

function changeRow(event: Event): void {
  const input = event.target as HTMLInputElement | HTMLSelectElement;
  const row = input.closest<HTMLElement>("[data-group]");
  const group = options.labels.groups.find(group => group.name === row?.dataset.group);
  if (!group) return;

  if (input.getAttribute("name") === "active") group.active = (input as HTMLInputElement).checked;
  else if (input.getAttribute("name") === "mode") group.mode = input.value as typeof group.mode;
  else if (input.getAttribute("name") === "dependency") group.layerDependency = input.value || null;
  else {
    const minInput = row!.querySelector<HTMLInputElement>("[name='zoom-min']")!;
    const maxInput = row!.querySelector<HTMLInputElement>("[name='zoom-max']")!;
    const zoom = {
      min: minInput.value === "" ? null : minInput.valueAsNumber,
      max: maxInput.value === "" ? null : maxInput.valueAsNumber
    };
    const error = validateLabelZoom(zoom);
    minInput.setCustomValidity(error || "");
    maxInput.setCustomValidity(error || "");
    if (error) return void input.reportValidity();
    group.zoom = zoom;
  }
  persistAndRender(input.getAttribute("name") === "mode");
}

function clickRow(event: Event): void {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
  if (!button || button.disabled) return;
  const row = button.closest<HTMLElement>("[data-group]")!;
  const name = row.dataset.group!;
  const index = options.labels.groups.findIndex(group => group.name === name);

  if (button.dataset.action === "style") {
    editStyle("labels", name);
    return;
  }
  if (button.dataset.action === "up" || button.dataset.action === "down") {
    const nextIndex = button.dataset.action === "up" ? index - 1 : index + 1;
    [options.labels.groups[index], options.labels.groups[nextIndex]] = [
      options.labels.groups[nextIndex],
      options.labels.groups[index]
    ];
    persistAndRender(true);
    renderRows();
    return;
  }
  if (button.dataset.action === "rename") {
    renameGroup(name);
    return;
  }
  if (button.dataset.action === "delete") deleteGroup(name);
}

function createGroup(): void {
  const type = ensureEl<HTMLSelectElement>("labelsNewType").value as LabelType;
  const input = ensureEl<HTMLInputElement>("labelsNewName");
  const name = input.value.trim();
  const error = validateLabelGroupName(
    name,
    options.labels.groups.map(group => group.name)
  );
  input.setCustomValidity(error || "");
  if (error) return void input.reportValidity();

  try {
    createLabelGroup({
      labels: options.labels,
      styles: style.labels,
      burgGroups: options.burgs.groups,
      name,
      type
    });
    input.value = "";
    persistAndRender(true);
    renderRows();
  } catch (error) {
    tip((error as Error).message, false, "error");
  }
}

function renameGroup(oldName: string): void {
  const newName = window.prompt("New Label Group name", oldName)?.trim();
  if (!newName || newName === oldName) return;
  try {
    renameLabelGroup({
      labels: options.labels,
      styles: style.labels,
      world: getWorld(),
      burgGroups: options.burgs.groups,
      oldName,
      newName
    });
    void Controllers.LabelsEditor.renameLastSelectedGroup(oldName, newName);
    persistAndRender(true);
    renderRows();
  } catch (error) {
    tip((error as Error).message, false, "error");
  }
}

function deleteGroup(name: string): void {
  const counts = countLabelAssignments(getWorld(), name);
  confirmationDialog({
    title: "Delete Label Group",
    message: `Delete "${name}" and restore affected labels to their entity defaults?<br><br>States: ${counts.states}; Provinces: ${counts.provinces}; Burgs: ${counts.burgs}; Rivers: ${counts.rivers}; Routes: ${counts.routes}; Added: ${counts.added}.`,
    confirm: "Delete",
    onConfirm: () => {
      deleteLabelGroup({
        labels: options.labels,
        styles: style.labels,
        world: getWorld(),
        burgGroups: options.burgs.groups,
        name
      });
      persistAndRender(true);
      renderRows();
    }
  });
}

function openAssignmentDialog(): void {
  destroyDialogIfExists("labelsAssignment");
  const html = /* html */ `<div id="labelsAssignment" class="dialog">
    <div style="display:flex; gap:.5em; align-items:center">
      <select id="labelsAssignmentType">${TYPES.map(type => `<option value="${type}">${TYPE_LABELS[type]}</option>`).join("")}</select>
      <span>Target:</span><select id="labelsAssignmentTarget">${getGroupedOptions()}</select>
    </div>
    <div class="header" style="display:grid; grid-template-columns:3em 16em 12em"><div><input id="labelsAssignmentAll" class="checkbox" type="checkbox"></div><div>Label</div><div>Current group</div></div>
    <div id="labelsAssignmentBody" class="table" style="max-height:55vh; overflow-y:auto"></div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  renderAssignmentRows();
  ensureEl("labelsAssignmentType").addEventListener("change", renderAssignmentRows);
  ensureEl("labelsAssignmentAll").addEventListener("change", toggleAllAssignments);
  $("#labelsAssignment").dialog({
    title: "Assign Labels",
    width: "fit-content",
    buttons: {
      Apply: applyBulkAssignment,
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    },
    close: function (this: HTMLElement) {
      $(this).dialog("destroy");
      this.remove();
    }
  });
}

function renderAssignmentRows(): void {
  const type = ensureEl<HTMLSelectElement>("labelsAssignmentType").value as LabelType;
  const removeTemporaryProjection = projectRegionLabelsForAudit(type);
  let rows: ReturnType<typeof getAssignmentRows>;
  try {
    rows = getAssignmentRows(type);
  } finally {
    removeTemporaryProjection();
  }
  ensureEl("labelsAssignmentBody").innerHTML = rows
    .map(
      row => /* html */ `<label style="display:grid; grid-template-columns:3em 16em 12em; align-items:center">
        <span><input class="checkbox" type="checkbox" data-id="${row.id}"></span><span>${escapeHtml(row.text)}</span><span>${row.group}</span>
      </label>`
    )
    .join("");
  ensureEl<HTMLInputElement>("labelsAssignmentAll").checked = false;
}

function projectRegionLabelsForAudit(type: LabelType): () => void {
  if (layerIsOn("toggleLabels") || (type !== "state" && type !== "province")) return () => undefined;
  renderLabelGroups();
  drawLabelsByType(type);

  return () => {
    document.querySelector("#labels")?.replaceChildren();
    const prefix = type === "state" ? "stateLabel" : "provinceLabel";
    document.querySelectorAll(`#textPaths > path[id^="textPath_${prefix}"]`).forEach(path => {
      path.remove();
    });
  };
}

function toggleAllAssignments(event: Event): void {
  const checked = (event.currentTarget as HTMLInputElement).checked;
  document.querySelectorAll<HTMLInputElement>("#labelsAssignmentBody input[type='checkbox']").forEach(input => {
    input.checked = checked;
  });
}

function applyBulkAssignment(this: HTMLElement): void {
  const type = ensureEl<HTMLSelectElement>("labelsAssignmentType").value as LabelType;
  const target = ensureEl<HTMLSelectElement>("labelsAssignmentTarget").value;
  const selectedIds = Array.from(
    document.querySelectorAll<HTMLInputElement>("#labelsAssignmentBody input:checked"),
    input => +input.dataset.id!
  );
  if (!selectedIds.length) {
    tip("Select at least one label", false, "error");
    return;
  }
  const targetType = options.labels.groups.find(group => group.name === target)?.type;
  if (!targetType) {
    tip("Select a valid target group", false, "error");
    return;
  }

  const apply = () => {
    assignLabelGroup(getWorld(), type, selectedIds, target);
    localStorage.setItem("label-groups", JSON.stringify(options.labels));
    if (layerIsOn("toggleLabels")) drawLabelsByType(getLabelType(type));
    $(this).dialog("close");
    renderRows();
  };
  if (targetType === type) {
    apply();
    return;
  }
  confirmationDialog({
    title: "Assign cross-type Label Group",
    message: `Assign ${selectedIds.length} ${TYPE_LABELS[type]} labels to the ${TYPE_LABELS[targetType]} group "${target}"?`,
    confirm: "Assign",
    onConfirm: apply
  });
}

function getAssignmentRows(type: LabelType): { id: number; text: string; group: string }[] {
  if (type === "state") {
    return pack.states
      .filter(entity => entity.i && !entity.removed)
      .map(entity => ({
        id: entity.i,
        text: getRegionAssignmentText("state", entity),
        group: resolveGroup(type, entity.label?.group)
      }));
  }
  if (type === "province") {
    return pack.provinces
      .filter(entity => entity.i && !entity.removed)
      .map(entity => ({
        id: entity.i,
        text: getRegionAssignmentText("province", entity),
        group: resolveGroup(type, entity.label?.group)
      }));
  }
  if (type === "burg") {
    return pack.burgs
      .filter(entity => entity.i && !entity.removed)
      .map(entity => ({
        id: entity.i!,
        text: entity.label?.text || entity.name || "",
        group: resolveGroup(type, entity.label?.group || entity.group)
      }));
  }
  if (type === "river") {
    return pack.rivers
      .filter(entity => entity.name)
      .map(entity => ({
        id: entity.i,
        text: entity.label?.text ?? `${entity.name} ${entity.type}`,
        group: resolveGroup(type, entity.label?.group)
      }));
  }
  if (type === "route") {
    return pack.routes
      .filter(entity => entity.name)
      .map(entity => ({
        id: entity.i,
        text: entity.label?.text ?? entity.name!,
        group: resolveGroup(type, entity.label?.group)
      }));
  }
  return pack.labels.map(entity => ({ id: entity.i, text: entity.text, group: resolveGroup(type, entity.group) }));
}

function getRegionAssignmentText(
  type: "state" | "province",
  entity: { i: number; name?: string; fullName?: string; label?: { text?: string; group?: string } }
): string {
  const rendered = document.querySelector<SVGTextElement>(
    `#labels text[data-label-type="${type}"][data-id="${entity.i}"]`
  );
  if (rendered) {
    const lines = Array.from(rendered.querySelectorAll("tspan"), tspan => tspan.textContent || "");
    return lines.length ? lines.join("|") : rendered.textContent?.trim() || "";
  }
  if (entity.label?.text !== undefined) return entity.label.text;
  const group = options.labels.groups.find(group => group.name === resolveGroup(type, entity.label?.group));
  return group?.mode === "full" ? entity.fullName || entity.name || "" : entity.name || entity.fullName || "";
}

function getGroupedOptions(): string {
  return TYPES.map(type => {
    const optionsMarkup = options.labels.groups
      .filter(group => group.type === type)
      .map(group => `<option value="${group.name}">${group.name}</option>`)
      .join("");
    return `<optgroup label="${TYPE_LABELS[type]}">${optionsMarkup}</optgroup>`;
  }).join("");
}

function getResolvedCount(name: string): number {
  return TYPES.reduce((total, type) => total + getAssignmentRows(type).filter(row => row.group === name).length, 0);
}

function resolveGroup(type: LabelType, requested?: string): string {
  const fallback = getDefaultLabelGroupName(type, options.burgs.groups);
  const name = requested || fallback;
  return options.labels.groups.some(group => group.name === name) ? name : fallback;
}

function getLabelType(type: LabelType): LabelType {
  return type;
}

function getLayerDependencies(): { id: string; name: string }[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[id^='toggle']"))
    .filter(element => /^toggle[A-Z]/.test(element.id))
    .map(element => ({ id: element.id, name: element.textContent?.trim() || element.id.replace(/^toggle/, "") }))
    .filter((dependency, index, all) => all.findIndex(candidate => candidate.id === dependency.id) === index)
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

function getWorld(): LabelWorld {
  return {
    states: pack.states,
    provinces: pack.provinces,
    burgs: pack.burgs,
    rivers: pack.rivers,
    routes: pack.routes,
    labels: pack.labels
  };
}

function persistAndRender(redraw: boolean): void {
  localStorage.setItem("label-groups", JSON.stringify(options.labels));
  if (redraw && layerIsOn("toggleLabels")) drawLabels();
  else renderLabelsNow();
}

function escapeHtml(value: string): string {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function close(): void {
  $("#labelsConfigurator").dialog("destroy");
  document.getElementById("labelsConfigurator")?.remove();
}

export const LabelsConfigurator = { open };
