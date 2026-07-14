import { type D3DragEvent, drag, polygonArea, select } from "d3";
import type { Feature } from "@/generators/features";
import { destroyDialogIfExists, ensureEl, findEl, getPackPolygon, rn, si, unique } from "../utils";

function open(element: SVGElement): void {
  if (customization) return;
  closeDialogs(".stable");
  if (layerIsOn("toggleCells")) toggleCells();

  renderDialog();

  debug.append("g").attr("id", "vertices");
  elSelected = select<SVGElement, unknown>(element) as unknown as typeof elSelected;
  selectCoastlineGroup(element);
  drawCoastlineVertices();
  select<SVGElement, unknown>("#viewbox").on("touchmove mousemove", null);

  $("#coastlineEditor").dialog({
    title: "Edit Coastline",
    resizable: false,
    position: { my: "center top+20", at: "top", of: "svg", collision: "fit" },
    close: closeCoastlineEditor
  });
}

function renderDialog(): void {
  destroyDialogIfExists("coastlineEditor");

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
  ensureEl("coastlineGroupsShow").on("click", showGroupSection);
  ensureEl("coastlineGroup").on("change", changeCoastlineGroup);
  ensureEl("coastlineGroupAdd").on("click", toggleNewGroupInput);
  ensureEl("coastlineGroupName").on("change", createNewGroup);
  ensureEl("coastlineGroupRemove").on("click", removeCoastlineGroup);
  ensureEl("coastlineGroupsHide").on("click", hideGroupSection);
  ensureEl("coastlineEditStyle").on("click", editGroupStyle);
}

function getFeature(): Feature {
  const featureId = +elSelected.attr("data-f");
  return pack.features[featureId];
}

function drawCoastlineVertices(): void {
  const { vertices, area } = getFeature();

  const cellsNumber = pack.cells.i.length;
  const neibCells: number[] = unique(vertices.flatMap(v => pack.vertices.c[v])).filter(cellId => cellId < cellsNumber);
  debug
    .select("#vertices")
    .selectAll<SVGPolygonElement, number>("polygon")
    .data(neibCells)
    .enter()
    .append("polygon")
    .attr("points", (d: number) => getPackPolygon(d, pack))
    .attr("data-c", (d: number) => d);

  debug
    .select("#vertices")
    .selectAll<SVGCircleElement, number>("circle")
    .data(vertices)
    .enter()
    .append("circle")
    .attr("cx", (d: number) => pack.vertices.p[d][0])
    .attr("cy", (d: number) => pack.vertices.p[d][1])
    .attr("r", 0.4)
    .attr("data-v", (d: number) => d)
    .call(drag<SVGCircleElement, number>().on("drag", handleVertexDrag).on("end", handleVertexDragEnd))
    .on("mousemove", () =>
      tip("Drag to move the vertex. Please use for fine-tuning only. Edit heightmap to change actual cell heights!")
    );

  ensureEl("coastlineArea").innerHTML = `${si(getArea(area))} ${getAreaUnit()}`;
}

function handleVertexDrag(
  this: SVGCircleElement,
  event: D3DragEvent<SVGCircleElement, number, number>,
  vertexId: number
): void {
  const { vertices, features } = pack;

  const x = rn(event.x, 2);
  const y = rn(event.y, 2);
  this.setAttribute("cx", String(x));
  this.setAttribute("cy", String(y));

  vertices.p[vertexId] = [x, y];

  const featureId = +elSelected.attr("data-f");
  const feature = features[featureId];

  // change coastline path
  select<SVGElement, unknown>("#deftemp")
    .select(`#featurePaths > path#feature_${featureId}`)
    .attr("d", getFeaturePath(feature));

  // update area
  const points = feature.vertices.map(vertex => vertices.p[vertex] as [number, number]);
  feature.area = Math.abs(polygonArea(points));
  ensureEl("coastlineArea").innerHTML = `${si(getArea(feature.area))} ${getAreaUnit()}`;

  // update cell
  debug
    .select("#vertices")
    .selectAll<SVGPolygonElement, number>("polygon")
    .attr("points", d => getPackPolygon(d, pack));
}

