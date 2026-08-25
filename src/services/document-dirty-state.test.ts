import { describe, expect, test } from "vitest";
import { createDocumentDirtyState } from "./document-dirty-state";

describe("document dirty state", () => {
  test("marks committed edits but ignores View-mode exploration", () => {
    let mode: "edit" | "view" = "view";
    const dirtyState = createDocumentDirtyState(() => mode);

    dirtyState.mark();
    expect(dirtyState.isDirty()).toBe(false);

    mode = "edit";
    dirtyState.mark();
    expect(dirtyState.isDirty()).toBe(true);

    dirtyState.clear();
    expect(dirtyState.isDirty()).toBe(false);
  });
});
