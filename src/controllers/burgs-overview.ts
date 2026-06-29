import { pack as packLayout, pointer, select, stratify } from "d3";
import { Controllers } from "@/controllers";
import { convertTemperature, ensureEl, getTemperatureLikeness, rn, si } from "../utils";

let isInitialized = false;

function overviewBurgs(
  settings: { stateId?: number | null; cultureId?: number | null } = { stateId: null, cultureId: null }
): void {
  if (customization) return;
  closeDialogs("#burgsOverview, .stable");
  if (!layerIsOn("toggleBurgIcons")) toggleBurgIcons();
  if (!layerIsOn("toggleLabels")) toggleLabels();

  updateFilter(settings);
  updateLockAllIcon();
  burgsOverviewAddLines();
  $("#burgsOverview").dialog();

  if (isInitialized) return;
  isInitialized = true;

  $("#burgsOverview").dialog({
    title: "Burgs Overview",
    resizable: false,
    width: fitContent(),
    close: exitAddBurgMode,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });

  // add listeners
  ensureEl("burgsOverviewRefresh").addEventListener("click", refreshBurgsEditor);
  ensureEl("burgsGroupsEditorButton").addEventListener("click", editBurgGroups);
  ensureEl("burgsChart").addEventListener("click", showBurgsChart);
  ensureEl("burgsFilterState").addEventListener("change", burgsOverviewAddLines);
  ensureEl("burgsFilterCulture").addEventListener("change", burgsOverviewAddLines);
  ensureEl("burgsSearch").addEventListener("input", burgsOverviewAddLines);
  ensureEl("regenerateBurgNames").addEventListener("click", regenerateNames);
  ensureEl("addNewBurg").addEventListener("click", enterAddBurgMode);
  ensureEl("burgsExport").addEventListener("click", downloadBurgsData);
  ensureEl("burgNamesImport").addEventListener("click", renameBurgsInBulk);
  ensureEl("burgsListToLoad").addEventListener("change", function (this: HTMLInputElement) {
    uploadFile(this, importBurgNames);
  });
  ensureEl("burgsLockAll").addEventListener("click", toggleLockAll);
  ensureEl("burgsRemoveAll").addEventListener("click", triggerAllBurgsRemove);
}

function refreshBurgsEditor(): void {
  updateFilter();
  burgsOverviewAddLines();
}

function updateFilter(settings: { stateId?: number | null; cultureId?: number | null } = {}): void {
  const stateFilter = ensureEl<HTMLSelectElement>("burgsFilterState");
  const selectedState = settings.stateId != null ? settings.stateId : +stateFilter.value || -1;
  stateFilter.options.length = 0; // remove all options
  stateFilter.options.add(new Option("all", "-1", false, selectedState === -1));
  stateFilter.options.add(new Option(pack.states[0].name, "0", false, selectedState === 0));
  const statesSorted = pack.states.filter(s => s.i && !s.removed).sort((a, b) => (a.name > b.name ? 1 : -1));
  statesSorted.forEach(
    s => void stateFilter.options.add(new Option(s.name, String(s.i), false, s.i === selectedState))
  );

  const cultureFilter = ensureEl<HTMLSelectElement>("burgsFilterCulture");
  const selectedCulture = settings.cultureId != null ? settings.cultureId : +cultureFilter.value || -1;
  cultureFilter.options.length = 0; // remove all options
  cultureFilter.options.add(new Option(`all`, "-1", false, selectedCulture === -1));
  cultureFilter.options.add(new Option(pack.cultures[0].name, "0", false, selectedCulture === 0));
  const culturesSorted = pack.cultures.filter(c => c.i && !c.removed).sort((a, b) => (a.name > b.name ? 1 : -1));
  culturesSorted.forEach(
    c => void cultureFilter.options.add(new Option(c.name, String(c.i), false, c.i === selectedCulture))
  );
}

