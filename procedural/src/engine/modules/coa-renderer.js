"use strict";

// Data constants (business logic of the module)
const colors = {
  argent: "#fafafa",
  or: "#ffe066",
  gules: "#d7374a",
  sable: "#333333",
  azure: "#377cd7",
  vert: "#26c061",
  purpure: "#522d5b",
  murrey: "#85185b",
  sanguine: "#b63a3a",
  tenné: "#cc7f19"
};

const shieldPositions = {
  // shield-specific position: [x, y] (relative to center)
  heater: {
    a: [-43.75, -50],
    b: [0, -50],
    c: [43.75, -50],
    d: [-43.75, 0],
    e: [0, 0],
    f: [43.75, 0],
    g: [-32.25, 37.5],
    h: [0, 50],
    i: [32.25, 37.5],
    y: [-50, -50],
    z: [0, 62.5],
    j: [-37.5, -37.5],
    k: [0, -37.5],
    l: [37.5, -37.5],
    m: [-30, 30],
    n: [0, 42.5],
    o: [30, 30],
    p: [-37.5, 0],
    q: [37.5, 0],
    A: [-66.2, -66.6],
    B: [-22, -66.6],
    C: [22, -66.6],
    D: [66.2, -66.6],
    K: [-66.2, -20],
    E: [66.2, -20],
    J: [-55.5, 26],
    F: [55.5, 26],
    I: [-33, 62],
    G: [33, 62],
    H: [0, 89.5]
  },
  spanish: {
    a: [-43.75, -50],
    b: [0, -50],
    c: [43.75, -50],
    d: [-43.75, 0],
    e: [0, 0],
    f: [43.75, 0],
    g: [-43.75, 50],
    h: [0, 50],
    i: [43.75, 50],
    y: [-50, -50],
    z: [0, 50],
    j: [-37.5, -37.5],
    k: [0, -37.5],
    l: [37.5, -37.5],
    m: [-37.5, 37.5],
    n: [0, 37.5],
    o: [37.5, 37.5],
    p: [-37.5, 0],
    q: [37.5, 0],
    A: [-66.2, -66.6],
    B: [-22, -66.6],
    C: [22, -66.6],
    D: [66.2, -66.6],
    K: [-66.4, -20],
    E: [66.4, -20],
    J: [-66.4, 26],
    F: [66.4, 26],
    I: [-49, 70],
    G: [49, 70],
    H: [0, 92]
  },
  // ... all other shieldPositions data from original ...
  moriaOrc: {
    a: [-37.5, -37.5],
    b: [0, -37.5],
    c: [37.5, -37.5],
    d: [-37.5, 0],
    e: [0, 0],
    f: [37.5, 0],
    g: [-37.5, 37.5],
    h: [0, 37.5],
    i: [37.5, 37.5],
    y: [-50, -50],
    z: [0, 40],
    j: [-30, -30],
    k: [0, -30],
    l: [30, -30],
    m: [-30, 30],
    n: [0, 30],
    o: [30, 30],
    p: [-30, 0],
    q: [30, 0],
    A: [-48, -48],
    B: [-16, -50],
    C: [16, -46],
    D: [39, -61],
    K: [-52, -19],
    E: [52, -26],
    J: [-42, 9],
    F: [52, 9],
    I: [-31, 40],
    G: [40, 43],
    H: [4, 47]
  }
};

const shieldSize = {
  // ... all shieldSize data from original ...
  moriaOrc: 0.7
};

const shieldBox = {
  // ... all shieldBox data from original ...
  moriaOrc: "0 0 200 200"
};

export const shieldPaths = {
  // ... all shieldPaths data from original ...
  moriaOrc:
    "M45 35c5 3 7 10 13 9h19c4-2 7-4 9-9 6 1 9 9 16 11 7-2 14 0 21 0 6-3 6-10 10-15 2-5 1-10-2-15-2-4-5-14-4-16 3 6 7 11 12 14 7 3 3 12 7 16 3 6 4 12 9 18 2 4 6 8 5 14 0 6-1 12 3 18-3 6-2 13-1 20 1 6-2 12-1 18 0 6-3 13 0 18 8 4 0 8-5 7-4 3-9 3-13 9-5 5-5 13-8 19 0 6 0 15-7 16-1 6-7 6-10 12-1-6 0-6-2-9l2-19c2-4 5-12-3-12-4-5-11-5-15 1l-13-18c-3-4-2 9-3 12 2 2-4-6-7-5-8-2-8 7-11 11-2 4-5 10-8 9 3-10 3-16 1-23-1-4 2-9-4-11 0-6 1-13-2-19-4-2-9-6-13-7V91c4-7-5-13 0-19-3-7 2-11 2-18-1-6 1-12 3-17v-1z"
};

const lines = {
  // ... all lines data from original ...
  archedReversed: "m 0,85 c 0,0 60,20.2 100,20 40,-0.2 100,-20 100,-20 v 30 H 0 Z"
};

