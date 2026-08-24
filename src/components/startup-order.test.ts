import { describe, expect, it } from "vitest";
import optionsRuntimeSource from "./options/options-runtime.ts?raw";

describe("component startup order", () => {
  it("does not call globals installed by the component entry point during dependency evaluation", () => {
    expect(optionsRuntimeSource.includes("window.enableElementDragging(")).toBe(false);
    expect(optionsRuntimeSource.includes('from "@/components/element-dragging"')).toBe(true);
  });
});
