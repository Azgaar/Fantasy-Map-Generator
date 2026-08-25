import { afterEach, describe, expect, test, vi } from "vitest";
import {
  getWorkspaceMode,
  hasWorkspaceCapability,
  initializeWorkspaceMode,
  registerWorkspaceModeTransitionHandler,
  requireWorkspaceCapability,
  resetWorkspaceModeForTests,
  setWorkspaceMode,
  subscribeToWorkspaceMode
} from "./workspace-mode";

afterEach(() => resetWorkspaceModeForTests());

describe("workspace mode", () => {
  test("defaults to View mode with inspect-only capabilities", () => {
    expect(getWorkspaceMode()).toBe("view");
    expect(hasWorkspaceCapability("map:inspect")).toBe(true);
    expect(hasWorkspaceCapability("map:edit")).toBe(false);
    expect(hasWorkspaceCapability("map:generate")).toBe(false);
  });

  test("updates the application root and notifies subscribers on a mode change", async () => {
    const root = {
      removeAttribute: vi.fn(),
      setAttribute: vi.fn()
    } as unknown as HTMLElement;
    const listener = vi.fn();
    initializeWorkspaceMode({ root });
    const unsubscribe = subscribeToWorkspaceMode(listener);

    await expect(setWorkspaceMode("edit")).resolves.toBe(true);

    expect(root.setAttribute).toHaveBeenLastCalledWith("data-workspace-mode", "edit");
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith("edit");

    unsubscribe();
    await setWorkspaceMode("view");
    expect(listener).toHaveBeenCalledOnce();
  });

  test("does not notify subscribers when the requested mode is already active", async () => {
    const listener = vi.fn();
    subscribeToWorkspaceMode(listener);

    await expect(setWorkspaceMode("view")).resolves.toBe(true);

    expect(listener).not.toHaveBeenCalled();
  });

  test("denies document mutation capabilities in View mode with concise feedback", async () => {
    const onCapabilityDenied = vi.fn();
    initializeWorkspaceMode({ onCapabilityDenied });

    expect(hasWorkspaceCapability("map:inspect")).toBe(true);
    expect(hasWorkspaceCapability("map:edit")).toBe(false);
    expect(hasWorkspaceCapability("map:generate")).toBe(false);
    expect(requireWorkspaceCapability("map:edit")).toBe(false);
    expect(onCapabilityDenied).toHaveBeenCalledWith("Switch to Edit mode to change this map");
  });

  test("does not change mode when a transition handler rejects it", async () => {
    const handler = vi.fn(() => false);
    registerWorkspaceModeTransitionHandler(handler);

    await expect(setWorkspaceMode("edit")).resolves.toBe(false);

    expect(handler).toHaveBeenCalledWith("edit", "view");
    expect(getWorkspaceMode()).toBe("view");
  });
});
