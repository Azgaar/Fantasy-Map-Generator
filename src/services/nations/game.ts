// AI Nations: a refereed, turn-based game played on the open map. Chosen states are run by AI models, which send
// orders and letters each turn; the user is the referee who rules on them. See docs/ai-nations.md

import type { Proposal } from "@/services/assistant/chats";
import type { Usage } from "@/services/assistant/provider/providers";

export const CATEGORIES = ["diplomacy", "military", "recruitment", "trade", "internal"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Ruling = "pending" | "approved" | "rejected";

/** The referee, as the sender of a letter */
export const REFEREE = 0;

export interface Order {
  title: string;
  category: Category;
  text: string;
  ruling: Ruling;
  outcome: string; // what the referee says happened; the nation reads it next turn
}

export interface Letter {
  from: number; // state id, or REFEREE
  to: number;
  text: string;
  delivered: boolean; // the referee may hold a letter back
}

/** What one nation sent for one turn */
export interface Submission {
  state: number;
  model: string;
  assessment: string; // the nation's private reading of its situation; only the referee sees it
  statement: string; // public proclamation, heard by every nation next turn
  orders: Order[];
  letters: Letter[];
  usage: Usage;
  error?: string;
}

export interface Nation {
  state: number;
  model: string;
  persona: string; // the referee's brief for this ruler: character, goals, limits
  notes: string; // the nation's own memory, rewritten by it every turn
}

export interface TurnRecord {
  turn: number;
  date: string; // the map's year when the turn was played
  news: string; // public events the referee announces before orders are collected
  letters: Letter[]; // written by the referee, as itself or as a state no model runs
  submissions: Submission[];
  proposals: Proposal[]; // map changes drafted from the rulings
  clerkNotes: string[];
}

export interface Settings {
  turnLength: string;
  rules: string; // house rules every nation reads
  fog: "full" | "known"; // "known" hides the details of states a nation has no relations with
  defaultModel: string;
}

export interface Game {
  version: 1;
  mapId: number;
  mapName: string;
  nations: Nation[];
  settings: Settings;
  current: TurnRecord;
  history: TurnRecord[];
  usage: Usage;
}

export const DEFAULT_MODEL = "claude-opus-5-5";
const STORAGE_KEY = "fmg-nations-games";
const HISTORY_LIMIT = 200;

const noUsage = (): Usage => ({ input: 0, output: 0, cached: 0 });

const emptyTurn = (turn: number): TurnRecord => ({
  turn,
  date: "",
  news: "",
  letters: [],
  submissions: [],
  proposals: [],
  clerkNotes: []
});

export function create(mapId: number, mapName: string): Game {
  return {
    version: 1,
    mapId,
    mapName,
    nations: [],
    settings: { turnLength: "one season", rules: "", fog: "known", defaultModel: DEFAULT_MODEL },
    current: emptyTurn(1),
    history: [],
    usage: noUsage()
  };
}

export const nationOf = (game: Game, state: number): Nation | undefined =>
  game.nations.find(nation => nation.state === state);

/** Hand a state to a model, or take it back; a returning nation keeps its persona and notes */
export function setControlled(game: Game, state: number, controlled: boolean): void {
  const nation = nationOf(game, state);
  if (controlled && !nation)
    game.nations.push({ state, model: game.settings.defaultModel || DEFAULT_MODEL, persona: "", notes: "" });
  if (!controlled && nation) game.nations = game.nations.filter(item => item !== nation);
}

/** Store what a nation sent, replacing its earlier submission of this turn, and count the tokens */
export function record(game: Game, submission: Submission, notes?: string): void {
  game.current.submissions = [...game.current.submissions.filter(item => item.state !== submission.state), submission];
  const nation = nationOf(game, submission.state);
  if (nation && notes !== undefined && !submission.error) nation.notes = notes;
  addUsage(game, submission.usage);
}

export function addUsage(game: Game, usage: Usage): void {
  game.usage.input += usage.input;
  game.usage.output += usage.output;
  game.usage.cached += usage.cached;
}

export const pendingOrders = (turn: TurnRecord): number =>
  turn.submissions.reduce((sum, item) => sum + item.orders.filter(order => order.ruling === "pending").length, 0);

/** Close the turn: it joins the history, where the next briefings read its rulings and letters */
export function endTurn(game: Game, date: string): void {
  game.current.date = date;
  game.history.push(game.current);
  if (game.history.length > HISTORY_LIMIT) game.history.splice(0, game.history.length - HISTORY_LIMIT);
  game.current = emptyTurn(game.current.turn + 1);
}

/** A game read from a file or the browser store, or the reason it is not one */
export function parse(value: unknown): Game | string {
  const game = value as Partial<Game> | null;
  if (!game || typeof game !== "object" || game.version !== 1) return "This is not an AI Nations game file";
  if (!Array.isArray(game.nations) || !Array.isArray(game.history) || !game.current || !game.settings)
    return "The game file is incomplete";
  return {
    ...create(Number(game.mapId) || 0, String(game.mapName ?? "")),
    ...game,
    settings: { ...create(0, "").settings, ...game.settings },
    usage: { ...noUsage(), ...game.usage }
  } as Game;
}

type Store = Record<string, Game>;
let store: Store | undefined;
let saving = false;
let dirty = false;

async function loadStore(): Promise<Store> {
  if (store) return store;
  const value = typeof ldb === "undefined" ? null : await ldb.get<Store>(STORAGE_KEY);
  store = value && typeof value === "object" ? value : {};
  return store;
}

/** The game kept in this browser for the map, or a new one */
export async function load(mapId: number, mapName: string): Promise<Game> {
  const games = await loadStore();
  const saved = parse(games[mapId]);
  const game = typeof saved === "string" ? create(mapId, mapName) : saved;
  game.mapName = mapName;
  games[mapId] = game;
  return game;
}

/** Put a game in the place of the map's own, e.g. one imported from a file */
export async function replace(game: Game): Promise<void> {
  (await loadStore())[game.mapId] = game;
  save();
}

export function save(): void {
  if (!store || typeof ldb === "undefined") return;
  dirty = true;
  if (saving) return;
  saving = true;
  void (async () => {
    try {
      while (dirty) {
        dirty = false;
        await ldb.set(STORAGE_KEY, store);
      }
    } catch (error) {
      console.error("AI Nations game could not be saved", error);
    } finally {
      saving = false;
    }
  })();
}
