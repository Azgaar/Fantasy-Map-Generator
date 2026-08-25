import { describe, expect, it } from "vitest";
import { PriorityQueue } from "./priority-queue";

describe("PriorityQueue", () => {
  it("returns items in ascending priority and keeps the next priority observable", () => {
    const queue = new PriorityQueue<string>();
    queue.push("late", 5);
    queue.push("first", 1);
    queue.push("middle", 3);

    expect(queue.peekValue()).toBe(1);
    expect(queue.pop()).toBe("first");
    expect(queue.pop()).toBe("middle");
    expect(queue.pop()).toBe("late");
    expect(queue.pop()).toBeUndefined();
  });
});
