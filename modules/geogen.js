units = { //units, their name and conversion ratio to Kilometers
    "mm": { name: "Millimeters", conv: 1000000 },
    "cm": { name: "Centimeters", conv: 100000 },
    "m": { name: "Meters", conv: 1000 },
    "km": { name: "Kilometers", conv: 1 },
    "in": { name: "Inches", conv: 39370.07874 },
    "ft": { name: "Feet", conv: 3280.839895 },
    "yd": { name: "Yards", conv: 1093.613298 },
    "mi": { name: "Miles", conv: 0.621371192 },
    "nmi": { name: "Nautical Miles", conv: 0.539956803 },
    "lg": { name: "Leagues", conv: 0.207123730 }, //this is just one possible value, meaning of league differs majorly 
    "vr": { name: "Versta", conv: 0.937382827 },
}
const type_names = {
    "continent": ["Acai", "Adroya", "Aehesus", "Aeplaes", "Aetiveth", "Afeutoris", "Ahera", "Ahux", "Aifin", "Aipodux", "Ames", "Areth", "Aseugeon", "Atane", "Aufokica", "Auluqoth", "Aupicul", "Auquan", "Aweapari", "Baeyis",
        "Beawath", "Blateron", "Bleumebela", "Blifin", "Braiyias", "Breizoth", "Brezoqall", "Bruanosia", "Buadrea", "Ceiphizuan", "Cewriograi", "Chaqon", "Chialuin", "Ciclone", "Cleikoxoa", "Cleiyezand", "Cleobuxune", "Clipuzoya",
        "Clowos", "Cluamisoa", "Clulath", "Codni", "Cowane", "Cracend", "Cuphiashoth", "Cusux", "Deblas", "Dreasuin", "Dreozai", "Edax", "Eduqith", "Eheiqeon", "Ehox", "Eifugias", "Eilolish", "Eiyuwax", "Eizunai", "Ekox", "Eleuvax",
        "Eobekaes", "Eodraes", "Eolovin", "Eqoqor", "Eseizela", "Esune", "Etroa", "Eubrax", "Euclax", "Eufuxura", "Eukolaes", "Euweon", "Feusuin", "Fliutazias", "Flucone", "Fuazath", "Geiwis", "Gliuboya", "Grigeucax", "Gruacitane",
        "Guashushea", "Helane", "Holira", "Hoqish", "Iapath", "Iawaqul", "Iboth", "Idia", "Ipeth", "Iqall", "Irend", "Iuqenax", "Iuzoa", "Iwor", "Iworis", "Jaepixari", "Jaukroran", "Jichul", "Jubrios", "Kaphox", "Kasuin", "Kerura",
        "Klikesh", "Kliocane", "Klumane", "Kraeputul", "Krahonan", "Krainura", "Kreomixias", "Krereudas", "Krifera", "Kuadox", "Kuyiocroa", "Limux", "Lopall", "Miozegrera", "Nauphuan", "Niudrica", "Nodeayuin", "Nophea", "Nuawasoa",
        "Odon", "Odrus", "Ogane", "Okaecox", "Oqai", "Osesh", "Osune", "Oyune", "Peoclosend", "Phuwuan", "Pleawos", "Pleidrand", "Prerai", "Priulone", "Qeawagaes", "Qeiqastrea", "Qephiasura", "Qiagreon", "Qiopath", "Reyath", "Riaploa",
        "Sainacas", "Sateron", "Serihoya", "Shonios", "Shuaditish", "Shuyun", "Slaedreth", "Slaeqabios", "Slicen", "Sliperon", "Sluraetuan", "Slutax", "Suchos", "Tegreinane", "Teophiduin", "Tibrura", "Tiotavoth", "Tizeudia",
        "Trepeocai", "Treutoya", "Triqos", "Uabroris", "Uahakia", "Uawiwios", "Ubenios", "Uhios", "Upiozan", "Urai", "Uwesux", "Uwush", "Vledath", "Vleowiyush", "Vlifica", "Vragrux", "Vraikequth", "Vuyiagren", "Waiqesh", "Wetrune",
        "Witrari", "Wreikucix", "Wrugith", "Xearutuin", "Xidren", "Xohix", "Xualuvax", "Yaqox", "Yegos", "Yeustror", "Yucrari", "Zaeshela", "Zaiplecaes", "Zeamuin", "Zephush"],
    "isle": ["Amtara Reef", "Balcaster Island", "Belleby Enclave", "Berksea Island", "Beversby Isle", "Birmingtague Ait", "Birtown Key", "Bolnach Haven", "Brightside Ait", "Brismark Islet", "Briswater Islet",
        "Brommer Chain", "Calenigan Isle", "Campbo Skerry", "Camptague Island", "Canterliers Enclave", "Cartwater Peninsula", "Casneau Holm", "Cauborough Islands", "Chiboubron Haven", "Chide Islands", "Clarenside Chain",
        "Cliffsomin Ait", "Cumberchester Chain", "Derwin Isles", "Digwood Cay", "Eastgue Isles", "Eatowe Atoll", "Elcola Key", "Emgough Key", "Fairdown Enclave", "Gamsons Isle", "Ganmond Haven", "Gatileche Isle",
        "Gilminster Holm", "Glenheim Archipelago", "Gracewaki Reef", "Granhead Isles", "Hadway Peninsula", "Hamliers Reef", "Haspids Enclave", "Hillsline Cay", "Hingchester Isle", "Irochill Islet", "Irridown Ait",
        "Killinggamau Cay", "Killingside Cay", "Kirlet Island", "Langbiens Islet", "Lashcana Island", "Leamingshaw Cay", "Limingnear Chain", "Menbour Atoll", "Milburns Refuge", "Miniris Cay", "Morintane Isle", "Petasack Holm",
        "Portgeo Archipelago", "Portterel Island", "Reidby Isles", "Reidfail Isles", "Repenmark Island", "Robmont Island", "Saglodge Holm", "Salisgeo Reef", "Sedgeree Skerry", "Shawris Archipelago", "Stafcouche Cay",
        "Staflams Skerry", "Stokemiota Refuge", "Susduff Ait", "Susleche Refuge", "Taunnet Islet", "The Arching Isle", "The Arid Islands", "The Burning Isles", "The Castaway Islet", "The Colossal Key", "The Deep Skerry",
        "The Defeated Haven", "The Diamond Isle", "The Distant Ait", "The Dread Atoll", "The Ethereal Enclave", "The Faraway Enclave", "The Fiery Holm", "The Fiery Island", "The Flowing Isles", "The Frozen Peninsula",
        "The Glowing Islet", "The Grim Reef", "The Heartless Haven", "The Hollow Islet", "The Jellyfish Holm", "The Laughing Ait", "The Light Chain", "The Lost Enclave", "The Mysterious Archipelago", "The Mysterious Key",
        "The Pain Key", "The Peaceful Haven", "The Pearl Chain", "The Penguin Refuge", "The Raging Archipelago", "The Relentless Chain", "The Sad Peninsula", "The Sanctum Chain", "The Shadowed Ait", "The Shaking Isles",
        "The Shark Enclave", "The Shrine Cay", "The Silver Peninsula", "The Skeleton Ait", "The Skeleton Cay", "The Skeleton Refuge", "The Starfish Haven", "The Sunny Isles", "The Torpedo Island", "The Virgin Skerry",
        "The Wasting Ait", "The Waterless Skerry", "The Waveless Isle", "The Windy Island", "The Yelling Ait", "Tisliers Island", "Turgonie Chain", "Ventmiota Isles", "Virworth Peninsula", "Wallsevain Refuge", "Wilwin Reef",
        "Windminster Islet", "Wynrial Chain"],
    "island": ["Lighthill", "Strongmill", "Whitebridge", "Woodwall", "Deepsnow", "Irondell", "Eriwynne", "Fairwinter", "Deepwater", "Waterton", "Fallmage", "Rosedell", "Westerdragon", "Oldfield", "Morton", "Ironshade", "Merridale",
        "Westcliff", "Flowercliff", "Vertkeep", "Clearmont", "Witchlyn", "Deerdell", "Hollowcastle", "Janwynne", "Clearden", "Oldburn", "Flowermeadow", "Linmoor", "Westerbeach", "Deepwolf", "Oakgate", "Southgrass", "Moormeadow",
        "Qauar", "Jipon", "Venela", "Martique", "Ugada", "Maurania", "Turnistan", "Russip", "Conada", "Svalbard", "Jan Mayen", "Mari Island", "Angua", "Baruda", "Monolia", "Ameri", "Samoa"],
    "freshwater": ["Shaded Lake", "Vast Expanse", "Neglected Gorge", "Glistening Loch", "Blythedows Lake", "Chamterre Lake", "Winterlan Gorge", "Wadelem Loch", "Ridgelis Expanse", "Bradbron Pond", "Calm Lake", "Mirrored Waters",
        "Unstable Basin", "Barren Reservoir", "Buchstino Lagoon", "Ferquet Expanse", "Cardpids Reservoir", "Gatilin Cove", "Bloomslet Expanse", "Antitos Cove", "Western Waters", "Pleasant Depths", "Vast Reservoir",
        "Peaceful Reservoir", "Harvern Basin", "Limingmeda Depths", "Wellingronto Lagoon", "Causahead Gorge", "Warming Reservoir", "Limingside Reservoir", "New Basin", "Cursed Basin", "Crystal Waters", "Ugly Lagoon",
        "Croyville Pond", "Landare Lake", "Franram Loch", "Hillsval Domain", "Smithrial Basin", "Suntrie Gorge", "Serene Lagoon", "Cobalt Loch", "Arrowhead Lake", "Iris Lagoon", "Manirood Shallows", "Appleware Shallows",
        "Buckinglam Basin", "Amespids Waters", "Gaulden Pond", "Margar Lake", "Coral Depths", "Boiling Gorge", "Peaceful Waters", "Flowing Shallows", "Walhurst Domain", "Wolffail Basin", "Stratsevain Lagoon", "Davellin Lake",
        "Morinneau Cove", "Huntbalt Expanse"],
    "salt": ["Gray Domain", "Wasor Basin", "Orocastle Lake", "Cowantrie Shallows", "Belldare Waters", "Bruderley Gorge", "Eckpond Cove", "Eastern Cove", "Coral Pond", "Shaded Waters", "Crocodile Depths", "Cottlecam Lake",
        "Midalants Lake", "Onofolk Reservoir", "Herewin Depths", "Grimrial Waters", "Sherden Lagoon", "Wasteful Shallows", "Cursed Reservoir", "Uncanny Pond", "Wrinkled Cove", "Rossoll Lagoon", "Huntingpond Basin",
        "Grandburn Waters", "Barnrey Domain", "Stokeleche Pond", "Kapusgus Cove", "Furthest Gorge", "Hungry Expanse", "Cursed Domain", "Narrow Depths", "Corngan Domain", "Estou Pond", "Bridgediac Loch", "Liverbiens Gorge",
        "Burstry Waters", "Caubiens Waters"]
}





