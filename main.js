// Fantasy Map Generator main script
// Azgaar (maxganiev@yandex.com). Minsk, 2017-2019
// https://github.com/Azgaar/Fantasy-Map-Generator
// MIT License

// I don't mind of any help with programming.
// See also https://github.com/Azgaar/Fantasy-Map-Generator/issues/153

"use strict";
const version = "0.80b"; // generator version
document.title += " v " + version;

// append svg layers (in default order)
let svg = d3.select("#map");
let defs = svg.select("#deftemp");
let viewbox = svg.select("#viewbox");
let scaleBar = svg.select("#scaleBar");
let ocean = viewbox.append("g").attr("id", "ocean");
let oceanLayers = ocean.append("g").attr("id", "oceanLayers");
let oceanPattern = ocean.append("g").attr("id", "oceanPattern");
let lakes = viewbox.append("g").attr("id", "lakes");
let landmass = viewbox.append("g").attr("id", "landmass");
let texture = viewbox.append("g").attr("id", "texture");
let terrs = viewbox.append("g").attr("id", "terrs");
let biomes = viewbox.append("g").attr("id", "biomes");
let cells = viewbox.append("g").attr("id", "cells");
let gridOverlay = viewbox.append("g").attr("id", "gridOverlay");
let coordinates = viewbox.append("g").attr("id", "coordinates");
let compass = viewbox.append("g").attr("id", "compass");
let rivers = viewbox.append("g").attr("id", "rivers");
let terrain = viewbox.append("g").attr("id", "terrain");
let cults = viewbox.append("g").attr("id", "cults");
let regions = viewbox.append("g").attr("id", "regions");
let statesBody = regions.append("g").attr("id", "statesBody");
let statesHalo = regions.append("g").attr("id", "statesHalo");
let borders = viewbox.append("g").attr("id", "borders");
let routes = viewbox.append("g").attr("id", "routes");
let roads = routes.append("g").attr("id", "roads");
let trails = routes.append("g").attr("id", "trails");
let searoutes = routes.append("g").attr("id", "searoutes");
let temperature = viewbox.append("g").attr("id", "temperature");
let coastline = viewbox.append("g").attr("id", "coastline");
let prec = viewbox.append("g").attr("id", "prec").attr("display", "none");
let population = viewbox.append("g").attr("id", "population");
let labels = viewbox.append("g").attr("id", "labels");
let icons = viewbox.append("g").attr("id", "icons");
let burgIcons = icons.append("g").attr("id", "burgIcons");
let anchors = icons.append("g").attr("id", "anchors");
let markers = viewbox.append("g").attr("id", "markers");
let ruler = viewbox.append("g").attr("id", "ruler").attr("display", "none");
let debug = viewbox.append("g").attr("id", "debug");

let freshwater = lakes.append("g").attr("id", "freshwater");
let salt = lakes.append("g").attr("id", "salt");

labels.append("g").attr("id", "states");
labels.append("g").attr("id", "addedLabels");

let burgLabels = labels.append("g").attr("id", "burgLabels");
burgIcons.append("g").attr("id", "cities");
burgLabels.append("g").attr("id", "cities");
anchors.append("g").attr("id", "cities");

burgIcons.append("g").attr("id", "towns");
burgLabels.append("g").attr("id", "towns");
anchors.append("g").attr("id", "towns");

// population groups
population.append("g").attr("id", "rural");
population.append("g").attr("id", "urban");

scaleBar.on("mousemove", function() {tip("Click to open Units Editor");}) // assign event separately as not a viewbox child

// main data variables
let grid = {}; // initial grapg based on jittered square grid and data
let pack = {}; // packed graph and data
let seed, mapHistory = [], elSelected, autoResize = true, modules = {}, notes = [];
let customization = 0; // 0 - no; 1 = heightmap draw; 2 - states draw; 3 - add state/burg; 4 - cultures draw
let mapCoordinates = {}; // map coordinates on globe
let winds = [225, 45, 225, 315, 135, 315]; // default wind directions
let biomesData = applyDefaultBiomesSystem();
let nameBases = [], nameBase = []; // Cultures-related data
const fonts = ["Almendra+SC", "Georgia", "Times+New+Roman", "Comic+Sans+MS", "Lucida+Sans+Unicode", "Courier+New"]; // default web-safe fonts

let color = d3.scaleSequential(d3.interpolateSpectral); // default color scheme
const lineGen = d3.line().curve(d3.curveBasis); // d3 line generator with default curve interpolation

// d3 zoom behavior
let scale = 1, viewX = 0, viewY = 0;
const zoom = d3.zoom().scaleExtent([1, 20]).on("zoom", zoomed);

applyStoredOptions();
let graphWidth = +mapWidthInput.value; // voronoi graph extention, should be stable for each map
let graphHeight = +mapHeightInput.value;
let svgWidth = graphWidth, svgHeight = graphHeight;  // svg canvas resolution, can vary for each map
landmass.append("rect").attr("x", 0).attr("y", 0).attr("width", graphWidth).attr("height", graphHeight);
oceanPattern.append("rect").attr("fill", "url(#oceanic)").attr("x", graphWidth * -.2).attr("y", graphHeight * -.2).attr("width", graphWidth * 1.4).attr("height", graphHeight * 1.4);
oceanLayers.append("rect").attr("id", "oceanBase").attr("x", graphWidth * -.2).attr("y", graphHeight * -.2).attr("width", graphWidth * 1.4).attr("height", graphHeight * 1.4);

// equator Y position limits
equatorOutput.min = equatorInput.min = graphHeight * -1;
equatorOutput.max = equatorInput.max = graphHeight * 2;

applyDefaultNamesData(); // apply default namesbase on load
applyDefaultStyle(); // apply style on load
generate(); // generate map on load
focusOn(); // based on searchParams focus on point, cell or burg from MFCG
addDragToUpload(); // allow map loading by drag and drop

// show message on load if required
setTimeout(showWelcomeMessage, 8000);
function showWelcomeMessage() {
  // Changelog dialog window
  if (localStorage.getItem("version") != version) {
    const link = 'https://www.reddit.com/r/FantasyMapGenerator/comments/bfskpi/update_stable_version_is_released_v_08b/?utm_source=share&utm_medium=web2x'; // announcement on Reddit
    alertMessage.innerHTML = `The Fantasy Map Generator is updated up to version <b>${version}</b>.

      This version is <b>not compatible</b> with older <i>.map</i> files. 
      Please use an <a href='https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog' target='_blank'>archived version</a> to open the file.

      <ul><a href=${link} target='_blank'>Main changes:</a>
        <li>World size and climate configuration</li>
        <li>Biomes layer and biomes editor</li>
        <li>Temperature and precipitation layers</li>
        <li>Reworked population model (now depends on biome)</li>
        <li>New states and cultures spread algorithm</li>
        <li>15 new cultures</li>
        <li>Texture layer and ability to link a custom texture</li>
        <li>Seed history (to open previously generated maps)</li>
        <li>Optimization (faster generation and smoother edit experience)</li>
        <li>UI and usability changes</li>
        <li>Reworked <a href='https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Hotkeys' target='_blank'>hotkeys</a></li>
      </ul>

      <p>Join our <a href='https://www.reddit.com/r/FantasyMapGenerator' target='_blank'>Reddit community</a> and 
      <a href='https://discordapp.com/invite/X7E84HU' target='_blank'>Discord server</a> 
      to share created maps, discuss the Generator, report bugs, ask questions and propose new features.</p>

      <p>Thanks for all supporters on <a href='https://www.patreon.com/azgaar' target='_blank'>Patreon</a>!</i></p>`;

    $("#alert").dialog(
      {resizable: false, title: "Fantasy Map Generator update", width: 330,
      buttons: {
        OK: function() {
          localStorage.clear();
          localStorage.setItem("version", version);
          $(this).dialog("close");
        }
      },
      position: {my: "center", at: "center", of: "svg"}
    });
  }
}

