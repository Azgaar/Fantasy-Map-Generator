// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";

const completeMock = vi.hoisted(() => vi.fn());
vi.mock("./providers", async importOriginal => ({
  ...(await importOriginal<typeof import("./providers")>()),
  complete: completeMock
}));

import type { Chat, TranscriptItem } from "../chats";
import { askProvider } from "./answerer";
import { save } from "./connection";

const newChat = (): Chat => ({
  id: "1",
  title: "New chat",
  updated: 0,
  tier: "key",
  mapId: 1,
  mapName: "Map",
  items: [],
  messages: [],
  usage: { input: 0, output: 0, cached: 0 }
});

beforeEach(() => {
  localStorage.clear();
  completeMock.mockReset();
  save({ provider: "openai", model: "custom-model", key: "key", localUrl: "" });
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
    status: "Renaming",
    definition: { name: "rename", description: "Rename", input_schema: {} },
    handle: vi.fn(async () => ({ content: "Renamed", item: { kind: "notice" as const, text: "Changed" } }))
  };
  await askProvider(chat, "Rename it", item => items.push(item), new AbortController().signal, {
    tools: [tool],
    context: async () => "# Current map"
  });
  expect(items.map(item => item.kind)).toEqual(["question", "notice", "answer"]);
  expect(tool.handle).toHaveBeenCalledWith({ id: "burg:1", name: "New" });
  expect(chat.messages.at(-1)?.role).toBe("assistant");
  expect(chat.usage).toEqual({ input: 30, output: 5, cached: 4 });
  expect(completeMock.mock.calls[0][0].provider).toBe("openai");
  expect(completeMock.mock.calls[0][0].system).toHaveLength(1);
  expect(chat.messages[0].content).toEqual([
    { type: "text", text: "# Current map" },
    { type: "text", text: "Rename it" }
  ]);
});

it("keeps the connection and prior history when a provider rejects a request", async () => {
  completeMock.mockRejectedValue(new Error("No credit"));
  const chat = newChat();
  const items: TranscriptItem[] = [];
  await expect(
    askProvider(chat, "Hello", item => items.push(item), new AbortController().signal, {
      tools: [],
      context: async () => "map"
    })
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
    askProvider(chat, "Rename two", item => items.push(item), controller.signal, {
      tools: [{ status: "Renaming", definition: { name: "rename", description: "", input_schema: {} }, handle }],
      context: async () => "map"
    })
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
    askProvider(chat, "Question", () => {}, controller.signal, {
      tools: [],
      context: async () => {
        controller.abort();
        return "map";
      }
    })
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
  await askProvider(chat, "Second", () => {}, new AbortController().signal, { tools: [], context: async () => "map" });
  expect(chat.messages[2].content[0]).toMatchObject({ content: "[Earlier tool result shortened]" });
});

const LOOK = { type: "tool_use", id: "look1", name: "look", input: {} };
const imageTool = {
  status: "Looking",
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
  await askProvider(chat, "Describe it", item => items.push(item), new AbortController().signal, {
    tools: [imageTool],
    context: async () => "map"
  });
  expect(completeMock).toHaveBeenCalledTimes(3);
  expect(items.at(-1)).toEqual({ kind: "answer", text: "A red shield." });
  const result = chat.messages.flatMap(message => message.content).find(block => block.type === "tool_result");
  expect(JSON.stringify(result)).toContain("cannot see images");
  expect(JSON.stringify(result)).not.toContain("QUJD");
});

it("does not retry a failure when no image was sent", async () => {
  completeMock.mockRejectedValue(new Error("No credit"));
  await expect(
    askProvider(newChat(), "Hi", () => {}, new AbortController().signal, { tools: [], context: async () => "map" })
  ).rejects.toThrow("No credit");
  expect(completeMock).toHaveBeenCalledTimes(1);
});

it("shows the status a map tool declares while it runs", async () => {
  completeMock
    .mockResolvedValueOnce({ content: [LOOK], usage: { input: 1, output: 1, cached: 0 } })
    .mockResolvedValueOnce({ content: [{ type: "text", text: "Done." }], usage: { input: 1, output: 1, cached: 0 } });
  const statuses: string[] = [];
  await askProvider(newChat(), "Describe it", () => {}, new AbortController().signal, {
    tools: [{ ...imageTool, status: "Looking at the emblem" }],
    context: async () => "map",
    onStatus: status => statuses.push(status)
  });
  expect(statuses).toContain("Looking at the emblem");
});

it("keeps no empty turn in history when the model ends without a word", async () => {
  completeMock.mockResolvedValueOnce({ content: [], usage: { input: 1, output: 0, cached: 0 } });
  const chat = newChat();
  await askProvider(chat, "Pick", () => {}, new AbortController().signal, { tools: [], context: async () => "map" });
  expect(chat.messages.map(message => message.role)).toEqual(["user"]);
});