const natural_types =
{
    land: {
        area: [
            "scrub", "heath", "moor", "wetland", "grassland", "fell", "bare_rock", "scree", "shingle", "sand", "mud", "cave_entrance", "sinkhole", "rock", "hill", "valley", "peninsula"
        ], features: [
            "wood", "tree_row", "tree"
        ], points: [
            "volcano", "cape", "peak", "spring", "hot_spring", "geyser", "stone ", "saddle", "tree", "cave_entrance", "sinkhole", "rock"
        ], lines: [
            "river_terrace", "ridge", "arete", "cliff"
        ]
    }, water: {
        area: [
            "water", "glacier", "bay", "strait", "beach", "reef"
        ], lines: [
            "coastline"
        ]
    }
}


burgs_groups = [
    { type: "city", pop: 100000, admin_level:8},
    { type: "town", pop: 2000, admin_level:9},
    { type: "village", pop: 100, admin_level:10},
    { type: "hamlet", pop: 10, admin_level:11},
    { type: "isolated_dwelling", pop: -1, admin_level:11}
]

numRegExp = new RegExp("[0-9]+");

const ln = "\r\n";

const cen_lat = 51.50265085;
const cen_lon = -3.16268235;

const rotation_angle_degs = 1;


// using the data on 
// https://en.wikipedia.org/wiki/List_of_United_States_cities_by_area
// the average of the square meter per person in city cant to 46.4906806 
avg_sqm_pp = 46.5;

