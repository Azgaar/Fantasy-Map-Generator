// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ open: vi.fn(), save: vi.fn(), getLayer: vi.fn(), edit: vi.fn(), zoom: vi.fn() }));
vi.mock("@/app/chrome/options-panel", () => ({ hideOptions: vi.fn(), toggleOptions: vi.fn() }));
vi.mock("@/controllers", () => ({
  Controllers: {
    Omnibar: { open: mocks.open },
    StatesEditor: { open: mocks.edit },
    MarkerCreator: { toggle: mocks.edit }
  }
}));
vi.mock("@/services", () => ({ Services: { Save: { toMachine: mocks.save } } }));
vi.mock("@/services/autosave", () => ({ toggleSaveReminder: vi.fn() }));
vi.mock("./chrome/app-info", () => ({ showInfo: vi.fn() }));
vi.mock("@/ui/dialog/dialog-helpers", () => ({ closeDialogs: vi.fn() }));
vi.mock("./chrome/tabs/layers-tab", () => ({ getLayerByShortcut: mocks.getLayer }));
vi.mock("@/ui/map/zoom", () => ({
  changeMapZoom: vi.fn(),
  panMap: vi.fn(),
  resetZoom: vi.fn(),
  setMapZoom: mocks.zoom
}));
vi.mock("./lifecycle", () => ({ regeneratePrompt: vi.fn() }));

import "./hotkeys";

function press(
  target: Element,
  code: string,
  key = code,
  modifiers: KeyboardEventInit = {}
): { keydown: KeyboardEvent; keyup: KeyboardEvent } {
  const init = { code, key, bubbles: true, cancelable: true, ...modifiers };
  const keydown = new KeyboardEvent("keydown", init);
  const keyup = new KeyboardEvent("keyup", init);
  target.dispatchEvent(keydown);
  target.dispatchEvent(keyup);
  return { keydown, keyup };
}

beforeEach(() => {
  document.body.innerHTML = '<button id="regenerateRivers">Regenerate</button><input id="field" />';
  mocks.open.mockClear();
  mocks.save.mockClear();
  mocks.getLayer.mockClear();
  mocks.edit.mockClear();
  mocks.zoom.mockClear();
  globalThis.options = { map: {} } as typeof options;
});

describe("save shortcut", () => {
  it.each(["ctrlKey", "metaKey"])("saves on %s + S keydown and suppresses the browser save", modifier => {
    const init = { code: "KeyS", key: "s", bubbles: true, cancelable: true, [modifier]: true };
    const keydown = new KeyboardEvent("keydown", init);
    document.body.dispatchEvent(keydown);
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(mocks.save).toHaveBeenCalledWith(false);
    expect(keydown.defaultPrevented).toBe(true);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { ...init, repeat: true }));
    document.body.dispatchEvent(new KeyboardEvent("keyup", init));
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(mocks.getLayer).not.toHaveBeenCalled();
  });

  it.each(["ctrlKey", "metaKey"])("overwrites the saved file for %s + Shift + S", modifier => {
    press(document.body, "KeyS", "S", { [modifier]: true, shiftKey: true });
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith(true);
    expect(mocks.getLayer).not.toHaveBeenCalled();
  });

  it("leaves typing in a text field alone", () => {
    const field = document.getElementById("field")!;
    field.focus();
    press(field, "KeyS", "s", { ctrlKey: true });
    expect(mocks.save).not.toHaveBeenCalled();
  });
});

describe("Space opens the search", () => {
  it("from the plain map", () => {
    press(document.body, "Space", " ");
    expect(mocks.open).toHaveBeenCalledTimes(1);
  });

  it("leaves the Space to a focused button, whose activation it is", () => {
    const button = document.getElementById("regenerateRivers")!;
    button.focus();
    const { keydown, keyup } = press(button, "Space", " ");
    expect(keydown.defaultPrevented).toBe(false);
    expect(keyup.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(button);
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it.each(["ctrlKey", "metaKey", "altKey", "shiftKey"])("ignores Space held with %s", modifier => {
    press(document.body, "Space", " ", { [modifier]: true });
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("leaves a text field alone", () => {
    const field = document.getElementById("field")!;
    field.focus();
    const { keydown } = press(field, "Space", " ");
    expect(keydown.defaultPrevented).toBe(false);
    expect(mocks.open).not.toHaveBeenCalled();
  });
});

describe("a view-only map", () => {
  beforeEach(() => (options.map.viewOnly = true));

  it("ignores editor hotkeys", () => {
    press(document.body, "KeyS", "S", { shiftKey: true });
    expect(mocks.edit).not.toHaveBeenCalled();
  });

  it("ignores creator hotkeys on layouts where they need no Shift", () => {
    press(document.body, "Backslash", "#"); // German QWERTZ
    expect(mocks.edit).not.toHaveBeenCalled();
  });

  it("keeps the browsing keys", () => {
    press(document.body, "Space", " ");
    press(document.body, "Digit3", "3");
    expect(mocks.open).toHaveBeenCalledOnce();
    expect(mocks.zoom).toHaveBeenCalledExactlyOnceWith(3);
  });
});
