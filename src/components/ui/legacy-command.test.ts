import { describe, expect, test, vi } from "vitest";
import { executeLegacyCommand, type LegacyCommandRoot } from "./legacy-command";

describe("executeLegacyCommand", () => {
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
});
