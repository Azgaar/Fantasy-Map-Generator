import { describe, expect, test } from "vitest";
import { mergeRoutePoints } from "./route-editor";

const points = (...cellIds: number[]): number[][] => cellIds.map(cellId => [cellId * 10, cellId * 20, cellId]);
const ids = (routePoints: number[][]): number[] => routePoints.map(point => point[2]);

describe("route editor merging", () => {
  test.each([
    { name: "current end to joined start", current: [1, 2, 3], joined: [3, 4, 5], expected: [1, 2, 3, 4, 5] },
    { name: "joined end to current start", current: [3, 4, 5], joined: [1, 2, 3], expected: [1, 2, 3, 4, 5] },
    { name: "two starts", current: [3, 2, 1], joined: [3, 4, 5], expected: [1, 2, 3, 4, 5] },
    { name: "two ends", current: [1, 2, 3], joined: [5, 4, 3], expected: [1, 2, 3, 4, 5] }
  ])("merges routes connected at $name without duplicating the shared point", ({ current, joined, expected }) => {
    expect(ids(mergeRoutePoints(points(...current), points(...joined))!)).toEqual(expected);
  });

  test("does not mutate either route while reversing their traversal direction", () => {
    const current = points(3, 2, 1);
    const joined = points(3, 4, 5);
    const originalCurrent = structuredClone(current);
    const originalJoined = structuredClone(joined);

    mergeRoutePoints(current, joined);

    expect(current).toEqual(originalCurrent);
    expect(joined).toEqual(originalJoined);
  });

  test("rejects routes without a shared endpoint", () => {
    expect(mergeRoutePoints(points(1, 2, 3), points(4, 5, 6))).toBeNull();
  });

  test("rejects empty routes", () => {
    expect(mergeRoutePoints([], points(1, 2))).toBeNull();
    expect(mergeRoutePoints(points(1, 2), [])).toBeNull();
    expect(mergeRoutePoints([], [])).toBeNull();
  });
});
