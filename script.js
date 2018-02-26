// Fantasy Map Generator main script
"use strict;"
fantasyMap();
function fantasyMap() {
  // Declare variables
  var svg = d3.select("svg"),
    mapWidth = +svg.attr("width"),
    mapHeight = +svg.attr("height"),
    defs = svg.select("#deftemp"),
    viewbox = svg.append("g").attr("id", "viewbox").on("touchmove mousemove", moved).on("click", clicked),
    ocean = viewbox.append("g").attr("id", "ocean"),
    oceanLayers = ocean.append("g").attr("id", "oceanLayers"),
    oceanPattern = ocean.append("g").attr("id", "oceanPattern"),
    landmass = viewbox.append("g").attr("id", "landmass"),
    terrs = viewbox.append("g").attr("id", "terrs"),
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
    grid = viewbox.append("g").attr("id", "grid"),
    searoutes = routes.append("g").attr("id", "searoutes"),
    labels = viewbox.append("g").attr("id", "labels"),
    icons = viewbox.append("g").attr("id", "icons"),
    burgs = icons.append("g").attr("id", "burgs"),
    debug = viewbox.append("g").attr("id", "debug");
   
  // Declare styles
    landmass.attr("fill", "#eef6fb");
    coastline.attr("opacity", .5).attr("stroke", "#1f3846").attr("stroke-width", .7).attr("filter", "url(#blurFilter)");
    regions.attr("opacity", .55);
    stateBorders.attr("opacity", .8).attr("stroke", "#56566d").attr("stroke-width", .5).attr("stroke-dasharray", "1.2 1.5").attr("stroke-linecap", "butt");
    neutralBorders.attr("opacity", .8).attr("stroke", "#56566d").attr("stroke-width", .3).attr("stroke-dasharray", "1 1.5").attr("stroke-linecap", "butt");
    cults.attr("opacity", .6);
    rivers.attr("fill", "#5d97bb");
    lakes.attr("fill", "#a6c1fd").attr("stroke", "#477794").attr("stroke-width", .3);
    burgs.attr("fill", "#ffffff").attr("stroke", "#3e3e4b");
    roads.attr("opacity", .8).attr("stroke", "#d06324").attr("stroke-width", .4).attr("stroke-dasharray", "1 2").attr("stroke-linecap", "round");
    trails.attr("opacity", .8).attr("stroke", "#d06324").attr("stroke-width", .1).attr("stroke-dasharray", ".5 1").attr("stroke-linecap", "round");
    searoutes.attr("opacity", .8).attr("stroke", "#ffffff").attr("stroke-width", .2).attr("stroke-dasharray", "1 2").attr("stroke-linecap", "round");
    grid.attr("stroke", "#808080").attr("stroke-width", .1);

  // canvas
  var canvas = document.getElementById("canvas"),
    ctx = canvas.getContext("2d");    
    
  // Color schemes
  var color = d3.scaleSequential(d3.interpolateSpectral),
      colors8 = d3.scaleOrdinal(d3.schemeSet2),
      colors20 = d3.scaleOrdinal(d3.schemeCategory20);

  // Version control
  var version = "0.52b";
  document.title = document.title + " v. " + version;

  // Common variables
  var customization, elSelected, cells = [], land = [], riversData = [],  manors = [], 
    queue = [], chain = {}, island = 0, cultureTree, manorTree;
  var graphSize = +sizeInput.value,
    manorsCount = manorsInput.value,
    capitalsCount = regionsInput.value,
    power = powerInput.value,
    neutral = neutralInput.value,
    swampiness = swampinessInput.value,
    sharpness = sharpnessInput.value;
  if (neutral === "100") {neutral = "300";}

  // Groups for labels
  var fonts = ["Amatic+SC:700"],
    capitals = labels.append("g").attr("id", "capitals").attr("fill", "#3e3e4b").attr("opacity", 1).attr("font-family", "Amatic SC").attr("data-font", "Amatic+SC:700").attr("font-size", Math.round(6 - capitalsCount / 20)),
    towns = labels.append("g").attr("id", "towns").attr("fill", "#3e3e4b").attr("opacity", 1).attr("font-family", "Amatic SC").attr("data-font", "Amatic+SC:700").attr("font-size", 2),
    countries = labels.append("g").attr("id", "countries").attr("fill", "#3e3e4b").attr("opacity", 1).attr("font-family", "Amatic SC").attr("data-font", "Amatic+SC:700").attr("font-size",  Math.round(18 - capitalsCount / 6));
  
  // append ocean pattern
  oceanPattern.append("rect").attr("x", 0).attr("y", 0)
    .attr("width", mapWidth).attr("height", mapHeight).attr("class", "pattern")
    .attr("stroke", "none").attr("fill", "url(#oceanPattern)");
  oceanLayers.append("rect").attr("x", 0).attr("y", 0)
    .attr("width", mapWidth).attr("height", mapHeight).attr("id", "oceanBase").attr("fill", "#5167a9");

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
    scale = d3.event.transform.k;
    viewX = d3.event.transform.x;
    viewY = d3.event.transform.y;
    viewbox.attr("transform", d3.event.transform);   
  }

  // Manually update viewbox
  function zoomUpdate() {
    var transform = d3.zoomIdentity.translate(viewX, viewY).scale(scale);
    svg.call(zoom.transform, transform);
  }

  generate(); // genarate map on load

  function generate() {
    console.group("Random map");
    console.time("TOTAL");
    placePoints();
    calculateVoronoi(points);
    detectNeighbors();
    defineHeightmap();
    markFeatures();
    drawOcean();
    reGraph();
    resolveDepressions();
    flux();
    drawRelief();
    drawCoastline();
    manorsAndRegions();
    console.timeEnd("TOTAL");
    console.groupEnd("Random map");
  }

  // Locate points to calculate Voronoi diagram
  function placePoints() {
    console.time("placePoints");
    points = [];
    var radius = 5.9 / graphSize; // 5.9 is a radius to get 8k cells
    var sampler = poissonDiscSampler(mapWidth, mapHeight, radius);
    while (sample = sampler()) {points.push([Math.ceil(sample[0]), Math.ceil(sample[1])]);}
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
      $("#lx").text(Math.ceil(point[0]));
      $("#ly").text(Math.ceil(point[1]));
      $("#cell").text(i);
      $("#height").text(ifDefined(p.height, 2));
      $("#flux").text(ifDefined(p.flux, 3));
      $("#river").text(ifDefined(p.river));
      $("#region").text(ifDefined(p.region));
      $("#feature").text(ifDefined(p.feature) + "" + ifDefined(p.featureNumber));
      $("#score").text(ifDefined(p.score));
      $("#path").text(ifDefined(p.path));
      $("#culture").text(ifDefined(cultures[p.culture]));
      d3.select("body").on("keydown", function() {
        if (d3.event.keyCode == 32) {console.table(p);}
        if (d3.event.keyCode == 77) {console.table(manors);}
        if (d3.event.keyCode == 67) {console.log(cells);}
      });
    }
    // draw line for Customization range placing
    icons.selectAll(".line").remove();
    if (customization === 1 && icons.selectAll(".tag").size() === 1) {
      var x = +icons.select(".tag").attr("cx");
      var y = +icons.select(".tag").attr("cy");
      icons.insert("line", ":first-child").attr("class", "line").attr("x1", x).attr("y1", y).attr("x2", point[0]).attr("y2", point[1]);
    }
  }

  // return value (e) if defined with specified number of decimals (f)
  function ifDefined(e, f) {
    if (e == undefined) {return "no";}
    if (f) {return e.toFixed(f);}
    return e;
  }

  // Drag actions
  function dragstarted() {
    var x0 = d3.event.x,
        y0 = d3.event.y,
        c0 = diagram.find(x0, y0).index,
        c1 = c0;
    d3.event.on("drag", function() {
      if (customization === 1) {
        var x1 = d3.event.x,
            y1 = d3.event.y,
            c2 = diagram.find(x1, y1).index;
        if (c2 !== c1) {
          c1 = c2;
          var brush = $("#options .pressed").attr("id");
          var power = +brushPower.value;
          if (brush === "brushElevate") {
            if (cells[c2].height < 0.2) {cells[c2].height = 0.2} else {cells[c2].height += power;}
          }
          if (brush === "brushDepress") {cells[c2].height -= power;}
          if (brush === "brushHill") {add(c2, "hill", power);}
          if (brush === "brushPit") {addPit(1, power, c2);}
          if (brush === "brushAlign") {cells[c2].height = cells[c0].height;}
          if (brush === "brushSmooth") {
            var heights = [cells[c2].height];
            cells[c2].neighbors.forEach(function(e) {heights.push(cells[e].height);});
            cells[c2].height = d3.mean(heights);
          }
        }  
        mockHeightmap();
      } else {
        viewbox.on(".drag", null);
      }
    });
  }
  
  
  // turn D3 polygons array into cell array, define neighbors for each cell
  function detectNeighbors(withGrid) {
    console.time("detectNeighbors");
    var gridPath = ""; // store grid as huge single path string
    polygons.map(function(i, d) {
      var neighbors = [];
      var type; // define type, -99 for map borders
    if (withGrid) {gridPath += "M" + i.join("L") + "Z";} // grid path
      diagram.cells[d].halfedges.forEach(function(e) {
        var edge = diagram.edges[e], ea;
        if (edge.left && edge.right) {
          ea = edge.left.index;
          if (ea === d) {ea = edge.right.index;}
          neighbors.push(ea);
        } else {
          if (edge.left) {ea = edge.left.index;} else {ea = edge.right.index;}
          type = -99; // polygon is on border if it has edge without opposite side polygon
        }
      })
      cells.push({index: d, data: i.data, height: 0, type, neighbors});
    });
  if (withGrid) {grid.append("path").attr("d", round(gridPath));}
    console.timeEnd("detectNeighbors");
  }

  // Generate Heigtmap routine
  function defineHeightmap() {
    console.time('defineHeightmap');
    var mapTemplate = templateInput.value;
    if (mapTemplate === "Random") {
      var rnd = Math.random();
      if (rnd > 0.98) {mapTemplate = "Volcano";}
      if (rnd > 0.8  && rnd <= 0.98) {mapTemplate = "High Island";}
      if (rnd > 0.62 && rnd <= 0.8) {mapTemplate = "Low Island";}
      if (rnd > 0.35 && rnd <= 0.62) {mapTemplate = "Continents";}
      if (rnd > 0.01 && rnd <= 0.35) {mapTemplate = "Archipelago";}
      if (rnd <= 0.01) {mapTemplate = "Atoll";}
    }
    addMountain();
    if (mapTemplate === "Volcano") {templateVolcano();}
    if (mapTemplate === "High Island") {templateHighIsland();}
    if (mapTemplate === "Low Island") {templateLowIsland();}
    if (mapTemplate === "Continents") {templateContinents();}
    if (mapTemplate === "Archipelago") {templateArchipelago();}
    if (mapTemplate === "Atoll") {templateAtoll();}
    console.log(mapTemplate + " template is applied");
    console.timeEnd('defineHeightmap');
  }

  // Heighmap Template: Volcano
  function templateVolcano() {
    modifyHeights("all", 0.07, 1.1);
    addHill(5, 0.4);
    addHill(2, 0.15);
  }
  
