// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const panel = vi.hoisted(() => ({
  mountMapPanel: vi.fn(),
  refreshMapContext: vi.fn(),
  unmountMapPanel: vi.fn(),
  newMapConversation: vi.fn()
}));
vi.mock("./help-assistant-map", () => panel);

import { HelpAssistant } from "./help-assistant";

const limits = { tier: "anonymous", remaining: 5, resetsAt: "2026-09-06T00:00:00.000Z" };

beforeEach(() => {
  document.body.innerHTML = `<div id="dialogs"></div>`;
  window.$ = vi.fn(() => ({ dialog: vi.fn() })) as unknown as typeof window.$;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(limits), { status: 200 }))
  );
  panel.mountMapPanel.mockClear();
  panel.refreshMapContext.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const visible = (id: string): boolean => !(document.getElementById(id) as HTMLElement).hidden;
describe("HelpAssistant shell", () => {
  it("opens the unified panel by default without mode buttons", () => {
    HelpAssistant.open();
    expect(document.getElementById("helpAssistant")).not.toBeNull();
    expect(visible("helpAssistantHelp")).toBe(false);
    expect(visible("helpAssistantMap")).toBe(true);
    expect(document.querySelector(".helpAssistantMode")).toBeNull();
    expect(panel.mountMapPanel).toHaveBeenCalledOnce();
  });

  it("opens on This map when asked and mounts the panel once", () => {
    HelpAssistant.open({ mode: "map" });
    expect(visible("helpAssistantMap")).toBe(true);
    expect(visible("helpAssistantHelp")).toBe(false);
    expect(document.querySelector(".helpAssistantMode")).toBeNull();
    expect(panel.mountMapPanel).toHaveBeenCalledTimes(1);
    expect(panel.mountMapPanel.mock.calls[0][0]).toBe(document.getElementById("helpAssistantMap"));

    HelpAssistant.open({ mode: "map" });
    expect(panel.mountMapPanel).toHaveBeenCalledTimes(1);
    expect(panel.refreshMapContext).toHaveBeenCalledTimes(2);
  });

  it("switches modes on a mounted dialog without rebuilding it", () => {
    HelpAssistant.open();
    const question = document.getElementById("helpAssistantQuestion") as HTMLTextAreaElement;
    question.value = "half typed";
    HelpAssistant.open({ mode: "map" });
    expect(visible("helpAssistantMap")).toBe(true);
    expect((document.getElementById("helpAssistantQuestion") as HTMLTextAreaElement).value).toBe("half typed");
    expect(document.getElementById("helpAssistantQuestion")).toBe(question);
  });

  it("routes legacy help entry points to the same conversation", () => {
    HelpAssistant.open({ mode: "map" });
    HelpAssistant.open({ mode: "help" });
    expect(panel.mountMapPanel).toHaveBeenCalledOnce();
    expect(visible("helpAssistantMap")).toBe(true);
  });
});