function gen_geodata(type) {


    let data = "";
    let ext = "";
    let dset = {};

    //work out the scale in the units chosen by using the conversion ratio times by 1000 for meters
    const scale = (distanceScale.value * unit_to_km(distanceUnit.value)) * 1000;
    console.log(scale + " meters per pixel");

    dset.settlements = dataget_settlements();
    dset.points = dataget_points();
    dset.states = dataget_states();
    dset.coastlines = dataget_bodies("#coastline > *");
    dset.lakes = dataget_bodies("#freshwater > *, #salt > *");

    if (type === "osm") {
        data = gen_osm(dset, scale);
        ext = ".osm";
    } else if (type === "json") {
        data = gen_json(dset, scale);
        ext = ".geo.json";
    }
    return { data: data, ext: ext }
}

function dataget_settlements() {
    let settlements = [];
    for (let i = 0, c = 0; i < pack.burgs.length; i++) {
        let burg = pack.burgs[i];
        let type = "";
        let level = "";
        if ("i" in burg) {
            settlements[c] = burg;
            //replace population with actual value, scale * 1000
            pop = settlements[c].population * populationRate.value * 100;
            settlements[c].population = pop;
            for (let t = 0; t < burgs_groups.length; t++) {
                if (pop > burgs_groups[t].pop) {
                    type = burgs_groups[t].type;
                    level = burgs_groups[t].admin_level;
                    break;
                }
            }
            settlements[c].type = type;
            settlements[c].admin_level = level;
            burgs_groups
            c++;
        }
    }
    return settlements;
}

