// @vitest-environment jsdom
import { beforeAll, expect, it, vi } from "vitest";
import { Notes } from "@/generators/notes";
import { OPERATIONS } from "./assistant-operations";

beforeAll(async () => {
  await Promise.all([
    import("@/generators/burgs-generator"),
    import("@/generators/states-generator"),
    import("@/generators/provinces-generator"),
    import("@/generators/cultures-generator"),
    import("@/generators/religions-generator"),
    import("@/generators/river-generator"),
    import("@/generators/markers-generator"),
    import("@/generators/biomes-generator"),
    import("@/generators/zones-generator"),
    import("@/generators/routes-generator"),
    import("@/generators/features-generator")
  ]);
});

it.each(Object.keys(OPERATIONS))("%s runs the public model-class method of that name", name => {
  const [model, method] = name.split(".");
  const owner = (model === "Notes" ? Notes : globalThis[model as keyof typeof globalThis]) as Record<string, unknown>;
  expect(typeof owner[method]).toBe("function");
  const spy = vi.spyOn(owner as Record<string, () => void>, method).mockImplementation(() => {});
  const args = ["a", "b", "c"].slice(0, OPERATIONS[name].run.length);
  OPERATIONS[name].run(...args);
  expect(spy).toHaveBeenCalledWith(...args);
  spy.mockRestore();
});
