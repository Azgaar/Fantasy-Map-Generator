"use strict";

// update old map file to the current version
export function resolveVersionConflicts(mapVersion) {
  const isOlderThan = tagVersion => compareVersions(mapVersion, tagVersion).isOlder;

  if (isOlderThan("1.0.0")) {
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
    Zones.generate();
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

  if (isOlderThan("1.1.0")) {
    // v1.0 code had a bug with religion layer id
    if (!relig.size()) relig = viewbox.insert("g", "#terrain").attr("id", "relig");

    // v1.0 had Sympathy status then relaced with Friendly
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

  if (isOlderThan("1.11.0")) {
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

  if (isOlderThan("1.21.0")) {
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
      if (!length) return;

      const s = this.getPointAtLength(length);
      const e = this.getPointAtLength(0);
      const source = findCell(s.x, s.y);
      const mouth = findCell(e.x, e.y);
      const name = Rivers.getName(mouth);
      const type = length < 25 ? rw({Creek: 9, River: 3, Brook: 3, Stream: 1}) : "River";
      pack.rivers.push({i, parent: 0, length, source, mouth, basin: i, name, type});
    });
  }

  if (isOlderThan("1.22.0")) {
    // v1.22 changed state neighbors from Set object to array
    BurgsAndStates.collectStatistics();
  }

  if (isOlderThan("1.3.0")) {
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

  if (isOlderThan("1.4.0")) {
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

  if (isOlderThan("1.5.0")) {
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

  if (isOlderThan("1.6.0")) {
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

  if (isOlderThan("1.61.0")) {
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

  if (isOlderThan("1.62.0")) {
    // v1.62 changed grid data
    gridOverlay.attr("size", null);
  }

  if (isOlderThan("1.63.0")) {
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

  if (isOlderThan("1.64.0")) {
    // v1.64 change states style
    const opacity = regions.attr("opacity");
    const filter = regions.attr("filter");
    statesBody.attr("opacity", opacity).attr("filter", filter);
    statesHalo.attr("opacity", opacity).attr("filter", "blur(5px)");
    regions.attr("opacity", null).attr("filter", null);
  }

  if (isOlderThan("1.65.0")) {
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

  if (isOlderThan("1.652.0")) {
    // remove style to unhide layers
    rivers.attr("style", null);
    borders.attr("style", null);
  }

  if (isOlderThan("1.7.0")) {
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

  if (isOlderThan("1.72.0")) {
    // v1.72 renamed custom style presets
    const storedStyles = Object.keys(localStorage).filter(key => key.startsWith("style"));
    storedStyles.forEach(styleName => {
      const style = localStorage.getItem(styleName);
      const newStyleName = styleName.replace(/^style/, customPresetPrefix);
      localStorage.setItem(newStyleName, style);
      localStorage.removeItem(styleName);
    });
  }

  if (isOlderThan("1.73.0")) {
    // v1.73 moved the hatching patterns out of the user's SVG
    document.getElementById("hatching")?.remove();

    // v1.73 added zone type to UI, ensure type is populated
    const zones = Array.from(document.querySelectorAll("#zones > g"));
    zones.forEach(zone => {
      if (!zone.dataset.type) zone.dataset.type = "Unknown";
    });
  }

  if (isOlderThan("1.84.0")) {
    // v1.84.0 added grid.cellsDesired to stored data
    if (!grid.cellsDesired) grid.cellsDesired = rn((graphWidth * graphHeight) / grid.spacing ** 2, -3);
  }

  if (isOlderThan("1.85.0")) {
    // v1.84.0 moved intial screen out of maon svg
    svg.select("#initial").remove();
  }

  if (isOlderThan("1.86.0")) {
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

  if (isOlderThan("1.88.0")) {
    // v1.87 may have incorrect shield for some reason
    pack.states.forEach(({coa}) => {
      if (coa?.shield === "state") delete coa.shield;
    });
  }

  if (isOlderThan("1.91.0")) {
    // from 1.91.00 custom coa is moved to coa object
    pack.states.forEach(state => {
      if (state.coa === "custom") state.coa = {custom: true};
    });
    pack.provinces.forEach(province => {
      if (province.coa === "custom") province.coa = {custom: true};
    });
    pack.burgs.forEach(burg => {
      if (burg.coa === "custom") burg.coa = {custom: true};
    });

    // from 1.91.00 emblems don't have transform attribute
    emblems.selectAll("use").each(function () {
      const transform = this.getAttribute("transform");
      if (!transform) return;

      const [dx, dy] = parseTransform(transform);
      const x = Number(this.getAttribute("x")) + Number(dx);
      const y = Number(this.getAttribute("y")) + Number(dy);

      this.setAttribute("x", x);
      this.setAttribute("y", y);
      this.removeAttribute("transform");
    });

    // from 1.91.00 coaSize is moved to coa object
    pack.states.forEach(state => {
      if (state.coaSize && state.coa) {
        state.coa.size = state.coaSize;
        delete state.coaSize;
      }
    });

    pack.provinces.forEach(province => {
      if (province.coaSize && province.coa) {
        province.coa.size = province.coaSize;
        delete province.coaSize;
      }
    });

    pack.burgs.forEach(burg => {
      if (burg.coaSize && burg.coa) {
        burg.coa.size = burg.coaSize;
        delete burg.coaSize;
      }
    });
  }

  if (isOlderThan("1.92.0")) {
    // v1.92 change labels text-anchor from 'start' to 'middle'
    labels.selectAll("tspan").each(function () {
      this.setAttribute("x", 0);
    });
  }

  if (isOlderThan("1.94.0")) {
    // from v1.94.00 texture image is removed when layer is off
    texture.style("display", null);

    const textureImage = texture.select("image");
    if (textureImage.size()) {
      // restore parameters
      const x = Number(textureImage.attr("x") || 0);
      const y = Number(textureImage.attr("y") || 0);
      const href = textureImage.attr("xlink:href") || textureImage.attr("href") || textureImage.attr("src");
      // save parameters to parent element
      texture.attr("data-href", href).attr("data-x", x).attr("data-y", y);
      // recreate image in expected format
      textureImage.remove();
      drawTexture();
    }
  }

  if (isOlderThan("1.95.0")) {
    // v1.95.00 added vignette visual layer
    const mask = defs.append("mask").attr("id", "vignette-mask");
    mask.append("rect").attr("fill", "white").attr("x", 0).attr("y", 0).attr("width", "100%").attr("height", "100%");
    mask
      .append("rect")
      .attr("id", "vignette-rect")
      .attr("fill", "black")
      .attr("x", "0.3%")
      .attr("y", "0.4%")
      .attr("width", "99.4%")
      .attr("height", "99.2%")
      .attr("rx", "5%")
      .attr("ry", "5%")
      .attr("filter", "blur(20px)");

    const vignette = svg
      .append("g")
      .attr("id", "vignette")
      .attr("mask", "url(#vignette-mask)")
      .attr("opacity", 0.3)
      .attr("fill", "#000000")
      .style("display", "none");
    vignette.append("rect").attr("x", 0).attr("y", 0).attr("width", "100%").attr("height", "100%");
  }

  if (isOlderThan("1.96.0")) {
    // v1.96 added ocean rendering for heightmap
    terrs.selectAll("*").remove();

    const opacity = terrs.attr("opacity");
    const filter = terrs.attr("filter");
    const scheme = terrs.attr("scheme") || "bright";
    const terracing = terrs.attr("terracing");
    const skip = terrs.attr("skip");
    const relax = terrs.attr("relax");

    const curveTypes = {0: "curveBasisClosed", 1: "curveLinear", 2: "curveStep"};
    const curve = curveTypes[terrs.attr("curve")] || "curveBasisClosed";

    terrs
      .attr("opacity", null)
      .attr("filter", null)
      .attr("mask", null)
      .attr("scheme", null)
      .attr("terracing", null)
      .attr("skip", null)
      .attr("relax", null)
      .attr("curve", null);

    terrs
      .append("g")
      .attr("id", "oceanHeights")
      .attr("data-render", 0)
      .attr("opacity", opacity)
      .attr("filter", filter)
      .attr("scheme", scheme)
      .attr("terracing", 0)
      .attr("skip", 0)
      .attr("relax", 1)
      .attr("curve", curve);

    terrs
      .append("g")
      .attr("id", "landHeights")
      .attr("opacity", opacity)
      .attr("scheme", scheme)
      .attr("filter", filter)
      .attr("terracing", terracing)
      .attr("skip", skip)
      .attr("relax", relax)
      .attr("curve", curve)
      .attr("mask", "url(#land)");

    if (layerIsOn("toggleHeight")) drawHeightmap();

    // v1.96.00 moved scaleBar options from units editor to style
    d3.select("#scaleBar").remove();

    scaleBar = svg
      .insert("g", "#viewbox + *")
      .attr("id", "scaleBar")
      .attr("opacity", 1)
      .attr("fill", "#353540")
      .attr("data-bar-size", 2)
      .attr("font-size", 10)
      .attr("data-x", 99)
      .attr("data-y", 99)
      .attr("data-label", "");

    scaleBar
      .append("rect")
      .attr("id", "scaleBarBack")
      .attr("opacity", 0.2)
      .attr("fill", "#ffffff")
      .attr("stroke", "#000000")
      .attr("stroke-width", 1)
      .attr("filter", "url(#blur5)")
      .attr("data-top", 20)
      .attr("data-right", 15)
      .attr("data-bottom", 15)
      .attr("data-left", 10);

    drawScaleBar(scaleBar, scale);
    fitScaleBar(scaleBar, svgWidth, svgHeight);

    if (!layerIsOn("toggleScaleBar")) scaleBar.style("display", "none");

    // v1.96.00 changed coloring approach for regiments
    armies.selectAll(":scope > g").each(function () {
      const fill = this.getAttribute("fill");
      if (!fill) return;
      const darkerColor = d3.color(fill).darker().hex();
      this.setAttribute("color", darkerColor);
      this.querySelectorAll("g > rect:nth-child(2)").forEach(rect => {
        rect.setAttribute("fill", "currentColor");
      });
    });
  }

  if (isOlderThan("1.97.0")) {
    // v1.97.00 changed MFCG link to an arbitrary preview URL
    options.villageMaxPopulation = 2000;
    options.showBurgPreview = options.showMFCGMap;
    delete options.showMFCGMap;

    pack.burgs.forEach(burg => {
      if (!burg.i || burg.removed) return;

      if (burg.MFCG) {
        burg.link = getBurgLink(burg);
        delete burg.MFCG;
      }
    });
  }

  if (isOlderThan("1.98.0")) {
    // v1.98.00 changed compass layer and rose element id
    const rose = compass.select("use");
    rose.attr("xlink:href", "#defs-compass-rose");

    if (!compass.selectAll("*").size()) {
      compass.style("display", "none");
      compass.append("use").attr("xlink:href", "#defs-compass-rose");
      shiftCompass();
    }
  }

  if (isOlderThan("1.99.0")) {
    // v1.99.00 changed routes generation algorithm and data format
    routes.attr("display", null).attr("style", null);

    delete cells.road;
    delete cells.crossroad;

    pack.routes = [];
    const POINT_DISTANCE = grid.spacing * 0.75;

    for (const g of document.querySelectorAll("#viewbox > #routes > g")) {
      const group = g.id;
      if (!group) continue;

      for (const node of g.querySelectorAll("path")) {
        const totalLength = node.getTotalLength();
        if (!totalLength) {
          ERROR && console.error("Route path has zero length", node);
          continue;
        }

        const increment = totalLength / Math.ceil(totalLength / POINT_DISTANCE);
        const points = [];

        for (let i = 0; i <= totalLength + 0.1; i += increment) {
          const point = node.getPointAtLength(i);
          const x = rn(point.x, 2);
          const y = rn(point.y, 2);
          const cellId = findCell(x, y);
          points.push([x, y, cellId]);
        }

        if (points.length < 2) {
          ERROR && console.error("Route path has less than 2 points", node);
          continue;
        }

        const secondCellId = points[1][2];
        const feature = pack.cells.f[secondCellId];

        pack.routes.push({i: pack.routes.length, group, feature, points});
      }
    }
    routes.selectAll("path").remove();
    if (layerIsOn("toggleRoutes")) drawRoutes();

    const links = (pack.cells.routes = {});
    for (const route of pack.routes) {
      for (let i = 0; i < route.points.length - 1; i++) {
        const cellId = route.points[i][2];
        const nextCellId = route.points[i + 1][2];

        if (cellId !== nextCellId) {
          if (!links[cellId]) links[cellId] = {};
          links[cellId][nextCellId] = route.i;

          if (!links[nextCellId]) links[nextCellId] = {};
          links[nextCellId][cellId] = route.i;
        }
      }
    }
  }

  if (isOlderThan("1.100.0")) {
    // v1.100.00 added zones to pack data
    pack.zones = [];
    zones.selectAll("g").each(function () {
      const i = pack.zones.length;
      const name = this.dataset.description;
      const type = this.dataset.type;
      const color = this.getAttribute("fill");
      const cells = this.dataset.cells.split(",").map(Number);
      pack.zones.push({i, name, type, cells, color});
    });
    zones.style("display", null).selectAll("*").remove();
    if (layerIsOn("toggleZones")) drawZones();
  }
}
