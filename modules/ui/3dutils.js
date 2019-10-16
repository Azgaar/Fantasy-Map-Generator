var _3dheightMapExponent = null;
var _3dmaxHeight = null;
var _3dcolorLookup = null;

function _2dto1d(source) {
  var r = [];

  var w = source[0].length;
  var h = source.length;

  var i=0;
  for (var y=0; y < h; y++) {
    for (var x=0; x < w; x++) { 
      r[i] = source[y][x];
      i++;
    }
  }

  return r;
}

function _1dto2d(source, w, h) {

  var r = [];

  var i=0;
  for (var y=0; y < h; y++) {
    r[y] = [];
    for (var x=0; x < w; x++) {
      r[y][x] = source[i];
      i++;
    }
  }

  return r;
}

function getSVGImage(type, width, height) {
  // clone svg
  const cloneEl = document.getElementById("map").cloneNode(true);
  cloneEl.id = "fantasyMap";
  document.getElementsByTagName("body")[0].appendChild(cloneEl);
  const clone = d3.select("#fantasyMap");

  if (type === "svg") {
    clone.select("#viewbox").attr("transform", null); // reset transform to show whole map
  }

  clone.attr("width", width).attr("height", height);

  // remove unused elements
  if (!clone.select("#terrain").selectAll("use").size()) clone.select("#defs-relief").remove();
  if (!clone.select("#prec").selectAll("circle").size()) clone.select("#prec").remove();
  if (!clone.select("#scaleBar").selectAll("use").size()) clone.select("#scaleBar").remove();

  // default to water - on Firefox, ocean pattern appears as alternating blocks of ocean and water pattern
  const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
  if (isFirefox) {
    if (!clone.select("#oceanPattern").selectAll("use").size()) clone.select("#oceanPattern").remove();
  }

  const removeEmptyGroups = function() {
    let empty = 0;
    clone.selectAll("g").each(function() {
      if (!this.hasChildNodes() || this.style.display === "none") {empty++; this.remove();}
      if (this.hasAttribute("display") && this.style.display === "inline") this.removeAttribute("display");
    });
    return empty;
  }
  while(removeEmptyGroups()) {removeEmptyGroups();}

  // for each g element get inline style
  const emptyG = clone.append("g").node();
  const defaultStyles = window.getComputedStyle(emptyG);
  clone.selectAll("g, #ruler > g > *, #scaleBar > text").each(function(d) {
    const compStyle = window.getComputedStyle(this);
    let style = "";
    for (let i=0; i < compStyle.length; i++) {
      const key = compStyle[i];
      const value = compStyle.getPropertyValue(key);
      // Firefox mask hack
      if (key === "mask-image" && value !== defaultStyles.getPropertyValue(key)) {
        style += "mask-image: url('#land');";
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
  const svg_xml = (new XMLSerializer()).serializeToString(clone.node());
  clone.remove();
  const blob = new Blob([svg_xml], {type: 'image/svg+xml;charset=utf-8'});
  const url = window.URL.createObjectURL(blob);
  return url;
}

function getHeightmap() {
  var mh = 0;
  grid.cells.h.forEach((height, i) => {
    h = grid.cells.h[i];

    if (h > mh) mh = h;
  });
  if (mh > 82) { mh = 82; }

  _3dheightMapExponent = heightExponentInput.value;
//  _3dmaxHeight = Math.pow(mh, _3dheightMapExponent);
  _3dmaxHeight = Math.pow(82, _3dheightMapExponent);

  var heightMap = [];
  for (var y=0; y < grid.cellsY; y++) {
    heightMap[y] = [];
  }

  var y = 0, x = 0;

// convert height from map heights to a linear height
  grid.cells.h.forEach((height, i) => {
    h = grid.cells.h[i];

    // add heightmap exponent
    if (h >= 20) height = Math.pow(h - 18, _3dheightMapExponent);
//    else if (h > 0) height = (h - 20) / h * 50;
    else height = 0;

    // get heightmap as a percentage
    let v = (height / _3dmaxHeight);

    // convert to 0-255
    v = (v * 255);

    heightMap[y][x] = Math.floor(v);
    x++;
    if (x >= grid.cellsX) { x = 0; y++ }
  });

  var hm = _2dto1d(heightMap);

  return hm;
}

function getPreviewTexture(width, height) {
  return getSVGImage("svg", width, height);
}
