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
  answerer: "azgaar-server" | "provider";
  mapId: number;
  mapName: string;
  items: TranscriptItem[];
  serverChatId?: string;
  messages: Message[];
  usage: Usage;
}

const STORAGE_KEY = "fmg-assistant-chats";
const CURRENT_KEY = "fmg-assistant-current-chat";
const LEGACY_KEY = "fmg-ai-chat-conversations";
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
    if (Array.isArray(value)) chats = value.filter(item => item?.id && Array.isArray(item.items));
    else {
      chats = migrateLegacyChats();
      if (chats.length) {
        await ldb.set(STORAGE_KEY, chats);
        localStorage.removeItem(LEGACY_KEY);
      }
    }
    currentId = localStorage.getItem(CURRENT_KEY) || chats[0]?.id || "";
    loaded = true;
  })();
  try {
    await loading;
  } finally {
    loading = undefined;
  }
}

function migrateLegacyChats(): Chat[] {
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]") as {
      id: string;
      title: string;
      mapId: number;
      updated: number;
      entries: (
        | { kind: "message"; role: "user" | "assistant" | "system" | "error"; text: string }
        | { kind: "script"; code: string; result?: RunResult }
        | { kind: "edit"; name: string }
      )[];
      messages: Message[];
      usage: Usage;
    }[];
    if (!Array.isArray(legacy)) return [];
    return legacy
      .filter(item => item.id && Array.isArray(item.entries))
      .map(item => ({
        id: item.id,
        title: item.title,
        updated: item.updated,
        answerer: "provider" as const,
        mapId: item.mapId,
        mapName: item.mapId ? `Map ${item.mapId}` : "Unknown map",
        items: item.entries.map((entry): TranscriptItem => {
          if (entry.kind === "script") return { kind: "step", code: entry.code, result: entry.result };
          if (entry.kind === "edit")
            return { kind: "notice", text: `Earlier note edit “${entry.name}” · Undo unavailable` };
          return entry.role === "user"
            ? { kind: "question", text: entry.text }
            : entry.role === "assistant"
              ? { kind: "answer", text: entry.text }
              : { kind: "notice", text: entry.text };
        }),
        messages: item.messages ?? [],
        usage: item.usage ?? { input: 0, output: 0, cached: 0 }
      }));
  } catch {
    return [];
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

export function create(tier: Tier, mapId: number, mapName: string): Chat {
  const answerer = answererFor(tier);
  if (!answerer) throw new Error("Connect a provider before starting a chat");
  const chat: Chat = {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: "New chat",
    updated: Date.now(),
    answerer,
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
  return chat.answerer === answererFor(tier) && chat.mapId === mapId;
}

// An image's data is not re-sent once its question is answered, so it does not count
export const isLong = (chat: Chat): boolean =>
  chat.answerer === "provider" &&
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
