"use strict";
function editReligions() {
  if (customization) return;
  closeDialogs("#religionsEditor, .stable");
  if (!layerIsOn("toggleReligions")) toggleReligions();
  if (layerIsOn("toggleCultures")) toggleCultures();
  if (layerIsOn("toggleStates")) toggleStates();
  if (layerIsOn("toggleBiomes")) toggleBiomes();
  if (layerIsOn("toggleProvinces")) toggleProvinces();

  const body = document.getElementById("religionsBody");
  const animate = d3.transition().duration(1500).ease(d3.easeSinIn);
  refreshReligionsEditor();
  drawReligionCenters();

  if (modules.editReligions) return;
  modules.editReligions = true;

  $("#religionsEditor").dialog({
    title: "Religions Editor", resizable: false, width: fitContent(), close: closeReligionsEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg"}
  });

  // add listeners
  document.getElementById("religionsEditorRefresh").addEventListener("click", refreshReligionsEditor);
  document.getElementById("religionsEditStyle").addEventListener("click", () => editStyle("relig"));
  document.getElementById("religionsLegend").addEventListener("click", toggleLegend);
  document.getElementById("religionsPercentage").addEventListener("click", togglePercentageMode);
  document.getElementById("religionsHeirarchy").addEventListener("click", showHierarchy);
  document.getElementById("religionsExtinct").addEventListener("click", toggleExtinct);
  document.getElementById("religionsManually").addEventListener("click", enterReligionsManualAssignent);
  document.getElementById("religionsManuallyApply").addEventListener("click", applyReligionsManualAssignent);
  document.getElementById("religionsManuallyCancel").addEventListener("click", () => exitReligionsManualAssignment());
  document.getElementById("religionsAdd").addEventListener("click", enterAddReligionMode);
  document.getElementById("religionsExport").addEventListener("click", downloadReligionsData);

  function refreshReligionsEditor() {
    religionsCollectStatistics();
    religionsEditorAddLines();
  }

  function religionsCollectStatistics() {
    const cells = pack.cells, religions = pack.religions;
    religions.forEach(r => r.cells = r.area = r.rural = r.urban = 0);

    for (const i of cells.i) {
      if (cells.h[i] < 20) continue;
      const r = cells.religion[i];
      religions[r].cells += 1;
      religions[r].area += cells.area[i];
      religions[r].rural += cells.pop[i];
      if (cells.burg[i]) religions[r].urban += pack.burgs[cells.burg[i]].population;
    }
  }

  // add line for each religion
  function religionsEditorAddLines() {
    const unit = areaUnit.value === "square" ? " " + distanceUnitInput.value + "²" : " " + areaUnit.value;
    let lines = "", totalArea = 0, totalPopulation = 0;

    for (const r of pack.religions) {
      if (r.removed) continue;

      const area = r.area * (distanceScaleInput.value ** 2);
      const rural = r.rural * populationRate.value;
      const urban = r.urban * populationRate.value * urbanization.value;
      const population = rn(rural + urban);
      if (r.i && !r.cells && body.dataset.extinct !== "show") continue; // hide extinct religions
      const populationTip = `Believers: ${si(population)}; Rural areas: ${si(rural)}; Urban areas: ${si(urban)}. Click to change`;
      totalArea += area;
      totalPopulation += population;

      if (r.i) {
        lines += `<div class="states religions" data-id=${r.i} data-name="${r.name}" data-color="${r.color}" data-area=${area} 
          data-population=${population} data-type=${r.type} data-form=${r.form} data-deity="${r.deity?r.deity:''}" data-expansionism=${r.expansionism}>
          <svg data-tip="Religion fill style. Click to change" width=".9em" height=".9em" style="margin-bottom:-1px"><rect x="0" y="0" width="100%" height="100%" fill="${r.color}" class="zoneFill"></svg>
          <input data-tip="Religion name. Click and type to change" class="religionName" value="${r.name}" autocorrect="off" spellcheck="false">
          <select data-tip="Religion type" class="religionType">${getTypeOptions(r.type)}</select>
          <input data-tip="Religion form" class="religionForm hide" value="${r.form}" autocorrect="off" spellcheck="false">
          <span data-tip="Click to re-generate supreme deity" class="icon-arrows-cw hide"></span>
          <input data-tip="Religion supreme deity" class="religionDeity hide" value="${r.deity?r.deity:''}" autocorrect="off" spellcheck="false">
          <span data-tip="Religion area" style="padding-right: 4px" class="icon-map-o hide"></span>
          <div data-tip="Religion area" class="biomeArea hide">${si(area) + unit}</div>
          <span data-tip="${populationTip}" class="icon-male hide"></span>
          <div data-tip="${populationTip}" class="culturePopulation hide">${si(population)}</div>
          <span data-tip="Remove religion" class="icon-trash-empty hide"></span>
        </div>`;
      } else {
        // No religion (neutral) line
        lines += `<div class="states" data-id=${r.i} data-name="${r.name}" data-color="" data-area=${area} data-population=${population} data-type="" data-form="" data-deity="" data-expansionism="">
          <svg width="9" height="9" class="placeholder"></svg>
          <input data-tip="Religion name. Click and type to change" class="religionName italic" value="${r.name}" autocorrect="off" spellcheck="false">
          <select data-tip="Religion type" class="religionType placeholder">${getTypeOptions(r.type)}</select>
          <input data-tip="Religion form" class="religionForm placeholder hide" value="" autocorrect="off" spellcheck="false">
          <span data-tip="Click to re-generate supreme deity" class="icon-arrows-cw placeholder hide"></span>
          <input data-tip="Religion supreme deity" class="religionDeity placeholder hide" value="" autocorrect="off" spellcheck="false">
          <span data-tip="Religion area" style="padding-right: 4px" class="icon-map-o hide"></span>
          <div data-tip="Religion area" class="biomeArea hide">${si(area) + unit}</div>
          <span data-tip="${populationTip}" class="icon-male hide"></span>
          <div data-tip="${populationTip}" class="culturePopulation hide">${si(population)}</div>
        </div>`;
      }
    }
    body.innerHTML = lines;

    // update footer
    const valid = pack.religions.filter(r => r.i && !r.removed);
    religionsOrganized.innerHTML = valid.filter(r => r.type === "Organized").length;
    religionsHeresies.innerHTML = valid.filter(r => r.type === "Heresy").length;
    religionsCults.innerHTML = valid.filter(r => r.type === "Cult").length;
    religionsFolk.innerHTML = valid.filter(r => r.type === "Folk").length;
    religionsFooterArea.innerHTML = si(totalArea) + unit;
    religionsFooterPopulation.innerHTML = si(totalPopulation);
    religionsFooterArea.dataset.area = totalArea;
    religionsFooterPopulation.dataset.population = totalPopulation;

    // add listeners
    body.querySelectorAll("div.religions").forEach(el => el.addEventListener("mouseenter", ev => religionHighlightOn(ev)));
    body.querySelectorAll("div.religions").forEach(el => el.addEventListener("mouseleave", ev => religionHighlightOff(ev)));
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("click", selectReligionOnLineClick));
    body.querySelectorAll("rect.zoneFill").forEach(el => el.addEventListener("click", religionChangeColor));
    body.querySelectorAll("div > input.religionName").forEach(el => el.addEventListener("input", religionChangeName));
    body.querySelectorAll("div > select.religionType").forEach(el => el.addEventListener("change", religionChangeType));
    body.querySelectorAll("div > input.religionForm").forEach(el => el.addEventListener("input", religionChangeForm));
    body.querySelectorAll("div > input.religionDeity").forEach(el => el.addEventListener("input", religionChangeDeity));
    body.querySelectorAll("div > span.icon-arrows-cw").forEach(el => el.addEventListener("click", regenerateDeity));
    body.querySelectorAll("div > div.culturePopulation").forEach(el => el.addEventListener("click", changePopulation));
    body.querySelectorAll("div > span.icon-trash-empty").forEach(el => el.addEventListener("click", religionRemove));

    if (body.dataset.type === "percentage") {body.dataset.type = "absolute"; togglePercentageMode();}
    applySorting(religionsHeader);
    $("#religionsEditor").dialog({width: fitContent()});
  }

  function getTypeOptions(type) {
    let options = "";
    const types = ["Folk", "Organized", "Cult", "Heresy"];
    types.forEach(t => options += `<option ${type === t ? "selected" : ""} value="${t}">${t}</option>`);
    return options;
  }

  function religionHighlightOn(event) {
    const religion = +event.target.dataset.id;
    const info = document.getElementById("religionInfo");
    if (info) {
      d3.select("#religionHierarchy").select("g[data-id='"+religion+"'] > path").classed("selected", 1);
      const r = pack.religions[religion];
      const type = r.name.includes(r.type) ? "" 
        : r.type === "Folk" || r.type === "Organized" 
        ? ". " + r.type + " religion" : ". " + r.type;
      const form = r.form === r.type || r.name.includes(r.form) ? "" : ". " + r.form;
      const rural = r.rural * populationRate.value;
      const urban = r.urban * populationRate.value * urbanization.value;
      const population = rural + urban > 0 ? ". " + si(rn(rural + urban)) + " believers" : ". Extinct";
      info.innerHTML = `${r.name}${type}${form}${population}`;
      tip("Drag to change parent. Hold CTRL and click to change abbreviation");
    }

    const el = body.querySelector(`div[data-id='${religion}']`);
    if (el) el.classList.add("active");

    if (!layerIsOn("toggleReligions")) return;
    if (customization) return;
    relig.select("#religion"+religion).raise().transition(animate).attr("stroke-width", 2.5).attr("stroke", "#c13119");
    debug.select("#religionsCenter"+religion).raise().transition(animate).attr("r", 8).attr("stroke-width", 2).attr("stroke", "#c13119");
  }

  function religionHighlightOff(event) {
    const religion = +event.target.dataset.id;
    const info = document.getElementById("religionInfo");
    if (info) {
      d3.select("#religionHierarchy").select("g[data-id='"+religion+"'] > path").classed("selected", 0);
      info.innerHTML = "&#8205;";
      tip("");
    }

    const el = body.querySelector(`div[data-id='${religion}']`)
    if (el) el.classList.remove("active");

    relig.select("#religion"+religion).transition().attr("stroke-width", null).attr("stroke", null);
    debug.select("#religionsCenter"+religion).transition().attr("r", 4).attr("stroke-width", 1.2).attr("stroke", null);
  }

  function religionChangeColor() {
    const el = this;
    const currentFill = el.getAttribute("fill");
    const religion = +el.parentNode.parentNode.dataset.id;

    const callback = function(fill) {
      el.setAttribute("fill", fill);
      pack.religions[religion].color = fill;
      relig.select("#religion"+religion).attr("fill", fill);
      debug.select("#religionsCenter"+religion).attr("fill", fill);
    }

    openPicker(currentFill, callback);
  }

  function religionChangeName() {
    const religion = +this.parentNode.dataset.id;
    this.parentNode.dataset.name = this.value;
    pack.religions[religion].name = this.value;
  }

  function religionChangeType() {
    const religion = +this.parentNode.dataset.id;
    this.parentNode.dataset.type = this.value;
    pack.religions[religion].type = this.value;
  }

  function religionChangeForm() {
    const religion = +this.parentNode.dataset.id;
    this.parentNode.dataset.form = this.value;
    pack.religions[religion].form = this.value;
  }

  function religionChangeDeity() {
    const religion = +this.parentNode.dataset.id;
    this.parentNode.dataset.deity = this.value;
    pack.religions[religion].deity = this.value;
  }

  function regenerateDeity() {
    const religion = +this.parentNode.dataset.id;
    const culture = pack.religions[religion].culture;
    const deity = Religions.getDeityName(culture);
    this.parentNode.dataset.deity = deity;
    pack.religions[religion].deity = deity;
    this.nextElementSibling.value = deity;
  }

  function changePopulation() {
    const religion = +this.parentNode.dataset.id;
    const r = pack.religions[religion];
    if (!r.cells) {tip("Religion does not have any cells, cannot change population", false, "error"); return;}
    const rural = rn(r.rural * populationRate.value);
    const urban = rn(r.urban * populationRate.value * urbanization.value);
    const total = rural + urban;
    const l = n => Number(n).toLocaleString();
    const burgs = pack.burgs.filter(b => !b.removed && pack.cells.religion[b.cell] === religion);

    alertMessage.innerHTML = `<p><i>Please note all population of religion territory is considered 
    believers of this religion. It means believers number change will directly change population</i></p>
    Rural: <input type="number" min=0 step=1 id="ruralPop" value=${rural} style="width:6em">
    Urban: <input type="number" min=0 step=1 id="urbanPop" value=${urban} style="width:6em" ${burgs.length?'':"disabled"}>
    <p>Total believers: ${l(total)} ⇒ <span id="totalPop">${l(total)}</span> (<span id="totalPopPerc">100</span>%)</p>`;

    const update = function() {
      const totalNew = ruralPop.valueAsNumber + urbanPop.valueAsNumber;
      if (isNaN(totalNew)) return;
      totalPop.innerHTML = l(totalNew);
      totalPopPerc.innerHTML = rn(totalNew / total * 100);
    }

    ruralPop.oninput = () => update();
    urbanPop.oninput = () => update();

    $("#alert").dialog({
      resizable: false, title: "Change believers number", width: "24em", buttons: {
        Apply: function() {applyPopulationChange(); $(this).dialog("close");},
        Cancel: function() {$(this).dialog("close");}
      }, position: {my: "center", at: "center", of: "svg"}
    });

    function applyPopulationChange() {
      const ruralChange = ruralPop.value / rural;
      if (isFinite(ruralChange) && ruralChange !== 1) {
        const cells = pack.cells.i.filter(i => pack.cells.religion[i] === religion);
        cells.forEach(i => pack.cells.pop[i] *= ruralChange);
      }
      if (!isFinite(ruralChange) && +ruralPop.value > 0) {
        const points = ruralPop.value / populationRate.value;
        const cells = pack.cells.i.filter(i => pack.cells.religion[i] === religion);
        const pop = rn(points / cells.length);
        cells.forEach(i => pack.cells.pop[i] = pop);
      }

      const urbanChange = urbanPop.value / urban;
      if (isFinite(urbanChange) && urbanChange !== 1) {
        burgs.forEach(b => b.population = rn(b.population * urbanChange, 4));
      }
      if (!isFinite(urbanChange) && +urbanPop.value > 0) {
        const points = urbanPop.value / populationRate.value / urbanization.value;
        const population = rn(points / burgs.length, 4);
        burgs.forEach(b => b.population = population);
      }

      refreshReligionsEditor();
    }

  }

  function religionRemove() {
    if (customization) return;
    const religion = +this.parentNode.dataset.id;
    relig.select("#religion"+religion).remove();
    debug.select("#religionsCenter"+religion).remove();

    pack.cells.religion.forEach((r, i) => {if(r === religion) pack.cells.religion[i] = 0;});
    pack.religions[religion].removed = true;
    const origin = pack.religions[religion].origin;
    pack.religions.forEach(r => {if(r.origin === religion) r.origin = origin;});

    refreshReligionsEditor();
  }

  function drawReligionCenters() {
    debug.select("#religionCenters").remove();
    const religionCenters = debug.append("g").attr("id", "religionCenters")
      .attr("stroke-width", 1.2).attr("stroke", "#444444").style("cursor", "move");

    const data = pack.religions.filter(r => r.i && r.center && r.cells && !r.removed);
    religionCenters.selectAll("circle").data(data).enter().append("circle")
      .attr("id", d => "religionsCenter"+d.i).attr("data-id", d => d.i)
      .attr("r", 4).attr("fill", d => d.color)
      .attr("cx", d => pack.cells.p[d.center][0]).attr("cy", d => pack.cells.p[d.center][1])
      .on("mouseenter", d => {
        tip(d.name+ ". Drag to move the religion center", true);
        religionHighlightOn(event);
      }).on("mouseleave", d => {
        tip('', true);
        religionHighlightOff(event);
      }).call(d3.drag().on("start", religionCenterDrag));
  }

  function religionCenterDrag() {
    const el = d3.select(this);
    const r = +this.dataset.id;
    d3.event.on("drag", () => {
      el.attr("cx", d3.event.x).attr("cy", d3.event.y);
      const cell = findCell(d3.event.x, d3.event.y);
      if (pack.cells.h[cell] < 20) return; // ignore dragging on water
      pack.religions[r].center = cell;
    });
  }

  function toggleLegend() {
    if (legend.selectAll("*").size()) {clearLegend(); return;}; // hide legend
    const data = pack.religions.filter(r => r.i && !r.removed && r.area).sort((a, b) => b.area - a.area).map(r => [r.i, r.color, r.name]);
    drawLegend("Religions", data);
  }

  function togglePercentageMode() {
    if (body.dataset.type === "absolute") {
      body.dataset.type = "percentage";
      const totalArea = +religionsFooterArea.dataset.area;
      const totalPopulation = +religionsFooterPopulation.dataset.population;

      body.querySelectorAll(":scope > div").forEach(function(el) {
        el.querySelector(".biomeArea").innerHTML = rn(+el.dataset.area / totalArea * 100) + "%";
        el.querySelector(".culturePopulation").innerHTML = rn(+el.dataset.population / totalPopulation * 100) + "%";
      });
    } else {
      body.dataset.type = "absolute";
      religionsEditorAddLines();
    }
  }

  function showHierarchy() {
    // build hierarchy tree
    pack.religions[0].origin = null;
    const religions = pack.religions.filter(r => !r.removed);
    const root = d3.stratify().id(d => d.i).parentId(d => d.origin)(religions);
    const treeWidth = root.leaves().length;
    const treeHeight = root.height;
    const width = treeWidth * 40, height = treeHeight * 60;

    const margin = {top: 10, right: 10, bottom: -5, left: 10};
    const w = width - margin.left - margin.right;
    const h = height + 30 - margin.top - margin.bottom;
    const treeLayout = d3.tree().size([w, h]);

    // prepare svg
    alertMessage.innerHTML = "<div id='religionInfo' class='chartInfo'>&#8205;</div>";
    const svg = d3.select("#alertMessage").insert("svg", "#religionInfo").attr("id", "religionHierarchy")
      .attr("width", width).attr("height", height).style("text-anchor", "middle");
    const graph = svg.append("g").attr("transform", `translate(10, -45)`);
    const links = graph.append("g").attr("fill", "none").attr("stroke", "#aaaaaa");
    const nodes = graph.append("g");

    renderTree();
    function renderTree() {
      treeLayout(root);
      links.selectAll('path').data(root.links()).enter()
        .append('path').attr("d", d => {return "M" + d.source.x + "," + d.source.y
          + "C" + d.source.x + "," + (d.source.y * 3 + d.target.y) / 4
          + " " + d.target.x + "," + (d.source.y * 2 + d.target.y) / 3
          + " " + d.target.x + "," + d.target.y;});

      const node = nodes.selectAll('g').data(root.descendants()).enter()
        .append('g').attr("data-id", d => d.data.i).attr("stroke", "#333333")
        .attr("transform", d => `translate(${d.x}, ${d.y})`)
        .on("mouseenter", () => religionHighlightOn(event))
        .on("mouseleave", () => religionHighlightOff(event))
        .call(d3.drag().on("start", d => dragToReorigin(d)));

      node.append("path").attr("d", d => {
          if (d.data.type === "Folk") return "M11.3,0A11.3,11.3,0,1,1,-11.3,0A11.3,11.3,0,1,1,11.3,0"; else // circle
          if (d.data.type === "Heresy") return "M0,-14L14,0L0,14L-14,0Z"; else // diamond
          if (d.data.type === "Cult") return "M-6.5,-11.26l13,0l6.5,11.26l-6.5,11.26l-13,0l-6.5,-11.26Z"; else // hex
          if (!d.data.i) return "M5,0A5,5,0,1,1,-5,0A5,5,0,1,1,5,0"; else // small circle
          return "M-11,-11h22v22h-22Z"; // square
        }).attr("fill", d => d.data.i ? d.data.color : "#ffffff")
          .attr("stroke-dasharray", d => d.data.cells ? "null" : "1");

      node.append("text").attr("dy", ".35em").text(d => d.data.i ? d.data.code : '');
    }

    $("#alert").dialog({
      title: "Religions tree", width: fitContent(), resizable: false, 
      position: {my: "left center", at: "left+10 center", of: "svg"}, buttons: {},
      close: () => {alertMessage.innerHTML = "";}
    });

    function dragToReorigin(d) {
      if (d3.event.sourceEvent.ctrlKey) {changeReligionCode(d); return;}

      const originLine = graph.append("path")
        .attr("class", "dragLine").attr("d", `M${d.x},${d.y}L${d.x},${d.y}`);

      d3.event.on("drag", () => {
        originLine.attr("d", `M${d.x},${d.y}L${d3.event.x},${d3.event.y}`)
      });

      d3.event.on("end", () => {
        originLine.remove();
        const selected = graph.select("path.selected");
        if (!selected.size()) return;
        const religion = d.data.i;
        const oldOrigin = d.data.origin;
        let newOrigin = selected.datum().data.i;
        if (newOrigin == oldOrigin) return; // already a child of the selected node
        if (newOrigin == religion) newOrigin = 0; // move to top
        if (newOrigin && d.descendants().some(node => node.id == newOrigin)) return; // cannot be a child of its own child
        pack.religions[religion].origin = d.data.origin = newOrigin; // change data
        showHierarchy() // update hierarchy
      });
    }

    function changeReligionCode(d) {
      const code = prompt(`Please provide an abbreviation for ${d.data.name}`, d.data.code);
      if (!code) return;
      pack.religions[d.data.i].code = code;
      nodes.select("g[data-id='"+d.data.i+"']").select("text").text(code);
    }
  }

  function toggleExtinct() {
    body.dataset.extinct = body.dataset.extinct !== "show" ? "show" : "hide";
    religionsEditorAddLines();
  }

  function enterReligionsManualAssignent() {
    if (!layerIsOn("toggleReligions")) toggleReligions();
    customization = 7;
    relig.append("g").attr("id", "temp");
    document.querySelectorAll("#religionsBottom > button").forEach(el => el.style.display = "none");
    document.getElementById("religionsManuallyButtons").style.display = "inline-block";
    debug.select("#religionCenters").style("display", "none");

    religionsEditor.querySelectorAll(".hide").forEach(el => el.classList.add("hidden"));
    religionsFooter.style.display = "none";
    body.querySelectorAll("div > input, select, span, svg").forEach(e => e.style.pointerEvents = "none");
    $("#religionsEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg"}});

    tip("Click on religion to select, drag the circle to change religion", true);
    viewbox.style("cursor", "crosshair")
      .on("click", selectReligionOnMapClick)
      .call(d3.drag().on("start", dragReligionBrush))
      .on("touchmove mousemove", moveReligionBrush);

    body.querySelector("div").classList.add("selected");
  }

  function selectReligionOnLineClick(i) {
    if (customization !== 7) return;
    body.querySelector("div.selected").classList.remove("selected");
    this.classList.add("selected");
  }

  function selectReligionOnMapClick() {
    const point = d3.mouse(this);
    const i = findCell(point[0], point[1]);
    if (pack.cells.h[i] < 20) return;

    const assigned = relig.select("#temp").select("polygon[data-cell='"+i+"']");
    const religion = assigned.size() ? +assigned.attr("data-religion") : pack.cells.religion[i];

    body.querySelector("div.selected").classList.remove("selected");
    body.querySelector("div[data-id='"+religion+"']").classList.add("selected");
  }
  
  function dragReligionBrush() {
    const r = +religionsManuallyBrushNumber.value;

    d3.event.on("drag", () => {
      if (!d3.event.dx && !d3.event.dy) return;
      const p = d3.mouse(this);
      moveCircle(p[0], p[1], r);
  
      const found = r > 5 ? findAll(p[0], p[1], r) : [findCell(p[0], p[1], r)];
      const selection = found.filter(isLand);
      if (selection) changeReligionForSelection(selection);
    });
  }

  // change religion within selection
  function changeReligionForSelection(selection) {
    const temp = relig.select("#temp");
    const selected = body.querySelector("div.selected");
    const r = +selected.dataset.id; // religionNew
    const color = pack.religions[r].color || "#ffffff";

    selection.forEach(function(i) {
      const exists = temp.select("polygon[data-cell='"+i+"']");
      const religionOld = exists.size() ? +exists.attr("data-religion") : pack.cells.religion[i];
      if (r === religionOld) return;

      // change of append new element
      if (exists.size()) exists.attr("data-religion", r).attr("fill", color);
      else temp.append("polygon").attr("data-cell", i).attr("data-religion", r).attr("points", getPackPolygon(i)).attr("fill", color);
    });
  }

  function moveReligionBrush() {
    showMainTip();
    const point = d3.mouse(this);
    const radius = +religionsManuallyBrushNumber.value;
    moveCircle(point[0], point[1], radius);
  }

  function applyReligionsManualAssignent() {
    const changed = relig.select("#temp").selectAll("polygon");
    changed.each(function() {
      const i = +this.dataset.cell;
      const r = +this.dataset.religion;
      pack.cells.religion[i] = r;
    });

    if (changed.size()) {
      drawReligions();
      refreshReligionsEditor();
      drawReligionCenters();
    }
    exitReligionsManualAssignment();
  }
 
  function exitReligionsManualAssignment(close) {
    customization = 0;
    relig.select("#temp").remove();
    removeCircle();
    document.querySelectorAll("#religionsBottom > button").forEach(el => el.style.display = "inline-block");
    document.getElementById("religionsManuallyButtons").style.display = "none";

    religionsEditor.querySelectorAll(".hide").forEach(el => el.classList.remove("hidden"));
    religionsFooter.style.display = "block";
    body.querySelectorAll("div > input, select, span, svg").forEach(e => e.style.pointerEvents = "all");
    if(!close) $("#religionsEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg"}});

    debug.select("#religionCenters").style("display", null);
    restoreDefaultEvents();
    clearMainTip();
    const selected = body.querySelector("div.selected");
    if (selected) selected.classList.remove("selected");
  }

  function enterAddReligionMode() {
    if (this.classList.contains("pressed")) {exitAddReligionMode(); return;};
    customization = 8;
    this.classList.add("pressed");
    tip("Click on the map to add a new religion", true);
    viewbox.style("cursor", "crosshair").on("click", addReligion);
    body.querySelectorAll("div > input, select, span, svg").forEach(e => e.style.pointerEvents = "none");
  }

  function exitAddReligionMode() {
    customization = 0;
    restoreDefaultEvents();
    clearMainTip();
    body.querySelectorAll("div > input, select, span, svg").forEach(e => e.style.pointerEvents = "all");
    if (religionsAdd.classList.contains("pressed")) religionsAdd.classList.remove("pressed");
  }

  function addReligion() {
    const point = d3.mouse(this);
    const center = findCell(point[0], point[1]);
    if (pack.cells.h[center] < 20) {tip("You cannot place religion center into the water. Please click on a land cell", false, "error"); return;}
    const occupied = pack.religions.some(r => !r.removed && r.center === center);
    if (occupied) {tip("This cell is already a religion center. Please select a different cell", false, "error"); return;}

    if (d3.event.shiftKey === false) exitAddReligionMode();
    Religions.add(center);

    drawReligions();
    refreshReligionsEditor();
    drawReligionCenters();
  }

  function downloadReligionsData() {
    const unit = areaUnit.value === "square" ? distanceUnitInput.value + "2" : areaUnit.value;
    let data = "Id,Religion,Color,Type,Form,Deity,Area "+unit+",Believers\n"; // headers

    body.querySelectorAll(":scope > div").forEach(function(el) {
      data += el.dataset.id + ",";
      data += el.dataset.name + ",";
      data += el.dataset.color + ",";
      data += el.dataset.type + ",";
      data += el.dataset.form + ",";
      data += el.dataset.deity.replace(",", " -") + ",";
      data += el.dataset.area + ",";
      data += el.dataset.population + "\n";
    });

    const dataBlob = new Blob([data], {type: "text/plain"});
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    document.body.appendChild(link);
    link.download = getFileName("Religions") + ".csv";
    link.href = url;
    link.click();
    window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 2000);
  }
  
  function closeReligionsEditor() {
    debug.select("#religionCenters").remove();
    exitReligionsManualAssignment("close");
    exitAddReligionMode();
  }

}