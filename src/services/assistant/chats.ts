import type { Message, Usage } from "./provider/providers";
import type { RunResult } from "./provider/runtime";

/** Who asks: a Guest or Member of the Azgaar server, or the user's own key */
export type Tier = "guest" | "member" | "key";

/** One recorded value a proposal changes: an entity field before and after */
export interface ChangeRow {
  key: string;
  entity: string;
  field: string;
  before?: unknown;
  after?: unknown;
  /** `after` holds items added to the end of the list at `field`, whatever else the list holds by then */
  append?: boolean;
  /** Next entity in an ordered collection; null means the end */
  nextId?: number | null;
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
  | { type: "emblem"; entity: string }
  | { type: "source"; page: string };

export type TranscriptItem =
  | { kind: "question"; text: string }
  | { kind: "answer"; text: string; ratingId?: number | null; rating?: "up" | "down" }
  | { kind: "step"; code: string; result?: RunResult }
  | { kind: "proposal"; proposal: Proposal }
  | { kind: "notice"; text: string }
  | { kind: "divider" }
  | { kind: "widget"; widget: Widget };

export interface Chat {
  id: string;
  title: string;
  updated: number;
  tier: Tier;
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

/** Loads once; a failed load is retried on the next call */
export function load(): Promise<void> {
  loading ??= ldb.get<Chat[]>(STORAGE_KEY).then(
    value => {
      chats = Array.isArray(value) ? value.filter(item => item?.id && Array.isArray(item.items)) : [];
      currentId = localStorage.getItem(CURRENT_KEY) || chats[0]?.id || "";
      loaded = true;
    },
    error => {
      loading = undefined;
      throw error;
    }
  );
  return loading;
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

export function canContinue(chat: Chat, tier: Tier | null, mapId: number): boolean {
  // Guest and Member share the Azgaar server's answerer
  return Boolean(tier) && (chat.tier === "key") === (tier === "key") && chat.mapId === mapId;
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
  // IndexedDB copies the value when it stores it, and a change during a write queues one more
  void (async () => {
    try {
      while (dirty) {
        dirty = false;
        await ldb.set(STORAGE_KEY, chats);
      }
    } catch (error) {
      ERROR && console.error("Assistant chats could not be saved", error); // the next change tries again
    } finally {
      saving = false;
    }
  })();
}
