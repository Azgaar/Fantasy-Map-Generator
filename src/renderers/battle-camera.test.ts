import { describe, expect, it } from "vitest";
import {
  type CameraTroop,
  clampView,
  createCamera,
  frameTroops,
  moveCamera,
  panView,
  type View,
  zoomView
} from "./battle-camera";

const field = { width: 1000, height: 600, front: 20 };
const troop = (x: number, y: number, present = true): CameraTroop => ({ x, y, width: 20, depth: 10, present });
const aspect = (view: View): number => view.width / view.height;
const inside = (view: View): boolean =>
  view.x >= 0 &&
  view.y >= 0 &&
  view.x + view.width <= field.width + 1e-9 &&
  view.y + view.height <= field.height + 1e-9;
const contains = (view: View, x: number, y: number): boolean =>
  x >= view.x && x <= view.x + view.width && y >= view.y && y <= view.y + view.height;

describe("frameTroops", () => {
  it("frames every battalion with a margin, in the field's proportions", () => {
    const view = frameTroops(field, [troop(300, 300), troop(600, 320)]);
    expect(contains(view, 300 - 10 - 40, 300)).toBe(true);
    expect(contains(view, 600 + 10 + 40, 320)).toBe(true);
    expect(aspect(view)).toBeCloseTo(5 / 3);
    expect(view.width).toBeLessThan(field.width);
  });

  it("gives the whole field for troops spread wider than it", () => {
    expect(frameTroops(field, [troop(5, 5), troop(995, 595)])).toEqual({ x: 0, y: 0, width: 1000, height: 600 });
  });

  it("never frames narrower than a few battalion fronts", () => {
    const view = frameTroops(field, [troop(500, 300)]);
    expect(view.width).toBeGreaterThanOrEqual(120);
    expect(contains(view, 500, 300)).toBe(true);
    expect(clampView(field, { x: 500, y: 300, width: 10, height: 6 }).width).toBe(120);
  });

  it("leaves out battalions that left the field", () => {
    const view = frameTroops(field, [troop(300, 300), troop(320, 300), troop(990, 590, false)]);
    expect(contains(view, 990, 590)).toBe(false);
  });

  it("keeps the view within the field by the edge", () => {
    const view = frameTroops(field, [troop(2, 2)]);
    expect(inside(view)).toBe(true);
    expect(view.x).toBe(0);
  });
});

describe("moveCamera", () => {
  const troops = [troop(300, 300), troop(400, 300)];

  it("eases toward the framing, reaches it and holds it", () => {
    let camera = createCamera(field);
    const target = frameTroops(field, troops);
    camera = moveCamera(camera, field, troops, "follow", 0.1);
    expect(camera.view.width).toBeLessThan(field.width);
    expect(camera.view.width).toBeGreaterThan(target.width);
    for (let frame = 0; frame < 120; frame++) camera = moveCamera(camera, field, troops, "follow", 1 / 60);
    expect(camera.view).toEqual(target);
    expect(moveCamera(camera, field, troops, "follow", 1 / 60).view).toEqual(target);
  });

  it("keeps the field's proportions while it eases", () => {
    const camera = moveCamera(createCamera(field), field, troops, "follow", 0.2);
    expect(aspect(camera.view)).toBeCloseTo(5 / 3);
  });

  it("ignores small changes of the framing", () => {
    let camera = moveCamera(createCamera(field), field, troops, "follow", Infinity);
    const held = camera.view;
    camera = moveCamera(camera, field, [troop(302, 301), troop(401, 300)], "follow", Infinity);
    expect(camera.view).toEqual(held);
    camera = moveCamera(camera, field, [troop(350, 300), troop(450, 300)], "follow", Infinity);
    expect(camera.view).not.toEqual(held);
  });

  it("shows the whole field in its mode", () => {
    expect(moveCamera(createCamera(field), field, troops, "field", 1).view).toEqual(
      clampView(field, { x: 0, y: 0, width: 1000, height: 600 })
    );
  });

  it("clamps a view set by hand", () => {
    const camera = { view: { x: 950, y: -40, width: 50, height: 30 }, target: createCamera(field).target };
    const { view } = moveCamera(camera, field, troops, "manual", 1);
    expect(view.width).toBe(120);
    expect(inside(view)).toBe(true);
  });

  it("gives the same views for the same inputs", () => {
    const run = (): View[] => {
      let camera = createCamera(field);
      return [0.05, 0.2, 0.05, 0.4].map((elapsed, i) => {
        camera = moveCamera(camera, field, [troop(300 + i * 30, 300), troop(500, 280)], "follow", elapsed);
        return camera.view;
      });
    };
    expect(run()).toEqual(run());
  });
});

describe("zoom and pan", () => {
  it("zooms at the pointer, keeping the point under it", () => {
    const view = zoomView(field, { x: 0, y: 0, width: 1000, height: 600 }, 2, [250, 150]);
    expect(view.width).toBe(500);
    expect((250 - view.x) / view.width).toBeCloseTo(0.25);
  });

  it("goes no further than the whole field or the least width", () => {
    expect(zoomView(field, { x: 0, y: 0, width: 1000, height: 600 }, 0.5, [500, 300]).width).toBe(1000);
    expect(zoomView(field, { x: 0, y: 0, width: 1000, height: 600 }, 100, [500, 300]).width).toBe(120);
  });

  it("pans within the field", () => {
    const view = panView(field, { x: 100, y: 100, width: 500, height: 300 }, 1000, -1000);
    expect(view).toEqual({ x: 500, y: 0, width: 500, height: 300 });
  });
});