function applyDefaultNamesData() {
  // name, min length, max length, letters to allow duplication, multi-word name rate
  nameBases = [
    {name: "German", min: 5, max: 12, d: "lt", m: 0},
    {name: "English", min: 6, max: 11, d: "", m: 0.1},
    {name: "French", min: 5, max: 13, d: "nlrs", m: 0.1},
    {name: "Italian", min: 5, max: 12, d: "cltr", m: 0.1},
    {name: "Castillian", min: 5, max: 11, d: "lr", m: 0},
    {name: "Ruthenian", min: 5, max: 10, d: "", m: 0},
    {name: "Nordic", min: 6, max: 10, d: "kln", m: 0.1},
    {name: "Greek", min: 5, max: 11, d: "s", m: 0.1},
    {name: "Roman", min: 6, max: 11, d: "ln", m: 0.1},
    {name: "Finnic", min: 5, max: 11, d: "akiut", m: 0},
    {name: "Korean", min: 5, max: 11, d: "", m: 0},
    {name: "Chinese", min: 5, max: 10, d: "", m: 0},
    {name: "Japanese", min: 4, max: 10, d: "", m: 0},
    {name: "Portuguese", min: 5, max: 11, d: "", m: 0.1},
    {name: "Nahuatl", min: 6, max: 13, d: "l", m: 0},
    {name: "Hungarian", min: 6, max: 13, d: "", m: 0.1},
    {name: "Turkish", min: 4, max: 10, d: "", m: 0},
    {name: "Berber", min: 4, max: 10, d: "s", m: 0.2},
    {name: "Arabic", min: 4, max: 9, d: "ae", m: 0.2},
    {name: "Inuit", min: 5, max: 15, d: "alutsn", m: 0},
    {name: "Basque", min: 4, max: 11, d: "r", m: 0.1},
    {name: "Nigerian", min: 4, max: 10, d: "", m: 0.3},
    {name: "Celtic", min: 4, max: 12, d: "nld", m: 0},
    {name: "Mesopotamian", min: 4, max: 9, d: "srpl", m: 0.1},
    {name: "Iranian", min: 5, max: 11, d: "", m: 0.1},
    {name: "Hawaiian", min: 5, max: 10, d: "auo", m: 1},
    {name: "Karnataka", min: 5, max: 11, d: "tnl", m: 0},
    {name: "Quechua", min: 6, max: 12, d: "l", m: 0},
    {name: "Swahili", min: 4, max: 9, d: "", m: 0},
    {name: "Vietnamese", min: 3, max: 12, d: "", m: 1},
    {name: "Cantonese", min: 5, max: 11, d: "", m: 0},
    {name: "Mongolian", min: 5, max: 12, d: "aou", m: .3}
  ];

  nameBase = [
    ["Achern","Aichhalden","Aitern","Albbruck","Alpirsbach","Altensteig","Althengstett","Appenweier","Auggen","Wildbad","Badenen","Badenweiler","Baiersbronn","Ballrechten","Bellingen","Berghaupten","Bernau","Biberach","Biederbach","Binzen","Birkendorf","Birkenfeld","Bischweier","Blumberg","Bollen","Bollschweil","Bonndorf","Bosingen","Braunlingen","Breisach","Breisgau","Breitnau","Brigachtal","Buchenbach","Buggingen","Buhl","Buhlertal","Calw","Dachsberg","Dobel","Donaueschingen","Dornhan","Dornstetten","Dottingen","Dunningen","Durbach","Durrheim","Ebhausen","Ebringen","Efringen","Egenhausen","Ehrenkirchen","Ehrsberg","Eimeldingen","Eisenbach","Elzach","Elztal","Emmendingen","Endingen","Engelsbrand","Enz","Enzklosterle","Eschbronn","Ettenheim","Ettlingen","Feldberg","Fischerbach","Fischingen","Fluorn","Forbach","Freiamt","Freiburg","Freudenstadt","Friedenweiler","Friesenheim","Frohnd","Furtwangen","Gaggenau","Geisingen","Gengenbach","Gernsbach","Glatt","Glatten","Glottertal","Gorwihl","Gottenheim","Grafenhausen","Grenzach","Griesbach","Gutach","Gutenbach","Hag","Haiterbach","Hardt","Harmersbach","Hasel","Haslach","Hausach","Hausen","Hausern","Heitersheim","Herbolzheim","Herrenalb","Herrischried","Hinterzarten","Hochenschwand","Hofen","Hofstetten","Hohberg","Horb","Horben","Hornberg","Hufingen","Ibach","Ihringen","Inzlingen","Kandern","Kappel","Kappelrodeck","Karlsbad","Karlsruhe","Kehl","Keltern","Kippenheim","Kirchzarten","Konigsfeld","Krozingen","Kuppenheim","Kussaberg","Lahr","Lauchringen","Lauf","Laufenburg","Lautenbach","Lauterbach","Lenzkirch","Liebenzell","Loffenau","Loffingen","Lorrach","Lossburg","Mahlberg","Malsburg","Malsch","March","Marxzell","Marzell","Maulburg","Monchweiler","Muhlenbach","Mullheim","Munstertal","Murg","Nagold","Neubulach","Neuenburg","Neuhausen","Neuried","Neuweiler","Niedereschach","Nordrach","Oberharmersbach","Oberkirch","Oberndorf","Oberbach","Oberried","Oberwolfach","Offenburg","Ohlsbach","Oppenau","Ortenberg","otigheim","Ottenhofen","Ottersweier","Peterstal","Pfaffenweiler","Pfalzgrafenweiler","Pforzheim","Rastatt","Renchen","Rheinau","Rheinfelden","Rheinmunster","Rickenbach","Rippoldsau","Rohrdorf","Rottweil","Rummingen","Rust","Sackingen","Sasbach","Sasbachwalden","Schallbach","Schallstadt","Schapbach","Schenkenzell","Schiltach","Schliengen","Schluchsee","Schomberg","Schonach","Schonau","Schonenberg","Schonwald","Schopfheim","Schopfloch","Schramberg","Schuttertal","Schwenningen","Schworstadt","Seebach","Seelbach","Seewald","Sexau","Simmersfeld","Simonswald","Sinzheim","Solden","Staufen","Stegen","Steinach","Steinen","Steinmauern","Straubenhardt","Stuhlingen","Sulz","Sulzburg","Teinach","Tiefenbronn","Tiengen","Titisee","Todtmoos","Todtnau","Todtnauberg","Triberg","Tunau","Tuningen","uhlingen","Unterkirnach","Reichenbach","Utzenfeld","Villingen","Villingendorf","Vogtsburg","Vohrenbach","Waldachtal","Waldbronn","Waldkirch","Waldshut","Wehr","Weil","Weilheim","Weisenbach","Wembach","Wieden","Wiesental","Wildberg","Winzeln","Wittlingen","Wittnau","Wolfach","Wutach","Wutoschingen","Wyhlen","Zavelstein"],
    ["Abingdon","Albrighton","Alcester","Almondbury","Altrincham","Amersham","Andover","Appleby","Ashboume","Atherstone","Aveton","Axbridge","Aylesbury","Baldock","Bamburgh","Barton","Basingstoke","Berden","Bere","Berkeley","Berwick","Betley","Bideford","Bingley","Birmingham","Blandford","Blechingley","Bodmin","Bolton","Bootham","Boroughbridge","Boscastle","Bossinney","Bramber","Brampton","Brasted","Bretford","Bridgetown","Bridlington","Bromyard","Bruton","Buckingham","Bungay","Burton","Calne","Cambridge","Canterbury","Carlisle","Castleton","Caus","Charmouth","Chawleigh","Chichester","Chillington","Chinnor","Chipping","Chisbury","Cleobury","Clifford","Clifton","Clitheroe","Cockermouth","Coleshill","Combe","Congleton","Crafthole","Crediton","Cuddenbeck","Dalton","Darlington","Dodbrooke","Drax","Dudley","Dunstable","Dunster","Dunwich","Durham","Dymock","Exeter","Exning","Faringdon","Felton","Fenny","Finedon","Flookburgh","Fowey","Frampton","Gateshead","Gatton","Godmanchester","Grampound","Grantham","Guildford","Halesowen","Halton","Harbottle","Harlow","Hatfield","Hatherleigh","Haydon","Helston","Henley","Hertford","Heytesbury","Hinckley","Hitchin","Holme","Hornby","Horsham","Kendal","Kenilworth","Kilkhampton","Kineton","Kington","Kinver","Kirby","Knaresborough","Knutsford","Launceston","Leighton","Lewes","Linton","Louth","Luton","Lyme","Lympstone","Macclesfield","Madeley","Malborough","Maldon","Manchester","Manningtree","Marazion","Marlborough","Marshfield","Mere","Merryfield","Middlewich","Midhurst","Milborne","Mitford","Modbury","Montacute","Mousehole","Newbiggin","Newborough","Newbury","Newenden","Newent","Norham","Northleach","Noss","Oakham","Olney","Orford","Ormskirk","Oswestry","Padstow","Paignton","Penkneth","Penrith","Penzance","Pershore","Petersfield","Pevensey","Pickering","Pilton","Pontefract","Portsmouth","Preston","Quatford","Reading","Redcliff","Retford","Rockingham","Romney","Rothbury","Rothwell","Salisbury","Saltash","Seaford","Seasalter","Sherston","Shifnal","Shoreham","Sidmouth","Skipsea","Skipton","Solihull","Somerton","Southam","Southwark","Standon","Stansted","Stapleton","Stottesdon","Sudbury","Swavesey","Tamerton","Tarporley","Tetbury","Thatcham","Thaxted","Thetford","Thornbury","Tintagel","Tiverton","Torksey","Totnes","Towcester","Tregoney","Trematon","Tutbury","Uxbridge","Wallingford","Wareham","Warenmouth","Wargrave","Warton","Watchet","Watford","Wendover","Westbury","Westcheap","Weymouth","Whitford","Wickwar","Wigan","Wigmore","Winchelsea","Winkleigh","Wiscombe","Witham","Witheridge","Wiveliscombe","Woodbury","Yeovil"],
    ["Adon","Aillant","Amilly","Andonville","Ardon","Artenay","Ascheres","Ascoux","Attray","Aubin","Audeville","Aulnay","Autruy","Auvilliers","Auxy","Aveyron","Baccon","Bardon","Barville","Batilly","Baule","Bazoches","Beauchamps","Beaugency","Beaulieu","Beaune","Bellegarde","Boesses","Boigny","Boiscommun","Boismorand","Boisseaux","Bondaroy","Bonnee","Bonny","Bordes","Bou","Bougy","Bouilly","Boulay","Bouzonville","Bouzy","Boynes","Bray","Breteau","Briare","Briarres","Bricy","Bromeilles","Bucy","Cepoy","Cercottes","Cerdon","Cernoy","Cesarville","Chailly","Chaingy","Chalette","Chambon","Champoulet","Chanteau","Chantecoq","Chapell","Charme","Charmont","Charsonville","Chateau","Chateauneuf","Chatel","Chatenoy","Chatillon","Chaussy","Checy","Chevannes","Chevillon","Chevilly","Chevry","Chilleurs","Choux","Chuelles","Clery","Coinces","Coligny","Combleux","Combreux","Conflans","Corbeilles","Corquilleroy","Cortrat","Coudroy","Coullons","Coulmiers","Courcelles","Courcy","Courtemaux","Courtempierre","Courtenay","Cravant","Crottes","Dadonville","Dammarie","Dampierre","Darvoy","Desmonts","Dimancheville","Donnery","Dordives","Dossainville","Douchy","Dry","Echilleuses","Egry","Engenville","Epieds","Erceville","Ervauville","Escrennes","Escrignelles","Estouy","Faverelles","Fay","Feins","Ferolles","Ferrieres","Fleury","Fontenay","Foret","Foucherolles","Freville","Gatinais","Gaubertin","Gemigny","Germigny","Gidy","Gien","Girolles","Givraines","Gondreville","Grangermont","Greneville","Griselles","Guigneville","Guilly","Gyleslonains","Huetre","Huisseau","Ingrannes","Ingre","Intville","Isdes","Jargeau","Jouy","Juranville","Bussiere","Laas","Ladon","Lailly","Langesse","Leouville","Ligny","Lombreuil","Lorcy","Lorris","Loury","Louzouer","Malesherbois","Marcilly","Mardie","Mareau","Marigny","Marsainvilliers","Melleroy","Menestreau","Merinville","Messas","Meung","Mezieres","Migneres","Mignerette","Mirabeau","Montargis","Montbarrois","Montbouy","Montcresson","Montereau","Montigny","Montliard","Mormant","Morville","Moulinet","Moulon","Nancray","Nargis","Nesploy","Neuville","Neuvy","Nevoy","Nibelle","Nogent","Noyers","Ocre","Oison","Olivet","Ondreville","Onzerain","Orleans","Ormes","Orville","Oussoy","Outarville","Ouzouer","Pannecieres","Pannes","Patay","Paucourt","Pers","Pierrefitte","Pithiverais","Pithiviers","Poilly","Potier","Prefontaines","Presnoy","Pressigny","Puiseaux","Quiers","Ramoulu","Rebrechien","Rouvray","Rozieres","Rozoy","Ruan","Sandillon","Santeau","Saran","Sceaux","Seichebrieres","Semoy","Sennely","Sermaises","Sigloy","Solterre","Sougy","Sully","Sury","Tavers","Thignonville","Thimory","Thorailles","Thou","Tigy","Tivernon","Tournoisis","Trainou","Treilles","Trigueres","Trinay","Vannes","Varennes","Vennecy","Vieilles","Vienne","Viglain","Vignes","Villamblain","Villemandeur","Villemoutiers","Villemurlin","Villeneuve","Villereau","Villevoques","Villorceau","Vimory","Vitry","Vrigny","Ivre"],
    ["Accumoli","Acquafondata","Acquapendente","Acuto","Affile","Agosta","Alatri","Albano","Allumiere","Alvito","Amaseno","Amatrice","Anagni","Anguillara","Anticoli","Antrodoco","Anzio","Aprilia","Aquino","Arce","Arcinazzo","Ardea","Ariccia","Arlena","Arnara","Arpino","Arsoli","Artena","Ascrea","Atina","Ausonia","Bagnoregio","Barbarano","Bassano","Bassiano","Bellegra","Belmonte","Blera","Bolsena","Bomarzo","Borbona","Borgo","Borgorose","Boville","Bracciano","Broccostella","Calcata","Camerata","Campagnano","Campodimele","Campoli","Canale","Canepina","Canino","Cantalice","Cantalupo","Canterano","Capena","Capodimonte","Capranica","Caprarola","Carbognano","Casalattico","Casalvieri","Casape","Casaprota","Casperia","Cassino","Castelforte","Castelliri","Castello","Castelnuovo","Castiglione","Castro","Castrocielo","Cave","Ceccano","Celleno","Cellere","Ceprano","Cerreto","Cervara","Cervaro","Cerveteri","Ciampino","Ciciliano","Cineto","Cisterna","Cittaducale","Cittareale","Civita","Civitavecchia","Civitella","Colfelice","Collalto","Colle","Colleferro","Collegiove","Collepardo","Collevecchio","Colli","Colonna","Concerviano","Configni","Contigliano","Corchiano","Coreno","Cori","Cottanello","Esperia","Fabrica","Faleria","Fara","Farnese","Ferentino","Fiamignano","Fiano","Filacciano","Filettino","Fiuggi","Fiumicino","Fondi","Fontana","Fonte","Fontechiari","Forano","Formello","Formia","Frascati","Frasso","Frosinone","Fumone","Gaeta","Gallese","Gallicano","Gallinaro","Gavignano","Genazzano","Genzano","Gerano","Giuliano","Gorga","Gradoli","Graffignano","Greccio","Grottaferrata","Grotte","Guarcino","Guidonia","Ischia","Isola","Itri","Jenne","Labico","Labro","Ladispoli","Lanuvio","Lariano","Latera","Lenola","Leonessa","Licenza","Longone","Lubriano","Maenza","Magliano","Mandela","Manziana","Marano","Marcellina","Marcetelli","Marino","Marta","Mazzano","Mentana","Micigliano","Minturno","Mompeo","Montalto","Montasola","Monte","Montebuono","Montefiascone","Monteflavio","Montelanico","Monteleone","Montelibretti","Montenero","Monterosi","Monterotondo","Montopoli","Montorio","Moricone","Morlupo","Morolo","Morro","Nazzano","Nemi","Nepi","Nerola","Nespolo","Nettuno","Norma","Olevano","Onano","Oriolo","Orte","Orvinio","Paganico","Palestrina","Paliano","Palombara","Pastena","Patrica","Percile","Pescorocchiano","Pescosolido","Petrella","Piansano","Picinisco","Pico","Piedimonte","Piglio","Pignataro","Pisoniano","Pofi","Poggio","Poli","Pomezia","Pontecorvo","Pontinia","Ponza","Ponzano","Posta","Pozzaglia","Priverno","Proceno","Prossedi","Riano","Rieti","Rignano","Riofreddo","Ripi","Rivodutri","Rocca","Roccagiovine","Roccagorga","Roccantica","Roccasecca","Roiate","Ronciglione","Roviano","Sabaudia","Sacrofano","Salisano","Sambuci","Santa","Santi","Santopadre","Saracinesco","Scandriglia","Segni","Selci","Sermoneta","Serrone","Settefrati","Sezze","Sgurgola","Sonnino","Sora","Soriano","Sperlonga","Spigno","Stimigliano","Strangolagalli","Subiaco","Supino","Sutri","Tarano","Tarquinia","Terelle","Terracina","Tessennano","Tivoli","Toffia","Tolfa","Torre","Torri","Torrice","Torricella","Torrita","Trevi","Trevignano","Trivigliano","Turania","Tuscania","Vacone","Valentano","Vallecorsa","Vallemaio","Vallepietra","Vallerano","Vallerotonda","Vallinfreda","Valmontone","Varco","Vasanello","Vejano","Velletri","Ventotene","Veroli","Vetralla","Vicalvi","Vico","Vicovaro","Vignanello","Viterbo","Viticuso","Vitorchiano","Vivaro","Zagarolo"],
    ["Abanades","Ablanque","Adobes","Ajofrin","Alameda","Alaminos","Alarilla","Albalate","Albares","Albarreal","Albendiego","Alcabon","Alcanizo","Alcaudete","Alcocer","Alcolea","Alcoroches","Aldea","Aldeanueva","Algar","Algora","Alhondiga","Alique","Almadrones","Almendral","Almoguera","Almonacid","Almorox","Alocen","Alovera","Alustante","Angon","Anguita","Anover","Anquela","Arbancon","Arbeteta","Arcicollar","Argecilla","Arges","Armallones","Armuna","Arroyo","Atanzon","Atienza","Aunon","Azuqueca","Azutan","Baides","Banos","Banuelos","Barcience","Bargas","Barriopedro","Belvis","Berninches","Borox","Brihuega","Budia","Buenaventura","Bujalaro","Burguillos","Burujon","Bustares","Cabanas","Cabanillas","Calera","Caleruela","Calzada","Camarena","Campillo","Camunas","Canizar","Canredondo","Cantalojas","Cardiel","Carmena","Carranque","Carriches","Casa","Casarrubios","Casas","Casasbuenas","Caspuenas","Castejon","Castellar","Castilforte","Castillo","Castilnuevo","Cazalegas","Cebolla","Cedillo","Cendejas","Centenera","Cervera","Checa","Chequilla","Chillaron","Chiloeches","Chozas","Chueca","Cifuentes","Cincovillas","Ciruelas","Ciruelos","Cobeja","Cobeta","Cobisa","Cogollor","Cogolludo","Condemios","Congostrina","Consuegra","Copernal","Corduente","Corral","Cuerva","Domingo","Dosbarrios","Driebes","Duron","El","Embid","Erustes","Escalona","Escalonilla","Escamilla","Escariche","Escopete","Espinosa","Espinoso","Esplegares","Esquivias","Estables","Estriegana","Fontanar","Fuembellida","Fuensalida","Fuentelsaz","Gajanejos","Galve","Galvez","Garciotum","Gascuena","Gerindote","Guadamur","Henche","Heras","Herreria","Herreruela","Hijes","Hinojosa","Hita","Hombrados","Hontanar","Hontoba","Horche","Hormigos","Huecas","Huermeces","Huerta","Hueva","Humanes","Illan","Illana","Illescas","Iniestola","Irueste","Jadraque","Jirueque","Lagartera","Las","Layos","Ledanca","Lillo","Lominchar","Loranca","Los","Lucillos","Lupiana","Luzaga","Luzon","Madridejos","Magan","Majaelrayo","Malaga","Malaguilla","Malpica","Mandayona","Mantiel","Manzaneque","Maqueda","Maranchon","Marchamalo","Marjaliza","Marrupe","Mascaraque","Masegoso","Matarrubia","Matillas","Mazarete","Mazuecos","Medranda","Megina","Mejorada","Mentrida","Mesegar","Miedes","Miguel","Millana","Milmarcos","Mirabueno","Miralrio","Mocejon","Mochales","Mohedas","Molina","Monasterio","Mondejar","Montarron","Mora","Moratilla","Morenilla","Muduex","Nambroca","Navalcan","Negredo","Noblejas","Noez","Nombela","Noves","Numancia","Nuno","Ocana","Ocentejo","Olias","Olmeda","Ontigola","Orea","Orgaz","Oropesa","Otero","Palmaces","Palomeque","Pantoja","Pardos","Paredes","Pareja","Parrillas","Pastrana","Pelahustan","Penalen","Penalver","Pepino","Peralejos","Peralveche","Pinilla","Pioz","Piqueras","Polan","Portillo","Poveda","Pozo","Pradena","Prados","Puebla","Puerto","Pulgar","Quer","Quero","Quintanar","Quismondo","Rebollosa","Recas","Renera","Retamoso","Retiendas","Riba","Rielves","Rillo","Riofrio","Robledillo","Robledo","Romanillos","Romanones","Rueda","Sacecorbo","Sacedon","Saelices","Salmeron","San","Santa","Santiuste","Santo","Sartajada","Sauca","Sayaton","Segurilla","Selas","Semillas","Sesena","Setiles","Sevilleja","Sienes","Siguenza","Solanillos","Somolinos","Sonseca","Sotillo","Sotodosos","Talavera","Tamajon","Taragudo","Taravilla","Tartanedo","Tembleque","Tendilla","Terzaga","Tierzo","Tordellego","Tordelrabano","Tordesilos","Torija","Torralba","Torre","Torrecilla","Torrecuadrada","Torrejon","Torremocha","Torrico","Torrijos","Torrubia","Tortola","Tortuera","Tortuero","Totanes","Traid","Trijueque","Trillo","Turleque","Uceda","Ugena","Ujados","Urda","Utande","Valdarachas","Valdesotos","Valhermoso","Valtablado","Valverde","Velada","Viana","Vinuelas","Yebes","Yebra","Yelamos","Yeles","Yepes","Yuncler","Yunclillos","Yuncos","Yunquera","Zaorejas","Zarzuela","Zorita"],
    ["Belgorod","Beloberezhye","Belyi","Belz","Berestiy","Berezhets","Berezovets","Berezutsk","Bobruisk","Bolonets","Borisov","Borovsk","Bozhesk","Bratslav","Bryansk","Brynsk","Buryn","Byhov","Chechersk","Chemesov","Cheremosh","Cherlen","Chern","Chernigov","Chernitsa","Chernobyl","Chernogorod","Chertoryesk","Chetvertnia","Demyansk","Derevesk","Devyagoresk","Dichin","Dmitrov","Dorogobuch","Dorogobuzh","Drestvin","Drokov","Drutsk","Dubechin","Dubichi","Dubki","Dubkov","Dveren","Galich","Glebovo","Glinsk","Goloty","Gomiy","Gorodets","Gorodische","Gorodno","Gorohovets","Goroshin","Gorval","Goryshon","Holm","Horobor","Hoten","Hotin","Hotmyzhsk","Ilovech","Ivan","Izborsk","Izheslavl","Kamenets","Kanev","Karachev","Karna","Kavarna","Klechesk","Klyapech","Kolomyya","Kolyvan","Kopyl","Korec","Kornik","Korochunov","Korshev","Korsun","Koshkin","Kotelno","Kovyla","Kozelsk","Kozelsk","Kremenets","Krichev","Krylatsk","Ksniatin","Kulatsk","Kursk","Kursk","Lebedev","Lida","Logosko","Lomihvost","Loshesk","Loshichi","Lubech","Lubno","Lubutsk","Lutsk","Luchin","Luki","Lukoml","Luzha","Lvov","Mtsensk","Mdin","Medniki","Melecha","Merech","Meretsk","Mescherskoe","Meshkovsk","Metlitsk","Mezetsk","Mglin","Mihailov","Mikitin","Mikulino","Miloslavichi","Mogilev","Mologa","Moreva","Mosalsk","Moschiny","Mozyr","Mstislav","Mstislavets","Muravin","Nemech","Nemiza","Nerinsk","Nichan","Novgorod","Novogorodok","Obolichi","Obolensk","Obolensk","Oleshsk","Olgov","Omelnik","Opoka","Opoki","Oreshek","Orlets","Osechen","Oster","Ostrog","Ostrov","Perelai","Peremil","Peremyshl","Pererov","Peresechen","Perevitsk","Pereyaslav","Pinsk","Ples","Polotsk","Pronsk","Proposhesk","Punia","Putivl","Rechitsa","Rodno","Rogachev","Romanov","Romny","Roslavl","Rostislavl","Rostovets","Rsha","Ruza","Rybchesk","Rylsk","Rzhavesk","Rzhev","Rzhischev","Sambor","Serensk","Serensk","Serpeysk","Shilov","Shuya","Sinech","Sizhka","Skala","Slovensk","Slutsk","Smedin","Sneporod","Snitin","Snovsk","Sochevo","Sokolec","Starica","Starodub","Stepan","Sterzh","Streshin","Sutesk","Svinetsk","Svisloch","Terebovl","Ternov","Teshilov","Teterin","Tiversk","Torchevsk","Toropets","Torzhok","Tripolye","Trubchevsk","Tur","Turov","Usvyaty","Uteshkov","Vasilkov","Velil","Velye","Venev","Venicha","Verderev","Vereya","Veveresk","Viazma","Vidbesk","Vidychev","Voino","Volodimer","Volok","Volyn","Vorobesk","Voronich","Voronok","Vorotynsk","Vrev","Vruchiy","Vselug","Vyatichsk","Vyatka","Vyshegorod","Vyshgorod","Vysokoe","Yagniatin","Yaropolch","Yasenets","Yuryev","Yuryevets","Zaraysk","Zhitomel","Zholvazh","Zizhech","Zubkov","Zudechev","Zvenigorod"],
    ["Akureyri","Aldra","Alftanes","Andenes","Austbo","Auvog","Bakkafjordur","Ballangen","Bardal","Beisfjord","Bifrost","Bildudalur","Bjerka","Bjerkvik","Bjorkosen","Bliksvaer","Blokken","Blonduos","Bolga","Bolungarvik","Borg","Borgarnes","Bosmoen","Bostad","Bostrand","Botsvika","Brautarholt","Breiddalsvik","Bringsli","Brunahlid","Budardalur","Byggdakjarni","Dalvik","Djupivogur","Donnes","Drageid","Drangsnes","Egilsstadir","Eiteroga","Elvenes","Engavogen","Ertenvog","Eskifjordur","Evenes","Eyrarbakki","Fagernes","Fallmoen","Fellabaer","Fenes","Finnoya","Fjaer","Fjelldal","Flakstad","Flateyri","Flostrand","Fludir","Gardaber","Gardur","Gimstad","Givaer","Gjeroy","Gladstad","Godoya","Godoynes","Granmoen","Gravdal","Grenivik","Grimsey","Grindavik","Grytting","Hafnir","Halsa","Hauganes","Haugland","Hauknes","Hella","Helland","Hellissandur","Hestad","Higrav","Hnifsdalur","Hofn","Hofsos","Holand","Holar","Holen","Holkestad","Holmavik","Hopen","Hovden","Hrafnagil","Hrisey","Husavik","Husvik","Hvammstangi","Hvanneyri","Hveragerdi","Hvolsvollur","Igeroy","Indre","Inndyr","Innhavet","Innes","Isafjordur","Jarklaustur","Jarnsreykir","Junkerdal","Kaldvog","Kanstad","Karlsoy","Kavosen","Keflavik","Kjelde","Kjerstad","Klakk","Kopasker","Kopavogur","Korgen","Kristnes","Krutoga","Krystad","Kvina","Lande","Laugar","Laugaras","Laugarbakki","Laugarvatn","Laupstad","Leines","Leira","Leiren","Leland","Lenvika","Loding","Lodingen","Lonsbakki","Lopsmarka","Lovund","Luroy","Maela","Melahverfi","Meloy","Mevik","Misvaer","Mornes","Mosfellsber","Moskenes","Myken","Naurstad","Nesberg","Nesjahverfi","Nesset","Nevernes","Obygda","Ofoten","Ogskardet","Okervika","Oknes","Olafsfjordur","Oldervika","Olstad","Onstad","Oppeid","Oresvika","Orsnes","Orsvog","Osmyra","Overdal","Prestoya","Raudalaekur","Raufarhofn","Reipo","Reykholar","Reykholt","Reykjahlid","Rif","Rinoya","Rodoy","Rognan","Rosvika","Rovika","Salhus","Sanden","Sandgerdi","Sandoker","Sandset","Sandvika","Saudarkrokur","Selfoss","Selsoya","Sennesvik","Setso","Siglufjordur","Silvalen","Skagastrond","Skjerstad","Skonland","Skorvogen","Skrova","Sleneset","Snubba","Softing","Solheim","Solheimar","Sorarnoy","Sorfugloy","Sorland","Sormela","Sorvaer","Sovika","Stamsund","Stamsvika","Stave","Stokka","Stokkseyri","Storjord","Storo","Storvika","Strand","Straumen","Strendene","Sudavik","Sudureyri","Sundoya","Sydalen","Thingeyri","Thorlakshofn","Thorshofn","Tjarnabyggd","Tjotta","Tosbotn","Traelnes","Trofors","Trones","Tverro","Ulvsvog","Unnstad","Utskor","Valla","Vandved","Varmahlid","Vassos","Vevelstad","Vidrek","Vik","Vikholmen","Vogar","Vogehamn","Vopnafjordur"],
    ["Abdera","Abila","Abydos","Acanthus","Acharnae","Actium","Adramyttium","Aegae","Aegina","Aegium","Aenus","Agrinion","Aigosthena","Akragas","Akrai","Akrillai","Akroinon","Akrotiri","Alalia","Alexandreia","Alexandretta","Alexandria","Alinda","Amarynthos","Amaseia","Ambracia","Amida","Amisos","Amnisos","Amphicaea","Amphigeneia","Amphipolis","Amphissa","Ankon","Antigona","Antipatrea","Antioch","Antioch","Antiochia","Andros","Apamea","Aphidnae","Apollonia","Argos","Arsuf","Artanes","Artemita","Argyroupoli","Asine","Asklepios","Aspendos","Assus","Astacus","Athenai","Athmonia","Aytos","Ancient","Baris","Bhrytos","Borysthenes","Berge","Boura","Bouthroton","Brauron","Byblos","Byllis","Byzantium","Bythinion","Callipolis","Cebrene","Chalcedon","Calydon","Carystus","Chamaizi","Chalcis","Chersonesos","Chios","Chytri","Clazomenae","Cleonae","Cnidus","Colosse","Corcyra","Croton","Cyme","Cyrene","Cythera","Decelea","Delos","Delphi","Demetrias","Dicaearchia","Dimale","Didyma","Dion","Dioscurias","Dodona","Dorylaion","Dyme","Edessa","Elateia","Eleusis","Eleutherna","Emporion","Ephesus","Ephyra","Epidamnos","Epidauros","Eresos","Eretria","Erythrae","Eubea","Gangra","Gaza","Gela","Golgi","Gonnos","Gorgippia","Gournia","Gortyn","Gythium","Hagios","Hagia","Halicarnassus","Halieis","Helike","Heliopolis","Hellespontos","Helorus","Hemeroskopeion","Heraclea","Hermione","Hermonassa","Hierapetra","Hierapolis","Himera","Histria","Hubla","Hyele","Ialysos","Iasus","Idalium","Imbros","Iolcus","Itanos","Ithaca","Juktas","Kallipolis","Kamares","Kameiros","Kannia","Kamarina","Kasmenai","Katane","Kerkinitida","Kepoi","Kimmerikon","Kios","Klazomenai","Knidos","Knossos","Korinthos","Kos","Kourion","Kume","Kydonia","Kynos","Kyrenia","Lamia","Lampsacus","Laodicea","Lapithos","Larissa","Lato","Laus","Lebena","Lefkada","Lekhaion","Leibethra","Leontinoi","Lepreum","Lessa","Lilaea","Lindus","Lissus","Epizephyrian","Madytos","Magnesia","Mallia","Mantineia","Marathon","Marmara","Maroneia","Masis","Massalia","Megalopolis","Megara","Mesembria","Messene","Metapontum","Methana","Methone","Methumna","Miletos","Misenum","Mochlos","Monastiraki","Morgantina","Mulai","Mukenai","Mylasa","Myndus","Myonia","Myra","Myrmekion","Mutilene","Myos","Nauplios","Naucratis","Naupactus","Naxos","Neapoli","Neapolis","Nemea","Nicaea","Nicopolis","Nirou","Nymphaion","Nysa","Oenoe","Oenus","Odessos","Olbia","Olous","Olympia","Olynthus","Opus","Orchomenus","Oricos","Orestias","Oreus","Oropus","Onchesmos","Pactye","Pagasae","Palaikastro","Pandosia","Panticapaeum","Paphos","Parium","Paros","Parthenope","Patrae","Pavlopetri","Pegai","Pelion","Peiraies","Pella","Percote","Pergamum","Petsofa","Phaistos","Phaleron","Phanagoria","Pharae","Pharnacia","Pharos","Phaselis","Philippi","Pithekussa","Philippopolis","Platanos","Phlius","Pherae","Phocaea","Pinara","Pisa","Pitane","Pitiunt","Pixous","Plataea","Poseidonia","Potidaea","Priapus","Priene","Prousa","Pseira","Psychro","Pteleum","Pydna","Pylos","Pyrgos","Rhamnus","Rhegion","Rhithymna","Rhodes","Rhypes","Rizinia","Salamis","Same","Samos","Scyllaeum","Selinus","Seleucia","Semasus","Sestos","Scidrus","Sicyon","Side","Sidon","Siteia","Sinope","Siris","Sklavokampos","Smyrna","Soli","Sozopolis","Sparta","Stagirus","Stratos","Stymphalos","Sybaris","Surakousai","Taras","Tanagra","Tanais","Tauromenion","Tegea","Temnos","Tenedos","Tenea","Teos","Thapsos","Thassos","Thebai","Theodosia","Therma","Thespiae","Thronion","Thoricus","Thurii","Thyreum","Thyria","Tiruns","Tithoraea","Tomis","Tragurion","Trapeze","Trapezus","Tripolis","Troizen","Troliton","Troy","Tylissos","Tyras","Tyros","Tyritake","Vasiliki","Vathypetros","Zakynthos","Zakros","Zankle"],
    ["Abila","Adflexum","Adnicrem","Aelia","Aelius","Aeminium","Aequum","Agrippina","Agrippinae","Ala","Albanianis","Ambianum","Andautonia","Apulum","Aquae","Aquaegranni","Aquensis","Aquileia","Aquincum","Arae","Argentoratum","Ariminum","Ascrivium","Atrebatum","Atuatuca","Augusta","Aurelia","Aurelianorum","Batavar","Batavorum","Belum","Biriciana","Blestium","Bonames","Bonna","Bononia","Borbetomagus","Bovium","Bracara","Brigantium","Burgodunum","Caesaraugusta","Caesarea","Caesaromagus","Calleva","Camulodunum","Cannstatt","Cantiacorum","Capitolina","Castellum","Castra","Castrum","Cibalae","Clausentum","Colonia","Concangis","Condate","Confluentes","Conimbriga","Corduba","Coria","Corieltauvorum","Corinium","Coriovallum","Cornoviorum","Danum","Deva","Divodurum","Dobunnorum","Drusi","Dubris","Dumnoniorum","Durnovaria","Durocobrivis","Durocornovium","Duroliponte","Durovernum","Durovigutum","Eboracum","Edetanorum","Emerita","Emona","Euracini","Faventia","Flaviae","Florentia","Forum","Gerulata","Gerunda","Glevensium","Hadriani","Herculanea","Isca","Italica","Iulia","Iuliobrigensium","Iuvavum","Lactodurum","Lagentium","Lauri","Legionis","Lemanis","Lentia","Lepidi","Letocetum","Lindinis","Lindum","Londinium","Lopodunum","Lousonna","Lucus","Lugdunum","Luguvalium","Lutetia","Mancunium","Marsonia","Martius","Massa","Matilo","Mattiacorum","Mediolanum","Mod","Mogontiacum","Moridunum","Mursa","Naissus","Nervia","Nida","Nigrum","Novaesium","Noviomagus","Olicana","Ovilava","Parisiorum","Partiscum","Paterna","Pistoria","Placentia","Pollentia","Pomaria","Pons","Portus","Praetoria","Praetorium","Pullum","Ragusium","Ratae","Raurica","Regina","Regium","Regulbium","Rigomagus","Roma","Romula","Rutupiae","Salassorum","Salernum","Salona","Scalabis","Segovia","Silurum","Sirmium","Siscia","Sorviodurum","Sumelocenna","Tarraco","Taurinorum","Theranda","Traiectum","Treverorum","Tungrorum","Turicum","Ulpia","Valentia","Venetiae","Venta","Verulamium","Vesontio","Vetera","Victoriae","Victrix","Villa","Viminacium","Vindelicorum","Vindobona","Vinovia","Viroconium"],
    ["Aanekoski","Abjapaluoja","Ahlainen","Aholanvaara","Ahtari","Aijala","Aimala","Akaa","Alajarvi","Alatornio","Alavus","Antsla","Aspo","Bennas","Bjorkoby","Elva","Emasalo","Espoo","Esse","Evitskog","Forssa","Haapajarvi","Haapamaki","Haapavesi","Haapsalu","Haavisto","Hameenlinna","Hameenmaki","Hamina","Hanko","Harjavalta","Hattuvaara","Haukipudas","Hautajarvi","Havumaki","Heinola","Hetta","Hinkabole","Hirmula","Hossa","Huittinen","Husula","Hyryla","Hyvinkaa","Iisalmi","Ikaalinen","Ilmola","Imatra","Inari","Iskmo","Itakoski","Jamsa","Jarvenpaa","Jeppo","Jioesuu","Jiogeva","Joensuu","Jokela","Jokikyla","Jokisuu","Jormua","Juankoski","Jungsund","Jyvaskyla","Kaamasmukka","Kaarina","Kajaani","Kalajoki","Kallaste","Kankaanpaa","Kannus","Kardla","Karesuvanto","Karigasniemi","Karkkila","Karkku","Karksinuia","Karpankyla","Kaskinen","Kasnas","Kauhajoki","Kauhava","Kauniainen","Kauvatsa","Kehra","Keila","Kellokoski","Kelottijarvi","Kemi","Kemijarvi","Kerava","Keuruu","Kiikka","Kiipu","Kilinginiomme","Kiljava","Kilpisjarvi","Kitee","Kiuruvesi","Kivesjarvi","Kiviioli","Kivisuo","Klaukkala","Klovskog","Kohtlajarve","Kokemaki","Kokkola","Kolho","Koria","Koskue","Kotka","Kouva","Kouvola","Kristiina","Kaupunki","Kuhmo","Kunda","Kuopio","Kuressaare","Kurikka","Kusans","Kuusamo","Kylmalankyla","Lahti","Laitila","Lankipohja","Lansikyla","Lappeenranta","Lapua","Laurila","Lautiosaari","Lepsama","Liedakkala","Lieksa","Lihula","Littoinen","Lohja","Loimaa","Loksa","Loviisa","Luohuanylipaa","Lusi","Maardu","Maarianhamina","Malmi","Mantta","Masaby","Masala","Matasvaara","Maula","Miiluranta","Mikkeli","Mioisakula","Munapirtti","Mustvee","Muurahainen","Naantali","Nappa","Narpio","Nickby","Niinimaa","Niinisalo","Nikkila","Nilsia","Nivala","Nokia","Nummela","Nuorgam","Nurmes","Nuvvus","Obbnas","Oitti","Ojakkala","Ollola","onningeby","Orimattila","Orivesi","Otanmaki","Otava","Otepaa","Oulainen","Oulu","Outokumpu","Paavola","Paide","Paimio","Pakankyla","Paldiski","Parainen","Parkano","Parkumaki","Parola","Perttula","Pieksamaki","Pietarsaari","Pioltsamaa","Piolva","Pohjavaara","Porhola","Pori","Porrasa","Porvoo","Pudasjarvi","Purmo","Pussi","Pyhajarvi","Raahe","Raasepori","Raisio","Rajamaki","Rakvere","Rapina","Rapla","Rauma","Rautio","Reposaari","Riihimaki","Rovaniemi","Roykka","Ruonala","Ruottala","Rutalahti","Saarijarvi","Salo","Sastamala","Saue","Savonlinna","Seinajoki","Sillamae","Sindi","Siuntio","Somero","Sompujarvi","Suonenjoki","Suurejaani","Syrjantaka","Tampere","Tamsalu","Tapa","Temmes","Tiorva","Tormasenvaara","Tornio","Tottijarvi","Tulppio","Turenki","Turi","Tuukkala","Tuurala","Tuuri","Tuuski","Ulvila","Unari","Upinniemi","Utti","Uusikaarlepyy","Uusikaupunki","Vaaksy","Vaalimaa","Vaarinmaja","Vaasa","Vainikkala","Valga","Valkeakoski","Vantaa","Varkaus","Vehkapera","Vehmasmaki","Vieki","Vierumaki","Viitasaari","Viljandi","Vilppula","Viohma","Vioru","Virrat","Ylike","Ylivieska","Ylojarvi"],
    ["Aewor","Andong","Angang","Anjung","Anmyeon","Ansan","Anseong","Anyang","Aphae","Apo","Asan","Baebang","Baekseok","Baeksu","Beobwon","Beolgyo","Beomseo","Boeun","Bongdam","Bongdong","Bonghwa","Bongyang","Boryeong","Boseong","Buan","Bubal","Bucheon","Buksam","Busan","Busan","Busan","Buyeo","Changnyeong","Changwon","Cheonan","Cheongdo","Cheongjin","Cheongju","Cheongju","Cheongsong","Cheongyang","Cheorwon","Chirwon","Chowol","Chuncheon","Chuncheon","Chungju","Chungmu","Daecheon","Daedeok","Daegaya","Daegu","Daegu","Daegu","Daejeon","Daejeon","Daejeon","Daejeong","Daesan","Damyang","Dangjin","Danyang","Dasa","Dogye","Dolsan","Dong","Dongducheon","Donggwangyang","Donghae","Dongsong","Doyang","Eonyang","Eumseong","Gaeseong","Galmal","Gampo","Ganam","Ganggyeong","Ganghwa","Gangjin","Gangneung","Ganseong","Gapyeong","Gaun","Gaya","Geochang","Geoje","Geojin","Geoncheon","Geumho","Geumil","Geumsan","Geumseong","Geumwang","Gijang","Gimcheon","Gimhae","Gimhwa","Gimje","Gimpo","Goa","Gochang","Gochon","Goesan","Gohan","Goheung","Gokseong","Gongdo","Gongju","Gonjiam","Goseong","Goyang","Gujwa","Gumi","Gungnae","Gunpo","Gunsan","Gunsan","Gunwi","Guri","Gurye","Guryongpo","Gwacheon","Gwangcheon","Gwangju","Gwangju","Gwangju","Gwangju","Gwangmyeong","Gwangyang","Gwansan","Gyeongju","Gyeongsan","Gyeongseong","Gyeongseong","Gyeryong","Hadong","Haeju","Haenam","Hamchang","Hamheung","Hampyeong","Hamyang","Hamyeol","Hanam","Hanrim","Hapcheon","Hapdeok","Hayang","Heunghae","Heungnam","Hoengseong","Hongcheon","Hongnong","Hongseong","Hwacheon","Hwado","Hwando","Hwaseong","Hwasun","Hwawon","Hyangnam","Icheon","Iksan","Illo","Imsil","Incheon","Incheon","Incheon","Inje","Iri","Iri","Jangan","Janghang","Jangheung","Janghowon","Jangseong","Jangseungpo","Jangsu","Jecheon","Jeju","Jeomchon","Jeongeup","Jeonggwan","Jeongju","Jeongok","Jeongseon","Jeonju","Jeonju","Jeungpyeong","Jido","Jiksan","Jillyang","Jinan","Jincheon","Jindo","Jingeon","Jinhae","Jinjeop","Jinju","Jinju","Jinnampo","Jinyeong","Jocheon","Jochiwon","Jori","Judeok","Jumunjin","Maepo","Mangyeong","Masan","Masan","Migeum","Miryang","Mokcheon","Mokpo","Mokpo","Muan","Muju","Mungyeong","Munmak","Munsan","Munsan","Naeseo","Naesu","Najin","Naju","Namhae","Namji","Nampyeong","Namwon","Namyang","Namyangju","Nohwa","Nongong","Nonsan","Ochang","Ocheon","Oedong","Okcheon","Okgu","Onam","Onsan","Onyang","Opo","Osan","Osong","Paengseong","Paju","Pocheon","Pogok","Pohang","Poseung","Punggi","Pungsan","Pyeongchang","Pyeonghae","Pyeongtaek","Pyeongyang","Sabi","Sabuk","Sacheon","Samcheok","Samcheonpo","Samho","Samhyang","Samnangjin","Samrye","Sancheong","Sangdong","Sangju","Sanyang","Sapgyo","Sariwon","Sejong","Seocheon","Seogwipo","Seokjeok","Seonggeo","Seonghwan","Seongjin","Seongju","Seongnam","Seongsan","Seonsan","Seosan","Seoul","Seungju","Siheung","Sinbuk","Sindong","Sineuiju","Sintaein","Soheul","Sokcho","Songak","Songjeong","Songnim","Songtan","Sunchang","Suncheon","Suwon","Taean","Taebaek","Tongjin","Tongyeong","Uijeongbu","Uiryeong","Uiseong","Uiwang","Ujeong","Uljin","Ulleung","Ulsan","Ulsan","Unbong","Ungcheon","Ungjin","Wabu","Waegwan","Wando","Wanggeomseong","Wiryeseong","Wondeok","Wonju","Wonsan","Yangchon","Yanggu","Yangju","Yangpyeong","Yangsan","Yangyang","Yecheon","Yeocheon","Yeoju","Yeomchi","Yeoncheon","Yeongam","Yeongcheon","Yeongdeok","Yeongdong","Yeonggwang","Yeongju","Yeongwol","Yeongyang","Yeonil","Yeonmu","Yeosu","Yesan","Yongin","Yongjin","Yugu","Wayang"],
    ["Anding","Anlu","Anqing","Anshun","Baan","Baixing","Banyang","Baoding","Baoqing","Binzhou","Caozhou","Changbai","Changchun","Changde","Changling","Changsha","Changtu","Changzhou","Chaozhou","Cheli","Chengde","Chengdu","Chenzhou","Chizhou","Chongqing","Chuxiong","Chuzhou","Dading","Dali","Daming","Datong","Daxing","Dean","Dengke","Dengzhou","Deqing","Dexing","Dihua","Dingli","Dongan","Dongchang","Dongchuan","Dongping","Duyun","Fengtian","Fengxiang","Fengyang","Fenzhou","Funing","Fuzhou","Ganzhou","Gaoyao","Gaozhou","Gongchang","Guangnan","Guangning","Guangping","Guangxin","Guangzhou","Guide","Guilin","Guiyang","Hailong","Hailun","Hangzhou","Hanyang","Hanzhong","Heihe","Hejian","Henan","Hengzhou","Hezhong","Huaian","Huaide","Huaiqing","Huanglong","Huangzhou","Huining","Huizhou","Hulan","Huzhou","Jiading","Jian","Jianchang","Jiande","Jiangning","Jiankang","Jianning","Jiaxing","Jiayang","Jilin","Jinan","Jingjiang","Jingzhao","Jingzhou","Jinhua","Jinzhou","Jiujiang","Kaifeng","Kaihua","Kangding","Kuizhou","Laizhou","Lanzhou","Leizhou","Liangzhou","Lianzhou","Liaoyang","Lijiang","Linan","Linhuang","Linjiang","Lintao","Liping","Liuzhou","Longan","Longjiang","Longqing","Longxing","Luan","Lubin","Lubin","Luzhou","Mishan","Nanan","Nanchang","Nandian","Nankang","Nanning","Nanyang","Nenjiang","Ningan","Ningbo","Ningguo","Ninguo","Ningwu","Ningxia","Ningyuan","Pingjiang","Pingle","Pingliang","Pingyang","Puer","Puzhou","Qianzhou","Qingyang","Qingyuan","Qingzhou","Qiongzhou","Qujing","Quzhou","Raozhou","Rende","Ruian","Ruizhou","Runing","Shafeng","Shajing","Shaoqing","Shaowu","Shaoxing","Shaozhou","Shinan","Shiqian","Shouchun","Shuangcheng","Shulei","Shunde","Shunqing","Shuntian","Shuoping","Sicheng","Sien","Sinan","Sizhou","Songjiang","Suiding","Suihua","Suining","Suzhou","Taian","Taibei","Tainan","Taiping","Taiwan","Taiyuan","Taizhou","Taonan","Tengchong","Tieli","Tingzhou","Tongchuan","Tongqing","Tongren","Tongzhou","Weihui","Wensu","Wenzhou","Wuchang","Wuding","Wuzhou","Xian","Xianchun","Xianping","Xijin","Xiliang","Xincheng","Xingan","Xingde","Xinghua","Xingjing","Xingqing","Xingyi","Xingyuan","Xingzhong","Xining","Xinmen","Xiping","Xuanhua","Xunzhou","Xuzhou","Yanan","Yangzhou","Yanji","Yanping","Yanqi","Yanzhou","Yazhou","Yichang","Yidu","Yilan","Yili","Yingchang","Yingde","Yingtian","Yingzhou","Yizhou","Yongchang","Yongping","Yongshun","Yongzhou","Yuanzhou","Yuezhou","Yulin","Yunnan","Yunyang","Zezhou","Zhangde","Zhangzhou","Zhaoqing","Zhaotong","Zhenan","Zhending","Zhengding","Zhenhai","Zhenjiang","Zhenxi","Zhenyun","Zhongshan","Zunyi"],
    ["Abira","Aga","Aikawa","Aizumisato","Ajigasawa","Akkeshi","Amagi","Ami","Anan","Ando","Asakawa","Ashikita","Bandai","Biratori","China","Chonan","Esashi","Fuchu","Fujimi","Funagata","Genkai","Godo","Goka","Gonohe","Gyokuto","Haboro","Hamatonbetsu","Happo","Harima","Hashikami","Hayashima","Heguri","Hidaka","Higashiagatsuma","Higashiura","Hiranai","Hirogawa","Hiroo","Hodatsushimizu","Hoki","Hokuei","Hokuryu","Horokanai","Ibigawa","Ichikai","Ichikawamisato","Ichinohe","Iide","Iijima","Iizuna","Ikawa","Inagawa","Itakura","Iwaizumi","Iwate","Kagamino","Kaisei","Kamifurano","Kamiita","Kamijima","Kamikawa","Kamikawa","Kamikawa","Kaminokawa","Kamishihoro","Kamitonda","Kamiyama","Kanda","Kanna","Kasagi","Kasuya","Katsuura","Kawabe","Kawagoe","Kawajima","Kawamata","Kawamoto","Kawanehon","Kawanishi","Kawara","Kawasaki","Kawasaki","Kawatana","Kawazu","Kihoku","Kikonai","Kin","Kiso","Kitagata","Kitajima","Kiyama","Kiyosato","Kofu","Koge","Kohoku","Kokonoe","Kora","Kosa","Kosaka","Kotohira","Kudoyama","Kumejima","Kumenan","Kumiyama","Kunitomi","Kurate","Kushimoto","Kutchan","Kyonan","Kyotamba","Mashike","Matsumae","Mifune","Mihama","Minabe","Minami","Minamiechizen","Minamioguni","Minamiosumi","Minamitane","Misaki","Misasa","Misato","Miyashiro","Miyoshi","Mori","Moseushi","Mutsuzawa","Nagaizumi","Nagatoro","Nagayo","Nagomi","Nakadomari","Nakanojo","Nakashibetsu","Nakatosa","Namegawa","Namie","Nanbu","Nanporo","Naoshima","Nasu","Niseko","Nishihara","Nishiizu","Nishikatsura","Nishikawa","Nishinoshima","Nishiwaga","Nogi","Noto","Nyuzen","Oarai","Obuse","Odai","Ogawara","Oharu","Oi","Oirase","Oishida","Oiso","Oizumi","Oji","Okagaki","Oketo","Okutama","Omu","Ono","Osaki","Osakikamijima","Otobe","Otsuki","Owani","Reihoku","Rifu","Rikubetsu","Rishiri","Rokunohe","Ryuo","Saka","Sakuho","Samani","Satsuma","Sayo","Saza","Setana","Shakotan","Shibayama","Shikama","Shimamoto","Shimizu","Shimokawa","Shintomi","Shirakawa","Shisui","Shitara","Sobetsu","Sue","Sumita","Suooshima","Suttsu","Tabuse","Tachiarai","Tadami","Tadaoka","Taiji","Taiki","Takachiho","Takahama","Taketoyo","Tako","Taragi","Tateshina","Tatsugo","Tawaramoto","Teshikaga","Tobe","Toin","Tokigawa","Toma","Tomioka","Tonosho","Tosa","Toyo","Toyokoro","Toyotomi","Toyoyama","Tsubata","Tsubetsu","Tsukigata","Tsunan","Tsuno","Tsuwano","Umi","Wakasa","Yamamoto","Yamanobe","Yamatsuri","Yanaizu","Yasuda","Yoichi","Yonaguni","Yoro","Yoshino","Yubetsu","Yugawara","Yuni","Yusuhara","Yuza"],
    ["Abrigada","Afonsoeiro","Agueda","Aguiar","Aguilada","Alagoas","Alagoinhas","Albufeira","Alcacovas","Alcanhoes","Alcobaca","Alcochete","Alcoutim","Aldoar","Alexania","Alfeizerao","Algarve","Alenquer","Almada","Almagreira","Almeirim","Alpalhao","Alpedrinha","Alvalade","Alverca","Alvor","Alvorada","Amadora","Amapa","Amieira","Anapolis","Anhangueira","Ansiaes","Apelacao","Aracaju","Aranhas","Arega","Areira","Araguaina","Araruama","Arganil","Armacao","Arouca","Asfontes","Assenceira","Avelar","Aveiro","Azambuja","Azinheira","Azueira","Bahia","Bairros","Balsas","Barcarena","Barreiras","Barreiro","Barretos","Batalha","Beira","Beja","Benavente","Betim","Boticas","Braga","Braganca","Brasilia","Brejo","Cabecao","Cabeceiras","Cabedelo","Cabofrio","Cachoeiras","Cadafais","Calheta","Calihandriz","Calvao","Camacha","Caminha","Campinas","Canidelo","Canha","Canoas","Capinha","Carmoes","Cartaxo","Carvalhal","Carvoeiro","Cascavel","Castanhal","Castelobranco","Caueira","Caxias","Chapadinha","Chaves","Celheiras","Cocais","Coimbra","Comporta","Coentral","Conde","Copacabana","Coqueirinho","Coruche","Corumba","Couco","Cubatao","Curitiba","Damaia","Doisportos","Douradilho","Dourados","Enxames","Enxara","Erada","Erechim","Ericeira","Ermidasdosado","Ervidel","Escalhao","Escariz","Esmoriz","Estombar","Espinhal","Espinho","Esposende","Esquerdinha","Estela","Estoril","Eunapolis","Evora","Famalicao","Famoes","Fanhoes","Fanzeres","Fatela","Fatima","Faro","Felgueiras","Ferreira","Figueira","Flecheiras","Florianopolis","Fornalhas","Fortaleza","Freiria","Freixeira","Frielas","Fronteira","Funchal","Fundao","Gaeiras","Gafanhadaboahora","Goa","Goiania","Gracas","Gradil","Grainho","Gralheira","Guarulhos","Guetim","Guimaraes","Horta","Iguacu","Igrejanova","Ilhavo","Ilheus","Ipanema","Iraja","Itaboral","Itacuruca","Itaguai","Itanhaem","Itapevi","Juazeiro","Lagos","Lavacolchos","Laies","Lamego","Laranjeiras","Leiria","Limoeiro","Linhares","Lisboa","Lomba","Lorvao","Lourencomarques","Lourical","Lourinha","Luziania","Macao","Macapa","Macedo","Machava","Malveira","Manaus","Mangabeira","Mangaratiba","Marambaia","Maranhao","Maringue","Marinhais","Matacaes","Matosinhos","Maxial","Maxias","Mealhada","Meimoa","Meires","Milharado","Mira","Miranda","Mirandela","Mogadouro","Montalegre","Montesinho","Moura","Mourao","Mozelos","Negroes","Neiva","Nespereira","Nilopolis","Niteroi","Nordeste","Obidos","Odemira","Odivelas","Oeiras","Oleiros","Olhao","Olhalvo","Olhomarinho","Olinda","Olival","Oliveira","Oliveirinha","Oporto","Ourem","Ovar","Palhais","Palheiros","Palmeira","Palmela","Palmital","Pampilhosa","Pantanal","Paradinha","Parelheiros","Paripueira","Paudalho","Pedrosinho","Penafiel","Peniche","Pedrogao","Pegoes","Pinhao","Pinheiro","Pinhel","Pombal","Pontal","Pontinha","Portel","Portimao","Poxim","Quarteira","Queijas","Queluz","Quiaios","Ramalhal","Reboleira","Recife","Redinha","Ribadouro","Ribeira","Ribeirao","Rosais","Roteiro","Sabugal","Sacavem","Sagres","Sandim","Sangalhos","Santarem","Santos","Sarilhos","Sarzedas","Satao","Satuba","Seixal","Seixas","Seixezelo","Seixo","Selmes","Sepetiba","Serta","Setubal","Silvares","Silveira","Sinhaem","Sintra","Sobral","Sobralinho","Sorocaba","Tabuacotavir","Tabuleiro","Taveiro","Teixoso","Telhado","Telheiro","Tomar","Torrao","Torreira","Torresvedras","Tramagal","Trancoso","Troviscal","Vagos","Valpacos","Varzea","Vassouras","Velas","Viana","Vidigal","Vidigueira","Vidual","Viladerei","Vilamar","Vimeiro","Vinhais","Vinhos","Viseu","Vitoria","Vlamao","Vouzela"],
    ["Acaltepec","Acaltepecatl","Acapulco","Acatlan","Acaxochitlan","Ajuchitlan","Atotonilco","Azcapotzalco","Camotlan","Campeche","Chalco","Chapultepec","Chiapan","Chiapas","Chihuahua","Cihuatlan","Cihuatlancihuatl","Coahuila","Coatepec","Coatlan","Coatzacoalcos","Colima","Colotlan","Coyoacan","Cuauhillan","Cuauhnahuac","Cuauhtemoc","Cuernavaca","Ecatepec","Epatlan","Guanajuato","Huaxacac","Huehuetlan","Hueyapan","Ixtapa","Iztaccihuatl","Iztapalapa","Jalisco","Jocotepec","Jocotepecxocotl","Matixco","Mazatlan","Michhuahcan","Michoacan","Michoacanmichin","Minatitlan","Naucalpan","Nayarit","Nezahualcoyotl","Oaxaca","Ocotepec","Ocotlan","Olinalan","Otompan","Popocatepetl","Queretaro","Sonora","Tabasco","Tamaulipas","Tecolotlan","Tenochtitlan","Teocuitlatlan","Teocuitlatlanteotl","Teotlalco","Teotlalcoteotl","Tepotzotlan","Tepoztlantepoztli","Texcoco","Tlachco","Tlalocan","Tlaxcala","Tlaxcallan","Tollocan","Tolutepetl","Tonanytlan","Tototlan","Tuchtlan","Tuxpan","Uaxacac","Xalapa","Xochimilco","Xolotlan","Yaotlan","Yopico","Yucatan","Yztac","Zacatecas","Zacualco"],
    ["Aba","Abadszalok","Abony","Adony","Ajak","Albertirsa","Alsozsolca","Aszod","Babolna","Bacsalmas","Baktaloranthaza","Balassagyarmat","Balatonalmadi","Balatonboglar","Balatonfured","Balatonfuzfo","Balkany","Balmazujvaros","Barcs","Bataszek","Batonyterenye","Battonya","Bekes","Berettyoujfalu","Berhida","Biatorbagy","Bicske","Biharkeresztes","Bodajk","Boly","Bonyhad","Budakalasz","Budakeszi","Celldomolk","Csakvar","Csenger","Csongrad","Csorna","Csorvas","Csurgo","Dabas","Demecser","Derecske","Devavanya","Devecser","Dombovar","Dombrad","Dorogullo","Dunafoldvar","Dunaharaszti","Dunavarsany","Dunavecse","Edeleny","Elek","Emod","Encs","Enying","Ercsi","Fegyvernek","Fehergyarmat","Felsozsolca","Fertoszentmiklos","Fonyod","Fot","Fuzesabony","Fuzesgyarmat","Gardony","God","Gyal","Gyomaendrod","Gyomro","Hajdudorog","Hajduhadhaz","Hajdunanas","Hajdusamson","Hajduszoboszlo","Halasztelek","Harkany","Hatvan","Heves","Heviz","Ibrany","Isaszeg","Izsak","Janoshalma","Janossomorja","Jaszapati","Jaszarokszallas","Jaszfenyszaru","Jaszkiser","Kaba","Kalocsa","Kapuvar","Karcag","Kecel","Kemecse","Kenderes","Kerekegyhaza","Kerepes","Keszthely","Kisber","Kiskoros","Kiskunmajsa","Kistarcsa","Kistelek","Kisujszallas","Kisvarda","Komadi","Komarom","Komlo","Kormend","Korosladany","Koszeg","Kozarmisleny","Kunhegyes","Kunszentmarton","Kunszentmiklos","Labatlan","Lajosmizse","Lenti","Letavertes","Letenye","Lorinci","Maglod","Mako","Mandok","Marcali","Martfu","Martonvasar","Mateszalka","Melykut","Mezobereny","Mezocsat","Mezohegyes","Mezokeresztes","Mezokovacshaza","Mezokovesd","Mezotur","Mindszent","Mohacs","Monor","Mor","Morahalom","Nadudvar","Nagyatad","Nagyecsed","Nagyhalasz","Nagykallo","Nagykata","Nagykoros","Nagymaros","Nyekladhaza","Nyergesujfalu","Nyiradony","Nyirbator","Nyirmada","Nyirtelek","Ocsa","Orkeny","Oroszlany","Paks","Pannonhalma","Paszto","Pecel","Pecsvarad","Pilis","Pilisvorosvar","Polgar","Polgardi","Pomaz","Puspokladany","Pusztaszabolcs","Putnok","Racalmas","Rackeve","Rakamaz","Rakoczifalva","Sajoszentpeter","Sandorfalva","Sarbogard","Sarkad","Sarospatak","Sarvar","Satoraljaujhely","Siklos","Simontornya","Solt","Soltvadkert","Sumeg","Szabadszallas","Szarvas","Szazhalombatta","Szecseny","Szeghalom","Szendro","Szentgotthard","Szentlorinc","Szerencs","Szigethalom","Szigetvar","Szikszo","Tab","Tamasi","Tapioszele","Tapolca","Tat","Tata","Teglas","Tet","Tiszacsege","Tiszafoldvar","Tiszafured","Tiszakecske","Tiszalok","Tiszaujvaros","Tiszavasvari","Tokaj","Tokol","Tolna","Tompa","Torokbalint","Torokszentmiklos","Totkomlos","Tura","Turkeve","Ujkigyos","ujszasz","Vamospercs","Varpalota","Vasarosnameny","Vasvar","Vecses","Velence","Veresegyhaz","Verpelet","Veszto","Zahony","Zalaszentgrot","Zirc","Zsambek"],
    ["Adapazari","Adiyaman","Afshin","Afyon","Ari","Akchaabat","Akchakale","Akchakoca","Akdamadeni","Akhisar","Aksaray","Akshehir","Alaca","Alanya","Alapli","Alashehir","Amasya","Anamur","Antakya","Ardeshen","Artvin","Aydin","Ayvalik","Babaeski","Bafra","Balikesir","Bandirma","Bartin","Bashiskele","Batman","Bayburt","Belen","Bergama","Besni","Beypazari","Beyshehir","Biga","Bilecik","Bingul","Birecik","Bismil","Bitlis","Bodrum","Bolu","Bolvadin","Bor","Bostanichi","Boyabat","Bozuyuk","Bucak","Bulancak","Bulanik","Burdur","Burhaniye","Chan","Chanakkale","Chankiri","Charshamba","Chaycuma","Chayeli","Chayirova","Cherkezkuy","Cheshme","Ceyhan","Ceylanpinar","Chine","Chivril","Cizre","Chorlu","Chumra","Dalaman","Darica","Denizli","Derik","Derince","Develi","Devrek","Didim","Dilovasi","Dinar","Diyadin","Diyarbakir","Doubayazit","Durtyol","Duzce","Duzichi","Edirne","Edremit","Elazi","Elbistan","Emirda","Erbaa","Ercish","Erdek","Erdemli","Ereli","Ergani","Erzin","Erzincan","Erzurum","Eskishehir","Fatsa","Fethiye","Gazipasha","Gebze","Gelibolu","Gerede","Geyve","Giresun","Guksun","Gulbashi","Gulcuk","Gurnen","Gumushhane","Guroymak","Hakkari","Harbiye","Havza","Hayrabolu","Hilvan","Idil","Idir","Ilgin","Imamolu","Incirliova","Inegul","Iskenderun","Iskilip","Islahiye","Isparta","Izmit","Iznik","Kadirli","Kahramanmarash","Kahta","Kaman","Kapakli","Karabuk","Karacabey","Karadeniz Ereli","Karakupru","Karaman","Karamursel","Karapinar","Karasu","Kars","Kartepe","Kastamonu","Kemer","Keshan","Kilimli","Kilis","Kirikhan","Kirikkale","Kirklareli","Kirshehir","Kiziltepe","Kurfez","Korkuteli","Kovancilar","Kozan","Kozlu","Kozluk","Kulu","Kumluca","Kurtalan","Kushadasi","Kutahya","Luleburgaz","Malatya","Malazgirt","Malkara","Manavgat","Manisa","Mardin","Marmaris","Mersin","Merzifon","Midyat","Milas","Mula","Muratli","Mush","Mut","Nazilli","Nevshehir","Nide","Niksar","Nizip","Nusaybin","udemish","Oltu","Ordu","Orhangazi","Ortaca","Osmancik","Osmaniye","Patnos","Payas","Pazarcik","Polatli","Reyhanli","Rize","Safranbolu","Salihli","Samanda","Samsun","Sandikli","shanliurfa","Saray","Sarikamish","Sarikaya","sharkishla","shereflikochhisar","Serik","Serinyol","Seydishehir","Siirt","Silifke","Silopi","Silvan","Simav","Sinop","shirnak","Sivas","Siverek","Surke","Soma","Sorgun","Suluova","Sungurlu","Suruch","Susurluk","Tarsus","Tatvan","Tavshanli","Tekirda","Terme","Tire","Tokat","Tosya","Trabzon","Tunceli","Turgutlu","Turhal","Unye","Ushak","Uzunkurpru","Van","Vezirkurpru","Viranshehir","Yahyali","Yalova","Yenishehir","Yerkury","Yozgat","Yuksekova","Zile","Zonguldak"],
    ["Abkhouch","Adrar","Agadir","Agelmam","Aghmat","Agrakal","Agulmam","Ahaggar","Almou","Anfa","Annaba","Aousja","Arbat","Argoub","Arif","Asfi","Assamer","Assif","Azaghar","Azmour","Azrou","Beccar","Beja","Bennour","Benslimane","Berkane","Berrechid","Bizerte","Bouskoura","Boutferda","Dar Bouazza","Darallouch","Darchaabane","Dcheira","Denden","Djebel","Djedeida","Drargua","Essaouira","Ezzahra","Fas","Fnideq","Ghezeze","Goubellat","Grisaffen","Guelmim","Guercif","Hammamet","Harrouda","Hoceima","Idurar","Ifendassen","Ifoghas","Imilchil","Inezgane","Izoughar","Jendouba","Kacem","Kelibia","Kenitra","Kerrando","Khalidia","Khemisset","Khenifra","Khouribga","Kidal","Korba","Korbous","Lahraouyine","Larache","Leyun","Lqliaa","Manouba","Martil","Mazagan","Mcherga","Mdiq","Megrine","Mellal","Melloul","Midelt","Mohammedia","Mornag","Mrrakc","Nabeul","Nadhour","Nador","Nawaksut","Nefza","Ouarzazate","Ouazzane","Oued Zem","Oujda","Ouladteima","Qsentina","Rades","Rafraf","Safi","Sefrou","Sejnane","Settat","Sijilmassa","Skhirat","Slimane","Somaa","Sraghna","Susa","Tabarka","Taferka","Tafza","Tagbalut","Tagerdayt","Takelsa","Tanja","Tantan","Taourirt","Taroudant","Tasfelalayt","Tattiwin","Taza","Tazerka","Tazizawt","Tebourba","Teboursouk","Temara","Testour","Tetouan","Tibeskert","Tifelt","Tinariwen","Tinduf","Tinja","Tiznit","Toubkal","Trables","Tubqal","Tunes","Urup","Watlas","Wehran","Wejda","Youssoufia","Zaghouan","Zahret","Zemmour","Zriba"],
    ["Abadilah","Abayt","Abha","Abud","Aden","Ahwar","Ajman","Alabadilah","Alabar","Alahjer","Alain","Alaraq","Alarish","Alarjam","Alashraf","Alaswaaq","Alawali","Albarar","Albawadi","Albirk","Aldhabiyah","Alduwaid","Alfareeq","Algayed","Alhada","Alhafirah","Alhamar","Alharam","Alharidhah","Alhawtah","Alhazim","Alhrateem","Alhudaydah","Alhujun","Alhuwaya","Aljahra","Aljohar","Aljubail","Alkawd","Alkhalas","Alkhawaneej","Alkhen","Alkhhafah","Alkhobar","Alkhuznah","Alkiranah","Allisafah","Allith","Almadeed","Almardamah","Almarwah","Almasnaah","Almejammah","Almojermah","Almshaykh","Almurjan","Almuwayh","Almuzaylif","Alnaheem","Alnashifah","Alqadeimah","Alqah","Alqahma","Alqalh","Alqouz","Alquaba","Alqunfudhah","Alqurayyat","Alradha","Alraqmiah","Alsadyah","Alsafa","Alshagab","Alshoqiq","Alshuqaiq","Alsilaa","Althafeer","Alwakrah","Alwasqah","Amaq","Amran","Annaseem","Aqbiyah","Arafat","Arar","Ardah","Arrawdah","Asfan","Ashayrah","Ashshahaniyah","Askar","Assaffaniyah","Ayaar","Aziziyah","Baesh","Bahrah","Baish","Balhaf","Banizayd","Baqaa","Baqal","Bidiyah","Bisha","Biyatah","Buqhayq","Burayda","Dafiyat","Damad","Dammam","Dariyah","Daynah","Dhafar","Dhahran","Dhalkut","Dhamar","Dhubab","Dhurma","Dibab","Dirab","Doha","Dukhan","Duwaibah","Enaker","Fadhla","Fahaheel","Fanateer","Farasan","Fardah","Fujairah","Ghalilah","Ghar","Ghizlan","Ghomgyah","Ghran","Hababah","Habil","Hadiyah","Haffah","Hajanbah","Hajrah","Halban","Haqqaq","Haradh","Hasar","Hathah","Hawarwar","Hawaya","Hawiyah","Hebaa","Hefar","Hijal","Husnah","Huwailat","Huwaitah","Irqah","Isharah","Ithrah","Jamalah","Jarab","Jareef","Jarwal","Jash","Jazan","Jeddah","Jiblah","Jihanah","Jilah","Jizan","Joha","Joraibah","Juban","Jubbah","Juddah","Jumeirah","Kamaran","Keyad","Khab","Khabtsaeed","Khaiybar","Khasab","Khathirah","Khawarah","Khulais","Khulays","Klayah","Kumzar","Limah","Linah","Mabar","Madrak","Mahab","Mahalah","Makhtar","Makshosh","Manfuhah","Manifah","Manshabah","Mareah","Masdar","Mashwar","Masirah","Maskar","Masliyah","Mastabah","Maysaan","Mazhar","Mdina","Meeqat","Mirbah","Mirbat","Mokhtara","Muharraq","Muladdah","Musandam","Musaykah","Muscat","Mushayrif","Musrah","Mussafah","Mutrah","Nafhan","Nahdah","Nahwa","Najran","Nakhab","Nizwa","Oman","Qadah","Qalhat","Qamrah","Qasam","Qatabah","Qawah","Qosmah","Qurain","Quraydah","Quriyat","Qurwa","Rabigh","Radaa","Rafha","Rahlah","Rakamah","Rasheedah","Rasmadrakah","Risabah","Rustaq","Ryadh","Saabah","Saabar","Sabtaljarah","Sabya","Sadad","Sadah","Safinah","Saham","Sahlat","Saihat","Salalah","Salmalzwaher","Salmiya","Sanaa","Sanaban","Sayaa","Sayyan","Shabayah","Shabwah","Shafa","Shalim","Shaqra","Sharjah","Sharkat","Sharurah","Shatifiyah","Shibam","Shidah","Shifiyah","Shihar","Shoqra","Shoqsan","Shuwaq","Sibah","Sihmah","Sinaw","Sirwah","Sohar","Suhailah","Sulaibiya","Sunbah","Tabuk","Taif","Taqah","Tarif","Tharban","Thumrait","Thuqbah","Thuwal","Tubarjal","Turaif","Turbah","Tuwaiq","Ubar","Umaljerem","Urayarah","Urwah","Wabrah","Warbah","Yabreen","Yadamah","Yafur","Yarim","Yemen","Yiyallah","Zabid","Zahwah","Zallaq","Zinjibar","Zulumah"],
    ["Aaluik","Aappilattoq","Aasiaat","Agdleruussakasit","Aggas","Akia","Akilia","Akuliaruseq","Akuliarutsip","Akunnaaq","Agissat","Agssaussat","Alluitsup","Alluttoq","Aluit","Aluk","Ammassalik","Amarortalik","Amitsorsuaq","Anarusuk","Angisorsuaq","Anguniartarfik","Annertussoq","Annikitsoq","Anoraliuirsoq","Appat","Apparsuit","Apusiaajik","Arsivik","Arsuk","Ataa","Atammik","Ateqanngitsorsuaq","Atilissuaq","Attu","Aukarnersuaq","Augpalugtoq, Aumat","Auvilikavsak","Auvilkikavsaup","Avadtlek","Avallersuaq","Bjornesk","Blabaerdalen","Blomsterdalen","Brattalhid","Bredebrae","Brededal","Claushavn","Edderfulegoer","Egger","Eqalugalinnguit","Eqalugarssuit","Eqaluit","Eqqua","Etah","Graah","Hakluyt","Haredalen","Hareoen","Hundeo","Igdlorssuit","Igaliku","Igdlugdlip","Igdluluarssuk","Iginniafik","Ikamiuk","Ikamiut","Ikarissat","Ikateq","Ikeq","Ikerasak","Ikerasaarsuk","Ikermiut","Ikermoissuaq","Ikertivaq","Ikorfarssuit","Ikorfat","Ilimanaq","Illorsuit","Iluileq","Iluiteq","Ilulissat","Illunnguit","Imaarsivik","Imartunarssuk","Immikkoortukajik","Innaarsuit","Ingjald","Inneruulalik","Inussullissuaq","Iqek","Ikerasakassak","Iperaq","Ippik","Isortok","Isungartussoq","Itileq","Itivdleq","Itissaalik","Ittit","Ittoqqortoormiit","Ivingmiut","Ivittuut","Kanajoorartuut","Kangaamiut","Kangaarsuk","Kangaatsiaq","Kangeq","Kangerluk","Kangerlussuaq","Kanglinnguit","Kapisillit","Karrat","Kekertamiut","Kiatak","Kiatassuaq","Kiataussaq","Kigatak","Kigdlussat","Kinaussak","Kingittorsuaq","Kitak","Kitsissuarsuit","Kitsissut","Klenczner","Kook","Kraulshavn","Kujalleq","Kullorsuaq","Kulusuk","Kuurmiit","Kuusuaq","Laksedalen","Maniitsoq","Marrakajik","Mattaangassut","Mernoq","Mittivakkat","Moriusaq","Myggbukta","Naajaat","Nako","Nangissat","Nanortalik","Nanuuseq","Nappassoq","Narsarmijt","Narssaq","Narsarsuaq","Narssarssuk","Nasaussaq","Nasiffik","Natsiarsiorfik","Naujanguit","Niaqornaarsuk","Niaqornat","Nordfjordspasset","Nugatsiaq","Nuluuk","Nunaa","Nunarssit","Nunarsuaq","Nunataaq","Nunatakavsaup","Nutaarmiut","Nuugaatsiaq","Nuuk","Nuukullak","Nuuluk","Nuussuaq","Olonkinbyen","Oqaatsut","Oqaitsúnguit","Oqonermiut","Oodaaq","Paagussat","Palungataq","Pamialluk","Paamiut","Paatuut","Patuersoq","Perserajoq","Paornivik","Pituffik","Puugutaa","Puulkuip","Qaanaq","Qaarsorsuaq","Qaarsorsuatsiaq","Qaasuitsup","Qaersut","Qajartalik","Qallunaat","Qaneq","Qaqaarissorsuaq","Qaqit","Qaqortok","Qasigiannguit","Qasse","Qassimiut","Qeertartivaq","Qeertartivatsiaq","Qeqertaq","Qeqertarssdaq","Qeqertarsuaq","Qeqertasussuk","Qeqertarsuatsiaat","Qeqertat","Qeqqata","Qernertoq","Qernertunnguit","Qianarreq","Qilalugkiarfik","Qingagssat","Qingaq","Qoornuup","Qorlortorsuaq","Qullikorsuit","Qunnerit","Qutdleq","Ravnedalen","Ritenbenk","Rypedalen","Sarfannguit","Saarlia","Saarloq","Saatoq","Saatorsuaq","Saatup","Saattut","Sadeloe","Salleq","Salliaruseq","Sammeqqat","Sammisoq","Sanningassoq","Saqqaq","Saqqarlersuaq","Saqqarliit","Sarqaq","Sattiaatteq","Savissivik","Serfanguaq","Sermersooq","Sermersut","Sermilik","Sermiligaaq","Sermitsiaq","Simitakaja","Simiutaq","Singamaq","Siorapaluk","Sisimiut","Sisuarsuit","Skal","Skarvefjeld","Skjoldungen","Storoen","Sullorsuaq","Suunikajik","Sverdrup","Taartoq","Takiseeq","Talerua","Tarqo","Tasirliaq","Tasiusak","Tiilerilaaq","Timilersua","Timmiarmiut","Tingmjarmiut","Traill","Tukingassoq","Tuttorqortooq","Tuujuk","Tuttulissuup","Tussaaq","Uigordlit","Uigorlersuaq","Uilortussoq","Uiivaq","Ujuaakajiip","Ukkusissat","Umanat","Upernavik","Upernattivik","Upepnagssivik","Upernivik","Uttorsiutit","Uumannaq","Uummannaarsuk","Uunartoq","Uvkusigssat","Ymer"],
    ["Abadio","Abaltzisketa","Abanto Zierbena","Aduna","Agurain","Aia","Aiara","Aizarnazabal","Ajangiz","Albiztur","Alegia","Alkiza","Alonsotegi","Altzaga","Altzo","Amezketa","Amorebieta","Amoroto","Amurrio","Andoain","Anoeta","Antzuola","Arakaldo","Arama","Aramaio","Arantzazu","Arbatzegi ","Areatza","Aretxabaleta","Arraia","Arrankudiaga","Arrasate","Arratzu","Arratzua","Arrieta","Arrigorriaga","Artea","Artzentales","Artziniega","Asparrena","Asteasu","Astigarraga","Ataun","Atxondo","Aulesti","Azkoitia","Azpeitia","Bakio","Baliarrain","Balmaseda","Barakaldo","Barrika","Barrundia","Basauri","Bastida","Beasain","Bedia","Beizama","Belauntza","Berango","Berantevilla","Berastegi","Bergara","Bermeo","Bernedo","Berriatua","Berriz","Berrobi","Bidania","Bilar","Bilbao","Burgelu","Busturia","Deba","Derio","Dima","Donemiliaga","Donostia","Dulantzi","Durango","Ea","Eibar","Elantxobe","Elduain","Elgeta","Elgoibar","Elorrio","Erandio","Ere–o","Ermua","Errenteria","Errezil","Erribera Beitia","Erriberagoitia","Errigoiti","Eskoriatza","Eskuernaga","Etxebarri","Etxebarria","Ezkio","Fika","Forua","Fruiz","Gabiria","Gaintza","Galdakao","Galdames","Gamiz","Garai","Gasteiz","Gatika","Gatzaga","Gaubea","Gauna","Gautegiz Arteaga","Gaztelu","Gernika","Gerrikaitz","Getaria","Getxo","Gizaburuaga","Goiatz","Gordexola","Gorliz","Harana","Hernani","Hernialde","Hondarribia","Ibarra","Ibarrangelu","Idiazabal","Iekora","Igorre","Ikaztegieta","Iru–a Oka","Irun","Irura","Iruraiz","Ispaster","Itsaso","Itsasondo","Iurreta","Izurtza","Jatabe","Kanpezu","Karrantza Harana","Kortezubi","Kripan","Kuartango","Lanestosa","Lantziego","Larrabetzu","Larraul","Lasarte","Laudio","Laukiz","Lazkao","Leaburu","Legazpi","Legorreta","Legutio","Leintz","Leioa","Lekeitio","Lemoa","Lemoiz","Leza","Lezama","Lezo","Lizartza","Loiu","Lumo","Ma–aria","Maeztu","Mallabia","Markina","Maruri","Ma–ueta","Me–aka","Mendaro","Mendata","Mendexa","Moreda Araba","Morga","Mundaka","Mungia","Munitibar","Murueta","Muskiz","Mutiloa","Mutriku","Muxika","Nabarniz","O–ati","Oiartzun","Oion","Okondo","Olaberria","Ondarroa","Ordizia","Orendain","Orexa","Oria","Orio","Ormaiztegi","Orozko","Ortuella","Otxandio","Pasaia","Plentzia","Portugalete","Samaniego","Santurtzi","Segura","Sestao","Sondika","Sopela","Sopuerta","Soraluze","Sukarrieta","Tolosa","Trapagaran","Turtzioz","Ubarrundia","Ubide","Ugao","Urdua","Urduliz","Urizaharra","Urkabustaiz","Urnieta","Urretxu","Usurbil","Xemein","Zaia","Zaldibar","Zaldibia","Zalduondo","Zambrana","Zamudio","Zaratamo","Zarautz","Zeanuri","Zeberio","Zegama","Zerain","Zestoa","Zierbena","Zigoitia","Ziortza","Zizurkil","Zuia","Zumaia","Zumarraga"],
    ["Abadogo","Abafon","Abdu","Acharu","Adaba","Adealesu","Adeto","Adyongo","Afaga","Afamju","Afuje","Agbelagba","Agigbigi","Agogoke","Ahute","Aiyelaboro","Ajebe","Ajola","Akarekwu","Akessan","Akunuba","Alawode","Alkaijji","Amangam","Amaoji","Amgbaye","Amtasa","Amunigun","Anase","Aniho","Animahun","Antul","Anyoko","Apekaa","Arapagi","Asamagidi","Asande","Ataibang","Awgbagba","Awhum","Awodu","Babanana","Babateduwa","Bagu","Bakura","Bandakwai","Bangdi","Barbo","Barkeje","Basa","Basabra","Basansagawa","Bieleshin","Bilikani","Birnindodo","Braidu","Bulakawa","Buriburi","Burisidna","Busum","Bwoi","Cainnan","Chakum","Charati","Chondugh","Dabibikiri","Dagwarga","Dallok","Danalili","Dandala","Darpi","Dhayaki","Dokatofa","Doma","Dozere","Duci","Dugan","Ebelibri","Efem","Efoi","Egudu","Egundugbo","Ekoku","Ekpe","Ekwere","Erhua","Eteu","Etikagbene","Ewhoeviri","Ewhotie","Ezemaowa","Fatima","Gadege","Galakura","Galea","Gamai","Gamen","Ganjin","Gantetudu","Garangamawa","Garema","Gargar","Gari","Garinbode","Garkuwa","Garu Kime","Gazabu","Gbure","Gerti","Gidan","Giringwe","Gitabaremu","Giyagiri","Giyawa","Gmawa","Golakochi","Golumba","Guchi","Gudugu","Gunji","Gusa","Gwambula","Gwamgwam","Gwodoti","Hayinlere","Hayinmaialewa","Hirishi","Hombo","Ibefum","Iberekodo","Ibodeipa","Icharge","Ideoro","Idofin","Idofinoka","Idya","Iganmeji","Igbetar","Igbogo","Ijoko","Ijuwa","Ikawga","Ikekogbe","Ikhin","Ikoro","Ikotefe","Ikotokpora","Ikpakidout","Ikpeoniong","Ilofa","Imuogo","Inyeneke","Iorsugh","Ipawo","Ipinlerere","Isicha","Itakpa","Itoki","Iyedeame","Jameri","Jangi","Jara","Jare","Jataudakum","Jaurogomki","Jepel","Jibam","Jirgu","Jirkange","Kafinmalama","Kamkem","Katab","Katanga","Katinda","Katirije","Kaurakimba","Keffinshanu","Kellumiri","Kiagbodor","Kibiare","Kingking","Kirbutu","Kita","Kogbo","Kogogo","Kopje","Koriga","Koroko","Korokorosei","Kotoku","Kuata","Kujum","Kukau","Kunboon","Kuonubogbene","Kurawe","Kushinahu","Kwaramakeri","Ladimeji","Lafiaro","Lahaga","Laindebajanle","Laindegoro","Lajere","Lakati","Ligeri","Litenswa","Lokobimagaji","Lusabe","Maba","Madarzai","Magoi","Maialewa","Maianita","Maijuja","Mairakuni","Maleh","Malikansaa","Mallamkola","Mallammaduri","Marmara","Masagu","Masoma","Mata","Matankali","Mbalare","Megoyo","Meku","Miama","Mige","Mkporagwu","Modi","Molafa","Mshi","Msugh","Muduvu","Murnachehu","Namnai","Nanumawa","Nasudu","Ndagawo","Ndamanma","Ndiebeleagu","Ndiwulunbe","Ndonutim","Ngaruwa","Ngbande","Nguengu","Nto Ekpe","Nubudi","Nyajo","Nyido","Nyior","Obafor","Obazuwa","Odajie","Odiama","Ofunatam","Ogali","Ogan","Ogbaga","Ogbahu","Ogultu","Ogunbunmi","Ogunmakin","Ojaota","Ojirami","Ojopode","Okehin","Olugunna","Omotunde","Onipede","Onisopi","Onma","Orhere","Orya","Oshotan","Otukwang","Otunade","Pepegbene","Poros","Rafin","Rampa","Rimi","Rinjim","Robertkiri","Rugan","Rumbukawa","Sabiu","Sabon","Sabongari","Sai","Salmatappare","Sangabama","Sarabe","Seboregetore","Seibiri","Sendowa","Shafar","Shagwa","Shata","Shefunda","Shengu","Sokoron","Sunnayu","Taberlma","Tafoki","Takula","Talontan","Taraku","Tarhemba","Tayu","Ter","Timtim","Timyam","Tindirke","Tirkalou","Tokunbo","Tonga","Torlwam","Tseakaadza","Tseanongo","Tseavungu","Tsebeeve","Tsekov","Tsepaegh","Tuba","Tumbo","Tungalombo","Tungamasu","Tunganrati","Tunganyakwe","Tungenzuri","Ubimimi","Uhkirhi","Umoru","Umuabai","Umuaja","Umuajuju","Umuimo","Umuojala","Unchida","Ungua","Unguwar","Unongo","Usha","Ute","Utongbo","Vembera","Vorokotok","Wachin","Walebaga","Wurawura","Wuro","Yanbashi","Yanmedi","Yenaka","Yoku","Zamangera","Zarunkwari","Zilumo","Zulika"],
    ["Aberaman","Aberangell","Aberarth","Aberavon","Aberbanc","Aberbargoed","Aberbeeg","Abercanaid","Abercarn","Abercastle","Abercegir","Abercraf","Abercregan","Abercych","Abercynon","Aberdare","Aberdaron","Aberdaugleddau","Aberdeen","Aberdulais","Aberdyfi","Aberedw","Abereiddy","Abererch","Abereron","Aberfan","Aberffraw","Aberffrwd","Abergavenny","Abergele","Aberglasslyn","Abergorlech","Abergwaun","Abergwesyn","Abergwili","Abergwynfi","Abergwyngregyn","Abergynolwyn","Aberhafesp","Aberhonddu","Aberkenfig","Aberllefenni","Abermain","Abermaw","Abermorddu","Abermule","Abernant","Aberpennar","Aberporth","Aberriw","Abersoch","Abersychan","Abertawe","Aberteifi","Aberthin","Abertillery","Abertridwr","Aberystwyth","Achininver","Afonhafren","Alisaha","Antinbhearmor","Ardenna","Attacon","Beira","Bhrura","Boioduro","Bona","Boudobriga","Bravon","Brigant","Briganta","Briva","Cambodunum","Cambra","Caracta","Catumagos","Centobriga","Ceredigion","Chalain","Dinn","Diwa","Dubingen","Duro","Ebora","Ebruac","Eburodunum","Eccles","Eighe","Eireann","Ferkunos","Genua","Ghrainnse","Inbhear","Inbhir","Inbhirair","Innerleithen","Innerleven","Innerwick","Inver","Inveraldie","Inverallan","Inveralmond","Inveramsay","Inveran","Inveraray","Inverarnan","Inverbervie","Inverclyde","Inverell","Inveresk","Inverfarigaig","Invergarry","Invergordon","Invergowrie","Inverhaddon","Inverkeilor","Inverkeithing","Inverkeithney","Inverkip","Inverleigh","Inverleith","Inverloch","Inverlochlarig","Inverlochy","Invermay","Invermoriston","Inverness","Inveroran","Invershin","Inversnaid","Invertrossachs","Inverugie","Inveruglas","Inverurie","Kilninver","Kirkcaldy","Kirkintilloch","Krake","Latense","Leming","Lindomagos","Llanaber","Lochinver","Lugduno","Magoduro","Monmouthshire","Narann","Novioduno","Nowijonago","Octoduron","Penning","Pheofharain","Ricomago","Rossinver","Salodurum","Seguia","Sentica","Theorsa","Uige","Vitodurum","Windobona"],
    ["Adab","Akkad","Akshak","Amnanum","Arbid","Arpachiyah","Arrapha","Assur","Babilim","Badtibira","Balawat","Barsip","Borsippa","Carchemish","Chagar Bazar","Chuera","Ctesiphon ","Der","Dilbat","Diniktum","Doura","Durkurigalzu","Ekallatum","Emar","Erbil","Eridu","Eshnunn","Fakhariya ","Gawra","Girsu","Hadatu","Hamoukar","Haradum","Harran","Hatra","Idu","Irisagrig","Isin","Jemdet","Kahat","Kartukulti","Khaiber","Kish ","Kisurra","Kuara","Kutha","Lagash","Larsa ","Leilan","Marad","Mardaman","Mari","Mashkan","Mumbaqat ","Nabada","Nagar","Nerebtum","Nimrud","Nineveh","Nippur","Nuzi","Qalatjarmo","Qatara","Rawda","Seleucia","Shaduppum","Shanidar","Sharrukin","Shemshara","Shibaniba","Shuruppak","Sippar","Tarbisu","Tellagrab","Tellessawwan","Tellessweyhat","Tellhassuna","Telltaya","Telul","Terqa","Thalathat","Tutub","Ubaid ","Umma","Ur","Urfa","Urkesh","Uruk","Urum","Zabalam","Zenobia"],
    ["Abali","Abrisham","Absard","Abuzeydabad","Afus","Alavicheh","Alikosh","Amol","Anarak","Anbar","Andisheh","Anshan","Aran","Ardabil","Arderica","Ardestan","Arjomand","Asgaran","Asgharabad","Ashian","Awan","Babajan","Badrud","Bafran","Baghestan","Baghshad","Bahadoran","Baharan Shahr","Baharestan","Bakun","Bam","Baqershahr","Barzok","Bastam","Behistun","Bitistar","Bumahen","Bushehr","Chadegan","Chahardangeh","Chamgardan","Chermahin","Choghabonut","Chugan","Damaneh","Damavand","Darabgard","Daran","Dastgerd","Dehaq","Dehaqan","Dezful","Dizicheh","Dorcheh","Dowlatabad","Duruntash","Ecbatana","Eslamshahr","Estakhr","Ezhiyeh","Falavarjan","Farrokhi","Fasham","Ferdowsieh","Fereydunshahr","Ferunabad","Firuzkuh","Fuladshahr","Ganjdareh","Ganzak","Gaz","Geoy","Godin","Goldasht","Golestan","Golpayegan","Golshahr","Golshan","Gorgab","Guged","Habibabad","Hafshejan","Hajjifiruz","Hana","Harand","Hasanabad","Hasanlu","Hashtgerd","Hecatompylos","Hormirzad","Imanshahr","Isfahan","Jandaq","Javadabad","Jiroft","Jowsheqan ","Jowzdan","Kabnak","Kahriz Sang","Kahrizak","Kangavar","Karaj","Karkevand","Kashan","Kelishad","Kermanshah","Khaledabad","Khansar","Khorramabad","Khur","Khvorzuq","Kilan","Komeh","Komeshcheh","Konar","Kuhpayeh","Kul","Kushk","Lavasan","Laybid","Liyan","Lyan","Mahabad","Mahallat","Majlesi","Malard","Manzariyeh","Marlik","Meshkat","Meymeh","Miandasht","Mish","Mobarakeh","Nahavand","Nain","Najafabad","Naqshe","Narezzash","Nasimshahr","Nasirshahr","Nasrabad","Natanz","Neyasar","Nikabad","Nimvar","Nushabad","Pakdasht","Parand","Pardis","Parsa","Pasargadai","Patigrabana","Pir Bakran","Pishva","Qahderijan","Qahjaverestan","Qamsar","Qarchak","Qods","Rabat","Ray-shahr","Rezvanshahr","Rhages","Robat Karim","Rozveh","Rudehen","Sabashahr","Safadasht","Sagzi","Salehieh","Sandal","Sarvestan","Sedeh","Sefidshahr","Semirom","Semnan","Shadpurabad","Shah","Shahdad","Shahedshahr","Shahin","Shahpour","Shahr","Shahreza","Shahriar","Sharifabad","Shemshak","Shiraz","Shushan","Shushtar","Sialk","Sin","Sukhteh","Tabas","Tabriz","Takhte","Talkhuncheh","Talli","Tarq","Temukan","Tepe","Tiran","Tudeshk","Tureng","Urmia","Vahidieh","Vahrkana","Vanak","Varamin","Varnamkhast","Varzaneh","Vazvan","Yahya","Yarim","Yasuj","Zarrin Shahr","Zavareh","Zayandeh","Zazeran","Ziar","Zibashahr","Zranka"],
    ["Aapueo","Ahoa","Ahuakaio","Ahuakamalii","Ahuakeio","Ahupau","Aki","Alaakua","Alae","Alaeloa","Alaenui","Alamihi","Aleamai","Alena","Alio","Aupokopoko","Auwahi","Hahakea","Haiku","Halakaa","Halehaku","Halehana","Halemano","Haleu","Haliimaile","Hamakuapoko","Hamoa","Hanakaoo","Hanaulu","Hanawana","Hanehoi","Haneoo","Haou","Hikiaupea","Hoalua","Hokuula","Honohina","Honokahua","Honokala","Honokalani","Honokeana","Honokohau","Honokowai","Honolua","Honolulu","Honolulunui","Honomaele","Honomanu","Hononana","Honopou","Hoolawa","Hopenui","Hualele","Huelo","Hulaia","Ihuula","Ilikahi","Interisland","Kaalaea","Kaalelehinale","Kaapahu","Kaehoeho","Kaeleku","Kaeo","Kahakuloa","Kahalawe","Kahalawe","Kahalehili","Kahana","Kahilo","Kahuai","Kaiaula","Kailihiakoko","Kailua","Kainehe","Kakalahale","Kakanoni","Kakio","Kakiweka","Kalena","Kalenanui","Kaleoaihe","Kalepa","Kaliae","Kalialinui","Kalihi","Kalihi","Kalihi","Kalimaohe","Kaloi","Kamani","Kamaole","Kamehame","Kanahena","Kanaio","Kaniaula","Kaonoulu","Kaopa","Kapaloa","Kapaula","Kapewakua","Kapohue","Kapuaikini","Kapunakea","Kapuuomahuka","Kauau","Kauaula","Kaukuhalahala","Kaulalo","Kaulanamoa","Kauluohana","Kaumahalua","Kaumakani","Kaumanu","Kaunauhane","Kaunuahane","Kaupakulua","Kawaipapa","Kawaloa","Kawaloa","Kawalua","Kawela","Keaa","Keaalii","Keaaula","Keahua","Keahuapono","Keakuapauaela","Kealahou","Keanae","Keauhou","Kekuapawela","Kelawea","Keokea","Keopuka","Kepio","Kihapuhala","Kikoo","Kilolani","Kipapa","Koakupuna","Koali","Koananai","Koheo","Kolea","Kolokolo","Kooka","Kopili","Kou","Kualapa","Kuhiwa","Kuholilea","Kuhua","Kuia","Kuiaha","Kuikui","Kukoae","Kukohia","Kukuiaeo","Kukuioolu","Kukuipuka","Kukuiula","Kulahuhu","Kumunui","Lapakea","Lapalapaiki","Lapueo","Launiupoko","Loiloa","Lole","Lualailua","Maalo","Mahinahina","Mahulua","Maiana","Mailepai","Makaakini","Makaalae","Makaehu","Makaiwa","Makaliua","Makapipi","Makapuu","Makawao","Makila","Mala","Maluaka","Mamalu","Manawaiapiki","Manawainui","Maulili","Mehamenui","Miana","Mikimiki","Moalii","Moanui","Mohopili","Mohopilo","Mokae","Mokuia","Mokupapa","Mooiki","Mooloa","Moomuku","Muolea","Nahuakamalii","Nailiilipoko","Nakaaha","Nakalepo","Nakaohu","Nakapehu","Nakula","Napili","Niniau","Niumalu","Nuu","Ohia","Oloewa","Olowalu","Omaopio","Onau","Onouli","Opaeula","Opana","Opikoula","Paakea","Paeahu","Paehala","Paeohi","Pahoa","Paia","Pakakia","Pakala","Palauea","Palemo","Panaewa","Paniau","Papaaea","Papaanui","Papaauhau","Papahawahawa","Papaka","Papauluana","Pauku","Paunau","Pauwalu","Pauwela","Peahi","Piapia","Pohakanele","Pohoula","Polaiki","Polanui","Polapola","Polua","Poopoo","Popoiwi","Popoloa","Poponui","Poupouwela","Puaa","Puaaluu","Puahoowali","Puakea","Puako","Pualaea","Puehuehu","Puekahi","Pueokauiki","Pukaauhuhu","Pukalani","Pukuilua","Pulehu","Pulehuiki","Pulehunui","Punaluu","Puolua","Puou","Puuhaehae","Puuhaoa","Puuiki","Puuki","Puukohola","Puulani","Puumaneoneo","Puunau","Puunoa","Puuomaiai","Puuomaile","Uaoa","Uhao","Ukumehame","Ulaino","Ulumalu","Unknown","Various","Wahikuli","Waiahole","Waiakoa","Waianae","Waianu","Waiawa","Waiehu","Waieli","Waihee","Waikapu","Wailamoa","Wailaulau","Wailua","Wailuku","Wainee","Waiohole","Waiohonu","Waiohue","Waiohuli","Waiokama","Waiokila","Waiopai","Waiopua","Waipao","Waipio","Waipioiki","Waipionui","Waipouli","Wakiu","Wananalua"],
    ["Adityapatna","Adyar","Afzalpur","Aland","Alnavar","Alur","Ambikanagara","Anekal","Ankola","Annigeri","Arkalgud","Arsikere","Athni","Aurad","Badami","Bagalkot","Bagepalli","Bail","Bajpe","Bangalore","Bangarapet","Bankapura","Bannur","Bantval","Basavakalyan","Basavana","Belgaum","Beltangadi","Belur","Bhadravati","Bhalki","Bhatkal","Bhimarayanagudi","Bidar","Bijapur","Bilgi","Birur","Bommasandra","Byadgi","Challakere","Chamarajanagar","Channagiri","Channapatna","Channarayapatna","Chik","Chikmagalur","Chiknayakanhalli","Chikodi","Chincholi","Chintamani","Chitapur","Chitgoppa","Chitradurga","Dandeli","Dargajogihalli","Devadurga","Devanahalli","Dod","Donimalai","Gadag","Gajendragarh","Gangawati","Gauribidanur","Gokak","Gonikoppal","Gubbi","Gudibanda","Gulbarga","Guledgudda","Gundlupet","Gurmatkal","Haliyal","Hangal","Harapanahalli","Harihar","Hassan","Hatti","Haveri","Hebbagodi","Heggadadevankote","Hirekerur","Holalkere","Hole","Homnabad","Honavar","Honnali","Hoovina","Hosakote","Hosanagara","Hosdurga","Hospet","Hubli","Hukeri","Hungund","Hunsur","Ilkal","Indi","Jagalur","Jamkhandi","Jevargi","Jog","Kadigenahalli","Kadur","Kalghatgi","Kamalapuram","Kampli","Kanakapura","Karkal","Karwar","Khanapur","Kodiyal","Kolar","Kollegal","Konnur","Koppa","Koppal","Koratagere","Kotturu","Krishnarajanagara","Krishnarajasagara","Krishnarajpet","Kudchi","Kudligi","Kudremukh","Kumta","Kundapura","Kundgol","Kunigal","Kurgunta","Kushalnagar","Kushtagi","Lakshmeshwar","Lingsugur","Londa","Maddur","Madhugiri","Madikeri","Mahalingpur","Malavalli","Mallar","Malur","Mandya","Mangalore","Manvi","Molakalmuru","Mudalgi","Mudbidri","Muddebihal","Mudgal","Mudhol","Mudigere","Mulbagal","Mulgund","Mulki","Mulur","Mundargi","Mundgod","Munirabad","Mysore","Nagamangala","Nanjangud","Narasimharajapura","Naregal","Nargund","Navalgund","Nipani","Pandavapura","Pavagada","Piriyapatna","Pudu","Puttur","Rabkavi","Raichur","Ramanagaram","Ramdurg","Ranibennur","Raybag","Robertson","Ron","Sadalgi","Sagar","Sakleshpur","Saligram","Sandur","Sankeshwar","Saundatti","Savanur","Sedam","Shahabad","Shahpur","Shaktinagar","Shiggaon","Shikarpur","Shirhatti","Shorapur","Shrirangapattana","Siddapur","Sidlaghatta","Sindgi","Sindhnur","Sira","Siralkoppa","Sirsi","Siruguppa","Somvarpet","Sorab","Sringeri","Srinivaspur","Sulya","Talikota","Tarikere","Tekkalakote","Terdal","Thumbe","Tiptur","Tirthahalli","Tirumakudal","Tumkur","Turuvekere","Udupi","Vijayapura","Wadi","Yadgir","Yelandur","Yelbarga","Yellapur","Yenagudde"],
    ["Altomisayoq","Ancash","Andahuaylas","Apachekta","Apachita","Apu ","Apurimac","Arequipa","Atahuallpa","Atawalpa","Atico","Ayacucho","Ayllu","Cajamarca","Carhuac","Carhuacatac","Cashan","Caullaraju","Caxamalca","Cayesh","Chacchapunta","Chacraraju","Champara","Chanchan","Chekiacraju","Chinchey","Chontah","Chopicalqui","Chucuito","Chuito","Chullo","Chumpi","Chuncho","Chuquiapo","Churup","Cochapata","Cojup","Collota","Conococha","Copa","Corihuayrachina","Cusichaca","Despacho","Haika","Hanpiq","Hatun","Haywarisqa","Huaca","Hualcan","Huamanga","Huamashraju","Huancarhuas","Huandoy","Huantsan","Huarmihuanusca","Huascaran","Huaylas","Huayllabamba","Huichajanca","Huinayhuayna","Huinioch","Illiasca","Intipunku","Ishinca","Jahuacocha","Jirishanca","Juli","Jurau","Kakananpunta","Kamasqa","Karpay","Kausay","Khuya ","Kuelap","Llaca","Llactapata","Llanganuco","Llaqta","Llupachayoc","Machu","Mallku","Matarraju","Mikhuy","Milluacocha","Munay","Ocshapalca","Ollantaytambo","Pacamayo","Paccharaju","Pachacamac","Pachakamaq","Pachakuteq","Pachakuti","Pachamama  ","Paititi","Pajaten","Palcaraju","Pampa","Panaka","Paqarina","Paqo","Parap","Paria","Patallacta","Phuyupatamarca","Pisac","Pongos","Pucahirca","Pucaranra","Puscanturpa","Putaca","Qawaq ","Qayqa","Qochamoqo","Qollana","Qorihuayrachina","Qorimoqo","Quenuaracra","Queshque","Quillcayhuanca","Quillya","Quitaracsa","Quitaraju","Qusqu","Rajucolta","Rajutakanan","Rajutuna","Ranrahirca","Ranrapalca","Raria","Rasac","Rimarima","Riobamba","Runkuracay","Rurec","Sacsa","Saiwa","Sarapo","Sayacmarca","Sinakara","TamboColorado","Tamboccocha","Taripaypacha","Taulliraju","Tawantinsuyu","Taytanchis","Tiwanaku","Tocllaraju","Tsacra","Tuco","Tullparaju","Tumbes","Ulta","Uruashraju","Vallunaraju","Vilcabamba","Wacho ","Wankawillka","Wayra","Yachay","Yahuarraju","Yanamarey","Yanesha","Yerupaja"],
    ["Abim","Adjumani","Alebtong","Amolatar","Amuria","Amuru","Apac","Arua","Arusha","Babati","Baragoi","Bombo","Budaka","Bugembe","Bugiri","Buikwe","Bukedea","Bukoba","Bukomansimbi","Bukungu","Buliisa","Bundibugyo","Bungoma","Busembatya","Bushenyi","Busia","Busia","Busolwe","Butaleja","Butambala","Butere","Buwenge","Buyende","Dadaab","Dodoma","Dokolo","Eldoret","Elegu","Emali","Embu","Entebbe","Garissa","Gede","Gulu","Handeni","Hima","Hoima","Hola","Ibanda","Iganga","Iringa","Isingiro","Isiolo","Jinja","Kaabong","Kabale","Kaberamaido","Kabuyanda","Kabwohe","Kagadi","Kahama","Kajiado","Kakamega","Kakinga","Kakira","Kakiri","Kakuma","Kalangala","Kaliro","Kalisizo","Kalongo","Kalungu","Kampala","Kamuli","Kamwenge","Kanoni","Kanungu","Kapchorwa","Kapenguria","Kasese","Kasulu","Katakwi","Kayunga","Kericho","Keroka","Kiambu","Kibaale","Kibaha","Kibingo","Kiboga","Kibwezi","Kigoma","Kihiihi","Kilifi","Kira","Kiruhura","Kiryandongo","Kisii","Kisoro","Kisumu","Kitale","Kitgum","Kitui","Koboko","Korogwe","Kotido","Kumi","Kyazanga","Kyegegwa","Kyenjojo","Kyotera","Lamu","Langata","Lindi","Lodwar","Lokichoggio","Londiani","Loyangalani","Lugazi","Lukaya","Luweero","Lwakhakha","Lwengo","Lyantonde","Machakos","Mafinga","Makambako","Makindu","Malaba","Malindi","Manafwa","Mandera","Maralal","Marsabit","Masaka","Masindi","MasindiPort","Masulita","Matugga","Mayuge","Mbale","Mbarara","Mbeya","Meru","Mitooma","Mityana","Mombasa","Morogoro","Moroto","Moshi","Moyale","Moyo","Mpanda","Mpigi","Mpondwe","Mtwara","Mubende","Mukono","Mumias","Muranga","Musoma","Mutomo","Mutukula","Mwanza","Nagongera","Nairobi","Naivasha","Nakapiripirit","Nakaseke","Nakasongola","Nakuru","Namanga","Namayingo","Namutumba","Nansana","Nanyuki","Narok","Naromoru","Nebbi","Ngora","Njeru","Njombe","Nkokonjeru","Ntungamo","Nyahururu","Nyeri","Oyam","Pader","Paidha","Pakwach","Pallisa","Rakai","Ruiru","Rukungiri","Rwimi","Sanga","Sembabule","Shimoni","Shinyanga","Singida","Sironko","Songea","Soroti","Ssabagabo","Sumbawanga","Tabora","Takaungu","Tanga","Thika","Tororo","Tunduma","Vihiga","Voi","Wajir","Wakiso","Watamu","Webuye","Wobulenzi","Wote","Wundanyi","Yumbe","Zanzibar"],
    ["An Khe","An Nhon","Ayun Pa","Ba Don","Ba Ria","Bac Giang","Bac Kan","Bac Lieu","Bac Ninh","Bao Loc","Ben Cat","Ben Tre","Bien Hoa","Bim Son","Binh Long","Binh Minh","Buon Ho","Buon Ma Thuot","Ca Mau","Cai Lay","Cam Pha","Cam Ranh","Can Tho","Cao Bang","Cao Lanh","Chau Doc","Chi Linh","Cua Lo","Da Lat","Da Nang","Di An","Dien Ban","Dien Bien Phu","Dong Ha","Dong Hoi","Dong Trieu","Duyen Hai","Gia Nghia","Gia Rai","Go Cong","Ha Giang","Ha Long","Ha Noi","Ha Tinh","Hai Duong","Hai Phong","Hoa Binh","Hoang Mai","Hoi An","Hong Linh","Hong Ngu","Hue","Hung Yen","Huong Thuy","Huong Tra","Kien Tuong","Kon Tum","Ky Anh","La Gi","Lai Chau","Lang Son","Lao Cai","Long Khanh","Long My","Long Xuyen","Mong Cai","Muong Lay","My Hao","My Tho","Nam Dinh","Nga Bay","Nga Nam","Nghia Lo","Nha Trang","Ninh Binh","Ninh Hoa","Phan Rang Thap Cham","Phan Thiet","Pho Yen","Phu Ly","Phu My","Phu Tho","Phuoc Long","Pleiku","Quang Ngai","Quang Tri","Quang Yen","Quy Nhon","Rach Gia","Sa Dec","Sam Son","Soc Trang","Son La","Son Tay","Song Cau","Song Cong","Tam Diep","Tam Ky","Tan An","Tan Chau","Tan Uyen","Tay Ninh","Thai Binh","Thai Hoa","Thai Nguyen","Thanh Hoa","Thu Dau Mot","Thuan An","Tra Vinh","Tu Son","Tuy Hoa","Tuyen Quang","Uong Bi","Vi Thanh","Viet Tri","Vinh","Vinh Chau","Vinh Long","Vinh Yen","Vung Tau","Yen Bai"],
    ["Chaiwan", "Chekham", "Cheungshawan", "Chingchung", "Chinghoi", "Chingsen", "Chingshing", "Chiunam", "Chiuon", "Chiuyeung", "Chiyuen", "Choihung", "Chuehoi", "Chuiman", "Chungfa", "Chungfu", "Chungsan", "Chunguktsuen", "Dakhing", "Daopo", "Daumun", "Dingwu", "Dinpak", "Donggun", "Dongyuen", "Duenchau", "Fachau", "Fado", "Fanling", "Fatgong", "Fatshan", "Fotan", "Fuktien", "Fumun", "Funggong", "Funghoi", "Fungshun", "Fungtei", "Gamtin", "Gochau", "Goming", "Gonghoi", "Gongshing", "Goyiu", "Hanghau", "Hangmei", "Hashan", "Hengfachuen", "Hengon", "Heungchau", "Heunggong", "Heungkiu", "Hingning", "Hohfuktong", "Hoichue", "Hoifung", "Hoiping", "Hokong", "Hokshan", "Homantin", "Hotin", "Hoyuen", "Hunghom", "Hungshuikiu", "Jiuling", "Kamping", "Kamsheung", "Kamwan", "Kaulongtong", "Keilun", "Kinon", "Kinsang", "Kityeung", "Kongmun", "Kukgong", "Kwaifong", "Kwaihing", "Kwongchau", "Kwongling", "Kwongming", "Kwuntong", "Laichikok", "Laiking", "Laiwan", "Lamtei", "Lamtin", "Leitung", "Leungking", "Limkong", "Linchau", "Linnam", "Linping", "Linshan", "Loding", "Lokcheong", "Lokfu", "Lokmachau", "Longchuen", "Longgong", "Longmun", "Longping", "Longwa", "Longwu", "Lowu", "Luichau", "Lukfung", "Lukho", "Lungmun", "Macheung", "Maliushui", "Maonshan", "Mauming", "Maunam", "Meifoo", "Mingkum", "Mogong", "Mongkok", "Muichau", "Muigong", "Muiyuen", "Naiwai", "Namcheong", "Namhoi", "Namhong", "Namo", "Namsha", "Namshan", "Nganwai", "Ngchuen", "Ngoumun", "Ngwa", "Nngautaukok", "Onting", "Pakwun", "Paotoishan", "Pingshan", "Pingyuen", "Poklo", "Polam", "Pongon", "Poning", "Potau", "Puito", "Punyue", "Saiwanho", "Saiyingpun", "Samshing", "Samshui", "Samtsen", "Samyuenlei", "Sanfung", "Sanhing", "Sanhui", "Sanwai", "Sanwui", "Seiwui", "Shamshuipo", "Shanmei", "Shantau", "Shatin", "Shatinwai", "Shaukeiwan", "Shauking", "Shekkipmei", "Shekmun", "Shekpai", "Sheungshui", "Shingkui", "Shiuhing", "Shundak", "Shunyi", "Shupinwai", "Simshing", "Siuhei", "Siuhong", "Siukwan", "Siulun", "Suikai", "Taihing", "Taikoo", "Taipo", "Taishuihang", "Taiwai", "Taiwo", "Taiwohau", "Tinhau", "Tinho", "Tinking", "Tinshuiwai", "Tiukengleng", "Toishan", "Tongfong", "Tonglowan", "Tsakyoochung", "Tsamgong", "Tsangshing", "Tseungkwano", "Tsihing", "Tsimshatsui", "Tsinggong", "Tsingshantsuen", "Tsingwun", "Tsingyi", "Tsingyuen", "Tsiuchau", "Tsuenshekshan", "Tsuenwan", "Tuenmun", "Tungchung", "Waichap", "Waichau", "Waidong", "Wailoi", "Waishing", "Waiyeung", "Wanchai", "Wanfau", "Wanon", "Wanshing", "Wingon", "Wongchukhang", "Wongpo", "Wongtaisin", "Woping", "Wukaisha", "Yano", "Yaumatei", "Yauoi", "Yautong", "Yenfa", "Yeungchun", "Yeungdong", "Yeunggong", "Yeungsai", "Yeungshan", "Yimtin", "Yingdak", "Yiuping", "Yongshing", "Yongyuen", "Yuenlong", "Yuenshing", "Yuetsau", "Yuknam", "Yunping", "Yuyuen"],
    ["Adaatsag", "Airag", "Alag Erdene", "Altai", "Altanshiree", "Altantsogts", "Arbulag", "Baatsagaan", "Batnorov", "Batshireet", "Battsengel", "Bayan Adarga", "Bayan Agt", "Bayanbulag", "Bayandalai", "Bayandun", "Bayangovi", "Bayanjargalan", "Bayankhongor", "Bayankhutag", "Bayanlig", "Bayanmonkh", "Bayannuur", "Bayan Ondor", "Bayan Ovoo", "Bayantal", "Bayantsagaan", "Bayantumen", "Bayan Uul", "Bayanzurkh", "Berkh", "Biger", "Binder", "Bogd", "Bombogor", "Bor Ondor", "Bugat", "Bulgan", "Buregkhangai", "Burentogtokh", "Buutsagaan", "Buyant", "Chandmani", "Chandmani Ondor", "Choibalsan", "Chuluunkhoroot", "Chuluut", "Dadal", "Dalanjargalan", "Dalanzadgad", "Darkhan", "Darvi", "Dashbalbar", "Dashinchilen", "Delger", "Delgerekh", "Delgerkhaan", "Delgerkhangai", "Delgertsogt", "Deluun", "Deren", "Dorgon", "Duut", "Erdene", "Erdenebulgan", "Erdeneburen", "Erdenedalai", "Erdenemandal", "Erdenetsogt", "Galshar", "Galt", "Galuut", "Govi Ugtaal", "Gurvan", "Gurvanbulag", "Gurvansaikhan", "Gurvanzagal", "Ikhkhet", "Ikh Tamir", "Ikh Uul", "Jargalan", "Jargalant", "Jargaltkhaan", "Jinst", "Khairkhan", "Khalhgol", "Khaliun", "Khanbogd", "Khangai", "Khangal", "Khankh", "Khankhongor", "Khashaat", "Khatanbulag", "Khatgal", "Kherlen", "Khishig Ondor", "Khokh", "Kholonbuir", "Khongor", "Khotont", "Khovd", "Khovsgol", "Khuld", "Khureemaral", "Khurmen", "Khutag Ondor", "Luus", "Mandakh", "Mandal Ovoo", "Mankhan", "Manlai", "Matad", "Mogod", "Monkhkhairkhan", "Moron", "Most", "Myangad", "Nogoonnuur", "Nomgon", "Norovlin", "Noyon", "Ogii", "Olgii", "Olziit", "Omnodelger", "Ondorkhaan", "Ondorshil", "Ondor Ulaan", "Orgon", "Orkhon", "Rashaant", "Renchinlkhumbe", "Sagsai", "Saikhan", "Saikhandulaan", "Saikhan Ovoo", "Sainshand", "Saintsagaan", "Selenge", "Sergelen", "Sevrei", "Sharga", "Sharyngol", "Shine Ider", "Shinejinst", "Shiveegovi", "Sumber", "Taishir", "Tarialan", "Tariat", "Teshig", "Togrog", "Tolbo", "Tomorbulag", "Tonkhil", "Tosontsengel", "Tsagaandelger", "Tsagaannuur", "Tsagaan Ovoo", "Tsagaan Uur", "Tsakhir", "Tseel", "Tsengel", "Tsenkher", "Tsenkhermandal", "Tsetseg", "Tsetserleg", "Tsogt", "Tsogt Ovoo", "Tsogttsetsii", "Tunel", "Tuvshruulekh", "Ulaanbadrakh", "Ulaankhus", "Ulaan Uul", "Uyench", "Yesonbulag", "Zag", "Zamyn Uud", "Zereg"]    
  ];
}

