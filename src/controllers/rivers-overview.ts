import { mean } from "d3";
import { Controllers } from "@/controllers";
import type { River } from "@/generators/river-generator";
import { ensureEl, rn } from "../utils";

const DIALOG_HTML = /* html */ `
  <div id="riversHeader" class="header" style="grid-template-columns: 9em 4em 7em 5em 5em 9em">
    <div data-tip="Click to sort by river name" class="sortable alphabetically" data-sortby="name">River&nbsp;</div>
    <div data-tip="Click to sort by river type name" class="sortable alphabetically" data-sortby="type">Type&nbsp;</div>
    <div data-tip="Click to sort by discharge (flux in m3/s)" class="sortable icon-sort-number-down" data-sortby="discharge">Discharge&nbsp;</div>
    <div data-tip="Click to sort by river length" class="sortable" data-sortby="length">Length&nbsp;</div>
    <div data-tip="Click to sort by river mouth width" class="sortable" data-sortby="width">Width&nbsp;</div>
    <div data-tip="Click to sort by river basin" class="sortable alphabetically" data-sortby="basin">Basin&nbsp;</div>
  </div>
  <div id="riversBody" class="table"></div>
  <div id="riversFooter" class="totalLine">
    <div data-tip="Rivers number" style="margin-left: 4px">Rivers:&nbsp;<span id="riversFooterNumber">0</span></div>
    <div data-tip="Average discharge" style="margin-left: 12px">Average discharge:&nbsp;<span id="riversFooterDischarge">0</span></div>
    <div data-tip="Average length" style="margin-left: 12px">Length:&nbsp;<span id="riversFooterLength">0</span></div>
    <div data-tip="Average mouth width" style="margin-left: 12px">Width:&nbsp;<span id="riversFooterWidth">0</span></div>
  </div>
  <div id="riversBottom">
    <button id="riversOverviewRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
    <button id="addNewRiver" data-tip="Automatically add river starting from clicked cell. Hold Shift to add multiple" class="icon-plus"></button>
    <button id="riverCreateNew" data-tip="Create a new river selecting river cells" class="icon-map-pin"></button>
    <button id="riversBasinHighlight" data-tip="Toggle basin highlight mode" class="icon-sitemap"></button>
    <button id="riversExport" data-tip="Save rivers-related data as a text file (.csv)" class="icon-download"></button>
    <button id="riversRemoveAll" data-tip="Remove all rivers" class="icon-trash"></button>
    <label for="riversSearch" data-tip="Filter by name, type or basin" style="margin-left: 0.2em">Search: <input id="riversSearch" type="search" /></label>
  </div>`;

function open(): void {
  if (customization) return;
  closeDialogs("#riversOverview, .stable");
  if (!layerIsOn("toggleRivers")) toggleRivers();

  ensureEl("riversOverview").innerHTML = DIALOG_HTML;
  riversOverviewAddLines();

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("riversOverviewRefresh").on("click", riversOverviewAddLines);
  ensureEl("addNewRiver").on("click", toggleAddRiver);
  ensureEl("riverCreateNew").on("click", createNewRiver);
  ensureEl("riversBasinHighlight").on("click", toggleBasinsHightlight);
  ensureEl("riversExport").on("click", downloadRiversData);
  ensureEl("riversRemoveAll").on("click", triggerAllRiversRemove);
  ensureEl("riversSearch").on("input", riversOverviewAddLines);

  $("#riversOverview").dialog({
    title: "Rivers Overview",
    resizable: false,
    width: fitContent(),
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" },
    close: closeRiversOverview
  });
}

function closeRiversOverview(): void {
  ensureEl("riversOverview").innerHTML = "";
}

function createNewRiver(): void {
  void Controllers.RiverCreator.open();
}

// add line for each river
function riversOverviewAddLines(): void {
  const body = ensureEl("riversBody");
  body.innerHTML = "";
  let lines = "";
  const unit = distanceUnitInput.value;

  // Precompute a lookup map from river id to river for efficient basin lookup
  const riversById = new Map<number, River>(pack.rivers.map((river: River) => [river.i, river]));

  let filteredRivers: River[] = pack.rivers;
  const searchText = ensureEl<HTMLInputElement>("riversSearch").value.toLowerCase().trim();
  if (searchText) {
    filteredRivers = filteredRivers.filter(r => {
      const name = (r.name || "").toLowerCase();
      const type = (r.type || "").toLowerCase();
      const basin = riversById.get(r.basin);
      const basinName = basin ? (basin.name || "").toLowerCase() : "";
      return name.includes(searchText) || type.includes(searchText) || basinName.includes(searchText);
    });
  }

  for (const r of filteredRivers) {
    const discharge = `${r.discharge} m³/s`;
    const length = `${rn(r.length * distanceScale)} ${unit}`;
    const width = `${rn(r.width * distanceScale, 3)} ${unit}`;
    const basin = riversById.get(r.basin)?.name;

    lines += /* html */ `<div
        class="states"
        data-id=${r.i}
        data-name="${r.name}"
        data-type="${r.type}"
        data-discharge="${r.discharge}"
        data-length="${r.length}"
        data-width="${r.width}"
        data-basin="${basin}"
      >
        <span data-tip="Locate the river" class="icon-target"></span>
        <div data-tip="River name" style="margin-left: 0.4em;" class="riverName">${r.name}</div>
        <div data-tip="River type name" class="riverType">${r.type}</div>
        <div data-tip="River discharge (flux power)" class="biomeArea">${discharge}</div>
        <div data-tip="River length from source to mouth" class="biomeArea">${length}</div>
        <div data-tip="River mouth width" class="biomeArea">${width}</div>
        <input data-tip="River basin (name of the main stem)" class="stateName" value="${basin}" disabled />
        <span data-tip="Edit river" class="icon-pencil"></span>
        <span data-tip="Remove river" class="icon-trash-empty"></span>
      </div>`;
  }
  body.insertAdjacentHTML("beforeend", lines);

  // update footer
  ensureEl("riversFooterNumber").innerHTML = `${filteredRivers.length} of ${pack.rivers.length}`;
  const averageDischarge = rn(mean(filteredRivers.map(r => r.discharge))!) || 0;
  ensureEl("riversFooterDischarge").innerHTML = `${averageDischarge} m³/s`;
  const averageLength = rn(mean(filteredRivers.map(r => r.length))!) || 0;
  ensureEl("riversFooterLength").innerHTML = `${averageLength * distanceScale} ${unit}`;
  const averageWidth = rn(mean(filteredRivers.map(r => r.width))!, 3) || 0;
  ensureEl("riversFooterWidth").innerHTML = `${rn(averageWidth * distanceScale, 3)} ${unit}`;

  // add listeners
  body.querySelectorAll("div.states").forEach(el => void el.on("mouseenter", (ev: Event) => riverHighlightOn(ev)));
  body.querySelectorAll("div.states").forEach(el => void el.on("mouseleave", (ev: Event) => riverHighlightOff(ev)));
  body.querySelectorAll("div > span.icon-target").forEach(el => void el.on("click", zoomToRiver));
  body.querySelectorAll("div > span.icon-pencil").forEach(el => void el.on("click", openRiverEditor));
  body.querySelectorAll("div > span.icon-trash-empty").forEach(el => void el.on("click", triggerRiverRemove));

  applySorting(ensureEl("riversHeader"));
}

