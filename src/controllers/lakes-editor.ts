import { drag, mean, min, polygonArea, polygonLength, select } from "d3";
import { Controllers } from "@/controllers";
import type { Feature } from "@/generators/features";
import { destroyDialogIfExists, ensureEl, findEl, getPackPolygon, rand, rn, si, unique } from "../utils";
import { getHeight } from "../utils/unitUtils";

function open(element: SVGElement): void {
  if (customization) return;
  closeDialogs(".stable");
  if (layerIsOn("toggleCells")) toggleCells();

  renderDialog();

  debug.append("g").attr("id", "vertices");
  elSelected = select<SVGElement, unknown>(element) as unknown as typeof elSelected;
  updateLakeValues();
  selectLakeGroup();
  drawLakeVertices();
  select(viewbox.node()!).on("touchmove mousemove", null);

  $("#lakeEditor").dialog({
    title: "Edit Lake",
    resizable: false,
    position: { my: "center top+20", at: "top", of: "svg", collision: "fit" },
    close: closeLakesEditor
  });
}

function renderDialog(): void {
  destroyDialogIfExists("lakeEditor");

  const html = /* html */ `<div id="lakeEditor" class="dialog">
    <div id="lakeBody" style="padding-bottom: 0.3em">
      <div>
        <div class="label" style="width: 4.8em">Name:</div>
        <span id="lakeNameCulture" data-tip="Generate culture-specific name for the lake" class="icon-book pointer"></span>
        <span id="lakeNameRandom" data-tip="Generate random name for the lake" class="icon-globe pointer"></span>
        <input id="lakeName" data-tip="Type to rename the lake" autocorrect="off" spellcheck="false" />
        <span data-tip="Speak the name. You can change voice and language in options" class="speaker">🔊</span>
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
  ensureEl("lakeName").on("input", changeName);
  ensureEl("lakeNameCulture").on("click", generateNameCulture);
  ensureEl("lakeNameRandom").on("click", generateNameRandom);
  ensureEl("lakeGroup").on("change", changeLakeGroup);
  ensureEl("lakeGroupAdd").on("click", toggleNewGroupInput);
  ensureEl("lakeGroupName").on("change", createNewGroup);
  ensureEl("lakeGroupRemove").on("click", removeLakeGroup);
  ensureEl("lakeEditStyle").on("click", editGroupStyle);
  ensureEl("lakeLegend").on("click", editLakeLegend);
}

function getLake(): Feature {
  const lakeId = +elSelected.attr("data-f");
  return pack.features.find(feature => feature.i === lakeId) as Feature;
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
  const vertices = getLake().vertices;

  const neibCells: number[] = unique(vertices.flatMap(v => pack.vertices.c[v]));
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
      tip("Drag to move the vertex. Please use for fine-tuning only! Edit heightmap to change actual cell heights")
    );
}

function handleVertexDrag(this: SVGCircleElement, event: any, vertexId: number): void {
  const x = rn(event.x, 2);
  const y = rn(event.y, 2);
  this.setAttribute("cx", String(x));
  this.setAttribute("cy", String(y));

  pack.vertices.p[vertexId] = [x, y];

  const feature = getLake();

  // update lake path
  select(defs.node()!).select(`#featurePaths > path#feature_${feature.i}`).attr("d", getFeaturePath(feature));

  // update area
  const points = feature.vertices.map(vertex => pack.vertices.p[vertex] as [number, number]);
  feature.area = Math.abs(polygonArea(points));
  ensureEl<HTMLInputElement>("lakeArea").value = `${si(getArea(feature.area))} ${getAreaUnit()}`;

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

function changeName(this: HTMLInputElement): void {
  getLake().name = this.value;
}

function generateNameCulture(): void {
  const lake = getLake();
  lake.name = ensureEl<HTMLInputElement>("lakeName").value = Lakes.getName(lake);
}

function generateNameRandom(): void {
  const lake = getLake();
  lake.name = ensureEl<HTMLInputElement>("lakeName").value = Names.getBase(rand(nameBases.length - 1));
}

function selectLakeGroup(): void {
  const lake = getLake();

  const select = ensureEl<HTMLSelectElement>("lakeGroup");
  select.options.length = 0; // remove all options
  lakes.selectAll<SVGGElement, unknown>("g").each(function () {
    select.options.add(new Option(this.id, this.id, false, this.id === lake.group));
  });
}

function changeLakeGroup(this: HTMLSelectElement): void {
  ensureEl(this.value).appendChild(elSelected.node()!);
  getLake().group = this.value;
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
  const basic = ["freshwater", "salt", "sinkhole", "frozen", "lava", "dry"].includes(oldGroup.id);
  if (!basic && oldGroup.childElementCount === 1) {
    ensureEl<HTMLSelectElement>("lakeGroup").selectedOptions[0].remove();
    ensureEl<HTMLSelectElement>("lakeGroup").options.add(new Option(group, group, false, true));
    oldGroup.id = group;
    toggleNewGroupInput();
    ensureEl<HTMLInputElement>("lakeGroupName").value = "";
    return;
  }

  // create a new group
  const newGroup = (elSelected.node()!.parentNode as SVGGElement).cloneNode(false) as SVGGElement;
  ensureEl("lakes").appendChild(newGroup);
  newGroup.id = group;
  ensureEl<HTMLSelectElement>("lakeGroup").options.add(new Option(group, group, false, true));
  ensureEl(group).appendChild(elSelected.node()!);

  toggleNewGroupInput();
  ensureEl<HTMLInputElement>("lakeGroupName").value = "";
}

function removeLakeGroup(): void {
  const group = (elSelected.node()!.parentNode as SVGGElement).id;
  if (["freshwater", "salt", "sinkhole", "frozen", "lava", "dry"].includes(group)) {
    tip("This is one of the default groups, it cannot be removed", false, "error");
    return;
  }

  const count = (elSelected.node()!.parentNode as SVGGElement).childElementCount;
  alertMessage.innerHTML = /* html */ `Are you sure you want to remove the group? All lakes of the group (${count}) will be turned into Freshwater`;
  $("#alert").dialog({
    resizable: false,
    title: "Remove lake group",
    width: "26em",
    buttons: {
      Remove: function (this: HTMLElement) {
        $(this).dialog("close");
        const freshwater = ensureEl("freshwater");
        const groupEl = ensureEl(group);
        while (groupEl.childNodes.length) {
          freshwater.appendChild(groupEl.childNodes[0]);
        }
        groupEl.remove();
        ensureEl<HTMLSelectElement>("lakeGroup").selectedOptions[0].remove();
        ensureEl<HTMLSelectElement>("lakeGroup").value = "freshwater";
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function editGroupStyle(): void {
  const g = (elSelected.node()!.parentNode as SVGGElement).id;
  editStyle("lakes", g);
}

function editLakeLegend(): void {
  const id = elSelected.attr("id");
  void Controllers.NotesEditor.open(id, `${getLake().name} ${ensureEl<HTMLSelectElement>("lakeGroup").value} lake`);
}

function closeLakesEditor(): void {
  debug.select("#vertices").remove();
  unselect();
  destroyDialogIfExists("lakeEditor");
}

export const LakesEditor = { open };