function dataget_points() {
    let points = [];
    for (let i = 0, c = 0; i < grid.points.length; i++) {
        let point = grid.points[i];
        if (point.length > 0) {
            points[c] = point;
            c++;
        }
    }
    return points;
}

function dataget_states() {
    statesCollectStatistics();
    const node_states = document.getElementById("statesHalo").childNodes;
    let states = [];
    for (var i = 0; i < node_states.length; i++) {
        states[i] = pack.states[i];
        if (states[i].center) {
            states[i].x = pack.cells.p[pack.states[i].center][0];
            states[i].y = pack.cells.p[pack.states[i].center][1];
        }
        states[i].path = node_states[i];
    }
    return states;

    function statesCollectStatistics() {
        const cells = pack.cells, states = pack.states;
        states.forEach(s => s.cells = s.area = s.burgs = s.rural = s.urban = 0);

        for (const i of cells.i) {
            if (cells.h[i] < 20) continue;
            const s = cells.state[i];
            states[s].cells += 1;
            states[s].area += cells.area[i];
            states[s].rural += cells.pop[i];
            if (cells.burg[i]) {
                states[s].urban += pack.burgs[cells.burg[i]].population;
                states[s].burgs++;
            }
        }
    }
}

function dataget_bodies(query) {
    let nodes = document.querySelectorAll(query);
    let bodies = [];
    for (var i = 0; i < nodes.length; i++) {
        let match = nodes[i].id.match(numRegExp);
        let f_id = Number(match[0]);
        if (f_id in pack.features) {
            bodies[i] = pack.features[f_id];
            if (type_names[bodies[i].group] === undefined) {
                console.log(bodies[i]);
            }
            bodies["name"] = type_names[bodies[i].group][i];
            bodies[i].path = nodes[i];
        } else {
            console.log("no feature by with id: " + f_id);
        }
    }
    return bodies;
}

function gen_osm(data, scale) {
    let cur_id = 1;

    let mpoints = osm_settlements_to_features(data.settlements, cur_id, scale);
    cur_id = mpoints.last_id;
    let spoints = osm_states_to_features(data.states, cur_id, scale);
    cur_id = spoints.last_id;
    let cpoints = osm_coastlines_to_features(data.coastlines, cur_id, scale);
    cur_id = cpoints.last_id;
    let lpoints = osm_lakes_to_features(data.lakes, cur_id, scale);
    cur_id = lpoints.last_id;

    let osm = "<?xml version='1.0' encoding='UTF-8'?>" + ln;
    osm += "<osm version='0.6' generator='JOSM'>" + ln;
    osm += mpoints.nodes;
    osm += spoints.nodes;
    osm += cpoints.nodes;
    osm += lpoints.nodes;
    osm += mpoints.ways
    osm += spoints.ways;
    osm += cpoints.ways;
    osm += lpoints.ways;
    osm += mpoints.relations
    osm += spoints.relations;
    osm += cpoints.relations;
    osm += lpoints.relations;
    osm += "</osm>";

    return osm;
}

function gen_json(data, scale) {
    let cur_id = 1;
    let features = [];
    //fpoints = json_points_to_features(data.points, cur_id, scale);
    //cur_id = fpoints.last_id;
    let mpoints = json_settlements_to_features(data.settlements, cur_id, scale);
    cur_id = mpoints.last_id;
    let spoints = json_states_to_features(data.states, cur_id, scale);
    cur_id = spoints.last_id;
    let cpoints = json_coastlines_to_features(data.coastlines, cur_id, scale);
    cur_id = cpoints.last_id;
    let lpoints = json_lakes_to_features(data.lakes, cur_id, scale);
    cur_id = lpoints.last_id;

    //features = features.concat(fpoints.json);
    features = features.concat(mpoints.json);
    features = features.concat(spoints.json);
    features = features.concat(cpoints.json);
    features = features.concat(lpoints.json);

    const json_data = { "type": "FeatureCollection", "features": features };

    return JSON.stringify(json_data, null, 2);
}


//--------------osm functions-------------------

