// Diplomacy view: states colored by their relation to one state
import { color as d3Color } from "d3";
import { NO_RELATION_COLOR, RELATIONS } from "@/data/diplomacy";
import { findEl } from "@/utils/nodeUtils";
import { getVertexPath } from "@/utils/pathUtils";

const MARK_ID = "diplomacyMark";

let markedState = 0;

/** Color states by their relation to the state and mark it */
export function showRelations(stateId: number): void {
  for (const state of pack.states) {
    if (!state.i || state.removed) continue;
    const relation = state.diplomacy?.[stateId];
    const color = (relation && RELATIONS[relation]?.color) || NO_RELATION_COLOR;

    findEl(`state${state.i}`)?.setAttribute("fill", color);
    findEl(`state-gap${state.i}`)?.setAttribute("stroke", color);
    findEl(`state-border${state.i}`)?.setAttribute("stroke", d3Color(color)!.darker().hex());
  }

  markState(stateId);
}

// the outline only changes with the marked state
function markState(stateId: number): void {
  if (stateId === markedState && findEl(MARK_ID)) return;
  removeRelationsMark();
  markedState = stateId;

  const { cells } = pack;
  const stateCells: number[] = [];
  for (const cellId of cells.i) if (cells.state[cellId] === stateId) stateCells.push(cellId);
  const d = getVertexPath(stateCells, pack);
  if (!d) return;

  findEl("debug")?.insertAdjacentHTML(
    "beforeend",
    /* html */ `<g id="${MARK_ID}" pointer-events="none" fill="none">
      <path d="${d}" stroke="#fff" stroke-width="3" stroke-opacity=".8" />
      <path d="${d}" stroke="#000" stroke-width="2" stroke-dasharray="8 6">
        <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="0.7s" repeatCount="indefinite" />
      </path>
    </g>`
  );
}

export function removeRelationsMark(): void {
  markedState = 0;
  findEl(MARK_ID)?.remove();
}