// add line for each burg
function burgsOverviewAddLines(): void {
  const body = ensureEl("burgsBody");
  const searchText = ensureEl<HTMLInputElement>("burgsSearch").value.toLowerCase().trim();
  const selectedStateId = +ensureEl<HTMLSelectElement>("burgsFilterState").value;
  const selectedCultureId = +ensureEl<HTMLSelectElement>("burgsFilterCulture").value;

  const validBurgs = pack.burgs.filter(b => b.i && !b.removed);
  let filtered = validBurgs;

  if (searchText) {
    // filter by search text
    filtered = filtered.filter(b => {
      const name = b.name!.toLowerCase();
      const state = (pack.states[b.state!]?.name || "").toLowerCase();
      const prov = pack.cells.province[b.cell];
      const province = prov ? pack.provinces[prov]?.name.toLowerCase() : "";
      const culture = (pack.cultures[b.culture!]?.name || "").toLowerCase();
      return (
        name.includes(searchText) ||
        state.includes(searchText) ||
        province.includes(searchText) ||
        culture.includes(searchText) ||
        b.group!.toLowerCase().includes(searchText)
      );
    });
  }
  if (selectedStateId !== -1) filtered = filtered.filter(b => b.state === selectedStateId); // filtered by state
  if (selectedCultureId !== -1) filtered = filtered.filter(b => b.culture === selectedCultureId); // filtered by culture

  body.innerHTML = "";
  let lines = "";
  let totalPopulation = 0;
  let totalProduct = 0;
  let totalProductPerCapita = 0;
  let totalTreasury = 0;

  for (const b of filtered) {
    const population = b.population! * populationRate * urbanization;
    const grossProduct = rn(b.product || 0, 2);
    const productPerCapita = rn(b.population! > 0 ? (b.product || 0) / b.population! : 0, 2);
    const treasury = rn(b.treasury || 0, 2);
    totalPopulation += population;
    totalProduct += grossProduct;
    totalProductPerCapita += productPerCapita;
    totalTreasury += treasury;
    const features = b.capital && b.port ? "a-capital-port" : b.capital ? "c-capital" : b.port ? "p-port" : "z-burg";
    const state = pack.states[b.state!].name;
    const prov = pack.cells.province[b.cell];
    const province = prov ? pack.provinces[prov].name : "";
    const culture = pack.cultures[b.culture!].name;

    lines += /* html */ `<div
        class="states"
        data-id=${b.i}
        data-name="${b.name}"
        data-state="${state}"
        data-province="${province}"
        data-culture="${culture}"
        data-group="${b.group}"
        data-population=${population}
        data-grossproduct=${grossProduct}
        data-productpercapita=${productPerCapita}
        data-treasury=${treasury}
        data-features="${features}"
      >
        <span data-tip="Click to zoom into view" class="icon-dot-circled pointer"></span>
        <input data-tip="Burg name" class="burgName" value="${b.name}" disabled />
        <input data-tip="Burg province" value="${province}" disabled />
        <input data-tip="Burg state" value="${state}" disabled />
        <input data-tip="Dominant culture" value="${culture}" disabled />
        <input data-tip="Burg group" value="${b.group}" disabled />
        <span data-tip="Burg population" class="icon-male"></span>
        <input data-tip="Burg population" value=${si(population)} style="width: 5em" disabled />
        <span data-tip="Gross Product: local sale revenue minus purchased ingredient costs during the production.">🟡</span>
        <input data-tip="Gross Product: local sale revenue minus purchased ingredient costs during the production." value=${grossProduct} style="width: 5em" disabled />
        <span data-tip="Wealth: gross product divided by population">🟡</span>
        <input data-tip="Wealth: gross product divided by population" value=${productPerCapita} style="width: 5em" disabled />
        <span data-tip="Treasury: accumulated cash balance">🟡</span>
        <input data-tip="Treasury: accumulated cash balance" value=${treasury} style="width: 5em" disabled />
        <div style="width: 3em">
          <span
            data-tip="${b.capital ? " This burg is a state capital" : "This burg is a NOT state capital"}"
            class="icon-star-empty${b.capital ? "" : " inactive"}" style="padding: 0 1px;"></span>
          <span data-tip="${b.port ? " This burg is a port" : "This burg is NOT a port"}"
          class="icon-anchor${b.port ? "" : " inactive"}" style="font-size: .9em; padding: 0 1px;"></span>
        </div>
        <span data-tip="Edit burg" class="icon-pencil"></span>
        <span class="locks pointer ${
          b.lock ? "icon-lock" : "icon-lock-open inactive"
        }" onmouseover="showElementLockTip(event)"></span>
        <span data-tip="Remove burg" class="icon-trash-empty"></span>
      </div>`;
  }
  if (!filtered.length) body.innerHTML = /* html */ `<div style="padding-block: 0.3em;">No burgs found</div>`;
  body.insertAdjacentHTML("beforeend", lines);

  // update footer
  ensureEl("burgsFooterBurgs").innerHTML = `${filtered.length} of ${validBurgs.length}`;
  ensureEl("burgsFooterPopulation").innerHTML = filtered.length ? si(totalPopulation / filtered.length) : "0";
  ensureEl("burgsFooterGrossProduct").innerHTML = filtered.length ? String(rn(totalProduct / filtered.length, 2)) : "0";
  ensureEl("burgsFooterProductPerCapita").innerHTML = filtered.length
    ? String(rn(totalProductPerCapita / filtered.length, 2))
    : "0";
  ensureEl("burgsFooterTreasury").innerHTML = filtered.length ? String(rn(totalTreasury / filtered.length, 2)) : "0";

  // add listeners
  body.querySelectorAll("div.states").forEach(el => void el.addEventListener("mouseenter", ev => burgHighlightOn(ev)));
  body.querySelectorAll("div.states").forEach(el => void el.addEventListener("mouseleave", () => burgHighlightOff()));
  body.querySelectorAll("div > span.icon-dot-circled").forEach(el => void el.addEventListener("click", zoomIntoBurg));
  body.querySelectorAll("div > span.locks").forEach(el => void el.addEventListener("click", toggleBurgLockStatus));
  body.querySelectorAll("div > span.icon-pencil").forEach(el => void el.addEventListener("click", openBurgEditor));
  body
    .querySelectorAll("div > span.icon-trash-empty")
    .forEach(el => void el.addEventListener("click", triggerBurgRemove));

  applySorting(ensureEl("burgsHeader"));
}