// apply default biomes data
function applyDefaultBiomesSystem() {
  const name = ["Marine","Hot desert","Cold desert","Savanna","Grassland","Tropical seasonal forest","Temparate deciduous forest","Tropical rain forest","Temperate rain forest","Taiga","Tundra","Glacier"];
  //const color = ["#53679f","#fbfaae","#e1df9b","#eef586","#bdde82","#b6d95d","#29bc56","#7dcb35","#45b348","#567c2c","#d5d59d","#e6f5fa"];
  const color = ["#53679f","#fbe79f","#b5b887","#d2d082","#c8d68f","#b6d95d","#29bc56","#7dcb35","#45b348","#4b6b32","#96784b","#d5e7eb"];
  
  const i = new Uint8Array(d3.range(0, name.length));
  const habitability = new Uint8Array([0,2,5,15,25,50,100,80,90,10,2,0]);
  const iconsDensity = new Uint8Array([0,3,2,120,120,120,120,150,150,100,5,0]);
  const icons = [{},{dune:1},{dune:1},{acacia:1, grass:9},{grass:1},{acacia:1, palm:1},{deciduous:1},{acacia:7, palm:2, deciduous:1},{deciduous:7, swamp:3},{conifer:1},{grass:1},{}];
  const cost = new Uint8Array([10,200,150,60,50,70,70,80,90,80,100,255]); // biome movement cost
  const biomesMartix = [
    new Uint8Array([1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2]),
    new Uint8Array([3,3,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,9,9,9,9,9,10,10]),
    new Uint8Array([5,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,9,9,9,9,9,10,10,10]),
    new Uint8Array([5,6,6,6,6,6,6,8,8,8,8,8,8,8,8,8,8,9,9,9,9,9,9,10,10,10]),
    new Uint8Array([7,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,9,9,9,9,9,9,10,10,10])
  ];

  // parse icons 'weighted array' into a simple array
  for (let i = 0; i < icons.length; i++) {
    const parsed = [];
    for (const icon in icons[i]) {
      for (let j = 0; j < icons[i][icon]; j++) {parsed.push(icon);}
    }
    icons[i] = parsed;
  }

  return {i, name, color, biomesMartix, habitability, iconsDensity, icons, cost};
}

