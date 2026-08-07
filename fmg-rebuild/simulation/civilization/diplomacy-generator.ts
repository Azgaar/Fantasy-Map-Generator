import { State } from "./state-generator";
import { createPRNG } from "../../core/random";

export type RelationType = "Alliance" | "Friendly" | "Neutral" | "Suspicious" | "War";

export interface StateRelation {
  stateA: number;
  stateB: number;
  type: RelationType;
  threat: number; // 0 to 100
}

export function generateDiplomacy(
  states: State[],
  seed: string
): StateRelation[] {
  const relations: StateRelation[] = [];
  const rng = createPRNG(seed);

  const types: RelationType[] = ["Alliance", "Friendly", "Neutral", "Suspicious", "War"];

  // Set relationships pairwise between all states
  for (let i = 0; i < states.length; i++) {
    for (let j = i + 1; j < states.length; j++) {
      const stateA = states[i].id;
      const stateB = states[j].id;

      // Randomly allocate relations based on weights
      const roll = rng();
      let type: RelationType = "Neutral";
      let threat = 0;

      if (roll < 0.1) {
        type = "Alliance";
        threat = Math.round(rng() * 15);
      } else if (roll < 0.3) {
        type = "Friendly";
        threat = Math.round(rng() * 30);
      } else if (roll < 0.7) {
        type = "Neutral";
        threat = Math.round(rng() * 50);
      } else if (roll < 0.9) {
        type = "Suspicious";
        threat = Math.round(50 + rng() * 30);
      } else {
        type = "War";
        threat = Math.round(80 + rng() * 20);
      }

      relations.push({
        stateA,
        stateB,
        type,
        threat
      });
    }
  }

  return relations;
}
