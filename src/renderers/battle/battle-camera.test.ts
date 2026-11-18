import { describe, expect, it } from "vitest";
import { BattleCamera, type CameraTroop, type View } from "./battle-camera";

const field = { width: 1000, height: 600, front: 20 };
const scene = { x: -20, y: -20, width: 1040, height: 640 }; // two nodes more round each side
const whole = scene;
const SCENE_ASPECT = 1040 / 640;
const troop = (x: number, y: number, present = true): CameraTroop => ({ x, y, width: 20, depth: 10, present });
const aspect = (view: View): number => view.width / view.height;
const inside = (view: View): boolean =>
  view.x >= whole.x - 1e-9 &&
  view.y >= whole.y - 1e-9 &&
  view.x + view.width <= whole.x + whole.width + 1e-9 &&
  view.y + view.height <= whole.y + whole.height + 1e-9;
const contains = (view: View, x: number, y: number): boolean =>
  x >= view.x && x <= view.x + view.width && y >= view.y && y <= view.y + view.height;

describe("frameTroops", () => {
  it("frames every battalion with a margin, in the scene's proportions", () => {
    const view = BattleCamera.frameTroops(field, [troop(300, 300), troop(600, 320)]);
    expect(contains(view, 300 - 10 - 40, 300)).toBe(true);
    expect(contains(view, 600 + 10 + 40, 320)).toBe(true);
    expect(aspect(view)).toBeCloseTo(SCENE_ASPECT);
    expect(view.width).toBeLessThan(field.width);
  });

  it("takes in the field and even margins of the scene round it", () => {
    expect(BattleCamera.getSceneBox(field)).toEqual(scene);
  });

  it("gives the whole scene for troops spread wider than it", () => {
    const view = BattleCamera.frameTroops(field, [troop(-95, -55), troop(1095, 655)]);
    for (const [key, value] of Object.entries(whole)) expect(view[key as keyof View]).toBeCloseTo(value);
  });

  it("never frames narrower than a few battalion fronts", () => {
    const view = BattleCamera.frameTroops(field, [troop(500, 300)]);
    expect(view.width).toBeGreaterThanOrEqual(120);
    expect(contains(view, 500, 300)).toBe(true);
    expect(BattleCamera.clampView(field, { x: 500, y: 300, width: 10, height: 6 }).width).toBe(120);
  });

  it("leaves out battalions that left the field", () => {
    const view = BattleCamera.frameTroops(field, [troop(300, 300), troop(320, 300), troop(990, 590, false)]);
    expect(contains(view, 990, 590)).toBe(false);
  });

  it("keeps the view within the scene by its edge", () => {
    const view = BattleCamera.frameTroops(field, [troop(-98, -58)]);
    expect(inside(view)).toBe(true);
    expect(view.x).toBeCloseTo(scene.x);
  });
});

describe("moveCamera", () => {
  const troops = [troop(300, 300), troop(400, 300)];

  it("eases toward the framing, reaches it and holds it", () => {
    let camera = BattleCamera.create(field);
    const target = BattleCamera.frameTroops(field, troops);
    camera = BattleCamera.move(camera, field, troops, "follow", 0.1);
    expect(camera.view.width).toBeLessThan(field.width);
    expect(camera.view.width).toBeGreaterThan(target.width);
    for (let frame = 0; frame < 120; frame++) camera = BattleCamera.move(camera, field, troops, "follow", 1 / 60);
    expect(camera.view).toEqual(target);
    expect(BattleCamera.move(camera, field, troops, "follow", 1 / 60).view).toEqual(target);
  });

  it("keeps the scene's proportions while it eases", () => {
    const camera = BattleCamera.move(BattleCamera.create(field), field, troops, "follow", 0.2);
    expect(aspect(camera.view)).toBeCloseTo(SCENE_ASPECT);
  });

  it("ignores small changes of the framing", () => {
    let camera = BattleCamera.move(BattleCamera.create(field), field, troops, "follow", Infinity);
    const held = camera.view;
    camera = BattleCamera.move(camera, field, [troop(302, 301), troop(401, 300)], "follow", Infinity);
    expect(camera.view).toEqual(held);
    camera = BattleCamera.move(camera, field, [troop(350, 300), troop(450, 300)], "follow", Infinity);
    expect(camera.view).not.toEqual(held);
  });

  it("shows the whole scene in its mode", () => {
    const { view } = BattleCamera.move(BattleCamera.create(field), field, troops, "field", 1);
    for (const [key, value] of Object.entries(whole)) expect(view[key as keyof View]).toBeCloseTo(value);
  });

  it("clamps a view set by hand", () => {
    const camera = { view: { x: 1150, y: -100, width: 50, height: 30 }, target: BattleCamera.create(field).target };
    const { view } = BattleCamera.move(camera, field, troops, "manual", 1);
    expect(view.width).toBe(120);
    expect(inside(view)).toBe(true);
  });

  it("gives the same views for the same inputs", () => {
    const run = (): View[] => {
      let camera = BattleCamera.create(field);
      return [0.05, 0.2, 0.05, 0.4].map((elapsed, i) => {
        camera = BattleCamera.move(camera, field, [troop(300 + i * 30, 300), troop(500, 280)], "follow", elapsed);
        return camera.view;
      });
    };
    expect(run()).toEqual(run());
  });
});

describe("zoom and pan", () => {
  it("zooms at the pointer, keeping the point under it", () => {
    const view = BattleCamera.zoomView(field, { x: 0, y: 0, width: 1000, height: 600 }, 2, [250, 150]);
    expect(view.width).toBe(500);
    expect((250 - view.x) / view.width).toBeCloseTo(0.25);
  });

  it("goes no further than the whole scene or the least width", () => {
    expect(BattleCamera.zoomView(field, { x: 0, y: 0, width: 1000, height: 600 }, 0.5, [500, 300]).width).toBeCloseTo(
      scene.width
    );
    expect(BattleCamera.zoomView(field, { x: 0, y: 0, width: 1000, height: 600 }, 100, [500, 300]).width).toBe(120);
  });

  it("pans within the scene", () => {
    const view = BattleCamera.panView(field, { x: 100, y: 100, width: 500, height: 300 }, 1000, -1000);
    expect(view.x).toBeCloseTo(whole.x + whole.width - 500);
    expect(view.y).toBeCloseTo(whole.y);
  });
});
