import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { destroyDialogIfExists, ensureEl } from "@/utils";

function open(): void {
  if (customization) return;
  closeDialogs("#labelsConfigurator, .stable");
  renderDialog();

  $("#labelGroupsConfigurator").dialog({
    title: "Configure Label Groups",
    position: { my: "center top+10", at: "center top", of: "svg", collision: "fit" },
    close
  });
}

function renderDialog(): void {
  destroyDialogIfExists("labelGroupsConfigurator");
  const html = /* html */ `<div id="labelGroupsConfigurator" class="dialog stable">
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
      <select id="labelsNewType">${TYPES.map(type => `<option value="${type}">${type}</option>`).join("")}</select>
      <input id="labelsNewName" placeholder="new group name" style="width:11em">
      <button id="labelsCreateGroup" class="icon-plus">Create group</button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
}

export const LabelGroupsConfigurator = { open };
