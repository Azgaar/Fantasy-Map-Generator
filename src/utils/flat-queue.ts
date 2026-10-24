// Binary min-heap priority queue, ported from mourner/flatqueue (ISC)
export class FlatQueue<T = number> {
  ids: T[] = [];
  values: number[] = [];
  length = 0;

  clear(): void {
    this.length = 0;
  }

  push(id: T, value: number): void {
    let pos = this.length++;
    while (pos > 0) {
      const parent = (pos - 1) >> 1;
      const parentValue = this.values[parent];
      if (value >= parentValue) break;
      this.ids[pos] = this.ids[parent];
      this.values[pos] = parentValue;
      pos = parent;
    }
    this.ids[pos] = id;
    this.values[pos] = value;
  }

  /** Callers check `length` first: an empty queue returns undefined */
  pop(): T {
    if (this.length === 0) return undefined as T;
    const top = this.ids[0];
    this.length--;

    if (this.length > 0) {
      const id = this.ids[this.length];
      const value = this.values[this.length];
      const halfLength = this.length >> 1;
      let pos = 0;

      while (pos < halfLength) {
        let left = (pos << 1) + 1;
        const right = left + 1;
        let bestIndex = this.ids[left];
        let bestValue = this.values[left];
        const rightValue = this.values[right];

        if (right < this.length && rightValue < bestValue) {
          left = right;
          bestIndex = this.ids[right];
          bestValue = rightValue;
        }
        if (bestValue >= value) break;

        this.ids[pos] = bestIndex;
        this.values[pos] = bestValue;
        pos = left;
      }

      this.ids[pos] = id;
      this.values[pos] = value;
    }

    return top;
  }

  peek(): T {
    return (this.length > 0 ? this.ids[0] : undefined) as T;
  }

  peekValue(): number {
    return (this.length > 0 ? this.values[0] : undefined) as number;
  }

  shrink(): void {
    this.ids.length = this.values.length = this.length;
  }
}
