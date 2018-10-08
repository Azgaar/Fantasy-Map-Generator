
  function editHeightmap(type) {
    closeDialogs();
    const regionData = [],cultureData = [];
    if (type !== "clean") {
      for (let i = 0; i < points.length; i++) {
        let cell = diagram.find(points[i][0],points[i][1]).index;
        // if closest cell is a small lake, try to find a land neighbor
        if (cells[cell].lake === 2) cells[cell].neighbors.forEach(function(n) {
          if (cells[n].height >= 20) {cell = n; }
        });
        let region = cells[cell].region;
        if (region === undefined) region = -1;
        regionData.push(region);
        let culture = cells[cell].culture;
        if (culture === undefined) culture = -1;
        cultureData.push(culture);
      }
    } else {undraw();}
    calculateVoronoi(points);
    detectNeighbors("grid");
    drawScaleBar();
    if (type === "keep") {
      svg.selectAll("#lakes, #coastline, #terrain, #rivers, #grid, #terrs, #landmass, #ocean, #regions")
        .selectAll("path, circle, line").remove();
      svg.select("#shape").remove();
      for (let i = 0; i < points.length; i++) {
        if (regionData[i] !== -1) cells[i].region = regionData[i];
        if (cultureData[i] !== -1) cells[i].culture = cultureData[i];
      }
    }
    mockHeightmap();
    customizeHeightmap();
    openBrushesPanel();
  }

  function openBrushesPanel() {
    if ($("#brushesPanel").is(":visible")) {return;}
    $("#brushesPanel").dialog({
      title: "Paint Brushes",
      minHeight: 40, width: "auto", maxWidth: 200, resizable: false,
      position: {my: "right top", at: "right-10 top+10", of: "svg"}
    }).on('dialogclose', function() {
      restoreDefaultEvents();
      $("#brushesButtons > .pressed").removeClass('pressed');
    });

    if (modules.openBrushesPanel) return;
    modules.openBrushesPanel = true;

    $("#brushesButtons > button").on("click", function() {
      const rSlider = $("#brushRadiusLabel, #brushRadius");
      debug.selectAll(".circle, .tag, .line").remove();
      if ($(this).hasClass('pressed')) {
        $(this).removeClass('pressed');
        restoreDefaultEvents();
        rSlider.attr("disabled", true).addClass("disabled");
      } else {
        $("#brushesButtons > .pressed").removeClass('pressed');
        $(this).addClass('pressed');
        viewbox.style("cursor", "crosshair");
        const id = this.id;
        if (id === "brushRange" || id === "brushTrough") {viewbox.on("click", placeLinearFeature);} // on click brushes
        else {viewbox.call(drag).on("click", null);} // on drag brushes
        if ($(this).hasClass("feature")) {rSlider.attr("disabled", true).addClass("disabled");}
        else {rSlider.attr("disabled", false).removeClass("disabled");}
      }
    });
  }

  function drawPerspective() {
    console.time("drawPerspective");
    const width = 320, height = 180;
    const wRatio = graphWidth / width, hRatio = graphHeight / height;
    const lineCount = 320, lineGranularity = 90;
    const perspective = document.getElementById("perspective");
    const pContext = perspective.getContext("2d");
    const lines = [];
    let i = lineCount;
    while (i--) {
      const x = i / lineCount * width | 0;
      const canvasPoints = [];
      lines.push(canvasPoints);
      let j = Math.floor(lineGranularity);
      while (j--) {
        const y = j / lineGranularity * height | 0;
        let index = getCellIndex(x * wRatio, y * hRatio);
        let h = heights[index] - 20;
        if (h < 1) h = 0;
        canvasPoints.push([x, y, h]);
      }
    }
    pContext.clearRect(0, 0, perspective.width, perspective.height);
    for (let canvasPoints of lines) {
      for (let i = 0; i < canvasPoints.length - 1; i++) {
        const pt1 = canvasPoints[i];
        const pt2 = canvasPoints[i + 1];
        const avHeight = (pt1[2] + pt2[2]) / 200;
        pContext.beginPath();
        pContext.moveTo(...transformPt(pt1));
        pContext.lineTo(...transformPt(pt2));
        let clr = "rgb(81, 103, 169)"; // water
        if (avHeight !== 0) {clr = color(1 - avHeight - 0.2);}
        pContext.strokeStyle = clr;
        pContext.stroke();
      }
      for (let i = 0; i < canvasPoints.length - 1; i++) {

      }
    }
    console.timeEnd("drawPerspective");
  }

  // get square grid cell index based on coords
  function getCellIndex(x, y) {
    const index = diagram.find(x, y).index;
    // let cellsX = Math.round(graphWidth / spacing);
    // let index = Math.ceil(y / spacing) * cellsX + Math.round(x / spacing);
    return index;
  }

  function transformPt(pt) {
    const width = 320, maxHeight = 0.2;
    var [x, y] = projectIsometric(pt[0],pt[1]);
    return [x + width / 2 + 10, y + 10 - pt[2] * maxHeight];
  }

  function projectIsometric(x, y) {
    const scale = 1, yProj = 4;
    return [(x - y) * scale, (x + y) / yProj * scale];
  }

  // templateEditor Button handlers
  $("#templateTools > button").on("click", function() {
    let id = this.id;
    id = id.replace("template", "");
    if (id === "Mountain") {
      const steps = $("#templateBody > div").length;
      if (steps > 0) return;
    }
    $("#templateBody").attr("data-changed", 1);
    $("#templateBody").append('<div data-type="' + id + '">' + id + '</div>');
    const el = $("#templateBody div:last-child");
    if (id === "Hill" || id === "Pit" || id === "Range" || id === "Trough") {
      var count = '<label>count:<input class="templateElCount" onmouseover="tip(\'Blobs to add\')" type="number" value="1" min="1" max="99"></label>';
    }
    if (id === "Hill") {
      var dist = '<label>distribution:<input class="templateElDist" onmouseover="tip(\'Set blobs distribution. 0.5 - map center; 0 - any place\')" type="number" value="0.25" min="0" max="0.5" step="0.01"></label>';
    }
    if (id === "Add" || id === "Multiply") {
      var dist = '<label>to:<select class="templateElDist" onmouseover="tip(\'Change only land or all cells\')"><option value="all" selected>all cells</option><option value="land">land only</option><option value="interval">interval</option></select></label>';
    }
    if (id === "Add") {
      var count = '<label>value:<input class="templateElCount" onmouseover="tip(\'Add value to height of all cells (negative values are allowed)\')" type="number" value="-10" min="-100" max="100" step="1"></label>';
    }
    if (id === "Multiply") {
      var count = '<label>by value:<input class="templateElCount" onmouseover="tip(\'Multiply all cells Height by the value\')" type="number" value="1.1" min="0" max="10" step="0.1"></label>';
    }
    if (id === "Smooth") {
      var count = '<label>fraction:<input class="templateElCount" onmouseover="tip(\'Set smooth fraction. 1 - full smooth, 2 - half-smooth, etc.\')" type="number" min="1" max="10" value="2"></label>';
    }
    if (id === "Strait") {
      var count = '<label>width:<input class="templateElCount" onmouseover="tip(\'Set strait width\')" value="1-7"></label>';
    }
    el.append('<span onmouseover="tip(\'Remove step\')" class="icon-trash-empty"></span>');
    $("#templateBody .icon-trash-empty").on("click", function() {$(this).parent().remove();});
    if (dist) el.append(dist);
    if (count) el.append(count);
    el.find("select.templateElDist").on("input", fireTemplateElDist);
    $("#templateBody").attr("data-changed", 1);
  });

  // fireTemplateElDist selector handlers
  function fireTemplateElDist() {
    if (this.value === "interval") {
      const interval = prompt("Populate a height interval (e.g. from 17 to 20), without space, but with hyphen", "17-20");
      if (interval) {
        const option = '<option value="' + interval + '">' + interval + '</option>';
        $(this).append(option).val(interval);
      }
    }
  }

  // templateSelect on change listener
  $("#templateSelect").on("input", function() {
    const steps = $("#templateBody > div").length;
    const changed = +$("#templateBody").attr("data-changed");
    const template = this.value;
    if (steps && changed === 1) {
      alertMessage.innerHTML = "Are you sure you want to change the base template? All the changes will be lost.";
      $("#alert").dialog({resizable: false, title: "Change Template",
        buttons: {
          Change: function() {
            changeTemplate(template);
            $(this).dialog("close");
          },
          Cancel: function() {
            const prev = $("#templateSelect").attr("data-prev");
            $("#templateSelect").val(prev);
            $(this).dialog("close");
          }
        }
      });
    }
    if (steps === 0 || changed === 0) changeTemplate(template);
  });

  function changeTemplate(template) {
    $("#templateBody").empty();
    $("#templateSelect").attr("data-prev", template);
    if (template === "templateVolcano") {
      addStep("Mountain");
      addStep("Add", 10);
      addStep("Hill", 5, 0.35);
      addStep("Range", 3);
      addStep("Trough", -4);
    }
    if (template === "templateHighIsland") {
      addStep("Mountain");
      addStep("Add", 10);
      addStep("Range", 6);
      addStep("Hill", 12, 0.25);
      addStep("Trough", 3);
      addStep("Multiply", 0.75, "land");
      addStep("Pit", 1);
      addStep("Hill", 3, 0.15);
    }
    if (template === "templateLowIsland") {
      addStep("Mountain");
      addStep("Add", 10);
      addStep("Smooth", 2);
      addStep("Range", 2);
      addStep("Hill", 4, 0.4);
      addStep("Hill", 12, 0.2);
      addStep("Trough", 8);
      addStep("Multiply", 0.35, "land");
    }
    if (template === "templateContinents") {
      addStep("Mountain");
      addStep("Add", 10);
      addStep("Hill", 30, 0.25);
      addStep("Strait", "4-7");
      addStep("Pit", 10);
      addStep("Trough", 10);
      addStep("Multiply", 0.6, "land");
      addStep("Smooth", 2);
      addStep("Range", 3);
    }
    if (template === "templateArchipelago") {
      addStep("Mountain");
      addStep("Add", 10);
      addStep("Hill", 12, 0.15);
      addStep("Range", 8);
      addStep("Strait", "2-3");
      addStep("Trough", 15);
      addStep("Pit", 10);
      addStep("Add", -5, "land");
      addStep("Multiply", 0.7, "land");
      addStep("Smooth", 3);
    }

    if (template === "templateAtoll") {
      addStep("Mountain");
      addStep("Add", 10, "all");
      addStep("Hill", 2, 0.35);
      addStep("Range", 2);
      addStep("Smooth", 1);
      addStep("Multiply", 0.1, "27-100");
    }
    if (template === "templateMainland") {
      addStep("Mountain");
      addStep("Add", 10, "all");
      addStep("Hill", 30, 0.2);
      addStep("Range", 10);
      addStep("Pit", 20);
      addStep("Hill", 10, 0.15);
      addStep("Trough", 10);
      addStep("Multiply", 0.4, "land");
      addStep("Range", 10);
      addStep("Smooth", 3);
    }
    if (template === "templatePeninsulas") {
      addStep("Add", 15);
      addStep("Hill", 30, 0);
      addStep("Range", 5);
      addStep("Pit", 15);
      addStep("Strait", "15-20");
    }
    $("#templateBody").attr("data-changed", 0);
  }

  // interprete template function
  function addStep(feature, count, dist) {
    if (!feature) return;
    if (feature === "Mountain") templateMountain.click();
    if (feature === "Hill") templateHill.click();
    if (feature === "Pit") templatePit.click();
    if (feature === "Range") templateRange.click();
    if (feature === "Trough") templateTrough.click();
    if (feature === "Strait") templateStrait.click();
    if (feature === "Add") templateAdd.click();
    if (feature === "Multiply") templateMultiply.click();
    if (feature === "Smooth") templateSmooth.click();
    if (count) {$("#templateBody div:last-child .templateElCount").val(count);}
    if (dist !== undefined) {
      if (dist !== "land") {
        const option = '<option value="' + dist + '">' + dist + '</option>';
        $("#templateBody div:last-child .templateElDist").append(option);
      }
      $("#templateBody div:last-child .templateElDist").val(dist);
    }
  }

  // Execute custom template
  $("#templateRun").on("click", function() {
    if (customization !== 1) return;
    let steps = $("#templateBody > div").length;
    if (!steps) return;
    heights = new Uint8Array(heights.length); // clean all heights
    for (let step=1; step <= steps; step++) {
      const type = $("#templateBody div:nth-child(" + step + ")").attr("data-type");
      if (type === "Mountain") {addMountain(); continue;}
      let count = $("#templateBody div:nth-child(" + step + ") .templateElCount").val();
      const dist = $("#templateBody div:nth-child(" + step + ") .templateElDist").val();
      if (count) {
        if (count[0] !== "-" && count.includes("-")) {
          const lim = count.split("-");
          count = Math.floor(Math.random() * (+lim[1] - +lim[0] + 1) + +lim[0]);
        } else {
          count = +count; // parse string
        }
      }
      if (type === "Hill") {addHill(count, +dist);}
      if (type === "Pit") {addPit(count);}
      if (type === "Range") {addRange(count);}
      if (type === "Trough") {addRange(-1 * count);}
      if (type === "Strait") {addStrait(count);}
      if (type === "Add") {modifyHeights(dist, count, 1);}
      if (type === "Multiply") {modifyHeights(dist, 0, count);}
      if (type === "Smooth") {smoothHeights(count);}
    }
    mockHeightmap();
    updateHistory();
  });

  // Save custom template as text file
  $("#templateSave").on("click", function() {
    const steps = $("#templateBody > div").length;
    let stepsData = "";
    for (let step=1; step <= steps; step++) {
      const element = $("#templateBody div:nth-child(" + step + ")");
      const type = element.attr("data-type");
      let count = $("#templateBody div:nth-child(" + step + ") .templateElCount").val();
      let dist = $("#templateBody div:nth-child(" + step + ") .templateElDist").val();
      if (!count) {count = "0";}
      if (!dist) {dist = "0";}
      stepsData += type + " " + count + " " + dist + "\r\n";
    }
    const dataBlob = new Blob([stepsData], {type: "text/plain"});
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.download = "template_" + Date.now() + ".txt";
    link.href = url;
    link.click();
    $("#templateBody").attr("data-changed", 0);
  });

  // Load custom template as text file
  $("#templateLoad").on("click", function() {templateToLoad.click();});
  $("#templateToLoad").change(function() {
    const fileToLoad = this.files[0];
    this.value = "";
    const fileReader = new FileReader();
    fileReader.onload = function(fileLoadedEvent) {
      const dataLoaded = fileLoadedEvent.target.result;
      const data = dataLoaded.split("\r\n");
      $("#templateBody").empty();
      if (data.length > 0) {
        $("#templateBody").attr("data-changed", 1);
        $("#templateSelect").attr("data-prev", "templateCustom").val("templateCustom");
      }
      for (let i=0; i < data.length; i++) {
        const line = data[i].split(" ");
        addStep(line[0],line[1],line[2]);
      }
    };
    fileReader.readAsText(fileToLoad, "UTF-8");
  });

  // Image to Heightmap Converter dialog
  function convertImage() {
    canvas.width = svgWidth;
    canvas.height = svgHeight;
    // turn off paint brushes drag and cursor
    $(".pressed").removeClass('pressed');
    restoreDefaultEvents();
    const div = d3.select("#colorScheme");
    if (div.selectAll("*").size() === 0) {
      for (let i = 0; i <= 100; i++) {
        let width = i < 20 || i > 70 ? "1px" : "3px";
        if (i === 0) width = "4px";
        const clr = color(1 - i / 100);
        const style = "background-color: " + clr + "; width: " + width;
        div.append("div").attr("data-color", i).attr("style", style);
      }
      div.selectAll("*").on("touchmove mousemove", showHeight).on("click", assignHeight);
    }
    if ($("#imageConverter").is(":visible")) {return;}
    $("#imageConverter").dialog({
      title: "Image to Heightmap Converter",
      minHeight: 30, width: 260, resizable: false,
      position: {my: "right top", at: "right-10 top+10", of: "svg"}})
    .on('dialogclose', function() {completeConvertion();});
  }

  // Load image to convert
  $("#convertImageLoad").on("click", function() {imageToLoad.click();});
  $("#imageToLoad").change(function() {
    console.time("loadImage");
    // set style
    resetZoom();
    grid.attr("stroke-width", .2);
    // load image
    const file = this.files[0];
    this.value = ""; // reset input value to get triggered if the same file is uploaded
    const reader = new FileReader();
    const img = new Image;
    // draw image
    img.onload = function() {
      ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
      heightsFromImage(+convertColors.value);
      console.timeEnd("loadImage");
    };
    reader.onloadend = function() {img.src = reader.result;};
    reader.readAsDataURL(file);
  });

  function heightsFromImage(count) {
    const imageData = ctx.getImageData(0, 0, svgWidth, svgHeight);
    const data = imageData.data;
    $("#landmass > path, .color-div").remove();
    $("#landmass, #colorsUnassigned").fadeIn();
    $("#colorsAssigned").fadeOut();
    const colors = [], palette = [];
    points.map(function(i) {
      let x = rn(i[0]), y = rn(i[1]);
      if (y == svgHeight) {y--;}
      if (x == svgWidth) {x--;}
      const p = (x + y * svgWidth) * 4;
      const r = data[p], g = data[p + 1], b = data[p + 2];
      colors.push([r, g, b]);
    });
    const cmap = MMCQ.quantize(colors, count);
    heights = new Uint8Array(points.length);
    polygons.map(function(i, d) {
      const nearest = cmap.nearest(colors[d]);
      const rgb = "rgb(" + nearest[0] + ", " + nearest[1] + ", " + nearest[2] + ")";
      const hex = toHEX(rgb);
      if (palette.indexOf(hex) === -1) {palette.push(hex);}
      landmass.append("path")
        .attr("d", "M" + i.join("L") + "Z").attr("data-i", d)
        .attr("fill", hex).attr("stroke", hex);
    });
    landmass.selectAll("path").on("click", landmassClicked);
    palette.sort(function(a, b) {return d3.lab(a).b - d3.lab(b).b;}).map(function(i) {
      $("#colorsUnassigned").append('<div class="color-div" id="' + i.substr(1) + '" style="background-color: ' + i + ';"/>');
    });
    $(".color-div").click(selectColor);
  }

  function landmassClicked() {
    const color = d3.select(this).attr("fill");
    $("#"+color.slice(1)).click();
  }

  function selectColor() {
    landmass.selectAll(".selectedCell").classed("selectedCell", 0);
    const el = d3.select(this);
    if (el.classed("selectedColor")) {
      el.classed("selectedColor", 0);
    } else {
      $(".selectedColor").removeClass("selectedColor");
      el.classed("selectedColor", 1);
      $("#colorScheme .hoveredColor").removeClass("hoveredColor");
      $("#colorsSelectValue").text(0);
      if (el.attr("data-height")) {
        const height = el.attr("data-height");
        $("#colorScheme div[data-color='" + height + "']").addClass("hoveredColor");
        $("#colorsSelectValue").text(height);
      }
      const color = "#" + d3.select(this).attr("id");
      landmass.selectAll("path").classed("selectedCell", 0);
      landmass.selectAll("path[fill='" + color + "']").classed("selectedCell", 1);
    }
  }

  function showHeight() {
    let el = d3.select(this);
    let height = el.attr("data-color");
    $("#colorsSelectValue").text(height);
    $("#colorScheme .hoveredColor").removeClass("hoveredColor");
    el.classed("hoveredColor", 1);
  }

  function assignHeight() {
    const sel = $(".selectedColor")[0];
    const height = +d3.select(this).attr("data-color");
    const rgb = color(1 - height / 100);
    const hex = toHEX(rgb);
    sel.style.backgroundColor = rgb;
    sel.setAttribute("data-height", height);
    const cur = "#" + sel.id;
    sel.id = hex.substr(1);
    landmass.selectAll(".selectedCell").each(function() {
      d3.select(this).attr("fill", hex).attr("stroke", hex);
      let i = +d3.select(this).attr("data-i");
      heights[i] = height;
    });
    const parent = sel.parentNode;
    if (parent.id === "colorsUnassigned") {
      colorsAssigned.appendChild(sel);
      $("#colorsAssigned").fadeIn();
      if ($("#colorsUnassigned .color-div").length < 1) {$("#colorsUnassigned").fadeOut();}
    }
    if ($("#colorsAssigned .color-div").length > 1) {sortAssignedColors();}
  }

  // sort colors based on assigned height
  function sortAssignedColors() {
    const data = [];
    const colors = d3.select("#colorsAssigned").selectAll(".color-div");
    colors.each(function(d) {
      const id = d3.select(this).attr("id");
      const height = +d3.select(this).attr("data-height");
      data.push({id, height});
    });
    data.sort(function(a, b) {return a.height - b.height}).map(function(i) {
      $("#colorsAssigned").append($("#"+i.id));
    });
  }

  // auto assign color based on luminosity or hue
  function autoAssing(type) {
    const imageData = ctx.getImageData(0, 0, svgWidth, svgHeight);
    const data = imageData.data;
    $("#landmass > path, .color-div").remove();
    $("#colorsAssigned").fadeIn();
    $("#colorsUnassigned").fadeOut();
    polygons.forEach(function(i, d) {
      let x = rn(i.data[0]), y = rn(i.data[1]);
      if (y == svgHeight) y--;
      if (x == svgWidth) x--;
      const p = (x + y * svgWidth) * 4;
      const r = data[p], g = data[p + 1], b = data[p + 2];
      const lab = d3.lab("rgb(" + r + ", " + g + ", " + b + ")");
      if (type === "hue") {
        var normalized = rn(normalize(lab.b + lab.a / 2, -50, 200), 2);
      } else {
        var normalized = rn(normalize(lab.l, 0, 100), 2);
      }
      const rgb = color(1 - normalized);
      const hex = toHEX(rgb);
      heights[d] = normalized * 100;
      landmass.append("path").attr("d", "M" + i.join("L") + "Z").attr("data-i", d).attr("fill", hex).attr("stroke", hex);
    });
    let unique = [...new Set(heights)].sort();
    unique.forEach(function(h) {
      const rgb = color(1 - h / 100);
      const hex = toHEX(rgb);
      $("#colorsAssigned").append('<div class="color-div" id="' + hex.substr(1) + '" data-height="' + h + '" style="background-color: ' + hex + ';"/>');
    });
    $(".color-div").click(selectColor);
  }

  function normalize(val, min, max) {
    let normalized = (val - min) / (max - min);
    if (normalized < 0) {normalized = 0;}
    if (normalized > 1) {normalized = 1;}
    return normalized;
  }

  function completeConvertion() {
    mockHeightmap();
    restartHistory();
    $(".color-div").remove();
    $("#colorsAssigned, #colorsUnassigned").fadeOut();
    grid.attr("stroke-width", .1);
    canvas.style.opacity = convertOverlay.value = convertOverlayValue.innerHTML = 0;
    // turn on paint brushes drag and cursor
    viewbox.style("cursor", "crosshair").call(drag);
    $("#imageConverter").dialog('close');
  }

  // Clear the map
  function undraw() {
    viewbox.selectAll("path, circle, line, text, use, #ruler > g").remove();
    defs.selectAll("*").remove();
    landmass.select("rect").remove();
    cells = [],land = [],riversData = [],manors = [],states = [],features = [],queue = [];
  }

  // Enter Heightmap Customization mode
  function customizeHeightmap() {
    customization = 1;
    tip('Heightmap customization mode is active. Click on "Complete" to finalize the Heightmap', true);
    $("#getMap").removeClass("buttonoff").addClass("glow");
    resetZoom();
    landmassCounter.innerHTML = "0";
    $('#grid').fadeIn();
    $('#toggleGrid').removeClass("buttonoff");
    restartHistory();
    $("#customizationMenu").slideDown();
    $("#openEditor").slideUp();
  }

  // Remove all customization related styles, reset values
  function exitCustomization() {
    customization = 0;
    tip("", true);
    canvas.style.opacity = 0;
    $("#customizationMenu").slideUp();
    $("#getMap").addClass("buttonoff").removeClass("glow");
    $("#landmass").empty();
    $('#grid').empty().fadeOut();
    $('#toggleGrid').addClass("buttonoff");
    restoreDefaultEvents();
    if (!$("#toggleHeight").hasClass("buttonoff")) {toggleHeight();}
    closeDialogs();
    history = [];
    historyStage = 0;
    $("#customizeHeightmap").slideUp();
    $("#openEditor").slideDown();
    debug.selectAll(".circle, .tag, .line").remove();
  }

  // open editCountries dialog
  function editCountries() {
    if (cults.selectAll("path").size()) $("#toggleCultures").click();
    if (regions.style("display") === "none") $("#toggleCountries").click();
    layoutPreset.value = "layoutPolitical";
    $("#countriesBody").empty();
    $("#countriesHeader").children().removeClass("icon-sort-name-up icon-sort-name-down icon-sort-number-up icon-sort-number-down");
    let totalArea = 0, totalBurgs = 0, unit, areaConv;
    if (areaUnit.value === "square") {unit = " " + distanceUnit.value + "²";} else {unit = " " + areaUnit.value;}
    let totalPopulation = 0;
    for (let s = 0; s < states.length; s++) {
      $("#countriesBody").append('<div class="states" id="state' + s + '"></div>');
      const el = $("#countriesBody div:last-child");
      const burgsCount = states[s].burgs;
      totalBurgs += burgsCount;
      // calculate user-friendly area and population
      const area = rn(states[s].area * Math.pow(distanceScale.value, 2));
      totalArea += area;
      areaConv = si(area) + unit;
      const urban = rn(states[s].urbanPopulation * urbanization.value * populationRate.value);
      const rural = rn(states[s].ruralPopulation * populationRate.value);
      var population = (urban + rural) * 1000;
      totalPopulation += population;
      const populationConv = si(population);
      const title = '\'Total population: ' + populationConv + '; Rural population: ' + rural + 'K; Urban population: ' + urban + 'K\'';
      let neutral = states[s].color === "neutral" || states[s].capital === "neutral";
      // append elements to countriesBody
      if (!neutral) {
        el.append('<input onmouseover="tip(\'Country color. Click to change\')" class="stateColor" type="color" value="' + states[s].color + '"/>');
        el.append('<input onmouseover="tip(\'Country name. Click and type to change\')" class="stateName" value="' + states[s].name + '" autocorrect="off" spellcheck="false"/>');
        var capital = states[s].capital !== "select" ? manors[states[s].capital].name : "select";
        if (capital === "select") {
          el.append('<button onmouseover="tip(\'Click on map to select a capital or to create a new capital\')" class="selectCapital" id="selectCapital' + s + '">★ select</button>');
        } else {
          el.append('<span onmouseover="tip(\'Country capital. Click to enlange\')" class="icon-star-empty enlange"></span>');
          el.append('<input onmouseover="tip(\'Capital name. Click and type to rename\')" class="stateCapital" value="' + capital + '" autocorrect="off" spellcheck="false"/>');
        }
        el.append('<span onmouseover="tip(\'Country expansionism (defines competitive size)\')" class="icon-resize-full hidden"></span>');
        el.append('<input onmouseover="tip(\'Capital expansionism (defines competitive size)\')" class="statePower hidden" type="number" min="0" max="99" step="0.1" value="' + states[s].power + '"/>');
      } else {
        el.append('<input class="stateColor placeholder" disabled type="color"/>');
        el.append('<input onmouseover="tip(\'Neutral burgs are united into this group. Click to change the group name\')" class="stateName italic" id="stateName' + s + '" value="' + states[s].name + '" autocorrect="off" spellcheck="false"/>');
        el.append('<span class="icon-star-empty placeholder"></span>');
        el.append('<input class="stateCapital placeholder"/>');
        el.append('<span class="icon-resize-full hidden placeholder"></span>');
        el.append('<input class="statePower hidden placeholder" value="0.0"/>');
      }
      el.append('<span onmouseover="tip(\'Cells count\')" class="icon-check-empty"></span>');
      el.append('<div onmouseover="tip(\'Cells count\')" class="stateCells">' + states[s].cells + '</div>');
      el.append('<span onmouseover="tip(\'Burgs count. Click to see a full list\')" style="padding-right: 1px" class="stateBIcon icon-dot-circled"></span>');
      el.append('<div onmouseover="tip(\'Burgs count. Click to see a full list\')" class="stateBurgs">' + burgsCount + '</div>');
      el.append('<span onmouseover="tip(\'Country area: ' + (area + unit) + '\')" style="padding-right: 4px" class="icon-map-o"></span>');
      el.append('<div onmouseover="tip(\'Country area: ' + (area + unit) + '\')" class="stateArea">' + areaConv + '</div>');
      el.append('<span onmouseover="tip(' + title + ')" class="icon-male"></span>');
      el.append('<input onmouseover="tip(' + title + ')" class="statePopulation" value="' + populationConv + '">');
      if (!neutral) {
        el.append('<span onmouseover="tip(\'Remove country, all assigned cells will become Neutral\')" class="icon-trash-empty"></span>');
        el.attr("data-country", states[s].name).attr("data-capital", capital).attr("data-expansion", states[s].power).attr("data-cells", states[s].cells)
          .attr("data-burgs", states[s].burgs).attr("data-area", area).attr("data-population", population);
      } else {
        el.attr("data-country", "bottom").attr("data-capital", "bottom").attr("data-expansion", "bottom").attr("data-cells", states[s].cells)
          .attr("data-burgs", states[s].burgs).attr("data-area", area).attr("data-population", population);
      }
    }
    // initialize jQuery dialog
    if (!$("#countriesEditor").is(":visible")) {
      $("#countriesEditor").dialog({
        title: "Countries Editor",
        minHeight: "auto", minWidth: Math.min(svgWidth, 390),
        position: {my: "right top", at: "right-10 top+10", of: "svg"}
      }).on("dialogclose", function() {
        if (customization === 2 || customization === 3) {
          $("#countriesManuallyCancel").click()
        }
      });
    }
    // restore customization Editor version
    if (customization === 3) {
      $("div[data-sortby='expansion'],.statePower, .icon-resize-full").removeClass("hidden");
      $("div[data-sortby='cells'],.stateCells, .icon-check-empty").addClass("hidden");
    } else {
      $("div[data-sortby='expansion'],.statePower, .icon-resize-full").addClass("hidden");
      $("div[data-sortby='cells'],.stateCells, .icon-check-empty").removeClass("hidden");
    }
    // populate total line on footer
    countriesFooterCountries.innerHTML = states.length;
    if (states[states.length-1].capital === "neutral") {countriesFooterCountries.innerHTML = states.length - 1;}
    countriesFooterBurgs.innerHTML = totalBurgs;
    countriesFooterArea.innerHTML = si(totalArea) + unit;
    countriesFooterPopulation.innerHTML = si(totalPopulation);
    // handle events
    $("#countriesBody .states").hover(focusOnState, unfocusState);
    $(".enlange").click(function() {
      const s = +(this.parentNode.id).slice(5);
      const capital = states[s].capital;
      const l = labels.select("[data-id='" + capital + "']");
      const x = +l.attr("x"), y = +l.attr("y");
      zoomTo(x, y, 8, 1600);
    });
    $(".stateName").on("input", function() {
      const s = +(this.parentNode.id).slice(5);
      states[s].name = this.value;
      labels.select("#regionLabel"+s).text(this.value);
      if ($("#burgsEditor").is(":visible")) {
        if ($("#burgsEditor").attr("data-state") == s) {
          const color = '<input title="Country color. Click to change" type="color" class="stateColor" value="' + states[s].color + '"/>';
          $("div[aria-describedby='burgsEditor'] .ui-dialog-title").text("Burgs of " + this.value).prepend(color);
        }
      }
    });
    $(".states > .stateColor").on("change", function() {
      const s = +(this.parentNode.id).slice(5);
      states[s].color = this.value;
      regions.selectAll(".region"+s).attr("fill", this.value).attr("stroke", this.value);
      if ($("#burgsEditor").is(":visible")) {
        if ($("#burgsEditor").attr("data-state") == s) {
          $(".ui-dialog-title > .stateColor").val(this.value);
        }
      }
    });
    $(".stateCapital").on("input", function() {
      const s = +(this.parentNode.id).slice(5);
      const capital = states[s].capital;
      manors[capital].name = this.value;
      labels.select("[data-id='" + capital +"']").text(this.value);
      if ($("#burgsEditor").is(":visible")) {
        if ($("#burgsEditor").attr("data-state") == s) {
          $("#burgs"+capital+" > .burgName").val(this.value);
        }
      }
    }).hover(focusCapital, unfocus);
    $(".stateBurgs, .stateBIcon").on("click", editBurgs).hover(focusBurgs, unfocus);

    $("#countriesBody > .states").on("click", function() {
      if (customization === 2) {
        $(".selected").removeClass("selected");
        $(this).addClass("selected");
        const state = +$(this).attr("id").slice(5);
        let color = states[state].color;
        if (color === "neutral") {color = "white";}
        if (debug.selectAll(".circle").size()) debug.selectAll(".circle").attr("stroke", color);
      }
    });

    $(".selectCapital").on("click", function() {
      if ($(this).hasClass("pressed")) {
        $(this).removeClass("pressed");
        tooltip.setAttribute("data-main", "");
        restoreDefaultEvents();
      } else {
        $(this).addClass("pressed");
        viewbox.style("cursor", "crosshair").on("click", selectCapital);
        tip("Click on the map to select or create a new capital", true);
      }
    });

    function selectCapital() {
      const point = d3.mouse(this);
      const index = getIndex(point);
      const x = rn(point[0], 2), y = rn(point[1], 2);

      if (cells[index].height < 20) {
        tip("Cannot place capital on the water! Select a land cell");
        return;
      }
      const state = +$(".selectCapital.pressed").attr("id").replace("selectCapital", "");
      let oldState = cells[index].region;
      if (oldState === "neutral") {oldState = states.length - 1;}
      if (cells[index].manor !== undefined) {
        // cell has burg
        const burg = cells[index].manor;
        if (states[oldState].capital === burg) {
          tip("Existing capital cannot be selected as a new state capital! Select other cell");
          return;
        } else {
          // make this burg a new capital
          const urbanFactor = 0.9; // for old neutrals
          manors[burg].region = state;
          if (oldState === "neutral") {manors[burg].population *= (1 / urbanFactor);}
          manors[burg].population *= 2; // give capital x2 population bonus
          states[state].capital = burg;
          moveBurgToGroup(burg, "capitals");
        }
      } else {
        // free cell -> create new burg for a capital
        const closest = cultureTree.find(x, y);
        const culture = cultureTree.data().indexOf(closest) || 0;
        const name = generateName(culture);
        const i = manors.length;
        cells[index].manor = i;
        states[state].capital = i;
        let score = cells[index].score;
        if (score <= 0) {score = rn(Math.random(), 2);}
        if (cells[index].crossroad) {score += cells[index].crossroad;} // crossroads
        if (cells[index].confluence) {score += Math.pow(cells[index].confluence, 0.3);} // confluences
        if (cells[index].port !== undefined) {score *= 3;} // port-capital
        const population = rn(score, 1);
        manors.push({i, cell:index, x, y, region: state, culture, name, population});
        burgIcons.select("#capitals").append("circle").attr("id", "burg"+i).attr("data-id", i).attr("cx", x).attr("cy", y).attr("r", 1).on("click", editBurg);
        burgLabels.select("#capitals").append("text").attr("data-id", i).attr("x", x).attr("y", y).attr("dy", "-0.35em").text(name).on("click", editBurg);
      }
      cells[index].region = state;
      cells[index].neighbors.map(function(n) {
        if (cells[n].height < 20) {return;}
        if (cells[n].manor !== undefined) {return;}
        cells[n].region = state;
      });
      redrawRegions();
      recalculateStateData(oldState); // re-calc old state data
      recalculateStateData(state); // calc new state data
      editCountries();
      restoreDefaultEvents();
    }

    $(".statePower").on("input", function() {
      const s = +(this.parentNode.id).slice(5);
      states[s].power = +this.value;
      regenerateCountries();
    });
    $(".statePopulation").on("change", function() {
      let s = +(this.parentNode.id).slice(5);
      const popOr = +$(this).parent().attr("data-population");
      const popNew = getInteger(this.value);
      if (!Number.isInteger(popNew) || popNew < 1000) {
        this.value = si(popOr);
        return;
      }
      const change = popNew / popOr;
      states[s].urbanPopulation = rn(states[s].urbanPopulation * change, 2);
      states[s].ruralPopulation = rn(states[s].ruralPopulation * change, 2);
      const urban = rn(states[s].urbanPopulation * urbanization.value * populationRate.value);
      const rural = rn(states[s].ruralPopulation * populationRate.value);
      const population = (urban + rural) * 1000;
      $(this).parent().attr("data-population", population);
      this.value = si(population);
      let total = 0;
      $("#countriesBody > div").each(function(e, i) {
        total += +$(this).attr("data-population");
      });
      countriesFooterPopulation.innerHTML = si(total);
      if (states[s].capital === "neutral") {s = "neutral";}
      manors.map(function(m) {
        if (m.region !== s) {return;}
        m.population = rn(m.population * change, 2);
      });
    });
    // fully remove country
    $("#countriesBody .icon-trash-empty").on("click", function() {
      const s = +(this.parentNode.id).slice(5);
      alertMessage.innerHTML = `Are you sure you want to remove the country? All lands and burgs will become neutral`;
      $("#alert").dialog({resizable: false, title: "Remove country", buttons: {
        Remove: function() {removeCountry(s); $(this).dialog("close");},
        Cancel: function() {$(this).dialog("close");}
      }});
    });

    function removeCountry(s) {
      const cellsCount = states[s].cells;
      const capital = +states[s].capital;
      if (!isNaN(capital)) moveBurgToGroup(capital, "towns");
      states.splice(s, 1);
      states.map(function(s, i) {s.i = i;});
      land.map(function(c) {
        if (c.region === s) c.region = "neutral";
        else if (c.region > s) c.region -= 1;
      });
      // do only if removed state had cells
      if (cellsCount) {
        manors.map(function(b) {if (b.region === s) b.region = "neutral";});
        // re-calculate neutral data
        const i = states.length;
        if (states[i-1].capital !== "neutral") {
          states.push({i, color: "neutral", name: "Neutrals", capital: "neutral"});
        }
        recalculateStateData(i-1); // re-calc data for neutrals
        redrawRegions();
      }
      editCountries();
    }

    $("#countriesNeutral, #countriesNeutralNumber").on("change", regenerateCountries);
  }

  // burgs list + editor
  function editBurgs(context, s) {
    if (s === undefined) {s = +(this.parentNode.id).slice(5);}
    $("#burgsEditor").attr("data-state", s);
    $("#burgsBody").empty();
    $("#burgsHeader").children().removeClass("icon-sort-name-up icon-sort-name-down icon-sort-number-up icon-sort-number-down");
    const region = states[s].capital === "neutral" ? "neutral" : s;
    const burgs = $.grep(manors, function (e) {
      return (e.region === region);
    });
    const populationArray = [];
    burgs.map(function(b) {
      $("#burgsBody").append('<div class="states" id="burgs' + b.i + '"></div>');
      const el = $("#burgsBody div:last-child");
      el.append('<span title="Click to enlarge the burg" style="padding-right: 2px" class="enlarge icon-globe"></span>');
      el.append('<input title="Burg name. Click and type to change" class="burgName" value="' + b.name + '" autocorrect="off" spellcheck="false"/>');
      el.append('<span title="Burg culture" class="icon-book" style="padding-right: 2px"></span>');
      el.append('<div title="Burg culture" class="burgCulture">' + cultures[b.culture].name + '</div>');
      let population = b.population * urbanization.value * populationRate.value * 1000;
      populationArray.push(population);
      population = population > 1e4 ? si(population) : rn(population, -1);
      el.append('<span title="Population" class="icon-male"></span>');
      el.append('<input title="Population. Input to change" class="burgPopulation" value="' + population + '"/>');
      const capital = states[s].capital;
      let type = "z-burg"; // usual burg by default
      if (b.i === capital) {el.append('<span title="Capital" class="icon-star-empty"></span>'); type = "c-capital";}
      else {el.append('<span class="icon-star-empty placeholder"></span>');}
      if (cells[b.cell].port !== undefined) {
        el.append('<span title="Port" class="icon-anchor small"></span>');
        if (type === "c-capital") {type = "a-capital-port";} else {type = "p-port";}
      } else {
        el.append('<span class="icon-anchor placeholder"></span>');
      }
      if (b.i !== capital) {el.append('<span title="Remove burg" class="icon-trash-empty"></span>');}
      el.attr("data-burg", b.name).attr("data-culture", cultures[b.culture].name).attr("data-population", b.population).attr("data-type", type);
    });
    if (!$("#burgsEditor").is(":visible")) {
      $("#burgsEditor").dialog({
        title: "Burgs of " + states[s].name,
        minHeight: "auto", width: "auto",
        position: {my: "right bottom", at: "right-10 bottom-10", of: "svg"}
      });
      const color = '<input title="Country color. Click to change" type="color" class="stateColor" value="' + states[s].color + '"/>';
      if (region !== "neutral") {$("div[aria-describedby='burgsEditor'] .ui-dialog-title").prepend(color);}
    }
    // populate total line on footer
    burgsFooterBurgs.innerHTML = burgs.length;
    burgsFooterCulture.innerHTML = $("#burgsBody div:first-child .burgCulture").text();
    const avPop = rn(d3.mean(populationArray), -1);
    burgsFooterPopulation.value = avPop;
    $(".enlarge").click(function() {
      const b = +(this.parentNode.id).slice(5);
      const l = labels.select("[data-id='" + b + "']");
      const x = +l.attr("x"), y = +l.attr("y");
      zoomTo(x, y, 8, 1600);
    });

    $("#burgsBody > div").hover(focusBurg, unfocus);

    $("#burgsBody > div").click(function() {
      if (!$("#changeCapital").hasClass("pressed")) return;
      const s = +$("#burgsEditor").attr("data-state");
      const newCap = +$(this).attr("id").slice(5);
      const oldCap = +states[s].capital;
      if (newCap === oldCap) {
        tip("This burg is already a capital! Please select a different burg", null, "error");
        return;
      }
      $("#changeCapital").removeClass("pressed");
      states[s].capital = newCap;
      if (!isNaN(oldCap)) moveBurgToGroup(oldCap, "towns");
      recalculateStateData(s);
      moveBurgToGroup(newCap, "capitals");
    });

    $(".burgName").on("input", function() {
      const b = +(this.parentNode.id).slice(5);
      manors[b].name = this.value;
      labels.select("[data-id='" + b + "']").text(this.value);
      if (b === s && $("#countriesEditor").is(":visible")) {
        $("#state"+s+" > .stateCapital").val(this.value);
      }
    });
    $(".ui-dialog-title > .stateColor").on("change", function() {
      states[s].color = this.value;
      regions.selectAll(".region"+s).attr("fill", this.value).attr("stroke", this.value);
      if ($("#countriesEditor").is(":visible")) {
        $("#state"+s+" > .stateColor").val(this.value);
      }
    });
    $(".burgPopulation").on("change", function() {
      const b = +(this.parentNode.id).slice(5);
      const pop = getInteger(this.value);
      if (!Number.isInteger(pop) || pop < 10) {
        const orig = rn(manors[b].population * urbanization.value * populationRate.value * 1000, 2);
        this.value = si(orig);
        return;
      }
      populationRaw = rn(pop / urbanization.value / populationRate.value / 1000, 2);
      const change = populationRaw - manors[b].population;
      manors[b].population = populationRaw;
      $(this).parent().attr("data-population", populationRaw);
      this.value = si(pop);
      let state = manors[b].region;
      if (state === "neutral") {state = states.length - 1;}
      states[state].urbanPopulation += change;
      updateCountryPopulationUI(state);
      const average = states[state].urbanPopulation / states[state].burgs * urbanization.value * populationRate.value * 1000;
      burgsFooterPopulation.value = rn(average, -1);
    });
    $("#burgsFooterPopulation").on("change", function() {
      const state = +$("#burgsEditor").attr("data-state");
      const newPop = +this.value;
      const avPop = states[state].urbanPopulation / states[state].burgs * urbanization.value * populationRate.value * 1000;
      if (!Number.isInteger(newPop) || newPop < 10) {this.value = rn(avPop, -1); return;}
      const change = +this.value / avPop;
      $("#burgsBody > div").each(function(e, i) {
        const b = +(this.id).slice(5);
        const pop = rn(manors[b].population * change, 2);
        manors[b].population = pop;
        $(this).attr("data-population", pop);
        let popUI = pop * urbanization.value * populationRate.value * 1000;
        popUI = popUI > 1e4 ? si(popUI) : rn(popUI, -1);
        $(this).children().filter(".burgPopulation").val(popUI);
      });
      states[state].urbanPopulation = rn(states[state].urbanPopulation * change, 2);
      updateCountryPopulationUI(state);
    });
    $("#burgsBody .icon-trash-empty").on("click", function() {
      alertMessage.innerHTML = `Are you sure you want to remove the burg?`;
      const b = +(this.parentNode.id).slice(5);
      $("#alert").dialog({resizable: false, title: "Remove burg",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            const state = +$("#burgsEditor").attr("data-state");
            $("#burgs"+b).remove();
            const cell = manors[b].cell;
            manors[b].region = "removed";
            cells[cell].manor = undefined;
            states[state].burgs = states[state].burgs - 1;
            burgsFooterBurgs.innerHTML = states[state].burgs;
            countriesFooterBurgs.innerHTML = +countriesFooterBurgs.innerHTML - 1;
            states[state].urbanPopulation = states[state].urbanPopulation - manors[b].population;
            const avPop = states[state].urbanPopulation / states[state].burgs * urbanization.value * populationRate.value * 1000;
            burgsFooterPopulation.value = rn(avPop, -1);
            if ($("#countriesEditor").is(":visible")) {
              $("#state"+state+" > .stateBurgs").text(states[state].burgs);
            }
            labels.select("[data-id='" + b + "']").remove();
            icons.select("[data-id='" + b + "']").remove();
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });
    });
  }

  // onhover style functions
  function focusOnState() {
    const s = +(this.id).slice(5);
    labels.select("#regionLabel" + s).classed("drag", true);
    document.getElementsByClassName("region" + s)[0].style.stroke = "red";
    document.getElementsByClassName("region" + s)[0].setAttribute("filter", "url(#blur1)");
  }

  function unfocusState() {
    const s = +(this.id).slice(5);
    labels.select("#regionLabel" + s).classed("drag", false);
    document.getElementsByClassName("region" + s)[0].style.stroke = "none";
    document.getElementsByClassName("region" + s)[0].setAttribute("filter", null);
  }

  function focusCapital() {
    const s = +(this.parentNode.id).slice(5);
    const capital = states[s].capital;
    labels.select("[data-id='" + capital + "']").classed("drag", true);
    icons.select("[data-id='" + capital + "']").classed("drag", true);
  }

  function focusBurgs() {
    const s = +(this.parentNode.id).slice(5);
    const stateManors = $.grep(manors, function (e) {
      return (e.region === s);
    });
    stateManors.map(function(m) {
      labels.select("[data-id='" + m.i + "']").classed("drag", true);
      icons.select("[data-id='" + m.i + "']").classed("drag", true);
    });
  }

  function focusBurg() {
    const b = +(this.id).slice(5);
    const l = labels.select("[data-id='" + b + "']");
    l.classed("drag", true);
  }

  function unfocus() {$(".drag").removeClass("drag");}

  // save dialog position if "stable" dialog window is dragged
  $(".stable").on("dialogdragstop", function(event, ui) {
    sessionStorage.setItem(this.id, [ui.offset.left, ui.offset.top]);
  });

  // restore saved dialog position on "stable" dialog window open
  $(".stable").on("dialogopen", function(event, ui) {
    let pos = sessionStorage.getItem(this.id);
    if (!pos) {return;}
    pos = pos.split(",");
    if (pos[0] > $(window).width() - 100 || pos[1] > $(window).width()  - 40) {return;} // prevent showing out of screen
    const at = `left+${pos[0]} top+${pos[1]}`;
    $(this).dialog("option", "position", {my: "left top", at: at, of: "svg"});
  });

  // open editCultures dialog
  function editCultures() {
    if (!cults.selectAll("path").size()) $("#toggleCultures").click();
    if (regions.style("display") !== "none") $("#toggleCountries").click();
    layoutPreset.value = "layoutCultural";
    $("#culturesBody").empty();
    $("#culturesHeader").children().removeClass("icon-sort-name-up icon-sort-name-down icon-sort-number-up icon-sort-number-down");

    // collect data
    const cellsC = [],areas = [],rurPops = [],urbPops = [];
    const unit = areaUnit.value === "square" ? " " + distanceUnit.value + "²" : " " + areaUnit.value;
    land.map(function(l) {
      const c = l.culture;
      if (c === undefined) return;
      cellsC[c] = cellsC[c] ? cellsC[c] + 1 : 1;
      areas[c] = areas[c] ? areas[c] + l.area : l.area;
      rurPops[c] = rurPops[c] ? rurPops[c] + l.pop : l.pop;
    });

    manors.map(function(m) {
      const c = m.culture;
      if (isNaN(c)) return;
      urbPops[c] = urbPops[c] ? urbPops[c] + m.population : m.population;
    });

    if (!nameBases[0]) applyDefaultNamesData();
    for (let c = 0; c < cultures.length; c++) {
      $("#culturesBody").append('<div class="states cultures" id="culture' + c + '"></div>');
      if (cellsC[c] === undefined) {
        cellsC[c] = 0;
        areas[c] = 0;
        rurPops[c] = 0;
      }
      if (urbPops[c] === undefined) urbPops[c] = 0;
      const area = rn(areas[c] * Math.pow(distanceScale.value, 2));
      const areaConv = si(area) + unit;
      const urban = rn(urbPops[c] * +urbanization.value * populationRate.value);
      const rural = rn(rurPops[c] * populationRate.value);
      const population = (urban + rural) * 1000;
      const populationConv = si(population);
      const title = '\'Total population: '+populationConv+'; Rural population: '+rural+'K; Urban population: '+urban+'K\'';
      let b = cultures[c].base;
      if (b >= nameBases.length) b = 0;
      const base = nameBases[b].name;
      const el = $("#culturesBody div:last-child");
      el.append('<input onmouseover="tip(\'Culture color. Click to change\')" class="stateColor" type="color" value="' + cultures[c].color + '"/>');
      el.append('<input onmouseover="tip(\'Culture name. Click and type to change\')" class="cultureName" value="' + cultures[c].name + '" autocorrect="off" spellcheck="false"/>');
      el.append('<span onmouseover="tip(\'Culture cells count\')" class="icon-check-empty"></span>');
      el.append('<div onmouseover="tip(\'Culture cells count\')" class="stateCells">' + cellsC[c] + '</div>');
      el.append('<span onmouseover="tip(\'Culture area: ' + areaConv + '\')" style="padding-right: 4px" class="icon-map-o"></span>');
      el.append('<div onmouseover="tip(\'Culture area: ' + areaConv + '\')" class="stateArea">' + areaConv + '</div>');
      el.append('<span onmouseover="tip(' + title + ')" class="icon-male"></span>');
      el.append('<div onmouseover="tip(' + title + ')" class="culturePopulation">' + populationConv + '</div>');
      el.append('<span onmouseover="tip(\'Click to re-generate names for burgs with this culture assigned\')" class="icon-arrows-cw"></span>');
      el.append('<select onmouseover="tip(\'Culture namesbase. Click to change\')" class="cultureBase"></select>');
      if (cultures.length > 1) {
        el.append('<span onmouseover="tip(\'Remove culture. Remaining cultures will be recalculated\')" class="icon-trash-empty"></span>');
      }
      el.attr("data-color", cultures[c].color).attr("data-culture", cultures[c].name)
        .attr("data-cells", cellsC[c]).attr("data-area", area).attr("data-population", population).attr("data-base", base);
    }

    addCultureBaseOptions();
    drawCultureCenters();

    let activeCultures = cellsC.reduce(function(s, v) {if(v) {return s + 1;} else {return s;}}, 0);
    culturesFooterCultures.innerHTML = activeCultures + "/" + cultures.length;
    culturesFooterCells.innerHTML = land.length;
    let totalArea = areas.reduce(function(s, v) {return s + v;});
    totalArea = rn(totalArea * Math.pow(distanceScale.value, 2));
    culturesFooterArea.innerHTML = si(totalArea) + unit;
    let totalPopulation = rurPops.reduce(function(s, v) {return s + v;}) * urbanization.value;
    totalPopulation += urbPops.reduce(function(s, v) {return s + v;});
    culturesFooterPopulation.innerHTML = si(totalPopulation * 1000 * populationRate.value);

    // initialize jQuery dialog
    if (!$("#culturesEditor").is(":visible")) {
      $("#culturesEditor").dialog({
        title: "Cultures Editor",
        minHeight: "auto", minWidth: Math.min(svgWidth, 336),
        position: {my: "right top", at: "right-10 top+10", of: "svg"},
        close: function() {
          debug.select("#cultureCenters").selectAll("*").remove();
          exitCulturesManualAssignment();
        }
      });
    }

    $(".cultures").hover(function() {
      const c = +(this.id).slice(7);
      debug.select("#cultureCenter"+c).attr("stroke", "#000000e6");
    }, function() {
      const c = +(this.id).slice(7);
      debug.select("#cultureCenter"+c).attr("stroke", "#00000080");
    });

    $(".cultures").on("click", function() {
      if (customization !== 4) return;
      const c = +(this.id).slice(7);
      $(".selected").removeClass("selected");
      $(this).addClass("selected");
      let color = cultures[c].color;
      debug.selectAll(".circle").attr("stroke", color);
    });

    $(".cultures .stateColor").on("input", function() {
      const c = +(this.parentNode.id).slice(7);
      const old = cultures[c].color;
      cultures[c].color = this.value;
      debug.select("#cultureCenter"+c).attr("fill", this.value);
      cults.selectAll('[fill="'+old+'"]').attr("fill", this.value).attr("stroke", this.value);
    });

    $(".cultures .cultureName").on("input", function() {
      const c = +(this.parentNode.id).slice(7);
      cultures[c].name = this.value;
    });

    $(".cultures .icon-arrows-cw").on("click", function() {
      const c = +(this.parentNode.id).slice(7);
      manors.forEach(function(m) {
        if (m.region === "removed") return;
        if (m.culture !== c) return;
        m.name = generateName(c);
        labels.select("[data-id='" + m.i +"']").text(m.name);
      });
    });

    $("#culturesBody .icon-trash-empty").on("click", function() {
      const c = +(this.parentNode.id).slice(7);
      cultures.splice(c, 1);
      const centers = cultures.map(function(c) {return c.center;});
      cultureTree = d3.quadtree(centers);
      recalculateCultures("fullRedraw");
      editCultures();
    });

    if (modules.editCultures) return;
    modules.editCultures = true;

    function addCultureBaseOptions() {
      $(".cultureBase").each(function() {
        const c = +(this.parentNode.id).slice(7);
        for (let i=0; i < nameBases.length; i++) {
          this.options.add(new Option(nameBases[i].name, i));
        }
        this.value = cultures[c].base;
        this.addEventListener("change", function() {
          cultures[c].base = +this.value;
        })
      });
    }

    function drawCultureCenters() {
      let cultureCenters = debug.select("#cultureCenters");
      if (cultureCenters.size()) {cultureCenters.selectAll("*").remove();}
      else {cultureCenters = debug.append("g").attr("id", "cultureCenters");}
      for (let c=0; c < cultures.length; c++) {
        cultureCenters.append("circle").attr("id", "cultureCenter"+c)
          .attr("cx", cultures[c].center[0]).attr("cy", cultures[c].center[1])
          .attr("r", 6).attr("stroke-width", 2).attr("stroke", "#00000080").attr("fill", cultures[c].color)
          .on("mousemove", cultureCenterTip).on("mouseleave", function() {tip("", true)})
          .call(d3.drag().on("start", cultureCenterDrag));
      }
    }

    function cultureCenterTip() {
      tip('Drag to move culture center and re-calculate cultures', true);
    }

    function cultureCenterDrag() {
      const el = d3.select(this);
      const c = +this.id.slice(13);

      d3.event.on("drag", function() {
        const x = d3.event.x, y = d3.event.y;
        el.attr("cx", x).attr("cy", y);
        cultures[c].center = [x, y];
        const centers = cultures.map(function(c) {return c.center;});
        cultureTree = d3.quadtree(centers);
        recalculateCultures();
      });
    }

    $("#culturesPercentage").on("click", function() {
      const el = $("#culturesEditor");
      if (el.attr("data-type") === "absolute") {
        el.attr("data-type", "percentage");
        const totalCells = land.length;
        let totalArea = culturesFooterArea.innerHTML;
        totalArea = getInteger(totalArea.split(" ")[0]);
        const totalPopulation = getInteger(culturesFooterPopulation.innerHTML);
        $("#culturesBody > .cultures").each(function() {
          const cells = rn($(this).attr("data-cells") / totalCells * 100);
          const area = rn($(this).attr("data-area") / totalArea * 100);
          const population = rn($(this).attr("data-population") / totalPopulation * 100);
          $(this).children().filter(".stateCells").text(cells + "%");
          $(this).children().filter(".stateArea").text(area + "%");
          $(this).children().filter(".culturePopulation").text(population + "%");
        });
      } else {
        el.attr("data-type", "absolute");
        editCultures();
      }
    });

    $("#culturesManually").on("click", function() {
      customization = 4;
      tip("Click to select a culture, drag the circle to re-assign", true);
      $("#culturesBottom").children().hide();
      $("#culturesManuallyButtons").show();
      viewbox.style("cursor", "crosshair").call(drag).on("click", changeSelectedOnClick);
      debug.select("#cultureCenters").selectAll("*").remove();
    });

    $("#culturesManuallyComplete").on("click", function() {
      const changed = cults.selectAll("[data-culture]");
      changed.each(function() {
        const i = +(this.id).slice(4);
        const c = +this.getAttribute("data-culture");
        this.removeAttribute("data-culture");
        cells[i].culture = c;
        const manor = cells[i].manor;
        if (manor !== undefined) manors[manor].culture = c;
      });
      exitCulturesManualAssignment();
      if (changed.size()) editCultures();
    });

    $("#culturesManuallyCancel").on("click", function() {
      cults.selectAll("[data-culture]").each(function() {
        const i = +(this.id).slice(4);
        const c = cells[i].culture;
        this.removeAttribute("data-culture");
        const color = cultures[c].color;
        this.setAttribute("fill", color);
        this.setAttribute("stroke", color);
      });
      exitCulturesManualAssignment();
      drawCultureCenters();
    });

    function exitCulturesManualAssignment() {
      debug.selectAll(".circle").remove();
      $("#culturesBottom").children().show();
      $("#culturesManuallyButtons").hide();
      $(".selected").removeClass("selected");
      customization = 0;
      restoreDefaultEvents();
    }

    $("#culturesRandomize").on("click", function() {
      const centers = cultures.map(function(c) {
        const x = Math.floor(Math.random() * graphWidth * 0.8 + graphWidth * 0.1);
        const y = Math.floor(Math.random() * graphHeight * 0.8 + graphHeight * 0.1);
        const center = [x, y];
        c.center = center;
        return center;
      });
      cultureTree = d3.quadtree(centers);
      recalculateCultures();
      drawCultureCenters();
      editCultures();
    });

    $("#culturesExport").on("click", function() {
      const unit = areaUnit.value === "square" ? distanceUnit.value + "2" : areaUnit.value;
      let data = "Culture,Cells,Area ("+ unit +"),Population,Namesbase\n"; // headers
      $("#culturesBody > .cultures").each(function() {
        data += $(this).attr("data-culture") + ",";
        data += $(this).attr("data-cells") + ",";
        data += $(this).attr("data-area") + ",";
        data += $(this).attr("data-population") + ",";
        data += $(this).attr("data-base") + "\n";
      });

      const dataBlob = new Blob([data], {type: "text/plain"});
      const url = window.URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      document.body.appendChild(link);
      link.download = "cultures_data" + Date.now() + ".csv";
      link.href = url;
      link.click();
      window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 2000);
    });

    $("#culturesRegenerateNames").on("click", function() {
      manors.forEach(function(m) {
        if (m.region === "removed") return;
        const culture = m.culture;
        m.name = generateName(culture);
        labels.select("[data-id='" + m.i +"']").text(m.name);
      });
    });

    $("#culturesEditNamesBase").on("click", editNamesbase);

    $("#culturesAdd").on("click", function() {
      const x = Math.floor(Math.random() * graphWidth * 0.8 + graphWidth * 0.1);
      const y = Math.floor(Math.random() * graphHeight * 0.8 + graphHeight * 0.1);
      const center = [x, y];

      let culture, base, name, color;
      if (cultures.length < defaultCultures.length) {
        // add one of the default cultures
        culture = cultures.length;
        base = defaultCultures[culture].base;
        color = defaultCultures[culture].color;
        name = defaultCultures[culture].name;
      } else {
        // add random culture besed on one of the current ones
        culture = rand(cultures.length - 1);
        name = generateName(culture);
        color = colors20(cultures.length % 20);
        base = cultures[culture].base;
      }
      cultures.push({name, color, base, center});
      const centers = cultures.map(function(c) {return c.center;});
      cultureTree = d3.quadtree(centers);
      recalculateCultures();
      editCultures();
    });
  }

  // open editNamesbase dialog
  function editNamesbase() {
    // update list of bases
    const select = document.getElementById("namesbaseSelect");
    for (let i = select.options.length; i < nameBases.length; i++) {
      const option = new Option(nameBases[i].name, i);
      select.options.add(option);
    }

    // restore previous state
    const textarea = document.getElementById("namesbaseTextarea");
    let selected = +textarea.getAttribute("data-base");
    if (selected >= nameBases.length) selected = 0;
    select.value = selected;
    if (textarea.value === "") namesbaseUpdateInputs(selected);
    const examples = document.getElementById("namesbaseExamples");
    if (examples.innerHTML === "") namesbaseUpdateExamples(selected);

    // open a dialog
    $("#namesbaseEditor").dialog({
      title: "Namesbase Editor",
      minHeight: "auto", minWidth: Math.min(svgWidth, 400),
      position: {my: "center", at: "center", of: "svg"}
    });

    if (modules.editNamesbase) return;
    modules.editNamesbase = true;

    function namesbaseUpdateInputs(selected) {
      const textarea = document.getElementById("namesbaseTextarea");
      textarea.value = nameBase[selected].join(", ");
      textarea.setAttribute("data-base", selected);
      const name = document.getElementById("namesbaseName");
      const method = document.getElementById("namesbaseMethod");
      const min = document.getElementById("namesbaseMin");
      const max = document.getElementById("namesbaseMax");
      const dublication = document.getElementById("namesbaseDouble");
      name.value = nameBases[selected].name;
      method.value = nameBases[selected].method;
      min.value = nameBases[selected].min;
      max.value = nameBases[selected].max;
      dublication.value = nameBases[selected].d;
    }

    function namesbaseUpdateExamples(selected) {
      const examples = document.getElementById("namesbaseExamples");
      let text = "";
      for (let i=0; i < 10; i++) {
        const name = generateName(false, selected);
        if (name === undefined) {
          text = "Cannot generate examples. Please verify the data";
          break;
        }
        if (i !== 0) text += ", ";
        text += name
      }
      examples.innerHTML = text;
    }

    $("#namesbaseSelect").on("change", function() {
      const selected = +this.value;
      namesbaseUpdateInputs(selected);
      namesbaseUpdateExamples(selected);
    });

    $("#namesbaseName").on("input", function() {
      const base = +textarea.getAttribute("data-base");
      const select = document.getElementById("namesbaseSelect");
      select.options[base].innerHTML = this.value;
      nameBases[base].name = this.value;
    });

    $("#namesbaseTextarea").on("input", function() {
      const base = +this.getAttribute("data-base");
      const data = textarea.value.replace(/ /g, "").split(",");
      nameBase[base] = data;
      if (data.length < 3) {
        chain[base] = [];
        const examples = document.getElementById("namesbaseExamples");
        examples.innerHTML = "Please provide a correct source data";
        return;
      }
      const method = document.getElementById("namesbaseMethod").value;
      if (method !== "selection") chain[base] = calculateChain(base);
    });

    $("#namesbaseMethod").on("change", function() {
      const base = +textarea.getAttribute("data-base");
      nameBases[base].method = this.value;
      if (this.value !== "selection") chain[base] = calculateChain(base);
    });

    $("#namesbaseMin").on("change", function() {
      const base = +textarea.getAttribute("data-base");
      if (+this.value > nameBases[base].max) {
        tip("Minimal length cannot be greated that maximal");
      } else {
        nameBases[base].min = +this.value;
      }
    });

    $("#namesbaseMax").on("change", function() {
      const base = +textarea.getAttribute("data-base");
      if (+this.value < nameBases[base].min) {
        tip("Maximal length cannot be less than minimal");
      } else {
        nameBases[base].max = +this.value;
      }
    });

    $("#namesbaseDouble").on("change", function() {
      const base = +textarea.getAttribute("data-base");
      nameBases[base].d = this.value;
    });

    $("#namesbaseDefault").on("click", function() {
      alertMessage.innerHTML = `Are you sure you want to restore the default namesbase?
        All custom bases will be removed and default ones will be assigned to existing cultures.
        Meanwhile existing names will not be changed.`;
      $("#alert").dialog({resizable: false, title: "Restore default data",
        buttons: {
          Restore: function() {
            $(this).dialog("close");
            $("#namesbaseEditor").dialog("close");
            const select = document.getElementById("namesbaseSelect");
            select.options.length = 0;
            document.getElementById("namesbaseTextarea").value = "";
            document.getElementById("namesbaseTextarea").setAttribute("data-base", 0);
            document.getElementById("namesbaseExamples").innerHTML === "";
            applyDefaultNamesData();
            const baseMax = nameBases.length - 1;
            cultures.forEach(function(c) {if (c.base > baseMax) c.base = baseMax;});
            chains = {};
            calculateChains();
            editCultures();
            editNamesbase();
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });
    });

    $("#namesbaseAdd").on("click", function() {
      const base = nameBases.length;
      const name = "Base" + base;
      const method = document.getElementById("namesbaseMethod").value;
      const select = document.getElementById("namesbaseSelect");
      select.options.add(new Option(name, base));
      select.value = base;
      nameBases.push({name, method, min: 4, max: 10, d: "", m: 1});
      nameBase.push([]);
      document.getElementById("namesbaseName").value = name;
      const textarea = document.getElementById("namesbaseTextarea");
      textarea.value = "";
      textarea.setAttribute("data-base", base);
      document.getElementById("namesbaseExamples").innerHTML = "";
      chain[base] = [];
      editCultures();
    });

    $("#namesbaseExamples, #namesbaseUpdateExamples").on("click", function() {
      const select = document.getElementById("namesbaseSelect");
      namesbaseUpdateExamples(+select.value);
    });

    $("#namesbaseDownload").on("click", function() {
      const nameBaseString = JSON.stringify(nameBase) + "\r\n";
      const nameBasesString = JSON.stringify(nameBases);
      const dataBlob = new Blob([nameBaseString + nameBasesString],{type:"text/plain"});
      const url = window.URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.download = "namebase" + Date.now() + ".txt";
      link.href = url;
      link.click();
    });

    $("#namesbaseUpload").on("click", function() {namesbaseToLoad.click();});
    $("#namesbaseToLoad").change(function() {
      const fileToLoad = this.files[0];
      this.value = "";
      const fileReader = new FileReader();
      fileReader.onload = function(fileLoadedEvent) {
        const dataLoaded = fileLoadedEvent.target.result;
        const data = dataLoaded.split("\r\n");
        if (data[0] && data[1]) {
          nameBase = JSON.parse(data[0]);
          nameBases = JSON.parse(data[1]);
          const select = document.getElementById("namesbaseSelect");
          select.options.length = 0;
          document.getElementById("namesbaseTextarea").value = "";
          document.getElementById("namesbaseTextarea").setAttribute("data-base", 0);
          document.getElementById("namesbaseExamples").innerHTML === "";
          const baseMax = nameBases.length - 1;
          cultures.forEach(function(c) {if (c.base > baseMax) c.base = baseMax;});
          chains = {};
          calculateChains();
          editCultures();
          editNamesbase();
        } else {
          tip("Cannot load a namesbase. Please check the data format")
        }
      };
      fileReader.readAsText(fileToLoad, "UTF-8");
    });
  }

  // open editLegends dialog
  function editLegends(id, name) {
    // update list of objects
    const select = document.getElementById("legendSelect");
    for (let i = select.options.length; i < notes.length; i++) {
      let option = new Option(notes[i].id, notes[i].id);
      select.options.add(option);
    }

    // select an object
    if (id) {
      let note = notes.find(note => note.id === id);
      if (note === undefined) {
        if (!name) name = id;
        note = {id, name, legend: ""};
        notes.push(note);
        let option = new Option(id, id);
        select.options.add(option);
      }
      select.value = id;
      legendName.value = note.name;
      legendText.value = note.legend;
    }

    // open a dialog
    $("#legendEditor").dialog({
      title: "Legends Editor",
      minHeight: "auto", minWidth: Math.min(svgWidth, 400),
      position: {my: "center", at: "center", of: "svg"}
    });

    if (modules.editLegends) return;
    modules.editLegends = true;

    // select another object
    document.getElementById("legendSelect").addEventListener("change", function() {
      let note = notes.find(note => note.id === this.value);
      legendName.value = note.name;
      legendText.value = note.legend;
    });

    // change note name on input
    document.getElementById("legendName").addEventListener("input", function() {
      let select = document.getElementById("legendSelect");
      let id = select.value;
      let note = notes.find(note => note.id === id);
      note.name = this.value;
    });

    // change note text on input
    document.getElementById("legendText").addEventListener("input", function() {
      let select = document.getElementById("legendSelect");
      let id = select.value;
      let note = notes.find(note => note.id === id);
      note.legend = this.value;
    });

    // hightlight DOM element
    document.getElementById("legendFocus").addEventListener("click", function() {
      let select = document.getElementById("legendSelect");
      let element = document.getElementById(select.value);

      // if element is not found
      if (element === null) {
        const message = "Related element is not found. Would you like to remove the note (legend item)?";
        alertMessage.innerHTML = message;
        $("#alert").dialog({resizable: false, title: "Element not found",
          buttons: {
            Remove: function() {$(this).dialog("close"); removeLegend();},
            Keep: function() {$(this).dialog("close");}
          }
        });
        return;
      }

      // if element is found
      highlightElement(element);
    });

    function highlightElement(element) {
      if (debug.select(".highlighted").size()) return; // allow only 1 highlight element simultaniosly
      let box = element.getBBox();
      let transform = element.getAttribute("transform") || null;
      let t = d3.transition().duration(1000).ease(d3.easeBounceOut);
      let r = d3.transition().duration(500).ease(d3.easeLinear);
      let highlight = debug.append("rect").attr("x", box.x).attr("y", box.y).attr("width", box.width).attr("height", box.height).attr("transform", transform);
      highlight.classed("highlighted", 1)
        .transition(t).style("outline-offset", "0px")
        .transition(r).style("outline-color", "transparent").remove();
      let tr = parseTransform(transform);
      let x = box.x + box.width / 2;
      if (tr[0]) x += tr[0];
      let y = box.y + box.height / 2;
      if (tr[1]) y += tr[1];
      if (scale >= 2) zoomTo(x, y, scale, 1600);
    }

    // download legends object as text file
    document.getElementById("legendDownload").addEventListener("click", function() {
      const legendString = JSON.stringify(notes);
      const dataBlob = new Blob([legendString],{type:"text/plain"});
      const url = window.URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.download = "legends" + Date.now() + ".txt";
      link.href = url;
      link.click();
    });

    // upload legends object as text file and parse to json
    document.getElementById("legendUpload").addEventListener("click", function() {
      document.getElementById("lagendsToLoad").click();
    });
    document.getElementById("lagendsToLoad").addEventListener("change", function() {
      const fileToLoad = this.files[0];
      this.value = "";
      const fileReader = new FileReader();
      fileReader.onload = function(fileLoadedEvent) {
        const dataLoaded = fileLoadedEvent.target.result;
        if (dataLoaded) {
          notes = JSON.parse(dataLoaded);
          const select = document.getElementById("legendSelect");
          select.options.length = 0;
          editLegends(notes[0].id, notes[0].name);
        } else {
          tip("Cannot load a file. Please check the data format")
        }
      };
      fileReader.readAsText(fileToLoad, "UTF-8");
    });

    // remove the legend item
    document.getElementById("legendRemove").addEventListener("click", function() {
      alertMessage.innerHTML = "Are you sure you want to remove the selected legend?";
      $("#alert").dialog({resizable: false, title: "Remove legend element",
        buttons: {
          Remove: function() {$(this).dialog("close"); removeLegend();},
          Keep: function() {$(this).dialog("close");}
        }
      });
    });

    function removeLegend() {
      let select = document.getElementById("legendSelect");
      let index = notes.findIndex(n => n.id === select.value);
      notes.splice(index, 1);
      select.options.length = 0;
      if (notes.length === 0) {
        $("#legendEditor").dialog("close");
        return;
      }
      editLegends(notes[0].id, notes[0].name);
    }

  }

  // Map scale and measurements editor
  function editScale() {
    $("#ruler").fadeIn();
    $("#scaleEditor").dialog({
      title: "Scale Editor",
      minHeight: "auto", width: "auto", resizable: false,
      position: {my: "center bottom", at: "center bottom-10", of: "svg"}
    });
  }

  // update only UI and sorting value in countryEditor screen
  function updateCountryPopulationUI(s) {
    if ($("#countriesEditor").is(":visible")) {
      const urban = rn(states[s].urbanPopulation * +urbanization.value * populationRate.value);
      const rural = rn(states[s].ruralPopulation * populationRate.value);
      const population = (urban + rural) * 1000;
      $("#state"+s).attr("data-population", population);
      $("#state"+s).children().filter(".statePopulation").val(si(population));
    }
  }

  // update dialogs if measurements are changed
  function updateCountryEditors() {
    if ($("#countriesEditor").is(":visible")) {editCountries();}
    if ($("#burgsEditor").is(":visible")) {
      const s = +$("#burgsEditor").attr("data-state");
      editBurgs(this, s);
    }
  }

  // remove drawn regions and draw all regions again
  function redrawRegions() {
    regions.selectAll("*").remove();
    borders.selectAll("path").remove();
    removeAllLabelsInGroup("countries");
    drawRegions();
  }

  // remove all labels in group including textPaths
  function removeAllLabelsInGroup(group) {
    labels.select("#"+group).selectAll("text").each(function() {
      defs.select("#textPath_" + this.id).remove();
      this.remove();
    });
    if (group !== "countries") {
      labels.select("#"+group).remove();
      updateLabelGroups();
    }
  }

  // restore keeped region / burgs / cultures data on edit heightmap completion
  function restoreRegions() {
    borders.selectAll("path").remove();
    removeAllLabelsInGroup("countries");
    manors.map(function(m) {
      const cell = diagram.find(m.x, m.y).index;
      if (cells[cell].height < 20) {
        // remove manor in ocean
        m.region = "removed";
        m.cell = cell;
        d3.selectAll("[data-id='" + m.i + "']").remove();
      } else {
        m.cell = cell;
        cells[cell].manor = m.i;
      }
    });
    cells.map(function(c) {
      if (c.height < 20) {
        // no longer a land cell
        delete c.region;
        delete c.culture;
        return;
      }
      if (c.region === undefined) {
        c.region = "neutral";
        if (states[states.length - 1].capital !== "neutral") {
          states.push({i: states.length, color: "neutral", capital: "neutral", name: "Neutrals"});
        }
      }
      if (c.culture === undefined) {
        const closest = cultureTree.find(c.data[0],c.data[1]);
        c.culture = cultureTree.data().indexOf(closest);
      }
    });
    states.map(function(s) {recalculateStateData(s.i);});
    drawRegions();
  }

  function regenerateCountries() {
    regions.selectAll("*").remove();
    const neutral = neutralInput.value = +countriesNeutral.value;
    manors.forEach(function(m) {
      if (m.region === "removed") return;
      let state = "neutral", closest = neutral;
      states.map(function(s) {
        if (s.capital === "neutral" || s.capital === "select") return;
        const c = manors[s.capital];
        let dist = Math.hypot(c.x - m.x, c.y - m.y) / s.power;
        if (cells[m.cell].fn !== cells[c.cell].fn) dist *= 3;
        if (dist < closest) {state = s.i; closest = dist;}
      });
      m.region = state;
      cells[m.cell].region = state;
    });

    defineRegions();
    const temp = regions.append("g").attr("id", "temp");
    land.forEach(function(l) {
      if (l.region === undefined) return;
      if (l.region === "neutral") return;
      const color = states[l.region].color;
      temp.append("path")
        .attr("data-cell", l.index).attr("data-state", l.region)
        .attr("d", "M" + polygons[l.index].join("L") + "Z")
        .attr("fill", color).attr("stroke", color);
    });
    const neutralCells = $.grep(cells, function(e) {return e.region === "neutral";});
    const last = states.length - 1;
    const type = states[last].color;
    if (type === "neutral" && !neutralCells.length) {
      // remove neutral line
      $("#state" + last).remove();
      states.splice(-1);
    }
    // recalculate data for all countries
    states.map(function(s) {
      recalculateStateData(s.i);
      $("#state"+s.i+" > .stateCells").text(s.cells);
      $("#state"+s.i+" > .stateBurgs").text(s.burgs);
      const area = rn(s.area * Math.pow(distanceScale.value, 2));
      const unit = areaUnit.value === "square" ? " " + distanceUnit.value + "²" : " " + areaUnit.value;
      $("#state"+s.i+" > .stateArea").text(si(area) + unit);
      const urban = rn(s.urbanPopulation * urbanization.value * populationRate.value);
      const rural = rn(s.ruralPopulation  * populationRate.value);
      const population = (urban + rural) * 1000;
      $("#state"+s.i+" > .statePopulation").val(si(population));
      $("#state"+s.i).attr("data-cells", s.cells).attr("data-burgs", s.burgs)
        .attr("data-area", area).attr("data-population", population);
    });
    if (type !== "neutral" && neutralCells.length) {
      // add neutral line
      states.push({i: states.length, color: "neutral", capital: "neutral", name: "Neutrals"});
      recalculateStateData(states.length - 1);
      editCountries();
    }
  }

  // enter state edit mode
  function mockRegions() {
    if (grid.style("display") !== "inline") {toggleGrid.click();}
    if (labels.style("display") !== "none") {toggleLabels.click();}
    stateBorders.selectAll("*").remove();
    neutralBorders.selectAll("*").remove();
  }

  // handle DOM elements sorting on header click
  $(".sortable").on("click", function() {
    const el = $(this);
    // remove sorting for all siglings except of clicked element
    el.siblings().removeClass("icon-sort-name-up icon-sort-name-down icon-sort-number-up icon-sort-number-down");
    const type = el.hasClass("alphabetically") ? "name" : "number";
    let state = "no";
    if (el.is("[class*='down']")) {state = "asc";}
    if (el.is("[class*='up']")) {state = "desc";}
    const sortby = el.attr("data-sortby");
    const list = el.parent().next(); // get list container element (e.g. "countriesBody")
    const lines = list.children("div"); // get list elements
    if (state === "no" || state === "asc") { // sort desc
      el.removeClass("icon-sort-" + type + "-down");
      el.addClass("icon-sort-" + type + "-up");
      lines.sort(function(a, b) {
        let an = a.getAttribute("data-" + sortby);
        if (an === "bottom") {return 1;}
        let bn = b.getAttribute("data-" + sortby);
        if (bn === "bottom") {return -1;}
        if (type === "number") {an = +an; bn = +bn;}
        if (an > bn) {return 1;}
        if (an < bn) {return -1;}
        return 0;
      });
    }
    if (state === "desc") { // sort asc
      el.removeClass("icon-sort-" + type + "-up");
      el.addClass("icon-sort-" + type + "-down");
      lines.sort(function(a, b) {
        let an = a.getAttribute("data-" + sortby);
        if (an === "bottom") {return 1;}
        let bn = b.getAttribute("data-" + sortby);
        if (bn === "bottom") {return -1;}
        if (type === "number") {an = +an; bn = +bn;}
        if (an < bn) {return 1;}
        if (an > bn) {return -1;}
        return 0;
      });
    }
    lines.detach().appendTo(list);
  });

  // load text file with new burg names
  $("#burgsListToLoad").change(function() {
    const fileToLoad = this.files[0];
    this.value = "";
    const fileReader = new FileReader();
    fileReader.onload = function(fileLoadedEvent) {
      const dataLoaded = fileLoadedEvent.target.result;
      const data = dataLoaded.split("\r\n");
      if (data.length === 0) {return;}
      let change = [];
      let message = `Burgs will be renamed as below. Please confirm`;
      message += `<div class="overflow-div"><table class="overflow-table"><tr><th>Id</th><th>Current name</th><th>New Name</th></tr>`;
      for (let i=0; i < data.length && i < manors.length; i++) {
        const v = data[i];
        if (v === "" || v === undefined) {continue;}
        if (v === manors[i].name) {continue;}
        change.push({i, name: v});
        message += `<tr><td style="width:20%">${i}</td><td style="width:40%">${manors[i].name}</td><td style="width:40%">${v}</td></tr>`;
      }
      message += `</tr></table></div>`;
      alertMessage.innerHTML = message;
      $("#alert").dialog({title: "Burgs bulk renaming", position: {my: "center", at: "center", of: "svg"},
        buttons: {
          Cancel: function() {$(this).dialog("close");},
          Confirm: function() {
            for (let i=0; i < change.length; i++) {
              const id = change[i].i;
              manors[id].name = change[i].name;
              labels.select("[data-id='" + id + "']").text(change[i].name);
            }
            $(this).dialog("close");
            updateCountryEditors();
          }
        }
      });
    };
    fileReader.readAsText(fileToLoad, "UTF-8");
  });

  // just apply map size that was already set, apply graph size!
  function applyMapSize() {
    svgWidth = graphWidth = +mapWidthInput.value;
    svgHeight = graphHeight = +mapHeightInput.value;
    svg.attr("width", svgWidth).attr("height", svgHeight);
    // set extent to map borders + 100px to get infinity world reception
    voronoi = d3.voronoi().extent([[-1, -1],[graphWidth+1, graphHeight+1]]);
    zoom.translateExtent([[0, 0],[graphWidth, graphHeight]]).scaleExtent([1, 20]).scaleTo(svg, 1);
    viewbox.attr("transform", null);
    ocean.selectAll("rect").attr("x", 0).attr("y", 0).attr("width", graphWidth).attr("height", graphHeight);
  }

  // change svg size on manual size change or window resize, do not change graph size
  function changeMapSize() {
    fitScaleBar();
    svgWidth = +mapWidthInput.value;
    svgHeight = +mapHeightInput.value;
    svg.attr("width", svgWidth).attr("height", svgHeight);
    const width = Math.max(svgWidth, graphWidth);
    const height = Math.max(svgHeight, graphHeight);
    zoom.translateExtent([[0, 0],[width, height]]);
    svg.select("#ocean").selectAll("rect").attr("x", 0)
      .attr("y", 0).attr("width", width).attr("height", height);
  }

  // fit full-screen map if window is resized
  $(window).resize(function(e) {
    // trick to prevent resize on download bar opening
    if (autoResize === false) return;
    mapWidthInput.value = window.innerWidth;
    mapHeightInput.value = window.innerHeight;
    changeMapSize();
  });

  // fit ScaleBar to map size
  function fitScaleBar() {
    const el = d3.select("#scaleBar");
    if (!el.select("rect").size()) return;
    const bbox = el.select("rect").node().getBBox();
    let tr = [svgWidth - bbox.width, svgHeight - (bbox.height - 10)];
    if (sessionStorage.getItem("scaleBar")) {
      const scalePos = sessionStorage.getItem("scaleBar").split(",");
      tr = [+scalePos[0] - bbox.width, +scalePos[1] - bbox.height];
    }
    el.attr("transform", "translate(" + rn(tr[0]) + "," + rn(tr[1]) + ")");
  }

  // restore initial style
  function applyDefaultStyle() {
    viewbox.on("touchmove mousemove", moved);
    landmass.attr("opacity", 1).attr("fill", "#eef6fb");
    coastline.attr("opacity", .5).attr("stroke", "#1f3846").attr("stroke-width", .7).attr("filter", "url(#dropShadow)");
    regions.attr("opacity", .4);
    stateBorders.attr("opacity", .8).attr("stroke", "#56566d").attr("stroke-width", .7).attr("stroke-dasharray", "1.2 1.5").attr("stroke-linecap", "butt");
    neutralBorders.attr("opacity", .8).attr("stroke", "#56566d").attr("stroke-width", .5).attr("stroke-dasharray", "1 1.5").attr("stroke-linecap", "butt");
    cults.attr("opacity", .6);
    rivers.attr("opacity", 1).attr("fill", "#5d97bb");
    lakes.attr("opacity", .5).attr("fill", "#a6c1fd").attr("stroke", "#5f799d").attr("stroke-width", .7);
    icons.selectAll("g").attr("opacity", 1).attr("fill", "#ffffff").attr("stroke", "#3e3e4b");
    roads.attr("opacity", .9).attr("stroke", "#d06324").attr("stroke-width", .35).attr("stroke-dasharray", "1.5").attr("stroke-linecap", "butt");
    trails.attr("opacity", .9).attr("stroke", "#d06324").attr("stroke-width", .15).attr("stroke-dasharray", ".8 1.6").attr("stroke-linecap", "butt");
    searoutes.attr("opacity", .8).attr("stroke", "#ffffff").attr("stroke-width", .35).attr("stroke-dasharray", "1 2").attr("stroke-linecap", "round");
    grid.attr("opacity", 1).attr("stroke", "#808080").attr("stroke-width", .1);
    ruler.attr("opacity", 1).style("display", "none").attr("filter", "url(#dropShadow)");
    overlay.attr("opacity", .8).attr("stroke", "#808080").attr("stroke-width", .5);
    markers.attr("filter", "url(#dropShadow01)");

    // ocean style
    svg.style("background-color", "#000000");
    ocean.attr("opacity", 1);
    oceanLayers.select("rect").attr("fill", "#53679f");
    oceanLayers.attr("filter", "");
    oceanPattern.attr("opacity", 1);
    oceanLayers.selectAll("path").attr("display", null);
    styleOceanPattern.checked = true;
    styleOceanLayers.checked = true;

    labels.attr("opacity", 1).attr("stroke", "#3a3a3a").attr("stroke-width", 0);
    let size = rn(8 - regionsInput.value / 20);
    if (size < 3) size = 3;
    burgLabels.select("#capitals").attr("fill", "#3e3e4b").attr("opacity", 1).attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC").attr("font-size", size).attr("data-size", size);
    burgLabels.select("#towns").attr("fill", "#3e3e4b").attr("opacity", 1).attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC").attr("font-size", 3).attr("data-size", 4);
    burgIcons.select("#capitals").attr("size", 1).attr("stroke-width", .24).attr("fill", "#ffffff").attr("stroke", "#3e3e4b").attr("fill-opacity", .7).attr("stroke-opacity", 1).attr("opacity", 1);
    burgIcons.select("#towns").attr("size", .5).attr("stroke-width", .12).attr("fill", "#ffffff").attr("stroke", "#3e3e4b").attr("fill-opacity", .7).attr("stroke-opacity", 1).attr("opacity", 1);
    size = rn(16 - regionsInput.value / 6);
    if (size < 6) size = 6;
    labels.select("#countries").attr("fill", "#3e3e4b").attr("opacity", 1).attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC").attr("font-size", size).attr("data-size", size);
    icons.select("#capital-anchors").attr("fill", "#ffffff").attr("stroke", "#3e3e4b").attr("stroke-width", 1.2).attr("size", 2);
    icons.select("#town-anchors").attr("fill", "#ffffff").attr("stroke", "#3e3e4b").attr("stroke-width", 1.2).attr("size", 1);
  }

  // Style options
  $("#styleElementSelect").on("change", function() {
    const sel = this.value;
    let el = viewbox.select("#"+sel);
    if (sel == "ocean") el = oceanLayers.select("rect");
    $("#styleInputs > div").hide();

    // opacity
    $("#styleOpacity, #styleFilter").css("display", "block");
    const opacity = el.attr("opacity") || 1;
    styleOpacityInput.value = styleOpacityOutput.value = opacity;

    // filter
    if (sel == "ocean") el = oceanLayers;
    styleFilterInput.value = el.attr("filter") || "";
    if (sel === "rivers" || sel === "lakes" || sel === "landmass") {
      $("#styleFill").css("display", "inline-block");
      styleFillInput.value = styleFillOutput.value = el.attr("fill");
    }

    if (sel === "roads" || sel === "trails" || sel === "searoutes" || sel === "lakes" || sel === "stateBorders" || sel === "neutralBorders" || sel === "grid" || sel === "overlay" || sel === "coastline") {
      $("#styleStroke").css("display", "inline-block");
      styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke");
      $("#styleStrokeWidth").css("display", "block");
      const width = el.attr("stroke-width") || "";
      styleStrokeWidthInput.value = styleStrokeWidthOutput.value = width;
    }

    if (sel === "roads" || sel === "trails" || sel === "searoutes" || sel === "stateBorders" || sel === "neutralBorders" || sel === "overlay") {
      $("#styleStrokeDasharray, #styleStrokeLinecap").css("display", "block");
      styleStrokeDasharrayInput.value = el.attr("stroke-dasharray") || "";
      styleStrokeLinecapInput.value = el.attr("stroke-linecap") || "inherit";
    }

    if (sel === "terrs") $("#styleScheme").css("display", "block");
    if (sel === "heightmap") $("#styleScheme").css("display", "block");
    if (sel === "overlay") $("#styleOverlay").css("display", "block");

    if (sel === "labels") {
      $("#styleFill, #styleStroke, #styleStrokeWidth, #styleFontSize").css("display", "inline-block");
      styleFillInput.value = styleFillOutput.value = el.select("g").attr("fill") || "#3e3e4b";
      styleStrokeInput.value = styleStrokeOutput.value = el.select("g").attr("stroke") || "#3a3a3a";
      styleStrokeWidthInput.value = styleStrokeWidthOutput.value = el.attr("stroke-width") || 0;
      $("#styleLabelGroups").css("display", "inline-block");
      updateLabelGroups();
    }

    if (sel === "ocean") {
      $("#styleOcean").css("display", "block");
      styleOceanBack.value = styleOceanBackOutput.value = svg.style("background-color");
      styleOceanFore.value = styleOceanForeOutput.value = oceanLayers.select("rect").attr("fill");
    }
  });

  // update Label Groups displayed on Style tab
  function updateLabelGroups() {
    if (styleElementSelect.value !== "labels") return;
    const cont = d3.select("#styleLabelGroupItems");
    cont.selectAll("button").remove();
    labels.selectAll("g").each(function() {
      const el = d3.select(this);
      const id = el.attr("id");
      const name = id.charAt(0).toUpperCase() + id.substr(1);
      const state = el.classed("hidden");
      if (id === "burgLabels") return;
      cont.append("button").attr("id", id).text(name).classed("buttonoff", state).on("click", function() {
        // toggle label group on click
        if (hideLabels.checked) hideLabels.click();
        const el = d3.select("#"+this.id);
        const state = !el.classed("hidden");
        el.classed("hidden", state);
        d3.select(this).classed("buttonoff", state);
      });
    });
  }

  $("#styleFillInput").on("input", function() {
    styleFillOutput.value = this.value;
    const el = svg.select("#" + styleElementSelect.value);
    if (styleElementSelect.value !== "labels") {
      el.attr('fill', this.value);
    } else {
      el.selectAll("g").attr('fill', this.value);
    }
  });

  $("#styleStrokeInput").on("input", function() {
    styleStrokeOutput.value = this.value;
    const el = svg.select("#"+styleElementSelect.value);
    el.attr('stroke', this.value);
  });

  $("#styleStrokeWidthInput").on("input", function() {
    styleStrokeWidthOutput.value = this.value;
    const el = svg.select("#"+styleElementSelect.value);
    el.attr('stroke-width', +this.value);
  });

  $("#styleStrokeDasharrayInput").on("input", function() {
    const sel = styleElementSelect.value;
    svg.select("#"+sel).attr('stroke-dasharray', this.value);
  });

  $("#styleStrokeLinecapInput").on("change", function() {
    const sel = styleElementSelect.value;
    svg.select("#"+sel).attr('stroke-linecap', this.value);
  });

  $("#styleOpacityInput").on("input", function() {
    styleOpacityOutput.value = this.value;
    const sel = styleElementSelect.value;
    svg.select("#"+sel).attr('opacity', this.value);

  });

  $("#styleFilterInput").on("change", function() {
    let sel = styleElementSelect.value;
    if (sel == "ocean") sel = "oceanLayers";
    const el = svg.select("#"+sel);
    el.attr('filter', this.value);
    zoom.scaleBy(svg, 1.00001); // enforce browser re-draw
  });

  $("#styleSchemeInput").on("change", function() {
    terrs.selectAll("path").remove();
    toggleHeight();
  });

  $("#styleOverlayType").on("change", function() {
    overlay.selectAll("*").remove();
    if (!$("#toggleOverlay").hasClass("buttonoff")) toggleOverlay();
  });

  $("#styleOverlaySize").on("change", function() {
    overlay.selectAll("*").remove();
    if (!$("#toggleOverlay").hasClass("buttonoff")) toggleOverlay();
    styleOverlaySizeOutput.value = this.value;
  });

  function calculateFriendlyOverlaySize() {
    let size = styleOverlaySize.value;
    if (styleOverlayType.value === "windrose") {styleOverlaySizeFriendly.innerHTML = ""; return;}
    if (styleOverlayType.value === "pointyHex" || styleOverlayType.value === "flatHex") size *= Math.cos(30 * Math.PI / 180) * 2;
    let friendly = "(" + rn(size * distanceScale.value) + " " + distanceUnit.value + ")";
    styleOverlaySizeFriendly.value = friendly;
  }

  $("#styleOceanBack").on("input", function() {
    svg.style("background-color", this.value);
    styleOceanBackOutput.value = this.value;
  });

  $("#styleOceanFore").on("input", function() {
    oceanLayers.select("rect").attr("fill", this.value);
    styleOceanForeOutput.value = this.value;
  });

  $("#styleOceanPattern").on("click", function() {oceanPattern.attr("opacity", +this.checked);});

  $("#styleOceanLayers").on("click", function() {
    const display = this.checked ? "block" : "none";
    oceanLayers.selectAll("path").attr("display", display);
  });

  // Other Options handlers
  $("input, select").on("input change", function() {
    const id = this.id;
    if (id === "hideLabels") invokeActiveZooming();
    if (id === "mapWidthInput" || id === "mapHeightInput") {
      changeMapSize();
      autoResize = false;
      localStorage.setItem("mapWidth", mapWidthInput.value);
      localStorage.setItem("mapHeight", mapHeightInput.value);
    }
    if (id === "sizeInput") {
      graphSize = sizeOutput.value = +this.value;
      if (graphSize === 3) {sizeOutput.style.color = "red";}
      if (graphSize === 2) {sizeOutput.style.color = "yellow";}
      if (graphSize === 1) {sizeOutput.style.color = "green";}
      // localStorage.setItem("graphSize", this.value); - temp off to always start with size 1
    }
    if (id === "templateInput") {localStorage.setItem("template", this.value);}
    if (id === "manorsInput") {manorsOutput.value = this.value; localStorage.setItem("manors", this.value);}
    if (id === "regionsInput") {
      regionsOutput.value = this.value;
      let size = rn(6 - this.value / 20);
      if (size < 3) {size = 3;}
      burgLabels.select("#capitals").attr("data-size", size);
      size = rn(18 - this.value / 6);
      if (size < 4) {size = 4;}
      labels.select("#countries").attr("data-size", size);
      localStorage.setItem("regions", this.value);
    }
    if (id === "powerInput") {powerOutput.value = this.value; localStorage.setItem("power", this.value);}
    if (id === "neutralInput") {neutralOutput.value = countriesNeutral.value = this.value; localStorage.setItem("neutal", this.value);}
    if (id === "culturesInput") {culturesOutput.value = this.value; localStorage.setItem("cultures", this.value);}
    if (id === "precInput") {precOutput.value = +precInput.value; localStorage.setItem("prec", this.value);}
    if (id === "swampinessInput") {swampinessOutput.value = this.value; localStorage.setItem("swampiness", this.value);}
    if (id === "outlineLayersInput") localStorage.setItem("outlineLayers", this.value);
    if (id === "transparencyInput") changeDialogsTransparency(this.value);
    if (id === "pngResolutionInput") localStorage.setItem("pngResolution", this.value);
    if (id === "zoomExtentMin" || id === "zoomExtentMax") {
      zoom.scaleExtent([+zoomExtentMin.value, +zoomExtentMax.value]);
      zoom.scaleTo(svg, +this.value);
    }

    if (id === "convertOverlay") {canvas.style.opacity = convertOverlayValue.innerHTML = +this.value;}
    if (id === "populationRate") {
      populationRateOutput.value = si(+populationRate.value * 1000);
      updateCountryEditors();
    }
    if (id === "urbanization") {
      urbanizationOutput.value = this.value;
      updateCountryEditors();
    }
    if (id === "distanceUnit" || id === "distanceScale" || id === "areaUnit") {
      const dUnit = distanceUnit.value;
      if (id === "distanceUnit" && dUnit === "custom_name") {
        const custom = prompt("Provide a custom name for distance unit");
        if (custom) {
          const opt = document.createElement("option");
          opt.value = opt.innerHTML = custom;
          distanceUnit.add(opt);
          distanceUnit.value = custom;
        } else {
          this.value = "km"; return;
        }
      }
      const scale = distanceScale.value;
      scaleOutput.value = scale + " " + dUnit;
      ruler.selectAll("g").each(function() {
        let label;
        const g = d3.select(this);
        const area = +g.select("text").attr("data-area");
        if (area) {
          const areaConv = area * Math.pow(scale, 2); // convert area to distanceScale
          let unit = areaUnit.value;
          if (unit === "square") {unit = dUnit + "²"} else {unit = areaUnit.value;}
          label = si(areaConv) + " " + unit;
        } else {
          const dist = +g.select("text").attr("data-dist");
          label = rn(dist * scale) + " " + dUnit;
        }
        g.select("text").text(label);
      });
      ruler.selectAll(".gray").attr("stroke-dasharray", rn(30 / scale, 2));
      drawScaleBar();
      updateCountryEditors();
    }
    if (id === "barSize") {
      barSizeOutput.innerHTML = this.value;
      $("#scaleBar").removeClass("hidden");
      drawScaleBar();
    }
    if (id === "barLabel") {
      $("#scaleBar").removeClass("hidden");
      drawScaleBar();
    }
    if (id === "barBackOpacity" || id === "barBackColor") {
      d3.select("#scaleBar > rect")
        .attr("opacity", +barBackOpacity.value)
        .attr("fill", barBackColor.value);
      $("#scaleBar").removeClass("hidden");
    }
  });

  $("#scaleOutput").change(function() {
    if (this.value === "" || isNaN(+this.value) || this.value < 0.01 || this.value > 10) {
      tip("Manually entered distance scale should be a number in a [0.01; 10] range");
      this.value = distanceScale.value + " " + distanceUnit.value;
      return;
    }
    distanceScale.value = +this.value;
    scaleOutput.value = this.value + " " + distanceUnit.value;
    updateCountryEditors();
  });

  $("#populationRateOutput").change(function() {
    if (this.value === "" || isNaN(+this.value) || this.value < 0.001 || this.value > 10) {
      tip("Manually entered population rate should be a number in a [0.001; 10] range");
      this.value = si(populationRate.value * 1000);
      return;
    }
    populationRate.value = +this.value;
    populationRateOutput.value = si(this.value * 1000);
    updateCountryEditors();
  });

  $("#urbanizationOutput").change(function() {
    if (this.value === "" || isNaN(+this.value) || this.value < 0 || this.value > 10) {
      tip("Manually entered urbanization rate should be a number in a [0; 10] range");
      this.value = urbanization.value;
      return;
    }
    const val = parseFloat(+this.value);
    if (val > 2) urbanization.setAttribute("max", val);
    urbanization.value = urbanizationOutput.value = val;
    updateCountryEditors();
  });


  // lock manually changed option to restrict it randomization
  $("#optionsContent input, #optionsContent select").change(function() {
    const icon = "lock" + this.id.charAt(0).toUpperCase() + this.id.slice(1);
    const el = document.getElementById(icon);
    if (!el) return;
    el.setAttribute("data-locked", 1);
    el.className = "icon-lock";
  });

  $("#optionsReset").click(restoreDefaultOptions);

  $("#rescaler").change(function() {
      const change = rn((+this.value - 5), 2);
      modifyHeights("all", change, 1);
      updateHeightmap();
      updateHistory();
      rescaler.value = 5;
  });

  $("#layoutPreset").on("change", function() {
    const preset = this.value;
    $("#mapLayers li").not("#toggleOcean").addClass("buttonoff");
    $("#toggleOcean").removeClass("buttonoff");
    $("#oceanPattern").fadeIn();
    $("#rivers, #terrain, #borders, #regions, #icons, #labels, #routes, #grid, #markers").fadeOut();
    cults.selectAll("path").remove();
    terrs.selectAll("path").remove();
    if (preset === "layoutPolitical") {
      toggleRivers.click();
      toggleRelief.click();
      toggleBorders.click();
      toggleCountries.click();
      toggleIcons.click();
      toggleLabels.click();
      toggleRoutes.click();
      toggleMarkers.click();
    }
    if (preset === "layoutCultural") {
      toggleRivers.click();
      toggleRelief.click();
      toggleBorders.click();
      $("#toggleCultures").click();
      toggleIcons.click();
      toggleLabels.click();
      toggleMarkers.click();
    }
    if (preset === "layoutHeightmap") {
      $("#toggleHeight").click();
      toggleRivers.click();
    }
  });

  // UI Button handlers
  $(".tab > button").on("click", function() {
    $(".tabcontent").hide();
    $(".tab > button").removeClass("active");
    $(this).addClass("active");
    const id = this.id;
    if (id === "layoutTab") {$("#layoutContent").show();}
    if (id === "styleTab") {$("#styleContent").show();}
    if (id === "optionsTab") {$("#optionsContent").show();}
    if (id === "customizeTab") {$("#customizeContent").show();}
    if (id === "aboutTab") {$("#aboutContent").show();}
  });

  // re-load page with provided seed
  $("#optionsSeedGenerate").on("click", function() {
    if (optionsSeed.value == seed) return;
    seed = optionsSeed.value;
    const url = new URL(window.location.href);
    window.location.href = url.pathname + "?seed=" + seed;
  });

  // Pull request from @evyatron
  // https://github.com/Azgaar/Fantasy-Map-Generator/pull/49
  function addDragToUpload() {
    document.addEventListener('dragover', function(e) {
        e.stopPropagation();
        e.preventDefault();
        $('#map-dragged').show();
    });

    document.addEventListener('dragleave', function(e) {
        $('#map-dragged').hide();
    });

    document.addEventListener('drop', function(e) {
      e.stopPropagation();
      e.preventDefault();
      $('#map-dragged').hide();
      // no files or more than one
      if (e.dataTransfer.items == null || e.dataTransfer.items.length != 1) {return;}
      const file = e.dataTransfer.items[0].getAsFile();
      // not a .map file
      if (file.name.indexOf('.map') == -1) {
        alertMessage.innerHTML = 'Please upload a <b>.map</b> file you have previously downloaded';
        $("#alert").dialog({
          resizable: false, title: "Invalid file format",
          width: 400, buttons: {
            Close: function() { $(this).dialog("close"); }
          }, position: {my: "center", at: "center", of: "svg"}
        });
        return;
      }
      // all good - show uploading text and load the map
      $("#map-dragged > p").text("Uploading<span>.</span><span>.</span><span>.</span>");
      uploadFile(file, function onUploadFinish() {
        $("#map-dragged > p").text("Drop to upload");
      });
    });
  }


function tip(tip, main, error) {
  const tooltip = d3.select("#tooltip");
  const reg = "linear-gradient(0.1turn, #ffffff00, #5e5c5c4d, #ffffff00)";
  const red = "linear-gradient(0.1turn, #ffffff00, #c71d1d66, #ffffff00)";
  tooltip.text(tip).style("background", error ? red : reg);
  if (main) tooltip.attr("data-main", tip);
}

window.tip = tip;

$("#optionsContainer *").on("mouseout", function() {
  tooltip.innerHTML = tooltip.getAttribute("data-main");
});
