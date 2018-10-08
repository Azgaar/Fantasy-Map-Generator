
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
      if (customization !== 5 && !brush.length && !$("div.selected").length) return;
      let radius = 0;
      if (customization === 1) {
        radius = brushRadius.value;
        if (brushId === "brushHill" || brushId === "brushPit") {
          radius = Math.pow(brushPower.value * 4, .5);
        }
      }
      else if (customization === 2) radius = countriesManuallyBrush.value;
      else if (customization === 4) radius = culturesManuallyBrush.value;
      else if (customization === 5) radius = reliefBulkRemoveRadius.value;

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
      moveCircle(point[0], point[1], r, clr);
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
        let selection = defineBrushSelection(c2, radius);
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
