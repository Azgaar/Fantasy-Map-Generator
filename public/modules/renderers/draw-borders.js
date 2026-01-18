"use strict";

function drawBorders() {
  TIME && console.time("drawBorders");
  const {cells, vertices} = pack;

  const statePath = [];
  const provincePath = [];
  const checked = {};

  const isLand = cellId => cells.h[cellId] >= 20;

  for (let cellId = 0; cellId < cells.i.length; cellId++) {
    if (!cells.state[cellId]) continue;
    const provinceId = cells.province[cellId];
    const stateId = cells.state[cellId];

    // bordering cell of another province
    if (provinceId) {
      const provToCell = cells.c[cellId].find(neibId => {
        const neibProvinceId = cells.province[neibId];
        return (
          neibProvinceId &&
          provinceId > neibProvinceId &&
          !checked[`prov-${provinceId}-${neibProvinceId}-${cellId}`] &&
          cells.state[neibId] === stateId
        );
      });

      if (provToCell !== undefined) {
        const addToChecked = cellId => (checked[`prov-${provinceId}-${cells.province[provToCell]}-${cellId}`] = true);
        const border = getBorder({type: "province", fromCell: cellId, toCell: provToCell, addToChecked});

        if (border) {
          provincePath.push(border);
          cellId--; // check the same cell again
          continue;
        }
      }
    }

    // if cell is on state border
    const stateToCell = cells.c[cellId].find(neibId => {
      const neibStateId = cells.state[neibId];
      return isLand(neibId) && stateId > neibStateId && !checked[`state-${stateId}-${neibStateId}-${cellId}`];
    });

    if (stateToCell !== undefined) {
      const addToChecked = cellId => (checked[`state-${stateId}-${cells.state[stateToCell]}-${cellId}`] = true);
      const border = getBorder({type: "state", fromCell: cellId, toCell: stateToCell, addToChecked});

      if (border) {
        statePath.push(border);
        cellId--; // check the same cell again
        continue;
      }
    }
  }

  svg.select("#borders").selectAll("path").remove();
  svg.select("#stateBorders").append("path").attr("d", statePath.join(" "));
  svg.select("#provinceBorders").append("path").attr("d", provincePath.join(" "));

  function getBorder({type, fromCell, toCell, addToChecked}) {
    const getType = cellId => cells[type][cellId];
    const isTypeFrom = cellId => cellId < cells.i.length && getType(cellId) === getType(fromCell);
    const isTypeTo = cellId => cellId < cells.i.length && getType(cellId) === getType(toCell);

    addToChecked(fromCell);
    const startingVertex = cells.v[fromCell].find(v => vertices.c[v].some(i => isLand(i) && isTypeTo(i)));
    if (startingVertex === undefined) return null;

    const checkVertex = vertex =>
      vertices.c[vertex].some(isTypeFrom) && vertices.c[vertex].some(c => isLand(c) && isTypeTo(c));
    const chain = getVerticesLine({vertices, startingVertex, checkCell: isTypeFrom, checkVertex, addToChecked});
    if (chain.length > 1) return "M" + chain.map(cellId => vertices.p[cellId]).join(" ");

    return null;
  }

  // connect vertices to chain to form a border
  function getVerticesLine({vertices, startingVertex, checkCell, checkVertex, addToChecked}) {
    let chain = []; // vertices chain to form a path
    let next = startingVertex;
    const MAX_ITERATIONS = vertices.c.length;

    for (let run = 0; run < 2; run++) {
      // first run: from any vertex to a border edge
      // second run: from found border edge to another edge
      chain = [];

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const previous = chain.at(-1);
        const current = next;
        chain.push(current);

        const neibCells = vertices.c[current];
        neibCells.map(addToChecked);

        const [c1, c2, c3] = neibCells.map(checkCell);
        const [v1, v2, v3] = vertices.v[current].map(checkVertex);
        const [vertex1, vertex2, vertex3] = vertices.v[current];

        if (v1 && vertex1 !== previous && c1 !== c2) next = vertex1;
        else if (v2 && vertex2 !== previous && c2 !== c3) next = vertex2;
        else if (v3 && vertex3 !== previous && c1 !== c3) next = vertex3;

        if (next === current || next === startingVertex) {
          if (next === startingVertex) chain.push(startingVertex);
          startingVertex = next;
          break;
        }
      }
    }

    return chain;
  }

  TIME && console.timeEnd("drawBorders");
}