it("tells the user when the model ends without an answer", async () => {
  completeMock.mockResolvedValueOnce({ content: [], usage: { input: 1, output: 0, cached: 0 } });
  const items: TranscriptItem[] = [];
  await askProvider(newChat(), "Pick", item => items.push(item), new AbortController().signal, {
    tools: [],
    context: async () => "map"
  });
  expect(items.at(-1)).toEqual({ kind: "notice", text: "The model ended without an answer. Ask again." });
});

it("asks again, for smaller calls, when a reply is cut off at the output limit", async () => {
  completeMock
    .mockResolvedValueOnce({ content: [], truncated: true, usage: { input: 1, output: 4096, cached: 0 } })
    .mockResolvedValueOnce({ content: [{ type: "text", text: "Done." }], usage: { input: 1, output: 1, cached: 0 } });
  const chat = newChat();
  const items: TranscriptItem[] = [];
  await askProvider(chat, "Add markers", item => items.push(item), new AbortController().signal, {
    tools: [],
    context: async () => "map"
  });
  expect(items.map(item => item.kind)).toEqual(["question", "answer"]);
  expect(JSON.stringify(chat.messages[1])).toContain("cut off at the output limit");
});

it("asks once for the proposal an answer claims but never sent", async () => {
  const proposal = { number: 1, mapId: 1, summary: "War", operations: [], change: [], state: "proposed" as const };
  const tool = {
    status: "Preparing a change",
    definition: { name: "propose_change", description: "Propose", input_schema: {} },
    handle: vi.fn(async () => ({ content: "Proposal #1 is waiting", item: { kind: "proposal" as const, proposal } }))
  };
  const reply = (text: string) => ({ content: [{ type: "text", text }], usage: { input: 1, output: 1, cached: 0 } });
  completeMock
    .mockResolvedValueOnce(reply("Your declaration batch is waiting in the card above."))
    .mockResolvedValueOnce({
      content: [{ type: "tool_use", id: "p", name: "propose_change", input: {} }],
      usage: { input: 1, output: 1, cached: 0 }
    })
    .mockResolvedValueOnce(reply("The card is there now."));
  const chat = newChat();
  const items: TranscriptItem[] = [];
  await askProvider(chat, "Declare war", item => items.push(item), new AbortController().signal, {
    tools: [tool],
    context: async () => "map"
  });
  expect(items.map(item => item.kind)).toEqual(["question", "answer", "proposal", "answer"]);
  expect(JSON.stringify(chat.messages[2])).toContain("no propose_change call succeeded");
});

it("does not ask for a proposal the answer says it did not make", async () => {
  const tool = {
    status: "Preparing a change",
    definition: { name: "propose_change", description: "Propose", input_schema: {} },
    handle: vi.fn()
  };
  completeMock.mockResolvedValueOnce({
    content: [{ type: "text", text: "It is already a vassal, so I've proposed nothing." }],
    usage: { input: 1, output: 1, cached: 0 }
  });
  await askProvider(newChat(), "Make it a vassal", () => {}, new AbortController().signal, {
    tools: [tool],
    context: async () => "map"
  });
  expect(completeMock).toHaveBeenCalledTimes(1);
});

it("keeps this question's tool results whole until they outgrow the budget", async () => {
  const read = (id: string) => ({ type: "tool_use", id, name: "big", input: {} });
  completeMock
    .mockResolvedValueOnce({ content: [read("a")], usage: { input: 1, output: 1, cached: 0 } })
    .mockResolvedValueOnce({ content: [read("b")], usage: { input: 1, output: 1, cached: 0 } })
    .mockResolvedValueOnce({ content: [read("c")], usage: { input: 1, output: 1, cached: 0 } })
    .mockResolvedValueOnce({ content: [{ type: "text", text: "Done" }], usage: { input: 1, output: 1, cached: 0 } });
  const chat = newChat();
  const big = {
    status: "Reading",
    definition: { name: "big", description: "", input_schema: {} },
    handle: async () => ({ content: "x".repeat(15_000) })
  };
  await askProvider(chat, "Read", () => {}, new AbortController().signal, { tools: [big], context: async () => "map" });
  const results = chat.messages.flatMap(message => message.content).filter(block => block.type === "tool_result");
  expect(results.map(result => (result.content as string).length)).toEqual([31, 15_000, 15_000]);
});

it("keeps every result of the latest step whole, however large", async () => {
  const call = (id: string) => ({ type: "tool_use", id, name: "big", input: {} });
  completeMock
    .mockResolvedValueOnce({ content: [call("a"), call("b")], usage: { input: 1, output: 1, cached: 0 } })
    .mockResolvedValueOnce({ content: [{ type: "text", text: "Done" }], usage: { input: 1, output: 1, cached: 0 } });
  const chat = newChat();
  const big = {
    status: "Reading",
    definition: { name: "big", description: "", input_schema: {} },
    handle: async () => ({ content: "x".repeat(40_000) })
  };
  await askProvider(chat, "Read", () => {}, new AbortController().signal, { tools: [big], context: async () => "map" });
  const results = chat.messages.flatMap(message => message.content).filter(block => block.type === "tool_result");
  expect(results.map(result => (result.content as string).length)).toEqual([40_000, 40_000]);
});

