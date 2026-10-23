// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmationDialog } from "./dialog-helpers";

describe("confirmationDialog", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="alert"><div id="alertMessage"></div></div>
    `;
    window.$ = vi.fn().mockReturnValue({
      dialog: vi.fn()
    }) as unknown as typeof window.$;
  });

  it("calls onConfirm immediately when event.shiftKey is true without opening dialog", () => {
    const onConfirm = vi.fn();
    const mockEvent = new MouseEvent("click", { shiftKey: true });

    confirmationDialog({
      onConfirm,
      event: mockEvent
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(window.$).not.toHaveBeenCalled();
  });

  it("opens jQuery UI dialog when Shift is not pressed", () => {
    const onConfirm = vi.fn();

    confirmationDialog({
      title: "Test Confirm",
      message: "Are you sure?",
      onConfirm
    });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(window.$).toHaveBeenCalledWith("#alert");
  });
});
