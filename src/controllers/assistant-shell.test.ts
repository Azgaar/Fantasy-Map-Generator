// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  mapId: 1,
  send: vi.fn(),
  note: null as string | null,
  close: undefined as (() => void) | undefined
}));
vi.mock("@/components/map-commands", () => ({ MAP_COMMANDS: [], isLinkable: () => false })); // its import touches the DOM
vi.mock("./assistant-map", () => ({
  AssistantMap: {
    id: () => state.mapId,
    name: () => "Test map",
    context: async () => "# Current map",
    tools: () => []
  }
}));
const proposals = vi.hoisted(() => ({
  canApply: vi.fn(() => true),
  canUndo: vi.fn(() => true),
  apply: vi.fn(() => true),
  undo: vi.fn(() => true),
  discard: vi.fn(),
  propose: vi.fn()
}));
vi.mock("./assistant-proposals", () => ({ Proposals: proposals }));
vi.mock("@/controllers", () => ({
  Controllers: {
    NotesEditor: { current: async () => (state.note ? { id: "burg:1", name: state.note, legend: "" } : null) }
  }
}));
vi.mock("@/services/assistant/azgaar-server/answerer", () => ({
  createAzgaarServerAnswerer: () => ({ status: () => "Guest", send: state.send })
}));

import { Assistant } from "./assistant";

beforeEach(() => {
  state.mapId++;
  state.note = null;
  state.close = undefined;
  localStorage.clear();
  localStorage.setItem("fmg-assistant-last-map", "0");
  state.send.mockReset();
  state.send.mockImplementation(
    (
      _chat: unknown,
      question: string,
      onItem: (item: { kind: "question"; text: string }) => void,
      signal: AbortSignal
    ) => {
      onItem({ kind: "question", text: question });
      return new Promise<void>((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new DOMException("Stopped", "AbortError")), { once: true })
      );
    }
  );
  document.body.innerHTML = '<div id="dialogs"></div>';
  localStorage.setItem("fmg-help-gateway", "http://localhost:9876");
  vi.stubGlobal("ldb", { get: vi.fn(async () => []), set: vi.fn(async () => {}) });
  window.$ = vi.fn(() => ({
    dialog: (options: string | { close?: () => void }) => {
      if (typeof options === "string") return;
      state.close = options.close;
      const panel = document.getElementById("assistant")!;
      const wrapper = document.createElement("div");
      wrapper.className = "ui-dialog";
      wrapper.innerHTML = '<div class="ui-dialog-titlebar"></div>';
      panel.replaceWith(wrapper);
      wrapper.append(panel);
    }
  })) as unknown as typeof window.$;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ tier: "anonymous", remaining: 5, resetsAt: "" }), { status: 200 }))
  );
});