// restore initial style
function applyDefaultStyle() {
  biomes.attr("opacity", null).attr("filter", null);
  borders.attr("opacity", .8).attr("stroke", "#56566d").attr("stroke-width", .7).attr("stroke-dasharray", "1.2 1.5").attr("stroke-linecap", "butt").attr("filter", null);
  cells.attr("opacity", null).attr("stroke", "#808080").attr("stroke-width", .1).attr("filter", null).attr("mask", null);

  gridOverlay.attr("opacity", .8).attr("stroke", "#808080").attr("stroke-width", .5).attr("stroke-dasharray", null).attr("transform", null).attr("filter", null).attr("mask", null);
  coordinates.attr("opacity", 1).attr("data-size", 10).attr("font-size", 10).attr("stroke", "#d4d4d4").attr("stroke-width", 1).attr("stroke-dasharray", 5).attr("filter", null).attr("mask", null);
  compass.attr("opacity", .8).attr("transform", null).attr("filter", null).attr("mask", "url(#water)");
  if (!d3.select("#initial").size()) d3.select("#rose").attr("transform", "translate(80 80) scale(.25)");

  coastline.attr("opacity", .5).attr("stroke", "#1f3846").attr("stroke-width", .7).attr("filter", "url(#dropShadow)");
  styleCoastlineAuto.checked = true;
  cults.attr("opacity", .6).attr("stroke", "#777777").attr("stroke-width", .5).attr("filter", null).attr("fill-rule", "evenodd");
  icons.selectAll("g").attr("opacity", null).attr("fill", "#ffffff").attr("stroke", "#3e3e4b").attr("filter", null).attr("mask", null);
  landmass.attr("opacity", 1).attr("fill", "#eef6fb").attr("filter", null);
  markers.attr("opacity", null).attr("filter", "url(#dropShadow01)");
  styleRescaleMarkers.checked = true;
  prec.attr("opacity", null).attr("stroke", "#000000").attr("stroke-width", .1).attr("fill", "#003dff").attr("filter", null);
  population.attr("opacity", null).attr("stroke-width", 1.6).attr("stroke-dasharray", null).attr("stroke-linecap", "butt").attr("filter", null);
  population.select("#rural").attr("stroke", "#0000ff");
  population.select("#urban").attr("stroke", "#ff0000");

  freshwater.attr("opacity", .5).attr("fill", "#a6c1fd").attr("stroke", "#5f799d").attr("stroke-width", .7).attr("filter", null);
  salt.attr("opacity", .5).attr("fill", "#409b8a").attr("stroke", "#388985").attr("stroke-width", .7).attr("filter", null);

  terrain.attr("opacity", null).attr("filter", null).attr("mask", null);
  rivers.attr("opacity", null).attr("fill", "#5d97bb").attr("filter", null);
  roads.attr("opacity", .9).attr("stroke", "#d06324").attr("stroke-width", .45).attr("stroke-dasharray", "1.5").attr("stroke-linecap", "butt").attr("filter", null);
  ruler.attr("opacity", null).attr("filter", null);
  searoutes.attr("opacity", .8).attr("stroke", "#ffffff").attr("stroke-width", .45).attr("stroke-dasharray", "1 2").attr("stroke-linecap", "round").attr("filter", null);
  
  regions.attr("opacity", .4).attr("filter", null);
  temperature.attr("opacity", null).attr("fill", "#000000").attr("stroke-width", 1.8).attr("fill-opacity", .3).attr("font-size", "8px").attr("stroke-dasharray", null).attr("filter", null).attr("mask", null);
  texture.attr("opacity", null).attr("filter", null).attr("mask", "url(#land)");
  texture.select("image").attr("x", 0).attr("y", 0);

  trails.attr("opacity", .9).attr("stroke", "#d06324").attr("stroke-width", .25).attr("stroke-dasharray", ".8 1.6").attr("stroke-linecap", "butt").attr("filter", null);

  // ocean and svg default style
  svg.attr("background-color", "#000000").attr("filter", null);
  const mapFilter = document.querySelector("#mapFilters .pressed");
  if (mapFilter) mapFilter.classList.remove("pressed");
  ocean.attr("opacity", null);
  oceanLayers.select("rect").attr("fill", "#53679f");
  oceanLayers.attr("filter", null);
  oceanPattern.attr("opacity", null);
  oceanLayers.selectAll("path").attr("display", null);
  styleOceanPattern.value = "url(#pattern1)";
  svg.select("#oceanic rect").attr("filter", "url(#pattern1)");

  // heightmap style
  terrs.attr("opacity", null).attr("filter", null).attr("mask", "url(#land)").attr("stroke", "none");
  const changed = styleHeightmapSchemeInput.value !== "bright" || 
                  styleHeightmapTerracingInput.value != 0 || 
                  styleHeightmapSkipInput.value != 5 || 
                  styleHeightmapSimplificationInput.value != 0 || 
                  styleHeightmapCurveInput.value != 0;
  styleHeightmapSchemeInput.value = "bright";
  styleHeightmapTerracingInput.value = styleHeightmapTerracingOutput.value = 0;
  styleHeightmapSkipInput.value = styleHeightmapSkipOutput.value = 5;
  styleHeightmapSimplificationInput.value = styleHeightmapSimplificationOutput.value = 0;
  styleHeightmapCurveInput.value = 0;
  if (changed) drawHeightmap();

  const citiesSize = Math.max(rn(8 - regionsInput.value / 20), 3);
  burgLabels.select("#cities").attr("fill", "#3e3e4b").attr("opacity", 1).attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC").attr("font-size", citiesSize).attr("data-size", citiesSize);
  burgIcons.select("#cities").attr("opacity", 1).attr("size", 1).attr("stroke-width", .24).attr("fill", "#ffffff").attr("stroke", "#3e3e4b").attr("fill-opacity", .7).attr("stroke-dasharray", "").attr("stroke-linecap", "butt");
  anchors.select("#cities").attr("opacity", 1).attr("fill", "#ffffff").attr("stroke", "#3e3e4b").attr("stroke-width", 1.2).attr("size", 2);

  burgLabels.select("#towns").attr("fill", "#3e3e4b").attr("opacity", 1).attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC").attr("font-size", 3).attr("data-size", 4);
  burgIcons.select("#towns").attr("opacity", 1).attr("size", .5).attr("stroke-width", .12).attr("fill", "#ffffff").attr("stroke", "#3e3e4b").attr("fill-opacity", .7).attr("stroke-dasharray", "").attr("stroke-linecap", "butt");
  anchors.select("#towns").attr("opacity", 1).attr("fill", "#ffffff").attr("stroke", "#3e3e4b").attr("stroke-width", 1.2).attr("size", 1);

  const stateLabelSize = Math.max(rn(24 - regionsInput.value / 6), 6);
  labels.select("#states").attr("fill", "#3e3e4b").attr("opacity", 1).attr("stroke", "#3a3a3a").attr("stroke-width", 0).attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC").attr("font-size", stateLabelSize).attr("data-size", stateLabelSize).attr("filter", null);
  labels.select("#addedLabels").attr("fill", "#3e3e4b").attr("opacity", 1).attr("stroke", "#3a3a3a").attr("stroke-width", 0).attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC").attr("font-size", 18).attr("data-size", 18).attr("filter", null);
  invokeActiveZooming();
}

