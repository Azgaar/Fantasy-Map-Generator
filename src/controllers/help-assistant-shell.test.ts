// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const bar = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn() }));
vi.mock("@/controllers", () => ({ Controllers: { Omnibar: bar } }));

import { HelpAssistant } from "./help-assistant";

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("assistant entry points", () => {
  it.each([undefined, "map", "help"] as const)("opens the omnibar for legacy mode %s", async mode => {
    await HelpAssistant.open({ mode });
    expect(bar.open).toHaveBeenCalledWith({ assistant: true });
    expect(document.querySelector(".ui-dialog")).toBeNull();
  });

  it("closes a visible assistant and reopens a collapsed one from the bubble", async () => {
    document.body.innerHTML = '<div id="omnibar"><section id="helpAssistant"></section></div>';
    await HelpAssistant.toggle();
    expect(bar.close).toHaveBeenCalledOnce();
    document.getElementById("omnibar")!.hidden = true;
    await HelpAssistant.toggle();
    expect(bar.open).toHaveBeenCalledWith({ assistant: true });
  });
});
