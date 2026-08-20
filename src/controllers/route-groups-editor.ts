import { confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { showDomDialog } from "@/components/ui/dom-dialog";
import type { Route } from "@/generators/routes-generator";
import { invalidatePixiRendererLayer } from "@/renderers/pixi/pixi-renderer-controller";
import { getMapRendererStyle } from "@/renderers/scene/map-style-state";
import { ensureEl } from "../utils";

// custom legacy 3-arg prompt from commonUtils.initializePrompt (collides with lib.dom's var prompt)
declare const prompt: (text: string, options: { default: string }, callback: (value: string) => void) => void;

function open(): void {
  if (customization) return;
  if (!layerIsOn("toggleRoutes")) toggleRoutes();

  renderDialog();
  addLines();

  showDomDialog({
    content: ensureEl("routeGroupsEditor"),
    onClose: closeRouteGroupsEditor,
    placement: "top-left",
    placementOffset: { x: 10, y: 140 },
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Edit Route groups",
    width: "22em"
  });
}

function renderDialog(): void {
  destroyDialog("routeGroupsEditor");

  const html = /* html */ `<div id="routeGroupsEditor" class="dialog">
    <div id="routeGroupsEditorBody" class="table" style="padding: 0.3em 0; width: 100%"></div>
    <div id="routeGroupsEditorBottom">
      <button id="routeGroupsEditorAdd" data-tip="Add route group" class="icon-plus"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("routeGroupsEditorAdd").addEventListener("click", addGroup);
  ensureEl("routeGroupsEditorBody").addEventListener("click", onBodyClick);
}

function closeRouteGroupsEditor(): void {
  destroyDialog("routeGroupsEditor");
}

function onBodyClick(ev: Event): void {
  const target = ev.target as HTMLElement;
  const group = target.closest<HTMLElement>(".states")?.dataset.id;
  if (target.classList.contains("editStyle") && group) editStyle("routes", group);
  else if (target.classList.contains("removeGroup") && group) removeGroup(group);
}

function addLines(): void {
  ensureEl("routeGroupsEditorBody").innerHTML = "";

  const rendererStyle = getMapRendererStyle(style);
  const groups = new Set([
    ...Object.keys(rendererStyle.routes.roles),
    ...pack.routes.map((route: Route) => route.group)
  ]);
  const lines = [...groups].map(group => {
    const count = pack.routes.filter((route: Route) => route.group === group).length;
    return /* html */ `<div data-id="${group}" class="states" style="display: flex; justify-content: space-between;">
          <span>${group} (${count})</span>
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
    const rendererStyle = getMapRendererStyle(style);
    if (group in rendererStyle.routes.roles || pack.routes.some((route: Route) => route.group === group))
      return tip("Element with this name already exists. Provide a unique name", false, "error");
    if (Number.isFinite(+group.charAt(0))) return tip("Group name should start with a letter", false, "error");

    rendererStyle.routes.roles[group] = {
      cap: "butt",
      color: "#000000",
      dash: "1 0.5",
      opacity: 1,
      width: 0.5
    };
    style.mapRenderer = rendererStyle;
    invalidatePixiRendererLayer("routes");
    addLines();

    const routeGroup = document.getElementById("routeGroup") as HTMLSelectElement | null;
    routeGroup?.options.add(new Option(group, group));
    const creatorGroup = document.getElementById("routeCreatorGroupSelect") as HTMLSelectElement | null;
    creatorGroup?.options.add(new Option(group, group));
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
      if (style.mapRenderer?.routes.roles[group]) delete style.mapRenderer.routes.roles[group];
      invalidatePixiRendererLayer("routes");
      addLines();
    }
  });
}

export const RouteGroupsEditor = { open };
