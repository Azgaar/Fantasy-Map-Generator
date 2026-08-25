import { afterEach, describe, expect, test, vi } from "vitest";
import { resetWorkspaceModeForTests, setWorkspaceMode } from "@/application/workspace-mode";
import { executeLegacyCommand, type LegacyCommandRoot } from "./legacy-command";

describe("executeLegacyCommand", () => {
  afterEach(() => resetWorkspaceModeForTests());
  test("clicks an available legacy control", () => {
    const click = vi.fn();
    const root: LegacyCommandRoot = { getElementById: () => ({ click }) };

    expect(executeLegacyCommand("saveButton", root)).toBe("executed");
    expect(click).toHaveBeenCalledOnce();
  });

  test("does not click a disabled legacy control", () => {
    const click = vi.fn();
    const root: LegacyCommandRoot = { getElementById: () => ({ click, disabled: true }) };

    expect(executeLegacyCommand("saveButton", root)).toBe("disabled");
    expect(click).not.toHaveBeenCalled();
  });

  test("reports a missing legacy control", () => {
    const root: LegacyCommandRoot = { getElementById: () => null };

    expect(executeLegacyCommand("missingButton", root)).toBe("missing");
  });

  test("enforces a requested workspace capability before clicking", async () => {
    const click = vi.fn();
    const root: LegacyCommandRoot = { getElementById: () => ({ click }) };
    await setWorkspaceMode("view");

    expect(executeLegacyCommand("newMapButton", root, "map:generate")).toBe("blocked");
    expect(click).not.toHaveBeenCalled();
  });
});
