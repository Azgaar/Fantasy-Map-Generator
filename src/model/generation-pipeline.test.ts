import { afterEach, expect, test, vi } from "vitest";
import "./graph/pack-generator";
import { Grid } from "@/model/graph/grid-generator";
import { Pack } from "@/model/graph/pack-generator";
import { Features } from "@/model/physical/features-generator";
import { HeightmapGenerator } from "@/model/physical/heightmap-generator";
import { Precipitation } from "@/model/physical/precipitation-generator";
import { Temperature } from "@/model/physical/temperature-generator";
import { GenerationPipeline } from "./generation-pipeline";
import { Coordinates } from "./physical/coordinates";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("a new world clears the previous map's collections before rebuilding its graph", async () => {
  const noop = () => {};
  Object.assign(Grid, { prepare: noop, addDeepDepressionLakes: noop, openNearSeaLakes: noop });
  Object.assign(HeightmapGenerator, { generate: noop });
  Object.assign(Features, { markupGrid: noop });
  Object.assign(Temperature, { generate: noop });
  Object.assign(Precipitation, { generate: noop });
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
