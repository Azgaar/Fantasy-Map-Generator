"use strict";
function editProvinces() {
  if (customization) return;
  closeDialogs("#provincesEditor, .stable");
  if (!layerIsOn("toggleProvinces")) toggleProvinces();
  if (!layerIsOn("toggleBorders")) toggleBorders();
  if (layerIsOn("toggleStates")) toggleStates();
  if (layerIsOn("toggleCultures")) toggleCultures();

  provs.selectAll("text").call(d3.drag().on("drag", dragLabel)).classed("draggable", true);
  const body = document.getElementById("provincesBodySection");
  refreshProvincesEditor();

  if (modules.editProvinces) return;
  modules.editProvinces = true;

  $("#provincesEditor").dialog({
    title: "Provinces Editor",
    resizable: false,
    width: fitContent(),
    close: closeProvincesEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  // add listeners
  document.getElementById("provincesEditorRefresh").addEventListener("click", refreshProvincesEditor);
  document.getElementById("provincesEditStyle").addEventListener("click", () => editStyle("provs"));
  document.getElementById("provincesFilterState").addEventListener("change", provincesEditorAddLines);
  document.getElementById("provincesPercentage").addEventListener("click", togglePercentageMode);
  document.getElementById("provincesChart").addEventListener("click", showChart);
  document.getElementById("provincesToggleLabels").addEventListener("click", toggleLabels);
  document.getElementById("provincesExport").addEventListener("click", downloadProvincesData);
  document.getElementById("provincesRemoveAll").addEventListener("click", removeAllProvinces);
  document.getElementById("provincesManually").addEventListener("click", enterProvincesManualAssignent);
  document.getElementById("provincesManuallyApply").addEventListener("click", applyProvincesManualAssignent);
  document.getElementById("provincesManuallyCancel").addEventListener("click", () => exitProvincesManualAssignment());
  document.getElementById("provincesRelease").addEventListener("click", triggerProvincesRelease);
  document.getElementById("provincesAdd").addEventListener("click", enterAddProvinceMode);
  document.getElementById("provincesRecolor").addEventListener("click", recolorProvinces);

  body.addEventListener("click", function (ev) {
    if (customization) return;
    const el = ev.target,
      cl = el.classList,
      line = el.parentNode,
      p = +line.dataset.id;
    const stateId = pack.provinces[p].state;

    if (el.tagName === "FILL-BOX") changeFill(el);
    else if (cl.contains("name")) editProvinceName(p);
    else if (cl.contains("coaIcon")) editEmblem("province", "provinceCOA" + p, pack.provinces[p]);
    else if (cl.contains("icon-star-empty")) capitalZoomIn(p);
    else if (cl.contains("icon-flag-empty")) triggerIndependencePromps(p);
    else if (cl.contains("icon-dot-circled")) overviewBurgs({stateId});
    else if (cl.contains("culturePopulation")) changePopulation(p);
    else if (cl.contains("icon-pin")) toggleFog(p, cl);
    else if (cl.contains("icon-trash-empty")) removeProvince(p);
    else if (cl.contains("icon-lock") || cl.contains("icon-lock-open")) updateLockStatus(p, cl);
  });

  body.addEventListener("change", function (ev) {
    const el = ev.target,
      cl = el.classList,
      line = el.parentNode,
      p = +line.dataset.id;
    if (cl.contains("cultureBase")) changeCapital(p, line, el.value);
  });

  function refreshProvincesEditor() {
    collectStatistics();
    updateFilter();
    provincesEditorAddLines();
  }

  function collectStatistics() {
    const {cells, provinces, burgs} = pack;

    provinces.forEach(p => {
      if (!p.i || p.removed) return;
      p.area = p.rural = p.urban = 0;
      p.burgs = [];
      if ((p.burg && !burgs[p.burg]) || burgs[p.burg].removed) p.burg = 0;
    });

    for (const i of cells.i) {
      const p = cells.province[i];
      if (!p) continue;

      provinces[p].area += cells.area[i];
      provinces[p].rural += cells.pop[i];
      if (!cells.burg[i]) continue;
      provinces[p].urban += burgs[cells.burg[i]].population;
      provinces[p].burgs.push(cells.burg[i]);
    }

    provinces.forEach(p => {
      if (!p.i || p.removed) return;
      if (!p.burg && p.burgs.length) p.burg = p.burgs[0];
    });
  }

  function updateFilter() {
    const stateFilter = document.getElementById("provincesFilterState");
    const selectedState = stateFilter.value || 1;
    stateFilter.options.length = 0; // remove all options
    stateFilter.options.add(new Option(`all`, -1, false, selectedState == -1));
    const statesSorted = pack.states.filter(s => s.i && !s.removed).sort((a, b) => (a.name > b.name ? 1 : -1));
    statesSorted.forEach(s => stateFilter.options.add(new Option(s.name, s.i, false, s.i == selectedState)));
  }

  // add line for each province
  function provincesEditorAddLines() {
    const unit = " " + getAreaUnit();
    const selectedState = +document.getElementById("provincesFilterState").value;
    let filtered = pack.provinces.filter(p => p.i && !p.removed); // all valid burgs
    if (selectedState != -1) filtered = filtered.filter(p => p.state === selectedState); // filtered by state
    body.innerHTML = "";

    let lines = "";
    let totalArea = 0;
    let totalPopulation = 0;
    let totalBurgs = 0;

    for (const p of filtered) {
      const area = getArea(p.area);
      totalArea += area;
      const rural = p.rural * populationRate;
      const urban = p.urban * populationRate * urbanization;
      const population = rn(rural + urban);
      const populationTip = `Total population: ${si(population)}; Rural population: ${si(
        rural
      )}; Urban population: ${si(urban)}`;
      totalPopulation += population;
      totalBurgs += p.burgs.length;

      const stateName = pack.states[p.state].name;
      const capital = p.burg ? pack.burgs[p.burg].name : "";
      const separable = p.burg && p.burg !== pack.states[p.state].capital;
      const focused = defs.select("#fog #focusProvince" + p.i).size();
      COArenderer.trigger("provinceCOA" + p.i, p.coa);
      lines += /* html */ `<div
        class="states"
        data-id=${p.i}
        data-name="${p.name}"
        data-form="${p.formName}"
        data-color="${p.color}"
        data-capital="${capital}"
        data-state="${stateName}"
        data-area=${area}
        data-population=${population}
        data-burgs=${p.burgs.length}
      >
        <fill-box fill="${p.color}"></fill-box>
        <input data-tip="Province name. Click to change" class="name pointer" value="${p.name}" readonly />
        <svg data-tip="Click to show and edit province emblem" class="coaIcon pointer hide" viewBox="0 0 200 200"><use href="#provinceCOA${
          p.i
        }"></use></svg>
        <input data-tip="Province form name. Click to change" class="name pointer hide" value="${
          p.formName
        }" readonly />
        <span data-tip="Province capital. Click to zoom into view" class="icon-star-empty pointer hide ${
          p.burg ? "" : "placeholder"
        }"></span>
        <select
          data-tip="Province capital. Click to select from burgs within the state. No capital means the province is governed from the state capital"
          class="cultureBase hide ${p.burgs.length ? "" : "placeholder"}"
        >
          ${p.burgs.length ? getCapitalOptions(p.burgs, p.burg) : ""}
        </select>
        <input data-tip="Province owner" class="provinceOwner" value="${stateName}" disabled">
        <span data-tip="Click to overview province burgs" style="padding-right: 1px" class="icon-dot-circled pointer hide"></span>
        <div data-tip="Burgs count" class="provinceBurgs hide">${p.burgs.length}</div>
        <span data-tip="Province area" style="padding-right: 4px" class="icon-map-o hide"></span>
        <div data-tip="Province area" class="biomeArea hide">${si(area) + unit}</div>
        <span data-tip="${populationTip}" class="icon-male hide"></span>
        <div data-tip="${populationTip}" class="culturePopulation hide">${si(population)}</div>
        <span
          data-tip="Declare province independence (turn non-capital province with burgs into a new state)"
          class="icon-flag-empty ${separable ? "" : "placeholder"} hide"
        ></span>
        <span data-tip="Toggle province focus" class="icon-pin ${focused ? "" : " inactive"} hide"></span>
        <span data-tip="Lock the province" class="icon-lock${p.lock ? "" : "-open"} hide"></span>
        <span data-tip="Remove the province" class="icon-trash-empty hide"></span>
      </div>`;
    }
    body.innerHTML = lines;

    // update footer
    byId("provincesFooterNumber").innerHTML = filtered.length;
    byId("provincesFooterBurgs").innerHTML = totalBurgs;
    byId("provincesFooterArea").innerHTML = filtered.length ? si(totalArea / filtered.length) + unit : 0 + unit;
    byId("provincesFooterPopulation").innerHTML = filtered.length ? si(totalPopulation / filtered.length) : 0;
    byId("provincesFooterArea").dataset.area = totalArea;
    byId("provincesFooterPopulation").dataset.population = totalPopulation;

    body.querySelectorAll("div.states").forEach(el => {
      el.addEventListener("click", selectProvinceOnLineClick);
      el.addEventListener("mouseenter", ev => provinceHighlightOn(ev));
      el.addEventListener("mouseleave", ev => provinceHighlightOff(ev));
    });

    if (body.dataset.type === "percentage") {
      body.dataset.type = "absolute";
      togglePercentageMode();
    }
    applySorting(provincesHeader);
    $("#provincesEditor").dialog({width: fitContent()});
  }

  function getCapitalOptions(burgs, capital) {
    let options = "";
    burgs.forEach(
      b => (options += `<option ${b === capital ? "selected" : ""} value="${b}">${pack.burgs[b].name}</option>`)
    );
    return options;
  }

  function provinceHighlightOn(event) {
    const province = +event.target.dataset.id;
    const el = body.querySelector(`div[data-id='${province}']`);
    if (el) el.classList.add("active");

    if (!layerIsOn("toggleProvinces")) return;
    if (customization) return;
    const animate = d3.transition().duration(2000).ease(d3.easeSinIn);
    provs
      .select("#province" + province)
      .raise()
      .transition(animate)
      .attr("stroke-width", 2.5)
      .attr("stroke", "#d0240f");
  }

  function provinceHighlightOff(event) {
    const province = +event.target.dataset.id;
    const el = body.querySelector(`div[data-id='${province}']`);
    if (el) el.classList.remove("active");

    if (!layerIsOn("toggleProvinces")) return;
    provs
      .select("#province" + province)
      .transition()
      .attr("stroke-width", null)
      .attr("stroke", null);
  }

  function changeFill(el) {
    const currentFill = el.getAttribute("fill");
    const p = +el.parentNode.dataset.id;

    const callback = newFill => {
      el.fill = newFill;
      pack.provinces[p].color = newFill;
      const g = provs.select("#provincesBody");
      g.select("#province" + p).attr("fill", newFill);
      g.select("#province-gap" + p).attr("stroke", newFill);
    };

    openPicker(currentFill, callback);
  }

  function capitalZoomIn(p) {
    const capital = pack.provinces[p].burg;
    const l = burgLabels.select("[data-id='" + capital + "']");
    const x = +l.attr("x");
    const y = +l.attr("y");
    zoomTo(x, y, 8, 2000);
  }

  function triggerIndependencePromps(p) {
    confirmationDialog({
      title: "Declare independence",
      message: "Are you sure you want to declare province independence? <br>It will turn province into a new state",
      confirm: "Declare",
      onConfirm: () => {
        const [oldStateId, newStateId] = declareProvinceIndependence(p);
        updateStatesPostRelease([oldStateId], [newStateId]);
      }
    });
  }

  function declareProvinceIndependence(provinceId) {
    const {states, provinces, cells, burgs} = pack;
    const province = provinces[provinceId];
    const {name, burg: burgId, burgs: provinceBurgs} = province;

    if (provinceBurgs.some(b => burgs[b].capital))
      return tip(
        "Cannot declare independence of a province having capital burg. Please change capital first",
        false,
        "error"
      );
    if (!burgId) return tip("Cannot declare independence of a province without burg", false, "error");

    const oldStateId = province.state;
    const newStateId = states.length;

    // turn province burg into a capital
    burgs[burgId].capital = 1;
    moveBurgToGroup(burgId, "cities");

    // move all burgs to a new state
    province.burgs.forEach(b => (burgs[b].state = newStateId));

    // define new state attributes
    const {cell: center, culture} = burgs[burgId];
    const color = getRandomColor();
    const coa = province.coa;
    const coaEl = document.getElementById("provinceCOA" + provinceId);
    if (coaEl) coaEl.id = "stateCOA" + newStateId;
    emblems.select(`#provinceEmblems > use[data-i='${provinceId}']`).remove();

    // update cells
    cells.i
      .filter(i => cells.province[i] === provinceId)
      .forEach(i => {
        cells.province[i] = 0;
        cells.state[i] = newStateId;
      });

    // update diplomacy and reverse relations
    const diplomacy = states.map(s => {
      if (!s.i || s.removed) return "x";
      let relations = states[oldStateId].diplomacy[s.i]; // relations between Nth state and old overlord
      // new state is Enemy to its old owner
      if (s.i === oldStateId) relations = "Enemy";
      else if (relations === "Ally") relations = "Suspicion";
      else if (relations === "Friendly") relations = "Suspicion";
      else if (relations === "Suspicion") relations = "Neutral";
      else if (relations === "Enemy") relations = "Friendly";
      else if (relations === "Rival") relations = "Friendly";
      else if (relations === "Vassal") relations = "Suspicion";
      else if (relations === "Suzerain") relations = "Enemy";
      s.diplomacy.push(relations);
      return relations;
    });
    diplomacy.push("x");
    states[0].diplomacy.push([
      `Independance declaration`,
      `${name} declared its independance from ${states[oldStateId].name}`
    ]);

    // create new state
    states.push({
      i: newStateId,
      name,
      diplomacy,
      provinces: [],
      color,
      expansionism: 0.5,
      capital: burgId,
      type: "Generic",
      center,
      culture,
      military: [],
      alert: 1,
      coa
    });

    // remove old province
    states[oldStateId].provinces = states[oldStateId].provinces.filter(p => p !== provinceId);
    provinces[provinceId] = {i: provinceId, removed: true};

    return [oldStateId, newStateId];
  }

  function updateStatesPostRelease(oldStates, newStates) {
    const allStates = unique([...oldStates, ...newStates]);

    layerIsOn("toggleProvinces") && toggleProvinces();
    layerIsOn("toggleStates") ? drawStates() : toggleStates();
    layerIsOn("toggleBorders") ? drawBorders() : toggleBorders();

    BurgsAndStates.collectStatistics();
    BurgsAndStates.defineStateForms(newStates);
    drawStateLabels(allStates);

    // redraw emblems
    allStates.forEach(stateId => {
      emblems.select(`#stateEmblems > use[data-i='${stateId}']`)?.remove();
      const {coa, pole} = pack.states[stateId];
      COArenderer.add("state", stateId, coa, ...pole);
    });

    unfog();
    closeDialogs();
    editStates();
  }

  function changePopulation(province) {
    const p = pack.provinces[province];
    const cells = pack.cells.i.filter(i => pack.cells.province[i] === province);
    if (!cells.length) {
      tip("Province does not have any cells, cannot change population", false, "error");
      return;
    }
    const rural = rn(p.rural * populationRate);
    const urban = rn(p.urban * populationRate * urbanization);
    const total = rural + urban;
    const l = n => Number(n).toLocaleString();

    alertMessage.innerHTML = /* html */ ` Rural: <input type="number" min="0" step="1" id="ruralPop" value=${rural} style="width:6em" /> Urban:
      <input type="number" min="0" step="1" id="urbanPop" value=${urban} style="width:6em" ${
      p.burgs.length ? "" : "disabled"
    } />
      <p>Total population: ${l(total)} ⇒ <span id="totalPop">${l(
      total
    )}</span> (<span id="totalPopPerc">100</span>%)</p>`;

    const update = function () {
      const totalNew = ruralPop.valueAsNumber + urbanPop.valueAsNumber;
      if (isNaN(totalNew)) return;
      totalPop.innerHTML = l(totalNew);
      totalPopPerc.innerHTML = rn((totalNew / total) * 100);
    };

    ruralPop.oninput = () => update();
    urbanPop.oninput = () => update();

    $("#alert").dialog({
      resizable: false,
      title: "Change province population",
      width: "24em",
      buttons: {
        Apply: function () {
          applyPopulationChange();
          $(this).dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      },
      position: {my: "center", at: "center", of: "svg"}
    });

    function applyPopulationChange() {
      const ruralChange = ruralPop.value / rural;
      if (isFinite(ruralChange) && ruralChange !== 1) {
        cells.forEach(i => (pack.cells.pop[i] *= ruralChange));
      }
      if (!isFinite(ruralChange) && +ruralPop.value > 0) {
        const points = ruralPop.value / populationRate;
        const pop = rn(points / cells.length);
        cells.forEach(i => (pack.cells.pop[i] = pop));
      }

      const urbanChange = urbanPop.value / urban;
      if (isFinite(urbanChange) && urbanChange !== 1) {
        p.burgs.forEach(b => (pack.burgs[b].population = rn(pack.burgs[b].population * urbanChange, 4)));
      }
      if (!isFinite(urbanChange) && +urbanPop.value > 0) {
        const points = urbanPop.value / populationRate / urbanization;
        const population = rn(points / burgs.length, 4);
        p.burgs.forEach(b => (pack.burgs[b].population = population));
      }

      refreshProvincesEditor();
    }
  }

  function toggleFog(p, cl) {
    const path = provs.select("#province" + p).attr("d"),
      id = "focusProvince" + p;
    cl.contains("inactive") ? fog(id, path) : unfog(id);
    cl.toggle("inactive");
  }

  function removeProvince(p) {
    alertMessage.innerHTML = /* html */ `Are you sure you want to remove the province? <br />This action cannot be reverted`;
    $("#alert").dialog({
      resizable: false,
      title: "Remove province",
      buttons: {
        Remove: function () {
          pack.cells.province.forEach((province, i) => {
            if (province === p) pack.cells.province[i] = 0;
          });
          const s = pack.provinces[p].state,
            state = pack.states[s];
          if (state.provinces.includes(p)) state.provinces.splice(state.provinces.indexOf(p), 1);

          unfog("focusProvince" + p);

          const coaId = "provinceCOA" + p;
          if (document.getElementById(coaId)) document.getElementById(coaId).remove();
          emblems.select(`#provinceEmblems > use[data-i='${p}']`).remove();

          pack.provinces[p] = {i: p, removed: true};

          const g = provs.select("#provincesBody");
          g.select("#province" + p).remove();
          g.select("#province-gap" + p).remove();
          if (!layerIsOn("toggleBorders")) toggleBorders();
          else drawBorders();
          refreshProvincesEditor();
          $(this).dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function editProvinceName(province) {
    const p = pack.provinces[province];
    document.getElementById("provinceNameEditor").dataset.province = province;
    document.getElementById("provinceNameEditorShort").value = p.name;
    applyOption(provinceNameEditorSelectForm, p.formName);
    document.getElementById("provinceNameEditorFull").value = p.fullName;

    const cultureId = pack.cells.culture[p.center];
    document.getElementById("provinceCultureDisplay").innerText = pack.cultures[cultureId].name;

    $("#provinceNameEditor").dialog({
      resizable: false,
      title: "Change province name",
      buttons: {
        Apply: function () {
          applyNameChange(p);
          $(this).dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      },
      position: {my: "center", at: "center", of: "svg"}
    });

    if (modules.editProvinceName) return;
    modules.editProvinceName = true;

    // add listeners
    document.getElementById("provinceNameEditorShortCulture").addEventListener("click", regenerateShortNameCulture);
    document.getElementById("provinceNameEditorShortRandom").addEventListener("click", regenerateShortNameRandom);
    document.getElementById("provinceNameEditorAddForm").addEventListener("click", addCustomForm);
    document.getElementById("provinceNameEditorFullRegenerate").addEventListener("click", regenerateFullName);

    function regenerateShortNameCulture() {
      const province = +provinceNameEditor.dataset.province;
      const culture = pack.cells.culture[pack.provinces[province].center];
      const name = Names.getState(Names.getCultureShort(culture), culture);
      document.getElementById("provinceNameEditorShort").value = name;
    }

    function regenerateShortNameRandom() {
      const base = rand(nameBases.length - 1);
      const name = Names.getState(Names.getBase(base), undefined, base);
      document.getElementById("provinceNameEditorShort").value = name;
    }

    function addCustomForm() {
      const value = provinceNameEditorCustomForm.value;
      const displayed = provinceNameEditorCustomForm.style.display === "inline-block";
      provinceNameEditorCustomForm.style.display = displayed ? "none" : "inline-block";
      provinceNameEditorSelectForm.style.display = displayed ? "inline-block" : "none";
      if (displayed) applyOption(provinceNameEditorSelectForm, value);
    }

    function regenerateFullName() {
      const short = document.getElementById("provinceNameEditorShort").value;
      const form = document.getElementById("provinceNameEditorSelectForm").value;
      document.getElementById("provinceNameEditorFull").value = getFullName();

      function getFullName() {
        if (!form) return short;
        if (!short && form) return "The " + form;
        return short + " " + form;
      }
    }

    function applyNameChange(p) {
      p.name = document.getElementById("provinceNameEditorShort").value;
      p.formName = document.getElementById("provinceNameEditorSelectForm").value;
      p.fullName = document.getElementById("provinceNameEditorFull").value;
      provs.select("#provinceLabel" + p.i).text(p.name);
      refreshProvincesEditor();
    }
  }

  function changeCapital(p, line, value) {
    line.dataset.capital = pack.burgs[+value].name;
    pack.provinces[p].center = pack.burgs[+value].cell;
    pack.provinces[p].burg = +value;
  }

  function togglePercentageMode() {
    if (body.dataset.type === "absolute") {
      body.dataset.type = "percentage";
      const totalBurgs = +byId("provincesFooterBurgs").innerText;
      const totalArea = +provincesFooterArea.dataset.area;
      const totalPopulation = +provincesFooterPopulation.dataset.population;

      body.querySelectorAll(":scope > div").forEach(function (el) {
        const {cells, burgs, area, population} = el.dataset;
        el.querySelector(".provinceBurgs").innerText = rn((+burgs / totalBurgs) * 100) + "%";
        el.querySelector(".biomeArea").innerHTML = rn((+area / totalArea) * 100) + "%";
        el.querySelector(".culturePopulation").innerHTML = rn((+population / totalPopulation) * 100) + "%";
      });
    } else {
      body.dataset.type = "absolute";
      provincesEditorAddLines();
    }
  }

  function showChart() {
    // build hierarchy tree
    const getColor = s => (!s.i || s.removed || s.color[0] !== "#" ? "#666" : d3.color(s.color).darker());
    const states = pack.states.map(s => ({id: s.i, state: s.i ? 0 : null, color: getColor(s)}));
    const provinces = pack.provinces
      .filter(p => p.i && !p.removed)
      .map(p => {
        return {
          id: p.i + states.length - 1,
          i: p.i,
          state: p.state,
          color: p.color,
          name: p.name,
          fullName: p.fullName,
          area: p.area,
          urban: p.urban,
          rural: p.rural
        };
      });
    const data = states.concat(provinces);
    const root = d3
      .stratify()
      .parentId(d => d.state)(data)
      .sum(d => d.area);

    const width = 300 + 300 * uiSize.value,
      height = 90 + 90 * uiSize.value;
    const margin = {top: 10, right: 10, bottom: 0, left: 10};
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;
    const treeLayout = d3.treemap().size([w, h]).padding(2);

    // prepare svg
    alertMessage.innerHTML = /* html */ `<select id="provincesTreeType" style="display:block; margin-left:13px; font-size:11px">
      <option value="area" selected>Area</option>
      <option value="population">Total population</option>
      <option value="rural">Rural population</option>
      <option value="urban">Urban population</option>
    </select>`;
    alertMessage.innerHTML += `<div id='provinceInfo' class='chartInfo'>&#8205;</div>`;
    const svg = d3
      .select("#alertMessage")
      .insert("svg", "#provinceInfo")
      .attr("id", "provincesTree")
      .attr("width", width)
      .attr("height", height)
      .attr("font-size", "10px");
    const graph = svg.append("g").attr("transform", `translate(10, 0)`);
    document.getElementById("provincesTreeType").addEventListener("change", updateChart);

    treeLayout(root);

    const node = graph
      .selectAll("g")
      .data(root.leaves())
      .enter()
      .append("g")
      .attr("data-id", d => d.data.i)
      .on("mouseenter", d => showInfo(event, d))
      .on("mouseleave", d => hideInfo(event, d));

    function showInfo(ev, d) {
      d3.select(ev.target).select("rect").classed("selected", 1);
      const name = d.data.fullName;
      const state = pack.states[d.data.state].fullName;

      const area = getArea(d.data.area) + " " + getAreaUnit();
      const rural = rn(d.data.rural * populationRate);
      const urban = rn(d.data.urban * populationRate * urbanization);

      const value =
        provincesTreeType.value === "area"
          ? "Area: " + area
          : provincesTreeType.value === "rural"
          ? "Rural population: " + si(rural)
          : provincesTreeType.value === "urban"
          ? "Urban population: " + si(urban)
          : "Population: " + si(rural + urban);

      provinceInfo.innerHTML = /* html */ `${name}. ${state}. ${value}`;
      provinceHighlightOn(ev);
    }

    function hideInfo(ev) {
      provinceHighlightOff(ev);
      if (!document.getElementById("provinceInfo")) return;
      provinceInfo.innerHTML = "&#8205;";
      d3.select(ev.target).select("rect").classed("selected", 0);
    }

    node
      .append("rect")
      .attr("stroke", d => d.parent.data.color)
      .attr("stroke-width", 1)
      .attr("fill", d => d.data.color)
      .attr("x", d => d.x0)
      .attr("y", d => d.y0)
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0);

    node
      .append("text")
      .attr("dx", ".2em")
      .attr("dy", "1em")
      .attr("x", d => d.x0)
      .attr("y", d => d.y0);

    function hideNonfittingLabels() {
      node.select("text").each(function (d) {
        this.innerHTML = d.data.name;
        let b = this.getBBox();
        if (b.y + b.height > d.y1 + 1) this.innerHTML = "";

        for (let i = 0; i < 15 && b.width > 0 && b.x + b.width > d.x1; i++) {
          if (this.innerHTML.length < 3) {
            this.innerHTML = "";
            break;
          }
          this.innerHTML = this.innerHTML.slice(0, -2) + "…";
          b = this.getBBox();
        }
      });
    }

    function updateChart() {
      const value =
        this.value === "area"
          ? d => d.area
          : this.value === "rural"
          ? d => d.rural
          : this.value === "urban"
          ? d => d.urban
          : d => d.rural + d.urban;

      root.sum(value);
      node.data(treeLayout(root).leaves());

      node
        .select("rect")
        .transition()
        .duration(1500)
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0);

      node
        .select("text")
        .transition()
        .duration(1500)
        .attr("x", d => d.x0)
        .attr("y", d => d.y0);

      setTimeout(hideNonfittingLabels, 2000);
    }

    $("#alert").dialog({
      title: "Provinces chart",
      width: fitContent(),
      position: {my: "left bottom", at: "left+10 bottom-10", of: "svg"},
      buttons: {},
      close: () => {
        alertMessage.innerHTML = "";
      }
    });

    hideNonfittingLabels();
  }

  function toggleLabels() {
    const hidden = provs.select("#provinceLabels").style("display") === "none";
    provs.select("#provinceLabels").style("display", `${hidden ? "block" : "none"}`);
    provs.attr("data-labels", +hidden);
    provs.selectAll("text").call(d3.drag().on("drag", dragLabel)).classed("draggable", true);
  }

  function triggerProvincesRelease() {
    confirmationDialog({
      title: "Release provinces",
      message: `Are you sure you want to release all provinces?
          </br>It will turn all separable provinces into independent states.
          </br>Capital province and provinces without any burgs will state as they are`,
      confirm: "Release",
      onConfirm: () => {
        const oldStateIds = [];
        const newStateIds = [];

        body.querySelectorAll(":scope > div").forEach(el => {
          const provinceId = +el.dataset.id;
          const province = pack.provinces[provinceId];
          if (!province.burg) return;
          if (province.burg === pack.states[province.state].capital) return;
          if (province.burgs.some(burgId => pack.burgs[burgId].capital)) return;

          const [oldStateId, newStateId] = declareProvinceIndependence(provinceId);
          oldStateIds.push(oldStateId);
          newStateIds.push(newStateId);
        });

        updateStatesPostRelease(unique(oldStateIds), newStateIds);
      }
    });
  }

  function enterProvincesManualAssignent() {
    if (!layerIsOn("toggleProvinces")) toggleProvinces();
    if (!layerIsOn("toggleBorders")) toggleBorders();

    // make province and state borders more visible
    provinceBorders.select("path").attr("stroke", "#000").attr("stroke-width", 0.5);
    stateBorders.select("path").attr("stroke", "#000").attr("stroke-width", 1.2);

    customization = 11;
    provs.select("g#provincesBody").append("g").attr("id", "temp");
    provs
      .select("g#provincesBody")
      .append("g")
      .attr("id", "centers")
      .attr("fill", "none")
      .attr("stroke", "#ff0000")
      .attr("stroke-width", 1);

    document.querySelectorAll("#provincesBottom > *").forEach(el => (el.style.display = "none"));
    document.getElementById("provincesManuallyButtons").style.display = "inline-block";

    provincesEditor.querySelectorAll(".hide").forEach(el => el.classList.add("hidden"));
    provincesHeader.querySelector("div[data-sortby='state']").style.left = "7.7em";
    provincesFooter.style.display = "none";
    body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "none"));
    $("#provincesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});

    tip("Click on a province to select, drag the circle to change province", true);
    viewbox
      .style("cursor", "crosshair")
      .on("click", selectProvinceOnMapClick)
      .call(d3.drag().on("start", dragBrush))
      .on("touchmove mousemove", moveBrush);

    body.querySelector("div").classList.add("selected");
    selectProvince(+body.querySelector("div").dataset.id);
  }

  function selectProvinceOnLineClick() {
    if (customization !== 11) return;
    if (this.parentNode.id !== "provincesBodySection") return;
    body.querySelector("div.selected").classList.remove("selected");
    this.classList.add("selected");
    selectProvince(+this.dataset.id);
  }

  function selectProvinceOnMapClick() {
    const point = d3.mouse(this);
    const i = findCell(point[0], point[1]);
    if (pack.cells.h[i] < 20 || !pack.cells.state[i]) return;

    const assigned = provs.select("g#temp").select("polygon[data-cell='" + i + "']");
    const province = assigned.size() ? +assigned.attr("data-province") : pack.cells.province[i];

    const editorLine = body.querySelector("div[data-id='" + province + "']");
    if (!editorLine) {
      tip("You cannot select a province if it is not in the Editor list", false, "error");
      return;
    }

    body.querySelector("div.selected").classList.remove("selected");
    editorLine.classList.add("selected");
    selectProvince(province);
  }

  function selectProvince(p) {
    debug.selectAll("path.selected").remove();
    const path = provs.select("#province" + p).attr("d");
    debug.append("path").attr("class", "selected").attr("d", path);
  }

  function dragBrush() {
    const r = +provincesBrush.value;

    d3.event.on("drag", () => {
      if (!d3.event.dx && !d3.event.dy) return;
      const p = d3.mouse(this);
      moveCircle(p[0], p[1], r);

      const found = r > 5 ? findAll(p[0], p[1], r) : [findCell(p[0], p[1])];
      const selection = found.filter(isLand);
      if (selection) changeForSelection(selection);
    });
  }

  // change province within selection
  function changeForSelection(selection) {
    const temp = provs.select("#temp"),
      centers = provs.select("#centers");
    const selected = body.querySelector("div.selected");

    const provinceNew = +selected.dataset.id;
    const state = pack.provinces[provinceNew].state;
    const fill = pack.provinces[provinceNew].color || "#ffffff";

    selection.forEach(i => {
      if (!pack.cells.state[i] || pack.cells.state[i] !== state) return;
      const exists = temp.select("polygon[data-cell='" + i + "']");
      const provinceOld = exists.size() ? +exists.attr("data-province") : pack.cells.province[i];
      if (provinceNew === provinceOld) return;
      if (i === pack.provinces[provinceOld].center) {
        const center = centers.select("polygon[data-center='" + i + "']");
        if (!center.size()) centers.append("polygon").attr("data-center", i).attr("points", getPackPolygon(i));
        tip(
          "Province center cannot be assigned to a different region. Please remove the province first",
          false,
          "error"
        );
        return;
      }

      // change of append new element
      if (exists.size()) {
        if (pack.cells.province[i] === provinceNew) exists.remove();
        else exists.attr("data-province", provinceNew).attr("fill", fill);
      } else {
        temp
          .append("polygon")
          .attr("points", getPackPolygon(i))
          .attr("data-cell", i)
          .attr("data-province", provinceNew)
          .attr("fill", fill)
          .attr("stroke", "#555");
      }
    });
  }

  function moveBrush() {
    showMainTip();
    const point = d3.mouse(this);
    const radius = +provincesBrush.value;
    moveCircle(point[0], point[1], radius);
  }

  function applyProvincesManualAssignent() {
    provs
      .select("#temp")
      .selectAll("polygon")
      .each(function () {
        const i = +this.dataset.cell;
        pack.cells.province[i] = +this.dataset.province;
      });

    if (!layerIsOn("toggleBorders")) toggleBorders();
    else drawBorders();
    if (!layerIsOn("toggleProvinces")) toggleProvinces();
    else drawProvinces();
    exitProvincesManualAssignment();
    refreshProvincesEditor();
  }

  function exitProvincesManualAssignment(close) {
    customization = 0;
    provs.select("#temp").remove();
    provs.select("#centers").remove();
    removeCircle();

    // restore borders style
    provinceBorders.select("path").attr("stroke", null).attr("stroke-width", null);
    stateBorders.select("path").attr("stroke", null).attr("stroke-width", null);
    debug.selectAll("path.selected").remove();

    document.querySelectorAll("#provincesBottom > *").forEach(el => (el.style.display = "inline-block"));
    document.getElementById("provincesManuallyButtons").style.display = "none";

    provincesEditor.querySelectorAll(".hide:not(.show)").forEach(el => el.classList.remove("hidden"));
    provincesHeader.querySelector("div[data-sortby='state']").style.left = "22em";
    provincesFooter.style.display = "block";
    body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "all"));
    if (!close)
      $("#provincesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});

    restoreDefaultEvents();
    clearMainTip();
    const selected = body.querySelector("div.selected");
    if (selected) selected.classList.remove("selected");
  }

  function enterAddProvinceMode() {
    if (this.classList.contains("pressed")) return exitAddProvinceMode();

    customization = 12;
    this.classList.add("pressed");
    tip("Click on the map to place a new province center", true);
    viewbox.style("cursor", "crosshair").on("click", addProvince);
    body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "none"));
  }

  function addProvince() {
    const {cells, provinces} = pack;
    const point = d3.mouse(this);
    const center = findCell(point[0], point[1]);
    if (cells.h[center] < 20)
      return tip("You cannot place province into the water. Please click on a land cell", false, "error");

    const oldProvince = cells.province[center];
    if (oldProvince && provinces[oldProvince].center === center)
      return tip("The cell is already a center of a different province. Select other cell", false, "error");

    const state = cells.state[center];
    if (!state)
      return tip(
        "You cannot create a province in neutral lands. Please assign this land to a state first",
        false,
        "error"
      );

    if (d3.event.shiftKey === false) exitAddProvinceMode();

    const province = provinces.length;
    pack.states[state].provinces.push(province);
    const burg = cells.burg[center];
    const c = cells.culture[center];
    const name = burg ? pack.burgs[burg].name : Names.getState(Names.getCultureShort(c), c);
    const formName = oldProvince ? provinces[oldProvince].formName : "Province";
    const fullName = name + " " + formName;
    const stateColor = pack.states[state].color;
    const rndColor = getRandomColor();
    const color = stateColor[0] === "#" ? d3.color(d3.interpolate(stateColor, rndColor)(0.2)).hex() : rndColor;

    // generate emblem
    const kinship = burg ? 0.8 : 0.4;
    const parent = burg ? pack.burgs[burg].coa : pack.states[state].coa;
    const type = BurgsAndStates.getType(center, parent.port);
    const coa = COA.generate(parent, kinship, P(0.1), type);
    coa.shield = COA.getShield(c, state);
    COArenderer.add("province", province, coa, point[0], point[1]);

    provinces.push({i: province, state, center, burg, name, formName, fullName, color, coa});

    cells.province[center] = province;
    cells.c[center].forEach(c => {
      if (cells.h[c] < 20 || cells.state[c] !== state) return;
      if (provinces.find(p => !p.removed && p.center === c)) return;
      cells.province[c] = province;
    });

    if (!layerIsOn("toggleBorders")) toggleBorders();
    else drawBorders();
    if (!layerIsOn("toggleProvinces")) toggleProvinces();
    else drawProvinces();
    collectStatistics();
    document.getElementById("provincesFilterState").value = state;
    provincesEditorAddLines();
  }

  function exitAddProvinceMode() {
    customization = 0;
    restoreDefaultEvents();
    clearMainTip();
    body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "all"));
    if (provincesAdd.classList.contains("pressed")) provincesAdd.classList.remove("pressed");
  }

  function recolorProvinces() {
    const state = +document.getElementById("provincesFilterState").value;

    pack.provinces.forEach(p => {
      if (!p || p.removed) return;
      if (state !== -1 && p.state !== state) return;
      const stateColor = pack.states[p.state].color;
      const rndColor = getRandomColor();
      p.color = stateColor[0] === "#" ? d3.color(d3.interpolate(stateColor, rndColor)(0.2)).hex() : rndColor;
    });

    if (!layerIsOn("toggleProvinces")) toggleProvinces();
    else drawProvinces();
  }

  function downloadProvincesData() {
    const unit = areaUnit.value === "square" ? distanceUnitInput.value + "2" : areaUnit.value;
    let data = `Id,Province,Full Name,Form,State,Color,Capital,Area ${unit},Total Population,Rural Population,Urban Population,Burgs\n`; // headers

    body.querySelectorAll(":scope > div").forEach(function (el) {
      const key = parseInt(el.dataset.id);
      const provincePack = pack.provinces[key];
      data += el.dataset.id + ",";
      data += el.dataset.name + ",";
      data += provincePack.fullName + ",";
      data += el.dataset.form + ",";
      data += el.dataset.state + ",";
      data += el.dataset.color + ",";
      data += el.dataset.capital + ",";
      data += el.dataset.area + ",";
      data += el.dataset.population + ",";
      data += Math.round(provincePack.rural * populationRate) + ",";
      data += Math.round(provincePack.urban * populationRate * urbanization) + ",";
      data += el.dataset.burgs + "\n";
    });

    const name = getFileName("Provinces") + ".csv";
    downloadFile(data, name);
  }

  function removeAllProvinces() {
    alertMessage.innerHTML = /* html */ `Are you sure you want to remove all provinces? <br />This action cannot be reverted`;
    $("#alert").dialog({
      resizable: false,
      title: "Remove all provinces",
      buttons: {
        Remove: function () {
          $(this).dialog("close");

          // remove emblems
          document.querySelectorAll("[id^='provinceCOA']").forEach(el => el.remove());
          emblems.select("#provinceEmblems").selectAll("*").remove();

          // remove data
          pack.provinces = [0];
          pack.cells.province = new Uint16Array(pack.cells.i.length);
          pack.states.forEach(s => (s.provinces = []));

          unfog();
          if (!layerIsOn("toggleBorders")) toggleBorders();
          else drawBorders();
          provs.select("#provincesBody").remove();
          turnButtonOff("toggleProvinces");

          provincesEditorAddLines();
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function dragLabel() {
    const tr = parseTransform(this.getAttribute("transform"));
    const x = +tr[0] - d3.event.x,
      y = +tr[1] - d3.event.y;

    d3.event.on("drag", function () {
      const transform = `translate(${x + d3.event.x},${y + d3.event.y})`;
      this.setAttribute("transform", transform);
    });
  }

  function closeProvincesEditor() {
    provs.selectAll("text").call(d3.drag().on("drag", null)).attr("class", null);
    if (customization === 11) exitProvincesManualAssignment("close");
    if (customization === 12) exitAddProvinceMode();
  }
}

function updateLockStatus(provinceId, classList) {
  const p = pack.provinces[provinceId];
  p.lock = !p.lock;

  classList.toggle("icon-lock-open");
  classList.toggle("icon-lock");
}
