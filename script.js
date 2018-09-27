// Fantasy Map Generator main script
// Azgaar (maxganiev@yandex.com). Minsk, 2017-2018
// https://github.com/Azgaar/Fantasy-Map-Generator
// GNU General Public License v3.0

// To programmers:
  // I don't mind of any help with programming
  // I know the code is badly structurized and it's hard to read it as a single page
  // Meanwhile a core part takes only 300-500 lines

// What should be done generally:
  // Refactor the code
  // Modernize the code (ES6)
  // Optimize the code
  // Modulize the code

// And particularry:
  // Migrate from d3-voronoi to mapbox-delunator or d3-delaunay
  // Use typed arrays instead of array of objects
  // Get rid of jQuery as d3.js can almost all the same and more
  // Re-build UI on reactive approach, vue.js

"use strict";
fantasyMap();
function fantasyMap() {
  // Version control
  const version = "0.60b";
  document.title += " v. " + version;

  // Declare variables
  let svg = d3.select("svg");
  let defs = svg.select("#deftemp");
  let viewbox = svg.append("g").attr("id", "viewbox");
  let ocean = viewbox.append("g").attr("id", "ocean");
  let oceanLayers = ocean.append("g").attr("id", "oceanLayers");
  let oceanPattern = ocean.append("g").attr("id", "oceanPattern");
  let landmass = viewbox.append("g").attr("id", "landmass");
  let terrs = viewbox.append("g").attr("id", "terrs");
  let grid = viewbox.append("g").attr("id", "grid");
  let overlay = viewbox.append("g").attr("id", "overlay");
  let routes = viewbox.append("g").attr("id", "routes");
  let roads = routes.append("g").attr("id", "roads").attr("data-type", "land");
  let trails = routes.append("g").attr("id", "trails").attr("data-type", "land");
  let rivers = viewbox.append("g").attr("id", "rivers");
  let terrain = viewbox.append("g").attr("id", "terrain");
  let cults = viewbox.append("g").attr("id", "cults");
  let regions = viewbox.append("g").attr("id", "regions");
  let borders = viewbox.append("g").attr("id", "borders");
  let stateBorders = borders.append("g").attr("id", "stateBorders");
  let neutralBorders = borders.append("g").attr("id", "neutralBorders");
  let lakes = viewbox.append("g").attr("id", "lakes");
  let coastline = viewbox.append("g").attr("id", "coastline");
  let searoutes = routes.append("g").attr("id", "searoutes").attr("data-type", "sea");
  let labels = viewbox.append("g").attr("id", "labels");
  let burgLabels = labels.append("g").attr("id", "burgLabels");
  let icons = viewbox.append("g").attr("id", "icons");
  let burgIcons = icons.append("g").attr("id", "burgIcons");
  let markers = viewbox.append("g").attr("id", "markers");
  let ruler = viewbox.append("g").attr("id", "ruler");
  let debug = viewbox.append("g").attr("id", "debug");

  labels.append("g").attr("id", "countries");
  burgIcons.append("g").attr("id", "capitals");
  burgLabels.append("g").attr("id", "capitals");
  burgIcons.append("g").attr("id", "towns");
  burgLabels.append("g").attr("id", "towns");
  icons.append("g").attr("id", "capital-anchors");
  icons.append("g").attr("id", "town-anchors");
  terrain.append("g").attr("id", "hills");
  terrain.append("g").attr("id", "mounts");
  terrain.append("g").attr("id", "swamps");
  terrain.append("g").attr("id", "forests");

  // append ocean pattern
  oceanPattern.append("rect").attr("fill", "url(#oceanic)").attr("stroke", "none");
  oceanLayers.append("rect").attr("id", "oceanBase");

  // main data variables
  let seed;
  let params;
  let voronoi;
  let diagram;
  let polygons;
  let spacing;
  let points = [];
  let heights;
  // Common variables
  const modules = {};
  let customization = 0;
  let history = [];
  let historyStage = 0;
  let elSelected;
  let autoResize = true;
  let graphSize;
  let cells = [];
  let land = [];
  let riversData = [];
  let manors = [];
  let states = [];
  let features = [];
  let notes = [];
  let queue = [];
  const fonts = ["Almendra+SC", "Georgia", "Times+New+Roman", "Comic+Sans+MS", "Lucida+Sans+Unicode", "Courier+New"];

  // Cultures-related data
  let defaultCultures = [];
  let cultures = [];
  const chain = {};
  let nameBases = [];
  let nameBase = [];
  let cultureTree;
  const vowels = "aeiouy";

  // canvas element for raster images
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  // Color schemes
  let color = d3.scaleSequential(d3.interpolateSpectral);
  const colors8 = d3.scaleOrdinal(d3.schemeSet2);
  const colors20 = d3.scaleOrdinal(d3.schemeCategory20);

  // D3 drag and zoom behavior
  let scale = 1, viewX = 0, viewY = 0;
  const zoom = d3.zoom().scaleExtent([1, 20]).on("zoom", zoomed);
  svg.call(zoom);

  // D3 Line generator variables
  const lineGen = d3.line().x(function (d) {
    return d.scX;
  }).y(function (d) {
    return d.scY;
  }).curve(d3.curveCatmullRom);

  applyStoredOptions();
  let graphWidth = +mapWidthInput.value; // voronoi graph extention, should be stable for each map
  let graphHeight = +mapHeightInput.value;
  let svgWidth = graphWidth, svgHeight = graphHeight;  // svg canvas resolution, can vary for each map

  // toggle off loading screen and on menus
  $("#loading, #initial").remove();
  svg.style("background-color", "#000000");
  $("#optionsContainer, #tooltip").show();
  if (localStorage.getItem("disable_click_arrow_tooltip")) {
    tooltip.innerHTML = "";
    tooltip.setAttribute("data-main", "");
    $("#optionsTrigger").removeClass("glow");
  }

  $("#optionsContainer").draggable({handle: ".drag-trigger", snap: "svg", snapMode: "both"});
  $("#mapLayers").sortable({items: "li:not(.solid)", cancel: ".solid", update: moveLayer});
  $("#templateBody").sortable({items: "div:not(div[data-type='Mountain'])"});
  $("#mapLayers, #templateBody").disableSelection();

  const drag = d3.drag()
    .container(function () {
      return this;
    })
    .subject(function () {
      const p = [d3.event.x, d3.event.y];
      return [p, p];
    })
    .on("start", dragstarted);

  function zoomed() {
    const scaleDiff = Math.abs(scale - d3.event.transform.k);
    scale = d3.event.transform.k;
    viewX = d3.event.transform.x;
    viewY = d3.event.transform.y;
    viewbox.attr("transform", d3.event.transform);
    // rescale only if zoom is significally changed
    if (scaleDiff > 0.001) {
      invokeActiveZooming();
      drawScaleBar();
    }
  }

  // Manually update viewbox
  function zoomUpdate(duration) {
    const dur = duration || 0;
    const transform = d3.zoomIdentity.translate(viewX, viewY).scale(scale);
    svg.transition().duration(dur).call(zoom.transform, transform);
  }

  // Zoom to specific point (x,y - coods, z - scale, d - duration)
  function zoomTo(x, y, z, d) {
    const transform = d3.zoomIdentity.translate(x * -z + graphWidth / 2, y * -z + graphHeight / 2).scale(z);
    svg.transition().duration(d).call(zoom.transform, transform);
  }

  // Reset zoom to initial
  function resetZoom(duration) {
    zoom.transform(svg, d3.zoomIdentity);
  }

  // Active zooming
  function invokeActiveZooming() {
    // toggle shade/blur filter on zoom
    let filter = scale > 2.6 ? "url(#blurFilter)" : "url(#dropShadow)";
    if (scale > 1.5 && scale <= 2.6) filter = null;
    coastline.attr("filter", filter);
    // rescale lables on zoom (active zooming)
    labels.selectAll("g").each(function(d) {
      const el = d3.select(this);
      if (el.attr("id") === "burgLabels") return;
      const desired = +el.attr("data-size");
      let relative = rn((desired + desired / scale) / 2, 2);
      if (relative < 2) relative = 2;
      el.attr("font-size", relative);
      if (hideLabels.checked) {
        el.classed("hidden", relative * scale < 6);
        updateLabelGroups();
      }
    });

    // rescale map markers
    markers.selectAll("use").each(function(d) {
      const el = d3.select(this);
      let x = +el.attr("data-x"), y = +el.attr("data-y");
      const desired = +el.attr("data-size");
      let size = desired * 5 + 25 / scale;
      if (size < 1) size = 1;
      el.attr("x", x - size / 2).attr("y", y - size).attr("width", size).attr("height", size);
    });

    if (ruler.size()) {
      if (ruler.style("display") !== "none") {
        if (ruler.selectAll("g").size() < 1) {return;}
        const factor = rn(1 / Math.pow(scale, 0.3), 1);
        ruler.selectAll("circle:not(.center)").attr("r", 2 * factor).attr("stroke-width", 0.5 * factor);
        ruler.selectAll("circle.center").attr("r", 1.2 * factor).attr("stroke-width", 0.3 * factor);
        ruler.selectAll("text").attr("font-size", 10 * factor);
        ruler.selectAll("line, path").attr("stroke-width", factor);
      }
    }
  }

  addDragToUpload();

  // Changelog dialog window
  const storedVersion = localStorage.getItem("version"); // show message on load
  if (storedVersion != version) {
    alertMessage.innerHTML = `<b>2018-29-23</b>:
      The <i>Fantasy Map Generator</i> is updated up to version <b>${version}</b>.
      Main changes:<br><br>
      <li>Map Markers</li>
      <li>Legend Editor (text notes)</li>
      <li>Bug fixes</li>
      <br>See a <a href='https://www.reddit.com/r/FantasyMapGenerator/comments/9iarje/update_new_version_is_published_v060b' target='_blank'>dedicated post</a> for the details.
      <br><br>
      <i>Join our <a href='https://www.reddit.com/r/FantasyMapGenerator/' target='_blank'>Reddit community</a>
      to share created maps, discuss the Generator, report bugs, ask questions and propose new features.
      You may also report bugs <a href='https://github.com/Azgaar/Fantasy-Map-Generator/issues' target='_blank'>here</a>.</i>`;

    $("#alert").dialog(
      {resizable: false, title: "Fantasy Map Generator update", width: 320,
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

  getSeed(); // get and set random generator seed
  applyNamesData(); // apply default namesbase on load
  generate(); // generate map on load
  applyDefaultStyle(); // apply style on load
  focusOn(); // based on searchParams focus on point, cell or burg from MFCG
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
    elevateLakes();
    resolveDepressionsPrimary();
    reGraph();
    resolveDepressionsSecondary();
    flux();
    addLakes();
    drawCoastline();
    drawRelief();
    generateCultures();
    manorsAndRegions();
    cleanData();
    console.timeEnd("TOTAL");
    console.groupEnd("Random map");
  }

  // get or generate map seed
  function getSeed() {
    const url = new URL(window.location.href);
    params = url.searchParams;
    seed = params.get("seed") || Math.floor(Math.random() * 1e9);
    console.log(" seed: " + seed);
    optionsSeed.value = seed;
    Math.seedrandom(seed);
  }

  // generate new map seed
  function changeSeed() {
    seed = Math.floor(Math.random() * 1e9);
    console.log(" seed: " + seed);
    optionsSeed.value = seed;
    Math.seedrandom(seed);
  }

  function updateURL() {
    const url = new URL(window.location.href);
    url.searchParams.set("seed", seed);
    if (url.protocol !== "file:") window.history.pushState({seed}, "", "url.search");
  }

  // load options from LocalStorage is any
  function applyStoredOptions() {
    if (localStorage.getItem("mapWidth") && localStorage.getItem("mapHeight")) {
      mapWidthInput.value = localStorage.getItem("mapWidth");
      mapHeightInput.value = localStorage.getItem("mapHeight");
    } else {
      mapWidthInput.value = window.innerWidth;
      mapHeightInput.value = window.innerHeight;
    }
    if (localStorage.getItem("graphSize")) {
      graphSize = localStorage.getItem("graphSize");
      sizeInput.value = sizeOutput.value = graphSize;
    } else {
      graphSize = +sizeInput.value;
    }
    if (localStorage.getItem("template")) {
      templateInput.value = localStorage.getItem("template");
      lockTemplateInput.setAttribute("data-locked", 1);
      lockTemplateInput.className = "icon-lock";
    }
    if (localStorage.getItem("manors")) {
      manorsInput.value = manorsOutput.value = localStorage.getItem("manors");
      lockManorsInput.setAttribute("data-locked", 1);
      lockManorsInput.className = "icon-lock";
    }
    if (localStorage.getItem("regions")) {
      regionsInput.value = regionsOutput.value = localStorage.getItem("regions");
      lockRegionsInput.setAttribute("data-locked", 1);
      lockRegionsInput.className = "icon-lock";
    }
    if (localStorage.getItem("power")) {
      powerInput.value = powerOutput.value = localStorage.getItem("power");
      lockPowerInput.setAttribute("data-locked", 1);
      lockPowerInput.className = "icon-lock";
    }
    if (localStorage.getItem("neutral")) neutralInput.value = neutralOutput.value = localStorage.getItem("neutral");
    if (localStorage.getItem("names")) {
      namesInput.value = localStorage.getItem("names");
      lockNamesInput.setAttribute("data-locked", 1);
      lockNamesInput.className = "icon-lock";
    }
    if (localStorage.getItem("cultures")) {
      culturesInput.value = culturesOutput.value = localStorage.getItem("cultures");
      lockCulturesInput.setAttribute("data-locked", 1);
      lockCulturesInput.className = "icon-lock";
    }
    if (localStorage.getItem("prec")) {
      precInput.value = precOutput.value = localStorage.getItem("prec");
      lockPrecInput.setAttribute("data-locked", 1);
      lockPrecInput.className = "icon-lock";
    }
    if (localStorage.getItem("swampiness")) swampinessInput.value = swampinessOutput.value = localStorage.getItem("swampiness");
    if (localStorage.getItem("outlineLayers")) outlineLayersInput.value = localStorage.getItem("outlineLayers");
    if (localStorage.getItem("pngResolution")) {
      pngResolutionInput.value = localStorage.getItem("pngResolution");
      pngResolutionOutput.value = pngResolutionInput.value + "x";
    }
    if (localStorage.getItem("transparency")) {
      transparencyInput.value = transparencyOutput.value = localStorage.getItem("transparency");
      changeDialogsTransparency(transparencyInput.value);
    } else {changeDialogsTransparency(0);}
  }

  function restoreDefaultOptions() {
    // remove ALL saved data from LocalStorage
    localStorage.clear();
    // set defaut values
    mapWidthInput.value = window.innerWidth;
    mapHeightInput.value = window.innerHeight;
    changeMapSize();
    graphSize = sizeInput.value = sizeOutput.value = 1;
    $("#options i[class^='icon-lock']").each(function() {
      this.setAttribute("data-locked", 0);
      this.className = "icon-lock-open";
      if (this.id === "lockNeutralInput" || this.id === "lockSwampinessInput") {
        this.setAttribute("data-locked", 1);
        this.className = "icon-lock";
      }
    });
    neutralInput.value = neutralOutput.value = 200;
    swampinessInput.value = swampinessOutput.value = 10;
    outlineLayersInput.value = "-6,-3,-1";
    transparencyInput.value = transparencyOutput.value = 0;
    changeDialogsTransparency(0);
    pngResolutionInput.value = 5;
    pngResolutionOutput.value = "5x";
    randomizeOptions();
  }

  // apply names data from localStorage if available
  function applyNamesData() {
    applyDefaultNamesData();
    defaultCultures = [
      {name:"Shwazen", color:"#b3b3b3", base:0},
      {name:"Angshire", color:"#fca463", base:1},
      {name:"Luari", color:"#99acfb", base:2},
      {name:"Tallian", color:"#a6d854", base:3},
      {name:"Toledi", color:"#ffd92f", base:4},
      {name:"Slovian", color:"#e5c494", base:5},
      {name:"Norse", color:"#dca3e4", base:6},
      {name:"Elladian", color:"#66c4a0", base:7},
      {name:"Latian", color:"#ff7174", base:8},
      {name:"Soomi", color:"#85c8fa", base:9},
      {name:"Koryo", color:"#578880", base:10},
      {name:"Hantzu", color:"#becb8d", base:11},
      {name:"Yamoto", color:"#ffd9da", base:12}
    ];
  }

  // apply default names data
  function applyDefaultNamesData() {
    nameBases = [                                                                   // min; max; mean; common
      {name: "German", method: "let-to-syl", min: 4, max: 11, d: "lt", m: 0.1},     // real: 3; 17; 8.6; 8
      {name: "English", method: "let-to-syl", min: 5, max: 10, d: "", m: 0.3},      // real: 4; 13; 7.9; 8
      {name: "French", method: "let-to-syl", min: 4, max: 10, d: "lns", m: 0.3},    // real: 3; 15; 7.6; 6
      {name: "Italian", method: "let-to-syl", min: 4, max: 11, d: "clrt", m: 0.2},  // real: 4; 14; 7.7; 7
      {name: "Castillian", method: "let-to-syl", min: 4, max: 10, d: "lr", m: 0},   // real: 2; 13; 7.5; 8
      {name: "Ruthenian", method: "let-to-syl", min: 4, max: 9, d: "", m: 0},       // real: 3; 12; 7.1; 7
      {name: "Nordic", method: "let-to-syl", min: 5, max: 9, d: "kln", m: 0.1},     // real: 3; 12; 7.5; 6
      {name: "Greek", method: "let-to-syl", min: 4, max: 10, d: "ls", m: 0.2},      // real: 3; 14; 7.1; 6
      {name: "Roman", method: "let-to-syl", min: 5, max: 10, d: "", m: 1},          // real: 3; 15; 8.0; 7
      {name: "Finnic", method: "let-to-syl", min: 3, max: 10, d: "aktu", m: 0},     // real: 3; 13; 7.5; 6
      {name: "Korean", method: "let-to-syl", min: 5, max: 10, d: "", m: 0},         // real: 3; 13; 6.8; 7
      {name: "Chinese", method: "let-to-syl", min: 5, max: 9, d: "", m: 0},         // real: 4; 11; 6.9; 6
      {name: "Japanese", method: "let-to-syl", min: 3, max: 9, d: "", m: 0}         // real: 2; 15; 6.8; 6
    ];
    nameBase = [
      ["Achern","Aichhalden","Aitern","Albbruck","Alpirsbach","Altensteig","Althengstett","Appenweier","Auggen","Wildbad","Badenen","Badenweiler","Baiersbronn","Ballrechten","Bellingen","Berghaupten","Bernau","Biberach","Biederbach","Binzen","Birkendorf","Birkenfeld","Bischweier","Blumberg","Bollen","Bollschweil","Bonndorf","Bosingen","Braunlingen","Breisach","Breisgau","Breitnau","Brigachtal","Buchenbach","Buggingen","Buhl","Buhlertal","Calw","Dachsberg","Dobel","Donaueschingen","Dornhan","Dornstetten","Dottingen","Dunningen","Durbach","Durrheim","Ebhausen","Ebringen","Efringen","Egenhausen","Ehrenkirchen","Ehrsberg","Eimeldingen","Eisenbach","Elzach","Elztal","Emmendingen","Endingen","Engelsbrand","Enz","Enzklosterle","Eschbronn","Ettenheim","Ettlingen","Feldberg","Fischerbach","Fischingen","Fluorn","Forbach","Freiamt","Freiburg","Freudenstadt","Friedenweiler","Friesenheim","Frohnd","Furtwangen","Gaggenau","Geisingen","Gengenbach","Gernsbach","Glatt","Glatten","Glottertal","Gorwihl","Gottenheim","Grafenhausen","Grenzach","Griesbach","Gutach","Gutenbach","Hag","Haiterbach","Hardt","Harmersbach","Hasel","Haslach","Hausach","Hausen","Hausern","Heitersheim","Herbolzheim","Herrenalb","Herrischried","Hinterzarten","Hochenschwand","Hofen","Hofstetten","Hohberg","Horb","Horben","Hornberg","Hufingen","Ibach","Ihringen","Inzlingen","Kandern","Kappel","Kappelrodeck","Karlsbad","Karlsruhe","Kehl","Keltern","Kippenheim","Kirchzarten","Konigsfeld","Krozingen","Kuppenheim","Kussaberg","Lahr","Lauchringen","Lauf","Laufenburg","Lautenbach","Lauterbach","Lenzkirch","Liebenzell","Loffenau","Loffingen","Lorrach","Lossburg","Mahlberg","Malsburg","Malsch","March","Marxzell","Marzell","Maulburg","Monchweiler","Muhlenbach","Mullheim","Munstertal","Murg","Nagold","Neubulach","Neuenburg","Neuhausen","Neuried","Neuweiler","Niedereschach","Nordrach","Oberharmersbach","Oberkirch","Oberndorf","Oberbach","Oberried","Oberwolfach","Offenburg","Ohlsbach","Oppenau","Ortenberg","otigheim","Ottenhofen","Ottersweier","Peterstal","Pfaffenweiler","Pfalzgrafenweiler","Pforzheim","Rastatt","Renchen","Rheinau","Rheinfelden","Rheinmunster","Rickenbach","Rippoldsau","Rohrdorf","Rottweil","Rummingen","Rust","Sackingen","Sasbach","Sasbachwalden","Schallbach","Schallstadt","Schapbach","Schenkenzell","Schiltach","Schliengen","Schluchsee","Schomberg","Schonach","Schonau","Schonenberg","Schonwald","Schopfheim","Schopfloch","Schramberg","Schuttertal","Schwenningen","Schworstadt","Seebach","Seelbach","Seewald","Sexau","Simmersfeld","Simonswald","Sinzheim","Solden","Staufen","Stegen","Steinach","Steinen","Steinmauern","Straubenhardt","Stuhlingen","Sulz","Sulzburg","Teinach","Tiefenbronn","Tiengen","Titisee","Todtmoos","Todtnau","Todtnauberg","Triberg","Tunau","Tuningen","uhlingen","Unterkirnach","Reichenbach","Utzenfeld","Villingen","Villingendorf","Vogtsburg","Vohrenbach","Waldachtal","Waldbronn","Waldkirch","Waldshut","Wehr","Weil","Weilheim","Weisenbach","Wembach","Wieden","Wiesental","Wildberg","Winzeln","Wittlingen","Wittnau","Wolfach","Wutach","Wutoschingen","Wyhlen","Zavelstein"],
      ["Abingdon","Albrighton","Alcester","Almondbury","Altrincham","Amersham","Andover","Appleby","Ashboume","Atherstone","Aveton","Axbridge","Aylesbury","Baldock","Bamburgh","Barton","Basingstoke","Berden","Bere","Berkeley","Berwick","Betley","Bideford","Bingley","Birmingham","Blandford","Blechingley","Bodmin","Bolton","Bootham","Boroughbridge","Boscastle","Bossinney","Bramber","Brampton","Brasted","Bretford","Bridgetown","Bridlington","Bromyard","Bruton","Buckingham","Bungay","Burton","Calne","Cambridge","Canterbury","Carlisle","Castleton","Caus","Charmouth","Chawleigh","Chichester","Chillington","Chinnor","Chipping","Chisbury","Cleobury","Clifford","Clifton","Clitheroe","Cockermouth","Coleshill","Combe","Congleton","Crafthole","Crediton","Cuddenbeck","Dalton","Darlington","Dodbrooke","Drax","Dudley","Dunstable","Dunster","Dunwich","Durham","Dymock","Exeter","Exning","Faringdon","Felton","Fenny","Finedon","Flookburgh","Fowey","Frampton","Gateshead","Gatton","Godmanchester","Grampound","Grantham","Guildford","Halesowen","Halton","Harbottle","Harlow","Hatfield","Hatherleigh","Haydon","Helston","Henley","Hertford","Heytesbury","Hinckley","Hitchin","Holme","Hornby","Horsham","Kendal","Kenilworth","Kilkhampton","Kineton","Kington","Kinver","Kirby","Knaresborough","Knutsford","Launceston","Leighton","Lewes","Linton","Louth","Luton","Lyme","Lympstone","Macclesfield","Madeley","Malborough","Maldon","Manchester","Manningtree","Marazion","Marlborough","Marshfield","Mere","Merryfield","Middlewich","Midhurst","Milborne","Mitford","Modbury","Montacute","Mousehole","Newbiggin","Newborough","Newbury","Newenden","Newent","Norham","Northleach","Noss","Oakham","Olney","Orford","Ormskirk","Oswestry","Padstow","Paignton","Penkneth","Penrith","Penzance","Pershore","Petersfield","Pevensey","Pickering","Pilton","Pontefract","Portsmouth","Preston","Quatford","Reading","Redcliff","Retford","Rockingham","Romney","Rothbury","Rothwell","Salisbury","Saltash","Seaford","Seasalter","Sherston","Shifnal","Shoreham","Sidmouth","Skipsea","Skipton","Solihull","Somerton","Southam","Southwark","Standon","Stansted","Stapleton","Stottesdon","Sudbury","Swavesey","Tamerton","Tarporley","Tetbury","Thatcham","Thaxted","Thetford","Thornbury","Tintagel","Tiverton","Torksey","Totnes","Towcester","Tregoney","Trematon","Tutbury","Uxbridge","Wallingford","Wareham","Warenmouth","Wargrave","Warton","Watchet","Watford","Wendover","Westbury","Westcheap","Weymouth","Whitford","Wickwar","Wigan","Wigmore","Winchelsea","Winkleigh","Wiscombe","Witham","Witheridge","Wiveliscombe","Woodbury","Yeovil"],
      ["Adon","Aillant","Amilly","Andonville","Ardon","Artenay","Ascheres","Ascoux","Attray","Aubin","Audeville","Aulnay","Autruy","Auvilliers","Auxy","Aveyron","Baccon","Bardon","Barville","Batilly","Baule","Bazoches","Beauchamps","Beaugency","Beaulieu","Beaune","Bellegarde","Boesses","Boigny","Boiscommun","Boismorand","Boisseaux","Bondaroy","Bonnee","Bonny","Bordes","Bou","Bougy","Bouilly","Boulay","Bouzonville","Bouzy","Boynes","Bray","Breteau","Briare","Briarres","Bricy","Bromeilles","Bucy","Cepoy","Cercottes","Cerdon","Cernoy","Cesarville","Chailly","Chaingy","Chalette","Chambon","Champoulet","Chanteau","Chantecoq","Chapell","Charme","Charmont","Charsonville","Chateau","Chateauneuf","Chatel","Chatenoy","Chatillon","Chaussy","Checy","Chevannes","Chevillon","Chevilly","Chevry","Chilleurs","Choux","Chuelles","Clery","Coinces","Coligny","Combleux","Combreux","Conflans","Corbeilles","Corquilleroy","Cortrat","Coudroy","Coullons","Coulmiers","Courcelles","Courcy","Courtemaux","Courtempierre","Courtenay","Cravant","Crottes","Dadonville","Dammarie","Dampierre","Darvoy","Desmonts","Dimancheville","Donnery","Dordives","Dossainville","Douchy","Dry","Echilleuses","Egry","Engenville","Epieds","Erceville","Ervauville","Escrennes","Escrignelles","Estouy","Faverelles","Fay","Feins","Ferolles","Ferrieres","Fleury","Fontenay","Foret","Foucherolles","Freville","Gatinais","Gaubertin","Gemigny","Germigny","Gidy","Gien","Girolles","Givraines","Gondreville","Grangermont","Greneville","Griselles","Guigneville","Guilly","Gyleslonains","Huetre","Huisseau","Ingrannes","Ingre","Intville","Isdes","Jargeau","Jouy","Juranville","Bussiere","Laas","Ladon","Lailly","Langesse","Leouville","Ligny","Lombreuil","Lorcy","Lorris","Loury","Louzouer","Malesherbois","Marcilly","Mardie","Mareau","Marigny","Marsainvilliers","Melleroy","Menestreau","Merinville","Messas","Meung","Mezieres","Migneres","Mignerette","Mirabeau","Montargis","Montbarrois","Montbouy","Montcresson","Montereau","Montigny","Montliard","Mormant","Morville","Moulinet","Moulon","Nancray","Nargis","Nesploy","Neuville","Neuvy","Nevoy","Nibelle","Nogent","Noyers","Ocre","Oison","Olivet","Ondreville","Onzerain","Orleans","Ormes","Orville","Oussoy","Outarville","Ouzouer","Pannecieres","Pannes","Patay","Paucourt","Pers","Pierrefitte","Pithiverais","Pithiviers","Poilly","Potier","Prefontaines","Presnoy","Pressigny","Puiseaux","Quiers","Ramoulu","Rebrechien","Rouvray","Rozieres","Rozoy","Ruan","Sandillon","Santeau","Saran","Sceaux","Seichebrieres","Semoy","Sennely","Sermaises","Sigloy","Solterre","Sougy","Sully","Sury","Tavers","Thignonville","Thimory","Thorailles","Thou","Tigy","Tivernon","Tournoisis","Trainou","Treilles","Trigueres","Trinay","Vannes","Varennes","Vennecy","Vieilles","Vienne","Viglain","Vignes","Villamblain","Villemandeur","Villemoutiers","Villemurlin","Villeneuve","Villereau","Villevoques","Villorceau","Vimory","Vitry","Vrigny","Ivre"],
      ["Accumoli","Acquafondata","Acquapendente","Acuto","Affile","Agosta","Alatri","Albano","Allumiere","Alvito","Amaseno","Amatrice","Anagni","Anguillara","Anticoli","Antrodoco","Anzio","Aprilia","Aquino","Arce","Arcinazzo","Ardea","Ariccia","Arlena","Arnara","Arpino","Arsoli","Artena","Ascrea","Atina","Ausonia","Bagnoregio","Barbarano","Bassano","Bassiano","Bellegra","Belmonte","Blera","Bolsena","Bomarzo","Borbona","Borgo","Borgorose","Boville","Bracciano","Broccostella","Calcata","Camerata","Campagnano","Campodimele","Campoli","Canale","Canepina","Canino","Cantalice","Cantalupo","Canterano","Capena","Capodimonte","Capranica","Caprarola","Carbognano","Casalattico","Casalvieri","Casape","Casaprota","Casperia","Cassino","Castelforte","Castelliri","Castello","Castelnuovo","Castiglione","Castro","Castrocielo","Cave","Ceccano","Celleno","Cellere","Ceprano","Cerreto","Cervara","Cervaro","Cerveteri","Ciampino","Ciciliano","Cineto","Cisterna","Cittaducale","Cittareale","Civita","Civitavecchia","Civitella","Colfelice","Collalto","Colle","Colleferro","Collegiove","Collepardo","Collevecchio","Colli","Colonna","Concerviano","Configni","Contigliano","Corchiano","Coreno","Cori","Cottanello","Esperia","Fabrica","Faleria","Falvaterra","Fara","Farnese","Ferentino","Fiamignano","Fiano","Filacciano","Filettino","Fiuggi","Fiumicino","Fondi","Fontana","Fonte","Fontechiari","Forano","Formello","Formia","Frascati","Frasso","Frosinone","Fumone","Gaeta","Gallese","Gallicano","Gallinaro","Gavignano","Genazzano","Genzano","Gerano","Giuliano","Gorga","Gradoli","Graffignano","Greccio","Grottaferrata","Grotte","Guarcino","Guidonia","Ischia","Isola","Itri","Jenne","Labico","Labro","Ladispoli","Lanuvio","Lariano","Latera","Lenola","Leonessa","Licenza","Longone","Lubriano","Maenza","Magliano","Mandela","Manziana","Marano","Marcellina","Marcetelli","Marino","Marta","Mazzano","Mentana","Micigliano","Minturno","Mompeo","Montalto","Montasola","Monte","Montebuono","Montefiascone","Monteflavio","Montelanico","Monteleone","Montelibretti","Montenero","Monterosi","Monterotondo","Montopoli","Montorio","Moricone","Morlupo","Morolo","Morro","Nazzano","Nemi","Nepi","Nerola","Nespolo","Nettuno","Norma","Olevano","Onano","Oriolo","Orte","Orvinio","Paganico","Palestrina","Paliano","Palombara","Pastena","Patrica","Percile","Pescorocchiano","Pescosolido","Petrella","Piansano","Picinisco","Pico","Piedimonte","Piglio","Pignataro","Pisoniano","Pofi","Poggio","Poli","Pomezia","Pontecorvo","Pontinia","Ponza","Ponzano","Posta","Pozzaglia","Priverno","Proceno","Prossedi","Riano","Rieti","Rignano","Riofreddo","Ripi","Rivodutri","Rocca","Roccagiovine","Roccagorga","Roccantica","Roccasecca","Roiate","Ronciglione","Roviano","Sabaudia","Sacrofano","Salisano","Sambuci","Santa","Santi","Santopadre","Saracinesco","Scandriglia","Segni","Selci","Sermoneta","Serrone","Settefrati","Sezze","Sgurgola","Sonnino","Sora","Soriano","Sperlonga","Spigno","Stimigliano","Strangolagalli","Subiaco","Supino","Sutri","Tarano","Tarquinia","Terelle","Terracina","Tessennano","Tivoli","Toffia","Tolfa","Torre","Torri","Torrice","Torricella","Torrita","Trevi","Trevignano","Trivigliano","Turania","Tuscania","Vacone","Valentano","Vallecorsa","Vallemaio","Vallepietra","Vallerano","Vallerotonda","Vallinfreda","Valmontone","Varco","Vasanello","Vejano","Velletri","Ventotene","Veroli","Vetralla","Vicalvi","Vico","Vicovaro","Vignanello","Viterbo","Viticuso","Vitorchiano","Vivaro","Zagarolo"],
      ["Abanades","Ablanque","Adobes","Ajofrin","Alameda","Alaminos","Alarilla","Albalate","Albares","Albarreal","Albendiego","Alcabon","Alcanizo","Alcaudete","Alcocer","Alcolea","Alcoroches","Aldea","Aldeanueva","Algar","Algora","Alhondiga","Alique","Almadrones","Almendral","Almoguera","Almonacid","Almorox","Alocen","Alovera","Alustante","Angon","Anguita","Anover","Anquela","Arbancon","Arbeteta","Arcicollar","Argecilla","Arges","Armallones","Armuna","Arroyo","Atanzon","Atienza","Aunon","Azuqueca","Azutan","Baides","Banos","Banuelos","Barcience","Bargas","Barriopedro","Belvis","Berninches","Borox","Brihuega","Budia","Buenaventura","Bujalaro","Burguillos","Burujon","Bustares","Cabanas","Cabanillas","Calera","Caleruela","Calzada","Camarena","Campillo","Camunas","Canizar","Canredondo","Cantalojas","Cardiel","Carmena","Carranque","Carriches","Casa","Casarrubios","Casas","Casasbuenas","Caspuenas","Castejon","Castellar","Castilforte","Castillo","Castilnuevo","Cazalegas","Cebolla","Cedillo","Cendejas","Centenera","Cervera","Checa","Chequilla","Chillaron","Chiloeches","Chozas","Chueca","Cifuentes","Cincovillas","Ciruelas","Ciruelos","Cobeja","Cobeta","Cobisa","Cogollor","Cogolludo","Condemios","Congostrina","Consuegra","Copernal","Corduente","Corral","Cuerva","Domingo","Dosbarrios","Driebes","Duron","El","Embid","Erustes","Escalona","Escalonilla","Escamilla","Escariche","Escopete","Espinosa","Espinoso","Esplegares","Esquivias","Estables","Estriegana","Fontanar","Fuembellida","Fuensalida","Fuentelsaz","Gajanejos","Galve","Galvez","Garciotum","Gascuena","Gerindote","Guadamur","Henche","Heras","Herreria","Herreruela","Hijes","Hinojosa","Hita","Hombrados","Hontanar","Hontoba","Horche","Hormigos","Huecas","Huermeces","Huerta","Hueva","Humanes","Illan","Illana","Illescas","Iniestola","Irueste","Jadraque","Jirueque","Lagartera","Las","Layos","Ledanca","Lillo","Lominchar","Loranca","Los","Lucillos","Lupiana","Luzaga","Luzon","Madridejos","Magan","Majaelrayo","Malaga","Malaguilla","Malpica","Mandayona","Mantiel","Manzaneque","Maqueda","Maranchon","Marchamalo","Marjaliza","Marrupe","Mascaraque","Masegoso","Matarrubia","Matillas","Mazarete","Mazuecos","Medranda","Megina","Mejorada","Mentrida","Mesegar","Miedes","Miguel","Millana","Milmarcos","Mirabueno","Miralrio","Mocejon","Mochales","Mohedas","Molina","Monasterio","Mondejar","Montarron","Mora","Moratilla","Morenilla","Muduex","Nambroca","Navalcan","Negredo","Noblejas","Noez","Nombela","Noves","Numancia","Nuno","Ocana","Ocentejo","Olias","Olmeda","Ontigola","Orea","Orgaz","Oropesa","Otero","Palmaces","Palomeque","Pantoja","Pardos","Paredes","Pareja","Parrillas","Pastrana","Pelahustan","Penalen","Penalver","Pepino","Peralejos","Peralveche","Pinilla","Pioz","Piqueras","Polan","Portillo","Poveda","Pozo","Pradena","Prados","Puebla","Puerto","Pulgar","Quer","Quero","Quintanar","Quismondo","Rebollosa","Recas","Renera","Retamoso","Retiendas","Riba","Rielves","Rillo","Riofrio","Robledillo","Robledo","Romanillos","Romanones","Rueda","Sacecorbo","Sacedon","Saelices","Salmeron","San","Santa","Santiuste","Santo","Sartajada","Sauca","Sayaton","Segurilla","Selas","Semillas","Sesena","Setiles","Sevilleja","Sienes","Siguenza","Solanillos","Somolinos","Sonseca","Sotillo","Sotodosos","Talavera","Tamajon","Taragudo","Taravilla","Tartanedo","Tembleque","Tendilla","Terzaga","Tierzo","Tordellego","Tordelrabano","Tordesilos","Torija","Torralba","Torre","Torrecilla","Torrecuadrada","Torrejon","Torremocha","Torrico","Torrijos","Torrubia","Tortola","Tortuera","Tortuero","Totanes","Traid","Trijueque","Trillo","Turleque","Uceda","Ugena","Ujados","Urda","Utande","Valdarachas","Valdesotos","Valhermoso","Valtablado","Valverde","Velada","Viana","Vinuelas","Yebes","Yebra","Yelamos","Yeles","Yepes","Yuncler","Yunclillos","Yuncos","Yunquera","Zaorejas","Zarzuela","Zorita"],
      ["Belgorod","Beloberezhye","Belyi","Belz","Berestiy","Berezhets","Berezovets","Berezutsk","Bobruisk","Bolonets","Borisov","Borovsk","Bozhesk","Bratslav","Bryansk","Brynsk","Buryn","Byhov","Chechersk","Chemesov","Cheremosh","Cherlen","Chern","Chernigov","Chernitsa","Chernobyl","Chernogorod","Chertoryesk","Chetvertnia","Demyansk","Derevesk","Devyagoresk","Dichin","Dmitrov","Dorogobuch","Dorogobuzh","Drestvin","Drokov","Drutsk","Dubechin","Dubichi","Dubki","Dubkov","Dveren","Galich","Glebovo","Glinsk","Goloty","Gomiy","Gorodets","Gorodische","Gorodno","Gorohovets","Goroshin","Gorval","Goryshon","Holm","Horobor","Hoten","Hotin","Hotmyzhsk","Ilovech","Ivan","Izborsk","Izheslavl","Kamenets","Kanev","Karachev","Karna","Kavarna","Klechesk","Klyapech","Kolomyya","Kolyvan","Kopyl","Korec","Kornik","Korochunov","Korshev","Korsun","Koshkin","Kotelno","Kovyla","Kozelsk","Kozelsk","Kremenets","Krichev","Krylatsk","Ksniatin","Kulatsk","Kursk","Kursk","Lebedev","Lida","Logosko","Lomihvost","Loshesk","Loshichi","Lubech","Lubno","Lubutsk","Lutsk","Luchin","Luki","Lukoml","Luzha","Lvov","Mtsensk","Mdin","Medniki","Melecha","Merech","Meretsk","Mescherskoe","Meshkovsk","Metlitsk","Mezetsk","Mglin","Mihailov","Mikitin","Mikulino","Miloslavichi","Mogilev","Mologa","Moreva","Mosalsk","Moschiny","Mozyr","Mstislav","Mstislavets","Muravin","Nemech","Nemiza","Nerinsk","Nichan","Novgorod","Novogorodok","Obolichi","Obolensk","Obolensk","Oleshsk","Olgov","Omelnik","Opoka","Opoki","Oreshek","Orlets","Osechen","Oster","Ostrog","Ostrov","Perelai","Peremil","Peremyshl","Pererov","Peresechen","Perevitsk","Pereyaslav","Pinsk","Ples","Polotsk","Pronsk","Proposhesk","Punia","Putivl","Rechitsa","Rodno","Rogachev","Romanov","Romny","Roslavl","Rostislavl","Rostovets","Rsha","Ruza","Rybchesk","Rylsk","Rzhavesk","Rzhev","Rzhischev","Sambor","Serensk","Serensk","Serpeysk","Shilov","Shuya","Sinech","Sizhka","Skala","Slovensk","Slutsk","Smedin","Sneporod","Snitin","Snovsk","Sochevo","Sokolec","Starica","Starodub","Stepan","Sterzh","Streshin","Sutesk","Svinetsk","Svisloch","Terebovl","Ternov","Teshilov","Teterin","Tiversk","Torchevsk","Toropets","Torzhok","Tripolye","Trubchevsk","Tur","Turov","Usvyaty","Uteshkov","Vasilkov","Velil","Velye","Venev","Venicha","Verderev","Vereya","Veveresk","Viazma","Vidbesk","Vidychev","Voino","Volodimer","Volok","Volyn","Vorobesk","Voronich","Voronok","Vorotynsk","Vrev","Vruchiy","Vselug","Vyatichsk","Vyatka","Vyshegorod","Vyshgorod","Vysokoe","Yagniatin","Yaropolch","Yasenets","Yuryev","Yuryevets","Zaraysk","Zhitomel","Zholvazh","Zizhech","Zubkov","Zudechev","Zvenigorod"],
      ["Akureyri","Aldra","Alftanes","Andenes","Austbo","Auvog","Bakkafjordur","Ballangen","Bardal","Beisfjord","Bifrost","Bildudalur","Bjerka","Bjerkvik","Bjorkosen","Bliksvaer","Blokken","Blonduos","Bolga","Bolungarvik","Borg","Borgarnes","Bosmoen","Bostad","Bostrand","Botsvika","Brautarholt","Breiddalsvik","Bringsli","Brunahlid","Budardalur","Byggdakjarni","Dalvik","Djupivogur","Donnes","Drageid","Drangsnes","Egilsstadir","Eiteroga","Elvenes","Engavogen","Ertenvog","Eskifjordur","Evenes","Eyrarbakki","Fagernes","Fallmoen","Fellabaer","Fenes","Finnoya","Fjaer","Fjelldal","Flakstad","Flateyri","Flostrand","Fludir","Gardabær","Gardur","Gimstad","Givaer","Gjeroy","Gladstad","Godoya","Godoynes","Granmoen","Gravdal","Grenivik","Grimsey","Grindavik","Grytting","Hafnir","Halsa","Hauganes","Haugland","Hauknes","Hella","Helland","Hellissandur","Hestad","Higrav","Hnifsdalur","Hofn","Hofsos","Holand","Holar","Holen","Holkestad","Holmavik","Hopen","Hovden","Hrafnagil","Hrisey","Husavik","Husvik","Hvammstangi","Hvanneyri","Hveragerdi","Hvolsvollur","Igeroy","Indre","Inndyr","Innhavet","Innes","Isafjordur","Jarklaustur","Jarnsreykir","Junkerdal","Kaldvog","Kanstad","Karlsoy","Kavosen","Keflavik","Kjelde","Kjerstad","Klakk","Kopasker","Kopavogur","Korgen","Kristnes","Krutoga","Krystad","Kvina","Lande","Laugar","Laugaras","Laugarbakki","Laugarvatn","Laupstad","Leines","Leira","Leiren","Leland","Lenvika","Loding","Lodingen","Lonsbakki","Lopsmarka","Lovund","Luroy","Maela","Melahverfi","Meloy","Mevik","Misvaer","Mornes","Mosfellsbær","Moskenes","Myken","Naurstad","Nesberg","Nesjahverfi","Nesset","Nevernes","Obygda","Ofoten","Ogskardet","Okervika","Oknes","Olafsfjordur","Oldervika","Olstad","Onstad","Oppeid","Oresvika","Orsnes","Orsvog","Osmyra","Overdal","Prestoya","Raudalaekur","Raufarhofn","Reipo","Reykholar","Reykholt","Reykjahlid","Rif","Rinoya","Rodoy","Rognan","Rosvika","Rovika","Salhus","Sanden","Sandgerdi","Sandoker","Sandset","Sandvika","Saudarkrokur","Selfoss","Selsoya","Sennesvik","Setso","Siglufjordur","Silvalen","Skagastrond","Skjerstad","Skonland","Skorvogen","Skrova","Sleneset","Snubba","Softing","Solheim","Solheimar","Sorarnoy","Sorfugloy","Sorland","Sormela","Sorvaer","Sovika","Stamsund","Stamsvika","Stave","Stokka","Stokkseyri","Storjord","Storo","Storvika","Strand","Straumen","Strendene","Sudavik","Sudureyri","Sundoya","Sydalen","Thingeyri","Thorlakshofn","Thorshofn","Tjarnabyggd","Tjotta","Tosbotn","Traelnes","Trofors","Trones","Tverro","Ulvsvog","Unnstad","Utskor","Valla","Vandved","Varmahlid","Vassos","Vevelstad","Vidrek","Vik","Vikholmen","Vogar","Vogehamn","Vopnafjordur"],
      ["Abdera","Abila","Abydos","Acanthus","Acharnae","Actium","Adramyttium","Aegae","Aegina","Aegium","Aenus","Agrinion","Aigosthena","Akragas","Akrai","Akrillai","Akroinon","Akrotiri","Alalia","Alexandreia","Alexandretta","Alexandria","Alinda","Amarynthos","Amaseia","Ambracia","Amida","Amisos","Amnisos","Amphicaea","Amphigeneia","Amphipolis","Amphissa","Ankon","Antigona","Antipatrea","Antioch","Antioch","Antiochia","Andros","Apamea","Aphidnae","Apollonia","Argos","Arsuf","Artanes","Artemita","Argyroupoli","Asine","Asklepios","Aspendos","Assus","Astacus","Athenai","Athmonia","Aytos","Ancient","Baris","Bhrytos","Borysthenes","Berge","Boura","Bouthroton","Brauron","Byblos","Byllis","Byzantium","Bythinion","Callipolis","Cebrene","Chalcedon","Calydon","Carystus","Chamaizi","Chalcis","Chersonesos","Chios","Chytri","Clazomenae","Cleonae","Cnidus","Colosse","Corcyra","Croton","Cyme","Cyrene","Cythera","Decelea","Delos","Delphi","Demetrias","Dicaearchia","Dimale","Didyma","Dion","Dioscurias","Dodona","Dorylaion","Dyme","Edessa","Elateia","Eleusis","Eleutherna","Emporion","Ephesus","Ephyra","Epidamnos","Epidauros","Eresos","Eretria","Erythrae","Eubea","Gangra","Gaza","Gela","Golgi","Gonnos","Gorgippia","Gournia","Gortyn","Gythium","Hagios","Hagia","Halicarnassus","Halieis","Helike","Heliopolis","Hellespontos","Helorus","Hemeroskopeion","Heraclea","Hermione","Hermonassa","Hierapetra","Hierapolis","Himera","Histria","Hubla","Hyele","Ialysos","Iasus","Idalium","Imbros","Iolcus","Itanos","Ithaca","Juktas","Kallipolis","Kamares","Kameiros","Kannia","Kamarina","Kasmenai","Katane","Kerkinitida","Kepoi","Kimmerikon","Kios","Klazomenai","Knidos","Knossos","Korinthos","Kos","Kourion","Kume","Kydonia","Kynos","Kyrenia","Lamia","Lampsacus","Laodicea","Lapithos","Larissa","Lato","Laus","Lebena","Lefkada","Lekhaion","Leibethra","Leontinoi","Lepreum","Lessa","Lilaea","Lindus","Lissus","Epizephyrian","Madytos","Magnesia","Mallia","Mantineia","Marathon","Marmara","Maroneia","Masis","Massalia","Megalopolis","Megara","Mesembria","Messene","Metapontum","Methana","Methone","Methumna","Miletos","Misenum","Mochlos","Monastiraki","Morgantina","Mulai","Mukenai","Mylasa","Myndus","Myonia","Myra","Myrmekion","Mutilene","Myos","Nauplios","Naucratis","Naupactus","Naxos","Neapoli","Neapolis","Nemea","Nicaea","Nicopolis","Nirou","Nymphaion","Nysa","Oenoe","Oenus","Odessos","Olbia","Olous","Olympia","Olynthus","Opus","Orchomenus","Oricos","Orestias","Oreus","Oropus","Onchesmos","Pactye","Pagasae","Palaikastro","Pandosia","Panticapaeum","Paphos","Parium","Paros","Parthenope","Patrae","Pavlopetri","Pegai","Pelion","Peiraieús","Pella","Percote","Pergamum","Petsofa","Phaistos","Phaleron","Phanagoria","Pharae","Pharnacia","Pharos","Phaselis","Philippi","Pithekussa","Philippopolis","Platanos","Phlius","Pherae","Phocaea","Pinara","Pisa","Pitane","Pitiunt","Pixous","Plataea","Poseidonia","Potidaea","Priapus","Priene","Prousa","Pseira","Psychro","Pteleum","Pydna","Pylos","Pyrgos","Rhamnus","Rhegion","Rhithymna","Rhodes","Rhypes","Rizinia","Salamis","Same","Samos","Scyllaeum","Selinus","Seleucia","Semasus","Sestos","Scidrus","Sicyon","Side","Sidon","Siteia","Sinope","Siris","Sklavokampos","Smyrna","Soli","Sozopolis","Sparta","Stagirus","Stratos","Stymphalos","Sybaris","Surakousai","Taras","Tanagra","Tanais","Tauromenion","Tegea","Temnos","Tenedos","Tenea","Teos","Thapsos","Thassos","Thebai","Theodosia","Therma","Thespiae","Thronion","Thoricus","Thurii","Thyreum","Thyria","Tiruns","Tithoraea","Tomis","Tragurion","Trapeze","Trapezus","Tripolis","Troizen","Troliton","Troy","Tylissos","Tyras","Tyros","Tyritake","Vasiliki","Vathypetros","Zakynthos","Zakros","Zankle"],
      ["Abila","Adflexum","Adnicrem","Aelia","Aelius","Aeminium","Aequum","Agrippina","Agrippinae","Ala","Albanianis","Ambianum","Andautonia","Apulum","Aquae","Aquaegranni","Aquensis","Aquileia","Aquincum","Arae","Argentoratum","Ariminum","Ascrivium","Atrebatum","Atuatuca","Augusta","Aurelia","Aurelianorum","Batavar","Batavorum","Belum","Biriciana","Blestium","Bonames","Bonna","Bononia","Borbetomagus","Bovium","Bracara","Brigantium","Burgodunum","Caesaraugusta","Caesarea","Caesaromagus","Calleva","Camulodunum","Cannstatt","Cantiacorum","Capitolina","Castellum","Castra","Castrum","Cibalae","Clausentum","Colonia","Concangis","Condate","Confluentes","Conimbriga","Corduba","Coria","Corieltauvorum","Corinium","Coriovallum","Cornoviorum","Danum","Deva","Divodurum","Dobunnorum","Drusi","Dubris","Dumnoniorum","Durnovaria","Durocobrivis","Durocornovium","Duroliponte","Durovernum","Durovigutum","Eboracum","Edetanorum","Emerita","Emona","Euracini","Faventia","Flaviae","Florentia","Forum","Gerulata","Gerunda","Glevensium","Hadriani","Herculanea","Isca","Italica","Iulia","Iuliobrigensium","Iuvavum","Lactodurum","Lagentium","Lauri","Legionis","Lemanis","Lentia","Lepidi","Letocetum","Lindinis","Lindum","Londinium","Lopodunum","Lousonna","Lucus","Lugdunum","Luguvalium","Lutetia","Mancunium","Marsonia","Martius","Massa","Matilo","Mattiacorum","Mediolanum","Mod","Mogontiacum","Moridunum","Mursa","Naissus","Nervia","Nida","Nigrum","Novaesium","Noviomagus","Olicana","Ovilava","Parisiorum","Partiscum","Paterna","Pistoria","Placentia","Pollentia","Pomaria","Pons","Portus","Praetoria","Praetorium","Pullum","Ragusium","Ratae","Raurica","Regina","Regium","Regulbium","Rigomagus","Roma","Romula","Rutupiae","Salassorum","Salernum","Salona","Scalabis","Segovia","Silurum","Sirmium","Siscia","Sorviodurum","Sumelocenna","Tarraco","Taurinorum","Theranda","Traiectum","Treverorum","Tungrorum","Turicum","Ulpia","Valentia","Venetiae","Venta","Verulamium","Vesontio","Vetera","Victoriae","Victrix","Villa","Viminacium","Vindelicorum","Vindobona","Vinovia","Viroconium"],
      ["Aanekoski","Abjapaluoja","Ahlainen","Aholanvaara","Ahtari","Aijala","Aimala","Akaa","Alajarvi","Alatornio","Alavus","Antsla","Aspo","Bennas","Bjorkoby","Elva","Emasalo","Espoo","Esse","Evitskog","Forssa","Haapajarvi","Haapamaki","Haapavesi","Haapsalu","Haavisto","Hameenlinna","Hameenmaki","Hamina","Hanko","Harjavalta","Hattuvaara","Haukipudas","Hautajarvi","Havumaki","Heinola","Hetta","Hinkabole","Hirmula","Hossa","Huittinen","Husula","Hyryla","Hyvinkaa","Iisalmi","Ikaalinen","Ilmola","Imatra","Inari","Iskmo","Itakoski","Jamsa","Jarvenpaa","Jeppo","Jioesuu","Jiogeva","Joensuu","Jokela","Jokikyla","Jokisuu","Jormua","Juankoski","Jungsund","Jyvaskyla","Kaamasmukka","Kaarina","Kajaani","Kalajoki","Kallaste","Kankaanpaa","Kannus","Kardla","Karesuvanto","Karigasniemi","Karkkila","Karkku","Karksinuia","Karpankyla","Kaskinen","Kasnas","Kauhajoki","Kauhava","Kauniainen","Kauvatsa","Kehra","Keila","Kellokoski","Kelottijarvi","Kemi","Kemijarvi","Kerava","Keuruu","Kiikka","Kiipu","Kilinginiomme","Kiljava","Kilpisjarvi","Kitee","Kiuruvesi","Kivesjarvi","Kiviioli","Kivisuo","Klaukkala","Klovskog","Kohtlajarve","Kokemaki","Kokkola","Kolho","Koria","Koskue","Kotka","Kouva","Kouvola","Kristiina","Kaupunki","Kuhmo","Kunda","Kuopio","Kuressaare","Kurikka","Kusans","Kuusamo","Kylmalankyla","Lahti","Laitila","Lankipohja","Lansikyla","Lappeenranta","Lapua","Laurila","Lautiosaari","Lepsama","Liedakkala","Lieksa","Lihula","Littoinen","Lohja","Loimaa","Loksa","Loviisa","Luohuanylipaa","Lusi","Maardu","Maarianhamina","Malmi","Mantta","Masaby","Masala","Matasvaara","Maula","Miiluranta","Mikkeli","Mioisakula","Munapirtti","Mustvee","Muurahainen","Naantali","Nappa","Narpio","Nickby","Niinimaa","Niinisalo","Nikkila","Nilsia","Nivala","Nokia","Nummela","Nuorgam","Nurmes","Nuvvus","Obbnas","Oitti","Ojakkala","Ollola","onningeby","Orimattila","Orivesi","Otanmaki","Otava","Otepaa","Oulainen","Oulu","Outokumpu","Paavola","Paide","Paimio","Pakankyla","Paldiski","Parainen","Parkano","Parkumaki","Parola","Perttula","Pieksamaki","Pietarsaari","Pioltsamaa","Piolva","Pohjavaara","Porhola","Pori","Porrasa","Porvoo","Pudasjarvi","Purmo","Pussi","Pyhajarvi","Raahe","Raasepori","Raisio","Rajamaki","Rakvere","Rapina","Rapla","Rauma","Rautio","Reposaari","Riihimaki","Rovaniemi","Roykka","Ruonala","Ruottala","Rutalahti","Saarijarvi","Salo","Sastamala","Saue","Savonlinna","Seinajoki","Sillamae","Sindi","Siuntio","Somero","Sompujarvi","Suonenjoki","Suurejaani","Syrjantaka","Tampere","Tamsalu","Tapa","Temmes","Tiorva","Tormasenvaara","Tornio","Tottijarvi","Tulppio","Turenki","Turi","Tuukkala","Tuurala","Tuuri","Tuuski","Ulvila","Unari","Upinniemi","Utti","Uusikaarlepyy","Uusikaupunki","Vaaksy","Vaalimaa","Vaarinmaja","Vaasa","Vainikkala","Valga","Valkeakoski","Vantaa","Varkaus","Vehkapera","Vehmasmaki","Vieki","Vierumaki","Viitasaari","Viljandi","Vilppula","Viohma","Vioru","Virrat","Ylike","Ylivieska","Ylojarvi"],
      ["Sabi","Wiryeseong","Hwando","Gungnae","Ungjin","Wanggeomseong","Ganggyeong","Jochiwon","Cheorwon","Beolgyo","Gangjin","Gampo","Yecheon","Geochang","Janghang","Hadong","Goseong","Yeongdong","Yesan","Sintaein","Geumsan","Boseong","Jangheung","Uiseong","Jumunjin","Janghowon","Hongseong","Gimhwa","Gwangcheon","Guryongpo","Jinyeong","Buan","Damyang","Jangseong","Wando","Angang","Okcheon","Jeungpyeong","Waegwan","Cheongdo","Gwangyang","Gochang","Haenam","Yeonggwang","Hanam","Eumseong","Daejeong","Hanrim","Samrye","Yongjin","Hamyang","Buyeo","Changnyeong","Yeongwol","Yeonmu","Gurye","Hwasun","Hampyeong","Namji","Samnangjin","Dogye","Hongcheon","Munsan","Gapyeong","Ganghwa","Geojin","Sangdong","Jeongseon","Sabuk","Seonghwan","Heunghae","Hapdeok","Sapgyo","Taean","Boeun","Geumwang","Jincheon","Bongdong","Doyang","Geoncheon","Pungsan","Punggi","Geumho","Wonju","Gaun","Hayang","Yeoju","Paengseong","Yeoncheon","Yangpyeong","Ganseong","Yanggu","Yangyang","Inje","Galmal","Pyeongchang","Hwacheon","Hoengseong","Seocheon","Cheongyang","Goesan","Danyang","Hamyeol","Muju","Sunchang","Imsil","Jangsu","Jinan","Goheung","Gokseong","Muan","Yeongam","Jindo","Seonsan","Daegaya","Gunwi","Bonghwa","Seongju","Yeongdeok","Yeongyang","Ulleung","Uljin","Cheongsong","wayang","Namhae","Sancheong","Uiryeong","Gaya","Hapcheon","Wabu","Dongsong","Sindong","Wondeok","Maepo","Anmyeon","Okgu","Sariwon","Dolsan","Daedeok","Gwansan","Geumil","Nohwa","Baeksu","Illo","Jido","Oedong","Ocheon","Yeonil","Hamchang","Pyeonghae","Gijang","Jeonggwan","Aewor","Gujwa","Seongsan","Jeongok","Seonggeo","Seungju","Hongnong","Jangan","Jocheon","Gohan","Jinjeop","Bubal","Beobwon","Yeomchi","Hwado","Daesan","Hwawon","Apo","Nampyeong","Munsan","Sinbuk","Munmak","Judeok","Bongyang","Ungcheon","Yugu","Unbong","Mangyeong","Dong","Naeseo","Sanyang","Soheul","Onsan","Eonyang","Nongong","Dasa","Goa","Jillyang","Bongdam","Naesu","Beomseo","Opo","Gongdo","Jingeon","Onam","Baekseok","Jiksan","Mokcheon","Jori","Anjung","Samho","Ujeong","Buksam","Tongjin","Chowol","Gonjiam","Pogok","Seokjeok","Poseung","Ochang","Hyangnam","Baebang","Gochon","Songak","Samhyang","Yangchon","Osong","Aphae","Ganam","Namyang","Chirwon","Andong","Ansan","Anseong","Anyang","Asan","Boryeong","Bucheon","Busan","Changwon","Cheonan","Cheongju","Chuncheon","Chungju","Daegu","Daejeon","Dangjin","Dongducheon","Donghae","Gangneung","Geoje","Gimcheon","Gimhae","Gimje","Gimpo","Gongju","Goyang","Gumi","Gunpo","Gunsan","Guri","Gwacheon","Gwangju","Gwangju","Gwangmyeong","Gyeongju","Gyeongsan","Gyeryong","Hwaseong","Icheon","Iksan","Incheon","Jecheon","Jeongeup","Jeonju","Jeju","Jinju","Naju","Namyangju","Namwon","Nonsan","Miryang","Mokpo","Mungyeong","Osan","Paju","Pocheon","Pohang","Pyeongtaek","Sacheon","Sangju","Samcheok","Sejong","Seogwipo","Seongnam","Seosan","Seoul","Siheung","Sokcho","Suncheon","Suwon","Taebaek","Tongyeong","Uijeongbu","Uiwang","Ulsan","Yangju","Yangsan","Yeongcheon","Yeongju","Yeosu","Yongin","Chungmu","Daecheon","Donggwangyang","Geumseong","Gyeongseong","Iri","Jangseungpo","Jeomchon","Jeongju","Migeum","Onyang","Samcheonpo","Busan","Busan","Cheongju","Chuncheon","Daegu","Daegu","Daejeon","Daejeon","Gunsan","Gwangju","Gwangju","Gyeongseong","Incheon","Incheon","Iri","Jeonju","Jinhae","Jinju","Masan","Masan","Mokpo","Songjeong","Songtan","Ulsan","Yeocheon","Cheongjin","Gaeseong","Haeju","Hamheung","Heungnam","Jinnampo","Najin","Pyeongyang","Seongjin","Sineuiju","Songnim","Wonsan"],
      ["Anding","Anlu","Anqing","Anshun","Baan","Baixing","Banyang","Baoding","Baoqing","Binzhou","Caozhou","Changbai","Changchun","Changde","Changling","Changsha","Changtu","Changzhou","Chaozhou","Cheli","Chengde","Chengdu","Chenzhou","Chizhou","Chongqing","Chuxiong","Chuzhou","Dading","Dali","Daming","Datong","Daxing","Dean","Dengke","Dengzhou","Deqing","Dexing","Dihua","Dingli","Dongan","Dongchang","Dongchuan","Dongping","Duyun","Fengtian","Fengxiang","Fengyang","Fenzhou","Funing","Fuzhou","Ganzhou","Gaoyao","Gaozhou","Gongchang","Guangnan","Guangning","Guangping","Guangxin","Guangzhou","Guide","Guilin","Guiyang","Hailong","Hailun","Hangzhou","Hanyang","Hanzhong","Heihe","Hejian","Henan","Hengzhou","Hezhong","Huaian","Huaide","Huaiqing","Huanglong","Huangzhou","Huining","Huizhou","Hulan","Huzhou","Jiading","Jian","Jianchang","Jiande","Jiangning","Jiankang","Jianning","Jiaxing","Jiayang","Jilin","Jinan","Jingjiang","Jingzhao","Jingzhou","Jinhua","Jinzhou","Jiujiang","Kaifeng","Kaihua","Kangding","Kuizhou","Laizhou","Lanzhou","Leizhou","Liangzhou","Lianzhou","Liaoyang","Lijiang","Linan","Linhuang","Linjiang","Lintao","Liping","Liuzhou","Longan","Longjiang","Longqing","Longxing","Luan","Lubin","Lubin","Luzhou","Mishan","Nanan","Nanchang","Nandian","Nankang","Nanning","Nanyang","Nenjiang","Ningan","Ningbo","Ningguo","Ninguo","Ningwu","Ningxia","Ningyuan","Pingjiang","Pingle","Pingliang","Pingyang","Puer","Puzhou","Qianzhou","Qingyang","Qingyuan","Qingzhou","Qiongzhou","Qujing","Quzhou","Raozhou","Rende","Ruian","Ruizhou","Runing","Shafeng","Shajing","Shaoqing","Shaowu","Shaoxing","Shaozhou","Shinan","Shiqian","Shouchun","Shuangcheng","Shulei","Shunde","Shunqing","Shuntian","Shuoping","Sicheng","Sien","Sinan","Sizhou","Songjiang","Suiding","Suihua","Suining","Suzhou","Taian","Taibei","Tainan","Taiping","Taiwan","Taiyuan","Taizhou","Taonan","Tengchong","Tieli","Tingzhou","Tongchuan","Tongqing","Tongren","Tongzhou","Weihui","Wensu","Wenzhou","Wuchang","Wuding","Wuzhou","Xian","Xianchun","Xianping","Xijin","Xiliang","Xincheng","Xingan","Xingde","Xinghua","Xingjing","Xingqing","Xingyi","Xingyuan","Xingzhong","Xining","Xinmen","Xiping","Xuanhua","Xunzhou","Xuzhou","Yanan","Yangzhou","Yanji","Yanping","Yanqi","Yanzhou","Yazhou","Yichang","Yidu","Yilan","Yili","Yingchang","Yingde","Yingtian","Yingzhou","Yizhou","Yongchang","Yongping","Yongshun","Yongzhou","Yuanzhou","Yuezhou","Yulin","Yunnan","Yunyang","Zezhou","Zhangde","Zhangzhou","Zhaoqing","Zhaotong","Zhenan","Zhending","Zhengding","Zhenhai","Zhenjiang","Zhenxi","Zhenyun","Zhongshan","Zunyi"],
      ["Nanporo","Naie","Kamisunagawa","Yuni","Naganuma","Kuriyama","Tsukigata","Urausu","Shintotsukawa","Moseushi","Chippubetsu","Uryu","Hokuryu","Numata","Tobetsu","Suttsu","Kuromatsunai","Rankoshi","Niseko","Kimobetsu","Kyogoku","Kutchan","Kyowa","Iwanai","Shakotan","Furubira","Niki","Yoichi","Toyoura","Toyako","Sobetsu","Shiraoi","Atsuma","Abira","Mukawa","Hidaka","Biratori","Niikappu","Urakawa","Samani","Erimo","Shinhidaka","Matsumae","Fukushima","Shiriuchi","Kikonai","Nanae","Shikabe","Mori","Yakumo","Oshamambe","Esashi","Kaminokuni","Assabu","Otobe","Okushiri","Imakane","Setana","Takasu","Higashikagura","Toma","Pippu","Aibetsu","Kamikawa","Higashikawa","Biei","Kamifurano","Nakafurano","Minamifurano","Horokanai","Wassamu","Kenbuchi","Shimokawa","Bifuka","Nakagawa","Mashike","Obira","Tomamae","Haboro","Enbetsu","Teshio","Hamatonbetsu","Nakatonbetsu","Esashi","Toyotomi","Horonobe","Rebun","Rishiri","Rishirifuji","Bihoro","Tsubetsu","Ozora","Shari","Kiyosato","Koshimizu","Kunneppu","Oketo","Saroma","Engaru","Yubetsu","Takinoue","Okoppe","Omu","Otofuke","Shihoro","Kamishihoro","Shikaoi","Shintoku","Shimizu","Memuro","Taiki","Hiroo","Makubetsu","Ikeda","Toyokoro","Honbetsu","Ashoro","Rikubetsu","Urahoro","Kushiro","Akkeshi","Hamanaka","Shibecha","Teshikaga","Shiranuka","Betsukai","Nakashibetsu","Shibetsu","Rausu","Hiranai","Imabetsu","Sotogahama","Ajigasawa","Fukaura","Fujisaki","Owani","Itayanagi","Tsuruta","Nakadomari","Noheji","Shichinohe","Rokunohe","Yokohama","Tohoku","Oirase","Oma","Sannohe","Gonohe","Takko","Nanbu","Hashikami","Shizukuishi","Kuzumaki","Iwate","Shiwa","Yahaba","Nishiwaga","Kanegasaki","Hiraizumi","Sumita","Otsuchi","Yamada","Iwaizumi","Karumai","Hirono","Ichinohe","Zao","Shichikashuku","Ogawara","Murata","Shibata","Kawasaki","Marumori","Watari","Yamamoto","Matsushima","Shichigahama","Rifu","Taiwa","Osato","Shikama","Kami","Wakuya","Misato","Onagawa","Minamisanriku","Kosaka","Fujisato","Mitane","Happo","Gojome","Hachirogata","Ikawa","Misato","Ugo","Yamanobe","Nakayama","Kahoku","Nishikawa","Asahi","Oe","Oishida","Kaneyama","Mogami","Funagata","Mamurogawa","Takahata","Kawanishi","Oguni","Shirataka","Iide","Mikawa","Shonai","Yuza","Koori","Kunimi","Kawamata","Kagamiishi","Shimogo","Tadami","Minamiaizu","Nishiaizu","Bandai","Inawashiro","Aizubange","Yanaizu","Mishima","Kaneyama","Aizumisato","Yabuki","Tanagura","Yamatsuri","Hanawa","Ishikawa","Asakawa","Furudono","Miharu","Ono","Hirono","Naraha","Tomioka","Okuma","Futaba","Namie","Shinchi","Ibaraki","Oarai","Shirosato","Daigo","Ami","Kawachi","Yachiyo","Goka","Sakai","Tone","Kaminokawa","Mashiko","Motegi","Ichikai","Haga","Mibu","Nogi","Shioya","Takanezawa","Nasu","Nakagawa","Yoshioka","Kanna","Shimonita","Kanra","Nakanojo","Naganohara","Kusatsu","Higashiagatsuma","Minakami","Tamamura","Itakura","Meiwa","Chiyoda","Oizumi","Ora","Ina","Miyoshi","Moroyama","Ogose","Namegawa","Ranzan","Ogawa","Kawajima","Yoshimi","Hatoyama","Tokigawa","Yokoze","Minano","Nagatoro","Ogano","Misato","Kamikawa","Kamisato","Yorii","Miyashiro","Sugito","Matsubushi","Shisui","Sakae","Kozaki","Tako","Tonosho","Kujukuri","Shibayama","Yokoshibahikari","Ichinomiya","Mutsuzawa","Shirako","Nagara","Chonan","Otaki","Onjuku","Kyonan","Mizuho","Hinode","Okutama","Oshima","Hachijo","Aikawa","Hayama","Samukawa","Oiso","Ninomiya","Nakai","Oi","Matsuda","Yamakita","Kaisei","Hakone","Manazuru","Yugawara","Seiro","Tagami","Aga","Izumozaki","Yuzawa","Tsunan","Kamiichi","Tateyama","Nyuzen","Asahi","Kawakita","Tsubata","Uchinada","Shika","Hodatsushimizu","Nakanoto","Anamizu","Noto","Eiheiji","Ikeda","Minamiechizen","Echizen","Mihama","Takahama","Oi","Wakasa","Ichikawamisato","Hayakawa","Minobu","Nanbu","Fujikawa","Showa","Nishikatsura","Fujikawaguchiko","Koumi","Sakuho","Karuizawa","Miyota","Tateshina","Nagawa","Shimosuwa","Fujimi","Tatsuno","Minowa","Iijima","Matsukawa","Takamori","Anan","Agematsu","Nagiso","Kiso","Ikeda","Sakaki","Obuse","Yamanouchi","Shinano","Iizuna","Ginan","Kasamatsu","Yoro","Tarui","Sekigahara","Godo","Wanouchi","Anpachi","Ibigawa","Ono","Ikeda","Kitagata","Sakahogi","Tomika","Kawabe","Hichiso","Yaotsu","Shirakawa","Mitake","Higashiizu","Kawazu","Minamiizu","Matsuzaki","Nishiizu","Kannami","Shimizu","Nagaizumi","Oyama","Yoshida","Kawanehon","Mori","Togo","Toyoyama","Oguchi","Fuso","Oharu","Kanie","Agui","Higashiura","Minamichita","Mihama","Taketoyo","Mihama","Kota","Shitara","Toei","Kisosaki","Toin","Komono","Asahi","Kawagoe","Taki","Meiwa","Odai","Tamaki","Watarai","Taiki","Minamiise","Kihoku","Mihama","Kiho","Hino","Ryuo","Aisho","Toyosato","Kora","Taga","Oyamazaki","Kumiyama","Ide","Ujitawara","Kasagi","Wazuka","Seika","Kyotamba","Ine","Yosano","Shimamoto","Toyono","Nose","Tadaoka","Kumatori","Tajiri","Misaki","Taishi","Kanan","Inagawa","Taka","Inami","Harima","Ichikawa","Fukusaki","Kamikawa","Taishi","Kamigori","Sayo","Kami","Shinonsen","Heguri","Sango","Ikaruga","Ando","Kawanishi","Miyake","Tawaramoto","Takatori","Kanmaki","Oji","Koryo","Kawai","Yoshino","Oyodo","Shimoichi","Kushimoto","Kimino","Katsuragi","Kudoyama","Koya","Yuasa","Hirogawa","Aridagawa","Mihama","Hidaka","Yura","Inami","Minabe","Hidakagawa","Shirahama","Kamitonda","Susami","Nachikatsuura","Taiji","Kozagawa","Iwami","Wakasa","Chizu","Yazu","Misasa","Yurihama","Kotoura","Hokuei","Daisen","Nanbu","Hoki","Nichinan","Hino","Kofu","Okuizumo","Iinan","Kawamoto","Misato","Onan","Tsuwano","Yoshika","Ama","Nishinoshima","Okinoshima","Wake","Hayashima","Satosho","Yakage","Kagamino","Shoo","Nagi","Kumenan","Misaki","Kibichuo","Fuchu","Kaita","Kumano","Saka","Kitahiroshima","Akiota","Osakikamijima","Sera","Jinsekikogen","Suooshima","Waki","Kaminoseki","Tabuse","Hirao","Abu","Katsuura","Kamikatsu","Ishii","Kamiyama","Naka","Mugi","Minami","Kaiyo","Matsushige","Kitajima","Aizumi","Itano","Kamiita","Tsurugi","Higashimiyoshi","Tonosho","Shodoshima","Miki","Naoshima","Utazu","Ayagawa","Kotohira","Tadotsu","Manno","Kamijima","Kumakogen","Masaki","Tobe","Uchiko","Ikata","Kihoku","Matsuno","Ainan","Toyo","Nahari","Tano","Yasuda","Motoyama","Otoyo","Tosa","Ino","Niyodogawa","Nakatosa","Sakawa","Ochi","Yusuhara","Tsuno","Shimanto","Otsuki","Kuroshio","Nakagawa","Umi","Sasaguri","Shime","Sue","Shingu","Hisayama","Kasuya","Ashiya","Mizumaki","Okagaki","Onga","Kotake","Kurate","Keisen","Chikuzen","Tachiarai","Oki","Hirokawa","Kawara","Soeda","Itoda","Kawasaki","Oto","Fukuchi","Kanda","Miyako","Yoshitomi","Koge","Chikujo","Yoshinogari","Kiyama","Kamimine","Miyaki","Genkai","Arita","Omachi","Kohoku","Shiroishi","Tara","Nagayo","Togitsu","Higashisonogi","Kawatana","Hasami","Ojika","Saza","Shinkamigoto","Misato","Gyokuto","Nankan","Nagasu","Nagomi","Ozu","Kikuyo","Minamioguni","Oguni","Takamori","Mifune","Kashima","Mashiki","Kosa","Yamato","Hikawa","Ashikita","Tsunagi","Nishiki","Taragi","Yunomae","Asagiri","Reihoku","Hiji","Kusu","Kokonoe","Mimata","Takaharu","Kunitomi","Aya","Takanabe","Shintomi","Kijo","Kawaminami","Tsuno","Kadogawa","Misato","Takachiho","Hinokage","Gokase","Satsuma","Nagashima","Yusui","Osaki","Higashikushira","Kinko","Minamiosumi","Kimotsuki","Nakatane","Minamitane","Yakushima","Setouchi","Tatsugo","Kikai","Tokunoshima","Amagi","Isen","Wadomari","China","Yoron","Motobu","Kin","Kadena","Chatan","Nishihara","Yonabaru","Haebaru","Kumejima","Yaese","Taketomi","Yonaguni"]
    ];
  }

  // randomize options if randomization is allowed in option
  function randomizeOptions() {
    const mod = rn((graphWidth + graphHeight) / 1500, 2); // add mod for big screens
    if (lockRegionsInput.getAttribute("data-locked") == 0) regionsInput.value = regionsOutput.value = rand(7, 17);
    if (lockManorsInput.getAttribute("data-locked") == 0) {
      const manors = regionsInput.value * 20 + rand(180 * mod);
      manorsInput.value = manorsOutput.innerHTML = manors;
    }
    if (lockPowerInput.getAttribute("data-locked") == 0) powerInput.value = powerOutput.value = rand(2, 8);
    if (lockNeutralInput.getAttribute("data-locked") == 0) neutralInput.value = neutralOutput.value = rand(100, 300);
    if (lockNamesInput.getAttribute("data-locked") == 0) namesInput.value = rand(0, 1);
    if (lockCulturesInput.getAttribute("data-locked") == 0) culturesInput.value = culturesOutput.value = rand(5, 10);
    if (lockPrecInput.getAttribute("data-locked") == 0) precInput.value = precOutput.value = rand(3, 12);
    if (lockSwampinessInput.getAttribute("data-locked") == 0) swampinessInput.value = swampinessOutput.value = rand(100);
  }

  // Locate points to calculate Voronoi diagram
  function placePoints() {
    console.time("placePoints");
    points = [];
    points = getJitteredGrid();
    heights = new Uint8Array(points.length);
    console.timeEnd("placePoints");
  }

  // Calculate Voronoi Diagram
  function calculateVoronoi(points) {
    console.time("calculateVoronoi");
    diagram = voronoi(points);
    // round edges to simplify future calculations
    diagram.edges.forEach(function(e) {
      e[0][0] = rn(e[0][0],2);
      e[0][1] = rn(e[0][1],2);
      e[1][0] = rn(e[1][0],2);
      e[1][1] = rn(e[1][1],2);
    });
    polygons = diagram.polygons();
    console.log(" cells: " + points.length);
    console.timeEnd("calculateVoronoi");
  }

  // Get cell info on mouse move (useful for debugging)
  function moved() {
    const point = d3.mouse(this);
    const i = diagram.find(point[0],point[1]).index;

    // update cellInfo
    if (i) {
      const p = cells[i]; // get cell
      infoX.innerHTML = rn(point[0]);
      infoY.innerHTML = rn(point[1]);
      infoCell.innerHTML = i;
      infoArea.innerHTML = ifDefined(p.area, "n/a", 2);
      if (customization === 1) {infoHeight.innerHTML = getFriendlyHeight(heights[i]);}
      else {infoHeight.innerHTML = getFriendlyHeight(p.height);}
      infoFlux.innerHTML = ifDefined(p.flux, "n/a", 2);
      let country = p.region === undefined ? "n/a" : p.region === "neutral" ? "neutral" : states[p.region].name + " (" + p.region + ")";
      infoCountry.innerHTML = country;
      let culture = ifDefined(p.culture) !== "no" ? cultures[p.culture].name + " (" + p.culture + ")" : "n/a";
      infoCulture.innerHTML = culture;
      infoPopulation.innerHTML = ifDefined(p.pop, "n/a", 2);
      infoBurg.innerHTML = ifDefined(p.manor) !== "no" ? manors[p.manor].name + " (" + p.manor + ")" : "no";
      const feature = features[p.fn];
      if (feature !== undefined) {
        const fType = feature.land ? "Island" : feature.border ? "Ocean" : "Lake";
        infoFeature.innerHTML = fType + " (" + p.fn + ")";
      } else {
        infoFeature.innerHTML = "n/a";
      }
    }

    // update tooltip
    if (toggleTooltips.checked) {
      tooltip.innerHTML = tooltip.getAttribute("data-main");
      const tag = event.target.tagName;
      const path = event.composedPath();
      const group = path[path.length - 7].id;
      const subgroup = path[path.length - 8].id;
      if (group === "rivers") tip("Click to open River Editor");
      if (group === "routes") tip("Click to open Route Editor");
      if (group === "terrain") tip("Click to open Relief Icon Editor");
      if (group === "labels") tip("Click to open Label Editor");
      if (group === "icons") tip("Click to open Icon Editor");
      if (group === "markers") tip("Click to open Marker Editor");
      if (group === "ruler") {
        if (tag === "path" || tag === "line") tip("Drag to move the measurer");
        if (tag === "text") tip("Click to remove the measurer");
        if (tag === "circle") tip("Drag to adjust the measurer");
      }
      if (subgroup === "burgIcons") tip("Click to open Burg Editor");
      if (subgroup === "burgLabels") tip("Click to open Burg Editor");

      // show legend on hover (if any)
      let id = event.target.id;
      if (id === "") id = event.target.parentNode.id;
      if (subgroup === "burgLabels") id = "burg" + event.target.getAttribute("data-id");

      let note = notes.find(note => note.id === id);
      let legend = document.getElementById("legend");
      let legendHeader = document.getElementById("legendHeader");
      let legendBody = document.getElementById("legendBody");
      if (note !== undefined && note.legend !== "") {
        legend.style.display = "block";
        legendHeader.innerHTML = note.name;
        legendBody.innerHTML = note.legend;
      } else {
        legend.style.display = "none";
        legendHeader.innerHTML = "";
        legendBody.innerHTML = "";
      }
    }

    // draw line for ranges placing for heightmap Customization
    if (customization === 1) {
      const line = debug.selectAll(".line");
      if (debug.selectAll(".tag").size() === 1) {
        const x = +debug.select(".tag").attr("cx");
        const y = +debug.select(".tag").attr("cy");
        if (line.size()) {line.attr("x1", x).attr("y1", y).attr("x2", point[0]).attr("y2", point[1]);}
        else {debug.insert("line", ":first-child").attr("class", "line")
      .attr("x1", x).attr("y1", y).attr("x2", point[0]).attr("y2", point[1]);}
      } else {
         line.remove();
      }
    }

    // change radius circle for Customization
    if (customization > 0) {
      const brush = $("#brushesButtons > .pressed");
      const brushId = brush.attr("id");
      if (brushId === "brushRange" || brushId === "brushTrough") return;
      if (!brush.length && !$("div.selected").length) return;
      let radius = 0;
      if (customization === 1) {
        radius = brushRadius.value;
        if (brushId === "brushHill" || brushId === "brushPit") {
          radius = Math.pow(brushPower.value * 4, .5);
        }
      }
      else if (customization === 2) radius = countriesManuallyBrush.value;
      else if (customization === 4) radius = culturesManuallyBrush.value;

      const r = rn(6 / graphSize * radius, 1);
      let clr = "#373737";
      if (customization === 2) {
        const state = +$("div.selected").attr("id").slice(5);
        clr = states[state].color === "neutral" ? "white" : states[state].color;
      }
      if (customization === 4) {
        const culture = +$("div.selected").attr("id").slice(7);
        clr = cultures[culture].color;
      }
      moveCircle(point[0],point[1],r, clr);
    }
  }

  // return value (v) if defined with specified number of decimals (d)
  // else return "no" or attribute (r)
  function ifDefined(v, r, d) {
    if (v === null || v === undefined) return r || "no";
    if (d) return v.toFixed(d);
    return v;
  }

  // get user-friendly (real-world) height value from map data
  function getFriendlyHeight(h) {
    let exponent = +heightExponent.value;
    let unit = heightUnit.value;
    let unitRatio = 1; // default calculations are in meters
    if (unit === "ft") unitRatio = 3.28; // if foot
    if (unit === "f") unitRatio = 0.5468; // if fathom
    let height = -990;
    if (h >= 20) height = Math.pow(h - 18, exponent);
    if (h < 20 && h > 0) height = (h - 20) / h * 50;
    return h + " (" + rn(height * unitRatio) + " " + unit + ")";
  }

  // move brush radius circle
  function moveCircle(x, y, r, c) {
    let circle = debug.selectAll(".circle");
    if (!circle.size()) circle = debug.insert("circle", ":first-child").attr("class", "circle");
    circle.attr("cx", x).attr("cy", y);
    if (r) circle.attr("r", r);
    if (c) circle.attr("stroke", c);
  }

  // Drag actions
  function dragstarted() {
    const x0 = d3.event.x, y0 = d3.event.y,
      c0 = diagram.find(x0, y0).index;
    let c1 = c0;
    let x1, y1;
    const opisometer = $("#addOpisometer").hasClass("pressed");
    const planimeter = $("#addPlanimeter").hasClass("pressed");
    const factor = rn(1 / Math.pow(scale, 0.3), 1);

    if (opisometer || planimeter) {
      $("#ruler").show();
      const type = opisometer ? "opisometer" : "planimeter";
      var rulerNew = ruler.append("g").attr("class", type).call(d3.drag().on("start", elementDrag));
      var points = [{scX: rn(x0, 2), scY: rn(y0, 2)}];
      if (opisometer) {
        var curve = rulerNew.append("path").attr("class", "opisometer white").attr("stroke-width", factor);
        const dash = rn(30 / distanceScale.value, 2);
        var curveGray = rulerNew.append("path").attr("class", "opisometer gray").attr("stroke-dasharray", dash).attr("stroke-width", factor);
      } else {
        var curve = rulerNew.append("path").attr("class", "planimeter").attr("stroke-width", factor);
      }
      var text = rulerNew.append("text").attr("dy", -1).attr("font-size", 10 * factor);
    }

    d3.event.on("drag", function() {
      x1 = d3.event.x, y1 = d3.event.y;
      const c2 = diagram.find(x1, y1).index;

      // Heightmap customization
      if (customization === 1) {
        if (c2 === c1 && x1 !== x0 && y1 !== y0) return;
        c1 = c2;
        const brush = $("#brushesButtons > .pressed");
        const id = brush.attr("id");
        const power = +brushPower.value;
        if (id === "brushHill") {add(c2, "hill", power); updateHeightmap();}
        if (id === "brushPit") {addPit(1, power, c2); updateHeightmap();}
        if (id !== "brushRange" || id !== "brushTrough") {
          // move a circle to show approximate change radius
          moveCircle(x1, y1);
          updateCellsInRadius(c2, c0);
        }
      }

      // Countries / cultures manuall assignment
      if (customization === 2 || customization === 4) {
        if ($("div.selected").length === 0) return;
        if (c2 === c1) return;
        c1 = c2;
        let radius = customization === 2 ? +countriesManuallyBrush.value : +culturesManuallyBrush.value;
        const r = rn(6 / graphSize * radius, 1);
        moveCircle(x1, y1, r);
        selection = defineBrushSelection(c2, radius);
        if (selection) {
          if (customization === 2) changeStateForSelection(selection);
          if (customization === 4) changeCultureForSelection(selection);
        }
      }

      if (opisometer || planimeter) {
        const l = points[points.length - 1];
        const diff = Math.hypot(l.scX - x1, l.scY - y1);
        if (diff > 5) {points.push({scX: x1, scY: y1});}
        if (opisometer) {
          lineGen.curve(d3.curveBasis);
          var d = round(lineGen(points));
          curve.attr("d", d);
          curveGray.attr("d", d);
          const dist = rn(curve.node().getTotalLength());
          const label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
          text.attr("x", x1).attr("y", y1 - 10).text(label);
        } else {
          lineGen.curve(d3.curveBasisClosed);
          var d = round(lineGen(points));
          curve.attr("d", d);
        }
      }
    });

    d3.event.on("end", function() {
      if (customization === 1) updateHistory();
      if (opisometer || planimeter) {
        $("#addOpisometer, #addPlanimeter").removeClass("pressed");
        restoreDefaultEvents();
        if (opisometer) {
          const dist = rn(curve.node().getTotalLength());
          var c = curve.node().getPointAtLength(dist / 2);
          const p = curve.node().getPointAtLength((dist / 2) - 1);
          const label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
          const atan = p.x > c.x ? Math.atan2(p.y - c.y, p.x - c.x) : Math.atan2(c.y - p.y, c.x - p.x);
          const angle = rn(atan * 180 / Math.PI, 3);
          const tr = "rotate(" + angle + " " + c.x + " " + c.y + ")";
          text.attr("data-points", JSON.stringify(points)).attr("data-dist", dist).attr("x", c.x).attr("y", c.y).attr("transform", tr).text(label).on("click", removeParent);
          rulerNew.append("circle").attr("cx", points[0].scX).attr("cy", points[0].scY).attr("r", 2 * factor).attr("stroke-width", 0.5 * factor)
            .attr("data-edge", "start").call(d3.drag().on("start", opisometerEdgeDrag));
          rulerNew.append("circle").attr("cx", points[points.length - 1].scX).attr("cy", points[points.length - 1].scY).attr("r", 2 * factor).attr("stroke-width", 0.5 * factor)
            .attr("data-edge", "end").call(d3.drag().on("start", opisometerEdgeDrag));
        } else {
          const vertices = points.map(function (p) {
            return [p.scX, p.scY]
          });
          const area = rn(Math.abs(d3.polygonArea(vertices))); // initial area as positive integer
          let areaConv = area * Math.pow(distanceScale.value, 2); // convert area to distanceScale
          areaConv = si(areaConv);
          if (areaUnit.value === "square") {areaConv += " " + distanceUnit.value + "²"} else {areaConv += " " + areaUnit.value;}
          var c = polylabel([vertices],1.0); // pole of inaccessibility
          text.attr("x", rn(c[0],2)).attr("y", rn(c[1],2)).attr("data-area", area).text(areaConv).on("click", removeParent);
        }
      }
    });
  }

  // restore default drag (map panning) and cursor
  function restoreDefaultEvents() {
    viewbox.style("cursor", "default").on(".drag", null).on("click", null);
  }

  // remove parent element (usually if child is clicked)
  function removeParent() {
    $(this.parentNode).remove();
  }

  // define selection based on radius
  function defineBrushSelection(center, r) {
    let radius = r;
    let selection = [center];
    if (radius > 1) selection = selection.concat(cells[center].neighbors);
    selection = $.grep(selection, function(e) {return cells[e].height >= 20;});
    if (radius === 2) return selection;
    let frontier = cells[center].neighbors;
    while (radius > 2) {
      let cycle = frontier.slice();
      frontier = [];
      cycle.map(function(s) {
        cells[s].neighbors.forEach(function(e) {
          if (selection.indexOf(e) !== -1) return;
          // if (cells[e].height < 20) return;
          selection.push(e);
          frontier.push(e);
        });
      });
      radius--;
    }
    selection = $.grep(selection, function(e) {return cells[e].height >= 20;});
    return selection;
  }

  // change region within selection
  function changeStateForSelection(selection) {
    if (selection.length === 0) return;
    const temp = regions.select("#temp");
    const stateNew = +$("div.selected").attr("id").slice(5);
    const color = states[stateNew].color === "neutral" ? "white" : states[stateNew].color;
    selection.map(function(index) {
      // keep stateOld and stateNew as integers!
      const exists = temp.select("path[data-cell='"+index+"']");
      const region = cells[index].region === "neutral" ? states.length - 1 : cells[index].region;
      const stateOld = exists.size() ? +exists.attr("data-state") : region;
      if (stateNew === stateOld) return;
      if (states[stateOld].capital === cells[index].manor) return; // not allowed to re-draw calitals
      // change of append new element
      if (exists.size()) {
        exists.attr("data-state", stateNew).attr("fill", color).attr("stroke", color);
      } else {
        temp.append("path").attr("data-cell", index).attr("data-state", stateNew)
          .attr("d", "M" + polygons[index].join("L") + "Z")
          .attr("fill", color).attr("stroke", color);
      }
    });
  }

  // change culture within selection
  function changeCultureForSelection(selection) {
    if (selection.length === 0) return;
    const cultureNew = +$("div.selected").attr("id").slice(7);
    const clr = cultures[cultureNew].color;
    selection.map(function(index) {
      const cult = cults.select("#cult"+index);
      const cultureOld = cult.attr("data-culture") !== null
        ? +cult.attr("data-culture")
        : cells[index].culture;
      if (cultureOld === cultureNew) return;
      cult.attr("data-culture", cultureNew).attr("fill", clr).attr("stroke", clr);
    });
  }

  // update cells in radius if non-feature brush selected
  function updateCellsInRadius(cell, source) {
    const power = +brushPower.value;
    let radius = +brushRadius.value;
    const brush = $("#brushesButtons > .pressed").attr("id");
    if ($("#brushesButtons > .pressed").hasClass("feature")) {return;}
    // define selection besed on radius
    let selection = [cell];
    if (radius > 1) selection = selection.concat(cells[cell].neighbors);
    if (radius > 2) {
      let frontier = cells[cell].neighbors;
      while (radius > 2) {
        let cycle = frontier.slice();
        frontier = [];
        cycle.map(function(s) {
          cells[s].neighbors.forEach(function(e) {
            if (selection.indexOf(e) !== -1) {return;}
            selection.push(e);
            frontier.push(e);
          });
        });
        radius--;
      }
    }
    // change each cell in the selection
    const sourceHeight = heights[source];
    selection.map(function(s) {
      // calculate changes
      if (brush === "brushElevate") {
        if (heights[s] < 20) {heights[s] = 20;}
        else {heights[s] += power;}
        if (heights[s] > 100) heights[s] = 100;
      }
      if (brush === "brushDepress") {
        heights[s] -= power;
       if (heights[s] > 100) heights[s] = 0;
      }
      if (brush === "brushAlign") {heights[s] = sourceHeight;}
      if (brush === "brushSmooth") {
        let hs = [heights[s]];
        cells[s].neighbors.forEach(function(e) {hs.push(heights[e]);});
        heights[s] = (heights[s] + d3.mean(hs)) / 2;
      }
    });
    updateHeightmapSelection(selection);
  }

  // Mouseclick events
  function placeLinearFeature() {
    const point = d3.mouse(this);
    const index = getIndex(point);
    let tag = debug.selectAll(".tag");
    if (!tag.size()) {
      tag = debug.append("circle").attr("data-cell", index).attr("class", "tag")
        .attr("r", 3).attr("cx", point[0]).attr("cy", point[1]);
    } else {
      const from = +tag.attr("data-cell");
      debug.selectAll(".tag, .line").remove();
      const power = +brushPower.value;
      const mod = $("#brushesButtons > .pressed").attr("id") === "brushRange" ? 1 : -1;
      const selection = addRange(mod, power, from, index);
      updateHeightmapSelection(selection);
    }
  }

  // turn D3 polygons array into cell array, define neighbors for each cell
  function detectNeighbors(withGrid) {
    console.time("detectNeighbors");
    let gridPath = ""; // store grid as huge single path string
    cells = [];
    polygons.map(function(i, d) {
      const neighbors = [];
      let type; // define cell type
      if (withGrid) {gridPath += "M" + i.join("L") + "Z";} // grid path
      diagram.cells[d].halfedges.forEach(function(e) {
        const edge = diagram.edges[e];
        if (edge.left && edge.right) {
          const ea = edge.left.index === d ? edge.right.index : edge.left.index;
          neighbors.push(ea);
        } else {
          type = "border"; // polygon is on border if it has edge without opposite side polygon
        }
      });
      cells.push({index: d, data: i.data, height: 0, type, neighbors});
    });
    if (withGrid) {grid.append("path").attr("d", round(gridPath, 1));}
    console.timeEnd("detectNeighbors");
  }

  // Generate Heigtmap routine
  function defineHeightmap() {
    console.time('defineHeightmap');
    if (lockTemplateInput.getAttribute("data-locked") == 0) {
      const rnd = Math.random();
      if (rnd > 0.95) {templateInput.value = "Volcano";}
      else if (rnd > 0.75) {templateInput.value = "High Island";}
      else if (rnd > 0.55) {templateInput.value = "Low Island";}
      else if (rnd > 0.35) {templateInput.value = "Continents";}
      else if (rnd > 0.15) {templateInput.value = "Archipelago";}
      else if (rnd > 0.10) {templateInput.value = "Mainland";}
      else if (rnd > 0.01) {templateInput.value = "Peninsulas";}
      else {templateInput.value = "Atoll";}
    }
    const mapTemplate = templateInput.value;
    if (mapTemplate === "Volcano") templateVolcano();
    if (mapTemplate === "High Island") templateHighIsland();
    if (mapTemplate === "Low Island") templateLowIsland();
    if (mapTemplate === "Continents") templateContinents();
    if (mapTemplate === "Archipelago") templateArchipelago();
    if (mapTemplate === "Atoll") templateAtoll();
    if (mapTemplate === "Mainland") templateMainland();
    if (mapTemplate === "Peninsulas") templatePeninsulas();
    console.log(" template: " + mapTemplate);
    console.timeEnd('defineHeightmap');
  }

  // Heighmap Template: Volcano
  function templateVolcano(mod) {
    addMountain();
    modifyHeights("all", 10, 1);
    addHill(5, 0.35);
    addRange(3);
    addRange(-4);
  }

// Heighmap Template: High Island
  function templateHighIsland(mod) {
    addMountain();
    modifyHeights("all", 10, 1);
    addRange(6);
    addHill(12, 0.25);
    addRange(-3);
    modifyHeights("land", 0, 0.75);
    addPit(1);
    addHill(3, 0.15);
  }

// Heighmap Template: Low Island
  function templateLowIsland(mod) {
    addMountain();
    modifyHeights("all", 10, 1);
    smoothHeights(2);
    addRange(2);
    addHill(4, 0.4);
    addHill(12, 0.2);
    addRange(-8);
    modifyHeights("land", 0, 0.35);
  }

  // Heighmap Template: Continents
  function templateContinents(mod) {
    addMountain();
    modifyHeights("all", 10, 1);
    addHill(30, 0.25);
    const count = Math.ceil(Math.random() * 4 + 4);
    addStrait(count);
    addPit(10);
    addRange(-10);
    modifyHeights("land", 0, 0.6);
    smoothHeights(2);
    addRange(3);
  }

  // Heighmap Template: Archipelago
  function templateArchipelago(mod) {
    addMountain();
    modifyHeights("all", 10, 1);
    addHill(12, 0.15);
    addRange(8);
    const count = Math.ceil(Math.random() * 2 + 2);
    addStrait(count);
    addRange(-15);
    addPit(10);
    modifyHeights("land", -5, 0.7);
    smoothHeights(3);
  }

  // Heighmap Template: Atoll
  function templateAtoll(mod) {
    addMountain();
    modifyHeights("all", 10, 1);
    addHill(2, 0.35);
    addRange(2);
    smoothHeights(1);
    modifyHeights("27-100", 0, 0.1);
  }

  // Heighmap Template: Mainland
  function templateMainland(mod) {
    addMountain();
    modifyHeights("all", 10, 1);
    addHill(30, 0.2);
    addRange(10);
    addPit(20);
    addHill(10, 0.15);
    addRange(-10);
    modifyHeights("land", 0, 0.4);
    addRange(10);
    smoothHeights(3);
  }

  // Heighmap Template: Peninsulas
  function templatePeninsulas(mod) {
    addMountain();
    modifyHeights("all", 15, 1);
    addHill(30, 0);
    addRange(5);
    addPit(15);
    const count = Math.ceil(Math.random() * 5 + 15);
    addStrait(count);
  }

  function addMountain() {
    const x = Math.floor(Math.random() * graphWidth / 3 + graphWidth / 3);
    const y = Math.floor(Math.random() * graphHeight * 0.2 + graphHeight * 0.4);
    const cell = diagram.find(x, y).index;
    const height = Math.random() * 10 + 90; // 90-99
    add(cell, "mountain", height);
  }

  // place with shift 0-0.5
  function addHill(count, shift) {
    for (let c = 0; c < count; c++) {
      let limit = 0, cell, height;
      do {
        height = Math.random() * 40 + 10; // 10-50
        const x = Math.floor(Math.random() * graphWidth * (1 - shift * 2) + graphWidth * shift);
        const y = Math.floor(Math.random() * graphHeight * (1 - shift * 2) + graphHeight * shift);
        cell = diagram.find(x, y).index;
        limit++;
      } while (heights[cell] + height > 90 && limit < 100);
      add(cell, "hill", height);
    }
  }

  function add(start, type, height) {
    const session = Math.ceil(Math.random() * 1e5);
    let radius;
    let hRadius;
    let mRadius;
    switch (+graphSize) {
      case 1: hRadius = 0.991; mRadius = 0.91; break;
      case 2: hRadius = 0.9967; mRadius = 0.951; break;
      case 3: hRadius = 0.999; mRadius = 0.975; break;
      case 4: hRadius = 0.9994; mRadius = 0.98; break;
    }
    radius = type === "mountain" ? mRadius : hRadius;
    const queue = [start];
    if (type === "mountain") heights[start] = height;
    for (let i=0; i < queue.length && height >= 1; i++) {
      if (type === "mountain") {height = heights[queue[i]] * radius - height / 100;}
      else {height *= radius;}
      cells[queue[i]].neighbors.forEach(function(e) {
        if (cells[e].used === session) return;
        const mod = Math.random() * 0.2 + 0.9; // 0.9-1.1 random factor
        heights[e] += height * mod;
        if (heights[e] > 100) heights[e] = 100;
        cells[e].used = session;
        queue.push(e);
      });
    }
  }

  function addRange(mod, height, from, to) {
    const session = Math.ceil(Math.random() * 100000);
    const count = Math.abs(mod);
    let range = [];
    for (let c = 0; c < count; c++) {
      range = [];
      let diff = 0, start = from, end = to;
      if (!start || !end) {
        do {
          const xf = Math.floor(Math.random() * (graphWidth * 0.7)) + graphWidth * 0.15;
          const yf = Math.floor(Math.random() * (graphHeight * 0.6)) + graphHeight * 0.2;
          start = diagram.find(xf, yf).index;
          const xt = Math.floor(Math.random() * (graphWidth * 0.7)) + graphWidth * 0.15;
          const yt = Math.floor(Math.random() * (graphHeight * 0.6)) + graphHeight * 0.2;
          end = diagram.find(xt, yt).index;
          diff = Math.hypot(xt - xf, yt - yf);
        } while (diff < 150 / graphSize || diff > 300  / graphSize)
      }
      if (start && end) {
        for (let l = 0; start != end && l < 10000; l++) {
          let min = 10000;
          cells[start].neighbors.forEach(function(e) {
            diff = Math.hypot(cells[end].data[0] - cells[e].data[0],cells[end].data[1] - cells[e].data[1]);
            if (Math.random() > 0.8) diff = diff / 2;
            if (diff < min) {min = diff, start = e;}
          });
          range.push(start);
        }
      }
      const change = height ? height : Math.random() * 10 + 10;
      range.map(function(r) {
        let rnd = Math.random() * 0.4 + 0.8;
        if (mod > 0) heights[r] += change * rnd;
        else if (heights[r] >= 10) {heights[r] -= change * rnd;}
        cells[r].neighbors.forEach(function(e) {
          if (cells[e].used === session) return;
          cells[e].used = session;
          rnd = Math.random() * 0.4 + 0.8;
          const ch = change / 2 * rnd;
          if (mod > 0) {heights[e] += ch;} else if (heights[e] >= 10) {heights[e] -= ch;}
          if (heights[e] > 100) heights[e] = mod > 0 ? 100 : 5;
        });
        if (heights[r] > 100) heights[r] = mod > 0 ? 100 : 5;
      });
    }
    return range;
  }

  function addStrait(width) {
    const session = Math.ceil(Math.random() * 100000);
    const top = Math.floor(Math.random() * graphWidth * 0.35 + graphWidth * 0.3);
    const bottom = Math.floor((graphWidth - top) - (graphWidth * 0.1) + (Math.random() * graphWidth * 0.2));
    let start = diagram.find(top, graphHeight * 0.1).index;
    const end = diagram.find(bottom, graphHeight * 0.9).index;
    let range = [];
    for (let l = 0; start !== end && l < 1000; l++) {
      let min = 10000; // dummy value
      cells[start].neighbors.forEach(function(e) {
        let diff = Math.hypot(cells[end].data[0] - cells[e].data[0], cells[end].data[1] - cells[e].data[1]);
        if (Math.random() > 0.8) {diff = diff / 2}
        if (diff < min) {min = diff; start = e;}
      });
      range.push(start);
    }
    const query = [];
    for (; width > 0; width--) {
      range.map(function(r) {
        cells[r].neighbors.forEach(function(e) {
          if (cells[e].used === session) {return;}
          cells[e].used = session;
          query.push(e);
          heights[e] *= 0.23;
          if (heights[e] > 100 || heights[e] < 5) heights[e] = 5;
        });
        range = query.slice();
      });
    }
  }

  function addPit(count, height, cell) {
    const session = Math.ceil(Math.random() * 1e5);
    for (let c = 0; c < count; c++) {
      let change = height ? height + 10 : Math.random() * 10 + 20;
      let start = cell;
      if (!start) {
        const lowlands = $.grep(cells, function(e) {return (heights[e.index] >= 20);});
        if (!lowlands.length) return;
        const rnd = Math.floor(Math.random() * lowlands.length);
        start = lowlands[rnd].index;
      }
      let query = [start],newQuery= [];
      // depress pit center
      heights[start] -= change;
      if (heights[start] < 5 || heights[start] > 100) heights[start] = 5;
      cells[start].used = session;
      for (let i = 1; i < 10000; i++) {
        const rnd = Math.random() * 0.4 + 0.8;
        change -= i / 0.6 * rnd;
        if (change < 1) break;
        query.map(function(p) {
          cells[p].neighbors.forEach(function(e) {
            if (cells[e].used === session) return;
            cells[e].used = session;
            if (Math.random() > 0.8) return;
            newQuery.push(e);
            heights[e] -= change;
            if (heights[e] < 5 || heights[e] > 100) heights[e] = 5;
          });
        });
        query = newQuery.slice();
        newQuery = [];
      }
    }
  }

  // Modify heights adding or multiplying by value
  function modifyHeights(range, add, mult) {
    function modify(v) {
      if (add) v += add;
      if (mult !== 1) {
        if (mult === "^2") mult = (v - 20) / 100;
        if (mult === "^3") mult = ((v - 20) * (v - 20)) / 100;
        if (range === "land") {v = 20 + (v - 20) * mult;}
        else {v *=  mult;}
      }
      if (v < 0) v = 0;
      if (v > 100) v = 100;
      return v;
    }
    const limMin = range === "land" ? 20 : range === "all" ? 0 : +range.split("-")[0];
    const limMax = range === "land" || range === "all" ? 100 : +range.split("-")[1];

    for (let i=0; i < heights.length; i++) {
      if (heights[i] < limMin || heights[i] > limMax) continue;
      heights[i] = modify(heights[i]);
    }
  }

  // Smooth heights using mean of neighbors
  function smoothHeights(fraction) {
    const fr = fraction || 2;
    for (let i=0; i < heights.length; i++) {
      const nHeights = [heights[i]];
      cells[i].neighbors.forEach(function(e) {nHeights.push(heights[e]);});
      heights[i] = (heights[i] * (fr - 1) + d3.mean(nHeights)) / fr;
    }
  }

  // Randomize heights a bit
  function disruptHeights() {
    for (let i=0; i < heights.length; i++) {
      if (heights[i] < 18) continue;
      if (Math.random() < 0.5) continue;
      heights[i] += 2 - Math.random() * 4;
    }
  }

  // Mark features (ocean, lakes, islands)
  function markFeatures() {
    console.time("markFeatures");
    Math.seedrandom(seed); // reset seed to get the same result on heightmap edit
    for (let i=0, queue=[0]; queue.length > 0; i++) {
      const cell = cells[queue[0]];
      cell.fn = i; // feature number
      const land = heights[queue[0]] >= 20;
      let border = cell.type === "border";
      if (border && land) cell.ctype = 2;

      while (queue.length) {
        const q = queue.pop();
        if (cells[q].type === "border") {
          border = true;
          if (land) cells[q].ctype = 2;
        }

        cells[q].neighbors.forEach(function(e) {
          const eLand = heights[e] >= 20;
          if (land === eLand && cells[e].fn === undefined) {
            cells[e].fn = i;
            queue.push(e);
          }
          if (land && !eLand) {
            cells[q].ctype = 2;
            cells[e].ctype = -1;
            cells[q].harbor = cells[q].harbor ? cells[q].harbor + 1 : 1;
          }
        });
      }
      features.push({i, land, border});

      // find unmarked cell
      for (let c=0; c < cells.length; c++) {
        if (cells[c].fn === undefined) {
          queue[0] = c;
          break;
        }
      }
    }
    console.timeEnd("markFeatures");
  }

  // remove closed lakes near ocean
  function reduceClosedLakes() {
    console.time("reduceClosedLakes");
    const fs = JSON.parse(JSON.stringify(features));
    let lakesInit = lakesNow = features.reduce(function(s, f) {
      return !f.land && !f.border ? s + 1 : s;
    }, 0);

    for (let c=0; c < cells.length && lakesNow > 0; c++) {
      if (heights[c] < 20) continue; // not land
      if (cells[c].ctype !== 2) continue; // not near water
      let ocean = null, lake = null;
      // find land cells with lake and ocean nearby
      cells[c].neighbors.forEach(function(n) {
        if (heights[n] >= 20) return;
        const fn = cells[n].fn;
        if (features[fn].border !== false) ocean = fn;
        if (fs[fn].border === false) lake = fn;
      });
      // if found, make it water and turn lake to ocean
      if (ocean !== null && lake !== null) {
        //debug.append("circle").attr("cx", cells[c].data[0]).attr("cy", cells[c].data[1]).attr("r", 2).attr("fill", "red");
        lakesNow --;
        fs[lake].border = ocean;
        heights[c] = 19;
        cells[c].fn = ocean;
        cells[c].ctype = -1;
        cells[c].neighbors.forEach(function(e) {if (heights[e] >= 20) cells[e].ctype = 2;});
      }
    }

    if (lakesInit === lakesNow) return; // nothing was changed
    for (let i=0; i < cells.length; i++) {
      if (heights[i] >= 20) continue; // not water
      const fn = cells[i].fn;
      if (fs[fn].border !== features[fn].border) {
        cells[i].fn = fs[fn].border;
        //debug.append("circle").attr("cx", cells[i].data[0]).attr("cy", cells[i].data[1]).attr("r", 1).attr("fill", "blue");
      }
    }
    console.timeEnd("reduceClosedLakes");
  }

  function drawOcean() {
    console.time("drawOcean");
    let limits = [];
    let odd = 0.8; // initial odd for ocean layer is 80%
    // Define type of ocean cells based on cell distance form land
    let frontier = $.grep(cells, function(e) {return e.ctype === -1;});
    if (Math.random() < odd) {limits.push(-1); odd = 0.2;}
    for (let c = -2; frontier.length > 0 && c > -10; c--) {
      if (Math.random() < odd) {limits.unshift(c); odd = 0.2;} else {odd += 0.2;}
      frontier.map(function(i) {
        i.neighbors.forEach(function(e) {
          if (!cells[e].ctype) cells[e].ctype = c;
        });
      });
      frontier = $.grep(cells, function(e) {return e.ctype === c;});
    }
    if (outlineLayersInput.value === "none") return;
    if (outlineLayersInput.value !== "random") limits = outlineLayersInput.value.split(",");
    // Define area edges
    const opacity = rn(0.4 / limits.length, 2);
    for (let l=0; l < limits.length; l++) {
      const edges = [];
      const lim = +limits[l];
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].ctype < lim || cells[i].ctype === undefined) continue;
        if (cells[i].ctype > lim && cells[i].type !== "border") continue;
        const cell = diagram.cells[i];
        cell.halfedges.forEach(function(e) {
          const edge = diagram.edges[e];
          const start = edge[0].join(" ");
          const end = edge[1].join(" ");
          if (edge.left && edge.right) {
            const ea = edge.left.index === i ? edge.right.index : edge.left.index;
            if (cells[ea].ctype < lim) edges.push({start, end});
          } else {
            edges.push({start, end});
          }
        });
      }
      lineGen.curve(d3.curveBasis);
      let relax = 0.8 - l / 10;
      if (relax < 0.2) relax = 0.2;
      const line = getContinuousLine(edges, 0, relax);
      oceanLayers.append("path").attr("d", line).attr("fill", "#ecf2f9").style("opacity", opacity);
    }
    console.timeEnd("drawOcean");
  }

  // recalculate Voronoi Graph to pack cells
  function reGraph() {
    console.time("reGraph");
    const tempCells = [],newPoints = []; // to store new data
    // get average precipitation based on graph size
    const avPrec = precInput.value / 5000;
    const smallLakesMax = 500;
    let smallLakes = 0;
    const evaporation = 2;
    cells.map(function(i, d) {
      let height = i.height || heights[d];
      if (height > 100) height = 100;
      const pit = i.pit;
      const ctype = i.ctype;
      if (ctype !== -1 && ctype !== -2 && height < 20) return; // exclude all deep ocean points
      const x = rn(i.data[0],1), y = rn(i.data[1],1);
      const fn = i.fn;
      const harbor = i.harbor;
      let lake = i.lake;
      // mark potential cells for small lakes to add additional point there
      if (smallLakes < smallLakesMax && !lake && pit > evaporation && ctype !== 2) {
        lake = 2;
        smallLakes++;
      }
      const region = i.region; // handle value for edit heightmap mode only
      const culture = i.culture; // handle value for edit heightmap mode only
      let copy = $.grep(newPoints, function(e) {return (e[0] == x && e[1] == y);});
      if (!copy.length) {
        newPoints.push([x, y]);
        tempCells.push({index:tempCells.length, data:[x, y],height, pit, ctype, fn, harbor, lake, region, culture});
      }
      // add additional points for cells along coast
      if (ctype === 2 || ctype === -1) {
        if (i.type === "border") return;
        if (!features[fn].land && !features[fn].border) return;
        i.neighbors.forEach(function(e) {
          if (cells[e].ctype === ctype) {
            let x1 = (x * 2 + cells[e].data[0]) / 3;
            let y1 = (y * 2 + cells[e].data[1]) / 3;
            x1 = rn(x1, 1), y1 = rn(y1, 1);
            copy = $.grep(newPoints, function(e) {return e[0] === x1 && e[1] === y1;});
            if (copy.length) return;
            newPoints.push([x1, y1]);
            tempCells.push({index:tempCells.length, data:[x1, y1],height, pit, ctype, fn, harbor, lake, region, culture});
          }
        });
      }
      if (lake === 2) { // add potential small lakes
        polygons[i.index].forEach(function(e) {
          if (Math.random() > 0.8) return;
          let rnd = Math.random() * 0.6 + 0.8;
          const x1 = rn((e[0] * rnd + i.data[0]) / (1 + rnd), 2);
          rnd = Math.random() * 0.6 + 0.8;
          const y1 = rn((e[1] * rnd + i.data[1]) / (1 + rnd), 2);
          copy = $.grep(newPoints, function(c) {return x1 === c[0] && y1 === c[1];});
          if (copy.length) return;
          newPoints.push([x1, y1]);
          tempCells.push({index:tempCells.length, data:[x1, y1],height, pit, ctype, fn, region, culture});
        });
      }
    });
    console.log( "small lakes candidates: " + smallLakes);
    cells = tempCells; // use tempCells as the only cells array
    calculateVoronoi(newPoints); // recalculate Voronoi diagram using new points
    let gridPath = ""; // store grid as huge single path string
    cells.map(function(i, d) {
      if (i.height >= 20) {
        // calc cell area
        i.area = rn(Math.abs(d3.polygonArea(polygons[d])), 2);
        const prec = rn(avPrec * i.area, 2);
        i.flux = i.lake ? prec * 10 : prec;
      }
      const neighbors = []; // re-detect neighbors
      diagram.cells[d].halfedges.forEach(function(e) {
        const edge = diagram.edges[e];
        if (edge.left === undefined || edge.right === undefined) {
          if (i.height >= 20) i.ctype = 99; // border cell
          return;
        }
        const ea = edge.left.index === d ? edge.right.index : edge.left.index;
        neighbors.push(ea);
        if (d < ea && i.height >= 20 && i.lake !== 1 && cells[ea].height >= 20 && cells[ea].lake !== 1) {
          gridPath += "M" + edge[0][0] + "," + edge[0][1] + "L" + edge[1][0] + "," + edge[1][1];
        }
      });
      i.neighbors = neighbors;
      if (i.region === undefined) delete i.region;
      if (i.culture === undefined) delete i.culture;
    });
    grid.append("path").attr("d", gridPath);
    console.timeEnd("reGraph");
  }

  // redraw all cells for Customization 1 mode
  function mockHeightmap() {
    let landCells = 0;
    $("#landmass").empty();
    const limit = renderOcean.checked ? 1 : 20;
    for (let i=0; i < heights.length; i++) {
      if (heights[i] < limit) continue;
      if (heights[i] > 100) heights[i] = 100;
      const clr = color(1 - heights[i] / 100);
      landmass.append("path").attr("id", "cell"+i)
        .attr("d", "M" + polygons[i].join("L") + "Z")
        .attr("fill", clr).attr("stroke", clr);
    }
  }

  $("#renderOcean").click(mockHeightmap);

  // draw or update all cells
  function updateHeightmap() {
    const limit = renderOcean.checked ? 1 : 20;
    for (let i=0; i < heights.length; i++) {
      if (heights[i] > 100) heights[i] = 100;
      let cell = landmass.select("#cell"+i);
      const clr = color(1 - heights[i] / 100);
      if (cell.size()) {
        if (heights[i] < limit) {cell.remove();}
        else {cell.attr("fill", clr).attr("stroke", clr);}
      } else if (heights[i] >= limit) {
        cell = landmass.append("path").attr("id", "cell"+i)
          .attr("d", "M" + polygons[i].join("L") + "Z")
          .attr("fill", clr).attr("stroke", clr);
      }
    }
  }

  // draw or update cells from the selection
  function updateHeightmapSelection(selection) {
    if (selection === undefined) return;
    const limit = renderOcean.checked ? 1 : 20;
    selection.map(function(s) {
      if (heights[s] > 100) heights[s] = 100;
      let cell = landmass.select("#cell"+s);
      const clr = color(1 - heights[s] / 100);
      if (cell.size()) {
        if (heights[s] < limit) {cell.remove();}
        else {cell.attr("fill", clr).attr("stroke", clr);}
      } else if (heights[s] >= limit) {
        cell = landmass.append("path").attr("id", "cell"+s)
          .attr("d", "M" + polygons[s].join("L") + "Z")
          .attr("fill", clr).attr("stroke", clr);
      }
    });
  }

  function updateHistory() {
    let landCells = 0; // count number of land cells
    if (renderOcean.checked) {
      landCells = heights.reduce(function(s, v) {if (v >= 20) {return s + 1;} else {return s;}}, 0);
    } else {
      landCells = landmass.selectAll("*").size();
    }
    history = history.slice(0, historyStage);
    history[historyStage] = heights.slice();
    historyStage++;
    undo.disabled = templateUndo.disabled = historyStage <= 1;
    redo.disabled = templateRedo.disabled = true;
    const landMean = Math.trunc(d3.mean(heights));
    const landRatio = rn(landCells / heights.length * 100);
    landmassCounter.innerHTML = landCells;
    landmassRatio.innerHTML = landRatio;
    landmassAverage.innerHTML = landMean;
    // if perspective view dialog is opened, update it
    if ($("#perspectivePanel").is(":visible")) drawPerspective();
  }

  // restoreHistory
  function restoreHistory(step) {
    historyStage = step;
    redo.disabled = templateRedo.disabled = historyStage >= history.length;
    undo.disabled = templateUndo.disabled = historyStage <= 1;
    if (history[historyStage - 1] === undefined) return;
    heights = history[historyStage - 1].slice();
    updateHeightmap();
  }

  // restart history from 1st step
  function restartHistory() {
    history = [];
    historyStage = 0;
    redo.disabled = templateRedo.disabled = true;
    undo.disabled = templateUndo.disabled = true;
    updateHistory();
  }

  // Detect and draw the coasline
  function drawCoastline() {
    console.time('drawCoastline');
    Math.seedrandom(seed); // reset seed to get the same result on heightmap edit
    const shape = defs.append("mask").attr("id", "shape").attr("fill", "black").attr("x", 0).attr("y", 0).attr("width", "100%").attr("height", "100%");
    $("#landmass").empty();
    let minX = graphWidth, maxX = 0; // extreme points
    let minXedge, maxXedge; // extreme edges
    const oceanEdges = [],lakeEdges = [];
    for (let i=0; i < land.length; i++) {
      const id = land[i].index, cell = diagram.cells[id];
      const f = land[i].fn;
      land[i].height = Math.trunc(land[i].height);
      if (!oceanEdges[f]) {oceanEdges[f] = []; lakeEdges[f] = [];}
      cell.halfedges.forEach(function(e) {
  			const edge = diagram.edges[e];
  			const start = edge[0].join(" ");
  			const end = edge[1].join(" ");
  			if (edge.left && edge.right) {
  				const ea = edge.left.index === id ? edge.right.index : edge.left.index;
          cells[ea].height = Math.trunc(cells[ea].height);
  				if (cells[ea].height < 20) {
            cells[ea].ctype = -1;
            if (land[i].ctype !== 1) {
              land[i].ctype = 1; // mark coastal land cells
            	// move cell point closer to coast
            	const x = (land[i].data[0] + cells[ea].data[0]) / 2;
            	const y = (land[i].data[1] + cells[ea].data[1]) / 2;
            	land[i].haven = ea; // harbor haven (oposite water cell)
            	land[i].coastX = rn(x + (land[i].data[0] - x) * 0.1, 1);
              land[i].coastY = rn(y + (land[i].data[1] - y) * 0.1, 1);
            	land[i].data[0] = rn(x + (land[i].data[0] - x) * 0.5, 1);
            	land[i].data[1] = rn(y + (land[i].data[1] - y) * 0.5, 1);
            }
  					if (features[cells[ea].fn].border) {
  						oceanEdges[f].push({start, end});
  						// island extreme points
  						if (edge[0][0] < minX) {minX = edge[0][0]; minXedge = edge[0]}
  						if (edge[1][0] < minX) {minX = edge[1][0]; minXedge = edge[1]}
  						if (edge[0][0] > maxX) {maxX = edge[0][0]; maxXedge = edge[0]}
  						if (edge[1][0] > maxX) {maxX = edge[1][0]; maxXedge = edge[1]}
  					} else {
              const l = cells[ea].fn;
              if (!lakeEdges[f][l]) lakeEdges[f][l] = [];
  						lakeEdges[f][l].push({start, end});
  					}
  				}
  			} else {
  				oceanEdges[f].push({start, end});
  			}
  		});
    }

    for (let f = 0; f < features.length; f++) {
    	if (!oceanEdges[f]) continue;
      if (!oceanEdges[f].length && lakeEdges[f].length) {
        const m = lakeEdges[f].indexOf(d3.max(lakeEdges[f]));
        oceanEdges[f] = lakeEdges[f][m];
        lakeEdges[f][m] = [];
      }
      lineGen.curve(d3.curveCatmullRomClosed.alpha(0.1));
    	const oceanCoastline = getContinuousLine(oceanEdges[f],3, 0);
      if (oceanCoastline) {
        shape.append("path").attr("d", oceanCoastline).attr("fill", "white"); // draw the mask
        coastline.append("path").attr("d", oceanCoastline); // draw the coastline
      }
      lineGen.curve(d3.curveBasisClosed);
      lakeEdges[f].forEach(function(l) {
        const lakeCoastline = getContinuousLine(l, 3, 0);
        if (lakeCoastline) {
          shape.append("path").attr("d", lakeCoastline).attr("fill", "black"); // draw the mask
        	lakes.append("path").attr("d", lakeCoastline); // draw the lakes
        }
      });
    }
    landmass.append("rect").attr("x", 0).attr("y", 0).attr("width", graphWidth).attr("height", graphHeight); // draw the landmass
    drawDefaultRuler(minXedge, maxXedge);
    console.timeEnd('drawCoastline');
  }

  // draw default scale bar
  function drawScaleBar() {
    if ($("#scaleBar").hasClass("hidden")) return; // no need to re-draw hidden element
    svg.select("#scaleBar").remove(); // fully redraw every time
    // get size
    const size = +barSize.value;
    const dScale = distanceScale.value;
    const unit = distanceUnit.value;
    const scaleBar = svg.append("g").attr("id", "scaleBar")
      .on("click", editScale)
      .on("mousemove", function () {
        tip("Click to open Scale Editor, drag to move");
      })
      .call(d3.drag().on("start", elementDrag));
    const init = 100; // actual length in pixels if scale, dScale and size = 1;
    let val = init * size * dScale / scale; // bar length in distance unit
    if (val > 900) {val = rn(val, -3);} // round to 1000
    else if (val > 90) {val = rn(val, -2);} // round to 100
    else if (val > 9) {val = rn(val, -1);} // round to 10
    else {val = rn(val)} // round to 1
    const l = val * scale / dScale; // actual length in pixels on this scale
    const x = 0, y = 0; // initial position
    scaleBar.append("line").attr("x1", x+0.5).attr("y1", y).attr("x2", x+l+size-0.5).attr("y2", y).attr("stroke-width", size).attr("stroke", "white");
    scaleBar.append("line").attr("x1", x).attr("y1", y + size).attr("x2", x+l+size).attr("y2", y + size).attr("stroke-width", size).attr("stroke", "#3d3d3d");
    const dash = size + " " + rn(l / 5 - size, 2);
    scaleBar.append("line").attr("x1", x).attr("y1", y).attr("x2", x+l+size).attr("y2", y)
      .attr("stroke-width", rn(size * 3, 2)).attr("stroke-dasharray", dash).attr("stroke", "#3d3d3d");
    // big scale
    for (let b = 0; b < 6; b++) {
      const value = rn(b * l / 5, 2);
      const label = rn(value * dScale / scale);
      if (b === 5) {
        scaleBar.append("text").attr("x", x + value).attr("y", y - 2 * size).attr("font-size", rn(5 * size, 1)).text(label + " " + unit);
      } else {
        scaleBar.append("text").attr("x", x + value).attr("y", y - 2 * size).attr("font-size", rn(5 * size, 1)).text(label);
      }
    }
    if (barLabel.value !== "") {
      scaleBar.append("text").attr("x", x + (l+1) / 2).attr("y", y + 2 * size)
        .attr("dominant-baseline", "text-before-edge")
        .attr("font-size", rn(5 * size, 1)).text(barLabel.value);
    }
    const bbox = scaleBar.node().getBBox();
    // append backbround rectangle
    scaleBar.insert("rect", ":first-child").attr("x", -10).attr("y", -20).attr("width", bbox.width + 10).attr("height", bbox.height + 15)
      .attr("stroke-width", size).attr("stroke", "none").attr("filter", "url(#blur5)")
      .attr("fill", barBackColor.value).attr("opacity", +barBackOpacity.value);
    fitScaleBar();
  }

  // draw default ruler measiring land x-axis edges
  function drawDefaultRuler(minXedge, maxXedge) {
    const rulerNew = ruler.append("g").attr("class", "linear").call(d3.drag().on("start", elementDrag));
    if (!minXedge) minXedge = [0, 0];
    if (!maxXedge) maxXedge = [svgWidth, svgHeight];
    const x1 = rn(minXedge[0],2), y1 = rn(minXedge[1],2), x2 = rn(maxXedge[0],2), y2 = rn(maxXedge[1],2);
    rulerNew.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2).attr("class", "white");
    rulerNew.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2).attr("class", "gray").attr("stroke-dasharray", 10);
    rulerNew.append("circle").attr("r", 2).attr("cx", x1).attr("cy", y1).attr("stroke-width", 0.5).attr("data-edge", "left").call(d3.drag().on("drag", rulerEdgeDrag));
    rulerNew.append("circle").attr("r", 2).attr("cx", x2).attr("cy", y2).attr("stroke-width", 0.5).attr("data-edge", "rigth").call(d3.drag().on("drag", rulerEdgeDrag));
    const x0 = rn((x1 + x2) / 2, 2), y0 = rn((y1 + y2) / 2, 2);
    rulerNew.append("circle").attr("r", 1.2).attr("cx", x0).attr("cy", y0).attr("stroke-width", 0.3).attr("class", "center").call(d3.drag().on("start", rulerCenterDrag));
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    const tr = "rotate(" + angle + " " + x0 + " " + y0 +")";
    const dist = rn(Math.hypot(x1 - x2, y1 - y2));
    const label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
    rulerNew.append("text").attr("x", x0).attr("y", y0).attr("dy", -1).attr("transform", tr).attr("data-dist", dist).text(label).on("click", removeParent).attr("font-size", 10);
  }

  // drag any element changing transform
  function elementDrag() {
    const el = d3.select(this);
    const tr = parseTransform(el.attr("transform"));
    const dx = +tr[0] - d3.event.x, dy = +tr[1] - d3.event.y;

    d3.event.on("drag", function() {
      const x = d3.event.x, y = d3.event.y;
      const transform = `translate(${(dx+x)},${(dy+y)}) rotate(${tr[2]} ${tr[3]} ${tr[4]})`;
      el.attr("transform", transform);
      const pp = this.parentNode.parentNode.id;
      if (pp === "burgIcons" || pp === "burgLabels") {
        tip('Use dragging for fine-tuning only, to move burg to a different cell use "Relocate" button');
      }
      if (pp === "labels") {
        // also transform curve control circle
        debug.select("circle").attr("transform", transform);
      }
    });

    d3.event.on("end", function() {
      // remember scaleBar bottom-right position
      if (el.attr("id") === "scaleBar") {
        const xEnd = d3.event.x, yEnd = d3.event.y;
        const diff = Math.abs(dx - xEnd) + Math.abs(dy - yEnd);
        if (diff > 5) {
          const bbox = el.node().getBoundingClientRect();
          sessionStorage.setItem("scaleBar", [bbox.right, bbox.bottom]);
        }
      }
    });
  }

  // draw ruler circles and update label
  function rulerEdgeDrag() {
    const group = d3.select(this.parentNode);
    const edge = d3.select(this).attr("data-edge");
    const x = d3.event.x, y = d3.event.y;
    let x0, y0;
    d3.select(this).attr("cx", x).attr("cy", y);
    const line = group.selectAll("line");
    if (edge === "left") {
      line.attr("x1", x).attr("y1", y);
      x0 = +line.attr("x2"), y0 = +line.attr("y2");
    } else {
      line.attr("x2", x).attr("y2", y);
      x0 = +line.attr("x1"), y0 = +line.attr("y1");
    }
    const xc = rn((x + x0) / 2, 2), yc = rn((y + y0) / 2, 2);
    group.select(".center").attr("cx", xc).attr("cy", yc);
    const dist = rn(Math.hypot(x0 - x, y0 - y));
    const label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
    const atan = x0 > x ? Math.atan2(y0 - y, x0 - x) : Math.atan2(y - y0, x - x0);
    const angle = rn(atan * 180 / Math.PI, 3);
    const tr = "rotate(" + angle + " " + xc + " " + yc + ")";
    group.select("text").attr("x", xc).attr("y", yc).attr("transform", tr).attr("data-dist", dist).text(label);
  }

  // draw ruler center point to split ruler into 2 parts
  function rulerCenterDrag() {
    let xc1, yc1, xc2, yc2;
    const group = d3.select(this.parentNode); // current ruler group
    let x = d3.event.x, y = d3.event.y; // current coords
    const line = group.selectAll("line"); // current lines
    const x1 = +line.attr("x1"), y1 = +line.attr("y1"), x2 = +line.attr("x2"), y2 = +line.attr("y2"); // initial line edge points
    const rulerNew = ruler.insert("g", ":first-child");
    rulerNew.attr("transform", group.attr("transform")).call(d3.drag().on("start", elementDrag));
    const factor = rn(1 / Math.pow(scale, 0.3), 1);
    rulerNew.append("line").attr("class", "white").attr("stroke-width", factor);
    const dash = +group.select(".gray").attr("stroke-dasharray");
    rulerNew.append("line").attr("class", "gray").attr("stroke-dasharray", dash).attr("stroke-width", factor);
    rulerNew.append("text").attr("dy", -1).on("click", removeParent).attr("font-size", 10 * factor).attr("stroke-width", factor);

    d3.event.on("drag", function() {
      x = d3.event.x, y = d3.event.y;
      d3.select(this).attr("cx", x).attr("cy", y);
      // change first part
      line.attr("x1", x1).attr("y1", y1).attr("x2", x).attr("y2", y);
      let dist = rn(Math.hypot(x1 - x, y1 - y));
      let label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
      let atan = x1 > x ? Math.atan2(y1 - y, x1 - x) : Math.atan2(y - y1, x - x1);
      xc1 = rn((x + x1) / 2, 2), yc1 = rn((y + y1) / 2, 2);
      let tr = "rotate(" + rn(atan * 180 / Math.PI, 3) + " " + xc1 + " " + yc1 + ")";
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
    const el = d3.select(this);
    const x0 = +el.attr("cx"), y0 = +el.attr("cy");
    const group = d3.select(this.parentNode);
    const curve = group.select(".white");
    const curveGray = group.select(".gray");
    const text = group.select("text");
    const points = JSON.parse(text.attr("data-points"));
    if (x0 === points[0].scX && y0 === points[0].scY) {points.reverse();}

    d3.event.on("drag", function() {
      const x = d3.event.x, y = d3.event.y;
      el.attr("cx", x).attr("cy", y);
      const l = points[points.length - 1];
      const diff = Math.hypot(l.scX - x, l.scY - y);
      if (diff > 5) {points.push({scX: x, scY: y});} else {return;}
      lineGen.curve(d3.curveBasis);
      const d = round(lineGen(points));
      curve.attr("d", d);
      curveGray.attr("d", d);
      const dist = rn(curve.node().getTotalLength());
      const label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
      text.attr("x", x).attr("y", y).text(label);
    });

    d3.event.on("end", function() {
      const dist = rn(curve.node().getTotalLength());
      const c = curve.node().getPointAtLength(dist / 2);
      const p = curve.node().getPointAtLength((dist / 2) - 1);
      const label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
      const atan = p.x > c.x ? Math.atan2(p.y - c.y, p.x - c.x) : Math.atan2(c.y - p.y, c.x - p.x);
      const angle = rn(atan * 180 / Math.PI, 3);
      const tr = "rotate(" + angle + " " + c.x + " " + c.y + ")";
      text.attr("data-points", JSON.stringify(points)).attr("data-dist", dist).attr("x", c.x).attr("y", c.y).attr("transform", tr).text(label);
    });
  }

  function getContinuousLine(edges, indention, relax) {
    let line = "";
    if (edges.length < 3) return "";
    while (edges.length > 2) {
      let edgesOrdered = []; // to store points in a correct order
      let start = edges[0].start;
      let end = edges[0].end;
      edges.shift();
      let spl = start.split(" ");
      edgesOrdered.push({scX: +spl[0],scY: +spl[1]});
      spl = end.split(" ");
      edgesOrdered.push({scX: +spl[0],scY: +spl[1]});
      let x0 = +spl[0],y0 = +spl[1];
      for (let i = 0; end !== start && i < 100000; i++) {
        let next = null, index = null;
        for (let e = 0; e < edges.length; e++) {
          const edge = edges[e];
          if (edge.start == end || edge.end == end) {
            next = edge;
            end = next.start == end ? next.end : next.start;
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
          const dist = Math.hypot(+spl[0] - x0, +spl[1] - y0);
          if (dist >= indention && Math.random() > relax) {
            edgesOrdered.push({scX: +spl[0],scY: +spl[1]});
            x0 = +spl[0],y0 = +spl[1];
          }
        } else {
          edgesOrdered.push({scX: +spl[0],scY: +spl[1]});
        }
        edges.splice(index, 1);
        if (i === 100000-1) {
          console.error("Line not ended, limit reached");
          break;
        }
      }
      line += lineGen(edgesOrdered);
    }
    return round(line, 1);
  }

  // temporary elevate lakes to min neighbors heights to correctly flux the water
  function elevateLakes() {
    console.time('elevateLakes');
    const lakes = $.grep(cells, function(e, d) {return heights[d] < 20 && !features[e.fn].border;});
    lakes.sort(function(a, b) {return heights[b.index] - heights[a.index];});
    for (let i=0; i < lakes.length; i++) {
      const hs = [],id = lakes[i].index;
      cells[id].height = heights[id]; // use height on object level
      lakes[i].neighbors.forEach(function(n) {
        const nHeight = cells[n].height || heights[n];
        if (nHeight >= 20) hs.push(nHeight);
      });
      if (hs.length) cells[id].height = d3.min(hs) - 1;
      if (cells[id].height < 20) cells[id].height = 20;
      lakes[i].lake = 1;
    }
    console.timeEnd('elevateLakes');
  }

  // Depression filling algorithm (for a correct water flux modeling; phase1)
  function resolveDepressionsPrimary() {
    console.time('resolveDepressionsPrimary');
    land = $.grep(cells, function(e, d) {
      if (!e.height) e.height = heights[d]; // use height on object level
      return e.height >= 20;
    });
    land.sort(function(a, b) {return b.height - a.height;});
    const limit = 10;
    for (let l = 0, depression = 1; depression > 0 && l < limit; l++) {
      depression = 0;
      for (let i = 0; i < land.length; i++) {
        const id = land[i].index;
        if (land[i].type === "border") continue;
        const hs = land[i].neighbors.map(function(n) {return cells[n].height;});
        const minHigh = d3.min(hs);
        if (cells[id].height <= minHigh) {
          depression++;
          land[i].pit = land[i].pit ? land[i].pit + 1 : 1;
          cells[id].height = minHigh + 2;
        }
      }
      if (l === 0) console.log(" depressions init: " + depression);
    }
    console.timeEnd('resolveDepressionsPrimary');
  }

  // Depression filling algorithm (for a correct water flux modeling; phase2)
  function resolveDepressionsSecondary() {
    console.time('resolveDepressionsSecondary');
    land = $.grep(cells, function(e) {return e.height >= 20;});
    land.sort(function(a, b) {return b.height - a.height;});
    const limit = 100;
    for (let l = 0, depression = 1; depression > 0 && l < limit; l++) {
      depression = 0;
      for (let i = 0; i < land.length; i++) {
        if (land[i].ctype === 99) continue;
        const nHeights = land[i].neighbors.map(function(n) {return cells[n].height});
        const minHigh = d3.min(nHeights);
        if (land[i].height <= minHigh) {
          depression++;
          land[i].pit = land[i].pit ? land[i].pit + 1 : 1;
          land[i].height = Math.trunc(minHigh + 2);
        }
      }
      if (l === 0) console.log(" depressions reGraphed: " + depression);
      if (l === limit - 1) console.error("Error: resolveDepressions iteration limit");
    }
    console.timeEnd('resolveDepressionsSecondary');
  }

  // restore initial heights if user don't want system to change heightmap
  function restoreCustomHeights() {
    land.forEach(function(l) {
      if (!l.pit) return;
      l.height = Math.trunc(l.height - l.pit * 2);
      if (l.height < 20) l.height = 20;
    });
  }

  function flux() {
    console.time('flux');
    riversData = [];
    let riverNext = 0;
    land.sort(function(a, b) {return b.height - a.height;});
    for (let i = 0; i < land.length; i++) {
      const id = land[i].index;
      const sx = land[i].data[0];
      const sy = land[i].data[1];
      let fn = land[i].fn;
      if (land[i].ctype === 99) {
        if (land[i].river !== undefined) {
          let x, y;
          const min = Math.min(sy, graphHeight - sy, sx, graphWidth - sx);
          if (min === sy) {x = sx; y = 0;}
          if (min === graphHeight - sy) {x = sx; y = graphHeight;}
          if (min === sx) {x = 0; y = sy;}
          if (min === graphWidth - sx) {x = graphWidth; y = sy;}
          riversData.push({river: land[i].river, cell: id, x, y});
        }
        continue;
      }
      if (features[fn].river !== undefined) {
        if (land[i].river !== features[fn].river) {
          land[i].river = undefined;
          land[i].flux = 0;
        }
      }
      let minHeight = 1000, min;
      land[i].neighbors.forEach(function(e) {
        if (cells[e].height < minHeight) {
          minHeight = cells[e].height;
          min = e;
        }
      });
      // Define river number
      if (min !== undefined && land[i].flux > 1) {
        if (land[i].river === undefined) {
          // State new River
          land[i].river = riverNext;
          riversData.push({river: riverNext, cell: id, x: sx, y: sy});
          riverNext += 1;
        }
        // Assing existing River to the downhill cell
        if (cells[min].river == undefined) {
          cells[min].river = land[i].river;
        } else {
          const riverTo = cells[min].river;
          const iRiver = $.grep(riversData, function (e) {
            return (e.river == land[i].river);
          });
          const minRiver = $.grep(riversData, function (e) {
            return (e.river == riverTo);
          });
          let iRiverL = iRiver.length;
          let minRiverL = minRiver.length;
          // re-assing river nunber if new part is greater
          if (iRiverL >= minRiverL) {
            cells[min].river = land[i].river;
            iRiverL += 1;
            minRiverL -= 1;
          }
          // mark confluences
          if (cells[min].height >= 20 && iRiverL > 1 && minRiverL > 1) {
            if (!cells[min].confluence) {
              cells[min].confluence = minRiverL-1;
            } else {
              cells[min].confluence += minRiverL-1;
            }
          }
        }
      }
      if (cells[min].flux) cells[min].flux += land[i].flux;
      if (land[i].river !== undefined) {
        const px = cells[min].data[0];
        const py = cells[min].data[1];
        if (cells[min].height < 20) {
          // pour water to the sea
          const x = (px + sx) / 2 + (px - sx) / 10;
          const y = (py + sy) / 2 + (py - sy) / 10;
          riversData.push({river: land[i].river, cell: id, x, y});
        } else {
          if (cells[min].lake === 1) {
            fn = cells[min].fn;
            if (features[fn].river === undefined) features[fn].river = land[i].river;
          }
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
    for (let i = 0; i < riverNext; i++) {
      const dataRiver = $.grep(riversData, function (e) {
        return e.river === i;
      });
      if (dataRiver.length > 1) {
        const riverAmended = amendRiver(dataRiver, 1);
        const width = rn(0.8 + Math.random() * 0.4, 1);
        const increment = rn(0.8 + Math.random() * 0.4, 1);
        const d = drawRiver(riverAmended, width, increment);
        rivers.append("path").attr("d", d).attr("id", "river"+i).attr("data-width", width).attr("data-increment", increment);
      }
    }
    rivers.selectAll("path").on("click", editRiver);
    console.timeEnd('drawRiverLines');
  }

  // add more river points on 1/3 and 2/3 of length
  function amendRiver(dataRiver, rndFactor) {
    const riverAmended = [];
    let side = 1;
    for (let r = 0; r < dataRiver.length; r++) {
      const dX = dataRiver[r].x;
      const dY = dataRiver[r].y;
      const cell = dataRiver[r].cell;
      const c = cells[cell].confluence || 0;
      riverAmended.push([dX, dY, c]);
      if (r+1 < dataRiver.length) {
        const eX = dataRiver[r + 1].x;
        const eY = dataRiver[r + 1].y;
        const angle = Math.atan2(eY - dY, eX - dX);
        const serpentine = 1 / (r + 1);
        const meandr = serpentine + 0.3 + Math.random() * 0.3 * rndFactor;
        if (Math.random() > 0.5) {
          side *= -1
        }
        const dist = Math.hypot(eX - dX, eY - dY);
        // if dist is big or river is small add 2 extra points
        if (dist > 8 || (dist > 4 && dataRiver.length < 6)) {
          let stX = (dX * 2 + eX) / 3;
          let stY = (dY * 2 + eY) / 3;
          let enX = (dX + eX * 2) / 3;
          let enY = (dY + eY * 2) / 3;
          stX += -Math.sin(angle) * meandr * side;
          stY += Math.cos(angle) * meandr * side;
          if (Math.random() > 0.8) {
            side *= -1
          }
          enX += Math.sin(angle) * meandr * side;
          enY += -Math.cos(angle) * meandr * side;
          riverAmended.push([stX, stY],[enX, enY]);
        // if dist is medium or river is small add 1 extra point
        } else if (dist > 4 || dataRiver.length < 6) {
          let scX = (dX + eX) / 2;
          let scY = (dY + eY) / 2;
          scX += -Math.sin(angle) * meandr * side;
          scY += Math.cos(angle) * meandr * side;
          riverAmended.push([scX, scY]);
        }
      }
    }
    return riverAmended;
  }

  // draw river polygon using arrpoximation
  function drawRiver(points, width, increment) {
      lineGen.curve(d3.curveCatmullRom.alpha(0.1));
    let extraOffset = 0.03; // start offset to make river source visible
      width = width || 1; // river width modifier
      increment = increment || 1; // river bed widening modifier
    let riverLength = 0;
    points.map(function(p, i) {
        if (i === 0) {return 0;}
        riverLength += Math.hypot(p[0] - points[i-1][0],p[1] - points[i-1][1]);
      });
    const widening = rn((1000 + (riverLength * 30)) * increment);
    const riverPointsLeft = [], riverPointsRight = [];
    const last = points.length - 1;
    const factor = riverLength / points.length;

    // first point
    let x = points[0][0], y = points[0][1], c;
    let angle = Math.atan2(y - points[1][1], x - points[1][0]);
    let xLeft = x + -Math.sin(angle) * extraOffset, yLeft = y + Math.cos(angle) * extraOffset;
    riverPointsLeft.push({scX:xLeft, scY:yLeft});
    let xRight = x + Math.sin(angle) * extraOffset, yRight = y + -Math.cos(angle) * extraOffset;
    riverPointsRight.unshift({scX:xRight, scY:yRight});

      // middle points
      for (let p = 1; p < last; p ++) {
        x = points[p][0],y = points[p][1],c = points[p][2];
        if (c) {extraOffset += Math.atan(c * 10 / widening);} // confluence
        const xPrev = points[p - 1][0], yPrev = points[p - 1][1];
        const xNext = points[p + 1][0], yNext = points[p + 1][1];
        angle = Math.atan2(yPrev - yNext, xPrev - xNext);
        var offset = (Math.atan(Math.pow(p * factor, 2) / widening) / 2 * width) + extraOffset;
        xLeft = x + -Math.sin(angle) * offset, yLeft = y + Math.cos(angle) * offset;
        riverPointsLeft.push({scX:xLeft, scY:yLeft});
        xRight = x + Math.sin(angle) * offset, yRight = y + -Math.cos(angle) * offset;
        riverPointsRight.unshift({scX:xRight, scY:yRight});
      }

      // end point
      x = points[last][0],y = points[last][1],c = points[last][2];
      if (c) {extraOffset += Math.atan(c * 10 / widening);} // confluence
      angle = Math.atan2(points[last-1][1] - y, points[last-1][0] - x);
      xLeft = x + -Math.sin(angle) * offset, yLeft = y + Math.cos(angle) * offset;
      riverPointsLeft.push({scX:xLeft, scY:yLeft});
      xRight = x + Math.sin(angle) * offset, yRight = y + -Math.cos(angle) * offset;
      riverPointsRight.unshift({scX:xRight, scY:yRight});

      // generate path and return
    const right = lineGen(riverPointsRight);
    let left = lineGen(riverPointsLeft);
    left = left.substring(left.indexOf("C"));
      return round(right + left, 2);
  }

  // draw river polygon with best quality
  function drawRiverSlow(points, width, increment) {
      lineGen.curve(d3.curveCatmullRom.alpha(0.1));
      width = width || 1;
    const extraOffset = 0.02 * width;
    increment = increment || 1;
    const riverPoints = points.map(function (p) {
      return {scX: p[0], scY: p[1]};
    });
    const river = defs.append("path").attr("d", lineGen(riverPoints));
    const riverLength = river.node().getTotalLength();
    const widening = rn((1000 + (riverLength * 30)) * increment);
    const riverPointsLeft = [], riverPointsRight = [];

    for (let l = 0; l < riverLength; l++) {
        var point = river.node().getPointAtLength(l);
        var from = river.node().getPointAtLength(l - 0.1);
        const to = river.node().getPointAtLength(l + 0.1);
        var angle = Math.atan2(from.y - to.y, from.x - to.x);
        var offset = (Math.atan(Math.pow(l, 2) / widening) / 2 * width) + extraOffset;
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
      var offset = (Math.atan(Math.pow(riverLength, 2) / widening) / 2 * width) + extraOffset;
      var xLeft = point.x + -Math.sin(angle) * offset;
      var yLeft = point.y + Math.cos(angle) * offset;
      riverPointsLeft.push({scX:xLeft, scY:yLeft});
      var xRight = point.x + Math.sin(angle) * offset;
      var yRight = point.y + -Math.cos(angle) * offset;
      riverPointsRight.unshift({scX:xRight, scY:yRight});

      river.remove();
      // generate path and return
    const right = lineGen(riverPointsRight);
    let left = lineGen(riverPointsLeft);
    left = left.substring(left.indexOf("C"));
      return round(right + left, 2);
  }

  // add lakes on depressed points on river course
  function addLakes() {
    console.time('addLakes');
    let smallLakes = 0;
    for (let i=0; i < land.length; i++) {
      // elavate all big lakes
      if (land[i].lake === 1) {
        land[i].height = 19;
        land[i].ctype = -1;
      }
      // define eligible small lakes
      if (land[i].lake === 2 && smallLakes < 100) {
        if (land[i].river !== undefined) {
          land[i].height = 19;
          land[i].ctype = -1;
          land[i].fn = -1;
          smallLakes++;
        } else {
          land[i].lake = undefined;
          land[i].neighbors.forEach(function(n) {
            if (cells[n].lake !== 1 && cells[n].river !== undefined) {
              cells[n].lake = 2;
              cells[n].height = 19;
              cells[n].ctype = -1;
              cells[n].fn = -1;
              smallLakes++;
            } else if (cells[n].lake === 2) {
              cells[n].lake = undefined;
            }
          });
        }
      }
    }
    console.log( "small lakes: " + smallLakes);

    // mark small lakes
    let unmarked = $.grep(land, function(e) {return e.fn === -1});
    while (unmarked.length) {
      let fn = -1, queue = [unmarked[0].index],lakeCells = [];
      unmarked[0].session = "addLakes";
      while (queue.length) {
        const q = queue.pop();
        lakeCells.push(q);
        if (cells[q].fn !== -1) fn = cells[q].fn;
        cells[q].neighbors.forEach(function(e) {
          if (cells[e].lake && cells[e].session !== "addLakes") {
            cells[e].session = "addLakes";
            queue.push(e);
          }
        });
      }
      if (fn === -1) {
        fn = features.length;
        features.push({i: fn, land: false, border: false});
      }
      lakeCells.forEach(function(c) {cells[c].fn = fn;});
      unmarked = $.grep(land, function(e) {return e.fn === -1});
    }

    land = $.grep(cells, function(e) {return e.height >= 20;});
    console.timeEnd('addLakes');
  }

  function editLabel() {
    if (customization) return;

    unselect();
    closeDialogs("#labelEditor, .stable");
    elSelected = d3.select(this).call(d3.drag().on("start", elementDrag)).classed("draggable", true);

    // update group parameters
    let group = d3.select(this.parentNode);
    updateGroupOptions();
    labelGroupSelect.value = group.attr("id");
    labelFontSelect.value = fonts.indexOf(group.attr("data-font"));
    labelSize.value = group.attr("data-size");
    labelColor.value = toHEX(group.attr("fill"));
    labelOpacity.value = group.attr("opacity");
    labelText.value = elSelected.text();
    const tr = parseTransform(elSelected.attr("transform"));
    labelAngle.value = tr[2];
    labelAngleValue.innerHTML = Math.abs(+tr[2]) + "°";

    $("#labelEditor").dialog({
      title: "Edit Label: " + labelText.value,
      minHeight: 30, width: "auto", maxWidth: 275, resizable: false,
      position: {my: "center top+10", at: "bottom", of: this},
      close: unselect
    });

    if (modules.editLabel) return;
    modules.editLabel = true;

    loadDefaultFonts();

    function updateGroupOptions() {
      labelGroupSelect.innerHTML = "";
      labels.selectAll("g:not(#burgLabels)").each(function(d) {
        if (this.parentNode.id === "burgLabels") return;
        let id = d3.select(this).attr("id");
        let opt = document.createElement("option");
        opt.value = opt.innerHTML = id;
        labelGroupSelect.add(opt);
      });
    }

    $("#labelGroupButton").click(function() {
      $("#labelEditor > button").not(this).toggle();
      $("#labelGroupButtons").toggle();
    });

    // on group change
    document.getElementById("labelGroupSelect").addEventListener("change", function() {
      document.getElementById(this.value).appendChild(elSelected.remove().node());
    });

    // toggle inputs to declare a new group
    document.getElementById("labelGroupNew").addEventListener("click", function() {
      if ($("#labelGroupInput").css("display") === "none") {
        $("#labelGroupInput").css("display", "inline-block");
        $("#labelGroupSelect").css("display", "none");
        labelGroupInput.focus();
      } else {
        $("#labelGroupSelect").css("display", "inline-block");
        $("#labelGroupInput").css("display", "none");
      }
    });

    // toggle inputs to select a group
    document.getElementById("labelExternalFont").addEventListener("click", function() {
      if ($("#labelFontInput").css("display") === "none") {
        $("#labelFontInput").css("display", "inline-block");
        $("#labelFontSelect").css("display", "none");
        labelFontInput.focus();
      } else {
        $("#labelFontSelect").css("display", "inline-block");
        $("#labelFontInput").css("display", "none");
      }
    });

    // on new group creation
    document.getElementById("labelGroupInput").addEventListener("change", function() {
      if (!this.value) {
        tip("Please provide a valid group name");
        return;
      }
      let group = this.value.toLowerCase().replace(/ /g, "_").replace(/[^\w\s]/gi, "");
      if (Number.isFinite(+group.charAt(0))) group = "g" + group;
      // if el with this id exists, add size to id
      while (labels.selectAll("#"+group).size()) {group += "_new";}
      createNewLabelGroup(group);
    });

    function createNewLabelGroup(g) {
      let group = elSelected.node().parentNode.cloneNode(false);
      let groupNew = labels.append(f => group).attr("id", g);
      groupNew.append(f => elSelected.remove().node());
      updateGroupOptions();
      $("#labelGroupSelect, #labelGroupInput").toggle();
      labelGroupInput.value = "";
      labelGroupSelect.value = g;
      updateLabelGroups();
    }

    // remove label group on click
    document.getElementById("labelGroupRemove").addEventListener("click", function() {
      let group = d3.select(elSelected.node().parentNode);
      let id = group.attr("id");
      let count = group.selectAll("text").size();
      // remove group with < 2 label without ask
      if (count < 2) {
        removeAllLabelsInGroup(id);
        $("#labelEditor").dialog("close");
        return;
      }
      alertMessage.innerHTML = "Are you sure you want to remove all labels (" + count + ") of that group?";
      $("#alert").dialog({resizable: false, title: "Remove label group",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            removeAllLabelsInGroup(id);
            $("#labelEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });
    });

    $("#labelTextButton").click(function() {
      $("#labelEditor > button").not(this).toggle();
      $("#labelTextButtons").toggle();
    });

    // on label text change
    document.getElementById("labelText").addEventListener("input", function() {
      if (!this.value) {
        tip("Name should not be blank, set opacity to 0 to hide label or click remove button to delete");
        return;
      }
      // change Label text
      if (elSelected.select("textPath").size()) elSelected.select("textPath").text(this.value);
      else elSelected.text(this.value);
      $("div[aria-describedby='labelEditor'] .ui-dialog-title").text("Edit Label: " + this.value);
      // check if label is a country name
      let id = elSelected.attr("id") || "";
      if (id.includes("regionLabel")) {
        let state = +elSelected.attr("id").slice(11);
        states[state].name = this.value;
      }
    });

    // generate a random country name
    document.getElementById("labelTextRandom").addEventListener("click", function() {
      let name = elSelected.text();
      let id = elSelected.attr("id") || "";
      if (id.includes("regionLabel")) {
        // label is a country name
        let state = +elSelected.attr("id").slice(11);
        name = generateStateName(state.i);
        states[state].name = name;
      } else {
        // label is not a country name, use random culture
        let c = elSelected.node().getBBox();
        let closest = cultureTree.find((c.x + c.width / 2), (c.y + c.height / 2));
        let culture = Math.floor(Math.random() * cultures.length);
        name = generateName(culture);
      }
      labelText.value = name;
      $("div[aria-describedby='labelEditor'] .ui-dialog-title").text("Edit Label: " + name);
      // change Label text
      if (elSelected.select("textPath").size()) elSelected.select("textPath").text(name);
      else elSelected.text(name);
    });

    $("#labelFontButton").click(function() {
      $("#labelEditor > button").not(this).toggle();
      $("#labelFontButtons").toggle();
    });

    // on label font change
    document.getElementById("labelFontSelect").addEventListener("change", function() {
      let group = elSelected.node().parentNode;
      let font = fonts[this.value].split(':')[0].replace(/\+/g, " ");
      group.setAttribute("font-family", font);
      group.setAttribute("data-font", fonts[this.value]);
    });

    // on adding custom font
    document.getElementById("labelFontInput").addEventListener("change", function() {
      fetchFonts(this.value).then(fetched => {
        if (!fetched) return;
        labelExternalFont.click();
        labelFontInput.value = "";
        if (fetched === 1) $("#labelFontSelect").val(fonts.length - 1).change();
      });
    });

    // on label size input
    document.getElementById("labelSize").addEventListener("input", function() {
      let group = elSelected.node().parentNode;
      let size = +this.value;
      group.setAttribute("data-size", size);
      group.setAttribute("font-size", rn((size + (size / scale)) / 2, 2))
    });

    $("#labelStyleButton").click(function() {
      $("#labelEditor > button").not(this).toggle();
      $("#labelStyleButtons").toggle();
    });

    // on label fill color input
    document.getElementById("labelColor").addEventListener("input", function() {
      let group = elSelected.node().parentNode;
      group.setAttribute("fill", this.value);
    });

    // on label opacity input
    document.getElementById("labelOpacity").addEventListener("input", function() {
      let group = elSelected.node().parentNode;
      group.setAttribute("opacity", this.value);
    });

    $("#labelAngleButton").click(function() {
      $("#labelEditor > button").not(this).toggle();
      $("#labelAngleButtons").toggle();
    });

    // on label angle input
    document.getElementById("labelAngle").addEventListener("input", function() {
      const tr = parseTransform(elSelected.attr("transform"));
      labelAngleValue.innerHTML = Math.abs(+this.value) + "°";
      const c = elSelected.node().getBBox();
      const angle = +this.value;
      const transform = `translate(${tr[0]},${tr[1]}) rotate(${angle} ${(c.x+c.width/2)} ${(c.y+c.height/2)})`;
      elSelected.attr("transform", transform);
    });

    // display control points to curve label (place on path)
    document.getElementById("labelCurve").addEventListener("click", function() {
      let c = elSelected.node().getBBox();
      let cx = c.x + c.width / 2, cy = c.y + c.height / 2;

      if (!elSelected.select("textPath").size()) {
        let id = elSelected.attr("id");
        let pathId = "#textPath_" + id;
        let path = `M${cx-c.width},${cy} q${c.width},0 ${c.width * 2},0`;
        let text = elSelected.text(), x = elSelected.attr("x"), y = elSelected.attr("y");
        elSelected.text(null).attr("data-x", x).attr("data-y", y).attr("x", null).attr("y", null);
        defs.append("path").attr("id", "textPath_" + id).attr("d", path);
        elSelected.append("textPath").attr("href", pathId).attr("startOffset", "50%").text(text);
      }

      if (!debug.select("circle").size()) {
        debug.append("circle").attr("id", "textPathControl").attr("r", 1.6)
          .attr("cx", cx).attr("cy", cy).attr("transform", elSelected.attr("transform") || null)
          .call(d3.drag().on("start", textPathControlDrag));
      }
    });

    // drag textPath controle point to curve the label
    function textPathControlDrag() {
      let textPath = defs.select("#textPath_" + elSelected.attr("id"));
      let path = textPath.attr("d").split(" ");
      let M = path[0].split(",");
      let q = path[1].split(","); // +q[1] to get qy - the only changeble value
      let y = d3.event.y;

      d3.event.on("drag", function() {
        let dy = d3.event.y - y;
        let total = +q[1] + dy * 8;
        d3.select(this).attr("cy", d3.event.y);
        textPath.attr("d", `${M[0]},${+M[1] - dy} ${q[0]},${total} ${path[2]}`);
      });
    }

    // cancel label curvature
    document.getElementById("labelCurveCancel").addEventListener("click", function() {
      if (!elSelected.select("textPath").size()) return;
      let text = elSelected.text(), x = elSelected.attr("data-x"), y = elSelected.attr("data-y");
      elSelected.text();
      elSelected.attr("x", x).attr("y", y).attr("data-x", null).attr("data-y", null).text(text);
      defs.select("#textPath_" + elSelected.attr("id")).remove();
      debug.select("circle").remove();
    });

    // open legendsEditor
    document.getElementById("labelLegend").addEventListener("click", function() {
      let id = elSelected.attr("id");
      let name = elSelected.text();
      editLegends(id, name);
    });

    // copy label on click
    document.getElementById("labelCopy").addEventListener("click", function() {
      let group = d3.select(elSelected.node().parentNode);
      copy = group.append(f => elSelected.node().cloneNode(true));
      let id = "label" + Date.now().toString().slice(7);
      copy.attr("id", id).attr("class", null).on("click", editLabel);
      let shift = +group.attr("font-size") + 1;
      if (copy.select("textPath").size()) {
        let path = defs.select("#textPath_" + elSelected.attr("id")).attr("d");
        let textPath = defs.append("path").attr("id", "textPath_" + id);
        copy.select("textPath").attr("href", "#textPath_" + id);
        let pathArray = path.split(" ");
        let x = +pathArray[0].split(",")[0].slice(1);
        let y = +pathArray[0].split(",")[1];
        textPath.attr("d", `M${x-shift},${y-shift} ${pathArray[1]} ${pathArray[2]}`);shift
      } else {
        let x = +elSelected.attr("x") - shift;
        let y = +elSelected.attr("y") - shift;
        while (group.selectAll("text[x='" + x + "']").size()) {x -= shift; y -= shift;}
        copy.attr("x", x).attr("y", y);
      }
    });

    // remove label on click
    document.getElementById("labelRemoveSingle").addEventListener("click", function() {
      alertMessage.innerHTML = "Are you sure you want to remove the label?";
      $("#alert").dialog({resizable: false, title: "Remove label",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            elSelected.remove();
            defs.select("#textPath_" + elSelected.attr("id")).remove();
            $("#labelEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });
    });
  }

  function editRiver() {
    if (customization) return;
    if (elSelected) {
      const self = d3.select(this).attr("id") === elSelected.attr("id");
      const point = d3.mouse(this);
      if (elSelected.attr("data-river") === "new") {
        addRiverPoint([point[0],point[1]]);
        completeNewRiver();
        return;
      } else if (self) {
        riverAddControlPoint(point);
        return;
      }
    }

    unselect();
    closeDialogs("#riverEditor, .stable");
    elSelected = d3.select(this);
    elSelected.call(d3.drag().on("start", riverDrag));

    const tr = parseTransform(elSelected.attr("transform"));
    riverAngle.value = tr[2];
    riverAngleValue.innerHTML = Math.abs(+tr[2]) + "°";
    riverScale.value = tr[5];
    riverWidthInput.value = +elSelected.attr("data-width");
    riverIncrement.value = +elSelected.attr("data-increment");

    $("#riverEditor").dialog({
      title: "Edit River",
      minHeight: 30, width: "auto", resizable: false,
      position: {my: "center top+20", at: "top", of: d3.event},
      close: function() {
        if ($("#riverNew").hasClass('pressed')) completeNewRiver();
        unselect();
      }
    });

    if (!debug.select(".controlPoints").size()) debug.append("g").attr("class", "controlPoints");
    riverDrawPoints();

    if (modules.editRiver) {return;}
    modules.editRiver = true;

    function riverAddControlPoint(point) {
      let dists = [];
      debug.select(".controlPoints").selectAll("circle").each(function() {
        const x = +d3.select(this).attr("cx");
        const y = +d3.select(this).attr("cy");
        dists.push(Math.hypot(point[0] - x, point[1] - y));
      });
      let index = dists.length;
      if (dists.length > 1) {
        const sorted = dists.slice(0).sort(function(a, b) {return a-b;});
        const closest = dists.indexOf(sorted[0]);
        const next = dists.indexOf(sorted[1]);
        if (closest <= next) {index = closest+1;} else {index = next+1;}
      }
      const before = ":nth-child(" + (index + 1) + ")";
      debug.select(".controlPoints").insert("circle", before)
        .attr("cx", point[0]).attr("cy", point[1]).attr("r", 0.35)
        .call(d3.drag().on("drag", riverPointDrag))
        .on("click", function(d) {
          $(this).remove();
          redrawRiver();
        });
      redrawRiver();
    }

    function riverDrawPoints() {
      const node = elSelected.node();
      // river is a polygon, so divide length by 2 to get course length
      const l = node.getTotalLength() / 2;
      const parts = (l / 5) >> 0; // number of points
      let inc = l / parts; // increment
      if (inc === Infinity) {inc = l;} // 2 control points for short rivers
      // draw control points
      for (let i = l, c = l; i > 0; i -= inc, c += inc) {
        const p1 = node.getPointAtLength(i);
        const p2 = node.getPointAtLength(c);
        const p = [(p1.x + p2.x) / 2, (p1.y + p2.y) / 2];
        addRiverPoint(p);
      }
      // last point should be accurate
      const lp1 = node.getPointAtLength(0);
      const lp2 = node.getPointAtLength(l * 2);
      const p = [(lp1.x + lp2.x) / 2, (lp1.y + lp2.y) / 2];
      addRiverPoint(p);
    }

    function addRiverPoint(point) {
      debug.select(".controlPoints").append("circle")
        .attr("cx", point[0]).attr("cy", point[1]).attr("r", 0.35)
        .call(d3.drag().on("drag", riverPointDrag))
        .on("click", function(d) {
          $(this).remove();
          redrawRiver();
        });
    }

    function riverPointDrag() {
      d3.select(this).attr("cx", d3.event.x).attr("cy", d3.event.y);
      redrawRiver();
    }

    function riverDrag() {
      const x = d3.event.x, y = d3.event.y;
      const tr = parseTransform(elSelected.attr("transform"));
      d3.event.on("drag", function() {
        let xc = d3.event.x, yc = d3.event.y;
        let transform = `translate(${(+tr[0]+xc-x)},${(+tr[1]+yc-y)}) rotate(${tr[2]} ${tr[3]} ${tr[4]}) scale(${tr[5]})`;
        elSelected.attr("transform", transform);
        debug.select(".controlPoints").attr("transform", transform);
      });
    }

    function redrawRiver() {
      let points = [];
      debug.select(".controlPoints").selectAll("circle").each(function() {
        const el = d3.select(this);
        points.push([+el.attr("cx"), +el.attr("cy")]);
      });
      const width = +riverWidthInput.value;
      const increment = +riverIncrement.value;
      const d = drawRiverSlow(points, width, increment);
      elSelected.attr("d", d);
    }

    $("#riverWidthInput, #riverIncrement").change(function() {
      const width = +riverWidthInput.value;
      const increment = +riverIncrement.value;
      elSelected.attr("data-width", width).attr("data-increment", increment);
      redrawRiver();
    });

    $("#riverRegenerate").click(function() {
      let points = [],amended = [],x, y, p1, p2;
      const node = elSelected.node();
      const l = node.getTotalLength() / 2;
      const parts = (l / 8) >> 0; // number of points
      let inc = l / parts; // increment
      if (inc === Infinity) {inc = l;} // 2 control points for short rivers
      for (let i = l, e = l; i > 0; i -= inc, e += inc) {
        p1 = node.getPointAtLength(i);
        p2 = node.getPointAtLength(e);
        x = (p1.x + p2.x) / 2, y = (p1.y + p2.y) / 2;
        points.push([x, y]);
      }
      // last point should be accurate
      p1 = node.getPointAtLength(0);
      p2 = node.getPointAtLength(l * 2);
      x = (p1.x + p2.x) / 2, y = (p1.y + p2.y) / 2;
      points.push([x, y]);
      // amend points
      const rndFactor = 0.3 + Math.random() * 1.4; // random factor in range 0.2-1.8
      for (let i = 0; i < points.length; i++) {
        x = points[i][0],y = points[i][1];
        amended.push([x, y]);
        // add additional semi-random point
        if (i + 1 < points.length) {
          const x2 = points[i+1][0],y2 = points[i+1][1];
          let side = Math.random() > 0.5 ? 1 : -1;
          const angle = Math.atan2(y2 - y, x2 - x);
          const serpentine = 2 / (i+1);
          const meandr = serpentine + 0.3 + Math.random() * rndFactor;
          x = (x + x2) / 2, y = (y + y2) / 2;
          x += -Math.sin(angle) * meandr * side;
          y += Math.cos(angle) * meandr * side;
          amended.push([x, y]);
        }
      }
      const width = +riverWidthInput.value * 0.6 + Math.random();
      const increment = +riverIncrement.value * 0.9 + Math.random() * 0.2;
      riverWidthInput.value = width;
      riverIncrement.value = increment;
      elSelected.attr("data-width", width).attr("data-increment", increment);
      const d = drawRiverSlow(amended, width, increment);
      elSelected.attr("d", d).attr("data-width", width).attr("data-increment", increment);
      debug.select(".controlPoints").selectAll("*").remove();
      amended.map(function(p) {addRiverPoint(p);});
    });

    $("#riverAngle").on("input", function() {
      const tr = parseTransform(elSelected.attr("transform"));
      riverAngleValue.innerHTML = Math.abs(+this.value) + "°";
      const c = elSelected.node().getBBox();
      const angle = +this.value, scale = +tr[5];
      const transform = `translate(${tr[0]},${tr[1]}) rotate(${angle} ${(c.x+c.width/2)*scale} ${(c.y+c.height/2)*scale}) scale(${scale})`;
      elSelected.attr("transform", transform);
      debug.select(".controlPoints").attr("transform", transform);
    });

    $("#riverReset").click(function() {
      elSelected.attr("transform", "");
      debug.select(".controlPoints").attr("transform", "");
      riverAngle.value = 0;
      riverAngleValue.innerHTML = "0°";
      riverScale.value = 1;
    });

    $("#riverScale").change(function() {
      const tr = parseTransform(elSelected.attr("transform"));
      const scaleOld = +tr[5],scale = +this.value;
      const c = elSelected.node().getBBox();
      const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
      const trX = +tr[0] + cx * (scaleOld - scale);
      const trY = +tr[1] + cy * (scaleOld - scale);
      const scX = +tr[3] * scale/scaleOld;
      const scY = +tr[4] * scale/scaleOld;
      const transform = `translate(${trX},${trY}) rotate(${tr[2]} ${scX} ${scY}) scale(${scale})`;
      elSelected.attr("transform", transform);
      debug.select(".controlPoints").attr("transform", transform);
    });

    $("#riverNew").click(function() {
      if ($(this).hasClass('pressed')) {
        completeNewRiver();
      } else {
        // enter creation mode
        $(".pressed").removeClass('pressed');
        $(this).addClass('pressed');
        if (elSelected) elSelected.call(d3.drag().on("drag", null));
        debug.select(".controlPoints").selectAll("*").remove();
        viewbox.style("cursor", "crosshair").on("click", newRiverAddPoint);
      }
    });

    function newRiverAddPoint() {
      const point = d3.mouse(this);
      addRiverPoint([point[0],point[1]]);
      if (!elSelected || elSelected.attr("data-river") !== "new") {
        const id = +$("#rivers > path").last().attr("id").slice(5) + 1;
        elSelected = rivers.append("path").attr("data-river", "new").attr("id", "river"+id)
          .attr("data-width", 2).attr("data-increment", 1).on("click", completeNewRiver);
      } else {
        redrawRiver();
        let cell = diagram.find(point[0],point[1]).index;
        let f = cells[cell].fn;
        let ocean = !features[f].land && features[f].border;
        if (ocean && debug.select(".controlPoints").selectAll("circle").size() > 5) completeNewRiver();
      }
    }

    function completeNewRiver() {
      $("#riverNew").removeClass('pressed');
      restoreDefaultEvents();
      if (!elSelected || elSelected.attr("data-river") !== "new") return;
      redrawRiver();
      elSelected.attr("data-river", "");
      elSelected.call(d3.drag().on("start", riverDrag)).on("click", editRiver);
      const r = +elSelected.attr("id").slice(5);
      debug.select(".controlPoints").selectAll("circle").each(function() {
        const x = +d3.select(this).attr("cx");
        const y = +d3.select(this).attr("cy");
        const cell = diagram.find(x, y, 3);
        if (!cell) return;
        if (cells[cell.index].river === undefined) cells[cell.index].river = r;
      });
      unselect();
      debug.append("g").attr("class", "controlPoints");
    }

    $("#riverCopy").click(function() {
      const tr = parseTransform(elSelected.attr("transform"));
      const d = elSelected.attr("d");
      let x = 2, y = 2;
      let transform = `translate(${tr[0]-x},${tr[1]-y}) rotate(${tr[2]} ${tr[3]} ${tr[4]}) scale(${tr[5]})`;
      while (rivers.selectAll("[transform='" + transform + "'][d='" + d + "']").size() > 0) {
        x += 2; y += 2;
        transform = `translate(${tr[0]-x},${tr[1]-y}) rotate(${tr[2]} ${tr[3]} ${tr[4]}) scale(${tr[5]})`;
      }
      const river = +$("#rivers > path").last().attr("id").slice(5) + 1;
      rivers.append("path").attr("d", d)
        .attr("transform", transform)
        .attr("id", "river"+river).on("click", editRiver)
        .attr("data-width", elSelected.attr("data-width"))
        .attr("data-increment", elSelected.attr("data-increment"));
      unselect();
    });

    // open legendsEditor
    document.getElementById("riverLegend").addEventListener("click", function() {
      let id = elSelected.attr("id");
      editLegends(id, id);
    });

    $("#riverRemove").click(function() {
      alertMessage.innerHTML = `Are you sure you want to remove the river?`;
      $("#alert").dialog({resizable: false, title: "Remove river",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            const river = +elSelected.attr("id").slice(5);
            const avPrec = rn(precInput.value / Math.sqrt(cells.length), 2);
            land.map(function(l) {
              if (l.river === river) {
                l.river = undefined;
                l.flux = avPrec;
              }
            });
            elSelected.remove();
            unselect();
            $("#riverEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      })
    });

  }

  function editRoute() {
    if (customization) {return;}
    if (elSelected) {
      const self = d3.select(this).attr("id") === elSelected.attr("id");
      const point = d3.mouse(this);
      if (elSelected.attr("data-route") === "new") {
        addRoutePoint({x:point[0],y:point[1]});
        completeNewRoute();
        return;
      } else if (self) {
        routeAddControlPoint(point);
        return;
      }
    }

    unselect();
    closeDialogs("#routeEditor, .stable");

    if (this !== window) {
      elSelected = d3.select(this);
      if (!debug.select(".controlPoints").size()) debug.append("g").attr("class", "controlPoints");
      routeDrawPoints();
      routeUpdateGroups();
      let routeType = d3.select(this.parentNode).attr("id");
      routeType.value = routeType;

      $("#routeEditor").dialog({
        title: "Edit Route",
        minHeight: 30, width: "auto", resizable: false,
        position: {my: "center top+20", at: "top", of: d3.event},
        close: function() {
          if ($("#addRoute").hasClass('pressed')) completeNewRoute();
          if ($("#routeSplit").hasClass('pressed')) $("#routeSplit").removeClass('pressed');
          unselect();
        }
      });
    }

    if (modules.editRoute) {return;}
    modules.editRoute = true;

    function routeAddControlPoint(point) {
      let dists = [];
      debug.select(".controlPoints").selectAll("circle").each(function() {
        const x = +d3.select(this).attr("cx");
        const y = +d3.select(this).attr("cy");
        dists.push(Math.hypot(point[0] - x, point[1] - y));
      });
      let index = dists.length;
      if (dists.length > 1) {
        const sorted = dists.slice(0).sort(function(a, b) {return a-b;});
        const closest = dists.indexOf(sorted[0]);
        const next = dists.indexOf(sorted[1]);
        if (closest <= next) {index = closest+1;} else {index = next+1;}
      }
      const before = ":nth-child(" + (index + 1) + ")";
      debug.select(".controlPoints").insert("circle", before)
        .attr("cx", point[0]).attr("cy", point[1]).attr("r", 0.35)
        .call(d3.drag().on("drag", routePointDrag))
        .on("click", function(d) {
          $(this).remove();
          routeRedraw();
        });
      routeRedraw();
    }

    function routeDrawPoints() {
      const node = elSelected.node();
      const l = node.getTotalLength();
      const parts = (l / 5) >> 0; // number of points
      let inc = l / parts; // increment
      if (inc === Infinity) {inc = l;} // 2 control points for short routes
      // draw control points
      for (let i = 0; i <= l; i += inc) {
        const p = node.getPointAtLength(i);
        addRoutePoint(p);
      }
      // convert length to distance
      routeLength.innerHTML = rn(l * distanceScale.value) + " " + distanceUnit.value;
    }

    function addRoutePoint(point) {
      const controlPoints = debug.select(".controlPoints").size()
        ? debug.select(".controlPoints")
        : debug.append("g").attr("class", "controlPoints");
      controlPoints.append("circle")
        .attr("cx", point.x).attr("cy", point.y).attr("r", 0.35)
        .call(d3.drag().on("drag", routePointDrag))
        .on("click", function(d) {
          if ($("#routeSplit").hasClass('pressed')) {
            routeSplitInPoint(this);
          } else {
            $(this).remove();
            routeRedraw();
          }
        });
    }

    function routePointDrag() {
      d3.select(this).attr("cx", d3.event.x).attr("cy", d3.event.y);
      routeRedraw();
    }

    function routeRedraw() {
      let points = [];
      debug.select(".controlPoints").selectAll("circle").each(function() {
        const el = d3.select(this);
        points.push({scX: +el.attr("cx"), scY: +el.attr("cy")});
      });
      lineGen.curve(d3.curveCatmullRom.alpha(0.1));
      elSelected.attr("d", lineGen(points));
      // get route distance
      const l = elSelected.node().getTotalLength();
      routeLength.innerHTML = rn(l * distanceScale.value) + " " + distanceUnit.value;
    }

    function newRouteAddPoint() {
      const point = d3.mouse(this);
      const x = rn(point[0],2), y = rn(point[1],2);
      let routeType = routeGroup.value;
      if (!elSelected) {
        const index = getIndex(point);
        const height = cells[index].height;
        if (height < 20) routeType = "searoutes";
        if (routeType === "searoutes" && height >= 20) routeType = "roads";
      }
      const group = routes.select("#"+routeType);
      addRoutePoint({x, y});
      if (!elSelected || elSelected.attr("data-route") !== "new") {
        const id = routeType + "" + group.selectAll("*").size();
        elSelected = group.append("path").attr("data-route", "new").attr("id", id).on("click", editRoute);
        routeUpdateGroups();
        routeType.value = routeType;
        $("#routeEditor").dialog({
          title: "Edit Route",
          minHeight: 30, width: "auto", resizable: false,
          position: {my: "center top+20", at: "top", of: d3.event},
          close: function() {
            if ($("#addRoute").hasClass('pressed')) completeNewRoute();
            if ($("#routeSplit").hasClass('pressed')) $("#routeSplit").removeClass('pressed');
            unselect();
          }
        });
      } else {
        routeRedraw();
      }
    }

    function completeNewRoute() {
      $("#routeNew, #addRoute").removeClass('pressed');
      restoreDefaultEvents();
      if (!elSelected) return;
      if (elSelected.attr("data-route") === "new") {
        routeRedraw();
        elSelected.attr("data-route", "");
        const node = elSelected.node();
        const l = node.getTotalLength();
        let pathCells = [];
        for (let i = 0; i <= l; i ++) {
          const p = node.getPointAtLength(i);
          const cell = diagram.find(p.x, p.y);
          if (!cell) {return;}
          pathCells.push(cell.index);
        }
        const uniqueCells = [...new Set(pathCells)];
        uniqueCells.map(function(c) {
          if (cells[c].path !== undefined) {cells[c].path += 1;}
          else {cells[c].path = 1;}
        });
      }
      tip("", true);
    }

    function routeUpdateGroups() {
      const group = d3.select(elSelected.node().parentNode);
      const type = group.attr("data-type");
      routeGroup.innerHTML = "";
      routes.selectAll("g").each(function(d) {
        const el = d3.select(this);
        if (el.attr("data-type") !== type) {return;}
        const opt = document.createElement("option");
        opt.value = opt.innerHTML = el.attr("id");
        routeGroup.add(opt);
      });
    }

    function routeSplitInPoint(clicked) {
      const group = d3.select(elSelected.node().parentNode);
      $("#routeSplit").removeClass('pressed');
      const points1 = [],points2 = [];
      let points = points1;
      debug.select(".controlPoints").selectAll("circle").each(function() {
        const el = d3.select(this);
        points.push({scX: +el.attr("cx"), scY: +el.attr("cy")});
        if (this === clicked) {
          points = points2;
          points.push({scX: +el.attr("cx"), scY: +el.attr("cy")});
        }
        el.remove();
      });
      lineGen.curve(d3.curveCatmullRom.alpha(0.1));
      elSelected.attr("d", lineGen(points1));
      const id = routeGroup.value + "" + group.selectAll("*").size();
      group.append("path").attr("id", id).attr("d", lineGen(points2)).on("click", editRoute);
      routeDrawPoints();
    }

    $("#routeGroup").change(function() {
      $(elSelected.node()).detach().appendTo($("#"+this.value));
    });

    // open legendsEditor
    document.getElementById("routeLegend").addEventListener("click", function() {
      let id = elSelected.attr("id");
      editLegends(id, id);
    });

    $("#routeNew").click(function() {
      if ($(this).hasClass('pressed')) {
        completeNewRoute();
      } else {
        // enter creation mode
        $(".pressed").removeClass('pressed');
        $("#routeNew, #addRoute").addClass('pressed');
        debug.select(".controlPoints").selectAll("*").remove();
        viewbox.style("cursor", "crosshair").on("click", newRouteAddPoint);
        tip("Click on map to add route point", true);
      }
    });

    $("#routeRemove").click(function() {
      alertMessage.innerHTML = `Are you sure you want to remove the route?`;
      $("#alert").dialog({resizable: false, title: "Remove route",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            elSelected.remove();
            $("#routeEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      })
    });
  }

  function editIcon() {
    if (customization) return;
    if (elSelected) if (this.isSameNode(elSelected.node())) return;

    unselect();
    closeDialogs("#iconEditor, .stable");
    elSelected = d3.select(this).call(d3.drag().on("start", elementDrag)).classed("draggable", true);

    // update group parameters
    const group = d3.select(this.parentNode);
    iconUpdateGroups();
    iconGroup.value = group.attr("id");
    iconFillColor.value = group.attr("fill");
    iconStrokeColor.value = group.attr("stroke");
    iconSize.value = group.attr("size");
    iconStrokeWidth.value = group.attr("stroke-width");

    $("#iconEditor").dialog({
      title: "Edit icon: " + group.attr("id"),
      minHeight: 30, width: "auto", resizable: false,
      position: {my: "center top+20", at: "top", of: d3.event},
      close: unselect
    });

    if (modules.editIcon) {return;}
    modules.editIcon = true;

    $("#iconGroups").click(function() {
      $("#iconEditor > button").not(this).toggle();
      $("#iconGroupsSelection").toggle();
    });

    function iconUpdateGroups() {
      iconGroup.innerHTML = "";
      const anchor = group.attr("id").includes("anchor");
      icons.selectAll("g").each(function(d) {
        const id = d3.select(this).attr("id");
        if (id === "burgs") return;
        if (!anchor && id.includes("anchor")) return;
        if (anchor && !id.includes("anchor")) return;
        const opt = document.createElement("option");
        opt.value = opt.innerHTML = id;
        iconGroup.add(opt);
      });
    }

    $("#iconGroup").change(function() {
      const newGroup = this.value;
      const to = $("#icons > #"+newGroup);
      $(elSelected.node()).detach().appendTo(to);
    });

    $("#iconCopy").click(function() {
      const group = d3.select(elSelected.node().parentNode);
      const copy = elSelected.node().cloneNode();
      copy.removeAttribute("data-id"); // remove assignment to burg if any
      const tr = parseTransform(copy.getAttribute("transform"));
      const shift = 10 / Math.sqrt(scale);
      let transform = "translate(" + rn(tr[0] - shift, 1)  + "," + rn(tr[1] - shift, 1)  + ")";
      for (let i=2; group.selectAll("[transform='" + transform + "']").size() > 0; i++) {
        transform = "translate(" + rn(tr[0] - shift * i, 1)  + "," + rn(tr[1] - shift * i, 1)  + ")";
      }
      copy.setAttribute("transform", transform);
      group.node().insertBefore(copy, null);
      copy.addEventListener("click", editIcon);
    });

    $("#iconRemoveGroup").click(function() {
      const group = d3.select(elSelected.node().parentNode);
      const count = group.selectAll("*").size();
      if (count < 2) {
        group.remove();
        $("#labelEditor").dialog("close");
        return;
      }
      const message = "Are you sure you want to remove all '" + iconGroup.value + "' icons (" + count + ")?";
      alertMessage.innerHTML = message;
      $("#alert").dialog({resizable: false, title: "Remove icon group",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            group.remove();
            $("#iconEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });
    });

    $("#iconColors").click(function() {
      $("#iconEditor > button").not(this).toggle();
      $("#iconColorsSection").toggle();
    });

    $("#iconFillColor").change(function() {
      const group = d3.select(elSelected.node().parentNode);
      group.attr("fill", this.value);
    });

    $("#iconStrokeColor").change(function() {
      const group = d3.select(elSelected.node().parentNode);
      group.attr("stroke", this.value);
    });

    $("#iconSetSize").click(function() {
      $("#iconEditor > button").not(this).toggle();
      $("#iconSizeSection").toggle();
    });

    $("#iconSize").change(function() {
      const group = d3.select(elSelected.node().parentNode);
      const size = +this.value;
      group.attr("size", size);
      group.selectAll("*").each(function() {d3.select(this).attr("width", size).attr("height", size)});
    });

    $("#iconStrokeWidth").change(function() {
      const group = d3.select(elSelected.node().parentNode);
      group.attr("stroke-width", this.value);
    });

    $("#iconRemove").click(function() {
      alertMessage.innerHTML = `Are you sure you want to remove the icon?`;
      $("#alert").dialog({resizable: false, title: "Remove icon",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            elSelected.remove();
            $("#iconEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      })
    });
  }

  function editReliefIcon() {
    if (customization) return;
    if (elSelected) if (this.isSameNode(elSelected.node())) return;

    unselect();
    closeDialogs("#reliefEditor, .stable");
    elSelected = d3.select(this).raise().call(d3.drag().on("start", elementDrag)).classed("draggable", true);
    const group = elSelected.node().parentNode.id;
    reliefGroup.value = group;

    $("#reliefEditor").dialog({
      title: "Edit relief icon",
      minHeight: 30, width: "auto", resizable: false,
      position: {my: "center top+40", at: "top", of: d3.event},
      close: unselect
    });

    if (modules.editReliefIcon) {return;}
    modules.editReliefIcon = true;

    $("#reliefGroups").click(function() {
      $("#reliefEditor > button").not(this).toggle();
      $("#reliefGroupsSelection").toggle();
    });

    $("#reliefGroup").change(function() {
      const type = this.value;
      const bbox = elSelected.node().getBBox();
      const cx = bbox.x;
      const cy = bbox.y + bbox.height / 2;
      const cell = diagram.find(cx, cy).index;
      const height = cell !== undefined ? cells[cell].height : 50;
      elSelected.remove();
      elSelected = addReliefIcon(height / 100, type, cx, cy);
      elSelected.call(d3.drag().on("start", elementDrag));
    });

    $("#reliefCopy").click(function() {
      const group = d3.select(elSelected.node().parentNode);
      const copy = elSelected.node().cloneNode(true);
      const tr = parseTransform(copy.getAttribute("transform"));
      const shift = 10 / Math.sqrt(scale);
      let transform = "translate(" + rn(tr[0] - shift, 1)  + "," + rn(tr[1] - shift, 1)  + ")";
      for (let i=2; group.selectAll("[transform='" + transform + "']").size() > 0; i++) {
        transform = "translate(" + rn(tr[0] - shift * i, 1)  + "," + rn(tr[1] - shift * i, 1)  + ")";
      }
      copy.setAttribute("transform", transform);
      group.node().insertBefore(copy, null);
      copy.addEventListener("click", editReliefIcon);
    });

    $("#reliefAddfromEditor").click(function() {
      clickToAdd(); // to load on click event function
      $("#addRelief").click();
    });

    $("#reliefRemoveGroup").click(function() {
      const group = d3.select(elSelected.node().parentNode);
      const count = group.selectAll("*").size();
      if (count < 2) {
        group.selectAll("*").remove();
        $("#labelEditor").dialog("close");
        return;
      }
      const message = "Are you sure you want to remove all '" + reliefGroup.value + "' icons (" + count + ")?";
      alertMessage.innerHTML = message;
      $("#alert").dialog({resizable: false, title: "Remove all icons within group",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            group.selectAll("*").remove();
            $("#reliefEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });
    });

    $("#reliefRemove").click(function() {
      alertMessage.innerHTML = `Are you sure you want to remove the icon?`;
      $("#alert").dialog({resizable: false, title: "Remove relief icon",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            elSelected.remove();
            $("#reliefEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      })
    });
  }

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

  function editMarker() {
    if (customization) return;

    unselect();
    closeDialogs("#markerEditor, .stable");
    elSelected = d3.select(this).call(d3.drag().on("start", elementDrag)).classed("draggable", true);

    $("#markerEditor").dialog({
      title: "Edit Marker",
      minHeight: 30, width: "auto", maxWidth: 275, resizable: false,
      position: {my: "center top+30", at: "bottom", of: d3.event},
      close: unselect
    });

    // update inputs
    let id = elSelected.attr("href");
    let symbol = d3.select("#defs-markers").select(id);
    let icon = symbol.select("text");
    markerSelectGroup.value = id.slice(1);
    markerIconSize.value = parseFloat(icon.attr("font-size"));
    markerIconShiftX.value = parseFloat(icon.attr("x"));
    markerIconShiftY.value = parseFloat(icon.attr("y"));
    markerIconFill.value = icon.attr("fill");
    markerIconStrokeWidth.value = icon.attr("stroke-width");
    markerIconStroke.value = icon.attr("stroke");
    markerSize.value = elSelected.attr("data-size");
    markerBase.value = symbol.select("path").attr("fill");
    markerFill.value = symbol.select("circle").attr("fill");

    let table = document.getElementById("markerIconTable");
    let selected = table.getElementsByClassName("selected");
    if (selected.length) selected[0].removeAttribute("class");
    selected = document.querySelectorAll("#markerIcon" + icon.text().codePointAt());
    if (selected.length) selected[0].className = "selected";
    markerIconCustom.value = selected.length ? "" : icon.text();

    if (modules.editMarker) return;
    modules.editMarker = true;

    $("#markerGroup").click(function() {
      $("#markerEditor > button").not(this).toggle();
      $("#markerGroupSection").toggle();
      updateMarkerGroupOptions();
    });

    function updateMarkerGroupOptions() {
      markerSelectGroup.innerHTML = "";
      d3.select("#defs-markers").selectAll("symbol").each(function() {
        let opt = document.createElement("option");
        opt.value = opt.innerHTML = this.id;
        markerSelectGroup.add(opt);
      });
      let id = elSelected.attr("href").slice(1);
      markerSelectGroup.value = id;
    }

    // on add marker type click
    document.getElementById("markerAddGroup").addEventListener("click", function() {
      if ($("#markerInputGroup").css("display") === "none") {
        $("#markerInputGroup").css("display", "inline-block");
        $("#markerSelectGroup").css("display", "none");
        markerInputGroup.focus();
      } else {
        $("#markerSelectGroup").css("display", "inline-block");
        $("#markerInputGroup").css("display", "none");
      }
    });

    // on marker type change
    document.getElementById("markerSelectGroup").addEventListener("change", function() {
      elSelected.attr("href", "#"+this.value);
      elSelected.attr("data-id", "#"+this.value);
    });

    // on new type input
    document.getElementById("markerInputGroup").addEventListener("change", function() {
      let newGroup = this.value.toLowerCase().replace(/ /g, "_").replace(/[^\w\s]/gi, "");
      if (Number.isFinite(+newGroup.charAt(0))) newGroup = "m" + newGroup;
      if (d3.select("#defs-markers").select("#"+newGroup).size()) {
        tip('The type "'+ newGroup + '" is already exists');
        return;
      }
      markerInputGroup.value = "";
      // clone old group assigning new id
      let id = elSelected.attr("href");
      let l = d3.select("#defs-markers").select(id).node().cloneNode(true);
      l.id = newGroup;
      elSelected.attr("href", "#"+newGroup);
      elSelected.attr("data-id", "#"+newGroup);
      document.getElementById("defs-markers").insertBefore(l, null);

      // select new group
      let opt = document.createElement("option");
      opt.value = opt.innerHTML = newGroup;
      markerSelectGroup.add(opt);
      $("#markerSelectGroup").val(newGroup).change();
      $("#markerSelectGroup, #markerInputGroup").toggle();
      updateMarkerGroupOptions();
    });

    $("#markerIconButton").click(function() {
      $("#markerEditor > button").not(this).toggle();
      $("#markerIconButtons").toggle();
      if (!$("#markerIconTable").text()) drawIconsList(icons);
    });

    $("#markerRemoveGroup").click(function() {
      let id = elSelected.attr("href");
      let used = document.querySelectorAll("use[data-id='"+id+"']");
      let count = used.length === 1 ? "1 element" : used.length + " elements";
      const message = "Are you sure you want to remove the marker (" + count + ")?";
      alertMessage.innerHTML = message;
      $("#alert").dialog({resizable: false, title: "Remove marker",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            if (id !== "#marker0") d3.select("#defs-markers").select(id).remove();
            used.forEach(function(e) {e.remove();});
            updateMarkerGroupOptions();
            $("#markerEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });
    });

    function drawIconsList() {
      let icons = [
        // emoticons in FF:
        ["2693", "⚓", "Anchor"],
        ["26EA", "⛪", "Church"],
        ["1F3EF", "🏯", "Japanese Castle"],
        ["1F3F0", "🏰", "Castle"],
        ["1F5FC", "🗼", "Tower"],
        ["1F3E0", "🏠", "House"],
        ["1F3AA", "🎪", "Tent"],
        ["1F3E8", "🏨", "Hotel"],
        ["1F4B0", "💰", "Money bag"],
        ["1F4A8", "💨", "Dashing away"],
        ["1F334", "🌴", "Palm"],
        ["1F335", "🌵", "Cactus"],
        ["1F33E", "🌾", "Sheaf"],
        ["1F5FB", "🗻", "Mountain"],
        ["1F30B", "🌋", "Volcano"],
        ["1F40E", "🐎", "Horse"],
        ["1F434", "🐴", "Horse Face"],
        ["1F42E", "🐮", "Cow"],
        ["1F43A", "🐺", "Wolf Face"],
        ["1F435", "🐵", "Monkey face"],
        ["1F437", "🐷", "Pig face"],
        ["1F414", "🐔", "Chiken"],
        ["1F411", "🐑", "Eve"],
        ["1F42B", "🐫", "Camel"],
        ["1F418", "🐘", "Elephant"],
        ["1F422", "🐢", "Turtle"],
        ["1F40C", "🐌", "Snail"],
        ["1F40D", "🐍", "Snake"],
        ["1F433", "🐳", "Whale"],
        ["1F42C", "🐬", "Dolphin"],
        ["1F420", "🐟", "Fish"],
        ["1F432", "🐲", "Dragon Head"],
        ["1F479", "👹", "Ogre"],
        ["1F47B", "👻", "Ghost"],
        ["1F47E", "👾", "Alien"],
        ["1F480", "💀", "Skull"],
        ["1F374", "🍴", "Fork and knife"],
        ["1F372", "🍲", "Food"],
        ["1F35E", "🍞", "Bread"],
        ["1F357", "🍗", "Poultry leg"],
        ["1F347", "🍇", "Grapes"],
        ["1F34F", "🍏", "Apple"],
        ["1F352", "🍒", "Cherries"],
        ["1F36F", "🍯", "Honey pot"],
        ["1F37A", "🍺", "Beer"],
        ["1F377", "🍷", "Wine glass"],
        ["1F3BB", "🎻", "Violin"],
        ["1F3B8", "🎸", "Guitar"],
        ["26A1", "⚡", "Electricity"],
        ["1F320", "🌠", "Shooting star"],
        ["1F319", "🌙", "Crescent moon"],
        ["1F525", "🔥", "Fire"],
        ["1F4A7", "💧", "Droplet"],
        ["1F30A", "🌊", "Wave"],
        ["231B", "⌛", "Hourglass"],
        ["1F3C6", "🏆", "Goblet"],
        ["26F2", "⛲", "Fountain"],
        ["26F5", "⛵", "Sailboat"],
        ["26FA", "⛺", "Tend"],
        ["1F489", "💉", "Syringe"],
        ["1F4D6", "📚", "Books"],
        ["1F3AF", "🎯", "Archery"],
        ["1F52E", "🔮", "Magic ball"],
        ["1F3AD", "🎭", "Performing arts"],
        ["1F3A8", "🎨", "Artist palette"],
        ["1F457", "👗", "Dress"],
        ["1F451", "👑", "Crown"],
        ["1F48D", "💍", "Ring"],
        ["1F48E", "💎", "Gem"],
        ["1F514", "🔔", "Bell"],
        ["1F3B2", "🎲", "Die"],
        // black and white icons in FF:
        ["26A0", "⚠", "Alert"],
        ["2317", "⌗", "Hash"],
        ["2318", "⌘", "POI"],
        ["2307", "⌇", "Wavy"],
        ["21E6", "⇦", "Left arrow"],
        ["21E7", "⇧", "Top arrow"],
        ["21E8", "⇨", "Right arrow"],
        ["21E9", "⇩", "Left arrow"],
        ["21F6", "⇶", "Three arrows"],
        ["2699", "⚙", "Gear"],
        ["269B", "⚛", "Atom"],
        ["0024", "$", "Dollar"],
        ["2680", "⚀", "Die1"],
        ["2681", "⚁", "Die2"],
        ["2682", "⚂", "Die3"],
        ["2683", "⚃", "Die4"],
        ["2684", "⚄", "Die5"],
        ["2685", "⚅", "Die6"],
        ["26B4", "⚴", "Pallas"],
        ["26B5", "⚵", "Juno"],
        ["26B6", "⚶", "Vesta"],
        ["26B7", "⚷", "Chiron"],
        ["26B8", "⚸", "Lilith"],
        ["263F", "☿", "Mercury"],
        ["2640", "♀", "Venus"],
        ["2641", "♁", "Earth"],
        ["2642", "♂", "Mars"],
        ["2643", "♃", "Jupiter"],
        ["2644", "♄", "Saturn"],
        ["2645", "♅", "Uranus"],
        ["2646", "♆", "Neptune"],
        ["2647", "♇", "Pluto"],
        ["26B3", "⚳", "Ceres"],
        ["2654", "♔", "Chess king"],
        ["2655", "♕", "Chess queen"],
        ["2656", "♖", "Chess rook"],
        ["2657", "♗", "Chess bishop"],
        ["2658", "♘", "Chess knight"],
        ["2659", "♙", "Chess pawn"],
        ["2660", "♠", "Spade"],
        ["2663", "♣", "Club"],
        ["2665", "♥", "Heart"],
        ["2666", "♦", "Diamond"],
        ["2698", "⚘", "Flower"],
        ["2625", "☥", "Ankh"],
        ["2626", "☦", "Orthodox"],
        ["2627", "☧", "Chi Rho"],
        ["2628", "☨", "Lorraine"],
        ["2629", "☩", "Jerusalem"],
        ["2670", "♰", "Syriac cross"],
        ["2020", "†", "Dagger"],
        ["262A", "☪", "Muslim"],
        ["262D", "☭", "Soviet"],
        ["262E", "☮", "Peace"],
        ["262F", "☯", "Yin yang"],
        ["26A4", "⚤", "Heterosexuality"],
        ["26A2", "⚢", "Female homosexuality"],
        ["26A3", "⚣", "Male homosexuality"],
        ["26A5", "⚥", "Male and female"],
        ["26AD", "⚭", "Rings"],
        ["2690", "⚐", "White flag"],
        ["2691", "⚑", "Black flag"],
        ["263C", "☼", "Sun"],
        ["263E", "☾", "Moon"],
        ["2668", "♨", "Hot springs"],
        ["2600", "☀", "Black sun"],
        ["2601", "☁", "Cloud"],
        ["2602", "☂", "Umbrella"],
        ["2603", "☃", "Snowman"],
        ["2604", "☄", "Comet"],
        ["2605", "★", "Black star"],
        ["2606", "☆", "White star"],
        ["269D", "⚝", "Outlined star"],
        ["2618", "☘", "Shamrock"],
        ["21AF", "↯", "Lightning"],
        ["269C", "⚜", "FleurDeLis"],
        ["2622", "☢", "Radiation"],
        ["2623", "☣", "Biohazard"],
        ["2620", "☠", "Skull"],
        ["2638", "☸", "Dharma"],
        ["2624", "☤", "Caduceus"],
        ["2695", "⚕", "Aeculapius staff"],
        ["269A", "⚚", "Hermes staff"],
        ["2697", "⚗", "Alembic"],
        ["266B", "♫", "Music"],
        ["2702", "✂", "Scissors"],
        ["2696", "⚖", "Scales"],
        ["2692", "⚒", "Hammer and pick"],
        ["2694", "⚔", "Swords"]
      ];

      let table = document.getElementById("markerIconTable"), row = "";
      table.addEventListener("click", clickMarkerIconTable, false);
      table.addEventListener("mouseover", hoverMarkerIconTable, false);

      for (let i=0; i < icons.length; i++) {
        if (i%20 === 0) row = table.insertRow(0);
        let cell = row.insertCell(0);
        let icon = String.fromCodePoint(parseInt(icons[i][0],16));
        cell.innerHTML = icon;
        cell.id = "markerIcon" + icon.codePointAt();
        cell.setAttribute("data-desc", icons[i][2]);
      }
    }

    function clickMarkerIconTable(e) {
      if (e.target !== e.currentTarget) {
        let table = document.getElementById("markerIconTable");
        let selected = table.getElementsByClassName("selected");
        if (selected.length) selected[0].removeAttribute("class");
        e.target.className = "selected";
        let id = elSelected.attr("href");
        let icon = e.target.innerHTML;
        d3.select("#defs-markers").select(id).select("text").text(icon);
      }
      e.stopPropagation();
    }

    function hoverMarkerIconTable(e) {
      if (e.target !== e.currentTarget) {
        let desc = e.target.getAttribute("data-desc");
        tip(e.target.innerHTML + " " + desc);
      }
      e.stopPropagation();
    }

    // change marker icon size
    document.getElementById("markerIconSize").addEventListener("input", function() {
      let id = elSelected.attr("href");
      d3.select("#defs-markers").select(id).select("text").attr("font-size", this.value + "px");
    });

    // change marker icon x shift
    document.getElementById("markerIconShiftX").addEventListener("input", function() {
      let id = elSelected.attr("href");
      d3.select("#defs-markers").select(id).select("text").attr("x", this.value + "%");
    });

    // change marker icon y shift
    document.getElementById("markerIconShiftY").addEventListener("input", function() {
      let id = elSelected.attr("href");
      d3.select("#defs-markers").select(id).select("text").attr("y", this.value + "%");
    });

    // apply custom unicode icon on input
    document.getElementById("markerIconCustom").addEventListener("input", function() {
      if (!this.value) return;
      let id = elSelected.attr("href");
      d3.select("#defs-markers").select(id).select("text").text(this.value);
    });

    $("#markerStyleButton").click(function() {
      $("#markerEditor > button").not(this).toggle();
      $("#markerStyleButtons").toggle();
    });

    // change marker size
    document.getElementById("markerSize").addEventListener("input", function() {
      let id = elSelected.attr("data-id");
      let used = document.querySelectorAll("use[data-id='"+id+"']");
      let size = this.value;
      used.forEach(function(e) {e.setAttribute("data-size", size);});
      invokeActiveZooming();
    });

    // change marker base color
    document.getElementById("markerBase").addEventListener("input", function() {
      let id = elSelected.attr("href");
      d3.select(id).select("path").attr("fill", this.value);
      d3.select(id).select("circle").attr("stroke", this.value);
    });

    // change marker fill color
    document.getElementById("markerFill").addEventListener("input", function() {
      let id = elSelected.attr("href");
      d3.select(id).select("circle").attr("fill", this.value);
    });

    // change marker icon y shift
    document.getElementById("markerIconFill").addEventListener("input", function() {
      let id = elSelected.attr("href");
      d3.select("#defs-markers").select(id).select("text").attr("fill", this.value);
    });

    // change marker icon y shift
    document.getElementById("markerIconStrokeWidth").addEventListener("input", function() {
      let id = elSelected.attr("href");
      d3.select("#defs-markers").select(id).select("text").attr("stroke-width", this.value);
    });

    // change marker icon y shift
    document.getElementById("markerIconStroke").addEventListener("input", function() {
      let id = elSelected.attr("href");
      d3.select("#defs-markers").select(id).select("text").attr("stroke", this.value);
    });

    // open legendsEditor
    document.getElementById("markerLegendButton").addEventListener("click", function() {
      let id = elSelected.attr("id");
      let symbol = elSelected.attr("href");
      let icon = d3.select("#defs-markers").select(symbol).select("text").text();
      let name = "Marker " + icon;
      editLegends(id, name);
    });

    // click on master button to add new markers on click
    document.getElementById("markerAdd").addEventListener("click", function() {
      document.getElementById("addMarker").click();
    });

    // remove marker on click
    document.getElementById("markerRemove").addEventListener("click", function() {
      alertMessage.innerHTML = "Are you sure you want to remove the marker?";
      $("#alert").dialog({resizable: false, title: "Remove marker",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            elSelected.remove();
            $("#markerEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });
    });
  }

  // clear elSelected variable
  function unselect() {
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
          const g = mounts.append("g");
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
          const g = hills.append("g");
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
        const g = swamps.append("g");
        swampCount++;
        land[i].used = 1;
        let swamp = drawSwamp(p[0],p[1]);
        land[i].neighbors.forEach(function(e) {
          if (cells[e].height >= 20 && cells[e].height < 30 && !cells[e].river && cells[e].used != 1) {
            cells[e].used = 1;
            swamp += drawSwamp(cells[e].data[0],cells[e].data[1]);
          }
        });
        g.append("path").attr("d", round(swamp, 1));
      }

      // forest icons
      if (Math.random() < height / 100 && height >= 22 && height < 48) {
        for (let c = 0, a = area; Math.random() < a / 15; c++, a -= 15) {
          if (land[i].ctype === 1 && c > 0) break;
          if (polygons[cell][c] === undefined) break;
          const g = forests.append("g");
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

  function addReliefIcon(height, type, cx, cy) {
    const g = terrain.select("#" + type).append("g");
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
        restoreDefaultEvents();
        tip("", true);
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
      addReliefIcon(height / 100, type, x, y);

      if (d3.event.shiftKey === false) {
        $("#addRelief").removeClass("pressed");
        restoreDefaultEvents();
      }
      tip("", true);
    }

    // add relief icon on click
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
    const c = diagram.find(point[0],point[1]);
    if (!c) {
      console.error("Cannot find closest cell for points" + point[0] + ", " + point[1]);
      return;
    }
    return index = c.index;
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
    "use strict";
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
      labels.select("#burgLabels").selectAll("text").each(function() {
        const id = this.getAttribute("id");
        if (id === null || id === undefined) return;
        this.removeAttribute("id");
        this.setAttribute("data-id", +id.replace("manorLabel", ""));
      });
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
      const id = this.getAttribute("id");
      if (id === null || id === undefined) return;
      this.removeAttribute("id");
      this.setAttribute("data-id", +id.replace("manorIcon", ""));
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
    newPoints = [],riversData = [],queue = [],elSelected = "";
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
      tip("", true);
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
    }).hover(focusStates, unfocus);
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
      tip("", true);
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
  function focusStates() {
    const s = +(this.parentNode.id).slice(5);
    const l = labels.select("#regionLabel" + s);
    l.classed("drag", true);
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
      tip("", true);
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
