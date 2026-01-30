import { initBridge } from "./bridge";
import { Camera } from "./control/Camera";
import { Quadtree } from "./data/Quadtree";
import { Renderer } from "./render/Renderer";
import type { WorkerCompleteMessage, WorkerInitMessage } from "./types";
import Worker from "./worker/generation.worker?worker"; // Vite worker import syntax

console.log("Fantasy Map Engine Initialized");

const CONFIG = {
  width: 1024,
  height: 1024,
};

// Main Entry Point
export class Engine {
  canvas: HTMLCanvasElement;
  worker: Worker;
  sharedBuffer: SharedArrayBuffer;
  dataView: Uint8ClampedArray;
  renderer: Renderer;
  quadtree: Quadtree | null = null;
  camera: Camera;
  isRendering: boolean = false;
  frameCount: number = 0;

  constructor() {
    this.canvas = document.getElementById("mapCanvas") as HTMLCanvasElement;

    // Initialize Renderer
    this.renderer = new Renderer(this.canvas);

    // Initialize Camera
    this.camera = new Camera(this.canvas, CONFIG.width, CONFIG.height);

    this.resize();
    window.addEventListener("resize", () => this.resize());

    // Initialize Shared Memory
    // 4 bytes per pixel (R, G, B, A)
    const bufferSize = CONFIG.width * CONFIG.height * 4;
    try {
      this.sharedBuffer = new SharedArrayBuffer(bufferSize);
      console.log("SharedArrayBuffer created.");
    } catch (e) {
      console.warn(
        "SharedArrayBuffer not supported. Engine requires COOP/COEP headers.",
      );
      throw e;
    }

    this.dataView = new Uint8ClampedArray(this.sharedBuffer);

    // Initialize Worker
    this.worker = new Worker();
    this.worker.onmessage = this.handleWorkerMessage.bind(this);

    // Initialize Bridge
    initBridge({
      rebuildMap: (seed) => this.startGeneration(seed),
      setWaterLevel: (level) => {
        // TODO: Wire up to renderer uniform
        console.log("Water level set to:", level);
      },
    });

    // Start Generation
    this.startGeneration("default-seed");
  }

  resize() {
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.renderer.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  startGeneration(seed: string) {
    console.log("Starting generation...");
    const msg: WorkerInitMessage = {
      type: "init",
      buffer: this.sharedBuffer,
      width: CONFIG.width,
      height: CONFIG.height,
      seed: seed,
    };
    this.worker.postMessage(msg);
  }

  handleWorkerMessage(e: MessageEvent<WorkerCompleteMessage>) {
    if (e.data.type === "complete") {
      console.log("Generation complete!");

      // 1. Upload Texture
      this.renderer.updateTexture(this.dataView, CONFIG.width, CONFIG.height);

      // 2. Build Quadtree
      console.time("Build Quadtree");
      this.quadtree = new Quadtree(this.dataView, CONFIG.width, CONFIG.height);
      const nodes = this.quadtree.build();
      console.timeEnd("Build Quadtree");
      console.log(`Quadtree generated ${nodes.length} nodes`);

      // 3. Update Instances
      const instanceData = new Float32Array(nodes.length * 3);
      for (let i = 0; i < nodes.length; i++) {
        instanceData[i * 3 + 0] = nodes[i].x;
        instanceData[i * 3 + 1] = nodes[i].y;
        instanceData[i * 3 + 2] = nodes[i].size;
      }
      this.renderer.updateInstances(instanceData, nodes.length);

      // 4. Start Render Loop
      if (!this.isRendering) {
        this.isRendering = true;
        this.loop();
      }
    }
  }

  loop() {
    this.frameCount++;

    const matrix = this.camera.getMatrix();
    this.renderer.render(matrix);
    requestAnimationFrame(() => this.loop());
  }
}

new Engine();
