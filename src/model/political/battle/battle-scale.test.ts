import { describe, expect, it } from "vitest";
import { BattleScale } from "./battle-scale";

describe("battle scale", () => {
  it("stands a battalion a metre a man across five ranks", () => {
    expect(BattleScale.getFieldSize(300).front).toBe(60);
    expect(BattleScale.getFieldSize(200).front).toBe(40);
    expect(BattleScale.getFieldSize(1000).front).toBe(200);
    expect(BattleScale.getFieldSize(4000).front).toBe(200); // more men stand deeper on the same front
  });

  it("sizes the field by the battalions, 0.6 as deep as it is wide", () => {
    const size = (men: number) => BattleScale.getFieldSize(men);
    expect(size(300).width).toBeCloseTo(1364, 0);
    expect(size(300).height).toBeCloseTo(818, 0);
    expect(size(200).width).toBeCloseTo(909, 0);
    expect(size(1000).width).toBeCloseTo(4545, 0);
    expect(size(1000).front).toBe(200);
  });

  it("keeps a node 1% of the field's width", () => {
    expect(BattleScale.getFieldSize(300).cell).toBeCloseTo(13.64, 2);
    expect(BattleScale.getFieldSize(1000).cell).toBeCloseTo(45.45, 2);
  });

  it("takes a besieged burg and the land about it in, top to bottom", () => {
    expect(BattleScale.getFieldSize(300, 60).width).toBeCloseTo(1533, 0); // a village: the ring and room about it
    expect(BattleScale.getFieldSize(300, 60, 219).width).toBeCloseTo(1130, 0); // the ring out of a bowshot
    expect(BattleScale.getFieldSize(300, 200).width).toBeCloseTo(2000, 0); // a burg
    expect(BattleScale.fitSiegeBurg(200, BattleScale.getFieldSize(300, 200))).toBe(200); // at its true size
    expect(BattleScale.getFieldSize(1000, 60).width).toBeCloseTo(2727, 0); // big battalions keep most of their field
    expect(BattleScale.getFieldSize(300, 60).front).toBe(60); // battalions keep their real size
  });

  it("zooms out for a siege at most 1.5 times, drawing a burg too big for it smaller", () => {
    const city = BattleScale.getFieldSize(300, 800);
    expect(city.width).toBeCloseTo(1.5 * BattleScale.getFieldSize(300).width, 0);
    const radius = BattleScale.fitSiegeBurg(800, city);
    expect(radius).toBeCloseTo(214, 0);
    expect(city.height / 2).toBeCloseTo(radius + 340 + 60, 5); // the ring fits above and below
    expect(BattleScale.getFieldSize(300, 5000).width).toBe(city.width);
  });

  it("keeps the field 250 m wide at least, and at most what battalions of 1000 ask for", () => {
    expect(BattleScale.getFieldSize(20).width).toBe(250);
    expect(BattleScale.getFieldSize(5000).width).toBeCloseTo(4545, 0); // as for battalions of 1000
    expect(BattleScale.getFieldSize(5000, 20000).width).toBeCloseTo(6818, 0); // a siege of a city, 1.5 times as wide
  });

  it("turns km/h into metres a tick of eight seconds and back to m/s", () => {
    expect(BattleScale.toMetresPerTick(3.6)).toBe(8);
    expect(BattleScale.toMetresPerSecond(BattleScale.toMetresPerTick(12.6))).toBeCloseTo(3.5, 5);
    expect(BattleScale.minutesToTicks(8)).toBe(60);
  });
});
