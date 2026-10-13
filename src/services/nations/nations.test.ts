import { describe, expect, test, vi } from "vitest";
import { type BriefState, buildBriefing, isKnown, type World } from "./briefing";
import { clerkBrief } from "./clerk";
import * as Games from "./game";
import { parseSubmission, playTurn } from "./turn";

const usage = { input: 10, output: 5, cached: 0 };

const state = (i: number, name: string, extra: Partial<BriefState> = {}): BriefState => ({
  i,
  name,
  fullName: `Kingdom of ${name}`,
  form: "Monarchy",
  rural: 100,
  urban: 20,
  area: 500,
  neighbors: [],
  provinces: [],
  military: [],
  diplomacy: ["x", "x", "x", "x"],
  treasury: 1000,
  salesTax: 0.15,
  pollTax: 0.2,
  ...extra
});

function world(): World {
  const orwin = state(1, "Orwin", {
    neighbors: [2],
    diplomacy: ["x", "x", "Enemy", "Unknown"],
    military: [{ i: 0, name: "1st Regiment", a: 1200, n: 0, x: 10, y: 10, u: { infantry: 800, archers: 400 } }]
  });
  const kahor = state(2, "Kahor", {
    neighbors: [1],
    diplomacy: ["x", "Enemy", "x", "Neutral"],
    military: [{ i: 0, name: "Raiders", a: 2360, n: 0, x: 12, y: 12, u: { cavalry: 2360 } }]
  });
  const varn = state(3, "Varn", { diplomacy: ["x", "Unknown", "Neutral", "x"] });
  return {
    states: [state(0, "Neutrals"), orwin, kahor, varn],
    burgs: [
      0,
      { i: 1, name: "Vel", state: 1, x: 11, y: 11, population: 30, capital: 1, port: 2 },
      { i: 2, name: "Orn", state: 2, x: 90, y: 90, population: 12 }
    ],
    provinces: [0],
    cultures: [],
    chronicle: [["War declaration", "Orwin declared a war on its enemy Kahor"]],
    year: 1042,
    era: "WE",
    stateAt: x => (x < 50 ? 1 : 2),
    people: (rural, urban) => (rural + urban) * 1000,
    area: raw => `${raw} mi²`,
    money: amount => `${amount} gp`
  };
}

function gameWith(...stateIds: number[]): Games.Game {
  const game = Games.create(7, "Test map");
  for (const id of stateIds) Games.setControlled(game, id, true);
  return game;
}

describe("briefing", () => {
  test("tells a nation its realm, its forces and who stands on its soil", () => {
    const text = buildBriefing(gameWith(1), 1, world());
    expect(text).toContain("# Turn 1 · 1042 WE");
    expect(text).toContain("You rule **Kingdom of Orwin (state:1)**");
    expect(text).toContain("Treasury: 1000 gp; sales tax 15%");
    expect(text).toContain(
      "1st Regiment (regiment #0): 1,200 troops (800 infantry, 400 archers), near Vel, in your territory"
    );
    expect(text).toContain("## Foreign forces on your soil\n\n- Kahor: Raiders, about 2,400 troops, near Vel");
    expect(text).toContain("This is the first turn");
  });

  test("hides the details of states a nation has no relations with, unless the fog is lifted", () => {
    const game = gameWith(1);
    const hidden = buildBriefing(game, 1, world());
    expect(hidden).toContain("Kingdom of Kahor (state:2): at war; borders you");
    expect(hidden).toContain("Lands you know only by name: Varn (state:3)");
    game.settings.fog = "full";
    expect(buildBriefing(game, 1, world())).toContain("Kingdom of Varn (state:3): no relations");
    const [, orwin, kahor, varn] = world().states;
    expect(isKnown(orwin, kahor, "known")).toBe(true);
    expect(isKnown(orwin, varn, "known")).toBe(false);
  });

  test("reports last turn's rulings, proclamations and delivered letters, and this turn's news", () => {
    const game = gameWith(1, 2);
    Games.record(game, {
      state: 1,
      model: "m",
      assessment: "",
      statement: "",
      orders: [
        {
          title: "March on Orn",
          category: "military",
          text: "…",
          ruling: "approved",
          outcome: "The pass is snowed in"
        },
        { title: "Raise levies", category: "recruitment", text: "…", ruling: "pending", outcome: "" }
      ],
      letters: [],
      usage
    });
    Games.record(game, {
      state: 2,
      model: "m",
      assessment: "secret plan",
      statement: "Kahor will not yield",
      orders: [],
      letters: [
        { from: 2, to: 1, text: "Peace for gold?", delivered: true },
        { from: 2, to: 1, text: "Held back", delivered: false }
      ],
      usage
    });
    Games.endTurn(game, "1042 WE");
    game.current.news = "A plague in the south";
    game.current.letters.push({ from: Games.REFEREE, to: 1, text: "The gods are watching", delivered: true });
    const text = buildBriefing(game, 1, world());
    expect(text).toContain("# Turn 2");
    expect(text).toContain("- [approved] March on Orn — The pass is snowed in");
    expect(text).toContain("- [no ruling: assume it did not happen] Raise levies");
    expect(text).toContain("- Kahor: Kahor will not yield");
    expect(text).toContain("- From Kahor: Peace for gold?");
    expect(text).toContain("- From The referee: The gods are watching");
    expect(text).toContain("A plague in the south");
    expect(text).not.toContain("Held back");
    expect(text).not.toContain("secret plan");
  });
});

