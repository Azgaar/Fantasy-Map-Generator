// One nation's turn: the model reads its briefing and answers with orders, letters and notes through a single tool

import type { Connection } from "@/services/assistant/provider/connection";
import {
  type Completion,
  type CompletionRequest,
  complete,
  type Message,
  type ToolDefinition,
  type ToolInput,
  type Usage
} from "@/services/assistant/provider/providers";
import { errorText } from "@/utils/stringUtils";
import { CATEGORIES, type Category, type Letter, type Nation, type Order, type Submission } from "./game";

const MAX_ORDERS = 8;
const MAX_LETTERS = 8;
const MAX_TEXT = 2000;

const SYSTEM = `You are the government of one state in a turn-based strategy game played on a fantasy map and run by a
human referee. Each turn you receive a briefing and answer with one call of \`submit_turn\`.

How the game works:
- The briefing is everything you know. Never invent facts about the map, other states or your own means.
- Orders are requests, not facts. The referee decides what actually happens and tells you next turn. An order may
  fail, half-succeed or have a price.
- Write each order so the referee can rule on it without asking: who acts, where, with how many, and how it is paid
  for. Name regiments, burgs and states as the briefing does. One action per order.
- Stay within your means: troops you have, a treasury you can afford, a population that can bear it.
- Diplomacy goes through letters, each to one state by its id. The referee reads every letter and may hold one back.
  A promise in a letter binds nobody until both sides act on it.
- The statement is public: every ruler hears it. Leave it empty when you have nothing to proclaim.
- You keep no memory between turns except \`notes\`. Rewrite them every turn: plans, promises made and received,
  who you trust, what you are waiting for.
- Rule in character, as the briefing describes you, and in your own state's interest. Other rulers do the same.

Be brief. A turn is a handful of orders that matter, not a list of everything possible.`;

const text = (description: string) => ({ type: "string", description });

const SUBMIT: ToolDefinition = {
  name: "submit_turn",
  description: "Send this turn's orders, letters, statement and notes to the referee. Call it exactly once.",
  input_schema: {
    type: "object",
    properties: {
      assessment: text(
        "Your private reading of the situation and your intent, in a few sentences. Only the referee sees it."
      ),
      statement: text("Public proclamation heard by every ruler, or an empty string."),
      orders: {
        type: "array",
        maxItems: MAX_ORDERS,
        items: {
          type: "object",
          properties: {
            title: text("The order in a few words."),
            category: { type: "string", enum: CATEGORIES },
            text: text("The full order: who, where, how many, how paid.")
          },
          required: ["title", "category", "text"]
        }
      },
      letters: {
        type: "array",
        maxItems: MAX_LETTERS,
        items: {
          type: "object",
          properties: { to: { type: "integer", description: "The receiving state's id." }, text: text("The letter.") },
          required: ["to", "text"]
        }
      },
      notes: text("Your memory for the next turn, replacing the old notes. At most 300 words.")
    },
    required: ["assessment", "statement", "orders", "letters", "notes"]
  }
};

const RETRY = "Answer only by calling submit_turn, once, with all of your turn in it.";

const clean = (value: unknown, limit = MAX_TEXT): string =>
  typeof value === "string" ? value.trim().slice(0, limit) : "";
const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(item => item && typeof item === "object") : [];

export interface Parsed {
  assessment: string;
  statement: string;
  orders: Order[];
  letters: Letter[];
  notes: string;
}

/** What the model sent, made safe to store: unknown categories fall back, letters to nobody are dropped */
export function parseSubmission(input: ToolInput, from: number, recipients: Set<number>): Parsed {
  const orders = list(input.orders)
    .map(item => ({
      title: clean(item.title, 120) || clean(item.text, 60) || "Order",
      category: (CATEGORIES.includes(item.category as Category) ? item.category : "internal") as Category,
      text: clean(item.text),
      ruling: "pending" as const,
      outcome: ""
    }))
    .filter(order => order.text)
    .slice(0, MAX_ORDERS);
  const letters = list(input.letters)
    .map(item => ({ from, to: Number(item.to), text: clean(item.text), delivered: true }))
    .filter(letter => letter.text && letter.to !== from && recipients.has(letter.to))
    .slice(0, MAX_LETTERS);
  return {
    assessment: clean(input.assessment),
    statement: clean(input.statement),
    orders,
    letters,
    notes: clean(input.notes, 4000)
  };
}

export interface TurnOptions {
  connection: Connection;
  recipients: Set<number>; // states a letter may go to
  signal?: AbortSignal;
  ask?: (request: CompletionRequest) => Promise<Completion>; // replaced in tests
}

export interface TurnResult {
  submission: Submission;
  notes?: string;
}

/** Ask the nation's model for its turn. A failure comes back as a submission carrying the error, never a throw,
 * so one nation's outage does not lose the others' turns */
export async function playTurn(nation: Nation, briefing: string, options: TurnOptions): Promise<TurnResult> {
  const { connection, recipients, signal, ask = complete } = options;
  const usage: Usage = { input: 0, output: 0, cached: 0 };
  const empty = { state: nation.state, model: nation.model, assessment: "", statement: "", orders: [], letters: [] };
  const messages: Message[] = [{ role: "user", content: [{ type: "text", text: briefing }] }];
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const completion = await ask({
        ...connection,
        model: nation.model,
        system: [{ type: "text", text: SYSTEM }],
        messages,
        tools: [SUBMIT],
        signal
      });
      usage.input += completion.usage.input;
      usage.output += completion.usage.output;
      usage.cached += completion.usage.cached;
      const call = completion.content.find(block => block.type === "tool_use" && block.name === SUBMIT.name);
      if (call?.type === "tool_use") {
        const { notes, ...parsed } = parseSubmission(call.input, nation.state, recipients);
        const cut = completion.truncated
          ? "The answer was cut off at the output limit; some orders may be missing."
          : "";
        return {
          submission: { ...empty, ...parsed, usage, ...(cut ? { error: cut } : {}) },
          notes: cut ? undefined : notes
        };
      }
      if (completion.content.length) messages.push({ role: "assistant", content: completion.content });
      messages.push({ role: "user", content: [{ type: "text", text: RETRY }] });
    }
    return { submission: { ...empty, usage, error: "The model answered without sending a turn. Ask it again." } };
  } catch (error) {
    return { submission: { ...empty, usage, error: errorText(error) } };
  }
}
