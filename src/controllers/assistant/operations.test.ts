// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { MODELS, OPERATIONS, runOperation } from "./operations";

it.each([...OPERATIONS])("%s runs the public model-class method of that name", name => {
  const [model, method] = name.split(".");
  const owner = MODELS[model as keyof typeof MODELS] as unknown as Record<string, unknown>;
  expect(typeof owner[method]).toBe("function");
  const spy = vi.spyOn(owner as Record<string, () => void>, method).mockImplementation(() => {});
  const { setMeaning } = owner;
  const clears = method === "rename" && setMeaning; // a rename clears the meaning
  if (clears) owner.setMeaning = vi.fn();
  runOperation(name, ["a", "b"]);
  if (clears) expect(owner.setMeaning).toHaveBeenCalledWith("a");
  if (clears) owner.setMeaning = setMeaning;
  expect(spy).toHaveBeenCalledWith("a", "b");
  spy.mockRestore();
});
