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
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;

  init(): boolean {
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.scene = new Scene();
    this.camera = new OrthographicCamera(
      0,
      window.innerWidth,
      0,
      window.innerHeight,
      -1,
      1,
    );

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
    // this.observeResize();

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
    if (!this.camera) return;
    const width = window.innerWidth || 960;
    const height = window.innerHeight || 540;
    console.log("WebGL2Layer: syncTransform", { width, height });
    this.camera.left = (0 - viewX) / scale;
    this.camera.right = (width - viewX) / scale;
    this.camera.top = (0 - viewY) / scale;
    this.camera.bottom = (height - viewY) / scale;
    this.camera.updateProjectionMatrix();
  }

  private observeResize(): void {
    if (!this.renderer) return;
    this.resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (this.renderer && width > 0 && height > 0) {
        this.renderer.setSize(width, height, false);
        this.requestRender();
      }
    });
    this.resizeObserver.observe(this.canvas);
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
