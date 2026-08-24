import { Buffer, BufferUsage, Geometry, Mesh, Shader } from "pixi.js";
import type { RendererResourceTracker } from "../../core/resource-budget";
import { type CellFillAttributeSource, updateCellFillAttributes } from "../../scene/layers/cell-fill-attributes";
import { buildCellFillScene, type CellLayerId } from "../../scene/layers/cell-fill-scene";
import type { RetainedCellTopology } from "../../scene/layers/retained-cell-topology";

const vertex = /* glsl */ `
  in vec2 aPosition;
  in vec4 aColor;
  out vec4 vColor;

  uniform mat3 uProjectionMatrix;
  uniform mat3 uWorldTransformMatrix;
  uniform mat3 uTransformMatrix;
  uniform vec4 uWorldColorAlpha;
  uniform vec4 uColor;

  void main(void) {
    mat3 matrix = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((matrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vColor = aColor * uColor * uWorldColorAlpha;
  }
`;

const fragment = /* glsl */ `
  in vec4 vColor;
  out vec4 finalColor;

  void main(void) {
    finalColor = vColor;
  }
`;

export class RetainedCellMesh {
  readonly mesh: Mesh<Geometry, Shader>;
  private readonly colorBuffer: Buffer;
  private readonly geometry: Geometry;
  private readonly shader: Shader;
  private readonly resourceIds: readonly string[];
  private static sequence = 0;

  constructor(
    private readonly topology: RetainedCellTopology,
    source: CellFillAttributeSource,
    layer: CellLayerId,
    private readonly resources?: RendererResourceTracker
  ) {
    const scene = buildCellFillScene(topology, source, layer);
    const resourcePrefix = `retained-cells:${++RetainedCellMesh.sequence}`;
    this.resourceIds = [`${resourcePrefix}:positions`, `${resourcePrefix}:colors`, `${resourcePrefix}:indices`];
    resources?.acquire(this.resourceIds[0], "geometry", scene.positions.byteLength);
    resources?.acquire(this.resourceIds[1], "geometry", scene.colors?.byteLength ?? 0);
    resources?.acquire(this.resourceIds[2], "geometry", scene.indices.byteLength);
    const positionBuffer = new Buffer({
      data: scene.positions,
      label: "retained-cell-positions",
      usage: BufferUsage.VERTEX | BufferUsage.STATIC
    });
    this.colorBuffer = new Buffer({
      data: scene.colors,
      label: "retained-cell-colors",
      shrinkToFit: false,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST
    });
    const indexBuffer = new Buffer({
      data: scene.indices,
      label: "retained-cell-indices",
      usage: BufferUsage.INDEX | BufferUsage.STATIC
    });
    this.geometry = new Geometry({
      attributes: {
        aColor: { buffer: this.colorBuffer, format: "float32x4" },
        aPosition: { buffer: positionBuffer, format: "float32x2" }
      },
      indexBuffer,
      topology: "triangle-list"
    });
    this.shader = Shader.from({ gl: { fragment, name: "retained-cell-fill", vertex }, resources: {} });
    this.mesh = new Mesh({ geometry: this.geometry, shader: this.shader });
    this.mesh.cullable = true;
    this.mesh.eventMode = "none";
  }

  update(source: CellFillAttributeSource, cellIds: Iterable<number>): void {
    const update = updateCellFillAttributes(this.colorBuffer.data as Float32Array, this.topology, source, cellIds);
    if (update) this.colorBuffer.update();
  }

  destroy(): void {
    this.mesh.removeFromParent();
    this.mesh.destroy();
    this.geometry.destroy();
    this.shader.destroy();
    for (const resourceId of this.resourceIds) this.resources?.release(resourceId);
  }
}
