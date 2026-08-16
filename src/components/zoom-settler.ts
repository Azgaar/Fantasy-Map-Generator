export interface ZoomChanges {
  scale: boolean;
  position: boolean;
}

/** Coalesce settled-state work across gestures without dropping changes when a frame is superseded. */
export class ZoomSettler {
  private frameId: number | null = null;
  private scaleChanged = false;
  private positionChanged = false;

  constructor(private readonly settle: (changes: ZoomChanges) => void) {}

  schedule(changes: ZoomChanges): void {
    this.scaleChanged ||= changes.scale;
    this.positionChanged ||= changes.position;
    this.cancel();
    this.frameId = requestAnimationFrame(() => {
      this.frameId = null;
      const pending = { scale: this.scaleChanged, position: this.positionChanged };
      this.scaleChanged = false;
      this.positionChanged = false;
      this.settle(pending);
    });
  }

  cancel(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }
}
