/**
 * Turn resolution (total-war/.plans/PLAN.md §5.1, decision D2 sequential): player commands during
 * turn N, then on EndTurn → AI factions act → economy tick → advance to N+1.
 */

import { runAi } from "./ai";
import type { EngineCtx } from "./context";
import { economyTick } from "./economy";
import type { GameEvent } from "./events";
import { season } from "./state";

export function endTurn(ctx: EngineCtx): GameEvent[] {
  const { campaign, config } = ctx;
  const events: GameEvent[] = [];

  runAi(ctx);
  events.push(...economyTick(ctx));

  events.push({ type: "TurnEnded", turn: campaign.turn });
  campaign.turn++;
  events.push({ type: "TurnBegan", turn: campaign.turn, year: campaign.year, season: season(campaign, config) });
  return events;
}
