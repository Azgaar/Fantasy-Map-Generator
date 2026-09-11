// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("@/components/options/options-panel", () => ({ hideOptions: vi.fn() }));
vi.mock("@/controllers", () => ({ Controllers: { Omnibar: { open: mocks.open } } }));
vi.mock("@/services", () => ({ Services: {} }));
vi.mock("@/services/autosave", () => ({ toggleSaveReminder: vi.fn() }));
vi.mock("./app-info", () => ({ showInfo: vi.fn() }));
vi.mock("./dialog/dialog-helpers", () => ({ closeDialogs: vi.fn() }));
vi.mock("./options/tabs/layers-tab", () => ({ getLayerByShortcut: () => undefined }));
vi.mock("./zoom", () => ({ changeMapZoom: vi.fn(), panMap: vi.fn(), setMapZoom: vi.fn() }));

import "./hotkeys";

function press(target: Element, code: string, key = code): { keydown: KeyboardEvent; keyup: KeyboardEvent } {
  const init = { code, key, bubbles: true, cancelable: true };
  const keydown = new KeyboardEvent("keydown", init);
  const keyup = new KeyboardEvent("keyup", init);
  target.dispatchEvent(keydown);
  target.dispatchEvent(keyup);
  return { keydown, keyup };
}

beforeEach(() => {
  document.body.innerHTML = '<button id="regenerateRivers">Regenerate</button><input id="field" />';
  mocks.open.mockClear();
});

describe("Space opens the search", () => {
  it("from the plain map", () => {
    press(document.body, "Space", " ");
    expect(mocks.open).toHaveBeenCalledTimes(1);
  });

  it("takes the Space away from a button that still holds the focus, instead of re-firing it", () => {
    const button = document.getElementById("regenerateRivers")!;
    button.focus();
    const { keydown, keyup } = press(button, "Space", " ");
    expect(keydown.defaultPrevented).toBe(true); // the native activation is the keyup's default
    expect(keyup.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(document.body);
    expect(mocks.open).toHaveBeenCalledTimes(1);
  });

  it("leaves a text field alone", () => {
    const field = document.getElementById("field")!;
    field.focus();
    const { keydown } = press(field, "Space", " ");
    expect(keydown.defaultPrevented).toBe(false);
    expect(mocks.open).not.toHaveBeenCalled();
  });
});
