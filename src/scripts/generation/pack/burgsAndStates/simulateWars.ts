import {TIME} from "config/logging";

import type {TStateData} from "./createStateData";
import type {TDiplomacy} from "./generateRelations";

export function simulateWars(statesData: TStateData[], diplomacy: TDiplomacy) {
  TIME && console.time("simulateWars");

  // declare wars
  for (const {i} of statesData) {
    const relations = diplomacy[i];
    if (!relations.includes("Rival")) continue; // no rivals to attack
    if (relations.includes("Vassal")) continue; // not independent
    if (relations.includes("Enemy")) continue; // already at war

    // select candidates to attack: rival independent states
    const candidates = relations
      .map((relation, index) => (relation === "Rival" && !diplomacy[index].includes("Vassal") ? index : 0))
      .filter(index => index);
    if (!candidates.length) continue;

    const attacker = getDiplomacyData(statesData[i], statistics);
    const defender = getDiplomacyData(statesData[ra(candidates)], statistics);

    const attackerPower = attacker.area * attacker.expansionism;
    const defenderPower = defender.area * defender.expansionism;
    if (attackerPower < defenderPower * gauss(1.6, 0.8, 0, 10, 2)) continue; // defender is too strong

    const attackers = [attacker];
    const defenders = [defender];
  }

  TIME && console.timeEnd("simulateWars");
  return null;
}
