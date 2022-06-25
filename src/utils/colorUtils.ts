const d3 = window.d3;

const c12 = [
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

export function getColors(number: number) {
  const cRB = d3.scaleSequential(d3.interpolateRainbow);
  const colors = d3.shuffle(
    d3
      .range(number)
      .map((index: number) => (index < 12 ? c12[index] : d3.color(cRB((index - 12) / (number - 12))).hex()))
  );
  return colors;
}

export function getRandomColor() {
  return d3.color(d3.scaleSequential(d3.interpolateRainbow)(Math.random())).hex();
}

// mix a color with a random color
export function getMixedColor(hexColor: string, mixation = 0.2, bright = 0.3) {
  // if provided color is not hex (e.g. harching), generate random one
  const color1 = hexColor && hexColor[0] === "#" ? hexColor : getRandomColor();
  const color2 = getRandomColor();
  const mixedColor = d3.interpolate(color1, color2)(mixation);

  return d3.color(mixedColor).brighter(bright).hex();
}
