import { Controllers } from "@/controllers";
import { DEFAULT_RIVER_GROUP } from "@/model/physical/river-generator";
import { Styles } from "@/model/styles/styles";
import { Layers } from "@/renderers/layers";
import { Dialog } from "@/ui/dialog/dialog";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";

const isStockGroup = (group: string) => group in Styles.defaults.rivers.groups;
const riversOf = (group: string) => pack.rivers.filter(river => river.group === group);

function open(): void {
  if (options.app.mode) return;
  Layers.show("rivers");

  renderDialog();
  addLines();

  Dialog.open("riverGroupsEditor", {
    title: t("Edit river groups"),
    position: { my: "left top", at: "left+10 top+140", of: "#map" },
    onClose: closeRiverGroupsEditor
  });
}

function renderDialog(): void {
  Dialog.destroy("riverGroupsEditor");

  const html = /* html */ `<div id="riverGroupsEditor" class="dialog">
    <div id="riverGroupsEditorBody" class="table" style="padding: 0.3em 0; width: 100%"></div>
    <div id="riverGroupsEditorBottom">
      <button id="riverGroupsEditorAdd" data-tip="${t("Add")}" class="icon-plus"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("riverGroupsEditorAdd").addEventListener("click", addGroup);
  ensureEl("riverGroupsEditorBody").addEventListener("click", onBodyClick);
}

function closeRiverGroupsEditor(): void {
  Dialog.destroy("riverGroupsEditor");
}

function onBodyClick(ev: Event): void {
  const target = ev.target as HTMLElement;
  const group = target.closest<HTMLElement>(".states")?.dataset.id;
  if (target.classList.contains("editStyle") && group) void Controllers.StyleEditor.open("rivers", group);
  else if (target.classList.contains("removeGroup") && group) removeGroup(group);
}

function addLines(): void {
  const lines = Object.keys(styles.rivers.groups).map(group => {
    const remove = isStockGroup(group)
      ? ""
      : `<span data-tip="${t("Remove")}" class="removeGroup icon-trash pointer"></span>`;
    return /* html */ `<div data-id="${group}" class="states" style="display: flex; justify-content: space-between;">
          <span>${group} (${riversOf(group).length})</span>
          <div style="width: auto; display: flex; gap: 0.4em;">
            <span data-tip="${t("Edit style")}" class="editStyle icon-brush pointer" style="font-size: smaller;"></span>
            ${remove}
          </div>
        </div>`;
  });

  ensureEl("riverGroupsEditorBody").innerHTML = lines.join("");
}

/** The river group select of the River Editor, when it is open */
function syncEditorSelect(): void {
  const select = findEl<HTMLSelectElement>("riverGroup");
  if (!select) return;
  const value = select.value;
  select.options.length = 0;
  for (const group of Object.keys(styles.rivers.groups)) select.options.add(new Option(group, group));
  select.value = value in styles.rivers.groups ? value : DEFAULT_RIVER_GROUP;
}

function addGroup(): void {
  Dialog.prompt(t("Group name"), { default: "new_group" }, v => {
    const group = v
      .toLowerCase()
      .replace(/ /g, "_")
      .replace(/[^\w\s]/gi, "");

    if (!group) return tip(t("Invalid group name"), false, "error");
    if (Object.hasOwn(styles.rivers.groups, group))
      return tip(t("Element with this name already exists. Provide a unique name"), false, "error");
    if (Number.isFinite(+group.charAt(0))) return tip(t("Group name should start with a letter"), false, "error");

    // the store is the only record of a group: a new one starts with the default group's style
    styles.rivers.groups[group] = structuredClone(styles.rivers.groups[DEFAULT_RIVER_GROUP]);
    Layers.draw("rivers"); // the layer makes the group element from the store

    syncEditorSelect();
    addLines();
  });
}

function removeGroup(group: string): void {
  Dialog.confirm({
    title: t("Remove"),
    message: sentences(
      t("Are you sure you want to remove the group?"),
      t("All rivers of the group ({{rivers}}) will be moved to the {{group}} group", {
        rivers: riversOf(group).length,
        group: DEFAULT_RIVER_GROUP
      })
    ),
    confirm: t("Remove"),
    onConfirm: () => {
      for (const river of riversOf(group)) river.group = DEFAULT_RIVER_GROUP;
      delete styles.rivers.groups[group];
      Layers.draw("rivers");
      syncEditorSelect();
      addLines();
    }
  });
}

export const RiverGroupsEditor = { open };