// focus on coordinates, cell or burg provided in searchParams
function focusOn() {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  if (params.get("from") === "MFCG") {
    if (params.get("seed").length === 13) {
      // show back burg from MFCG
      params.set("burg", params.get("seed").slice(-4));
    } else {
      // select burg for MFCG
      findBurgForMFCG(params); 
      return;
    }
  }

  const s = +params.get("scale") || 8;
  let x = +params.get("x");
  let y = +params.get("y");

  const c = +params.get("cell");
  if (c) {
    x = pack.cells.p[c][0];
    y = pack.cells.p[c][1];
  }

  const b = +params.get("burg");
  if (b) {
    x = pack.burgs[b].x;
    y = pack.burgs[b].y;
  }

  if (x && y) zoomTo(x, y, s, 1600);
}

// find burg for MFCG and focus on it
function findBurgForMFCG(params) {
  const cells = pack.cells, burgs = pack.burgs;
  if (pack.burgs.length < 2) {console.error("Cannot select a burg for MFCG"); return;}

  const size = +params.get("size");
  let coast = +params.get("coast");
  let port = +params.get("port");
  let river = +params.get("river");

  let selection = defineSelection(coast, port, river);
  if (!selection.length) selection = defineSelection(coast, !port, !river);
  if (!selection.length) selection = defineSelection(!coast, 0, !river);
  if (!selection.length) selection = [burgs[1]]; // select first if nothing is found

  function defineSelection(coast, port, river) {
    if (port && river) return burgs.filter(b => b.port && cells.r[b.cell]);
    if (!port && coast && river) return burgs.filter(b => !b.port && cells.t[b.cell] === 1 && cells.r[b.cell]);
    if (!coast && !river) return burgs.filter(b => cells.t[b.cell] !== 1 && !cells.r[b.cell]);
    if (!coast && river) return burgs.filter(b => cells.t[b.cell] !== 1 && cells.r[b.cell]);
    if (coast && river) return burgs.filter(b => cells.t[b.cell] === 1 && cells.r[b.cell]);
    return [];
  }

  // select a burg with closest population from selection
  const selected = d3.scan(selection, (a, b) => Math.abs(a.population - size) - Math.abs(b.population - size));
  const b = selection[selected].i;  
  if (!b) {console.error("Cannot select a burg for MFCG"); return;}
  if (size) burgs[b].population = size;

  const label = burgLabels.select("[data-id='" + b + "']");
  if (label.size()) {
    tip("Here stands the glorious city of " + burgs[b].name, true, "error");
    label.classed("drag", true).on("mouseover", function() {
      d3.select(this).classed("drag", false);
      label.on("mouseover", null);
      tip("", true);
    });
  }

  zoomTo(burgs[b].x, burgs[b].y, 8, 1600);
  invokeActiveZooming();
}

