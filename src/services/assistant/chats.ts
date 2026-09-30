import type { Message, Usage } from "./providers";
import type { RunResult } from "./runtime";
import { answererFor, type Tier } from "./tier";

/** One recorded value a proposal changes: an entity field before and after */
export interface ChangeRow {
  key: string;
  entity: string;
  field: string;
  before?: unknown;
  after?: unknown;
}

export interface Proposal {
  number: number;
  mapId: number;
  summary: string;
  operations: { op: string; args: unknown[] }[];
  change: ChangeRow[];
  state: "proposed" | "applied" | "undone" | "discarded";
}

export interface ChartRow {
  label: string;
  value: number;
  entity?: string;
}

/** A choice becomes a proposal when it carries operations, otherwise the user's next question */
export interface Choice {
  label: string;
  operations?: Proposal["operations"];
}

/** Placed by the show tool. Entities and cards hold references and read the map when drawn */
export type Widget =
  | { type: "entities"; title: string; entities: string[] }
  | { type: "card"; entity: string }
  | { type: "chart"; chart: "bar" | "pie"; title: string; unit?: string; rows: ChartRow[] }
  | { type: "choices"; title: string; choices: Choice[]; picked?: number }
  | { type: "inset"; title: string; entity?: string; box?: [x0: number, y0: number, x1: number, y1: number] }
  | { type: "emblem"; entity: string };

export type TranscriptItem =
  | { kind: "question"; text: string }
  | { kind: "answer"; text: string; ratingId?: number | null; rating?: "up" | "down" }
  | { kind: "step"; code: string; result?: RunResult }
  | { kind: "proposal"; proposal: Proposal }
  | { kind: "notice"; text: string; retryAt?: number }
  | { kind: "divider" }
  | { kind: "widget"; widget: Widget };

export interface Chat {
  id: string;
  title: string;
  updated: number;
  tier: NonNullable<Tier>;
  mapId: number;
  mapName: string;
  items: TranscriptItem[];
  serverChatId?: string;
  messages: Message[];
  usage: Usage;
}

const STORAGE_KEY = "fmg-assistant-chats";
const CURRENT_KEY = "fmg-assistant-current-chat";
const TITLE_LENGTH = 60;
let chats: Chat[] = [];
let currentId = "";
let loaded = false;
let loading: Promise<void> | undefined;
let saving = false;
let dirty = false;

export async function load(): Promise<void> {
  if (loaded) return;
  if (loading) return loading;
  loading = (async () => {
    const value = await ldb.get<Chat[]>(STORAGE_KEY);
    chats = Array.isArray(value) ? value.filter(item => item?.id && Array.isArray(item.items)) : [];
    currentId = localStorage.getItem(CURRENT_KEY) || chats[0]?.id || "";
    loaded = true;
  })();
  try {
    await loading;
  } finally {
    loading = undefined;
  }
}

export const list = (): Chat[] => [...chats].sort((a, b) => b.updated - a.updated);
export const current = (): Chat | undefined => chats.find(chat => chat.id === currentId);

export function select(id: string): Chat | undefined {
  const selected = chats.find(chat => chat.id === id);
  if (!selected) return current();
  currentId = id;
  localStorage.setItem(CURRENT_KEY, id);
  touch(selected);
  return selected;
}

export function create(tier: NonNullable<Tier>, mapId: number, mapName: string): Chat {
  const chat: Chat = {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: "New chat",
    updated: Date.now(),
    tier,
    mapId,
    mapName,
    items: [],
    messages: [],
    usage: { input: 0, output: 0, cached: 0 }
  };
  chats.push(chat);
  select(chat.id);
  return chat;
}

export function remove(id: string): void {
  chats = chats.filter(chat => chat.id !== id);
  if (currentId === id) {
    currentId = "";
    localStorage.removeItem(CURRENT_KEY);
  }
  persist();
}

export function append(chat: Chat, item: TranscriptItem): void {
  if (item.kind === "question" && !chat.items.some(entry => entry.kind === "question")) {
    chat.title = item.text.length > TITLE_LENGTH ? `${item.text.slice(0, TITLE_LENGTH).trimEnd()}…` : item.text;
  }
  chat.items.push(item);
  touch(chat);
}

export function touch(chat: Chat): void {
  chat.updated = Date.now();
  persist();
}

export function canContinue(chat: Chat, tier: Tier, mapId: number): boolean {
  return answererFor(chat.tier) === answererFor(tier) && chat.mapId === mapId;
}

// An image's data is not re-sent once its question is answered, so it does not count
export const isLong = (chat: Chat): boolean =>
  chat.tier === "key" &&
  JSON.stringify(chat.messages, (key, value) => (key === "data" && typeof value === "string" ? "" : value)).length >
    100_000;

function persist(): void {
  if (!loaded || typeof ldb === "undefined") return;
  dirty = true;
  if (saving) return;
  saving = true;
  void (async () => {
    try {
      while (dirty) {
        dirty = false;
        await ldb.set(STORAGE_KEY, structuredClone(chats));
      }
    } catch (error) {
      console.warn("Assistant chats could not be saved", error);
    } finally {
      saving = false;
    }
  })();
}