function osm_settlements_to_features(data, id, scale) {
    let nodes = "";
    let ways = "";
    let relations = "";
    let tagcats = {};
    for (let i = 0; i < data.length; i++) {
        let members = [];
        id++;
        boundry = xy_to_boundry(data[i].x, data[i].y, data[i].population, scale);
        start_id = id;

        nodes += latlongs_to_nodes(boundry, id);
        id += boundry.length + 1;
        tagcats = {
            type: "boundry", boundary: "administrative", admin_level: data[i].admin_level,
            name: data[i].name
        };
        tags = gen_tags(tagcats);
        ways += gen_way(id, start_id, boundry.length, tags);
        members.push({ id: id, type: "way", role: "outer" });
        id += boundry.length + 1;
        start_id = id;
        tagcats = {
            type: "place", place: data[i].type, name: data[i].name,
            cell: data[i].cell, region: data[i].region, area: (Math.PI * data.population ^ 2), culture: data[i].culture,
            population: data[i].population, feature: data[i].feature,
            capital: data[i].capital, port: data[i].port, settlement_id: data[i].i, x: data[i].x, y: data[i].y
        };
        tags = gen_tags(tagcats);
        nodes += latlong_to_node(xy_to_coords(data[i].x * scale, data[i].y * scale), id, tags);
        members.push({ id: id, type: "node", role: "admin_centre" });
        id++;

        tagcats = {
            type: "boundry", boundary: "administrative", border_type: "city", admin_level: data[i].admin_level, designation: "principal_area",
            name: data[i].name, long_name: data[i].long_name, "is_in:country": data[i].country, "is_in:country_code": data[i].country_code,
            cell: data[i].cell, region: data[i].region, area: (Math.PI * data.population ^ 2), culture: data[i].culture,
            population: data[i].population, feature: data[i].feature,
            capital: data[i].capital, port: data[i].port, settlement_id: data[i].i, x: data[i].x, y: data[i].y
        };
        tags = gen_tags(tagcats);
        relations += gen_relation(id++, tags, members);
    }
    return { nodes: nodes, ways: ways, relations: relations, last_id: id };
}

function osm_states_to_features(data, id, scale) {
    let nodes = "";
    let ways = "";
    let relations = "";
    let tagcats = {};
    let tags = "";
    for (let i = 0; i < data.length; i++) {
        let boundries = flatten_multi_svg(data[i].path, 1000);

        let members = [];
        for (let b = 0; b < boundries.length; b++) {
            if (boundries[b].length > 0) {
                id++;

                start_id = id;
                tagcats = {
                    region_id: b, border_type: "nation",
                    boundary: "administrative", admin_level: "2",
                };
                let region_tags = gen_tags(tagcats);
                nodes += latlongs_to_nodes(xypath_to_latlong(boundries[b], scale), id);
                id += boundries[b].length + 1;
                members.push({ id: id, type: "way", role: "outer" });
                ways += gen_way(id, start_id, boundries[b].length, region_tags);
            }
        }
        if (data[i].center) {
            id++;
            tagcats = {
                type: "place", place: "country", name: data[i].name,long_name: data[i].long_name,
                cell: data[i].cell, region: data[i].region, culture: data[i].culture, 
                x: data[i].x, y: data[i].y, center: data[i].center, country: data[i].name, country_code: data[i].i,
                state_id: data[i].i, color: data[i].color, expansionism: data[i].expansionism, capital: data[i].capital,
                state_type: data[i].type, center: data[i].center, culture: data[i].culture, cells: data[i].cells, area: data[i].area,
                rural: data[i].rural, urban: data[i].urban, cities: data[i].burgs, x: data[i].x, y: data[i].y
            };

            tags = gen_tags(tagcats);
            nodes += latlong_to_node(xy_to_coords(data[i].x * scale, data[i].y * scale), id, tags);
            members.push({ id: id, type: "node", role: "label" });
            id++;
        }
        tagcats = {
            type: "boundary", boundary: "administrative", admin_level: "2", 
            border_type: "country", maritime: "yes",
            name: data[i].name,long_name: data[i].long_name,
            cell: data[i].cell, region: data[i].region, culture: data[i].culture,
            x: data[i].x, y: data[i].y, center: data[i].center, country: data[i].name, country_code: data[i].i,
            state_id: data[i].i, color: data[i].color, expansionism: data[i].expansionism, capital: data[i].capital,
            state_type: data[i].type, center: data[i].center, culture: data[i].culture, cells: data[i].cells, area: data[i].area,
            rural: data[i].rural, urban: data[i].urban, cities: data[i].burgs, x: data[i].x, y: data[i].y
        };
        tags = gen_tags(tagcats);
        relations += gen_relation(id++, tags, members);

    }
    return { nodes: nodes, ways: ways, relations: relations, last_id: id };
}

