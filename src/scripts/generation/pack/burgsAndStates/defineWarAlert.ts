import {relationsAlertRate} from "config/military";
import {minmax, rn} from "utils/numberUtils";

export function defineWarAlert(
  neighbors: number[],
  relations: TRelation[],
  areaRate: number,
  expansionismRate: number
) {
  const expansionismRealization = getRealization(areaRate, expansionismRate);
  const peacefulness = getPeacefulness(relations);
  const neighborliness = getNeighborliness(neighbors, relations);
  const warAlert = getWarAlert(expansionismRealization, peacefulness, neighborliness);

  return rn(warAlert, 2);
}

function getRealization(expansionismRate: number, areaRate: number) {
  const [MIN, MAX] = [0.25, 4];
  return minmax(expansionismRate / areaRate, MIN, MAX);
}

function getPeacefulness(relations: TRelation[]) {
  if (relations.includes("Enemy")) return 1;
  if (relations.includes("Rival")) return 0.8;
  if (relations.includes("Suspicion")) return 0.5;
  return 0.1;
}

function getNeighborliness(neighbors: number[], relations: TRelation[]) {
  const neighborRelations = neighbors.map(neibStateId => relations[neibStateId]);

  const initialRate = 0.5;
  const rate = neighborRelations.reduce((acc, relation) => (acc += relationsAlertRate[relation]), initialRate);

  const [MIN, MAX] = [0.3, 3];
  return minmax(rate, MIN, MAX);
}

function getWarAlert(expansionismRealization: number, peacefulness: number, neighborliness: number) {
  const alert = expansionismRealization * peacefulness * neighborliness;

  const [MIN, MAX] = [0.1, 5];
  return minmax(alert, MIN, MAX);
}
