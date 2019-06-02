// Functions to save and load the map
"use strict";

/*
* Saves a backup into localStorage
* - keep in mind that default localStorage is 5000KB so it is small a map has a huge size of some mb!
* - at least you have the ability to revert your last change(s) now! ;)
* - users can customize the size of this maybe we should give them a hint?
*/
function saveBreadCrumb() {
  console.time("saveBreadCrumb");
  const date = new Date();
  const dateString = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
  const license = "File can be loaded in azgaar.github.io/Fantasy-Map-Generator";
  const params = [version, license, dateString, seed, graphWidth, graphHeight].join("|");
  const options = [distanceUnit.value, distanceScale.value, areaUnit.value, heightUnit.value, heightExponent.value, temperatureScale.value,
  barSize.value, barLabel.value, barBackOpacity.value, barBackColor.value, barPosX.value, barPosY.value, populationRate.value, urbanization.value,
  equatorOutput.value, equidistanceOutput.value, temperatureEquatorOutput.value, temperaturePoleOutput.value, precOutput.value, JSON.stringify(winds)].join("|");
  const coords = JSON.stringify(mapCoordinates);
  const biomes = [biomesData.color, biomesData.habitability, biomesData.name].join("|");
  const notesData = JSON.stringify(notes);

  svg.attr("width", graphWidth).attr("height", graphHeight);
  const transform = d3.zoomTransform(svg.node());
  viewbox.attr("transform", null);
  const svg_xml = (new XMLSerializer()).serializeToString(svg.node());

  const gridGeneral = JSON.stringify({ spacing: grid.spacing, cellsX: grid.cellsX, cellsY: grid.cellsY, boundary: grid.boundary, points: grid.points, features: grid.features });
  const features = JSON.stringify(pack.features);
  const cultures = JSON.stringify(pack.cultures);
  const states = JSON.stringify(pack.states);
  const burgs = JSON.stringify(pack.burgs);

  const data = [params, options, coords, biomes, notesData, svg_xml,
    gridGeneral, grid.cells.h, grid.cells.prec, grid.cells.f, grid.cells.t, grid.cells.temp,
    features, cultures, states, burgs,
    pack.cells.biome, pack.cells.burg, pack.cells.conf, pack.cells.culture, pack.cells.fl,
    pack.cells.pop, pack.cells.r, pack.cells.road, pack.cells.s, pack.cells.state].join("\r\n");
  
  var previousData = new Array ();
  previousData = getBreadCrumbs();
  const localStorageSizeInKB = testLocalStorageMaxSize();
  const maxBreadCrumbs = Math.floor(localStorageSizeInKB / (new Blob([data], { type: "text/plain" }).size / 1000));

  try {
    if(previousData.length >= maxBreadCrumbs-1){ 
      var half = Math.ceil(maxBreadCrumbs * 0.5);
      previousData = previousData.splice(0, half); //HACK - loosing 50% on reaching max...
      localStorage.removeItem("breadCrumb");
    }
    previousData[previousData.length] = JSON.stringify(data);
    localStorage.setItem("breadCrumb", JSON.stringify(previousData));
    localStorage.setItem("breadCrumbIndex", previousData.length);
  }
  catch (e) {
    console.log("Storage failed: " + e);
  }

  svg.attr("width", svgWidth).attr("height", svgHeight);
  zoom.transform(svg, transform);
  console.timeEnd("saveBreadCrumb");
}

/*
* Loads last crumb deletes previous crumb
*/
function loadLastBreadCrumb(){
  console.time("loadLastBreadCrumb");
  const crumbToLoad = getPreviousBreadCrumb();
  if(crumbToLoad){
    const escape = crumbToLoad.slice(1,crumbToLoad.length-1);
    const data = escape.split("\\r\\n");
    const mapVersion = data[0].split("|")[0] || data[0];
    if (mapVersion === version) {
      parseLoadedData(data); // parsing problem when loading blob?
    }
  }
  console.timeEnd("loadLastBreadCrumb");
}

function testLocalStorageMaxSize(){
  if (localStorage) {
    var i = 0;
    try {
        // Test up to 50 MB
        for (i = 250; i <= 50000; i += 250) {
            localStorage.setItem('test', new Array((i * 1024) + 1).join('a'));
        }
    } catch (e) {
        localStorage.removeItem('test');
        return (i - 250);            
    }
  }
}

function getBreadCrumbs(){
  var returnAlwaysAsArray = new Array ();
  var previousData = JSON.parse(localStorage.getItem("breadCrumb"));
  if(previousData === null){
    return returnAlwaysAsArray;
  }else if(!Array.isArray(previousData)){
    return returnAlwaysAsArray[0] = previousData; //sometimes returns indexed char array wth? - workaround String(cast)
  }else{
    return previousData;
  }
}

/*
* returns previous Bread Crumb (if exists)
* - deletes/undoes last change from localStorage!
*/
function getPreviousBreadCrumb() {
  const breadCrumbs = getBreadCrumbs();
  if(breadCrumbs.length <= 0){
    return null;
  }

  const lastCrumbIndex = localStorage.getItem("breadCrumbIndex");
  if(lastCrumbIndex > 0){
      localStorage.setItem("breadCrumbIndex", lastCrumbIndex-1);
      localStorage.setItem("breadCrumb", JSON.stringify(breadCrumbs.slice(0,breadCrumbs.length-1)));
  }

  return breadCrumbs[breadCrumbs.length-1];
}
