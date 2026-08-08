import * as THREE from "three";
import { AppState } from "../state/store";

export class ThreeRenderer {
  private container: HTMLDivElement;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private mesh!: THREE.Mesh;
  private animationFrameId: number | null = null;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.init();
  }

  private init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0c);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
    this.camera.position.set(0, 150, 250);
    this.camera.lookAt(0, 0, 0);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 200, 50);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    // Add a simple grid helper
    const gridHelper = new THREE.GridHelper(400, 40, 0x4f46e5, 0x222225);
    gridHelper.position.y = -10;
    this.scene.add(gridHelper);
  }

  updateTerrain(state: AppState) {
    if (!state.grid || !state.heights) return;

    // Remove old mesh if exists
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach(m => m.dispose());
      } else {
        this.mesh.material.dispose();
      }
    }

    // Interpolate heights onto a regular 3D Plane grid (e.g. 64x64 segments)
    const segs = 60;
    const geo = new THREE.PlaneGeometry(300, 200, segs, segs);
    
    // Rotate geometry to lay flat on horizontal XZ plane
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors: number[] = [];

    // Map Voronoi points onto regular grid coordinates
    const gridWidth = state.width;
    const gridHeight = state.height;

    const findClosestHeight = (tx: number, ty: number): number => {
      // Maps localized [-150, 150] X & [-100, 100] Z coordinates back to grid width/height
      const gx = ((tx + 150) / 300) * gridWidth;
      const gy = ((ty + 100) / 200) * gridHeight;

      let minDist = Infinity;
      let closestHeight = 0;
      const points = state.grid!.points;
      const heights = state.heights!;
      for (let i = 0; i < points.length; i++) {
        const [px, py] = points[i];
        const dist = Math.pow(gx - px, 2) + Math.pow(gy - py, 2);
        if (dist < minDist) {
          minDist = dist;
          closestHeight = heights[i];
        }
      }
      return closestHeight;
    };

    // Populate vertex heights and build vertex colors
    const colorObj = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i); // Note: Y in Three is height, plane coordinates lie on XZ
      
      const h = findClosestHeight(vx, vz);
      
      // Extrude height (h is 0-100, we scale it)
      const heightExtrusion = h < 20 ? (h - 20) * 0.1 : (h - 20) * 0.4;
      pos.setY(i, heightExtrusion);

      // Color mapping: water is blue, land is green/brown
      if (h < 20) {
        colorObj.setRGB(0.1, 0.2, 0.4 + (h / 20) * 0.4);
      } else {
        const ratio = (h - 20) / 80;
        if (ratio < 0.4) {
          colorObj.setRGB(0.2 + ratio * 0.2, 0.5 + ratio * 0.2, 0.1);
        } else {
          colorObj.setRGB(0.5 + ratio * 0.4, 0.4 + ratio * 0.4, 0.3);
        }
      }
      colors.push(colorObj.r, colorObj.g, colorObj.b);
    }

    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.1,
      flatShading: true
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
  }

  startAnimation() {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      
      // Gentle rotation for dynamic visual effect
      if (this.mesh) {
        this.mesh.rotation.y += 0.002;
      }
      
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  stopAnimation() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  destroy() {
    this.stopAnimation();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
