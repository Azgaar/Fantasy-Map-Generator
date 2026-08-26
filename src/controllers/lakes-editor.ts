import { drag, mean, min, polygonLength, type Selection, select } from "d3";
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { Coastline } from "@/generators/coastline-generator";
import type { Feature } from "@/generators/features";
import { GraphOverride } from "@/generators/graph-override";
import { getArea, getAreaUnit, speak } from "@/utils";
import { ensureEl, findEl, rand, rn, si, unique } from "../utils";
import { getHeight } from "../utils/unitUtils";

let selectedLake: Selection<SVGElement, unknown, HTMLElement, unknown>;

function open(element: SVGElement): void {
  if (customization) return;
  closeDialogs(".stable");
  Layers.hide("cells");

  renderDialog();

  select("#debug").append("g").attr("id", "vertices");
  selectedLake = select<SVGElement, unknown>(element) as unknown as typeof selectedLake;
  updateLakeValues();
  selectLakeGroup();
  drawLakeVertices();
  select<SVGElement, unknown>("#viewbox").on("touchmove mousemove", null);

  $("#lakeEditor").dialog({
    title: "Edit Lake",
    resizable: false,
    position: { my: "center top+20", at: "top", of: "svg", collision: "fit" },
    close: closeLakesEditor
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
  const lakeId = +selectedLake.attr("data-f");
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
  select("#debug")
    .select("#vertices")
    .selectAll<SVGPolygonElement, number>("polygon")
    .data(neibCells)
    .enter()
    .append("polygon")
    .attr("points", (d: number) => String(Pack.getPolygon(d)))
    .attr("data-c", (d: number) => d);

  select<SVGGElement, unknown>("#debug")
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

  GraphOverride.movePackVertex(vertexId, [x, y]);

  const feature = getLake();

  // update lake path
  select<SVGElement, unknown>("#deftemp")
    .select(`#featurePaths > path#feature_${feature.i}`)
    .attr("d", Coastline.getFeaturePath(feature));
  ensureEl<HTMLInputElement>("lakeArea").value = `${si(getArea(feature.area))} ${getAreaUnit()}`;

  // update cell
  select("#debug")
    .select("#vertices")
    .selectAll<SVGPolygonElement, number>("polygon")
    .attr("points", d => String(Pack.getPolygon(d)));
}

function handleVertexDragEnd(): void {
  Layers.draw("states", "provinces", "borders", "biomes", "religions", "cultures");
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

const isLakeType = (group: string) => Layers.get("lakes").children.some(child => child.id === group);
function assignGroup(elements: Element[], group: string): void {
  for (const element of elements) {
    const feature = pack.features[+(element.getAttribute("data-f") || 0)];
    if (!feature) continue;
    if (isLakeType(group)) feature.subtype = group; // a default group is the lake subtype as well
    feature.group = group;
  }
}

function selectLakeGroup(): void {
  const lake = getLake();
  const currentGroup = lake.group;

  const groupSelect = ensureEl<HTMLSelectElement>("lakeGroup");
  groupSelect.options.length = 0; // remove all options
  select<SVGGElement, unknown>("#lakes")
    .selectAll<SVGGElement, unknown>("g")
    .each(function () {
      groupSelect.options.add(new Option(this.id, this.id, false, this.id === currentGroup));
    });
}

function changeLakeGroup(this: HTMLSelectElement): void {
  ensureEl(this.value).appendChild(selectedLake.node()!);
  assignGroup([selectedLake.node()!], this.value);
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
  const oldGroup = selectedLake.node()!.parentNode as SVGGElement;
  const basic = isLakeType(oldGroup.id);
  if (!basic && oldGroup.childElementCount === 1) {
    ensureEl<HTMLSelectElement>("lakeGroup").selectedOptions[0].remove();
    ensureEl<HTMLSelectElement>("lakeGroup").options.add(new Option(group, group, false, true));
    oldGroup.id = group;
    assignGroup(Array.from(oldGroup.children), group);
    toggleNewGroupInput();
    ensureEl<HTMLInputElement>("lakeGroupName").value = "";
    return;
  }

  // create a new group
  const newGroup = (selectedLake.node()!.parentNode as SVGGElement).cloneNode(false) as SVGGElement;
  ensureEl("lakes").appendChild(newGroup);
  newGroup.id = group;
  ensureEl<HTMLSelectElement>("lakeGroup").options.add(new Option(group, group, false, true));
  ensureEl(group).appendChild(selectedLake.node()!);
  assignGroup([selectedLake.node()!], group);

  toggleNewGroupInput();
  ensureEl<HTMLInputElement>("lakeGroupName").value = "";
}

function removeLakeGroup(): void {
  const group = (selectedLake.node()!.parentNode as SVGGElement).id;
  if (isLakeType(group)) {
    tip("This is one of the default groups, it cannot be removed", false, "error");
    return;
  }

  const count = (selectedLake.node()!.parentNode as SVGGElement).childElementCount;
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
        assignGroup(Array.from(groupEl.children), "freshwater");
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
  const g = (selectedLake.node()!.parentNode as SVGGElement).id;
  editStyle("lakes", g);
}

function editLakeLegend(): void {
  const id = selectedLake.attr("id");
  void Controllers.NotesEditor.open(id, `${getLake().name} ${ensureEl<HTMLSelectElement>("lakeGroup").value} lake`);
}

function closeLakesEditor(): void {
  select("#debug").select("#vertices").remove();
  applyDefaultViewboxEvents();
  destroyDialog("lakeEditor");
}

export const LakesEditor = { open };
