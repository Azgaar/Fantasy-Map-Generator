// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";

const completeMock = vi.hoisted(() => vi.fn());
vi.mock("./providers", async importOriginal => ({
  ...(await importOriginal<typeof import("./providers")>()),
  complete: completeMock
}));

import type { Chat, TranscriptItem } from "./chats";
import { save } from "./connection";
import { createProviderAnswerer } from "./provider-answerer";

const newChat = (): Chat => ({
  id: "1",
  title: "New chat",
  updated: 0,
  answerer: "provider",
  mapId: 1,
  mapName: "Map",
  items: [],
  messages: [],
  usage: { input: 0, output: 0, cached: 0 }
});

beforeEach(() => {
  localStorage.clear();
  completeMock.mockReset();
  save({ provider: "openai", model: "custom-model", key: "key", localUrl: "", localModel: "" });
});

it("dispatches a map tool, reports its change, and preserves provider history", async () => {
  completeMock
    .mockResolvedValueOnce({
      content: [{ type: "tool_use", id: "call1", name: "rename", input: { id: "burg:1", name: "New" } }],
      usage: { input: 10, output: 2, cached: 0 }
    })
    .mockResolvedValueOnce({
      content: [{ type: "text", text: "Renamed it." }],
      usage: { input: 20, output: 3, cached: 4 }
    });
  const chat = newChat();
  const items: TranscriptItem[] = [];
  const tool = {
    definition: { name: "rename", description: "Rename", input_schema: {} },
    handle: vi.fn(async () => ({ content: "Renamed", item: { kind: "notice" as const, text: "Changed" } }))
  };
  await createProviderAnswerer([tool], async () => "# Current map").send(
    chat,
    "Rename it",
    item => items.push(item),
    new AbortController().signal
  );
  expect(items.map(item => item.kind)).toEqual(["question", "notice", "answer"]);
  expect(tool.handle).toHaveBeenCalledWith({ id: "burg:1", name: "New" });
  expect(chat.messages.at(-1)?.role).toBe("assistant");
  expect(chat.usage).toEqual({ input: 30, output: 5, cached: 4 });
  expect(completeMock.mock.calls[0][0].providerId).toBe("openai");
  expect(completeMock.mock.calls[0][0].system[1].text).toBe("# Current map");
});

it("keeps the connection and prior history when a provider rejects a request", async () => {
  completeMock.mockRejectedValue(new Error("No credit"));
  const chat = newChat();
  const items: TranscriptItem[] = [];
  await expect(
    createProviderAnswerer([], async () => "map").send(
      chat,
      "Hello",
      item => items.push(item),
      new AbortController().signal
    )
  ).rejects.toThrow("No credit");
  expect(chat.messages).toEqual([]);
  expect(items).toEqual([{ kind: "question", text: "Hello" }]);
  expect(localStorage.getItem("fmg-assistant-connected")).toBe("1");
});

it("keeps completed changes and fills cancelled tool results when stopped mid-batch", async () => {
  const controller = new AbortController();
  completeMock.mockResolvedValueOnce({
    content: [
      { type: "tool_use", id: "first", name: "rename", input: {} },
      { type: "tool_use", id: "second", name: "rename", input: {} }
    ],
    usage: { input: 1, output: 1, cached: 0 }
  });
  const handle = vi.fn(async () => {
    controller.abort();
    return { content: "Renamed", item: { kind: "notice" as const, text: "Changed" } };
  });
  const chat = newChat();
  const items: TranscriptItem[] = [];
  await expect(
    createProviderAnswerer(
      [{ definition: { name: "rename", description: "", input_schema: {} }, handle }],
      async () => "map"
    ).send(chat, "Rename two", item => items.push(item), controller.signal)
  ).rejects.toThrow();
  expect(handle).toHaveBeenCalledTimes(1);
  expect(completeMock).toHaveBeenCalledTimes(1);
  expect(chat.messages.at(-1)?.content).toEqual([
    { type: "tool_result", tool_use_id: "first", content: "Renamed", is_error: false },
    { type: "tool_result", tool_use_id: "second", content: "Cancelled before this tool ran.", is_error: true }
  ]);
  expect(items.map(item => item.kind)).toEqual(["question", "notice"]);
});

