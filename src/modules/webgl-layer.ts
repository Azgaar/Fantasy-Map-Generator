import {
  Group,
  OrthographicCamera,
  Scene as ThreeScene,
  WebGLRenderer,
} from "three";

export interface WebGLLayerConfig {
  id: string;
  setup: (group: Group) => void; // called once after WebGL2 confirmed; add meshes to group
  render?: (group: Group) => void; // called each frame before renderer.render(); update uniforms/geometry
  dispose: (group: Group) => void; // called on unregister(); dispose all GPU objects in group
}
interface RegisteredLayer {
  config: WebGLLayerConfig;
  group: Group;
}

export class WebGL2LayerClass {
  private renderer: WebGLRenderer | null = null;
  private camera: OrthographicCamera | null = null;
  private scene: ThreeScene | null = null;
  private layers: Map<string, RegisteredLayer> = new Map();
  private pendingConfigs: WebGLLayerConfig[] = []; // queue for register() before init()
  private rafId: number | null = null;

  init(): boolean {
    const canvas = Scene.getCanvas();
    const { graphWidth, graphHeight } = Scene.getViewport();

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    canvas.style.width = `${graphWidth}px`;
    canvas.style.height = `${graphHeight}px`;
    this.renderer.setSize(graphWidth, graphHeight, false);
    this.scene = new ThreeScene();
    this.camera = new OrthographicCamera(0, graphWidth, 0, graphHeight, -1, 1);

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

  private syncTransform() {
    if (!this.camera) return;
    const { bottom, left, right, top } = Scene.getCameraBounds();

    this.camera.left = left;
    this.camera.right = right;
    this.camera.top = top;
    this.camera.bottom = bottom;
    this.camera.updateProjectionMatrix();
  }

  private render() {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.syncTransform();
    for (const layer of this.layers.values()) {
      if (layer.group.visible && layer.config.render)
        layer.config.render(layer.group);
    }
    this.renderer.render(this.scene, this.camera);
  }

  register(config: WebGLLayerConfig) {
    if (!this.scene) {
      // init() has not been called yet — queue for processing in init()
      this.pendingConfigs.push(config);
      return;
    }

    // Post-init registration: create group immediately
    const group = new Group();
    config.setup(group);
    this.scene.add(group);
    this.layers.set(config.id, { config, group });
  }

  setLayerVisible(id: string, visible: boolean) {
    const layer = this.layers.get(id);
    if (!layer) return;
    layer.group.visible = visible;
    this.rerender();
  }

  unregister(id: string) {
    const layer = this.layers.get(id);
    if (!layer) return;
    layer.config.dispose(layer.group);
    this.scene?.remove(layer.group);
    this.layers.delete(id);
  }

  rerender() {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.render();
    });
  }
}

declare global {
  var WebGLLayer: WebGL2LayerClass;
}

window.WebGLLayer = new WebGL2LayerClass();
