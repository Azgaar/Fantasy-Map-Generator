import { afterEach, expect, test, vi } from "vitest";
import "./pack-generator";
import { Coordinates } from "./coordinates";
import { GenerationPipeline } from "./generation-pipeline";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("a new world clears the previous map's collections before rebuilding its graph", async () => {
  const noop = () => {};
  vi.stubGlobal("Grid", { prepare: noop, addDeepDepressionLakes: noop, openNearSeaLakes: noop });
  vi.stubGlobal("HeightmapGenerator", { generate: noop });
  vi.stubGlobal("Features", { markupGrid: noop });
  vi.stubGlobal("Temperature", { generate: noop });
  vi.stubGlobal("Precipitation", { generate: noop });
  vi.spyOn(Coordinates, "generate").mockImplementation(noop);
  const previous = {
    relief: [{ type: "mount", x: 10, y: 10, s: 5 }],
    journeys: [{ i: 0, name: "Previous quest", segments: [] }],
    markers: [{ i: 1, lock: true }]
  };
  vi.stubGlobal("pack", previous);
  let next: typeof pack | undefined;
  vi.spyOn(Pack, "generate").mockImplementation(() => {
    next = pack;
    throw new Error("Stop at the new graph");
  });

  await expect(GenerationPipeline.run({})).rejects.toThrow("Stop at the new graph");

  expect(next).not.toBe(previous);
  expect(next).toEqual({});
  expect(previous.journeys[0].name).toBe("Previous quest");
});
