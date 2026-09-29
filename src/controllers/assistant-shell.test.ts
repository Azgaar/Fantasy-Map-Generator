// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const panel = vi.hoisted(() => ({ mountMapPanel: vi.fn(), refreshMapContext: vi.fn(), unmountMapPanel: vi.fn() }));
vi.mock("./assistant-map", () => panel);

import { Assistant } from "./assistant";

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
const selectedMode = (): string | null =>
  document.querySelector('#assistant .assistantMode[aria-selected="true"]')?.getAttribute("data-mode") ?? null;

describe("Assistant shell", () => {
  it("opens on the Help panel by default", () => {
    Assistant.open();
    expect(document.getElementById("assistant")).not.toBeNull();
    expect(visible("assistantHelp")).toBe(true);
    expect(visible("assistantMap")).toBe(false);
    expect(selectedMode()).toBe("help");
    expect(panel.mountMapPanel).not.toHaveBeenCalled();
  });

  it("opens on This map when asked and mounts the panel once", () => {
    Assistant.open({ mode: "map" });
    expect(visible("assistantMap")).toBe(true);
    expect(visible("assistantHelp")).toBe(false);
    expect(selectedMode()).toBe("map");
    expect(panel.mountMapPanel).toHaveBeenCalledTimes(1);
    expect(panel.mountMapPanel.mock.calls[0][0]).toBe(document.getElementById("assistantMap"));

    Assistant.open({ mode: "map" });
    expect(panel.mountMapPanel).toHaveBeenCalledTimes(1);
    expect(panel.refreshMapContext).toHaveBeenCalledTimes(2);
  });

  it("switches modes on a mounted dialog without rebuilding it", () => {
    Assistant.open();
    const question = document.getElementById("assistantQuestion") as HTMLTextAreaElement;
    question.value = "half typed";
    Assistant.open({ mode: "map" });
    expect(visible("assistantMap")).toBe(true);
    expect((document.getElementById("assistantQuestion") as HTMLTextAreaElement).value).toBe("half typed");
    expect(document.getElementById("assistantQuestion")).toBe(question);
  });

  it("switches with the mode buttons", () => {
    Assistant.open();
    (document.querySelector('.assistantMode[data-mode="map"]') as HTMLButtonElement).click();
    expect(selectedMode()).toBe("map");
    expect(visible("assistantMap")).toBe(true);
    (document.querySelector('.assistantMode[data-mode="help"]') as HTMLButtonElement).click();
    expect(selectedMode()).toBe("help");
    expect(visible("assistantHelp")).toBe(true);
  });
});
