import { pointer, select, sum } from "d3";
import { Controllers } from "@/controllers";
import type { Regiment } from "../generators/military-generator";
import { capitalize, ensureEl, last, si } from "../utils";

let isInitialized = false;

function open(state = -1): void {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleMilitary")) toggleMilitary();

  const body = ensureEl("regimentsBody");
  updateFilter(state);
  refreshRegimentsOverview();
  $("#regimentsOverview").dialog();

  if (!isInitialized) {
    updateHeaders();

    $("#regimentsOverview").dialog({
      title: "Regiments Overview",
      resizable: false,
      width: fitContent(),
      position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
    });

    // add listeners
    ensureEl("regimentsOverviewRefresh").on("click", refreshRegimentsOverview);
    ensureEl("regimentsPercentage").on("click", togglePercentageMode);
    ensureEl("regimentsAddNew").on("click", toggleAdd);
    ensureEl("regimentsExport").on("click", downloadRegimentsData);
    ensureEl("regimentsFilter").on("change", refreshRegimentsOverview);

    body.on("click", async event => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-edit-regiment]");
      if (!target) return;
      Controllers.RegimentEditor.open(`#${target.dataset.editRegiment}`);
    });

    isInitialized = true;
  }
}

// update military types in header and tooltips
function updateHeaders(): void {
  const header = ensureEl("regimentsHeader");
  const units = options.military.length;
  header.style.gridTemplateColumns = `9em 13em repeat(${units}, 5.2em) 7em`;

  header.querySelectorAll(".removable").forEach(el => {
    el.remove();
  });
  const insert = (html: string) => ensureEl("regimentsTotal").insertAdjacentHTML("beforebegin", html);
  for (const u of options.military) {
    const label = capitalize(u.name.replace(/_/g, " "));
    insert(
      `<div data-tip="Regiment ${u.name} units number. Click to sort" class="sortable removable" data-sortby="${u.name}">${label}&nbsp;</div>`
    );
  }
  header.querySelectorAll<HTMLElement>(".removable").forEach(el => {
    el.on("click", () => sortLines(el));
  });
}

// add line for each state
function refreshRegimentsOverview(): void {
  const body = ensureEl("regimentsBody");
  const state = +ensureEl<HTMLSelectElement>("regimentsFilter").value;
  body.innerHTML = "";
  let lines = "";
  const regiments: Regiment[] = [];

  for (const s of pack.states) {
    if (!s.i || s.removed || !s.military?.length) continue;
    if (state !== -1 && s.i !== state) continue; // specific state is selected

    for (const r of s.military) {
      const sortData = options.military.map(u => `data-${u.name}=${r.u[u.name] || 0}`).join(" ");
      const lineData = options.military
        .map(u => `<div data-type="${u.name}" data-tip="${capitalize(u.name)} units number">${r.u[u.name] || 0}</div>`)
        .join(" ");

      lines += /* html */ `<div class="states" data-id="${r.i}" data-s="${s.i}" data-state="${s.name}" data-name="${
        r.name
      }" ${sortData} data-total="${r.a}">
          <fill-box data-tip="${s.fullName}" fill="${s.color}" disabled></fill-box>
          <input data-tip="${s.fullName}" style="width:6em" value="${s.name}" readonly />
          ${
            r.icon!.startsWith("http") || r.icon!.startsWith("data:image")
              ? `<img src="${r.icon}" data-tip="Regiment's emblem" style="width:1.2em; height:1.2em; vertical-align: middle;">`
              : `<span data-tip="Regiment's emblem" style="width:1em">${r.icon}</span>`
          }
          <input data-tip="Regiment's name" style="width:13em" value="${r.name}" readonly />
          ${lineData}
          <div data-type="total" data-tip="Total military personnel (not considering crew)" style="font-weight: bold">${
            r.a
          }</div>
          <span data-tip="Edit regiment" data-edit-regiment="regiment${s.i}-${r.i}" class="icon-pencil pointer"></span>
        </div>`;

      regiments.push(r);
    }
  }

  lines += /* html */ `<div id="regimentsTotalLine" class="totalLine" data-tip="Total of all displayed regiments">
      <div style="width: 21em; margin-left: 1em">Regiments: ${regiments.length}</div>
      ${options.military
        .map(u => `<div style="width:5em">${si(sum(regiments.map(r => r.u[u.name] || 0)))}</div>`)
        .join(" ")}
      <div style="width:5em">${si(sum(regiments.map(r => r.a)))}</div>
    </div>`;

  body.insertAdjacentHTML("beforeend", lines);
  if (body.dataset.type === "percentage") {
    body.dataset.type = "absolute";
    togglePercentageMode();
  }
  applySorting(ensureEl("regimentsHeader"));

  // add listeners
  body.querySelectorAll<HTMLElement>("div.states").forEach(el => {
    el.on("mouseenter", event => regimentHighlightOn(event));
  });
  body.querySelectorAll<HTMLElement>("div.states").forEach(el => {
    el.on("mouseleave", event => regimentHighlightOff(event));
  });
}

