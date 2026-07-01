import type { Route } from "@/generators/routes-generator";
import { ensureEl } from "../utils";

// custom legacy 3-arg prompt from commonUtils.initializePrompt (collides with lib.dom's var prompt)
declare const prompt: (text: string, options: { default: string }, callback: (value: string) => void) => void;

const DEFAULT_GROUPS = ["roads", "trails", "searoutes"];

const DIALOG_HTML = /* html */ `
  <div id="routeGroupsEditorBody" class="table" style="padding: 0.3em 0; width: 100%"></div>
  <div id="routeGroupsEditorBottom">
    <button id="routeGroupsEditorAdd" data-tip="Add route group" class="icon-plus"></button>
  </div>`;

function open(): void {
  if (customization) return;
  if (!layerIsOn("toggleRoutes")) toggleRoutes();

  ensureEl("routeGroupsEditor").innerHTML = DIALOG_HTML;
  addLines();

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("routeGroupsEditorAdd").on("click", addGroup);
  ensureEl("routeGroupsEditorBody").on("click", onBodyClick);

  $("#routeGroupsEditor").dialog({
    title: "Edit Route groups",
    resizable: false,
    position: { my: "left top", at: "left+10 top+140", of: "#map" },
    close: closeRouteGroupsEditor
  });
}

function closeRouteGroupsEditor(): void {
  ensureEl("routeGroupsEditor").innerHTML = "";
}

function onBodyClick(ev: Event): void {
  const target = ev.target as HTMLElement;
  const group = target.closest<HTMLElement>(".states")?.dataset.id;
  if (target.classList.contains("editStyle") && group) editStyle("routes", group);
  else if (target.classList.contains("removeGroup") && group) removeGroup(group);
}

function addLines(): void {
  ensureEl("routeGroupsEditorBody").innerHTML = "";

  const lines = routes
    .selectAll<SVGGElement, unknown>("g")
    .nodes()
    .map(el => {
      const count = el.children.length;
      return /* html */ `<div data-id="${el.id}" class="states" style="display: flex; justify-content: space-between;">
          <span>${el.id} (${count})</span>
          <div style="width: auto; display: flex; gap: 0.4em;">
            <span data-tip="Edit style" class="editStyle icon-brush pointer" style="font-size: smaller;"></span>
            <span data-tip="Remove group" class="removeGroup icon-trash pointer"></span>
          </div>
        </div>`;
    });

  ensureEl("routeGroupsEditorBody").innerHTML = lines.join("");
}

function addGroup(): void {
  prompt("Type group name", { default: "route-group-new" }, v => {
    let group = v
      .toLowerCase()
      .replace(/ /g, "_")
      .replace(/[^\w\s]/gi, "");

    if (!group) return tip("Invalid group name", false, "error");
    if (!group.startsWith("route-")) group = `route-${group}`;
    if (document.getElementById(group))
      return tip("Element with this name already exists. Provide a unique name", false, "error");
    if (Number.isFinite(+group.charAt(0))) return tip("Group name should start with a letter", false, "error");

    routes
      .append("g")
      .attr("id", group)
      .attr("stroke", "#000000")
      .attr("stroke-width", 0.5)
      .attr("stroke-dasharray", "1 0.5")
      .attr("stroke-linecap", "butt");
    ensureEl<HTMLSelectElement>("routeGroup").options.add(new Option(group, group));
    addLines();

    ensureEl<HTMLSelectElement>("routeCreatorGroupSelect").options.add(new Option(group, group));
  });
}

function removeGroup(group: string): void {
  confirmationDialog({
    title: "Remove route group",
    message:
      "Are you sure you want to remove the entire route group? All routes in this group will be removed.<br>This action can't be reverted",
    confirm: "Remove",
    onConfirm: () => {
      pack.routes.filter((r: Route) => r.group === group).forEach(Routes.remove);
      if (!DEFAULT_GROUPS.includes(group)) routes.select(`#${group}`).remove();
      addLines();
    }
  });
}

export const RouteGroupsEditor = { open };