describe("turn", () => {
  const recipients = new Set([1, 2, 3]);

  test("keeps what is usable of a model's answer", () => {
    const parsed = parseSubmission(
      {
        assessment: " We are strong ",
        statement: 5,
        orders: [
          { title: "Go", category: "sorcery", text: "March" },
          { title: "Empty", category: "trade", text: "" },
          "junk"
        ],
        letters: [
          { to: 2, text: "Hello" },
          { to: 1, text: "To myself" },
          { to: 99, text: "To nobody" }
        ],
        notes: "remember"
      },
      1,
      recipients
    );
    expect(parsed.assessment).toBe("We are strong");
    expect(parsed.statement).toBe("");
    expect(parsed.orders).toEqual([
      { title: "Go", category: "internal", text: "March", ruling: "pending", outcome: "" }
    ]);
    expect(parsed.letters).toEqual([{ from: 1, to: 2, text: "Hello", delivered: true }]);
    expect(parsed.notes).toBe("remember");
  });

  const nation = { state: 1, model: "claude-opus-5-5", persona: "", notes: "" };
  const connection = { provider: "anthropic" as const, model: "other", key: "k", localUrl: "" };
  const turnCall = {
    type: "tool_use" as const,
    id: "t",
    name: "submit_turn",
    input: {
      assessment: "a",
      statement: "",
      orders: [{ title: "Go", category: "military", text: "March" }],
      letters: [],
      notes: "n"
    }
  };

  test("asks the nation's own model and returns its orders and notes", async () => {
    const ask = vi.fn(async (_request: unknown) => ({ content: [turnCall], usage }));
    const { submission, notes } = await playTurn(nation, "briefing", { connection, recipients, ask });
    expect(ask.mock.calls[0][0]).toMatchObject({ model: "claude-opus-5-5", key: "k" });
    expect(submission.orders).toHaveLength(1);
    expect(submission.usage).toEqual(usage);
    expect(notes).toBe("n");
  });

  test("asks once more when the model answers in prose, and reports a failure instead of throwing", async () => {
    const prose = { content: [{ type: "text" as const, text: "My orders are…" }], usage };
    const ask = vi
      .fn()
      .mockResolvedValueOnce(prose)
      .mockResolvedValueOnce({ content: [turnCall], usage });
    const retried = await playTurn(nation, "briefing", { connection, recipients, ask });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(retried.submission.orders).toHaveLength(1);
    expect(retried.submission.usage.input).toBe(20);

    const failed = await playTurn(nation, "briefing", {
      connection,
      recipients,
      ask: () => Promise.reject(new Error("401"))
    });
    expect(failed.submission.error).toBe("401");
    expect(failed.notes).toBeUndefined();
  });
});

describe("game", () => {
  test("a failed turn keeps the nation's notes, a good one replaces them", () => {
    const game = gameWith(1);
    const submission = { state: 1, model: "m", assessment: "", statement: "", orders: [], letters: [], usage };
    Games.record(game, submission, "first");
    Games.record(game, { ...submission, error: "outage" }, "lost");
    expect(Games.nationOf(game, 1)?.notes).toBe("first");
    expect(game.current.submissions).toHaveLength(1);
    expect(game.usage.input).toBe(20);
  });

  test("survives a round trip through a file and refuses other files", () => {
    const game = gameWith(1, 2);
    Games.endTurn(game, "1042 WE");
    expect(Games.parse(JSON.parse(JSON.stringify(game)))).toEqual(game);
    expect(Games.parse({ version: 2 })).toBe("This is not an AI Nations game file");
    expect(Games.parse({ version: 1, nations: [] })).toBe("The game file is incomplete");
  });
});

describe("clerk", () => {
  test("hands over only approved orders, with the referee's outcome", () => {
    const game = gameWith(1);
    Games.record(game, {
      state: 1,
      model: "m",
      assessment: "",
      statement: "",
      orders: [
        {
          title: "March on Orn",
          category: "military",
          text: "Move the 1st",
          ruling: "approved",
          outcome: "Half arrive"
        },
        { title: "Burn it", category: "military", text: "Burn Orn", ruling: "rejected", outcome: "" }
      ],
      letters: [],
      usage
    });
    const brief = clerkBrief(game.current, id => `S${id}`);
    expect(brief).toContain("S1 (state:1), military: March on Orn");
    expect(brief).toContain("Referee's outcome: Half arrive");
    expect(brief).not.toContain("Burn it");
    game.current.submissions[0].orders[0].ruling = "pending";
    expect(clerkBrief(game.current, String)).toBeNull();
  });
});
