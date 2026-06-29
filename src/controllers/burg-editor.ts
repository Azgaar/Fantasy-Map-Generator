import { drag, pointer, type Selection, select } from "d3";
import { Controllers } from "@/controllers";
import type { Burg } from "../generators/burgs-generator";
import { convertTemperature, ensureEl, getTemperatureLikeness, parseTransform, rand, rn } from "../utils";
import type { PromptOptions } from "../utils/commonUtils";

declare const showBurgTemperatureGraph: (id: string) => void;
declare const prompt: (text: string, options: PromptOptions, callback: (value: string | number) => void) => void;

let isInitialized = false;
let selected: Selection<any, any, any, any> | null = null;

function open(id: number | string): void {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleBurgIcons")) toggleBurgIcons();
  if (!layerIsOn("toggleLabels")) toggleLabels();

  selected = select<any, unknown>("#burgLabels").select(`[data-id='${id}']`);
  if (!selected.size()) selected = select<any, unknown>("#burgIcons").select(`[data-id='${id}']`);

  select<SVGTextElement, unknown>("#burgLabels")
    .selectAll<SVGTextElement, unknown>("text")
    .call(drag<SVGTextElement, unknown>().on("start", dragBurgLabel))
    .classed("draggable", true);
  updateGroupsList();
  updateBurgValues();

  $("#burgEditor").dialog({
    title: "Edit Burg",
    resizable: false,
    close: closeBurgEditor,
    position: { my: "left top", at: "left+10 top+10", of: "svg", collision: "fit" }
  });

  if (isInitialized) return;
  isInitialized = true;

  // add listeners
  ensureEl("burgName").on("input", changeName);
  ensureEl("burgNameReRandom").on("click", generateNameRandom);
  ensureEl("burgGroup").on("change", changeGroup);
  ensureEl("burgGroupConfigure").on("click", editBurgGroups);
  ensureEl("burgType").on("change", changeType);
  ensureEl("burgCulture").on("change", changeCulture);
  ensureEl("burgNameReCulture").on("click", generateNameCulture);
  ensureEl("burgPopulation").on("change", changePopulation);
  ensureEl("burgBody")
    .querySelectorAll<HTMLElement>(".burgFeature")
    .forEach(el => void el.on("click", toggleFeature));
  ensureEl("burgLinkOpen").on("click", openBurgLink);

  ensureEl("burgStyleShow").on("click", showStyleSection);
  ensureEl("burgStyleHide").on("click", hideStyleSection);
  ensureEl("burgEditLabelStyle").on("click", editGroupLabelStyle);
  ensureEl("burgEditIconStyle").on("click", editGroupIconStyle);
  ensureEl("burgEditAnchorStyle").on("click", editGroupAnchorStyle);

  ensureEl("burgEmblem").on("click", openEmblemEdit);
  ensureEl("burgSetPreviewLink").on("click", setCustomPreview);
  ensureEl("burgEditEmblem").on("click", openEmblemEdit);
  ensureEl("burgLocate").on("click", zoomIntoBurg);
  ensureEl("burgRelocate").on("click", toggleRelocateBurg);
  ensureEl("burglLegend").on("click", editBurgLegend);
  ensureEl("burgLock").on("click", toggleBurgLockButton);
  ensureEl("burgRemove").on("click", removeSelectedBurg);
  ensureEl("burgTemperatureGraph").on("click", showTemperatureGraph);
  ensureEl("burgProductionOverview").on("click", showProductionOverview);
}

function getSelectedId(): number {
  return +selected!.attr("data-id");
}

function updateGroupsList(): void {
  const groupSelect = ensureEl<HTMLSelectElement>("burgGroup");
  groupSelect.options.length = 0; // remove all options
  for (const { name } of options.burgs.groups) {
    groupSelect.options.add(new Option(name, name));
  }
}

