"use strict";
function editEmblem(type, id, el) {
  if (customization) return;
  if (!id && d3.event) defineEmblemData(d3.event);

  emblems.selectAll(":scope > use").call(d3.drag().on("drag", dragEmblem)).classed("draggable", true);

  const emblemStates = document.getElementById("emblemStates");
  const emblemProvinces = document.getElementById("emblemProvinces");
  const emblemBurgs = document.getElementById("emblemBurgs");
  const {states, provinces, burgs, cells} = pack;

  updateElementSelectors(type, id, el);

  $("#emblemEditor").dialog({
    title: "Edit Emblem", resizable: true, width: "18em", height: "auto",
    position: {my: "left top", at: "left+10 top+10", of: "svg", collision: "fit"},
    close: closeEmblemEditor
  });

  // add listeners,then remove on closure
  emblemStates.oninput = selectState;
  emblemProvinces.oninput = selectProvince;
  emblemBurgs.oninput = selectBurg;
  document.getElementById("emblemShapeSelector").oninput = changeShape;
  document.getElementById("emblemsRegenerate").onclick = regenerate;
  document.getElementById("emblemsArmoria").onclick = openInArmoria;
  document.getElementById("emblemsDownload").onclick = download;
  document.getElementById("emblemsFocus").onclick = showArea;

  function defineEmblemData(e) {
    const parent = e.target.parentNode;
    const [g, t] = parent.id === "burgEmblems" ? [pack.burgs, "burg"] :
                      parent.id === "provinceEmblems" ? [pack.provinces, "province"] :
                      [pack.states, "state"];
    const i = +e.target.dataset.i;
    type = t;
    id = type+"COA"+i;
    el = g[i];
  }

  function updateElementSelectors(type, id, el) {
    let state = 0, province = 0, burg = 0;

    // set active type
    emblemStates.parentElement.className = type === "state" ? "active" : "";
    emblemProvinces.parentElement.className = type === "province" ? "active" : "";
    emblemBurgs.parentElement.className = type === "burg" ? "active" : "";

    // define selected values
    if (type === "state") state = el.i;
    else if (type === "province") {
      province = el.i
      state = states[el.state].i;
    } else {
      burg = el.i;
      province = cells.province[el.cell] ? provinces[cells.province[el.cell]].i : 0;
      state = provinces[province].state || 0;
    }

    // update option list and select actual values
    emblemStates.options.length = 0;
    const neutralBurgs = burgs.filter(burg => burg.i && !burg.removed && !burg.state);
    if (neutralBurgs.length) emblemStates.options.add(new Option(states[0].name, 0, false, !state));
    const stateList = states.filter(state => state.i && !state.removed);
    stateList.forEach(s => emblemStates.options.add(new Option(s.name, s.i, false, s.i === state)));

    emblemProvinces.options.length = 0;
    emblemProvinces.options.add(new Option("", 0, false, !province));
    const provinceList = provinces.filter(province => !province.removed && province.state === state);
    provinceList.forEach(p => emblemProvinces.options.add(new Option(p.name, p.i, false, p.i === province)));

    emblemBurgs.options.length = 0;
    emblemBurgs.options.add(new Option("", 0, false, !burg));
    const burgList = burgs.filter(burg => !burg.removed && province ? cells.province[burg.cell] === province : burg.state === state);
    burgList.forEach(b => emblemBurgs.options.add(new Option(b.capital ? "👑 " + b.name : b.name, b.i, false, b.i === burg)));
    emblemBurgs.options[0].disabled = true;

    COArenderer.trigger(id, el.coa);
    updateEmblemData(type, id, el);
  }

  function updateEmblemData(type, id, el) {
    if (!el.coa) return;
    document.getElementById("emblemImage").setAttribute("href", "#" + id);
    document.getElementById("emblemShapeSelector").value = el.coa.shield;
    let name = el.fullName || el.name;
    if (type === "burg") name = "Burg of " + name;
    document.getElementById("emblemArmiger").innerText = name;
  }

  function selectState() {
    const state = +this.value;
    if (state) {
      type = "state";
      el = states[state];
      id = "stateCOA"+ state;
    } else {
      // select neutral burg if state is changed to Neutrals
      const neutralBurgs = burgs.filter(burg => burg.i && !burg.removed && !burg.state);
      if (!neutralBurgs.length) return;
      type = "burg";
      el = neutralBurgs[0];
      id = "burgCOA"+ neutralBurgs[0].i;
    }
    updateElementSelectors(type, id, el);
  }

  function selectProvince() {
    const province = +this.value;

    if (province) {
      type = "province";
      el = provinces[province];
      id = "provinceCOA"+ province;
    } else {
      // select state if province is changed to null value
      const state = +emblemStates.value;
      type = "state";
      el = states[state];
      id = "stateCOA"+ state;
    }

    updateElementSelectors(type, id, el);
  }

  function selectBurg() {
    const burg = +this.value;
    type = "burg";
    el = burgs[burg];
    id = "burgCOA"+ burg;
    updateElementSelectors(type, id, el);
  }

  function changeShape() {
    el.coa.shield = this.value;
    document.getElementById(id).remove();
    COArenderer.trigger(id, el.coa);
  }

  function showArea() {
    highlightEmblemElement(type, el);
  }

  function regenerate() {
    let parent = null;
    if (type === "province") parent = pack.states[el.state].coa;
    else if (type === "burg") {
      const province = pack.cells.province[el.cell];
      parent = province ? pack.provinces[province].coa : pack.states[el.state].coa;
    }

    const shield = el.coa.shield;
    el.coa = COA.generate(parent);
    el.coa.shield = shield;

    document.getElementById(id).remove();
    COArenderer.trigger(id, el.coa);
  }

  function openInArmoria() {
    const json = JSON.stringify(el.coa).replaceAll("#", "%23");
    const url = `http://azgaar.github.io/Armoria/?coa=${json}`;
    openURL(url);
  }

  function download() {
    const coa = document.getElementById(id);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 500;
    canvas.height = 500;

    const url = getURL(coa, el.coa);
    const img = new Image();
    img.src = url;
    img.onload = () => {
      URL.revokeObjectURL(url);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      drawCanvas(canvas, el);
    }

    function drawCanvas(canvas, el) {
      const link = document.createElement("a");
      link.download = getFileName(`Emblem ${el.fullName || el.name}`) + ".png";
      canvas.toBlob(function (blob) {
        link.href = window.URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        setTimeout(function () {
          canvas.remove();
          window.URL.revokeObjectURL(link.href);
        }, 5000);
      });
    }
  }

  function getURL(svg, coa) {
    const clone = svg.cloneNode(true); // clone svg
    const d = clone.getElementsByTagName("defs")[0];

    d.insertAdjacentHTML("beforeend", document.getElementById(coa.shield).outerHTML); // copy shield to defs
    svg.querySelectorAll("[fill^=url]").forEach(el => {
      const id = el.getAttribute("fill").match(/\#([^)]+)\)/)[1];
      d.insertAdjacentHTML("beforeend", document.getElementById(id).outerHTML);
    });

    const serialized = (new XMLSerializer()).serializeToString(clone);
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    return url;
  }

  function dragEmblem() {
    const tr = parseTransform(this.getAttribute("transform"));
    const x = +tr[0] - d3.event.x, y = +tr[1] - d3.event.y;
  
    d3.event.on("drag", function() {
      const transform = `translate(${(x + d3.event.x)},${(y + d3.event.y)})`;
      this.setAttribute("transform", transform);
    });
  }

  function closeEmblemEditor() {
    emblems.selectAll(":scope > use").call(d3.drag().on("drag", null)).attr("class", null);
  }
}