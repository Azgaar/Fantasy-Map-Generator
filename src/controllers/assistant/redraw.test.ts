import { expect, it } from "vitest";
import { layersFor } from "./redraw";

const layers = (...rows: [key: string, field: string][]) => layersFor(rows.map(([key, field]) => ({ key, field })));

it("draws the layers that show the changed field", () => {
  expect(layers(["burg:1", "name"])).toEqual(["labels"]);
  expect(layers(["burg:1", "population"])).toEqual(["population"]);
  expect(layers(["state:1", "color"])).toEqual(["states", "military"]);
  expect(layers(["state:2", "military.0.name"])).toEqual(["military"]);
  expect(layers(["river:3", "widthFactor"])).toEqual(["rivers"]);
});

it("draws everything showing an entity when it is added or removed", () => {
  expect(layers(["burg:4", ""])).toEqual(["burgIcons", "labels", "emblems", "population", "goods"]);
  expect(layers(["province:2", "removed"])).toEqual(["provinces", "borders", "labels", "emblems"]);
});

it("draws territory from cell ownership and merges the layers of a batch", () => {
  expect(layers(["cells", "state"], ["cells", "routes"], ["route:7", ""])).toEqual([
    "states",
    "borders",
    "provinces",
    "burgIcons",
    "labels",
    "military",
    "emblems",
    "routes"
  ]);
});

it("draws emblems and labels for any entity, and nothing for notes, locks, lore or data no layer shows", () => {
  expect(layers(["culture:1", "coa.shield"], ["addedLabel:1", "label.group"])).toEqual(["emblems", "labels"]);
  expect(layers(["marker:1", "note"], ["route:1", "lock"], ["lore", "name"], ["state:1", "treasury"])).toEqual([]);
});
