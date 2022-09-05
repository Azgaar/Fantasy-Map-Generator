import * as d3 from "d3";

import {TIME} from "config/logging";
import {getAdjective, list, trimVowels} from "utils/languageUtils";
import {gauss, P, ra, rw} from "utils/probabilityUtils";
import {conflictTypes} from "./config";

const {Names} = window;

export function generateConflicts(states: IState[], cultures: TCultures): IConflict[] {
  TIME && console.time("generateConflicts");
  const historicalWars = generateHistoricalConflicts(states, cultures);
  const ongoingWars = generateOngoingConflicts(states);

  TIME && console.timeEnd("generateConflicts");
  return [...historicalWars, ...ongoingWars].sort((a, b) => a.start - b.start);
}

function generateOngoingConflicts(states: IState[]): IConflict[] {
  const statesMap = new Map(states.map(state => [state.i, state]));
  const wars: IConflict[] = [];

  for (const {i: stateId, relations} of states) {
    if (!relations.includes("Rival")) continue; // no rivals to attack
    if (relations.includes("Vassal")) continue; // not independent
    if (relations.includes("Enemy")) continue; // already at war

    // select candidates to attack: rival independent states
    const candidates = relations
      .map((relation, stateId) => {
        const state = statesMap.get(stateId);
        const isVassal = state?.relations.includes("Vassal");
        return relation === "Rival" && state && !isVassal ? stateId : 0;
      })
      .filter(index => index);
    if (!candidates.length) continue;

    const attacker = statesMap.get(stateId);
    const defender = statesMap.get(ra(candidates));
    if (!attacker || !defender) continue;

    const attackerPower = getStatePower(attacker);
    const defenderPower = getStatePower(defender);
    if (attackerPower < defenderPower * gauss(1.6, 0.8, 0, 10, 2)) continue; // defender is too strong

    const war = simulateWar(attacker, defender);
    wars.push(war);
  }

  return wars;

  function simulateWar(attacker: IState, defender: IState): IConflict {
    const history = [`${attacker.name} declared a war on its rival ${defender.name}`];

    // vassals join the war
    function addVassals(state: IState, side: "attackers" | "defenders") {
      const vassals = getVassals(state);
      if (vassals.length === 0) return [];
      const names = list(vassals.map(({name}) => name));
      history.push(`${state.name}'s vassal${vassals.length > 1 ? "s" : ""} ${names} joined the war on ${side} side`);
      return vassals;
    }

    const attackers = [attacker, ...addVassals(attacker, "attackers")];
    const defenders = [defender, ...addVassals(defender, "defenders")];

    let attackersPower = d3.sum(attackers.map(getStatePower));
    let defendersPower = d3.sum(defenders.map(getStatePower));

    defender.relations.forEach((relation, stateId) => {
      if (relation !== "Ally" || !stateId) return;
      const ally = statesMap.get(stateId)!;
      if (ally.relations.includes("Vassal")) return;

      const allyParty = [ally, ...getVassals(ally)];

      const joinedPower = defendersPower + d3.sum(allyParty.map(getStatePower));
      const isWeak = joinedPower < attackersPower * gauss(1.6, 0.8, 0, 10, 2);
      const isRival = ally.relations[attacker.i] !== "Rival";
      if (!isRival && isWeak) {
        // defender's ally does't involve: break the pact
        const reason = ally.relations.includes("Enemy") ? "Being already at war," : `Frightened by ${attacker.name},`;
        history.push(`${reason} ${ally.name} severed the defense pact with ${defender.name}`);

        allyParty.forEach(ally => {
          defender.relations[ally.i] = "Suspicion";
          ally.relations[defender.i] = "Suspicion";
        });

        return;
      }

      // defender's ally and its vassals join the war
      defenders.push(...allyParty);
      const withVassals = allyParty.length > 1 ? " and its vassals " : "";
      history.push(`Defender's ally ${ally.name}${withVassals}joined the war`);

      defendersPower = joinedPower;
    });

    attacker.relations.forEach((relation, stateId) => {
      if (relation !== "Ally" || !stateId) return;
      if (defenders.some(defender => defender.i === stateId)) return;
      const ally = statesMap.get(stateId)!;
      if (ally.relations.includes("Vassal")) return;

      const allyParty = [ally, ...getVassals(ally)];

      const joinedPower = attackersPower + d3.sum(allyParty.map(getStatePower));
      const isWeak = joinedPower < defendersPower * 1.2;
      const isRival = ally.relations[defender.i] !== "Rival";
      if (!isRival || isWeak) {
        history.push(`Attacker's ally ${ally.name} avoided entering the war`);
        return;
      }

      const allies = ally.relations.map((relation, stateId) => (relation === "Ally" ? stateId : 0));
      if (defenders.some(({i}) => allies.includes(i))) {
        history.push(`Attacker's ally ${ally.name} did not join the war as it has allies on both sides`);
        return;
      }

      // attacker's ally and its vassals join the war
      attackers.push(...allyParty);
      const withVassals = allyParty.length > 1 ? " and its vassals " : "";
      history.push(`Attacker's ally ${ally.name}${withVassals}joined the war`);

      attackersPower = joinedPower;
    });

    // change relations to Enemy for all participants
    attackers.forEach(attacker => {
      defenders.forEach(defender => {
        defender.relations[attacker.i] = "Enemy";
        attacker.relations[defender.i] = "Enemy";
      });
    });

    const advantage = getAdvantage(attackersPower, defendersPower);
    const winning = attackersPower > defendersPower ? "attackers" : "defenders";
    history.push(`At the moment, the ${advantage} advantage is on the side of the ${winning}`);

    const name = `${attacker.name}-${trimVowels(defender.name)}ian War`;
    const parties = {attackers: attackers.map(({i}) => i), defenders: defenders.map(({i}) => i)};
    const start = options.year - gauss(2, 2, 0, 5);
    return {name, start, parties, description: history.join(". ")};
  }

  function getStatePower(state: IState) {
    return state.area * state.expansionism;
  }

  function getVassals(state: IState) {
    return state.relations
      .map((relation, stateId) => (relation === "Suzerain" ? stateId : 0))
      .filter(stateId => stateId)
      .map(stateId => statesMap.get(stateId)!);
  }

  function getAdvantage(p1: number, p2: number) {
    const advantage = p1 > p2 ? p1 / p2 : p2 / p1;
    if (advantage > 3) return "overwhelming";
    if (advantage > 2) return "decisive";
    if (advantage > 1.3) return "significant";
    return "minor";
  }
}

function generateHistoricalConflicts(states: IState[], cultures: TCultures): IConflict[] {
  const statesMap = new Map(states.map(state => [state.i, state]));
  const isConflict = (conflict: IConflict | null): conflict is IConflict => conflict !== null;
  const getNameBase = (cultureId: number) => cultures[cultureId].base;
  return states.map(generateConflicts).flat();

  function generateConflicts(state: IState): IConflict[] {
    const conflicts = state.neighbors
      .map((neighbor, index) => {
        if (index && P(0.8)) return null;
        const enemy = statesMap.get(neighbor);
        if (!enemy) return null;

        const properName = P(0.8) ? enemy.name : Names.getBaseShort(getNameBase(enemy.culture));
        const name = getAdjective(properName) + " " + rw(conflictTypes);
        const start = gauss(options.year - 100, 150, 1, options.year - 6);
        const end = start + gauss(4, 5, 1, options.year - start - 1);
        const parties = {attackers: [state.i], defenders: [enemy.i]};

        const conflict: IConflict = {name, start, end, parties};
        return conflict;
      })
      .filter(isConflict);

    return conflicts;
  }
}
