// Fantasy Map Generator (WIP) main script
fantasyMapGenerator();
function fantasyMapGenerator() {
  console.clear();
  console.time(" TimeTotal");
  $(".container").hide(); 

  // Define variables
  var svg = d3.select("svg"),
      mapWidth = +svg.attr("width"),
      mapHeight = +svg.attr("height"),
      defs = svg.select("#deftemp"),
      viewbox = svg.select(".viewbox").on("touchmove mousemove", moved).on("click", clicked),
      container = viewbox.select(".container"), //.attr("transform", "translate(80 25)"),
      ocean = container.append("g").attr("class", "ocean"),
      rose = container.append("use").attr("xlink:href","#rose"),
      islandBack = container.append("g").attr("class", "islandBack"),
      hCells = container.append("g").attr("class", "hCells"),
      grid = container.append("g").attr("class", "grid"),      
      mapCells = container.append("g").attr("class", "mapCells"),
      mapContours = container.append("g").attr("class", "mapContours"),
      hatching = container.append("g").attr("class", "hatching"),
      rivers = container.append("g").attr("class", "rivers"),
      riversShade = rivers.append("g").attr("class", "riversShade"),
      coasts = container.append("g").attr("class", "coasts"),
      coastline = coasts.append("g").attr("class", "coastline"),
      lakecoast = coasts.append("g").attr("class", "lakecoast"),
      debug = container.append("g").attr("class", "debug"),
      selected = debug.append("g").attr("class", "selected"),
      highlighted = debug.append("g").attr("class", "highlighted")
      cursored = debug.append("g").attr("class", "cursored");

  var base = ocean.append("rect").attr("x", 0).attr("y", 0).attr("width", mapWidth).attr("height", mapHeight).attr("class", "base");
  var mottling = container.append("rect").attr("x", 0).attr("y", 0).attr("width", mapWidth).attr("height", mapHeight).attr("class", "mottling");

  // Define basic data for Voronoi. Poisson-disc sampling for a points
  // Source: bl.ocks.org/mbostock/99049112373e12709381
  console.time('poissonDiscSampler');
  var voronoi = d3.voronoi().extent([[0, 0], [mapWidth, mapHeight]]);
  var diagram, polygons;
  var sampler = poissonDiscSampler(mapWidth, mapHeight, 5.9);
  var samples = [], sample;
  while (sample = sampler()) {samples.push([Math.ceil(sample[0]), Math.ceil(sample[1])]);}
  console.timeEnd('poissonDiscSampler');

  // Add D3 drag and zoom behavior
  var zoom = d3.zoom()
    .translateExtent([[0, 0], [mapWidth, mapHeight]])
    .scaleExtent([1, 40]); // 40x is default max zoom;
  svg.call(zoom);

  var drag = d3.drag()
    .container(function() {return this;})
    .subject(function() {var p=[d3.event.x, d3.event.y]; return [p, p];})
    .on("start", dragstarted);

  function zoomed() {
    scale = d3.event.transform.k;
    viewX = d3.event.transform.x;
    viewY = d3.event.transform.y;
    if (mapStyle.value == "map_contours" && mapType.value == "heightmap") {
      var x = 0.5 / scale;
      var y = 0.6 / scale;
      container.selectAll(".contoursShade")
        .attr("transform", "translate("+x+" "+y+")")
        .attr("opacity", 4 / scale);
      mapContours.attr("opacity", 4 / scale);
    }
    viewbox.attr("transform", d3.event.transform);
  }

  // manually update viewbox
  function zoomUpdate() {
    var transform = d3.zoomIdentity.translate(viewX, viewY).scale(scale);
    svg.call(zoom.transform, transform);
  }

  var dragCloud = d3.drag()
    .container(function() {return this;})
    .subject(function() {var p=[d3.event.x, d3.event.y]; return [p, p];})
    .on("start", dragCloudstarted);

  cloud = debug.append("g").attr("class", "cloud").call(dragCloud);
  cloud.append("text").text("☁").attr("x", 96).attr("y", mapHeight*0.5);
  cloud.append("text").text("⇶").attr("x", 96).attr("y", mapHeight*0.5)
    .attr("dx", "2").attr("dy", "-17").attr("id", "cloudArrow");

  // Common variables 
  var queue = [], riversData = [], selection = [], highlighting = [],
      scale = 1, viewX = 0, viewY = 0, simplex, 
      noiseApplied, pointsHeights = [], pointsCells = [], pointsBiomes = [], pointsCellHeights = [],
      biomNames = [], biomColors = [], biomIDs = "", biomGrad = "", adjectives = [],
      mapTemplate = "Undefined", boids = [], animation, animated = false,
      // D3 colors
      bright = d3.scaleSequential(d3.interpolateSpectral), // 1-
      light = d3.scaleSequential(d3.interpolateRdYlGn), // 1.2-
      green = d3.scaleSequential(d3.interpolateGreens), // 0
      blue = d3.scaleSequential(d3.interpolateBlues), // 0
      monochrome = d3.scaleSequential(d3.interpolateGreys), // 0.8-
      sepia = d3.scaleLinear().domain([0, 1]).interpolate(d3.interpolateHcl).range([d3.rgb("#8e5e2a"), d3.rgb("#faf6ea")]),
      // Journey data
      journeyStep = -1,
      stepName = ["", "1. Define Landmass", "2. Finalize Heighmap", "3. Define Climate"],
      stepHint = ["", "Select a mode and mock up the Heighmap", "Fine-tune the Heighmap and overlay with noise", "Define precipitation and set up Biomes",];
      
  // D3 Line generator
  var scX = d3.scaleLinear().domain([0, mapWidth]).range([0, mapWidth]);
  var scY = d3.scaleLinear().domain([0, mapHeight]).range([0, mapHeight]);
  var lineGen = d3.line().x(function(d) {return scX(d.scX);}).y(function(d) {return scY(d.scY);});

  // Prepare voronoi graph on-load
  loadData();
  newRandomMap();
  $("#initial, .container").fadeIn("slow"); 
  console.timeEnd(" TimeTotal");

  // Assing long strings and arrays (will be a separate json file)
  function loadData() {
    adjectives = ["Ablaze", "Ablazing", "Accented", "Ashen", "Ashy", "Beaming", "Bi-Color", "Blazing", "Bleached", "Bleak", "Blended", "Blotchy", "Bold", "Brash", "Bright", "Brilliant", "Burnt", "Checkered", "Chromatic", "Classic", "Clean", "Colored", "Colorful", "Colorless", "Complementing", "Contrasting", "Cool", "Coordinating", "Crisp", "Dappled", "Dark", "Dayglo", "Deep", "Delicate", "Digital", "Dim", "Dirty", "Discolored", "Dotted", "Drab", "Dreary", "Dull", "Dusty", "Earth", "Electric", "Eye-Catching", "Faded", "Faint", "Festive", "Fiery", "Flashy", "Flattering", "Flecked", "Florescent", "Frosty", "Full-Toned", "Glistening", "Glittering", "Glowing", "Harsh", "Hazy", "Hot", "Hued", "Icy", "Illuminated", "Incandescent", "Intense", "Interwoven", "Iridescent", "Kaleidoscopic", "Lambent", "Light", "Loud", "Luminous", "Lusterless", "Lustrous", "Majestic", "Marbled", "Matte", "Medium", "Mellow", "Milky", "Mingled", "Mixed", "Monochromatic", "Motley", "Mottled", "Muddy", "Multicolored", "Multihued", "Murky", "Natural", "Neutral", "Opalescent", "Opaque", "Pale", "Pastel", "Patchwork", "Patchy", "Patterned", "Perfect", "Picturesque", "Plain", "Primary", "Prismatic", "Psychedelic", "Pure", "Radiant", "Reflective", "Rich", "Royal", "Ruddy", "Rustic", "Satiny", "Saturated", "Secondary", "Shaded", "Sheer", "Shining", "Shiny", "Shocking", "Showy", "Smoky", "Soft", "Solid", "Somber", "Soothing", "Sooty", "Sparkling", "Speckled", "Stained", "Streaked", "Streaky", "Striking", "Strong Neutral", "Subtle", "Sunny", "Swirling", "Tinged", "Tinted", "Tonal", "Toned", "Translucent", "Transparent", "Two-Tone", "Undiluted", "Uneven", "Uniform", "Vibrant", "Vivid", "Wan", "Warm", "Washed-Out", "Waxen", "Wild"];
    biomNames = ["Hot desert","Savanna","Tropical dry forest","Tropical wet forest","Xeric srubland","Temperate dry grassland","Temperate wet grassland","Temperate deciduous forest","Subtropical rain forest","Cold desert","Temperate rain forest","Coniferous wet forest","Temperate coniferous forest","Subtaiga","Boreal wet forest","Boreal dry forest","Subpolar scrub","Subpolar desert","Tundra","Rocky desert ","Polar desert","Glacier"];
    biomColors = ["#fbfaae","#eef586","#b6d95d","#7dcb35","#d6dd7f","#bdde82","#a1d77a","#29bc56","#76bd32","#e1df9b","#45b348","#52a444","#6fb252","#567c2c","#618a38","#a4b36d","#acb076","#b5ad8b","#d5d59d","#bfbfbf","#f2f2f2","#fafeff"];
    biomIDs = "2,3,3,3,3,8,8,8,8,8,8,8,8,8,8,8,8,8,8,10,10,10,10,10,10,10,10,10,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,13,13,13,13,13,14,14,14,14,14,14,14,14,18,18,18,18,18,20,20,20,20,20,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21||2,2,3,3,3,3,8,8,8,8,8,8,8,8,8,8,8,8,8,8,10,10,10,10,10,10,10,10,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,13,13,13,13,13,14,14,14,14,14,14,14,18,18,18,18,18,20,20,20,20,20,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21||1,2,2,3,3,3,8,8,8,8,8,8,8,8,8,8,8,8,8,8,10,10,10,10,10,10,10,10,10,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,13,13,13,13,13,14,14,14,14,14,14,14,18,18,18,18,18,20,20,20,20,20,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21||1,1,2,2,2,2,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,13,13,13,13,13,13,14,14,14,14,14,14,14,18,18,18,18,20,20,20,20,20,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21||1,1,2,2,2,2,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,12,12,12,12,12,12,12,12,12,14,14,14,14,14,14,14,14,14,14,14,14,14,14,18,18,18,20,20,20,20,20,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21||1,1,1,2,2,2,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,12,12,12,12,12,12,12,12,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,18,18,20,20,20,20,20,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21||0,1,1,1,1,2,2,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,18,20,20,20,20,20,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21||0,0,1,1,1,1,1,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,20,20,20,20,20,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21||0,0,0,1,1,1,1,1,5,5,5,5,5,5,5,5,5,5,5,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,16,16,16,16,16,16,16,16,16,16,16,16,16,16,20,20,20,20,20,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21||0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,17,17,17,17,17,17,17,17,17,17,17,17,17,17,19,19,19,19,19,19,19,19,19,19,19,19,20,20,20,20,21,21,21,21,21";
    biomGrad = "#b6d95d,#aad453,#9fcf4b,#96cb44,#8ec73f,#88c53b,#83c438,#7fc236,#7cc034,#7abf33,#78be32,#77be32,#76be33,#75be34,#73be35,#6fbd37,#6bbc3a,#66bb3d,#61ba40,#5cb942,#57b844,#53b745,#50b646,#4eb347,#4eb047,#4eae46,#4fac45,#50aa44,#51a844,#52a644,#52a544,#52a444,#52a444,#52a444,#52a444,#52a444,#52a444,#52a444,#52a444,#52a444,#52a444,#52a444,#52a444,#52a444,#52a444,#52a444,#52a444,#52a444,#52a444,#52a444,#52a444,#52a444,#52a444,#53a343,#54a242,#559f40,#569b3e,#57973b,#589238,#598e35,#5a8a33,#5b8732,#5c8532,#5d8432,#5d8533,#5e8534,#608535,#648737,#6b8b3c,#769244,#839a4f,#90a35b,#9dad6a,#a8b87b,#b1c38d,#b9cd9f,#c1d6b1,#c9dec1,#cfe5d0,#d6ebdc,#ddf0e6,#e3f4ed,#e8f7f2,#ecfaf6,#effcf9,#f2fdfb,#f4fdfd,#f6fdfe,#f8fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#fafeff||#c5df67,#b8d95d,#abd455,#9fd04e,#95cc49,#8bc944,#84c841,#7ec63f,#79c43d,#76c33c,#73c23b,#71c13b,#6fc13c,#6dc03d,#6bc03d,#68c03f,#65bf41,#61be44,#5dbd46,#59bc47,#55bb49,#51ba4a,#4eb94b,#4db64b,#4db34a,#4db149,#4eaf48,#4fae48,#50ac48,#50ab48,#50aa48,#50a948,#50a948,#50a948,#51a948,#51a847,#51a847,#52a847,#52a847,#52a847,#52a847,#52a847,#52a847,#52a847,#53a847,#53a847,#54a847,#54a847,#55a847,#55a847,#57a847,#58a847,#58a747,#59a746,#5aa645,#5ba343,#5c9f41,#5d9b3e,#5d963b,#5e9238,#5e8e36,#5f8a35,#5f8835,#608736,#608736,#618737,#628737,#658838,#6b8b3c,#759143,#81984c,#8ca057,#99a965,#a4b476,#adbf88,#b5ca9b,#bed3ae,#c6dcbe,#cce3ce,#d4e9da,#dbefe5,#e2f4ec,#e7f7f2,#ecfaf6,#effcf9,#f2fdfb,#f4fdfd,#f6fdfe,#f8fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#fafeff||#d2e572,#c5de68,#b7d95f,#aad458,#9ed153,#93ce4e,#8acc4b,#82ca48,#7cc846,#78c745,#74c645,#71c545,#6fc445,#6dc446,#6bc346,#68c348,#66c349,#62c24b,#5fc04d,#5cbf4e,#5abf4f,#57be50,#54bc50,#54ba4f,#53b84f,#54b64e,#54b44d,#55b34d,#56b24d,#56b14d,#56b04d,#55b04d,#55b04d,#55b04d,#57af4d,#57ae4c,#57ae4c,#58ae4c,#58ae4c,#59ae4c,#59ae4c,#59ae4c,#59ae4c,#59ae4c,#5aae4c,#59af4c,#5baf4c,#5cae4c,#5eae4c,#5fae4c,#61ad4c,#62ad4c,#63ac4c,#64ac4b,#65ab4a,#66a949,#67a547,#67a144,#679c41,#68983e,#68943c,#68903b,#678d3a,#688c3b,#678c3b,#688b3b,#688b3b,#6b8b3c,#708e3f,#789245,#82984c,#8c9f56,#97a763,#a1b273,#aabd85,#b2c798,#bbd1ab,#c3dabc,#cae1cc,#d3e8d9,#daeee4,#e2f3eb,#e7f7f1,#ebf9f5,#effcf9,#f2fdfb,#f4fdfd,#f6fdfe,#f8fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#fafeff||#ddea7d,#d1e373,#c3de6a,#b6d962,#a9d55c,#9ed258,#94d055,#8cce52,#85cc50,#80cb4f,#7cca4f,#79c94f,#76c84f,#74c84f,#72c750,#70c751,#6ec752,#6cc653,#6ac454,#68c454,#66c455,#64c356,#63c155,#63c055,#62be55,#62bc54,#62bb53,#63ba53,#63b953,#63b853,#63b853,#63b853,#63b853,#63b853,#64b753,#65b653,#65b653,#65b653,#65b653,#66b653,#67b653,#67b653,#67b653,#67b653,#68b653,#68b752,#69b652,#6ab652,#6cb552,#6eb552,#6fb452,#71b452,#72b352,#73b352,#74b251,#75b050,#76ad4e,#76a94c,#75a549,#75a047,#759c45,#749843,#739542,#739343,#719242,#719142,#719042,#739042,#779244,#7d9549,#859a4e,#8ea057,#97a763,#a0b172,#a9bc84,#b1c696,#b9cfa9,#c1d9bb,#c9e0cb,#d2e7d8,#d9ede3,#e1f2ea,#e6f6f1,#eaf9f5,#eefbf9,#f2fcfb,#f4fcfd,#f6fcfe,#f8fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#f9fdfe,#fafeff||#e6ee88,#dbe87e,#cfe375,#c3de6d,#b7da67,#acd762,#a2d55f,#9ad35c,#93d15a,#8ed059,#8acf59,#86ce59,#84cd59,#82cd59,#81cc59,#80cc5a,#7ecc5a,#7dcb5b,#7bca5b,#7aca5b,#78ca5c,#77c95c,#76c75b,#77c65b,#76c55b,#76c35b,#76c25a,#77c25a,#77c15a,#77c15a,#76c15a,#76c05a,#76c05a,#77c05a,#78bf5a,#78be5a,#78be5a,#78be5a,#78be5a,#79be5a,#7abe5a,#7abe5a,#7abe5a,#7abe5a,#7abf5a,#7bbf5a,#7cbe5a,#7dbe5a,#7ebd5a,#80bd5a,#81bc5a,#83bc5a,#84bb5a,#85bb5a,#86ba59,#87b858,#87b657,#87b255,#86ae53,#85aa51,#84a54f,#83a14d,#819e4c,#809b4c,#7e994b,#7d974b,#7d964b,#7e964a,#81974c,#86994f,#8c9c53,#93a15a,#9aa865,#a2b173,#aabb83,#b1c495,#b8cda7,#bfd7b9,#c6dec9,#cfe5d6,#d6ebe1,#def0e8,#e4f4ef,#e9f7f3,#edf9f7,#f0faf9,#f2fbfb,#f4fbfc,#f6fcfd,#f7fcfd,#f7fcfd,#f7fcfd,#f7fdfd,#f8fcfe,#f8fdfe,#f8fdfe,#f8fdfe,#f9fdff,#f9fdff,#fafeff||#edf191,#e4ec88,#dae77f,#cfe378,#c5df73,#bcdc6e,#b3db6b,#acd968,#a6d866,#a1d765,#9dd665,#9ad465,#98d365,#97d365,#96d265,#95d165,#94d164,#93d064,#92d064,#91cf64,#90cf64,#8fce64,#8ecc63,#8ecc63,#8dcb63,#8dca63,#8dc962,#8dc962,#8dc862,#8dc862,#8cc862,#8cc762,#8cc762,#8dc762,#8ec662,#8ec663,#8ec663,#8ec663,#8ec663,#8fc663,#90c663,#90c663,#90c663,#90c663,#90c663,#91c663,#92c563,#93c563,#94c563,#96c563,#96c363,#98c363,#98c364,#98c364,#99c263,#9ac062,#9abe61,#9abb60,#99b85e,#97b45c,#96af5a,#94ab59,#92a758,#90a457,#8ea157,#8c9e56,#8b9d56,#8c9c55,#8d9c56,#919d58,#959f5b,#9aa360,#9fa969,#a5b175,#acb984,#b2c294,#b8caa5,#bed3b6,#c4dac5,#cbe0d2,#d3e6dc,#d9eae3,#dfeee9,#e3f1ed,#e7f3f0,#eaf4f3,#ecf5f5,#eff6f6,#f1f7f7,#f2f8f8,#f3f9f9,#f4fafa,#f4fbfb,#f5fbfc,#f6fcfd,#f7fcfe,#f7fdfe,#f8fdff,#f9fdff,#fafeff||#f2f399,#ebef91,#e4eb8a,#dbe884,#d4e57f,#cde37b,#c6e178,#c0e076,#bbdf74,#b7de73,#b4dd73,#b1dc73,#b0db73,#b0db73,#afda72,#add972,#add871,#abd671,#aad570,#a9d470,#a8d46f,#a7d36e,#a6d16e,#a6d16d,#a5d06d,#a5cf6d,#a5ce6d,#a5ce6d,#a5ce6d,#a5ce6d,#a4ce6d,#a4cd6d,#a4cd6d,#a4cd6d,#a4cd6d,#a5cc6e,#a5cc6e,#a5cc6e,#a5cc6e,#a5cc6e,#a6cc6e,#a6cc6e,#a6cc6e,#a6cc6e,#a6cc6e,#a7cc6e,#a8cb6e,#a9cb6e,#aacb6e,#abcb6e,#abca6e,#acca6e,#acca6f,#acca6f,#adc96e,#adc86e,#adc66d,#adc46c,#acc16b,#aabe69,#a8b968,#a6b566,#a3b065,#a1ad64,#9ea964,#9ca663,#9aa462,#9aa261,#9ba162,#9ca263,#9fa365,#a2a569,#a5aa6f,#a9b179,#aeb786,#b3bf94,#b7c6a3,#bccdb1,#c1d3bf,#c6d9ca,#ccded3,#d2e1da,#d7e5df,#dbe7e3,#dee9e6,#e1eae9,#e4eceb,#e7eded,#e9efef,#ebf0f0,#edf2f2,#eff5f4,#f1f7f6,#f2f9f9,#f4fafb,#f5fbfc,#f5fcfd,#f7fdfe,#f8fdff,#fafeff||#f6f5a1,#f1f29a,#ecf095,#e7ee91,#e2ec8e,#deea8b,#d9e988,#d5e886,#d2e885,#cfe784,#cde684,#cbe684,#cae584,#cae584,#c9e383,#c7e283,#c6e081,#c4de80,#c3dc7f,#c1db7e,#c0da7c,#bfd97c,#bdd77c,#bcd67b,#bcd57a,#bbd47a,#bbd37a,#bbd37a,#bbd37a,#bbd37a,#bbd37a,#bbd37a,#bbd37a,#bbd37a,#bbd37a,#bbd27b,#bbd27b,#bbd27b,#bbd27b,#bbd27b,#bcd27b,#bcd27b,#bcd27b,#bcd27b,#bcd27b,#bdd27b,#bdd17b,#bdd17b,#bed17b,#bed17b,#bed17b,#bfd17b,#bfd17c,#bfd17c,#c0d07c,#c0cf7c,#c0ce7c,#bfcd7b,#beca7a,#bdc878,#bbc377,#b8bf75,#b5ba74,#b2b673,#aeb272,#abae71,#a9ab70,#a8a86f,#a8a770,#a8a770,#a9a771,#aaa873,#acac77,#aeb07e,#b0b588,#b3bb94,#b5c0a0,#b9c6ac,#bccbb7,#c0d0c1,#c4d4c8,#c9d6ce,#cdd9d3,#d0dad6,#d3dcd9,#d6dddc,#d9dfde,#dce1e1,#e0e4e3,#e3e6e6,#e6eae9,#eaedec,#edf1f0,#eff4f3,#f1f6f6,#f3f8f8,#f4fafa,#f6fcfc,#f7fdfe,#fafeff||#f9f7a8,#f6f6a4,#f4f5a1,#f1f49f,#eff39e,#edf29c,#ebf19b,#e9f199,#e8f199,#e6f098,#e5f098,#e4f098,#e4ef98,#e3ef98,#e2ed97,#e0ec96,#dfea94,#dde792,#dae491,#d8e28f,#d6e08d,#d4de8c,#d2dc8c,#d1db8b,#d0da8a,#cfd98a,#cfd98a,#cfd98a,#cfd98a,#cfd98a,#cfd98a,#cfd98a,#cfd98a,#cfd98a,#cfd98a,#cfd88a,#cfd88a,#cfd88a,#cfd88a,#cfd88a,#d0d88a,#d0d88a,#d0d88a,#d0d88a,#d0d88a,#d0d88a,#d0d88a,#d0d88a,#d0d88a,#d0d88a,#d0d88a,#d1d88a,#d1d88b,#d1d88b,#d1d78b,#d1d78b,#d1d68b,#d1d68b,#d0d48a,#cfd288,#cdce87,#cac986,#c6c484,#c2bf83,#beba81,#bbb680,#b8b27f,#b5af7e,#b3ad7e,#b2ac7e,#b2ab7e,#b2ac7f,#b2ae81,#b2b085,#b2b38b,#b3b794,#b3bb9d,#b5bfa7,#b7c2af,#bac6b7,#bcc9bd,#bfcac2,#c3ccc6,#c5ccc8,#c7ceca,#c9cfcd,#cdd1d0,#d1d3d3,#d6d7d7,#dadbdb,#dfe0e0,#e4e5e4,#e8eae9,#eceeed,#eff2f1,#f2f4f4,#f3f7f7,#f5f9f9,#f7fcfc,#fafeff||#fbfaae,#fbfaae,#fbfaae,#fbfaae,#fbfaae,#fbfaae,#fbfaae,#fbfaae,#fbfaae,#fbfaae,#fbfaae,#fbfaae,#fbfaae,#faf9ad,#f9f8ac,#f7f6ab,#f5f4a9,#f3f1a6,#efeda4,#eceaa2,#e9e7a0,#e6e49e,#e4e29d,#e2e09c,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9b,#e1df9a,#e0dd99,#ded998,#dbd497,#d7cf95,#d2c993,#cdc391,#c9be8f,#c5b98f,#c0b68e,#bdb38d,#bab28c,#b9b08b,#b8b08b,#b7b08b,#b5b08c,#b3b18f,#b2b394,#b1b69b,#b1b8a2,#b2baa8,#b3bcae,#b4beb3,#b6bfb6,#b8bfb9,#babfba,#bbc0bc,#bdc1bf,#c1c3c2,#c6c6c6,#cbcbcb,#d1d1d1,#d7d7d7,#dddddd,#e3e3e3,#e8e8e8,#ededed,#f0f1f1,#f2f4f4,#f4f7f7,#f7fbfb,#fafeff";
    biomIDs = biomIDs.split("||");
    biomIDs = biomIDs.map(function(m) {return m.split(",");})
    biomGrad = biomGrad.split("||");
    biomGrad = biomGrad.map(function(m) {return m.split(",");})
  }

  // Calculate Voronoi Diagram
  function calculateVoronoi(points) {
    diagram = voronoi(points),
    polygons = diagram.polygons();
  }

  // Find cells for every x/y point
  function findCells(points) {
    console.time('findCells');
    pointsCells = [];
    points.map(function(i, d) {
      if (!pointsCells[i[1]]) {pointsCells[i[1]] = [];}
      pointsCells[i[1]][i[0]] = d;
      neighborCells(i[1], i[0], 2);
    });
    d3.range(0, mapHeight).forEach(function(y) {
      d3.range(0, mapWidth).forEach(function(x) {
        if (!pointsCells[y]) {pointsCells[y] = [];}
        if (!pointsCells[y][x]) {
          pointsCells[y][x] = diagram.find(x, y).index;
          neighborCells(y, x, 1);
        }
      });
    });
    console.timeEnd('findCells');
  }

  function neighborCells(y, x, l) {
    if (y > l && x > l && y + l < mapHeight && x + l < mapWidth) {
      var v = pointsCells[y][x];
      for (c = l * -1; c < l; c ++) {
        if (!pointsCells[y+c]) {pointsCells[y+c] = [];}
        if (!pointsCells[y-c]) {pointsCells[y-c] = [];}
        pointsCells[y+c][x] = v;
        pointsCells[y+c][x+c] = v;
        pointsCells[y][x+c] = v;
        pointsCells[y][x-c] = v;
        if (c > 1 || c < -1) {
          var p = c+1;
          if (!pointsCells[y+p]) {pointsCells[y+p] = [];}
          if (!pointsCells[y-p]) {pointsCells[y-p] = [];}
          pointsCells[y+c][x+p] = v;
          pointsCells[y+c][x-p] = v;
          pointsCells[y+p][x+c] = v;
          pointsCells[y+p][x-c] = v;
        }
      }
    }
  }

  function detectNeighbors() {
    console.time("detectNeighbors");
    // define neighbors for each polygon
    polygons.map(function(i, d) {
      i.index = d;
      if (!i.height) {i.height = 0;}
      var neighbors = [];
      diagram.cells[d].halfedges.forEach(function(e) {
        var edge = diagram.edges[e], ea;
        if (edge.left && edge.right) {
          ea = edge.left.index;
          if (ea === d) {
            ea = edge.right.index;
          }
          neighbors.push(ea);
        } else {
          if (edge.left) {
            ea = edge.left.index;
          } else {
            ea = edge.right.index;
          }
          polygons[ea].type = -99; // map border
        }
      })
      i.neighbors = neighbors;
    });
    console.timeEnd("detectNeighbors");
  }

  function addMountain() {
    var x = Math.floor(Math.random() * mapWidth / 2 + mapWidth / 4);
    var y = Math.floor(Math.random() * mapHeight / 3 + mapHeight / 3);
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
      } while (polygons[rnd].height + height > 0.9 && limit < 100)
      add(rnd, "hill", height);
    }
  }

  function add(start, type, height) {
    var sharpness = 0.2;
    var radius = 0.99;
    if (type === "mountain") {radius = 0.9;}
    var queue = []; // polygons to check
    var used = []; // used polygons
    polygons[start].height += height;
    polygons[start].feature = undefined;
    queue.push(start);
    used.push(start);
    for (i = 0; i < queue.length && height > 0.01; i++) {
      if (type == "mountain") {
        height = polygons[queue[i]].height * radius - height/100;
      } else {
        height = height * radius;
      }
      polygons[queue[i]].neighbors.forEach(function(e) {
        if (used.indexOf(e) < 0) {
          var mod = Math.random() * sharpness + 1.1 - sharpness;
          if (sharpness == 0) {mod = 1;}
          polygons[e].height += height * mod;
          if (polygons[e].height > 1) {
            polygons[e].height = 1;
          }
          polygons[e].feature = undefined;
          queue.push(e);
          used.push(e);
        }
      });
    }
  }

  function addRange(mod) {
    var count = Math.abs(mod);
    for (c = 0; c < count; c++) {
      var from, to, diff = 0;
      do {
        var xf = Math.floor(Math.random() * (mapWidth*0.7)) + mapWidth*0.15;
        var yf = Math.floor(Math.random() * (mapHeight*0.6)) + mapHeight*0.2;
        from = diagram.find(xf, yf).index;
        var xt = Math.floor(Math.random() * (mapWidth*0.7)) + mapWidth*0.15;
        var yt = Math.floor(Math.random() * (mapHeight*0.6)) + mapHeight*0.2;
        to = diagram.find(xt, yt).index;
        diff = Math.hypot(xt - xf, yt - yf);
      } while (diff < 180 || diff > 400)
      var range = [];
      if (from && to) {
        for (var l = 0; from != to && l < 1000; l++) {
          var min = 10000;
          polygons[from].neighbors.forEach(function(e) {
            diff = Math.hypot(polygons[to].data[0] - polygons[e].data[0], polygons[to].data[1] - polygons[e].data[1]);
            if (Math.random() > 0.5) {diff = diff/2}
            if (diff < min) {
              min = diff;
              from = e;
            }
          });
          range.push(from);
        }
      }
      if (range.length > 0) {
        var change = Math.random() * 0.4 + 0.1;
        var query = [];
        var used = [];
        for (var i = 1; change > 0.01; i++) {
          var rnd = Math.random() * 0.4 + 0.8;
          change -= i / 30 * rnd;
          range.map(function(r) {
            polygons[r].neighbors.forEach(function(e) {
              if (used.indexOf(e) == -1 && Math.random() > 0.2 && change > 0) {
                query.push(e);
                used.push(e);
                if (mod > 0) {
                  polygons[e].height += change;
                  if (polygons[e].height > 1) {polygons[e].height = 1;}
                } else if (polygons[e].height >= 0.2) {
                  polygons[e].height -= change;
                  if (polygons[e].height < 0.1) {
                    polygons[e].height = 0.13 + i/100;
                    if (polygons[e].height >= 0.2) {polygons[e].height = 0.19;}
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

  function addPit(count) {
    for (c = 0; c < count; c++) {
      var change = Math.random() * 0.3 + 0.2;
      var limit = 0; // iterations limit
      do {
        rnd = Math.floor(Math.random() * polygons.length);
        limit++;
      } while (polygons[rnd].height < 0.17 && limit < 100)
      var query = [rnd], used = [];
      for (var i = 1; change > 0.01; i++) {
        var rnd = Math.random() * 0.4 + 0.8;
        change -= i / 60 * rnd;
        query.map(function(p) {
          polygons[p].neighbors.forEach(function(e) {
            if (used.indexOf(e) == -1 && change > 0) {
              query.push(e);
              used.push(e);
              polygons[e].height -= change;
              if (polygons[e].height < 0.1) {
                polygons[e].height = 0.1 + i/100;
                if (polygons[e].height >= 0.2) {polygons[e].height = 0.19;}
              }
            }
          });
        });
      }
    }
  }

  function getNoise(nx, ny) {
    return simplex.noise2D(nx, ny) / 2 + 0.5;
  }

  function addNoise() {
    console.time("addNoise");
    pointsHeights = [], pointsCellHeights = [], pointsCells = [];
    // SimplexNoise by Jonas Wagner
    simplex = new SimplexNoise();
    d3.range(0, mapHeight).forEach(function(y) {
      d3.range(0, mapWidth).forEach(function(x) {
        var cell = diagram.find(x, y).index;
        if (!pointsCells[y]) {pointsCells[y] = [];}
        pointsCells[y][x] = cell;
        var cellHeight = polygons[cell].height;
        if (cellHeight >= 0.2) {
          var nx = x / mapWidth - 0.5;
          var ny = y / mapHeight - 0.5;
          var noise = getNoise(2 * nx, 2 * ny) / 2;
          noise += getNoise(4 * nx, 4 * ny) / 4;
          noise += getNoise(8 * nx, 8 * ny) / 8;
          var height = (cellHeight * 2 + noise) / 3;
          if (height < 0.2) {height = 0.2;}
          pointsCellHeights.push(height);
          height += (Math.floor(Math.random() * 3) - 1) / 100;
          pointsHeights.push(height);
        } else {
          pointsCellHeights.push(cellHeight);
          pointsHeights.push(cellHeight);
        }
      });
    });
    console.timeEnd("addNoise");
  }

  function showNoise() {
    coastline.selectAll("*").remove();
    hCells.selectAll("*").remove();
    polygons.forEach(function(i) {
      x = Math.floor(i.data[0]);
      y = Math.floor(i.data[1]);
      var height = pointsCellHeights[x + y * mapWidth];
      if (height >= 0.2) {
        var clr = bright(1 - height);
        hCells.append("path")
          .attr("d", "M" + i.join("L") + "Z")
          .attr("stroke", clr)
          .attr("fill", clr);
      }
    });
  }

  function applyNoise() {
      polygons.forEach(function(i) {
      if (i.height >= 0.2) {
        x = i.data[0];
        y = i.data[1];
        i.height = pointsCellHeights[x + y * mapWidth];
      }
    });
  }

  function drawMapBase(style) {
    console.time("drawMapBase");
    // remove map base elements to redraw
    mapCells.selectAll("*").remove();
    mapContours.selectAll("*").remove();
    // detect color scheme with Evil
    var color = eval(mapColor.value), clr;
    // set backgroud color for islands
    if (mapStyle.value === "map_flat") {
      clr = "#f9f9eb";
    } else if (mapStyle.value === "map_shaded") {
      clr = sepia(0.2);
    } else if (mapType.value === "heightmap") {
      clr = color(0.75);
    } else {
      var temp = Math.floor(20 - (temperatureInput.value - 12) / 0.2);
      if (temp > 99) {temp = 99;} // max value
      if (temp < 0) {temp = 0;} // min value
      clr = biomGrad[1][temp];
    }
    d3.selectAll(".islandBack").attr("fill", clr);
    // "polygonal" map style 
    if (mapStyle.value === "map_polygonal") {
      polygons.map(function(i) {
        if (i.height >= 0.2) {
          var clr;
          if (mapType.value === "heightmap") {clr = color(1 - i.height);}
          if (mapType.value === "biomes") {clr = biomColors[i.biom];}
          mapCells.append("path")
            .attr("shape-rendering", "geometricPrecision")
            .attr("d", "M" + i.join("L") + "Z")
            .attr("fill", clr)
            .attr("stroke", clr)
            .attr("stroke-width", 0.7);
        }
      });
    }
    // 'triangled' map style
    if (mapStyle.value === "map_triangled") {
      diagram.edges.forEach(function(e) {
        if (e.left && e.right) {
          var clrR, clrL, hDelta = 0;
          var hLeft = polygons[e.left.index].height;
          var hRight = polygons[e.right.index].height;
          if (hLeft >= 0.2 || hRight >= 0.2) {
            var dR = e[0][0] + " " + e[0][1] + " L" + e.right[0] + " " + e.right[1] + " L" + e[1][0] + " " + e[1][1];
            var dL = e[0][0] + " " + e[0][1] + " L" + e.left[0] + " " + e.left[1] + " L" + e[1][0] + " " + e[1][1];
            hDelta = hRight - hLeft;
            if (mapType.value === "heightmap") {
              clrR = d3.hsl(color(1 - hRight + hDelta / 3));
              clrL = d3.hsl(color(1 - hLeft - hDelta / 3));
            }
            if (mapType.value === "biomes") {
              var cR = polygons[e.right.index].biomColor;
              var cL = polygons[e.left.index].biomColor;
              clrR = d3.hsl(d3.interpolateLab(cR, cL)(0.33));
              clrL = d3.hsl(d3.interpolateLab(cL, cR)(0.33));
            }
            if (hLeft >= 0.2 && hRight >= 0.2) {
              clrR = clrR.darker(hDelta * 2 * hRight);
              if (hDelta > 0.02) {
                clrR.l -= hDelta / 4;
              }
              clrL = clrL.darker(hDelta); 
            }
            mapCells.append("path")
              .attr("d", "M" + dR + "Z")
              .attr("fill", clrR);
            mapCells.append("path")
              .attr("d", "M" + dL + "Z")
              .attr("fill", clrL);
          }
        }
      })
    }
    // 'noisy' map style
    if (mapStyle.value === "map_noisy") {
      if (mapType.value === "heightmap") {
        mapCells.selectAll("path")
          .data(d3.contours()
            .size([mapWidth, mapHeight])
            .thresholds(d3.range(0.2, 0.9, 0.04))
            (pointsHeights))
          .enter().append("path")
          .attr("d", d3.geoPath())
          .attr("fill", function(d) { return color(0.95-d.value);});
      }
      if (mapType.value === "biomes") {
      mapCells.selectAll("path")
        .data(d3.contours()
          .size([mapWidth, mapHeight])
          .thresholds(d3.range(0, 22))
          .smooth(false) 
          (pointsBiomes))
        .enter().append("path")
        .attr("d", d3.geoPath())
        .attr("fill", function(d) {return biomColors[d.value]});
      }
    }
    // 'contours' map style
    if (mapStyle.value === "map_contours") {        
      mapCells.selectAll("path")
        .data(d3.contours()
          .size([mapWidth, mapHeight])
          .thresholds(d3.range(0.2, 0.9, 0.04))
          (pointsHeights))
        .enter().append("path")
        .attr("d", d3.geoPath())
        .attr("fill", function(d) {return color(0.95-d.value);});
      var data = d3.contours()
        .size([mapWidth, mapHeight])
        .thresholds(d3.range(0.22, 0.9, 0.04))
        (pointsCellHeights);
      var contours = mapContours.selectAll("p")
        .data(data).enter().append("g")
        .attr("shape-rendering", "geometricPrecision");
      contours.data(data).append("path")
        .attr("d", d3.geoPath())
        .attr("class", "contoursShade")
        .attr("transform", "translate("+0.5/scale+" "+0.6/scale+")")
        .attr("opacity", 4/scale)
        .attr("fill", function(d) { return d3.hsl(color(0.95-d.value)).darker(2)});
      contours.data(data).append("path")
        .attr("d", d3.geoPath())
        .attr("fill", function(d) { return color(0.95-d.value)});
    }
    // 'relaxed' map style
    if (mapStyle.value === "map_relaxed") {      
      var cont = [];
      lineGen.curve(d3.curveBasisClosed);
      if (mapType.value === "biomes") {
        console.time("range")
        var range = [...new Set(pointsBiomes)];
        range.shift();
        range.sort(sortNumber);
        console.timeEnd("range")
        var data = d3.contours()
          .size([mapWidth, mapHeight])
          .thresholds(d3.range(0, 22))
          .smooth(false)
          (pointsBiomes)
        range.forEach(function(d) {
          cont[d] = [data[d]];
          var el = defs.data(cont[d]).append("path").attr("d", d3.geoPath());
          var path = el.node().getPathData();
          var elements = [{scX:path[0].values[0], scY:path[0].values[1]}];
          var p = "";
          for (var s = 1; s < path.length; s++) {
            if (path[s].type == "M") {
              if (elements.length > 8) {
                p += lineGen(elements);
              }
              elements = [];
            }
            if (path[s].type != "Z" && s % 4 == 1) {
              elements.push({scX:path[s].values[0], scY:path[s].values[1]});
            }
          }
          mapCells.append("path")
            .attr("id", d).attr("d", p)
            .attr("fill", biomColors[d])
            .attr("shape-rendering", "geometricPrecision");
        });
      } else {
        var range = d3.range(0.22, 0.9, 0.04);
        var data = d3.contours()
          .size([mapWidth, mapHeight])
          .thresholds(range)
          (pointsCellHeights);
        range.forEach(function(d, i) {
          cont[i] = [data[i]];
          var clr = color(0.95-d.toFixed(2));
          var el = defs.data(cont[i]).append("path").attr("d", d3.geoPath());
          var path = el.node().getPathData();
          var p = "";
          if (path.length > 0) {
            var elements = [{scX:path[0].values[0], scY:path[0].values[1]}];          
          }
          for (var s = 1; s < path.length; s++) {
            if (path[s].type == "M") {
              if (elements.length > 8) {p += lineGen(elements);}
              elements = [];
            }
            if (path[s].type != "Z" && s % 4 == 1) {
              elements.push({scX:path[s].values[0], scY:path[s].values[1]});
            }
          }
          mapCells.append("path").attr("d", p).attr("fill", clr)
            .attr("shape-rendering", "geometricPrecision");   
        });
      }
    }    
    // 'shaded' map style
    if (mapStyle.value === "map_shaded") {
      mapCells.selectAll("path")
        .data(d3.contours()
          .size([mapWidth, mapHeight])
          .thresholds(d3.range(0.2, 0.9, 0.04))
          (pointsCellHeights))
        .enter().append("path")
        .attr("d", d3.geoPath())
        .attr("fill", function(d) {return sepia(d.value);})
        .attr("stroke", "none")
        .attr("filter", "url(#blurFilter)");
    }  
    console.timeEnd("drawMapBase");
  }

  function drawHeightmap(change) {
    hCells.selectAll("*").remove();
    var nonzero = $.grep(polygons, function(e) {return (e.height);});
    nonzero.map(function(i) {
      if (change) {i.height += change;}
      if (i.height > 1) {i.height = 1;}
      if (i.height < 0) {i.height = 0;}
      var clr = bright(1 - i.height);
      hCells.append("path")
        .attr("d", "M" + i.join("L") + "Z")
        .attr("stroke", clr)
        .attr("fill", clr);
    });
  }

  // Draw edgy coastline for the Journey
  function mockCoastline() {
    coastline.selectAll("*").remove();
    var edges = [];
    for (var i = 0; i < polygons.length; i++) {
      if (polygons[i].height >= 0.2) {
        var cell = diagram.cells[i];
        cell.halfedges.forEach(function(e) {
          var edge = diagram.edges[e];
          if (edge.left && edge.right) {
            var ea = edge.left.index;
            if (ea === i) {ea = edge.right.index;}
            if (polygons[ea].height < 0.2) {
              var start = edge[0].join(" ");
              var end = edge[1].join(" ");
              edges.push({start, end});
              polygons[ea].type = -1;
            }
          }
        })
      }
    }
    lineGen.curve(d3.curveLinear);
    var line = getContinuousLine(edges, 0, 0);
    coastline.append("path").attr("d", line);
  }

  // Draw selection
  function drawSelection() {
    selected.selectAll("*").remove();
    selection.map(function(i) {
      selected.append("path")
        .attr("d", "M" + polygons[i].join("L") + "Z");
    });
  }

  function getPrecipitation(prec) {
    if (prec > 0.9) {return 0;}
    if (prec > 0.75) {return 1;}
    if (prec > 0.6) {return 2;}
    if (prec > 0.5) {return 3;}
    if (prec > 0.4) {return 4;}
    if (prec > 0.3) {return 5;}
    if (prec > 0.2) {return 6;}
    if (prec > 0.05) {return 7;}
    if (prec > 0.02) {return 8;}
    return 9;
  }

  // Mark and name features (ocean, lakes, isles)
  function markFeatures() {
    console.time("markFeatures");
    var queue = [], island = 0, lake = 0, number = 0, type, name, greater = 0, less = 0;
    var start = diagram.find(0, 0).index; // start for top left corner to define Ocean first
    var unmarked = [polygons[start]];
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
      polygons[start].feature = type;
      polygons[start].featureNumber = number;
      while (queue.length > 0) {
        var i = queue[0];
        queue.shift();
        polygons[i].neighbors.forEach(function(e) {
          if (!polygons[e].feature && polygons[e].height >= greater && polygons[e].height < less) {
            polygons[e].feature = type;
            polygons[e].featureNumber = number;
            queue.push(e);            
          }
          if (type == "Island" && polygons[e].height < 0.2) {
            polygons[i].type = 1;
            polygons[e].type = -1;
          }
        });
      }
      unmarked = $.grep(polygons, function(e) {return (!e.feature);});
    }
    console.timeEnd("markFeatures");
  }

  function drawOcean(limits, colors) {
    console.time("drawOcean");
    // Mark distances
    var frontier = $.grep(polygons, function(e) {return (e.type === -1);});
    for (var c = -2; frontier.length > 0 && c > limits[0]; c--) {
      frontier.map(function(i) {
        i.neighbors.forEach(function(e) {
          if (!polygons[e].type) {polygons[e].type = c;}
        });
      });
      frontier = $.grep(polygons, function(e) {return (e.type === c);});      
    }
    // Define area edges
    for (var c = 0; c < limits.length; c++) {
      var edges = [];
      for (var i = 0; i < polygons.length; i++) {
        if (polygons[i].feature === "Ocean" && polygons[i].type >= limits[c]) {
          var cell = diagram.cells[i];
          cell.halfedges.forEach(function(e) {
            var edge = diagram.edges[e];
            if (edge.left && edge.right) {
              var ea = edge.left.index;
              if (ea === i) {ea = edge.right.index;}
              var type = polygons[ea].type;
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
      var relax = 0.8-c/10;
      if (relax < 0.2) {relax = 0.2};
      var line = getContinuousLine(edges, 0, relax);
      ocean.append("path").attr("d", line).attr("fill", colors[c]);
    }
    // Define ocean fill-rule
    if (mapTemplate === "Atoll") {
      ocean.attr("fill-rule", "nonzero");
    } else {
      ocean.attr("fill-rule", "evenodd");
    }
    console.timeEnd("drawOcean");
  }

  // Detect and draw the coasline
  function drawCoastline() {
    console.time('drawCoastline');
    var oceanEdges = [], lakeEdges = [], seashore = [];
    for (var i = 0; i < polygons.length; i++) {
      if (polygons[i].height >= 0.2) {
        var cell = diagram.cells[i];
        cell.halfedges.forEach(function(e) {
          var edge = diagram.edges[e];
          if (edge.left && edge.right) {
            var ea = edge.left.index;
            if (ea === i) {ea = edge.right.index;}
            if (polygons[ea].height < 0.2) {
              var start = edge[0].join(" ");
              var end = edge[1].join(" ");
              if (polygons[ea].feature === "Lake") {
                lakeEdges.push({start, end}); 
              } else {
                oceanEdges.push({start, end});
              }
              var x = (edge[0][0] + edge[1][0]) / 2;
              var y = (edge[0][1] + edge[1][1]) / 2;
              // Add costline edge's centers to array to use later to place manors
              seashore.push({cell: i, x, y});
            }
          }
        })
      }
    }
    lineGen.curve(d3.curveCatmullRom); //curveBasis, curveStep, curveCatmullRom;
    var line = getContinuousLine(oceanEdges, 1.5, 0);
    defs.select("#shape").append("path").attr("d", line);
    islandBack.append("path").attr("d", line); // draw the landmass
    coastline.append("path").attr("d", line).attr("class", "coastShade");; // draw the coastline
    line = getContinuousLine(lakeEdges, 1.5, 0);
    lakecoast.append("path").attr("d", line); // draw the lakes
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
      var x0 = spl[0];
      var y0 = spl[1];
      for (var i = 0; end !== start && i < 2000; i++) {
        var next = $.grep(edges, function(e) {return (e.start == end || e.end == end);});
        if (next.length > 0) {
          if (next[0].start == end) {
            end = next[0].end;
          } else if (next[0].end == end) {
            end = next[0].start;
          }
          spl = end.split(" ");
          var dist = Math.hypot(spl[0] - x0, spl[1] - y0);
          if (dist >= indention && Math.random() > relax) {
            edgesOrdered.push({scX: spl[0], scY: spl[1]}); 
            x0 = spl[0];
            y0 = spl[1];
          }
        }
        var rem = edges.indexOf(next[0]);
        edges.splice(rem, 1);
      }
      line += lineGen(edgesOrdered) + "Z ";
    }
    return line;
  }

  // Onclick actions
  function clicked() {
    if (journeyStep == 1) {
      var point = d3.mouse(this),
          cell = diagram.find(point[0], point[1]).index,
          status = map_mode.getAttribute("status");       
      if (status == 1) {
        var power = +$("#change_power").text();
        if ($("#draw_increase").attr("status") == 1) {polygons[c2].height += power;}
        if ($("#draw_decrease").attr("status") == 1) {polygons[c2].height -= power;}
        if ($("#draw_erase").attr("status") == 1) {polygons[c2].height = 0;}
        if ($("#draw_smooth").attr("status") == 1) {
          var heights = [polygons[cell].height];
          polygons[cell].neighbors.forEach(function(e) {heights.push(polygons[e].height);});
          polygons[cell].height = d3.mean(heights);
        }
        drawHeightmap();
        mockCoastline();
      } else if (status == 2) {
        var index = selection.indexOf(cell);
        if (index == -1) {
          if (cell_line.getAttribute("start") == "") {
            selection.push(cell);
          } else { // cell_line - add highlighted to selection
            addHighlighted();
            cell_line.setAttribute("start", cell);
          }
        } else {
          if (cell_line.getAttribute("start") == "") {
            selection.splice(index, 1);
          } else { // cell_line - add highlighted to selection
            addHighlighted();
            cell_line.setAttribute("start", "");
          }
        }
        drawSelection();
      }
    }
  }

  // Drag actions
  function dragstarted() {
    var redraw = 0;
    var x0 = d3.event.x,
        y0 = d3.event.y,
        c0 = diagram.find(x0, y0).index,
        c1 = c0;
    var mode = selection.indexOf(c0);
    d3.event.on("drag", function() {
      var x1 = d3.event.x,
          y1 = d3.event.y,
          c2 = diagram.find(x1, y1).index;
      if (c2 !== c1 && journeyStep == 1) {
        c1 = c2;
        status = map_mode.getAttribute("status");
        if (status == 2) {
          var state = selection.indexOf(c2);
          if (mode == -1 && state == -1) {
            selection.push(c2);
            drawSelection();
          } else if (mode != -1 && state != -1) {
            selection.splice(state, 1);
            drawSelection();
          }
        } else if (status == 1) {
          var power = +$("#change_power").text();
          if ($("#draw_increase").attr("status") == 1) {polygons[c2].height += power;}
          if ($("#draw_decrease").attr("status") == 1) {polygons[c2].height -= power;}
          if ($("#draw_align").attr("status") == 1) {polygons[c2].height = polygons[c0].height;}
          if ($("#draw_erase").attr("status") == 1) {polygons[c2].height = 0;}
          if ($("#draw_smooth").attr("status") == 1) {
            var heights = [polygons[c2].height];
            polygons[c2].neighbors.forEach(function(e) {heights.push(polygons[e].height);});
            polygons[c2].height = d3.mean(heights);
          }
          ;
          highlighting.push(c2);
          highlighting.map(function(h) {
            highlighted.append("path").attr("d", "M" + polygons[h].join("L") + "Z");
          });
          redraw = 1;
        }
      }
    }).on("end", function() {
      if (redraw == 1) {
        drawHeightmap();
        mockCoastline();
        highlighting = [];
        highlighted.selectAll("*").remove();
      }
    });
  }

  function dragCloudstarted() {
    var angle, winds;
    d3.event.on("drag", function() {
      var x = d3.event.x;
      var y = d3.event.y + 20;
      x = Math.max(40, Math.min(mapWidth-40, x));
      y = Math.max(40, Math.min(mapHeight, y));
      angle = Math.atan2(mapHeight / 2 - y, mapWidth / 2 - x);
      cloud.selectAll("text").attr("x", x).attr("y", y);
      var arrow = cloud.selectAll("#cloudArrow").node().getBBox();
      var arrowX = arrow.x + arrow.width / 2;
      var arrowY = arrow.y + arrow.height / 2;
      degree = angle * 180 / Math.PI;
      var azimuth = degree;
      if (degree < 0) {azimuth = 360 + degree;}
      if (azimuth >= 90) {azimuth -= 90;} else {azimuth += 270;}
      winds = parseWinds(degree);
      hintbar.innerHTML = "Prevailing winds: " + winds + " (" + Math.floor(azimuth) + "º)";
      cloud.selectAll("#cloudArrow").attr("transform", "rotate("+degree+" "+arrowX+" "+arrowY+")");
    }).on("end", function() {     
      simulateWind(angle, winds);
    });
  }

  function parseWinds(d) {
    if (d > 40 && d <= 140) {return "North";}
    if (d > 140 && d < 160) {return "North-East";}
    if (Math.abs(d) >= 160) {return "East";}
    if (d > -160 && d < -140) {return "South-East";}
    if (d > -140 && d <= -40) {return "South";}
    if (d > -40 && d < -20) {return "South-West";}
    if (Math.abs(d) <= 20) {return "West";}
    if (d > 20 && d < 40) {return "North-West";}
  }

  function addHighlighted() {
    highlighting.map(function(i) {
      if (selection.indexOf(i) == -1) {selection.push(i);}
    });
    highlighted.selectAll("*").remove();
    highlighting = [];
  }

  function clear() {
    console.log("----------");
    svg.transition().duration(3000).call(zoom.transform, d3.zoomIdentity);
    // Remove all on regenerate 
    container.selectAll("path").remove();
    debug.selectAll("circle").remove();
    //debug.selectAll("text").remove();
    defs.selectAll("path").remove();
  }

  // Random map
  $("#new_random").click(function() {
    clear();
    newRandomMap();
  });

  // Random map Routine
  function newRandomMap() {
    console.time(" RandomMap");
    base.transition().duration(3000).attr("fill", "#5167a9");
    $("#explore").text("Explore the Map");
    calculateVoronoi(samples);
    detectNeighbors();
    generateHeightmap();
    markFeatures();
    drawOcean([-6,-3,-1], ["#5E78B6","#6d8cc5","#7EABD5"]);
    reGraph();
    collectStats();
    addNoise();
    applyNoise();
    //randomizePrecipitation();
    //calculatePrecipitation();
    unifyPrecipitation(); // temp
    resolveDepressions();
    //downcutRivers();
    drawCoastline();
    //defineBiomes();
    drawMapBase();   
    console.timeEnd(" RandomMap");
  }

  // Select Heighmap Template
  function generateHeightmap() {
    console.time("generateHeightmap");
    var rnd = Math.random();
    if (rnd > 0.8) {templateHighIsland();}
    if (rnd > 0.55 && rnd <= 0.8) {templateLowIsland();}
    if (rnd > 0.3 && rnd <= 0.55) {templateIsles();}
    if (rnd > 0.05 && rnd <= 0.3) {templateArchipelago();}
    if (rnd <= 0.05) {templateAtoll();}
    downgradeBorders();
    smoothOcean();
    console.timeEnd("generateHeightmap");
  }

// Heighmap Template: High Island
  function templateHighIsland() {
    mapTemplate = "High Island";
    addMountain();
    modifyHeights("all",0.04,0.9);
    addHill(8, 0.4);
    addHill(8, 0.33);
    addRange(-2);
    addPit(3);
    modifyHeights("land",0,0.6);
    addRange(2);
  }

// Heighmap Template: Low Island
  function templateLowIsland() {
    mapTemplate = "Low Island";
    addMountain();
    modifyHeights("all",0.03,0.9);
    addHill(8, 0.4);
    addHill(8, 0.33);
    addRange(-2);
    addPit(3);
    modifyHeights("land",0,0.3);
  }

  // Heighmap Template: Continental Islands
  function templateIsles() {
    mapTemplate = "Continental Islands";
    addMountain();
    addHill(14, 0.25);
    addRange(-5);
    modifyHeights("land",0,0.9);
  }

  // Heighmap Template: Archipelago
  function templateArchipelago() {
    mapTemplate = "Archipelago";
    addMountain();
    modifyHeights("land",-0.2,1);
    addHill(15, 0.15);
    addRange(-2);
    addPit(8);
    modifyHeights("land",-0.05,0.9);
  }

  // Heighmap Template: Atoll
  function templateAtoll() {
    mapTemplate = "Atoll";
    addMountain();
    addHill(8, 0.4);
    modifyHeights("land",0.1,1);
    var frontier = [];
    polygons.map(function(i) {
      if (i.height) {
        var heights = [i.height];
        i.neighbors.forEach(function(e) {heights.push(polygons[e].height);});
        i.height = d3.mean(heights);
      }
    });
    polygons.map(function(i) {
      if (i.height < 0.18) {i.height -= 0.06;}
      if (i.height > 0.21) {i.height = 0.17;}
      if (i.height >= 0.18 && Math.random() > 0.2) {
        i.height = 0.20 * (Math.random() * 0.1 + 1);
        frontier.push(i.index);
      }
    });
    var change = 0.05;
    var used = frontier.slice();
    while (change > 0.01) {
      var queue = [];
      change -= 0.01 * (Math.random() * 0.4 + 0.8);
      frontier.map(function(i) {
        polygons[i].neighbors.forEach(function(e) {
          if (used.indexOf(e) == -1) {
            used.push(e);
            queue.push(e);
            polygons[e].height += change * (Math.random() * 0.2 + 0.9);
          }
        });
        frontier = queue.slice();
      });
    }
  }

  // recalculate Voronoi Graph to relax Ocean and pack coast cells
  function reGraph() {
    console.time("reGraph");
    var points = [], data = [];
    var coastal = $.grep(polygons, function(e) {return (e.type == 1 || e.type == -1);});
    console.log("coastal polygons: " + coastal.length);
    polygons.map(function(i) {
      //debug.append("text").attr("x", i.data[0]).attr("y", i.data[1]).attr("font-size", 2).attr("fill", "black").text(i.type);
      if (i.type == 1 || i.type == -1) {
        var x0 = i.data[0];
        var y0 = i.data[1];
        points.push([x0, y0]);
        data.push({height:i.height, type:i.type, feature:i.feature, number:i.featureNumber});
        //if (i.type == -1) {debug.append("circle").attr("cx", x0).attr("cy", y0).attr("r", 0.3).attr("fill", "white");}
        // add new points
        i.neighbors.forEach(function(e) {
          if (polygons[e].type == i.type) {
            var x1 = Math.ceil((x0 * 2 + polygons[e].data[0]) / 3 - 0.5 + Math.random());
            var y1 = Math.ceil((y0 * 2 + polygons[e].data[1]) / 3 - 0.5 + Math.random());
            var copy = $.grep(points, function(e) {return (e[0] == x1 && e[1] == y1);});
            if (!copy.length) {
              points.push([x1, y1]);
              data.push({height:i.height, type:i.type, feature:i.feature, number:i.featureNumber});
              //if (i.type == -1) {debug.append("circle").attr("cx", x1).attr("cy", y1).attr("r", 0.3).attr("fill", "white");}
            }
          };
        });
      } else if (i.height >= 0.20) {
        points.push([i.data[0], i.data[1]]);
        data.push({height:i.height, type:i.type, feature:i.feature, number:i.featureNumber});
      }
    });
    calculateVoronoi(points);
    polygons.map(function(i, d) {
      i.index = d;
      i.height = data[d].height;
      i.type = data[d].type;
      i.feature = data[d].feature;
      i.featureNumber = data[d].number;
      i.precipitation = 0;
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
    //findCells(points);
    console.timeEnd("reGraph");
  }

  // collect and display map stats
  function collectStats() {
    console.log(" Map stats:");
    var land = $.grep(polygons, function(e,d) {return (e.height >= 0.2);});
    var landmass = Math.floor(land.length / polygons.length * 100);
    var heights = [];
    land.map(function(i) {heights.push(i.height);});
    var avElevation = d3.mean(heights);
    console.log(" Heighmat template: "+mapTemplate)
    console.log(" Polygons initial: "+samples.length);
    console.log(" Polygons repacked: "+polygons.length);
    console.log(" Land / Ocean polygons: "+land.length+"/"+(polygons.length-land.length));
    console.log(" Average land elevation: "+avElevation.toFixed(2));
  }

  // Downgrade near-border cells (prevent non-island formation errors)
  function downgradeBorders() {
    var borderCells = $.grep(polygons, function(e) {return (e.type == -99);});
    borderCells.map(function(i) {
      i.neighbors.forEach(function(e) {polygons[e].height = 0;});
    });
  }

  // Smooth Ocean
  function smoothOcean() {
    var frontier = $.grep(polygons, function(e) {return (e.type === -1);});
    for (var c = -2; frontier.length > 0 && c > -6; c--) {
      frontier.map(function(i) {
        polygons[i.index].height = 0.2 + (c+1)/50;
        i.neighbors.forEach(function(e) {
          if (!polygons[e].type && polygons[e].height < 0.2) {polygons[e].type = c;}
        });
      });
      frontier = $.grep(polygons, function(e) {return (e.type === c);});      
    }
  }

  // Modify heights multiplying/adding by value
  function modifyHeights(type, add, mult) {
    polygons.map(function(i) {
      if (type === "land") {
        if (i.height >= 0.2) {
          i.height += add;
          var dif = i.height - 0.2;
          var factor = mult;
          if (mult == "^2") {factor = dif}
          if (mult == "^3") {factor = dif * dif;}
          i.height = 0.2 + dif * factor;
        } 
      }
      if (type === "ocean") {
        if (i.height < 0.2 && i.height > 0) {
          i.height += add;
          i.height *= mult;
        } 
      }
      if (type === "all") {
        if (i.height > 0) {
          i.height += add;
          i.height *= mult;
        }
      } 
    });
  }

  // Explore map
  $("#explore").click(function() {
    zoom.on("zoom", zoomed);
    container.transition().duration(3000).attr("transform", "translate(0 0)");
    svg.select("#rose").transition().duration(3000).attr("transform", "translate(75 75) scale(0.2)");
    if (journeyStep == 0) {
      $("#initial, #rose").fadeOut();
      $("#toolbar, #hintbar").fadeIn();
      journeyStep = 1;
      $("#toolbar_step1").fadeIn();
      hintbar.innerHTML = stepHint[journeyStep];
    } else if (journeyStep == -1) {
      $("#initial").fadeOut();
    }
  });

  // New Journey
  $("#new_journey").click(function() {
    zoom.on("zoom", zoomed);
    journeyStep = 1;
    d3.select(".mottling").attr("display", "none");
    $("#initial, #rose").fadeOut();
    $("#toolbar, #hintbar").fadeIn();
    $("#toolbar_step1").fadeIn();
    base.transition().duration(3000).attr("fill", "#5e4fa2");
    svg.append("text").text(stepName[journeyStep]).attr("class", "step")
      .attr("x", mapWidth/6).attr("y", mapHeight/3).transition()
        .duration(3000).style("font-size", "50px").style("fill-opacity", 1)
        .transition().delay(1000)
        .duration(2500).style("font-size", "0px").style("fill-opacity", 0)
      .remove();
    clear();
    calculateVoronoi(samples);
    detectNeighbors();
    hintbar.innerHTML = stepHint[journeyStep];
    container.attr("transform", "translate(0 0)");
    noiseApplied = false;
    $("#precN").attr("prec", 0);
    $("#precE").attr("prec", 0);
    $("#precS").attr("prec", 0);
    $("#precW").attr("prec", 0);
    //toggleGrid();
  });

  // Journey Move back
  function back() {
    $(".step_buttons").fadeOut();
    if (journeyStep == -1) {
      $("#initial").fadeIn();
    } else if (journeyStep == 0) {
      $("#initial, #rose").fadeOut();
      $("#toolbar, #hintbar").fadeIn();
      hintbar.innerHTML = stepHint[journeyStep];
    } else if (journeyStep == 1) {
      $("#new_journey").text("New Journey");
      $("#explore").text("Back to Journey");
      $("#initial").fadeIn();
      $("#toolbar, #hintbar").fadeOut();
    }
    journeyStep--;
    $("#toolbar_step"+journeyStep).toggle();
  }

  // Journey Move forward
  function next() {
    if (hCells.selectAll("*").size()) {
      journeyStep++;
      $(".step_buttons").hide();
      $("#toolbar_step"+journeyStep).toggle();
      svg.append("text").text(stepName[journeyStep]).attr("class", "step")
        .attr("x", mapWidth/6).attr("y", mapHeight/3).transition()
        .duration(3000).style("font-size", "50px").style("fill-opacity", 1)
        .transition().delay(1000).duration(2500).style("font-size", "0px")
        .style("fill-opacity", 0).remove();
      if (journeyStep == 2) {
        viewbox.on(".drag", null);
        $(".container").fadeOut("slow"); 
        coastline.selectAll("*").remove();
        hCells.selectAll("*").remove();
        markFeatures();
        drawOcean([-6,-3,-1], ["#5E78B6","#6d8cc5","#7EABD5"]);
        reGraph();
        if (noiseApplied == false) {addNoise();}
        drawCoastline();
        drawMapBase();
        $(".container").fadeIn("slow"); 
      }
    } else {
      hintbar.innerHTML = "You have to define landmass first!";
    }
  }

  // Toolbar buttons handler
  $(".toolbar_button").click(function() {
    var button = $(this).attr('id');
    var parentButton = $(this).parent().attr('id');
    if (button == "map_mode") {
      var status = map_mode.getAttribute("status");
      if (status == -1) {
        map_mode.setAttribute("status", 0);
        $("#map_mode").text("♒");
        $("#map_mode_rand").show();
        hintbar.innerHTML = "Random mode: place a feature at a random point";
      } else if (status == 0) {
        map_mode.setAttribute("status", 1);
        $("#map_mode").text("✏");
        $("#map_mode_rand").hide();
        $("#map_mode_draw").show();
        viewbox.call(drag);
        hintbar.innerHTML = "Free Draw mode: click or drag to directly change cell heights";
      } else if (status == 1) {
        map_mode.setAttribute("status", 2);
        $("#map_mode").text("➚");
        $("#map_mode_draw").hide();
        $("#map_mode_selection").show();
        hintbar.innerHTML = "Selection mode: click or drag to select cells";
      } else if (status == 2) {
        map_mode.setAttribute("status", -1);
        $("#map_mode").text("☸");
        $("#map_mode_selection").hide();
        hintbar.innerHTML = "Click to change the mode of operation";
        viewbox.on(".drag", null);
      }
    }
    if (parentButton == "map_mode_draw") {$("#map_mode_draw > div").attr("status", 0)}
    if (button == "draw_increase") {$("#draw_increase").attr("status", 1);}
    if (button == "draw_decrease") {$("#draw_decrease").attr("status", 1);}
    if (button == "draw_align") {$("#draw_align").attr("status", 1);}
    if (button == "draw_erase") {$("#draw_erase").attr("status", 1);}
    if (button == "draw_smooth") {$("#draw_smooth").attr("status", 1);}
    if (button == "map_clear") {
      clear();
      polygons.map(function(i) {i.height = 0;});
      cell_cancel.click();
    }
    if (button == "cell_expand") {
      var list = selection.slice();
      list.map(function(i) {
        polygons[i].neighbors.forEach(function(e) {
          if (selection.indexOf(e) == -1) {
            selection.push(e);
          }
        });
      });
      drawSelection();
    }
    if (button == "cell_line") {
      highlighted.selectAll("*").remove();
      highlighting = [];
      if (cell_line.getAttribute("start") == "") {
        var cell = +selection[selection.length-1];
        cell_line.setAttribute("start", cell);
        hintbar.innerHTML = "Click to set selection end cell";
      } else {
        cell_line.setAttribute("start", "");
        hintbar.innerHTML = "Select line of cells";
      }
      drawSelection();
    }
    if (button == "cell_cancel") {
      selection = [];
      $("#cellMenu").hide();
      cell_line.setAttribute("start", "");
      selected.selectAll("*").remove();
      highlighted.selectAll("*").remove();
    }
    if (parentButton == "map_mode_rand") {
      if (button == "rand_hill") {addHill(1, 0.25);}
      if (button == "rand_range") {addRange(1);}
      if (button == "rand_pit") {addPit(1);}
      if (button == "rand_trough") {addRange(-1);}
      drawHeightmap();
      mockCoastline();
    }
    if (button == "map_up" || button == "map_down") {
      var change = +$("#change_power").text();
      var mod = 1;
      if (button == "map_down") {mod = -1;} 
      if (selection.length > 0) {
        var used = selection.slice();
        var frontier = selection.slice();
        frontier.map(function(i) {polygons[i].height += change * mod * (Math.random() * 0.2 + 0.9);});
        while (change > 0.01) {
          var queue = [];
          change -= 0.01 * (Math.random() * 0.4 + 0.8);
          frontier.map(function(i) {
            polygons[i].neighbors.forEach(function(e) {
              if (used.indexOf(e) == -1) {
                used.push(e);
                queue.push(e);
                polygons[e].height += change * mod * (Math.random() * 0.2 + 0.9);
              }
            });
            frontier = queue.slice();
          });
        }
        drawHeightmap();
      } else {
        drawHeightmap(change * mod);
      }
      mockCoastline();
    }
    if (button == "change_power") {
      if ($("#change_power").text() == ".01") {
        $("#change_power").text(".05");
      } else if ($("#change_power").text() == ".05") {
        $("#change_power").text(".10");        
      } else {
        $("#change_power").text(".01"); 
      }
    }
    if (button == "map_relax") {
      if (selection.length > 0) {
         selection.map(function(i) {
           var heights = [polygons[i].height];
           polygons[i].neighbors.forEach(function(e) {heights.push(polygons[e].height);});
           var mean = d3.mean(heights);
           polygons[i].height = (polygons[i].height * 3 + mean) / 4;
         });
      } else {
        polygons.map(function(i) {
          if (i.height > 0) {
            var heights = [i.height];
            i.neighbors.forEach(function(e) {heights.push(polygons[e].height);});
            var mean = d3.mean(heights);
            i.height = (i.height * 3 + mean) / 4;
          }
        });
      }
      drawHeightmap();
      mockCoastline();
    }
    if (button == "map_random") {
      if (selection.length > 0) {
        selection.map(function(i) {
          if (polygons[i].height > 0) {
            var power = +$("#change_power").text();
            var value =  Math.random() * power;
            var mod = 1;
            if (Math.random() > 0.5) {mod = -1;}
            if (polygons[i].height < 0.2) {value /= 10;}
           polygons[i].height += value * mod;
          }
        });
      } else {
        polygons.map(function(i) {
          if (i.height > 0) {
            var power = +$("#change_power").text();
            var value =  Math.random() * power;
            var mod = 1;
            if (Math.random() > 0.5) {mod = -1;}
            if (i.height < 0.2) {value /= 10;}
            i.height += value * mod;
          }
        });
      }
      drawHeightmap();
      mockCoastline();
    }
    if (button == "map_template") {
      $("#map_template_buttons").toggle();
      if ($("#map_template_buttons").is(':visible')) {
        $("#toolbar").css("border-radius", "0 0 4px 0"); 
      } else {
        $("#toolbar").css("border-radius", "0 4px 4px 0");
      }
    }
    if (button == "map_noise") {$("#map_noise_buttons").toggle();}
    if (button == "map_style") {$("#map_style_buttons").toggle();}
    if (button == "map_rand") {$("#map_rand_buttons").toggle();}
    if (parentButton == "map_template_buttons") {
      clear();
      polygons.map(function(i) {i.height = 0; i.type = undefined;});
      cell_cancel.click();
      if (button == "temp_high_island") {templateHighIsland();}
      if (button == "temp_low_island") {templateLowIsland();}
      if (button == "temp_isles") {templateIsles();}
      if (button == "temp_archipelago") {templateArchipelago();}
      if (button == "temp_atoll") {templateAtoll();}
      polygons.map(function(i) {if (i.height < 0.2) {i.height = 0}});
      downgradeBorders();
      mockCoastline();
      smoothOcean();
      drawHeightmap();
    }

    if (button == "generate_noise") {
      addNoise();
      showNoise();
    }
    if (button == "apply_noise") {
      applyNoise();
      noiseApplied = true;
      drawHeightmap();
      mockCoastline();
    }
    if (button == "cancel_noise") {
      drawHeightmap(); 
      mockCoastline();
    }
    if (parentButton == "map_style_buttons") {
      mapStyle.value = button;
      drawMapBase();
    }
    if (button == "map_wind") {
      cancelAnimationFrame(animation);
      animated = false;
      if ($("#main").length) {$("#canvasContainer").empty();}
      $("#map_wind_buttons, .cloud").toggle();
    }
    if (button == "resetZoom") {svg.transition().duration(1000).call(zoom.transform, d3.zoomIdentity);}
    if (button == "back") {back();}
    if (button == "next") {next();}
  });

  // Change hint on button mouseover
  $(".toolbar_button, .cellMenu_button").mouseover(function() {
    var button = $(this).attr("id"), hint;
    // step 1
    if (button == "map_mode") {
      var status = map_mode.getAttribute("status");
      if (status == 1) {
        hint = "Free Draw mode: click or drag to directly change cell heights";
      } else if (status == 2) {
        hint = "Selection mode: click or drag to select cells";
      } else {
        hint = "Random mode: place a feature at a random point";
      }
    }
    if (button == "map_template") {hint = "Apply formation template (current heightmap will be lost)";}
    if (button == "temp_high_island") {hint = "Apply High (Volcanic) Island formation template (overwrite current map)";}
    if (button == "temp_low_island") {hint = "Apply Low Island formation template (overwrite current map)";}
    if (button == "temp_isles") {hint = "Apply Continental Islands formation template (overwrite current map)";}
    if (button == "temp_archipelago") {hint = "Apply Archipelago formation template (overwrite current map)";}
    if (button == "temp_atoll") {hint = "Apply Atoll formation template (overwrite current map)";}
    if (button == "change_power") {hint = "Change brush power";}

    if (button == "draw_increase") {hint = "Increase height by brush power";}
    if (button == "draw_decrease") {hint = "Decrease height by brush power";}
    if (button == "draw_align") {hint = "Spread the clicked cell height";}
    if (button == "draw_erase") {hint = "Set cell height to zero";}
    if (button == "draw_smooth") {hint = "Smooth by taking neigbours cells mean height";}
    if (button == "map_clear") {hint = "Clear the map (all the data will be lost!)";}

    if (button == "map_up") {hint = "Decrease selection height";}
    if (button == "map_down") {hint = "Increase selection height";}
    if (button == "map_relax") {hint = "Smooth the selection";}
    if (button == "map_random") {hint = "Randomize the selection";}
    if (button == "map_noise") {hint = "Overlay with random noise layer";}
    if (button == "map_rand") {hint = "Randomly Place a feature";}
    if (button == "rand_hill") {hint = "Place a random Hill";}
    if (button == "rand_range") {hint = "Place a random Range";}
    if (button == "rand_pit") {hint = "Place a random Pit";}
    if (button == "rand_trough") {hint = "Place a random Trough";}
    // step 2
    if (button == "map_temp") {hint = "Set average annual temperature. Temperature depends this value and land altitude";}
    if (button == "map_wind") {hint = "Toggle wind map. Drag the Cloud to set a prevailing winds";}
    if (button == "map_style") {hint = "Select base map rendering style";}
    if (button == "map_polygonal") {hint = "Polygonal map rendering style";}
    if (button == "map_noisy") {hint = "Noisy map rendering style";}
    if (button == "map_relaxed") {hint = "Relaxed map rendering style";}
    if (button == "map_contours") {hint = "Contours map rendering style";}
    if (button == "map_triangled") {hint = "Triangled map rendering style";}
    if (button == "map_shaded") {hint = "Shaded map rendering style";}
    if (button == "map_flat") {hint = "Flat map rendering style";}
    // general buttons
    if (button == "resetZoom") {hint = "Restore default zoom";}
    if (button == "download") {hint = "Save map in SVG";}
    if (button == "back") {hint = "Back to the previous step";}
    if (button == "next") {hint = "Go to the next step";}
    // cell buttons
    if (button == "cell_expand") {hint = "Expand the selection";}
    if (button == "cell_line") {hint = "Select line of cells";}
    if (button == "cell_cancel") {hint = "Deselect all cells";}
    hintbar.innerHTML = hint;
  }).mouseout(function() {
    hintbar.innerHTML = stepHint[journeyStep];
  });

  // redraw map on options change 
  $("#mapStyle, #mapColor, #mapType").change(function() {
    drawMapBase();
  });

  // recalculate Temperature and redraw map on option change 
  $("#temperatureInput").change(function() {
    defineBiomes();
    drawMapBase();
  });

  // Change Initial Precipitation on cloud click (journey step 2)
  function changePrec() {
    var prec = +$(this).attr("prec");
    prec++;
    if (prec>5) {prec=0;}
    $(this).attr("prec", prec);
    $(this).attr("fill", blue(prec/6));
    var text = "Click to change the fainfall power. Current value: ";
    hintbar.innerHTML = text + prec;
    updatePrec();
  }

  // Show hint on Cloud mousemove (journey step 2)
  function changePrecHint() {
    var prec = +$(this).attr("prec");
    var text = "Click to change the fainfall power. Current value: ";
    hintbar.innerHTML = text + prec;
  }

  // recalculate Precipitation and redraw map on option change 
  function updatePrec() {
    riversShade.selectAll("path").remove();
    rivers.selectAll("path").remove();
    polygons.map(function(i) {
      i.precipitation = 0;
      i.flux = undefined;
      i.river = undefined;
    })
    calculatePrecipitation();
    //defineBiomes();
  }

  // redraw coastline on coast style change
  $("#coastStyle").change(function() {
    drawCoastline();
  });

  // Draw of remove blur polygons on input change
  $("#blurInput").change(function() {
    if (blurInput.checked == true) {
      d3.selectAll(".mapCells")
        .attr("filter", "url(#blurFilter)");    
    } else {
      d3.selectAll(".mapCells")
        .attr("filter", "");    
    }
  });

  // Switch map color scheme
  function switchColor() {
    d3.selectAll(".blur").remove();
    if (blurInput.valueAsNumber > 0) {
      var limit = 0.2;
      if (seaInput.checked == true) {
        limit = 0;
      }
      polygons.map(function(i) {
        if (i.height >= limit) {
          mapCells.append("path")
            .attr("d", "M" + i.join("L") + "Z")
            .attr("class", "blur")
            .attr("stroke-width", blurInput.valueAsNumber)
            .attr("stroke", bright(1 - i.height));
        }
      });
    }
  }

  // Toggle polygons strokes on input change
  $("#strokesInput").change(function() {
    toggleGrid();
  });

  function toggleGrid() {
    if (grid.selectAll("*").empty()) {
      var d = "";
      polygons.map(function(i) {
        d += "M" + i.join("L") + "Z";
      });
      grid.append("path").attr("d", d);
    } else {
      grid.selectAll("*").remove();
    }
  }

  // Toggle precipitation map
  $("#fluxInput").change(function() {
    if (fluxInput.checked == true) {
      polygons.map(function(i) {
        if (i.height >= 0.2) {
          mapCells.append("path")
            .attr("d", "M" + i.join("L") + "Z")
            .attr("stroke", blue(i.precipitation))
            .attr("fill", blue(i.precipitation))
            .attr("class", "flux");
        }
      });
    } else {
      d3.selectAll(".flux").remove();
    }
  });

  // Toggle slope hatching
  $("#hatchingInput").change(function() {
    if (hatchingInput.checked == true) {
      console.time("slopeHatching");
      d3.range(0, mapHeight).forEach(function(y) {
        d3.range(0, mapWidth).forEach(function(x) {
          var point = x + y * mapWidth;
          var height = pointsHeights[point];
          if (height >= 0.2) {
            var delta = pointsHeights[point] - pointsHeights[point-1];
            if (Math.abs(delta) > 0.05) {
              var dx = x - 0.4 + Math.random() * 0.8;
              var dy = y - 0.4 + Math.random() * 0.8;
              var l = Math.abs(delta) * 50;
              var h = delta * -10 * height;
              if (l > 1) {l =1;}
              if (l < 0.5) {l = 0.5;}
              if (h > 0.4) {h = 0.4;}
              if (h < -0.4) {h = -0.4;}
              var d = dx+" "+dy+" l"+l+" "+h;
              hatching.append("path").attr("d", "M" + d + "Z");
            }
          }
        });
      });
      console.timeEnd("slopeHatching");
    } else {
      hatching.selectAll("path").remove();
    }
  });

  // Descrease or increase land
  function elevateLand(mod) {
    polygons.map(function(i) {
      if (i.height >= 0.2) {i.height += mod;}
    });
  }

  function downcutRivers() {
    console.time("downcutRivers");
    var downcut = downcuttingInput.valueAsNumber;
    polygons.map(function(i) {
      if (i.flux >= 0.85 && i.height >= 0.21) {
        i.height -= downcut / 10; 
      }
    });
    console.timeEnd("downcutRivers");
  }

  function randomizePrecipitation() {
    var total = 0;
    function rndPrec() {
      if (Math.random() > 0.2) {
        var prec = Math.floor(Math.random() * 12) + 6;
      } else {
        var prec = Math.floor(Math.random() * 18) + 2;
      }
      return prec;
    }
    Math.random() >= 0.75 ? prec = rndPrec() : prec = 0;
    $("#precN").attr("prec", prec);
    total = prec;
    Math.random() >= 0.75 ? prec = rndPrec() : prec = 0;
    $("#precE").attr("prec", prec);
    total += prec;
    Math.random() >= 0.75 ? prec = rndPrec() : prec = 0;
    $("#precS").attr("prec", prec);
    total += prec;
    Math.random() >= 0.75 ? prec = rndPrec() : prec = 0;
    $("#precW").attr("prec", prec);
    total += prec;
    if (total == 0) {$("#precW").attr("prec", 12)}
  }

  function calculatePrecipitation() {
    console.time("calculatePrecipitation");
    var precN = +$("#precN").attr("prec");
    var precE = +$("#precE").attr("prec");
    var precS = +$("#precS").attr("prec");
    var precW = +$("#precW").attr("prec");
    if (precN > 0) {
      var frontier = $.grep(polygons, function(e) {
        return (e.data[1] < precN * 10 && e.data[0] > mapWidth*0.1 && e.data[0] < mapWidth*0.9);
      });
      frontier.map(function(i) {
        var x = i.data[0], y = i.data[1];
        var precipitation = precN;
        while (y < mapHeight * 0.9 && precipitation > 0) {
          y += 10;
          x += Math.floor(Math.random() * 20 - 10);
          precipitation = rainfall(x, y, precipitation);
        }
      });
    }
    if (precE > 0) {
      var frontier = $.grep(polygons, function(e) {
        return (e.data[0] * 10 > mapWidth-precE && e.data[1] > mapHeight*0.1 && e.data[1] < mapHeight*0.9);
      });
      frontier.map(function(i) {
        var x = i.data[0], y = i.data[1];
        var precipitation = precE;
        while (x > mapWidth * 0.1 && precipitation > 0) {
          x -= 10;
          y += Math.floor(Math.random() * 20 - 10);
          precipitation = rainfall(x, y, precipitation);
        }
      });
    }
    if (precS > 0) {
      var frontier = $.grep(polygons, function(e) {
        return (e.data[1] * 10 > mapHeight-precS && e.data[0] > mapWidth*0.1 && e.data[0] < mapWidth*0.9);
      });
      frontier.map(function(i) {
        var x = i.data[0], y = i.data[1];
        var precipitation = precS;
        while (y > mapHeight * 0.1 && precipitation > 0) {
          y -= 10;
          x += Math.floor(Math.random() * 20 - 10);
          precipitation = rainfall(x, y, precipitation);
        }
      });
    }
    if (precW > 0) {
      var frontier = $.grep(polygons, function(e) {
        return (e.data[0] * 10 < precW && e.data[1] > mapHeight*0.1 && e.data[1] < mapHeight*0.9);
      });
      frontier.map(function(i) {
        var x = i.data[0], y = i.data[1];
        var precipitation = precW;
        while (x < mapWidth * 0.9 && precipitation > 0) {
          x += 10;
          y += Math.floor(Math.random() * 20 - 10);
          precipitation = rainfall(x, y, precipitation);
        }
      });
    }
    // Smooth precipitation by taking average values of all neighbors
    polygons.map(function(i) {
      if (i.height >= 0.2) {
        var prec = [i.precipitation];
        i.neighbors.forEach(function(e) {
          prec.push(polygons[e].precipitation);
        });
        var mean = d3.mean(prec);
        if (i.precipitation < mean) {
          i.precipitation = mean;
        }
        i.flux = i.precipitation;
        if (i.precipitation < 0.01) {
          i.precipitation = 0.01;
        }
      }
    });
    console.timeEnd("calculatePrecipitation");
  }

  function rainfall(x, y, precipitation) {
    if (x < 0) {x = 0;}
    if (y < 0) {y = 0;}
    if (x >= mapWidth) {y = mapWidth-1;} 
    if (y >= mapHeight) {y = mapHeight-1;}
    var height = pointsHeights[x + y * mapWidth];
    if (height >= 0.2) {
      var cell = pointsCells[y][x];
      if (height < 0.6) {
        var rain = Math.random() * height;
        precipitation -= rain;
        polygons[cell].precipitation += rain;
      } else {
        precipitation = 0;
        polygons[cell].precipitation += precipitation;
      }
    }
  return precipitation;
  }

  function unifyPrecipitation() {
    polygons.map(function(i) {
      if (i.height >= 0.2) {
        i.flux = 0.1;
        i.precipitation = 0.3;
      }
    });
  }

  function resolveDepressions() {
    console.time('resolveDepressions');
    land = $.grep(polygons, function(e) {
      return (e.height >= 0.2);
    });
    var depression = 1, minCell, minHigh;
    while (depression > 0) {
      depression = 0;
      for (var i = 0; i < land.length; i++) {
        minHigh = 10;
        land[i].neighbors.forEach(function(e) {
          if (polygons[e].height < minHigh) {
            minHigh = polygons[e].height;
            minCell = e;
          }
        });
        if (land[i].height <= polygons[minCell].height) {
          depression += 1;
          land[i].height = polygons[minCell].height + 0.01;
        }
      }
    }
    land.sort(compareHeight);
    console.timeEnd('resolveDepressions');
    flux();
  }

  function compareHeight(a, b) {
    if (a.height < b.height) return 1;
    if (a.height > b.height) return -1;
    return 0;
  }

  function compareOrder(a, b) {
    if (a.order < b.order) return 1;
    if (a.order > b.order) return -1;
    return 0;
  }

  function sortNumber(a, b) {
    return a - b;
  }

  function flux() {
    console.time('flux');
    riversData = [];
    var riversOrder = [], confluence = [];
    var oposite, riverNext = 0;
    for (var i = 0; i < land.length; i++) {
      var pour = [], id = land[i].index;
      var min, minHeight = 1;
      diagram.cells[id].halfedges.forEach(function(e) {
        var edge = diagram.edges[e];
        var ea = edge.left.index;
        if (ea === id || !ea) {
          ea = edge.right.index;
        }
        if (ea) {
          if (polygons[ea].height < minHeight) {
            min = ea;
            minHeight = polygons[ea].height;
          }
          // Define neighbour ocean cells for deltas
          if (polygons[ea].height < 0.2) {
            var xDiff = (edge[0][0] + edge[1][0]) / 2;
            var yDiff = (edge[0][1] + edge[1][1]) / 2;
            pour.push({x:xDiff, y:yDiff, cell:ea});
          }
        }
      })
      // Define river number
      if (!land[i]) {console.log("- Land cell is undefined!")}
      if (land[i].flux > 0.85) {
        if (!land[i].river) {
          // State new River
          land[i].river = riverNext;
          var rnd = Math.random() / 1000;
          riversOrder.push({r: riverNext, order: rnd});
          riversData.push({river: riverNext,
            cell: id, x: land[i].data[0],
            y: land[i].data[1], type: "source"});
          riverNext += 1;
        }
        // Assing existing River to the downhill cell
        if (!polygons[min].river) {
          polygons[min].river = land[i].river;
        } else {
          var riverTo = polygons[min].river;
          var iRiver = $.grep(riversData, function(e) {
            return (e.river == land[i].river);
          });
          var minRiver = $.grep(riversData, function(e) {
            return (e.river == riverTo);
          });
          var iRiverL = iRiver.length;
          var minRiverL = minRiver.length;
          // re-assing river nunber if new part is greater
          if (iRiverL >= minRiverL) {
            riversOrder[land[i].river].order += iRiverL;
            polygons[min].river = land[i].river;
            iRiverL += 1;
            minRiverL -= 1;
          } else {
            if (!riversOrder[riverTo]) {
              console.log("- Order Error!");
              riversOrder[riverTo] = [];
              riversOrder[riverTo].order = minRiverL;
            } else {
              riversOrder[riverTo].order += minRiverL;
            }
          }
          // mark confluences
          if (polygons[min].height >= 0.2 && iRiverL > 1 && minRiverL > 1) {
            if (iRiverL >= minRiverL) {
              confluence.push({id: min, s: id, l: iRiverL, r: land[i].river})
            }
            if (!polygons[min].confluence) {
              polygons[min].confluence = 2;
              var cellTo = minRiver[minRiverL-1].cell;
              if (cellTo == min) {
                cellTo = minRiver[minRiverL-2].cell;
              }
              confluence.push({id: min, s: cellTo, l: minRiverL-1, r: riverTo})
            } else {
              polygons[min].confluence += 1;
            }
            if (iRiverL < minRiverL) {
              confluence.push({id: min, s: id, l: iRiverL, r: land[i].river})
            }
          }
        }
      }
      polygons[min].flux += land[i].flux;
      if (land[i].precipitation * 0.97> polygons[min].precipitation) {
        polygons[min].precipitation = land[i].precipitation * 0.97
      }
      if (land[i].river) {
        if (polygons[min].height < 0.2) {
          // pour water to the Ocean
          if (land[i].flux > 14 && pour.length > 1 && !land[i].confluence) {
            // River Delta
            for (var c = 0; c < pour.length; c++) {
              if (c == 0) {
                riversData.push({river: land[i].river,
                  cell: id, x: pour[0].x,
                  y: pour[0].y, type: "delta",
                  pour: pour[0].cell});
              } else {
                riversData.push({river: riverNext,
                  cell: id, x: land[i].data[0],
                  y: land[i].data[1], type: "course"});
                riversData.push({river: riverNext,
                  cell: id, x: pour[c].x,
                  y: pour[c].y, type: "delta",
                  pour: pour[0].cell});
                riverNext += 1;
              }
            }
          } else {
            // River Estuary
            var x = pour[0].x+(pour[0].x-land[i].data[0])/10;
            var y = pour[0].y+(pour[0].y-land[i].data[1])/10;
            riversData.push({river: land[i].river,
              cell: id, x: x, y: y,
              type: "estuary", pour: pour[0].cell});
          }
        }
        else {
          // add next River segment
          riversData.push({river: land[i].river,
            cell: min, x: polygons[min].data[0],
            y: polygons[min].data[1], type: "course"});
        }
      }
    }
    console.timeEnd('flux');
    riversOrder.sort(compareOrder);
    drawRiverLines(riversOrder, confluence);
  }

  function drawRiverLines(riversOrder, confluence) {
    console.time('drawRiverLines');
    var dataRiver, x, y, line, side = 1, confAngles = [];
    lineGen.curve(d3.curveCatmullRom.alpha(0.1));
    for (var i = 0; i < riversOrder.length; i++) {
      dataRiver = $.grep(riversData, function(e) {
        return (e.river == riversOrder[i].r);
      });
      var order = riversOrder[i].r;
      var riverAmended = [];
      if (dataRiver.length > 1) {
        if (dataRiver.length > 2 || dataRiver[1].type == "delta") {
          // add more river points on 1/3 and 2/3 of length
          for (var r = 0; r < dataRiver.length; r++) {
            var dX = dataRiver[r].x;
            var dY = dataRiver[r].y;
            riverAmended.push({scX:dX, scY:dY});
            if (r+1 < dataRiver.length) {
              var eX = dataRiver[r+1].x;
              var eY = dataRiver[r+1].y;
              var angle = Math.atan2(eY - dY, eX - dX);
              if (dataRiver[r+1].type == "course") {
                var meandr = 0.4 + Math.random() * 0.3;
                var stX = (dX * 2 + eX) / 3;
                var stY = (dY * 2 + eY) / 3;
                var enX = (dX + eX * 2) / 3;
                var enY = (dY + eY * 2) / 3;
                if (Math.random() > 0.5) {side *= -1};
                stX += -Math.sin(angle) * meandr * side;
                stY += Math.cos(angle) * meandr * side;
                if (Math.random() > 0.6) {side *= -1};
                enX += Math.sin(angle) * meandr * side;
                enY += -Math.cos(angle) * meandr * side;
                riverAmended.push({scX:stX, scY:stY});
                riverAmended.push({scX:enX, scY:enY});
              } else {
                var meandr = 0.2 + Math.random() * 0.1;
                var mX = (dX + eX) / 2;
                var mY = (dY + eY) / 2;
                mX += -Math.sin(angle) * meandr * side;
                mY += Math.cos(angle) * meandr * side;
                riverAmended.push({scX:mX, scY:mY});
              }
            }
          }
        }
        var d = lineGen(riverAmended);
        if (dataRiver[1].type == "delta") {
          riversShade.append("path").attr("d", d).attr("stroke-width", 0.2);
          rivers.append("path").attr("d", d).attr("stroke-width", 0.6);
        } else {
          var river = defs.append("path").attr("d", d);
          var path = river.node().getPathData();
          var count = 1, width = 0;
          for (var s = 1; s < path.length; s++) {
            var segment = "";
            if (s == 1) {
              var sX = path[0].values[0];
              var sY = path[0].values[1];
            } else {
              var sX = path[s-1].values[4];
              var sY = path[s-1].values[5];
            }
            var eX = path[s].values[4];
            var eY = path[s].values[5];
            var xn = eX, yn = eY;
            var to = diagram.find(eX, eY, 0.01);
            var riverWidth = (count + width * 3) / 50;
            var curve = " C"+ path[s].values[0]+"," +path[s].values[1] + ", " + path[s].values[2]+"," +path[s].values[3];
            count += 1;   
            if (to) {
              if (polygons[to.index].confluence) {
                var confData = $.grep(confluence, function(e) {
                  return (e.id == to.index);
                });       
                if (s+1 !== path.length) {
                  var angle = Math.atan2(eY - path[s].values[3], eX - path[s].values[2]);
                  confAngles[to.index] = angle;
                  // Tributaries use Main Stem's angle and amended curve
                  var angle = confAngles[to.index];
                  var midX = (path[s].values[0] + path[s].values[2]) / 2;
                  var midY = (path[s].values[1] + path[s].values[3]) / 2;
                  var curve = " C"+ path[s].values[0]+"," +path[s].values[1] + ", " + midX + "," + midY;
                  if (angle == undefined) {
                    // if tributary rendered before main stem only
                    var angle = Math.atan2(eY - path[s].values[3], eX - path[s].values[2]);
                  }
                }
                var flux = polygons[to.index].flux;
                count = 0, width = Math.pow(flux, 0.9);
                var df = (width * 3 / 50 - riverWidth) / 2;
                var c1 = confData[0].s;
                var c2 = confData[1].s;
                var bX = (polygons[c1].data[0] + polygons[c2].data[0])/2;
                var bY = (polygons[c1].data[1] + polygons[c2].data[1])/2;
                var xl = -Math.sin(angle) * df + eX;
                var yl = Math.cos(angle) * df + eY;
                var xr = Math.sin(angle) * df + eX;
                var yr = -Math.cos(angle) * df + eY;
                var cross = ((bX-eX)*(sY-eY) - (bY-eY)*(sX-eX));
                if (cross > 0) {
                  xn = xr;
                  yn = yr;
                } else {
                  xn = xl;
                  yn = yl;
                }
              }
            }
            segment += sX +","+sY + curve + "," + xn+"," +yn;
            var shadowWidth = riverWidth/3;
            if (shadowWidth < 0.1) {shadowWidth = 0.1;}
            riversShade.append("path").attr("d", "M"+segment)
              .attr("stroke-width", shadowWidth);
            rivers.append("path").attr("d", "M"+segment)
              .attr("stroke-width", riverWidth);
          }
        }
      }
    }
    console.timeEnd('drawRiverLines');
  }

  function defineBiomes() {
    console.time('defineBiomes');
    var temperature, temp, prec;
    pointsBiomes = [];
    if (randomTemp.checked) {
      var rand = Math.random();
      if (rand > 0.5) {
        temperature = Math.floor(Math.random() * 6) + 7;
      } else if (rand > 0.2) {
        temperature = Math.floor(Math.random() * 10) + 5;
      } else {
        temperature = Math.floor(Math.random() * 20);
      }
      temperatureInput.value = temperature;
      temperatureOutput.value = temperature;
    } else {
      temperature = temperatureInput.value;
    }
    d3.range(0, mapHeight).forEach(function(y) {
      d3.range(0, mapWidth).forEach(function(x) {
        var height = pointsHeights[x + y * mapWidth];
        if (height >= 0.2) {
          var cell = pointsCells[y][x];
          prec = getPrecipitation(polygons[cell].precipitation);
          temp = Math.floor(polygons[cell].height * 100 - (temperature - 12) / 0.2); 
          if (temp > 99) {temp = 99;} // max value
          if (temp < 0) {temp = 0;} // min value
          pointsBiomes.push(biomIDs[prec][temp]);
        } else {
          pointsBiomes.push(-1);
        }
      });
    });
    polygons.map(function(i) {
      if (i.height >= 0.2) {
        var prec = getPrecipitation(i.precipitation);
        var temp = Math.floor(i.height * 100 - (temperature - 12) / 0.2); 
        if (temp > 99) {temp = 99;} // max value
        if (temp < 0) {temp = 0;} // min value
        i.biom = biomIDs[prec][temp];
        i.biomColor = biomGrad[prec][temp];
      }
    });
    console.timeEnd('defineBiomes');
  }

  // genearal update on mousemove
  function moved() {
    var point = d3.mouse(this),
        x = Math.floor(point[0]),
        y = Math.floor(point[1]),
        i = diagram.find(x, y).index; 
    if (journeyStep == 1 && $("#map_mode").attr("status") > 0) {
      cursored.selectAll("path").transition().duration(50).style("opacity", 0).remove();
      var d = "M" + polygons[i].join("L") + "Z";
      cursored.append("path").attr("d", d).attr("stroke", "white").attr("stroke-width", 0.3);
      cursored.append("path").attr("d", d).attr("stroke", "black").attr("stroke-width", 0.1);
    }
    $("#cell").text(i);
    $("#heightPoint").text(pointsHeights[x + y * mapWidth]);
    if (polygons[i].feature) {
      $("#feature").text(polygons[i].feature);
    } else {
      $("#feature").text("n/a");
    }
    if (polygons[i].precipitation) {
      var prec = Math.floor(polygons[i].precipitation * 500);
      $("#precipitation").text(prec);
    } else {
      $("#precipitation").text("n/a");
      var prec = "ocean";
    }
    if (polygons[i].biom) {
      $("#biom").text(biomNames[polygons[i].biom]);
    } else {
      $("#biom").text("no");
    }
    var height = (polygons[i].height).toFixed(2);
    $("#height").text(height);    
    if (height >= 0.2) {
      var temp = Math.floor(temperatureInput.value - (polygons[i].height - 0.2) * 20);
      $("#temperature").text(temp);
    } else {
      var temp = temperatureInput.value;
      $("#temperature").text(temperatureInput.value);
    }
    if (height >= 0.2) {
      var elev = Math.ceil((height-0.195) * 4000 * height);
    } else if (height < 0.2 && height > 0) {
      var elev = Math.ceil((height-0.2) * 70 / height);
    } else {
      var elev = "-1000";
    }
    $("#elevation").text(elev);
    if (journeyStep > 0) {
      if (height > 0) {
        if (journeyStep === 1) {
          var hint = "Height: " + height + " (" + elev + " m)";
        } else if (journeyStep === 2) {
          if (prec !== "ocean") {
            var hint = "Height: " + elev + "m " + "Temperature: " + temp + "°C " + "Precipitation: " + prec + "cm";
          } else {
            var hint = "Height: " + elev + "m " + "Temperature: " + temp + "°C";
          }
        }      
      }
      $("#hintbar").text(hint);
    }
    if (polygons[i].river) {
      $("#river").text(polygons[i].river);
    } else {
      $("#river").text("no");
    }
    // cell_line highlighting
    if (cell_line.getAttribute("start") != "") {
      var next = +cell_line.getAttribute("start");
      highlighted.selectAll("*").remove();
      highlighting = [];
      // from to i
      while (next != i) {
        var min = 1000;
        polygons[next].neighbors.forEach(function(e) {
          var x = polygons[i].data[0] - polygons[e].data[0];
          var y = polygons[i].data[1] - polygons[e].data[1];
          var diff = Math.hypot(x, y);
          if (diff < min) {
            min = diff;
            next = e;
          }
        });
        highlighting.push(next);
      }
      highlighting.map(function(h) {
        highlighted.append("path")
          .attr("d", "M" + polygons[h].join("L") + "Z");
      });
    }
  }

  function simulateWind(trend, winds) {
    if ($("#main").length == 0) {
      $("#canvasContainer").append("<canvas id='main' width='960' height='540'></canvas>");
      $("#canvasContainer").append("<canvas class='off' width='960' height='540' style='display: none;'></canvas>");
    }
    cancelAnimationFrame(animation);
    boids = []; // remove all elements
    var init = new Vec2(Math.cos(trend) * 0.25, Math.sin(trend) * 0.25); // initial change
    var persistence = init.clone().scale(persistenceInput.value); // persistence of change (1% of initial change)
    var waterPolygons = $.grep(polygons, function(e) {return (e.height < 0.2);});
    var canvas = document.getElementById("main"),
      context = canvas.getContext("2d"),
      offscreen = document.querySelector(".off"),
      offscreenContext = offscreen.getContext("2d"),
      elements = 800,
      wave = 7,
      maxVelocity = 2;
    offscreenContext.globalAlpha = 0.95;
    offscreenContext.clearRect(0, 0, mapWidth, mapHeight);
    context.clearRect(0, 0, mapWidth, mapHeight);
    animation = requestAnimationFrame(tick);
    animated = true;

    $("#map_wind_animation").click(function() {
      if (animated) {
        cancelAnimationFrame(animation);
        animated = false;
      } else {
        animation = requestAnimationFrame(tick);
        animated = true;
      }
    });

    function tick() {
      offscreenContext.clearRect(0, 0, mapWidth, mapHeight);
      offscreenContext.drawImage(canvas, 0, 0, mapWidth, mapHeight);
      context.clearRect(0, 0, mapWidth, mapHeight);
      context.drawImage(offscreen, 0, 0, mapWidth, mapHeight);
      var angleMod = angleInput.value;
      if (elements - boids.length >= wave) {
        if (boids.length > 200) {addInternalBlow(Math.floor(wave*0.2));} 
        addExternalBlows(Math.floor(wave*0.8));
      }
      boids.forEach(function(b, i){
        var x = Math.ceil(b.pos.x); 
        var y = Math.ceil(b.pos.y);
        var hCur = pointsCellHeights[x + y * mapWidth];
        if (!hCur) {hCur = 0.2;}
        var fPos = b.pos.clone().add(b.change);
        var x = Math.ceil(fPos.x); 
        var y = Math.ceil(fPos.y);
        var hNew = pointsHeights[x + y * mapWidth];
        if (!hNew) {boids.splice(i, 1); return;}
        var alignment = new Vec2();
        var separation = new Vec2();
        boids.forEach(function(b2){
          if (b === b2) {return;}
          var diff = b2.pos.clone().subtract(b.pos);
          var distance = diff.length();
          if (distance) {
            if (distance < 5 && hNew < 0.2) {
              boids.splice(i, 1); // remove element;
              return;
            }
            if (distance < 5) {separation.add(diff.clone().scaleTo(-1 / distance));}
            if (distance < 20) {alignment.add(b2.change.clone().scale(1 / distance));}
          }
        });
        if (hCur >= 0.2 && hNew >= 0.2) {
          var dif = (hCur - hNew) * 3;
          var cliff = hNew - 0.25;
          if (cliff < 0) {cliff = 0.01;}
          var angle = dif * cliff * angleMod;

          var lc = b.change.clone().turn(angle).scaleTo(10);
          var rc = b.change.clone().turn(angle * -1).scaleTo(10);
          var lp = b.pos.clone().add(lc);
          var rp = b.pos.clone().add(rc);
          var lh = pointsHeights[Math.ceil(lp.x) + Math.ceil(lp.y) * mapWidth];
          var rh = pointsHeights[Math.ceil(rp.x) + Math.ceil(rp.y) * mapWidth];
          if (lh < rh) {b.change.turn(angle);} else {b.change.turn(angle * -1);}
          b.change.scale(0.8 + dif);
        } else {
          b.change.scale(1.01).scaleTo(maxVelocity);
        }
        b.change.add(alignment.scaleTo(alignmentInput.value));
        b.change.add(separation.scale(separationInput.value));
        b.change.add(persistence).truncate(maxVelocity);
        b.pos.add(b.change);
        if (b.change.length() > 0.1) {
          context.beginPath();
          context.fillStyle = $(".jscolor").css("background-color");
          context.arc(b.pos.x, b.pos.y, 1, 1, Math.PI);
          context.fill();
        } else {
          boids.splice(i, 1); // remove element;
          return;
        }
      });
      $("#info").text(boids.length);
      animation = requestAnimationFrame(tick);
    }

    function addExternalBlows(count) {
      for (var i = 0; i < count; i++) {
        var x, y;
        if (Math.random() > 0.5) {
          if (winds === "North-East" || winds === "South-East") {x = mapWidth;}
          if (winds === "North-West" || winds === "South-West") {x = 0;}
          y = Math.floor(Math.random() * mapHeight);
        } else {
          if (winds === "South-West" || winds === "South-East") {y = mapHeight-1;}
          if (winds === "North-West" || winds === "North-East") {y = 0;}
          x = Math.floor(Math.random() * mapWidth);
        }
        if (winds === "North") {y = 0; x = Math.floor(Math.random() * mapWidth);}
        if (winds === "South") {y = mapHeight-1; x = Math.floor(Math.random() * mapWidth);}
        if (winds === "West") {x = 0; y = Math.floor(Math.random() * mapHeight);}
        if (winds === "East") {x = mapWidth; y = Math.floor(Math.random() * mapHeight);}
        boids.push({pos: new Vec2(x, y), change: init.clone()});
      }
    }

    function addInternalBlow(count) {
      for (var i = 0; i < count; i++) {
        var p = Math.floor(Math.random() * waterPolygons.length);
        var x = waterPolygons[p].data[0];
        var y = waterPolygons[p].data[1];
        boids.push({pos: new Vec2(x, y), change: init.clone()});
      }
    }
  }

  // Based on https://www.jasondavies.com/poisson-disc
  function poissonDiscSampler(width, height, radius) {
    var k = 5, // maximum number of samples before rejection
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
    switch(d3.event.keyCode) {
      case 27: // Escape for back
        back();
        break;
       case 13: // Enter for next
        next();
        break;
       case 32: // Space for next
        next();
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
  });

  // Downoad map in SVG
  d3.select("#download").on("click", function() {
    var config = {filename: 'map_dowloaded',}
    d3_save_svg.save(d3.select('svg').node(), config);
    svg.selectAll("*").attr("style", null);
  });
}