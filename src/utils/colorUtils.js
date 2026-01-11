"use strict";
// FMG utils related to colors

// convert RGB color string to HEX without #
function toHEX(rgb) {
  if (rgb.charAt(0) === "#") return rgb;

  rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
  return rgb && rgb.length === 4
    ? "#" +
        ("0" + parseInt(rgb[1], 10).toString(16)).slice(-2) +
        ("0" + parseInt(rgb[2], 10).toString(16)).slice(-2) +
        ("0" + parseInt(rgb[3], 10).toString(16)).slice(-2)
    : "";
}

const C_12 = [
  "#dababf",
  "#fb8072",
  "#80b1d3",
  "#fdb462",
  "#b3de69",
  "#fccde5",
  "#c6b9c1",
  "#bc80bd",
  "#ccebc5",
  "#ffed6f",
  "#8dd3c7",
  "#eb8de7"
];
const scaleRainbow = d3.scaleSequential(d3.interpolateRainbow);

// return array of standard shuffled colors
function getColors(number) {
  const colors = d3.shuffle(
    d3.range(number).map(i => (i < 12 ? C_12[i] : d3.color(scaleRainbow((i - 12) / (number - 12))).hex()))
  );
  return colors;
}

function getRandomColor() {
  return d3.color(d3.scaleSequential(d3.interpolateRainbow)(Math.random())).hex();
}

// mix a color with a random color
function getMixedColor(color, mix = 0.2, bright = 0.3) {
  const c = color && color[0] === "#" ? color : getRandomColor(); // if provided color is not hex (e.g. harching), generate random one
  return d3.color(d3.interpolate(c, getRandomColor())(mix)).brighter(bright).hex();
}
