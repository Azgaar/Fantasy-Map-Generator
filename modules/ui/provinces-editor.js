"use strict";
function editProvinces() {
  if (customization) return;
  closeDialogs("#provincesEditor, .stable");
  if (!layerIsOn("toggleProvinces")) toggleProvinces();
  if (!layerIsOn("toggleBorders")) toggleBorders();
  if (layerIsOn("toggleStates")) toggleStates();
  if (layerIsOn("toggleCultures")) toggleCultures();

  const body = document.getElementById("provincesBodySection");
  refreshProvincesEditor();

  if (modules.editProvinces) return;
  modules.editProvinces = true;

  $("#provincesEditor").dialog({
    title: "Provinces Editor", resizable: false, width: fitContent(), close: closeProvincesEditor,
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
  document.getElementById("provincesAdd").addEventListener("click", enterAddProvinceMode);

  body.addEventListener("click", function(ev) {
    if (customization) return;
    const el = ev.target, cl = el.classList, line = el.parentNode, p = +line.dataset.id;
    if (cl.contains("zoneFill")) changeFill(el); else
    if (cl.contains("name")) editProvinceName(p); else
    if (cl.contains("icon-fleur")) provinceOpenCOA(ev, p); else
    if (cl.contains("icon-star-empty")) capitalZoomIn(p); else
    if (cl.contains("icon-flag-empty")) declareProvinceIndependence(p); else
    if (cl.contains("culturePopulation")) changePopulation(p); else
    if (cl.contains("icon-pin")) focusOn(p, cl); else
    if (cl.contains("icon-trash-empty")) removeProvince(p);
  });

  body.addEventListener("change", function(ev) {
    const el = ev.target, cl = el.classList, line = el.parentNode, p = +line.dataset.id;
    if (cl.contains("cultureBase")) changeCapital(p, line, el.value);
  });

  function refreshProvincesEditor() {
    collectStatistics();
    updateFilter();
    provincesEditorAddLines();
  }

  function collectStatistics() {
    const cells = pack.cells, provinces = pack.provinces;
    provinces.forEach(p => {
      if (!p.i || p.removed) return;
      p.area = p.rural = p.urban = 0;
      p.burgs = [];
    });

    for (const i of cells.i) {
      const p = cells.province[i];
      if (!p) continue;

      provinces[p].area += cells.area[i];
      provinces[p].rural += cells.pop[i];
      if (!cells.burg[i]) continue;
      provinces[p].urban += pack.burgs[cells.burg[i]].population;
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
    const statesSorted = pack.states.filter(s => s.i && !s.removed).sort((a, b) => (a.name > b.name) ? 1 : -1);
    statesSorted.forEach(s => stateFilter.options.add(new Option(s.name, s.i, false, s.i == selectedState)));
  }

  // add line for each state
  function provincesEditorAddLines() {
    const unit = areaUnit.value === "square" ? " " + distanceUnitInput.value + "²" : " " + areaUnit.value;
    const selectedState = +document.getElementById("provincesFilterState").value;
    let filtered = pack.provinces.filter(p => p.i && !p.removed); // all valid burgs
    if (selectedState != -1) filtered = filtered.filter(p => p.state === selectedState); // filtered by state
    body.innerHTML = "";
    let lines = "", totalArea = 0, totalPopulation = 0;

    for (const p of filtered) {
      const area = p.area * (distanceScaleInput.value ** 2);
      totalArea += area;
      const rural = p.rural * populationRate.value;
      const urban = p.urban * populationRate.value * urbanization.value;
      const population = rn(rural + urban);
      const populationTip = `Total population: ${si(population)}; Rural population: ${si(rural)}; Urban population: ${si(urban)}`;
      totalPopulation += population;

      const stateName = pack.states[p.state].name;
      const capital = p.burg ? pack.burgs[p.burg].name : '';
      const separable = p.burg && p.burg !== pack.states[p.state].capital;
      const focused = defs.select("#fog #focusProvince"+p.i).size();
      lines += `<div class="states" data-id=${p.i} data-name=${p.name} data-form=${p.formName} data-color="${p.color}" data-capital="${capital}" data-state="${stateName}" data-area=${area} data-population=${population}>
        <svg data-tip="Province fill style. Click to change" width=".9em" height=".9em" style="margin-bottom:-1px"><rect x="0" y="0" width="100%" height="100%" fill="${p.color}" class="zoneFill"></svg>
        <input data-tip="Province name. Click to change" class="name pointer" value="${p.name}" readonly>
        <span data-tip="Click to open province COA in the Iron Arachne Heraldry Generator. Ctrl + click to change the seed" class="icon-fleur pointer hide"></span>
        <input data-tip="Province form name. Click to change" class="name pointer hide" value="${p.formName}" readonly>
        <span data-tip="Province capital. Click to zoom into view" class="icon-star-empty pointer hide ${p.burg?'':'placeholder'}"></span>
        <select data-tip="Province capital. Click to select from burgs within the state. No capital means the province is governed from the state capital" class="cultureBase hide ${p.burgs.length?'':'placeholder'}">${p.burgs.length ? getCapitalOptions(p.burgs, p.burg) : ''}</select>
        <input data-tip="Province owner" class="provinceOwner" value="${stateName}" disabled">
        <span data-tip="Province area" style="padding-right: 4px" class="icon-map-o hide"></span>
        <div data-tip="Province area" class="biomeArea hide">${si(area) + unit}</div>
        <span data-tip="${populationTip}" class="icon-male hide"></span>
        <div data-tip="${populationTip}" class="culturePopulation hide">${si(population)}</div>
        <span data-tip="Declare province independence (turn province into a new state)" class="icon-flag-empty ${separable ? '' : 'placeholder'} hide"></span>
        <span data-tip="Toggle province focus" class="icon-pin ${focused?'':' inactive'} hide"></span>
        <span data-tip="Remove the province" class="icon-trash-empty hide"></span>
      </div>`;
    }
    body.innerHTML = lines;

    // update footer
    provincesFooterNumber.innerHTML = filtered.length;
    provincesFooterArea.innerHTML = filtered.length ? si(totalArea / filtered.length) + unit : 0 + unit;
    provincesFooterPopulation.innerHTML = filtered.length ? si(totalPopulation / filtered.length) : 0;
    provincesFooterArea.dataset.area = totalArea;
    provincesFooterPopulation.dataset.population = totalPopulation;

    body.querySelectorAll("div.states").forEach(el => {
      el.addEventListener("click", selectProvinceOnLineClick);
      el.addEventListener("mouseenter", ev => provinceHighlightOn(ev));
      el.addEventListener("mouseleave", ev => provinceHighlightOff(ev));
    });

    if (body.dataset.type === "percentage") {body.dataset.type = "absolute"; togglePercentageMode();}
    applySorting(provincesHeader);
    $("#provincesEditor").dialog({width: fitContent()});
  }

  function getCapitalOptions(burgs, capital) {
    let options = "";
    burgs.forEach(b => options += `<option ${b === capital ? "selected" : ""} value="${b}">${pack.burgs[b].name}</option>`);
    return options;
  }

  function provinceHighlightOn(event) {
    const province = +event.target.dataset.id;
    const el = body.querySelector(`div[data-id='${province}']`);
    if (el) el.classList.add("active");

    if (!layerIsOn("toggleProvinces")) return;
    if (customization) return;
    const animate = d3.transition().duration(2000).ease(d3.easeSinIn);
    provs.select("#province"+province).raise().transition(animate).attr("stroke-width", 2.5).attr("stroke", "#d0240f");
  }

  function provinceHighlightOff(event) {
    const province = +event.target.dataset.id;
    const el = body.querySelector(`div[data-id='${province}']`);
    if (el) el.classList.remove("active");

    if (!layerIsOn("toggleProvinces")) return;
    provs.select("#province"+province).transition().attr("stroke-width", null).attr("stroke", null);
  }

  function changeFill(el) {
    const currentFill = el.getAttribute("fill");
    const p = +el.parentNode.parentNode.dataset.id;

    const callback = function(fill) {
      el.setAttribute("fill", fill);
      pack.provinces[p].color = fill;
      const g = provs.select("#provincesBody");
      g.select("#province"+p).attr("fill", fill);
      g.select("#province-gap"+p).attr("stroke", fill);
    }

    openPicker(currentFill, callback);
  }

  function provinceOpenCOA(event, p) {
    const defSeed = `${seed}-p${p}`;

    if (event.ctrlKey) {
      const newSeed = prompt(`Please provide an Iron Arachne Heraldry Generator seed. `+ 
        `Default seed is a combination of FMG map seed and province id (${defSeed})`, pack.provinces[p].IAHG || defSeed);
      if (newSeed && newSeed != defSeed) pack.provinces[p].IAHG = newSeed; else return;
    }

    const s = pack.provinces[p].IAHG || defSeed;
    openURL("https://ironarachne.com/heraldry/" + s);
  }

  function capitalZoomIn(p) {
    const capital = pack.provinces[p].burg;
    const l = burgLabels.select("[data-id='" + capital + "']");
    const x = +l.attr("x"), y = +l.attr("y");
    zoomTo(x, y, 8, 2000);
  }

  function declareProvinceIndependence(p) {
    const states = pack.states, provinces = pack.provinces, cells = pack.cells;
    const oldState = pack.provinces[p].state;
    const newState = pack.states.length;

    // turn province burg into a capital
    const burg = provinces[p].burg;
    if (!burg) return;
    pack.burgs[burg].capital = 1;
    moveBurgToGroup(burg, "cities");

    // move all burgs to a new state
    provinces[p].burgs.forEach(b => pack.burgs[b].state = newState);

    // difine new state attributes
    const center = pack.burgs[burg].cell;
    const culture = pack.burgs[burg].culture;
    const name = provinces[p].name;
    const color = getRandomColor();

    // update cells
    cells.i.filter(i => cells.province[i] === p).forEach(i => {
        cells.province[i] = 0;
        cells.state[i] = newState;
    });

    // update diplomacy and reverse relations
    const diplomacy = states.map(s => {
      if (!s.i) return "x";
      let relations = states[oldState].diplomacy[s.i]; // relations between Nth state and old overlord
      if (s.i === oldState) relations = "Enemy"; // new state is Enemy to its old overlord
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
    states[0].diplomacy.push([`Independance declaration`, `${name} declared its independance from ${states[oldState].name}`]);

    // create new state
    states.push({i:newState, name, diplomacy, provinces:[], color, expansionism:.5, capital:burg, type:"Generic", center, culture});
    BurgsAndStates.collectStatistics();
    BurgsAndStates.defineStateForms([newState]);

    if (layerIsOn("toggleProvinces")) toggleProvinces();
    if (!layerIsOn("toggleStates")) toggleStates(); else drawStates();
    if (!layerIsOn("toggleBorders")) toggleBorders(); else drawBorders();
    BurgsAndStates.drawStateLabels([newState, oldState]);

    // remove old province
    unfocus(p);
    if (states[oldState].provinces.includes(p)) states[oldState].provinces.splice(states[oldState].provinces.indexOf(p), 1);
    provinces[p].removed = true;

    closeDialogs();
    editStates();
  }

  function changePopulation(province) {
    const p = pack.provinces[province];
    const cells = pack.cells.i.filter(i => pack.cells.province[i] === province);
    if (!cells.length) {tip("Province does not have any cells, cannot change population", false, "error"); return;}
    const rural = rn(p.rural * populationRate.value);
    const urban = rn(p.urban * populationRate.value * urbanization.value);
    const total = rural + urban;
    const l = n => Number(n).toLocaleString();

    alertMessage.innerHTML = `
    Rural: <input type="number" min=0 step=1 id="ruralPop" value=${rural} style="width:6em">
    Urban: <input type="number" min=0 step=1 id="urbanPop" value=${urban} style="width:6em" ${p.burgs.length?'':"disabled"}>
    <p>Total population: ${l(total)} ⇒ <span id="totalPop">${l(total)}</span> (<span id="totalPopPerc">100</span>%)</p>`;

    const update = function() {
      const totalNew = ruralPop.valueAsNumber + urbanPop.valueAsNumber;
      if (isNaN(totalNew)) return;
      totalPop.innerHTML = l(totalNew);
      totalPopPerc.innerHTML = rn(totalNew / total * 100);
    }

    ruralPop.oninput = () => update();
    urbanPop.oninput = () => update();

    $("#alert").dialog({
      resizable: false, title: "Change province population", width: "24em", buttons: {
        Apply: function() {applyPopulationChange(); $(this).dialog("close");},
        Cancel: function() {$(this).dialog("close");}
      }, position: {my: "center", at: "center", of: "svg"}
    });

    function applyPopulationChange() {
      const ruralChange = ruralPop.value / rural;
      if (isFinite(ruralChange) && ruralChange !== 1) {
        cells.forEach(i => pack.cells.pop[i] *= ruralChange);
      }
      if (!isFinite(ruralChange) && +ruralPop.value > 0) {
        const points = ruralPop.value / populationRate.value;
        const pop = rn(points / cells.length);
        cells.forEach(i => pack.cells.pop[i] = pop);
      }

      const urbanChange = urbanPop.value / urban;
      if (isFinite(urbanChange) && urbanChange !== 1) {
        p.burgs.forEach(b => pack.burgs[b].population = rn(pack.burgs[b].population * urbanChange, 4));
      }
      if (!isFinite(urbanChange) && +urbanPop.value > 0) {
        const points = urbanPop.value / populationRate.value / urbanization.value;
        const population = rn(points / burgs.length, 4);
        p.burgs.forEach(b => pack.burgs[b].population = population);
      }

      refreshProvincesEditor();
    }

  }

  function focusOn(p, cl) {
    const inactive = cl.contains("inactive");
    cl.toggle("inactive");

    if (inactive) {
      if (defs.select("#fog #focusProvince"+p).size()) return;
      fogging.attr("display", "block");
      const path = provs.select("#province"+p).attr("d");
      defs.select("#fog").append("path").attr("d", path).attr("fill", "black").attr("id", "focusProvince"+p);
      fogging.append("path").attr("d", path).attr("id", "focusProvinceHalo"+p)
        .attr("fill", "none").attr("stroke", pack.provinces[p].color).attr("filter", "url(#blur5)");
    } else unfocus(p);
  }

  function unfocus(p) {
    defs.select("#focusProvince"+p).remove();
    fogging.select("#focusProvinceHalo"+p).remove();
    if (!defs.selectAll("#fog path").size()) fogging.attr("display", "none"); // all items are de-focused
  }

  function removeProvince(p) {
    pack.cells.province.forEach((province, i) => {if(province === p) pack.cells.province[i] = 0;});
    const state = pack.provinces[p].state;
    if (pack.states[state].provinces.includes(p)) pack.states[state].provinces.splice(pack.states[state].provinces.indexOf(p), 1);
    pack.provinces[p].removed = true;
    unfocus(p);

    const g = provs.select("#provincesBody");
    g.select("#province"+p).remove();
    g.select("#province-gap"+p).remove();
    if (!layerIsOn("toggleBorders")) toggleBorders(); else drawBorders();
    refreshProvincesEditor();
  }

  function editProvinceName(province) {
    const p = pack.provinces[province];
    document.getElementById("provinceNameEditor").dataset.province = province;
    document.getElementById("provinceNameEditorShort").value = p.name;
    applyOption(provinceNameEditorSelectForm, p.formName)
    document.getElementById("provinceNameEditorFull").value = p.fullName;

    $("#provinceNameEditor").dialog({
      resizable: false, title: "Change province name", width: "22em", buttons: {
        Apply: function() {applyNameChange(p); $(this).dialog("close");},
        Cancel: function() {$(this).dialog("close");}
      }, position: {my: "center", at: "center", of: "svg"}
    });

    if (modules.editProvinceName) return;
    modules.editProvinceName = true;

    // add listeners
    document.getElementById("provinceNameEditorShortCulture").addEventListener("click", regenerateShortNameCuture);
    document.getElementById("provinceNameEditorShortRandom").addEventListener("click", regenerateShortNameRandom);
    document.getElementById("provinceNameEditorAddForm").addEventListener("click", addCustomForm);
    document.getElementById("provinceNameEditorFullRegenerate").addEventListener("click", regenerateFullName);

    function regenerateShortNameCuture() {
      const province = +provinceNameEditor.dataset.province;
      const culture = pack.cells.culture[pack.provinces[province].center];
      const name = Names.getState(Names.getCultureShort(culture), culture);
      document.getElementById("provinceNameEditorShort").value = name;
    }

    function regenerateShortNameRandom() {
      const base = rand(nameBase.length-1);
      const name = Names.getState(Names.getBase(base), undefined, base);
      document.getElementById("provinceNameEditorShort").value = name;
    }

    function addCustomForm() {
      const value = provinceNameEditorCustomForm.value;
      const displayed = provinceNameEditorCustomForm.style.display === "inline-block";
      provinceNameEditorCustomForm.style.display = displayed ? "none" : "inline-block";
      provinceNameEditorSelectForm.style.display = displayed ? "inline-block" : "none";
      if (displayed && value) applyOption(provinceNameEditorSelectForm, value);
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
      provs.select("#provinceLabel"+p.i).text(p.name);
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
      const totalArea = +provincesFooterArea.dataset.area;
      const totalPopulation = +provincesFooterPopulation.dataset.population;

      body.querySelectorAll(":scope > div").forEach(function(el) {
        el.querySelector(".biomeArea").innerHTML = rn(+el.dataset.area / totalArea * 100) + "%";
        el.querySelector(".culturePopulation").innerHTML = rn(+el.dataset.population / totalPopulation * 100) + "%";
      });
    } else {
      body.dataset.type = "absolute";
      provincesEditorAddLines();
    }
  }

  function showChart() {
    // build hierarchy tree
    const states = pack.states.map(s => {
      return {id:s.i, state: s.i?0:null, color: s.i && s.color[0] === "#" ? d3.color(s.color).darker() : "#666"}
    });
    const provinces = pack.provinces.filter(p => p.i && !p.removed).map(p => {
      return {id:p.i+states.length-1, i:p.i, state:p.state, color:p.color, 
        name:p.name, fullName:p.fullName, area:p.area, urban:p.urban, rural:p.rural}
    });
    const data = states.concat(provinces);
    const root = d3.stratify().parentId(d => d.state)(data).sum(d => d.area);

    const width = 300 + 300 * uiSizeOutput.value, height = 90 + 90 * uiSizeOutput.value;
    const margin = {top: 10, right: 10, bottom: 0, left: 10};
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;
    const treeLayout = d3.treemap().size([w, h]).padding(2);

    // prepare svg
    alertMessage.innerHTML = `<select id="provincesTreeType" style="display:block; margin-left:13px; font-size:11px">
      <option value="area" selected>Area</option>
      <option value="population">Total population</option>
      <option value="rural">Rural population</option>
      <option value="urban">Urban population</option>
    </select>`;
    alertMessage.innerHTML += `<div id='provinceInfo' class='chartInfo'>&#8205;</div>`;
    const svg = d3.select("#alertMessage").insert("svg", "#provinceInfo").attr("id", "provincesTree")
      .attr("width", width).attr("height", height).attr("font-size", "10px");
    const graph = svg.append("g").attr("transform", `translate(10, 0)`);
    document.getElementById("provincesTreeType").addEventListener("change", updateChart);

    treeLayout(root);

    const node = graph.selectAll("g").data(root.leaves()).enter()
      .append("g").attr("data-id", d => d.data.i)
      .on("mouseenter", d => showInfo(event, d))
      .on("mouseleave", d => hideInfo(event, d));

    function showInfo(ev, d) {
      d3.select(ev.target).select("rect").classed("selected", 1);
      const name = d.data.fullName;
      const state = pack.states[d.data.state].fullName;

      const unit = areaUnit.value === "square" ? " " + distanceUnitInput.value + "²" : " " + areaUnit.value;
      const area = d.data.area * (distanceScaleInput.value ** 2) + unit;
      const rural = rn(d.data.rural * populationRate.value);
      const urban = rn(d.data.urban * populationRate.value * urbanization.value);

      const value = provincesTreeType.value === "area" ? "Area: " + area
        : provincesTreeType.value === "rural" ? "Rural population: " + si(rural)
        : provincesTreeType.value === "urban" ? "Urban population: " + si(urban)
        : "Population: " + si(rural + urban);

      provinceInfo.innerHTML = `${name}. ${state}. ${value}`;
      provinceHighlightOn(ev);
    }

    function hideInfo(ev) {
      provinceHighlightOff(ev);
      if (!document.getElementById("provinceInfo")) return;
      provinceInfo.innerHTML = "&#8205;";
      d3.select(ev.target).select("rect").classed("selected", 0);
    }

    node.append("rect").attr("stroke", d => d.parent.data.color)
      .attr("stroke-width", 1).attr("fill", d => d.data.color)
      .attr("x", d => d.x0).attr("y", d => d.y0)
      .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0);

    node.append("text").attr("dx", ".2em").attr("dy", "1em")
      .attr("x", d => d.x0).attr("y", d => d.y0);

    function hideNonfittingLabels() {
      node.select("text").each(function(d) {
        this.innerHTML = d.data.name;
        let b = this.getBBox();
        if (b.y + b.height > d.y1 + 1) this.innerHTML = "";

        for(let i=0; i < 15 && b.width > 0 && b.x + b.width > d.x1; i++) {
          if (this.innerHTML.length < 3) {this.innerHTML = ""; break;}
          this.innerHTML = this.innerHTML.slice(0, -2) + "…";
          b = this.getBBox();
        }
      })

    }

    function updateChart() {
      const value = this.value === "area" ? d => d.area
        : this.value === "rural" ? d => d.rural
        : this.value === "urban" ? d => d.urban
        : d => d.rural + d.urban;

      root.sum(value);
      node.data(treeLayout(root).leaves());

      node.select("rect").transition().duration(1500)
        .attr("x", d => d.x0).attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0);

      node.select("text").transition().duration(1500)
        .attr("x", d => d.x0).attr("y", d => d.y0);

      setTimeout(hideNonfittingLabels, 2000);
    }

    $("#alert").dialog({
      title: "Provinces chart", width: fitContent(),
      position: {my: "left bottom", at: "left+10 bottom-10", of: "svg"}, buttons: {},
      close: () => {alertMessage.innerHTML = "";}
    });

    hideNonfittingLabels();
  }

  function toggleLabels() {
    const hidden = provs.select("#provinceLabels").style("display") === "none";
    provs.select("#provinceLabels").style("display", `${hidden ? "block" : "none"}`);
    provs.attr("data-labels", +hidden);
  }

  function enterProvincesManualAssignent() {
    if (!layerIsOn("toggleProvinces")) toggleProvinces();
    if (!layerIsOn("toggleBorders")) toggleBorders();

    customization = 11;
    provs.select("g#provincesBody").append("g").attr("id", "temp");
    provs.select("g#provincesBody").append("g").attr("id", "centers")
      .attr("fill", "none").attr("stroke", "#ff0000").attr("stroke-width", 1);

    document.querySelectorAll("#provincesBottom > *").forEach(el => el.style.display = "none");
    document.getElementById("provincesManuallyButtons").style.display = "inline-block";

    provincesEditor.querySelectorAll(".hide").forEach(el => el.classList.add("hidden"));
    provincesHeader.querySelector("div[data-sortby='state']").style.left = "7.7em";
    provincesFooter.style.display = "none";
    body.querySelectorAll("div > input, select, span, svg").forEach(e => e.style.pointerEvents = "none");
    $("#provincesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});

    tip("Click on a province to select, drag the circle to change province", true);
    viewbox.style("cursor", "crosshair")
      .on("click", selectProvinceOnMapClick)
      .call(d3.drag().on("start", dragBrush))
      .on("touchmove mousemove", moveBrush);

    body.querySelector("div").classList.add("selected");
  }

  function selectProvinceOnLineClick() {
    if (customization !== 11) return;
    if (this.parentNode.id !== "provincesBodySection") return;
    body.querySelector("div.selected").classList.remove("selected");
    this.classList.add("selected");
  }

  function selectProvinceOnMapClick() {
    const point = d3.mouse(this);
    const i = findCell(point[0], point[1]);
    if (pack.cells.h[i] < 20 || !pack.cells.state[i]) return;

    const assigned = provs.select("g#temp").select("polygon[data-cell='"+i+"']");
    const province = assigned.size() ? +assigned.attr("data-province") : pack.cells.province[i];

    const editorLine = body.querySelector("div[data-id='"+province+"']");
    if (!editorLine) {tip("You cannot select a province if it is not in the Editor list", false, "error"); return;}

    body.querySelector("div.selected").classList.remove("selected");
    editorLine.classList.add("selected");
  }

  function dragBrush() {
    const r = +provincesManuallyBrush.value;

    d3.event.on("drag", () => {
      if (!d3.event.dx && !d3.event.dy) return;
      const p = d3.mouse(this);
      moveCircle(p[0], p[1], r);

      const found = r > 5 ? findAll(p[0], p[1], r) : [findCell(p[0], p[1], r)];
      const selection = found.filter(isLand);
      if (selection) changeForSelection(selection);
    });
  }

  // change province within selection
  function changeForSelection(selection) {
    const temp = provs.select("#temp"), centers = provs.select("#centers");
    const selected = body.querySelector("div.selected");

    const provinceNew = +selected.dataset.id;
    const state = pack.provinces[provinceNew].state;
    const fill = pack.provinces[provinceNew].color || "#ffffff";
    const stroke = d3.color(fill).darker(.2).hex();

    selection.forEach(i => {
      if (!pack.cells.state[i] || pack.cells.state[i] !== state) return;
      const exists = temp.select("polygon[data-cell='"+i+"']");
      const provinceOld = exists.size() ? +exists.attr("data-province") : pack.cells.province[i];
      if (provinceNew === provinceOld) return;
      if (i === pack.provinces[provinceOld].center) {
        const center = centers.select("polygon[data-center='"+i+"']");
        if (!center.size()) centers.append("polygon").attr("data-center", i).attr("points", getPackPolygon(i));
        tip("Province center cannot be assigned to a different region. Please remove the province first", false, "error"); 
        return;
      }

      // change of append new element
      if (exists.size()) exists.attr("data-province", provinceNew).attr("fill", fill).attr("stroke", stroke);
      else temp.append("polygon").attr("points", getPackPolygon(i))
        .attr("data-cell", i).attr("data-province", provinceNew)
        .attr("fill", fill).attr("stroke", stroke);
    });
  }

  function moveBrush() {
    showMainTip();
    const point = d3.mouse(this);
    const radius = +provincesManuallyBrush.value;
    moveCircle(point[0], point[1], radius);
  }

  function applyProvincesManualAssignent() {
    provs.select("#temp").selectAll("polygon").each(function() {
      const i = +this.dataset.cell;
      pack.cells.province[i] = +this.dataset.province;;
    });

    if (!layerIsOn("toggleBorders")) toggleBorders(); else drawBorders();
    if (!layerIsOn("toggleProvinces")) toggleProvinces(); else drawProvinces();
    exitProvincesManualAssignment();
    refreshProvincesEditor();
  }

  function exitProvincesManualAssignment(close) {
    customization = 0;
    provs.select("#temp").remove();
    provs.select("#centers").remove();
    removeCircle();

    document.querySelectorAll("#provincesBottom > *").forEach(el => el.style.display = "inline-block");
    document.getElementById("provincesManuallyButtons").style.display = "none";

    provincesEditor.querySelectorAll(".hide:not(.show)").forEach(el => el.classList.remove("hidden"));
    provincesHeader.querySelector("div[data-sortby='state']").style.left = "22em";
    provincesFooter.style.display = "block";
    body.querySelectorAll("div > input, select, span, svg").forEach(e => e.style.pointerEvents = "all");
    if(!close) $("#provincesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});

    restoreDefaultEvents();
    clearMainTip();
    const selected = body.querySelector("div.selected");
    if (selected) selected.classList.remove("selected");
  }

  function enterAddProvinceMode() {
    if (this.classList.contains("pressed")) {exitAddProvinceMode(); return;};
    customization = 12;
    this.classList.add("pressed");
    tip("Click on the map to place a new province center", true);
    viewbox.style("cursor", "crosshair").on("click", addProvince);
    body.querySelectorAll("div > input, select, span, svg").forEach(e => e.style.pointerEvents = "none");
  }

  function addProvince() {
    const cells = pack.cells, provinces = pack.provinces;
    const point = d3.mouse(this);
    const center = findCell(point[0], point[1]);
    if (cells.h[center] < 20) {tip("You cannot place province into the water. Please click on a land cell", false, "error"); return;}
    const oldProvince = cells.province[center];
    if (oldProvince && provinces[oldProvince].center === center) {tip("The cell is already a center of a different province. Select other cell", false, "error"); return;}
    const state = cells.state[center];
    if (!state) {tip("You cannot create a province in neutral lands. Please assign this land to a state first", false, "error"); return;}

    if (d3.event.shiftKey === false) exitAddProvinceMode();

    const province = provinces.length;
    pack.states[state].provinces.push(province);
    const burg = cells.burg[center];
    const c = cells.culture[center];
    const name = burg ? pack.burgs[burg].name : Names.getState(Names.getCultureShort(c), c);
    const formName = oldProvince ? provinces[oldProvince].formName : "Province";
    const fullName = name + " " + formName;
    const stateColor = pack.states[state].color, rndColor = getRandomColor();
    const color = stateColor[0] === "#" ? d3.color(d3.interpolate(stateColor, rndColor)(.2)).hex() : rndColor;
    provinces.push({i:province, state, center, burg, name, formName, fullName, color});

    cells.province[center] = province;
    cells.c[center].forEach(c => {
      if (cells.h[c] < 20 || cells.state[c] !== state) return;
      if (provinces.find(p => !p.removed && p.center === c)) return;
      cells.province[c] = province;
    });

    if (!layerIsOn("toggleBorders")) toggleBorders(); else drawBorders();
    if (!layerIsOn("toggleProvinces")) toggleProvinces(); else drawProvinces();
    collectStatistics();
    document.getElementById("provincesFilterState").value = state;
    provincesEditorAddLines();
  }

  function exitAddProvinceMode() {
    customization = 0;
    restoreDefaultEvents();
    clearMainTip();
    body.querySelectorAll("div > input, select, span, svg").forEach(e => e.style.pointerEvents = "all");
    if (provincesAdd.classList.contains("pressed")) provincesAdd.classList.remove("pressed");
  }

  function downloadProvincesData() {
    const unit = areaUnit.value === "square" ? distanceUnitInput.value + "2" : areaUnit.value;
    let data = "Id,Province,Form,State,Color,Capital,Area "+unit+",Population\n"; // headers

    body.querySelectorAll(":scope > div").forEach(function(el) {
      data += el.dataset.id + ",";
      data += el.dataset.name + ",";
      data += el.dataset.form + ",";
      data += el.dataset.state + ",";
      data += el.dataset.color + ",";
      data += el.dataset.capital + ",";
      data += el.dataset.area + ",";
      data += el.dataset.population + "\n";
    });

    const dataBlob = new Blob([data], {type: "text/plain"});
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    document.body.appendChild(link);
    link.download = getFileName("Provinces") + ".csv";
    link.href = url;
    link.click();
    window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 2000);
  }

  function removeAllProvinces() {
    alertMessage.innerHTML = `Are you sure you want to remove all provinces?`;
    $("#alert").dialog({resizable: false, title: "Remove all provinces",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          pack.provinces.filter(p => p.i).forEach(p => {
            p.removed = true;
            unfocus(p.i);
          });
          pack.cells.i.forEach(i => pack.cells.province[i] = 0);
          pack.states.filter(s => s.i && !s.removed).forEach(s => s.provinces = []);

          if (!layerIsOn("toggleBorders")) toggleBorders(); else drawBorders();
          provs.select("#provincesBody").remove();
          turnButtonOff("toggleProvinces");

          provincesEditorAddLines();
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }

  function closeProvincesEditor() {
    if (customization === 11) exitProvincesManualAssignment("close");
    if (customization === 12) exitAddProvinceMode();
  }

}