function handleVertexDragEnd(): void {
  if (layerIsOn("toggleStates")) drawStates();
  if (layerIsOn("toggleProvinces")) drawProvinces();
  if (layerIsOn("toggleBorders")) drawBorders();
  if (layerIsOn("toggleBiomes")) drawBiomes();
  if (layerIsOn("toggleReligions")) drawReligions();
  if (layerIsOn("toggleCultures")) drawCultures();
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

function selectCoastlineGroup(node: SVGElement): void {
  const group = (node.parentNode as SVGGElement).id;
  const groupSelect = ensureEl<HTMLSelectElement>("coastlineGroup");
  groupSelect.options.length = 0; // remove all options

  select<SVGGElement, unknown>("#coastline")
    .selectAll<SVGGElement, unknown>("g")
    .each(function () {
      groupSelect.options.add(new Option(this.id, this.id, false, this.id === group));
    });
}

function changeCoastlineGroup(this: HTMLSelectElement): void {
  ensureEl(this.value).appendChild(elSelected.node()!);
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

  if (findEl(group)) {
    tip("Element with this id already exists. Please provide a unique name", false, "error");
    return;
  }

  if (Number.isFinite(+group.charAt(0))) {
    tip("Group name should start with a letter", false, "error");
    return;
  }

  // just rename if only 1 element left
  const oldGroup = elSelected.node()!.parentNode as SVGGElement;
  const basic = ["sea_island", "lake_island"].includes(oldGroup.id);
  if (!basic && oldGroup.childElementCount === 1) {
    ensureEl<HTMLSelectElement>("coastlineGroup").selectedOptions[0].remove();
    ensureEl<HTMLSelectElement>("coastlineGroup").options.add(new Option(group, group, false, true));
    oldGroup.id = group;
    toggleNewGroupInput();
    ensureEl<HTMLInputElement>("coastlineGroupName").value = "";
    return;
  }

  // create a new group
  const newGroup = (elSelected.node()!.parentNode as SVGGElement).cloneNode(false) as SVGGElement;
  ensureEl("coastline").appendChild(newGroup);
  newGroup.id = group;
  ensureEl<HTMLSelectElement>("coastlineGroup").options.add(new Option(group, group, false, true));
  ensureEl(group).appendChild(elSelected.node()!);

  toggleNewGroupInput();
  ensureEl<HTMLInputElement>("coastlineGroupName").value = "";
}

function removeCoastlineGroup(): void {
  const group = (elSelected.node()!.parentNode as SVGGElement).id;
  if (["sea_island", "lake_island"].includes(group)) {
    tip("This is one of the default groups, it cannot be removed", false, "error");
    return;
  }

  const count = (elSelected.node()!.parentNode as SVGGElement).childElementCount;
  alertMessage.innerHTML = /* html */ `Are you sure you want to remove the group? All coastline elements of the group (${count}) will be moved under
    <i>sea_island</i> group`;
  $("#alert").dialog({
    resizable: false,
    title: "Remove coastline group",
    width: "26em",
    buttons: {
      Remove: function (this: HTMLElement) {
        $(this).dialog("close");
        const sea = ensureEl("sea_island");
        const groupEl = ensureEl(group);
        while (groupEl.childNodes.length) {
          sea.appendChild(groupEl.childNodes[0]);
        }
        groupEl.remove();
        ensureEl<HTMLSelectElement>("coastlineGroup").selectedOptions[0].remove();
        ensureEl<HTMLSelectElement>("coastlineGroup").value = "sea_island";
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function editGroupStyle(): void {
  const g = (elSelected.node()!.parentNode as SVGGElement).id;
  editStyle("coastline", g);
}

function closeCoastlineEditor(): void {
  debug.select("#vertices").remove();
  unselect();
  destroyDialogIfExists("coastlineEditor");
}

export const CoastlineVertexEditor = { open };
