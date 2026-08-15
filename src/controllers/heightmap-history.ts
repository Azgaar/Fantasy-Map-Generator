export class HeightmapHistory {
  private snapshots: Uint8Array[] = [];
  private position = 0;

  get current(): Uint8Array | undefined {
    return this.snapshots[this.position - 1];
  }

  get previousPosition(): number {
    return this.position - 1;
  }

  get nextPosition(): number {
    return this.position + 1;
  }

  get canUndo(): boolean {
    return this.position > 1;
  }

  get canRedo(): boolean {
    return this.position < this.snapshots.length;
  }

  commit(heights: Uint8Array): void {
    this.snapshots = this.snapshots.slice(0, this.position);
    this.snapshots.push(heights.slice());
    this.position = this.snapshots.length;
  }

  restore(position: number): Uint8Array | undefined {
    if (position < 1 || position > this.snapshots.length) return undefined;
    this.position = position;
    return this.current?.slice();
  }

  reset(heights: Uint8Array): void {
    this.snapshots = [];
    this.position = 0;
    this.commit(heights);
  }

  clear(): void {
    this.snapshots = [];
    this.position = 0;
  }
}
