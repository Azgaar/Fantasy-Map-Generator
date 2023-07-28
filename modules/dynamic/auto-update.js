"use strict";

// update old .map version to the current one
export function resolveVersionConflicts(version) {
  if (version < 1) {
    // v1.0 added a new religions layer
    relig = viewbox.insert("g", "#terrain").attr("id", "relig");
    Religions.generate();

    // v1.0 added a legend box
    legend = svg.append("g").attr("id", "legend");
    legend
      .attr("font-family", "Almendra SC")
      .attr("font-size", 13)
      .attr("data-size", 13)
      .attr("data-x", 99)
      .attr("data-y", 93)
      .attr("stroke-width", 2.5)
      .attr("stroke", "#812929")
      .attr("stroke-dasharray", "0 4 10 4")
      .attr("stroke-linecap", "round");

    // v1.0 separated drawBorders fron drawStates()
    stateBorders = borders.append("g").attr("id", "stateBorders");
    provinceBorders = borders.append("g").attr("id", "provinceBorders");
    borders
      .attr("opacity", null)
      .attr("stroke", null)
      .attr("stroke-width", null)
      .attr("stroke-dasharray", null)
      .attr("stroke-linecap", null)
      .attr("filter", null);
    stateBorders
      .attr("opacity", 0.8)
      .attr("stroke", "#56566d")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2")
      .attr("stroke-linecap", "butt");
    provinceBorders
      .attr("opacity", 0.8)
      .attr("stroke", "#56566d")
      .attr("stroke-width", 0.5)
      .attr("stroke-dasharray", "1")
      .attr("stroke-linecap", "butt");

    // v1.0 added state relations, provinces, forms and full names
    provs = viewbox.insert("g", "#borders").attr("id", "provs").attr("opacity", 0.6);
    BurgsAndStates.collectStatistics();
    BurgsAndStates.generateCampaigns();
    BurgsAndStates.generateDiplomacy();
    BurgsAndStates.defineStateForms();
    drawStates();
    BurgsAndStates.generateProvinces();
    drawBorders();
    if (!layerIsOn("toggleBorders")) $("#borders").fadeOut();
    if (!layerIsOn("toggleStates")) regions.attr("display", "none").selectAll("path").remove();

    // v1.0 added zones layer
    zones = viewbox.insert("g", "#borders").attr("id", "zones").attr("display", "none");
    zones
      .attr("opacity", 0.6)
      .attr("stroke", null)
      .attr("stroke-width", 0)
      .attr("stroke-dasharray", null)
      .attr("stroke-linecap", "butt");
    addZones();
    if (!markers.selectAll("*").size()) {
      Markers.generate();
      turnButtonOn("toggleMarkers");
    }

    // v1.0 add fogging layer (state focus)
    fogging = viewbox
      .insert("g", "#ruler")
      .attr("id", "fogging-cont")
      .attr("mask", "url(#fog)")
      .append("g")
      .attr("id", "fogging")
      .style("display", "none");
    fogging.append("rect").attr("x", 0).attr("y", 0).attr("width", "100%").attr("height", "100%");
    defs
      .append("mask")
      .attr("id", "fog")
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("fill", "white");

    // v1.0 changes states opacity bask to regions level
    if (statesBody.attr("opacity")) {
      regions.attr("opacity", statesBody.attr("opacity"));
      statesBody.attr("opacity", null);
    }

    // v1.0 changed labels to multi-lined
    labels.selectAll("textPath").each(function () {
      const text = this.textContent;
      const shift = this.getComputedTextLength() / -1.5;
      this.innerHTML = /* html */ `<tspan x="${shift}">${text}</tspan>`;
    });

    // v1.0 added new biome - Wetland
    biomesData.name.push("Wetland");
    biomesData.color.push("#0b9131");
    biomesData.habitability.push(12);
  }

  if (version < 1.1) {
    // v1.0 initial code had a bug with religion layer id
    if (!relig.size()) relig = viewbox.insert("g", "#terrain").attr("id", "relig");

    // v1.0 initially has Sympathy status then relaced with Friendly
    for (const s of pack.states) {
      if (!s.diplomacy) continue;
      s.diplomacy = s.diplomacy.map(r => (r === "Sympathy" ? "Friendly" : r));
    }

    // labels should be toggled via style attribute, so remove display attribute
    labels.attr("display", null);

    // v1.0 added religions heirarchy tree
    if (pack.religions[1] && !pack.religions[1].code) {
      pack.religions
        .filter(r => r.i)
        .forEach(r => {
          r.origin = 0;
          r.code = r.name.slice(0, 2);
        });
    }

    if (!document.getElementById("freshwater")) {
      lakes.append("g").attr("id", "freshwater");
      lakes
        .select("#freshwater")
        .attr("opacity", 0.5)
        .attr("fill", "#a6c1fd")
        .attr("stroke", "#5f799d")
        .attr("stroke-width", 0.7)
        .attr("filter", null);
    }

    if (!document.getElementById("salt")) {
      lakes.append("g").attr("id", "salt");
      lakes
        .select("#salt")
        .attr("opacity", 0.5)
        .attr("fill", "#409b8a")
        .attr("stroke", "#388985")
        .attr("stroke-width", 0.7)
        .attr("filter", null);
    }

    // v1.1 added new lake and coast groups
    if (!document.getElementById("sinkhole")) {
      lakes.append("g").attr("id", "sinkhole");
      lakes.append("g").attr("id", "frozen");
      lakes.append("g").attr("id", "lava");
      lakes
        .select("#sinkhole")
        .attr("opacity", 1)
        .attr("fill", "#5bc9fd")
        .attr("stroke", "#53a3b0")
        .attr("stroke-width", 0.7)
        .attr("filter", null);
      lakes
        .select("#frozen")
        .attr("opacity", 0.95)
        .attr("fill", "#cdd4e7")
        .attr("stroke", "#cfe0eb")
        .attr("stroke-width", 0)
        .attr("filter", null);
      lakes
        .select("#lava")
        .attr("opacity", 0.7)
        .attr("fill", "#90270d")
        .attr("stroke", "#f93e0c")
        .attr("stroke-width", 2)
        .attr("filter", "url(#crumpled)");

      coastline.append("g").attr("id", "sea_island");
      coastline.append("g").attr("id", "lake_island");
      coastline
        .select("#sea_island")
        .attr("opacity", 0.5)
        .attr("stroke", "#1f3846")
        .attr("stroke-width", 0.7)
        .attr("filter", "url(#dropShadow)");
      coastline
        .select("#lake_island")
        .attr("opacity", 1)
        .attr("stroke", "#7c8eaf")
        .attr("stroke-width", 0.35)
        .attr("filter", null);
    }

    // v1.1 features stores more data
    defs.select("#land").selectAll("path").remove();
    defs.select("#water").selectAll("path").remove();
    coastline.selectAll("path").remove();
    lakes.selectAll("path").remove();
    drawCoastline();
  }

  if (version < 1.11) {
    // v1.11 added new attributes
    terrs.attr("scheme", "bright").attr("terracing", 0).attr("skip", 5).attr("relax", 0).attr("curve", 0);
    svg.select("#oceanic > *").attr("id", "oceanicPattern");
    oceanLayers.attr("layers", "-6,-3,-1");
    gridOverlay.attr("type", "pointyHex").attr("size", 10);

    // v1.11 added cultures heirarchy tree
    if (pack.cultures[1] && !pack.cultures[1].code) {
      pack.cultures
        .filter(c => c.i)
        .forEach(c => {
          c.origin = 0;
          c.code = c.name.slice(0, 2);
        });
    }

    // v1.11 had an issue with fogging being displayed on load
    unfog();

    // v1.2 added new terrain attributes
    if (!terrain.attr("set")) terrain.attr("set", "simple");
    if (!terrain.attr("size")) terrain.attr("size", 1);
    if (!terrain.attr("density")) terrain.attr("density", 0.4);
  }

  if (version < 1.21) {
    // v1.11 replaced "display" attribute by "display" style
    viewbox.selectAll("g").each(function () {
      if (this.hasAttribute("display")) {
        this.removeAttribute("display");
        this.style.display = "none";
      }
    });

    // v1.21 added rivers data to pack
    pack.rivers = []; // rivers data
    rivers.selectAll("path").each(function () {
      const i = +this.id.slice(5);
      const length = this.getTotalLength() / 2;
      const s = this.getPointAtLength(length),
        e = this.getPointAtLength(0);
      const source = findCell(s.x, s.y),
        mouth = findCell(e.x, e.y);
      const name = Rivers.getName(mouth);
      const type = length < 25 ? rw({Creek: 9, River: 3, Brook: 3, Stream: 1}) : "River";
      pack.rivers.push({i, parent: 0, length, source, mouth, basin: i, name, type});
    });
  }

  if (version < 1.22) {
    // v1.22 changed state neighbors from Set object to array
    BurgsAndStates.collectStatistics();
  }

  if (version < 1.3) {
    // v1.3 added global options object
    const winds = options.slice(); // previostly wind was saved in settings[19]
    const year = rand(100, 2000);
    const era = Names.getBaseShort(P(0.7) ? 1 : rand(nameBases.length)) + " Era";
    const eraShort = era[0] + "E";
    const military = Military.getDefaultOptions();
    options = {winds, year, era, eraShort, military};

    // v1.3 added campaings data for all states
    BurgsAndStates.generateCampaigns();

    // v1.3 added militry layer
    armies = viewbox.insert("g", "#icons").attr("id", "armies");
    armies
      .attr("opacity", 1)
      .attr("fill-opacity", 1)
      .attr("font-size", 6)
      .attr("box-size", 3)
      .attr("stroke", "#000")
      .attr("stroke-width", 0.3);
    turnButtonOn("toggleMilitary");
    Military.generate();
  }

  if (version < 1.4) {
    // v1.35 added dry lakes
    if (!lakes.select("#dry").size()) {
      lakes.append("g").attr("id", "dry");
      lakes
        .select("#dry")
        .attr("opacity", 1)
        .attr("fill", "#c9bfa7")
        .attr("stroke", "#8e816f")
        .attr("stroke-width", 0.7)
        .attr("filter", null);
    }

    // v1.4 added ice layer
    ice = viewbox.insert("g", "#coastline").attr("id", "ice").style("display", "none");
    ice
      .attr("opacity", null)
      .attr("fill", "#e8f0f6")
      .attr("stroke", "#e8f0f6")
      .attr("stroke-width", 1)
      .attr("filter", "url(#dropShadow05)");
    drawIce();

    // v1.4 added icon and power attributes for units
    for (const unit of options.military) {
      if (!unit.icon) unit.icon = getUnitIcon(unit.type);
      if (!unit.power) unit.power = unit.crew;
    }

    function getUnitIcon(type) {
      if (type === "naval") return "🌊";
      if (type === "ranged") return "🏹";
      if (type === "mounted") return "🐴";
      if (type === "machinery") return "💣";
      if (type === "armored") return "🐢";
      if (type === "aviation") return "🦅";
      if (type === "magical") return "🔮";
      else return "⚔️";
    }

    // v1.4 added state reference for regiments
    pack.states.filter(s => s.military).forEach(s => s.military.forEach(r => (r.state = s.i)));
  }

  if (version < 1.5) {
    // not need to store default styles from v 1.5
    localStorage.removeItem("styleClean");
    localStorage.removeItem("styleGloom");
    localStorage.removeItem("styleAncient");
    localStorage.removeItem("styleMonochrome");

    // v1.5 cultures has shield attribute
    pack.cultures.forEach(culture => {
      if (culture.removed) return;
      culture.shield = Cultures.getRandomShield();
    });

    // v1.5 added burg type value
    pack.burgs.forEach(burg => {
      if (!burg.i || burg.removed) return;
      burg.type = BurgsAndStates.getType(burg.cell, burg.port);
    });

    // v1.5 added emblems
    defs.append("g").attr("id", "defs-emblems");
    emblems = viewbox.insert("g", "#population").attr("id", "emblems").style("display", "none");
    emblems.append("g").attr("id", "burgEmblems");
    emblems.append("g").attr("id", "provinceEmblems");
    emblems.append("g").attr("id", "stateEmblems");
    regenerateEmblems();
    toggleEmblems();

    // v1.5 changed releif icons data
    terrain.selectAll("use").each(function () {
      const type = this.getAttribute("data-type") || this.getAttribute("xlink:href");
      this.removeAttribute("xlink:href");
      this.removeAttribute("data-type");
      this.removeAttribute("data-size");
      this.setAttribute("href", type);
    });
  }

  if (version < 1.6) {
    // v1.6 changed rivers data
    for (const river of pack.rivers) {
      const el = document.getElementById("river" + river.i);
      if (el) {
        river.widthFactor = +el.getAttribute("data-width");
        el.removeAttribute("data-width");
        el.removeAttribute("data-increment");
        river.discharge = pack.cells.fl[river.mouth] || 1;
        river.width = rn(river.length / 100, 2);
        river.sourceWidth = 0.1;
      } else {
        Rivers.remove(river.i);
      }
    }

    // v1.6 changed lakes data
    for (const f of pack.features) {
      if (f.type !== "lake") continue;
      if (f.evaporation) continue;

      f.flux = f.flux || f.cells * 3;
      f.temp = grid.cells.temp[pack.cells.g[f.firstCell]];
      f.height = f.height || d3.min(pack.cells.c[f.firstCell].map(c => pack.cells.h[c]).filter(h => h >= 20));
      const height = (f.height - 18) ** heightExponentInput.value;
      const evaporation = ((700 * (f.temp + 0.006 * height)) / 50 + 75) / (80 - f.temp);
      f.evaporation = rn(evaporation * f.cells);
      f.name = f.name || Lakes.getName(f);
      delete f.river;
    }
  }

  if (version < 1.61) {
    // v1.61 changed rulers data
    ruler.style("display", null);
    rulers = new Rulers();

    ruler.selectAll(".ruler > .white").each(function () {
      const x1 = +this.getAttribute("x1");
      const y1 = +this.getAttribute("y1");
      const x2 = +this.getAttribute("x2");
      const y2 = +this.getAttribute("y2");
      if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return;
      const points = [
        [x1, y1],
        [x2, y2]
      ];
      rulers.create(Ruler, points);
    });

    ruler.selectAll("g.opisometer").each(function () {
      const pointsString = this.dataset.points;
      if (!pointsString) return;
      const points = JSON.parse(pointsString);
      rulers.create(Opisometer, points);
    });

    ruler.selectAll("path.planimeter").each(function () {
      const length = this.getTotalLength();
      if (length < 30) return;

      const step = length > 1000 ? 40 : length > 400 ? 20 : 10;
      const increment = length / Math.ceil(length / step);
      const points = [];
      for (let i = 0; i <= length; i += increment) {
        const point = this.getPointAtLength(i);
        points.push([point.x | 0, point.y | 0]);
      }

      rulers.create(Planimeter, points);
    });

    ruler.selectAll("*").remove();

    if (rulers.data.length) {
      turnButtonOn("toggleRulers");
      rulers.draw();
    } else turnButtonOff("toggleRulers");

    // 1.61 changed oceanicPattern from rect to image
    const pattern = document.getElementById("oceanic");
    const filter = pattern.firstElementChild.getAttribute("filter");
    const href = filter ? "./images/" + filter.replace("url(#", "").replace(")", "") + ".png" : "";
    pattern.innerHTML = /* html */ `<image id="oceanicPattern" href=${href} width="100" height="100" opacity="0.2"></image>`;
  }

  if (version < 1.62) {
    // v1.62 changed grid data
    gridOverlay.attr("size", null);
  }

  if (version < 1.63) {
    // v1.63 changed ocean pattern opacity element
    const oceanPattern = document.getElementById("oceanPattern");
    if (oceanPattern) oceanPattern.removeAttribute("opacity");
    const oceanicPattern = document.getElementById("oceanicPattern");
    if (!oceanicPattern.getAttribute("opacity")) oceanicPattern.setAttribute("opacity", 0.2);

    // v 1.63 moved label text-shadow from css to editable inline style
    burgLabels.select("#cities").style("text-shadow", "white 0 0 4px");
    burgLabels.select("#towns").style("text-shadow", "white 0 0 4px");
    labels.select("#states").style("text-shadow", "white 0 0 4px");
    labels.select("#addedLabels").style("text-shadow", "white 0 0 4px");
  }

  if (version < 1.64) {
    // v1.64 change states style
    const opacity = regions.attr("opacity");
    const filter = regions.attr("filter");
    statesBody.attr("opacity", opacity).attr("filter", filter);
    statesHalo.attr("opacity", opacity).attr("filter", "blur(5px)");
    regions.attr("opacity", null).attr("filter", null);
  }

  if (version < 1.65) {
    // v1.65 changed rivers data
    d3.select("#rivers").attr("style", null); // remove style to unhide layer
    const {cells, rivers} = pack;
    const defaultWidthFactor = rn(1 / (pointsInput.dataset.cells / 10000) ** 0.25, 2);

    for (const river of rivers) {
      const node = document.getElementById("river" + river.i);
      if (node && !river.cells) {
        const riverCells = [];
        const riverPoints = [];

        const length = node.getTotalLength() / 2;
        if (!length) continue;
        const segments = Math.ceil(length / 6);
        const increment = length / segments;

        for (let i = 0; i <= segments; i++) {
          const shift = increment * i;
          const {x: x1, y: y1} = node.getPointAtLength(length + shift);
          const {x: x2, y: y2} = node.getPointAtLength(length - shift);
          const x = rn((x1 + x2) / 2, 1);
          const y = rn((y1 + y2) / 2, 1);

          const cell = findCell(x, y);
          riverPoints.push([x, y]);
          riverCells.push(cell);
        }

        river.cells = riverCells;
        river.points = riverPoints;
      }

      river.widthFactor = defaultWidthFactor;

      cells.i.forEach(i => {
        const riverInWater = cells.r[i] && cells.h[i] < 20;
        if (riverInWater) cells.r[i] = 0;
      });
    }
  }

  if (version < 1.652) {
    // remove style to unhide layers
    rivers.attr("style", null);
    borders.attr("style", null);
  }

  if (version < 1.7) {
    // v1.7 changed markers data
    const defs = document.getElementById("defs-markers");
    const markersGroup = document.getElementById("markers");

    if (defs && markersGroup) {
      const markerElements = markersGroup.querySelectorAll("use");
      const rescale = +markersGroup.getAttribute("rescale");

      pack.markers = Array.from(markerElements).map((el, i) => {
        const id = el.getAttribute("id");
        const note = notes.find(note => note.id === id);
        if (note) note.id = `marker${i}`;

        let x = +el.dataset.x;
        let y = +el.dataset.y;

        const transform = el.getAttribute("transform");
        if (transform) {
          const [dx, dy] = parseTransform(transform);
          if (dx) x += +dx;
          if (dy) y += +dy;
        }
        const cell = findCell(x, y);
        const size = rn(rescale ? el.dataset.size * 30 : el.getAttribute("width"), 1);

        const href = el.href.baseVal;
        const type = href.replace("#marker_", "");
        const symbol = defs?.querySelector(`symbol${href}`);
        const text = symbol?.querySelector("text");
        const circle = symbol?.querySelector("circle");

        const icon = text?.innerHTML;
        const px = text && Number(text.getAttribute("font-size")?.replace("px", ""));
        const dx = text && Number(text.getAttribute("x")?.replace("%", ""));
        const dy = text && Number(text.getAttribute("y")?.replace("%", ""));
        const fill = circle && circle.getAttribute("fill");
        const stroke = circle && circle.getAttribute("stroke");

        const marker = {i, icon, type, x, y, size, cell};
        if (size && size !== 30) marker.size = size;
        if (!isNaN(px) && px !== 12) marker.px = px;
        if (!isNaN(dx) && dx !== 50) marker.dx = dx;
        if (!isNaN(dy) && dy !== 50) marker.dy = dy;
        if (fill && fill !== "#ffffff") marker.fill = fill;
        if (stroke && stroke !== "#000000") marker.stroke = stroke;
        if (circle?.getAttribute("opacity") === "0") marker.pin = "no";

        return marker;
      });

      markersGroup.style.display = null;
      defs?.remove();
      markerElements.forEach(el => el.remove());
      if (layerIsOn("markers")) drawMarkers();
    }
  }

  if (version < 1.72) {
    // v1.72 renamed custom style presets
    const storedStyles = Object.keys(localStorage).filter(key => key.startsWith("style"));
    storedStyles.forEach(styleName => {
      const style = localStorage.getItem(styleName);
      const newStyleName = styleName.replace(/^style/, customPresetPrefix);
      localStorage.setItem(newStyleName, style);
      localStorage.removeItem(styleName);
    });
  }

  if (version < 1.73) {
    // v1.73 moved the hatching patterns out of the user's SVG
    document.getElementById("hatching")?.remove();

    // v1.73 added zone type to UI, ensure type is populated
    const zones = Array.from(document.querySelectorAll("#zones > g"));
    zones.forEach(zone => {
      if (!zone.dataset.type) zone.dataset.type = "Unknown";
    });
  }

  if (version < 1.84) {
    // v1.84.0 added grid.cellsDesired to stored data
    if (!grid.cellsDesired) grid.cellsDesired = rn((graphWidth * graphHeight) / grid.spacing ** 2, -3);
  }

  if (version < 1.85) {
    // v1.84.0 moved intial screen out of maon svg
    svg.select("#initial").remove();
  }

  if (version < 1.86) {
    // v1.86.0 added multi-origin culture and religion hierarchy trees
    for (const culture of pack.cultures) {
      culture.origins = [culture.origin];
      delete culture.origin;
    }

    for (const religion of pack.religions) {
      religion.origins = [religion.origin];
      delete religion.origin;
    }
  }

  if (version < 1.88) {
    // v1.87 may have incorrect shield for some reason
    pack.states.forEach(({coa}) => {
      if (coa?.shield === "state") delete coa.shield;
    });
  }

  if (version < 1.89) {
    //May need a major bump
    
  }
}
