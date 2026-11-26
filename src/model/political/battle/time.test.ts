import { describe, expect, it } from "vitest";
import { BattleTime } from "./time";

describe("battle time", () => {
  it("starts a battle at an hour the seed gives, always the same, by day four times in five", () => {
    const hours = Array.from({ length: 2000 }, (_, i) => BattleTime.getHour((i * 2654435761) % 2 ** 31)); // seeds as the screen draws them
    expect(hours.every(hour => Number.isInteger(hour) && hour >= 0 && hour < 24)).toBe(true);
    expect(new Set(hours).size).toBe(24);
    const byDay = hours.filter(hour => BattleTime.getDaylight(hour) === 1).length / hours.length;
    expect(byDay).toBeGreaterThan(0.77);
    expect(byDay).toBeLessThan(0.83);
    expect(BattleTime.getHour(42)).toBe(BattleTime.getHour(42));
  });

  it("shows the time of day from the start hour", () => {
    expect(BattleTime.formatClock(14, 0)).toBe("14:00:00");
    expect(BattleTime.formatClock(6, 8)).toBe("06:01:04");
    expect(BattleTime.formatClock(23, 600)).toBe("00:20:00");
  });

  it("gives day from 5 to 20, twilight to 23 and from 3, night between", () => {
    expect(BattleTime.getDaylight(12)).toBe(1);
    expect(BattleTime.getDaylight(19.9)).toBe(1);
    expect(BattleTime.getDaylight(21.5)).toBeCloseTo(0.5, 5);
    expect(BattleTime.getDaylight(1)).toBe(0);
    expect(BattleTime.getDaylight(4)).toBeCloseTo(0.5, 5);
    expect([1, 4, 6, 21].map(time => BattleTime.getPeriod(time))).toEqual(["night", "dawn", "morning", "dusk"]);
  });

  it("has the sun rise in the east, stand south at midday in the north and north in the south, and set in the west", () => {
    const deg = (radians: number): number => (radians * 180) / Math.PI;
    expect(deg(BattleTime.getSun(12.5, 45).azimuth)).toBeCloseTo(180, 5);
    expect(deg(BattleTime.getSun(12.5, 45).altitude)).toBeCloseTo(45, 5);
    expect(deg(BattleTime.getSun(12.5, -30).azimuth)).toBeCloseTo(0, 5);
    expect(deg(BattleTime.getSun(5, 45).azimuth)).toBeCloseTo(67.5, 5);
    expect(deg(BattleTime.getSun(20, 45).azimuth)).toBeCloseTo(292.5, 5);
    expect(BattleTime.getSun(5, 45).altitude).toBeCloseTo(0, 5);
    expect(BattleTime.getSun(1, 45).altitude).toBeLessThan(0);
  });
});