function osm_coastlines_to_features(data, id, scale) {
    let nodes = "";
    let ways = "";
    let relations = "";
    let tagcats = {};
    for (let i = 0; i < data.length; i++) {
        let members = [];
        id++;
        boundry = xypath_to_latlong(flatten_svg(data[i].path, 1000), scale);
        start_id = id;
        nodes += latlongs_to_nodes(boundry, id);
        id += boundry.length + 1;
        tagcats = {
            type: "natural", natural: "coastline", feature_id: data[i].i
        };
        tags = gen_tags(tagcats);
        ways += gen_way(id, start_id, boundry.length, tags);
        members.push({ id: id, type: "way", role: "outer" });
        id++
        //let type = natural_types.land.area[Math.floor((Math.random() * natural_types.land.area.length))];
        let type =  natural_types.land.area[4];
        tagcats = {
            type: "natural", natural: type, feature_id: data[i].i
        };
        tags = gen_tags(tagcats);

        ways += gen_way(id, start_id, boundry.length, tags);
        members.push({ id: id, type: "way", role: "outer" });

        let name = type_names[data[i].group][i];
        tagcats = {
            type: "place", place: data[i].group,
            feature_id: data[i].i, name: name, body: data[i].body, border: data[i].border,
            cells: data[i].cells, land: data[i].land, mtype: data[i].type
        };
        tags = gen_tags(tagcats);

        relations += gen_relation(id++, tags, members);


    }
    return { nodes: nodes, ways: ways, relations: relations, last_id: id };
}

function osm_lakes_to_features(data, id, scale) {
    let nodes = "";
    let ways = "";
    let relations = "";
    let tagcats = {};
    for (let i = 0; i < data.length; i++) {
        let members = [];
        id++;
        boundry = xypath_to_latlong(flatten_svg(data[i].path, 1000), scale);
        start_id = id;
        nodes += latlongs_to_nodes(boundry, id);
        id += boundry.length + 1;
        let name = type_names[data[i].group][i];
        tagcats = {
            type: "natural", natural: "water", water: "lake",
            name: name
        };
        if (data.group === "salt") {
            tagcats.salt = "yes";
        }
        tags = gen_tags(tagcats);
        ways += gen_way(id, start_id, boundry.length, tags);
        members.push({ id: id, type: "way", role: "outer" });
        id++;
        tagcats = {
            type: "multipolygon", natural: "water", water: "lake",
            name: name, body: data[i].body, border: data[i].border,
            cells: data[i].cells, land: data[i].land, mtype: data[i].mtype,
            feature_id: data[i].i
        };
        if (data.group === "salt") {
            tagcats.salt = "yes";
        }
        tags = gen_tags(tagcats);
        relations += gen_relation(id++, tags, members);
    }
    return { nodes: nodes, ways: ways, relations: relations, last_id: id };
}

//--------------osm functions-------------------

function gen_way(way_id, start_id, num, tags) {
    way = "\t<way id='-" + way_id.toString() + "' action='modify' visible='true'>" + ln;

    way += gen_nd(start_id, num);
    way += tags;
    way += "\t</way >" + ln;
    return way;
}

function gen_relation(id, tags, members, tagcats) {
    relation = "";
    relation += "\t<relation id='-" + (id).toString() + "' action='modify' visible='true'>" + ln;
    relation += gen_members(members);
    relation += tags;
    relation += "\t</relation>" + ln;
    return relation;
}

function gen_members(ids) {
    members = "";
    for (i = 0; i < ids.length; ++i) {
        members += "\t\t<member type='" + ids[i].type + "' ref='-" + (ids[i].id).toString() + "' role='" + ids[i].role + "' />" + ln;
    }
    return members;
}

function gen_nd(id, num) {
    last_nd = "\t\t<nd ref='-" + (id).toString() + "' />" + ln;
    nd = "";
    for (i = 0; i < num; ++i) {
        nd += "\t\t<nd ref='-" + (id++).toString() + "' />" + ln;
    }
    nd += last_nd;
    return nd;
}

function latlongs_to_nodes(latlongs, id) {
    nodes = "";
    for (k in latlongs) {
        ll = latlongs[k];
        nodes += "\t<node id='-" + (id++).toString() + "' action='modify' visible='true' lat='" + (ll.slat).toString() + "' lon='" + (ll.slon).toString() + "' />" + ln;

    }
    return nodes;
}

function latlong_to_node(ll, id, tags) {
    node = "";
    node += "\t<node id='-" + (id++).toString() + "' action='modify' visible='true' lat='" + (ll.slat).toString() + "' lon='" + (ll.slon).toString() + "'>" + ln;
    node += tags;
    node += "\t</node>" + ln;
    return node;
}


