import { describe, expect, it } from "vitest";
import { formatClock, getFieldSize, minutesToTicks, toMetresPerSecond, toMetresPerTick } from "./battle-scale";

describe("battle scale", () => {
  it("stands a battalion a metre a man across five ranks", () => {
    expect(getFieldSize(300).front).toBe(60);
    expect(getFieldSize(200).front).toBe(40);
    expect(getFieldSize(1000).front).toBe(200);
  });

  it("sizes the field by the battalions, 0.6 as deep as it is wide", () => {
    const size = (men: number) => getFieldSize(men);
    expect(size(300).width).toBeCloseTo(1364, 0);
    expect(size(300).height).toBeCloseTo(818, 0);
    expect(size(200).width).toBeCloseTo(909, 0);
    expect(size(1000).width).toBeCloseTo(4545, 0);
    expect(size(1000).front).toBe(200);
  });

  it("keeps a node 1% of the field's width", () => {
    expect(getFieldSize(300).cell).toBeCloseTo(13.64, 2);
    expect(getFieldSize(1000).cell).toBeCloseTo(45.45, 2);
  });

  it("takes a besieged burg and the land about it in, top to bottom", () => {
    expect(getFieldSize(300, 60).width).toBeCloseTo(2267, 0); // a village: the ring and room about it
    expect(getFieldSize(300, 800).width).toBeCloseTo(4733, 0); // a city
    expect(getFieldSize(300, 800).height / 2).toBeGreaterThan(800 + 340); // the ring fits above and below
    expect(getFieldSize(1000, 60).width).toBeCloseTo(4545, 0); // big battalions keep their field
    expect(getFieldSize(300, 60).front).toBe(60); // battalions keep their real size
  });

  it("keeps the field between 250 m and 10 km wide", () => {
    expect(getFieldSize(20).width).toBe(250);
    expect(getFieldSize(300, 5000).width).toBe(10000);
    expect(getFieldSize(5000).width).toBe(10000);
  });

  it("turns km/h into metres a tick of eight seconds and back to m/s", () => {
    expect(toMetresPerTick(3.6)).toBe(8);
    expect(toMetresPerSecond(toMetresPerTick(12.6))).toBeCloseTo(3.5, 5);
    expect(minutesToTicks(8)).toBe(60);
  });

  it("shows the time a tick is at as m:ss, h:mm:ss past an hour", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(8)).toBe("1:04");
    expect(formatClock(600)).toBe("1:20:00");
  });
});
