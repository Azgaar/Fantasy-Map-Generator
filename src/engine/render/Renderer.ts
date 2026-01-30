export class Renderer {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  program: WebGLProgram | null = null;

  // Buffers
  quadBuffer: WebGLBuffer | null = null;
  instanceBuffer: WebGLBuffer | null = null;

  // Texture
  dataTexture: WebGLTexture | null = null;

  // Locations
  locations: {
    a_position: number;
    a_instanceInfo: number; // x, y, size
    u_viewMatrix: WebGLUniformLocation | null;
    u_gridSize: WebGLUniformLocation | null;
    u_dataTexture: WebGLUniformLocation | null;
  };

  instanceCount: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 not supported");
    this.gl = gl;

    this.initShaders();
    this.initBuffers();
    this.initTexture();

    // Default locations object (will be populated in initShaders)
    this.locations = {
      a_position: 0,
      a_instanceInfo: 1,
      u_viewMatrix: null,
      u_gridSize: null,
      u_dataTexture: null,
    };

    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
  }

  private initShaders() {
    const gl = this.gl;

    const vsSource = `#version 300 es
        layout(location=0) in vec2 a_position; // 0..1 quad
        layout(location=1) in vec3 a_instanceInfo; // x, y, size

        uniform mat3 u_viewMatrix;
        uniform vec2 u_gridSize;

        out vec2 v_uv;
        out float v_height;

        void main() {
            // Calculate world position of this pixel in the quad
            float size = a_instanceInfo.z;
            vec2 worldPos = a_instanceInfo.xy + a_position * size;

            vec2 viewPos = (u_viewMatrix * vec3(worldPos, 1.0)).xy;

            gl_Position = vec4(viewPos, 0.0, 1.0);

            // UV for texture lookup (normalized 0..1 relative to whole grid)
            v_uv = worldPos / u_gridSize;
        }`;

    const fsSource = `#version 300 es
        precision highp float;

        uniform sampler2D u_dataTexture;

        in vec2 v_uv;

        out vec4 outColor;

        void main() {
            vec4 data = texture(u_dataTexture, v_uv);
            float height = data.r;
            float moisture = data.g;

            vec3 color;

            if (height < 0.2) {
                color = vec3(0.0, 0.2, 0.6); // Deep Ocean
            } else if (height < 0.25) {
                color = vec3(0.0, 0.4, 0.8); // Shallow Water
            } else if (height < 0.28) {
                color = vec3(0.9, 0.8, 0.6); // Beach
            } else if (height < 0.6) {
                // Land gradient based on moisture
                color = mix(vec3(0.8, 0.7, 0.4), vec3(0.1, 0.6, 0.1), moisture);
            } else if (height < 0.8) {
                color = vec3(0.4, 0.4, 0.4); // Rock
            } else {
                color = vec3(1.0, 1.0, 1.0); // Snow
            }

            // Debug: Use direct height if texture fetch is working
            // color = vec3(height, height, height);

            outColor = vec4(color, 1.0);
        }`;

    const vertexShader = this.createShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fsSource);

    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error(
        `Shader program link error: ${gl.getProgramInfoLog(this.program)}`,
      );
    }

    // Cache locations
    this.locations = {
      a_position: 0, // Explicitly set in layout
      a_instanceInfo: 1,
      u_viewMatrix: gl.getUniformLocation(this.program, "u_viewMatrix"),
      u_gridSize: gl.getUniformLocation(this.program, "u_gridSize"),
      u_dataTexture: gl.getUniformLocation(this.program, "u_dataTexture"),
    };
  }

  private createShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${info}`);
    }
    return shader;
  }

  private initBuffers() {
    const gl = this.gl;

    // Quad Geometry (0,0 to 1,1)
    const quadVerts = new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]);

    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    // Instance Buffer (Dynamic)
    this.instanceBuffer = gl.createBuffer();
    // Initial size reserved for ~100k instances (3 floats per instance = 1.2MB)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    // Using DYNAMIC_DRAW for frequent updates
    gl.bufferData(gl.ARRAY_BUFFER, 100000 * 3 * 4, gl.DYNAMIC_DRAW);
  }

  private initTexture() {
    const gl = this.gl;
    this.dataTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);

    // Initial parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  updateTexture(data: Uint8ClampedArray, width: number, height: number) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data,
    );

    gl.useProgram(this.program);
    gl.uniform1i(this.locations.u_dataTexture, 0); // Explicitly set sampler to texture unit 0
    gl.uniform2f(this.locations.u_gridSize, width, height);
  }

  updateInstances(instances: Float32Array, count: number) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);

    // Reallocate buffer every time to avoid sync issues or subdata offset issues
    gl.bufferData(gl.ARRAY_BUFFER, instances, gl.DYNAMIC_DRAW);
    this.instanceCount = count;
  }

  render(viewMatrix: Float32Array) {
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT); // Clear buffer

    gl.useProgram(this.program);

    // Bind Uniforms
    gl.uniformMatrix3fv(this.locations.u_viewMatrix, false, viewMatrix);

    // Bind Geometry
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.locations.a_position);
    gl.vertexAttribPointer(this.locations.a_position, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(this.locations.a_position, 0); // Ensure 0

    // Bind Instances
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.enableVertexAttribArray(this.locations.a_instanceInfo);
    gl.vertexAttribPointer(
      this.locations.a_instanceInfo,
      3,
      gl.FLOAT,
      false,
      0,
      0,
    );
    gl.vertexAttribDivisor(this.locations.a_instanceInfo, 1); // 1 per instance

    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.instanceCount);

    // Cleanup divisor
    gl.vertexAttribDivisor(this.locations.a_instanceInfo, 0);
  }
}