function burgHighlightOn(event: Event): void {
  const burg = +(event.target as HTMLElement).dataset.id!;
  const label = burgLabels.select(`[data-id='${burg}']`);
  if (label.size()) label.classed("drag", true);
}

function burgHighlightOff(): void {
  burgLabels.selectAll("text.drag").classed("drag", false);
}

function zoomIntoBurg(this: HTMLElement): void {
  const burg = +(this.parentNode as HTMLElement).dataset.id!;
  const label = document.querySelector(`#burgLabels [data-id='${burg}']`)!;
  const x = +label.getAttribute("x")!;
  const y = +label.getAttribute("y")!;
  zoomTo(x, y, 8, 2000);
}

function toggleBurgLockStatus(this: HTMLElement): void {
  const burgId = +(this.parentNode as HTMLElement).dataset.id!;

  const burg = pack.burgs[burgId];
  burg.lock = !burg.lock;

  if (this.classList.contains("icon-lock")) {
    this.classList.remove("icon-lock");
    this.classList.add("icon-lock-open");
    this.classList.add("inactive");
  } else {
    this.classList.remove("icon-lock-open");
    this.classList.add("icon-lock");
    this.classList.remove("inactive");
  }
}

function openBurgEditor(this: HTMLElement): void {
  const burg = +(this.parentNode as HTMLElement).dataset.id!;
  Controllers.BurgEditor.open(burg);
}

function triggerBurgRemove(this: HTMLElement): void {
  const burgId = +(this.parentNode as HTMLElement).dataset.id!;
  if (pack.burgs[burgId].capital) {
    tip("You cannot remove the capital. Please change the state capital first", false, "error");
    return;
  }

  confirmationDialog({
    title: "Remove burg",
    message: "Are you sure you want to remove the burg? <br>This action cannot be reverted",
    confirm: "Remove",
    onConfirm: () => {
      Burgs.remove(burgId);
      burgsOverviewAddLines();
    }
  });
}

function regenerateNames(): void {
  ensureEl("burgsBody")
    .querySelectorAll<HTMLElement>(":scope > div")
    .forEach(el => {
      const burg = +el.dataset.id!;
      if (pack.burgs[burg].lock) return;

      const culture = pack.burgs[burg].culture!;
      const name = Names.getCulture(culture);

      el.querySelector<HTMLInputElement>(".burgName")!.value = name;
      pack.burgs[burg].name = el.dataset.name = name;
      burgLabels.select(`[data-id='${burg}']`).text(name);
    });
}

function enterAddBurgMode(this: HTMLElement): void {
  if (this.classList.contains("pressed")) {
    exitAddBurgMode();
    return;
  }
  customization = 3;
  this.classList.add("pressed");
  tip("Click on the map to create a new burg. Hold Shift to add multiple", true, "warn");
  select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addBurgOnClick);
}

