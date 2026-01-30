export class Camera {
  x: number = 0; // Center world X
  y: number = 0; // Center world Y
  zoom: number = 1;

  worldWidth: number;
  worldHeight: number;
  canvas: HTMLCanvasElement;

  constructor(
    canvas: HTMLCanvasElement,
    worldWidth: number,
    worldHeight: number,
  ) {
    this.canvas = canvas;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.x = worldWidth / 2;
    this.y = worldHeight / 2;

    this.attachControls();
  }

  getMatrix(): Float32Array {
    const aspect = this.canvas.width / this.canvas.height;

    // Determine view size in world units
    // At zoom 1, width = worldWidth
    const viewW = this.worldWidth / this.zoom;
    const viewH = viewW / aspect; // Maintain square pixels

    // Scale to map viewW -> 2.0 (Clip space width)
    const sx = 2.0 / viewW;
    const sy = 2.0 / viewH;

    // Matrix 3x3 for 2D transform
    // [ sx  0  0 ]
    // [ 0  -sy 0 ]  (Flip Y: World 0 is Top, Clip 0 is Center, Clip Y+ is Up)
    // [ tx  ty 1 ]
    //
    // tx = -center.x * sx
    // ty = -center.y * -sy = center.y * sy
    // Note: Clip space 0,0 is center.
    // If x=center.x, result should be 0.
    // x*sx + tx = cx*sx + (-cx*sx) = 0. Correct.

    return new Float32Array([
      sx,
      0,
      0,
      0,
      -sy,
      0,
      -this.x * sx,
      this.y * sy,
      1,
    ]);
  }

  attachControls() {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    this.canvas.addEventListener("mousedown", (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });

    window.addEventListener("mouseup", () => {
      isDragging = false;
    });

    this.canvas.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      // Convert screen pixel delta to world delta
      const viewW = this.worldWidth / this.zoom;
      const pxScale = viewW / this.canvas.width;

      this.x -= dx * pxScale;
      this.y -= dy * pxScale;
    });

    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const scaleFactor = 1.1;
        const amount = e.deltaY < 0 ? scaleFactor : 1 / scaleFactor;

        // Apply Zoom
        const newZoom = Math.max(0.1, Math.min(this.zoom * amount, 100));

        // Adjust center so that the world point under mouse stays stationary
        // newCenter = mouseWorld - (mouseWorld - oldCenter) * (oldScale / newScale) ?
        // Easier:
        // Mouse World Pos = this.x + worldDx
        // After zoom, we want Mouse World Pos to map to same Screen Pos

        // Let's just do simple center zoom for now to avoid jumpiness bugs in first pass
        this.zoom = newZoom;
      },
      { passive: false },
    );

    // Basic Touch support (Pinch) - TODO
  }
}