const templates = {
  // ... all templates data from original ...
  saltirePartedLined: line =>
    `<path d="${line}" transform="translate(3 -13) rotate(45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(-23 13) rotate(225 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(-23 -13) rotate(-45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(3 13) rotate(-225 110 100) scale(1.1 1)"/>`
};

const patterns = {
  // ... all patterns data from original ...
  honeycombed: (p, c1, c2, size) =>
    `<pattern id="${p}" width="${size * 0.143}" height="${
      size * 0.24514
    }" viewBox="0 0 70 120"><rect width="70" height="120" fill="${c1}"/><path d="M 70,0 V 20 L 35,40 m 35,80 V 100 L 35,80 M 0,120 V 100 L 35,80 V 40 L 0,20 V 0" stroke="${c2}" fill="none" stroke-width="3"/></pattern>`
};

/**
 * Generates an SVG string for a given Coat of Arms definition.
 * @param {object} coa The Coat of Arms definition object.
 * @param {string} id A unique ID to be used for SVG elements like clipPaths and patterns.
 * @param {object} chargesData An object mapping charge names to their raw SVG <g> element strings.
 * @returns {string} The complete SVG string for the Coat of Arms.
 */
export function render(coa, id, chargesData) {
  const {shield = "heater", division, ordinaries = [], charges = []} = coa;

  const ordinariesRegular = ordinaries.filter(o => !o.above);
  const ordinariesAboveCharges = ordinaries.filter(o => o.above);
  const shieldPath = shieldPaths[shield] || shieldPaths.heater;
  const tDiv = division ? (division.t.includes("-") ? division.t.split("-")[1] : division.t) : null;
  const positions = shieldPositions[shield];
  const sizeModifier = shieldSize[shield] || 1;
  const viewBox = shieldBox[shield] || "0 0 200 200";

  const shieldClip = `<clipPath id="${shield}_${id}"><path d="${shieldPath}"/></clipPath>`;
  const divisionClip = division
    ? `<clipPath id="divisionClip_${id}">${getTemplate(division.division, division.line)}</clipPath>`
    : "";
  const loadedCharges = getCharges(coa, id, chargesData, shieldPath);
  const loadedPatterns = getPatterns(coa, id);
  const blacklight = `<radialGradient id="backlight_${id}" cx="100%" cy="100%" r="150%"><stop stop-color="#fff" stop-opacity=".3" offset="0"/><stop stop-color="#fff" stop-opacity=".15" offset=".25"/><stop stop-color="#000" stop-opacity="0" offset="1"/></radialGradient>`;
  const field = `<rect x="0" y="0" width="200" height="200" fill="${clr(coa.t1)}"/>`;
  const style = `<style>g.secondary,path.secondary{fill:var(--secondary);}g.tertiary,path.tertiary{fill:var(--tertiary);}</style>`;

  const divisionGroup = division ? templateDivision() : "";
  const overlay = `<path d="${shieldPath}" fill="url(#backlight_${id})" stroke="#333"/>`;

  const svg = `<svg id="${id}" width="200" height="200" viewBox="${viewBox}">
      <defs>${shieldClip}${divisionClip}${loadedCharges}${loadedPatterns}${blacklight}${style}</defs>
      <g clip-path="url(#${shield}_${id})">${field}${divisionGroup}${templateAboveAll()}</g>
      ${overlay}</svg>`;

  return svg;

  function templateDivision() {
    let svg = "";

    // In field part
    for (const ordinary of ordinariesRegular) {
      if (ordinary.divided === "field") svg += templateOrdinary(ordinary, ordinary.t);
      else if (ordinary.divided === "counter") svg += templateOrdinary(ordinary, tDiv);
    }
    for (const charge of charges) {
      if (charge.divided === "field") svg += templateCharge(charge, charge.t);
      else if (charge.divided === "counter") svg += templateCharge(charge, tDiv);
    }
    for (const ordinary of ordinariesAboveCharges) {
      if (ordinary.divided === "field") svg += templateOrdinary(ordinary, ordinary.t);
      else if (ordinary.divided === "counter") svg += templateOrdinary(ordinary, tDiv);
    }

    // In division part
    svg += `<g clip-path="url(#divisionClip_${id})"><rect x="0" y="0" width="200" height="200" fill="${clr(
      division.t
    )}"/>`;
    for (const ordinary of ordinariesRegular) {
      if (ordinary.divided === "division") svg += templateOrdinary(ordinary, ordinary.t);
      else if (ordinary.divided === "counter") svg += templateOrdinary(ordinary, coa.t1);
    }
    for (const charge of charges) {
      if (charge.divided === "division") svg += templateCharge(charge, charge.t);
      else if (charge.divided === "counter") svg += templateCharge(charge, coa.t1);
    }
    for (const ordinary of ordinariesAboveCharges) {
      if (ordinary.divided === "division") svg += templateOrdinary(ordinary, ordinary.t);
      else if (ordinary.divided === "counter") svg += templateOrdinary(ordinary, coa.t1);
    }
    return (svg += `</g>`);
  }

  function templateAboveAll() {
    let svg = "";
    ordinariesRegular.filter(o => !o.divided).forEach(ordinary => (svg += templateOrdinary(ordinary, ordinary.t)));
    charges.filter(o => !o.divided || !division).forEach(charge => (svg += templateCharge(charge, charge.t)));
    ordinariesAboveCharges
      .filter(o => !o.divided)
      .forEach(ordinary => (svg += templateOrdinary(ordinary, ordinary.t)));
    return svg;
  }

  function templateOrdinary(ordinary, tincture) {
    const fill = clr(tincture);
    let svg = `<g fill="${fill}" stroke="none">`;
    if (ordinary.ordinary === "bordure")
      svg += `<path d="${shieldPath}" fill="none" stroke="${fill}" stroke-width="16.7%"/>`;
    else if (ordinary.ordinary === "orle")
      svg += `<path d="${shieldPath}" fill="none" stroke="${fill}" stroke-width="5%" transform="scale(.85)" transform-origin="center">`;
    else svg += getTemplate(ordinary.ordinary, ordinary.line);
    return svg + `</g>`;
  }

  function templateCharge(charge, tincture, secondaryTincture, tertiaryTincture) {
    const primary = clr(tincture);
    const secondary = clr(secondaryTincture || tincture);
    const tertiary = clr(tertiaryTincture || tincture);
    const stroke = charge.stroke || "#000";

    const chargePositions = [...new Set(charge.p)].filter(position => positions[position]);
    let svg = `<g fill="${primary}" style="--secondary: ${secondary}; --tertiary: ${tertiary}" stroke="${stroke}">`;
    for (const p of chargePositions) {
      const transform = getElTransform(charge, p);
      svg += `<use href="#${charge.charge}_${id}" transform="${transform}"></use>`;
    }
    return svg + "</g>";

    function getElTransform(c, p) {
      const s = (c.size || 1) * sizeModifier;
      const sx = c.sinister ? -s : s;
      const sy = c.reversed ? -s : s;
      let [x, y] = positions[p];
      x = x - 100 * (sx - 1);
      y = y - 100 * (sy - 1);
      const scale = c.sinister || c.reversed ? `${sx} ${sy}` : s;
      return `translate(${x} ${y}) scale(${scale})`;
    }
  }
}

