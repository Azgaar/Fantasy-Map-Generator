// @vitest-environment jsdom
import { expect, it, vi } from "vitest";

const askMock = vi.hoisted(() => vi.fn());
vi.mock("./api", async importOriginal => ({ ...(await importOriginal<typeof import("./api")>()), ask: askMock }));

import type { Chat, TranscriptItem } from "../chats";
import { createAzgaarServerAnswerer } from "./answerer";
import { AzgaarServerError } from "./api";

const newChat = (): Chat => ({
  id: "local",
  title: "Help",
  updated: 0,
  answerer: "azgaar-server",
  mapId: 1,
  mapName: "Secret map",
  items: [],
  messages: [],
  usage: { input: 0, output: 0, cached: 0 }
});

it("sends only the question and server chat id, marking a new server memory", async () => {
  askMock.mockResolvedValue({ answer: "Use the Rivers Editor", conversationId: "new-id", requestId: 4 });
  const chat = { ...newChat(), serverChatId: "old-id" };
  const items: TranscriptItem[] = [];
  await createAzgaarServerAnswerer().send(
    chat,
    "How do I edit a river?",
    item => items.push(item),
    new AbortController().signal
  );
  expect(askMock).toHaveBeenCalledWith("How do I edit a river?", "old-id", expect.any(AbortSignal));
  expect(items).toEqual([
    { kind: "question", text: "How do I edit a river?" },
    { kind: "divider" },
    { kind: "answer", text: "Use the Rivers Editor", ratingId: 4 }
  ]);
  expect(chat.serverChatId).toBe("new-id");
});

it("shows a countdown on a rate limit and retries exactly once", async () => {
  vi.useFakeTimers();
  askMock.mockReset();
  askMock.mockRejectedValue(new AzgaarServerError("rate_limited", "Slow down.", 3));
  const items: TranscriptItem[] = [];
  const sent = createAzgaarServerAnswerer().send(
    newChat(),
    "Hi",
    item => items.push(item),
    new AbortController().signal
  );
  const outcome = expect(sent).rejects.toThrow("Slow down.");
  await vi.advanceTimersByTimeAsync(3000);
  await outcome;
  vi.useRealTimers();
  expect(askMock).toHaveBeenCalledTimes(2);
  expect(items).toEqual([
    { kind: "question", text: "Hi" },
    { kind: "notice", text: "Slow down.", retryAt: expect.any(Number) }
  ]);
});
