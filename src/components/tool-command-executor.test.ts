import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openBiomes: vi.fn(),
  tip: vi.fn(),
  withDomDialogPlacement: vi.fn((_placement: string, openDialog: () => unknown) => openDialog()),
  withDomDialogPresentation: vi.fn((_presentation: string, openDialog: () => unknown) => openDialog())
}));

vi.mock("@/controllers", () => ({
  Controllers: { BiomesEditor: { open: mocks.openBiomes } }
}));

vi.mock("./tooltips", () => ({ tip: mocks.tip }));
vi.mock("./ui/dialog-placement-context", () => ({
  withDomDialogPlacement: mocks.withDomDialogPlacement,
  withDomDialogPresentation: mocks.withDomDialogPresentation
}));

import { resetWorkspaceModeForTests, setWorkspaceMode } from "@/application/workspace-mode";
import { invokeToolControllerCommand } from "./tool-command-executor";

afterEach(() => resetWorkspaceModeForTests());

describe("invokeToolControllerCommand", () => {
  beforeEach(async () => {
    (globalThis as Record<string, unknown>).customization = 0;
    vi.clearAllMocks();
    await setWorkspaceMode("edit");
  });

  test("invokes a controller without a legacy control click", () => {
    expect(invokeToolControllerCommand("editBiomesButton")).toBe("executed");
    expect(mocks.openBiomes).toHaveBeenCalledOnce();
  });

  test("applies a requested dialog placement while the controller opens", () => {
    expect(invokeToolControllerCommand("editBiomesButton", "center")).toBe("executed");
    expect(mocks.withDomDialogPlacement).toHaveBeenCalledWith("center", expect.any(Function));
    expect(mocks.openBiomes).toHaveBeenCalledOnce();
  });

  test("applies a requested panel presentation while the controller opens", () => {
    expect(invokeToolControllerCommand("editBiomesButton", undefined, "panel")).toBe("executed");
    expect(mocks.withDomDialogPresentation).toHaveBeenCalledWith("panel", expect.any(Function));
    expect(mocks.openBiomes).toHaveBeenCalledOnce();
  });

  test("blocks tools while customization mode is active", () => {
    (globalThis as Record<string, unknown>).customization = 1;

    expect(invokeToolControllerCommand("editBiomesButton")).toBe("blocked");
    expect(mocks.openBiomes).not.toHaveBeenCalled();
    expect(mocks.tip).toHaveBeenCalledWith("Please exit the customization mode first", false, "error");
  });

  test("reports unknown commands", () => {
    expect(invokeToolControllerCommand("unknown-command")).toBe("missing");
  });

  test("blocks editing controller commands in View mode before loading a controller", async () => {
    await setWorkspaceMode("view");

    expect(invokeToolControllerCommand("editBiomesButton")).toBe("blocked");
    expect(mocks.openBiomes).not.toHaveBeenCalled();
  });
});