function updateFilter(state: number): void {
  const filter = ensureEl<HTMLSelectElement>("regimentsFilter");
  filter.options.length = 0; // remove all options
  filter.options.add(new Option("all", "-1", false, state === -1));
  const statesSorted = pack.states.filter(s => s.i && !s.removed).sort((a, b) => (a.name! > b.name! ? 1 : -1));
  statesSorted.forEach(s => {
    filter.options.add(new Option(s.name, String(s.i), false, s.i === state));
  });
}

function regimentHighlightOn(event: Event): void {
  const target = event.target as HTMLElement;
  const state = +target.dataset.s!;
  const id = +target.dataset.id!;
  if (customization || !state) return;
  select<SVGGElement, unknown>(`#armies > g > g#regiment${state}-${id}`)
    .transition()
    .duration(2000)
    .style("fill", "#ff0000");
}

function regimentHighlightOff(event: Event): void {
  const target = event.target as HTMLElement;
  const state = +target.dataset.s!;
  const id = +target.dataset.id!;
  select<SVGGElement, unknown>(`#armies > g > g#regiment${state}-${id}`)
    .transition()
    .duration(1000)
    .style("fill", null);
}

function togglePercentageMode(): void {
  const body = ensureEl("regimentsBody");
  if (body.dataset.type === "absolute") {
    body.dataset.type = "percentage";
    const lines = body.querySelectorAll<HTMLElement>(":scope > div:not(.totalLine)");
    const array = Array.from(lines);
    const cache: Record<string, number> = {};

    const total = (type: string): number => {
      if (cache[type]) return cache[type];
      cache[type] = sum(array.map(el => +(el.dataset[type] || 0)));
      return cache[type];
    };

    lines.forEach(el => {
      el.querySelectorAll<HTMLElement>("div").forEach(div => {
        const type = div.dataset.type!;
        if (type === "rate") return;
        const elTotal = total(type);
        div.textContent = elTotal ? `${Math.round((+(el.dataset[type] || 0) / elTotal) * 100)}%` : "0%";
      });
    });
  } else {
    body.dataset.type = "absolute";
    refreshRegimentsOverview();
  }
}

function toggleAdd(): void {
  const button = ensureEl("regimentsAddNew");
  button.classList.toggle("pressed");
  if (button.classList.contains("pressed")) {
    select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addRegimentOnClick);
    tip("Click on map to create new regiment or fleet", true);
    const regimentAdd = document.getElementById("regimentAdd");
    if (regimentAdd?.offsetParent) regimentAdd.classList.add("pressed");
  } else {
    clearMainTip();
    // `clicked` is unported classic code that reads the legacy `d3.event` global, so this one
    // rebind must go through the classic v5 `viewbox` selection, not a fresh v7 one
    viewbox.on("click", clicked).style("cursor", "default");
    refreshRegimentsOverview();
    const regimentAdd = document.getElementById("regimentAdd");
    if (regimentAdd?.offsetParent) regimentAdd.classList.remove("pressed");
  }
}

function addRegimentOnClick(this: SVGGElement, event: MouseEvent): void {
  const state = +ensureEl<HTMLSelectElement>("regimentsFilter").value;
  if (state === -1) {
    tip("Please select state from the list", false, "error");
    return;
  }

  const point = pointer(event, this);
  const cell = findCell(point[0], point[1]);
  if (cell === undefined) return;
  const x = pack.cells.p[cell][0];
  const y = pack.cells.p[cell][1];
  const military = pack.states[state].military!;
  const i = military.length ? last(military).i + 1 : 0;
  const n = +(pack.cells.h[cell] < 20); // naval or land
  const reg: Regiment = {
    a: 0,
    cell,
    i,
    n,
    u: {},
    x,
    y,
    bx: x,
    by: y,
    state,
    icon: "🛡️",
    name: "",
    t: 0,
    s: 0,
    type: ""
  };
  reg.name = Military.getName(reg, military);
  military.push(reg);
  Military.generateNote(reg, pack.states[state]); // add legend
  drawRegiment(reg, state);
  toggleAdd();
}

function downloadRegimentsData(): void {
  const units = options.military.map(u => u.name);
  let data = `State,Id,Icon,Name,${units.map(u => capitalize(u)).join(",")},X,Y,Latitude,Longitude,Base X,Base Y,Base Latitude,Base Longitude\n`; // headers

  for (const s of pack.states) {
    if (!s.i || s.removed || !s.military?.length) continue;

    for (const r of s.military) {
      data += `${s.name},`;
      data += `${r.i},`;
      data += `${r.icon},`;
      data += `${r.name},`;
      data += `${units.map(unit => r.u[unit]).join(",")},`;

      data += `${r.x},`;
      data += `${r.y},`;
      data += `${getLatitude(r.y, 2)},`;
      data += `${getLongitude(r.x, 2)},`;

      data += `${r.bx},`;
      data += `${r.by},`;
      data += `${getLatitude(r.by, 2)},`;
      data += `${getLongitude(r.bx, 2)}\n`;
    }
  }

  const name = `${getFileName("Regiments")}.csv`;
  downloadFile(data, name);
}

export const RegimentsOverview = { open, refresh: refreshRegimentsOverview };