function gen_tags(tagcats) {
    let tags = "";
    const blk = "Unimplemented";
    for (k in tagcats) {
        tags += "\t\t<tag k='" + k + "' v='" + tagcats[k] + "' />" + ln;
    }
    //tags += "\t\t<tag k='wikipedia' v='" + blk + "' />" + ln;
    //tags += "\t\t<tag k='url' v='" + blk + "' />" + ln;
    return tags;
}

//--------------json functions-------------------

function json_settlements_to_features(data, id, scale) {
    allPoints = [];
    for (let i = 0; i < data.length; i++) {
        id++;

        pop = data[i].population;
        let bound = xy_to_boundry(data[i].x, data[i].y, pop, scale);
        let polygon = latlongs_to_polygon(bound);
        allPoints[i] = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [polygon]
            },
            "properties": {
                "name": data[i].name, "settlement_id": data[i].i, "feature": data[i].feature, "capital": data[i].capital, "port": data[i].port, "AREA_CODE": data[i].cell, "POLYGON_ID": id, "UNIT_ID": data[i].region, "HECTARES": (Math.PI * pop ^ 2), "DESCRIPT0": "CIVIL ADMINISTRATION AREA", "CULTURE": data[i].culture, "POPULATION": pop
            }
        }
    }
    return { json: allPoints, last_id: id };

}

function json_states_to_features(data, id, scale) {
    allPoints = [];
    for (let i = 0; i < data.length; i++) {
        id++;

        pop = data[i].population;
        let boundries = flatten_multi_svg(data[i].path, 1000);
        let multiPolygon = []
        for (let b = 1; b < boundries.length; b++) {
            multiPolygon[b] = latlongs_to_polygon(xypath_to_latlong(boundries[b], scale));
        }
        allPoints[i] = {
            "type": "Feature",
            "geometry": {
                "type": "MultiPolygon",
                "coordinates": [multiPolygon]
            },
            "properties": {
                "name": data[i].name, "state_id": data[i].i, "feature": data[i].feature, "capital": data[i].capital, "port": data[i].port, "AREA_CODE": data[i].cell, "POLYGON_ID": id, "UNIT_ID": data[i].region, "HECTARES": (Math.PI * pop ^ 2), "DESCRIPT0": "CIVIL ADMINISTRATION AREA", "CULTURE": data[i].culture, "POPULATION": pop
            }
        }
    }
    return { json: allPoints, last_id: id };

}

function json_coastlines_to_features(data, id, scale) {
    allPoints = [];
    for (let i = 0; i < data.length; i++) {
        id++;

        pop = data[i].population;
        let bound = flatten_svg(data[i].path, 1000);
        let polygon = latlongs_to_polygon(xypath_to_latlong(bound, scale));
        allPoints[i] = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [polygon]
            },
            "properties": {
                "name": data[i].name, "feature_id": data[i].i, "feature": data[i].feature, "capital": data[i].capital, "port": data[i].port, "AREA_CODE": data[i].cell, "POLYGON_ID": id, "UNIT_ID": data[i].region, "HECTARES": (Math.PI * pop ^ 2), "DESCRIPT0": "CIVIL ADMINISTRATION AREA", "CULTURE": data[i].culture, "POPULATION": pop
            }
        }
    }
    return { json: allPoints, last_id: id };

}

function json_points_to_features(data, id, scale) {
    allPoints = [];
    for (let i = 0; i < data.length; i++) {
        id++;
        [x, y] = data[i];
        ll = xy_to_coords(x * scale, y * scale);
        allPoints[c] = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [ll.slon, ll.slat] //geojson is [lon,lat]
            },
            "properties": {
                "name": "Point: " + (c + 1),
                "POINT_ID": id
            }
        }
    }
    return { json: allPoints, last_id: id };
}

//--------------json functions-------------------

function gen_settlements_props(data, it) {
    let props = {
        "name": data[i].name,
        "settlement_id": data[i].i,
        "feature": data[i].feature,
        "capital": data[i].capital,
        "port": data[i].port,
        "AREA_CODE": data[i].cell,
        "POLYGON_ID": it,
        "UNIT_ID": data[i].region,
        "HECTARES": (Math.PI * data.population ^ 2),
        "DESCRIPT0": "CIVIL ADMINISTRATION AREA",
        "CULTURE": data[i].culture,
        "POPULATION": data.population
    }
    return props;
}