function zoomed() {
  const transform = d3.event.transform;
  const scaleDiff = scale - transform.k;
  const positionDiff = viewX - transform.x | viewY - transform.y;
  scale = transform.k;
  viewX = transform.x;
  viewY = transform.y;
  viewbox.attr("transform", transform);

  // update grid only if view position
  if (positionDiff) drawCoordinates();

  // rescale only if zoom is changed
  if (scaleDiff) {
    invokeActiveZooming();
    drawScaleBar();
  }
}

// Zoom to a specific point
function zoomTo(x, y, z = 8, d = 2000) {
  const transform = d3.zoomIdentity.translate(x * -z + graphWidth / 2, y * -z + graphHeight / 2).scale(z);
  svg.transition().duration(d).call(zoom.transform, transform);
}

// Reset zoom to initial
function resetZoom(d = 1000) {
  svg.transition().duration(d).call(zoom.transform, d3.zoomIdentity);
}

// calculate x,y extreme points of viewBox
function getViewBoxExtent() {
  // x = trX / scale * -1 + graphWidth / scale
  // y = trY / scale * -1 + graphHeight / scale
  return [[Math.abs(viewX / scale), Math.abs(viewY / scale)], [Math.abs(viewX / scale) + graphWidth / scale, Math.abs(viewY / scale) + graphHeight / scale]];
}