function addBurgOnClick(this: SVGGElement, event: any): void {
  const point = pointer(event, this);
  const cell = findCell(point[0], point[1])!;

  if (pack.cells.h[cell] < 20) {
    tip("You cannot place state into the water. Please click on a land cell", false, "error");
    return;
  }
  if (pack.cells.burg[cell]) {
    tip("There is already a burg in this cell. Please select a free cell", false, "error");
    return;
  }

  Burgs.add(point as [number, number]); // add new burg

  if (event.shiftKey === false) {
    exitAddBurgMode();
    burgsOverviewAddLines();
  }
}

function exitAddBurgMode(): void {
  customization = 0;
  restoreDefaultEvents();
  clearMainTip();
  ensureEl("addBurgTool").classList.remove("pressed");
  ensureEl("addNewBurg").classList.remove("pressed");
}

function showBurgsChart(): void {
  // build hierarchy tree
  const states = pack.states.map(s => {
    const color = s.color ? s.color : "#ccc";
    const name = s.fullName ? s.fullName : s.name;
    return { id: s.i, state: s.i ? 0 : null, color, name };
  });

  const burgs = pack.burgs
    .filter(b => b.i && !b.removed)
    .map(b => {
      const id = b.i + states.length - 1;
      const population = b.population;
      const capital = b.capital;
      const province = pack.cells.province[b.cell];
      const parent = province ? province + states.length - 1 : b.state;
      return {
        id,
        i: b.i,
        state: b.state,
        culture: b.culture,
        province,
        parent,
        name: b.name,
        population,
        capital,
        x: b.x,
        y: b.y
      };
    });
  const data: any[] = (states as any[]).concat(burgs);
  if (data.length < 2) {
    tip("No burgs to show", false, "error");
    return;
  }

  const root = (stratify() as any)
    .parentId((d: any) => d.state)(data)
    .sum((d: any) => d.population)
    .sort((a: any, b: any) => b.value - a.value);

  const uiSize = ensureEl<HTMLInputElement>("uiSize").valueAsNumber;
  const width = 150 + 200 * uiSize;
  const height = 150 + 200 * uiSize;
  const margin = { top: 0, right: -50, bottom: -10, left: -50 };
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;
  const treeLayout = packLayout().size([w, h]).padding(3);

  // prepare svg
  alertMessage.innerHTML = /* html */ `<select id="burgsTreeType" style="display:block; margin-left:13px; font-size:11px">
      <option value="states" selected>Group by state</option>
      <option value="cultures">Group by culture</option>
      <option value="parent">Group by province and state</option>
      <option value="provinces">Group by province</option>
    </select>`;
  alertMessage.innerHTML += `<div id='burgsInfo' class='chartInfo'>&#8205;</div>`;
  const svg = select("#alertMessage")
    .insert("svg", "#burgsInfo")
    .attr("id", "burgsTree")
    .attr("width", width)
    .attr("height", height - 10)
    .attr("stroke-width", 2);
  const graph = svg.append("g").attr("transform", `translate(-50, -10)`);
  ensureEl("burgsTreeType").addEventListener("change", updateChart);

  treeLayout(root);

  const node = graph
    .selectAll("circle")
    .data(root.leaves())
    .join("circle")
    .attr("data-id", (d: any) => d.data.i)
    .attr("r", (d: any) => d.r)
    .attr("fill", (d: any) => d.parent.data.color)
    .attr("cx", (d: any) => d.x)
    .attr("cy", (d: any) => d.y)
    .on("mouseenter", (event: any, d: any) => showInfo(event, d))
    .on("mouseleave", (event: any) => hideInfo(event))
    .on("click", (_event: any, d: any) => zoomTo(d.data.x, d.data.y, 8, 2000));

  function showInfo(ev: any, d: any): void {
    select(ev.target).transition().duration(1500).attr("stroke", "#c13119");
    const name = d.data.name;
    const parent = d.parent.data.name;
    const population = si(d.value * populationRate * urbanization);

    ensureEl("burgsInfo").innerHTML = /* html */ `${name}. ${parent}. Population: ${population}`;
    burgHighlightOn(ev);
    tip("Click to zoom into view");
  }

  function hideInfo(ev: any): void {
    burgHighlightOff();
    if (!ensureEl("burgsInfo")) return;
    ensureEl("burgsInfo").innerHTML = "&#8205;";
    select(ev.target).transition().attr("stroke", null);
    tip("");
  }

  function updateChart(this: HTMLSelectElement): void {
    const getStatesData = () =>
      pack.states.map(s => {
        const color = s.color ? s.color : "#ccc";
        const name = s.fullName ? s.fullName : s.name;
        return { id: s.i, state: s.i ? 0 : null, color, name };
      });

    const getCulturesData = () =>
      pack.cultures.map(c => {
        const color = c.color ? c.color : "#ccc";
        return { id: c.i, culture: c.i ? 0 : null, color, name: c.name };
      });

    const getParentData = () => {
      const states = pack.states.map(s => {
        const color = s.color ? s.color : "#ccc";
        const name = s.fullName ? s.fullName : s.name;
        return { id: s.i, parent: s.i ? 0 : null, color, name };
      });
      const provinces = pack.provinces
        .filter(p => p.i && !p.removed)
        .map(p => {
          return { id: p.i + states.length - 1, parent: p.state, color: p.color, name: p.fullName };
        });
      return (states as any[]).concat(provinces);
    };

    const getProvincesData = () =>
      pack.provinces.map(p => {
        const color = p.color ? p.color : "#ccc";
        const name = p.fullName ? p.fullName : p.name;
        return { id: p.i ? p.i : 0, province: p.i ? 0 : null, color, name };
      });

    const value = (d: any) => {
      if (this.value === "states") return d.state;
      if (this.value === "cultures") return d.culture;
      if (this.value === "parent") return d.parent;
      if (this.value === "provinces") return d.province;
    };

    const mapping: Record<string, () => any[]> = {
      states: getStatesData,
      cultures: getCulturesData,
      parent: getParentData,
      provinces: getProvincesData
    };

    const base = mapping[this.value]();
    burgs.forEach(b => {
      b.id = b.i + base.length - 1;
    });

    const data: any[] = base.concat(burgs);

    const root = (stratify() as any)
      .parentId((d: any) => value(d))(data)
      .sum((d: any) => d.population)
      .sort((a: any, b: any) => b.value - a.value);

    node
      .data((treeLayout(root) as any).leaves())
      .transition()
      .duration(2000)
      .attr("data-id", (d: any) => d.data.i)
      .attr("fill", (d: any) => d.parent.data.color)
      .attr("cx", (d: any) => d.x)
      .attr("cy", (d: any) => d.y)
      .attr("r", (d: any) => d.r);
  }

  $("#alert").dialog({
    title: "Burgs bubble chart",
    width: fitContent(),
    position: { my: "left bottom", at: "left+10 bottom-10", of: "svg" },
    buttons: {},
    close: () => (alertMessage.innerHTML = "")
  });
}

