"use strict";

function drawMarkers() {
  TIME && console.time("drawMarkers");

  const rescale = +markers.attr("rescale");
  const pinned = +markers.attr("pinned");

  const markersData = pinned ? pack.markers.filter(({pinned}) => pinned) : pack.markers;
  const html = markersData.map(marker => drawMarker(marker, rescale));
  markers.html(html.join(""));

  TIME && console.timeEnd("drawMarkers");
}

// prettier-ignore
const pinShapes = {
  bubble: (fill, stroke) => `<path d="M6,19 l9,10 L24,19" fill="${stroke}" stroke="none" /><circle cx="15" cy="15" r="10" fill="${fill}" stroke="${stroke}"/>`,
  pin: (fill, stroke) => `<path d="m 15,3 c -5.5,0 -9.7,4.09 -9.7,9.3 0,6.8 9.7,17 9.7,17 0,0 9.7,-10.2 9.7,-17 C 24.7,7.09 20.5,3 15,3 Z" fill="${fill}" stroke="${stroke}"/>`,
  square: (fill, stroke) => `<path d="m 20,25 -5,4 -5,-4 z" fill="${stroke}"/><path d="M 5,5 H 25 V 25 H 5 Z" fill="${fill}" stroke="${stroke}"/>`,
  squarish: (fill, stroke) => `<path d="m 5,5 h 20 v 20 h -6 l -4,4 -4,-4 H 5 Z" fill="${fill}" stroke="${stroke}" />`,
  diamond: (fill, stroke) => `<path d="M 2,15 15,1 28,15 15,29 Z" fill="${fill}" stroke="${stroke}" />`,
  hex: (fill, stroke) => `<path d="M 15,29 4.61,21 V 9 L 15,3 25.4,9 v 12 z" fill="${fill}" stroke="${stroke}" />`,
  hexy: (fill, stroke) => `<path d="M 15,29 6,21 5,8 15,4 25,8 24,21 Z" fill="${fill}" stroke="${stroke}" />`,
  shieldy: (fill, stroke) => `<path d="M 15,29 6,21 5,7 c 0,0 5,-3 10,-3 5,0 10,3 10,3 l -1,14 z" fill="${fill}" stroke="${stroke}" />`,
  shield: (fill, stroke) => `<path d="M 4.6,5.2 H 25 v 6.7 A 20.3,20.4 0 0 1 15,29 20.3,20.4 0 0 1 4.6,11.9 Z" fill="${fill}" stroke="${stroke}" />`,
  pentagon: (fill, stroke) => `<path d="M 4,16 9,4 h 12 l 5,12 -11,13 z" fill="${fill}" stroke="${stroke}" />`,
  heptagon: (fill, stroke) => `<path d="M 15,29 6,22 4,12 10,4 h 10 l 6,8 -2,10 z" fill="${fill}" stroke="${stroke}" />`,
  circle: (fill, stroke) => `<circle cx="15" cy="15" r="11" fill="${fill}" stroke="${stroke}" />`,
  no: () => ""
};

const getPin = (shape = "bubble", fill = "#fff", stroke = "#000") => {
  const shapeFunction = pinShapes[shape] || pinShapes.bubble;
  return shapeFunction(fill, stroke);
};

function drawMarker(marker, rescale = 1) {
  const {i, icon, x, y, dx = 50, dy = 50, px = 12, size = 30, pin, fill, stroke} = marker;
  const id = `marker${i}`;
  const zoomSize = rescale ? Math.max(rn(size / 5 + 24 / scale, 2), 1) : size;
  const viewX = rn(x - zoomSize / 2, 1);
  const viewY = rn(y - zoomSize, 1);

  const isExternal = icon.startsWith("http") || icon.startsWith("data:image");

  return /* html */ `
    <svg id="${id}" viewbox="0 0 30 30" width="${zoomSize}" height="${zoomSize}" x="${viewX}" y="${viewY}">
      <g>${getPin(pin, fill, stroke)}</g>
      <text x="${dx}%" y="${dy}%" font-size="${px}px" >${isExternal ? "" : icon}</text>
      <image x="${dx / 2}%" y="${dy / 2}%" width="${px}px" height="${px}px" href="${isExternal ? icon : ""}" />
    </svg>`;
}
