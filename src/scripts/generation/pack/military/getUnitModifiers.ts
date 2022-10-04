import {stateModifier} from "config/military";
import {isState} from "utils/typeUtils";

// calculate overall state modifiers for unit types based on state features
export function getUnitModifiers(states: TStates) {
  const validStates = states.filter(isState);

  for (const state of validStates) {
    const military = {platoons: []};
    const {i: stateId, relations, expansionism, area, neighbors, alert} = state;

    for (const unit of options.military) {
      if (!stateModifier[unit.type]) continue;

      let modifier = stateModifier[unit.type][s.type] || 1;
      if (unit.type === "mounted" && s.formName.includes("Horde")) modifier *= 2;
      else if (unit.type === "naval" && s.form === "Republic") modifier *= 1.2;
      military[unit.name] = modifier * alert;
    }
  }
}
