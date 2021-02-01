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
  document.getElementById("emblemsDownload").onclick = toggleDownload;
  document.getElementById("emblemsDownloadSVG").onclick = () => download("svg");
  document.getElementById("emblemsDownloadPNG").onclick = () => download("png");
  document.getElementById("emblemsDownloadJPG").onclick = () => download("jpeg");
  document.getElementById("emblemsGallery").onclick = downloadGallery;
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

  function toggleDownload() {
    const buttons = document.getElementById("emblemDownloadControl");
    buttons.classList.toggle("hidden");
  }

  function download(format) {
    const coa = document.getElementById(id);
    const size = +emblemsDownloadSize.value;
    const url = getURL(coa, el.coa, size);
    const link = document.createElement("a");
    link.download = getFileName(`Emblem ${el.fullName || el.name}`) + "." + format;

    if (format === "svg") downloadSVG(url, link); else downloadRaster(format, url, link, size);
    document.getElementById("emblemDownloadControl").classList.add("hidden");
  }

  function downloadSVG(url, link) {
    link.href = url;
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => window.URL.revokeObjectURL(URL), 5000);
  }

  function downloadRaster(format, url, link, size) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = size;
    canvas.height = size;

    const img = new Image();
    img.src = url;
    img.onload = async function() {
      if (format === "jpeg") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const URL = await canvas.toDataURL("image/" + format, .92);
      link.href = URL;
      document.body.appendChild(link);
      link.click();
      window.setTimeout(() => window.URL.revokeObjectURL(URL), 5000);
    }
  }

  function getURL(svg, coa, size) {
    const serialized = getSVG(svg, coa, size);
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    return url;
  }

  function getSVG(svg, coa, size) {
    const clone = svg.cloneNode(true); // clone svg
    const d = clone.getElementsByTagName("defs")[0];

    clone.removeAttribute("id");
    clone.setAttribute("width", size);
    clone.setAttribute("height", size);

    d.insertAdjacentHTML("beforeend", document.getElementById(coa.shield).outerHTML); // copy shield to defs
    clone.querySelectorAll("[fill^=url]").forEach(el => {
      const id = el.getAttribute("fill").match(/\#([^)]+)\)/)[1];
      d.insertAdjacentHTML("beforeend", document.getElementById(id).outerHTML);
    });

    return (new XMLSerializer()).serializeToString(clone);
  }

  function downloadGallery() {
    const name = getFileName("Emblems Gallery");
    const validStates = states.filter(s => s.i && !s.removed && s.coa);
    const validProvinces = provinces.filter(p => p.i && !p.removed && p.coa);
    const validBurgs = burgs.filter(b => b.i && !b.removed && b.coa);
    triggerCOALoad(validStates, validProvinces, validBurgs);
    const timeout = (validStates.length + validProvinces.length + validBurgs.length) * 8;
    tip("Preparing to download...", true, "warn", timeout);
    d3.timeout(runDownload, timeout);

    function runDownload() {
      const stateSection = `<div><h2>States</h2>` + validStates.map(state => {
        const el = document.getElementById("stateCOA"+state.i);
        const svg = getSVG(el, state.coa, 200);
        return `<figure id="state_${state.i}"><a href="#provinces_${state.i}"><figcaption>${state.fullName}</figcaption>${svg}</a></figure>`;
      }).join("") + `</div>`;

      const provinceSections = validStates.map(state => {
        const figures = validProvinces.filter(p => p.state === state.i).map(province => {
          const el = document.getElementById("provinceCOA"+province.i);
          const svg = getSVG(el, province.coa, 200);
          return `<figure id="province_${province.i}"><a href="#burgs_${province.i}"><figcaption>${province.fullName}</figcaption>${svg}</a></figure>`;
        }).join("");
        return `<div id="provinces_${state.i}"><h2>${state.fullName} provinces</h2>${figures}</div>`;
      }).join("");

      const burgSections = validStates.map(state => {
        const stateBurgs = validBurgs.filter(b => b.state === state.i);
        let stateBurgSections = validProvinces.filter(p => p.state === state.i).map(province => {
          const provinceBurgs = stateBurgs.filter(b => cells.province[b.cell] === province.i);
          if (!provinceBurgs.length) return "";
          const provinceBurgFigures = provinceBurgs.map(burg => {
            const el = document.getElementById("burgCOA"+burg.i);
            const svg = getSVG(el, burg.coa, 200);
            return `<figure id="burg_${burg.i}"><figcaption>${burg.name}</figcaption>${svg}</figure>`;
          }).join("");
          return `<div id="burgs_${province.i}"><h2>${province.fullName} burgs</h2>${provinceBurgFigures}</div>`;
        }).join("");

        const stateBurgOutOfProvinces = stateBurgs.filter(b => !cells.province[b.cell]);
        const stateBurgOutOfProvincesFigures = stateBurgOutOfProvinces.map(burg => {
          const el = document.getElementById("burgCOA"+burg.i);
          const svg = getSVG(el, burg.coa, 200);
          return `<figure id="burg_${burg.i}"><figcaption>${burg.name}</figcaption>${svg}</figure>`;
        }).join("");
        if (stateBurgOutOfProvincesFigures) stateBurgSections += `<div><h2>${state.fullName} burgs under direct control</h2>${stateBurgOutOfProvincesFigures}</div>`;
        return stateBurgSections;
      }).join("");

      const neutralBurgs = validBurgs.filter(b => !b.state);
      const neutralsSection = neutralBurgs.length ? "<div><h2>Independent burgs</h2>" + neutralBurgs.map(burg => {
        const el = document.getElementById("burgCOA"+burg.i);
        const svg = getSVG(el, burg.coa, 200);
        return `<figure id="burg_${burg.i}"><figcaption>${burg.name}</figcaption>${svg}</figure>`;
      }).join("") + "</div>" : "";

      const FMG = `<a href="https://azgaar.github.io/Fantasy-Map-Generator" target="_blank">Azgaar's Fantasy Map Generator</a>`;
      const license = `<a target="_blank" href="https://github.com/Azgaar/Armoria#license">the license</a>`;
      const html = `<!DOCTYPE html><html><head><title>${mapName.value} Emblems Gallery</title></head>
        <style type="text/css">
          body { margin: 0; padding: 1em; font-family: serif; }
          h1, h2 { font-family: 'Forum'; }
          div { width: 100%; max-width: 1018px; margin: 0 auto; border-bottom: 1px solid #ddd; }
          figure { margin: 0 0 2em; display: inline-block; transition: .2s; }
          figure:hover { background-color: #f6f6f6; }
          figcaption { text-align: center; margin: .4em 0; width: 200px; font-family: 'Overlock SC' }
          figure > a { color: black; text-decoration: none; }
          address { width: 100%; max-width: 1018px; margin: 0 auto; }
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Forum&family=Overlock+SC" rel="stylesheet">
        <body>
          <div><h1>${mapName.value} Emblems Gallery</h1></div>
          ${stateSection}
          ${provinceSections}
          ${burgSections}
          ${neutralsSection}
          <address>Generated by ${FMG}. The tool is free, but images may be copyrighted, see ${license}</address>
        </body></html>`;
      downloadFile(html, name + ".html", "text/plain");
    }
  }

  function triggerCOALoad(states, provinces, burgs) {
    states.forEach(state => COArenderer.trigger("stateCOA"+state.i, state.coa));
    provinces.forEach(province => COArenderer.trigger("provinceCOA"+province.i, province.coa));
    burgs.forEach(burg => COArenderer.trigger("burgCOA"+burg.i, burg.coa));
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