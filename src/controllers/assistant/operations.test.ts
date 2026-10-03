// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { Lore } from "@/generators/lore";
import { Notes } from "@/generators/notes";
import { Styles } from "@/generators/styles";
import { OPERATIONS, runOperation } from "./operations";

it.each([...OPERATIONS])("%s runs the public model-class method of that name", name => {
  const [model, method] = name.split(".");
  const owner = ({ Notes, Lore, Styles }[model] ?? globalThis[model as keyof typeof globalThis]) as Record<
    string,
    unknown
  >;
  expect(typeof owner[method]).toBe("function");
  const spy = vi.spyOn(owner as Record<string, () => void>, method).mockImplementation(() => {});
  runOperation(name, ["a", "b"]);
  expect(spy).toHaveBeenCalledWith("a", "b");
  spy.mockRestore();
});