function riverHighlightOn(event: Event): void {
  if (!layerIsOn("toggleRivers")) toggleRivers();
  const r = +(event.target as HTMLElement).dataset.id!;
  rivers.select(`#river${r}`).attr("stroke", "red").attr("stroke-width", 1);
}

function riverHighlightOff(e: Event): void {
  const r = +(e.target as HTMLElement).dataset.id!;
  rivers.select(`#river${r}`).attr("stroke", null).attr("stroke-width", null);
}

function zoomToRiver(this: HTMLElement): void {
  const r = +(this.parentNode as HTMLElement).dataset.id!;
  const river = rivers.select(`#river${r}`).node() as Element;
  highlightElement(river, 3);
}

function toggleBasinsHightlight(): void {
  if (rivers.attr("data-basin") === "hightlighted") {
    rivers.selectAll("*").attr("fill", null);
    rivers.attr("data-basin", null);
  } else {
    rivers.attr("data-basin", "hightlighted");
    const basins = [...new Set(pack.rivers.map((r: River) => r.basin))];
    const colors = [
      "#1f77b4",
      "#ff7f0e",
      "#2ca02c",
      "#d62728",
      "#9467bd",
      "#8c564b",
      "#e377c2",
      "#7f7f7f",
      "#bcbd22",
      "#17becf"
    ];

    basins.forEach((b, i) => {
      const color = colors[i % colors.length];
      pack.rivers
        .filter((r: River) => r.basin === b)
        .forEach((r: River) => {
          rivers.select(`#river${r.i}`).attr("fill", color);
        });
    });
  }
}

function downloadRiversData(): void {
  let data = "Id,River,Type,Discharge,Length,Width,Basin\n"; // headers

  ensureEl("riversBody")
    .querySelectorAll<HTMLElement>(":scope > div")
    .forEach(el => {
      const d = el.dataset;
      const discharge = `${d.discharge} m³/s`;
      const length = `${rn(+d.length! * distanceScale)} ${distanceUnitInput.value}`;
      const width = `${rn(+d.width! * distanceScale, 3)} ${distanceUnitInput.value}`;
      data += `${[d.id, d.name, d.type, discharge, length, width, d.basin].join(",")}\n`;
    });

  const name = `${getFileName("Rivers")}.csv`;
  downloadFile(data, name);
}

function openRiverEditor(this: HTMLElement): void {
  const id = `river${(this.parentNode as HTMLElement).dataset.id}`;
  void Controllers.RiverEditor.open(id);
}

function triggerRiverRemove(this: HTMLElement): void {
  const river = +(this.parentNode as HTMLElement).dataset.id!;
  alertMessage.innerHTML = /* html */ `Are you sure you want to remove the river? All tributaries will be auto-removed`;

  $("#alert").dialog({
    resizable: false,
    width: "22em",
    title: "Remove river",
    buttons: {
      Remove: function (this: any) {
        Rivers.remove(river);
        riversOverviewAddLines();
        $(this).dialog("close");
      },
      Cancel: function (this: any) {
        $(this).dialog("close");
      }
    }
  });
}

function triggerAllRiversRemove(): void {
  alertMessage.innerHTML = /* html */ `Are you sure you want to remove all rivers?`;
  $("#alert").dialog({
    resizable: false,
    title: "Remove all rivers",
    buttons: {
      Remove: function (this: any) {
        $(this).dialog("close");
        removeAllRivers();
      },
      Cancel: function (this: any) {
        $(this).dialog("close");
      }
    }
  });
}

function removeAllRivers(): void {
  pack.rivers = [];
  pack.cells.r = new Uint16Array(pack.cells.i.length);
  rivers.selectAll("*").remove();
  riversOverviewAddLines();
}

export const RiversOverview = { open };
