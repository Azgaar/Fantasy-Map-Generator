import { beforeEach, describe, expect, it, vi } from "vitest";

type Store = typeof import("./conversations");

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: () => null,
    length: 0
  } as unknown as Storage;
}

const globals = globalThis as Record<string, unknown>;

async function freshStore(): Promise<Store> {
  vi.resetModules();
  return import("./conversations");
}

beforeEach(() => {
  globals.localStorage = memoryStorage();
  globals.mapId = 1;
  globals.WARN = false;
});

describe("conversation store", () => {
  it("creates a conversation on first use and makes it current", async () => {
    const store = await freshStore();
    const conversation = store.current();
    expect(store.list()).toEqual([conversation]);
    expect(store.isEmpty(conversation)).toBe(true);
  });

  it("titles a conversation from its opening question and shortens it", async () => {
    const store = await freshStore();
    const conversation = store.current();
    conversation.entries.push({ kind: "message", role: "user", text: "a".repeat(60) });
    store.touch(conversation);
    expect(conversation.title).toBe(`${"a".repeat(42)}…`);
  });

  it("switches between conversations", async () => {
    const store = await freshStore();
    const first = store.current();
    const second = store.create();
    expect(store.current().id).toBe(second.id);
    expect(store.select(first.id).id).toBe(first.id);
  });

  it("falls back to another conversation after a removal", async () => {
    const store = await freshStore();
    const first = store.current();
    const second = store.create();
    store.remove(second.id);
    expect(store.current().id).toBe(first.id);
    expect(store.list().length).toBe(1);
  });

  it("lets an unused conversation follow the map, and leaves a used one behind", async () => {
    const store = await freshStore();
    const empty = store.current();
    globals.mapId = 2;
    expect(store.forCurrentMap().id).toBe(empty.id);
    expect(empty.mapId).toBe(2);

    empty.entries.push({ kind: "message", role: "user", text: "how many burgs?" });
    globals.mapId = 3;
    const next = store.forCurrentMap();
    expect(next.id).not.toBe(empty.id);
    expect(store.list().length).toBe(2);
  });

  it("restores stored conversations on the next load", async () => {
    const store = await freshStore();
    const conversation = store.current();
    conversation.entries.push({ kind: "message", role: "user", text: "which states have no ports?" });
    store.touch(conversation);

    const reloaded = await freshStore();
    expect(reloaded.list().length).toBe(1);
    expect(reloaded.current().title).toBe("which states have no ports?");
    expect(reloaded.current().entries.length).toBe(1);
  });

  it("survives unreadable storage", async () => {
    globals.localStorage = memoryStorage();
    (globals.localStorage as Storage).setItem("fmg-ai-chat-conversations", "{not json");
    const store = await freshStore();
    expect(store.list()).toEqual([]);
  });
});