function gen_state_props(data, it) {
    let props = {
        "name": data.name,
        "state_id": data.i,
        "color": data.color,
        "capital": data.capital,
        "expansionism": data.expansionism,
        "type": data.type,
        "expansionism": data.expansionism,
        "center": data.center,
        "culture": data.culture,
        "cells": data.cells,
        "area": data.area,
        "rural": data.rural,
        "urban": data.urban,
        "cities": data.burgs,
        "AREA_CODE": data.cell,
        "POLYGON_ID": it,
        "HECTARES": (Math.PI * data.population ^ 2),
        "DESCRIPT0": "CIVIL ADMINISTRATION AREA",
        "POPULATION": data.population
    }
    return props;
}

function gen_coastline_props(data) {
    let props = {
        "name": data.name,
        "state_id": data.i,
    }
    return props;
}

//--------------generic functions-------------------

function flatten_multi_svg(path, num) {
    const len = path.getTotalLength();
    const elem = path.pathSegList.numberOfItems;
    var paths = [];
    var nums = 0;
    var poly = 0;
    paths[poly] = [];
    for (var i = 0; i < elem; i++) {
        item = path.pathSegList.getItem(i);
        if (item.pathSegType === 2) {
            if (poly > 0 && i > 0) {
                let fp = paths[poly][0];
                paths[poly][nums] = { x: fp.x, y: fp.y };
            }
            poly++;
            paths[poly] = [];
            nums = 0;
        }
        paths[poly][nums] = { x: item.x, y: item.y };
        nums++;
    }
    return paths;
}

function flatten_multi_svg2(path, num) {
    var len = path.getTotalLength();
    var d = [];
    var c = 0;
    var poly = 0;
    poly++;
    c = 0;
    d[poly] = [];
    p = path.getPointAtLength(0);
    d[poly][c] = { x: p.x, y: p.y };
    incr = (len / num);

    for (var i = incr; i <= len; i += incr) {
        item = path.getPathSegAtLength(i);
        switch (item.pathSegType) {
            case 2:
                poly++;
                c = 0;
                d[poly] = [];
                d[poly][c] = { x: item.x, y: item.y };
            case 4:
                var skip = "";
        }
        p = path.getPointAtLength(i);
        d[poly][c] = { x: p.x, y: p.y };
        c++;
    }
    return d;
}

function flatten_svg(path, num) {
    var len = path.getTotalLength();
    var d = [];
    var c = 0;
    c = 0;
    d = [];
    p = path.getPointAtLength(0);
    d[c] = { x: p.x, y: p.y };
    //d[poly] = [];
    //var p = path.getPointAtLength(0);
    //d[poly][c] = {x:p.x, y:p.y};
    incr = (len / num);

    for (var i = incr; i <= len; i += incr) {
        p = path.getPointAtLength(i);
        d[c] = { x: p.x, y: p.y };
        c++;
    }
    d[c] = { x: d[0].x, y: d[0].y };
    return d;
}



function unit_to_km(unit) {
    conv = 1;
    name = "Unknown";
    if (unit in units) { //ignoring custom units atm
        name = units[unit].name;
        conv = units[unit].conv;
    }
    return conv;
}

function xy_to_coords(x, y) {
    porg = {};
    porg.x = x;
    porg.y = -y;
    porg.rotation_angle_degs = rotation_angle_degs;
    porg.xoffset_mtrs = 0;
    porg.yoffset_mtrs = 0;
    porg.olon = 0.1;
    porg.olat = 0.1;
    return translate_coordinates(1, porg);
}

function dict_to_array(dict) {
    return Object.keys(dict).map(function (key) {
        return dict[key];
    })
}

function xy_to_boundry(x, y, pop, scale) {
    let n = 20;

    // The radius of circle, which area is the places's area
    // which is worked out by place's population * average m^2 per person 
    let r = Math.sqrt((avg_sqm_pp * pop) / Math.PI);

    if (r < 20) {
        r = 20;
    }
    let boundry = [];
    x *= scale;
    y *= scale;
    for (let i = 0; i < n; i++) {
        x_new = x + Math.cos((2 * Math.PI / n) * i) * r;
        y_new = y + Math.sin((2 * Math.PI / n) * i) * r;
        boundry[i] = xy_to_coords(x_new, y_new);
    }
    boundry[boundry.length] = boundry[0];
    return boundry;
}

function xypath_to_latlong(xys, scale) {
    latlongs = []
    for (let i = 0; i < xys.length; i++) {
        let xy = xys[i];
        x = xy.x * scale;
        y = xy.y * scale;
        latlongs[i] = xy_to_coords(x, y);
    }
    return latlongs;

}

function latlongs_to_polygon(latlongs) {
    polygon = [];
    for (k in latlongs) {
        ll = latlongs[k];
        polygon[k] = [ll.slon, ll.slat]; //geojson is [lon,lat]
    }
    return polygon;
}