// Helpers
function getCharges(coa, id, chargesData, shieldPath) {
  let chargesToLoad = coa.charges ? coa.charges.map(charge => charge.charge) : [];
  if (semy(coa.t1)) chargesToLoad.push(semy(coa.t1));
  if (semy(coa.division?.t)) chargesToLoad.push(semy(coa.division.t));

  const uniqueCharges = [...new Set(chargesToLoad)];
  return uniqueCharges
    .map(charge => {
      if (charge === "inescutcheon") {
        return `<g id="inescutcheon_${id}"><path transform="translate(66 66) scale(.34)" d="${shieldPath}"/></g>`;
      }
      const chargeSVG = chargesData[charge];
      if (!chargeSVG) {
        console.error(`Charge data for "${charge}" not provided.`);
        return "";
      }
      // Inject the unique ID into the provided <g> tag
      return chargeSVG.replace(/<g/i, `<g id="${charge}_${id}"`);
    })
    .join("");
}

function getPatterns(coa, id) {
  const isPattern = string => string.includes("-");
  let patternsToAdd = [];
  if (coa.t1.includes("-")) patternsToAdd.push(coa.t1);
  if (coa.division && isPattern(coa.division.t)) patternsToAdd.push(coa.division.t);
  if (coa.ordinaries) {
    coa.ordinaries.filter(ordinary => isPattern(ordinary.t)).forEach(ordinary => patternsToAdd.push(ordinary.t));
  }
  if (coa.charges) {
    coa.charges.filter(charge => isPattern(charge.t)).forEach(charge => patternsToAdd.push(charge.t));
  }
  if (!patternsToAdd.length) return "";

  return [...new Set(patternsToAdd)]
    .map(patternString => {
      const [pattern, t1, t2, size] = patternString.split("-");
      const charge = semy(patternString);
      if (charge) return patterns.semy(patternString, clr(t1), clr(t2), getSizeMod(size), charge + "_" + id);
      return patterns[pattern](patternString, clr(t1), clr(t2), getSizeMod(size), charge);
    })
    .join("");
}

function getSizeMod(size) {
  if (size === "small") return 0.8;
  if (size === "smaller") return 0.5;
  if (size === "smallest") return 0.25;
  if (size === "big") return 1.6;
  return 1;
}

function getTemplate(id, line) {
  const linedId = id + "Lined";
  if (!line || line === "straight" || !templates[linedId]) return templates[id];
  const linePath = lines[line];
  return templates[linedId](linePath);
}

function clr(tincture) {
  if (colors[tincture]) return colors[tincture];
  return `url(#${tincture})`;
}

function semy(string) {
  const isSemy = /^semy/.test(string);
  if (!isSemy) return false;
  const match = string.match(/semy_of_(.*?)-/);
  return match ? match[1] : false;
}