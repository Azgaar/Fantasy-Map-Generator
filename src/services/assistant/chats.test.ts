// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";

const storage = new Map<string, unknown>();
beforeEach(() => {
  vi.resetModules();
  storage.clear();
  localStorage.clear();
  vi.stubGlobal("ldb", {
    get: vi.fn(async (key: string) => storage.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      storage.set(key, value);
    })
  });
});

it("keeps chats from different maps and tiers, with no cap", async () => {
  const chats = await import("./chats");
  await chats.load();
  const first = chats.create("guest", 1, "First map");
  chats.append(first, { kind: "question", text: "How do I draw a river?" });
  expect(first.title).toBe("How do I draw a river?");
  expect(chats.canContinue(first, "member", 1)).toBe(true);
  expect(chats.canContinue(first, "key", 1)).toBe(false);
  expect(chats.canContinue(first, "guest", 2)).toBe(false);
  for (let index = 0; index < 25; index++) chats.create("key", index + 2, `Map ${index}`);
  expect(chats.list()).toHaveLength(26);
  await vi.waitFor(() => expect(storage.has("fmg-assistant-chats")).toBe(true));
});

it("recognizes provider history beyond the long-chat threshold", async () => {
  const chats = await import("./chats");
  await chats.load();
  const chat = chats.create("key", 1, "Map");
  const image = {
    type: "image" as const,
    source: { type: "base64" as const, media_type: "image/png" as const, data: "x".repeat(200_000) }
  };
  chat.messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: "1", content: [image] }] });
  expect(chats.isLong(chat)).toBe(false); // an image is not counted
  chat.messages.push({ role: "user", content: [{ type: "text", text: "x".repeat(100_000) }] });
  expect(chats.isLong(chat)).toBe(true);
});

it("retries a failed load without overwriting the saved chats", async () => {
  const chats = await import("./chats");
  vi.mocked(ldb.get).mockRejectedValueOnce(new Error("Temporarily unavailable"));
  await expect(chats.load()).rejects.toThrow("Temporarily unavailable");
  expect(ldb.set).not.toHaveBeenCalled();
  await chats.load();
  const chat = chats.create("guest", 9, "Recovered");
  await vi.waitFor(() => expect(storage.get("fmg-assistant-chats")).toEqual([chat]));
});

it("coalesces pending saves and persists the latest history", async () => {
  const chats = await import("./chats");
  await chats.load();
  let release: (() => void) | undefined;
  vi.mocked(ldb.set).mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        release = resolve;
      })
  );
  const chat = chats.create("guest", 1, "Map");
  for (let index = 0; index < 20; index++) chats.append(chat, { kind: "question", text: `Question ${index}` });
  expect(ldb.set).toHaveBeenCalledTimes(1);
  release!();
  await vi.waitFor(() => expect(ldb.set).toHaveBeenCalledTimes(2));
  expect((storage.get("fmg-assistant-chats") as { items: unknown[] }[])[0].items).toHaveLength(20);
});
