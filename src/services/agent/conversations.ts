// Conversation store. A chat that never ends gets expensive: every earlier turn is re-sent with the
// next question, so the cheapest control is starting a fresh conversation. Conversations are kept in
// localStorage, newest first, with the oldest dropped when the budget runs out.

import type { Message, Usage } from "./providers";
import type { RunResult } from "./runtime";

export type MessageRole = "user" | "assistant" | "system" | "error";

export type Entry =
  | { kind: "message"; role: MessageRole; text: string }
  | { kind: "script"; code: string; result?: RunResult };

export interface Conversation {
  id: string;
  title: string;
  mapId: number;
  updated: number;
  entries: Entry[];
  messages: Message[];
  usage: Usage;
}

const STORAGE_KEY = "fmg-ai-chat-conversations";
const MAX_CONVERSATIONS = 20;
const MAX_STORED_CHARS = 2_000_000;
const TITLE_LENGTH = 42;
const NEW_TITLE = "New conversation";

let conversations = load();
let currentId = conversations[0]?.id ?? "";

export const list = (): Conversation[] => conversations;

export function current(): Conversation {
  return conversations.find(conversation => conversation.id === currentId) ?? create();
}

export function select(id: string): Conversation {
  if (conversations.some(conversation => conversation.id === id)) currentId = id;
  return current();
}

export function create(): Conversation {
  const conversation: Conversation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: NEW_TITLE,
    mapId,
    updated: Date.now(),
    entries: [],
    messages: [],
    usage: { input: 0, output: 0, cached: 0 }
  };

  conversations.unshift(conversation);
  currentId = conversation.id;
  save();
  return conversation;
}

export function remove(id: string): void {
  conversations = conversations.filter(conversation => conversation.id !== id);
  if (currentId === id) currentId = conversations[0]?.id ?? "";
  save();
}

// Called after every change: refreshes the title from the opening question, re-sorts and persists
export function touch(conversation: Conversation): void {
  const firstQuestion = conversation.entries.find(entry => entry.kind === "message" && entry.role === "user");
  if (firstQuestion?.kind === "message") conversation.title = shorten(firstQuestion.text);

  conversation.updated = Date.now();
  conversations.sort((a, b) => b.updated - a.updated);
  save();
}

// A conversation belongs to the map it was asked about. Once the map changes the old answers are
// stale, so an untouched conversation follows the new map and a used one is left behind.
export function forCurrentMap(): Conversation {
  const conversation = current();
  if (conversation.mapId === mapId) return conversation;
  if (!conversation.entries.length) {
    conversation.mapId = mapId;
    return conversation;
  }
  return create();
}

export const isEmpty = (conversation: Conversation): boolean => !conversation.entries.length;

const shorten = (text: string): string =>
  text.length > TITLE_LENGTH ? `${text.slice(0, TITLE_LENGTH).trimEnd()}…` : text;

function load(): Conversation[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter(item => item?.id && Array.isArray(item.entries)) : [];
  } catch {
    return [];
  }
}

function save(): void {
  try {
    let stored = conversations.slice(0, MAX_CONVERSATIONS);
    let json = JSON.stringify(stored);
    while (json.length > MAX_STORED_CHARS && stored.length > 1) {
      stored = stored.slice(0, -1);
      json = JSON.stringify(stored);
    }
    localStorage.setItem(STORAGE_KEY, json);
  } catch (error) {
    WARN && console.warn("AI Chat: conversations could not be stored", error);
  }
}