// active zooming feature
function invokeActiveZooming() {
  if (styleCoastlineAuto.checked) {
    // toggle shade/blur filter for coatline on zoom
    let filter = scale > 2.6 ? "url(#blurFilter)" : "url(#dropShadow)";
    if (scale > 1.5 && scale <= 2.6) filter = null;
    coastline.attr("filter", filter);
  }

  // rescale lables on zoom
  if (labels.style("display") !== "none") {
    labels.selectAll("g").each(function(d) {
      if (this.id === "burgLabels") return;
      const desired = +this.dataset.size;
      const relative = Math.max(rn((desired + desired / scale) / 2, 2), 1);
      this.getAttribute("font-size", relative);
      const hidden = hideLabels.checked && (relative * scale < 6 || relative * scale > 100);
      if (hidden) this.classList.add("hidden"); else this.classList.remove("hidden");
    });
  }

  // turn off ocean pattern if scale is big (improves performance)
  oceanPattern.select("rect").attr("fill", scale > 10 ? "#fff" : "url(#oceanic)").attr("opacity", scale > 10 ? .2 : null);

  // change states halo width
  if (!customization) {
    const haloSize = rn(10 / scale, 1);
    statesHalo.attr("stroke-width", haloSize).style("display", haloSize > 3 ? "block" : "none");
  }

  // rescale map markers
  if (styleRescaleMarkers.checked && markers.style("display") !== "none") {
    markers.selectAll("use").each(function(d) {
      const x = +this.dataset.x, y = +this.dataset.y, desired = +this.dataset.size;
      const size = Math.max(desired * 5 + 25 / scale, 1);
      d3.select(this).attr("x", x - size/2).attr("y", y - size).attr("width", size).attr("height", size);
    });
  }

  // rescale rulers to have always the same size
  if (ruler.style("display") !== "none") {
    const size = rn(1 / scale ** .3 * 2, 1);
    ruler.selectAll("circle").attr("r", 2 * size).attr("stroke-width", .5 * size);
    ruler.selectAll("rect").attr("stroke-width", .5 * size);
    ruler.selectAll("text").attr("font-size", 10 * size);
    ruler.selectAll("line, path").attr("stroke-width", size);
  }
}

// Pull request from @evyatron
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

function generate() {
  console.time("TOTAL");
  invokeActiveZooming();
  generateSeed();
  console.group("Map " + seed);
  applyMapSize();
  randomizeOptions();
  placePoints();
  calculateVoronoi(grid, grid.points);
  drawScaleBar();
  HeightmapGenerator.generate();
  markFeatures();
  openNearSeaLakes();
  OceanLayers();
  calculateMapCoordinates();
  calculateTemperatures();
  generatePrecipitation();
  reGraph();
  drawCoastline();

  elevateLakes();
  resolveDepressions();
  Rivers.generate();
  defineBiomes();

  rankCells();
  Cultures.generate();
  Cultures.expand();
  BurgsAndStates.generate();
  BurgsAndStates.drawStateLabels();
  console.timeEnd("TOTAL");

  window.setTimeout(() => {
    showStatistics();
    console.groupEnd("Map " + seed);
  }, 300); // wait for rendering
}

// generate map seed (string!) or get it from URL searchParams
function generateSeed() {
  const first = !mapHistory[0];
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const urlSeed = url.searchParams.get("seed");
  if (first && params.get("from") === "MFCG" && urlSeed.length === 13) seed = urlSeed.slice(0,-4);
  else if (first && urlSeed) seed = urlSeed;
  else if (optionsSeed.value && optionsSeed.value != seed) seed = optionsSeed.value;
  else seed = Math.floor(Math.random() * 1e9).toString();
  optionsSeed.value = seed;
  Math.seedrandom(seed);
}

// Place points to calculate Voronoi diagram
function placePoints() {
  console.time("placePoints");
  const cellsDesired = 10000 * densityInput.value; // generate 10k points for graphSize = 1
  const spacing = grid.spacing = rn(Math.sqrt(graphWidth * graphHeight / cellsDesired), 2); // spacing between points before jirrering
  grid.boundary = getBoundaryPoints(graphWidth, graphHeight, spacing);
  grid.points = getJitteredGrid(graphWidth, graphHeight, spacing); // jittered square grid
  grid.cellsX = Math.floor((graphWidth + 0.5 * spacing) / spacing);
  grid.cellsY = Math.floor((graphHeight + 0.5 * spacing) / spacing);
  console.timeEnd("placePoints");
}

// calculate Delaunay and then Voronoi diagram
function calculateVoronoi(graph, points) {
  console.time("calculateDelaunay");
  const n = points.length;
  const allPoints = points.concat(grid.boundary);
  const delaunay = Delaunator.from(allPoints);
  console.timeEnd("calculateDelaunay");
  
  console.time("calculateVoronoi");
  const voronoi = Voronoi(delaunay, allPoints, n);
  graph.cells = voronoi.cells;
  graph.cells.i = n < 65535 ? Uint16Array.from(d3.range(n)) : Uint32Array.from(d3.range(n)); // array of indexes
  graph.vertices = voronoi.vertices;
  console.timeEnd("calculateVoronoi");
}

// Mark features (ocean, lakes, islands)
function markFeatures() {
  console.time("markFeatures");
  Math.seedrandom(seed); // restart Math.random() to get the same result on heightmap edit in Erase mode
  const cells = grid.cells, heights = grid.cells.h;
  cells.f = new Uint16Array(cells.i.length); // cell feature number
  cells.t = new Int8Array(cells.i.length); // cell type: 1 = land coast; -1 = water near coast;
  grid.features = [0];

  for (let i=1, queue=[0]; queue[0] !== -1; i++) {
    cells.f[queue[0]] = i; // feature number
    const land = heights[queue[0]] >= 20;
    let border = false; // true if feature touches map border

    while (queue.length) {
      const q = queue.pop();
      if (cells.b[q]) border = true;
      cells.c[q].forEach(function(e) {
        const eLand = heights[e] >= 20;
        //if (eLand) cells.t[e] = 2;
        if (land === eLand && cells.f[e] === 0) {
          cells.f[e] = i;
          queue.push(e);
        }
        if (land && !eLand) {cells.t[q] = 1; cells.t[e] = -1;}
      });
    }
    const type = land ? "island" : border ? "ocean" : "lake";
    grid.features.push({i, land, border, type});

    queue[0] = cells.f.findIndex(f => !f); // find unmarked cell
  }

  console.timeEnd("markFeatures");
}

// How to handle lakes generated near seas? They can be both open or closed.
// As these lakes are usually get a lot of water inflow, most of them should have brake the treshold and flow to sea via river or strait (see Ancylus Lake).
// So I will help this process and open these kind of lakes setting a treshold cell heigh below the sea level (=19).
function openNearSeaLakes() {
  if (templateInput.value === "Atoll") return; // no need for Atolls
  const cells = grid.cells, features = grid.features;
  if (!features.find(f => f.type === "lake")) return; // no lakes
  console.time("openLakes");
  const limit = 50; // max height that can be breached by water

  for (let t = 0, removed = true; t < 5 && removed; t++) {
    removed = false;

    for (const i of cells.i) {
      const lake = cells.f[i];
      if (features[lake].type !== "lake") continue; // not a lake cell

      check_neighbours:
      for (const c of cells.c[i]) {
        if (cells.t[c] !== 1 || cells.h[c] > limit) continue; // water cannot brake this

        for (const n of cells.c[c]) {
          const ocean = cells.f[n];
          if (features[ocean].type !== "ocean") continue; // not an ocean
          removed = removeLake(c, lake, ocean);
          break check_neighbours;
        }
      }
    }

  }

  function removeLake(treshold, lake, ocean) {
    cells.h[treshold] = 19;
    cells.t[treshold] = -1;
    cells.f[treshold] = ocean;
    cells.c[treshold].forEach(function(c) {
      if (cells.h[c] >= 20) cells.t[c] = 1; // mark as coastline
    });
    features[lake].type = "ocean"; // mark former lake as ocean
    return true;
  }

  console.timeEnd("openLakes");
}