it("counts an image by its billed size, so it outlives the reads after it", async () => {
  const look = { type: "tool_use", id: "l", name: "look", input: {} };
  const read = { type: "tool_use", id: "r", name: "big", input: {} };
  completeMock
    .mockResolvedValueOnce({ content: [look], usage: { input: 1, output: 1, cached: 0 } })
    .mockResolvedValueOnce({ content: [read], usage: { input: 1, output: 1, cached: 0 } })
    .mockResolvedValueOnce({ content: [{ type: "text", text: "Done" }], usage: { input: 1, output: 1, cached: 0 } });
  const emblem = {
    ...imageTool,
    handle: async () => ({
      content: [
        {
          type: "image" as const,
          source: { type: "base64" as const, media_type: "image/png" as const, data: "A".repeat(54_000) }
        }
      ]
    })
  };
  const big = {
    status: "Reading",
    definition: { name: "big", description: "", input_schema: {} },
    handle: async () => ({ content: "x".repeat(20_000) })
  };
  const chat = newChat();
  await askProvider(chat, "Look", () => {}, new AbortController().signal, {
    tools: [emblem, big],
    context: async () => "map"
  });
  const [image] = chat.messages.flatMap(message => message.content).filter(block => block.type === "tool_result");
  expect(image.content).not.toBe("[Earlier tool result shortened]");
});

it("shows text beside a lookup or a failed call only when no answer follows it", async () => {
  const read = { type: "tool_use", id: "r", name: "read_map", input: {} };
  const broken = { type: "tool_use", id: "b", name: "show_card", input: {} };
  const reply = (text: string, ...calls: unknown[]) => ({
    content: [...(text ? [{ type: "text", text }] : []), ...calls],
    usage: { input: 1, output: 1, cached: 0 }
  });
  const readMap = {
    status: "Reading",
    definition: { name: "read_map", description: "", input_schema: {} },
    handle: async () => ({ content: "42" })
  };
  const answers = async (...replies: ReturnType<typeof reply>[]) => {
    completeMock.mockReset();
    for (const next of replies) completeMock.mockResolvedValueOnce(next);
    const items: TranscriptItem[] = [];
    await askProvider(newChat(), "How many?", item => items.push(item), new AbortController().signal, {
      tools: [readMap],
      context: async () => "map"
    });
    return items.flatMap(item => (item.kind === "answer" ? [item.text] : []));
  };
  expect(await answers(reply("Let me check.", read), reply("42."))).toEqual(["42."]);
  expect(await answers(reply("It is 42.", read), reply(""))).toEqual(["It is 42."]);
  expect(await answers(reply("Here it is:", broken), reply("It is 42."))).toEqual(["It is 42."]);
});

it("sends a changed map context with the newest message and leaves the question untouched", async () => {
  completeMock
    .mockResolvedValueOnce({ content: [LOOK], usage: { input: 1, output: 1, cached: 0 } })
    .mockResolvedValueOnce({ content: [LOOK], usage: { input: 1, output: 1, cached: 0 } })
    .mockResolvedValueOnce({ content: [{ type: "text", text: "Done." }], usage: { input: 1, output: 1, cached: 0 } });
  const contexts = ["markers: 1", "markers: 1", "markers: 2"];
  const chat = newChat();
  await askProvider(chat, "Place one", () => {}, new AbortController().signal, {
    tools: [imageTool],
    context: async () => contexts.shift()!
  });
  const texts = chat.messages.map(message =>
    message.content.flatMap(block => (block.type === "text" ? [block.text] : []))
  );
  expect(texts[0]).toEqual(["markers: 1", "Place one"]);
  expect(texts[2]).toEqual([]);
  expect(texts[4]).toEqual(["markers: 2"]);
});

it("answers a call with broken arguments with their error, without running the tool", async () => {
  completeMock
    .mockResolvedValueOnce({
      content: [{ type: "tool_use", id: "x", name: "look", input: { invalidArguments: "Not valid JSON" } }],
      usage: { input: 1, output: 1, cached: 0 }
    })
    .mockResolvedValueOnce({ content: [{ type: "text", text: "Done." }], usage: { input: 1, output: 1, cached: 0 } });
  const handle = vi.fn(imageTool.handle);
  const chat = newChat();
  await askProvider(chat, "Look", () => {}, new AbortController().signal, {
    tools: [{ ...imageTool, handle }],
    context: async () => "map"
  });
  expect(handle).not.toHaveBeenCalled();
  expect(chat.messages[2].content[0]).toMatchObject({ content: "Not valid JSON", is_error: true });
});
