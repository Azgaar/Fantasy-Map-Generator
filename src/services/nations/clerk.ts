// The clerk's brief: the referee's rulings of one turn, worded as a request the Assistant turns into a map change

import type { TurnRecord } from "./game";

const INTRO = `You are the referee's clerk in a turn-based strategy game played on this map. The referee has ruled on this
turn's orders. Draft the map changes those rulings call for, as propose_change batches the referee will preview.

- Change only what a ruling says happened. Where the referee's outcome differs from the order, the outcome wins.
- Rejected orders and plain talk change nothing. Skip them.
- Typical changes: relations (States.setRelation), moving, raising, resizing or disbanding regiments (Military.*),
  treasuries (States.setTreasury), land changing hands (States.setCells, Provinces.setState), war alert.
- Read the map before proposing: find regiments, burgs and coordinates by name, never guess ids.
- Prefer one batch for the whole turn. Then list in a few lines what you proposed and which rulings you left to the
  referee to do by hand, and why.`;

/** The rulings as the clerk reads them, or null when no approved order could change the map */
export function clerkBrief(turn: TurnRecord, name: (state: number) => string): string | null {
  const rulings = turn.submissions.flatMap(submission =>
    submission.orders
      .filter(order => order.ruling === "approved")
      .map(order => {
        const outcome = order.outcome.trim();
        return `- ${name(submission.state)} (state:${submission.state}), ${order.category}: ${order.title}\n  Order: ${order.text}\n  Referee's outcome: ${outcome || "approved as ordered"}`;
      })
  );
  if (!rulings.length) return null;
  const news = turn.news.trim() ? `\n\nNews the referee announced this turn:\n${turn.news.trim()}` : "";
  return `${INTRO}\n\nTurn ${turn.turn} rulings:\n${rulings.join("\n")}${news}`;
}