// calculate map position on globe based on equator position and length to poles
function calculateMapCoordinates() {
  const eqY = +document.getElementById("equatorInput").value;
  const eqD = +document.getElementById("equidistanceInput").value;
  const latT = graphHeight / 2 / eqD * 180;
  const eqMod = eqY / graphHeight;
  const latN = latT * eqMod;
  const latS = latN - latT;
  const lon = Math.min(graphWidth / graphHeight * latT / 2, 180);
  mapCoordinates = {latT, latN, latS, lonT: lon*2, lonW: -lon, lonE: lon};
}

// temperature model
function calculateTemperatures() {
  console.time('calculateTemperatures');
  const cells = grid.cells;
  cells.temp = new Int8Array(cells.i.length); // temperature array
  const tEq = +temperatureEquatorInput.value;
  const tPole = +temperaturePoleInput.value;
  const eqY = +document.getElementById("equatorInput").value;
  const eqD = +document.getElementById("equidistanceInput").value;

  d3.range(0, cells.i.length, grid.cellsX).forEach(function(r) {
    const y = grid.points[r][1];
    const initTemp = tEq - Math.abs(y - eqY) / eqD * (tEq - tPole);
    for (let i = r; i < r+grid.cellsX; i++) {
      cells.temp[i] = initTemp - convertToFriendly(cells.h[i]);
    }
  });

  // temperature decreases by 6.5�C per 1km
  function convertToFriendly(h) {
    if (h < 20) return 0;
    const exponent = +heightExponent.value;
    const height = Math.pow(h - 18, exponent);
    return rn(height / 1000 * 6.5);
  }

  console.timeEnd('calculateTemperatures');
}

// simplest precipitation model
function generatePrecipitation() {
  console.time('generatePrecipitation');
  prec.selectAll("*").remove();
  const cells = grid.cells;
  cells.prec = new Uint8Array(cells.i.length); // precipitation array
  const modifier = precInput.value / 100; // user's input
  const cellsX = grid.cellsX, cellsY = grid.cellsY;
  let westerly = [], easterly = [], southerly = 0, northerly = 0;

  {// latitude bands
  // x4 = 0�5� latitude: wet throught the year (rising zone)
  // x2 = 5�20� latitude: wet summer (rising zone), dry winter (sinking zone)
  // x1 = 20�30� latitude: dry all year (sinking zone)
  // x2 = 30�50� latitude: wet winter (rising zone), dry summer (sinking zone)
  // x3 = 50�60� latitude: wet all year (rising zone)
  // x2 = 60�70� latitude: wet summer (rising zone), dry winter (sinking zone)
  // x1 = 70�90� latitude: dry all year (sinking zone)
  }
  const lalitudeModifier = [4,2,2,2,1,1,2,2,2,2,3,3,2,2,1,1,1,0.5]; // by 5d step
 
  // difine wind directions based on cells latitude and prevailing winds there
  d3.range(0, cells.i.length, cellsX).forEach(function(c, i) {
    const lat = mapCoordinates.latN - i / cellsY * mapCoordinates.latT;
    const band = (Math.abs(lat) - 1) / 5 | 0;
    const latMod = lalitudeModifier[band];
    const tier = Math.abs(lat - 89) / 30 | 0; // 30d tiers from 0 to 5 from N to S
    if (winds[tier] > 40 && winds[tier] < 140) westerly.push([c, latMod, tier]);
    else if (winds[tier] > 220 && winds[tier] < 320) easterly.push([c + cellsX -1, latMod, tier]);
    if (winds[tier] > 100 && winds[tier] < 260) northerly++;
    else if (winds[tier] > 280 || winds[tier] < 80) southerly++;
  });
  
  // distribute winds by direction
  if (westerly.length) passWind(westerly, 120 * modifier, 1, cellsX);
  if (easterly.length) passWind(easterly, 120 * modifier, -1, cellsX);
  const vertT = (southerly + northerly);
  if (northerly) {
    const bandN = (Math.abs(mapCoordinates.latN) - 1) / 5 | 0;
    const latModN = mapCoordinates.latT > 60 ? d3.mean(lalitudeModifier) : lalitudeModifier[bandN];
    const maxPrecN = northerly / vertT * 60 * modifier * latModN;
    passWind(d3.range(0, cellsX, 1), maxPrecN, cellsX, cellsY);
  }
  if (southerly) {
    const bandS = (Math.abs(mapCoordinates.latS) - 1) / 5 | 0;
    const latModS = mapCoordinates.latT > 60 ? d3.mean(lalitudeModifier) : lalitudeModifier[bandS];
    const maxPrecS = southerly / vertT * 60 * modifier * latModS;
    passWind(d3.range(cells.i.length - cellsX, cells.i.length, 1), maxPrecS, -cellsX, cellsY);
  }

  function passWind(source, maxPrec, next, steps) {
    const maxPrecInit = maxPrec;
    for (let first of source) {
      if (first[0]) {maxPrec = Math.min(maxPrecInit * first[1], 255); first = first[0];}
      let humidity = maxPrec - cells.h[first]; // initial water amount
      if (humidity <= 0) continue; // if first cell in row is too elevated cosdired wind dry
      for (let s = 0, current = first; s < steps; s++, current += next) {
        // no flux on permafrost 
        if (cells.temp[current] < -5) continue;
        // water cell
        if (cells.h[current] < 20) {
          if (cells.h[current+next] >= 20) {
            cells.prec[current+next] += Math.max(humidity / rand(10, 20), 1); // coastal precipitation
          } else {
            humidity = Math.min(humidity + 5 * modifier, maxPrec); // wind gets more humidity passing water cell
            cells.prec[current] += 5 * modifier; // water cells precipitation (need to correctly pour water through lakes)
          }
          continue;
        }

        // land cell
        const precipitation = getPrecipitation(humidity, current, next);
        cells.prec[current] += precipitation;
        const evaporation = precipitation > 1.5 ? 1 : 0; // some humidity evaporates back to the atmosphere
        humidity = Math.min(Math.max(humidity - precipitation + evaporation, 0), maxPrec);
      }
    }
  }

  function getPrecipitation(humidity, i, n) {
    if (cells.h[i+n] > 85) return humidity; // 85 is max passable height
    const normalLoss = Math.max(humidity / (10 * modifier), 1); // precipitation in normal conditions
    const diff = Math.max(cells.h[i+n] - cells.h[i], 0); // difference in height
    const mod = (cells.h[i+n] / 70) ** 2; // 50 stands for hills, 70 for mountains
    return Math.min(Math.max(normalLoss + diff * mod, 1), humidity);
  }

  void function drawWindDirection() {
     const wind = prec.append("g").attr("id", "wind");

    d3.range(0, 6).forEach(function(t) {
      if (westerly.length > 1) {
        const west = westerly.filter(w => w[2] === t);
        if (west && west.length > 3) {
          const from = west[0][0], to = west[west.length-1][0];
          const y = (grid.points[from][1] + grid.points[to][1]) / 2;
          wind.append("text").attr("x", 20).attr("y", y).text("\u21C9");
        }
      }
      if (easterly.length > 1) {
        const east = easterly.filter(w => w[2] === t);
        if (east && east.length > 3) {
          const from = east[0][0], to = east[east.length-1][0];
          const y = (grid.points[from][1] + grid.points[to][1]) / 2;
          wind.append("text").attr("x", graphWidth - 52).attr("y", y).text("\u21C7");
        }
      }
    });

    if (northerly) wind.append("text").attr("x", graphWidth / 2).attr("y", 42).text("\u21CA");
    if (southerly) wind.append("text").attr("x", graphWidth / 2).attr("y", graphHeight - 20).text("\u21C8");
  }();

  console.timeEnd('generatePrecipitation');
}

// recalculate Voronoi Graph to pack cells
function reGraph() {
  console.time("reGraph");
  let cells = grid.cells, points = grid.points, features = grid.features;
  const newCells = {p:[], g:[], h:[], t:[], f:[], r:[], biome:[]}; // to store new data
  const spacing2 = grid.spacing ** 2;

  for (const i of cells.i) {
    const height = cells.h[i];
    const type = cells.t[i];
    if (height < 20 && type !== -1 && type !== -2) continue; // exclude all deep ocean points
    if (type === -2 && (i%4=== 0 || features[cells.f[i]].type === "lake")) continue; // exclude non-coastal lake points
    const x = points[i][0], y = points[i][1];

    addNewPoint(x, y); // add point to array
    // add additional points for cells along coast
    if (type === 1 || type === -1) {
      if (cells.b[i]) continue; // not for near-border cells
      cells.c[i].forEach(function(e) {
        if (i > e) return;
        if (cells.t[e] === type) {
          const dist2 = (y - points[e][1]) ** 2 + (x - points[e][0]) ** 2;
          if (dist2 < spacing2) return; // too close to each other
          const x1 = rn((x + points[e][0]) / 2, 1);
          const y1 = rn((y + points[e][1]) / 2, 1);
          addNewPoint(x1, y1);
        }
      });
    }

    function addNewPoint(x, y) {
      newCells.p.push([x, y]);
      newCells.g.push(i);
      newCells.h.push(height);
    }
  }

  calculateVoronoi(pack, newCells.p);
  cells = pack.cells;
  cells.p = newCells.p; // points coordinates [x, y]
  cells.g = cells.i.length < 65535 ? Uint16Array.from(newCells.g) : Uint32Array.from(newCells.g); // reference to initial grid cell
  cells.q = d3.quadtree(cells.p.map((p, d) => [p[0], p[1], d])); // points quadtree for fast search
  cells.h = new Uint8Array(newCells.h); // heights
  cells.area = new Uint16Array(cells.i.length); // cell area
  cells.i.forEach(i => cells.area[i] = Math.abs(d3.polygonArea(getPackPolygon(i))));

  console.timeEnd("reGraph");
}

// Detect and draw the coasline
function drawCoastline() {
  console.time('drawCoastline');
  reMarkFeatures();
  const cells = pack.cells, vertices = pack.vertices, n = cells.i.length, features = pack.features;
  const used = new Uint8Array(features.length); // store conneted features
  const largestLand = d3.scan(features.map(f => f.land ? f.cells : 0), (a, b) => b - a);
  const landMask = defs.select("#land");
  const waterMask = defs.select("#water");  
  lineGen.curve(d3.curveBasisClosed);

  for (const i of cells.i) {
    const startFromEdge = !i && cells.h[i] >= 20;
    if (!startFromEdge && cells.t[i] !== -1 && cells.t[i] !== 1) continue; // non-edge cell
    const f = cells.f[i];
    if (used[f]) continue; // already connected
    if (features[f].type === "ocean") continue; // ocean cell

    const type = features[f].type === "lake" ? 1 : -1; // type value to search for
    const start = findStart(i, type);
    if (start === -1) continue; // cannot start here
    const connectedVertices = connectVertices(start, type);
    used[f] = 1;
    const points = connectedVertices.map(v => vertices.p[v]);

    const path = round(lineGen(points));
    const id = features[f].group + features[f].i;
    if (features[f].type === "lake") {
      landMask.append("path").attr("d", path).attr("fill", "black");
      //waterMask.append("path").attr("d", path).attr("fill", "white"); // uncomment to show over lakes
      lakes.select("#"+features[f].group).append("path").attr("d", path).attr("id", id); // draw the lake
    } else {
      landMask.append("path").attr("d", path).attr("fill", "white");
      waterMask.append("path").attr("d", path).attr("fill", "black");
      coastline.append("path").attr("d", path).attr("id", id); // draw the coastline
    }

    // draw ruler to cover the biggest land piece
    if (f === largestLand) {
      const from = points[d3.scan(points, (a, b) => a[0] - b[0])];
      const to = points[d3.scan(points, (a, b) => b[0] - a[0])];
      addRuler(from[0], from[1], to[0], to[1]);
    }
  }

  // find cell vertex to start path detection
  function findStart(i, t) {
    if (t === -1 && cells.b[i]) return cells.v[i].find(v => vertices.c[v].some(c => c >= n)); // map border cell
    const filtered = cells.c[i].filter(c => cells.t[c] === t);
    const index = cells.c[i].indexOf(d3.min(filtered));
    return index === -1 ? index : cells.v[i][index];
  }

  // connect vertices to chain
  function connectVertices(start, t) {
    const chain = []; // vertices chain to form a path
    for (let i=0, current = start; i === 0 || current !== start && i < 10000; i++) {
      const prev = chain[chain.length-1]; // previous vertex in chain
      //d3.select("#labels").append("text").attr("x", vertices.p[current][0]).attr("y", vertices.p[current][1]).text(i).attr("font-size", "1px");
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current] // cells adjacent to vertex
      const v = vertices.v[current] // neighboring vertices
      const c0 = c[0] >= n || cells.t[c[0]] === t;
      const c1 = c[1] >= n || cells.t[c[1]] === t;
      const c2 = c[2] >= n || cells.t[c[2]] === t;
      if (v[0] !== prev && c0 !== c1) current = v[0];
      else if (v[1] !== prev && c1 !== c2) current = v[1];
      else if (v[2] !== prev && c0 !== c2) current = v[2];
      if (current === chain[chain.length-1]) {console.error("Next vertex is not found"); break;}
    }
    chain.push(chain[0]); // push first vertex as the last one
    return chain;
  }

  console.timeEnd('drawCoastline');
}

// Re-mark features (ocean, lakes, islands)
function reMarkFeatures() {
  console.time("reMarkFeatures");
  const cells = pack.cells, features = pack.features = [0];
  const continentCells = grid.cells.i.length / 10, islandCell = continentCells / 50;
  cells.f = new Uint16Array(cells.i.length); // cell feature number
  cells.t = new Int8Array(cells.i.length); // cell type: 1 = land along coast; -1 = water along coast;
  cells.haven = new Uint16Array(cells.i.length); // cell haven (opposite water cell);
  cells.harbor = new Uint16Array(cells.i.length); // cell harbor (number of adjacent water cells);

  for (let i=1, queue=[0]; queue[0] !== -1; i++) {
    cells.f[queue[0]] = i; // feature number
    const land = cells.h[queue[0]] >= 20;
    let border = false; // true if feature touches map border
    let cellNumber = 1; // to count cells number in a feature
    const temp = grid.cells.temp[cells.g[queue[0]]]; // first cell temparature

    while (queue.length) {
      const q = queue.pop();
      if (cells.b[q]) border = true;
      cells.c[q].forEach(function(e) {
        const eLand = cells.h[e] >= 20;
        if (land === eLand && cells.f[e] === 0) {
          cells.f[e] = i;
          queue.push(e);
          cellNumber++;
        }
        if (land && !eLand) {
          cells.t[q] = 1; 
          cells.t[e] = -1;
          cells.harbor[q]++;
          if (!cells.haven[q]) cells.haven[q] = e;
        } else if (land && eLand) {
          if (!cells.t[e] && cells.t[q] === 1) cells.t[e] = 2;
          else if (!cells.t[q] && cells.t[e] === 1) cells.t[q] = 2;
        }
      });
    }

    const type = land ? "island" : border ? "ocean" : "lake";
    let group;
    if (type === "lake") group = temp < 25 ? "freshwater" : "salt"; else
    if (type === "ocean") group = "ocean"; else
    if (type === "island") group = cellNumber > continentCells ? "continent" : cellNumber > islandCell ? "island" : "isle";
    features.push({i, land, border, type, cells: cellNumber, group});
    queue[0] = cells.f.findIndex(f => !f); // find unmarked cell
  }

  console.timeEnd("reMarkFeatures");
}

// temporary elevate some lakes to resolve depressions and flux the water to form an open (exorheic) lake
function elevateLakes() {
  if (templateInput.value === "Atoll") return; // no need for Atolls
  console.time('elevateLakes');
  const cells = pack.cells, features = pack.features;
  const maxCells = cells.i.length / 100; // size limit; let big lakes be closed (endorheic)
  const lakes = cells.i
    .filter(i => features[cells.f[i]].group === "freshwater" && features[cells.f[i]].cells < maxCells)
    .sort(highest); // highest cells go first

  for (const i of lakes) {
    //debug.append("circle").attr("cx", cells.p[i][0]).attr("cy", cells.p[i][1]).attr("r", 1).attr("fill", "blue");
    const hs = cells.c[i].filter(isLand).map(c => cells.h[c]);
    cells.h[i] = Math.max(d3.min(hs) - 5, 20) || 20;
  }

  console.timeEnd('elevateLakes');
}

// depression filling algorithm (for a correct water flux modeling)
function resolveDepressions() {
  console.time('resolveDepressions');
  const cells = pack.cells;
  const land = cells.i.filter(i => cells.h[i] >= 20 && cells.h[i] < 95 && !cells.b[i]); // exclude near-border cells
  land.sort(highest); // highest cells go first

  for (let l = 0, depression = Infinity; depression > 1 && l < 100; l++) {
    depression = 0;
    for (const i of land) {
      const minHeight = d3.min(cells.c[i].map(c => cells.h[c]));
      if (minHeight === 100) continue; // already max height
      if (cells.h[i] <= minHeight) {cells.h[i] = minHeight + 1; depression++;}
    }
  }

  console.timeEnd('resolveDepressions');
  //const depressed = cells.i.filter(i => cells.h[i] >= 20  && cells.h[i] < 95 && !cells.b[i] && cells.h[i] <= d3.min(cells.c[i].map(c => cells.h[c])));
  //debug.selectAll(".deps").data(depressed).enter().append("circle").attr("r", 0.8).attr("cx", d => cells.p[d][0]).attr("cy", d => cells.p[d][1]);
}

// assign biome id for each cell
function defineBiomes() {
  console.time("defineBiomes");  
  const cells = pack.cells, f = pack.features;
  cells.biome = new Uint8Array(cells.i.length); // biomes array

  for (const i of cells.i) {
    if (f[cells.f[i]].group === "freshwater") cells.h[i] = 19; // de-elevate lakes
    if (cells.h[i] < 20) continue; // water cells have biome 0
    let moist = grid.cells.prec[cells.g[i]];
    if (cells.r[i]) moist += Math.max(cells.fl[i] / 20, 2);
    const n = cells.c[i].filter(isLand).map(c => grid.cells.prec[cells.g[c]]).concat([moist]);
    moist = rn(d3.mean(n));
    const temp = grid.cells.temp[cells.g[i]]; // flux from precipitation
    cells.biome[i] = getBiomeId(moist, temp);
  }

  function getBiomeId(moisture, temperature) {
    if (temperature < -5) return 11; // permafrost biome
    const m = Math.min((moisture + 4) / 5 | 0, 4); // moisture band from 0 to 4
    const t = Math.min(Math.max(20 - temperature, 0), 25); // temparature band from 0 to 25
    return biomesData.biomesMartix[m][t];
  }

  console.timeEnd("defineBiomes");
}

// assess cells suitability to calculate population and rand cells for culture center and burgs placement
function rankCells() {
  console.time('rankCells');
  const cells = pack.cells, f = pack.features;
  cells.s = new Int16Array(cells.i.length); // cell suitability array
  cells.pop = new Uint16Array(cells.i.length); // cell population array

  const flMean = d3.median(cells.fl.filter(f => f)), flMax = d3.max(cells.fl) + d3.max(cells.conf); // to normalize flux
  const areaMean = d3.mean(cells.area); // to adjust population by cell area

  for (const i of cells.i) {
    let s = +biomesData.habitability[cells.biome[i]]; // base suitability derived from biome habitability
    if (!s) continue; // uninhabitable biomes has 0 suitability
    s += normalize(cells.fl[i] + cells.conf[i], flMean, flMax) * 250; // big rivers and confluences are valued
    s -= (cells.h[i] - 50) / 5; // low elevation is valued, high is not;

    if (cells.t[i] === 1) {
      if (cells.r[i]) s += 15; // estuary is valued
      const type = f[cells.f[cells.haven[i]]].type;
      const group = f[cells.f[cells.haven[i]]].group;
      if (type === "lake") {
        if (group === "salt") s += 10; else s += 30; // lake coast is valued
      } else {
        s += 5; // ocean coast is valued
        if (cells.harbor[i] === 1) s += 20; // safe sea harbor is valued
      }
    }

    cells.s[i] = s / 5; // general population rate
    // cell rural population is suitability adjusted by cell area
    cells.pop[i] = cells.s[i] > 0 ? cells.s[i] * cells.area[i] / areaMean : 0;
  }

  console.timeEnd('rankCells');
}

// show map stats on generation complete
function showStatistics() {
  const template = templateInput.value;
  const templateRandom = locked("template") ? "" : "(random)";
  const stats = `  Seed: ${seed}
  Size: ${graphWidth}x${graphHeight}
  Template: ${template} ${templateRandom}
  Points: ${grid.points.length}
  Cells: ${pack.cells.i.length}
  States: ${pack.states.length-1}
  Burgs: ${pack.burgs.length-1}`;
  mapHistory.push({seed, width:graphWidth, height:graphHeight, template, created: Date.now()});
  console.log(stats);
}

function regenerateMap() {
  closeDialogs("#worldConfigurator");
  customization = 0;
  undraw();
  resetZoom(1000);
  generate();
  restoreLayers();
  if ($("#worldConfigurator").is(":visible")) editWorld();
}

// Clear the map
function undraw() {
  viewbox.selectAll("path, circle, polygon, line, text, use, #ruler > g").remove();
  defs.selectAll("path, clipPath").remove();
}