function downloadBurgsData(): void {
  let data = `Id,Burg,Province,Province Full Name,State,State Full Name,Culture,Religion,Group,Population,X,Y,Latitude,Longitude,Elevation (${heightUnit.value}),Temperature,Temperature likeness,Capital,Port,Citadel,Walls,Plaza,Temple,Shanty Town,Emblem,Preview link\n`; // headers
  const valid = pack.burgs.filter(b => b.i && !b.removed); // all valid burgs

  valid.forEach(b => {
    data += `${b.i},`;
    data += `${b.name},`;
    const province = pack.cells.province[b.cell];
    data += province ? `${pack.provinces[province].name},` : ",";
    data += province ? `${pack.provinces[province].fullName},` : ",";
    data += `${pack.states[b.state!].name},`;
    data += `${pack.states[b.state!].fullName},`;
    data += `${pack.cultures[b.culture!].name},`;
    data += `${pack.religions[pack.cells.religion[b.cell]].name},`;
    data += `${b.group},`;
    data += `${rn(b.population! * populationRate * urbanization)},`;

    // add geography data
    data += `${b.x},`;
    data += `${b.y},`;
    data += `${getLatitude(b.y, 2)},`;
    data += `${getLongitude(b.x, 2)},`;
    data += `${parseInt(getHeight(pack.cells.h[b.cell]), 10)},`;
    const temperature = grid.cells.temp[pack.cells.g[b.cell]];
    data += `${convertTemperature(temperature)},`;
    data += `${getTemperatureLikeness(temperature)},`;

    // add status data
    data += b.capital ? "capital," : ",";
    data += b.port ? "port," : ",";
    data += b.citadel ? "citadel," : ",";
    data += b.walls ? "walls," : ",";
    data += b.plaza ? "plaza," : ",";
    data += b.temple ? "temple," : ",";
    data += b.shanty ? "shanty town," : ",";
    data += b.coa ? `${JSON.stringify(b.coa).replace(/"/g, "").replace(/,/g, ";")},` : ",";
    data += Burgs.getPreview(b).link;

    data += "\n";
  });

  const name = `${getFileName("Burgs")}.csv`;
  downloadFile(data, name);
}

