// @vitest-environment jsdom
import { beforeAll, expect, it, vi } from "vitest";
import { Emblems } from "@/generators/emblems-generator";
import { Lore } from "@/generators/lore";
import { Notes } from "@/generators/notes";
import { OPERATIONS, runOperation } from "./operations";

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
    import("@/generators/features-generator"),
    import("@/generators/military-generator"),
    import("@/generators/added-labels"),
    import("@/generators/labels-generator"),
    import("@/generators/journeys/journeys-generator"),
    import("@/generators/goods-generator"),
    import("@/generators/markets-generator")
  ]);
});

it.each([...OPERATIONS])("%s runs the public model-class method of that name", name => {
  const [model, method] = name.split(".");
  const owner = ({ Notes, Emblems, Lore }[model] ?? globalThis[model as keyof typeof globalThis]) as Record<
    string,
    unknown
  >;
  expect(typeof owner[method]).toBe("function");
  const spy = vi.spyOn(owner as Record<string, () => void>, method).mockImplementation(() => {});
  runOperation(name, ["a", "b"]);
  expect(spy).toHaveBeenCalledWith("a", "b");
  spy.mockRestore();
});
