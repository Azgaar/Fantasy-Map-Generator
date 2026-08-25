import { afterEach, describe, expect, test, vi } from "vitest";
import { closeDialogs, closeEditDialogs, destroyDialog, registerManagedDialog, updateDialog } from "./dialog-helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("managed dialogs", () => {
  test("close with closeDialogs while honoring stable and id exceptions", () => {
    const close = vi.fn();
    const unregister = registerManagedDialog("testDialog", close, true);

    closeDialogs(".stable");
    closeDialogs("#testDialog");
    expect(close).not.toHaveBeenCalled();

    closeDialogs();
    expect(close).toHaveBeenCalledOnce();
    unregister();
  });

  test("route update and destroy operations through the managed registry", () => {
    const close = vi.fn();
    const update = vi.fn();
    const unregister = registerManagedDialog("testDialog", close, false, update);

    updateDialog("testDialog", { title: "Updated title", width: "30em" });
    expect(update).toHaveBeenCalledWith({ title: "Updated title", width: "30em" });

    destroyDialog("testDialog");
    expect(close).toHaveBeenCalledOnce();
    unregister();
  });

  test("uses the guarded close path for bulk close operations", () => {
    const close = vi.fn();
    const requestClose = vi.fn();
    const unregister = registerManagedDialog("guardedDialog", close, false, undefined, requestClose);

    closeDialogs();

    expect(requestClose).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    unregister();
  });

  test("closes only edit dialogs during a View-mode transition", () => {
    const closeEditor = vi.fn();
    const closeInspector = vi.fn();
    const unregisterEditor = registerManagedDialog("editor", closeEditor);
    const unregisterInspector = registerManagedDialog(
      "inspector",
      closeInspector,
      false,
      undefined,
      undefined,
      "inspect"
    );

    closeEditDialogs();

    expect(closeEditor).toHaveBeenCalledOnce();
    expect(closeInspector).not.toHaveBeenCalled();
    unregisterEditor();
    unregisterInspector();
  });
});