function renameBurgsInBulk(): void {
  alertMessage.innerHTML = /* html */ `Download burgs list as a text file, make changes and re-upload the file. Make sure the file is a plain text document with each
    name on its own line (the dilimiter is CRLF). If you do not want to change the name, just leave it as is`;

  $("#alert").dialog({
    title: "Burgs bulk renaming",
    width: "22em",
    position: { my: "center", at: "center", of: "svg" },
    buttons: {
      Download: () => {
        const data = pack.burgs
          .filter(b => b.i && !b.removed)
          .map(b => b.name)
          .join("\r\n");
        const name = `${getFileName("Burg names")}.txt`;
        downloadFile(data, name);
      },
      Upload: () => ensureEl("burgsListToLoad").click(),
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function importBurgNames(dataLoaded: string): void {
  if (!dataLoaded) {
    tip("Cannot load the file, please check the format", false, "error");
    return;
  }
  const data = dataLoaded
    .replace(/\r\n|\r/g, "\n")
    .split("\n")
    .filter(Boolean);
  if (!data.length) {
    tip("Cannot parse the list, please check the file format", false, "error");
    return;
  }

  const change: { id: number; name: string }[] = [];
  let message = `Burgs to be renamed as below:`;
  message += `<table class="overflow-table"><tr><th>Id</th><th>Current name</th><th>New Name</th></tr>`;

  const burgs = pack.burgs.filter(b => b.i && !b.removed);
  for (let i = 0; i < data.length && i <= burgs.length; i++) {
    const v = data[i];
    if (!v || !burgs[i] || v === burgs[i].name) continue;
    change.push({ id: burgs[i].i, name: v });
    message += `<tr><td style="width:20%">${burgs[i].i}</td><td style="width:40%">${burgs[i].name}</td><td style="width:40%">${v}</td></tr>`;
  }
  message += `</tr></table>`;

  if (!change.length) message = "No changes found in the file. Please change some names to get a result";
  alertMessage.innerHTML = message;

  const onConfirm = () => {
    for (let i = 0; i < change.length; i++) {
      const id = change[i].id;
      pack.burgs[id].name = change[i].name;
      burgLabels.select(`[data-id='${id}']`).text(change[i].name);
    }
    burgsOverviewAddLines();
  };

  confirmationDialog({
    title: "Burgs bulk renaming",
    message,
    confirm: "Rename",
    onConfirm
  });
}

function triggerAllBurgsRemove(): void {
  const number = pack.burgs.filter(b => b.i && !b.removed && !b.capital && !b.lock).length;
  confirmationDialog({
    title: `Remove ${number} burgs`,
    message: `
        Are you sure you want to remove all <i>unlocked</i> burgs except for capitals?
        <br><i>To remove a capital you have to remove its state first</i>`,
    confirm: "Remove",
    onConfirm: () => {
      pack.burgs.filter(b => b.i && !(b.capital || b.lock)).forEach(b => void Burgs.remove(b.i));
      burgsOverviewAddLines();
    }
  });
}

function toggleLockAll(): void {
  const activeBurgs = pack.burgs.filter(b => b.i && !b.removed);
  const allLocked = activeBurgs.every(burg => burg.lock);

  activeBurgs.forEach(burg => {
    burg.lock = !allLocked;
  });

  burgsOverviewAddLines();
  ensureEl("burgsLockAll").className = allLocked ? "icon-lock" : "icon-lock-open";
}

function updateLockAllIcon(): void {
  const allLocked = pack.burgs.every(({ lock, i, removed }) => lock || !i || removed);
  ensureEl("burgsLockAll").className = allLocked ? "icon-lock-open" : "icon-lock";
}

function editBurgGroups(): void {
  Controllers.BurgGroupEditor.open();
}

export const BurgsOverview = { open: overviewBurgs };
