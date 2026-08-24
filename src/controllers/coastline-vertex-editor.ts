import { closeDialogs, confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { showDomDialog } from "@/components/ui/dom-dialog";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { moveFeatureVertex, setFeatureGroup } from "@/controllers/editor-mutations";
import type { Feature } from "@/generators/features";
import type { MapLayerId } from "@/renderers/core/layer-registry";
import {
  MAP_INTERACTION_HANDLE_EVENT,
  type MapInteractionHandleEventDetail
} from "@/renderers/interaction/map-interaction-overlay";
import {
  clearMapInteractionOverlay,
  invalidatePixiRendererLayer,
  updateMapInteractionOverlay
} from "@/renderers/pixi/pixi-renderer-controller";
import { isPixiOwnedLayer } from "@/renderers/pixi/pixi-renderer-ownership";
import { getMapRendererStyle } from "@/renderers/scene/map-style-state";
import { getArea, getAreaUnit } from "@/utils";
import { ensureEl, rn, si, unique } from "../utils";

let selectedFeatureId = 0;
let activeVertex: { initialPoint: [number, number]; invalidationLayers: MapLayerId[]; vertexId: number } | null = null;

function open(featureId: number): void {
  if (customization) return;
  closeDialogs(".stable");
  if (window.LayerControls.isLayerOn("toggleCells")) window.LayerControls.toggleLayer("toggleCells");

  renderDialog();

  const feature = pack.features.find(candidate => candidate.i === featureId && candidate.type === "island");
  if (!feature) return;
  selectedFeatureId = featureId;
  document.getElementById("map")?.addEventListener(MAP_INTERACTION_HANDLE_EVENT, editCoastlineVertex as EventListener);
  selectCoastlineGroup();
  drawCoastlineVertices();

  showDomDialog({
    content: ensureEl("coastlineEditor"),
    onClose: closeCoastlineEditor,
    placement: "top-center",
    placementOffset: { x: 0, y: 20 },
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Edit Coastline",
    width: "fit-content"
  });
}

function renderDialog(): void {
  destroyDialog("coastlineEditor");

  const html = /* html */ `<div id="coastlineEditor" class="dialog">
    <button id="coastlineGroupsShow" data-tip="Show the group selection" class="icon-tags"></button>
    <div id="coastlineGroupsSelection" style="display: none">
      <button id="coastlineGroupsHide" data-tip="Hide the group section" class="icon-tags"></button>
      <select id="coastlineGroup" data-tip="Select a group for this coastline" style="width: 9em"></select>
      <input id="coastlineGroupName" placeholder="new group name" data-tip="Provide a name for the new group" style="display: none; width: 9em" />
      <span id="coastlineGroupAdd" data-tip="Create a new group for this coastline" class="icon-plus pointer"></span>
      <span id="coastlineGroupRemove" data-tip="Remove the group" class="icon-trash-empty pointer"></span>
    </div>
    <button id="coastlineEditStyle" data-tip="Edit coastline group style in Style Editor" class="icon-brush"></button>
    <button id="coastlineArea" data-tip="Landmass area in selected units">0</button>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("coastlineGroupsShow").addEventListener("click", showGroupSection);
  ensureEl("coastlineGroup").addEventListener("change", changeCoastlineGroup);
  ensureEl("coastlineGroupAdd").addEventListener("click", toggleNewGroupInput);
  ensureEl("coastlineGroupName").addEventListener("change", createNewGroup);
  ensureEl("coastlineGroupRemove").addEventListener("click", removeCoastlineGroup);
  ensureEl("coastlineGroupsHide").addEventListener("click", hideGroupSection);
  ensureEl("coastlineEditStyle").addEventListener("click", editGroupStyle);
}

function getFeature(): Feature {
  return pack.features.find(feature => feature.i === selectedFeatureId) as Feature;
}

function drawCoastlineVertices(): void {
  const feature = getFeature();
  const { vertices, area } = feature;

  updateMapInteractionOverlay({
    handles: vertices.map(vertexId => {
      const [x, y] = pack.vertices.p[vertexId];
      return {
        id: `coastline-vertex:${vertexId}`,
        label: `Move coastline vertex ${vertexId}`,
        point: { x, y }
      };
    }),
    selection: getCoastlineSelection(vertices)
  });

  ensureEl("coastlineArea").innerHTML = `${si(getArea(area))} ${getAreaUnit()}`;
}

function editCoastlineVertex(event: CustomEvent<MapInteractionHandleEventDetail>): void {
  const serializedId = String(event.detail.handleId);
  if (!serializedId.startsWith("coastline-vertex:")) return;
  const vertexId = Number(serializedId.split(":")[1]);
  if (!getFeature().vertices.includes(vertexId)) return;

  if (event.detail.phase === "start") {
    activeVertex = { initialPoint: [...pack.vertices.p[vertexId]], invalidationLayers: [], vertexId };
    tip("Drag to fine-tune the coastline vertex; use the heightmap editor for topological changes", true);
    return;
  }
  if (event.detail.phase === "cancel") {
    if (activeVertex?.vertexId === vertexId) {
      applyFeatureVertexMutation(vertexId, activeVertex.initialPoint);
      activeVertex = null;
      drawCoastlineVertices();
    }
    return;
  }
  if (event.detail.phase === "move") {
    const layers = applyFeatureVertexMutation(vertexId, [
      rn(event.detail.worldPoint.x, 2),
      rn(event.detail.worldPoint.y, 2)
    ]);
    if (layers && activeVertex?.vertexId === vertexId) {
      activeVertex.invalidationLayers = layers;
      updateMapInteractionOverlay({ selection: getCoastlineSelection(getFeature().vertices, vertexId) });
    }
    return;
  }
  if (event.detail.phase !== "end" || activeVertex?.vertexId !== vertexId) return;
  invalidateFeatureGeometry(activeVertex.invalidationLayers);
  activeVertex = null;
  drawCoastlineVertices();
}

function applyFeatureVertexMutation(vertexId: number, point: [number, number]): MapLayerId[] | null {
  const mutation = moveFeatureVertex(pack, selectedFeatureId, vertexId, point);
  if (!mutation.changed) return null;
  ensureEl("coastlineArea").innerHTML = `${si(getArea(getFeature().area))} ${getAreaUnit()}`;
  return mutation.layers;
}

function invalidateFeatureGeometry(layers: readonly MapLayerId[]): void {
  for (const layer of layers) if (isPixiOwnedLayer(layer)) invalidatePixiRendererLayer(layer);
}

function showGroupSection(): void {
  document.querySelectorAll<HTMLElement>("#coastlineEditor > button").forEach(el => {
    el.style.display = "none";
  });
  ensureEl("coastlineGroupsSelection").style.display = "inline-block";
}

function hideGroupSection(): void {
  document.querySelectorAll<HTMLElement>("#coastlineEditor > button").forEach(el => {
    el.style.display = "inline-block";
  });
  ensureEl("coastlineGroupsSelection").style.display = "none";
  ensureEl("coastlineGroupName").style.display = "none";
  ensureEl<HTMLInputElement>("coastlineGroupName").value = "";
  ensureEl("coastlineGroup").style.display = "inline-block";
}

function selectCoastlineGroup(): void {
  const group = getFeature().group;
  const groupSelect = ensureEl<HTMLSelectElement>("coastlineGroup");
  groupSelect.options.length = 0;
  const groups = new Set([
    ...Object.keys(getMapRendererStyle(style).coastline.roles),
    ...pack.features.filter(feature => feature.type === "island").map(feature => feature.group)
  ]);
  for (const role of groups) groupSelect.options.add(new Option(role, role, false, role === group));
}

function changeCoastlineGroup(this: HTMLSelectElement): void {
  if (setFeatureGroup(pack, selectedFeatureId, this.value).changed) invalidatePixiRendererLayer("coastline");
}

function toggleNewGroupInput(): void {
  const coastlineGroupName = ensureEl("coastlineGroupName");
  const coastlineGroup = ensureEl("coastlineGroup");
  if (coastlineGroupName.style.display === "none") {
    coastlineGroupName.style.display = "inline-block";
    coastlineGroupName.focus();
    coastlineGroup.style.display = "none";
  } else {
    coastlineGroupName.style.display = "none";
    coastlineGroup.style.display = "inline-block";
  }
}

function createNewGroup(this: HTMLInputElement): void {
  if (!this.value) {
    tip("Please provide a valid group name");
    return;
  }

  const group = this.value
    .toLowerCase()
    .replace(/ /g, "_")
    .replace(/[^\w\s]/gi, "");

  const mapStyle = getMapRendererStyle(style);
  const groups = new Set([
    ...Object.keys(mapStyle.coastline.roles),
    ...pack.features.filter(feature => feature.type === "island").map(feature => feature.group)
  ]);
  if (groups.has(group)) {
    tip("A coastline group with this name already exists. Please provide a unique name", false, "error");
    return;
  }

  if (Number.isFinite(+group.charAt(0))) {
    tip("Group name should start with a letter", false, "error");
    return;
  }

  // just rename if only 1 element left
  const feature = getFeature();
  const oldGroup = feature.group;
  const basic = ["sea_island", "lake_island"].includes(oldGroup);
  const groupFeatures = pack.features.filter(candidate => candidate.type === "island" && candidate.group === oldGroup);
  mapStyle.coastline.roles[group] = structuredClone(mapStyle.coastline.roles[oldGroup] ?? mapStyle.coastline.default);
  if (!basic && groupFeatures.length === 1) delete mapStyle.coastline.roles[oldGroup];
  setFeatureGroup(pack, feature.i, group);
  style.mapRenderer = mapStyle;
  invalidatePixiRendererLayer("coastline");
  selectCoastlineGroup();

  toggleNewGroupInput();
  ensureEl<HTMLInputElement>("coastlineGroupName").value = "";
}

function removeCoastlineGroup(): void {
  const group = getFeature().group;
  if (["sea_island", "lake_island"].includes(group)) {
    tip("This is one of the default groups, it cannot be removed", false, "error");
    return;
  }

  const groupFeatures = pack.features.filter(feature => feature.type === "island" && feature.group === group);
  const count = groupFeatures.length;
  confirmationDialog({
    confirm: "Remove",
    message: /* html */ `Are you sure you want to remove the group? All coastline elements of the group (${count}) will be moved under
      <i>sea_island</i> group`,
    onConfirm: () => {
      for (const feature of groupFeatures) setFeatureGroup(pack, feature.i, "sea_island");
      const mapStyle = getMapRendererStyle(style);
      delete mapStyle.coastline.roles[group];
      style.mapRenderer = mapStyle;
      invalidatePixiRendererLayer("coastline");
      selectCoastlineGroup();
    },
    title: "Remove coastline group"
  });
}

function editGroupStyle(): void {
  window.StyleEditor.edit("coastline", getFeature().group);
}

function closeCoastlineEditor(): void {
  document
    .getElementById("map")
    ?.removeEventListener(MAP_INTERACTION_HANDLE_EVENT, editCoastlineVertex as EventListener);
  if (activeVertex) invalidateFeatureGeometry(activeVertex.invalidationLayers);
  clearMapInteractionOverlay();
  activeVertex = null;
  selectedFeatureId = 0;
  applyDefaultViewboxEvents();
  destroyDialog("coastlineEditor");
}

function getCoastlineSelection(vertices: readonly number[], activeVertexId?: number) {
  const cellsNumber = pack.cells.i.length;
  const relevantVertices = activeVertexId === undefined ? vertices : [activeVertexId];
  const cells = unique(relevantVertices.flatMap(vertexId => pack.vertices.c[vertexId])).filter(
    cellId => cellId >= 0 && cellId < cellsNumber
  );
  return [
    { kind: "polygon" as const, points: vertices.map(vertexId => toPoint(pack.vertices.p[vertexId])) },
    ...cells.map(cellPolygon)
  ];
}

function cellPolygon(cellId: number) {
  return {
    kind: "polygon" as const,
    points: pack.cells.v[cellId].map(vertexId => toPoint(pack.vertices.p[vertexId]))
  };
}

function toPoint([x, y]: readonly number[]): { x: number; y: number } {
  return { x, y };
}

export const CoastlineVertexEditor = { open };
