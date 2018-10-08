function editBurg() {
  if (customization) return;
  unselect();
  closeDialogs("#burgEditor, .stable");
  elSelected = d3.select(this);
  const id = +elSelected.attr("data-id");
  if (id === undefined) return;
  d3.selectAll("[data-id='" + id + "']").call(d3.drag().on("start", elementDrag)).classed("draggable", true);

  // update Burg details
  const type = elSelected.node().parentNode.id;
  const labelGroup = burgLabels.select("#"+type);
  const iconGroup = burgIcons.select("#"+type);
  burgNameInput.value = manors[id].name;
  updateBurgsGroupOptions();
  burgSelectGroup.value = labelGroup.attr("id");
  burgSelectDefaultFont.value = fonts.indexOf(labelGroup.attr("data-font"));
  burgSetLabelSize.value = labelGroup.attr("data-size");
  burgLabelColorInput.value = toHEX(labelGroup.attr("fill"));
  burgLabelOpacity.value = labelGroup.attr("opacity") === undefined ? 1 : +labelGroup.attr("opacity");
  const tr = parseTransform(elSelected.attr("transform"));
  burgLabelAngle.value = tr[2];
  burgLabelAngleOutput.innerHTML = Math.abs(+tr[2]) + "°";
  burgIconSize.value = iconGroup.attr("size");
  burgIconFillOpacity.value = iconGroup.attr("fill-opacity") === undefined ? 1 : +iconGroup.attr("fill-opacity");
  burgIconFillColor.value = iconGroup.attr("fill");
  burgIconStrokeWidth.value = iconGroup.attr("stroke-width");
  burgIconStrokeOpacity.value = iconGroup.attr("stroke-opacity") === undefined ? 1 : +iconGroup.attr("stroke-opacity");
  burgIconStrokeColor.value = iconGroup.attr("stroke");
  const cell = cells[manors[id].cell];
  if (cell.region !== "neutral" && cell.region !== undefined) {
    burgToggleCapital.disabled = false;
    const capital = states[manors[id].region] ? id === states[manors[id].region].capital ? 1 : 0 : 0;
    d3.select("#burgToggleCapital").classed("pressed", capital);
  } else {
    burgToggleCapital.disabled = true;
    d3.select("#burgToggleCapital").classed("pressed", false);
  }
  d3.select("#burgTogglePort").classed("pressed", cell.port !== undefined);
  burgPopulation.value = manors[id].population;
  burgPopulationFriendly.value = rn(manors[id].population * urbanization.value * populationRate.value * 1000);

  $("#burgEditor").dialog({
    title: "Edit Burg: " + manors[id].name,
    minHeight: 30, width: "auto", resizable: false,
    position: {my: "center top+40", at: "top", of: d3.event},
    close: function() {
      d3.selectAll("[data-id='" + id + "']").call(d3.drag().on("drag", null)).classed("draggable", false);
      elSelected = null;
    }
  });

  if (modules.editBurg) return;
  modules.editBurg = true;

  loadDefaultFonts();

  function updateBurgsGroupOptions() {
    burgSelectGroup.innerHTML = "";
    burgIcons.selectAll("g").each(function(d) {
      const opt = document.createElement("option");
      opt.value = opt.innerHTML = d3.select(this).attr("id");
      burgSelectGroup.add(opt);
    });
  }

  $("#burgEditor > button").not("#burgAddfromEditor").not("#burgRelocate").not("#burgRemove").click(function() {
    if ($(this).next().is(":visible")) {
      $("#burgEditor > button").show();
      $(this).next("div").hide();
    } else {
      $("#burgEditor > *").not(this).hide();
      $(this).next("div").show();
    }
  });

  $("#burgEditor > div > button").click(function() {
    if ($(this).next().is(":visible")) {
      $("#burgEditor > div > button").show();
      $(this).parent().prev().show();
      $(this).next("div").hide();
    } else {
      $("#burgEditor > div > button").not(this).hide();
      $(this).parent().prev().hide();
      $(this).next("div").show();
    }
  });

  $("#burgSelectGroup").change(function() {
    const id = +elSelected.attr("data-id");
    const g = this.value;
    moveBurgToGroup(id, g);
  });

  $("#burgInputGroup").change(function() {
    let newGroup = this.value.toLowerCase().replace(/ /g, "_").replace(/[^\w\s]/gi, "");
    if (Number.isFinite(+newGroup.charAt(0))) newGroup = "g" + newGroup;
    if (burgLabels.select("#"+newGroup).size()) {
      tip('The group "'+ newGroup + '" is already exists');
      return;
    }
    burgInputGroup.value = "";
    // clone old group assigning new id
    const id = elSelected.node().parentNode.id;
    const l = burgLabels.select("#"+id).node().cloneNode(false);
    l.id = newGroup;
    const i = burgIcons.select("#"+id).node().cloneNode(false);
    i.id = newGroup;
    burgLabels.node().insertBefore(l, null);
    burgIcons.node().insertBefore(i, null);
    // select new group
    const opt = document.createElement("option");
    opt.value = opt.innerHTML = newGroup;
    burgSelectGroup.add(opt);
    $("#burgSelectGroup").val(newGroup).change();
    $("#burgSelectGroup, #burgInputGroup").toggle();
    updateLabelGroups();
  });

  $("#burgAddGroup").click(function() {
    if ($("#burgInputGroup").css("display") === "none") {
      $("#burgInputGroup").css("display", "inline-block");
      $("#burgSelectGroup").css("display", "none");
      burgInputGroup.focus();
    } else {
      $("#burgSelectGroup").css("display", "inline-block");
      $("#burgInputGroup").css("display", "none");
    }
  });

  $("#burgRemoveGroup").click(function() {
    const group = d3.select(elSelected.node().parentNode);
    const type = group.attr("id");
    const id = +elSelected.attr("data-id");
    const count = group.selectAll("*").size();
    const message = "Are you sure you want to remove all Burgs (" + count + ") of that group?";
    alertMessage.innerHTML = message;
    $("#alert").dialog({resizable: false, title: "Remove Burgs",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          group.selectAll("*").each(function(d) {
            const id = +d3.select(this).attr("data-id");
            if (id === undefined) return;
            const cell = manors[id].cell;
            const state = manors[id].region;
            if (states[state]) {
              if (states[state].capital === id) states[state].capital = "select";
              states[state].burgs --;
            }
            manors[id].region = "removed";
            cells[cell].manor = undefined;
          });
          burgLabels.select("#"+type).selectAll("*").remove();
          burgIcons.select("#"+type).selectAll("*").remove();
          $("#icons g[id*='anchors'] [data-id=" + id + "]").parent().children().remove();
          closeDialogs(".stable");
          updateCountryEditors();
          $("#burgEditor").dialog("close");
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });

  });

  $("#burgNameInput").on("input", function() {
    if (this.value === "") {
      tip("Name should not be blank, set opacity to 0 to hide label or remove button to delete");
      return;
    }
    const id = +elSelected.attr("data-id");
    burgLabels.selectAll("[data-id='" + id + "']").text(this.value);
    manors[id].name = this.value;
    $("div[aria-describedby='burgEditor'] .ui-dialog-title").text("Edit Burg: " + this.value);
  });

  $("#burgNameReCulture, #burgNameReRandom").click(function() {
    const id = +elSelected.attr("data-id");
    const culture = this.id === "burgNameReCulture" ? manors[id].culture : Math.floor(Math.random() * cultures.length);
    const name = generateName(culture);
    burgLabels.selectAll("[data-id='" + id + "']").text(name);
    manors[id].name = name;
    burgNameInput.value = name;
    $("div[aria-describedby='burgEditor'] .ui-dialog-title").text("Edit Burg: " + name);
  });

  $("#burgToggleExternalFont").click(function() {
    if ($("#burgInputExternalFont").css("display") === "none") {
      $("#burgInputExternalFont").css("display", "inline-block");
      $("#burgSelectDefaultFont").css("display", "none");
      burgInputExternalFont.focus();
    } else {
      $("#burgSelectDefaultFont").css("display", "inline-block");
      $("#burgInputExternalFont").css("display", "none");
    }
  });

  $("#burgSelectDefaultFont").change(function() {
    const type = elSelected.node().parentNode.id;
    const group = burgLabels.select("#"+type);
    if (burgSelectDefaultFont.value === "") return;
    const font = fonts[burgSelectDefaultFont.value].split(':')[0].replace(/\+/g, " ");
    group.attr("font-family", font).attr("data-font", fonts[burgSelectDefaultFont.value]);
  });

  $("#burgInputExternalFont").change(function() {
    fetchFonts(this.value).then(fetched => {
      if (!fetched) return;
      burgToggleExternalFont.click();
      burgInputExternalFont.value = "";
      if (fetched === 1) $("#burgSelectDefaultFont").val(fonts.length - 1).change();
    });
  });

  $("#burgSetLabelSize").on("input", function() {
    const type = elSelected.node().parentNode.id;
    const group = burgLabels.select("#"+type);
    group.attr("data-size", +this.value);
    invokeActiveZooming();
  });

  $("#burgLabelColorInput").on("input", function() {
    const type = elSelected.node().parentNode.id;
    const group = burgLabels.select("#"+type);
    group.attr("fill", this.value);
  });

  $("#burgLabelOpacity").on("input", function() {
    const type = elSelected.node().parentNode.id;
    const group = burgLabels.select("#"+type);
    group.attr("opacity", +this.value);
  });

  $("#burgLabelAngle").on("input", function() {
    const id = +elSelected.attr("data-id");
    const el = burgLabels.select("[data-id='"+ id +"']");
    const tr = parseTransform(el.attr("transform"));
    const c = el.node().getBBox();
    burgLabelAngleOutput.innerHTML = Math.abs(+this.value) + "°";
    const angle = +this.value;
    const transform = `translate(${tr[0]},${tr[1]}) rotate(${angle} ${(c.x+c.width/2)} ${(c.y+c.height/2)})`;
    el.attr("transform", transform);
  });

  $("#burgIconSize").on("input", function() {
    const type = elSelected.node().parentNode.id;
    const group = burgIcons.select("#"+type);
    const size = +this.value;
    group.attr("size", size);
    group.selectAll("*").each(function() {d3.select(this).attr("r", size)});
  });

  $("#burgIconFillOpacity").on("input", function() {
    const type = elSelected.node().parentNode.id;
    const group = burgIcons.select("#"+type);
    group.attr("fill-opacity", +this.value);
  });

  $("#burgIconFillColor").on("input", function() {
    const type = elSelected.node().parentNode.id;
    const group = burgIcons.select("#"+type);
    group.attr("fill", this.value);
  });

  $("#burgIconStrokeWidth").on("input", function() {
    const type = elSelected.node().parentNode.id;
    const group = burgIcons.select("#"+type);
    group.attr("stroke-width", +this.value);
  });

  $("#burgIconStrokeOpacity").on("input", function() {
    const type = elSelected.node().parentNode.id;
    const group = burgIcons.select("#"+type);
    group.attr("stroke-opacity", +this.value);
  });

  $("#burgIconStrokeColor").on("input", function() {
    const type = elSelected.node().parentNode.id;
    const group = burgIcons.select("#"+type);
    group.attr("stroke", this.value);
  });

  $("#burgToggleCapital").click(function() {
    const id = +elSelected.attr("data-id");
    const state = manors[id].region;
    if (states[state] === undefined) return;
    const capital = states[manors[id].region] ? id === states[manors[id].region].capital ? 0 : 1 : 1;
    if (capital && states[state].capital !== "select") {
      // move oldCapital to a town group
      const oldCapital = states[state].capital;
      moveBurgToGroup(oldCapital, "towns");
    }
    states[state].capital = capital ? id : "select";
    d3.select("#burgToggleCapital").classed("pressed", capital);
    const g = capital ? "capitals" : "towns";
    moveBurgToGroup(id, g);
  });

  $("#burgTogglePort").click(function() {
    const id = +elSelected.attr("data-id");
    const cell = cells[manors[id].cell];
    const markAsPort = cell.port === undefined ? true : undefined;
    cell.port = markAsPort;
    d3.select("#burgTogglePort").classed("pressed", markAsPort);
    if (markAsPort) {
      const type = elSelected.node().parentNode.id;
      const ag = type === "capitals" ? "#capital-anchors" : "#town-anchors";
      const group = icons.select(ag);
      const size = +group.attr("size");
      const x = rn(manors[id].x - size * 0.47, 2);
      const y = rn(manors[id].y - size * 0.47, 2);
      group.append("use").attr("xlink:href", "#icon-anchor").attr("data-id", id)
        .attr("x", x).attr("y", y).attr("width", size).attr("height", size)
        .on("click", editIcon);
    } else {
      $("#icons g[id*='anchors'] [data-id=" + id + "]").remove();
    }
  });

  $("#burgPopulation").on("input", function() {
    const id = +elSelected.attr("data-id");
    burgPopulationFriendly.value = rn(this.value * urbanization.value * populationRate.value * 1000);
    manors[id].population = +this.value;
  });

  $("#burgRelocate").click(function() {
    if ($(this).hasClass('pressed')) {
      $(".pressed").removeClass('pressed');
      restoreDefaultEvents();
      tip("", true);
    } else {
      $(".pressed").removeClass('pressed');
      const id = elSelected.attr("data-id");
      $(this).addClass('pressed').attr("data-id", id);
      viewbox.style("cursor", "crosshair").on("click", relocateBurgOnClick);
      tip("Click on map to relocate burg. Hold Shift for continuous move", true);
    }
  });

  // open legendsEditor
  document.getElementById("burglLegend").addEventListener("click", function() {
    let burg = +elSelected.attr("data-id");
    let id = "burg" + burg;
    let name = manors[burg].name;
    editLegends(id, name);
  });

  // move burg to a different cell
  function relocateBurgOnClick() {
    const point = d3.mouse(this);
    const index = getIndex(point);
    const i = +$("#burgRelocate").attr("data-id");
    if (isNaN(i) || !manors[i]) return;

    if (cells[index].height < 20) {
      tip("Cannot place burg in the water! Select a land cell", null, "error");
      return;
    }

    if (cells[index].manor !== undefined && cells[index].manor !== i) {
      tip("There is already a burg in this cell. Please select a free cell", null, "error");
      $('#grid').fadeIn();
      d3.select("#toggleGrid").classed("buttonoff", false);
      return;
    }

    let region = cells[index].region;
    const oldRegion = manors[i].region;
    // relocating capital to other country you "conquer" target cell
    if (states[oldRegion] && states[oldRegion].capital === i) {
      if (region !== oldRegion) {
        tip("Capital cannot be moved to another country!", null, "error");
        return;
      }
    }

    if (d3.event.shiftKey === false) {
      $("#burgRelocate").removeClass("pressed");
      restoreDefaultEvents();
      tip("", true);
      if (region !== oldRegion) {
        recalculateStateData(oldRegion);
        recalculateStateData(region);
        updateCountryEditors();
      }
    }

    const x = rn(point[0],2), y = rn(point[1],2);
    burgIcons.select("circle[data-id='"+i+"']").attr("transform", null).attr("cx", x).attr("cy", y);
    burgLabels.select("text[data-id='"+i+"']").attr("transform", null).attr("x", x).attr("y", y);
    const anchor = icons.select("use[data-id='"+i+"']");
    if (anchor.size()) {
      const size = anchor.attr("width");
      const xa = rn(x - size * 0.47, 2);
      const ya = rn(y - size * 0.47, 2);
      anchor.attr("transform", null).attr("x", xa).attr("y", ya);
    }
    cells[index].manor = i;
    cells[manors[i].cell].manor = undefined;
    manors[i].x = x, manors[i].y = y, manors[i].region = region, manors[i].cell = index;
  }

  // open in MFCG
  $("#burgSeeInMFCG").click(function() {
    const id = +elSelected.attr("data-id");
    const name = manors[id].name;
    const cell = manors[id].cell;
    const pop = rn(manors[id].population);
    const size = pop > 65 ? 65 : pop < 6 ? 6 : pop;
    const s = seed + "" + id;
    const hub = cells[cell].crossroad > 2 ? 1 : 0;
    const river = cells[cell].river ? 1 : 0;
    const coast = cells[cell].port !== undefined ? 1 : 0;
    const sec = pop > 40 ? 1 : Math.random() < pop / 100 ? 1 : 0;
    const thr = sec && Math.random() < 0.8 ? 1 : 0;
    const url = "http://fantasycities.watabou.ru/";
    let params = `?name=${name}&size=${size}&seed=${s}&hub=${hub}&random=0&continuous=0`;
    params += `&river=${river}&coast=${coast}&citadel=${id&1}&plaza=${sec}&temple=${thr}&walls=${sec}&shantytown=${sec}`;
    const win = window.open(url+params, '_blank');
    win.focus();
  });

  $("#burgAddfromEditor").click(function() {
    clickToAdd(); // to load on click event function
    $("#addBurg").click();
  });

  $("#burgRemove").click(function() {
    alertMessage.innerHTML = `Are you sure you want to remove the Burg?`;
    $("#alert").dialog({resizable: false, title: "Remove Burg",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          const id = +elSelected.attr("data-id");
          d3.selectAll("[data-id='" + id + "']").remove();
          const cell = manors[id].cell;
          const state = manors[id].region;
          if (states[state]) {
            if (states[state].capital === id) states[state].capital = "select";
            states[state].burgs --;
          }
          manors[id].region = "removed";
          cells[cell].manor = undefined;
          closeDialogs(".stable");
          updateCountryEditors();
        },
        Cancel: function() {$(this).dialog("close");}
      }
    })
  });
}

  // clear elSelected variable
  function unselect() {
    tip("", true);
    restoreDefaultEvents();
    if (customization === 5) customization = 0;
    if (!elSelected) return;
    elSelected.call(d3.drag().on("drag", null)).attr("class", null);
    debug.selectAll("*").remove();
    viewbox.style("cursor", "default");
    elSelected = null;
  }

  // transform string to array [translateX,translateY,rotateDeg,rotateX,rotateY,scale]
  function parseTransform(string) {
    if (!string) {return [0,0,0,0,0,1];}
    const a = string.replace(/[a-z()]/g, "").replace(/[ ]/g, ",").split(",");
    return [a[0] || 0, a[1] || 0, a[2] || 0, a[3] || 0, a[4] || 0, a[5] || 1];
  }

  // generic function to move any burg to any group
  function moveBurgToGroup(id, g) {
    $("#burgLabels [data-id=" + id + "]").detach().appendTo($("#burgLabels > #"+g));
    $("#burgIcons [data-id=" + id + "]").detach().appendTo($("#burgIcons > #"+g));
    const rSize = $("#burgIcons > #"+g).attr("size");
    $("#burgIcons [data-id=" + id + "]").attr("r", rSize);
    const el = $("#icons g[id*='anchors'] [data-id=" + id + "]");
    if (el.length) {
      const to = g === "towns" ? $("#town-anchors") : $("#capital-anchors");
      el.detach().appendTo(to);
      const useSize = to.attr("size");
      const x = rn(manors[id].x - useSize * 0.47, 2);
      const y = rn(manors[id].y - useSize * 0.47, 2);
      el.attr("x", x).attr("y", y).attr("width", useSize).attr("height", useSize);
    }
    updateCountryEditors();
  }

  // generate cultures for a new map based on options and namesbase
  function generateCultures() {
    const count = +culturesInput.value;
    cultures = d3.shuffle(defaultCultures).slice(0, count);
    const centers = d3.range(cultures.length).map(function(d, i) {
      const x = Math.floor(Math.random() * graphWidth * 0.8 + graphWidth * 0.1);
      const y = Math.floor(Math.random() * graphHeight * 0.8 + graphHeight * 0.1);
      const center = [x, y];
      cultures[i].center = center;
      return center;
    });
    cultureTree = d3.quadtree(centers);
  }

  function manorsAndRegions() {
    console.group('manorsAndRegions');
    calculateChains();
    rankPlacesGeography();
    locateCapitals();
    generateMainRoads();
    rankPlacesEconomy();
    locateTowns();
    getNames();
    shiftSettlements();
    checkAccessibility();
    defineRegions("withCultures");
    generatePortRoads();
    generateSmallRoads();
    generateOceanRoutes();
    calculatePopulation();
    drawManors();
    drawRegions();
    console.groupEnd('manorsAndRegions');
  }

  // Assess cells geographycal suitability for settlement
  function rankPlacesGeography() {
    console.time('rankPlacesGeography');
    land.map(function(c) {
      let score = 0;
      c.flux = rn(c.flux, 2);
      // get base score from height (will be biom)
      if (c.height <= 40) score = 2;
      else if (c.height <= 50) score = 1.8;
      else if (c.height <= 60) score = 1.6;
      else if (c.height <= 80) score = 1.4;
      score += (1 - c.height / 100) / 3;
      if (c.ctype && Math.random() < 0.8 && !c.river) {
        c.score = 0; // ignore 80% of extended cells
      } else {
        if (c.harbor) {
          if (c.harbor === 1) {score += 1;} else {score -= 0.3;} // good sea harbor is valued
        }
        if (c.river) score += 1; // coastline is valued
        if (c.river && c.ctype === 1) score += 1; // estuary is valued
        if (c.flux > 1) score += Math.pow(c.flux, 0.3); // riverbank is valued
        if (c.confluence) score += Math.pow(c.confluence, 0.7); // confluence is valued;
        const neighbEv = c.neighbors.map(function(n) {if (cells[n].height >= 20) return cells[n].height;});
        const difEv = c.height - d3.mean(neighbEv);
        // if (!isNaN(difEv)) score += difEv * 10 * (1 - c.height / 100); // local height maximums are valued
      }
      c.score = rn(Math.random() * score + score, 3); // add random factor
    });
    land.sort(function(a, b) {return b.score - a.score;});
    console.timeEnd('rankPlacesGeography');
  }

  // Assess the cells economical suitability for settlement
  function rankPlacesEconomy() {
    console.time('rankPlacesEconomy');
    land.map(function(c) {
      let score = c.score;
      let path = c.path || 0; // roads are valued
      if (path) {
        path = Math.pow(path, 0.2);
        const crossroad = c.crossroad || 0; // crossroads are valued
        score = score + path + crossroad;
      }
      c.score = rn(Math.random() * score + score, 2); // add random factor
    });
    land.sort(function(a, b) {return b.score - a.score;});
    console.timeEnd('rankPlacesEconomy');
  }

   // calculate population for manors, cells and states
  function calculatePopulation() {
    // neutral population factors < 1 as neutral lands are usually pretty wild
    const ruralFactor = 0.5, urbanFactor = 0.9;

    // calculate population for each burg (based on trade/people attractors)
    manors.map(function(m) {
      const cell = cells[m.cell];
      let score = cell.score;
      if (score <= 0) {score = rn(Math.random(), 2)}
      if (cell.crossroad) {score += cell.crossroad;} // crossroads
      if (cell.confluence) {score += Math.pow(cell.confluence, 0.3);} // confluences
      if (m.i !== m.region && cell.port) {score *= 1.5;} // ports (not capital)
      if (m.i === m.region && !cell.port) {score *= 2;} // land-capitals
      if (m.i === m.region && cell.port) {score *= 3;} // port-capitals
      if (m.region === "neutral") score *= urbanFactor;
      const rnd = 0.6 + Math.random() * 0.8; // random factor
      m.population = rn(score * rnd, 1);
    });

    // calculate rural population for each cell based on area + elevation (elevation to be changed to biome)
    const graphSizeAdj = 90 / Math.sqrt(cells.length, 2); // adjust to different graphSize
    land.map(function(l) {
      let population = 0;
      const elevationFactor = Math.pow(1 - l.height / 100, 3);
      population = elevationFactor * l.area * graphSizeAdj;
      if (l.region === "neutral") population *= ruralFactor;
      l.pop = rn(population, 1);
    });

    // calculate population for each region
    states.map(function(s, i) {
      // define region burgs count
      const burgs = $.grep(manors, function (e) {
        return e.region === i;
      });
      s.burgs = burgs.length;
      // define region total and burgs population
      let burgsPop = 0; // get summ of all burgs population
      burgs.map(function(b) {burgsPop += b.population;});
      s.urbanPopulation = rn(burgsPop, 2);
      const regionCells = $.grep(cells, function (e) {
        return e.region === i;
      });
      let cellsPop = 0;
      regionCells.map(function(c) {cellsPop += c.pop});
      s.cells = regionCells.length;
      s.ruralPopulation = rn(cellsPop, 1);
    });

    // collect data for neutrals
    const neutralCells = $.grep(cells, function(e) {return e.region === "neutral";});
    if (neutralCells.length) {
      let burgs = 0, urbanPopulation = 0, ruralPopulation = 0, area = 0;
      manors.forEach(function(m) {
        if (m.region !== "neutral") return;
        urbanPopulation += m.population;
        burgs++;
      });
      neutralCells.forEach(function(c) {
        ruralPopulation += c.pop;
        area += cells[c.index].area;
      });
      states.push({i: states.length, color: "neutral", name: "Neutrals", capital: "neutral",
        cells: neutralCells.length, burgs, urbanPopulation: rn(urbanPopulation, 2),
        ruralPopulation: rn(ruralPopulation, 2), area: rn(area)});
    }
  }

  function locateCapitals() {
    console.time('locateCapitals');
    // min distance detween capitals
    const count = +regionsInput.value;
    let spacing = (graphWidth + graphHeight) / 2 / count;
    console.log(" states: " + count);

    for (let l = 0; manors.length < count; l++) {
      const region = manors.length;
      const x = land[l].data[0],y = land[l].data[1];
      let minDist = 10000; // dummy value
      for (let c = 0; c < manors.length; c++) {
        const dist = Math.hypot(x - manors[c].x, y - manors[c].y);
        if (dist < minDist) minDist = dist;
        if (minDist < spacing) break;
      }
      if (minDist >= spacing) {
        const cell = land[l].index;
        const closest = cultureTree.find(x, y);
        const culture = getCultureId(closest);
        manors.push({i: region, cell, x, y, region, culture});
      }
      if (l === land.length - 1) {
        console.error("Cannot place capitals with current spacing. Trying again with reduced spacing");
        l = -1, manors = [], spacing /= 1.2;
      }
    }

    // For each capital create a country
    const scheme = count <= 8 ? colors8 : colors20;
    const mod = +powerInput.value;
    manors.forEach(function(m, i) {
      const power = rn(Math.random() * mod / 2 + 1, 1);
      const color = scheme(i / count);
      states.push({i, color, power, capital: i});
      const p = cells[m.cell];
      p.manor = i;
      p.region = i;
      p.culture = m.culture;
    });
    console.timeEnd('locateCapitals');
  }

  function locateTowns() {
    console.time('locateTowns');
    const count = +manorsInput.value;
    const neutral = +neutralInput.value;
    const manorTree = d3.quadtree();
    manors.forEach(function(m) {manorTree.add([m.x, m.y]);});

    for (let l = 0; manors.length < count && l < land.length; l++) {
      const x = land[l].data[0],y = land[l].data[1];
      const c = manorTree.find(x, y);
      const d = Math.hypot(x - c[0],y - c[1]);
      if (d < 6) continue;
      const cell = land[l].index;
      let region = "neutral", culture = -1, closest = neutral;
      for (let c = 0; c < states.length; c++) {
        let dist = Math.hypot(manors[c].x - x, manors[c].y - y) / states[c].power;
        const cap = manors[c].cell;
        if (cells[cell].fn !== cells[cap].fn) dist *= 3;
        if (dist < closest) {region = c; closest = dist;}
      }
      if (closest > neutral / 5 || region === "neutral") {
        const closestCulture = cultureTree.find(x, y);
        culture = getCultureId(closestCulture);
      } else {
        culture = manors[region].culture;
      }
      land[l].manor = manors.length;
      land[l].culture = culture;
      land[l].region = region;
      manors.push({i: manors.length, cell, x, y, region, culture});
      manorTree.add([x, y]);
    }
    if (manors.length < count) {
      const error = "Cannot place all burgs. Requested " + count + ", placed " + manors.length;
      console.error(error);
    }
    console.timeEnd('locateTowns');
  }

  // shift settlements from cell point
  function shiftSettlements() {
    for (let i=0; i < manors.length; i++) {
      const capital = i < regionsInput.value;
      const cell = cells[manors[i].cell];
      let x = manors[i].x, y = manors[i].y;
      if ((capital && cell.harbor) || cell.harbor === 1) {
        // port: capital with any harbor and towns with good harbors
        if (cell.haven === undefined) {
          cell.harbor = undefined;
        } else {
          cell.port = cells[cell.haven].fn;
          x = cell.coastX;
          y = cell.coastY;
        }
      }
      if (cell.river && cell.type !== 1) {
        let shift = 0.2 * cell.flux;
        if (shift < 0.2) shift = 0.2;
        if (shift > 1) shift = 1;
        shift = Math.random() > .5 ? shift : shift * -1;
        x = rn(x + shift, 2);
        shift = Math.random() > .5 ? shift : shift * -1;
        y = rn(y + shift, 2);
      }
      cell.data[0] = manors[i].x = x;
      cell.data[1] = manors[i].y = y;
    }
  }

  // Validate each island with manors has port
  function checkAccessibility() {
    console.time("checkAccessibility");
    for (let f = 0; f < features.length; f++) {
      if (!features[f].land) continue;
      const manorsOnIsland = $.grep(land, function (e) {
        return e.manor !== undefined && e.fn === f;
      });
      if (!manorsOnIsland.length) continue;

      // if lake port is the only port on lake, remove port
      const lakePorts = $.grep(manorsOnIsland, function (p) {
        return p.port && !features[p.port].border;
      });
      if (lakePorts.length) {
        const lakes = [];
        lakePorts.forEach(function(p) {lakes[p.port] = lakes[p.port] ? lakes[p.port] + 1 : 1;});
        lakePorts.forEach(function(p) {if (lakes[p.port] === 1) p.port = undefined;});
      }

      // check how many ocean ports are there on island
      const oceanPorts = $.grep(manorsOnIsland, function (p) {
        return p.port && features[p.port].border;
      });
      if (oceanPorts.length) continue;
      const portCandidates = $.grep(manorsOnIsland, function (c) {
        return c.harbor && features[cells[c.harbor].fn].border && c.ctype === 1;
      });
      if (portCandidates.length) {
        // No ports on island. Upgrading first burg to port
        const candidate = portCandidates[0];
        candidate.harbor = 1;
        candidate.port = cells[candidate.haven].fn;
        const manor = manors[portCandidates[0].manor];
        candidate.data[0] = manor.x = candidate.coastX;
        candidate.data[1] = manor.y = candidate.coastY;
        // add score for each burg on island (as it's the only port)
        candidate.score += Math.floor((portCandidates.length - 1) / 2);
      } else {
        // No ports on island. Reducing score for burgs
        manorsOnIsland.forEach(function(e) {e.score -= 2;});
      }
    }
  console.timeEnd("checkAccessibility");
  }

  function generateMainRoads() {
    console.time("generateMainRoads");
    lineGen.curve(d3.curveBasis);
    if (states.length < 2 || manors.length < 2) return;
    for (let f = 0; f < features.length; f++) {
      if (!features[f].land) continue;
      const manorsOnIsland = $.grep(land, function(e) {return e.manor !== undefined && e.fn === f;});
      if (manorsOnIsland.length > 1) {
        for (let d = 1; d < manorsOnIsland.length; d++) {
          for (let m = 0; m < d; m++) {
            const path = findLandPath(manorsOnIsland[d].index, manorsOnIsland[m].index, "main");
            restorePath(manorsOnIsland[m].index, manorsOnIsland[d].index, "main", path);
          }
        }
      }
    }
    console.timeEnd("generateMainRoads");
  }

  // add roads from port to capital if capital is not a port
  function generatePortRoads() {
    console.time("generatePortRoads");
    if (!states.length || manors.length < 2) return;
    const portless = [];
    for (let s=0; s < states.length; s++) {
      const cell = manors[s].cell;
      if (cells[cell].port === undefined) portless.push(s);
    }
    for (let l=0; l < portless.length; l++) {
      const ports = $.grep(land, function(l) {return l.port !== undefined && l.region === portless[l];});
      if (!ports.length) continue;
      let minDist = 1000, end = -1;
      ports.map(function(p) {
        const dist = Math.hypot(e.data[0] - p.data[0],e.data[1] - p.data[1]);
        if (dist < minDist && dist > 1) {minDist = dist; end = p.index;}
      });
      if (end !== -1) {
        const start = manors[portless[l]].cell;
        const path = findLandPath(start, end, "direct");
        restorePath(end, start, "main", path);
      }
    }
    console.timeEnd("generatePortRoads");
  }

  function generateSmallRoads() {
    console.time("generateSmallRoads");
    if (manors.length < 2) return;
    for (let f = 0; f < features.length; f++) {
      const manorsOnIsland = $.grep(land, function (e) {
        return e.manor !== undefined && e.fn === f;
      });
      const l = manorsOnIsland.length;
      if (l > 1) {
        const secondary = rn((l + 8) / 10);
        for (let s = 0; s < secondary; s++) {
          var start = manorsOnIsland[Math.floor(Math.random() * l)].index;
          var end = manorsOnIsland[Math.floor(Math.random() * l)].index;
          var dist = Math.hypot(cells[start].data[0] - cells[end].data[0],cells[start].data[1] - cells[end].data[1]);
          if (dist > 10) {
            var path = findLandPath(start, end, "direct");
            restorePath(end, start, "small", path);
          }
        }
        manorsOnIsland.map(function(e, d) {
          if (!e.path && d > 0) {
            const start = e.index;
            let end = -1;
            const road = $.grep(land, function (e) {
              return e.path && e.fn === f;
            });
            if (road.length > 0) {
              let minDist = 10000;
              road.map(function(i) {
                const dist = Math.hypot(e.data[0] - i.data[0], e.data[1] - i.data[1]);
                if (dist < minDist) {minDist = dist; end = i.index;}
              });
            } else {
              end = manorsOnIsland[0].index;
            }
            const path = findLandPath(start, end, "main");
            restorePath(end, start, "small", path);
          }
        });
      }
    }
    console.timeEnd("generateSmallRoads");
  }

  function generateOceanRoutes() {
    console.time("generateOceanRoutes");
    lineGen.curve(d3.curveBasis);
    const cAnchors = icons.selectAll("#capital-anchors");
    const tAnchors = icons.selectAll("#town-anchors");
    const cSize = cAnchors.attr("size") || 2;
    const tSize = tAnchors.attr("size") || 1;

    const ports = [];
    // groups all ports on water feature
    for (let m = 0; m < manors.length; m++) {
      const cell = manors[m].cell;
      const port = cells[cell].port;
      if (port === undefined) continue;
      if (ports[port] === undefined) ports[port] = [];
      ports[port].push(cell);

      // draw anchor icon
      const group = m < states.length ? cAnchors : tAnchors;
      const size = m < states.length ? cSize : tSize;
      const x = rn(cells[cell].data[0] - size * 0.47, 2);
      const y = rn(cells[cell].data[1] - size * 0.47, 2);
      group.append("use").attr("xlink:href", "#icon-anchor").attr("data-id", m)
        .attr("x", x).attr("y", y).attr("width", size).attr("height", size);
      icons.selectAll("use").on("click", editIcon);
    }

    for (let w = 0; w < ports.length; w++) {
      if (!ports[w]) continue;
      if (ports[w].length < 2) continue;
      const onIsland = [];
      for (let i = 0; i < ports[w].length; i++) {
        const cell = ports[w][i];
        const fn = cells[cell].fn;
        if (onIsland[fn] === undefined) onIsland[fn] = [];
        onIsland[fn].push(cell);
      }

      for (let fn = 0; fn < onIsland.length; fn++) {
        if (!onIsland[fn]) continue;
        if (onIsland[fn].length < 2) continue;
        const start = onIsland[fn][0];
        const paths = findOceanPaths(start, -1);

        for (let h=1; h < onIsland[fn].length; h++) {
          // routes from all ports on island to 1st port on island
          restorePath(onIsland[fn][h],start, "ocean", paths);
        }

        // inter-island routes
        for (let c=fn+1; c < onIsland.length; c++) {
          if (!onIsland[c]) continue;
          if (!onIsland[c].length) continue;
          if (onIsland[fn].length > 3) {
            const end = onIsland[c][0];
            restorePath(end, start, "ocean", paths);
          }
        }

        if (features[w].border && !features[fn].border && onIsland[fn].length > 5) {
          // encircle the island
          onIsland[fn].sort(function(a, b) {return cells[b].cost - cells[a].cost;});
          for (let a = 2; a < onIsland[fn].length && a < 10; a++) {
            const from = onIsland[fn][1],to = onIsland[fn][a];
            const dist = Math.hypot(cells[from].data[0] - cells[to].data[0],cells[from].data[1] - cells[to].data[1]);
            const distPath = getPathDist(from, to);
            if (distPath > dist * 4 + 10) {
              const totalCost = cells[from].cost + cells[to].cost;
              const pathsAdd = findOceanPaths(from, to);
              if (cells[to].cost < totalCost) {
                restorePath(to, from, "ocean", pathsAdd);
                break;
              }
            }
          }
        }

      }

    }
    console.timeEnd("generateOceanRoutes");
  }

  function findLandPath(start, end, type) {
    // A* algorithm
    const queue = new PriorityQueue({
      comparator: function (a, b) {
        return a.p - b.p
      }
    });
    const cameFrom = [];
    const costTotal = [];
    costTotal[start] = 0;
    queue.queue({e: start, p: 0});
    while (queue.length > 0) {
      const next = queue.dequeue().e;
      if (next === end) {break;}
      const pol = cells[next];
      pol.neighbors.forEach(function(e) {
        if (cells[e].height >= 20) {
          let cost = cells[e].height / 100 * 2;
          if (cells[e].path && type === "main") {
            cost = 0.15;
          } else {
            if (typeof e.manor === "undefined") {cost += 0.1;}
            if (typeof e.river !== "undefined") {cost -= 0.1;}
            if (cells[e].harbor) {cost *= 0.3;}
            if (cells[e].path) {cost *= 0.5;}
            cost += Math.hypot(cells[e].data[0] - pol.data[0],cells[e].data[1] - pol.data[1]) / 30;
          }
          const costNew = costTotal[next] + cost;
          if (!cameFrom[e] || costNew < costTotal[e]) { //
            costTotal[e] = costNew;
            cameFrom[e] = next;
            const dist = Math.hypot(cells[e].data[0] - cells[end].data[0], cells[e].data[1] - cells[end].data[1]) / 15;
            const priority = costNew + dist;
            queue.queue({e, p: priority});
          }
        }
      });
    }
    return cameFrom;
  }

  function findLandPaths(start, type) {
    // Dijkstra algorithm (not used now)
    const queue = new PriorityQueue({comparator: function(a, b) {return a.p - b.p}});
    const cameFrom = [],costTotal = [];
    cameFrom[start] = "no", costTotal[start] = 0;
    queue.queue({e: start, p: 0});
    while (queue.length > 0) {
      const next = queue.dequeue().e;
      const pol = cells[next];
      pol.neighbors.forEach(function(e) {
        if (cells[e].height < 20) return;
        let cost = cells[e].height / 100 * 2;
        if (e.river !== undefined) cost -= 0.2;
        if (pol.region !== cells[e].region) cost += 1;
        if (cells[e].region === "neutral") cost += 1;
        if (e.manor !== undefined) cost = 0.1;
        const costNew = costTotal[next] + cost;
        if (!cameFrom[e]) {
          costTotal[e] = costNew;
          cameFrom[e] = next;
          queue.queue({e, p: costNew});
        }
      });
    }
    return cameFrom;
  }

  function findOceanPaths(start, end) {
    const queue = new PriorityQueue({comparator: function(a, b) {return a.p - b.p}});
    let next;
    const cameFrom = [],costTotal = [];
    cameFrom[start] = "no", costTotal[start] = 0;
    queue.queue({e: start, p: 0});
    while (queue.length > 0 && next !== end) {
      next = queue.dequeue().e;
      const pol = cells[next];
      pol.neighbors.forEach(function(e) {
        if (cells[e].ctype < 0 || cells[e].haven === next) {
          let cost = 1;
          if (cells[e].ctype > 0) cost += 100;
          if (cells[e].ctype < -1) {
            const dist = Math.hypot(cells[e].data[0] - pol.data[0],cells[e].data[1] - pol.data[1]);
            cost += 50 + dist * 2;
          }
          if (cells[e].path && cells[e].ctype < 0) cost *= 0.8;
          const costNew = costTotal[next] + cost;
          if (!cameFrom[e]) {
            costTotal[e] = costNew;
            cells[e].cost = costNew;
            cameFrom[e] = next;
            queue.queue({e, p: costNew});
          }
        }
      });
    }
    return cameFrom;
  }

  function getPathDist(start, end) {
    const queue = new PriorityQueue({
      comparator: function (a, b) {
        return a.p - b.p
      }
    });
    let next, costNew;
    const cameFrom = [];
    const costTotal = [];
    cameFrom[start] = "no";
    costTotal[start] = 0;
    queue.queue({e: start, p: 0});
    while (queue.length > 0 && next !== end) {
      next = queue.dequeue().e;
      const pol = cells[next];
      pol.neighbors.forEach(function(e) {
        if (cells[e].path && (cells[e].ctype === -1 || cells[e].haven === next)) {
          const dist = Math.hypot(cells[e].data[0] - pol.data[0], cells[e].data[1] - pol.data[1]);
          costNew = costTotal[next] + dist;
          if (!cameFrom[e]) {
            costTotal[e] = costNew;
            cameFrom[e] = next;
            queue.queue({e, p: costNew});
          }
        }
      });
    }
    return costNew;
  }

  function restorePath(end, start, type, from) {
    let path = [], current = end;
    const limit = 1000;
    let prev = cells[end];
    if (type === "ocean" || !prev.path) {path.push({scX: prev.data[0],scY: prev.data[1],i: end});}
    if (!prev.path) {prev.path = 1;}
    for (let i = 0; i < limit; i++) {
      current = from[current];
      let cur = cells[current];
      if (!cur) {break;}
      if (cur.path) {
        cur.path += 1;
        path.push({scX: cur.data[0],scY: cur.data[1],i: current});
        prev = cur;
        drawPath();
      } else {
        cur.path = 1;
        if (prev) {path.push({scX: prev.data[0],scY: prev.data[1],i: prev.index});}
        prev = undefined;
        path.push({scX: cur.data[0],scY: cur.data[1],i: current});
      }
      if (current === start || !from[current]) {break;}
    }
    drawPath();
    function drawPath() {
      if (path.length > 1) {
        // mark crossroades
        if (type === "main" || type === "small") {
          const plus = type === "main" ? 4 : 2;
          const f = cells[path[0].i];
          if (f.path > 1) {
            if (!f.crossroad) {f.crossroad = 0;}
            f.crossroad += plus;
          }
          const t = cells[(path[path.length - 1].i)];
          if (t.path > 1) {
            if (!t.crossroad) {t.crossroad = 0;}
            t.crossroad += plus;
          }
        }
        // draw path segments
        let line = lineGen(path);
        line = round(line, 1);
        let id = 0; // to create unique route id
        if (type === "main") {
          id = roads.selectAll("path").size();
          roads.append("path").attr("d", line).attr("id", "road"+id).on("click", editRoute);
        } else if (type === "small") {
          id = trails.selectAll("path").size();
          trails.append("path").attr("d", line).attr("id", "trail"+id).on("click", editRoute);
        } else if (type === "ocean") {
          id = searoutes.selectAll("path").size();
          searoutes.append("path").attr("d", line).attr("id", "searoute"+id).on("click", editRoute);
        }
      }
      path = [];
    }
  }

  // Append burg elements
  function drawManors() {
    console.time('drawManors');
    const capitalIcons = burgIcons.select("#capitals");
    const capitalLabels = burgLabels.select("#capitals");
    const townIcons = burgIcons.select("#towns");
    const townLabels = burgLabels.select("#towns");
    const capitalSize = capitalIcons.attr("size") || 1;
    const townSize = townIcons.attr("size") || 0.5;
    capitalIcons.selectAll("*").remove();
    capitalLabels.selectAll("*").remove();
    townIcons.selectAll("*").remove();
    townLabels.selectAll("*").remove();

    for (let i = 0; i < manors.length; i++) {
      const x = manors[i].x, y = manors[i].y;
      const cell = manors[i].cell;
      const name = manors[i].name;
      const ic = i < states.length ? capitalIcons : townIcons;
      const lb = i < states.length ? capitalLabels : townLabels;
      const size = i < states.length ? capitalSize : townSize;
      ic.append("circle").attr("id", "burg"+i).attr("data-id", i).attr("cx", x).attr("cy", y).attr("r", size).on("click", editBurg);
      lb.append("text").attr("data-id", i).attr("x", x).attr("y", y).attr("dy", "-0.35em").text(name).on("click", editBurg);
    }
    console.timeEnd('drawManors');
  }

  // get settlement and country names based on option selected
  function getNames() {
    console.time('getNames');
    // if names source is an external resource
    if (namesInput.value === "1") {
      const request = new XMLHttpRequest();
      const url = "https://archivist.xalops.com/archivist-core/api/name/settlement?count=";
      request.open("GET", url+manors.length, true);
      request.onload = function() {
        const names = JSON.parse(request.responseText);
        for (let i=0; i < manors.length; i++) {
          manors[i].name = names[i];
          burgLabels.select("[data-id='" + i + "']").text(names[i]);
          if (i < states.length) {
            states[i].name = generateStateName(i);
            labels.select("#countries").select("#regionLabel"+i).text(states[i].name);
          }
        }
        console.log(names);
      };
      request.send(null);
    }

    if (namesInput.value !== "0") return;
    for (let i=0; i < manors.length; i++) {
      const culture = manors[i].culture;
      manors[i].name = generateName(culture);
      if (i < states.length) states[i].name = generateStateName(i);
    }
    console.timeEnd('getNames');
  }

  function calculateChains() {
    for (let c=0; c < nameBase.length; c++) {
      chain[c] = calculateChain(c);
    }
  }

  // calculate Markov's chain from namesbase data
  function calculateChain(c) {
    const chain = [];
    const d = nameBase[c].join(" ").toLowerCase();
    const method = nameBases[c].method;

    for (let i = -1, prev = " ", str = ""; i < d.length - 2; prev = str, i += str.length, str = "") {
      let vowel = 0, f = " ";
      if (method === "let-to-let") {str = d[i+1];} else {
        for (let c=i+1; str.length < 5; c++) {
          if (d[c] === undefined) break;
          str += d[c];
          if (str === " ") break;
          if (d[c] !== "o" && d[c] !== "e" && vowels.includes(d[c]) && d[c+1] === d[c]) break;
          if (d[c+2] === " ") {str += d[c+1]; break;}
          if (vowels.includes(d[c])) vowel++;
          if (vowel && vowels.includes(d[c+2])) break;
        }
      }
      if (i >= 0) {
        f = d[i];
        if (method === "syl-to-syl") f = prev;
      }
      if (chain[f] === undefined) chain[f] = [];
      chain[f].push(str);
    }
    return chain;
  }

  // generate random name using Markov's chain
  function generateName(culture, base) {
    if (base === undefined) {
      if (!cultures[culture]) {
        console.error("culture " + culture + " is not defined. Will load default cultures and set first culture");
        generateCultures();
        culture = 0;
      }
      base = cultures[culture].base;
    }
    if (!nameBases[base]) {
      console.error("nameBase " + base + " is not defined. Will load default names data and first base");
      if (!nameBases[0]) applyDefaultNamesData();
      base = 0;
    }
    const method = nameBases[base].method;
    const error = function(base) {
      tip("Names data for base " + nameBases[base].name + " is incorrect. Please fix in Namesbase Editor");
      editNamesbase();
    };

    if (method === "selection") {
      if (nameBase[base].length < 1) {error(base); return;}
      const rnd = rand(nameBase[base].length - 1);
      const name = nameBase[base][rnd];
      return name;
    }

    const data = chain[base];
    if (data === undefined || data[" "] === undefined) {error(base); return;}
    const max = nameBases[base].max;
    const min = nameBases[base].min;
    const d = nameBases[base].d;
    let word = "", variants = data[" "];
    if (variants === undefined) {
      error(base);
      return;
    }
    let cur = variants[rand(variants.length - 1)];
    for (let i=0; i < 21; i++) {
      if (cur === " " && Math.random() < 0.8) {
        // space means word end, but we don't want to end if word is too short
        if (word.length < min) {
          word = "";
          variants = data[" "];
        } else {break;}
      } else {
        const l = method === "let-to-syl" && cur.length > 1 ? cur[cur.length - 1] : cur;
        variants = data[l];
        // word is getting too long, restart
        word += cur; // add current el to word
        if (word.length > max) word = "";
      }
      if (variants === undefined) {
        error(base);
        return;
      }
      cur = variants[rand(variants.length - 1)];
    }
    // very rare case, let's just select a random name
    if (word.length < 2) word = nameBase[base][rand(nameBase[base].length - 1)];

    // do not allow multi-word name if word is foo short or not allowed for culture
    if (word.includes(" ")) {
      let words = word.split(" "), parsed;
      if (Math.random() > nameBases[base].m) {word = words.join("");}
      else {
        for (let i=0; i < words.length; i++) {
          if (words[i].length < 2) {
            if (!i) words[1] = words[0] + words[1];
            if (i) words[i-1] = words[i-1] + words[i];
            words.splice(i, 1);
        	  i--;
          }
        }
        word = words.join(" ");
      }
    }

    // parse word to get a final name
    const name = [...word].reduce(function(r, c, i, data) {
      if (c === " ") {
        if (!r.length) return "";
        if (i+1 === data.length) return r;
      }
      if (!r.length) return c.toUpperCase();
      if (r.slice(-1) === " ") return r + c.toUpperCase();
      if (c === data[i-1]) {
        if (!d.includes(c)) return r;
        if (c === data[i-2]) return r;
      }
      return r + c;
    }, "");
    return name;
  }

  // Define areas based on the closest manor to a polygon
  function defineRegions(withCultures) {
    console.time('defineRegions');
    const manorTree = d3.quadtree();
    manors.forEach(function(m) {if (m.region !== "removed") manorTree.add([m.x, m.y]);});

    const neutral = +neutralInput.value;
    land.forEach(function(i) {
      if (i.manor !== undefined && manors[i.manor].region !== "removed") {
        i.region = manors[i.manor].region;
        if (withCultures && manors[i.manor].culture !== undefined) i.culture = manors[i.manor].culture;
        return;
      }
      const x = i.data[0],y = i.data[1];

      let dist = 100000, manor = null;
      if (manors.length) {
        const c = manorTree.find(x, y);
        dist = Math.hypot(c[0] - x, c[1] - y);
        manor = getManorId(c);
      }
      if (dist > neutral / 2 || manor === null) {
        i.region = "neutral";
        if (withCultures) {
          const closestCulture = cultureTree.find(x, y);
          i.culture = getCultureId(closestCulture);
        }
      } else {
        const cell = manors[manor].cell;
        if (cells[cell].fn !== i.fn) {
          let minDist = dist * 3;
          land.forEach(function(l) {
            if (l.fn === i.fn && l.manor !== undefined) {
              if (manors[l.manor].region === "removed") return;
              const distN = Math.hypot(l.data[0] - x, l.data[1] - y);
              if (distN < minDist) {minDist = distN; manor = l.manor;}
            }
          });
        }
        i.region = manors[manor].region;
        if (withCultures) i.culture = manors[manor].culture;
      }
    });
    console.timeEnd('defineRegions');
  }

  // Define areas cells
  function drawRegions() {
    console.time('drawRegions');
    labels.select("#countries").selectAll("*").remove();

    // arrays to store edge data
    const edges = [],coastalEdges = [],borderEdges = [],neutralEdges = [];
    for (let a=0; a < states.length; a++) {
      edges[a] = [];
      coastalEdges[a] = [];
    }
    const e = diagram.edges;
    for (let i=0; i < e.length; i++) {
      if (e[i] === undefined) continue;
      const start = e[i][0].join(" ");
      const end = e[i][1].join(" ");
      const p = {start, end};
      if (e[i].left === undefined) {
        const r = e[i].right.index;
        const rr = cells[r].region;
        if (Number.isInteger(rr)) edges[rr].push(p);
        continue;
      }
      if (e[i].right === undefined) {
        const l = e[i].left.index;
        const lr = cells[l].region;
        if (Number.isInteger(lr)) edges[lr].push(p);
        continue;
      }
      const l = e[i].left.index;
      const r = e[i].right.index;
      const lr = cells[l].region;
      const rr = cells[r].region;
      if (lr === rr) continue;
      if (Number.isInteger(lr)) {
        edges[lr].push(p);
        if (rr === undefined) {coastalEdges[lr].push(p);}
        else if (rr === "neutral") {neutralEdges.push(p);}
      }
      if (Number.isInteger(rr)) {
        edges[rr].push(p);
        if (lr === undefined) {coastalEdges[rr].push(p);}
        else if (lr === "neutral") {neutralEdges.push(p);}
        else if (Number.isInteger(lr)) {borderEdges.push(p);}
      }
    }
    edges.map(function(e, i) {
      if (e.length) {
        drawRegion(e, i);
        drawRegionCoast(coastalEdges[i],i);
      }
    });
    drawBorders(borderEdges, "state");
    drawBorders(neutralEdges, "neutral");
    console.timeEnd('drawRegions');
  }

  function drawRegion(edges, region) {
    let path = "";
    const array = [];
    lineGen.curve(d3.curveLinear);
    while (edges.length > 2) {
      const edgesOrdered = []; // to store points in a correct order
      const start = edges[0].start;
      let end = edges[0].end;
      edges.shift();
      let spl = start.split(" ");
      edgesOrdered.push({scX: spl[0],scY: spl[1]});
      spl = end.split(" ");
      edgesOrdered.push({scX: spl[0],scY: spl[1]});
      for (let i = 0; end !== start && i < 2000; i++) {
        const next = $.grep(edges, function (e) {
          return (e.start == end || e.end == end);
        });
        if (next.length > 0) {
          if (next[0].start == end) {
            end = next[0].end;
          } else if (next[0].end == end) {
            end = next[0].start;
          }
          spl = end.split(" ");
          edgesOrdered.push({scX: spl[0],scY: spl[1]});
        }
        const rem = edges.indexOf(next[0]);
        edges.splice(rem, 1);
      }
      path += lineGen(edgesOrdered) + "Z ";
      array[array.length] = edgesOrdered.map(function(e) {return [+e.scX, +e.scY];});
    }
    const color = states[region].color;
    regions.append("path").attr("d", round(path, 1)).attr("fill", color).attr("class", "region"+region);
    array.sort(function(a, b){return b.length - a.length;});
    let capital = states[region].capital;
    // add capital cell as a hole
    if (!isNaN(capital)) {
      const capitalCell = manors[capital].cell;
      array.push(polygons[capitalCell]);
    }
    const name = states[region].name;
    const c = polylabel(array, 1.0); // pole of inaccessibility
    labels.select("#countries").append("text").attr("id", "regionLabel"+region).attr("x", rn(c[0])).attr("y", rn(c[1])).text(name).on("click", editLabel);
    states[region].area = rn(Math.abs(d3.polygonArea(array[0]))); // define region area
  }

  function drawRegionCoast(edges, region) {
    let path = "";
    while (edges.length > 0) {
      const edgesOrdered = []; // to store points in a correct order
      const start = edges[0].start;
      let end = edges[0].end;
      edges.shift();
      let spl = start.split(" ");
      edgesOrdered.push({scX: spl[0],scY: spl[1]});
      spl = end.split(" ");
      edgesOrdered.push({scX: spl[0],scY: spl[1]});
      let next = $.grep(edges, function (e) {
        return (e.start == end || e.end == end);
      });
      while (next.length > 0) {
        if (next[0].start == end) {
          end = next[0].end;
        } else if (next[0].end == end) {
          end = next[0].start;
        }
        spl = end.split(" ");
        edgesOrdered.push({scX: spl[0],scY: spl[1]});
        const rem = edges.indexOf(next[0]);
        edges.splice(rem, 1);
        next = $.grep(edges, function(e) {return (e.start == end || e.end == end);});
      }
      path += lineGen(edgesOrdered);
    }
    const color = states[region].color;
    regions.append("path").attr("d", round(path, 1)).attr("fill", "none").attr("stroke", color).attr("stroke-width", 5).attr("class", "region"+region);
  }

  function drawBorders(edges, type) {
    let path = "";
    if (edges.length < 1) {return;}
    while (edges.length > 0) {
      const edgesOrdered = []; // to store points in a correct order
      const start = edges[0].start;
      let end = edges[0].end;
      edges.shift();
      let spl = start.split(" ");
      edgesOrdered.push({scX: spl[0],scY: spl[1]});
      spl = end.split(" ");
      edgesOrdered.push({scX: spl[0],scY: spl[1]});
      let next = $.grep(edges, function (e) {
        return (e.start == end || e.end == end);
      });
      while (next.length > 0) {
        if (next[0].start == end) {
          end = next[0].end;
        } else if (next[0].end == end) {
          end = next[0].start;
        }
        spl = end.split(" ");
        edgesOrdered.push({scX: spl[0],scY: spl[1]});
        const rem = edges.indexOf(next[0]);
        edges.splice(rem, 1);
        next = $.grep(edges, function(e) {return (e.start == end || e.end == end);});
      }
      path += lineGen(edgesOrdered);
    }
    if (type === "state") {stateBorders.append("path").attr("d", round(path, 1));}
    if (type === "neutral") {neutralBorders.append("path").attr("d", round(path, 1));}
  }

  // generate region name
  function generateStateName(state) {
    let culture = null;
    if (states[state]) if(manors[states[state].capital]) culture = manors[states[state].capital].culture;
    let name = "NameIdontWant";
    if (Math.random() < 0.85 || culture === null) {
      // culture is random if capital is not yet defined
      if (culture === null) culture = rand(cultures.length - 1);
      // try to avoid too long words as a basename
      for (let i=0; i < 20 && name.length > 7; i++) {
        name = generateName(culture);
      }
    } else {
      name = manors[state].name;
    }
    const base = cultures[culture].base;

    let addSuffix = false;
    // handle special cases
    const e = name.slice(-2);
    if (base === 5 && (e === "sk" || e === "ev" || e === "ov")) {
      // remove -sk and -ev/-ov for Ruthenian
      name = name.slice(0,-2);
      addSuffix = true;
    } else if (name.length > 5 && base === 1 && name.slice(-3) === "ton") {
      // remove -ton ending for English
      name = name.slice(0,-3);
      addSuffix = true;
    } else if (name.length > 6 && name.slice(-4) === "berg") {
      // remove -berg ending for any
      name = name.slice(0,-4);
      addSuffix = true;
    } else if (base === 12) {
      // Japanese ends on vowels
      if (vowels.includes(name.slice(-1))) return name;
      return name + "u";
    } else if (base === 10) {
      // Korean has "guk" suffix
      if (name.slice(-3) === "guk") return name;
      if (name.slice(-1) === "g") name = name.slice(0,-1);
      if (Math.random() < 0.2 && name.length < 7) name = name + "guk"; // 20% for "guk"
      return name;
    } else if (base === 11) {
      // Chinese has "guo" suffix
      if (name.slice(-3) === "guo") return name;
      if (name.slice(-1) === "g") name = name.slice(0,-1);
      if (Math.random() < 0.3 && name.length < 7) name = name + " Guo"; // 30% for "guo"
      return name;
    }

    // define if suffix should be used
    let vowel = vowels.includes(name.slice(-1)); // last char is vowel
    if (vowel && name.length > 3) {
      if (Math.random() < 0.85) {
        if (vowels.includes(name.slice(-2,-1))) {
          name = name.slice(0,-2);
          addSuffix = true; // 85% for vv
        } else if (Math.random() < 0.7) {
          name = name.slice(0,-1);
          addSuffix = true; // ~60% for cv
        }
      }
    } else if (Math.random() < 0.6) {
      addSuffix = true; // 60% for cc and vc
    }

    if (addSuffix === false) return name;
    let suffix = "ia"; // common latin suffix
    const rnd = Math.random();
    if (rnd < 0.05 && base === 3) suffix = "terra"; // 5% "terra" for Italian
    else if (rnd < 0.05 && base === 4) suffix = "terra"; // 5% "terra" for Spanish
    else if (rnd < 0.05 && base == 2) suffix = "terre"; // 5% "terre" for French
    else if (rnd < 0.5 && base == 0) suffix = "land"; // 50% "land" for German
    else if (rnd < 0.4 && base == 1) suffix = "land"; // 40% "land" for English
    else if (rnd < 0.3 && base == 6) suffix = "land"; // 30% "land" for Nordic
    else if (rnd < 0.1 && base == 7) suffix = "eia"; // 10% "eia" for Greek ("ia" is also Greek)
    else if (rnd < 0.4 && base == 9) suffix = "maa"; // 40% "maa" for Finnic
    if (name.slice(-1 * suffix.length) === suffix) return name; // no suffix if name already ends with it
    if (name.slice(-1) === suffix.charAt(0)) name = name.slice(0, -1); // remove name last letter if it's a suffix first letter
    return name + suffix;
  }

  // re-calculate cultures
  function recalculateCultures(fullRedraw) {
    console.time("recalculateCultures");
    // For each capital find closest culture and assign it to capital
    states.forEach(function(s) {
      if (s.capital === "neutral" || s.capital === "select") return;
      const capital = manors[s.capital];
      const c = cultureTree.find(capital.x, capital.y);
      capital.culture = getCultureId(c);
    });

    // For each town if distance to its capital > neutral / 2,
    // assign closest culture to the town; else assign capital's culture
    const manorTree = d3.quadtree();
    const neutral = +neutralInput.value;
    manors.forEach(function(m) {
      if (m.region === "removed") return;
      manorTree.add([m.x, m.y]);
      if (m.region === "neutral") {
        const culture = cultureTree.find(m.x, m.y);
        m.culture = getCultureId(culture);
        return;
      }
      const c = states[m.region].capital;
      if (c !== "neutral" && c !== "select") {
        const dist = Math.hypot(m.x - manors[c].x, m.y - manors[c].y);
        if (dist <= neutral / 5) {
          m.culture = manors[c].culture;
          return;
        }
      }
      const culture = cultureTree.find(m.x, m.y);
      m.culture = getCultureId(culture);
    });

    // For each land cell if distance to closest manor > neutral / 2,
    // assign closest culture to the cell; else assign manors's culture
    const changed = [];
    land.forEach(function(i) {
      const x = i.data[0],y = i.data[1];
      const c = manorTree.find(x, y);
      const culture = i.culture;
      const dist = Math.hypot(c[0] - x, c[1] - y);
      let manor = getManorId(c);
      if (dist > neutral / 2 || manor === undefined) {
        const closestCulture = cultureTree.find(i.data[0],i.data[1]);
        i.culture = getCultureId(closestCulture);
      } else {
        const cell = manors[manor].cell;
        if (cells[cell].fn !== i.fn) {
          let minDist = dist * 3;
          land.forEach(function(l) {
            if (l.fn === i.fn && l.manor !== undefined) {
              if (manors[l.manor].region === "removed") return;
              const distN = Math.hypot(l.data[0] - x, l.data[1] - y);
              if (distN < minDist) {minDist = distN; manor = l.manor;}
            }
          });
        }
        i.culture = manors[manor].culture;
      }
      // re-color cells
      if (i.culture !== culture || fullRedraw) {
        const clr = cultures[i.culture].color;
        cults.select("#cult"+i.index).attr("fill", clr).attr("stroke", clr);
      }
    });
    console.timeEnd("recalculateCultures");
  }

  // get culture Id from center coordinates
  function getCultureId(c) {
    for (let i=0; i < cultures.length; i++) {
      if (cultures[i].center[0] === c[0]) if (cultures[i].center[1] === c[1]) return i;
    }
  }

  // get manor Id from center coordinates
  function getManorId(c) {
    for (let i=0; i < manors.length; i++) {
      if (manors[i].x === c[0]) if (manors[i].y === c[1]) return i;
    }
  }

  // focus on coorditanes, cell or burg provided in searchParams
  function focusOn() {
    if (params.get("from") === "MFCG") {
      // focus on burg from MFCG
      findBurgForMFCG();
      return;
    }
    let s = params.get("scale") || 8;
    let x = params.get("x");
    let y = params.get("y");
    let c = params.get("cell");
    if (c !== null) {
      x = cells[+c].data[0];
      y = cells[+c].data[1];
    }
    let b = params.get("burg");
    if (b !== null) {
      x = manors[+b].x;
      y = manors[+b].y;
    }
    if (x !== null && y !== null) zoomTo(x, y, s, 1600);
  }

  // find burg from MFCG and focus on it
  function findBurgForMFCG() {
    if (!manors.length) {console.error("No burgs generated. Cannot select a burg for MFCG"); return;}
    const size = +params.get("size");
    let coast = +params.get("coast");
    let port = +params.get("port");
    let river = +params.get("river");
    let selection = defineSelection(coast, port, river);
    if (!selection.length) selection = defineSelection(coast, !port, !river);
    if (!selection.length) selection = defineSelection(!coast, 0, !river);
    if (!selection.length) selection = manors[0]; // select first if nothing is found
    if (!selection.length) {console.error("Cannot find a burg for MFCG"); return;}

    function defineSelection(coast, port, river) {
      let selection = [];
      if (port && river) selection = $.grep(manors, function(e) {return cells[e.cell].port !== undefined && cells[e.cell].river !== undefined;});
      else if (!port && coast && river) selection = $.grep(manors, function(e) {return cells[e.cell].port === undefined && cells[e.cell].ctype === 1 && cells[e.cell].river !== undefined;});
      else if (!coast && !river) selection = $.grep(manors, function(e) {return cells[e.cell].ctype !== 1 && cells[e.cell].river === undefined;});
      else if (!coast && river) selection = $.grep(manors, function(e) {return cells[e.cell].ctype !== 1 && cells[e.cell].river !== undefined;});
      else if (coast && !river) selection = $.grep(manors, function(e) {return cells[e.cell].ctype === 1 && cells[e.cell].river === undefined;});
      return selection;
    }

    // select a burg with closes population from selection
    const selected = d3.scan(selection, function(a, b) {return Math.abs(a.population - size) - Math.abs(b.population - size);});
    const burg = selection[selected].i;
    if (size && burg !== undefined) {manors[burg].population = size;} else {return;}

    // focus on found burg
    const label = burgLabels.select("[data-id='" + burg + "']");
    if (!label.size()) {
      console.error("Cannot find a label for MFCG burg "+burg);
      return;
    }
    tip("Here stands the glorious city of "+manors[burg].name, true);
    label.classed("drag", true).on("mouseover", function() {
      d3.select(this).classed("drag", false);
      tip("", true);
    });
    const x = +label.attr("x"), y = +label.attr("y");
    zoomTo(x, y, 8, 1600);
  }

  // draw the Heightmap
  function toggleHeight() {
    const scheme = styleSchemeInput.value;
    let hColor = color;
    if (scheme === "light") hColor = d3.scaleSequential(d3.interpolateRdYlGn);
    if (scheme === "green") hColor = d3.scaleSequential(d3.interpolateGreens);
    if (scheme === "monochrome") hColor = d3.scaleSequential(d3.interpolateGreys);
    if (!terrs.selectAll("path").size()) {
      cells.map(function(i, d) {
        let height = i.height;
        if (height < 20 && !i.lake) return;
        if (i.lake) {
          const nHeights = i.neighbors.map(function(e) {if (cells[e].height >= 20) return cells[e].height;});
          const mean = d3.mean(nHeights);
          if (!mean) return;
          height = Math.trunc(mean);
          if (height < 20 || isNaN(height)) height = 20;
        }
        const clr = hColor((100 - height) / 100);
        terrs.append("path")
          .attr("d", "M" + polygons[d].join("L") + "Z")
          .attr("fill", clr).attr("stroke", clr);
      });
    } else {
      terrs.selectAll("path").remove();
    }
  }

  // draw Cultures
  function toggleCultures() {
    if (cults.selectAll("path").size() == 0) {
      land.map(function(i) {
        const color = cultures[i.culture].color;
        cults.append("path")
          .attr("d", "M" + polygons[i.index].join("L") + "Z")
          .attr("id", "cult" + i.index)
          .attr("fill", color)
          .attr("stroke", color);
      });
    } else {
      cults.selectAll("path").remove();
    }
  }

  // draw Overlay
  function toggleOverlay() {
    if (overlay.selectAll("*").size() === 0) {
      const type = styleOverlayType.value;
      const size = +styleOverlaySize.value;
      if (type === "pointyHex" || type === "flatHex") {
        let points = getHexGridPoints(size, type);
        let hex = "m" + getHex(size, type).slice(0, 4).join("l");
        let d = points.map(function(p) {return "M" + p + hex;}).join("");
        overlay.append("path").attr("d", d);
      } else if (type === "square") {
        const x = d3.range(size, svgWidth, size);
        const y = d3.range(size, svgHeight, size);
        overlay.append("g").selectAll("line").data(x).enter().append("line")
          .attr("x1", function(d) {return d;})
          .attr("x2", function(d) {return d;})
          .attr("y1", 0).attr("y2", svgHeight);
        overlay.append("g").selectAll("line").data(y).enter().append("line")
          .attr("y1", function(d) {return d;})
          .attr("y2", function(d) {return d;})
          .attr("x1", 0).attr("x2", svgWidth);
      } else {
        const tr = `translate(80 80) scale(${size / 20})`;
        d3.select("#rose").attr("transform", tr);
        overlay.append("use").attr("xlink:href","#rose");
      }
      overlay.call(d3.drag().on("start", elementDrag));
      calculateFriendlyOverlaySize();
    } else {
      overlay.selectAll("*").remove();
    }
  }

  function getHex(radius, type) {
    let x0 = 0, y0 = 0;
    let s = type === "pointyHex" ? 0 : Math.PI / -6;
    let thirdPi = Math.PI / 3;
    let angles = [s, s + thirdPi, s + 2 * thirdPi, s + 3 * thirdPi, s + 4 * thirdPi, s + 5 * thirdPi];
    return angles.map(function(angle) {
      const x1 = Math.sin(angle) * radius,
        y1 = -Math.cos(angle) * radius,
        dx = x1 - x0,
        dy = y1 - y0;
      x0 = x1, y0 = y1;
      return [dx, dy];
    });
  }

  function getHexGridPoints(size, type) {
    let points = [];
    const rt3 = Math.sqrt(3);
    const off = type === "pointyHex" ? rt3 * size / 2 : size * 3 / 2;
    const ySpace = type === "pointyHex" ? size * 3 / 2 : rt3 * size / 2;
    const xSpace = type === "pointyHex" ? rt3 * size : size * 3;
    for (let y = 0, l = 0; y < graphHeight; y += ySpace, l++) {
      for (let x = l % 2 ? 0 : off; x < graphWidth; x += xSpace) {
        points.push([x, y]);
      }
    }
    return points;
  }

  // clean data to get rid of redundand info
  function cleanData() {
    console.time("cleanData");
    cells.map(function(c) {
      delete c.cost;
      delete c.used;
      delete c.coastX;
      delete c.coastY;
      if (c.ctype === undefined) delete c.ctype;
      if (c.lake === undefined) delete c.lake;
      c.height = Math.trunc(c.height);
      if (c.height >= 20) c.flux = rn(c.flux, 2);
    });
    // restore layers if they was turned on
    if (!$("#toggleHeight").hasClass("buttonoff") && !terrs.selectAll("path").size()) toggleHeight();
    if (!$("#toggleCultures").hasClass("buttonoff") && !cults.selectAll("path").size()) toggleCultures();
    closeDialogs();
    invokeActiveZooming();
    console.timeEnd("cleanData");
  }

  // close all dialogs except stated
  function closeDialogs(except) {
    except = except || "#except";
    $(".dialog:visible").not(except).each(function(e) {
      $(this).dialog("close");
    });
  }

  // change transparency for modal windowa
  function changeDialogsTransparency(v) {
    localStorage.setItem("transparency", v);
    const alpha = (100 - +v) / 100;
    const optionsColor = "rgba(164, 139, 149, " + alpha + ")"; // purple-red
    const dialogsColor = "rgba(255, 255, 255, " + alpha + ")"; // white
    document.getElementById("options").style.backgroundColor = optionsColor;
    document.getElementById("dialogs").style.backgroundColor = dialogsColor;
  }

  // Draw the water flux system (for dubugging)
  function toggleFlux() {
    const colorFlux = d3.scaleSequential(d3.interpolateBlues);
    if (terrs.selectAll("path").size() == 0) {
      land.map(function(i) {
        terrs.append("path")
          .attr("d", "M" + polygons[i.index].join("L") + "Z")
          .attr("fill", colorFlux(0.1 + i.flux))
          .attr("stroke", colorFlux(0.1 + i.flux));
      });
    } else {
      terrs.selectAll("path").remove();
    }
  }

  // Draw the Relief (need to create more beautiness)
  function drawRelief() {
    console.time('drawRelief');
    let h, count, rnd, cx, cy, swampCount = 0;
    const hills = terrain.select("#hills");
    const mounts = terrain.select("#mounts");
    const swamps = terrain.select("#swamps");
    const forests = terrain.select("#forests");
    terrain.selectAll("g").selectAll("g").remove();
    // sort the land to Draw the top element first (reduce the elements overlapping)
    land.sort(compareY);
    for (let i = 0; i < land.length; i++) {
      if (land[i].river) continue; // no icons on rivers
      const cell = land[i].index;
      const p = d3.polygonCentroid(polygons[cell]); // polygon centroid point
      if (p === undefined) continue; // something is wrong with data
      const height = land[i].height;
      const area = land[i].area;
      if (height >= 70) {
        // mount icon
        h = (height - 55) * 0.12;
        for (let c = 0, a = area; Math.random() < a / 50; c++, a -= 50) {
          if (polygons[cell][c] === undefined) break;
          const g = mounts.append("g").attr("data-cell", cell);
          if (c < 2) {
            cx = p[0] - h / 100 * (1 - c / 10) - c * 2;
            cy = p[1] + h / 400 + c;
          } else {
            const p2 = polygons[cell][c];
            cx = (p[0] * 1.2 + p2[0] * 0.8) / 2;
            cy = (p[1] * 1.2 + p2[1] * 0.8) / 2;
          }
          rnd = Math.random() * 0.8 + 0.2;
          let mount = "M" + cx + "," + cy + " L" + (cx + h / 3 + rnd) + "," + (cy - h / 4 - rnd * 1.2) + " L" + (cx + h / 1.1) + "," + (cy - h) + " L" + (cx + h + rnd) + "," + (cy - h / 1.2 + rnd) + " L" + (cx + h * 2) + "," + cy;
          let shade = "M" + cx + "," + cy + " L" + (cx + h / 3 + rnd) + "," + (cy - h / 4 - rnd * 1.2) + " L" + (cx + h / 1.1) + "," + (cy - h) + " L" + (cx + h / 1.5) + "," + cy;
          let dash = "M" + (cx - 0.1) + "," + (cy + 0.3) + " L" + (cx + 2 * h + 0.1) + "," + (cy + 0.3);
          dash += "M" + (cx + 0.4) + "," + (cy + 0.6) + " L" + (cx + 2 * h - 0.3) + "," + (cy + 0.6);
          g.append("path").attr("d", round(mount, 1)).attr("stroke", "#5c5c70");
          g.append("path").attr("d", round(shade, 1)).attr("fill", "#999999");
          g.append("path").attr("d", round(dash, 1)).attr("class", "strokes");
        }
      } else if (height > 50) {
        // hill icon
        h = (height - 40) / 10;
        if (h > 1.7) h = 1.7;
        for (let c = 0, a = area; Math.random() < a / 30; c++, a -= 30) {
          if (land[i].ctype === 1 && c > 0) break;
          if (polygons[cell][c] === undefined) break;
          const g = hills.append("g").attr("data-cell", cell);
          if (c < 2) {
            cx = p[0] - h - c * 1.2;
            cy = p[1] + h / 4 + c / 1.6;
          } else {
            const p2 = polygons[cell][c];
            cx = (p[0] * 1.2 + p2[0] * 0.8) / 2;
            cy = (p[1] * 1.2 + p2[1] * 0.8) / 2;
          }
          let hill = "M" + cx + "," + cy + " Q" + (cx + h) + "," + (cy - h) + " " + (cx + 2 * h) + "," + cy;
          let shade = "M" + (cx + 0.6 * h) + "," + (cy + 0.1) + " Q" + (cx + h * 0.95) + "," + (cy - h * 0.91) + " " + (cx + 2 * h * 0.97) + "," + cy;
          let dash = "M" + (cx - 0.1) + "," + (cy + 0.2) + " L" + (cx + 2 * h + 0.1) + "," + (cy + 0.2);
          dash += "M" + (cx + 0.4) + "," + (cy + 0.4) + " L" + (cx + 2 * h - 0.3) + "," + (cy + 0.4);
          g.append("path").attr("d", round(hill, 1)).attr("stroke", "#5c5c70");
          g.append("path").attr("d", round(shade, 1)).attr("fill", "white");
          g.append("path").attr("d", round(dash, 1)).attr("class", "strokes");
        }
      }

      // swamp icons
      if (height >= 21 && height < 22 && swampCount < +swampinessInput.value && land[i].used != 1) {
        const g = swamps.append("g").attr("data-cell", cell);
        swampCount++;
        land[i].used = 1;
        let swamp = drawSwamp(p[0],p[1]);
        land[i].neighbors.forEach(function(e) {
          if (cells[e].height >= 20 && cells[e].height < 30 && !cells[e].river && cells[e].used != 1) {
            cells[e].used = 1;
            swamp += drawSwamp(cells[e].data[0], cells[e].data[1]);
          }
        });
        g.append("path").attr("d", round(swamp, 1));
      }

      // forest icons
      if (Math.random() < height / 100 && height >= 22 && height < 48) {
        for (let c = 0, a = area; Math.random() < a / 15; c++, a -= 15) {
          if (land[i].ctype === 1 && c > 0) break;
          if (polygons[cell][c] === undefined) break;
          const g = forests.append("g").attr("data-cell", cell);
          if (c === 0) {
            cx = rn(p[0] - 1 - Math.random(), 1);
            cy = p[1] - 2;
          } else {
            const p2 = polygons[cell][c];
            if (c > 1) {
              const dist = Math.hypot(p2[0] - polygons[cell][c-1][0],p2[1] - polygons[cell][c-1][1]);
              if (dist < 2) continue;
            }
            cx = (p[0] * 0.5 + p2[0] * 1.5) / 2;
            cy = (p[1] * 0.5 + p2[1] * 1.5) / 2 - 1;
          }
          const forest = "M" + cx + "," + cy + " q-1,0.8 -0.05,1.25 v0.75 h0.1 v-0.75 q0.95,-0.47 -0.05,-1.25 z ";
          const light = "M" + cx + "," + cy + " q-1,0.8 -0.05,1.25 h0.1 q0.95,-0.47 -0.05,-1.25 z ";
          const shade = "M" + cx + "," + cy + " q-1,0.8 -0.05,1.25 q-0.2,-0.55 0,-1.1 z ";
          g.append("path").attr("d", forest);
          g.append("path").attr("d", light).attr("fill", "white").attr("stroke", "none");
          g.append("path").attr("d", shade).attr("fill", "#999999").attr("stroke", "none");
        }
      }
    }
    terrain.selectAll("g").selectAll("g").on("click", editReliefIcon);
    console.timeEnd('drawRelief');
  }

  function addReliefIcon(height, type, cx, cy, cell) {
    const g = terrain.select("#" + type).append("g").attr("data-cell", cell);
    if (type === "mounts") {
      const h = height >= 0.7 ? (height - 0.55) * 12 : 1.8;
      const rnd = Math.random() * 0.8 + 0.2;
      let mount = "M" + cx + "," + cy + " L" + (cx + h / 3 + rnd) + "," + (cy - h / 4 - rnd * 1.2) + " L" + (cx + h / 1.1) + "," + (cy - h) + " L" + (cx + h + rnd) + "," + (cy - h / 1.2 + rnd) + " L" + (cx + h * 2) + "," + cy;
      let shade = "M" + cx + "," + cy + " L" + (cx + h / 3 + rnd) + "," + (cy - h / 4 - rnd * 1.2) + " L" + (cx + h / 1.1) + "," + (cy - h) + " L" + (cx + h / 1.5) + "," + cy;
      let dash = "M" + (cx - 0.1) + "," + (cy + 0.3) + " L" + (cx + 2 * h + 0.1) + "," + (cy + 0.3);
      dash += "M" + (cx + 0.4) + "," + (cy + 0.6) + " L" + (cx + 2 * h - 0.3) + "," + (cy + 0.6);
      g.append("path").attr("d", round(mount, 1)).attr("stroke", "#5c5c70");
      g.append("path").attr("d", round(shade, 1)).attr("fill", "#999999");
      g.append("path").attr("d", round(dash, 1)).attr("class", "strokes");
    }
    if (type === "hills") {
      let h = height > 0.5 ? (height - 0.4) * 10 : 1.2;
      if (h > 1.8) h = 1.8;
      let hill = "M" + cx + "," + cy + " Q" + (cx + h) + "," + (cy - h) + " " + (cx + 2 * h) + "," + cy;
      let shade = "M" + (cx + 0.6 * h) + "," + (cy + 0.1) + " Q" + (cx + h * 0.95) + "," + (cy - h * 0.91) + " " + (cx + 2 * h * 0.97) + "," + cy;
      let dash = "M" + (cx - 0.1) + "," + (cy + 0.2) + " L" + (cx + 2 * h + 0.1) + "," + (cy + 0.2);
      dash += "M" + (cx + 0.4) + "," + (cy + 0.4) + " L" + (cx + 2 * h - 0.3) + "," + (cy + 0.4);
      g.append("path").attr("d", round(hill, 1)).attr("stroke", "#5c5c70");
      g.append("path").attr("d", round(shade, 1)).attr("fill", "white");
      g.append("path").attr("d", round(dash, 1)).attr("class", "strokes");
    }
    if (type === "swamps") {
      const swamp = drawSwamp(cx, cy);
      g.append("path").attr("d", round(swamp, 1));
    }
    if (type === "forests") {
      const rnd = Math.random();
      const h = rnd * 0.4 + 0.6;
      const forest = "M" + cx + "," + cy + " q-1,0.8 -0.05,1.25 v0.75 h0.1 v-0.75 q0.95,-0.47 -0.05,-1.25 z ";
      const light = "M" + cx + "," + cy + " q-1,0.8 -0.05,1.25 h0.1 q0.95,-0.47 -0.05,-1.25 z ";
      const shade = "M" + cx + "," + cy + " q-1,0.8 -0.05,1.25 q-0.2,-0.55 0,-1.1 z ";
      g.append("path").attr("d", forest);
      g.append("path").attr("d", light).attr("fill", "white").attr("stroke", "none");
      g.append("path").attr("d", shade).attr("fill", "#999999").attr("stroke", "none");
    }
    g.on("click", editReliefIcon);
    return g;
  }

  function compareY(a, b) {
    if (a.data[1] > b.data[1]) return 1;
    if (a.data[1] < b.data[1]) return -1;
    return 0;
  }

  function drawSwamp(x, y) {
    const h = 0.6;
    let line = "";
    for (let c = 0; c < 3; c++) {
      let cx;
      let cy;
      if (c == 0) {
        cx = x;
        cy = y - 0.5 - Math.random();
      }
      if (c == 1) {
        cx = x + h + Math.random();
        cy = y + h + Math.random();
      }
      if (c == 2) {
        cx = x - h - Math.random();
        cy = y + 2 * h + Math.random();
      }
      line += "M" + cx + "," + cy + " H" + (cx - h / 6) + " M" + cx + "," + cy + " H" + (cx + h / 6) + " M" + cx + "," + cy + " L" + (cx - h / 3) + "," + (cy - h / 2) + " M" + cx + "," + cy + " V" + (cy - h / 1.5) + " M" + cx + "," + cy + " L" + (cx + h / 3) + "," + (cy - h / 2);
      line += "M" + (cx - h) + "," + cy + " H" + (cx - h / 2) + " M" + (cx + h / 2) + "," + cy + " H" + (cx + h);
    }
    return line;
  }

  function dragged(e) {
    const el = d3.select(this);
    const x = d3.event.x;
    const y = d3.event.y;
    el.raise().classed("drag", true);
    if (el.attr("x")) {
      el.attr("x", x).attr("y", y + 0.8);
      const matrix = el.attr("transform");
      if (matrix) {
        const angle = matrix.split('(')[1].split(')')[0].split(' ')[0];
        const bbox = el.node().getBBox();
        const rotate = "rotate(" + angle + " " + (bbox.x + bbox.width / 2) + " " + (bbox.y + bbox.height / 2) + ")";
        el.attr("transform", rotate);
      }
    } else {
      el.attr("cx", x).attr("cy", y);
    }
  }

  function dragended(d) {
    d3.select(this).classed("drag", false);
  }

  // Complete the map for the "customize" mode
  function getMap() {
    if (customization !== 1) {
      tip('Nothing to complete! Click on "Edit" or "Clear all" to enter a heightmap customization mode', null, "error");
      return;
    }
    if (+landmassCounter.innerHTML < 150) {
      tip("Insufficient land area! Please add more land cells to complete the map", null, "error");
      return;
    }
    exitCustomization();
    console.time("TOTAL");
    markFeatures();
    drawOcean();
    elevateLakes();
    resolveDepressionsPrimary();
    reGraph();
    resolveDepressionsSecondary();
    flux();
    addLakes();
    if (!changeHeights.checked) restoreCustomHeights();
    drawCoastline();
    drawRelief();
    const keepData = states.length && manors.length;
    if (keepData) {
      restoreRegions();
    } else {
      generateCultures();
      manorsAndRegions();
    }
    cleanData();
    console.timeEnd("TOTAL");
  }

  // Add support "click to add" button events
  $("#customizeTab").click(clickToAdd);
  function clickToAdd() {
    if (modules.clickToAdd) return;
    modules.clickToAdd = true;

    // add label on click
    $("#addLabel").click(function() {
      if ($(this).hasClass('pressed')) {
        $(".pressed").removeClass('pressed');
        restoreDefaultEvents();
      } else {
        $(".pressed").removeClass('pressed');
        $(this).addClass('pressed');
        closeDialogs(".stable");
        viewbox.style("cursor", "crosshair").on("click", addLabelOnClick);
      }
    });

    function addLabelOnClick() {
      const point = d3.mouse(this);
      const index = getIndex(point);
      const x = rn(point[0],2), y = rn(point[1],2);

      // get culture in clicked point to generate a name
      const closest = cultureTree.find(x, y);
      const culture = cultureTree.data().indexOf(closest) || 0;
      const name = generateName(culture);

      let group = labels.select("#addedLabels");
      if (!group.size()) {
        group = labels.append("g").attr("id", "addedLabels")
          .attr("fill", "#3e3e4b").attr("opacity", 1)
          .attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC")
          .attr("font-size", 18).attr("data-size", 18);
      }
      let id = "label" + Date.now().toString().slice(7);
      group.append("text").attr("id", id).attr("x", x).attr("y", y).text(name).on("click", editLabel);

      if (d3.event.shiftKey === false) {
        $("#addLabel").removeClass("pressed");
        restoreDefaultEvents();
      }
    }

    // add burg on click
    $("#addBurg").click(function() {
      if ($(this).hasClass('pressed')) {
        $(".pressed").removeClass('pressed');
        restoreDefaultEvents();
        tip("", true);
      } else {
        $(".pressed").removeClass('pressed');
        $(this).attr("data-state", -1).addClass('pressed');
        $("#burgAdd, #burgAddfromEditor").addClass('pressed');
        viewbox.style("cursor", "crosshair").on("click", addBurgOnClick);
        tip("Click on map to place burg icon with a label. Hold Shift to place several", true);
      }
    });

    function addBurgOnClick() {
      const point = d3.mouse(this);
      const index = getIndex(point);
      const x = rn(point[0],2), y = rn(point[1],2);

      // get culture in clicked point to generate a name
      let culture = cells[index].culture;
      if (culture === undefined) culture = 0;
      const name = generateName(culture);

      if (cells[index].height < 20) {
        tip("Cannot place burg in the water! Select a land cell", null, "error");
        return;
      }
      if (cells[index].manor !== undefined) {
        tip("There is already a burg in this cell. Please select a free cell", null, "error");
        $('#grid').fadeIn();
        d3.select("#toggleGrid").classed("buttonoff", false);
        return;
      }
      const i = manors.length;
      const size = burgIcons.select("#towns").attr("size");
      burgIcons.select("#towns").append("circle").attr("id", "burg"+i).attr("data-id", i).attr("cx", x).attr("cy", y).attr("r", size).on("click", editBurg);
      burgLabels.select("#towns").append("text").attr("data-id", i).attr("x", x).attr("y", y).attr("dy", "-0.35em").text(name).on("click", editBurg);
      invokeActiveZooming();

      if (d3.event.shiftKey === false) {
        $("#addBurg, #burgAdd, #burgAddfromEditor").removeClass("pressed");
        restoreDefaultEvents();
      }

      let region, state = +$("#addBurg").attr("data-state");
      if (state !== -1) {
        region = states[state].capital === "neutral" ? "neutral" : state;
        const oldRegion = cells[index].region;
        if (region !== oldRegion) {
          cells[index].region = region;
          redrawRegions();
        }
      } else {
        region = cells[index].region;
        state = region === "neutral" ? states.length - 1 : region;
      }
      cells[index].manor = i;
      let score = cells[index].score;
      if (score <= 0) {score = rn(Math.random(), 2);}
      if (cells[index].crossroad) {score += cells[index].crossroad;} // crossroads
      if (cells[index].confluence) {score += Math.pow(cells[index].confluence, 0.3);} // confluences
      if (cells[index].port !== undefined) {score *= 3;} // port-capital
      const population = rn(score, 1);
      manors.push({i, cell:index, x, y, region, culture, name, population});
      recalculateStateData(state);
      updateCountryEditors();
      tip("", true);
    }

    // add river on click
    $("#addRiver").click(function() {
      if ($(this).hasClass('pressed')) {
        $(".pressed").removeClass('pressed');
        unselect();
      } else {
        $(".pressed").removeClass('pressed');
        unselect();
        $(this).addClass('pressed');
        closeDialogs(".stable");
        viewbox.style("cursor", "crosshair").on("click", addRiverOnClick);
        tip("Click on map to place new river or extend an existing one", true);
      }
    });

    function addRiverOnClick() {
      const point = d3.mouse(this);
      const index = diagram.find(point[0], point[1]).index;
      let cell = cells[index];
      if (cell.river || cell.height < 20) return;
      const dataRiver = []; // to store river points
      const last = $("#rivers > path").last();
      const river = last.length ? +last.attr("id").slice(5) + 1 : 0;
      cell.flux = 0.85;
      while (cell) {
        cell.river = river;
        const x = cell.data[0], y = cell.data[1];
        dataRiver.push({x, y, cell:index});
        const nHeights = [];
        cell.neighbors.forEach(function(e) {nHeights.push(cells[e].height);});
        const minId = nHeights.indexOf(d3.min(nHeights));
        const min = cell.neighbors[minId];
        const tx = cells[min].data[0], ty = cells[min].data[1];
        if (cells[min].height < 20) {
          const px = (x + tx) / 2;
          const py = (y + ty) / 2;
          dataRiver.push({x: px, y: py, cell:index});
          cell = undefined;
        } else {
          if (cells[min].river === undefined) {cells[min].flux += cell.flux; cell = cells[min];}
          else {
            const r = cells[min].river;
            const riverEl = $("#river"+r);
            const riverCells = $.grep(land, function(e) {return e.river === r;});
            riverCells.sort(function(a, b) {return b.height - a.height});
            const riverCellsUpper = $.grep(riverCells, function(e) {return e.height > cells[min].height;});
            if (dataRiver.length > riverCellsUpper.length) {
              // new river is more perspective
              const avPrec = rn(precInput.value / Math.sqrt(cells.length), 2);
              let dataRiverMin = [];
              riverCells.map(function(c) {
                if (c.height < cells[min].height) {
                  cells[c.index].river = undefined;
                  cells[c.index].flux = avPrec;
                } else {
                  dataRiverMin.push({x:c.data[0],y:c.data[1],cell:c.index});
                }
              });
              cells[min].flux += cell.flux;
              if (cells[min].confluence) {cells[min].confluence += riverCellsUpper.length;}
              else {cells[min].confluence = riverCellsUpper.length;}
              cell = cells[min];
              // redraw old river's upper part or remove if small
              if (dataRiverMin.length > 1) {
                var riverAmended = amendRiver(dataRiverMin, 1);
                var d = drawRiver(riverAmended, 1.3, 1);
                riverEl.attr("d", d).attr("data-width", 1.3).attr("data-increment", 1);
              } else {
                riverEl.remove();
                dataRiverMin.map(function(c) {cells[c.cell].river = undefined;});
              }
            } else {
              if (cells[min].confluence) {cells[min].confluence += dataRiver.length;}
              else {cells[min].confluence = dataRiver.length;}
              cells[min].flux += cell.flux;
              dataRiver.push({x: tx, y: ty, cell:min});
              cell = undefined;
            }
          }
        }
      }
      const rndFactor = 0.2 + Math.random() * 1.6; // random factor in range 0.2-1.8
      var riverAmended = amendRiver(dataRiver, rndFactor);
      var d = drawRiver(riverAmended, 1.3, 1);
      rivers.append("path").attr("d", d).attr("id", "river"+river)
        .attr("data-width", 1.3).attr("data-increment", 1).on("click", editRiver);
    }

    // add relief icon on click
    $("#addRelief").click(function() {
      if ($(this).hasClass('pressed')) {
        $(".pressed").removeClass('pressed');
        restoreDefaultEvents();
      } else {
        $(".pressed").removeClass('pressed');
        $(this).addClass('pressed');
        closeDialogs(".stable");
        viewbox.style("cursor", "crosshair").on("click", addReliefOnClick);
        tip("Click on map to place relief icon. Hold Shift to place several", true);
      }
    });

    function addReliefOnClick() {
      const point = d3.mouse(this);
      const index = getIndex(point);
      const height = cells[index].height;
      if (height < 20) {
        tip("Cannot place icon in the water! Select a land cell");
        return;
      }

      const x = rn(point[0],2), y = rn(point[1],2);
      const type = reliefGroup.value;
      addReliefIcon(height / 100, type, x, y, index);

      if (d3.event.shiftKey === false) {
        $("#addRelief").removeClass("pressed");
        restoreDefaultEvents();
      }
      tip("", true);
    }

    // add route on click
    $("#addRoute").click(function() {
      if (!modules.editRoute) editRoute();
      $("#routeNew").click();
    });

    // add marker on click
    $("#addMarker").click(function() {
      if ($(this).hasClass('pressed')) {
        $(".pressed").removeClass('pressed');
        restoreDefaultEvents();
      } else {
        $(".pressed").removeClass('pressed');
        $(this).addClass('pressed');
        $("#markerAdd").addClass('pressed');
        viewbox.style("cursor", "crosshair").on("click", addMarkerOnClick);
      }
    });

    function addMarkerOnClick() {
      const point = d3.mouse(this);
      let x = rn(point[0],2), y = rn(point[1],2);
      let selected = markerSelectGroup.value;
      let valid = selected && d3.select("#defs-markers").select("#"+selected).size() === 1;
      let symbol = valid ? "#"+selected : "#marker0";
      let desired = valid ? markers.select("[data-id='" + symbol + "']").attr("data-size") : 1;
      if (isNaN(desired)) desired = 1;
      let id = "marker" + Date.now().toString().slice(7); // unique id
      let size = desired * 5 + 25 / scale;

      markers.append("use").attr("id", id).attr("xlink:href", symbol).attr("data-id", symbol)
        .attr("data-x", x).attr("data-y", y).attr("x", x - size / 2).attr("y", y - size)
        .attr("data-size", desired).attr("width", size).attr("height", size).on("click", editMarker);

      if (d3.event.shiftKey === false) {
        $("#addMarker, #markerAdd").removeClass("pressed");
        restoreDefaultEvents();
      }
    }

  }

  // return cell / polly Index or error
  function getIndex(point) {
    let c = diagram.find(point[0], point[1]);
    if (!c) {
      console.error("Cannot find closest cell for points" + point[0] + ", " + point[1]);
      return;
    }
    return c.index;
  }

  // re-calculate data for a particular state
  function recalculateStateData(state) {
    const s = states[state] || states[states.length - 1];
    if (s.capital === "neutral") state = "neutral";
    const burgs = $.grep(manors, function(e) {return e.region === state;});
    s.burgs = burgs.length;
    let burgsPop = 0; // get summ of all burgs population
    burgs.map(function(b) {burgsPop += b.population;});
    s.urbanPopulation = rn(burgsPop, 1);
    const regionCells = $.grep(cells, function(e) {return (e.region === state);});
    let cellsPop = 0, area = 0;
    regionCells.map(function(c) {
      cellsPop += c.pop;
      area += c.area;
    });
    s.cells = regionCells.length;
    s.area = rn(area);
    s.ruralPopulation = rn(cellsPop, 1);
  }

  function changeSelectedOnClick() {
    const point = d3.mouse(this);
    const index = diagram.find(point[0],point[1]).index;
    if (cells[index].height < 20) return;
    $(".selected").removeClass("selected");
    let color;

    // select state
    if (customization === 2) {
      const assigned = regions.select("#temp").select("path[data-cell='"+index+"']");
      let s = assigned.size() ? assigned.attr("data-state") : cells[index].region;
      if (s === "neutral") s = states.length - 1;
      color = states[s].color;
      if (color === "neutral") color = "white";
      $("#state"+s).addClass("selected");
    }

    // select culture
    if (customization === 4) {
      const assigned = cults.select("#cult"+index);
      const c = assigned.attr("data-culture") !== null
        ? +assigned.attr("data-culture")
        : cells[index].culture;
      color = cultures[c].color;
      $("#culture"+c).addClass("selected");
    }

    debug.selectAll(".circle").attr("stroke", color);
  }

  // fetch default fonts if not done before
  function loadDefaultFonts() {
    if (!$('link[href="fonts.css"]').length) {
      $("head").append('<link rel="stylesheet" type="text/css" href="fonts.css">');
      const fontsToAdd = ["Amatic+SC:700", "IM+Fell+English", "Great+Vibes", "MedievalSharp", "Metamorphous",
                        "Nova+Script", "Uncial+Antiqua", "Underdog", "Caesar+Dressing", "Bitter", "Yellowtail", "Montez",
                        "Shadows+Into+Light", "Fredericka+the+Great", "Orbitron", "Dancing+Script:700",
                        "Architects+Daughter", "Kaushan+Script", "Gloria+Hallelujah", "Satisfy", "Comfortaa:700", "Cinzel"];
      fontsToAdd.forEach(function(f) {if (fonts.indexOf(f) === -1) fonts.push(f);});
      updateFontOptions();
    }
  }

  function fetchFonts(url) {
    return new Promise((resolve, reject) => {
      if (url === "") {
        tip("Use a direct link to any @font-face declaration or just font name to fetch from Google Fonts");
        return;
      }
      if (url.indexOf("http") === -1) {
        url = url.replace(url.charAt(0), url.charAt(0).toUpperCase()).split(" ").join("+");
        url = "https://fonts.googleapis.com/css?family=" + url;
      }
      const fetched = addFonts(url).then(fetched => {
        if (fetched === undefined) {
          tip("Cannot fetch font for this value!");
          return;
        }
        if (fetched === 0) {
          tip("Already in the fonts list!");
          return;
        }
        updateFontOptions();
        if (fetched === 1) {
          tip("Font " + fonts[fonts.length - 1] + " is fetched");
        } else if (fetched > 1) {
          tip(fetched + " fonts are added to the list");
        }
        resolve(fetched);
      });
    })
  }

  function addFonts(url) {
    $("head").append('<link rel="stylesheet" type="text/css" href="' + url + '">');
    return fetch(url)
      .then(resp => resp.text())
      .then(text => {
        let s = document.createElement('style');
        s.innerHTML = text;
        document.head.appendChild(s);
        let styleSheet = Array.prototype.filter.call(
          document.styleSheets,
          sS => sS.ownerNode === s)[0];
        let FontRule = rule => {
          let family = rule.style.getPropertyValue('font-family');
          let font = family.replace(/['"]+/g, '').replace(/ /g, "+");
          let weight = rule.style.getPropertyValue('font-weight');
          if (weight !== "400") font += ":" + weight;
          if (fonts.indexOf(font) == -1) {
            fonts.push(font);
            fetched++
          }
        };
        let fetched = 0;
        for (let r of styleSheet.cssRules) {FontRule(r);}
        document.head.removeChild(s);
        return fetched;
      })
      .catch(function() {});
  }

  // Update font list for Label and Burg Editors
  function updateFontOptions() {
    labelFontSelect.innerHTML = "";
    for (let i=0; i < fonts.length; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      const font = fonts[i].split(':')[0].replace(/\+/g, " ");
      opt.style.fontFamily = opt.innerHTML = font;
      labelFontSelect.add(opt);
    }
    burgSelectDefaultFont.innerHTML  = labelFontSelect.innerHTML;
  }

  // convert RGB color string to HEX without #
  function toHEX(rgb){
    if (rgb.charAt(0) === "#") {return rgb;}
    rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
      return (rgb && rgb.length === 4) ? "#" +
      ("0" + parseInt(rgb[1],10).toString(16)).slice(-2) +
      ("0" + parseInt(rgb[2],10).toString(16)).slice(-2) +
      ("0" + parseInt(rgb[3],10).toString(16)).slice(-2) : '';
  }

  // random number in a range
  function rand(min, max) {
    if (min === undefined && !max === undefined) return Math.random();
    if (max === undefined) {max = min; min = 0;}
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // round value to d decimals
  function rn(v, d) {
     var d = d || 0;
    const m = Math.pow(10, d);
    return Math.round(v * m) / m;
  }

  // round string to d decimals
  function round(s, d) {
     var d = d || 1;
     return s.replace(/[\d\.-][\d\.e-]*/g, function(n) {return rn(n, d);})
  }

  // corvent number to short string with SI postfix
  function si(n) {
    if (n >= 1e9) {return rn(n / 1e9, 1) + "B";}
    if (n >= 1e8) {return rn(n / 1e6) + "M";}
    if (n >= 1e6) {return rn(n / 1e6, 1) + "M";}
    if (n >= 1e4) {return rn(n / 1e3) + "K";}
    if (n >= 1e3) {return rn(n / 1e3, 1) + "K";}
    return rn(n);
  }

  // getInteger number from user input data
  function getInteger(value) {
    const metric = value.slice(-1);
    if (metric === "K") {return parseInt(value.slice(0, -1) * 1e3);}
    if (metric === "M") {return parseInt(value.slice(0, -1) * 1e6);}
    if (metric === "B") {return parseInt(value.slice(0, -1) * 1e9);}
    return parseInt(value);
  }

  // downalod map as SVG or PNG file
  function saveAsImage(type) {
    console.time("saveAsImage");
    const webSafe = ["Georgia", "Times+New+Roman", "Comic+Sans+MS", "Lucida+Sans+Unicode", "Courier+New", "Verdana", "Arial", "Impact"];
    // get non-standard fonts used for labels to fetch them from web
    const fontsInUse = []; // to store fonts currently in use
    labels.selectAll("g").each(function(d) {
      const font = d3.select(this).attr("data-font");
      if (!font) return;
      if (webSafe.indexOf(font) !== -1) return; // do not fetch web-safe fonts
      if (fontsInUse.indexOf(font) === -1) fontsInUse.push(font);
    });
    const fontsToLoad = "https://fonts.googleapis.com/css?family=" + fontsInUse.join("|");

    // clone svg
    const cloneEl = document.getElementsByTagName("svg")[0].cloneNode(true);
    cloneEl.id = "fantasyMap";
    document.getElementsByTagName("body")[0].appendChild(cloneEl);
    const clone = d3.select("#fantasyMap");

    // rteset transform for svg
    if (type === "svg") {
      clone.attr("width", graphWidth).attr("height", graphHeight);
      clone.select("#viewbox").attr("transform", null);
      if (svgWidth !== graphWidth || svgHeight !== graphHeight) {
        // move scale bar to right bottom corner
        const el = clone.select("#scaleBar");
        if (!el.size()) return;
        const bbox = el.select("rect").node().getBBox();
        const tr = [graphWidth - bbox.width, graphHeight - (bbox.height - 10)];
        el.attr("transform", "translate(" + rn(tr[0]) + "," + rn(tr[1]) + ")");
      }

      // to fix use elements sizing
      clone.selectAll("use").each(function() {
        const size = this.parentNode.getAttribute("size") || 1;
        this.setAttribute("width", size + "px");
        this.setAttribute("height", size + "px");
      });

      // clean attributes
      //clone.selectAll("*").each(function() {
      //  const attributes = this.attributes;
      //  for (let i = 0; i < attributes.length; i++) {
      //    const attr = attributes[i];
      //    if (attr.value === "" || attr.name.includes("data")) {
      //      this.removeAttribute(attr.name);
      //    }
      //  }
      //});

    }

    // for each g element get inline style
    const emptyG = clone.append("g").node();
    const defaultStyles = window.getComputedStyle(emptyG);

    // show hidden labels but in reduced size
    clone.select("#labels").selectAll(".hidden").each(function(e) {
      const size = d3.select(this).attr("font-size");
      d3.select(this).classed("hidden", false).attr("font-size", rn(size * 0.4, 2));
    });

    // save group css to style attribute
    clone.selectAll("g, #ruler > g > *, #scaleBar > text").each(function(d) {
      const compStyle = window.getComputedStyle(this);
      let style = "";
      for (let i=0; i < compStyle.length; i++) {
        const key = compStyle[i];
        const value = compStyle.getPropertyValue(key);
        // Firefox mask hack
        if (key === "mask-image" && value !== defaultStyles.getPropertyValue(key)) {
          style += "mask-image: url('#shape');";
          continue;
        }
        if (key === "cursor") continue; // cursor should be default
        if (this.hasAttribute(key)) continue; // don't add style if there is the same attribute
        if (value === defaultStyles.getPropertyValue(key)) continue;
        style += key + ':' + value + ';';
      }
      if (style != "") this.setAttribute('style', style);
    });
    emptyG.remove();

    // load fonts as dataURI so they will be available in downloaded svg/png
    GFontToDataURI(fontsToLoad).then(cssRules => {
      clone.select("defs").append("style").text(cssRules.join('\n'));
      const svg_xml = (new XMLSerializer()).serializeToString(clone.node());
      clone.remove();
      const blob = new Blob([svg_xml], {type: 'image/svg+xml;charset=utf-8'});
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.target = "_blank";
      if (type === "png") {
        const ratio = svgHeight / svgWidth;
        canvas.width = svgWidth * pngResolutionInput.value;
        canvas.height = svgHeight * pngResolutionInput.value;
        const img = new Image();
        img.src = url;
        img.onload = function(){
          window.URL.revokeObjectURL(url);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          link.download = "fantasy_map_" + Date.now() + ".png";
          canvas.toBlob(function(blob) {
             link.href = window.URL.createObjectURL(blob);
             document.body.appendChild(link);
             link.click();
             window.setTimeout(function() {window.URL.revokeObjectURL(link.href);}, 5000);
          });
          canvas.style.opacity = 0;
          canvas.width = svgWidth;
          canvas.height = svgHeight;
        }
      } else {
        link.download = "fantasy_map_" + Date.now() + ".svg";
        link.href = url;
        document.body.appendChild(link);
        link.click();
      }
      console.timeEnd("saveAsImage");
      window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 5000);
    });
  }

  // Code from Kaiido's answer:
  // https://stackoverflow.com/questions/42402584/how-to-use-google-fonts-in-canvas-when-drawing-dom-objects-in-svg
  function GFontToDataURI(url) {
    return fetch(url) // first fecth the embed stylesheet page
      .then(resp => resp.text()) // we only need the text of it
      .then(text => {
        let s = document.createElement('style');
        s.innerHTML = text;
        document.head.appendChild(s);
        let styleSheet = Array.prototype.filter.call(
          document.styleSheets,
          sS => sS.ownerNode === s)[0];
        let FontRule = rule => {
          let src = rule.style.getPropertyValue('src');
          let family = rule.style.getPropertyValue('font-family');
          let url = src.split('url(')[1].split(')')[0];
          return {
            rule: rule,
            src: src,
            url: url.substring(url.length - 1, 1)
          };
        };
        let fontRules = [],fontProms = [];

        for (let r of styleSheet.cssRules) {
          let fR = FontRule(r);
          fontRules.push(fR);
          fontProms.push(
            fetch(fR.url) // fetch the actual font-file (.woff)
            .then(resp => resp.blob())
            .then(blob => {
              return new Promise(resolve => {
                let f = new FileReader();
                f.onload = e => resolve(f.result);
                f.readAsDataURL(blob);
              })
            })
            .then(dataURL => {
              return fR.rule.cssText.replace(fR.url, dataURL);
            })
          )
        }
        document.head.removeChild(s); // clean up
        return Promise.all(fontProms); // wait for all this has been done
      });
  }

  // Save in .map format, based on FileSystem API
  function saveMap() {
    console.time("saveMap");
    // data convention: 0 - params; 1 - all points; 2 - cells; 3 - manors; 4 - states;
    // 5 - svg; 6 - options (see below); 7 - cultures;
    // 8 - empty (former nameBase); 9 - empty (former nameBases); 10 - heights; 11 - notes;
    // size stats: points = 6%, cells = 36%, manors and states = 2%, svg = 56%;
    const date = new Date();
    const dateString = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
    const license = "File can be loaded in azgaar.github.io/Fantasy-Map-Generator";
    const params = version + "|" + license +  "|" + dateString + "|" + seed;
    const options = customization + "|" +
    distanceUnit.value + "|" + distanceScale.value + "|" + areaUnit.value + "|" +
    barSize.value  + "|" + barLabel.value  + "|" + barBackOpacity.value  + "|" + barBackColor.value + "|" +
    populationRate.value + "|" + urbanization.value;

    // set zoom / transform values to default
    svg.attr("width", graphWidth).attr("height", graphHeight);
    const transform = d3.zoomTransform(svg.node());
    viewbox.attr("transform", null);
    const oceanBack = ocean.select("rect");
    const oceanShift = [oceanBack.attr("x"), oceanBack.attr("y"), oceanBack.attr("width"), oceanBack.attr("height")];
    oceanBack.attr("x", 0).attr("y", 0).attr("width", graphWidth).attr("height", graphHeight);

    const svg_xml = (new XMLSerializer()).serializeToString(svg.node());
    const line = "\r\n";
    let data = params + line + JSON.stringify(points) + line + JSON.stringify(cells) + line;
    data += JSON.stringify(manors) + line + JSON.stringify(states) + line + svg_xml + line + options + line;
    data += JSON.stringify(cultures) + line + "" + line + "" + line + heights + line +  JSON.stringify(notes) + line;
    const dataBlob = new Blob([data], {type: "text/plain"});
    const dataURL = window.URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.download = "fantasy_map_" + Date.now() + ".map";
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();

    // restore initial values
    svg.attr("width", svgWidth).attr("height", svgHeight);
    zoom.transform(svg, transform);
    oceanBack.attr("x", oceanShift[0]).attr("y", oceanShift[1]).attr("width", oceanShift[2]).attr("height", oceanShift[3]);

    console.timeEnd("saveMap");
    window.setTimeout(function() {window.URL.revokeObjectURL(dataURL);}, 4000);
  }

  // Map Loader based on FileSystem API
  $("#mapToLoad").change(function() {
    console.time("loadMap");
    closeDialogs();
    const fileToLoad = this.files[0];
    this.value = "";
    uploadFile(fileToLoad);
  });

  function uploadFile(file, callback) {
    console.time("loadMap");
    const fileReader = new FileReader();
    fileReader.onload = function(fileLoadedEvent) {
      const dataLoaded = fileLoadedEvent.target.result;
      const data = dataLoaded.split("\r\n");
      // data convention: 0 - params; 1 - all points; 2 - cells; 3 - manors; 4 - states;
      // 5 - svg; 6 - options; 7 - cultures; 8 - none; 9 - none; 10 - heights; 11 - notes;
      const params = data[0].split("|");
      const mapVersion = params[0] || data[0];
      if (mapVersion !== version) {
        let message = `The Map version `;
        // mapVersion reference was not added to downloaded map before v. 0.52b, so I cannot support really old files
        if (mapVersion.length <= 10) {
          message +=  `(${mapVersion}) does not match the Generator version (${version}). The map will be auto-updated.
                      In case of critical issues you may send the .map file
                      <a href="mailto:maxganiev@yandex.ru?Subject=Map%20update%20request" target="_blank">to me</a>
                      or just keep using
                      <a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog" target="_blank">an appropriate version</a>
                      of the Generator`;
        } else if (!mapVersion || parseFloat(mapVersion) < 0.54) {
          message += `you are trying to load is too old and cannot be updated. Please re-create the map or just keep using
                      <a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog" target="_blank">an archived version</a>
                      of the Generator. Please note the Generator is still on demo and a lot of changes are being made every month`;
        }
        alertMessage.innerHTML = message;
        $("#alert").dialog({title: "Warning", buttons: {OK: function() {
          loadDataFromMap(data);
        }}});
      } else {loadDataFromMap(data);}
      if (mapVersion.length > 10) {console.error("Cannot load map"); }
    };
    fileReader.readAsText(file, "UTF-8");
    if (callback) {callback();}
  }

  function loadDataFromMap(data) {
    closeDialogs();
    // update seed
    const params = data[0].split("|");
    if (params[3]) {
      seed = params[3];
      optionsSeed.value = seed;
    }

    // get options
    if (data[0] === "0.52b" || data[0] === "0.53b") {
      customization = 0;
    } else if (data[6]) {
      const options = data[6].split("|");
      customization = +options[0] || 0;
      if (options[1]) distanceUnit.value = options[1];
      if (options[2]) distanceScale.value = options[2];
      if (options[3]) areaUnit.value = options[3];
      if (options[4]) barSize.value = options[4];
      if (options[5]) barLabel.value = options[5];
      if (options[6]) barBackOpacity.value = options[6];
      if (options[7]) barBackColor.value = options[7];
      if (options[8]) populationRate.value = options[8];
      if (options[9]) urbanization.value = options[9];
    }

    // replace old svg
    svg.remove();
    if (data[0] === "0.52b" || data[0] === "0.53b") {
      states = []; // no states data in old maps
      document.body.insertAdjacentHTML("afterbegin", data[4]);
    } else {
      states = JSON.parse(data[4]);
      document.body.insertAdjacentHTML("afterbegin", data[5]);
    }

    svg = d3.select("svg");

    // always change graph size to the size of loaded map
    const nWidth = +svg.attr("width"), nHeight = +svg.attr("height");
    graphWidth = nWidth;
    graphHeight = nHeight;
    voronoi = d3.voronoi().extent([[-1, -1],[graphWidth+1, graphHeight+1]]);
    zoom.translateExtent([[0, 0],[graphWidth, graphHeight]]).scaleExtent([1, 20]).scaleTo(svg, 1);
    viewbox.attr("transform", null);

    // temporary fit loaded svg element to current canvas size
    svg.attr("width", svgWidth).attr("height", svgHeight);
    if (nWidth !== svgWidth || nHeight !== svgHeight) {
      alertMessage.innerHTML  = `The loaded map has size ${nWidth} x ${nHeight} pixels, while the current canvas size is ${svgWidth} x ${svgHeight} pixels.
                                Click "Rescale" to fit the map to the current canvas size. Click "OK" to browse the map without rescaling`;
      $("#alert").dialog({title: "Map size conflict",
        buttons: {
          Rescale: function() {
            applyLoadedData(data);
            // rescale loaded map
            const xRatio = svgWidth / nWidth;
            const yRatio = svgHeight / nHeight;
            const scaleTo = rn(Math.min(xRatio, yRatio), 4);
            // calculate frames to scretch ocean background
            const extent = (100 / scaleTo) + "%";
            const xShift = (nWidth * scaleTo - svgWidth) / 2 / scaleTo;
            const yShift = (nHeight * scaleTo - svgHeight) / 2 / scaleTo;
            svg.select("#ocean").selectAll("rect").attr("x", xShift).attr("y", yShift).attr("width", extent).attr("height", extent);
            zoom.translateExtent([[0, 0],[nWidth, nHeight]]).scaleExtent([scaleTo, 20]).scaleTo(svg, scaleTo);
            $(this).dialog("close");
          },
          OK: function() {
            changeMapSize();
            applyLoadedData(data);
            $(this).dialog("close");
          }
        }
      });
    } else {
      applyLoadedData(data);
    }
  }

  function applyLoadedData(data) {
    // redefine variables
    defs = svg.select("#deftemp");
    viewbox = svg.select("#viewbox");
    ocean = viewbox.select("#ocean");
    oceanLayers = ocean.select("#oceanLayers");
    oceanPattern = ocean.select("#oceanPattern");
    landmass = viewbox.select("#landmass");
    grid = viewbox.select("#grid");
    overlay = viewbox.select("#overlay");
    terrs = viewbox.select("#terrs");
    cults = viewbox.select("#cults");
    routes = viewbox.select("#routes");
    roads = routes.select("#roads");
    trails = routes.select("#trails");
    rivers = viewbox.select("#rivers");
    terrain = viewbox.select("#terrain");
    regions = viewbox.select("#regions");
    borders = viewbox.select("#borders");
    stateBorders = borders.select("#stateBorders");
    neutralBorders = borders.select("#neutralBorders");
    coastline = viewbox.select("#coastline");
    lakes = viewbox.select("#lakes");
    searoutes = routes.select("#searoutes");
    labels = viewbox.select("#labels");
    icons = viewbox.select("#icons");
    markers = viewbox.select("#markers");
    ruler = viewbox.select("#ruler");
    debug = viewbox.select("#debug");

    if (!d3.select("#defs-markers").size()) {
      let symbol = '<g id="defs-markers"><symbol id="marker0" viewBox="0 0 30 30"><path d="M6,19 l9,10 L24,19" fill="#000000" stroke="none"></path><circle cx="15" cy="15" r="10" stroke-width="1" stroke="#000000" fill="#ffffff"></circle><text x="50%" y="50%" fill="#000000" stroke-width="0" stroke="#000000" font-size="22px" dominant-baseline="central">?</text></symbol></g>';
      let cont = document.getElementsByTagName("defs");
      cont[0].insertAdjacentHTML("afterbegin", symbol);
      markers = viewbox.append("g").attr("id", "markers");
    }

    // version control: ensure required groups are created with correct data
    if (!labels.select("#burgLabels").size()) {
      labels.append("g").attr("id", "burgLabels");
      $("#labels #capitals, #labels #towns").detach().appendTo($("#burgLabels"));
    }

    if (!icons.select("#burgIcons").size()) {
      icons.append("g").attr("id", "burgIcons");
      $("#icons #capitals, #icons #towns").detach().appendTo($("#burgIcons"));
      icons.select("#burgIcons").select("#capitals").attr("size", 1).attr("fill-opacity", .7).attr("stroke-opacity", 1);
      icons.select("#burgIcons").select("#towns").attr("size", .5).attr("fill-opacity", .7).attr("stroke-opacity", 1);
    }

    icons.selectAll("g").each(function() {
      const size = this.getAttribute("font-size");
      if (size === null || size === undefined) return;
      this.removeAttribute("font-size");
      this.setAttribute("size", size);
    });

    icons.select("#burgIcons").selectAll("circle").each(function() {
      this.setAttribute("r", this.parentNode.getAttribute("size"));
    });

    icons.selectAll("use").each(function() {
      const size = this.parentNode.getAttribute("size");
      if (size === null || size === undefined) return;
      this.setAttribute("width", size);
      this.setAttribute("height", size);
    });

    if (!labels.select("#countries").size()) {
      labels.append("g").attr("id", "countries")
        .attr("fill", "#3e3e4b").attr("opacity", 1)
        .attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC")
        .attr("font-size", 14).attr("data-size", 14);
    }

    burgLabels = labels.select("#burgLabels");
    burgIcons = icons.select("#burgIcons");

    // restore events
    svg.call(zoom);
    restoreDefaultEvents();
    viewbox.on("touchmove mousemove", moved);
    overlay.selectAll("*").call(d3.drag().on("start", elementDrag));
    terrain.selectAll("g").selectAll("g").on("click", editReliefIcon);
    labels.selectAll("text").on("click", editLabel);
    icons.selectAll("circle, path, use").on("click", editIcon);
    burgLabels.selectAll("text").on("click", editBurg);
    burgIcons.selectAll("circle, path, use").on("click", editBurg);
    rivers.selectAll("path").on("click", editRiver);
    routes.selectAll("path").on("click", editRoute);
    markers.selectAll("use").on("click", editMarker);
    svg.select("#scaleBar").call(d3.drag().on("start", elementDrag)).on("click", editScale);
    ruler.selectAll("g").call(d3.drag().on("start", elementDrag));
    ruler.selectAll("g").selectAll("text").on("click", removeParent);
    ruler.selectAll(".opisometer").selectAll("circle").call(d3.drag().on("start", opisometerEdgeDrag));
    ruler.selectAll(".linear").selectAll("circle:not(.center)").call(d3.drag().on("drag", rulerEdgeDrag));
    ruler.selectAll(".linear").selectAll("circle.center").call(d3.drag().on("drag", rulerCenterDrag));

    // update data
    const newPoints = [];
    riversData = [], queue = [], elSelected = "";
    points = JSON.parse(data[1]);
    cells = JSON.parse(data[2]);
    manors = JSON.parse(data[3]);
    if (data[7]) cultures = JSON.parse(data[7]);
    if (data[7] === undefined) generateCultures();
    if (data[11]) notes = JSON.parse(data[11]);

    // place random point
    function placePoint() {
      const x = Math.floor(Math.random() * graphWidth * 0.8 + graphWidth * 0.1);
      const y = Math.floor(Math.random() * graphHeight * 0.8 + graphHeight * 0.1);
      return [x, y];
    }

    // ensure each culure has a valid namesbase assigned, if not assign first base
    if (!nameBase[0]) applyDefaultNamesData();
    cultures.forEach(function(c) {
      const b = c.base;
      if (b === undefined) c.base = 0;
      if (!nameBase[b] || !nameBases[b]) c.base = 0;
      if (c.center === undefined) c.center = placePoint();
    });
    const graphSizeAdj = 90 / Math.sqrt(cells.length, 2); // adjust to different graphSize

    // cells validations
    cells.forEach(function(c, d) {
      // collect points
      newPoints.push(c.data);

      // update old 0-1 height range to a new 0-100 range
      if (c.height < 1) c.height = Math.trunc(c.height * 100);
      if (c.height === 1 && c.region !== undefined && c.flux !== undefined) c.height = 100;

      // check if there are any unavailable cultures
      if (c.culture > cultures.length - 1) {
        const center = [c.data[0],c.data[1]];
        const cult = {name:"AUTO_"+c.culture, color:"#ff0000", base:0, center};
        cultures.push(cult);
      }

      if (c.height >= 20) {
        if (!polygons[d] || !polygons[d].length) return;
        // calculate area
        if (c.area === undefined || isNaN(c.area)) {
          const area = d3.polygonArea(polygons[d]);
          c.area = rn(Math.abs(area), 2);
        }
        // calculate population
        if (c.pop === undefined || isNaN(c.pop)) {
          let population = 0;
          const elevationFactor = Math.pow((100 - c.height) / 100, 3);
          population = elevationFactor * c.area * graphSizeAdj;
          if (c.region === "neutral") population *= 0.5;
          c.pop = rn(population, 1);
        }
        // if culture is undefined, set to 0
        if (c.culture === undefined || isNaN(c.culture)) c.culture = 0;
      }
    });

    land = $.grep(cells, function(e) {return (e.height >= 20);});
    calculateVoronoi(newPoints);

    // get heights Uint8Array
    if (data[10]) {heights = new Uint8Array(data[10].split(","));}
    else {
      heights = new Uint8Array(points.length);
      for (let i=0; i < points.length; i++) {
        const cell = diagram.find(points[i][0],points[i][1]).index;
        heights[i] = cells[cell].height;
      }
    }

    // restore Heightmap customization mode
    if (customization === 1) {
      optionsTrigger.click();
      $("#customizeHeightmap, #customizationMenu").slideDown();
      $("#openEditor").slideUp();
      updateHistory();
      customizeTab.click();
      paintBrushes.click();
      tip("The map is in Heightmap customization mode. Please finalize the Heightmap", true);
    }
    // restore Country Edition mode
    if (customization === 2 || customization === 3) tip("The map is in Country Edition mode. Please complete the assignment", true);

    // restore layers state
    d3.select("#toggleCultures").classed("buttonoff", !cults.selectAll("path").size());
    d3.select("#toggleHeight").classed("buttonoff", !terrs.selectAll("path").size());
    d3.select("#toggleCountries").classed("buttonoff", regions.style("display") === "none");
    d3.select("#toggleRivers").classed("buttonoff", rivers.style("display") === "none");
    d3.select("#toggleOcean").classed("buttonoff", oceanPattern.style("display") === "none");
    d3.select("#toggleRelief").classed("buttonoff", terrain.style("display") === "none");
    d3.select("#toggleBorders").classed("buttonoff", borders.style("display") === "none");
    d3.select("#toggleIcons").classed("buttonoff", icons.style("display") === "none");
    d3.select("#toggleLabels").classed("buttonoff", labels.style("display") === "none");
    d3.select("#toggleRoutes").classed("buttonoff", routes.style("display") === "none");
    d3.select("#toggleGrid").classed("buttonoff", grid.style("display") === "none");

    // update map to support some old versions and fetch fonts
    labels.selectAll("g").each(function(d) {
      const el = d3.select(this);
      if (el.attr("id") === "burgLabels") return;
      const font = el.attr("data-font");
      if (font && fonts.indexOf(font) === -1) addFonts("https://fonts.googleapis.com/css?family=" + font);
      if (!el.attr("data-size")) el.attr("data-size", +el.attr("font-size"));
      if (el.style("display") === "none") el.node().style.display = null;
    });

    invokeActiveZooming();
    console.timeEnd("loadMap");
  }

  // get square grid with some jirrering
  function getJitteredGrid() {
    let sizeMod = rn((graphWidth + graphHeight) / 1500, 2); // screen size modifier
    spacing = rn(7.5 * sizeMod / graphSize, 2); // space between points before jirrering
    const radius = spacing / 2; // square radius
    const jittering = radius * 0.9; // max deviation
    const jitter = function() {return Math.random() * 2 * jittering - jittering;};
    let points = [];
    for (let y = radius; y < graphHeight; y += spacing) {
      for (let x = radius; x < graphWidth; x += spacing) {
        let xj = rn(x + jitter(), 2);
        let yj = rn(y + jitter(), 2);
        points.push([xj, yj]);
      }
    }
    return points;
  }

  // Hotkeys, see github.com/Azgaar/Fantasy-Map-Generator/wiki/Hotkeys
  d3.select("body").on("keydown", function() {
    const active = document.activeElement.tagName;
    if (active === "INPUT" || active === "SELECT" || active === "TEXTAREA") return;
    const key = d3.event.keyCode;
    const ctrl = d3.event.ctrlKey;
    const p = d3.mouse(this);
    if (key === 117) $("#randomMap").click(); // "F6" for new map
    else if (key === 27) closeDialogs(); // Escape to close all dialogs
    else if (key === 79) optionsTrigger.click(); // "O" to toggle options
    else if (key === 80) saveAsImage("png"); // "P" to save as PNG
    else if (key === 83) saveAsImage("svg"); // "S" to save as SVG
    else if (key === 77) saveMap(); // "M" to save MAP file
    else if (key === 76) mapToLoad.click(); // "L" to load MAP
    else if (key === 32) console.table(cells[diagram.find(p[0],p[1]).index]); // Space to log focused cell data
    else if (key === 192) console.log(cells); // "`" to log cells data
    else if (key === 66) console.table(manors); // "B" to log burgs data
    else if (key === 67) console.table(states); // "C" to log countries data
    else if (key === 70) console.table(features); // "F" to log features data
    else if (key === 37) zoom.translateBy(svg, 10, 0); // Left to scroll map left
    else if (key === 39) zoom.translateBy(svg, -10, 0); // Right to scroll map right
    else if (key === 38) zoom.translateBy(svg, 0, 10); // Up to scroll map up
    else if (key === 40) zoom.translateBy(svg, 0, -10); // Up to scroll map up
    else if (key === 107) zoom.scaleBy(svg, 1.2); // Plus to zoom map up
    else if (key === 109) zoom.scaleBy(svg, 0.8); // Minus to zoom map out
    else if (key === 48 || key === 96) resetZoom(); // 0 to reset zoom
    else if (key === 49 || key === 97) zoom.scaleTo(svg, 1); // 1 to zoom to 1
    else if (key === 50 || key === 98) zoom.scaleTo(svg, 2); // 2 to zoom to 2
    else if (key === 51 || key === 99) zoom.scaleTo(svg, 3); // 3 to zoom to 3
    else if (key === 52 || key === 100) zoom.scaleTo(svg, 4); // 4 to zoom to 4
    else if (key === 53 || key === 101) zoom.scaleTo(svg, 5); // 5 to zoom to 5
    else if (key === 54 || key === 102) zoom.scaleTo(svg, 6); // 6 to zoom to 6
    else if (key === 55 || key === 103) zoom.scaleTo(svg, 7); // 7 to zoom to 7
    else if (key === 56 || key === 104) zoom.scaleTo(svg, 8); // 8 to zoom to 8
    else if (key === 57 || key === 105) zoom.scaleTo(svg, 9); // 9 to zoom to 9
    else if (key === 9) $("#updateFullscreen").click(); // Tab to fit map to fullscreen
    else if (ctrl && key === 90) undo.click(); // Ctrl + "Z" to toggle undo
    else if (ctrl && key === 89) redo.click(); // Ctrl + "Y" to toggle undo
  });

  // Show help
  function showHelp() {
    $("#help").dialog({
      title: "About Fantasy Map Generator",
      minHeight: 30, width: "auto", maxWidth: 275, resizable: false,
      position: {my: "center top+10", at: "bottom", of: this},
      close: unselect
    });
  }

  // Toggle Options pane
  $("#optionsTrigger").on("click", function() {
    if (tooltip.getAttribute("data-main") === "Сlick the arrow button to open options") {
      tooltip.setAttribute("data-main", "");
      tooltip.innerHTML = "";
      localStorage.setItem("disable_click_arrow_tooltip", true);
    }
    if ($("#options").css("display") === "none") {
      $("#regenerate").hide();
      $("#options").fadeIn();
      $("#layoutTab").click();
      $("#optionsTrigger").removeClass("icon-right-open glow").addClass("icon-left-open");
    } else {
      $("#options").fadeOut();
      $("#optionsTrigger").removeClass("icon-left-open").addClass("icon-right-open");
    }
  });
  $("#collapsible").hover(function() {
    if ($("#optionsTrigger").hasClass("glow")) return;
    if ($("#options").css("display") === "none") {
      $("#regenerate").show();
      $("#optionsTrigger").removeClass("glow");
    }}, function() {
    $("#regenerate").hide();
  });

  // move layers on mapLayers dragging (jquery sortable)
  function moveLayer(event, ui) {
    const el = getLayer(ui.item.attr("id"));
    if (el) {
      const prev = getLayer(ui.item.prev().attr("id"));
      const next = getLayer(ui.item.next().attr("id"));
      if (prev) {el.insertAfter(prev);} else if (next) {el.insertBefore(next);}
    }
  }

  // define connection between option layer buttons and actual svg groups
  function getLayer(id) {
    if (id === "toggleGrid") {return $("#grid");}
    if (id === "toggleOverlay") {return $("#overlay");}
    if (id === "toggleHeight") {return $("#terrs");}
    if (id === "toggleCultures") {return $("#cults");}
    if (id === "toggleRoutes") {return $("#routes");}
    if (id === "toggleRivers") {return $("#rivers");}
    if (id === "toggleCountries") {return $("#regions");}
    if (id === "toggleBorders") {return $("#borders");}
    if (id === "toggleRelief") {return $("#terrain");}
    if (id === "toggleLabels") {return $("#labels");}
    if (id === "toggleIcons") {return $("#icons");}
  }

  // UI Button handlers
  $("button, a, li, i").on("click", function() {
    const id = this.id;
    const parent = this.parentNode.id;
    if (debug.selectAll(".tag").size()) {debug.selectAll(".tag, .line").remove();}
    if (id === "toggleHeight") {toggleHeight();}
    if (id === "toggleCountries") {$('#regions').fadeToggle();}
    if (id === "toggleCultures") {toggleCultures();}
    if (id === "toggleOverlay") {toggleOverlay();}
    if (id === "toggleFlux") {toggleFlux();}
    if (parent === "mapLayers" || parent === "styleContent") {$(this).toggleClass("buttonoff");}
    if (id === "randomMap" || id === "regenerate") {
      changeSeed();
      exitCustomization();
      undraw();
      resetZoom(1000);
      generate();
      return;
    }
    if (id === "editCountries") editCountries();
    if (id === "editCultures") editCultures();
    if (id === "editScale" || id === "editScaleCountries" || id === "editScaleBurgs") editScale();
    if (id === "countriesManually") {
      customization = 2;
      tip("Click to select a country, drag the circle to re-assign", true);
      mockRegions();
      let temp = regions.append("g").attr("id", "temp");
      $("#countriesBottom").children().hide();
      $("#countriesManuallyButtons").show();
      // highlight capital cells as it's not allowed to change capital's state that way
      states.map(function(s) {
        if (s.capital === "neutral" || s.capital === "select") return;
        const capital = s.capital;
        const index = manors[capital].cell;
        temp.append("path")
          .attr("data-cell", index).attr("data-state", s.i)
          .attr("d", "M" + polygons[index].join("L") + "Z")
          .attr("fill", s.color).attr("stroke", "red").attr("stroke-width", .7);
      });
      viewbox.style("cursor", "crosshair").call(drag).on("click", changeSelectedOnClick);
    }
    if (id === "countriesRegenerate") {
      customization = 3;
      tip("Manually change \"Expansion\" value for a country or click on \"Randomize\" button", true);
      mockRegions();
      regions.append("g").attr("id", "temp");
      $("#countriesBottom").children().hide();
      $("#countriesRegenerateButtons").show();
      $(".statePower, .icon-resize-full, .stateCells, .icon-check-empty").toggleClass("hidden");
      $("div[data-sortby='expansion'],div[data-sortby='cells']").toggleClass("hidden");
    }
    if (id === "countriesManuallyComplete") {
      debug.selectAll(".circle").remove();
      const changedCells = regions.select("#temp").selectAll("path");
      let changedStates = [];
      changedCells.each(function() {
        const el = d3.select(this);
        const cell = +el.attr("data-cell");
        let stateOld = cells[cell].region;
        if (stateOld === "neutral") {stateOld = states.length - 1;}
        const stateNew = +el.attr("data-state");
        const region = states[stateNew].color === "neutral" ? "neutral" : stateNew;
        cells[cell].region = region;
        if (cells[cell].manor !== undefined) {manors[cells[cell].manor].region = region;}
        changedStates.push(stateNew, stateOld);
      });
      changedStates = [...new Set(changedStates)];
      changedStates.map(function(s) {recalculateStateData(s);});
      const last = states.length - 1;
      if (states[last].capital === "neutral" && states[last].cells === 0) {
        $("#state" + last).remove();
        states.splice(-1);
      }
      $("#countriesManuallyCancel").click();
      if (changedStates.length) {editCountries();}
    }
    if (id === "countriesManuallyCancel") {
      redrawRegions();
      debug.selectAll(".circle").remove();
      if (grid.style("display") === "inline") {toggleGrid.click();}
      if (labels.style("display") === "none") {toggleLabels.click();}
      $("#countriesBottom").children().show();
      $("#countriesManuallyButtons, #countriesRegenerateButtons").hide();
      $(".selected").removeClass("selected");
      $("div[data-sortby='expansion'],.statePower, .icon-resize-full").addClass("hidden");
      $("div[data-sortby='cells'],.stateCells, .icon-check-empty").removeClass("hidden");
      customization = 0;
      restoreDefaultEvents();
    }
    if (id === "countriesApply") {$("#countriesManuallyCancel").click();}
    if (id === "countriesRandomize") {
      const mod = +powerInput.value * 2;
      $(".statePower").each(function(e, i) {
        const state = +(this.parentNode.id).slice(5);
        if (states[state].capital === "neutral") return;
        const power = rn(Math.random() * mod / 2 + 1, 1);
        $(this).val(power);
        $(this).parent().attr("data-expansion", power);
        states[state].power = power;
      });
      regenerateCountries();
    }
    if (id === "countriesAddM" || id === "countriesAddR" || id === "countriesAddG") {
      let i = states.length;
      // move neutrals to the last line
      if (states[i-1].capital === "neutral") {states[i-1].i = i; i -= 1;}
      var name = generateStateName(0);
      const color = colors20(i);
      states.push({i, color, name, capital: "select", cells: 0, burgs: 0, urbanPopulation: 0, ruralPopulation: 0, area: 0, power: 1});
      states.sort(function(a, b){return a.i - b.i});
      editCountries();
    }
    if (id === "countriesRegenerateNames") {
      const editor = d3.select("#countriesBody");
      states.forEach(function(s) {
        if (s.capital === "neutral") return;
        s.name = generateStateName(s.i);
        labels.select("#regionLabel"+s.i).text(s.name);
        editor.select("#state"+s.i).select(".stateName").attr("value", s.name);
      });
    }
    if (id === "countriesPercentage") {
      var el = $("#countriesEditor");
      if (el.attr("data-type") === "absolute") {
        el.attr("data-type", "percentage");
        const totalCells = land.length;
        const totalBurgs = +countriesFooterBurgs.innerHTML;
        let totalArea = countriesFooterArea.innerHTML;
        totalArea = getInteger(totalArea.split(" ")[0]);
        const totalPopulation = getInteger(countriesFooterPopulation.innerHTML);
        $("#countriesBody > .states").each(function() {
          const cells = rn($(this).attr("data-cells") / totalCells * 100);
          const burgs = rn($(this).attr("data-burgs") / totalBurgs * 100);
          const area = rn($(this).attr("data-area") / totalArea * 100);
          const population = rn($(this).attr("data-population") / totalPopulation * 100);
          $(this).children().filter(".stateCells").text(cells + "%");
          $(this).children().filter(".stateBurgs").text(burgs + "%");
          $(this).children().filter(".stateArea").text(area + "%");
          $(this).children().filter(".statePopulation").val(population + "%");
        });
      } else {
        el.attr("data-type", "absolute");
        editCountries();
      }
    }
    if (id === "countriesExport") {
      if ($(".statePower").length === 0) {return;}
      const unit = areaUnit.value === "square" ? distanceUnit.value + "2" : areaUnit.value;
      let data = "Country,Capital,Cells,Burgs,Area (" + unit + "),Population\n"; // countries headers
      $("#countriesBody > .states").each(function() {
        const country = $(this).attr("data-country");
        if (country === "bottom") {data += "neutral,"} else {data += country + ",";}
        const capital = $(this).attr("data-capital");
        if (capital === "bottom" || capital === "select") {data += ","} else {data += capital + ",";}
        data += $(this).attr("data-cells") + ",";
        data += $(this).attr("data-burgs") + ",";
        data += $(this).attr("data-area") + ",";
        const population = +$(this).attr("data-population");
        data += population + "\n";
      });
      data += "\nBurg,Country,Culture,Population\n"; // burgs headers
      manors.map(function(m) {
        if (m.region === "removed") return; // skip removed burgs
        data += m.name + ",";
        const country = m.region === "neutral" ? "neutral" : states[m.region].name;
        data += country + ",";
        data += cultures[m.culture].name + ",";
        const population = m.population * urbanization.value * populationRate.value * 1000;
        data += population + "\n";
      });
      const dataBlob = new Blob([data], {type: "text/plain"});
      const url = window.URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      document.body.appendChild(link);
      link.download = "countries_data" + Date.now() + ".csv";
      link.href = url;
      link.click();
      window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 2000);
    }

    if (id === "burgNamesImport") burgsListToLoad.click();

    if (id === "removeCountries") {
      alertMessage.innerHTML = `Are you sure you want remove all countries?`;
      $("#alert").dialog({resizable: false, title: "Remove countries",
        buttons: {
          Cancel: function() {$(this).dialog("close");},
          Remove: function() {
            $(this).dialog("close");
            $("#countriesBody").empty();
            manors.map(function(m) {m.region = "neutral";});
            land.map(function(l) {l.region = "neutral";});
            states.map(function(s) {
              const c = +s.capital;
              if (isNaN(c)) return;
              moveBurgToGroup(c, "towns");
            });
            removeAllLabelsInGroup("countries");
            regions.selectAll("path").remove();
            states = [];
            states.push({i: 0, color: "neutral", capital: "neutral", name: "Neutrals"});
            recalculateStateData(0);
            if ($("#burgsEditor").is(":visible")) {$("#burgsEditor").dialog("close");}
            editCountries();
          }
        }
      })
    }
    if (id === "removeBurgs") {
      alertMessage.innerHTML = `Are you sure you want to remove all burgs associated with the country?`;
      $("#alert").dialog({resizable: false, title: "Remove associated burgs",
        buttons: {
          Cancel: function() {$(this).dialog("close");},
          Remove: function() {
            $(this).dialog("close");
            const state = +$("#burgsEditor").attr("data-state");
            const region = states[state].capital === "neutral" ? "neutral" : state;
            $("#burgsBody").empty();
            manors.map(function(m) {
              if (m.region !== region) {return;}
              m.region = "removed";
              cells[m.cell].manor = undefined;
              labels.select("[data-id='" + m.i + "']").remove();
              icons.selectAll("[data-id='" + m.i + "']").remove();
            });
            states[state].urbanPopulation = 0;
            states[state].burgs = 0;
            states[state].capital = "select";
            if ($("#countriesEditor").is(":visible")) {
              editCountries();
              $("#burgsEditor").dialog("moveToTop");
            }
            burgsFooterBurgs.innerHTML = 0;
            burgsFooterPopulation.value = 0;
          }
        }
      });
    }
    if (id === "changeCapital") {
      if ($(this).hasClass("pressed")) {
        $(this).removeClass("pressed")
      } else {
        $(".pressed").removeClass("pressed");
        $(this).addClass("pressed");
      }
    }
    if (id === "regenerateBurgNames") {
      var s = +$("#burgsEditor").attr("data-state");
      $(".burgName").each(function(e, i) {
        const b = +(this.parentNode.id).slice(5);
        const name = generateName(manors[b].culture);
        $(this).val(name);
        $(this).parent().attr("data-burg", name);
        manors[b].name = name;
        labels.select("[data-id='" + b + "']").text(name);
      });
      if ($("#countriesEditor").is(":visible")) {
        if (states[s].capital === "neutral") {return;}
        var c = states[s].capital;
        $("#state"+s).attr("data-capital", manors[c].name);
        $("#state"+s+" > .stateCapital").val(manors[c].name);
      }
    }
    if (id === "burgAdd") {
      var state = +$("#burgsEditor").attr("data-state");
      clickToAdd(); // to load on click event function
      $("#addBurg").click().attr("data-state", state);
    }
    if (id === "toggleScaleBar") {$("#scaleBar").toggleClass("hidden");}
    if (id === "addRuler") {
      $("#ruler").show();
      const rulerNew = ruler.append("g").attr("class", "linear").call(d3.drag().on("start", elementDrag));
      const factor = rn(1 / Math.pow(scale, 0.3), 1);
      const y = Math.floor(Math.random() * graphHeight * 0.5 + graphHeight * 0.25);
      const x1 = graphWidth * 0.2, x2 = graphWidth * 0.8;
      const dash = rn(30 / distanceScale.value, 2);
      rulerNew.append("line").attr("x1", x1).attr("y1", y).attr("x2", x2).attr("y2", y).attr("class", "white").attr("stroke-width", factor);
      rulerNew.append("line").attr("x1", x1).attr("y1", y).attr("x2", x2).attr("y2", y).attr("class", "gray").attr("stroke-width", factor).attr("stroke-dasharray", dash);
      rulerNew.append("circle").attr("r", 2 * factor).attr("stroke-width", 0.5 * factor).attr("cx", x1).attr("cy", y).attr("data-edge", "left").call(d3.drag().on("drag", rulerEdgeDrag));
      rulerNew.append("circle").attr("r", 2 * factor).attr("stroke-width", 0.5 * factor).attr("cx", x2).attr("cy", y).attr("data-edge", "rigth").call(d3.drag().on("drag", rulerEdgeDrag));
      rulerNew.append("circle").attr("r", 1.2 * factor).attr("stroke-width", 0.3 * factor).attr("cx", graphWidth / 2).attr("cy", y).attr("class", "center").call(d3.drag().on("start", rulerCenterDrag));
      const dist = rn(x2 - x1);
      const label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
      rulerNew.append("text").attr("x", graphWidth / 2).attr("y", y).attr("dy", -1).attr("data-dist", dist).text(label).text(label).on("click", removeParent).attr("font-size", 10 * factor);
      return;
    }
    if (id === "addOpisometer" || id === "addPlanimeter") {
      if ($(this).hasClass("pressed")) {
        restoreDefaultEvents();
        $(this).removeClass("pressed");
      } else {
        $(this).addClass("pressed");
        viewbox.style("cursor", "crosshair").call(drag);
      }
      return;
    }
    if (id === "removeAllRulers") {
      if ($("#ruler > g").length < 1) {return;}
      alertMessage.innerHTML = `Are you sure you want to remove all placed rulers?`;
      $("#alert").dialog({resizable: false, title: "Remove all rulers",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            $("#ruler > g").remove();
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });
      return;
    }
    if (id === "editHeightmap") {$("#customizeHeightmap").slideToggle();}
    if (id === "fromScratch") {
      alertMessage.innerHTML = "Are you sure you want to clear the map? All progress will be lost";
      $("#alert").dialog({resizable: false, title: "Clear map",
        buttons: {
          Clear: function() {
            closeDialogs();
            undraw();
            placePoints();
            calculateVoronoi(points);
            detectNeighbors("grid");
            drawScaleBar();
            customizeHeightmap();
            openBrushesPanel();
            $(this).dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });
    }
    if (id === "fromHeightmap") {
      const message = `Hightmap is a basic element on which secondary data (rivers, burgs, countries etc) is based.
      If you want to significantly change the hightmap, it may be better to clean up all the secondary data
      and let the system to re-generate it based on the updated hightmap. In case of minor changes, you can keep the data.
      Newly added lands will be considered as neutral. Burgs located on a removed land cells will be deleted.
      Rivers and small lakes will be re-gerenated based on updated heightmap. Routes won't be regenerated.`;
      alertMessage.innerHTML = message;
      $("#alert").dialog({resizable: false, title: "Edit Heightmap",
        buttons: {
          "Clean up": function() {
            editHeightmap("clean");
            $(this).dialog("close");
          },
          Keep: function() {
            $(this).dialog("close");
            editHeightmap("keep");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });
      return;
    }
    // heightmap customization buttons
    if (customization === 1) {
      if (id === "paintBrushes") {openBrushesPanel();}
      if (id === "rescaleExecute") {
        const subject = rescaleLower.value + "-" + rescaleHigher.value;
        const sign = conditionSign.value;
        let modifier = rescaleModifier.value;
        if (sign === "×") {modifyHeights(subject, 0, +modifier);}
        if (sign === "÷") {modifyHeights(subject, 0, (1 / modifier));}
        if (sign === "+") {modifyHeights(subject, +modifier, 1);}
        if (sign === "-") {modifyHeights(subject, (-1 * modifier), 1);}
        if (sign === "^") {modifyHeights(subject, 0, "^" + modifier);}
        updateHeightmap();
        updateHistory();
      }
      if (id === "rescaleButton") {
        $("#modifyButtons").children().not("#rescaleButton, .condition").toggle();
      }
      if (id === "rescaleCondButton") {$("#modifyButtons").children().not("#rescaleCondButton, #rescaler").toggle();}
      if (id === "undo" || id === "templateUndo") {restoreHistory(historyStage - 1);}
      if (id === "redo" || id === "templateRedo") {restoreHistory(historyStage + 1);}
      if (id === "smoothHeights") {
        smoothHeights(4);
        updateHeightmap();
        updateHistory();
      }
      if (id === "disruptHeights") {
        disruptHeights();
        updateHeightmap();
        updateHistory();
      }
      if (id === "getMap") getMap();
      if (id === "applyTemplate") {
        if ($("#templateEditor").is(":visible")) {return;}
        $("#templateEditor").dialog({
          title: "Template Editor",
          minHeight: "auto", width: "auto", resizable: false,
          position: {my: "right top", at: "right-10 top+10", of: "svg"}
        });
      }
      if (id === "convertImage") {convertImage();}
      if (id === "convertImageGrid") {$("#grid").fadeToggle();}
      if (id === "convertImageHeights") {$("#landmass").fadeToggle();}
      if (id === "perspectiveView") {
        if ($("#perspectivePanel").is(":visible")) return;
        $("#perspectivePanel").dialog({
          title: "Perspective View",
          width: 520, height: 190,
          position: {my: "center center", at: "center center", of: "svg"}
        });
        drawPerspective();
        return;
      }
    }
    if (id === "restoreStyle") {
      alertMessage.innerHTML = "Are you sure you want to restore default style?";
      $("#alert").dialog({resizable: false, title: "Restore style",
        buttons: {
          Restore: function() {
            applyDefaultStyle();
            $(this).dialog("close");
          },
          Cancel: function() {
            $(this).dialog("close");
          }
        }
      });
    }
    if (parent === "mapFilters") {
      $("svg").attr("filter", "");
      if ($(this).hasClass('pressed')) {
        $("#mapFilters .pressed").removeClass('pressed');
      } else {
        $("#mapFilters .pressed").removeClass('pressed');
        $(this).addClass('pressed');
        $("svg").attr("filter", "url(#filter-" + id + ")");
      }
      return;
    }
    if (id === "updateFullscreen") {
      mapWidthInput.value = window.innerWidth;
      mapHeightInput.value = window.innerHeight;
      localStorage.removeItem("mapHeight");
      localStorage.removeItem("mapWidth");
      changeMapSize();
    }
    if (id === "zoomExtentDefault") {
      zoomExtentMin.value = 1;
      zoomExtentMax.value = 20;
      zoom.scaleExtent([1, 20]).scaleTo(svg, 1);
    }
    if (id === "saveButton") {$("#saveDropdown").slideToggle();}
    if (id === "loadMap") {mapToLoad.click();}
    if (id === "zoomReset") {resetZoom(1000);}
    if (id === "zoomPlus") {
      scale += 1;
      if (scale > 40) {scale = 40;}
      invokeActiveZooming();
    }
    if (id === "zoomMinus") {
      scale -= 1;
      if (scale <= 1) {scale = 1; viewX = 0; viewY = 0;}
      invokeActiveZooming();
    }
    if (id === "styleFontPlus" || id === "styleFontMinus") {
      var el = viewbox.select("#"+styleElementSelect.value);
      var mod = id === "styleFontPlus" ? 1.1 : 0.9;
      el.selectAll("g").each(function() {
        const el = d3.select(this);
        let size = rn(el.attr("data-size") * mod, 2);
        if (size < 2) {size = 2;}
        el.attr("data-size", size).attr("font-size", rn((size + (size / scale)) / 2, 2));
      });
      invokeActiveZooming();
      return;
    }
    if (id === "brushClear") {
      if (customization === 1) {
        var message = "Are you sure you want to clear the map?";
        alertMessage.innerHTML = message;
        $("#alert").dialog({resizable: false, title: "Clear map",
          buttons: {
            Clear: function() {
              $(this).dialog("close");
              viewbox.style("cursor", "crosshair").call(drag);
              landmassCounter.innerHTML = "0";
              $("#landmass").empty();
              heights = new Uint8Array(heights.length);
              // clear history
              history = [];
              historyStage = 0;
              updateHistory();
              redo.disabled = templateRedo.disabled = true;
              undo.disabled = templateUndo.disabled =  true;
            },
            Cancel: function() {$(this).dialog("close");}
          }
        });
      } else {
        start.click();
      }
    }
    if (id === "templateComplete") getMap();
    if (id === "convertColorsMinus") {
      var current = +convertColors.value - 1;
      if (current < 4) {current = 3;}
      convertColors.value = current;
      heightsFromImage(current);
    }
    if (id === "convertColorsPlus") {
      var current = +convertColors.value + 1;
      if (current > 255) {current = 256;}
      convertColors.value = current;
      heightsFromImage(current);
    }
    if (id === "convertOverlayButton") {
      $("#convertImageButtons").children().not(this).not("#convertColors").toggle();
    }
    if (id === "convertAutoLum") {autoAssing("lum");}
    if (id === "convertAutoHue") {autoAssing("hue");}
    if (id === "convertComplete") {completeConvertion();}
  });

  // support save options
  $("#saveDropdown > div").click(function() {
    const id = this.id;
    let dns_allow_popup_message = localStorage.getItem("dns_allow_popup_message");
    if (!dns_allow_popup_message) {
      localStorage.clear();
      let message = "Generator uses pop-up window to download files. ";
      message += "Please ensure your browser does not block popups. ";
      message += "Please check browser settings and turn off adBlocker if it is enabled";
      alertMessage.innerHTML = message;
      $("#alert").dialog({title: "File saver. Please enable popups!",
        buttons: {
          "Don't show again": function() {
            localStorage.setItem("dns_allow_popup_message", true);
            $(this).dialog("close");
          },
          Close: function() {$(this).dialog("close");}
        },
        position: {my: "center", at: "center", of: "svg"}
      });
    }
    if (id === "saveMap") {saveMap();}
    if (id === "saveSVG") {saveAsImage("svg");}
    if (id === "savePNG") {saveAsImage("png");}
    $("#saveDropdown").slideUp("fast");
  });

  // lock / unlock option randomization
  $("#options i[class^='icon-lock']").click(function() {
    $(this).toggleClass("icon-lock icon-lock-open");
    const locked = +$(this).hasClass("icon-lock");
    $(this).attr("data-locked", locked);
    const option = (this.id).slice(4, -5).toLowerCase();
    const value = $("#"+option+"Input").val();
    if (locked) {localStorage.setItem(option, value);}
    else {localStorage.removeItem(option);}
  });