function updateBurgValues(): void {
  const id = getSelectedId();
  const b = pack.burgs[id];
  const province = pack.cells.province[b.cell];
  const provinceName = province ? `${pack.provinces[province].fullName}, ` : "";
  const stateName = pack.states[b.state!].fullName || pack.states[b.state!].name;
  ensureEl("burgProvinceAndState").innerHTML = provinceName + stateName;

  ensureEl<HTMLInputElement>("burgName").value = b.name!;
  ensureEl<HTMLSelectElement>("burgGroup").value = b.group!;
  ensureEl<HTMLSelectElement>("burgType").value = b.type || "Generic";
  ensureEl<HTMLInputElement>("burgPopulation").value = String(rn(b.population! * populationRate * urbanization));
  ensureEl("burgWealth").innerHTML = `🟡 ${rn(b.population! > 0 ? (b.product || 0) / b.population! : 0, 2)}`;
  ensureEl("burgTreasury").innerHTML = `🟡 ${rn(b.treasury || 0, 2)}`;
  ensureEl("burgEditAnchorStyle").style.display = +b.port! ? "inline-block" : "none";

  // update list and select culture
  const cultureSelect = ensureEl<HTMLSelectElement>("burgCulture");
  cultureSelect.options.length = 0;
  const cultures = pack.cultures.filter(c => !c.removed);
  cultures.forEach(c => void cultureSelect.options.add(new Option(c.name, String(c.i), false, c.i === b.culture)));

  const temperature = grid.cells.temp[pack.cells.g[b.cell]];
  ensureEl("burgTemperature").innerHTML = convertTemperature(temperature);
  ensureEl("burgTemperatureLikeIn").dataset.tip =
    `Average yearly temperature is like in ${getTemperatureLikeness(temperature)}`;
  ensureEl("burgElevation").innerHTML = getHeight(pack.cells.h[b.cell]);

  ensureEl("burgCapital").classList.toggle("inactive", !b.capital);
  ensureEl("burgPort").classList.toggle("inactive", !b.port);
  ensureEl("burgCitadel").classList.toggle("inactive", !b.citadel);
  ensureEl("burgWalls").classList.toggle("inactive", !b.walls);
  ensureEl("burgPlaza").classList.toggle("inactive", !b.plaza);
  ensureEl("burgTemple").classList.toggle("inactive", !b.temple);
  ensureEl("burgShanty").classList.toggle("inactive", !b.shanty);
  ensureEl("burgProduction").innerHTML = getProduction(Production.getBurgProduction(b));

  updateBurgLockIcon();

  // set emblem image
  const coaID = `burgCOA${id}`;
  COArenderer.trigger(coaID, b.coa);
  ensureEl("burgEmblem").setAttribute("href", `#${coaID}`);

  updateBurgPreview(b);
}

function dragBurgLabel(this: SVGTextElement, event: any): void {
  const tr = parseTransform(this.getAttribute("transform")!);
  const dx = +tr[0] - event.x;
  const dy = +tr[1] - event.y;

  event.on("drag", function (this: SVGTextElement, dragEvent: any) {
    const { x, y } = dragEvent;
    this.setAttribute("transform", `translate(${dx + x},${dy + y})`);
    tip('Use dragging for fine-tuning only, to actually move burg use "Relocate" button', false, "warn");
  });
}

function changeName(): void {
  const id = getSelectedId();
  const value = ensureEl<HTMLInputElement>("burgName").value;
  pack.burgs[id].name = value;
  selected!.text(value);
}

function generateNameRandom(): void {
  const base = rand(nameBases.length - 1);
  ensureEl<HTMLInputElement>("burgName").value = Names.getBase(base);
  changeName();
}

function changeGroup(this: HTMLSelectElement): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];
  Burgs.changeGroup(burg, this.value);
}

function changeType(this: HTMLSelectElement): void {
  const id = getSelectedId();
  pack.burgs[id].type = this.value as Burg["type"];
}

function changeCulture(this: HTMLSelectElement): void {
  const id = getSelectedId();
  pack.burgs[id].culture = +this.value;
}

function generateNameCulture(): void {
  const id = getSelectedId();
  const culture = pack.burgs[id].culture!;
  ensureEl<HTMLInputElement>("burgName").value = Names.getCulture(culture);
  changeName();
}

function changePopulation(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];

  pack.burgs[id].population = rn(
    ensureEl<HTMLInputElement>("burgPopulation").valueAsNumber / populationRate / urbanization,
    4
  );
  updateBurgPreview(burg);
}

function toggleFeature(this: HTMLElement): void {
  const burgId = getSelectedId();
  const burg = pack.burgs[burgId];

  const feature = this.dataset.feature!;
  const value = Number(this.classList.contains("inactive"));

  if (feature === "port") togglePort(burgId);
  else if (feature === "capital") toggleCapital(burgId);
  else (burg as any)[feature] = value;

  this.classList.toggle("inactive", !(burg as any)[feature]);

  ensureEl("burgEditAnchorStyle").style.display = burg.port ? "inline-block" : "none";
  updateBurgPreview(burg);
}

