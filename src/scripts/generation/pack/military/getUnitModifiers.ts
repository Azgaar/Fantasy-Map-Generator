import {stateModifier} from "config/military";
import {isState} from "utils/typeUtils";

// calculate overall state modifiers for unit types based on state features
export function getUnitModifiers(states: TStates) {
  return states.map(state => {
    if (!isState(state)) return {};

    const unitModifiers: Dict<number> = {};
    const {type: stateType, formName, form, alert} = state;

    for (const {type, name} of options.military) {
      if (!stateModifier[type]) continue;

      let modifier = stateModifier[type][stateType] || 1;
      if (type === "mounted" && formName.includes("Horde")) modifier *= 2;
      else if (type === "naval" && form === "Republic") modifier *= 1.2;

      unitModifiers[name] = modifier * alert;
    }

    return unitModifiers;
  });
}
