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
    import("@/generators/markers-generator")
  ]);
});

it.each(Object.keys(OPERATIONS))("%s runs the public model-class method of that name", name => {
  const [model, method] = name.split(".");
  const owner = (model === "Notes" ? Notes : globalThis[model as keyof typeof globalThis]) as Record<string, unknown>;
  expect(typeof owner[method]).toBe("function");
  const spy = vi.spyOn(owner as Record<string, () => void>, method).mockImplementation(() => {});
  OPERATIONS[name].run("a", "b");
  expect(spy).toHaveBeenCalledWith("a", "b");
  spy.mockRestore();
});