it("does not contact a provider after Stop while preparing map context", async () => {
  const controller = new AbortController();
  const chat = newChat();
  await expect(
    createProviderAnswerer([], async () => {
      controller.abort();
      return "map";
    }).send(chat, "Question", () => {}, controller.signal)
  ).rejects.toThrow();
  expect(completeMock).not.toHaveBeenCalled();
  expect(chat.messages).toEqual([]);
});

it("shortens tool results from earlier questions before the next request", async () => {
  const chat = newChat();
  chat.messages.push(
    { role: "user", content: [{ type: "text", text: "First" }] },
    { role: "assistant", content: [{ type: "tool_use", id: "old", name: "read_map", input: {} }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "old", content: "big result" }] },
    { role: "assistant", content: [{ type: "text", text: "Answer" }] }
  );
  completeMock.mockResolvedValueOnce({
    content: [{ type: "text", text: "Done" }],
    usage: { input: 1, output: 1, cached: 0 }
  });
  await createProviderAnswerer([], async () => "map").send(chat, "Second", () => {}, new AbortController().signal);
  expect(chat.messages[2].content[0]).toMatchObject({ content: "[Earlier tool result shortened]" });
});

const LOOK = { type: "tool_use", id: "look1", name: "look", input: {} };
const imageTool = {
  definition: { name: "look", description: "Look", input_schema: {} },
  handle: async () => ({
    content: [
      { type: "text" as const, text: "The emblem" },
      { type: "image" as const, source: { type: "base64" as const, media_type: "image/png" as const, data: "QUJD" } }
    ]
  })
};

it("asks once more without images when the model cannot see them", async () => {
  completeMock
    .mockResolvedValueOnce({ content: [LOOK], usage: { input: 1, output: 1, cached: 0 } })
    .mockRejectedValueOnce(new Error("This model does not support image input"))
    .mockResolvedValueOnce({
      content: [{ type: "text", text: "A red shield." }],
      usage: { input: 1, output: 1, cached: 0 }
    });
  const chat = newChat();
  const items: TranscriptItem[] = [];
  await createProviderAnswerer([imageTool], async () => "map").send(
    chat,
    "Describe it",
    item => items.push(item),
    new AbortController().signal
  );
  expect(completeMock).toHaveBeenCalledTimes(3);
  expect(items.at(-1)).toEqual({ kind: "answer", text: "A red shield." });
  const result = chat.messages.flatMap(message => message.content).find(block => block.type === "tool_result");
  expect(JSON.stringify(result)).toContain("cannot see images");
  expect(JSON.stringify(result)).not.toContain("QUJD");
});

it("does not retry a failure when no image was sent", async () => {
  completeMock.mockRejectedValue(new Error("No credit"));
  await expect(
    createProviderAnswerer([], async () => "map").send(newChat(), "Hi", () => {}, new AbortController().signal)
  ).rejects.toThrow("No credit");
  expect(completeMock).toHaveBeenCalledTimes(1);
});

it("shows the status a map tool declares while it runs", async () => {
  completeMock
    .mockResolvedValueOnce({ content: [LOOK], usage: { input: 1, output: 1, cached: 0 } })
    .mockResolvedValueOnce({ content: [{ type: "text", text: "Done." }], usage: { input: 1, output: 1, cached: 0 } });
  const statuses: string[] = [];
  await createProviderAnswerer([{ ...imageTool, status: "Looking at the emblem" }], async () => "map").send(
    newChat(),
    "Describe it",
    () => {},
    new AbortController().signal,
    status => statuses.push(status)
  );
  expect(statuses).toContain("Looking at the emblem");
});

it("keeps no empty turn in history when the model ends without a word", async () => {
  completeMock.mockResolvedValueOnce({ content: [], usage: { input: 1, output: 0, cached: 0 } });
  const chat = newChat();
  await createProviderAnswerer([], async () => "map").send(chat, "Pick", () => {}, new AbortController().signal);
  expect(chat.messages.map(message => message.role)).toEqual(["user"]);
});