afterEach(async () => {
  state.close?.();
  await new Promise(resolve => setTimeout(resolve, 0));
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

it("opens one Assistant panel with one composer and no mode tabs", async () => {
  Assistant.open();
  await vi.waitFor(() => expect(document.getElementById("assistantTranscript")?.textContent).toContain("Hi!"));
  expect(document.querySelectorAll("#assistantQuestion")).toHaveLength(1);
  expect(document.querySelector(".assistantMode")).toBeNull();
  const input = document.getElementById("assistantQuestion") as HTMLTextAreaElement;
  input.value = "partly typed";
  Assistant.open();
  expect(document.getElementById("assistantQuestion")).toBe(input);
  expect(input.value).toBe("partly typed");
});

it("offers a key on a self-hosted origin and hides the composer", async () => {
  localStorage.removeItem("fmg-help-gateway");
  Assistant.open();
  await vi.waitFor(() =>
    expect(document.getElementById("assistantTranscript")?.textContent).toContain("official site")
  );
  expect((document.getElementById("assistantComposer") as HTMLElement).hidden).toBe(true);
  expect(document.getElementById("assistantAccount")?.textContent).toContain("Use key");
});

it("cancels an answer and starts a fresh chat when the map changes", async () => {
  Assistant.open();
  await vi.waitFor(() => expect(document.getElementById("assistantTranscript")?.textContent).toContain("Hi!"));
  const input = document.getElementById("assistantQuestion") as HTMLTextAreaElement;
  input.value = "Old map question";
  (document.getElementById("assistantAsk") as HTMLButtonElement).click();
  await vi.waitFor(() => expect(state.send).toHaveBeenCalled());
  state.mapId++;
  window.dispatchEvent(new Event("map:generated"));
  await vi.waitFor(() =>
    expect(document.getElementById("assistantTranscript")?.textContent).not.toContain("Old map question")
  );
  expect((state.send.mock.calls[0][3] as AbortSignal).aborted).toBe(true);
  expect(document.getElementById("assistantTranscript")?.textContent).toContain("Hi!");
});

const clickText = (text: string) => {
  const button = [...document.querySelectorAll<HTMLButtonElement>("#assistant button")].find(
    item => item.textContent === text
  );
  expect(button, text).toBeDefined();
  button!.click();
};

it("updates the note chip when the notes editor changes or closes", async () => {
  Assistant.open();
  await vi.waitFor(() => expect(document.getElementById("assistantTranscript")?.textContent).toContain("Hi!"));
  state.note = "Orwin";
  window.dispatchEvent(new Event("notes:context-changed"));
  await vi.waitFor(() => expect(document.getElementById("assistantContext")?.textContent).toBe("Note: Orwin"));
  state.note = null;
  window.dispatchEvent(new Event("notes:context-changed"));
  await vi.waitFor(() => expect(document.getElementById("assistantContext")?.hidden).toBe(true));
});

it("offers New chat after deleting the selected chat instead of a dead composer", async () => {
  Assistant.open();
  await vi.waitFor(() => expect(document.getElementById("assistantTranscript")?.textContent).toContain("Hi!"));
  document.getElementById("assistantOpenChats")!.click();
  document.querySelector<HTMLButtonElement>(".assistantDelete")!.click();
  document.getElementById("assistantOpenChats")!.click();
  expect(document.getElementById("assistantComposer")?.hidden).toBe(true);
  clickText("New chat");
  expect(document.getElementById("assistantComposer")?.hidden).toBe(false);
});

it("keeps a selected read-only chat when reopening the panel or reloading the same map", async () => {
  const chats = await import("@/services/assistant/chats");
  Assistant.open();
  await vi.waitFor(() => expect(document.getElementById("assistantTranscript")?.textContent).toContain("Hi!"));
  const old = chats.create("guest", -1, "Old map");
  chats.append(old, { kind: "question", text: "Read-only history" });
  document.getElementById("assistantOpenChats")!.click();
  clickText("Read-only history");
  const count = chats.list().length;
  window.dispatchEvent(new Event("map:generated"));
  state.close?.();
  Assistant.open();
  await vi.waitFor(() =>
    expect(document.getElementById("assistantTranscript")?.textContent).toContain("Read-only history")
  );
  expect(document.getElementById("assistantComposer")?.hidden).toBe(true);
  expect(chats.list()).toHaveLength(count);
});

it("ignores late UI callbacks after the panel closes", async () => {
  let finish: (() => void) | undefined;
  state.send.mockImplementation(
    (_chat, _question, onItem, _signal, onStatus) =>
      new Promise<void>(resolve => {
        finish = () => {
          onStatus("Reading the map");
          onItem({ kind: "step", code: "return 1" });
          resolve();
        };
      })
  );
  Assistant.open();
  await vi.waitFor(() => expect(document.getElementById("assistantTranscript")?.textContent).toContain("Hi!"));
  (document.getElementById("assistantQuestion") as HTMLTextAreaElement).value = "Read";
  document.getElementById("assistantAsk")!.click();
  state.close?.();
  expect(() => finish?.()).not.toThrow();
});

function proposal(
  state: import("@/services/assistant/chats").Proposal["state"],
  rows: number
): import("@/services/assistant/chats").Proposal {
  const change = Array.from({ length: rows }, (_, i) => ({
    key: `burg:${i}`,
    entity: `Burg <${i}>`,
    field: "name",
    before: `<${i}>`,
    after: `New ${i}`
  }));
  return { number: 1, mapId: 1, summary: "Rename <burgs>", operations: [], change, state };
}

it("applies, undoes and discards proposals even in a read-only chat", async () => {
  const chats = await import("@/services/assistant/chats");
  Assistant.open();
  await vi.waitFor(() => expect(document.getElementById("assistantTranscript")?.textContent).toContain("Hi!"));
  const active = chats.current()!;
  const pending = proposal("proposed", 1);
  chats.append(active, { kind: "proposal", proposal: pending });
  state.mapId++;
  document.getElementById("assistantOpenChats")!.click();
  document.getElementById("assistantOpenChats")!.click();
  expect(document.getElementById("assistantComposer")?.hidden).toBe(true);
  const button = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>(".assistantProposal button")].find(
      item => item.textContent === label
    )!;
  button("Apply").click();
  expect(proposals.apply).toHaveBeenCalledWith(pending, state.mapId);
  button("Discard").click();
  expect(proposals.discard).toHaveBeenCalledWith(pending);
  proposals.canApply.mockReturnValueOnce(false);
  document.getElementById("assistantOpenChats")!.click();
  document.getElementById("assistantOpenChats")!.click();
  expect(button("Changed since").disabled).toBe(true);
});

it("renders every transcript item type and never renders user text as HTML", async () => {
  const chats = await import("@/services/assistant/chats");
  Assistant.open();
  await vi.waitFor(() => expect(document.getElementById("assistantTranscript")?.textContent).toContain("Hi!"));
  const active = chats.current()!;
  const items: import("@/services/assistant/chats").TranscriptItem[] = [
    { kind: "question", text: "<b>bold</b>" },
    { kind: "step", code: "return 1", result: { ok: true, value: "1", logs: [], ms: 38 } },
    { kind: "answer", text: "| A |\n|---|\n| 1 |", ratingId: 3 },
    { kind: "proposal", proposal: proposal("proposed", 10) },
    { kind: "proposal", proposal: proposal("applied", 1) },
    { kind: "divider" },
    { kind: "notice", text: "Earlier notice" }
  ];
  for (const item of items) chats.append(active, item);
  document.getElementById("assistantOpenChats")!.click();
  document.getElementById("assistantOpenChats")!.click();
  const log = document.getElementById("assistantTranscript")!;
  expect(log.querySelector(".assistantQuestion")?.innerHTML).toBe("&lt;b&gt;bold&lt;/b&gt;");
  expect(log.querySelector(".assistantStep summary")?.textContent).toBe("Read the map · 38 ms");
  expect(log.querySelector(".assistantAnswer table")).not.toBeNull();
  expect(log.querySelectorAll(".assistantFeedback button")).toHaveLength(2);
  const [proposed, applied] = log.querySelectorAll(".assistantProposal");
  expect(proposed.querySelector(".assistantProposalState")?.textContent).toBe("Proposed");
  expect(proposed.querySelector(".assistantProposalSummary")?.innerHTML).toBe("Rename &lt;burgs&gt;");
  expect(proposed.querySelectorAll(".assistantChangeField")).toHaveLength(8);
  expect(proposed.querySelector(".assistantChangeName")?.innerHTML).toBe("Burg &lt;0&gt;");
  expect(proposed.querySelector(".assistantChangeField del")?.innerHTML).toBe("&lt;0&gt;");
  expect(proposed.textContent).toContain("… 2 more changes");
  expect(proposed.textContent).toContain("10 changes · 10 entities");
  expect([...proposed.querySelectorAll("button")].map(button => button.textContent)).toEqual(["Discard", "Apply"]);
  expect(applied.querySelector("summary")?.textContent).toBe("Show 1 change");
  expect(applied.querySelector("button")?.textContent).toBe("Undo");
  expect(log.querySelector(".assistantDivider")).not.toBeNull();
  expect(log.querySelector(".assistantNoticeItem")?.textContent).toContain("Earlier notice");
});

it("shows an added or removed entity as one row and cell changes as a count", async () => {
  const chats = await import("@/services/assistant/chats");
  Assistant.open();
  await vi.waitFor(() => expect(document.getElementById("assistantTranscript")?.textContent).toContain("Hi!"));
  const change = [
    { key: "burg:3", entity: "Burg Vel", field: "removed", before: undefined, after: true },
    { key: "burg:3", entity: "Burg Vel", field: "coa", before: { t1: "or" }, after: undefined },
    { key: "zone:2", entity: "Zone Plague", field: "", before: undefined, after: { i: 2, name: "Plague" } },
    { key: "cells", entity: "Cells", field: "state", before: { 1: 2, 5: 2 }, after: { 1: 3, 5: 3 } }
  ];
  const removal = { ...proposal("proposed", 0), change };
  chats.append(chats.current()!, { kind: "proposal", proposal: removal });
  document.getElementById("assistantOpenChats")!.click();
  document.getElementById("assistantOpenChats")!.click();
  const card = document.querySelector("#assistantTranscript .assistantProposal")!;
  const rows = [...card.querySelectorAll(".assistantChangeEntity")].map(entity =>
    entity.textContent!.replace(/\s+/g, " ").trim()
  );
  expect(rows).toEqual(["Burg Vel Removed", "Zone Plague Added", "Cells State 2 cells"]);
  expect(card.textContent).toContain("3 changes · 3 entities");
});

it("renders entity links in answers and an entities widget", async () => {
  vi.stubGlobal("pack", { burgs: [0, { i: 1, name: "Vel" }], states: [] });
  const chats = await import("@/services/assistant/chats");
  Assistant.open();
  await vi.waitFor(() => expect(document.getElementById("assistantTranscript")?.textContent).toContain("Hi!"));
  const active = chats.current()!;
  chats.append(active, { kind: "answer", text: "See [Vel](burg:1) and [Orn](burg:7)." });
  chats.append(active, { kind: "widget", widget: { type: "entities", title: "Ports", entities: ["burg:1"] } });
  document.getElementById("assistantOpenChats")!.click();
  document.getElementById("assistantOpenChats")!.click();
  const log = document.getElementById("assistantTranscript")!;
  expect(log.querySelector(".assistantAnswer")?.innerHTML).toContain('data-id="burg:1"');
  expect(log.querySelector(".assistantAnswer")?.textContent).toBe("See Vel and Orn.");
  expect(log.querySelector(".assistantWidget li")?.textContent).toBe("Vel");
  expect(log.querySelector('[data-action="mark"]')?.getAttribute("aria-pressed")).toBe("false");
});

it("turns a picked choice into a proposal, or into the next question", async () => {
  const chats = await import("@/services/assistant/chats");
  Assistant.open();
  await vi.waitFor(() => expect(document.getElementById("assistantTranscript")?.textContent).toContain("Hi!"));
  const active = chats.current()!;
  const operations = [{ op: "Burgs.rename", args: [1, "Saltmere"] }];
  const widget = {
    type: "choices" as const,
    title: "Rename",
    choices: [{ label: "Saltmere", operations }, { label: "Tell me more" }]
  };
  chats.append(active, { kind: "widget", widget });
  proposals.propose.mockReturnValueOnce({ ...proposal("proposed", 1), summary: "Saltmere" });
  document.getElementById("assistantOpenChats")!.click();
  document.getElementById("assistantOpenChats")!.click();
  const choice = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('[data-action="choose"]')].find(
      button => button.textContent === label
    )!;
  choice("Saltmere").click();
  expect(proposals.propose).toHaveBeenCalledWith("Saltmere", operations, 1, state.mapId);
  expect(active.items.at(-1)).toMatchObject({ kind: "proposal", proposal: { summary: "Saltmere" } });
  expect(choice("Tell me more").disabled).toBe(true);

  const second = { type: "choices" as const, title: "Next", choices: [{ label: "Tell me more" }, { label: "Stop" }] };
  chats.append(active, { kind: "widget", widget: second });
  document.getElementById("assistantOpenChats")!.click();
  document.getElementById("assistantOpenChats")!.click();
  [...document.querySelectorAll<HTMLButtonElement>('[data-action="choose"]')]
    .find(button => button.textContent === "Tell me more" && !button.disabled)!
    .click();
  await vi.waitFor(() =>
    expect(state.send).toHaveBeenCalledWith(
      active,
      "Tell me more",
      expect.any(Function),
      expect.any(AbortSignal),
      expect.any(Function)
    )
  );
  expect(second).toMatchObject({ picked: 0 });
});

it("retries a failed question without leaving the failure behind", async () => {
  const chats = await import("@/services/assistant/chats");
  Assistant.open();
  await vi.waitFor(() => expect(document.getElementById("assistantTranscript")?.textContent).toContain("Hi!"));
  const active = chats.current()!;
  state.send.mockImplementationOnce(async (_chat: unknown, question: string, onItem: (item: object) => void) => {
    onItem({ kind: "question", text: question });
    throw new Error("Invalid request");
  });
  const input = document.getElementById("assistantQuestion") as HTMLTextAreaElement;
  input.value = "Where is Vel?";
  document.getElementById("assistantAsk")!.click();
  const retry = document.getElementById("assistantResend")!;
  await vi.waitFor(() => expect(retry.hidden).toBe(false));
  retry.click();
  await vi.waitFor(() => expect(state.send).toHaveBeenCalledTimes(2));
  expect(state.send.mock.calls[1][1]).toBe("Where is Vel?");
  expect(active.items.map(item => item.kind)).toEqual(["question"]);
});