function togglePort(burgId: number): void {
  const burg = pack.burgs[burgId];
  if (burg.port) {
    burg.port = 0;

    const anchor = document.querySelector(`#anchors [data-id='${burgId}']`);
    if (anchor) anchor.remove();
  } else {
    const { cells, features } = pack;
    const haven = cells.haven[burg.cell];
    let portFeatureId: number | null;

    if (haven) {
      const featureId = cells.f[haven];
      const feature = features[featureId];
      portFeatureId =
        feature?.type === "lake" && feature.outlet
          ? (Rivers.resolveLakeDrainFeature(featureId) ?? featureId)
          : featureId;
    } else {
      portFeatureId = Rivers.resolveDrainFeature(burg.cell);
      if (!portFeatureId) {
        tip("No navigable water body found downstream, cannot assign port", false, "warn");
        return;
      }
    }

    burg.port = portFeatureId;

    anchors
      .select(`#${burg.group}`)
      .append("use")
      .attr("href", "#icon-anchor")
      .attr("id", `anchor${burg.i}`)
      .attr("data-id", burg.i)
      .attr("x", burg.x)
      .attr("y", burg.y);
  }
}

function toggleCapital(burgId: number): void {
  const { burgs, states } = pack;

  if (burgs[burgId].capital) {
    tip("To change capital please assign a capital status to another burg of this state", false, "error");
    return;
  }

  const stateId = burgs[burgId].state;
  if (!stateId) {
    tip("Neutral lands cannot have a capital", false, "error");
    return;
  }

  const oldCapitalId = states[stateId].capital;
  states[stateId].capital = burgId;
  states[stateId].center = burgs[burgId].cell;

  const capital = burgs[burgId];
  capital.capital = 1;
  Burgs.changeGroup(capital);

  const oldCapital = burgs[oldCapitalId];
  oldCapital.capital = 0;
  Burgs.changeGroup(oldCapital);
}

function toggleBurgLockButton(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];
  burg.lock = !burg.lock;

  updateBurgLockIcon();
}

function updateBurgLockIcon(): void {
  const id = getSelectedId();
  const b = pack.burgs[id];
  if (b.lock) {
    ensureEl("burgLock").classList.remove("icon-lock-open");
    ensureEl("burgLock").classList.add("icon-lock");
  } else {
    ensureEl("burgLock").classList.remove("icon-lock");
    ensureEl("burgLock").classList.add("icon-lock-open");
  }
}

function showStyleSection(): void {
  document.querySelectorAll<HTMLElement>("#burgBottom > button").forEach(el => {
    el.style.display = "none";
  });
  ensureEl("burgStyleSection").style.display = "inline-block";
}

function hideStyleSection(): void {
  document.querySelectorAll<HTMLElement>("#burgBottom > button").forEach(el => {
    el.style.display = "inline-block";
  });
  ensureEl("burgStyleSection").style.display = "none";
}

function editGroupLabelStyle(): void {
  const g = (selected!.node() as Element).parentNode as HTMLElement;
  closeDialogs(".stable");
  editStyle("labels", g.id);
}

function editGroupIconStyle(): void {
  const g = (selected!.node() as Element).parentNode as HTMLElement;
  closeDialogs(".stable");
  editStyle("burgIcons", g.id);
}

function editGroupAnchorStyle(): void {
  const g = (selected!.node() as Element).parentNode as HTMLElement;
  closeDialogs(".stable");
  editStyle("anchors", g.id);
}

function updateBurgPreview(burg: Burg): void {
  const preview = Burgs.getPreview(burg).preview;
  if (!preview) {
    ensureEl("burgPreviewSection").style.display = "none";
    return;
  }

  ensureEl("burgPreviewSection").style.display = "block";

  // recreate object to force reload (Chrome bug)
  const container = ensureEl("burgPreviewObject");
  container.innerHTML = "";
  const object = document.createElement("object");
  object.style.width = "100%";
  object.style.maxWidth = "60vw";
  object.style.maxHeight = "60vh";
  object.data = preview;
  container.insertBefore(object, null);
}

function openBurgLink(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];
  const link = Burgs.getPreview(burg).link;
  if (link) openURL(link);
}

function setCustomPreview(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];

  prompt(
    "Provide custom URL to the burg map. It can be a link to a generator or just an image. Leave empty to use the default map preview",
    { default: Burgs.getPreview(burg).link || "", required: false },
    link => {
      if (link) burg.link = String(link);
      else delete burg.link;
      updateBurgPreview(burg);
    }
  );
}

function openEmblemEdit(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];
  editEmblem("burg", `burgCOA${id}`, burg);
}

function zoomIntoBurg(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];
  zoomTo(burg.x, burg.y, 8, 2000);
}

function toggleRelocateBurg(): void {
  const toggler = ensureEl("toggleCells");
  ensureEl("burgRelocate").classList.toggle("pressed");
  if (ensureEl("burgRelocate").classList.contains("pressed")) {
    select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", relocateBurgOnClick);
    tip("Click on map to relocate burg. Hold Shift for continuous move", true);
    if (!layerIsOn("toggleCells")) {
      toggleCells();
      toggler.dataset.forced = "true";
    }
  } else {
    clearMainTip();
    restoreDefaultEvents();
    if (layerIsOn("toggleCells") && toggler.dataset.forced) {
      toggleCells();
      toggler.dataset.forced = "false";
    }
  }
}

