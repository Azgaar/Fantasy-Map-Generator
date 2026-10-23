// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { Lore } from "@/model/story/lore";
import { Notes } from "@/model/story/notes";
import { Styles } from "@/model/styles/styles";
import { OPERATIONS, runOperation } from "./operations";
import { StylePresets } from "./style-presets";

it.each([...OPERATIONS])("%s runs the public model-class method of that name", name => {
  const [model, method] = name.split(".");
  const owner = ({ Notes, Lore, Styles, StylePresets }[model] ??
    globalThis[model as keyof typeof globalThis]) as Record<string, unknown>;
  expect(typeof owner[method]).toBe("function");
  const spy = vi.spyOn(owner as Record<string, () => void>, method).mockImplementation(() => {});
  runOperation(name, ["a", "b"]);
  expect(spy).toHaveBeenCalledWith("a", "b");
  spy.mockRestore();
});
