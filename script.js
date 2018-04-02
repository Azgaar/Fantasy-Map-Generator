// Fantasy Map Generator main script
"use strict;"
fantasyMap();
function fantasyMap() {
  // Version control
  var version = "0.55b";
  document.title += " v. " + version;

  // Declare variables
  var svg = d3.select("svg"),
    defs = svg.select("#deftemp"),
    viewbox = svg.append("g").attr("id", "viewbox"),
    ocean = viewbox.append("g").attr("id", "ocean"),
    oceanLayers = ocean.append("g").attr("id", "oceanLayers"),
    oceanPattern = ocean.append("g").attr("id", "oceanPattern"),
    landmass = viewbox.append("g").attr("id", "landmass"),
    terrs = viewbox.append("g").attr("id", "terrs"),
    grid = viewbox.append("g").attr("id", "grid"),
    overlay = viewbox.append("g").attr("id", "overlay"),
    cults = viewbox.append("g").attr("id", "cults"),
    routes = viewbox.append("g").attr("id", "routes"),
    roads = routes.append("g").attr("id", "roads"),
    trails = routes.append("g").attr("id", "trails"),
    rivers = viewbox.append("g").attr("id", "rivers"),
    terrain = viewbox.append("g").attr("id", "terrain"),
    regions = viewbox.append("g").attr("id", "regions"),
    borders = viewbox.append("g").attr("id", "borders"),
    stateBorders = borders.append("g").attr("id", "stateBorders"),
    neutralBorders = borders.append("g").attr("id", "neutralBorders"),
    coastline = viewbox.append("g").attr("id", "coastline"),
    lakes = viewbox.append("g").attr("id", "lakes"),
    searoutes = routes.append("g").attr("id", "searoutes"),
    labels = viewbox.append("g").attr("id", "labels"),
    icons = viewbox.append("g").attr("id", "icons"),
    burgs = icons.append("g").attr("id", "burgs"),
    ruler = viewbox.append("g").attr("id", "ruler"),
    debug = viewbox.append("g").attr("id", "debug");
    capitals = labels.append("g").attr("id", "capitals"),
    towns = labels.append("g").attr("id", "towns"),
    countries = labels.append("g").attr("id", "countries"),
    addedLabels = labels.append("g").attr("id", "addedLabels");    

  // Common variables
  var mapWidth, mapHeight,
    customization, history = [], historyStage = -1, elSelected, 
    cells = [], land = [], riversData = [],  manors = [], states = [],
    queue = [], chain = {}, island = 0, cultureTree, manorTree, shift = false;

  // default fonts
  var fonts = ["Amatic+SC:700", "Georgia", "Times New Roman", "Arial", "Comic Sans MS", "Lucida Sans Unicode", "Verdana", "Courier New"];

  // canvas
  var canvas = document.getElementById("canvas"),
    ctx = canvas.getContext("2d");    

  // Color schemes;
  var color = d3.scaleSequential(d3.interpolateSpectral),
      colors8 = d3.scaleOrdinal(d3.schemeSet2),
      colors20 = d3.scaleOrdinal(d3.schemeCategory20);
    
  // randomize options
  var graphSize = +sizeInput.value,
    manorsCount = manorsOutput.innerHTML = +manorsInput.value,
    capitalsCount = regionsOutput.innerHTML = +regionsInput.value,
    neutral = countriesNeutral.value = +neutralInput.value,
    swampiness = +swampinessInput.value,
    sharpness = +sharpnessInput.value,
    precipitation = +precInput.value;

  // Get screen size
  if (localStorage.getItem("screenSize")) {
    var stored = localStorage.getItem("screenSize").split(",");
    mapWidthInput.value = +stored[0];
    mapHeightInput.value = +stored[1];
    $(".fullscreen").removeClass("fullscreen");
    $("#mapScreenSize").addClass("icon-resize-full-alt").removeClass("icon-resize-small");
  } else {
    mapWidthInput.value = $(window).width();
    mapHeightInput.value = $(window).height();    
  }
  applyMapSize();

  // append ocean pattern
  oceanPattern.append("rect").attr("x", 0).attr("y", 0).attr("width", mapWidth).attr("height", mapHeight).attr("fill", "url(#oceanPattern)").attr("stroke", "none");
  oceanLayers.append("rect").attr("x", 0).attr("y", 0).attr("width", mapWidth).attr("height", mapHeight).attr("id", "oceanBase");

  applyDefaultStyle();
  
  // toggle off loading screen and on menus
  $("#loading").remove();
  $("#statusbar").css("top", mapHeight - 20).show();
  $("#optionsContainer").show();
 
  // D3 Line generator
  var scX = d3.scaleLinear().domain([0, mapWidth]).range([0, mapWidth]),
    scY = d3.scaleLinear().domain([0, mapHeight]).range([0, mapHeight]),
    lineGen = d3.line().x(function(d) {return scX(d.scX);}).y(function(d) {return scY(d.scY);});

  // main data variables
  var voronoi = d3.voronoi().extent([[0, 0], [mapWidth, mapHeight]]);
  var diagram, polygons, points = [], sample;

  // D3 drag and zoom behavior
  var scale = 1, viewX = 0, viewY = 0;
  var zoom = d3.zoom().scaleExtent([1, 40]) // 40x is default max zoom
    .translateExtent([[0, 0], [mapWidth, mapHeight]]) // 0,0 as default extent
    .on("zoom", zoomed);
  svg.call(zoom);
  
  $("#optionsContainer").draggable({handle: ".drag-trigger", snap: "svg", snapMode: "both"});
  $("#mapLayers").sortable({items: "li:not(.solid)", cancel: ".solid", update: moveLayer});
  $("#templateBody").sortable({items: "div:not(div[data-type='Mountain'])"});
  $("#mapLayers, #templateBody").disableSelection();
   
  var drag = d3.drag()
    .container(function() {return this;})
    .subject(function() {var p=[d3.event.x, d3.event.y]; return [p, p];})
    .on("start", dragstarted);
  
  function zoomed() {
    var scaleDiff = Math.abs(scale - d3.event.transform.k);
    scale = d3.event.transform.k;
    viewX = d3.event.transform.x;
    viewY = d3.event.transform.y;
    viewbox.attr("transform", d3.event.transform);
    // rescale only if zoom is significally changed
    if (scaleDiff > 0.0001) {
      invokeActiveZooming();
      drawScaleBar();
    }
  }

  // Active zooming
  function invokeActiveZooming() {
    // toggle shade/blur filter on zoom
    var filter = scale > 2.6 ? "url(#blurFilter)" : "url(#dropShadow)";
    if (scale > 1.5 && scale <= 2.6) {filter = null;}
    coastline.attr("filter", filter);
    // rescale lables on zoom (active zooming)
    labels.selectAll("g").each(function(d) {
      var el = d3.select(this);
      var desired = +el.attr("data-size");
      var relative = rn((desired + (desired / scale)) / 2, 2);
      el.attr("font-size", relative);
      var size = +el.attr("font-size");
      if ($("#activeZooming").hasClass("icon-eye-off") && size * scale < 6) {
        el.classed("hidden", true);
      } else {
        el.classed("hidden", false)
      }
    });
    if (ruler.size()) {
      if (ruler.style("display") !== "none") {
        if (ruler.selectAll("g").size() < 1) {return;}
        var factor = rn(1 / Math.pow(scale, 0.3), 1);
        ruler.selectAll("circle:not(.center)").attr("r", 2 * factor).attr("stroke-width", 0.5 * factor);
        ruler.selectAll("circle.center").attr("r", 1.2 * factor).attr("stroke-width", 0.3 * factor);
        ruler.selectAll("text").attr("font-size", 10 * factor);
        ruler.selectAll("line, path").attr("stroke-width", factor);
      }      
    }
  }

  // Manually update viewbox
  function zoomUpdate(duration) {
    var duration = duration || 0;
    var transform = d3.zoomIdentity.translate(viewX, viewY).scale(scale);
    svg.transition().duration(duration).call(zoom.transform, transform);
  }

  // Zoom to specific point (x,y - coods, z - scale, d - duration)
  function zoomTo(x, y, z, d) {
    var transform = d3.zoomIdentity.translate(x * -z + mapWidth / 2, y * -z + mapHeight / 2).scale(z);
    svg.transition().duration(d).call(zoom.transform, transform);    
  }
  
  // Reset zoom to initial with some duration
  function resetZoom(duration) {
    svg.transition().duration(duration).call(zoom.transform, d3.zoomIdentity);
  }

  // Changelog dialog window
  var storedVersion = localStorage.getItem("version"); // show message on load
  if (storedVersion != version) {
    var message = "2018-03-30: The <i>Fantasy Map Generator</i> Demo is updated up to version " + version + ". Main features:<br><br>";
    message += "<li>Countries Editor: add, remove, change borders, export data etc.</li>";
    message += "<li>Burgs Editor: add, rename, remove, change population or capital</li>";
    message += "<li>Scale Editor: set distance, area and population scales</li>";
    message += "<li>Measurers: linear distance, curve length and area measurers</li>";
    message += "<li>Scale bar: toggable auto-rourded and auto-sized bar</li>";
    message += "<li>Overlays: hex grid, square grid, wind rose</li>";
    message += "<br><i>See ";
    message += "<a href='https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog' target='_blank'>changelog</a>";
    message += " for more details. Please report bugs ";
    message += "<a href='https://github.com/Azgaar/Fantasy-Map-Generator/issues' target='_blank'>here</a></i>";
    alertMessage.innerHTML = message;
    $("#alert").dialog(
      {resizable: false, title: "Fantasy Map Generator v. " + version, width: 400,
      buttons: {
        "Don't show again": function() {
          localStorage.setItem("version", version);
          $(this).dialog("close");            
        },
        Close: function() {$(this).dialog("close");}
      },
      position: {my: "center", at: "center", of: "svg"}
    });
  }
  
  generate(); // genarate map on load
  invokeActiveZooming(); // to hide what need to be hidden

  function generate() {
    console.group("Random map");
    console.time("TOTAL");
    applyMapSize();
    randomizeOptions();
    placePoints();
    calculateVoronoi(points);
    detectNeighbors();
    drawScaleBar();
    defineHeightmap();
    markFeatures();
    drawOcean();
    reGraph();
    resolveDepressions();
    flux();
    drawRelief();
    drawCoastline();
    manorsAndRegions();
    cleanData();
    console.timeEnd("TOTAL");
    console.groupEnd("Random map");
  }

  // randomize options if randomization is allowed in option
  function randomizeOptions() {
    if (randomizeInput.value !== "1") {return;}
    regionsInput.value = 7 + Math.floor(Math.random() * 10);
    manorsInput.value = regionsInput.value * 27 + Math.floor(Math.random() * 300);
    manorsCount = manorsOutput.innerHTML = manorsInput.value;
    capitalsCount = regionsOutput.innerHTML = regionsInput.value; 
    precInput.value = 10 + Math.floor(Math.random() * 15);
    precipitation = precOutput.value = +precInput.value;
  }

  // Locate points to calculate Voronoi diagram
  function placePoints() {
    console.time("placePoints");
    points = [];
    var radius = 5.9 / graphSize; // 5.9 is a radius to get 8k cells
    var sampler = poissonDiscSampler(mapWidth, mapHeight, radius);
    while (sample = sampler()) {
      var x = rn(sample[0], 2);
      var y = rn(sample[1], 2);
      points.push([x, y]);
    }
    console.timeEnd("placePoints");
  }

  // Calculate Voronoi Diagram
  function calculateVoronoi(points) {
    console.time("calculateVoronoi");
    diagram = voronoi(points),
    polygons = diagram.polygons();
    console.log(" cells: " + points.length);
    console.timeEnd("calculateVoronoi");
  }

  // Get cell info on mouse move (useful for debugging)
  function moved() {
    var point = d3.mouse(this);
    var i = diagram.find(point[0], point[1]).index;  
    if (i) {
      var p = cells[i]; // get cell
      $("#lx").text(rn(point[0]));
      $("#ly").text(rn(point[1]));
      $("#cell").text(i);
      $("#height").text(ifDefined(p.height, 2));
      $("#feature").text(ifDefined(p.feature) + "" + ifDefined(p.featureNumber)); // to support v. >0.54b
      $("#feature").text(ifDefined(p.f) + "" + ifDefined(p.fn));
    }
    // draw line for Customization range placing
    icons.selectAll(".line").remove();
    if (customization === 1 && icons.selectAll(".tag").size() === 1) {
      var x = +icons.select(".tag").attr("cx");
      var y = +icons.select(".tag").attr("cy");
      icons.insert("line", ":first-child").attr("class", "line").attr("x1", x).attr("y1", y).attr("x2", point[0]).attr("y2", point[1]);
    }
    // draw circle to show brush radius for Customization
    var circle = icons.selectAll(".circle");
    var brush = $("#brushesButtons .pressed");
    if (customization === 1 || customization === 2) {
      if (customization === 1 && (brush.length === 0 || brush.hasClass("feature"))) {circle.remove(); return;}
      if (customization === 2 && $("div.selected").length === 0) {circle.remove(); return;}
      var radius = customization === 1 ? brushRadius.value : countriesManuallyBrush.value; 
      var r = rn(6 / graphSize * radius, 1);
      if (circle.size() > 0) {circle.attr("r", r).attr("cx", point[0]).attr("cy", point[1]);}
      else {icons.insert("circle", ":first-child").attr("class", "circle").attr("r", r).attr("cx", point[0]).attr("cy", point[1]);}
    } else {circle.remove();}
  }

  // return value (e) if defined with specified number of decimals (f)
  function ifDefined(e, f) {
    if (e == undefined) {return "no";}
    if (f) {return e.toFixed(f);}
    return e;
  }  
  
  // Drag actions
  function dragstarted() {
    var x0 = d3.event.x, y0 = d3.event.y,
        c0 = diagram.find(x0, y0).index, c1 = c0;
    var x1, y1;
    var opisometer = $("#addOpisometer").hasClass("pressed");
    var planimeter = $("#addPlanimeter").hasClass("pressed");
    var factor = rn(1 / Math.pow(scale, 0.3), 1);
    if (opisometer || planimeter) {
      $("#ruler").show();
      var type = opisometer ? "opisometer" : "planimeter";
      var rulerNew = ruler.append("g").attr("class", type).call(d3.drag().on("start", elementDrag));
      var points = [{scX: rn(x0, 2), scY: rn(y0, 2)}];
      if (opisometer) {
        var title = 
        `Opisometer is an instrument for measuring the lengths of arbitrary curved lines.
        One dash shows 30 km (18.6 mi), approximate distance of a daily loaded march.
        Click on the label to remove the ruler from the map`;      
        rulerNew.append("title").text(title);
        var curve = rulerNew.append("path").attr("class", "opisometer white").attr("stroke-width", factor);
        var dash = rn(30 / distanceScale.value, 2);
        var curveGray = rulerNew.append("path").attr("class", "opisometer gray").attr("stroke-dasharray", dash).attr("stroke-width", factor);
      } else {
        var title = 
        `Planimeter is an instrument  to determine the area of a two-dimensional shape.
        Click on the label to remove the ruler from the map`;  
        rulerNew.append("title").text(title);
        var curve = rulerNew.append("path").attr("class", "planimeter").attr("stroke-width", factor);  
      }
      var text = rulerNew.append("text").attr("dy", -1).attr("font-size", 10 * factor);
    }
   
    d3.event.on("drag", function() {
      x1 = d3.event.x, y1 = d3.event.y;
      var c2 = diagram.find(x1, y1).index;
      // Heightmap customization
      if (customization === 1) {
        if (c2 !== c1) {
          c1 = c2;
          var brush = $("#brushesButtons .pressed").attr("id");
          var power = +brushPower.value;
          if (brush === "brushHill") {add(c2, "hill", power);}
          if (brush === "brushPit") {addPit(1, power, c2);}
          if (!$("#brushesButtons .pressed").hasClass("feature")) {
            // move a circle to show actual change radius
            var radius = +brushRadius.value;
            var r = rn(6 / graphSize * radius, 1);
            var circle = icons.selectAll(".circle");
            if (circle.size() > 0) {circle.attr("r", r).attr("cx", x1).attr("cy", y1);}
            else {icons.insert("circle", ":first-child").attr("class", "circle").attr("r", r).attr("cx", x1).attr("cy", y1);}
            updateCellsInRadius(c2, c0);
          }
        }
        mockHeightmap();
      }
      // Countries customization
      if (customization === 2 && $("div.selected").length) {
        // move a circle to show actual change radius
        var radius = +countriesManuallyBrush.value;
        var r = rn(6 / graphSize * radius, 1);
        var circle = icons.selectAll(".circle");
        if (circle.size() > 0) {circle.attr("r", r).attr("cx", x1).attr("cy", y1);}
        else {icons.insert("circle", ":first-child").attr("class", "circle").attr("r", r).attr("cx", x1).attr("cy", y1);}
        // define selection based on radius
        var selection = [c2];
        while (radius > 1) {
          var frontier = selection.slice();
          frontier.map(function(s) {
            cells[s].neighbors.forEach(function(e) {
              if (selection.indexOf(e) === -1) {selection.push(e);}
            });
          });
          radius--;
        }
        // change region within selection
        selection.map(function(c2) {
          if (cells[c2].height >= 0.2 && c2 !== c0) {
            var exists = regions.select("#temp").select("path[data-cell='"+c2+"']");
            if (exists.size()) {exists.remove();}
            var stateNew = +$("div.selected").attr("id").slice(5); // state
            if (states[stateNew].color === "neutral") {stateNew = "neutral";}
            var stateOld = cells[c2].region;
            if (stateNew !== stateOld) {
              var color = stateNew !== "neutral" ? states[stateNew].color : "white";
              if (stateOld !== "neutral") {
                if (cells[c2].manor !== states[stateOld].capital) {
                  regions.select("#temp").append("path")
                    .attr("data-cell", c2).attr("data-state", stateNew)
                    .attr("d", "M" + polygons[c2].join("L") + "Z")
                    .attr("fill", color).attr("stroke", color);
                }
              } else {
                regions.select("#temp").append("path")
                  .attr("data-cell", c2).attr("data-state", stateNew)
                  .attr("d", "M" + polygons[c2].join("L") + "Z")
                  .attr("fill", color).attr("stroke", color);
              }
            }
          }
        });
      }
      if (opisometer || planimeter) {
        var l = points[points.length - 1];
        var diff = Math.hypot(l.scX - x1, l.scY - y1);
        if (diff > 5) {points.push({scX: x1, scY: y1});}
        if (opisometer) {
          lineGen.curve(d3.curveBasis);
          var d = round(lineGen(points));
          curve.attr("d", d);
          curveGray.attr("d", d);
          var dist = rn(curve.node().getTotalLength());
          var label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
          text.attr("x", x1).attr("y", y1 - 10).text(label);
        } else {
          lineGen.curve(d3.curveBasisClosed);
          var d = round(lineGen(points));
          curve.attr("d", d);      
        }
      }
    });
    
    d3.event.on("end", function() {
      if (opisometer || planimeter) {
        $("#addOpisometer, #addPlanimeter").removeClass("pressed");
        viewbox.style("cursor", "default").on(".drag", null);
        if (opisometer) {
          var dist = rn(curve.node().getTotalLength());
          var c = curve.node().getPointAtLength(dist / 2);
          var p = curve.node().getPointAtLength((dist / 2) - 1);
          var label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
          var atan = p.x > c.x ? Math.atan2(p.y - c.y, p.x - c.x) : Math.atan2(c.y - p.y, c.x - p.x);
          var angle = rn(atan * 180 / Math.PI, 3);
          var tr = "rotate(" + angle + " " + c.x + " " + c.y +")";
          text.attr("data-points", JSON.stringify(points)).attr("data-dist", dist).attr("x", c.x).attr("y", c.y).attr("transform", tr).text(label).on("click", removeParent);
          rulerNew.append("circle").attr("cx", points[0].scX).attr("cy", points[0].scY).attr("r", 2 * factor).attr("stroke-width", 0.5 * factor)
            .attr("data-edge", "start").call(d3.drag().on("start", opisometerEdgeDrag));
          rulerNew.append("circle").attr("cx", points[points.length - 1].scX).attr("cy", points[points.length - 1].scY).attr("r", 2 * factor).attr("stroke-width", 0.5 * factor)
            .attr("data-edge", "end").call(d3.drag().on("start", opisometerEdgeDrag));
        } else {
          var vertices = points.map(function(p) {return [p.scX, p.scY]});
          var area = rn(Math.abs(d3.polygonArea(vertices))); // initial area as positive integer
          var areaConv = area * Math.pow(distanceScale.value, 2); // convert area to distanceScale
          areaConv = si(areaConv);
          if (areaUnit.value === "square") {areaConv += " " + distanceUnit.value + "²"} else {areaConv += " " + areaUnit.value;}
          var c = polylabel([vertices], 1.0); // pole of inaccessibility
          text.attr("x", rn(c[0], 2)).attr("y", rn(c[1], 2)).attr("data-area", area).text(areaConv).on("click", removeParent);
        }
      }
    });
  }
  
  // remove parent element (usually if child is clicked)
  function removeParent() {
    $(this.parentNode).remove();
  }

  // update cells in radius if non-feature brush selected on both single click and drag
  function updateCellsInRadius(cell, source) {
    var power = +brushPower.value;
    var radius = +brushRadius.value;
    var brush = $("#brushesButtons .pressed").attr("id");
    if ($("#brushesButtons .pressed").hasClass("feature")) {return;}
    // define selection besed on radius
    var selection = [cell];
    while (radius > 1) {
      var frontier = selection.slice();
      frontier.map(function(s) {
        cells[s].neighbors.forEach(function(e) {
          if (selection.indexOf(e) === -1) {selection.push(e);}
        });
      });
      radius--;
    }
    // change each cell in the selection
    var sourceHeight = cells[source].height;
    selection.map(function(s) {
      if (brush === "brushElevate") {
        if (cells[s].height < 0.2) {cells[s].height = 0.2} 
        else {cells[s].height += power;}
      }
      if (brush === "brushDepress") {cells[s].height -= power;}
      if (brush === "brushAlign") {cells[s].height = sourceHeight;}
      if (brush === "brushSmooth") {
        var heights = [cells[s].height];
        cells[s].neighbors.forEach(function(e) {heights.push(cells[e].height);});
        cells[s].height = (cells[s].height + d3.mean(heights)) / 2;
      }
    });
  }
  
  // turn D3 polygons array into cell array, define neighbors for each cell
  function detectNeighbors(withGrid) {
    console.time("detectNeighbors");
    var gridPath = ""; // store grid as huge single path string
    cells = [];
    polygons.map(function(i, d) {
      var neighbors = [];
      var ctype; // define cell type, -99 for map borders
      if (withGrid) {gridPath += "M" + i.join("L") + "Z";} // grid path
      diagram.cells[d].halfedges.forEach(function(e) {
        var edge = diagram.edges[e], ea;
        if (edge.left && edge.right) {
          ea = edge.left.index;
          if (ea === d) {ea = edge.right.index;}
          neighbors.push(ea);
        } else {
          if (edge.left) {ea = edge.left.index;} else {ea = edge.right.index;}
          ctype = -99; // polygon is on border if it has edge without opposite side polygon
        }
      })
      cells.push({index: d, data: i.data, height: 0, ctype, neighbors});
    });
    if (withGrid) {grid.append("path").attr("d", round(gridPath, 1));}
    console.timeEnd("detectNeighbors");
  }

  // Generate Heigtmap routine
  function defineHeightmap() {
    console.time('defineHeightmap');
    var mapTemplate = templateInput.value;
    if (mapTemplate === "Random") {
      var rnd = Math.random();
      if (rnd > 0.9) {mapTemplate = "Volcano";}
      if (rnd > 0.7  && rnd <= 0.9) {mapTemplate = "High Island";}
      if (rnd > 0.5 && rnd <= 0.7) {mapTemplate = "Low Island";}
      if (rnd > 0.35 && rnd <= 0.5) {mapTemplate = "Continents";}
      if (rnd > 0.01 && rnd <= 0.35) {mapTemplate = "Archipelago";}
      if (rnd <= 0.01) {mapTemplate = "Atoll";}
    }
    addMountain();
    var mod = rn((mapWidth + mapHeight) / 1500, 2); // add mod for big screens
    if (mapTemplate === "Volcano") {templateVolcano(mod);}
    if (mapTemplate === "High Island") {templateHighIsland(mod);}
    if (mapTemplate === "Low Island") {templateLowIsland(mod);}
    if (mapTemplate === "Continents") {templateContinents(mod);}
    if (mapTemplate === "Archipelago") {templateArchipelago(mod);}
    if (mapTemplate === "Atoll") {templateAtoll(mod);}
    console.log(mapTemplate + " template is applied");
    console.timeEnd('defineHeightmap');
  }

  // Heighmap Template: Volcano
  function templateVolcano(mod) {
    modifyHeights("all", 0.05, 1.1);
    addHill(rn(4 * mod), 0.4);
    addHill(rn(4 * mod), 0.15);
    addRange(rn(4 * mod));
    addRange(rn(-10 * mod));
  }
  
// Heighmap Template: High Island
  function templateHighIsland(mod) {
    modifyHeights("all", 0.05, 0.9);
    addRange(rn(4 * mod));
    addHill(rn(12 * mod), 0.25);
    addRange(rn(-8 * mod));
    modifyHeights("land", 0, 0.75);
    addHill(rn(3 * mod), 0.15);
  }

// Heighmap Template: Low Island
  function templateLowIsland(mod) {
    smoothHeights(2);
    addRange(rn(5 * mod));
    addHill(rn(6 * mod), 0.4);
    addHill(rn(14 * mod), 0.2);
    addRange(rn(-10 * mod));
    modifyHeights("land", 0, 0.35);
  }

  // Heighmap Template: Continents
  function templateContinents(mod) {
    addHill(rn(24 * mod), 0.25);
    addRange(rn(4 * mod));
    addHill(rn(3 * mod), 0.18);
    modifyHeights("land", 0, 0.7);
    var count = Math.ceil(Math.random() * 6 + 2);
    addStrait(count);
    smoothHeights(3);
    addPit(rn(18 * mod));
    addRange(rn(-14 * mod));
    modifyHeights("land", 0, 0.8);
    modifyHeights("all", 0.02, 1);
  }

  // Heighmap Template: Archipelago
  function templateArchipelago(mod) {
    modifyHeights("land", -0.2, 1);
    addHill(rn(16 * mod), 0.17);
    addRange(rn(8 * mod));
    var count = Math.ceil(Math.random() * 2 + 2);
    addStrait(count);
    addRange(rn(-18 * mod));
    addPit(rn(10 * mod));
    modifyHeights("land", -0.05, 0.7);
    smoothHeights(4);    
  }

  // Heighmap Template: Atoll
  function templateAtoll(mod) {
    addHill(rn(2 * mod), 0.35);
    addRange(rn(2 * mod));
    modifyHeights("all", 0.07, 1);
    smoothHeights(1);
    modifyHeights("0.27-10", 0, 0.1);
  }
  
  function addMountain() {
    var x = Math.floor(Math.random() * mapWidth / 3 + mapWidth / 3);
    var y = Math.floor(Math.random() * mapHeight * 0.2 + mapHeight * 0.4);
    var rnd = diagram.find(x, y).index;
    var height = Math.random() * 0.1 + 0.9;
    add(rnd, "mountain", height);
  }

  function addHill(count, shift) {
    // shift from 0 to 0.5
    for (c = 0; c < count; c++) {
      var limit = 0;
      do {
        var height = Math.random() * 0.4 + 0.1;
        var x = Math.floor(Math.random() * mapWidth * (1-shift*2) + mapWidth * shift);
        var y = Math.floor(Math.random() * mapHeight * (1-shift*2) + mapHeight * shift);
        var rnd = diagram.find(x, y).index;
        limit ++;
      } while (cells[rnd].height + height > 0.9 && limit < 100)
      add(rnd, "hill", height);
    }
  }

  function add(start, type, height) {
    var session = Math.ceil(Math.random() * 1e5);
    var sharpness = 0.2;
    var radius, hRadius, mRadius;
    switch (+graphSize) {
      case 1: hRadius = 0.991; mRadius = 0.91; break;
      case 2: hRadius = 0.9967; mRadius = 0.951; break;
      case 3: hRadius = 0.999; mRadius = 0.975; break;
      case 4: hRadius = 0.9994; mRadius = 0.98; break;
    }
    radius = type === "mountain" ? mRadius : hRadius; 
    var queue = [start];
    if (type === "mountain") {cells[start].height = height;}
    for (i = 0; i < queue.length && height >= 0.01; i++) {
      if (type == "mountain") {
        height = +cells[queue[i]].height * radius - height / 100;
      } else {
        height *= radius;
      }
      cells[queue[i]].neighbors.forEach(function(e) {
        if (cells[e].used === session) {return;}
        var mod = Math.random() * sharpness + 1.1 - sharpness;
        if (sharpness == 0) {mod = 1;}
        cells[e].height += height * mod;
        if (cells[e].height > 1) {cells[e].height = 1;}
        cells[e].used = session;
        queue.push(e);
      });
    }
  }

  function addRange(mod, height, from, to) {
    var session = Math.ceil(Math.random() * 100000);
    var count = Math.abs(mod);
    for (c = 0; c < count; c++) {
      var diff = 0, start = from, end = to;
      if (!start || !end) { 
        do {
          var xf = Math.floor(Math.random() * (mapWidth*0.7)) + mapWidth*0.15;
          var yf = Math.floor(Math.random() * (mapHeight*0.6)) + mapHeight*0.2;
          start = diagram.find(xf, yf).index;
          var xt = Math.floor(Math.random() * (mapWidth*0.7)) + mapWidth*0.15;
          var yt = Math.floor(Math.random() * (mapHeight*0.6)) + mapHeight*0.2;
          end = diagram.find(xt, yt).index;
          diff = Math.hypot(xt - xf, yt - yf);
        } while (diff < 150 / graphSize || diff > 300  / graphSize)
      }
      var range = [];
      if (start && end) {
        for (var l = 0; start != end && l < 10000; l++) {
          var min = 10000;
          cells[start].neighbors.forEach(function(e) {
            diff = Math.hypot(cells[end].data[0] - cells[e].data[0], cells[end].data[1] - cells[e].data[1]);
            if (Math.random() > 0.8) {diff = diff / 2}
            if (diff < min) {min = diff, start = e;}
          });
          range.push(start);
        }
      }
      var change = height ? height : Math.random() * 0.1 + 0.1;
      range.map(function(r) {  
        var rnd = Math.random() * 0.4 + 0.8;
        if (mod > 0) {cells[r].height += change * rnd;}
        else if (cells[r].height >= 0.1) {cells[r].height -= change * rnd;}
        cells[r].neighbors.forEach(function(e) {
          if (cells[e].used === session) {return;}
          cells[e].used = session;
          rnd = Math.random() * 0.4 + 0.8;
          if (mod > 0) {
            cells[e].height += change / 2 * rnd;
          } else if (cells[e].height >= 0.1) {
            cells[e].height -= change / 2 * rnd;
          }
        });
      });
    }
  }

  function addStrait(width) {
    var session = Math.ceil(Math.random() * 100000);
    var top = Math.floor(Math.random() * mapWidth * 0.35 + mapWidth * 0.3);
    var bottom = Math.floor((mapWidth - top) - (mapWidth * 0.1) + (Math.random() * mapWidth * 0.2));
    var start = diagram.find(top, mapHeight * 0.2).index;
    var end = diagram.find(bottom, mapHeight * 0.8).index;
    var range = [];
    for (var l = 0; start !== end && l < 1000; l++) {
      var min = 10000; // dummy value
      cells[start].neighbors.forEach(function(e) {
        diff = Math.hypot(cells[end].data[0] - cells[e].data[0], cells[end].data[1] - cells[e].data[1]);
        if (Math.random() > 0.8) {diff = diff / 2}
        if (diff < min) {min = diff; start = e;}
      });
      range.push(start);
    }
    var query = [];
    for (; width > 0; width--) {
      range.map(function(r) {
        cells[r].neighbors.forEach(function(e) {
          if (cells[e].used === session) {return;}
          cells[e].used = session;
          query.push(e);
          var height = cells[e].height * 0.23;
          cells[e].height = rn(height, 2);
        });
        range = query.slice();
      });
    }
  }

  function addPit(count, height, cell) {
    var session = Math.ceil(Math.random() * 100000);
    for (c = 0; c < count; c++) {
      var change = height ? height + 0.1 : Math.random() * 0.1 + 0.2;
      var start = cell;
      if (!start) {
        var lowlands = $.grep(cells, function(e) {return (e.height >= 0.2);});
        if (lowlands.length == 0) {return;}
        var rnd = Math.floor(Math.random() * lowlands.length);
        start = lowlands[rnd].index;
      }
      var query = [start], newQuery= [];
      // depress pit center
      cells[start].height -= change;
      if (cells[start].height < 0.05) {cells[start].height = 0.05;}
      cells[start].used = session;
      for (var i = 1; i < 10000; i++) {
        var rnd = Math.random() * 0.4 + 0.8;
        change -= i / 60 * rnd;
        if (change < 0.01) {return;}
        query.map(function(p) {
          cells[p].neighbors.forEach(function(e) {
            if (cells[e].used === session) {return;}
            cells[e].used = session;
            if (Math.random() > 0.8) {return;}
            newQuery.push(e);
            cells[e].height -= change;
            if (cells[e].height < 0.05) {cells[e].height = 0.05;}
          });
        });
        query = newQuery.slice();
        newQuery = [];
      }
    }
  }

  // Modify heights multiplying/adding by value
  function modifyHeights(type, add, mult) {
    cells.map(function(i) {
      if (type === "land") {
        if (i.height >= 0.2) {
          i.height += add;
          var dif = i.height - 0.2;
          var factor = mult;
          if (mult == "^2") {factor = dif}
          if (mult == "^3") {factor = dif * dif;}
          i.height = 0.2 + dif * factor;
        } 
      } else if (type === "all") {
        if (i.height > 0) {
          i.height += add;
          i.height *= mult;
        }
      } else {
        var interval = type.split("-");
        if (i.height >= +interval[0] && i.height <= +interval[1]) {
          i.height += add;
          if ($.isNumeric(mult)) {i.height *= mult; return;}
          if (mult.slice(0,1) === "^") {
            pow = mult.slice(1);
            i.height = Math.pow(i.height, pow);
          }
        }
      }
    });
  }

  // Smooth heights using mean of neighbors
  function smoothHeights(fraction) {
    var fraction = fraction || 2;
    cells.map(function(i) {
      var heights = [i.height];
      i.neighbors.forEach(function(e) {heights.push(cells[e].height);});
      i.height = (i.height * (fraction - 1) + d3.mean(heights)) / fraction;
    });
  }

  // Randomize heights a bit
  function disruptHeights() {
    cells.map(function(i) {
      if (i.height < 0.18) {return;}
      if (Math.random() > 0.5) {return;}
      var rnd = rn(2 - Math.random() * 4) / 100;
      i.height = rn(i.height + rnd, 2);
    });
  }
  
  // Mark features (ocean, lakes, islands)
  function markFeatures() {
    console.time("markFeatures");
    var queue = [], lake = 0, number = 0, type, greater = 0, less = 0;
    // ensure all border cells are ocean
    cells.map(function(l) {
      if (l.ctype === -99) {l.height = 0;}
      else {l.height = rn(l.height, 2);}
    });
    // start with top left corner to define Ocean first
    var start = diagram.find(0, 0).index;
    var unmarked = [cells[start]];
    while (unmarked.length > 0) {
      if (unmarked[0].height >= 0.2) {
        type = "Island";
        number = island;
        island += 1;
        greater = 0.2;
        less = 100; // just to omit exclusion
      } else {
        type = "Lake";
        number = lake;
        lake += 1;
        greater = -100; // just to omit exclusion
        less = 0.2;
      }
      if (type === "Lake" && number === 0) {type = "Ocean";}
      start = unmarked[0].index;
      queue.push(start);
      cells[start].f = type;
      cells[start].fn = number;
      while (queue.length > 0) {
        var i = queue[0];
        queue.shift();
        cells[i].neighbors.forEach(function(e) {
          if (!cells[e].f && cells[e].height >= greater && cells[e].height < less) {
            cells[e].f = type;
            cells[e].fn = number;
            queue.push(e);
          }
          if (type === "Island" && cells[e].height < 0.2) {
            cells[i].ctype = 2;
            cells[e].ctype = -1;
            if (cells[e].f === "Ocean") {
              // check if ocean coast is good harbor
              if (cells[i].harbor) {
                cells[i].harbor += 1;
              } else {
                cells[i].harbor = 1;
              }
            }
          }
        });
      }
      unmarked = $.grep(cells, function(e) {return (!e.f);});
    }
    console.log(" islands: " + island);
    console.timeEnd("markFeatures");
  }

  function drawOcean() {
    console.time("drawOcean");
    var limits = [], odd = 0.8; // initial odd for ocean layer is 80%
    // Define type of ocean cells based on cell distance form land
    var frontier = $.grep(cells, function(e) {return (e.ctype === -1 && e.f === "Ocean");});
    if (Math.random() < odd) {limits.push(-1); odd = 0.3;}
    for (var c = -2; frontier.length > 0 && c > -10; c--) {
      if (Math.random() < odd) {limits.unshift(c); odd = 0.3;} else {odd += 0.2;} 
      frontier.map(function(i) {
        i.neighbors.forEach(function(e) {
          if (!cells[e].ctype) {cells[e].ctype = c;}
        });
      });
      frontier = $.grep(cells, function(e) {return (e.ctype === c);});      
    }
    if (outlineLayers.value !== "random") {limits = outlineLayers.value.split(",");}
    // Define area edges
    for (var c = 0; c < limits.length; c++) {
      var edges = [];
      for (var i = 0; i < cells.length; i++) {
        if (cells[i].f === "Ocean" && cells[i].ctype >= limits[c]) {
          var cell = diagram.cells[i];
          cell.halfedges.forEach(function(e) {
            var edge = diagram.edges[e];
            if (edge.left && edge.right) {
              var ea = edge.left.index;
              if (ea === i) {ea = edge.right.index;}
              var ctype = cells[ea].ctype;
              if (ctype < limits[c] || ctype == undefined) {
                var start = edge[0].join(" ");
                var end = edge[1].join(" ");
                edges.push({start, end});
              }
            } else {
              var start = edge[0].join(" ");
              var end = edge[1].join(" ");
              edges.push({start, end});
            }
          })
        }
      }
      lineGen.curve(d3.curveBasisClosed);
      var relax = 0.8 - c / 10;
      if (relax < 0.2) {relax = 0.2};
      var line = getContinuousLine(edges, 0, relax);
      oceanLayers.append("path").attr("d", line).attr("fill", "#ecf2f9").style("opacity", 0.4 / limits.length);
    }
    console.timeEnd("drawOcean");
  }

  // recalculate Voronoi Graph to pack cells
  function reGraph() {
    console.time("reGraph");
    var tempCells = [], newPoints = []; // to store new data
    land = [], polygons= []; // clear old data
    // get average precipitation based on graph size
    var avPrec = rn(precipitation / Math.sqrt(cells.length), 2);   
    cells.map(function(i) {
      var height = Math.trunc(i.height * 100) / 100;
      var ctype = i.ctype;
      if (ctype !== -1 && ctype !== -2 && height < 0.2) {return;}
      var x = rn(i.data[0], 1);
      var y = rn(i.data[1], 1);
      var f = i.f;
      var fn = i.fn;
      var harbor = i.harbor;
      var copy = $.grep(newPoints, function(e) {return (e[0] == x && e[1] == y);});
      if (!copy.length) {
        newPoints.push([x, y]);
        tempCells.push({index:tempCells.length, data:[x, y], height, ctype, f, fn, harbor});
      }
      // add additional points for cells along coast
      if (ctype === 2 || ctype === -1) {
        i.neighbors.forEach(function(e) {
          if (cells[e].ctype === ctype) {
            var x1 = (x * 2 + cells[e].data[0]) / 3;
            var y1 = (y * 2 + cells[e].data[1]) / 3;
            x1 = rn(x1, 1), y1 = rn(y1, 1);
            copy = $.grep(newPoints, function(e) {return (e[0] === x1 && e[1] === y1);});
            if (!copy.length) {
              newPoints.push([x1, y1]);
              tempCells.push({index:tempCells.length, data:[x1, y1], height, ctype, f, fn, harbor});
            }
          };
        });
      }
    });
    cells = tempCells; // use tempCells as the only cells array
    calculateVoronoi(newPoints); // recalculate Voronoi diagram using new points
    var gridPath = ""; // store grid as huge single path string
    cells.map(function(i, d) {
      if (i.height >= 0.2) {gridPath += round("M" + polygons[d].join("L") + "Z", 1);}
      var neighbors = []; // re-detect neighbors
      diagram.cells[d].halfedges.forEach(function(e) {
        var edge = diagram.edges[e], ea;
        if (!edge.left || !edge.right) {return;}
        ea = edge.left.index;
        if (ea === d) {ea = edge.right.index;}
        neighbors.push(ea);
        if (i.height >= 0.2 && cells[ea].height < 0.2) {
          if (i.ctype === 1) {return;} // coastal point already defined
          i.ctype = 1; // mark coastal land cells
          // move cell point closer to coast
          var x = (i.data[0] + cells[ea].data[0]) / 2;
          var y = (i.data[1] + cells[ea].data[1]) / 2;
          if (cells[ea].f === "Lake") {
            i.data[0] = rn(x + (i.data[0] - x) * 0.22, 1);
            i.data[1] = rn(y + (i.data[1] - y) * 0.22, 1);
          } else {
            i.haven = ea; // harbor haven (oposite ocean cell)
            i.coastX = rn(x + (i.data[0] - x) * 0.12, 1);
            i.coastY = rn(y + (i.data[1] - y) * 0.12, 1);
            i.data[0] = rn(x + (i.data[0] - x) * 0.4, 1);
            i.data[1] = rn(y + (i.data[1] - y) * 0.4, 1);
          }
        }
      })
      i.neighbors = neighbors;
      if (i.haven === undefined) {delete i.harbor;}
      i.flux = avPrec;
    });
    grid.append("path").attr("d", gridPath);
    land = $.grep(cells, function(e) {return (e.height >= 0.2);});
    land.sort(function(a, b) {return b.height - a.height;});
    console.timeEnd("reGraph");
  }

  // Draw temp Heightmap for Customization
  function mockHeightmap(log) {
    $("#landmass").empty();
    var heights = [];
    var landCells = 0;
    cells.map(function(i) {
      if (i.height > 1) {i.height = 1;}
      if (i.height < 0) {i.height = 0;}
      if (i.height >= 0.2) {
        landCells++;
        landmass.append("path")
          .attr("d", "M" + polygons[i.index].join("L") + "Z")
          .attr("fill", color(1 - i.height))
          .attr("stroke", color(1 - i.height));        
      }
      heights.push(i.height);
    });
    // update history
    if (log !== "nolog") {
      history = history.slice(0, historyStage);
      history[historyStage] = heights;
      historyStage += 1;
    }
    redo.disabled = true; 
    undo.disabled = true;
    if (historyStage < history.length - 1) {redo.disabled = false;}
    if (historyStage > 0) {undo.disabled = false;}
    var elevationAverage = rn(d3.mean(heights), 2);
    var landRatio = rn(landCells / cells.length * 100);
    landmassCounter.innerHTML = landCells + " (" + landRatio + "%); Average Elevation: " + elevationAverage;
    if (landCells > 100) {
      $("#getMap").attr("disabled", false).removeClass("buttonoff");
    } else {
      $("#getMap").attr("disabled", true).addClass("buttonoff");
    }
    // if perspective is displayed, update it
    if ($("#perspectivePanel").is(":visible")) {drawPerspective();}
  }
  
  // restoreHistory
  function restoreHistory(step) {
    historyStage = step;
    var heights = history[historyStage];
    if (heights === undefined) {return;}
    cells.map(function(i, d) {
      i.height = heights[d];
    });
    mockHeightmap("nolog");
  }
   
  // Detect and draw the coasline
  function drawCoastline() {
    console.time('drawCoastline');
    getCurveType();
    var oceanCoastline = "", lakeCoastline = "";
    $("#landmass").empty();
    var minX = mapWidth, maxX = 0; // extreme points
    var minXedge, maxXedge; // extreme edges
    for (var isle = 0; isle < island; isle++) {
      var coastal = $.grep(land, function(e) {return (e.ctype === 1 && e.fn === isle);});
      if (!coastal.length) {continue;}
      var oceanEdges = [], lakeEdges = [];
      for (var i = 0; i < coastal.length; i++) {
        var id = coastal[i].index, cell = diagram.cells[id];
        cell.halfedges.forEach(function(e) {
          var edge = diagram.edges[e];
          if (edge.left && edge.right) {
            var ea = edge.left.index;
            if (ea === id) {ea = edge.right.index;}
            if (cells[ea].height < 0.2) {
              var start = edge[0].join(" ");
              var end = edge[1].join(" ");
              if (cells[ea].f === "Lake") {
                lakeEdges.push({start, end});
              } else {
                // island extreme points
                if (edge[0][0] < minX) {minX = edge[0][0]; minXedge = edge[0]}
                if (edge[1][0] < minX) {minX = edge[1][0]; minXedge = edge[1]}
                if (edge[0][0] > maxX) {maxX = edge[0][0]; maxXedge = edge[0]}
                if (edge[1][0] > maxX) {maxX = edge[1][0]; maxXedge = edge[1]} 
                oceanEdges.push({start, end});
              }
            }
          }
        })
      }
      oceanCoastline += getContinuousLine(oceanEdges, 1.5, 0);
      if (lakeEdges.length > 0) {lakeCoastline += getContinuousLine(lakeEdges, 1.5, 0);}
    }
    d3.select("#shape").append("path").attr("d", oceanCoastline).attr("fill", "white");  // draw the clippath
    landmass.append("path").attr("d", oceanCoastline); // draw the landmass
    coastline.append("path").attr("d", oceanCoastline); // draw the coastline   
    lakes.append("path").attr("d", lakeCoastline); // draw the lakes
    drawDefaultRuler(minXedge, maxXedge);
    console.timeEnd('drawCoastline');
  }

  // draw default scale bar
  function drawScaleBar() {
    if ($("#scaleBar").hasClass("hidden")) {return;} // no need to re-draw hidden element
    svg.select("#scaleBar").remove(); // fully redraw every time
    var title = 
    `Map scale defines ratio between distance on a map and the corresponding distance on the ground.
    Click to edit the map scale, drag to move the bar`;
    // get size
    var size = +barSize.value;
    var dScale = distanceScale.value;
    var unit = distanceUnit.value;
    var scaleBar = svg.append("g").attr("id", "scaleBar").on("click", editScale).call(d3.drag().on("start", elementDrag));
    scaleBar.append("title").text(title);
    const init = 100; // actual length in pixels if scale, dScale and size = 1;
    let val = init * size * dScale / scale; // bar length in distance unit
    if (val > 900) {val = rn(val, -3);} // round to 1000
    else if (val > 90) {val = rn(val, -2);} // round to 100
    else if (val > 9) {val = rn(val, -1);} // round to 10
    else {val = rn(val)} // round to 1
    const l = val * scale / dScale; // actual length in pixels on this scale
    var x = 0, y = 0; // initial position
    scaleBar.append("line").attr("x1", x+0.5).attr("y1", y).attr("x2", x+l+size-0.5).attr("y2", y).attr("stroke-width", size).attr("stroke", "white");
    scaleBar.append("line").attr("x1", x).attr("y1", y + size).attr("x2", x+l+size).attr("y2", y + size).attr("stroke-width", size).attr("stroke", "#3d3d3d");
    var stepB = size + " " + rn(l / 5 - size, 2) + " ", stepS = size + " " + rn(l / 25 - size, 2) + " ";
    var dash = stepS + stepS + stepS + stepS + stepS + stepB + stepB + stepB + stepB;
    scaleBar.append("line").attr("x1", x).attr("y1", y).attr("x2", x+l+size).attr("y2", y)
      .attr("stroke-width", rn(size * 3, 2)).attr("stroke-dasharray", dash).attr("stroke", "#3d3d3d");;
    // small scale
      for (var s = 1; s < 5; s++) {
        var value = rn(s * l / 25, 2);
        var label = rn(value * dScale / scale);
        if (label < s) {continue;}
        if (s > 1 && (l * dScale / 25) >= 100) {continue;}
        if (s > 2 && label >= 100) {continue;}        
        if (s === 4 && label >= l / 10) {continue;}        
        scaleBar.append("text").attr("x", x + value).attr("y", y - 2 * size).attr("font-size", rn(2.6 * size, 1)).text(label);
      }
    // big scale
    for (var b = 0; b < 6; b++) {
      var value = rn(b * l / 5, 2);
      var label = rn(value * dScale / scale);
      if (b === 5) {
        scaleBar.append("text").attr("x", x + value).attr("y", y - 2 * size).attr("font-size", rn(5 * size, 1)).text(label + " " + unit);
      } else {
        scaleBar.append("text").attr("x", x + value).attr("y", y - 2 * size).attr("font-size", rn(5 * size, 1)).text(label);
      }
    }
    label = `One pixel equals ${dScale} ${unit}`;
    scaleBar.append("text").attr("x", x + (l+1) / 2).attr("y", y + 2 * size).attr("dominant-baseline", "text-before-edge").attr("font-size", rn(7 * size, 1)).text(label);
    // move scaleBar to desired bottom-right point
    var tr, bbox = scaleBar.node().getBBox();
    if (localStorage.getItem("scaleBar")) {
      var scalePos = localStorage.getItem("scaleBar").split(",");
      tr = [+scalePos[0] - bbox.width, +scalePos[1] - bbox.height];
    } else {
      tr = [mapWidth - 10 - bbox.width, mapHeight - 10 - bbox.height];
    }
    scaleBar.attr("transform", "translate(" + rn(tr[0]) + "," + rn(tr[1]) + ")");
  }
  
  // draw default ruler measiring land x-axis edges
  function drawDefaultRuler(minXedge, maxXedge) {
    var title = 
    `Ruler is an instrument for measuring thelinear lengths.
    One dash shows 30 km (18.6 mi), approximate distance of a daily loaded march.
    Drag edge circles to move the ruler, center circle to split the ruler into 2 parts.
    Click on the ruler label to remove the ruler from the map`;
    var rulerNew = ruler.append("g").attr("class", "linear").call(d3.drag().on("start", elementDrag));
    rulerNew.append("title").text(title);
    var x1 = rn(minXedge[0], 2), y1 = rn(minXedge[1], 2), x2 = rn(maxXedge[0], 2), y2 = rn(maxXedge[1], 2);
    rulerNew.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2).attr("class", "white");
    rulerNew.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2).attr("class", "gray").attr("stroke-dasharray", 10);
    rulerNew.append("circle").attr("r", 2).attr("cx", x1).attr("cy", y1).attr("stroke-width", 0.5).attr("data-edge", "left").call(d3.drag().on("drag", rulerEdgeDrag));
    rulerNew.append("circle").attr("r", 2).attr("cx", x2).attr("cy", y2).attr("stroke-width", 0.5).attr("data-edge", "rigth").call(d3.drag().on("drag", rulerEdgeDrag));
    var x0 = rn((x1 + x2) / 2, 2), y0 = rn((y1 + y2) / 2, 2);
    rulerNew.append("circle").attr("r", 1.2).attr("cx", x0).attr("cy", y0).attr("stroke-width", 0.3).attr("class", "center").call(d3.drag().on("start", rulerCenterDrag));
    var angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    var tr = "rotate(" + angle + " " + x0 + " " + y0 +")";
    var dist = rn(Math.hypot(x1 - x2, y1 - y2));
    var label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
    rulerNew.append("text").attr("x", x0).attr("y", y0).attr("dy", -1).attr("transform", tr).attr("data-dist", dist).text(label).on("click", removeParent).attr("font-size", 10);    
  }
  
  // drag any element changing transform
  function elementDrag() {
    var el = d3.select(this);
    var tr = parseTransform(el.attr("transform"));
    var dx = +tr[0] - d3.event.x, dy = +tr[1] - d3.event.y;
    d3.event.on("drag", function() {
      var x = d3.event.x, y = d3.event.y;
      var transform = `translate(${(dx+x)},${(dy+y)})`;
      el.attr("transform", transform);
    });

    d3.event.on("end", function() {
      // remember scaleBar bottom-right position
      if (el.attr("id") === "scaleBar") {
        var bbox = el.node().getBoundingClientRect();
        localStorage.setItem("scaleBar", [bbox.right, bbox.bottom])
      }
    });
  }

  // draw ruler circles and update label
  function rulerEdgeDrag() {
    var group = d3.select(this.parentNode);
    var edge = d3.select(this).attr("data-edge");
    var x = d3.event.x, y = d3.event.y, x0, y0;
    d3.select(this).attr("cx", x).attr("cy", y);
    var line = group.selectAll("line");
    if (edge === "left") {
      line.attr("x1", x).attr("y1", y);
      x0 = +line.attr("x2"), y0 = +line.attr("y2");  
    } else {
      line.attr("x2", x).attr("y2", y);
      x0 = +line.attr("x1"), y0 = +line.attr("y1");
    }
    var xc = rn((x + x0) / 2, 2), yc = rn((y + y0) / 2, 2);
    group.select(".center").attr("cx", xc).attr("cy", yc);
    var dist = rn(Math.hypot(x0 - x, y0 - y));
    var label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
    var atan = x0 > x ? Math.atan2(y0 - y, x0 - x) : Math.atan2(y - y0, x - x0);
    var angle = rn(atan * 180 / Math.PI, 3);
    var tr = "rotate(" + angle + " " + xc + " " + yc +")";
    group.select("text").attr("x", xc).attr("y", yc).attr("transform", tr).attr("data-dist", dist).text(label);
  }
  
  // draw ruler center point to split ruler into 2 parts
  function rulerCenterDrag() {
    var xc1, yc1, xc2, yc2;
    var group = d3.select(this.parentNode); // current ruler group
    var x = d3.event.x, y = d3.event.y; // current coords
    var line = group.selectAll("line"); // current lines
    var x1 = +line.attr("x1"), y1 = +line.attr("y1"), x2 = +line.attr("x2"), y2 = +line.attr("y2"); // initial line edge points
    var rulerNew = ruler.insert("g", ":first-child");
    rulerNew.call(d3.drag().on("start", elementDrag));
    var title = 
    `Ruler is an instrument for measuring thelinear lengths.
    One dash shows 30 km (18.6 mi), approximate distance of a daily loaded march.
    Drag edge circles to move the ruler, center circle to split the ruler into 2 parts.
    Click on the ruler label to remove the ruler from the map`;
    var factor = rn(1 / Math.pow(scale, 0.3), 1);
    rulerNew.append("title").text(title);
    rulerNew.append("line").attr("class", "white").attr("stroke-width", factor);
    var dash = +group.select(".gray").attr("stroke-dasharray");
    rulerNew.append("line").attr("class", "gray").attr("stroke-dasharray", dash).attr("stroke-width", factor);
    rulerNew.append("text").attr("dy", -1).on("click", removeParent).attr("font-size", 10 * factor).attr("stroke-width", factor);

    d3.event.on("drag", function() {
      x = d3.event.x, y = d3.event.y;
      d3.select(this).attr("cx", x).attr("cy", y);
      // change first part
      line.attr("x1", x1).attr("y1", y1).attr("x2", x).attr("y2", y);
      var dist = rn(Math.hypot(x1 - x, y1 - y));
      var label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
      var atan = x1 > x ? Math.atan2(y1 - y, x1 - x) : Math.atan2(y - y1, x - x1);
      xc1 = rn((x + x1) / 2, 2), yc1 = rn((y + y1) / 2, 2);
      var tr = "rotate(" + rn(atan * 180 / Math.PI, 3) + " " + xc1 + " " + yc1 +")";
      group.select("text").attr("x", xc1).attr("y", yc1).attr("transform", tr).attr("data-dist", dist).text(label);
      // change second (new) part
      dist = rn(Math.hypot(x2 - x, y2 - y));
      label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
      atan = x2 > x ? Math.atan2(y2 - y, x2 - x) : Math.atan2(y - y2, x - x2);
      xc2 = rn((x + x2) / 2, 2), yc2 = rn((y + y2) / 2, 2);
      tr = "rotate(" + rn(atan * 180 / Math.PI, 3) + " " + xc2 + " " + yc2 +")";
      rulerNew.selectAll("line").attr("x1", x).attr("y1", y).attr("x2", x2).attr("y2", y2);
      rulerNew.select("text").attr("x", xc2).attr("y", yc2).attr("transform", tr).attr("data-dist", dist).text(label);
    });

    d3.event.on("end", function() {
      // circles for 1st part
      group.selectAll("circle").remove();
      group.append("circle").attr("cx", x1).attr("cy", y1).attr("r", 2 * factor).attr("stroke-width", 0.5 * factor).attr("data-edge", "left").call(d3.drag().on("drag", rulerEdgeDrag));  
      group.append("circle").attr("cx", x).attr("cy", y).attr("r", 2 * factor).attr("stroke-width", 0.5 * factor).attr("data-edge", "rigth").call(d3.drag().on("drag", rulerEdgeDrag));         
      group.append("circle").attr("cx", xc1).attr("cy", yc1).attr("r", 1.2 * factor).attr("stroke-width", 0.3 * factor).attr("class", "center").call(d3.drag().on("start", rulerCenterDrag));
      // circles for 2nd part
      rulerNew.append("circle").attr("cx", x).attr("cy", y).attr("r", 2 * factor).attr("stroke-width", 0.5 * factor).attr("data-edge", "left").call(d3.drag().on("drag", rulerEdgeDrag));
      rulerNew.append("circle").attr("cx", x2).attr("cy", y2).attr("r", 2 * factor).attr("stroke-width", 0.5 * factor).attr("data-edge", "rigth").call(d3.drag().on("drag", rulerEdgeDrag));
      rulerNew.append("circle").attr("cx", xc2).attr("cy", yc2).attr("r", 1.2 * factor).attr("stroke-width", 0.3 * factor).attr("class", "center").call(d3.drag().on("start", rulerCenterDrag));
    });
  }

  function opisometerEdgeDrag() {
    var el = d3.select(this);
    var x0 = +el.attr("cx"), y0 = +el.attr("cy");    
    var group = d3.select(this.parentNode);
    var curve = group.select(".white");
    var curveGray = group.select(".gray");
    var text = group.select("text");
    var points = JSON.parse(text.attr("data-points"));
    if (x0 === points[0].scX && y0 === points[0].scY) {points.reverse();}

    d3.event.on("drag", function() {
      var x = d3.event.x, y = d3.event.y;
      el.attr("cx", x).attr("cy", y);
      var l = points[points.length - 1];
      var diff = Math.hypot(l.scX - x, l.scY - y);
      if (diff > 5) {points.push({scX: x, scY: y});} else {return;}
      lineGen.curve(d3.curveBasis);
      var d = round(lineGen(points));
      curve.attr("d", d);
      curveGray.attr("d", d);
      var dist = rn(curve.node().getTotalLength());
      var label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
      text.attr("x", x).attr("y", y).text(label);
    });

    d3.event.on("end", function() {
      var dist = rn(curve.node().getTotalLength());
      var c = curve.node().getPointAtLength(dist / 2);
      var p = curve.node().getPointAtLength((dist / 2) - 1);
      var label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
      var atan = p.x > c.x ? Math.atan2(p.y - c.y, p.x - c.x) : Math.atan2(c.y - p.y, c.x - p.x);
      var angle = rn(atan * 180 / Math.PI, 3);
      var tr = "rotate(" + angle + " " + c.x + " " + c.y +")";
      text.attr("data-points", JSON.stringify(points)).attr("data-dist", dist).attr("x", c.x).attr("y", c.y).attr("transform", tr).text(label);   
    });    
  }

  function getContinuousLine(edges, indention, relax) {
    var edgesOr = edges.slice(); 
    var line = "";
    while (edges.length > 2) {
      var edgesOrdered = []; // to store points in a correct order
      var start = edges[0].start;
      var end = edges[0].end;
      edges.shift();
      var spl = start.split(" ");
      edgesOrdered.push({scX: +spl[0], scY: +spl[1]});
      spl = end.split(" ");
      edgesOrdered.push({scX: +spl[0], scY: +spl[1]});
      var x0 = +spl[0], y0 = +spl[1];
      for (var i = 0; end !== start && i < 100000; i++) {
        var next = null, index = null;
        for (var e = 0; e < edges.length; e++) {
          var edge = edges[e];
          if (edge.start == end || edge.end == end) {
            next = edge;
            if (next.start == end) {end = next.end;} else {end = next.start;}
            index = e;
            break;
          }
        }
        if (!next) {
          console.error("Next edge is not found");
          return "";
        }
        spl = end.split(" ");
        if (indention || relax) {
          var dist = Math.hypot(+spl[0] - x0, +spl[1] - y0);
          if (dist >= indention && Math.random() > relax) {
            edgesOrdered.push({scX: +spl[0], scY: +spl[1]}); 
            x0 = +spl[0], y0 = +spl[1];
          }
        } else {
          edgesOrdered.push({scX: +spl[0], scY: +spl[1]}); 
        }
        edges.splice(index, 1);
        if (i === 100000-1) {
          console.error("Line not ended, limit reached");
          break;
        }
      }
      line += lineGen(edgesOrdered) + "Z";
    }
    return round(line, 1);
  }

  // Resolve Heightmap Depressions (for a correct water flux modeling)
  function resolveDepressions() {
    console.time('resolveDepressions');
    var depression = 1, limit = 100, minCell, minHigh;
    for (var l = 0; depression > 0 && l < limit; l++) {
      depression = 0;
      for (var i = 0; i < land.length; i++) {
        var heights = [];
        land[i].neighbors.forEach(function(e) {heights.push(+cells[e].height);});
        var minHigh = d3.min(heights);
        if (land[i].height <= minHigh) {
          depression += 1;
          land[i].height = minHigh + 0.01;
        }
      }
      if (l === limit - 1) {console.error("Error: resolveDepressions iteration limit");}
    }
    console.timeEnd('resolveDepressions');
  }  
  
  function flux() {
    console.time('flux');
    riversData = [];
    var riversOrder = [], riverNext = 0;
    land.sort(function(a, b) {return b.height - a.height;});
    for (var i = 0; i < land.length; i++) {
      var id = land[i].index;
      var heights = [];
      land[i].neighbors.forEach(function(e) {heights.push(cells[e].height);});
      var minId = heights.indexOf(d3.min(heights));
      var min = land[i].neighbors[minId];
      // Define river number
      if (land[i].flux > 0.85) {
        if (land[i].river == undefined) {
          // State new River
          land[i].river = riverNext;
          riversData.push({river: riverNext, cell: id, x: land[i].data[0], y: land[i].data[1]});
          riverNext += 1;
        }
        // Assing existing River to the downhill cell
        if (cells[min].river == undefined) {
          cells[min].river = land[i].river;
        } else {
          var riverTo = cells[min].river;
          var iRiver = $.grep(riversData, function(e) {return (e.river == land[i].river);});
          var minRiver = $.grep(riversData, function(e) {return (e.river == riverTo);});
          var iRiverL = iRiver.length;
          var minRiverL = minRiver.length;
          // re-assing river nunber if new part is greater
          if (iRiverL >= minRiverL) {
            cells[min].river = land[i].river;
            iRiverL += 1;
            minRiverL -= 1;
          }
          // mark confluences
          if (cells[min].height >= 0.2 && iRiverL > 1 && minRiverL > 1) {
            if (!cells[min].confluence) {
              cells[min].confluence = minRiverL-1;
            } else {
              cells[min].confluence += minRiverL-1;
            }
          }
        }
      }
      cells[min].flux += land[i].flux;
      if (land[i].river != undefined) {
        var px = cells[min].data[0];
        var py = cells[min].data[1];
        if (cells[min].height < 0.2) {
          // pour water to the Ocean
            var sx = land[i].data[0];
            var sy = land[i].data[1];
            var x = (px + sx) / 2 + (px - sx) / 20;
            var y = (py + sy) / 2 + (py - sy) / 20;
            riversData.push({river: land[i].river, cell: id, x, y});
        }
        else {
          // add next River segment
          riversData.push({river: land[i].river, cell: min, x: px, y: py});
        }
      }
    }
    console.timeEnd('flux');
    drawRiverLines(riverNext);
  }

  function drawRiverLines(riverNext) {
    console.time('drawRiverLines');
    lineGen.curve(d3.curveCatmullRom.alpha(0.1));
    for (var i = 0; i < riverNext; i++) {
      var dataRiver = $.grep(riversData, function(e) {return e.river === i;});
      if (dataRiver.length > 1) {
        var riverAmended = amendRiver(dataRiver, 1);
        var width = rn(0.8 + Math.random() * 0.4, 1);
        var increment = rn(0.8 + Math.random() * 0.4, 1);
        var d = drawRiver(riverAmended, width, increment);
        rivers.append("path").attr("d", d).attr("id", "river"+i)
          .attr("data-points", round(JSON.stringify(riverAmended), 1))
          .attr("data-width", width).attr("data-increment", increment);
      }
    }
    rivers.selectAll("path").on("click", editRiver);
    console.timeEnd('drawRiverLines');
  }

  // add more river points on 1/3 and 2/3 of length
  function amendRiver(dataRiver, rndFactor) {
    var riverAmended = [], side = 1;
    for (var r = 0; r < dataRiver.length; r++) {
      var dX = dataRiver[r].x;
      var dY = dataRiver[r].y;
      var cell = dataRiver[r].cell;
      var c = cells[cell].confluence || 0;
      riverAmended.push([dX, dY, c]);
      if (r+1 < dataRiver.length) {
        var eX = dataRiver[r+1].x;
        var eY = dataRiver[r+1].y;
        var angle = Math.atan2(eY - dY, eX - dX);
        var serpentine = 1 / (r+1);
        var meandr = serpentine + 0.3 + Math.random() * 0.3 * rndFactor; 
        if (Math.random() > 0.5) {side *= -1};           
        var dist = Math.hypot(eX - dX, eY - dY);
        // if dist is big or river is small add 2 extra points
        if (dist > 8 || (dist > 4 && dataRiver.length < 6)) {
          var stX = (dX * 2 + eX) / 3;
          var stY = (dY * 2 + eY) / 3;
          var enX = (dX + eX * 2) / 3;
          var enY = (dY + eY * 2) / 3;
          stX += -Math.sin(angle) * meandr * side;
          stY += Math.cos(angle) * meandr * side;
          if (Math.random() > 0.8) {side *= -1};
          enX += Math.sin(angle) * meandr * side;
          enY += -Math.cos(angle) * meandr * side;
          riverAmended.push([stX, stY], [enX, enY]);              
        // if dist is medium or river is small add 1 extra point
        } else if (dist > 4 || dataRiver.length < 6) {
          var scX = (dX + eX) / 2;
          var scY = (dY + eY) / 2;
          scX += -Math.sin(angle) * meandr * side;
          scY += Math.cos(angle) * meandr * side;
          riverAmended.push([scX, scY]);
        }
      }
    }
    return riverAmended;
  }

  function drawRiver(points, width, increment) {
      var extraOffset = 0.02; // start offset to make river source visible
      var width = width || 1; // river width modifier
      var increment = increment || 1; // river bed widening modifier
      var riverLength = 0;
      points.map(function(p, i) {
        if (i === 0) {return 0;}
        riverLength += Math.hypot(p[0] - points[i-1][0], p[1] - points[i-1][1]);
      });
      var widening = rn((1000 + (riverLength * 30)) * increment); // FIX me!
      var riverPointsLeft = [], riverPointsRight = [];
      var last = points.length - 1;
      var factor = riverLength / points.length;

      // first point
      var x = points[0][0], y = points[0][1], c;
      var angle = Math.atan2(y - points[1][1], x - points[1][0]);
      var xLeft = x + -Math.sin(angle) * extraOffset, yLeft = y + Math.cos(angle) * extraOffset;
      riverPointsLeft.push({scX:xLeft, scY:yLeft});
      var xRight = x + Math.sin(angle) * extraOffset, yRight = y + -Math.cos(angle) * extraOffset;
      riverPointsRight.unshift({scX:xRight, scY:yRight});

      // middle points
      for (var p = 1; p < last; p ++) {
        x = points[p][0], y = points[p][1], c = points[p][2];
        if (c) {extraOffset += Math.atan(c * 10 / widening);} // confluence
        var xPrev = points[p-1][0], yPrev = points[p-1][1];
        var xNext = points[p+1][0], yNext = points[p+1][1];
        angle = Math.atan2(yPrev - yNext, xPrev - xNext);
        var offset = (Math.atan(Math.pow(p * factor, 2) / widening) / 2 * width) + extraOffset;
        xLeft = x + -Math.sin(angle) * offset, yLeft = y + Math.cos(angle) * offset;
        riverPointsLeft.push({scX:xLeft, scY:yLeft});
        xRight = x + Math.sin(angle) * offset, yRight = y + -Math.cos(angle) * offset;
        riverPointsRight.unshift({scX:xRight, scY:yRight});
      }

      // end point
      x = points[last][0], y = points[last][1], c = points[last][2];
      if (c) {extraOffset += Math.atan(c * 10 / widening);} // confluence
      angle = Math.atan2(points[last-1][1] - y, points[last-1][0] - x);
      xLeft = x + -Math.sin(angle) * offset, yLeft = y + Math.cos(angle) * offset;
      riverPointsLeft.push({scX:xLeft, scY:yLeft});
      xRight = x + Math.sin(angle) * offset, yRight = y + -Math.cos(angle) * offset;
      riverPointsRight.unshift({scX:xRight, scY:yRight});

      // generate path and return
      var right = lineGen(riverPointsRight);
      var left = lineGen(riverPointsLeft);
      left = left.substring(left.indexOf("C"));
      var d = round(right + left + "Z", 2);
      return d;
  }

  function editRiver() {
    if ($("#riverNew").hasClass('pressed')) {
      var point = d3.mouse(this);
      addRiverPoint({scX:point[0], scY:point[1]});
      redrawRiver();
      $("#riverNew").click(); 
      return;
    }
    unselect();
    elSelected = d3.select(this);
    elSelected.call(d3.drag().on("start", riverDrag)).classed("draggable", true);   
    var points = JSON.parse(elSelected.attr("data-points"));
    rivers.append("g").attr("class", "riverPoints").attr("transform", elSelected.attr("transform"));
    points.map(function(p) {addRiverPoint(p)});
    var tr = parseTransform(elSelected.attr("transform"));
    riverAngle.value = tr[2];
    riverAngleValue.innerHTML = Math.abs(+tr[2]) + "°";
    riverScale.value = tr[5];
    riverWidthInput.value = +elSelected.attr("data-width");
    riverIncrement.value = +elSelected.attr("data-increment");
    $("#riverEditor").dialog({
      title: "Edit River",
      minHeight: 30, width: "auto", maxWidth: 275, resizable: false,
      position: {my: "center top", at: "top", of: this}
    }).on("dialogclose", function() {unselect();});
  }

  function unselect() {
    if (elSelected) {
      elSelected.call(d3.drag().on("drag", null)).classed("draggable", false);
      rivers.select(".riverPoints").remove();
      $(".pressed").removeClass('pressed');
      viewbox.style("cursor", "default");
      elSelected = null;
      if ($("#riverEditor").is(":visible")) {$("#riverEditor").dialog("close");}
      if ($("#labelEditor").is(":visible")) {$("#labelEditor").dialog("close");}
    }
  }

  function addRiverPoint(point) {
    rivers.select(".riverPoints").append("circle")
      .attr("cx", point[0]).attr("cy", point[1]).attr("r", 0.35)
      .call(d3.drag().on("start", riverPointDrag))
      .on("click", function(d) {
        if ($("#riverRemovePoint").hasClass('pressed')) {
          $(this).remove(); redrawRiver();            
        }
        if ($("#riverNew").hasClass('pressed')) {
          $("#riverNew").click();
        }
      });
  }

  function riverPointDrag() {
    var x = d3.event.x, y = d3.event.y;
    var el = d3.select(this);
    d3.event
      .on("drag", function() {el.attr("cx", d3.event.x).attr("cy", d3.event.y);})
      .on("end", function() {redrawRiver();});
  }

  $("#riverEditor .editButton, #riverEditor .editButtonS").click(function() {
    if (this.id == "riverRemove") {
      alertMessage.innerHTML = `Are you sure you want to remove the river?`;
      $(function() {$("#alert").dialog({resizable: false, title: "Remove river",
        buttons: {
          "Remove": function() {
            $(this).dialog("close");
            elSelected.remove();
            rivers.select(".riverPoints").remove();
            $("#riverEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }})
      });
      return;
    }
    if (this.id == "riverCopy") {
      var tr = parseTransform(elSelected.attr("transform"));
      var d = elSelected.attr("d");
      var points = elSelected.attr("data-points");
      var width = elSelected.attr("data-width");
      var increment = elSelected.attr("data-increment");
      var x = 2, y = 2;
      transform = `translate(${tr[0]-x},${tr[1]-y}) rotate(${tr[2]} ${tr[3]} ${tr[4]}) scale(${tr[5]})`;
      while (rivers.selectAll("[transform='" + transform + "'][d='" + d + "']").size() > 0) {
        x += 2; y += 2;
        transform = `translate(${tr[0]-x},${tr[1]-y}) rotate(${tr[2]} ${tr[3]} ${tr[4]}) scale(${tr[5]})`;
      }
      var river = +$("#rivers > path").last().attr("id").slice(5) + 1;
      rivers.append("path").attr("d", d).attr("data-points", points).attr("transform", transform)
        .attr("id", "river"+river).on("click", editRiver)
        .attr("data-width", width).attr("data-increment", increment);
      return;
    }
    if (this.id == "riverRegenerate") {
      // restore main points
      var points = JSON.parse(elSelected.attr("data-points"));
      var riverCells = [], dataRiver = [];
      for (var p = 0; p < points.length; p++) {
        var cell = diagram.find(points[p][0], points[p][1], 1);
        if (cell !== null && cell !== riverCells[riverCells.length-1]) {riverCells.push(cell);}
      }
      for (var c = 0; c < riverCells.length; c++) {
        var rc = riverCells[c];
        dataRiver.push({x:rc[0], y:rc[1], cell:rc.index});
      }
      // if last point not in cell center push it with one extra point
      var last = points.pop();
      if (dataRiver[dataRiver.length-1].x !== last[0]) {
        dataRiver.push({x:last[0], y:last[1], cell:dataRiver[dataRiver.length-1].cell});
      }
      var rndFactor = 0.2 + Math.random() * 1.6; // random factor in range 0.2-1.8
      var riverAmended = amendRiver(dataRiver, rndFactor);
      lineGen.curve(d3.curveCatmullRom.alpha(0.1));
      var width = +elSelected.attr("data-width");
      var increment = +elSelected.attr("data-increment");
      var d = drawRiver(riverAmended, width, increment);
      elSelected.attr("d", d).attr("data-points", round(JSON.stringify(riverAmended), 1));
      rivers.select(".riverPoints").selectAll("*").remove();
      riverAmended.map(function(p) {addRiverPoint(p);});
      return;
    }
    if (this.id == "riverResize") {$("#riverAngle, #riverAngleValue, #riverScaleIcon, #riverScale, #riverReset").toggle();}
    if (this.id == "riverWidth") {$("#riverWidthInput, #riverIncrementIcon, #riverIncrement").toggle();}
    if (this.id == "riverAddPoint" || this.id == "riverRemovePoint" || this.id == "riverNew") {
      if ($(this).hasClass('pressed')) {
        $(".pressed").removeClass('pressed');
        if (elSelected.attr("data-river") == "new") {
          rivers.select(".riverPoints").selectAll("*").remove();
          elSelected.attr("data-river", "");
          elSelected.call(d3.drag().on("start", riverDrag)).classed("draggable", true); 
        }
        viewbox.style("cursor", "default");
      } else {
        $(".pressed").removeClass('pressed');
        $(this).addClass('pressed');
        if (this.id == "riverAddPoint" || this.id == "riverNew") {viewbox.style("cursor", "crosshair");}
        if (this.id == "riverNew") {rivers.select(".riverPoints").selectAll("*").remove();}
      }
      return;
    }
    if (this.id == "riverReset") {
      elSelected.attr("transform", "");
      rivers.select(".riverPoints").attr("transform", "");
      riverAngle.value = 0;
      riverAngleValue.innerHTML = "0°";
      riverScale.value = 1;
      return;
    }
    $("#riverEditor .editButton").toggle();
    $(this).show().next().toggle();
  });

  // on riverAngle change
  $("#riverAngle").change(function() {
    var tr = parseTransform(elSelected.attr("transform"));
    riverAngleValue.innerHTML = Math.abs(+this.value) + "°";
    $(this).attr("title", $(this).val());
    var c = elSelected.node().getBBox();
    var angle = this.value;
    var scale = +tr[5];
    transform = `translate(${tr[0]},${tr[1]}) rotate(${angle} ${(c.x+c.width/2)*scale} ${(c.y+c.height/2)*scale}) scale(${scale})`;
    elSelected.attr("transform", transform);
    rivers.select(".riverPoints").attr("transform", transform);
  });

  // on riverScale change
  $("#riverScale").change(function() {
    var tr = parseTransform(elSelected.attr("transform"));
    $(this).attr("title", $(this).val());
    var scaleOld = +tr[5];
    var scale = +this.value;
    var c = elSelected.node().getBBox();
    var cx = c.x+c.width/2;
    var cy = c.y+c.height/2;
    var trX = +tr[0] + cx * (scaleOld - scale);
    var trY = +tr[1] + cy * (scaleOld - scale);
    var scX = +tr[3] * scale/scaleOld;
    var scY = +tr[4] * scale/scaleOld;
    transform = `translate(${trX},${trY}) rotate(${tr[2]} ${scX} ${scY}) scale(${scale})`;
    elSelected.attr("transform", transform);
    rivers.select(".riverPoints").attr("transform", transform);
  });

  // change river width
  $("#riverWidthInput, #riverIncrement").change(function() {
    var points = JSON.parse(elSelected.attr("data-points"));
    lineGen.curve(d3.curveCatmullRom.alpha(0.1));
    var width = +$("#riverWidthInput").val();
    var increment = +$("#riverIncrement").val();
    var d = drawRiver(points, width, increment);    
    elSelected.attr("d", d).attr("data-width", width).attr("data-increment", increment);
  });
  
  function riverDrag() {
    var x = d3.event.x, y = d3.event.y;
    var el = d3.select(this);
    var tr = parseTransform(el.attr("transform"));
    d3.event.on("drag", function() {
      var xc = d3.event.x, yc = d3.event.y;
      var transform = `translate(${(+tr[0]+xc-x)},${(+tr[1]+yc-y)}) rotate(${tr[2]} ${tr[3]} ${tr[4]}) scale(${tr[5]})`;
      el.attr("transform", transform);
      rivers.select(".riverPoints").attr("transform", transform);
    });
  }

  function parseTransform(string) {
    // [translateX,translateY,rotateDeg,rotateX,rotateY,scale]
    if (!string) {return [0,0,0,0,0,1];}
    var a = string.replace(/[a-z()]/g,"").replace(/[ ]/g,",").split(",");
    return [a[0] || 0, a[1] || 0, a[2] || 0, a[3] || 0, a[4] || 0, a[5] || 1];
  }

  function redrawRiver() {
    var points = [];
    rivers.select(".riverPoints").selectAll("circle").each(function() {
      var el = d3.select(this);
      points.push([+el.attr("cx"), +el.attr("cy")]);
    });
    lineGen.curve(d3.curveCatmullRom.alpha(0.1));
    var d = drawRiver(points);
    elSelected.attr("d", d).attr("data-points", round(JSON.stringify(points), 1));
  }

  function manorsAndRegions() {
    console.group('manorsAndRegions');
    calculateChains();
    rankPlacesGeography();
    getCurveType();
    locateCultures();
    locateCapitals();
    generateMainRoads();
    rankPlacesEconomy();
    locateTowns();
    checkAccessibility();
    drawManors();
    defineRegions();
    drawRegions();
    generatePortRoads();
    generateSmallRoads();
    generateOceanRoutes();
    calculatePopulation();
    console.groupEnd('manorsAndRegions');
  }

  // Assess cells geographycal suitability for settlement
  function rankPlacesGeography() {
    console.time('rankPlacesGeography');
    land.map(function(c) {
      var score = 0;
      // truncate decimals to keep dta clear
      c.height = rn(c.height, 2);
      c.flux = rn(c.flux, 2);
      // base score from height (will be biom)
      if (c.height <= 0.8) {score = 1.4;}      
      if (c.height <= 0.6) {score = 1.6;}
      if (c.height <= 0.5) {score = 1.8;}
      if (c.height <= 0.4) {score = 2;} 
      score += (1 - c.height) / 2;
      if (c.ctype && Math.random() < 0.8 && !c.river) {
        c.score = 0; // ignore 80% of extended cells
      } else {
        if (c.harbor) {
          if (c.harbor === 1) {score += 2;} else {score -= 0.2;} // good sea harbor is valued
          if (c.river && c.ctype === 1) {score += 2;} // sea estuaries are valued
        }
        if (c.river && c.ctype === 1) {score += 2;} // all estuaries are valued 
        if (c.flux > 1) {score += Math.pow(c.flux, 0.3);} // riverbank is valued
        if (c.confluence) {score += Math.pow(c.confluence, 0.3);} // confluence is valued;
      }
      c.score = rn(score, 2);
    });
    land.sort(function(a, b) {return b.score - a.score;});
    console.timeEnd('rankPlacesGeography');
  }

  // Assess the cells economical suitability for settlement
  function rankPlacesEconomy() {
    console.time('rankPlacesEconomy');
    land.map(function(c) {
      var score = c.score;
      var path = c.path || 0; // roads are valued
      if (path) {
        path = Math.pow(path, 0.2);
        var crossroad = c.crossroad || 0; // crossroads are valued
        score = score + path + crossroad;     
      } 
      c.score = rn(Math.random() * score + score, 2); // 0.5 random factor
    });
    land.sort(function(a, b) {return b.score - a.score;});
    console.timeEnd('rankPlacesEconomy');
  }
 
   // get population for manors and states
  function calculatePopulation() {
    // rank all burgs to get final scores (population); what attracts trade/people 
    manors.map(function(m) {
      var cell = cells[m.cell];
      var score = cell.score;
      if (score <= 0) {score = rn(Math.random(), 2)}
      if (cell.crossroad) {score += cell.crossroad;} // crossroads
      if (cell.confluence) {score += Math.pow(cell.confluence, 0.3);} // confluences
      if (m.i !== m.region && cell.port) {score *= 1.5;} // ports (not capital)
      if (m.i === m.region && !cell.port) {score *= 2;} // land-capitals
      if (m.i === m.region && cell.port) {score *= 3;} // port-capitals
      m.population = rn(score, 1);
    });
    // calculate population for each region
    states.map(function(s, i) {
      // define region burgs count
      var burgs = $.grep(manors, function(e) {return (e.region === i);});
      s.burgs = burgs.length;  
      // define region total and burgs population
      var burgsPop = 0; // get summ of all burgs population
      burgs.map(function(b) {burgsPop += b.population;});
      s.urbanPopulation = rn(burgsPop, 2);
      var regionCells = $.grep(cells, function(e) {return (e.region === i);});
      var cellsScore = 0; // cells score based on elevation (but should be biome)
      regionCells.map(function(c) {cellsScore += Math.pow((1 - c.height), 3) * 10;});
      s.cells = regionCells.length;
      var graphSizeAdj = 90 / Math.sqrt(cells.length, 2); // adjust to different graphSize
      s.ruralPopulation = rn(cellsScore * graphSizeAdj, 2);
    });
    // collect data for neutrals
    var burgs = $.grep(manors, function(e) {return (e.region === "neutral");});
    if (burgs.length > 0) {
      // decrease neutral land population as neutral lands usually are pretty wild
      var ruralFactor = 0.5, urbanFactor = 0.9;
      var burgsPop = 0;
      burgs.map(function(b) {
        manors[b.i].population = rn(manors[b.i].population * urbanFactor, 1);
        burgsPop += b.population;
      });
      var urbanPopulation = rn(burgsPop, 2);
      var regionCells = $.grep(cells, function(e) {return (e.region === "neutral");});
      var cellsScore = 0, area = 0;
      regionCells.map(function(c) {
        cellsScore += Math.pow((1 - c.height), 3) * 10;
        area += rn(Math.abs(d3.polygonArea(polygons[c.index])));
      });
      var graphSizeAdj = 90 / Math.sqrt(cells.length, 2);
      ruralPopulation = rn(cellsScore * graphSizeAdj * ruralFactor, 2);
      states.push({i: states.length, color: "neutral", name: "Neutrals", capital: "neutral", cells: regionCells.length, burgs: burgs.length, urbanPopulation, ruralPopulation, area});
    }
  }
   
  // Locate cultures
  function locateCultures() {
    var cultureCenters = d3.range(7).map(function(d) {return [Math.random() * mapWidth, Math.random() * mapHeight];});
    cultureTree = d3.quadtree().extent([[0, 0], [mapHeight, mapWidth]]).addAll(cultureCenters);;
  }

  function locateCapitals() {
    console.time('locateCapitals');
    var spacing = mapWidth / capitalsCount;
    manorTree = d3.quadtree().extent([[0, 0], [mapHeight, mapWidth]]);
    console.log(" countries: " + capitalsCount);
    for (var l = 0; l < land.length && manors.length < capitalsCount; l++) {
      var m = manors.length;
      var dist = 10000; // dummy value
      if (l > 0) {
        var closest = manorTree.find(land[l].data[0], land[l].data[1]);
        dist = Math.hypot(land[l].data[0] - closest[0], land[l].data[1] - closest[1]);
      }
      if (dist >= spacing) {
        var cell = land[l].index;
        shiftSettlement(land[l], "capital"); 
        queue.push(cell);
        queue.push(...land[l].neighbors);
        var closest = cultureTree.find(land[l].data[0], land[l].data[1]);
        var culture = cultureTree.data().indexOf(closest);
        var name = generateName(culture);
        manors.push({i: m, cell, x: land[l].data[0], y: land[l].data[1], region: m, culture, name});
        manorTree.add([land[l].data[0], land[l].data[1]]);
      }
      if (l === land.length - 1) {
        console.error("Cannot place capitals with current spacing. Trying again with reduced spacing");
        l = -1, manors = [], queue = [];
        manorTree = d3.quadtree().extent([[0, 0], [mapHeight, mapWidth]]);
        spacing /= 1.2;
      }
    }
    // define color scheme for resions
    var scheme = capitalsCount <= 8 ? colors8 : colors20;
    manors.map(function(e, i) {
      var mod = +powerInput.value;
      var power = rn(Math.random() * mod / 2 + 1, 1);
      var color = scheme(i / capitalsCount);
      states.push({i, color, power, capital: i});
      states[i].name = generateStateName(i);
      var p = cells[e.cell];
      p.manor = i;
      p.region = i; 
      p.culture = e.culture;
    });
    console.timeEnd('locateCapitals');
  }

  function locateTowns() {
    console.time('locateTowns');
    for (var l = 0; l < land.length && manors.length < manorsCount; l++) {
      if (queue.indexOf(land[l].index) == -1) {
        queue.push(land[l].index);
        if (land[l].ctype || Math.random() > 0.6) {queue.push(...land[l].neighbors);}
        shiftSettlement(land[l], "town");
        var x = land[l].data[0];
        var y = land[l].data[1];
        var cell = land[l].index;        
        var region = "neutral", culture = -1, closest = neutral;
        for (c = 0; c < capitalsCount; c++) {
          var dist = Math.hypot(manors[c].x - x, manors[c].y - y) / states[c].power;
          var cap = manors[c].cell;
          if (cells[cell].fn !== cells[cap].fn) {dist *= 3;}
          if (dist < closest) {region = c; closest = dist;}
        }
        if (closest > neutral / 5 || region === "neutral") {
          var closestCulture = cultureTree.find(x, y);
          culture = cultureTree.data().indexOf(closestCulture);
        } else {
          culture = manors[region].culture;
        }
        var name = generateName(culture);
        land[l].manor = manors.length;
        land[l].culture = culture;
        land[l].region = region;
        manors.push({i: manors.length, cell, x, y, region, culture, name});
      }
      if (l === land.length - 1) {
        console.error("Cannot place all towns. Towns requested: " + manorsCount + ". Towns placed: " + manors.length);
      }
    }
    console.timeEnd('locateTowns');
  }
  
  function shiftSettlement(cell, type) {
    if ((type === "capital" && cell.harbor) || (type === "town" && cell.harbor === 1)) {
      cell.port = true;
      cell.data[0] = cell.coastX;
      cell.data[1] = cell.coastY;
    }
    if (cell.river) {
      var shift = 0.2 * cell.flux;
      if (shift < 0.2) {shift = 0.2;}
      if (shift > 1) {shift = 1;}
      shift = Math.random() > .5 ? shift : shift * -1;
      cell.data[0] += shift;
      shift = Math.random() > .5 ? shift : shift * -1;
      cell.data[1] += shift;
      cell.data[0] = rn(cell.data[0], 2);
      cell.data[1] = rn(cell.data[1], 2);
    }      
  }
  
  // Validate each island with manors has at least one port (so Island is accessible)
  function checkAccessibility() {
    console.time("checkAccessibility");
    for (var i = 0; i < island; i++) {
      var manorsOnIsland = $.grep(land, function(e) {return (typeof e.manor !== "undefined" && e.fn === i);});
      if (manorsOnIsland.length > 0) {
        var ports = $.grep(manorsOnIsland, function(p) {return (p.port);});
        if (ports.length === 0) {
          var portCandidates = $.grep(manorsOnIsland, function(c) {return (c.harbor && c.ctype === 1);});
          if (portCandidates.length > 0) {
            // No ports on island. Upgrading first burg to port
            portCandidates[0].harbor = 1;
            portCandidates[0].port = true;
            portCandidates[0].data[0] = portCandidates[0].coastX;
            portCandidates[0].data[1] = portCandidates[0].coastY;
            var manor = manors[portCandidates[0].manor];
            manor.x = portCandidates[0].coastX;
            manor.y = portCandidates[0].coastY;
            // add 1 score point for every other burg on island (as it's the only port)
            portCandidates[0].score += Math.floor((portCandidates.length - 1) / 2);
          } else {
            // No ports on island. Reducing score for burgs
            manorsOnIsland.map(function(e) {e.score -= 2;});
          }
        }
      }
    }
  console.timeEnd("checkAccessibility");
  }

  function generateMainRoads() {
    console.time("generateMainRoads");
    for (var i = 0; i < island; i++) {
      var manorsOnIsland = $.grep(land, function(e) {return (typeof e.manor !== "undefined" && e.fn === i);});
      if (manorsOnIsland.length > 1) {
        for (var d = 1; d < manorsOnIsland.length; d++) {
          for (var m = 0; m < d; m++) {
            var path = findLandPath(manorsOnIsland[d].index, manorsOnIsland[m].index, "main");
            restorePath(manorsOnIsland[m].index, manorsOnIsland[d].index, "main", path);
          }
        }
      }
    }
    console.timeEnd("generateMainRoads");
  }

  function generatePortRoads() {
    console.time("generatePortRoads");
    var landCapitals = $.grep(land, function(e) {return (e.manor < capitalsCount && !e.port);});
    landCapitals.map(function(e) {
      var ports = $.grep(land, function(l) {return (l.port && l.region === e.manor);});
      var minDist = 1000, end = -1;
      ports.map(function(p) {
        var dist = Math.hypot(e.data[0] - p.data[0], e.data[1] - p.data[1]);
        if (dist < minDist) {minDist = dist; end = p.index;}        
      });
      if (end !== -1) {
        var start = e.index;
        var path = findLandPath(start, end, "direct");
        restorePath(end, start, "main", path);
      }
    });
    console.timeEnd("generatePortRoads");
  }

  function generateSmallRoads() {
    console.time("generateSmallRoads");
    lineGen.curve(d3.curveBasis);
    for (var i = 0; i < island; i++) {
      var manorsOnIsland = $.grep(land, function(e) {return (typeof e.manor !== "undefined" && e.fn === i);});
      var l = manorsOnIsland.length;
      if (l > 1) {
        var secondary = rn((l + 8) / 10);
        for (s = 0; s < secondary; s++) {
          var start = manorsOnIsland[Math.floor(Math.random() * l)].index;
          var end = manorsOnIsland[Math.floor(Math.random() * l)].index;
          var dist = Math.hypot(cells[start].data[0] - cells[end].data[0], cells[start].data[1] - cells[end].data[1]);
          if (dist > 10) {
            var path = findLandPath(start, end, "direct");
            restorePath(end, start, "small", path);            
          }
        }
        manorsOnIsland.map(function(e, d) {
          if (!e.path && d > 0) {
            var start = e.index, end = -1;
            var road = $.grep(land, function(e) {return (e.path && e.fn === i);});
            if (road.length > 0) {
              var minDist = 10000;
              road.map(function(i) {
                var dist = Math.hypot(e.data[0] - i.data[0], e.data[1] - i.data[1]);
                if (dist < minDist) {minDist = dist; end = i.index;}
              });
            } else {
              end = manorsOnIsland[0].index;
            }
            var path = findLandPath(start, end, "main");
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
    var ports = [];
    for (var i = 0; i < island; i++) {
      var portsOnIsland = $.grep(land, function(e) {return (e.fn === i && e.port);});
      if (portsOnIsland.length) {ports.push(portsOnIsland);}
    }
    ports.sort(function(a, b) {return b.length - a.length;});
    for (var i = 0; i < ports.length; i++) {
      var start = ports[i][0].index;
      var paths = findOceanPaths(start, -1);
      // draw anchor icons
      for (var p = 0; p < ports[i].length; p++) {
        var x = ports[i][p].data[0];
        var y = ports[i][p].data[1];
        icons.append("use").attr("xlink:href", "#icon-anchor").attr("x", x - 0.5).attr("y", y - 0.44).attr("width", 1).attr("height", 1)
          .call(d3.drag().on("start", elementDrag));
      }
      var length = ports[i].length; // ports on island
      // routes from all ports on island to 1st port on island
      for (var h = 1; h < length; h++) {
        var end = ports[i][h].index;
        restorePath(end, start, "ocean", paths);
      }
      // inter-island routes
      for (var c = i + 1; c < ports.length; c++) {
        if (i === 0 || (ports[c].length > 2 && length > 3)) {
          var end = ports[c][0].index;
          restorePath(end, start, "ocean", paths);
        }
      }
      if (length > 5) {
        ports[i].sort(function(a, b) {return b.cost - a.cost;});
        for (var a = 2; a < length && a < 10; a++) {
          var dist = Math.hypot(ports[i][1].data[0] - ports[i][a].data[0], ports[i][1].data[1] - ports[i][a].data[1]);
          var distPath = getPathDist(ports[i][1].index, ports[i][a].index);
          if (distPath > dist * 4 + 10) {
            var totalCost = ports[i][1].cost + ports[i][a].cost;
            var paths = findOceanPaths(ports[i][1].index, ports[i][a].index);
            if (ports[i][a].cost < totalCost) {
              restorePath(ports[i][a].index, ports[i][1].index, "ocean", paths);
              break;
            }
          }
        }
      }
    }
    console.timeEnd("generateOceanRoutes");
  }

  function findLandPath(start, end, type) {
    // A* algorithm
    var queue = new PriorityQueue({comparator: function(a, b) {return a.p - b.p}});
    var cameFrom = [];
    var costTotal = [];
    costTotal[start] = 0;
    queue.queue({e: start, p: 0});
    while (queue.length > 0) {
      var next = queue.dequeue().e;
      if (next === end) {break;}
      var pol = cells[next];
      pol.neighbors.forEach(function(e) {
        if (cells[e].height >= 0.2) {
          var cost = cells[e].height * 2;
          if (cells[e].path && type === "main") {
            cost = 0.15;
          } else {
            if (typeof e.manor === "undefined") {cost += 0.1;}
            if (typeof e.river !== "undefined") {cost -= 0.1;}
            if (cells[e].harbor) {cost *= 0.3;}
            if (cells[e].path) {cost *= 0.5;}
            cost += Math.hypot(cells[e].data[0] - pol.data[0], cells[e].data[1] - pol.data[1]) / 30;
          }
          var costNew = costTotal[next] + cost;
          if (!cameFrom[e] || costNew < costTotal[e]) { //  
            costTotal[e] = costNew;
            cameFrom[e] = next;
            var dist = Math.hypot(cells[e].data[0] - cells[end].data[0], cells[e].data[1] - cells[end].data[1]) / 15;
            var priority = costNew + dist;
            queue.queue({e, p: priority});
          }
        }
      });
    }
    return cameFrom;
  } 

  function findLandPaths(start, type) {
    // Dijkstra algorithm (not used now)
    var queue = new PriorityQueue({comparator: function(a, b) {return a.p - b.p}});
    var cameFrom = [];
    var costTotal = [];
    cameFrom[start] = "no";
    costTotal[start] = 0;
    queue.queue({e: start, p: 0});
    while (queue.length > 0) {
      var next = queue.dequeue().e;
      var pol = cells[next];
      pol.neighbors.forEach(function(e) {
        var cost = cells[e].height;
        if (cost >= 0.2) {
          cost *= 2;
          if (typeof e.river !== "undefined") {cost -= 0.2;}
          if (pol.region !== cells[e].region) {cost += 1;}
          if (cells[e].region === "neutral") {cost += 1;}
          if (typeof e.manor !== "undefined") {cost = 0.1;}
          var costNew = costTotal[next] + cost;
          if (!cameFrom[e]) {
            costTotal[e] = costNew;
            cameFrom[e] = next;
            queue.queue({e, p: costNew});
          }
        }
      });
    }
    return cameFrom;
  }

  function findOceanPaths(start, end) {
    var queue = new PriorityQueue({comparator: function(a, b) {return a.p - b.p}});
    var next, cameFrom = [], costTotal = [];
    cameFrom[start] = "no", costTotal[start] = 0;
    queue.queue({e: start, p: 0});
    while (queue.length > 0 && next !== end) {
      next = queue.dequeue().e;
      var pol = cells[next];
      pol.neighbors.forEach(function(e) {
        if (cells[e].ctype < 0 || cells[e].haven === next) {
          var cost = 1;
          if (cells[e].ctype > 0) {cost += 100;}
          if (cells[e].ctype < -1) {
            var dist = Math.hypot(cells[e].data[0] - pol.data[0], cells[e].data[1] - pol.data[1]);
            cost += 50 + dist * 2;
          }
          if (cells[e].path && cells[e].ctype < 0) {cost *= 0.8;}
          var costNew = costTotal[next] + cost;
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
    var queue = new PriorityQueue({comparator: function(a, b) {return a.p - b.p}});
    var next, costNew;
    var cameFrom = [];
    var costTotal = [];
    cameFrom[start] = "no";
    costTotal[start] = 0;
    queue.queue({e: start, p: 0});
    while (queue.length > 0 && next !== end) {
      next = queue.dequeue().e;
      var pol = cells[next];
      pol.neighbors.forEach(function(e) {
        if (cells[e].path && (cells[e].ctype === -1 || cells[e].haven === next)) {
          var dist = Math.hypot(cells[e].data[0] - pol.data[0], cells[e].data[1] - pol.data[1]);
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
    var path = [], current = end, limit = 1000;
    var prev = cells[end];
    if (type === "ocean" || !prev.path) {path.push({scX: prev.data[0], scY: prev.data[1], i: end});}
    if (!prev.path) {prev.path = 1;}
    for (var i = 0; i < limit; i++) {
      current = from[current];
      var cur = cells[current];
      if (!cur) {break;}
      if (cur.path) {
        cur.path += 1;
        path.push({scX: cur.data[0], scY: cur.data[1], i: current});
        prev = cur;
        drawPath();
      } else {
        cur.path = 1;
        if (prev) {path.push({scX: prev.data[0], scY: prev.data[1], i: prev.index});}
        prev = undefined;
        path.push({scX: cur.data[0], scY: cur.data[1], i: current});
      }
      if (current === start || !from[current]) {break;}
    }
    drawPath();
    function drawPath() {
      if (path.length > 1) {
        // mark crossroades
        if (type === "main" || type === "small") {
          var plus = type === "main" ? 4 : 2;
          var f = cells[path[0].i];
          if (f.path > 1) {
            if (!f.crossroad) {f.crossroad = 0;}
            f.crossroad += plus;     
          }
          var t = cells[(path[path.length - 1].i)];
          if (t.path > 1) {
            if (!t.crossroad) {t.crossroad = 0;}
            t.crossroad += plus;
          }
        }
        // draw path segments
        var line = lineGen(path);
        line = round(line, 1);
        if (type === "main") {
          roads.append("path").attr("d", line).attr("data-start", start).attr("data-end", end);  
        } else if (type === "small") {
          trails.append("path").attr("d", line);
        } else if (type === "ocean") {
          searoutes.append("path").attr("d", line);
        }
      }
      path = [];
    }
  }

  // Append manors with random / generated names
  // For each non-capital manor detect the closes capital (used for areas)
  function drawManors() {
    console.time('drawManors');
    for (var i = 0; i < manors.length; i++) {
      var x = manors[i].x;
      var y = manors[i].y;
      var cell = manors[i].cell;
      var name = manors[i].name;
      if (i < capitalsCount) {
        burgs.append("circle").attr("id", "manorIcon"+i).attr("r", 1).attr("stroke-width", .24).attr("class", "manor").attr("cx", x).attr("cy", y);
        capitals.append("text").attr("id", "manorLabel"+i).attr("x", x).attr("y", y).attr("dy", -1.3).text(name);      
      } else {
        burgs.append("circle").attr("id", "manorIcon"+i).attr("r", .5).attr("stroke-width", .12).attr("class", "manor").attr("cx", x).attr("cy", y);
        towns.append("text").attr("id", "manorLabel"+i).attr("x", x).attr("y", y).attr("dy", -.7).text(name);
      }
    }
    labels.selectAll("text").on("click", editLabel);
    burgs.selectAll("circle").call(d3.drag().on("start", elementDrag));
    console.timeEnd('drawManors');
  }

  // calculate Markov's chain from real data
  function calculateChains() {
    var vowels = "aeiouy";
    for (var l = 0; l < cultures.length; l++) {
      var probs = []; // Coleshill -> co les hil l-com
      var inline = manorNames[l].join(" ").toLowerCase();
      var syl = "";
      for (var i = -1; i < inline.length - 2;) {
        if (i < 0) {var f = " ";} else {var f = inline[i];}
        var str = "", vowel = 0;
        for (var c = i+1; str.length < 5; c++) {
          if (inline[c] === undefined) {break;}
          str += inline[c];
          if (str === " ") {break;}
          if (inline[c] !== "o" && inline[c] !== "e" && vowels.includes(inline[c]) && inline[c+1] === inline[c]) {break;}
          if (inline[c+2] === " ") {str += inline[c+1]; break;}
          if (vowels.includes(inline[c])) {vowel++;}
          if (vowel && vowels.includes(inline[c+2])) {break;}
        }
        i += str.length;
        probs[f] = probs[f] || [];
        probs[f].push(str);
      }
      chain[l] = probs;
    }
  }

  // generate random name using Markov's chain
  function generateName(culture) {
    var data = chain[culture], res = "", next = data[" "];
    var cur = next[Math.floor(Math.random() * next.length)];
    while (res.length < 7) {
      var l = cur.charAt(cur.length - 1);
      if (cur !== " ") {
        res += cur;
        next = data[l]; 
        cur = next[Math.floor(Math.random() * next.length)];
      } else if (res.length > 2 + Math.floor(Math.random() * 5)) {
        break;
      } else {
        next = data[" "];
        cur = next[Math.floor(Math.random() * next.length)];
      }
    }
    var name = res.charAt(0).toUpperCase() + res.slice(1);
    return name;
  }
  
  // Define areas based on the closest manor to a polygon
  function defineRegions() {
    console.time('defineRegions');
    manorTree = d3.quadtree().extent([[0, 0], [mapHeight, mapWidth]]);
    manors.map(function(m) {manorTree.add([m.x, m.y]);});
    land.map(function(i) {
      if (i.region !== undefined) {return;}
      var x = i.data[0], y = i.data[1];
      var closest = manorTree.find(x, y);
      var dist = Math.hypot(closest[0] - x, closest[1] - y);
      if (dist > neutral / 2) {
        i.region = "neutral";
        var closestCulture = cultureTree.find(i.data[0], i.data[1]);
        i.culture = cultureTree.data().indexOf(closestCulture);            
      } else {
        var manor = $.grep(manors, function(e) {return (e.x === closest[0] && e.y === closest[1]);});
        var cell = manor[0].cell;
        if (cells[cell].fn !== i.fn) {
          var minDist = dist * 3;
          land.map(function(l) {
            if (l.fn === i.fn && l.manor !== undefined) {
              var distN = Math.hypot(l.data[0] - i.data[0], l.data[1] - i.data[1]);
              if (distN < minDist) {minDist = distN; cell = l.index;}
            }
          });
        }
        i.region = cells[cell].region;
        i.culture = cells[cell].culture;
      }
    });
    console.timeEnd('defineRegions');
  }

  // Define areas cells
  function drawRegions() {
    console.time('drawRegions');
    var edges = [], coastalEdges = [], borderEdges = [], neutralEdges = []; // arrays to store edges
    land.map(function(l) {
      var s = l.region;
      if (!edges[s]) {edges[s] = [], coastalEdges[s] = [];}
      var cell = diagram.cells[l.index];
      cell.halfedges.forEach(function(e) {
        var edge = diagram.edges[e];
        if (edge.left && edge.right) {
          var ea = edge.left.index;
          if (ea === l.index) {ea = edge.right.index;}
          var opp = cells[ea];
          if (opp.region !== s) {
            var start = edge[0].join(" ");
            var end = edge[1].join(" ");
            edges[s].push({start, end});
            if (opp.height >= 0.2 && opp.region > s) {borderEdges.push({start, end});}
            if (opp.height >= 0.2 && opp.region === "neutral") {neutralEdges.push({start, end});}
            if (opp.height < 0.2) {coastalEdges[s].push({start, end});}
          }
        }
      })
    });
    edges.map(function(e, i) {
      if (e.length) {
        drawRegion(e, i);
        drawRegionCoast(coastalEdges[i], i);
      }
    });
    drawBorders(borderEdges, "state");
    drawBorders(neutralEdges, "neutral");
    console.timeEnd('drawRegions');
  }

  function drawRegion(edges, region) {
    var path = "", array = [];
    lineGen.curve(d3.curveLinear);
    while (edges.length > 2) {
      var edgesOrdered = []; // to store points in a correct order
      var start = edges[0].start;
      var end = edges[0].end;
      edges.shift();
      var spl = start.split(" ");
      edgesOrdered.push({scX: spl[0], scY: spl[1]});
      spl = end.split(" ");
      edgesOrdered.push({scX: spl[0], scY: spl[1]});
      for (var i = 0; end !== start && i < 2000; i++) {
        var next = $.grep(edges, function(e) {return (e.start == end || e.end == end);});
        if (next.length > 0) {
          if (next[0].start == end) {
            end = next[0].end;
          } else if (next[0].end == end) {
            end = next[0].start;
          }
          spl = end.split(" ");
          edgesOrdered.push({scX: spl[0], scY: spl[1]});
        }
        var rem = edges.indexOf(next[0]);
        edges.splice(rem, 1);
      }
      path += lineGen(edgesOrdered) + "Z ";
      var edgesFormatted = [];
      edgesOrdered.map(function(e) {edgesFormatted.push([+e.scX, +e.scY])});
      array[array.length] = edgesFormatted;
    }
    var color = states[region].color;
    regions.append("path").attr("d", round(path, 1)).attr("fill", color).attr("stroke", "none").attr("class", "region"+region);
    array.sort(function(a, b){return b.length - a.length;});
    var name = states[region].name;
    var c = polylabel(array, 1.0); // pole of inaccessibility
    countries.append("text").attr("id", "regionLabel"+region).attr("x", rn(c[0])).attr("y", rn(c[1])).text(name).on("click", editLabel);      
    states[region].area = rn(Math.abs(d3.polygonArea(array[0]))); // define region area
  }

  function drawRegionCoast(edges, region) {
    var path = "";
    while (edges.length > 0) {
      var edgesOrdered = []; // to store points in a correct order
      var start = edges[0].start;
      var end = edges[0].end;
      edges.shift();
      var spl = start.split(" ");
      edgesOrdered.push({scX: spl[0], scY: spl[1]});
      spl = end.split(" ");
      edgesOrdered.push({scX: spl[0], scY: spl[1]});
      var next = $.grep(edges, function(e) {return (e.start == end || e.end == end);});
      while (next.length > 0) {
        if (next[0].start == end) {
          end = next[0].end;
        } else if (next[0].end == end) {
          end = next[0].start;
        }
        spl = end.split(" ");
        edgesOrdered.push({scX: spl[0], scY: spl[1]});
        var rem = edges.indexOf(next[0]);
        edges.splice(rem, 1);
        next = $.grep(edges, function(e) {return (e.start == end || e.end == end);});
      }
      path += lineGen(edgesOrdered);
    }
    var color = states[region].color;
    regions.append("path").attr("d", round(path, 1)).attr("fill", "none").attr("stroke", color).attr("stroke-width", 1.5).attr("class", "region"+region); 
  }

  function drawBorders(edges, type) {
    var path = "";
    if (edges.length < 1) {return;}
    while (edges.length > 0) {
      var edgesOrdered = []; // to store points in a correct order
      var start = edges[0].start;
      var end = edges[0].end;
      edges.shift();
      var spl = start.split(" ");
      edgesOrdered.push({scX: spl[0], scY: spl[1]});
      spl = end.split(" ");
      edgesOrdered.push({scX: spl[0], scY: spl[1]});
      var next = $.grep(edges, function(e) {return (e.start == end || e.end == end);});
      while (next.length > 0) {
        if (next[0].start == end) {
          end = next[0].end;
        } else if (next[0].end == end) {
          end = next[0].start;
        }
        spl = end.split(" ");
        edgesOrdered.push({scX: spl[0], scY: spl[1]});
        var rem = edges.indexOf(next[0]);
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
    var culture = state;
    if (states[state]) if(manors[states[state].capital]) {culture = manors[states[state].capital].culture;}
    var name = Math.random() < 0.8 ? generateName(culture) : manors[state].name;
    var suffix = "ia"; // common latin suffix
    var vowels = "aeiouy";
    if (Math.random() < 0.05 && (culture == 3 || culture == 4)) {suffix = "terra";} // 5% "terra" for Italian and Spanish
    if (Math.random() < 0.05 && culture == 2) {suffix = "terre";} // 5% "terre" for French
    if (Math.random() < 0.5 && culture == 0) {suffix = "land";} // 50% "land" for German
    if (Math.random() < 0.33 && (culture == 1 || culture == 6)) {suffix = "land";} // 33% "land" for English and Scandinavian
    if (culture == 5 && name.slice(-2) === "sk") {name.slice(0,-2);} // exclude -sk suffix for Slavic
    if (name.indexOf(suffix) !== -1) {suffix = "";} // null suffix if name already contains it 
    var ending = name.slice(-1);
    if (vowels.includes(ending) && name.length > 3) {
      if (Math.random() > 0.2) {
        ending = name.slice(-2,-1);
        if (vowels.includes(ending)) {
          name = name.slice(0,-2) + suffix; // 80% for vv
        } else if (Math.random() > 0.2) {
          name = name.slice(0,-1) + suffix; // 64% for cv
        }
      }
    } else if (Math.random() > 0.5) {
      name += suffix // 50% for cc
    } 
    if (name.slice(-4) === "berg") {name += suffix;} // special case for -berg
    return name;    
  }

  // draw the Heightmap
  function toggleHeight() {
    var scheme = styleSchemeInput.value;
    var hColor = color;
    if (scheme === "light") {hColor = d3.scaleSequential(d3.interpolateRdYlGn);}
    if (scheme === "green") {hColor = d3.scaleSequential(d3.interpolateGreens);}
    if (scheme === "monochrome") {hColor = d3.scaleSequential(d3.interpolateGreys);}
    if (terrs.selectAll("path").size() == 0) {
      land.map(function(i) {
        terrs.append("path")
          .attr("d", "M" + polygons[i.index].join("L") + "Z")
          .attr("fill", hColor(1 - i.height))
          .attr("stroke", hColor(1 - i.height));
      });
    } else {
      terrs.selectAll("path").remove();
    }
  }

  // draw Cultures
  function toggleCultures() {
    if (cults.selectAll("path").size() == 0) {
      land.map(function(i) {
        cults.append("path")
          .attr("d", "M" + polygons[i.index].join("L") + "Z")
          .attr("fill", colors8(i.culture / cultures.length))
          .attr("stroke", colors8(i.culture / cultures.length));
      });
    } else {
      cults.selectAll("path").remove();
    }
  }

  // draw Overlay
  function toggleOverlay() {
    if (overlay.selectAll("*").size() === 0) {
      var type = styleOverlayType.value;
      var size = +styleOverlaySize.value;
      if (type === "hex") {
        var hexbin = d3.hexbin().radius(size).size([mapWidth, mapHeight]);
        overlay.append("path").attr("d", round(hexbin.mesh(), 0));        
      } else if (type === "square") {
        var x = d3.range(size, mapWidth, size);
        var y = d3.range(size, mapHeight, size);
        overlay.append("g").selectAll("line").data(x).enter().append("line")
          .attr("x1", function(d) {return d;})
          .attr("x2", function(d) {return d;})
          .attr("y1", 0).attr("y2", mapHeight);
        overlay.append("g").selectAll("line").data(y).enter().append("line")
          .attr("y1", function(d) {return d;})
          .attr("y2", function(d) {return d;})
          .attr("x1", 0).attr("x2", mapWidth);
      } else {
        var tr = `translate(80 80) scale(${size / 25})`;
        d3.select("#rose").attr("transform", tr);
        overlay.append("use").attr("xlink:href","#rose");
      }
      overlay.call(d3.drag().on("start", elementDrag));
    } else {
      overlay.selectAll("*").remove();
    }
  }

  // clean data to get rid of redundand info
  function cleanData() {
    console.time("cleanData");
    cells.map(function(c) {
      delete c.cost;
      delete c.used;
      delete c.coastX;
      delete c.coastY;
    });
    // restore heightmap layer if it was turned on
    if (!$("#toggleHeight").hasClass("buttonoff") && !terrs.selectAll("path").size()) {toggleHeight();}
    console.timeEnd("cleanData");
  }
  
  // Draw the water flux system (for dubugging)
  function toggleFlux() {
    var colorFlux = d3.scaleSequential(d3.interpolateBlues);
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
    var ea, edge, id, cell, x, y, height, path, dash = "", rnd, count;
    var hill = [], hShade = [], swamp = "", swampCount = 0, forest = "", fShade = "", fLight = "", swamp = "";
    hill[0] = "", hill[1] = "", hShade[0] = "", hShade[1] = "";
    var strokes = terrain.append("g").attr("id", "strokes"),
      hills = terrain.append("g").attr("id", "hills"),
      mounts = terrain.append("g").attr("id", "mounts"),
      swamps = terrain.append("g").attr("id", "swamps"),
      forests = terrain.append("g").attr("id", "forests");
    // sort the land to Draw the top element first (reduce the elements overlapping)
    land.sort(compareY);
    for (i = 0; i < land.length; i++) {
      x = land[i].data[0];
      y = land[i].data[1];
      height = land[i].height;
      if (height >= 0.7 && !land[i].river) {
        h = (height - 0.55) * 12;
        if (height < 0.8) {
          count = 2;
        } else {
          count = 1;
        }
        rnd = Math.random() * 0.8 + 0.2;
        for (c = 0; c < count; c++) {
          cx = x - h * 0.9 - c;
          cy = y + h / 4 + c / 2;
          path = "M " + cx + "," + cy + " L " + (cx + h / 3 + rnd) + "," + (cy - h / 4 - rnd * 1.2) + " L " + (cx + h / 1.1) + "," + (cy - h) + " L " + (cx + h + rnd) + "," + (cy - h / 1.2 + rnd) + " L " + (cx + h * 2) + "," + cy;
          mounts.append("path").attr("d", path).attr("stroke", "#5c5c70");
          path = "M " + cx + "," + cy + " L " + (cx + h / 3 + rnd) + "," + (cy - h / 4 - rnd * 1.2) + " L " + (cx + h / 1.1) + "," + (cy - h) + " L " + (cx + h / 1.5) + "," + cy;
          mounts.append("path").attr("d", path).attr("fill", "#999999");
          dash += "M" + (cx - 0.1) + "," + (cy + 0.3) + " L" + (cx + 2 * h + 0.1) + "," + (cy + 0.3);
        }
        dash += "M" + (cx + 0.4) + "," + (cy + 0.6) + " L" + (cx + 2 * h - 0.3) + "," + (cy + 0.6);
      } else if (height > 0.5 && !land[i].river) {
        h = (height - 0.4) * 10;
        count = Math.floor(4 - h);
        if (h > 1.8) {
          h = 1.8
        }
        for (c = 0; c < count; c++) {
          cx = x - h - c;
          cy = y + h / 4 + c / 2;
          hill[c] += "M" + cx + "," + cy + " Q" + (cx + h) + "," + (cy - h) + " " + (cx + 2 * h) + "," + cy;
          hShade[c] += "M" + (cx + 0.6 * h) + "," + (cy + 0.1) + " Q" + (cx + h * 0.95) + "," + (cy - h * 0.91) + " " + (cx + 2 * h * 0.97) + "," + cy;
          dash += "M" + (cx - 0.1) + "," + (cy + 0.2) + " L" + (cx + 2 * h + 0.1) + "," + (cy + 0.2);
        }
        dash += "M" + (cx + 0.4) + "," + (cy + 0.4) + " L" + (cx + 2 * h - 0.3) + "," + (cy + 0.4);
      }
      if (height >= 0.21 && height < 0.22 && !land[i].river && swampCount < swampiness && land[i].used != 1) {
        swampCount++;
        land[i].used = 1;
        swamp += drawSwamp(x, y);
        id = land[i].index;
        cell = diagram.cells[id];
        cell.halfedges.forEach(function(e) {
          edge = diagram.edges[e];
          ea = edge.left.index;
          if (ea === id || !ea) {
            ea = edge.right.index;
          }
          if (cells[ea].height >= 0.2 && cells[ea].height < 0.3 && !cells[ea].river && cells[ea].used != 1) {
            cells[ea].used = 1;
            swamp += drawSwamp(cells[ea].data[0], cells[ea].data[1]);
          }
        })
      }
      if (Math.random() < height && height >= 0.22 && height < 0.48 && !land[i].river) {
        for (c = 0; c < Math.floor(height * 8); c++) {
          h = 0.6;
          if (c == 0) {
            cx = x - h - Math.random();
            cy = y - h - Math.random();
          }
          if (c == 1) {
            cx = x + h + Math.random();
            cy = y + h + Math.random();
          }
          if (c == 2) {
            cx = x - h - Math.random();
            cy = y + 2 * h + Math.random();
          }
          forest += "M " + cx + " " + cy + " q -1 0.8 -0.05 1.25 v 0.75 h 0.1 v -0.75 q 0.95 -0.47 -0.05 -1.25 z";
          fLight += "M " + cx + " " + cy + " q -1 0.8 -0.05 1.25 h 0.1 q 0.95 -0.47 -0.05 -1.25 z";
          fShade += "M " + cx + " " + cy + " q -1 0.8 -0.05 1.25 q -0.2 -0.55 0 -1.1 z";
        }
      }
    }
    // draw all these stuff
    strokes.append("path").attr("d", round(dash, 1));
    hills.append("path").attr("d", round(hill[0], 1)).attr("stroke", "#5c5c70");
    hills.append("path").attr("d", round(hShade[0], 1)).attr("fill", "white");
    hills.append("path").attr("d", round(hill[1], 1)).attr("stroke", "#5c5c70");
    hills.append("path").attr("d", round(hShade[1], 1)).attr("fill", "white").attr("stroke", "white");
    swamps.append("path").attr("d", round(swamp, 1));
    forests.append("path").attr("d", forest);
    forests.append("path").attr("d", fLight).attr("fill", "white").attr("stroke", "none");
    forests.append("path").attr("d", fShade).attr("fill", "#999999").attr("stroke", "none");
    console.timeEnd('drawRelief');
  }

  function compareY(a, b) {
    if (a.data[1] > b.data[1]) return 1;
    if (a.data[1] < b.data[1]) return -1;
    return 0;
  }

  function drawSwamp(x, y) {
    var h = 0.6, line = "";
    for (c = 0; c < 3; c++) {
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
    var el = d3.select(this);
    var x = d3.event.x;
    var y = d3.event.y;
    el.raise().classed("drag", true);
    if (el.attr("x")) {
      el.attr("x", x).attr("y", y + 0.8);
      var matrix = el.attr("transform");
      if (matrix) {
        var angle = matrix.split('(')[1].split(')')[0].split(' ')[0];
        var bbox = el.node().getBBox();
        var rotate = "rotate("+ angle + " " + (bbox.x + bbox.width/2) + " " + (bbox.y + bbox.height/2) + ")";  
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
    exitCustomization();
    console.time("TOTAL");
    applyMapSize();
    randomizeOptions();
    markFeatures();
    drawOcean();
    reGraph();
    resolveDepressions();
    flux();
    drawRelief();
    drawCoastline();
    manorsAndRegions();
    cleanData();
    console.timeEnd("TOTAL");
  }

  // Mouseclick events
  function clicked() {
    var brush = $(".pressed").attr("id");
    if (customization !== 1 && brush === "brushHill") {
      $("#"+brush).removeClass("pressed");
      brush = $(".pressed").attr("id");
    }
    if (customization === 2) {
      var cell = diagram.find(x, y).index;
      var assigned = regions.select("#temp").select("path[data-cell='"+cell+"']");
      if (assigned.size()) {var s = assigned.attr("data-state");} else {var s = cells[cell].region;}
      if (s === "neutral") {s = states.length - 1;}
      $(".selected").removeClass("selected");
      $("#state"+s).addClass("selected");
    }
    if (!brush) {return;}
    var point = d3.mouse(this);
    if ($("#riverAddPoint").hasClass('pressed')) {
      var dists = [], points = [];
      var tr = parseTransform(elSelected.attr("transform"));
      if (tr[5] == "1") {
        point[0] -= +tr[0];
        point[1] -= +tr[1];
      }
      rivers.select(".riverPoints").selectAll("circle").each(function() {
        var x = +d3.select(this).attr("cx");
        var y = +d3.select(this).attr("cy");
        dists.push(Math.hypot(point[0] - x, point[1] - y));
        points.push([x, y]);
      }).remove();
      var index = dists.length;
      if (points.length > 1) {
        var sorted = dists.slice(0).sort(function(a, b) {return a-b;});  
        var closest = dists.indexOf(sorted[0]);
        var next = dists.indexOf(sorted[1]);
        if (closest <= next) {index = closest+1;} else {index = next+1;}
      }
      points.splice(index, 0, [point[0], point[1]]);
      lineGen.curve(d3.curveCatmullRom.alpha(0.1));
      var d = drawRiver(points, 2, 1);
      elSelected.attr("d", d).attr("data-points", round(JSON.stringify(points), 1));
      points.map(function(p) {addRiverPoint(p)});
      return;
    }
    if ($("#riverNew").hasClass('pressed')) {
      if (elSelected.attr("data-river") !== "new") {          
        elSelected.call(d3.drag().on("drag", null)).classed("draggable", false);
        var river = +$("#rivers > path").last().attr("id").slice(5) + 1;
        elSelected = rivers.append("path").attr("data-river", "new").attr("id", "river"+river)
          .attr("data-width", 2).attr("data-increment", 1).on("click", editRiver);
      }
      addRiverPoint({scX:point[0], scY:point[1]});
      redrawRiver();
      return;
    }
    if (brush === "addLabel" || brush === "addBurg" || brush.includes("selectCapital")) {
      var cell = diagram.find(x, y).index;
      if (!cell) {return;}
      var x = rn(point[0], 2), y = rn(point[1], 2);
      // get culture in clicked point to generate a name
      var closest = cultureTree.find(x, y);
      var culture = cultureTree.data().indexOf(closest) || 0;
      var name = generateName(culture);
      // please label
      if (brush === "addLabel") {
        addedLabels.append("text").attr("x", x).attr("y", y).text(name).on("click", editLabel);
        if (!shift) {$("#"+brush).removeClass("pressed");} 
      }
      if (brush === "addBurg") {
        if (cells[cell].height < 0.2) {
          console.error("Cannot place burg in the water! Select a land cell");
          return;
        }
        if (cells[cell].manor !== undefined) {
          console.error("There is already a burg in this cell. Select a free cell");
          return;
        }
        var i = manors.length;
        burgs.append("circle").attr("id", "manorIcon"+i).attr("r", .5).attr("stroke-width", .12).attr("cx", x).attr("cy", y).call(d3.drag().on("start", elementDrag));
        labels.select("#towns").append("text").attr("id", "manorLabel"+i).attr("x", x).attr("y", y).attr("dy", -0.7).text(name).on("click", editLabel);
        var region, state;
        if ($("#burgAdd").hasClass("pressed")) {
          state = +$("#burgsEditor").attr("data-state");
          region = states[state].color === "neutral" ? "neutral" : state;
          var oldRegion = cells[cell].region;
          if (region !== oldRegion) {
            cells[cell].region = region;
            redrawRegions();
          }
        } else {
          region = cells[cell].region;
          state = region === "neutral" ? states.length - 1 : region;
        }
        cells[cell].manor = i;
        var score = cells[cell].score;
        if (score <= 0) {score = rn(Math.random(), 2);}
        if (cells[cell].crossroad) {score += cell.crossroad;} // crossroads
        if (cells[cell].confluence) {score += Math.pow(cell.confluence, 0.3);} // confluences
        if (cells[cell].port) {score *= 3;} // port-capital
        var population = rn(score, 1);  
        manors.push({i, cell, x, y, region, culture, name, population});
        recalculateStateData(state);
        updateCountryEditors();
        if (!shift) {
          $("#"+brush).removeClass("pressed");
          $("#burgAdd").removeClass("pressed");
          viewbox.style("cursor", "default");
        }
      }
      if (brush.includes("selectCapital")) {
        if (cells[cell].height < 0.2) {
          console.error("Cannot place capital in the water! Select a land cell");
          return;
        }
        var state = +brush.replace("selectCapital", "");
        var oldState = cells[cell].region;
        if (oldState === "neutral") {oldState = states.length - 1;}
        if (cells[cell].manor !== undefined) {
          var burg = cells[cell].manor;
          if (states[oldState].capital === burg) {
            console.error("Existing capital cannot be selected as a new state capital! Select other cell");
            return;
          } else {
            // make capital from existing burg
            var urbanFactor = 0.9; // for old neutrals
            manors[burg].region = state;
            if (oldState === "neutral") {manors[burg].population *= (1 / urbanFactor);}
            manors[burg].population *= 2; // give capital x2 population bonus
            states[state].capital = burg;
            $("#manorLabel"+burg).detach().appendTo($("#capitals")).attr("dy", -1.3);
            $("#manorIcon"+burg).attr("r", 1).attr("stroke-width", .24); 
          }
        } else {
          // create new burg for capital
          var i = manors.length;
          cells[cell].manor = i;
          states[state].capital = i;
          var score = cells[cell].score;
          if (score <= 0) {score = rn(Math.random(), 2);}
          if (cells[cell].crossroad) {score += cell.crossroad;} // crossroads
          if (cells[cell].confluence) {score += Math.pow(cell.confluence, 0.3);} // confluences
          if (cells[cell].port) {score *= 3;} // port-capital
          var population = rn(score, 1);
          manors.push({i, cell, x, y, region: state, culture, name, population});
          burgs.append("circle").attr("id", "manorIcon"+i).attr("r", 1).attr("stroke-width", .24).attr("cx", x).attr("cy", y).call(d3.drag().on("start", elementDrag));
          capitals.append("text").attr("id", "manorLabel"+i).attr("id", "manorLabel"+i).attr("x", x).attr("y", y).attr("dy", -1.3).text(name).on("click", editLabel);
        }
        cells[cell].region = state;
        cells[cell].neighbors.map(function(n) {
          if (cells[n].height < 0.2) {return;}
          if (cells[n].manor !== undefined) {return;}
          cells[n].region = state;
        });
        redrawRegions();
        recalculateStateData(oldState); // re-calc old state data
        recalculateStateData(state); // calc new state data
        editCountries();
        $("#"+brush).removeClass("pressed");
      }
      return;
    }
    if (brush === "addRiver") {
      var index = diagram.find(point[0], point[1]).index;
      var cell = cells[index];
      if (cell.river || cell.height < 0.2) {return;}
      var dataRiver = []; // to store river points
      var river = +$("#rivers > path").last().attr("id").slice(5) + 1;
      cell.flux = 0.85;
      while (cell) {
        cell.river = river;
        var x = cell.data[0], y = cell.data[1];
        dataRiver.push({x, y, cell:index});
        var heights = [];
        cell.neighbors.forEach(function(e) {heights.push(cells[e].height);});
        var minId = heights.indexOf(d3.min(heights));
        var min = cell.neighbors[minId];
        var tx = cells[min].data[0], ty = cells[min].data[1];
        if (cells[min].height < 0.2) {
          var px = (x + tx) / 2;
          var py = (y + ty) / 2;
          dataRiver.push({x: px, y: py, cell:index});
          cell = undefined;
        } else {
          if (!cells[min].river) {cells[min].flux += cell.flux; cell = cells[min];}
          if (cells[min].river) {
            var r = cells[min].river;
            var riverEl = $("#river"+r);
            var points = JSON.parse(riverEl.attr("data-points"));
            var riverCells = [];
            for (var p = 0; p < points.length; p++) {
              var c = diagram.find(points[p].scX, points[p].scY, 5);
              if (c === null) {continue;}
              if (c.index !== riverCells[riverCells.length-1]) {riverCells.push(c.index);}
            }
            if (dataRiver.length > riverCells.indexOf(min)) {
              cells[min].flux = cell.flux + cells[min].flux / 2;
              cell = cells[min];
              riverEl.remove();
              cells.map(function(c) {if (c.river === r) {c.river = undefined;}})
            } else {
              cells[min].confluence += dataRiver.length;
              cells[min].flux += cell.flux;
              dataRiver.push({x: tx, y: ty, cell:min});
              cell = undefined;
            }
          }
        }
      }
      var rndFactor = 0.2 + Math.random() * 1.6; // random factor in range 0.2-1.8
      var riverAmended = amendRiver(dataRiver, rndFactor);
      lineGen.curve(d3.curveCatmullRom.alpha(0.1));
      var d = drawRiver(riverAmended, 2, 1);
      rivers.append("path").attr("d", d).attr("id", "river"+river)
        .attr("data-points", round(JSON.stringify(riverAmended), 1))
        .attr("data-width", 2).attr("data-increment", 1).on("click", editRiver);       
      return;
    }
    if (customization === 1) {
      var cell = diagram.find(point[0], point[1]).index;
      var power = +brushPower.value;
      if (brush === "brushHill") {add(cell, "hill", power);}
      if (brush === "brushPit") {addPit(1, power, cell);}
      if (brush === "brushRange" || brush === "brushTrough") {
        if (icons.selectAll(".tag").size() === 0) {
          icons.append("circle").attr("r", 3).attr("class", "tag").attr("cx", point[0]).attr("cy", point[1]);
        } else {
          var x = +icons.select(".tag").attr("cx");
          var y = +icons.select(".tag").attr("cy");
          var from = diagram.find(x, y).index;
          icons.selectAll(".tag, .line").remove();
          addRange(brush === "brushRange" ? 1 : -1, power, from, cell);
        }
      }
      updateCellsInRadius(cell, cell);
      mockHeightmap();
    }
  }

  // re-calculate data for a particular state
  function recalculateStateData(state) {
    var s = states[state];
    if (s.color === "neutral") {state = "neutral";}
    var ruralFactor = state === "neutral" ? 0.5 : 1;    
    var burgs = $.grep(manors, function(e) {return (e.region === state);});
    s.burgs = burgs.length;  
    var burgsPop = 0; // get summ of all burgs population
    burgs.map(function(b) {burgsPop += b.population;});
    s.urbanPopulation = rn(burgsPop, 2);
    var regionCells = $.grep(cells, function(e) {return (e.region === state);});
    var cellsScore = 0, area = 0;
    regionCells.map(function(c) {
      cellsScore += Math.pow((1 - c.height), 3) * 10;
      area += rn(Math.abs(d3.polygonArea(polygons[c.index])));
    });
    regionCells.map(function(c) {cellsScore += Math.pow((1 - c.height), 3) * 10;});
    s.cells = regionCells.length;
    s.area = area;
    var graphSizeAdj = 90 / Math.sqrt(cells.length, 2);
    s.ruralPopulation = rn(cellsScore * graphSizeAdj * ruralFactor, 2);
  }
  
  function editLabel() {
    unselect();
    elSelected = d3.select(this);
    elSelected.call(d3.drag().on("drag", dragged).on("end", dragended)).classed("draggable", true);
    var group = d3.select(this.parentNode);
    updateGroupOptions();
    editGroupSelect.value = group.attr("id");
    editFontSelect.value = fonts.indexOf(group.attr("data-font"));
    editSize.value = group.attr("data-size");
    editColor.value = toHEX(group.attr("fill"));
    editOpacity.value = group.attr("opacity");
    editText.value = elSelected.text();
    var matrix = elSelected.attr("transform");
    if (matrix) {
      var rotation = matrix.split('(')[1].split(')')[0].split(' ')[0];
    } else {
      var rotation = 0;
    }
    editAngle.value = rotation;
    editAngleValue.innerHTML = rotation + "°";  
    $("#labelEditor").dialog({
      title: "Edit Label: " + editText.value,
      minHeight: 30, width: "auto", maxWidth: 275, resizable: false,
      position: {my: "center top", at: "bottom", of: this}
    }).on("dialogclose", function() {unselect();});
    fetchAdditionalFonts();
  }

  // fetch default fonts if not done before  
  function fetchAdditionalFonts() {
    if (fonts.indexOf("Bitter") === -1) {
      $("head").append('<link rel="stylesheet" type="text/css" href="fonts.css">');
      fonts = fonts.concat(["IM+Fell+English", "Great+Vibes", "Bitter", "Yellowtail", "Montez", "Lobster", "Josefin+Sans", "Shadows+Into+Light", "Orbitron", "Dancing+Script:700", "Bangers", "Chewy", "Architects+Daughter", "Kaushan+Script", "Gloria+Hallelujah", "Satisfy", "Comfortaa:700", "Cinzel"]);
      updateFontOptions();
    }
  }

  $("#labelEditor .editButton, #labelEditor .editButtonS").click(function() {
    var group = d3.select(elSelected.node().parentNode);
    if (this.id == "editRemoveSingle") {  
      alertMessage.innerHTML = "Are you sure you want to remove the label?";
      $(function() {$("#alert").dialog({resizable: false, title: "Remove label",
        buttons: {
          "Remove": function() {
            $(this).dialog("close");
            elSelected.remove();
            $("#labelEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }})
      });
      return;
    }
    if (this.id == "editGroupRemove") {
      var count = group.selectAll("text").size()
      if (count < 2) {
        group.remove();
        $("#labelEditor").dialog("close");
        return;
      }
      var message = "Are you sure you want to remove all labels (" + count + ") of that group?";
      alertMessage.innerHTML = message;
      $(function() {$("#alert").dialog({resizable: false, title: "Remove labels",
        buttons: {
          "Remove": function() {
            $(this).dialog("close");
            group.remove();
            $("#labelEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }})
      });
      return;
    }
    if (this.id == "editCopy") {
      var shift = +group.attr("font-size") + 1;
      var xn = +elSelected.attr("x") - shift;
      var yn = +elSelected.attr("y") - shift;
      while (group.selectAll("text[x='" + xn + "']").size() > 0) {xn -= shift; yn -= shift;}
      group.append("text").attr("x", xn).attr("y", yn).text(elSelected.text())
        .attr("transform", elSelected.attr("transform")).on("click", editLabel);
      return;
    }
    if (this.id == "editGroupNew") {
      if ($("#editGroupInput").css("display") === "none") {
        $("#editGroupInput").css("display", "inline-block");
        $("#editGroupSelect").css("display", "none");
        editGroupInput.focus();
      } else {
        $("#editGroupSelect").css("display", "inline-block");
        $("#editGroupInput").css("display", "none");
      }
      return;
    }
    if (this.id == "editExternalFont") {
      if ($("#editFontInput").css("display") === "none") {
        $("#editFontInput").css("display", "inline-block");
        $("#editFontSelect").css("display", "none");
        editFontInput.focus();
      } else {
        $("#editFontSelect").css("display", "inline-block");
        $("#editFontInput").css("display", "none");
      }
      return;
    }
    if (this.id == "editTextRandom") {
      var name;
      // check if label is country name
      if (group.attr("id") === "countries") {
        var state = $.grep(states, function(e) {return (e.name === editText.value);})[0];
        name = generateStateName(state.i);
        state.name = name;
      } else {
        // check if label is manor name
        var manor = $.grep(manors, function(e) {return (e.name === editText.value);})[0];
        if (manor) {
          var culture = manor.culture;
          name = generateName(culture);
          manor.name = name;
        } else {
          // if not, get culture closest to BBox centre
          var c = elSelected.node().getBBox();
          var closest = cultureTree.find((c.x + c.width / 2), (c.y + c.height / 2));
          var culture = cultureTree.data().indexOf(closest) || 0;
          name = generateName(culture);
        }
      }
      editText.value = name;
      elSelected.text(name);
      $("div[aria-describedby='labelEditor'] .ui-dialog-title").text("Edit Label: " + name);
      return;
    }
    $("#labelEditor .editButton").toggle();
    if (this.id == "editGroupButton") {
      if ($("#editGroupInput").css("display") !== "none") {$("#editGroupSelect").css("display", "inline-block");}
      if ($("#editGroupRemove").css("display") === "none") {
        $("#editGroupRemove, #editGroupNew").css("display", "inline-block");
      } else {
        $("#editGroupInput, #editGroupRemove, #editGroupNew").css("display", "none");
      }
    }
    if (this.id == "editFontButton") {$("#editSizeIcon, #editFontSelect, #editSize").toggle();}
    if (this.id == "editStyleButton") {$("#editOpacityIcon, #editOpacity, #editShadowIcon, #editShadow").toggle();}
    if (this.id == "editAngleButton") {$("#editAngleValue").toggle();}
    if (this.id == "editTextButton") {$("#editTextRandom").toggle();}
    $(this).show().next().toggle();
  });

  function updateGroupOptions() {
    editGroupSelect.innerHTML = "";
    labels.selectAll("g").each(function(d) {
      var opt = document.createElement("option");
      opt.value = opt.innerHTML = d3.select(this).attr("id");
      editGroupSelect.add(opt);
    });
  }

  // on editAngle change
  $("#editAngle").change(function() {
    var c = elSelected.node().getBBox();
    var rotate = `rotate(${this.value} ${(c.x+c.width/2)} ${(c.y+c.height/2)})`;
    elSelected.attr("transform", rotate);
  });

  // on editFontInput change. Use a direct link to any @font-face declaration or just font name to fetch from Google Fonts
  $("#editFontInput").change(function() {
    if (editFontInput.value !== "") {
      var url = (editFontInput.value).replace(/ /g, "+");
      if (url.indexOf("http") === -1) {url = "https://fonts.googleapis.com/css?family=" + url;}
      addFonts(url);
      editFontInput.value = "";
      editExternalFont.click();
    }
  });

  function addFonts(url) {
    $('head').append('<link rel="stylesheet" type="text/css" href="' + url + '">');
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
          let weight = rule.style.getPropertyValue('font-weight');
          let font = family.replace(/['"]+/g, '').replace(/ /g, "+") + ":" + weight;
          if (fonts.indexOf(font) == -1) {fonts.push(font);}
        };
        for (var r of styleSheet.cssRules) {FontRule(r);}
        document.head.removeChild(s);
        updateFontOptions();
      })
  }

  // on any Editor input change
  $("#labelEditor .editTrigger").change(function() {
    if (!elSelected) {return;}
    $(this).attr("title", $(this).val());    
    elSelected.text(editText.value); // change Label text   
    // check if Group was changed
    var group = d3.select(elSelected.node().parentNode);
    var groupOld = group.attr("id");
    var groupNew = editGroupSelect.value;
    // check if label is country name
    if (elSelected.attr("id").includes("regionLabel")) {
      var state = +elSelected.attr("id").slice(11);
      states[state].name = name;
    }
    // check if label is manor name
    if (elSelected.attr("id").includes("manorLabel")) {
      var manor = +elSelected.attr("id").slice(10);
      manors[manor].name = name;
    }
    if (editGroupInput.value !== "") {
      groupNew = editGroupInput.value.toLowerCase().replace(/ /g, "_").replace(/[^\w\s]/gi, "");
      if (Number.isFinite(+groupNew.charAt(0))) {groupNew = "g" + groupNew;}
    }
    if (groupOld !== groupNew) {
      var removed = elSelected.remove();
      if (labels.select("#"+groupNew).size() > 0) {
        group = labels.select("#"+groupNew);
        editFontSelect.value = fonts.indexOf(group.attr("data-font"));
        editSize.value = group.attr("data-size");
        editColor.value = toHEX(group.attr("fill"));    
        editOpacity.value = group.attr("opacity");   
      } else {
        if (group.selectAll("text").size() === 0) {group.remove();}
        group = labels.append("g").attr("id", groupNew);
        updateGroupOptions();
        $("#editGroupSelect, #editGroupInput").toggle();
        editGroupInput.value = "";
      }
      group.append(function() {return removed.node();});
      editGroupSelect.value = group.attr("id");
    }
    // update Group attributes
    var size = +editSize.value;
    var font = fonts[editFontSelect.value].split(':')[0].replace(/\+/g, " ");
    group.attr("data-size", size)
      .attr("font-size", rn((size + (size / scale)) / 2, 2))
      .attr("font-family", font)
      .attr("data-font", fonts[editFontSelect.value])
      .attr("fill", editColor.title)
      .attr("opacity", editOpacity.value);
  });

  // Update font list for Label Editor
  function updateFontOptions() {
    editFontSelect.innerHTML = "";
    for (var i=0; i < fonts.length; i++) {
      var opt = document.createElement('option');
      opt.value = i;
      var font = fonts[i].split(':')[0].replace(/\+/g, " ");
      opt.style.fontFamily = opt.innerHTML = font;
      editFontSelect.add(opt);
    }
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

  // get Curve Type
  function getCurveType() {
    type = curveType.value;
    if (type === "Catmull–Rom") {lineGen.curve(d3.curveCatmullRom);}
    if (type === "Linear") {lineGen.curve(d3.curveLinear);}
    if (type === "Basis") {lineGen.curve(d3.curveBasisClosed);}
    if (type === "Cardinal") {lineGen.curve(d3.curveCardinal);}
    if (type === "Step") {lineGen.curve(d3.curveStep);}
  }

  // round value to d decimals
  function rn(v, d) {
     var d = d || 0;
     var m = Math.pow(10, d);
     return Math.round(v * m) / m;
  }

  // round string to d decimals
  function round(s, d) {
     var d = d || 1;
     return s.replace(/[\d\.-][\d\.e-]*/g, function(n) {return rn(n, d);})
  }

  // corvent number to short string with SI postfix
  function si(n, d) {
    if (n >= 1e9) {return rn(n / 1e9, 1) + "B";}
    if (n >= 1e8) {return rn(n / 1e6) + "M";}
    if (n >= 1e6) {return rn(n / 1e6, 1) + "M";}
    if (n >= 1e4) {return rn(n / 1e3) + "K";}
    if (n >= 1e3) {return rn(n / 1e3, 1) + "K";}
    return rn(n);
  }

  // getInteger number from user input data
  function getInteger(value) {
    var metric = value.slice(-1);
    if (metric === "K") {return parseInt(value.slice(0, -1) * 1e3);}
    if (metric === "M") {return parseInt(value.slice(0, -1) * 1e6);}
    if (metric === "B") {return parseInt(value.slice(0, -1) * 1e9);}
    return parseInt(value);
  }
  
  // downalod map as SVG or PNG file
  function saveAsImage(type) {
    console.time("saveAsImage");
    // get all used fonts  
    var fontsInUse = []; // to store fonts currently in use
    labels.selectAll("g").each(function(d) {
      var font = d3.select(this).attr("data-font");
      if (fontsInUse.indexOf(font) === -1) {fontsInUse.push(font);}
    });
    var fontsToLoad = "https://fonts.googleapis.com/css?family=" + fontsInUse.join("|");

    // clone svg
    var cloneEl = document.getElementsByTagName("svg")[0].cloneNode(true);
    cloneEl.id = "clone";
    document.getElementsByTagName("body")[0].appendChild(cloneEl);
    var clone = d3.select("#clone");
    if (type === "svg") {clone.select("#viewbox").attr("transform", null);}

    // for each g element get inline style
    var emptyG = clone.append("g").node();
    var defaultStyles = window.getComputedStyle(emptyG);
    clone.selectAll("g, #ruler > g > *, #scaleBar > text").each(function(d) {
      var compStyle = window.getComputedStyle(this);
      var style = "";
      for (var i=0; i < compStyle.length; i++) {
        var key = compStyle[i];
        var value = compStyle.getPropertyValue(key);
        if (key !== "cursor" && value != defaultStyles.getPropertyValue(key)) {
          style += key + ':' + value + ';';
        }
      }
      if (style != "") {this.setAttribute('style', style);}
    });
    emptyG.remove();

    // load fonts as dataURI so they will be available in downloaded svg/png
    GFontToDataURI(fontsToLoad).then(cssRules => {
      clone.select("defs").append("style").text(cssRules.join('\n'));
      var svg_xml = (new XMLSerializer()).serializeToString(clone.node());
      clone.remove();      
      var blob = new Blob([svg_xml], {type:'image/svg+xml;charset=utf-8'});
      var url = window.URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.target = "_blank";
      if (type === "png") {
        canvas.width = $(window).width();
        canvas.height = $(window).height();
        var img = new Image();
        img.src = url;
        img.onload = function(){
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          link.download = "fantasy_map_" + Date.now() + ".png";
          link.href = canvas.toDataURL('image/png');
          canvas.style.opacity = 0;        
          document.body.appendChild(link);
          link.click();
        }
      } else {
        link.download = "fantasy_map_" + Date.now() + ".svg";
        link.href = url;
        document.body.appendChild(link);
        link.click();  
      }
      console.timeEnd("saveAsImage");
      window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 10000);
    });
  }

  // Code from Kaiido's answer:
  // https://stackoverflow.com/questions/42402584/how-to-use-google-fonts-in-canvas-when-drawing-dom-objects-in-svg
  function GFontToDataURI(url) {
    "use strict;"
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
        let fontRules = [], fontProms = [];

        for (var r of styleSheet.cssRules) {
          let fR = FontRule(r)
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

  // print displayed map segment
  function printMap() {
    var popUpAndPrint = function() {window.print(); window.close();};
    setTimeout(popUpAndPrint, 500);    
  }

  // Save in .map format, based on FileSystem API
  function saveMap() {
    console.time("saveMap");
    // data convention: 0 - version; 1 - all points; 2 - cells; 3 - manors; 4 - states; 5 - svg;
    // size stats: points = 6%, cells = 36%, manors and states = 2%, svg = 56%;
    var svg_xml = (new XMLSerializer()).serializeToString(svg.node());
    var line = "\r\n";
    var data = version + line + JSON.stringify(points) + line + JSON.stringify(cells) + line + JSON.stringify(manors) + line + JSON.stringify(states) + line + svg_xml;
    var dataBlob = new Blob([data], {type:"text/plain"});
    var dataURL = window.URL.createObjectURL(dataBlob);
    var link = document.createElement("a");
    link.download = "fantasy_map_" + Date.now() + ".map";
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    console.timeEnd("saveMap");
    window.setTimeout(function() {window.URL.revokeObjectURL(dataURL);}, 5000);
  }

  // Map Loader based on FileSystem API
  $("#fileToLoad").change(function() {
    console.time("loadMap");
    var fileToLoad = this.files[0];
    this.value = "";
    var fileReader = new FileReader();
    fileReader.onload = function(fileLoadedEvent) {
      var dataLoaded = fileLoadedEvent.target.result;
      var data = dataLoaded.split("\r\n");

      // data convention: 0 - version; 1 - all points; 2 - cells; 3 - manors; 4 - states; 5 - svg;
      var mapVersion = data[0];
      if (mapVersion !== version) {
        var message = `The Map version `;
        // mapVersion reference was not added to downloaded map before v. 0.52b, so I cannot support really old files
        if (mapVersion.length <= 10) {
          message += ` (${mapVersion}) `;
          message += `does not match the Generator version (${version}). The map will be auto-updated. In case of critical issues you may send the .map file  `;
          message += `<a href="mailto:maxganiev@yandex.ru?Subject=Map%20update%20request" target="_top">to me</a>`;
          message += ` or just keep using `
          message += `<a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog" target="_blank">an appropriate version</a>`;
          message += ` of the Generator`;
        } else {
          message += `  you are trying to load is too old and cannot be updated. `;
          message += `Please re-create the map or just keep using `;
          message += `<a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog" target="_blank">an archived version</a>`;
          message += ` of the Generator. Please note the Gennerator is still on demo and a lot of crusial changes are made every month`;
        }
        alertMessage.innerHTML = message;
        $("#alert").dialog({title: "Load map", buttons: {OK: function() {$(this).dialog("close");}}});
      }
      if (mapVersion.length > 10) {console.error("Cannot load map"); return;}
      newPoints = [], points = [], cells = [], land = [], riversData = [], island = 0, manors = [], states = [], queue = []; 
      svg.remove();
      points = JSON.parse(data[1]);
      cells = JSON.parse(data[2]);
      land = $.grep(cells, function(e) {return (e.height >= 0.2);});
      cells.map(function(e) {newPoints.push(e.data);});
      calculateVoronoi(newPoints);
      manors = JSON.parse(data[3]);
      if (mapVersion === "0.52b" || mapVersion === "0.53b") {
        states = [];
        document.body.insertAdjacentHTML("afterbegin", data[4]);        
      } else {
        states = JSON.parse(data[4]);
        document.body.insertAdjacentHTML("afterbegin", data[5]);        
      }

      // redefine variables
      customization = 0, elSelected = "";
      svg = d3.select("svg").call(zoom);
      mapWidth = +svg.attr("width");
      mapHeight = +svg.attr("height");
      defs = svg.select("#deftemp");
      viewbox = svg.select("#viewbox").on("touchmove mousemove", moved).on("click", clicked);
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
      burgs = icons.select("#burgs");
      debug = viewbox.select("#debug");
      capitals = labels.select("#capitals");
      towns = labels.select("#towns");
      countries = labels.select("#countries");
      ruler = viewbox.select("#ruler");

      // restore events
      overlay.selectAll("*").call(d3.drag().on("start", elementDrag));
      labels.selectAll("text").on("click", editLabel);
      burgs.selectAll("circle").call(d3.drag().on("start", elementDrag));
      rivers.selectAll("path").on("click", editRiver);
      svg.select("#scaleBar").call(d3.drag().on("start", elementDrag)).on("click", editScale);
      ruler.selectAll("g").call(d3.drag().on("start", elementDrag)); 
      ruler.selectAll("g").selectAll("text").on("click", removeParent);
      ruler.selectAll(".opisometer").selectAll("circle").call(d3.drag().on("start", opisometerEdgeDrag));
      ruler.selectAll(".linear").selectAll("circle:not(.center)").call(d3.drag().on("drag", rulerEdgeDrag));
      ruler.selectAll(".linear").selectAll("circle.center").call(d3.drag().on("drag", rulerCenterDrag));

      // get countries count
      capitalsCount = +$("#regions > path:last").attr("class").slice(6) + 1;
      regionsOutput.innerHTML = regionsInput.value = capitalsCount;

      // restore layers state
      if (cults.selectAll("path").size() == 0) {$("#toggleCultures").addClass("buttonoff");} else {$("#toggleCultures").removeClass("buttonoff");}
      if (terrs.selectAll("path").size() == 0) {$("#toggleHeight").addClass("buttonoff");} else {$("#toggleHeight").removeClass("buttonoff");}
      if (regions.attr("display") === "none") {$("#toggleCountries").addClass("buttonoff");} else {$("#toggleCountries").removeClass("buttonoff");}
      if (rivers.attr("display") === "none") {$("#toggleRivers").addClass("buttonoff");} else {$("#toggleRivers").removeClass("buttonoff");}
      if (oceanPattern.attr("display") === "none") {$("#toggleOcean").addClass("buttonoff");} else {$("#toggleOcean").removeClass("buttonoff");}
      if (landmass.attr("display") === "none") {$("#landmass").addClass("buttonoff");} else {$("#landmass").removeClass("buttonoff");}
      if (terrain.attr("display") === "none") {$("#toggleRelief").addClass("buttonoff");} else {$("#toggleRelief").removeClass("buttonoff");}
      if (borders.attr("display") === "none") {$("#toggleBorders").addClass("buttonoff");} else {$("#toggleBorders").removeClass("buttonoff");}
      if (burgs.attr("display") === "none") {$("#toggleIcons").addClass("buttonoff");} else {$("#toggleIcons").removeClass("buttonoff");}
      if (labels.attr("display") === "none") {$("#toggleLabels").addClass("buttonoff");} else {$("#toggleLabels").removeClass("buttonoff");}
      if (routes.attr("display") === "none") {$("#toggleRoutes").addClass("buttonoff");} else {$("#toggleRoutes").removeClass("buttonoff");}
      if (grid.attr("display") === "none") {$("#toggleGrid").addClass("buttonoff");} else {$("#toggleGrid").removeClass("buttonoff");}

      // update map to support some old versions and fetch fonts
      labels.selectAll("g").each(function(d) {
        var el = d3.select(this);
        var font = el.attr("data-font");
        if (fonts.indexOf(font) === -1) {addFonts("https://fonts.googleapis.com/css?family=" + font);}
        el.attr("data-size", +el.attr("font-size"));
        if (el.style("display") === "none") {el.node().style.display = null;}
      });
      invokeActiveZooming();
      console.timeEnd("loadMap");
    };
    fileReader.readAsText(fileToLoad, "UTF-8");
  });

  // Poisson-disc sampling for a points
  // Source: bl.ocks.org/mbostock/99049112373e12709381; Based on https://www.jasondavies.com/poisson-disc
  function poissonDiscSampler(width, height, radius) {
    var k = 5, // maximum number of points before rejection
        radius2 = radius * radius,
        R = 3 * radius2,
        cellSize = radius * Math.SQRT1_2,
        gridWidth = Math.ceil(width / cellSize),
        gridHeight = Math.ceil(height / cellSize),
        grid = new Array(gridWidth * gridHeight),
        queue = [],
        queueSize = 0,
        sampleSize = 0;
    return function() {
      if (!sampleSize) return sample(Math.random() * width, Math.random() * height);
      // Pick a random existing sample and remove it from the queue
      while (queueSize) {
        var i = Math.random() * queueSize | 0,
            s = queue[i];
        // Make a new candidate between [radius, 2 * radius] from the existing sample.
        for (var j = 0; j < k; ++j) {
          var a = 2 * Math.PI * Math.random(),
              r = Math.sqrt(Math.random() * R + radius2),
              x = s[0] + r * Math.cos(a),
              y = s[1] + r * Math.sin(a);
          // Reject candidates that are outside the allowed extent, or closer than 2 * radius to any existing sample
          if (0 <= x && x < width && 0 <= y && y < height && far(x, y)) return sample(x, y);
        }
        queue[i] = queue[--queueSize];
        queue.length = queueSize;
      }
    };
    function far(x, y) {
      var i = x / cellSize | 0,
          j = y / cellSize | 0,
          i0 = Math.max(i - 2, 0),
          j0 = Math.max(j - 2, 0),
          i1 = Math.min(i + 3, gridWidth),
          j1 = Math.min(j + 3, gridHeight);
      for (j = j0; j < j1; ++j) {
        var o = j * gridWidth;
        for (i = i0; i < i1; ++i) {
          if (s = grid[o + i]) {
            var s,
                dx = s[0] - x,
                dy = s[1] - y;
            if (dx * dx + dy * dy < radius2) return false;
          }
        }
      }
      return true;
    }
    function sample(x, y) {
      var s = [x, y];
      queue.push(s);
      grid[gridWidth * (y / cellSize | 0) + (x / cellSize | 0)] = s;
      ++sampleSize;
      ++queueSize;
      return s;
    }
  }

  // Hotkeys
  d3.select("body").on("keydown", function() {
    $("input").on("keydown", function(e) {e.stopPropagation();}); // cancel on input
    switch(d3.event.keyCode) {
      case 16: // Shift - hold to continue adding elements on click 
        shift = true;
        break;
      case 113: // "F2" for new map
        $("#randomMap").click();
        break;
      case 32: // Space to log focused cell data
        var point = d3.mouse(this);
        var index = diagram.find(point[0], point[1]).index;
        console.table(cells[index]);
        break;
      case 67: // "C" to log cells data
        console.log(cells);
        break;
      case 77: // "B" to log burgs data
        console.table(manors);
        break;
      case 83: // "S" to log states data
        console.table(states);
        break;        
      case 27: // Escape (do nothing)
        break;
      case 37: // Left to scroll map left
        if (viewX + 10 <= 0) {
          viewX += 10;
          zoomUpdate();
        }
        break;
      case 39: // Right to scroll map right
        if (viewX - 10 >= (mapWidth * (scale-1) * -1)) {
          viewX -= 10;
          zoomUpdate();
        }
        break;
      case 38: // Up to scroll map up
        if (viewY + 10 <= 0) {
          viewY += 10;
          zoomUpdate();
        }
        break;
      case 40: // Down to scroll map down
        if (viewY - 10 >= (mapHeight * (scale-1) * -1)) {
          viewY -= 10;
          zoomUpdate();
        }
        break;
      case 107: // Plus to zoom map up
        if (scale < 40) {
          var dx = mapWidth / 2 * (scale-1) + viewX;
          var dy = mapHeight / 2 * (scale-1) + viewY;
          viewX = dx - mapWidth / 2 * scale;
          viewY = dy - mapHeight / 2 * scale;
          scale += 1;
          if (scale > 40) {scale = 40;}
          zoomUpdate();
          invokeActiveZooming();
        }
        break;
      case 109: // Minus to zoom map out
        if (scale > 1) {
          var dx = mapWidth / 2 * (scale-1) + viewX;
          var dy = mapHeight / 2 * (scale-1) + viewY;
          viewX += mapWidth / 2 - dx;
          viewY += mapHeight / 2 - dy;
          scale -= 1;
          if (scale < 1) {
            scale = 1;
            viewX = 0;
            viewY = 0;
          }
          zoomUpdate();
          invokeActiveZooming();
        }
        break;
      case 9: // Tab to toggle full-screen mode
        $("#mapScreenSize").click();
        break;
      }
  }).on("keyup", function() {
    if (d3.event.keyCode == 16) {shift = false;}
  });

  // Toggle Options pane
  $("#optionsTrigger").on("click", function() {
    if ($("#options").css("display") === "none") {
      $("#regenerate").hide();
      $("#options").fadeIn();
      $("#layoutTab").click();
      this.innerHTML = "◀";
    } else {
      $("#options").fadeOut();
      this.innerHTML = "▶";
    }
  });
  $("#collapsible").hover(function() {
    if ($("#options").css("display") === "none") {$("#regenerate").show();}
  }, function() {
    $("#regenerate").hide();
  });

  // move layers on mapLayers dragging (jquery sortable)
  function moveLayer(event, ui) {    
    var el = getLayer(ui.item.attr("id"));
    if (el) {
      var prev = getLayer(ui.item.prev().attr("id"));
      var next = getLayer(ui.item.next().attr("id"));
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
  $("button, a, li").on("click", function() {
    var id = this.id;
    var parent = this.parentNode.id;
    if (icons.selectAll(".tag").size() > 0) {icons.selectAll(".tag, .line").remove();}
    if (id === "toggleHeight") {toggleHeight();}
    if (id === "toggleCountries") {
      var countries = !$("#toggleCountries").hasClass("buttonoff");
      var cultures = !$("#toggleCultures").hasClass("buttonoff");
      if (!countries && cultures) {
        $("#toggleCultures").toggleClass("buttonoff");
        toggleCultures();
      }
      $('#regions').fadeToggle();
      return;
    }
    if (id === "toggleCultures") {
      var countries = !$("#toggleCountries").hasClass("buttonoff");
      var cultures = !$("#toggleCultures").hasClass("buttonoff");      
      if (!cultures && countries) {
        $("#toggleCountries").toggleClass("buttonoff");
        $('#regions').fadeToggle();
      }
      toggleCultures();
      return;
    }
    if (id === "toggleOverlay") {toggleOverlay();}
    if (id === "toggleFlux") {toggleFlux();}
    if (parent === "mapLayers" || parent === "styleContent") {$(this).toggleClass("buttonoff");}
    if (id === "randomMap" || id === "regenerate") {
      exitCustomization();
      undraw();
      resetZoom(1000);
      generate();
      return;
    }
    if (id === "editCountries") {editCountries();}
    if (id === "editScale") {editScale();}
    if (id === "countriesManually") {
      customization = 2;
      mockRegions();
      regions.append("g").attr("id", "temp");
      $("#countriesBottom").children().hide();
      $("#countriesManuallyButtons").show();
      viewbox.style("cursor", "crosshair").call(drag);   
    }
    if (id === "countriesRegenerate") {
      customization = 3;
      mockRegions();
      regions.append("g").attr("id", "temp");
      $("#countriesBottom").children().hide();
      $("#countriesRegenerateButtons").show();
      $(".statePower, .icon-resize-full, .stateCells, .icon-check-empty").toggleClass("hidden");
      $("div[data-sortby='expansion'], div[data-sortby='cells']").toggleClass("hidden");
    }
    if (id === "countriesManuallyComplete") {
      var changedCells = regions.select("#temp").selectAll("path");
      var changedStates = [];
      changedCells.each(function() {
        var el = d3.select(this);
        var cell = +el.attr("data-cell");
        var stateOld = cells[cell].region;
        var stateNew = el.attr("data-state");
        if (stateNew !== "neutral") {stateNew = +stateNew;}
        cells[cell].region = stateNew;
        if (cells[cell].manor !== undefined) {manors[cells[cell].manor].region = stateNew;}
        changedStates.push(stateNew, stateOld);
      });
      changedStates = [...new Set(changedStates)];
      changedStates.map(function(s) {
        if (s === "neutral") {s = states.length - 1;}
        recalculateStateData(s);
      });
      var last = states.length - 1;
      if (states[last].color === "neutral" && states[last].cells === 0) {
        $("#state" + last).remove();
        states.splice(-1);
      }
      $("#countriesManuallyCancel").click();
      if (changedStates.length) {editCountries();}
    }
    if (id === "countriesManuallyCancel") {
      redrawRegions();
      if (grid.style("display") === "inline") {toggleGrid.click();}
      if (labels.style("display") === "none") {toggleLabels.click();}
      $("#countriesBottom").children().show();
      $("#countriesManuallyButtons, #countriesRegenerateButtons").hide();
      $(".selected").removeClass("selected");
      $("div[data-sortby='expansion'], .statePower, .icon-resize-full").addClass("hidden");
      $("div[data-sortby='cells'], .stateCells, .icon-check-empty").removeClass("hidden");  
      customization = 0;
      viewbox.style("cursor", "default").on(".drag", null);
    }
    if (id === "countriesRandomize") {
      var mod = +powerInput.value * 2;
      $(".statePower").each(function(e, i) {
        var state = +(this.parentNode.id).slice(5);
        if (states[state].color === "neutral") {return;}
        var power = rn(Math.random() * mod / 2 + 1, 1);
        $(this).val(power);
        $(this).parent().attr("data-expansion", power);
        states[state].power = power;
      });
      regenerateCountries();     
    }
    if (id === "countriesAdd") {
      var i = states.length;
      // move neutrals to the last line
      if (states[i-1].color === "neutral") {states[i-1].i = i; i -= 1;}
      var name = generateStateName(0);
      var color = colors20(i);
      states.push({i, color, name, capital: "select", cells: 0, burgs: 0, urbanPopulation: 0, ruralPopulation: 0, area: 0, power: 1});
      states.sort(function(a, b){return a.i - b.i});
      editCountries();
    }
    if (id === "countriesPercentage") {
      var el = $("#countriesEditor");
      if (el.attr("data-type") === "absolute") {
        el.attr("data-type", "percentage");
        var totalCells = land.length;
        var totalBurgs = +countriesFooterBurgs.innerHTML;
        var totalArea = countriesFooterArea.innerHTML;
        totalArea = getInteger(totalArea.split(" ")[0]);
        var totalPopulation = getInteger(countriesFooterPopulation.innerHTML);
        $("#countriesBody > .states").each(function() {
          var cells = rn($(this).attr("data-cells") / totalCells * 100);
          var burgs = rn($(this).attr("data-burgs") / totalBurgs * 100);
          var area = rn($(this).attr("data-area") / totalArea * 100);
          var population = rn($(this).attr("data-population") / totalPopulation * 100);
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
      var unit = areaUnit.value === "square" ? distanceUnit.value + "2" : areaUnit.value;
      var data = "Country,Capital,Cells,Burgs,Area ("+ unit +"),Population\n"; // countries headers
      $("#countriesBody > .states").each(function() {
        var country = $(this).attr("data-country");
        if (country === "bottom") {data += "neutral,"} else {data += country + ",";}
        var capital = $(this).attr("data-capital");
        if (capital === "bottom" || capital === "select") {data += ","} else {data += capital + ",";}
        data += $(this).attr("data-cells") + ",";
        data += $(this).attr("data-burgs") + ",";
        data += $(this).attr("data-area") + ",";
        var population = +$(this).attr("data-population");
        data += population + "\n";
      });
      data += "\nBurg,Country,Culture,Population\n"; // burgs headers
      manors.map(function(m) {
        if (m.region === "removed") {return;} // skip removed burgs
        data += m.name + ",";
        var country = m.region === "neutral" ? "neutral" : states[m.region].name;
        data += country + ",";
        data += window.cultures[m.culture] + ",";
        var population = m.population * urbanization.value * populationRate.value * 1000;
        data += population + "\n";
      });
      var dataBlob = new Blob([data], {type:"text/plain"});
      var url = window.URL.createObjectURL(dataBlob);
      var link = document.createElement("a");
      link.download = "countries_data" + Date.now() + ".csv";
      link.href = url;
      link.click();
    }
    if (id === "removeCountries") {
      alertMessage.innerHTML = `Are you sure you want to remove all countries?`;
      $(function() {$("#alert").dialog({resizable: false, title: "Remove countries",
        buttons: {
          "Remove": function() {
            $(this).dialog("close");
            $("#countriesBody").empty();
            manors.map(function(m) {m.region = "neutral";});
            land.map(function(l) {l.region = "neutral";});
            states.map(function(s) {
              var c = +s.capital;
              if (isNaN(c)) {return;}
              $("#manorLabel"+c).detach().appendTo($("#towns")).attr("dy", -0.7);
              $("#manorIcon"+c).attr("r", .5).attr("stroke-width", .12); 
            });    
            labels.select("#countries").selectAll("text").remove();
            regions.selectAll("path").remove();
            states = [];
            states.push({i: 0, color: "neutral", capital: "neutral", name: "Neutrals"});
            recalculateStateData(0);
            if ($("#burgsEditor").is(":visible")) {$("#burgsEditor").dialog("close");}
            editCountries();
          },
          Cancel: function() {$(this).dialog("close");}
        }})
      });      
    }    
    if (id === "removeBurgs") {
      alertMessage.innerHTML = `Are you sure you want to remove all burgs associated with the country?`;
      $(function() {$("#alert").dialog({resizable: false, title: "Remove associated burgs",
        buttons: {
          "Remove": function() {
            $(this).dialog("close");
            var state = +$("#burgsEditor").attr("data-state");
            var region = states[state].color === "neutral" ? "neutral" : state;
            $("#burgsBody").empty();
            manors.map(function(m) {
              if (m.region !== region) {return;}
              m.region = "removed";
              cells[m.cell].manor = undefined;
              labels.select("#manorLabel"+m.i).remove();
              icons.select("#manorIcon"+m.i).remove();        
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
          },
          Cancel: function() {$(this).dialog("close");}
        }})
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
        var b = +(this.parentNode.id).slice(5);
        var name = generateName(manors[b].culture);
        $(this).val(name);
        $(this).parent().attr("data-burg", name);
        manors[b].name = name;
        labels.select("#manorLabel"+b).text(name);
      });
      if ($("#countriesEditor").is(":visible")) {
        if (states[s].color === "neutral") {return;}
        var c = states[s].capital;
        $("#state"+s).attr("data-capital", manors[c].name);
        $("#state"+s+" > .stateCapital").val(manors[c].name);
      }
    }
    if (id === "burgAdd") {$("#addBurg").click();}
    if (id === "toggleScaleBar") {$("#scaleBar").toggleClass("hidden");}
    if (id === "addRuler") {
      $("#ruler").show();
      var title = 
      `Ruler is an instrument for measuring thelinear lengths.
      One dash shows 30 km (18.6 mi), approximate distance of a daily loaded march.
      Drag edge circles to move the ruler, center circle to split the ruler into 2 parts.
      Click on the ruler label to remove the ruler from the map`;
      var rulerNew = ruler.append("g").attr("class", "linear").call(d3.drag().on("start", elementDrag));
      var factor = rn(1 / Math.pow(scale, 0.3), 1);
      rulerNew.append("title").text(title);
      var y = Math.floor(Math.random() * mapHeight * 0.5 + mapHeight * 0.25);
      var x1 = mapWidth * 0.2, x2 = mapWidth * 0.8;
      var dash = rn(30 / distanceScale.value, 2);
      rulerNew.append("line").attr("x1", x1).attr("y1", y).attr("x2", x2).attr("y2", y).attr("class", "white").attr("stroke-width", factor);
      rulerNew.append("line").attr("x1", x1).attr("y1", y).attr("x2", x2).attr("y2", y).attr("class", "gray").attr("stroke-width", factor).attr("stroke-dasharray", dash);
      rulerNew.append("circle").attr("r", 2 * factor).attr("stroke-width", 0.5 * factor).attr("cx", x1).attr("cy", y).attr("data-edge", "left").call(d3.drag().on("drag", rulerEdgeDrag));
      rulerNew.append("circle").attr("r", 2 * factor).attr("stroke-width", 0.5 * factor).attr("cx", x2).attr("cy", y).attr("data-edge", "rigth").call(d3.drag().on("drag", rulerEdgeDrag));
      rulerNew.append("circle").attr("r", 1.2 * factor).attr("stroke-width", 0.3 * factor).attr("cx", mapWidth / 2).attr("cy", y).attr("class", "center").call(d3.drag().on("start", rulerCenterDrag));
      var dist = rn(x2 - x1);
      var label = rn(dist * distanceScale.value) + " " + distanceUnit.value;        
      rulerNew.append("text").attr("x", mapWidth / 2).attr("y", y).attr("dy", -1).attr("data-dist", dist).text(label).text(label).on("click", removeParent).attr("font-size", 10 * factor);
      return;
    }
    if (id === "addOpisometer" || id === "addPlanimeter") {
      if ($(this).hasClass("pressed")) {
        viewbox.style("cursor", "default").on(".drag", null);
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
      $(function() {$("#alert").dialog({resizable: false, title: "Remove all rulers",
        buttons: {
          "Remove": function() {
            $(this).dialog("close");
            $("#ruler > g").remove();
          },
          Cancel: function() {$(this).dialog("close");}
        }})
      });
      return;
    }      
    if (id === "editHeightmap") {$("#customizeHeightmap").slideToggle();}
    if (id === "fromScratch") {
      undraw();
      placePoints();
      calculateVoronoi(points);
      detectNeighbors("grid");
      drawScaleBar();
      customizeHeightmap();
      return;
    }
    if (id === "fromHeightmap") {
      var heights = [];
      for (var i = 0; i < points.length; i++) {
        var cell = diagram.find(points[i][0], points[i][1]).index;  
        heights.push(cells[cell].height);
      }
      undraw();
      calculateVoronoi(points);
      detectNeighbors("grid");
      drawScaleBar();
      for (var i = 0; i < points.length; i++) {
        cells[i].height = heights[i];
      }
      mockHeightmap();
      customizeHeightmap();
      return;
    }
    // heightmap customization buttons
    if (customization === 1) {
      if (id === "paintBrushes") {
        if ($("#brushesPanel").is(":visible")) {return;}
        $("#brushesPanel").dialog({
          title: "Paint Brushes",
          minHeight: 40, width: "auto", maxWidth: 200, resizable: false,
          position: {my: "right top", at: "right-10 top+10", of: "svg"}});
      }
      if (id === "rescaleExecute") {
        var subject = rescaleLower.value + "-" + rescaleHigher.value;
        var sign = conditionSign.value;
        var modifier = rescaleModifier.value;
        if (sign === "×") {modifyHeights(subject, 0, +modifier);}
        if (sign === "÷") {modifyHeights(subject, 0, (1 / modifier));}
        if (sign === "+") {modifyHeights(subject, +modifier, 1);}
        if (sign === "-") {modifyHeights(subject, (-1 * modifier), 1);}
        if (sign === "^") {modifyHeights(subject, 0, "^" + modifier);}
        mockHeightmap();
      }
      if (id === "rescaleButton") {
        $("#modifyButtons").children().not("#rescaleButton, .condition").toggle();
      }
      if (id === "rescaleCondButton") {$("#modifyButtons").children().not("#rescaleCondButton, #rescaler").toggle();}
      if (id === "undo") {restoreHistory(historyStage - 1);}
      if (id === "redo") {restoreHistory(historyStage + 1);}
      if (id === "smoothHeights") {smoothHeights(4); mockHeightmap();}
      if (id === "disruptHeights") {disruptHeights(); mockHeightmap();}
      if (id === "getMap") {getMap();}
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
        // Inputs control
        if ($("#perspectivePanel").is(":visible")) {return;}
        const line = +$("#lineHandle0").attr("data-value");
        const grad = +$("#lineHandle1").attr("data-value");
        $("#lineSlider").slider({
          min: 10, max: 320, step: 1, values: [line, grad],
          create: function() {
            $("#lineHandle0").text("x:"+line);
            $("#lineHandle1").text("y:"+grad);
          },
          slide: function(event, ui) {
            $("#lineHandle0").text("x:"+ui.values[0]).attr("data-value", ui.values[0]);
            $("#lineHandle1").text("y:"+ui.values[1]).attr("data-value", ui.values[1]);
            drawPerspective();
          }
        });
        $("#ySlider").slider({
          min: 1, max: 5, step: 0.1, value: +$("#yHandle").attr("data-value"),
          create: function() {$("#yHandle").text($("#yHandle").attr("data-value"));},
          slide: function(event, ui) {
            $("#yHandle").text(ui.value).attr("data-value", ui.value);
            drawPerspective();
          }
        });
        $("#scaleSlider").slider({
          min: 0.5, max: 2, step: 0.1, value: +$("#scaleHandle").attr("data-value"),
          create: function() {$("#scaleHandle").text($("#scaleHandle").attr("data-value"));},
          slide: function(event, ui) {
            $("#scaleHandle").text(ui.value).attr("data-value", ui.value);
            drawPerspective();
          }
        });
        $("#heightSlider").slider({
          min: 1, max: 50, step: 1, value: +$("#heightHandle").attr("data-value"),
          create: function() {$("#heightHandle").text($("#heightHandle").attr("data-value"));},
          slide: function(event, ui) {
            $("#heightHandle").text(ui.value).attr("data-value", ui.value);
            drawPerspective();
          }
        });
        $("#perspectivePanel").dialog({
          title: "Perspective View",
          width: 520, height: 360,
          position: {my: "center center", at: "center center", of: "svg"}
        });
        drawPerspective();
        return;
      }
    }
    if ($(this).hasClass('radio') && (parent === "addFeature" || parent === "brushesButtons")) {
      if ($(this).hasClass('pressed')) {
        $(this).removeClass('pressed');
        viewbox.style("cursor", "default").on(".drag", null);;
        $("#brushRadiusLabel, #brushRadius").attr("disabled", true).addClass("disabled");
        if (id === "addBurg") {$("#burgAdd").removeClass("pressed");}
      } else {
        $(".pressed").removeClass('pressed');
        $(this).addClass('pressed'); 
        viewbox.style("cursor", "crosshair");
        if (id === "addBurg") {$("#burgAdd").addClass("pressed");}
        if (id.slice(0,5) === "brush" && id !== "brushRange" && id !== "brushTrough") {
          viewbox.call(drag); 
        }
        if (parent === "addFeature" || $(this).hasClass("feature")) {
          $("#brushRadiusLabel, #brushRadius").attr("disabled", true).addClass("disabled");
        } else {
          $("#brushRadiusLabel, #brushRadius").attr("disabled", false).removeClass("disabled");
        }
      }
      return;
    }
    if (id === "restoreStyle") {
      alertMessage.innerHTML = "Are you sure you want to restore default style?";
      $("#alert").dialog({resizable: false, title: "Restore style",
        buttons: {
          "Restore": function() {
            applyDefaultStyle();
            $(this).dialog("close");
          },
          Cancel: function() {
            $(this).dialog("close");
          }
      }});
    }
    if ($(this).hasClass('radio') && parent === "mapFilters") {
      $("svg").removeClass();
      if ($(this).hasClass('pressed')) {
        $("#mapFilters .pressed").removeClass('pressed');
      } else {
        $("#mapFilters .pressed").removeClass('pressed');
        $(this).addClass('pressed');
        if (id === "grayscale") {$("svg").addClass("grayscale");}
        if (id === "sepia") {$("svg").addClass("sepia");}
        if (id === "tint") {$("svg").addClass("tint");}
        if (id === "dingy") {$("svg").addClass("dingy");}
      }
      return;
    }  
    if (id === "mapScreenSize") {
      if ($("body").hasClass("fullscreen")) {
        mapWidthInput.value = 960; // default width
        mapHeightInput.value = 540; // default height
        $(".fullscreen").removeClass("fullscreen");     
        $(this).addClass("icon-resize-full-alt").removeClass("icon-resize-small");
      } else {
        mapWidthInput.value = $(window).width();
        mapHeightInput.value = $(window).height();
        $("body").addClass("fullscreen");
        $("svg").addClass("fullscreen");
        $(this).removeClass("icon-resize-full-alt").addClass("icon-resize-small");
      }
      changeMapSize();
    }    
    if (id === "saveButton") {$("#saveDropdown").slideToggle();}
    if (id === "loadMap") {fileToLoad.click();}
    if (id === "printMap") {printMap();}
    if (id === "zoomReset") {resetZoom(1000);}
    if (id === "zoomPlus") {
      scale += 1; 
      if (scale > 40) {scale = 40;}
      zoomUpdate();
      invokeActiveZooming();
    }
    if (id === "zoomMinus") {
      scale -= 1; 
      if (scale <= 1) {scale = 1; viewX = 0; viewY = 0;}
      zoomUpdate();
      invokeActiveZooming();
    }
    if (id === "styleFontPlus" || id === "styleFontMinus") {
      var el = viewbox.select("#"+styleElementSelect.value);
      var mod = id === "styleFontPlus" ? 1.1 : 0.9;
      el.selectAll("g").each(function() {
        var el = d3.select(this);
        var size = rn(el.attr("data-size") * mod, 2);
        if (size < 0.2) {size = 0.2;}
        el.attr("data-size", size).attr("font-size", rn((size + (size / scale)) / 2, 2));
      });
      return;
    }
    if (id === "styleFillPlus" || id === "styleFillMinus") {
      var el = viewbox.select("#"+styleElementSelect.value);
      var mod = id === "styleFillPlus" ? 1.1 : 0.9;
      el.selectAll("*").each(function() {
        var el = d3.select(this);
        var size = rn(el.attr("r") * mod, 2);
        if (size < 0.1) {size = 0.1;}
        if (el.node().nodeName === "circle") {el.attr("r", size);}
      });
      return;
    }
    if (id === "styleStrokePlus" || id === "styleStrokeMinus") {
      var el = viewbox.select("#"+styleElementSelect.value);
      var mod = id === "styleStrokePlus" ? 1.1 : 0.9;
      el.selectAll("*").each(function() {
        var el = d3.select(this);
        var size = rn(el.attr("stroke-width") * mod, 2);
        if (size < 0.1) {size = 0.1;}
        if (el.node().nodeName === "circle") {el.attr("stroke-width", size);}
      });
      return;
    } 
    if (id === "templateClear" || id === "brushClear") {
      if (customization === 1) {
        var message = "Are you sure you want to clear the map?";
        alertMessage.innerHTML = message;
        $(function() {$("#alert").dialog({resizable: false, title: "Clear map",
          buttons: {
            "Clear": function() {
              $(this).dialog("close");
              viewbox.style("cursor", "crosshair").call(drag);
              landmassCounter.innerHTML = "0";
              $("#landmass").empty();
              cells.map(function(i) {i.height = 0;});
              // clear history
              history = [];
              historyStage = -1;
              redo.disabled = true;
              undo.disabled = true;
            },
            Cancel: function() {$(this).dialog("close");}
          }})
        });     
      } else {
        start.click();
      }
    }
    if (id === "templateComplete") {
      if (customization === 1 && !$("#getMap").attr("disabled")) {getMap();}
    }
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
      $("#convertImageButtons").children().not(this).not("#imageToLoad, #convertColors").toggle();
    }
    if (id === "convertAutoLum") {autoAssing("lum");}
    if (id === "convertAutoHue") {autoAssing("hue");}
    if (id === "convertComplete") {completeConvertion();}
  });

  // support save options
  $("#saveDropdown > div").click(function() {
    var id = this.id;
    if (id === "saveMap") {saveMap();}
    if (id === "saveSVG") {saveAsImage("svg");}
    if (id === "savePNG") {saveAsImage("png");}
    if (id === "activeZooming") {
      $(this).toggleClass("icon-eye icon-eye-off");
      zoomUpdate();
      invokeActiveZooming();
      return;
    }
    $("#saveDropdown").slideUp("fast"); 
  });

  function drawPerspective() {
    console.time("drawPerspective");
    const width = 320, height = 180;
    const wRatio = mapWidth / width, hRatio = mapHeight / height;    
    const lineCount = +$("#lineHandle0").attr("data-value");
    const lineGranularity = +$("#lineHandle1").attr("data-value");    
    const perspective = document.getElementById("perspective");
    const pContext = perspective.getContext("2d");
    const lines = [];
    let i = Math.floor(lineCount);
    while (i--) {
      const x = i / lineCount * width | 0;
      const canvasPoints = [];
      lines.push(canvasPoints);
      let j = Math.floor(lineGranularity);
      while (j--) {
        const y = j / lineGranularity * height | 0;
        let h = getHeightInPoint(x * wRatio, y * hRatio) - 0.2;
        if (h < 0) {h = 0;}
        canvasPoints.push([x, y, h]);
      }
    }
    pContext.clearRect(0, 0, perspective.width, perspective.height);
    for (let canvasPoints of lines) {
      for (let i = 0; i < canvasPoints.length - 1; i++) {
        const pt1 = canvasPoints[i];
        const pt2 = canvasPoints[i + 1];
        const avHeight = (pt1[2] + pt2[2]) / 2;
        pContext.beginPath();
        pContext.moveTo(...transformPt(pt1));
        pContext.lineTo(...transformPt(pt2));
        let clr = "rgb(81, 103, 169)"; // water
        if (avHeight !== 0) {clr = color(1 - avHeight - 0.2);}
        pContext.strokeStyle = clr;
        pContext.stroke();
      }
    }
    console.timeEnd("drawPerspective");
  }

  // get Height value in point for Perspective view
  function getHeightInPoint(x, y) {
    const index = diagram.find(x, y).index;
    return cells[index].height;
  }

  function transformPt(pt) {
    const width = 320;
    const maxHeight = +$("#heightHandle").attr("data-value");
    var [x, y] = projectIsometric(pt[0], pt[1]);
    return [x + width / 2 + 10, y + 10 - pt[2] * maxHeight];
  }

  function projectIsometric(x, y) {
    const scale = $("#scaleHandle").attr("data-value");
    const yProj = $("#yHandle").attr("data-value");
    return [(x - y) * scale, (x + y) / yProj * scale];
  }

  // templateEditor Button handlers
  $("#templateTools > button").on("click", function() {
    var id = this.id;
    id = id.replace("template", "");
    if (id === "Mountain") {
      var steps = $("#templateBody > div").length;
      if (steps > 0) {return;}
    }
    $("#templateBody").attr("data-changed", 1);
    $("#templateBody").append('<div data-type="' + id + '">' + id + '</div>');
    var el = $("#templateBody div:last-child");
    if (id === "Hill" || id === "Pit" || id === "Range" || id === "Trough") {
      var count = '<label>count:<input class="templateElCount" title="Blobs to add" type="number" value="1" min="1" max="99"></label>';
    }
    if (id === "Hill") {
      var dist = '<label>distribution:<input class="templateElDist" title="Set blobs distribution. 0.5 - map center; 0.1 - any place" type="number" value="0.25" min="0.1" max="0.5" step="0.01"></label>';
    }
    if (id === "Add" || id === "Multiply") {
      var dist = '<label>to:<select class="templateElDist" title="Change only land or all cells"><option value="all" selected>all cells</option><option value="land">land only</option><option value="interval">interval</option></select></label>';
    }
    if (id === "Add") {
      var count = '<label>value:<input class="templateElCount" title="Add value to height of all cells (negative values are allowed)" type="number" value="-0.1" min="-1" max="1" step="0.01"></label>';
    }
    if (id === "Multiply") {
      var count = '<label>by value:<input class="templateElCount" title="Multiply all cells Height by the value" type="number" value="1.1" min="0" max="10" step="0.1"></label>';
    }
    if (id === "Smooth") {
      var count = '<label>fraction:<input class="templateElCount" title="Set smooth fraction. 1 - full smooth, 2 - half-smooth, etc." type="number" min="1" max="10" value="2"></label>';
    }    
    if (id === "Strait") {
      var count = '<label>width:<input class="templateElCount" title="Set strait width" value="1-7"></label>';
    }
    el.append('<span title="Remove step" class="icon-trash-empty"></span>');
    $(".icon-trash-empty").on("click", function() {$(this).parent().remove();});
    if (dist) {el.append(dist);}
    if (count) {el.append(count);}
    el.find("select.templateElDist").on("input", fireTemplateElDist);
    $("#templateBody").attr("data-changed", 1);
  });
   
  // fireTemplateElDist selector handlers
  function fireTemplateElDist() {
    if (this.value === "interval") {
      var interval = prompt("Populate a height interval (e.g. from 0.17 to 0.2), without space, but with hyphen", "0.17-0.2");
      if (interval) {
        var option = '<option value="' + interval + '">' + interval + '</option>';
        $(this).append(option).val(interval);
      } 
    }
  }
     
  // templateSelect on change listener
  $("#templateSelect").on("input", function() {
    var steps = $("#templateBody > div").length;
    var changed = +$("#templateBody").attr("data-changed");
    var template = this.value;
    if (steps && changed === 1) {
      alertMessage.innerHTML = "Are you sure you want to change the base template? All the changes will be lost.";
      $(function() {$("#alert").dialog({resizable: false, title: "Change Template",
        buttons: {
          "Change": function() {
            changeTemplate(template);
            $(this).dialog("close");            
          },
          Cancel: function() {
            var prev = $("#templateSelect").attr("data-prev");
            $("#templateSelect").val(prev);
            $(this).dialog("close");
          }
        }})
      });
    }
    if (steps === 0 || changed === 0) {changeTemplate(template);}
  });

  function changeTemplate(template) {
    $("#templateBody").empty();
    $("#templateSelect").attr("data-prev", template);
    addStep("Mountain");
    if (template === "templateVolcano") {
      addStep("Add", 0.05);
      addStep("Multiply", 1.1);
      addStep("Hill", 5, 0.4);
      addStep("Hill", 2, 0.15);
      addStep("Range", 3);
      addStep("Trough", 3);
    }
    if (template === "templateHighIsland") {
      addStep("Add", 0.05);
      addStep("Multiply", 0.9);
      addStep("Range", 4);
      addStep("Hill", 12, 0.25);
      addStep("Trough", 3);
      addStep("Multiply", 0.75, "land");
      addStep("Hill", 3, 0.15);
    }
    if (template === "templateLowIsland") {
      addStep("Smooth", 2);
      addStep("Range", 1);
      addStep("Hill", 4, 0.4);
      addStep("Hill", 12, 0.2);
      addStep("Trough", 8);
      addStep("Multiply", 0.35, "land");
    }
    if (template === "templateContinents") {
      addStep("Hill", 24, 0.25);
      addStep("Range", 4);
      addStep("Hill", 3, 0.18);
      addStep("Multiply", 0.7, "land");
      addStep("Strait", "2-7");
      addStep("Smooth", 2);
      addStep("Pit", 7);
      addStep("Trough", 8);
      addStep("Multiply", 0.8, "land");
      addStep("Add", 0.02, "all");
    }
    if (template === "templateArchipelago") {
      addStep("Add", -0.2, "land");
      addStep("Hill", 14, 0.17);
      addStep("Range", 5);
      addStep("Strait", "2-4");      
      addStep("Trough", 12);
      addStep("Pit", 8);
      addStep("Add", -0.05, "land");
      addStep("Multiply", 0.7, "land");
      addStep("Smooth", 4);              
    }
    if (template === "templateAtoll") {
      addStep("Hill", 2, 0.35);
      addStep("Range", 2);
      addStep("Add", 0.07, "all");
      addStep("Smooth", 1);
      addStep("Multiply", 0.1, "0.27-10");
    }      
    $("#templateBody").attr("data-changed", 0);
  }
  
  // interprete template function
  function addStep(feature, count, dist) {
    if (!feature) {return;}
    if (feature === "Mountain") {templateMountain.click();}
    if (feature === "Hill") {templateHill.click();}
    if (feature === "Pit") {templatePit.click();}
    if (feature === "Range") {templateRange.click();}
    if (feature === "Trough") {templateTrough.click();}
    if (feature === "Strait") {templateStrait.click();}
    if (feature === "Add") {templateAdd.click();}
    if (feature === "Multiply") {templateMultiply.click();}
    if (feature === "Smooth") {templateSmooth.click();}
    if (count) {$("#templateBody div:last-child .templateElCount").val(count);}
    if (dist) {
      if (dist !== "land") {
        var option = '<option value="' + dist + '">' + dist + '</option>';
        $("#templateBody div:last-child .templateElDist").append(option);
      }
      $("#templateBody div:last-child .templateElDist").val(dist);
    }
  }
  
  // Execute custom template  
  $("#templateRun").on("click", function() {
    if (customization !== 1) {return;}
    var steps = $("#templateBody > div").length;
    if (steps) {cells.map(function(i) {i.height = 0;});}
    for (var step=1; step <= steps; step++) {
      var element = $("#templateBody div:nth-child(" + step + ")");
      var type = element.attr("data-type");
      if (type === "Mountain") {addMountain(); continue;}
      var count = $("#templateBody div:nth-child(" + step + ") .templateElCount").val();
      var dist = $("#templateBody div:nth-child(" + step + ") .templateElDist").val();
      if (count) {
        if (count[0] !== "-" && count.includes("-")) {
          var lim = count.split("-");
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
    if (steps) {mockHeightmap();}
  });
  
  // Save custom template as text file
  $("#templateSave").on("click", function() {
    var steps = $("#templateBody > div").length;
    var stepsData = "";
    for (var step=1; step <= steps; step++) {
      var element = $("#templateBody div:nth-child(" + step + ")");
      var type = element.attr("data-type");
      var count = $("#templateBody div:nth-child(" + step + ") .templateElCount").val();
      var dist = $("#templateBody div:nth-child(" + step + ") .templateElDist").val();
      if (!count) {count = "0";}
      if (!dist) {dist = "0";}
      stepsData += type + " " + count + " " + dist + "\r\n";
    }  
    var dataBlob = new Blob([stepsData], {type:"text/plain"});
    var url = window.URL.createObjectURL(dataBlob);
    var link = document.createElement("a");
    link.download = "template_" + Date.now() + ".txt";
    link.href = url;
    link.click();
    $("#templateBody").attr("data-changed", 0);
  });
  
  // Load custom template as text file
  $("#templateLoad").on("click", function() {templateToLoad.click();});
  $("#templateToLoad").change(function() {
    var fileToLoad = this.files[0];
    this.value = "";
    var fileReader = new FileReader();
    fileReader.onload = function(fileLoadedEvent) {
      var dataLoaded = fileLoadedEvent.target.result;
      var data = dataLoaded.split("\r\n");
      $("#templateBody").empty();
      if (data.length > 0) {
        $("#templateBody").attr("data-changed", 1);
        $("#templateSelect").attr("data-prev", "templateCustom").val("templateCustom");
      }
      for (var i=0; i < data.length; i++) {
        var line = data[i].split(" ");
        addStep(line[0], line[1], line[2]);
      }
    };
    fileReader.readAsText(fileToLoad, "UTF-8");
  });
  
  // Image to Heightmap Converter dialog
  function convertImage() {
    $(".pressed").removeClass('pressed');
    viewbox.style("cursor", "default");
    var div = d3.select("#colorScheme");
    if (div.selectAll("*").size() === 0) {
      for (var i = 0; i <= 100; i++) {
        var width = i < 20 || i > 70 ? "1px" : "3px";
        if (i === 0) {width = "4px";}
        var clr = color(1-i/100);
        var style = "background-color: " + clr + "; width: " + width;
        div.append("div").attr("data-color", i/100).attr("style", style);
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
    // reset style
    viewbox.attr("transform", null);
    grid.attr("stroke-width", .3);
    // load image
    var file = this.files[0];
    this.value = ""; // reset input value to get triggered if the same file is uploaded
    var reader = new FileReader();
    var img = new Image;
    // draw image
    img.onload = function() {
      ctx.drawImage(img, 0, 0, mapWidth, mapHeight);
      heightsFromImage(+convertColors.value);
      console.timeEnd("loadImage");
    }
    reader.onloadend = function() {img.src = reader.result;}
    reader.readAsDataURL(file);
  });
  
  function heightsFromImage(count) {
    var imageData = ctx.getImageData(0, 0, mapWidth, mapHeight);
    var data = imageData.data;
    $("#landmass > path, .color-div").remove();
    $("#landmass, #colorsUnassigned").fadeIn();
    $("#colorsAssigned").fadeOut();
    var colors = [], palette = [];
    points.map(function(i) {
      var x = rn(i[0]), y = rn(i[1]);
      if (y == mapHeight) {y--;}
      if (x == mapWidth) {x--;}
      var p = (x + y * mapWidth) * 4;
      var r = data[p], g = data[p + 1], b = data[p + 2];
      colors.push([r, g, b]);
    });
    var cmap = MMCQ.quantize(colors, count);
    polygons.map(function(i, d) {
      cells[d].height = undefined;
      var nearest = cmap.nearest(colors[d]);
      var rgb = "rgb(" + nearest[0] + ", " + nearest[1] + ", " + nearest[2] + ")";
      var hex = toHEX(rgb);
      if (palette.indexOf(hex) === -1) {palette.push(hex);}
      landmass.append("path").attr("d", "M" + i.join("L") + "Z").attr("data-i", d).attr("fill", hex).attr("stroke", hex);
    });
    landmass.selectAll("path").on("click", landmassClicked);
    palette.sort(function(a, b) {return d3.lab(a).b - d3.lab(b).b;}).map(function(i) {
      $("#colorsUnassigned").append('<div class="color-div" id="' + i.substr(1) + '" style="background-color: ' + i + ';"/>');
    });
    $(".color-div").click(selectColor);
  }

  function landmassClicked() {
    var color = d3.select(this).attr("fill");
    $("#"+color.slice(1)).click();
  }

  function selectColor() {
    landmass.selectAll(".selectedCell").classed("selectedCell", 0);
    var el = d3.select(this);
    if (el.classed("selectedColor")) {
      el.classed("selectedColor", 0);
    } else {
      $(".selectedColor").removeClass("selectedColor");
      el.classed("selectedColor", 1);
      $("#colorScheme .hoveredColor").removeClass("hoveredColor");
      $("#colorsSelectValue").text(0);
      if (el.attr("data-height")) {
        var height = el.attr("data-height");
        $("#colorScheme div[data-color='" + height + "']").addClass("hoveredColor");
        $("#colorsSelectValue").text(rn(height * 100));
      }
      var color = "#" + d3.select(this).attr("id");
      landmass.selectAll("path").classed("selectedCell", 0);
      landmass.selectAll("path[fill='" + color + "']").classed("selectedCell", 1);
    }
  }

  function showHeight() {
    var el = d3.select(this);
    var height = rn(el.attr("data-color") * 100);
    $("#colorsSelectValue").text(height);
    $("#colorScheme .hoveredColor").removeClass("hoveredColor");
    el.classed("hoveredColor", 1);
  }

  function assignHeight() {
    var sel = $(".selectedColor")[0];
    var height = +d3.select(this).attr("data-color");
    var rgb = color(1-height);
    var hex = toHEX(rgb);
    sel.style.backgroundColor = rgb;
    sel.setAttribute("data-height", height);
    var cur = "#" + sel.id;
    sel.id = hex.substr(1);
    landmass.selectAll(".selectedCell").each(function() {
      d3.select(this).attr("fill", hex).attr("stroke", hex);
      var i = +d3.select(this).attr("data-i");
      cells[i].height = height;
    });
    var parent = sel.parentNode;
    if (parent.id === "colorsUnassigned") {
      colorsAssigned.appendChild(sel);
      $("#colorsAssigned").fadeIn();
      if ($("#colorsUnassigned .color-div").length < 1) {$("#colorsUnassigned").fadeOut();}
    }
    if ($("#colorsAssigned .color-div").length > 1) {sortAssignedColors();}
  }
   
  // sort colors based on assigned height
  function sortAssignedColors() {
    var data = [];
    var colors = d3.select("#colorsAssigned").selectAll(".color-div");
    colors.each(function(d) {
      var id = d3.select(this).attr("id");
      var height = +d3.select(this).attr("data-height");
      data.push({id, height});
    });
    data.sort(function(a, b) {return a.height - b.height}).map(function(i) {
      $("#colorsAssigned").append($("#"+i.id));
    });
  }

  // auto assign color based on luminosity or hue
  function autoAssing(type) {
    var imageData = ctx.getImageData(0, 0, mapWidth, mapHeight);
    var data = imageData.data;
    $("#landmass > path, .color-div").remove();
    $("#colorsAssigned").fadeIn();
    $("#colorsUnassigned").fadeOut();
    var heights = [];
    polygons.map(function(i, d) {
      var x = rn(i.data[0]), y = rn(i.data[1]);      
      if (y == mapHeight) {y--;}
      if (x == mapWidth) {x--;}
      var p = (x + y * mapWidth) * 4;
      var r = data[p], g = data[p + 1], b = data[p + 2];
      var lab = d3.lab("rgb(" + r + ", " + g + ", " + b + ")");
      if (type === "hue") {
        var normalized = rn(normalize(lab.b + lab.a / 2, -50, 200), 2);
      } else {
        var normalized = rn(normalize(lab.l, 0, 100), 2);
      }
      heights.push(normalized);
      var rgb = color(1 - normalized);
      var hex = toHEX(rgb);
      cells[d].height = normalized;
      landmass.append("path").attr("d", "M" + i.join("L") + "Z").attr("data-i", d).attr("fill", hex).attr("stroke", hex);      
    });
    heights.sort(function(a, b) {return a - b;});
    var unique = [...new Set(heights)];
    unique.map(function(i) {
      var rgb = color(1 - i);
      var hex = toHEX(rgb);
      $("#colorsAssigned").append('<div class="color-div" id="' + hex.substr(1) + '" data-height="' + i + '" style="background-color: ' + hex + ';"/>');
    });
    $(".color-div").click(selectColor);
  }

  function normalize(val, min, max) {
    var normalized = (val - min) / (max - min);
    if (normalized < 0) {normalized = 0;}
    if (normalized > 1) {normalized = 1;}     
    return normalized;
  }

  function completeConvertion() {
    mockHeightmap();
    canvas.style.opacity = convertOverlay.value = convertOverlayValue.innerHTML = 0;
    $("#imageConverter").dialog('close');
  }

  // Clear the map
  function undraw() {
    svg.selectAll("path, circle, line, text, #ruler > g").remove();
    cells = [], land = [], riversData = [], island = 0, manors = [], states = [], queue = [];
    history = [], historyStage = -1; redo.disabled = true; undo.disabled = true; // clear history
  }

  // Enter Heightmap Customization mode
  function customizeHeightmap() {
    customization = 1;
    svg.transition().duration(1000).call(zoom.transform, d3.zoomIdentity);
    $("#customizationMenu").slideDown();
    viewbox.style("cursor", "crosshair").call(drag);
    landmassCounter.innerHTML = "0";
    $('#grid').fadeIn();
    $('#toggleGrid').removeClass("buttonoff");
    if ($("#labelEditor").is(":visible")) {$("#labelEditor").dialog('close');}
    if ($("#riverEditor").is(":visible")) {$("#riverEditor").dialog('close');}
  }
  
  // Remove all customization related styles, reset values
  function exitCustomization() {
    customization = 0;
    canvas.style.opacity = 0;
    $("#customizationMenu").slideUp();
    $("#getMap").attr("disabled", true).addClass("buttonoff");
    $("#landmass").empty();
    $('#grid').empty().fadeOut();
    $('#toggleGrid').addClass("buttonoff");      
    viewbox.style("cursor", "default").on(".drag", null);
    if (!$("#toggleHeight").hasClass("buttonoff")) {toggleHeight();}
    if ($("#imageConverter").is(":visible")) {$("#imageConverter").dialog('close');}
    if ($("#brushesPanel").is(":visible")) {$("#brushesPanel").dialog('close');}
    if ($("#templateEditor").is(":visible")) {$("#templateEditor").dialog('close');}
    history = [];
    historyStage = -1;
  }
  
  // open editCountries dialog
  function editCountries() {
    $("#countriesBody").empty();
    $("#countriesHeader").children().removeClass("icon-sort-name-up icon-sort-name-down icon-sort-number-up icon-sort-number-down");
    var totalArea = 0, totalBurgs = 0, unit, areaConv;
    if (areaUnit.value === "square") {unit = " " + distanceUnit.value + "²";} else {unit = " " + areaUnit.value;}
    var totalPopulation = 0;
    for (var s = 0; s < states.length; s++) {
      $("#countriesBody").append('<div class="states" id="state' + s + '"></div>');
      var el = $("#countriesBody div:last-child");
      var burgs = states[s].burgs;
      totalBurgs += burgs;
      // calculate user-friendly area and population
      var area = rn(states[s].area * Math.pow(distanceScale.value, 2));
      totalArea += area;
      areaConv = si(area) + unit;
      var urban = rn(states[s].urbanPopulation * +urbanization.value * populationRate.value);
      var rural = rn(states[s].ruralPopulation  * populationRate.value);
      var population = (urban + rural) * 1000;
      totalPopulation += population;
      var populationConv = si(population);
      var title = `Total population: ${population}K\nRural population: ${rural}K\nUrban population: ${urban}K`;    
      // append elements to countriesBody
      if (states[s].color !== "neutral") {
        el.append('<input title="Country color. Click to change" class="stateColor" type="color" value="' + states[s].color + '"/>');
        el.append('<input title="Country name. Click and type to change" class="stateName" value="' + states[s].name + '" autocorrect="off" spellcheck="false"/>');
        var capital = states[s].capital !== "select" ? manors[states[s].capital].name : "select";
        if (capital === "select") {
          el.append('<button title="Click on map to select a capital or to create a new capital" class="selectCapital" id="selectCapital' + s + '">★ select</button>');
        } else {
          el.append('<span title="Country capital. Click to enlange" class="icon-star-empty enlange"></span>');
          el.append('<input title="Capital name. Click and type to rename" class="stateCapital" value="' + capital + '" autocorrect="off" spellcheck="false"/>');          
        }
        el.append('<span title="Country expansionism (defines competitive size)" class="icon-resize-full hidden"></span>');
        el.append('<input title="Capital expansionism (defines competitive size)" class="statePower hidden" type="number" min="0" max="99" step="0.1" value="' + states[s].power + '"/>');
      } else {
        el.append('<input class="stateColor placeholder" type="color"/>');
        el.append('<input title="Neutral burgs are united into this group. Click to change the group name" class="stateName italic" id="stateName' + s + '" value="' + states[s].name + '" autocorrect="off" spellcheck="false"/>');
        el.append('<span class="icon-star-empty placeholder"></span>');
        el.append('<input class="stateCapital placeholder"/>');
        el.append('<span class="icon-resize-full hidden placeholder"></span>');
        el.append('<input class="statePower hidden placeholder" value="0.0"/>');
      }
      el.append('<span title="Cells count" class="icon-check-empty"></span>');
      el.append('<div title="Cells count" class="stateCells">' + states[s].cells + '</div>');
      el.append('<span title="Burgs count. Click to show a full list" style="padding-right: 1px" class="stateBIcon icon-dot-circled"></span>');
      el.append('<div title="Burgs count. Click to show a full list" class="stateBurgs">' + burgs + '</div>');
      el.append('<span title="Area: ' + (area + unit) + '" style="padding-right: 4px" class="icon-map-o"></span>');
      el.append('<div title="Area: ' + (area + unit) + '" class="stateArea">' + areaConv + '</div>');
      el.append('<span title="' + title + '" class="icon-male"></span>');
      el.append('<input title="' + title + '" class="statePopulation" value="' + populationConv + '">');
      if (states[s].color !== "neutral") {
        el.append('<span title="Remove country, all assigned cells will become Neutral" class="icon-trash-empty"></span>');
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
        minHeight: "auto", width: "auto",
        position: {my: "right top", at: "right-10 top+10", of: "svg"}
      }).on("dialogclose", function() {$("#countriesManuallyCancel").click();});      
    }
    // restore customization Editor version
    if (customization === 3) {
      $("div[data-sortby='expansion'], .statePower, .icon-resize-full").removeClass("hidden");
      $("div[data-sortby='cells'], .stateCells, .icon-check-empty").addClass("hidden");
    } else {
      $("div[data-sortby='expansion'], .statePower, .icon-resize-full").addClass("hidden");
      $("div[data-sortby='cells'], .stateCells, .icon-check-empty").removeClass("hidden");
    }
    // populate total line on footer
    countriesFooterCountries.innerHTML = states.length;
    if (states[states.length-1].color === "neutral") {countriesFooterCountries.innerHTML = states.length - 1;}
    countriesFooterBurgs.innerHTML = totalBurgs;
    countriesFooterArea.innerHTML = si(totalArea) + unit;
    countriesFooterPopulation.innerHTML = si(totalPopulation);
    // handle events
    $(".enlange").click(function() {
      var s = +(this.parentNode.id).slice(5);
      var capital = states[s].capital;
      var l = labels.select("#manorLabel"+capital);
      var x = +l.attr("x"), y = +l.attr("y");
      zoomTo(x, y, 8, 1600);
    });
    $(".stateName").on("input", function() {
      var s = +(this.parentNode.id).slice(5);
      states[s].name = this.value;
      labels.select("#regionLabel"+s).text(this.value);
      if ($("#burgsEditor").is(":visible")) {
        if ($("#burgsEditor").attr("data-state") == s) {
          var color = '<input title="Country color. Click to change" type="color" class="stateColor" value="' + states[s].color + '"/>';
          $("div[aria-describedby='burgsEditor'] .ui-dialog-title").text("Burgs of " + this.value).prepend(color);
        }
      }
    }).hover(focusStates, unfocus);
    $(".states > .stateColor").on("change", function() {
      var s = +(this.parentNode.id).slice(5);
      states[s].color = this.value;
      regions.selectAll(".region"+s).attr("fill", this.value).attr("stroke", this.value);
      if ($("#burgsEditor").is(":visible")) {
        if ($("#burgsEditor").attr("data-state") == s) {
          $(".ui-dialog-title > .stateColor").val(this.value);
        }
      }
    });
    $(".stateCapital").on("input", function() {
      var s = +(this.parentNode.id).slice(5);
      var capital = states[s].capital;
      manors[capital].name = this.value;
      labels.select("#manorLabel"+capital).text(this.value);
      if ($("#burgsEditor").is(":visible")) {
        if ($("#burgsEditor").attr("data-state") == s) {
          $("#burgs"+capital+" > .burgName").val(this.value);
        }
      }
    }).hover(focusCapital, unfocus);
    $(".stateBurgs, .stateBIcon").on("click", editBurgs).hover(focusBurgs, unfocus);
    $("#countriesBody > .states").on("click", function() {
      if ($(event.target).hasClass("selectCapital")) {
        $(event.target).toggleClass("pressed");
      } else if (customization === 2) {
        $(".selected").removeClass("selected");
        $(this).addClass("selected");
      }
    });
    $(".statePower").on("input", function() {
      var s = +(this.parentNode.id).slice(5);
      states[s].power = +this.value;
      regenerateCountries();
    });
    $(".statePopulation").on("change", function() {
      var s = +(this.parentNode.id).slice(5);
      var popOr = +$(this).parent().attr("data-population");
      var popNew = getInteger(this.value);
      if (!Number.isInteger(popNew) || popNew < 1000) {
        this.value = si(popOr);
        return;
      }
      var change = popNew / popOr;
      states[s].urbanPopulation = rn(states[s].urbanPopulation * change, 2);
      states[s].ruralPopulation = rn(states[s].ruralPopulation * change, 2);
      var urban = rn(states[s].urbanPopulation * urbanization.value * populationRate.value);
      var rural = rn(states[s].ruralPopulation  * populationRate.value);
      var population = (urban + rural) * 1000;
      $(this).parent().attr("data-population", population);
      this.value = si(population);
      var total = 0;
      $("#countriesBody > div").each(function(e, i) {
        total += +$(this).attr("data-population");
      });
      countriesFooterPopulation.innerHTML = si(total * 1000);
      if (states[s].color === "neutral") {s = "neutral";}
      manors.map(function(m) {
        if (m.region !== s) {return;}
        m.population = rn(m.population * change, 2);
      });
    });
    // fully remove country
    $(".icon-trash-empty").on("click", function() {
      alertMessage.innerHTML = `Are you sure you want to remove the country?`;
      var s = +(this.parentNode.id).slice(5);
      var capital = states[s].capital;
      if (capital === "select") {
        states.splice(s, 1);
        states.map(function(s, i) {s.i = i;});
        $("#state"+s).remove();
        return;
      }
      $(function() {$("#alert").dialog({resizable: false, title: "Remove country",
        buttons: {
          "Remove": function() {
            $(this).dialog("close");
            states.splice(s, 1);
            states.map(function(s, i) {s.i = i;});
            $("#manorLabel"+capital).detach().appendTo($("#towns")).attr("dy", -0.7); // change capital label to burg
            $("#manorIcon"+capital).attr("r", .5).attr("stroke-width", .12);
            var burgs = $.grep(manors, function(e) {return (e.region === s);});
            var urbanFactor = 0.9;
            burgs.map(function(b) {
              if (b.i === capital) {b.population *= 0.5;}
              b.population *= urbanFactor;
              b.region = "neutral";
            });
            cells.map(function(c) {
              if (c.region === s) {c.region = "neutral";}
              else if (c.region > s) {c.region -= 1;}
            });
            // re-calculate neutral data
            if (states[states.length-1].color !== "neutral") {
              states.push({i: states.length, color: "neutral", name: "Neutrals", capital: "neutral"});
            }
            redrawRegions();
            recalculateStateData(states.length - 1); // re-calc data for neutrals
            editCountries();            
          },
          Cancel: function() {$(this).dialog("close");}
        }})
      });
    });
    $("#countriesNeutral").on("change", function() {regenerateCountries();});
  }

  // burgs list + editor
  function editBurgs(context, s) {
    if (s === undefined) {s = +(this.parentNode.id).slice(5);}
    $("#burgsEditor").attr("data-state", s);
    $("#burgsBody").empty();
    $("#burgsHeader").children().removeClass("icon-sort-name-up icon-sort-name-down icon-sort-number-up icon-sort-number-down");
    var region = states[s].color === "neutral" ? "neutral" : s;
    var burgs = $.grep(manors, function(e) {return (e.region === region);});
    var populationArray = [];
    burgs.map(function(b) {
      $("#burgsBody").append('<div class="states" id="burgs' + b.i + '"></div>');
      var el = $("#burgsBody div:last-child");
      el.append('<span title="Click to enlange the burg" style="padding-right: 2px" class="enlange icon-globe"></span>');
      el.append('<input title="Burg name. Click and type to change" class="burgName" value="' + b.name + '" autocorrect="off" spellcheck="false"/>');
      el.append('<span title="Burg culture" class="icon-book" style="padding-right: 2px"></span>');
      el.append('<div title="Burg culture" class="burgCulture">' + cultures[b.culture] + '</div>');
      var population = b.population * urbanization.value * populationRate.value * 1000;
      populationArray.push(population);
      population = population > 1e4 ? si(population) : rn(population, -1);
      el.append('<span title="Population" class="icon-male"></span>');
      el.append('<input title="Population. Input to change" class="burgPopulation" value="' + population + '"/>');
      var capital = states[s].capital;
      var type = "z-burg"; // usual burg by default
      if (b.i === capital) {el.append('<span title="Capital" class="icon-star-empty"></span>'); type = "c-capital";}
      else {el.append('<span class="icon-star-empty placeholder"></span>');}
      if (cells[b.cell].port) {
        el.append('<span title="Port" class="icon-anchor small"></span>');
        if (type === "c-capital") {type = "a-capital-port";} else {type = "p-port";}
      } else {
        el.append('<span class="icon-anchor placeholder"></span>');
      }
      if (b.i !== capital) {el.append('<span title="Remove burg" class="icon-trash-empty"></span>');}
      el.attr("data-burg", b.name).attr("data-culture", cultures[b.culture]).attr("data-population", b.population).attr("data-type", type);
    });
    if (!$("#burgsEditor").is(":visible")) {
      $("#burgsEditor").dialog({
        title: "Burgs of " + states[s].name,
        minHeight: "auto", width: "auto",
        position: {my: "right bottom", at: "right-10 bottom-10", of: "svg"}
      });
      var color = '<input title="Country color. Click to change" type="color" class="stateColor" value="' + states[s].color + '"/>';
      if (region !== "neutral") {$("div[aria-describedby='burgsEditor'] .ui-dialog-title").prepend(color);}
    }
    // populate total line on footer
    burgsFooterBurgs.innerHTML = burgs.length;
    burgsFooterCulture.innerHTML = $("#burgsBody div:first-child .burgCulture").text();   
    var avPop = rn(d3.mean(populationArray), -1);
    burgsFooterPopulation.value = avPop;
    $(".enlange").click(function() {
      var b = +(this.parentNode.id).slice(5);
      var l = labels.select("#manorLabel"+b);
      var x = +l.attr("x"), y = +l.attr("y");
      zoomTo(x, y, 8, 1600);
    });
    $("#burgsBody > div").hover(focusBurg, unfocus);
    $("#burgsBody > div").click(function() {
      if (!$("#changeCapital").hasClass("pressed")) {return;}
      var type = $(this).attr("data-type");
      if (type.includes("capital")) {return;}
      var s = +$("#burgsEditor").attr("data-state");
      var b = +$(this).attr("id").slice(5);    
      var oldCap = states[s].capital;
      manors[oldCap].population *= 0.5;
      manors[b].population *= 2;
      states[s].capital = b;
      recalculateStateData(s);
      $("#manorLabel"+oldCap).detach().appendTo($("#towns")).attr("dy", -0.7);
      $("#manorIcon"+oldCap).attr("r", .5).attr("stroke-width", .12);      
      $("#manorLabel"+b).detach().appendTo($("#capitals")).attr("dy", -1.3);
      $("#manorIcon"+b).attr("r", 1).attr("stroke-width", .24);         
      updateCountryEditors();
      $("#changeCapital").removeClass("pressed");
    });
    $(".burgName").on("input", function() {
      var b = +(this.parentNode.id).slice(5);
      manors[b].name = this.value;
      labels.select("#manorLabel"+b).text(this.value);
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
      var b = +(this.parentNode.id).slice(5);
      var pop = getInteger(this.value);
      if (!Number.isInteger(pop) || pop < 10) {
        var orig = rn(manors[b].population * urbanization.value * populationRate.value * 1000, 2);
        this.value = si(orig);
        return;
      }
      populationRaw = rn(pop / urbanization.value / populationRate.value / 1000, 2);
      var change = populationRaw - manors[b].population;
      manors[b].population = populationRaw;
      $(this).parent().attr("data-population", populationRaw);
      this.value = si(pop);
      var state = manors[b].region;
      if (state === "neutral") {state = states.length - 1;}
      states[state].urbanPopulation += change;
      updateCountryPopulationUI(state);
      var average = states[state].urbanPopulation / states[state].burgs * urbanization.value * populationRate.value * 1000;
      burgsFooterPopulation.value = rn(average, -1);
    });
    $("#burgsFooterPopulation").on("change", function() {
      var state = +$("#burgsEditor").attr("data-state");
      var newPop = +this.value;
      var avPop = states[state].urbanPopulation / states[state].burgs * urbanization.value * populationRate.value * 1000;
      if (!Number.isInteger(newPop) || newPop < 10) {this.value = rn(avPop, -1); return;}      
      var change = +this.value / avPop;
      $("#burgsBody > div").each(function(e, i) {
        var b = +(this.id).slice(5);
        var pop = rn(manors[b].population * change, 2);
        manors[b].population = pop;
        $(this).attr("data-population", pop);
        var popUI = pop * urbanization.value * populationRate.value * 1000;
        popUI = popUI > 1e4 ? si(popUI) : rn(popUI, -1);        
        $(this).children().filter(".burgPopulation").val(popUI);
      });
      states[state].urbanPopulation = rn(states[state].urbanPopulation * change, 2);
      updateCountryPopulationUI(state);
    });
    $(".icon-trash-empty").on("click", function() {
      alertMessage.innerHTML = `Are you sure you want to remove the burg?`;
      var b = +(this.parentNode.id).slice(5);
      $(function() {$("#alert").dialog({resizable: false, title: "Remove burg",
        buttons: {
          "Remove": function() {
            $(this).dialog("close");
            var state = +$("#burgsEditor").attr("data-state");
            $("#burgs"+b).remove();
            var cell = manors[b].cell;
            manors[b].region = "removed";
            cells[cell].manor = undefined;
            states[state].burgs = states[state].burgs - 1;
            burgsFooterBurgs.innerHTML = states[state].burgs;
            countriesFooterBurgs.innerHTML = +countriesFooterBurgs.innerHTML - 1; 
            states[state].urbanPopulation = states[state].urbanPopulation - manors[b].population;
            var avPop = states[state].urbanPopulation / states[state].burgs * urbanization.value * populationRate.value * 1000;
            burgsFooterPopulation.value = rn(avPop, -1);
            if ($("#countriesEditor").is(":visible")) {
              $("#state"+state+" > .stateBurgs").text(states[state].burgs);
            }
            labels.select("#manorLabel"+b).remove();
            icons.select("#manorIcon"+b).remove();            
          },
          Cancel: function() {$(this).dialog("close");}
        }})
      });
    });
  }
 
  // onhover style functions
  function focusStates() {
    var s = +(this.parentNode.id).slice(5);
    var l = labels.select("#regionLabel"+s);
    l.classed("drag", true);
  }

  function focusCapital() {
    var s = +(this.parentNode.id).slice(5);
    var capital = states[s].capital;
    var l = labels.select("#manorLabel"+capital); 
    l.classed("drag", true); 
  }

  function focusBurgs() {
    var s = +(this.parentNode.id).slice(5);
    var stateManors = $.grep(manors, function(e) {return (e.region === s);});
    stateManors.map(function(m) {
      labels.select("#manorLabel"+m.i).classed("drag", true);
      burgs.select("#manorIcon"+m.i).classed("drag", true);
    });
  }  
  
  function focusBurg() {
    var b = +(this.id).slice(5);
    var l = labels.select("#manorLabel"+b);
    l.classed("drag", true);
  }

  function unfocus() {$(".drag").removeClass("drag");}

  // save dialog position if dialog window is dragged
  $(".dialog").on("dialogdragstop", function(event, ui) {
    localStorage.setItem(this.id, [ui.offset.left, ui.offset.top]);
  });
  
  // restore saved dialog position on dialog window open
  $(".dialog").on("dialogopen", function(event, ui) {
    var pos = localStorage.getItem(this.id);
    if (!pos) {return;}
    pos = pos.split(",");
    var at = `left+${pos[0]} top+${pos[1]}`;
    $(this).dialog("option", "position", {my: "left top", at: at, of: "svg"});
  });

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
      var urban = rn(states[s].urbanPopulation * +urbanization.value * populationRate.value);
      var rural = rn(states[s].ruralPopulation  * populationRate.value);
      var population = (urban + rural) * 1000;
      $("#state"+s).attr("data-population", population);
      $("#state"+s).children().filter(".statePopulation").val(si(population));
    }
  }
  
  // update dialogs if measurements are changed
  function updateCountryEditors() {
    if ($("#countriesEditor").is(":visible")) {editCountries();}
    if ($("#burgsEditor").is(":visible")) {
      var s = +$("#burgsEditor").attr("data-state");
      editBurgs(this, s);
    }
  }

  // remove drawn regions and draw all regions again
  function redrawRegions() {
    regions.selectAll("*").remove();
    stateBorders.selectAll("*").remove();
    neutralBorders.selectAll("*").remove();
    countries.selectAll("text").remove();
    drawRegions();  
  }
  
  function regenerateCountries() {
    regions.selectAll("*").remove();
    land.map(function(l) {l.region = undefined;});
    neutral = +countriesNeutral.value;
    manors.map(function(m) {
      var state = "neutral", closest = neutral; 
      var x = m.x, y = m.y;
      states.map(function(s) {
        if (s.color === "neutral") {return;}
        var c = manors[s.capital];
        var dist = Math.hypot(c.x - x, c.y - y) / s.power;
        if (cells[m.cell].fn !== cells[c.cell].fn) {dist *= 3;}
        if (dist < closest) {state = s.i; closest = dist;}
      });
      m.region = state;
      cells[m.cell].region = state;
    });
    defineRegions();
    var temp = regions.append("g").attr("id", "temp");
    land.map(function(l) {
      if (l.region === undefined) {return;}
      if (l.region === "neutral") {return;}
      var color = states[l.region].color;
      temp.append("path")
        .attr("data-cell", l.index).attr("data-state", l.region)
        .attr("d", "M" + polygons[l.index].join("L") + "Z")
        .attr("fill", color).attr("stroke", color);
    });
    var neutralBurgs = $.grep(manors, function(e) {return (e.region === "neutral");});
    var last = states.length - 1;
    var type = states[last].color;
    if (type === "neutral" && neutralBurgs.length === 0) {
      // remove neutral line
      $("#state" + last).remove();
      states.splice(-1);
    }
    // recalculate data for all countries
    states.map(function(s) {
      recalculateStateData(s.i);
      $("#state"+s.i+" > .stateCells").text(s.cells);
      $("#state"+s.i+" > .stateBurgs").text(s.burgs);
      var area = rn(s.area * Math.pow(distanceScale.value, 2));
      var unit = areaUnit.value === "square" ? " " + distanceUnit.value + "²" : " " + areaUnit.value;
      $("#state"+s.i+" > .stateArea").text(si(area) + unit);
      var urban = rn(s.urbanPopulation * urbanization.value * populationRate.value);
      var rural = rn(s.ruralPopulation  * populationRate.value);
      var population = (urban + rural) * 1000;
      $("#state"+s.i+" > .statePopulation").val(si(population));
      $("#state"+s.i).attr("data-cells", s.cells).attr("data-burgs", s.burgs)
        .attr("data-area", area).attr("data-population", population);
    });
    if (type !== "neutral" && neutralBurgs.length > 0) {
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
    var el = $(this);
    // remove sorting for all siglings except of clicked element
    el.siblings().removeClass("icon-sort-name-up icon-sort-name-down icon-sort-number-up icon-sort-number-down");
    var type = el.hasClass("alphabetically") ? "name" : "number";
    var state = "no";
    if (el.is("[class*='down']")) {state = "asc";}
    if (el.is("[class*='up']")) {state = "desc";}
    var sortby = el.attr("data-sortby");
    var list = el.parent().next(); // get list container element (e.g. "countriesBody")
    var lines = list.children("div"); // get list elements
    if (state === "no" || state === "asc") { // sort desc
      el.removeClass("icon-sort-" + type + "-down");
      el.addClass("icon-sort-" + type + "-up");
      lines.sort(function(a, b) {
        var an = a.getAttribute("data-" + sortby);
        if (an === "bottom") {return 1;}
        var bn = b.getAttribute("data-" + sortby);
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
        var an = a.getAttribute("data-" + sortby);
        if (an === "bottom") {return 1;}
        var bn = b.getAttribute("data-" + sortby);
        if (bn === "bottom") {return -1;}
        if (type === "number") {an = +an; bn = +bn;}
        if (an < bn) {return 1;}
        if (an > bn) {return -1;}
        return 0;
      });
    }
    lines.detach().appendTo(list);
  });
  
  // just apply map size that was already set
  function applyMapSize() {
    mapWidth = +mapWidthInput.value;
    mapHeight = +mapHeightInput.value;
    svg.attr("width", mapWidth).attr("height", mapHeight);
    canvas.width = mapWidth;
    canvas.height = mapHeight;
  }
    
  // change map size on manual size change or window resize
  function changeMapSize() {
    mapWidth = +mapWidthInput.value;
    mapHeight = +mapHeightInput.value;
    svg.attr("width", mapWidth).attr("height", mapHeight);
    if ($("body").hasClass("fullscreen")) {
      localStorage.removeItem("screenSize");
    } else {
      localStorage.setItem("screenSize", [mapWidth, mapHeight]);
    }
    voronoi = d3.voronoi().extent([[0, 0], [mapWidth, mapHeight]]);
    oceanPattern.select("rect").attr("width", mapWidth).attr("height", mapHeight);
    oceanLayers.select("rect").attr("width", mapWidth).attr("height", mapHeight);       
    scX = d3.scaleLinear().domain([0, mapWidth]).range([0, mapWidth]);
    scY = d3.scaleLinear().domain([0, mapHeight]).range([0, mapHeight]);
    lineGen = d3.line().x(function(d) {return scX(d.scX);}).y(function(d) {return scY(d.scY);});
    zoom.translateExtent([[0, 0], [mapWidth, mapHeight]]);
    if (d3.select("#scaleBar").size()) {
      var bbox = d3.select("#scaleBar").node().getBBox();
      var tr = [mapWidth - 10 - bbox.width, mapHeight - 10 - bbox.height];
      d3.select("#scaleBar").attr("transform", "translate(" + rn(tr[0]) + "," + rn(tr[1]) + ")");
      localStorage.removeItem("scaleBar");
    }
    $("#statusbar").css("top", mapHeight + 8);
    if ($("body").hasClass("fullscreen")) {$("#statusbar").css("top", mapHeight - 20);}
  }

  // fit full-screen map if window is resized
  $(window).resize(function() {
    if ($("body").hasClass("fullscreen")) {
      mapWidthInput.value = $(window).width();
      mapHeightInput.value = $(window).height();
      applyMapSize();
      oceanPattern.select("rect").attr("width", mapWidth).attr("height", mapHeight);
      oceanLayers.select("rect").attr("width", mapWidth).attr("height", mapHeight);
      zoom.translateExtent([[0, 0], [mapWidth, mapHeight]]);
      $("#statusbar").css("top", mapHeight - 20);
      if (d3.select("#scaleBar").size()) {
        var bbox = d3.select("#scaleBar").node().getBBox();
        var tr = [mapWidth - 10 - bbox.width, mapHeight - 10 - bbox.height];
        d3.select("#scaleBar").attr("transform", "translate(" + rn(tr[0]) + "," + rn(tr[1]) + ")");
        localStorage.removeItem("scaleBar");
      }
    }
  });

  // restore initial style
  function applyDefaultStyle() {
    viewbox.on("touchmove mousemove", moved).on("click", clicked);
    landmass.attr("opacity", 1).attr("fill", "#eef6fb");
    coastline.attr("opacity", .5).attr("stroke", "#1f3846").attr("stroke-width", .7).attr("filter", "url(#dropShadow)");
    regions.attr("opacity", .55);
    stateBorders.attr("opacity", .8).attr("stroke", "#56566d").attr("stroke-width", .5).attr("stroke-dasharray", "1.2 1.5").attr("stroke-linecap", "butt");
    neutralBorders.attr("opacity", .8).attr("stroke", "#56566d").attr("stroke-width", .3).attr("stroke-dasharray", "1 1.5").attr("stroke-linecap", "butt");
    cults.attr("opacity", .6);
    rivers.attr("opacity", 1).attr("fill", "#5d97bb");
    lakes.attr("opacity", 1).attr("fill", "#a6c1fd").attr("stroke", "#477794").attr("stroke-width", .3);
    burgs.attr("opacity", 1).attr("fill", "#ffffff").attr("stroke", "#3e3e4b");
    roads.attr("opacity", .8).attr("stroke", "#d06324").attr("stroke-width", .4).attr("stroke-dasharray", "1 2").attr("stroke-linecap", "round");
    trails.attr("opacity", .8).attr("stroke", "#d06324").attr("stroke-width", .1).attr("stroke-dasharray", ".5 1").attr("stroke-linecap", "round");
    searoutes.attr("opacity", .8).attr("stroke", "#ffffff").attr("stroke-width", .2).attr("stroke-dasharray", "1 2").attr("stroke-linecap", "round");
    grid.attr("opacity", 1).attr("stroke", "#808080").attr("stroke-width", .1);
    ruler.attr("opacity", 1).style("display", "none").attr("filter", "url(#dropShadow)");
    overlay.attr("opacity", 1).attr("stroke", "#808080").attr("stroke-width", .5);
    ocean.select("#oceanBase").attr("opacity", 1).attr("fill", "#5167a9");
    labels.attr("opacity", 1);
    size = rn(10 - capitalsCount / 20);
    capitals.attr("fill", "#3e3e4b").attr("opacity", 1).attr("font-family", "Amatic SC").attr("data-font", "Amatic+SC:700").attr("font-size", size).attr("data-size", size);
    towns.attr("fill", "#3e3e4b").attr("opacity", 1).attr("font-family", "Amatic SC").attr("data-font", "Amatic+SC:700").attr("font-size", 4).attr("data-size", 4);
    size = rn(18 - capitalsCount / 6);
    countries.attr("fill", "#3e3e4b").attr("opacity", 1).attr("font-family", "Amatic SC").attr("data-font", "Amatic+SC:700").attr("font-size", size).attr("data-size", size);
    addedLabels.attr("fill", "#3e3e4b").attr("opacity", 1).attr("font-family", "Amatic SC").attr("data-font", "Amatic+SC:700").attr("font-size", 18).attr("data-size", 18);
  }

  // Options handlers
  $("input, select").on("input change", function() {
    var id = this.id;
    if (id === "styleElementSelect") {
      var sel = this.value;
      var el = viewbox.select("#"+sel);
      $("#styleInputs div").hide();
      if (sel === "rivers" || sel === "oceanBase" || sel === "lakes" || sel === "landmass" || sel === "burgs") {
        $("#styleFill").css("display", "inline-block");
        styleFillInput.value = styleFillOutput.value = el.attr("fill");
      }
      if (sel === "roads" || sel === "trails" || sel === "searoutes" || sel === "lakes" || sel === "stateBorders" || sel === "neutralBorders" || sel === "grid" || sel === "overlay" || sel === "coastline") {
        $("#styleStroke").css("display", "inline-block");
        styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke");
        $("#styleStrokeWidth").css("display", "block");
        var width = el.attr("stroke-width") || "";
        styleStrokeWidthInput.value = styleStrokeWidthOutput.value = width;
      }
      if (sel === "roads" || sel === "trails" || sel === "searoutes" || sel === "stateBorders" || sel === "neutralBorders" || sel === "overlay") {
        $("#styleStrokeDasharray, #styleStrokeLinecap").css("display", "block");
        styleStrokeDasharrayInput.value = el.attr("stroke-dasharray") || "";
        styleStrokeLinecapInput.value = el.attr("stroke-linecap") || "inherit";
      }
      if (sel === "regions") {
        $("#styleMultiple").css("display", "inline-block");
        $("#styleMultiple input").remove();
        //var count = +$("#regions > path:last").attr("class").slice(6) + 1;
        for (var s = 0; s < states.length; s++) {
          var color = regions.select(".region"+s).attr("fill");
          $("#styleMultiple").append('<input type="color" id="regionColor' + s + '" value="' + states[s].color + '"/>');
        }
        $("#styleMultiple input").on("input", function() {
          var id = this.id;
          var r = +id.replace("regionColor", "");
          states[r].color = this.value;
          regions.selectAll(".region"+r).attr("fill", this.value).attr("stroke", this.value); 
        });
      }
      if (sel === "terrs") {$("#styleScheme").css("display", "block");}  
      if (sel === "heightmap") {$("#styleScheme").css("display", "block");} 
      if (sel === "cults") {
        $("#styleMultiple").css("display", "inline-block");
        $("#styleMultiple input").remove();
        var colors = [];
        cults.selectAll("path").each(function(d) {
          var fill = d3.select(this).attr("fill");
          if (colors.indexOf(fill) === -1) {colors.push(fill);}
        });
        for (var c = 0; c < colors.length; c++) {
          $("#styleMultiple").append('<input type="color" id="' + colors[c].substr(1) + '" value="' + colors[c] + '"/>');
        }
        $("#styleMultiple input").on("input", function() {
          var oldColor = "#" + d3.select(this).attr("id");
          var newColor = this.value;
          cults.selectAll("path").each(function() {
            var fill = d3.select(this).attr("fill");
            if (oldColor === fill) {d3.select(this).attr("fill", newColor).attr("stroke", newColor);}
          });
          $(this).attr("id", newColor.substr(1));
        });
      }
      if (sel === "labels") {
        $("#styleFill, #styleFontSize").css("display", "inline-block");
        styleFillInput.value = styleFillOutput.value = el.select("g").attr("fill");
      }      
      if (sel === "burgs") {
        $("#styleSize").css("display", "block");
        $("#styleStroke").css("display", "inline-block");
        styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke");
      }
      if (sel === "overlay") {
        $("#styleOverlay").css("display", "block");
      }
      // opacity
      $("#styleOpacity, #styleFilter").css("display", "block");
      var opacity = el.attr("opacity") || 1;
      styleOpacityInput.value = styleOpacityOutput.value = opacity;
      // filter
      if (sel == "oceanBase") {el = oceanLayers;}
      styleFilterInput.value = el.attr("filter") || "";
      return;
    }
    if (id === "styleFillInput") {
      styleFillOutput.value = this.value;
      var el = svg.select("#"+styleElementSelect.value);
      if (styleElementSelect.value !== "labels") {
          el.attr('fill', this.value);
      } else {
        el.selectAll("g").attr('fill', this.value);
      }
      return;
    }
    if (id === "styleStrokeInput") {
      styleStrokeOutput.value = this.value;
      var el = svg.select("#"+styleElementSelect.value);
      el.attr('stroke', this.value);
      return;
    }
    if (id === "styleStrokeWidthInput") {
      styleStrokeWidthOutput.value = this.value;
      var sel = styleElementSelect.value;
      svg.select("#"+sel).attr('stroke-width', +this.value);
      return;
    }
    if (id === "styleStrokeDasharrayInput") {
      var sel = styleElementSelect.value;
      svg.select("#"+sel).attr('stroke-dasharray', this.value);
      return;
    }
    if (id === "styleStrokeLinecapInput") {
      var sel = styleElementSelect.value;
      svg.select("#"+sel).attr('stroke-linecap', this.value);
      return;
    }
    if (id === "styleOpacityInput") {
      styleOpacityOutput.value = this.value;
      var sel = styleElementSelect.value;
      svg.select("#"+sel).attr('opacity', this.value);
      return;
    }
    if (id === "styleFilterInput") {
      var sel = styleElementSelect.value;
      if (sel == "oceanBase") {sel = "oceanLayers";}
      var el = svg.select("#"+sel);
      el.attr('filter', this.value);
      return;
    }
    if (id === "styleSchemeInput") {
      terrs.selectAll("path").remove();
      toggleHeight();
      return;
    }
    if (id === "styleOverlayType") {
      overlay.selectAll("*").remove();
      if (!$("#toggleOverlay").hasClass("buttonoff")) {
        toggleOverlay();
      }
    }
    if (id === "styleOverlaySize") {
      styleOverlaySizeOutput.value = this.value;
      overlay.selectAll("*").remove();
      if (!$("#toggleOverlay").hasClass("buttonoff")) {
        toggleOverlay();
      }
    }
    if (id === "mapWidthInput" || id === "mapHeightInput") {changeMapSize();}
    if (id === "sizeInput") {graphSize = sizeOutput.value = this.value;}
    if (id === "randomizeInput") {randomizeOutput.innerHTML = +this.value ? "✓" : "✕";}
    if (id === "manorsInput") {
      if (randomizeInput.value === "1") {
        randomizeInput.value = 0;
        randomizeOutput.innerHTML = "✕";
      }
      manorsCount = manorsOutput.value = this.value;
    }
    if (id === "regionsInput") {
      if (randomizeInput.value === "1") {
        randomizeInput.value = 0;
        randomizeOutput.innerHTML = "✕";
      }      
      capitalsCount = regionsOutput.value = this.value;
      var size = rn(6 - capitalsCount / 20);
      if (size < 3) {size = 3;}
      capitals.attr("data-size", size);
      size = rn(18 - capitalsCount / 6);
      if (size < 4) {size = 4;}
      countries.attr("data-size", size);
    }
    if (id === "powerInput") {powerOutput.value = this.value;}
    if (id === "neutralInput") {neutral = neutralOutput.value = this.value;}
    if (id === "swampinessInput") {swampiness = swampinessOutput.value = this.value;}
    if (id === "sharpnessInput") {sharpness = sharpnessOutput.value = this.value;}
    if (id === "precInput") {
      precipitation = precOutput.value = +precInput.value;
      if (randomizeInput.value === "1") {
        randomizeInput.value = 0;
        randomizeOutput.innerHTML = "✕";
      }
    }
    if (id === "convertOverlay") {canvas.style.opacity = convertOverlayValue.innerHTML = +this.value;}
    if (id === "populationRate") {
      var population = +populationRate.value;
      var output = si(population * 1000);
      populationRateOutput.innerHTML = output;
      updateCountryEditors();
    }
    if (id === "urbanization") {
      urbanizationOutput.innerHTML = this.value;
      updateCountryEditors();
    }
    if (id === "distanceUnit" || id === "distanceScale" || id === "areaUnit") {
      var dUnit = distanceUnit.value;
      if (id === "distanceUnit" && dUnit === "custom_name") {
        var custom = prompt("Provide a custom name for distance unit");
        if (custom) {
          var opt = document.createElement("option");
          opt.value = opt.innerHTML = custom;
          distanceUnit.add(opt);
          distanceUnit.value = custom;
        } else {
          this.value = "km"; return;
        }
      }
      var scale = distanceScale.value;
      scaleOutput.innerHTML = scale + " " + dUnit;
      ruler.selectAll("g").each(function() {
        var label;
        var g = d3.select(this);
        var area = +g.select("text").attr("data-area");
        if (area) {
          var areaConv = area * Math.pow(scale, 2); // convert area to distanceScale
          var unit = areaUnit.value;
          if (unit === "square") {unit = dUnit + "²"} else {unit = areaUnit.value;}
          label = si(areaConv) + " " + unit;
        } else {
          var dist = +g.select("text").attr("data-dist");
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
  });

  $("#rescaler").change(function() {
      var change = rn((+this.value - 5) / 10, 2);
      modifyHeights("all", change, 1);
      mockHeightmap();
      rescaler.value = 5;
  });

  $("#layoutPreset").on("change", function() { 
    var preset = this.value;
    $("#mapLayers li").not("#toggleOcean, #toggleLandmass").addClass("buttonoff");
    $("#toggleOcean, #toggleLandmass").removeClass("buttonoff");
    $("#oceanPattern, #landmass").fadeIn();
    $("#rivers, #terrain, #borders, #regions, #burgs, #labels, #routes, #grid").fadeOut();
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
    }
    if (preset === "layoutCultural") {
      toggleRivers.click();
      toggleRelief.click();
      toggleBorders.click();
      $("#toggleCultures").click();
      toggleIcons.click();
      toggleLabels.click();
    }
    if (preset === "layoutEconomical") {
      toggleRivers.click();
      toggleRelief.click();
      toggleBorders.click();
      toggleIcons.click();
      toggleLabels.click();
      toggleRoutes.click();
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
    var id = this.id;
    if (id === "layoutTab") {$("#layoutContent").show();}
    if (id === "styleTab") {$("#styleContent").show();}
    if (id === "optionsTab") {$("#optionsContent").show();}
    if (id === "customizeTab") {$("#customizeContent").show();}
    if (id === "aboutTab") {$("#aboutContent").show();}
  });
}