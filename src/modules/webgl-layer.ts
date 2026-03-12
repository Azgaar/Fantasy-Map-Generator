import { Group, OrthographicCamera, Scene, WebGLRenderer } from "three";
import { byId } from "../utils";

export interface WebGLLayerConfig {
  id: string;
  setup: (group: Group) => void; // called once after WebGL2 confirmed; add meshes to group
  render: (group: Group) => void; // called each frame before renderer.render(); update uniforms/geometry
  dispose: (group: Group) => void; // called on unregister(); dispose all GPU objects in group
}
interface RegisteredLayer {
  config: WebGLLayerConfig;
  group: Group;
}

export class WebGL2LayerClass {
  private canvas = byId("webgl-canvas")!;
  private renderer: WebGLRenderer | null = null;
  private camera: OrthographicCamera | null = null;
  private scene: Scene | null = null;
  private layers: Map<string, RegisteredLayer> = new Map();
  private pendingConfigs: WebGLLayerConfig[] = []; // queue for register() before init()
  private rafId: number | null = null;

  init(): boolean {
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.canvas.style.width = `${graphWidth}px`;
    this.canvas.style.height = `${graphHeight}px`;
    this.renderer.setSize(graphWidth, graphHeight, false);
    this.scene = new Scene();
    this.camera = new OrthographicCamera(0, graphWidth, 0, graphHeight, -1, 1);

    console.log("WebGL2Layer: initialized");

    svg.on("zoom.webgl", () => this.requestRender());

    // Process pre-init registrations (register() before init() is explicitly safe)
    for (const config of this.pendingConfigs) {
      const group = new Group();
      config.setup(group);
      this.scene.add(group);
      this.layers.set(config.id, { config, group });
    }
    this.pendingConfigs = [];

    return true;
  }

  register(config: WebGLLayerConfig): void {
    if (!this.scene) {
      // init() has not been called yet — queue for processing in init()
      this.pendingConfigs.push(config);
      return;
    }

    // Post-init registration: create group immediately
    const group = new Group();
    // group.renderOrder = config.renderOrder;
    config.setup(group);
    this.scene.add(group);
    this.layers.set(config.id, { config, group });
  }

  unregister(id: string): void {
    const layer = this.layers.get(id);
    if (!layer || !this.scene) return;
    const scene = this.scene;
    layer.config.dispose(layer.group);
    scene.remove(layer.group);
    this.layers.delete(id);
    const anyVisible = [...this.layers.values()].some((l) => l.group.visible);
    if (this.canvas && !anyVisible) this.canvas.style.display = "none";
  }

  setVisible(id: string, visible: boolean): void {
    const layer = this.layers.get(id);
    if (!layer) return;
    layer.group.visible = visible;
    const anyVisible = [...this.layers.values()].some((l) => l.group.visible);
    if (this.canvas) this.canvas.style.display = anyVisible ? "block" : "none";
    if (visible) this.requestRender();
  }

  clearLayer(id: string): void {
    const layer = this.layers.get(id);
    if (!layer) return;
    layer.group.clear();
    this.requestRender();
  }

  requestRender(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.render();
    });
  }

  syncTransform(): void {
    console.log("WebGL2Layer: syncing transform", {
      viewX,
      viewY,
      scale,
      graphWidth,
      graphHeight,
    });
    if (!this.camera) return;
    const x = -viewX / scale;
    const y = -viewY / scale;
    const w = graphWidth / scale;
    const h = graphHeight / scale;

    this.camera.left = x;
    this.camera.right = x + w;
    this.camera.top = y;
    this.camera.bottom = y + h;
    this.camera.updateProjectionMatrix();
  }

  private render(): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.syncTransform();
    for (const layer of this.layers.values()) {
      if (layer.group.visible) layer.config.render(layer.group);
    }
    this.renderer.render(this.scene, this.camera);
  }
}

declare global {
  var WebGLLayer: WebGL2LayerClass;
}

window.WebGLLayer = new WebGL2LayerClass();
