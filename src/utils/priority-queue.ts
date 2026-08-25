/**
 * Small, typed binary min-heap compatible with the subset of FlatQueue used by Fantasia.
 * Keeping it local avoids adding a production dependency for a three-operation data structure.
 */
export class PriorityQueue<T> {
  private readonly items: T[] = [];
  private readonly priorities: number[] = [];

  get length(): number {
    return this.items.length;
  }

  push(item: T, priority: number): void {
    let index = this.items.length;
    this.items.push(item);
    this.priorities.push(priority);

    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.priorities[parent] <= priority) break;
      this.items[index] = this.items[parent];
      this.priorities[index] = this.priorities[parent];
      index = parent;
    }

    this.items[index] = item;
    this.priorities[index] = priority;
  }

  peekValue(): number | undefined {
    return this.priorities[0];
  }

  pop(): T | undefined {
    const first = this.items[0];
    const last = this.items.pop();
    const lastPriority = this.priorities.pop();
    if (!this.items.length || last === undefined || lastPriority === undefined) return first;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= this.items.length) break;
      const right = left + 1;
      const child = right < this.items.length && this.priorities[right] < this.priorities[left] ? right : left;
      if (this.priorities[child] >= lastPriority) break;
      this.items[index] = this.items[child];
      this.priorities[index] = this.priorities[child];
      index = child;
    }

    this.items[index] = last;
    this.priorities[index] = lastPriority;
    return first;
  }
}
