import { mean, min, polygonLength } from "d3";
import { closeDialogs, confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { showDomDialog } from "@/components/ui/dom-dialog";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { moveFeatureVertex, setFeatureGroup } from "@/controllers/editor-mutations";
import type { Feature } from "@/generators/features";
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
import { getArea, getAreaUnit, speak } from "@/utils";
import { ensureEl, rand, rn, si, unique } from "../utils";
import { getHeight } from "../utils/unitUtils";

let selectedLakeId = 0;
let activeVertex: { initialPoint: [number, number]; vertexId: number } | null = null;

function open(lakeId: number): void {
  if (customization) return;
  closeDialogs(".stable");
  if (layerIsOn("toggleCells")) toggleCells();

  renderDialog();

  const lake = pack.features.find(feature => feature.i === lakeId && feature.type === "lake");
  if (!lake) return;
  selectedLakeId = lakeId;
  document.getElementById("map")?.addEventListener(MAP_INTERACTION_HANDLE_EVENT, editLakeVertex as EventListener);
  updateLakeValues();
  selectLakeGroup();
  drawLakeVertices();

  showDomDialog({
    content: ensureEl("lakeEditor"),
    onClose: closeLakesEditor,
    placement: "top-center",
    placementOffset: { x: 0, y: 20 },
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Edit Lake",
    width: "fit-content"
  });
}

function renderDialog(): void {
  destroyDialog("lakeEditor");

  const html = /* html */ `<div id="lakeEditor" class="dialog">
    <div id="lakeBody" style="padding-bottom: 0.3em">
      <div>
        <div class="label" style="width: 4.8em">Name:</div>
        <span id="lakeNameCulture" data-tip="Generate culture-specific name for the lake" class="icon-book pointer"></span>
        <span id="lakeNameRandom" data-tip="Generate random name for the lake" class="icon-globe pointer"></span>
        <input id="lakeName" data-tip="Type to rename the lake" autocorrect="off" spellcheck="false" />
        <span id="lakeNameSpeak" data-tip="Speak the name. You can change voice and language in options" class="speaker">🔊</span>
      </div>
      <div data-tip="Type to change lake type (group)">
        <div class="label" style="width: 4.8em">Type:</div>
        <span id="lakeGroupRemove" data-tip="Remove the group" class="icon-trash-empty pointer"></span>
        <span id="lakeGroupAdd" data-tip="Create a new type (group) for the lake" class="icon-plus pointer"></span>
        <select id="lakeGroup" data-tip="Select lake type (group)"></select>
        <input id="lakeGroupName" placeholder="type name" data-tip="Provide a name for the new group" style="display: none" />
        <span id="lakeEditStyle" data-tip="Edit lake group style in Style Editor" class="icon-brush pointer"></span>
      </div>
      <div data-tip="Lake area in selected units">
        <div class="label">Area:</div>
        <input id="lakeArea" disabled />
      </div>
      <div data-tip="Lake shore length in selected units">
        <div class="label">Shore length:</div>
        <input id="lakeShoreLength" disabled />
      </div>
      <div data-tip="Lake elevation in selected units">
        <div class="label">Elevation:</div>
        <input id="lakeElevation" disabled />
      </div>
      <div data-tip="Lake average depth in selected units">
        <div class="label">Average depth:</div>
        <input id="lakeAverageDepth" disabled />
      </div>
      <div data-tip="Lake maximum depth in selected units">
        <div class="label">Max depth:</div>
        <input id="lakeMaxDepth" disabled />
      </div>
      <div data-tip="Lake water supply. If supply > evaporation and there is an outlet, the lake water is fresh. If supply is very low, the lake becomes dry">
        <div class="label">Supply:</div>
        <input id="lakeFlux" disabled />
      </div>
      <div data-tip="Evaporation from lake surface. If evaporation > supply, the lake water is saline. If difference is high, the lake becomes dry">
        <div class="label">Evaporation:</div>
        <input id="lakeEvaporation" disabled />
      </div>
      <div data-tip="Number of lake inlet rivers">
        <div class="label">Inlets:</div>
        <input id="lakeInlets" disabled />
      </div>
      <div data-tip="Lake outlet river">
        <div class="label">Outlet:</div>
        <input id="lakeOutlet" disabled />
      </div>
    </div>
    <div id="lakeBottom">
      <button id="lakeLegend" data-tip="Edit free text notes (legend) for the lake" class="icon-edit"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("lakeName").addEventListener("input", changeName);
  ensureEl("lakeNameSpeak").addEventListener("click", () => speak(ensureEl<HTMLInputElement>("lakeName").value));
  ensureEl("lakeNameCulture").addEventListener("click", generateNameCulture);
  ensureEl("lakeNameRandom").addEventListener("click", generateNameRandom);
  ensureEl("lakeGroup").addEventListener("change", changeLakeGroup);
  ensureEl("lakeGroupAdd").addEventListener("click", toggleNewGroupInput);
  ensureEl("lakeGroupName").addEventListener("change", createNewGroup);
  ensureEl("lakeGroupRemove").addEventListener("click", removeLakeGroup);
  ensureEl("lakeEditStyle").addEventListener("click", editGroupStyle);
  ensureEl("lakeLegend").addEventListener("click", editLakeLegend);
}

function getLake(): Feature {
  return pack.features.find(feature => feature.i === selectedLakeId) as Feature;
}

function updateLakeValues(): void {
  const { cells, vertices, rivers } = pack;

  const l = getLake();
  ensureEl<HTMLInputElement>("lakeName").value = l.name;
  ensureEl<HTMLInputElement>("lakeArea").value = `${si(getArea(l.area))} ${getAreaUnit()}`;

  const length = polygonLength(l.vertices.map(v => vertices.p[v] as [number, number]));
  ensureEl<HTMLInputElement>("lakeShoreLength").value = `${si(length * distanceScale)} ${distanceUnitInput.value}`;

  const lakeCells = Array.from(cells.i.filter(i => cells.f[i] === l.i));
  const heights = lakeCells.map(i => cells.h[i]);

  ensureEl<HTMLInputElement>("lakeElevation").value = getHeight(l.height);
  ensureEl<HTMLInputElement>("lakeAverageDepth").value = getHeight(mean(heights) ?? 0, true);
  ensureEl<HTMLInputElement>("lakeMaxDepth").value = getHeight(min(heights) ?? 0, true);

  ensureEl<HTMLInputElement>("lakeFlux").value = String(l.flux);
  ensureEl<HTMLInputElement>("lakeEvaporation").value = String(l.evaporation);

  const inlets = l.inlets?.map(inlet => rivers.find(river => river.i === inlet)?.name);
  const outlet = l.outlet ? rivers.find(river => river.i === l.outlet)?.name : "no";
  const inletsInput = ensureEl<HTMLInputElement>("lakeInlets");
  inletsInput.value = inlets ? String(inlets.length) : "no";
  inletsInput.title = inlets ? inlets.join(", ") : "";
  ensureEl<HTMLInputElement>("lakeOutlet").value = outlet ?? "no";
}

function drawLakeVertices(): void {
  const lake = getLake();
  const cells = unique(lake.vertices.flatMap(vertexId => pack.vertices.c[vertexId])).filter(
    cellId => cellId >= 0 && cellId < pack.cells.i.length
  );
  updateMapInteractionOverlay({
    handles: lake.vertices.map(vertexId => {
      const [x, y] = pack.vertices.p[vertexId];
      return {
        id: `lake-vertex:${vertexId}`,
        label: `Move vertex ${vertexId} of ${lake.name || "lake"}`,
        point: { x, y }
      };
    }),
    selection: [
      { kind: "polygon", points: lake.vertices.map(vertexId => toPoint(pack.vertices.p[vertexId])) },
      ...cells.map(cellPolygon)
    ]
  });
}

function editLakeVertex(event: CustomEvent<MapInteractionHandleEventDetail>): void {
  const serializedId = String(event.detail.handleId);
  if (!serializedId.startsWith("lake-vertex:")) return;
  const vertexId = Number(serializedId.split(":")[1]);
  if (!getLake().vertices.includes(vertexId)) return;

  if (event.detail.phase === "start") {
    activeVertex = { initialPoint: [...pack.vertices.p[vertexId]], vertexId };
    tip("Drag to move the vertex. Use this for fine-tuning; edit the heightmap for topological changes", true);
    return;
  }
  if (event.detail.phase === "cancel") {
    if (activeVertex?.vertexId === vertexId) {
      applyFeatureVertexMutation(vertexId, activeVertex.initialPoint);
      activeVertex = null;
      drawLakeVertices();
    }
    return;
  }
  if (event.detail.phase === "move") {
    applyFeatureVertexMutation(vertexId, [rn(event.detail.worldPoint.x, 2), rn(event.detail.worldPoint.y, 2)]);
    return;
  }
  if (event.detail.phase !== "end" || activeVertex?.vertexId !== vertexId) return;
  activeVertex = null;
  updateLakeValues();
  drawLakeVertices();
}

function applyFeatureVertexMutation(vertexId: number, point: [number, number]): void {
  const mutation = moveFeatureVertex(pack, selectedLakeId, vertexId, point);
  if (!mutation.changed) return;
  for (const layer of mutation.layers) if (isPixiOwnedLayer(layer)) invalidatePixiRendererLayer(layer);
  ensureEl<HTMLInputElement>("lakeArea").value = `${si(getArea(getLake().area))} ${getAreaUnit()}`;
}

function changeName(this: HTMLInputElement): void {
  getLake().name = this.value;
}

function generateNameCulture(): void {
  const lake = getLake();
  lake.name = ensureEl<HTMLInputElement>("lakeName").value = Lakes.getName(lake);
}

function generateNameRandom(): void {
  const lake = getLake();
  lake.name = ensureEl<HTMLInputElement>("lakeName").value = Names.getBase(rand(Names.nameBases.length - 1));
}

function selectLakeGroup(): void {
  const lake = getLake();

  const groupSelect = ensureEl<HTMLSelectElement>("lakeGroup");
  groupSelect.options.length = 0;
  const groups = new Set([
    ...Object.keys(getMapRendererStyle(style).lakes.roles),
    ...pack.features.filter(feature => feature.type === "lake").map(feature => feature.group)
  ]);
  for (const group of groups) groupSelect.options.add(new Option(group, group, false, group === lake.group));
}

function changeLakeGroup(this: HTMLSelectElement): void {
  if (setFeatureGroup(pack, selectedLakeId, this.value).changed) invalidatePixiRendererLayer("lakes");
}

function toggleNewGroupInput(): void {
  const lakeGroupName = ensureEl("lakeGroupName");
  const lakeGroup = ensureEl("lakeGroup");
  if (lakeGroupName.style.display === "none") {
    lakeGroupName.style.display = "inline-block";
    lakeGroupName.focus();
    lakeGroup.style.display = "none";
  } else {
    lakeGroupName.style.display = "none";
    lakeGroup.style.display = "inline-block";
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
    ...Object.keys(mapStyle.lakes.roles),
    ...pack.features.filter(feature => feature.type === "lake").map(feature => feature.group)
  ]);
  if (groups.has(group)) {
    tip("A lake group with this name already exists. Please provide a unique name", false, "error");
    return;
  }

  if (Number.isFinite(+group.charAt(0))) {
    tip("Group name should start with a letter", false, "error");
    return;
  }

  // just rename if only 1 element left
  const lake = getLake();
  const oldGroup = lake.group;
  const basic = ["freshwater", "salt", "sinkhole", "frozen", "lava", "dry"].includes(oldGroup);
  const groupFeatures = pack.features.filter(feature => feature.type === "lake" && feature.group === oldGroup);
  mapStyle.lakes.roles[group] = structuredClone(mapStyle.lakes.roles[oldGroup] ?? mapStyle.lakes.default);
  if (!basic && groupFeatures.length === 1) delete mapStyle.lakes.roles[oldGroup];
  setFeatureGroup(pack, lake.i, group);
  style.mapRenderer = mapStyle;
  invalidatePixiRendererLayer("lakes");
  selectLakeGroup();

  toggleNewGroupInput();
  ensureEl<HTMLInputElement>("lakeGroupName").value = "";
}

function removeLakeGroup(): void {
  const group = getLake().group;
  if (["freshwater", "salt", "sinkhole", "frozen", "lava", "dry"].includes(group)) {
    tip("This is one of the default groups, it cannot be removed", false, "error");
    return;
  }

  const groupFeatures = pack.features.filter(feature => feature.type === "lake" && feature.group === group);
  const count = groupFeatures.length;
  confirmationDialog({
    confirm: "Remove",
    message: `Are you sure you want to remove the group? All lakes of the group (${count}) will be turned into Freshwater`,
    onConfirm: () => {
      for (const feature of groupFeatures) setFeatureGroup(pack, feature.i, "freshwater");
      const mapStyle = getMapRendererStyle(style);
      delete mapStyle.lakes.roles[group];
      style.mapRenderer = mapStyle;
      invalidatePixiRendererLayer("lakes");
      selectLakeGroup();
    },
    title: "Remove lake group"
  });
}

function editGroupStyle(): void {
  editStyle("lakes", getLake().group);
}

function editLakeLegend(): void {
  const lake = getLake();
  void Controllers.NotesEditor.open(`feature_${lake.i}`, `${lake.name} ${lake.group} lake`);
}

function closeLakesEditor(): void {
  document.getElementById("map")?.removeEventListener(MAP_INTERACTION_HANDLE_EVENT, editLakeVertex as EventListener);
  clearMapInteractionOverlay();
  activeVertex = null;
  selectedLakeId = 0;
  applyDefaultViewboxEvents();
  destroyDialog("lakeEditor");
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

export const LakesEditor = { open };