// Heighmap Template: High Island
  function templateHighIsland() {
    modifyHeights("all", 0.08, 0.9);
    addRange(4);
    addHill(12, 0.25);
    addRange(-3);
    modifyHeights("land", 0, 0.75);
    addHill(3, 0.15);
  }

// Heighmap Template: Low Island
  function templateLowIsland() {
    modifyHeights("all", 0.05, 1);
    smoothHeights();
    addHill(4, 0.4);
    addHill(12, 0.2);
    addRange(-3);
    modifyHeights("land", 0, 0.3);
  }

  // Heighmap Template: Continents
  function templateContinents() {
    addHill(24, 0.25);
    addRange(2);
    addHill(3, 0.1);
    modifyHeights("land", 0, 0.7);
    var count = Math.floor(Math.random() * 7 + 2);
    addStrait(count);
    smoothHeights();
    addPit(5);
    addRange(-3);
    modifyHeights("land", 0, 0.8);
    modifyHeights("all", 0.02, 1);
  }

  // Heighmap Template: Archipelago
  function templateArchipelago() {
    modifyHeights("land", -0.2, 1);
    addHill(15, 0.15);
    addRange(-2);
    addPit(8);
    modifyHeights("land", -0.05, 0.9);
  }

  // Heighmap Template: Atoll
  function templateAtoll() {
    addHill(2, 0.35);
    addRange(1);
    modifyHeights("all", 0.07, 1);
    smoothHeights();
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
    var sharpness = 0.2;
    var radius = 0.99;
    if (type === "mountain") {radius = 0.9;}
    var queue = []; // cells to check
    var used = []; // used cells
    cells[start].height += height;
    cells[start].feature = undefined;
    queue.push(start);
    used.push(start);
    for (i = 0; i < queue.length && height >= 0.01; i++) {
      if (type == "mountain") {
        height = +cells[queue[i]].height * radius - height / 100;
      } else {
        height *= radius;
      }
      cells[queue[i]].neighbors.forEach(function(e) {
        if (used.indexOf(e) < 0) {
          var mod = Math.random() * sharpness + 1.1 - sharpness;
          if (sharpness == 0) {mod = 1;}
          cells[e].height += height * mod;
          if (cells[e].height > 1) {cells[e].height = 1;}
          cells[e].feature = undefined;
          queue.push(e);
          used.push(e);
        }
      });
    }
  }

  function addRange(mod, height, from, to) {
    var count = Math.abs(mod);
    for (c = 0; c < count; c++) {
      var diff = 0;
      var start = from;
      var end = to;
      if (!start || !end) { 
        do {
          var xf = Math.floor(Math.random() * (mapWidth*0.7)) + mapWidth*0.15;
          var yf = Math.floor(Math.random() * (mapHeight*0.6)) + mapHeight*0.2;
          start = diagram.find(xf, yf).index;
          var xt = Math.floor(Math.random() * (mapWidth*0.7)) + mapWidth*0.15;
          var yt = Math.floor(Math.random() * (mapHeight*0.6)) + mapHeight*0.2;
          end = diagram.find(xt, yt).index;
          diff = Math.hypot(xt - xf, yt - yf);
        } while (diff < 180 || diff > 400)
      }
      var range = [];
      if (start && end) {
        for (var l = 0; start != end && l < 1000; l++) {
          var min = 10000;
          cells[start].neighbors.forEach(function(e) {
            diff = Math.hypot(cells[end].data[0] - cells[e].data[0], cells[end].data[1] - cells[e].data[1]);
            if (Math.random() > 0.5) {diff = diff / 2}
            if (diff < min) {
              min = diff;
              start = e;
            }
          });
          range.push(start);
        }
      }
      if (range.length > 0) {
        var change = height ? height + 0.2 : Math.random() * 0.2 + 0.2;
        var query = [];
        var used = [];
        for (var i = 1; change >= 0.01; i++) {
          var rnd = Math.random() * 0.4 + 0.8;
          change -= i / 40 * rnd;
          range.map(function(r) {
            cells[r].neighbors.forEach(function(e) {
              if (used.indexOf(e) == -1 && Math.random() > 0.2 && change > 0) {
                query.push(e);
                used.push(e);
                if (mod > 0) {
                  cells[e].height += change;
                  if (cells[e].height > 1) {cells[e].height = 1;}
                } else if (cells[e].height >= 0.2) {
                  cells[e].height -= change;
                  if (cells[e].height < 0.1) {
                    cells[e].height = 0.13 + i / 100;
                    if (cells[e].height >= 0.2) {cells[e].height = 0.19;}
                  } 
                }
              }
            });
            range = query.slice();
          });
        }
      }
    }
  }

  function addStrait(width) {
    var top = Math.floor(Math.random() * mapWidth * 0.3 + mapWidth * 0.35);
    var bottom = Math.floor((mapWidth - top) - (mapWidth * 0.1) + (Math.random() * mapWidth * 0.2));
    var start = diagram.find(top, mapHeight * 0.1).index;
    var end = diagram.find(bottom, mapHeight * 0.9).index;
    var range = [];
    for (var l = 0; start !== end && l < 1000; l++) {
      var min = 10000;
      cells[start].neighbors.forEach(function(e) {
        diff = Math.hypot(cells[end].data[0] - cells[e].data[0], cells[end].data[1] - cells[e].data[1]);
        if (Math.random() > 0.5) {diff = diff / 2}
        if (diff < min) {min = diff; start = e;}
      });
      range.push(start);
    }
    var query = [], used = [];
    for (var i = 1; width > 0; i++) {
      width --;
      range.map(function(r) {
        cells[r].neighbors.forEach(function(e) {
          if (used.indexOf(e) == -1) {
            query.push(e), used.push(e);
            var height = (Math.floor(Math.random() * 101) + 100) / 1000;
            cells[e].height = Math.trunc(height * 100) / 100;
          }
        });
        range = query.slice();
      });
    }
  }

  function addPit(count, height, cell) {
    for (c = 0; c < count; c++) {
      var change = height ? height + 0.2 : Math.random() * 0.3 + 0.2;
      var start = cell, used = [];
      if (!start) {
        var lowlands = $.grep(cells, function(e) {return (e.height >= 0.2);});
        if (lowlands.length == 0) {return;}
        var rnd = Math.floor(Math.random() * lowlands.length);
        start = lowlands[rnd].index;
      }
      var query = [start];
      for (var i = 1; change >= 0.01; i++) {
        var rnd = Math.random() * 0.4 + 0.8;
        change -= i / 60 * rnd;
        query.map(function(p) {
          cells[p].neighbors.forEach(function(e) {
            if (used.indexOf(e) == -1 && change > 0) {
              query.push(e);
              used.push(e);
              cells[e].height -= change;
              if (cells[e].height < 0.1) {
                cells[e].height = 0.1 + i / 100;
                if (cells[e].height >= 0.2) {cells[e].height = 0.19;}
              }
            }
          });
        });
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
          i.height *= mult;
        }
      }
    });
  }

  // Smooth heights using mean of neighbors
  function smoothHeights() {
    cells.map(function(i) {
      var heights = [i.height];
      i.neighbors.forEach(function(e) {heights.push(cells[e].height);});
      i.height = d3.mean(heights);
    });
  }

  // Get polygone neighbors and update their height with small optional modifier
  function neighbors(i, height) {
    cells[i].neighbors.forEach(function(e) {
      if (!cells[e].used) {
        var mod = Math.random() * sharpness + 1.1 - sharpness;
        if (sharpness == 0.1) {mod = 1;}
        cells[e].height += height * mod;
        cells[e].used = 1;
        queue.push(e);
      }
    });
  }

  // Mark features (ocean, lakes, islands)
  function markFeatures() {
    console.time("markFeatures");
    var queue = [], lake = 0, number = 0, type, greater = 0, less = 0;
    // ensure all near border cells are ocean
    cells.map(function(l) {
      l.height = Math.trunc(l.height * 100) / 100;
      if (l.type === -99) {
        l.height = 0;
        l.neighbors.forEach(function(e) {cells[e].height = 0;});
      }
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
      if (type == "Lake" && number == 0) {type = "Ocean";}
      start = unmarked[0].index;
      queue.push(start);
      cells[start].feature = type;
      cells[start].featureNumber = number;
      while (queue.length > 0) {
        var i = queue[0];
        queue.shift();
        cells[i].neighbors.forEach(function(e) {
          if (!cells[e].feature && cells[e].height >= greater && cells[e].height < less) {
            cells[e].feature = type;
            cells[e].featureNumber = number;
            queue.push(e);
          }
          if (type == "Island" && cells[e].height < 0.2) {
            cells[i].type = 2;
            cells[e].type = -1;
            if (cells[e].feature === "Ocean") {
              if (cells[i].harbor) {
                cells[i].harbor += 1;
              } else {
                cells[i].harbor = 1;
              }
            }
          }
        });
      }
      unmarked = $.grep(cells, function(e) {return (!e.feature);});
    }
    console.timeEnd("markFeatures");
  }

  function drawOcean() {
    console.time("drawOcean");
    var limits = [], odd = 0.8; // initial odd for ocean layer is 80%
    // Define type of ocean cells based on cell distance form land
    var frontier = $.grep(cells, function(e) {return (e.type === -1);});
    if (Math.random() < odd) {limits.push(-1); odd = 0.3;}
    for (var c = -2; frontier.length > 0 && c > -10; c--) {
      if (Math.random() < odd) {limits.unshift(c); odd = 0.3;} else {odd += 0.2;} 
      frontier.map(function(i) {
        i.neighbors.forEach(function(e) {
          if (!cells[e].type) {cells[e].type = c;}
        });
      });
      frontier = $.grep(cells, function(e) {return (e.type === c);});      
    }
    if (outlineLayers.value !== "random") {limits = outlineLayers.value.split(",");}
    // Define area edges
    for (var c = 0; c < limits.length; c++) {
      var edges = [];
      for (var i = 0; i < cells.length; i++) {
        if (cells[i].feature === "Ocean" && cells[i].type >= limits[c]) {
          var cell = diagram.cells[i];
          cell.halfedges.forEach(function(e) {
            var edge = diagram.edges[e];
            if (edge.left && edge.right) {
              var ea = edge.left.index;
              if (ea === i) {ea = edge.right.index;}
              var type = cells[ea].type;
              if (type < limits[c] || type == undefined) {
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
    cells.map(function(i) {
      var height = Math.trunc(i.height * 100) / 100;
      var type = i.type || undefined;
      if (type !== -1 && type !== -2 && height < 0.2) {return;}
      var x = Math.round(i.data[0] * 10) / 10;
      var y = Math.round(i.data[1] * 10) / 10;
      var feature = i.feature;
      var featureNumber = i.featureNumber;
      var harbor = type === 2 ? +i.harbor : undefined;
      var flux = y >= mapHeight / 2 ? 0.07 : 0.1;
      var copy = $.grep(newPoints, function(e) {return (e[0] == x && e[1] == y);});
      if (!copy.length) {
        newPoints.push([x, y]);
        tempCells.push({index:tempCells.length, data:[x, y], height, type, feature, featureNumber, harbor, flux});
      }
      if (type === 2 || type === -1) { // add additional points
        i.neighbors.forEach(function(e) {
          if (cells[e].type == type) {
            var x1 = Math.ceil((x * 2 + cells[e].data[0]) / 3);
            var y1 = Math.ceil((y * 2 + cells[e].data[1]) / 3);
            copy = $.grep(newPoints, function(e) {return (e[0] == x1 && e[1] == y1);});
            if (!copy.length) {
              newPoints.push([x1, y1]);
              tempCells.push({index:tempCells.length, data:[x1, y1], height, type, feature, featureNumber, harbor, flux});
            }
          };
        });
      }
    });
    cells = tempCells; // use tempCells as the only cells array
    calculateVoronoi(newPoints); // recalculate Voronoi diagram using new points
    var gridPath = ""; // store grid as huge single path string
    cells.map(function(i, d) {
      gridPath += "M" + polygons[d].join("L") + "Z";
      var neighbors = []; // re-detect neighbors
      diagram.cells[d].halfedges.forEach(function(e) {
        var edge = diagram.edges[e], ea;
        if (edge.left && edge.right) {
          ea = edge.left.index;
          if (ea === d) {ea = edge.right.index;}
          neighbors.push(ea);
        }
      })
      i.neighbors = neighbors;
    });
    grid.append("path").attr("d", round(gridPath));
    land = $.grep(cells, function(e) {return (e.height >= 0.2);});
    land.sort(function(a, b) {return b.height - a.height;});
    console.timeEnd("reGraph");
  }

  // Draw temp Heightmap for the Journey
  function mockHeightmap() {
    $("#landmass").empty();
    var elevation = [];
    cells.map(function(i) {
      if (i.height > 1) {i.height = 1;}
      if (i.height < 0) {i.height = 0;}
      if (i.height >= 0.2) {
        elevation.push(i.height);
        landmass.append("path")
          .attr("d", "M" + polygons[i.index].join("L") + "Z")
          .attr("fill", color(1 - i.height))
          .attr("stroke", color(1 - i.height));        
      }
    });
    var elevationAverage = Math.round(d3.mean(elevation) * 100) / 100;
    var landRatio = Math.round(elevation.length / cells.length * 100)
    landmassCounter.innerHTML = elevation.length + " (" + landRatio + "%); Average Elevation: " + elevationAverage;
    if (elevation.length > 100) {
      $("#getMap").attr("disabled", false).removeClass("buttonoff");
    } else {
      $("#getMap").attr("disabled", true).addClass("buttonoff");
    }
    if (elevation.length > 0) {
      $("#featureIsland").attr("disabled", true).addClass("buttonoff");
    } else {
      $("#featureIsland").attr("disabled", false).removeClass("buttonoff");
    }
  }

  // Detect and draw the coasline
  function drawCoastline() {
    console.time('drawCoastline');
    $("#landmass").empty();
    var oceanEdges = [], lakeEdges = [];
    var edges = diagram.edges;
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      if (!e) {continue;}
      if (!e.left || !e.right) {continue;}
      var l = cells[e.left.index], r = cells[e.right.index];
      if (l.height < 0.2 && r.height < 0.2) {continue;}
      if (l.height >= 0.2 && r.height >= 0.2) {continue;}
      var start = e[0].join(" ");
      var end = e[1].join(" ");
      if (l.height > r.height) {var land = l, water = r;} else {var land = r, water = l;}
      var x = (e[0][0] + e[1][0]) / 2;
      var y = (e[0][1] + e[1][1]) / 2;
      if (water.feature === "Lake") {
        lakeEdges.push({start, end}); 
        land.data[0] = x + (land.data[0] - x) * 0.4;
        land.data[1] = y + (land.data[1] - y) * 0.4;
      } else {
        oceanEdges.push({start, end});
        if (land.type !== 1) { // locate place at shore
          var coastX = x + (land.data[0] - x) * 0.12;
          var coastY = y + (land.data[1] - y) * 0.12;
          var pointX = x + (land.data[0] - x) * 0.4;
          var pointY = y + (land.data[1] - y) * 0.4;
          land.coastX = Math.round(coastX * 100) / 100;
          land.coastY = Math.round(coastY * 100) / 100;
          land.data[0] = Math.round(pointX * 100) / 100;
          land.data[1] = Math.round(pointY * 100) / 100;
          land.type = 1;
          land.haven = water.index; // mark haven
        }        
      }
    }
    getCurveType();
    var line = getContinuousLine(oceanEdges, 1.5, 0);
    d3.select("#shape").append("path").attr("d", line).attr("fill", "white");  // draw the clippath
    landmass.append("path").attr("d", line); // draw the landmass
    coastline.append("path").attr("d", line); // draw the coastline
    line = getContinuousLine(lakeEdges, 1.5, 0);
    lakes.append("path").attr("d", line); // draw the lakes
    console.timeEnd('drawCoastline');
  }

  function getContinuousLine(edges, indention, relax) {
    var line = "";
    while (edges.length > 2) {
      var edgesOrdered = []; // to store points in a correct order
      var start = edges[0].start;
      var end = edges[0].end;
      edges.shift();
      var spl = start.split(" ");
      edgesOrdered.push({scX: spl[0], scY: spl[1]});
      spl = end.split(" ");
      edgesOrdered.push({scX: spl[0], scY: spl[1]});
      var x0 = +spl[0];
      var y0 = +spl[1];
      for (var i = 0; end !== start && i < 50000; i++) {
        var next = $.grep(edges, function(e) {return (e.start == end || e.end == end);});
        if (!next.length) {
          end = edges[0].end;
          edges.shift();
          continue;
        }
        if (next[0].start == end) {end = next[0].end;} else {end = next[0].start;}
        spl = end.split(" ");
        var dist = Math.hypot(+spl[0] - x0, +spl[1] - y0);
        if (dist >= indention && Math.random() > relax) {
          edgesOrdered.push({scX: +spl[0], scY: +spl[1]}); 
          x0 = +spl[0], y0 = +spl[1];
        }
        var rem = edges.indexOf(next[0]);
        edges.splice(rem, 1);
      }
      line += lineGen(edgesOrdered) + "Z";
    }
    return round(line);
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
      cells[min].flux = +(cells[min].flux+land[i].flux).toFixed(2);
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
        var d = drawRiver(riverAmended);
        rivers.append("path").attr("d", d).attr("data-points", JSON.stringify(riverAmended));
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
      riverAmended.push({scX:dX, scY:dY});
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
          riverAmended.push({scX:stX, scY:stY}, {scX:enX, scY:enY});              
        // if dist is medium or river is small add 1 extra point
        } else if (dist > 4 || dataRiver.length < 6) {
          var scX = (dX + eX) / 2;
          var scY = (dY + eY) / 2;
          scX += -Math.sin(angle) * meandr * side;
          scY += Math.cos(angle) * meandr * side;
          riverAmended.push({scX, scY});
        }
      }
    }
    return riverAmended;
  }

  function drawRiver(riverPoints, startWidth, widening) {
      var extraWidth = startWidth || 0.02;
      var widening = widening || 250;
      var d = lineGen(riverPoints);
      var river = defs.append("path").attr("d", d);
      var riverLength = river.node().getTotalLength();
      var riverPointsLeft = [], riverPointsRight = [];
      for (var l=0; l < riverLength; l++) {
        var point = river.node().getPointAtLength(l);
        var cell = diagram.find(point.x, point.y, 1);
        if (cell) {
          var confluence = cells[cell.index].confluence;
          if (confluence) {extraWidth += Math.atan(confluence / 100);}
        }
        var from = river.node().getPointAtLength(l - 0.1);
        var to = river.node().getPointAtLength(l + 0.1);
        var angle = Math.atan2(from.y - to.y, from.x - to.x);  
        var offset = Math.atan(l / widening) + extraWidth;
        var xLeft = point.x + -Math.sin(angle) * offset;
        var yLeft = point.y + Math.cos(angle) * offset;       
        riverPointsLeft.push({scX:xLeft, scY:yLeft});
        var xRight = point.x + Math.sin(angle) * offset;
        var yRight = point.y + -Math.cos(angle) * offset;         
        riverPointsRight.unshift({scX:xRight, scY:yRight});
      }
      var point = river.node().getPointAtLength(riverLength);
      var from = river.node().getPointAtLength(riverLength - 0.1);
      var angle = Math.atan2(from.y - point.y, from.x - point.x);
      var offset = Math.atan(riverLength / widening) + extraWidth;
      var xLeft = point.x + -Math.sin(angle) * offset;
      var yLeft = point.y + Math.cos(angle) * offset;       
      riverPointsLeft.push({scX:xLeft, scY:yLeft});
      var xRight = point.x + Math.sin(angle) * offset;
      var yRight = point.y + -Math.cos(angle) * offset;           
      riverPointsRight.unshift({scX:xRight, scY:yRight});      
      river.remove();      
      var right = lineGen(riverPointsRight);
      var left = lineGen(riverPointsLeft);
      left = left.substring(left.indexOf("C"));
      var d = right + left + "Z";
      d = d.replace(/[\d\.-][\d\.e-]*/g, function(n) {return Math.round(n*100)/100;});
      return d;
  }

  function editRiver() {
    if (elSelected) {
      if ($("#riverNew").hasClass('pressed')) {
        var point = d3.mouse(this);
        addRiverPoint({scX:point[0], scY:point[1]});
        redrawRiver();
        $("#riverNew").click(); 
        return;
      }
      elSelected.call(d3.drag().on("drag", null)).classed("draggable", false);
      rivers.select(".riverPoints").remove();
    }
    elSelected = d3.select(this);
    elSelected.call(d3.drag().on("drag", riverDrag)).classed("draggable", true);   
    var points = JSON.parse(elSelected.attr("data-points"));
    rivers.append("g").attr("class", "riverPoints").attr("transform", elSelected.attr("transform"));
    points.map(function(p) {addRiverPoint(p)});
    var tr = parseTransform(elSelected.attr("transform"));
    riverAngle.value = tr[2];
    riverAngleValue.innerHTML = Math.abs(+tr[2]) + "°";
    riverScale.value = tr[5];
    $("#riverEditor").dialog({
      title: "Edit River",
      minHeight: 30, width: "auto", maxWidth: 275, resizable: false,
      position: {my: "center top", at: "top", of: this}
    }).on("dialogclose", function(event) {
      if (elSelected) {
        elSelected.call(d3.drag().on("drag", null)).classed("draggable", false);
        rivers.select(".riverPoints").remove();
        $(".pressed").removeClass('pressed');
        viewbox.style("cursor", "default");
      }
    });
  }

  function addRiverPoint(point) {
    rivers.select(".riverPoints").append("circle")
      .attr("cx", point.scX).attr("cy", point.scY).attr("r", 0.25)
      .call(d3.drag().on("drag", riverPointDrag))
      .on("click", function(d) {
        if ($("#riverRemovePoint").hasClass('pressed')) {
          $(this).remove(); redrawRiver();            
        }
        if ($("#riverNew").hasClass('pressed')) {
          $("#riverNew").click();
        }
      });
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
      var x = 2, y = 2;
      transform = `translate(${tr[0]-x},${tr[1]-y}) rotate(${tr[2]} ${tr[3]} ${tr[4]}) scale(${tr[5]})`;
      while (rivers.selectAll("[transform='" + transform + "'][d='" + d + "']").size() > 0) {
        x += 2; y += 2;
        transform = `translate(${tr[0]-x},${tr[1]-y}) rotate(${tr[2]} ${tr[3]} ${tr[4]}) scale(${tr[5]})`;
      }
      rivers.append("path").attr("d", d).attr("data-points", points).attr("transform", transform).on("click", editRiver);
      return;
    }
    if (this.id == "riverRenegerate") {
      // restore main points
      var points = JSON.parse(elSelected.attr("data-points"));
      var riverCells = [], dataRiver = [];
      for (var p = 0; p < points.length; p++) {
        var cell = diagram.find(points[p].scX, points[p].scY, 1);
        if (cell !== null && cell !== riverCells[riverCells.length-1]) {riverCells.push(cell);}
      }
      for (var c = 0; c < riverCells.length; c++) {
        dataRiver.push({x:riverCells[c][0], y:riverCells[c][1]});
      }
      // if last point not in cell center push it with one extra point
      var last = points.pop();
      if (dataRiver[dataRiver.length-1].x !== last.scX) {
        dataRiver.push({x:last.scX, y:last.scY});
      }
      var rndFactor = 0.2 + Math.random() * 1.6; // random factor in range 0.2-1.8
      var riverAmended = amendRiver(dataRiver, rndFactor);
      lineGen.curve(d3.curveCatmullRom.alpha(0.1));
      var startWidth = 0.01 + Math.random() * 0.04;
      var widening = 100 + Math.random() * 150;
      var d = drawRiver(riverAmended, startWidth, widening);
      elSelected.attr("d", d).attr("data-points", JSON.stringify(riverAmended));
      rivers.select(".riverPoints").selectAll("*").remove();
      riverAmended.map(function(p) {addRiverPoint(p);});
      return;
    } 
    if (this.id == "riverRisize") {$("#riverAngle, #riverAngleValue, #riverScaleIcon, #riverScale, #riverReset").toggle();}
    if (this.id == "riverAddPoint" || this.id == "riverRemovePoint" || this.id == "riverNew") {
      if ($(this).hasClass('pressed')) {
        $(".pressed").removeClass('pressed');
        if (elSelected.attr("data-river") == "new") {
          rivers.select(".riverPoints").selectAll("*").remove();
          elSelected.attr("data-river", "");
          elSelected.call(d3.drag().on("drag", riverDrag)).classed("draggable", true); 
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

  function riverDrag() {
    var x = d3.event.x, y = d3.event.y;
    var el = d3.select(this);
    var tr = parseTransform(el.attr("transform"));
    d3.event.on("drag", function() {
      xc = d3.event.x, yc = d3.event.y;
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

  function riverPointDrag() {
    var x = d3.event.x, y = d3.event.y;
    var el = d3.select(this);
    d3.event
      .on("drag", function() {el.attr("cx", d3.event.x).attr("cy", d3.event.y);})
      .on("end", function() {
      if (Math.abs(d3.event.x - x) + Math.abs(d3.event.y - y) > 0) {redrawRiver();}
    });
  }

  function redrawRiver() {
    var points = [];
    rivers.select(".riverPoints").selectAll("circle").each(function() {
      var el = d3.select(this);
      points.push({scX: +el.attr("cx"), scY: +el.attr("cy")});
    });
    lineGen.curve(d3.curveCatmullRom.alpha(0.1));
    var d = drawRiver(points);
    elSelected.attr("d", d).attr("data-points", JSON.stringify(points));
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
    // temporary off as now there are too many islands and searoutes produce mess
    //checkAccessibility();
    drawManors();
    defineRegions();
    drawRegions();
    generatePortRoads();
    generateSmallRoads();
    generateOceanRoutes();
    console.groupEnd('manorsAndRegions');
  }

  // Assess cells geographycal suitability for settlement
  function rankPlacesGeography() {
    console.time('rankPlacesGeography');
    land.map(function(c) {
      var score = (1 - c.height) * 5; // base score from height (will be biom)
      if (c.type && Math.random() < 0.8 && !c.river) {
        c.score = 0; // ignore 80% of extended cells
      } else {
        if (c.type === 1 && c.harbor) {
          score += 3 - c.harbor; // good sea harbor is valued
          if (c.river && c.harbor === 1) {score += 3;} // estuaries are valued
        } 
        if (c.flux > 1) {score += c.flux / 2;} // riverbank is valued
        if (c.confluence) {score += c.confluence / 2;} // confluence is valued;
      }
      c.score = Math.floor(score);
    });
    land.sort(compareScore);
    console.timeEnd('rankPlacesGeography');
  }

  // Assess the cells economical suitability for settlement
  function rankPlacesEconomy() {
    console.time('rankPlacesEconomy');
    land.map(function(c) {
      var score = c.score;
      if (c.path) {
        var path = Math.ceil(c.path / 15);
        if (path < 1) {path = 1;}
        if (path > 5) {path = 5;}
        if (c.crossroad) {path *= 2;} // crossroads are valued
        score += path; // roads are valued
      }
      c.score = Math.floor(Math.random() * score + score); // 0.5 random factor
    });
    land.sort(compareScore);
    console.timeEnd('rankPlacesEconomy');
  }

  function compareScore(a, b) {
    if (a.score < b.score) return 1;
    if (a.score > b.score) return -1;
    return 0;
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
    if (power > 0) {spacing / power;}
    console.log(" capitals: " + capitalsCount);
    for (var l = 0; l < land.length && manors.length < capitalsCount; l++) {
      var m = manors.length;
      var dist = 10000;
      if (l > 0) {
        var closest = manorTree.find(land[l].data[0], land[l].data[1]);
        dist = Math.hypot(land[l].data[0] - closest[0], land[l].data[1] - closest[1]);
      }
      if (dist >= spacing) {
        if (land[l].harbor > 0 && land[l].type === 1) {
          land[l].port = true;
          land[l].data[0] = land[l].coastX;
          land[l].data[1] = land[l].coastY;
        }
        if (land[l].river) {
          var shift = Math.floor(0.2 * land[l].flux);
          if (shift < 0.2) {shift = 0.2;}
          if (shift > 1) {shift = 1;}
          land[l].data[0] += shift - Math.random();
          land[l].data[1] += shift - Math.random();
        }
        land[l].data[0] = +(land[l].data[0]).toFixed(2);
        land[l].data[1] = +(land[l].data[1]).toFixed(2);
        var cell = land[l].index;
        queue.push(cell);
        queue.push(...land[l].neighbors);
        var closest = cultureTree.find(land[l].data[0], land[l].data[1]);
        var culture = cultureTree.data().indexOf(closest);
        var name = generateName(culture);
        var capitalPower = Math.round((Math.random() * power / 2 + 1) * 10) / 10;
        manors.push({i: m, cell, x: land[l].data[0], y: land[l].data[1], region: m, power: capitalPower, score: land[l].score, culture, name});
        manorTree.add([land[l].data[0], land[l].data[1]]);
      }
      if (l === land.length - 1) {
        console.error("Cannot place capitals with current spacing. Trying again with reduced spacing");
        l = -1;
        manors = [];
        queue = [];
        manorTree = d3.quadtree().extent([[0, 0], [mapHeight, mapWidth]]);
        spacing /= 1.2;
      }
    }
    manors.map(function(e, i) {
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
        if (land[l].harbor === 1 && land[l].type === 1) {
          land[l].port = true;
          land[l].data[0] = land[l].coastX;
          land[l].data[1] = land[l].coastY;
        }
        queue.push(land[l].index);
        if (land[l].type || Math.random() > 0.6) {queue.push(...land[l].neighbors);}
        if (land[l].river) {
          var shift = Math.floor(0.2 * land[l].flux);
          if (shift < 0.2) {shift = 0.2;}
          if (shift > 1) {shift = 1;}
          land[l].data[0] += shift - Math.random();
          land[l].data[1] += shift - Math.random();
        }
        land[l].data[0] = +(land[l].data[0]).toFixed(2);
        land[l].data[1] = +(land[l].data[1]).toFixed(2);        
        var x = land[l].data[0];
        var y = land[l].data[1];
        var cell = land[l].index;        
        var region = "neutral", culture = -1, closest = neutral;
        for (c = 0; c < capitalsCount; c++) {
          var dist = Math.hypot(manors[c].x - x, manors[c].y - y) / manors[c].power;
          var cap = manors[c].cell;
          if (cells[cell].featureNumber !== cells[cap].featureNumber) {dist *= 3;}
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
        manors.push({i: manors.length, cell, x, y, region, score: land[l].score, culture, name});
      }
      if (l === land.length - 1) {
        console.error("Cannot place all towns. Towns requested: " + manorsCount + ". Towns placed: " + manors.length);
      }
    }
    console.timeEnd('locateTowns');
  }

  // Validate each island with manors has at least one port (so Island is accessible)
  function checkAccessibility() {
    console.time("checkAccessibility");
    for (var i = 0; i < island; i++) {
      var manorsOnIsland = $.grep(land, function(e) {return (typeof e.manor !== "undefined" && e.featureNumber === i);});
      if (manorsOnIsland.length > 0) {
        var ports = $.grep(manorsOnIsland, function(p) {return (p.port);});
        if (ports.length === 0) {
          var portCandidates = $.grep(manorsOnIsland, function(c) {return (c.harbor && c.type === 1);});
          if (portCandidates.length > 0) {
            console.error("No ports on Island " + manorsOnIsland[0].featureNumber + ". Upgrading first manor to port");
            portCandidates[0].harbor = 1;
            portCandidates[0].port = true;
            portCandidates[0].data[0] = portCandidates[0].coastX;
            portCandidates[0].data[1] = portCandidates[0].coastY;
            manors[portCandidates[0].manor].x = portCandidates[0].coastX;
            manors[portCandidates[0].manor].y = portCandidates[0].coastY;
          } else {
            console.error("Cannot generate ports on Island " + manorsOnIsland[0].featureNumber + ". Removing " + manorsOnIsland.length + " manors");
            manorsOnIsland.map(function(e) {
              manors.splice(e.manor, 1);
              e.manor = undefined;
            });
          }
        }
      }
    }
  console.timeEnd("checkAccessibility");
  }

  function generateMainRoads() {
    console.time("generateMainRoads");
    for (var i = 0; i < island; i++) {
      var manorsOnIsland = $.grep(land, function(e) {return (typeof e.manor !== "undefined" && e.featureNumber === i);});
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
    console.log(" islands: " + island);
    for (var i = 0; i < island; i++) {
      var manorsOnIsland = $.grep(land, function(e) {return (typeof e.manor !== "undefined" && e.featureNumber === i);});
      var l = manorsOnIsland.length;
      if (l > 1) {
        var secondary = Math.floor((l + 8) / 10);
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
            var road = $.grep(land, function(e) {return (e.path && e.featureNumber === i);});
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
      ports[i] = $.grep(land, function(e) {return (e.featureNumber === i && e.port);});
      if (!ports[i]) {ports[i] = [];}
    }
    ports.sort(function(a, b) {return a.length < b.length;})
    for (var i = 0; i < island; i++) {
      if (ports[i].length === 0) {break;}
      var length = ports[i].length;
      ports[i].sort(function(a, b) {return a.score < b.score;})
      var start = ports[i][0].index;
      var paths = findOceanPaths(start, -1);
      /* draw anchor icons
      for (var p = 0; p < ports[i].length; p++) {
        var x0 = ports[i][p].data[0];
        var y0 = ports[i][p].data[1];
        var x1 = cells[h.haven].data[0];
        var y1 = cells[h.haven].data[1];
        var x = x0 + (x1 - x0) * 0.8;
        var y = y0 + (y1 - y0) * 0.8;
        icons.append("use").attr("xlink:href", "#icon-anchor").attr("x", x).attr("y", y).attr("width", 1).attr("height", 1);
      } */
      for (var h = 1; h < length; h++) {
        var end = ports[i][h].index;
        restorePath(end, start, "ocean", paths);
      }
      for (var c = i + 1; c < island; c++) {
        if (ports[c].length > 3 && length > 3) {
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
            if (cells[e].type === 1) {cost *= 0.3;}
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
    // Dijkstra algorithm
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
    var next;
    var cameFrom = [];
    var costTotal = [];
    cameFrom[start] = "no";
    costTotal[start] = 0;
    queue.queue({e: start, p: 0});
    while (queue.length > 0 && next !== end) {
      next = queue.dequeue().e;
      var pol = cells[next];
      pol.neighbors.forEach(function(e) {
        if (cells[e].type < 0 || cells[e].haven === next) {
          var cost = 1;
          if (cells[e].type > 0) {cost += 100;}
          if (cells[e].type < -1) {
            var dist = Math.hypot(cells[e].data[0] - pol.data[0], cells[e].data[1] - pol.data[1]);
            cost += 50 + dist * 2;
          }
          if (cells[e].path && cells[e].type < 0) {cost *= 0.8;}
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
        if (cells[e].path && (cells[e].type === -1 || cells[e].haven === next)) {
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
    var path = [], current = end, limit = 300;
    var prev = cells[end];
    if (type === "ocean" || !prev.path) {path.push({scX: prev.data[0], scY: prev.data[1]});}
    if (!prev.path) {prev.path = 1;}
    for (var i = 0; i < limit; i++) {
      current = from[current];
      var cur = cells[current];
      if (!cur) {break;}
      if (cur.path) {
        cur.path += 1;
        path.push({scX: cur.data[0], scY: cur.data[1]});
        prev = cur;
        drawPath();
      } else {
        cur.path = 1;
        if (prev) {path.push({scX: prev.data[0], scY: prev.data[1]});}
        prev = undefined;
        path.push({scX: cur.data[0], scY: cur.data[1]});
      }
      if (current === start || !from[current]) {break;}
    }
    drawPath();
    function drawPath() {
      if (path.length > 1) {
        var line = lineGen(path);
        line = round(line);
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
        burgs.append("circle").attr("r", 1).attr("stroke-width", .24).attr("class", "manor").attr("cx", x).attr("cy", y);
        capitals.append("text").attr("x", x).attr("y", y).attr("dy", -1.3).text(name);      
      } else {
        burgs.append("circle").attr("r", .5).attr("stroke-width", .12).attr("class", "manor").attr("cx", x).attr("cy", y);
        towns.append("text").attr("x", x).attr("y", y).attr("dy", -.7).text(name);
      }
    }
    labels.selectAll("text").on("click", editLabel);
    burgs.selectAll("circle").call(d3.drag().on("drag", dragged).on("end", dragended)).on("click", changeBurg);
    console.timeEnd('drawManors');
  }

  // calculate Markov's chain from real data
  function calculateChains() {
    var vowels = "aeiouy";
    //var digraphs = ["ai","ay","ea","ee","ei","ey","ie","oa","oo","ow","ue","ch","ng","ph","sh","th","wh"];
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
      if (i.region === undefined) {
        var closest = manorTree.find(i.data[0], i.data[1]);
        var dist = Math.hypot(closest[0] - i.data[0], closest[1] - i.data[1]);
        if (dist > neutral) {
          i.region = "neutral";
          var closestCulture = cultureTree.find(i.data[0], i.data[1]);
          i.culture = cultureTree.data().indexOf(closestCulture);            
        } else {
          var manor = $.grep(manors, function(e) {return (e.x === closest[0] && e.y === closest[1]);});
          var cell = manor[0].cell;
          if (cells[cell].featureNumber !== i.featureNumber) {
            var minDist = dist * 3;
            land.map(function(l) {
              if (l.featureNumber === i.featureNumber && l.manor !== undefined) {
                var distN = Math.hypot(l.data[0] - i.data[0], l.data[1] - i.data[1]);
                if (distN < minDist) {minDist = distN; cell = l.index;}
              }
            });
          }
          i.region = cells[cell].region;
          i.culture = cells[cell].culture;
        }
      }
    });
    console.timeEnd('defineRegions');
  }

  // Define areas cells
  function drawRegions() {
    console.time('drawRegions');
    var edges = [], borderEdges = [], coastalEdges = [], neutralEdges = []; // arrays to store edges
    for (var i = 0; i < capitalsCount; i++) {
      edges[i] = [];
      land.map(function(p) {
        if (p.region === i) {
          var cell = diagram.cells[p.index];  
          cell.halfedges.forEach(function(e) {
            var edge = diagram.edges[e];
            if (edge.left && edge.right) {
              var ea = edge.left.index;
              if (ea === p.index) {ea = edge.right.index;}
              var opp = cells[ea];
              if (opp.region !== i) {
                var start = edge[0].join(" ");
                var end = edge[1].join(" ");
                edges[i].push({start, end});
                if (opp.height >= 0.2 && opp.region > i) {borderEdges.push({start, end});}
                if (opp.height >= 0.2 && opp.region === "neutral") {neutralEdges.push({start, end});}
                if (opp.height < 0.2) {coastalEdges.push({start, end});}
              }
            }
          })
        }
      });
      drawRegion(edges[i], i);
      drawRegionCoast(coastalEdges, i);
    }
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
    if (capitalsCount <= 8) {
      var scheme = colors8;
    } else {
      var scheme = colors20;
    }
    var color = scheme(region / capitalsCount);
    regions.append("path").attr("d", round(path)).attr("fill", color).attr("stroke", "none").attr("class", "region"+region);
    array.sort(function(a, b){return b.length - a.length;});
    generateRegionName(array, region);
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
    if (capitalsCount <= 8) {
      var scheme = colors8;
    } else {
      var scheme = colors20;
    }
    var color = scheme(region / capitalsCount);
    regions.append("path").attr("d", round(path)).attr("fill", "none").attr("stroke", color).attr("stroke-width", 1.5).attr("class", "region"+region);
  }

  function drawBorders(edges, type) {
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
    if (type === "state") {stateBorders.append("path").attr("d", round(path));}
    if (type === "neutral") {neutralBorders.append("path").attr("d", round(path));}
  }

  // generate region name and place label at pole of inaccessibility of the largest continuous element of the region
  function generateRegionName(array, region) {
    var name;
    var culture = manors[region].culture;
    var c = polylabel(array, 1.0); // pole of inaccessibility
    // get source name (capital name = 20%; random name = 80%)
    if (Math.random() < 0.8) {
      name = generateName(culture);
    } else {
      name = manors[region].name;
    }
    name = addRegionSuffix(name, culture);
    countries.append("text").attr("x", c[0].toFixed(2)).attr("y", c[1].toFixed(2)).text(name).on("click", editLabel);
  }

  function addRegionSuffix(name, culture) {
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
    //if (name.slice(-2) !== "ia" && culture == 5 && Math.random() > 0.5) {name += "skaya Zemya";} // special case for Slavic
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
    var ea, edge, id, cell, x, y, height, path, dash = "", rnd;
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
    strokes.append("path").attr("d", round(dash));
    hills.append("path").attr("d", round(hill[0])).attr("stroke", "#5c5c70");
    hills.append("path").attr("d", round(hShade[0])).attr("fill", "white");
    hills.append("path").attr("d", round(hill[1])).attr("stroke", "#5c5c70");
    hills.append("path").attr("d", round(hShade[1])).attr("fill", "white").attr("stroke", "white");
    swamps.append("path").attr("d", round(swamp));
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
    markFeatures();
    drawOcean();
    reGraph();
    resolveDepressions();
    flux();
    drawRelief();
    drawCoastline();
    manorsAndRegions();
    console.timeEnd("TOTAL");
  }

  // Add label or burg on mouseclick
  function clicked() {
    var brush = $("#options .pressed").attr("id");
    var point = d3.mouse(this);
    if (brush === "addLabel" || brush === "addBurg") {
      var rnd = Math.floor(Math.random() * cultures.length);
      var name = generateName(rnd);
      if (brush === "addLabel") {
        countries.append("text").attr("x", point[0]).attr("y", point[1]).text(name).on("click", editLabel);
      } else {
        burgs.append("circle").attr("r", 1).attr("stroke-width", .24)
          .attr("cx", point[0]).attr("cy", point[1])
          .call(d3.drag().on("drag", dragged).on("end", dragended)).on("click", changeBurg);
        capitals.append("text").attr("x", point[0]).attr("y", point[1]).attr("dy", -1.3).text(name).on("click", editLabel);
      }
      return;
    }
    if (customization === 1 && brush) {
      var cell = diagram.find(point[0], point[1]).index;
      var power = +brushPower.value;
      if (brush === "brushElevate") {cells[cell].height = +cells[cell].height + power;}
      if (brush === "brushDepress") {cells[cell].height = +cells[cell].height - power;}
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
      mockHeightmap();
    }
    // add new river point if elSelected is river (has data-points) and add button pressed
    if (!elSelected) {return;}
    if (elSelected.attr("data-points")) {
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
          points.push({scX:x, scY:y});
        }).remove();
        var index = dists.length;
        if (points.length > 1) {
          var sorded = dists.slice(0).sort(function(a, b) {return a-b;});  
          var closest = dists.indexOf(sorded[0]);
          var next = dists.indexOf(sorded[1]);
          if (closest <= next) {index = closest+1;} else {index = next+1;}
        }
        points.splice(index, 0, {scX:point[0], scY:point[1]});
        lineGen.curve(d3.curveCatmullRom.alpha(0.1));
        var d = drawRiver(points);
        elSelected.attr("d", d).attr("data-points", JSON.stringify(points));
        points.map(function(p) {addRiverPoint(p)});
        return;
      }
      if ($("#riverNew").hasClass('pressed')) {
        if (elSelected.attr("data-river") !== "new") {          
          elSelected.call(d3.drag().on("drag", null)).classed("draggable", false);
          elSelected = rivers.append("path").attr("data-river", "new").on("click", editRiver);
        }
        addRiverPoint({scX:point[0], scY:point[1]});
        redrawRiver();
        return;
      }
    }
  }

  // Change burg marker size on click
  function changeBurg() {
    var size = this.getAttribute("r");
    size = +size + .25;
    if (size > 1.5) {size = .5;}
    var width = this.getAttribute("stroke-width");
    width = +width + .06;
    if (width > .36) {width = .12;}
    var type = this.getAttribute("class");
    if (type) {
      d3.selectAll("."+type).attr("r", size).attr("stroke-width", width);
    } else {
      this.setAttribute("r", size);
      this.setAttribute("stroke-width", width);
    }  
  }

  function editLabel() {
    if (elSelected) {
      elSelected.call(d3.drag().on("drag", null)).classed("draggable", false);
    }
    elSelected = d3.select(this);
    elSelected.call(d3.drag().on("drag", dragged).on("end", dragended)).classed("draggable", true);
    var group = d3.select(this.parentNode);
    updateGroupOptions();
    editGroupSelect.value = group.attr("id");
    editFontSelect.value = fonts.indexOf(group.attr("data-font"));
    editSize.value = group.attr("font-size");
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
    });
    // fetch default fonts if not done before
    if (fonts.indexOf("Bitter") === -1) {
      $("head").append('<link rel="stylesheet" type="text/css" href="fonts.css">');
      fonts = ["Amatic+SC:700", "IM+Fell+English", "Great+Vibes", "Bitter", "Yellowtail", "Montez", "Lobster", "Josefin+Sans", "Shadows+Into+Light", "Orbitron", "Dancing+Script:700", "Bangers", "Chewy", "Architects+Daughter", "Kaushan+Script", "Gloria+Hallelujah", "Satisfy", "Comfortaa:700", "Cinzel"];
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
      var culture, index;
      // check if label is manor name to get culture
      var manor = $.grep(manors, function(e) {return (e.name === editText.value);});
      if (manor.length === 1) {
        culture = manor[0].culture;
        index = manor[0].i;
      } else {
        // if not get cell's culture at BBox centre
        var c = elSelected.node().getBBox();
        var x = c.x + c.width / 2;
        var y = c.y + c.height / 2;
        culture = diagram.find(x, y).culture;
        if (!culture) {culture = 0;}        
      }
      var name = generateName(culture);
      if (group.attr("id") === "countries") {name = addRegionSuffix(name, culture);}
      editText.value = name;
      elSelected.text(name);
      $("div[aria-describedby='labelEditor'] .ui-dialog-title").text("Edit Label: " + name);
      if (manor.length === 1) {manors[index].name = name;}
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
    $(this).attr("title", $(this).val());    
    elSelected.text(editText.value);
    // check if Group was changed
    var group = d3.select(elSelected.node().parentNode);
    var groupOld = group.attr("id");
    var groupNew = editGroupSelect.value;
    if (editGroupInput.value !== "") {
      groupNew = editGroupInput.value.toLowerCase().replace(/ /g, "_").replace(/[^\w\s]/gi, "");
      if (Number.isFinite(+groupNew.charAt(0))) {groupNew = "g" + groupNew;}
    }
    if (groupOld !== groupNew) {
      var removed = elSelected.remove();
      if (labels.select("#"+groupNew).size() > 0) {
        group = labels.select("#"+groupNew);
        editFontSelect.value = fonts.indexOf(group.attr("data-font"));
        editSize.value = group.attr("font-size");
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
    var font = fonts[editFontSelect.value].split(':')[0].replace(/\+/g, " ");
    group.attr("font-size", editSize.value)
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

  // source from https://gist.github.com/jimhigson/7985923
  function round(path) {
     return path.replace(/[\d\.-][\d\.e-]*/g, function(n) {return Math.round(n*10)/10;})
  }

  // downalod map as SVG or PNG file
  function saveAsImage(type) {
    console.time("saveAsImage");
    // get all used fonts
    if (type === "svg") {viewbox.attr("transform", null);}    
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

    // for each g element get inline style so it could be used in saved svg
    var emptyG = clone.append("g").node();
    var defaultStyles = window.getComputedStyle(emptyG);
    clone.selectAll("g").each(function(d) {
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
      var blob = new Blob([svg_xml], {type:'image/svg+xml;charset=utf-8'});
      var url = window.URL.createObjectURL(blob);
      var link = document.createElement("a");
      if (type === "png") {
        canvas.width = mapWidth * 2;
        canvas.height = mapHeight * 2;
        var img = new Image();
        img.src = url;
        img.onload = function(){
          ctx.drawImage(img, 0, 0, mapWidth * 2, mapHeight * 2);
          link.download = "fantasy_map_" + Date.now() + ".png";
          link.href = canvas.toDataURL('image/png');
          canvas.width = mapWidth;
          canvas.height = mapHeight;
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
      clone.remove();
      console.timeEnd("saveAsImage");
      window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 2000);
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

  // Save in .map format, based on FileSystem API
  function saveMap() {
    console.time("saveMap");
    // data convention: 0 - version; 1 - all points; 2 - cells; 3 - manors; 4 - svg;
    var svg_xml = (new XMLSerializer()).serializeToString(svg.node());
    var line = "\r\n";
    var data = version + line + JSON.stringify(points) + line + JSON.stringify(cells) + line + JSON.stringify(manors) + line + svg_xml;
    var dataBlob = new Blob([data], {type:"text/plain"});
    var dataURL = window.URL.createObjectURL(dataBlob);
    var link = document.createElement("a");
    link.download = "fantasy_map_" + Date.now() + ".map";
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    console.timeEnd("saveMap");
    window.setTimeout(function() {window.URL.revokeObjectURL(dataURL);}, 2000);
  }

  // Map Loader based on FileSystem API
  $("#fileToLoad").change(function() {
    console.time("loadMap");
    var fileToLoad = this.files[0];
    this.value = "";
    var fileReader = new FileReader();
    fileReader.onload = function(fileLoadedEvent) {
      newPoints = [], points = [], cells = [], land = [], riversData = [], island = 0, manors = [], queue = [];
      var dataLoaded = fileLoadedEvent.target.result;
      svg.remove();
      var data = dataLoaded.split("\r\n");
      // data convention: 0 - version; 1 - all points; 2 - cells; 3 - manors; 4 - svg;
      var mapVersion = data[0];
      if (mapVersion !== version) {
        var message = `The Map version does not match the Generator version (${version}). In case of issues please send the .map file to me (maxganiev@yandex.ru) for update or use an archived version of the Generator (https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog)`;
        alertMessage.innerHTML = message;
        $(function() {$("#alert").dialog({title: "Load map"});});
      }
      if (mapVersion.length > 10) {console.error("Cannot load map"); return;}
      points = JSON.parse(data[1]);
      cells = JSON.parse(data[2]);
      land = $.grep(cells, function(e) {return (e.height >= 0.2);});
      cells.map(function(e) {newPoints.push(e.data);});
      calculateVoronoi(newPoints);
      manors = JSON.parse(data[3]);
      document.body.insertAdjacentHTML("afterbegin", data[4]);

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
      grid = viewbox.select("#grid");
      searoutes = routes.select("#searoutes");
      labels = viewbox.select("#labels");
      icons = viewbox.select("#icons");
      burgs = icons.select("#burgs");
      debug = viewbox.select("#debug");
      capitals = labels.select("#capitals");
      towns = labels.select("#towns");
      countries = labels.select("#countries");
      // restore events
      labels.selectAll("text").on("click", editLabel);
      burgs.selectAll("circle").call(d3.drag().on("drag", dragged).on("end", dragended)).on("click", changeBurg);
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
    if (!$("#labelEditor").is(":visible")) {
    switch(d3.event.keyCode) {
      case 27: // Escape
        break;
      case 37: // Left
        if (viewX + 10 <= 0) {
          viewX += 10;
          zoomUpdate();
        }
        break;
      case 39: // Right
        if (viewX - 10 >= (mapWidth * (scale-1) * -1)) {
          viewX -= 10;
          zoomUpdate();
        }
        break;
      case 38: // Up
        if (viewY + 10 <= 0) {
          viewY += 10;
          zoomUpdate();
        }
        break;
      case 40: // Down
        if (viewY - 10 >= (mapHeight * (scale-1) * -1)) {
          viewY -= 10;
          zoomUpdate();
        }
        break;
      case 107: // Plus
        if (scale < 40) {
          var dx = mapWidth / 2 * (scale-1) + viewX;
          var dy = mapHeight / 2 * (scale-1) + viewY;
          viewX = dx - mapWidth / 2 * scale;
          viewY = dy - mapHeight / 2 * scale;
          scale += 1;
          if (scale > 40) {scale = 40;}
          zoomUpdate();
        }
        break;
      case 109: // Minus
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
        }
        break;
      }
    }
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
    if (id === "toggleHeight") {return $("#terrs");}
    if (id === "toggleCultures") {return $("#cults");}
    if (id === "toggleRivers") {return $("#rivers");}
    if (id === "toggleRelief") {return $("#terrain");}
    if (id === "toggleBorders") {return $("#borders");}
    if (id === "toggleCountries") {return $("#regions");}
    if (id === "toggleIcons") {return $("#icons");}
    if (id === "toggleLabels") {return $("#labels");}
    if (id === "toggleRoutes") {return $("#routes");}
    if (id === "toggleGrid") {return $("#grid");}   
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
    }
    if (id === "toggleCultures") {
      var countries = !$("#toggleCountries").hasClass("buttonoff");
      var cultures = !$("#toggleCultures").hasClass("buttonoff");      
      if (!cultures && countries) {
        $("#toggleCountries").toggleClass("buttonoff");
        $('#regions').fadeToggle();
      }
      toggleCultures();
    }
    if (id === "toggleFlux") {toggleFlux();}
    if (parent === "mapLayers" || parent === "styleContent") {$(this).toggleClass("buttonoff");}
    if (id === "randomMap" || id === "regenerate") {
      exitCustomization();
      undraw();
      generate();
    }
    if (id === "fromScratch") {
      undraw();
      placePoints();
      calculateVoronoi(points);
      detectNeighbors("grid");
      customizeHeightmap();
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
      for (var i = 0; i < points.length; i++) {
        cells[i].height = heights[i];
      }      
      mockHeightmap();
      customizeHeightmap();
    }    
    // heightmap customization buttons
    if (customization === 1) {
      if (id === "rescale") {
        $("#heightmapRescaler").dialog({
          title: "Rescale Heightmap",
          minHeight: 30, width: "auto", maxWidth: 260, resizable: false,
          position: {my: "right top", at: "right-10 top+10", of: "svg"}});

      }
      if (id === "rescaleMultiply") {
        var modifier = rescaleModifier.value;
        var subject = rescaleSubject.value;
        modifyHeights(subject, 0, modifier);
        mockHeightmap();
      }
      if (id === "rescaleAdd") {
        var modifier = rescaleModifier.value;
        var subject = rescaleSubject.value;
        modifyHeights(subject, +modifier, 1);
        mockHeightmap();
      }
      if (id === "smoothHeights") {smoothHeights(); mockHeightmap();}
      if (id === "getMap") {getMap();}
      if (id === "applyTemplate") {
        $("#templateEditor").dialog({
          title: "Template Editor",
          minHeight: 50, width: 260, resizable: false,
          position: {my: "right top", at: "right-10 top+10", of: "svg"}
        });
      }
      if (id === "convertImage") {convertImage();}
      if (id === "convertImageGrid") {$("#grid").fadeToggle();}
      if (id === "convertImageHeights") {$("#landmass").fadeToggle();}
    }
    if ($(this).hasClass('radio')) {
      if ($(this).hasClass('pressed')) {
        $(".pressed").removeClass('pressed');
        viewbox.style("cursor", "default").on(".drag", null);
      } else {
        $(".pressed").removeClass('pressed');
        $(this).addClass('pressed'); 
        viewbox.style("cursor", "crosshair");
        if (id.slice(0,5) === "brush" && id !== "brushRange" && id !== "brushTrough") {
          viewbox.call(drag); 
        } else {
          viewbox.on(".drag", null);
        }
      }
    }
    if (id === "saveMap") {saveMap();}
    if (id === "loadMap") {fileToLoad.click();}
    if (id === "saveSVG") {saveAsImage("svg");}
    if (id === "savePNG") {saveAsImage("png");}
    if (id === "zoomReset") {svg.transition().duration(1000).call(zoom.transform, d3.zoomIdentity);}
    if (id === "zoomPlus") {
      scale += 1; 
      if (scale > 40) {scale = 40;}
      zoomUpdate();
    }
    if (id === "zoomMinus") {
      scale -= 1; 
      if (scale <= 1) {scale = 1; viewX = 0; viewY = 0;}
      zoomUpdate();
    }
    if (id === "styleFontPlus" || id === "styleFontMinus") {
      var el = viewbox.select("#"+styleElementSelect.value);
      var mod = id === "styleFontPlus" ? 1.1 : 0.9;
      el.selectAll("g").each(function() {
        var el = d3.select(this);
        var size = Math.trunc(+el.attr("font-size") * mod * 100) / 100;
        if (size < 0.2) {size = 0.2;}
        el.attr("font-size", size);
      });
      return;
    }
    if (id === "styleFillPlus" || id === "styleFillMinus") {
      var el = viewbox.select("#"+styleElementSelect.value);
      var mod = id === "styleFillPlus" ? 1.1 : 0.9;
      el.selectAll("*").each(function() {
        var el = d3.select(this);
        var size = Math.trunc(+el.attr("r") * mod * 100) / 100;
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
        var size = Math.trunc(+el.attr("stroke-width") * mod * 100) / 100;
        if (size < 0.1) {size = 0.1;}
        if (el.node().nodeName === "circle") {el.attr("stroke-width", size);}
      });
      return;
    }   
    if (id === "templateClear") {
      if (customization === 1) {
        $("#customizationMenu").fadeIn("slow");
        viewbox.style("cursor", "crosshair").call(drag);
        landmassCounter.innerHTML = "0";
        $("#landmass").empty();
        cells.map(function(i) {i.height = 0;});        
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
      var count = '<label>count:<input class="templateElCount" title="Blobs to add" type="number" value="1" min="1" max="99" step="1"></label>';
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
    if (id === "Strait") {
      var count = '<label>width:<input class="templateElCount" title="Set strait width" value="1-8"></label>';
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
    var message = "Are you sure you want to change the base tamplate? All the changes will be lost."
    if (steps && changed === 1) {var proceed = confirm(message);}
    if (steps === 0 || proceed === true || changed === 0) {
      $("#templateBody").empty();
      var template = this.value;
      $("#templateSelect").attr("data-prev", template);
      addStep("Mountain");
      if (template === "templateVolcano") {
        addStep("Add", 0.07);
        addStep("Multiply", 1.1);
        addStep("Hill", 5, 0.4);
        addStep("Hill", 2, 0.15);
      }
      if (template === "templateHighIsland") {
        addStep("Add", 0.08);
        addStep("Multiply", 0.9);
        addStep("Range", 4);
        addStep("Hill", 12, 0.25);
        addStep("Trough", 3);
        addStep("Multiply", 0.75, "land");
        addStep("Hill", 3, 0.15);
      }
      if (template === "templateLowIsland") {
        addStep("Add", 0.05);
        addStep("Smooth");
        addStep("Hill", 4, 0.4);
        addStep("Hill", 12, 0.2);
        addStep("Trough", 3);
        addStep("Multiply", 0.3, "land");
      }
      if (template === "templateContinents") {
        addStep("Hill", 24, 0.25);
        addStep("Range", 2);
        addStep("Hill", 3, 0.1);
        addStep("Multiply", 0.7, "land");
        addStep("Strait", "2-8");
        addStep("Smooth");
        addStep("Pit", 5);
        addStep("Trough", 3);
        addStep("Multiply", 0.8, "land");
        addStep("Add", 0.02, "all");
      }
      if (template === "templateArchipelago") {
        addStep("Add", -0.2, "land");
        addStep("Hill", 15, 0.15);
        addStep("Trough", 2);
        addStep("Pit", 8);
        addStep("Add", -0.05, "land");
        addStep("Multiply", 0.9, "land");        
      }
      if (template === "templateAtoll") {
        addStep("Hill", 2, 0.35);
        addStep("Range", 1);
        addStep("Add", 0.07, "all");
        addStep("Smooth");
        addStep("Multiply", 0.1, "0.27-10");
      }      
      $("#templateBody").attr("data-changed", 0);
    } else {
      var prev = $("#templateSelect").attr("data-prev");
      $("#templateSelect").val(prev);
    }
  });
  
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
      if (type === "Smooth") {smoothHeights();}
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
    viewbox.style("cursor", "default").on(".drag", null);
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
    grid.attr("display", "block").attr("stroke-width", .3);
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
      var x = i[0], y = i[1];
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
        $("#colorsSelectValue").text(Math.round(height * 100));
      }
      var color = "#" + d3.select(this).attr("id");
      landmass.selectAll("path").classed("selectedCell", 0);
      landmass.selectAll("path[fill='" + color + "']").classed("selectedCell", 1);
    }
  }

  function showHeight() {
    var el = d3.select(this);
    var height = Math.round(el.attr("data-color") * 100);
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
      var x = i.data[0], y = i.data[1];
      if (y == mapHeight) {y--;}
      var p = (x + y * mapWidth) * 4;
      var r = data[p], g = data[p + 1], b = data[p + 2];
      var lab = d3.lab("rgb(" + r + ", " + g + ", " + b + ")");
      if (type === "hue") {
        var normalized = Math.trunc(normalize(lab.b + lab.a / 2, -50, 200) * 100) / 100;
      } else {
        var normalized = Math.trunc(normalize(lab.l, 0, 100) * 100) / 100;
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
    svg.selectAll("path, circle, text").remove();
    cells = [], land = [], riversData = [], island = 0, manors = [], queue = [];
  }

  // Enter Heightmap Customization mode
  function customizeHeightmap() {
    customization = 1;
    svg.transition().duration(1000).call(zoom.transform, d3.zoomIdentity);
    $("#customizationMenu").fadeIn("slow");
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
    $("#customizationMenu").fadeOut("slow");
    $("#getMap").attr("disabled", true).addClass("buttonoff");
    $('#grid').empty().fadeOut();
    $('#toggleGrid').addClass("buttonoff");      
    viewbox.style("cursor", "default").on(".drag", null); 
    if (!$("#toggleHeight").hasClass("buttonoff")) {toggleHeight();}     
    if ($("#imageConverter").is(":visible")) {$("#imageConverter").dialog('close');}
    if ($("#templateEditor").is(":visible")) {$("#templateEditor").dialog('close');}
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
      if (sel === "roads" || sel === "trails" || sel === "searoutes" || sel === "lakes" || sel === "stateBorders" || sel === "neutralBorders" || sel === "grid" || sel === "coastline") {
        $("#styleStroke").css("display", "inline-block");
        styleStrokeInput.value = styleStrokeOutput.value = el.attr("stroke");
        $("#styleStrokeWidth").css("display", "block");
        var width = el.attr("stroke-width") || "";
        styleStrokeWidthInput.value = styleStrokeWidthOutput.value = width;
      }
      if (sel === "roads" || sel === "trails" || sel === "searoutes" || sel === "stateBorders" || sel === "neutralBorders") {
        $("#styleStrokeDasharray, #styleStrokeLinecap").css("display", "block");
        styleStrokeDasharrayInput.value = el.attr("stroke-dasharray") || "";
        styleStrokeLinecapInput.value = el.attr("stroke-linecap") || "inherit";
      }
      if (sel === "regions") {
        $("#styleMultiple").css("display", "inline-block");
        $("#styleMultiple input").remove();
        for (var r = 0; r < capitalsCount; r++) {
          var color = regions.select(".region"+r).attr("fill");
          $("#styleMultiple").append('<input type="color" id="regionColor' + r + '" value="' + color + '"/>');
        }
        $("#styleMultiple input").on("input", function() {
          var id = this.id;
          var r = +id.replace("regionColor", "");
          regions.selectAll(".region"+r).attr("fill", this.value); 
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
      var el = viewbox.select("#"+styleElementSelect.value);
      if (styleElementSelect.value !== "labels") {
          el.attr('fill', this.value);
      } else {
        el.selectAll("g").attr('fill', this.value);
      }
      return;
    }
    if (id === "styleStrokeInput") {
      styleStrokeOutput.value = this.value;
      var el = viewbox.select("#"+styleElementSelect.value);
      el.attr('stroke', this.value);
      return;
    }
    if (id === "styleStrokeWidthInput") {
      styleStrokeWidthOutput.value = this.value;
      var sel = styleElementSelect.value;
      viewbox.select("#"+sel).attr('stroke-width', +this.value);
      return;
    }
    if (id === "styleStrokeDasharrayInput") {
      var sel = styleElementSelect.value;
      viewbox.select("#"+sel).attr('stroke-dasharray', this.value);
      return;
    }
    if (id === "styleStrokeLinecapInput") {
      var sel = styleElementSelect.value;
      viewbox.select("#"+sel).attr('stroke-linecap', this.value);
      return;
    }
    if (id === "styleOpacityInput") {
      styleOpacityOutput.value = this.value;
      var sel = styleElementSelect.value;
      viewbox.select("#"+sel).attr('opacity', this.value);
      return;
    }
    if (id === "styleFilterInput") {
      var sel = styleElementSelect.value;
      if (sel == "oceanBase") {sel = "oceanLayers";}
      var el = viewbox.select("#"+sel);
      el.attr('filter', this.value);
      return;
    }
    if (id === "styleSchemeInput") {
      terrs.selectAll("path").remove();
      toggleHeight();
      return;
    }
    if (id === "sizeInput") {graphSize = sizeOutput.value = this.value;}
    if (id === "manorsInput") {manorsCount = manorsOutput.value = this.value;}
    if (id === "regionsInput") {
      capitalsCount = regionsOutput.value = this.value;
      var size = Math.round(6 - capitalsCount / 20);
      if (size < 3) {size = 3;}
      capitals.attr("font-size", size);
      size = Math.round(18 - capitalsCount / 6);
      if (size < 4) {size = 4;}
      countries.attr("font-size", size);
    }
    if (id === "powerInput") {power = powerOutput.value = this.value;}
    if (id === "neutralInput") {
      neutral = neutralOutput.value = this.value;
      if (this.value === "100") {neutral = "500";}
    }
    if (id === "swampinessInput") {swampiness = swampinessOutput.value = this.value;}
    if (id === "sharpnessInput") {sharpness = sharpnessOutput.value = this.value;}
    if (id === "brushPower") {brushPowerOutput.value = this.value;}
    if (id === "convertOverlay") {canvas.style.opacity = convertOverlayValue.innerHTML = +this.value;}
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
  });
}