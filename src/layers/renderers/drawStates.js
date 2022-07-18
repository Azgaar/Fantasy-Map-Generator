import * as d3 from "d3";

import polylabel from "polylabel";

export function drawStates() {
  regions.selectAll("path").remove();

  const {cells, vertices, features} = pack;
  const states = pack.states;
  const n = cells.i.length;

  const used = new Uint8Array(cells.i.length);
  const vArray = new Array(states.length); // store vertices array
  const body = new Array(states.length).fill(""); // path around each state
  const gap = new Array(states.length).fill(""); // path along water for each state to fill the gaps
  const halo = new Array(states.length).fill(""); // path around states, but not lakes

  const getStringPoint = v => vertices.p[v[0]].join(",");

  // define inner-state lakes to omit on border render
  const innerLakes = features.map(feature => {
    if (feature.type !== "lake") return false;

    const shoreline = feature.shoreline || [];
    const states = shoreline.map(i => cells.state[i]);
    return new Set(states).size > 1 ? false : true;
  });

  for (const i of cells.i) {
    if (!cells.state[i] || used[i]) continue;
    const state = cells.state[i];

    const onborder = cells.c[i].some(n => cells.state[n] !== state);
    if (!onborder) continue;

    const borderWith = cells.c[i].map(c => cells.state[c]).find(n => n !== state);
    const vertex = cells.v[i].find(v => vertices.c[v].some(i => cells.state[i] === borderWith));
    const chain = connectVertices(vertex, state);

    const noInnerLakes = chain.filter(v => v[1] !== "innerLake");
    if (noInnerLakes.length < 3) continue;

    // get path around the state
    if (!vArray[state]) vArray[state] = [];
    const points = noInnerLakes.map(v => vertices.p[v[0]]);
    vArray[state].push(points);
    body[state] += "M" + points.join("L");

    // connect path for halo
    let discontinued = true;
    halo[state] += noInnerLakes
      .map(v => {
        if (v[1] === "border") {
          discontinued = true;
          return "";
        }

        const operation = discontinued ? "M" : "L";
        discontinued = false;
        return `${operation}${getStringPoint(v)}`;
      })
      .join("");

    // connect gaps between state and water into a single path
    discontinued = true;
    gap[state] += chain
      .map(v => {
        if (v[1] === "land") {
          discontinued = true;
          return "";
        }

        const operation = discontinued ? "M" : "L";
        discontinued = false;
        return `${operation}${getStringPoint(v)}`;
      })
      .join("");
  }

  // find state visual center
  vArray.forEach((ar, i) => {
    const sorted = ar.sort((a, b) => b.length - a.length); // sort by points number
    states[i].pole = polylabel(sorted, 1.0); // pole of inaccessibility
  });

  const bodyData = body.map((p, s) => [p.length > 10 ? p : null, s, states[s].color]).filter(d => d[0]);
  const gapData = gap.map((p, s) => [p.length > 10 ? p : null, s, states[s].color]).filter(d => d[0]);
  const haloData = halo.map((p, s) => [p.length > 10 ? p : null, s, states[s].color]).filter(d => d[0]);

  const bodyString = bodyData.map(d => `<path id="state${d[1]}" d="${d[0]}" fill="${d[2]}" stroke="none"/>`).join("");
  const gapString = gapData.map(d => `<path id="state-gap${d[1]}" d="${d[0]}" fill="none" stroke="${d[2]}"/>`).join("");
  const clipString = bodyData
    .map(d => `<clipPath id="state-clip${d[1]}"><use href="#state${d[1]}"/></clipPath>`)
    .join("");
  const haloString = haloData
    .map(
      d =>
        `<path id="state-border${d[1]}" d="${d[0]}" clip-path="url(#state-clip${d[1]})" stroke="${
          d3.color(d[2]) ? d3.color(d[2]).darker().hex() : "#666666"
        }"/>`
    )
    .join("");

  statesBody.html(bodyString + gapString);
  defs.select("#statePaths").html(clipString);
  statesHalo.html(haloString);

  // connect vertices to chain
  function connectVertices(start, state) {
    const chain = []; // vertices chain to form a path
    const getType = c => {
      const borderCell = c.find(i => cells.b[i]);
      if (borderCell) return "border";

      const waterCell = c.find(i => cells.h[i] < 20);
      if (!waterCell) return "land";
      if (innerLakes[cells.f[waterCell]]) return "innerLake";
      return features[cells.f[waterCell]].type;
    };

    for (let i = 0, current = start; i === 0 || (current !== start && i < 20000); i++) {
      const prev = chain.length ? chain[chain.length - 1][0] : -1; // previous vertex in chain

      const c = vertices.c[current]; // cells adjacent to vertex
      chain.push([current, getType(c)]); // add current vertex to sequence

      c.filter(c => cells.state[c] === state).forEach(c => (used[c] = 1));
      const c0 = c[0] >= n || cells.state[c[0]] !== state;
      const c1 = c[1] >= n || cells.state[c[1]] !== state;
      const c2 = c[2] >= n || cells.state[c[2]] !== state;

      const v = vertices.v[current]; // neighboring vertices

      if (v[0] !== prev && c0 !== c1) current = v[0];
      else if (v[1] !== prev && c1 !== c2) current = v[1];
      else if (v[2] !== prev && c0 !== c2) current = v[2];

      if (current === prev) {
        ERROR && console.error("Next vertex is not found");
        break;
      }
    }

    if (chain.length) chain.push(chain[0]);
    return chain;
  }

  Zoom.invoke();
}
