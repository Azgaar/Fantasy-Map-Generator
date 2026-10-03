// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  mapId: 1,
  send: vi.fn(),
  note: null as string | null,
  close: undefined as (() => void) | undefined
}));
vi.mock("@/components/map-commands", () => ({ MAP_COMMANDS: [], isLinkable: () => false })); // its import touches the DOM
vi.mock("./map", () => ({
  AssistantMap: {
    id: () => state.mapId,
    name: () => "Test map",
    context: async () => "# Current map",
    tools: () => []
  }
}));
const proposals = vi.hoisted(() => ({
  ready: vi.fn(() => true),
  run: vi.fn(() => true),
  discard: vi.fn(),
  propose: vi.fn()
}));
vi.mock("./proposals", () => ({ Proposals: proposals }));
vi.mock("@/controllers", () => ({
  Controllers: {
    NotesEditor: { current: async () => (state.note ? { id: "burg:1", name: state.note, legend: "" } : null) }
  }
}));
vi.mock("@/services/assistant/azgaar-server/answerer", () => ({ askServer: state.send }));

import { Assistant } from "./index";

beforeEach(() => {
  state.mapId++;
  state.note = null;
  state.close = undefined;
  localStorage.clear();
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
  const ask = document.getElementById("assistantAsk");
  if (ask?.classList.contains("busy")) ask.click(); // closing no longer stops an answer
  await new Promise(resolve => setTimeout(resolve, 0));
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

it("opens one Assistant panel with one composer and no mode tabs", async () => {
  Assistant.open();
  await vi.waitFor(() => expect(document.getElementById("assistantTranscript")?.textContent).toContain("Hi!"));
  expect(document.querySelectorAll("#assistantQuestion")).toHaveLength(1);
  expect(document.querySelector(".assistantMode")).toBeNull();
  await vi.waitFor(() =>
    expect(document.getElementById("assistantStatus")?.textContent).toBe("5 questions left today")
  );
  const input = document.getElementById("assistantQuestion") as HTMLTextAreaElement;
  for (const blank of ["  \n ", "a".repeat(2001)]) {
    input.value = blank;
    document.getElementById("assistantAsk")!.click();
  }
  expect(state.send).not.toHaveBeenCalled();
  input.value = "partly typed";
  Assistant.open();
  expect(document.getElementById("assistantQuestion")).toBe(input);
  expect(input.value).toBe("partly typed");
});

it("starts a Member chat after signing in and keeps the Guest chat", async () => {
  const chats = await import("@/services/assistant/chats");
  await chats.load();
  const guest = chats.create("guest", state.mapId, "Test map");
  localStorage.setItem("fmg-help-token", "signed-in-token");

  Assistant.open();
  await vi.waitFor(() => expect(chats.current()?.tier).toBe("member"));
  expect(chats.current()?.id).not.toBe(guest.id);
  expect(chats.list()).toContain(guest);
});

it("starts a Guest chat if Member sign-in expires during an answer", async () => {
  const chats = await import("@/services/assistant/chats");
  localStorage.setItem("fmg-help-token", "signed-in-token");
  Assistant.open();
  await vi.waitFor(() => expect(chats.current()?.tier).toBe("member"));
  const member = chats.current()!;
  state.send.mockImplementation(async (_chat, _question, onItem) => {
    onItem({ kind: "answer", text: "The session expired" });
    localStorage.removeItem("fmg-help-token");
  });

  (document.getElementById("assistantQuestion") as HTMLTextAreaElement).value = "Tell me about this map";
  document.getElementById("assistantAsk")!.click();
  await vi.waitFor(() => expect(chats.current()?.tier).toBe("guest"));
  expect(chats.current()?.id).not.toBe(member.id);
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
  expect(document.getElementById("assistantTranscript")?.textContent).toContain("I can write the note “Orwin”");
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

it("keeps the panel, its draft and a running answer when closed", async () => {
  let finish: (() => void) | undefined;
  state.send.mockImplementation(
    (_chat, question, onItem) =>
      new Promise<void>(resolve => {
        onItem({ kind: "question", text: question });
        finish = () => {
          onItem({ kind: "step", code: "return 1" });
          resolve();
        };
      })
  );
  Assistant.open();
  await vi.waitFor(() => expect(document.getElementById("assistantTranscript")?.textContent).toContain("Hi!"));
  const input = document.getElementById("assistantQuestion") as HTMLTextAreaElement;
  input.value = "Read";
  document.getElementById("assistantAsk")!.click();
  const close = state.close;
  close?.();
  input.value = "draft";
  finish?.();
  await vi.waitFor(() => expect(document.getElementById("assistantAsk")?.classList.contains("busy")).toBe(false));
  Assistant.open();
  expect(state.close).toBe(close); // reopened, not rebuilt
  expect(document.getElementById("assistantQuestion")).toBe(input);
  expect(input.value).toBe("draft");
  expect(document.getElementById("assistantTranscript")?.textContent).toContain("Read");
  expect(document.querySelectorAll("#assistant")).toHaveLength(1);
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
  expect(proposals.run).toHaveBeenCalledWith("apply", pending, state.mapId);
  button("Discard").click();
  expect(proposals.discard).toHaveBeenCalledWith(pending);
  proposals.ready.mockReturnValueOnce(false);
  document.getElementById("assistantOpenChats")!.click();
  document.getElementById("assistantOpenChats")!.click();
  expect(button("Changed since").disabled).toBe(true);
  pending.state = "undone";
  document.getElementById("assistantOpenChats")!.click();
  document.getElementById("assistantOpenChats")!.click();
  button("Redo").click();
  expect(proposals.run).toHaveBeenCalledWith("redo", pending, state.mapId);
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
    {
      key: "zone:2",
      entity: "Zone Plague",
      field: "",
      before: undefined,
      after: { i: 2, name: "Plague", note: "<p>Spreads by river</p>" }
    },
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
  expect(rows).toEqual(["Burg VelRemove", "Zone PlagueAdd Spreads by river", "Cells State 2 cells"]);
  expect([...card.querySelectorAll(".assistantChangeTag")].map(tag => tag.className)).toEqual([
    "assistantChangeTag remove",
    "assistantChangeTag add"
  ]);
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
    expect(state.send).toHaveBeenCalledWith(active, "Tell me more", expect.any(Function), expect.any(AbortSignal))
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
  const retry = document.getElementById("assistantRetry")!;
  await vi.waitFor(() => expect(retry.hidden).toBe(false));
  retry.click();
  await vi.waitFor(() => expect(state.send).toHaveBeenCalledTimes(2));
  expect(state.send.mock.calls[1][1]).toBe("Where is Vel?");
  expect(active.items.map(item => item.kind)).toEqual(["question"]);
});

/** An answer with a rating id in the open chat, drawn with its rating buttons */
async function ratedAnswer(rating?: "up" | "down") {
  const chats = await import("@/services/assistant/chats");
  Assistant.open();
  await vi.waitFor(() => expect(document.getElementById("assistantTranscript")?.textContent).toContain("Hi!"));
  const item = { kind: "answer" as const, text: "Use the Rivers Editor", ratingId: 41, rating };
  chats.append(chats.current()!, item);
  document.getElementById("assistantOpenChats")!.click();
  document.getElementById("assistantOpenChats")!.click();
  return item;
}

const rate = (label: "Good answer" | "Bad answer") =>
  document.querySelector<HTMLButtonElement>(`#assistantTranscript [aria-label="${label}"]`)!.click();

it("selects a rating at once, posts it and moves it when the user switches", async () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  const item = await ratedAnswer();
  vi.stubGlobal("fetch", fetchMock);
  rate("Good answer");
  expect(item.rating).toBe("up");
  expect(document.querySelector('[aria-label="Good answer"]')?.getAttribute("aria-pressed")).toBe("true");
  expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({
    requestId: 41,
    rating: "up"
  });
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  rate("Bad answer");
  expect(item.rating).toBe("down");
});

it("restores the previous rating when the post fails", async () => {
  const item = await ratedAnswer("down");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("down")));
  rate("Good answer");
  await vi.waitFor(() => expect(item.rating).toBe("down"));
});

it("refreshes limits after an unauthorized rating", async () => {
  const item = await ratedAnswer();
  const fetchMock = vi.fn(async (url: string) =>
    String(url).includes("/v1/feedback")
      ? new Response(JSON.stringify({ error: { code: "unauthorized", message: "Session expired." } }), { status: 401 })
      : new Response(JSON.stringify({ tier: "anonymous", remaining: 3, resetsAt: "" }), { status: 200 })
  );
  vi.stubGlobal("fetch", fetchMock);
  rate("Good answer");
  await vi.waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/v1/limits"))).toBe(true));
  expect(item.rating).toBeUndefined();
});