function relocateBurgOnClick(this: SVGGElement, event: any): void {
  const cells = pack.cells;
  const point = pointer(event, this);
  const cellId = findCell(point[0], point[1])!;
  const id = getSelectedId();
  const burg = pack.burgs[id];

  if (cells.h[cellId] < 20) {
    tip("Cannot place burg into the water! Select a land cell", false, "error");
    return;
  }
  if (cells.burg[cellId] && cells.burg[cellId] !== id) {
    tip("There is already a burg in this cell. Please select a free cell", false, "error");
    return;
  }

  const newState = cells.state[cellId];
  const oldState = burg.state;
  if (newState !== oldState && burg.capital) {
    tip("Capital cannot be relocated into another state!", false, "error");
    return;
  }

  // change UI
  const x = rn(point[0], 2);
  const y = rn(point[1], 2);

  burgIcons.select(`#burg${id}`).attr("x", x).attr("y", y);
  burgLabels.select(`#burgLabel${id}`).attr("transform", null).attr("x", x).attr("y", y);

  const anchor = anchors.select(`use[data-id='${id}']`);
  if (anchor.size()) {
    const size = +anchor.attr("width");
    const xa = rn(x - size * 0.47, 2);
    const ya = rn(y - size * 0.47, 2);
    anchor.attr("transform", null).attr("x", xa).attr("y", ya);
  }

  // change data
  cells.burg[burg.cell] = 0;
  cells.burg[cellId] = id;
  burg.cell = cellId;
  burg.state = newState;
  burg.x = x;
  burg.y = y;
  if (burg.capital) pack.states[newState].center = burg.cell;

  if (event.shiftKey === false) toggleRelocateBurg();
}

function editBurgLegend(): void {
  const id = selected!.attr("data-id");
  const name = selected!.text();
  editNotes(`burg${id}`, name);
}

function showTemperatureGraph(): void {
  const id = selected!.attr("data-id");
  showBurgTemperatureGraph(id);
}

function showProductionOverview(): void {
  const id = getSelectedId();
  Controllers.ProductionOverview.open(id);
}

function removeSelectedBurg(): void {
  const burgId = getSelectedId();
  const burg = pack.burgs[burgId];

  if (burg.capital) {
    alertMessage.innerHTML = /* html */ `You cannot remove the capital. You must change the state capital first`;
    $("#alert").dialog({
      resizable: false,
      title: "Remove burg",
      buttons: {
        Ok: function (this: HTMLElement) {
          $(this).dialog("close");
        }
      }
    });
  } else if (pack.markets?.some(m => m.centerBurgId === burgId)) {
    alertMessage.innerHTML = /* html */ `You cannot remove a market center burg. Please remove the market first`;
    $("#alert").dialog({
      resizable: false,
      title: "Remove burg",
      buttons: {
        Ok: function (this: HTMLElement) {
          $(this).dialog("close");
        }
      }
    });
  } else {
    confirmationDialog({
      title: "Remove burg",
      message: "Are you sure you want to remove the burg? <br>This action cannot be reverted",
      confirm: "Remove",
      onConfirm: () => {
        Burgs.remove(burgId);
        $("#burgEditor").dialog("close");
      }
    });
  }
}

function editBurgGroups(): void {
  Controllers.BurgGroupEditor.open();
}

function closeBurgEditor(): void {
  ensureEl("burgRelocate").classList.remove("pressed");
  select<SVGTextElement, unknown>("#burgLabels")
    .selectAll<SVGTextElement, unknown>("text")
    .call(drag<SVGTextElement, unknown>().on("drag", null))
    .classed("draggable", false);
  unselect();
}

function getProduction(pool: Record<number, number>): string {
  if (!pool) return "";
  let html = "";
  const sorted = Object.entries(pool).sort(([, a], [, b]) => b - a);
  for (const [resourceId, production] of sorted) {
    const resource = Goods.get(+resourceId);
    if (!resource) continue;
    const { name, unit, icon } = resource;
    const unitName = production === 1 ? unit : `${unit}s`;
    html += `<span data-tip="${name}: ${production} ${unitName} per day">
      <svg class="resIcon" width="1em" height="1em"><use href="#${icon}"></use></svg>
      <span style="margin: 0 0.2em 0 -0.2em">${production}</span>
    </span>`;
  }
  return html;
}

export const BurgEditor = { open };
