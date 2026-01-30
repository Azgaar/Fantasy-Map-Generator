import"./modulepreload-polyfill-B5Qt9EMX.js";function u(h){window.MapController=h,console.log("MapController API initialized")}class f{x=0;y=0;zoom=1;worldWidth;worldHeight;canvas;constructor(t,e,r){this.canvas=t,this.worldWidth=e,this.worldHeight=r,this.x=e/2,this.y=r/2,this.attachControls()}getMatrix(){const t=this.canvas.width/this.canvas.height,e=this.worldWidth/this.zoom,r=e/t,i=2/e,s=2/r;return new Float32Array([i,0,0,0,-s,0,-this.x*i,this.y*s,1])}attachControls(){let t=!1,e=0,r=0;this.canvas.addEventListener("mousedown",i=>{t=!0,e=i.clientX,r=i.clientY}),window.addEventListener("mouseup",()=>{t=!1}),this.canvas.addEventListener("mousemove",i=>{if(!t)return;const s=i.clientX-e,o=i.clientY-r;e=i.clientX,r=i.clientY;const l=this.worldWidth/this.zoom/this.canvas.width;this.x-=s*l,this.y-=o*l}),this.canvas.addEventListener("wheel",i=>{i.preventDefault();const s=1.1,o=i.deltaY<0?s:1/s,a=Math.max(.1,Math.min(this.zoom*o,100));this.zoom=a},{passive:!1})}}class g{nodes=[];data;width;height;threshold;constructor(t,e,r,i=20){this.data=t,this.width=e,this.height=r,this.threshold=i}build(){return this.nodes=[],this.split(0,0,this.width),this.nodes}queryRange(t,e,r,i){const s=[];for(let o=0;o<this.nodes.length;o++){const a=this.nodes[o];a.x<r&&a.x+a.size>t&&a.y<i&&a.y+a.size>e&&s.push(a)}return s}split(t,e,r){if(r<=1){this.nodes.push({x:t,y:e,size:r});return}if(this.shouldSplit(t,e,r)){const i=r/2;this.split(t,e,i),this.split(t+i,e,i),this.split(t,e+i,i),this.split(t+i,e+i,i)}else this.nodes.push({x:t,y:e,size:r})}shouldSplit(t,e,r){if(t>=this.width||e>=this.height)return!1;let i=255,s=0;const o=Math.max(1,Math.floor(r/8));for(let a=e;a<e+r&&!(a>=this.height);a+=o)for(let l=t;l<t+r&&!(l>=this.width);l+=o){const d=(a*this.width+l)*4,c=this.data[d];if(c<i&&(i=c),c>s&&(s=c),s-i>this.threshold)return!0}return!1}}class v{canvas;gl;program=null;quadBuffer=null;instanceBuffer=null;dataTexture=null;locations;instanceCount=0;constructor(t){this.canvas=t;const e=t.getContext("webgl2",{preserveDrawingBuffer:!0});if(!e)throw new Error("WebGL2 not supported");this.gl=e,this.initShaders(),this.initBuffers(),this.initTexture(),this.locations={a_position:0,a_instanceInfo:1,u_viewMatrix:null,u_gridSize:null,u_dataTexture:null},this.gl.enable(this.gl.BLEND),this.gl.blendFunc(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA)}initShaders(){const t=this.gl,e=`#version 300 es
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
        }`,r=`#version 300 es
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
        }`,i=this.createShader(t.VERTEX_SHADER,e),s=this.createShader(t.FRAGMENT_SHADER,r);if(this.program=t.createProgram(),t.attachShader(this.program,i),t.attachShader(this.program,s),t.linkProgram(this.program),!t.getProgramParameter(this.program,t.LINK_STATUS))throw new Error(`Shader program link error: ${t.getProgramInfoLog(this.program)}`);this.locations={a_position:0,a_instanceInfo:1,u_viewMatrix:t.getUniformLocation(this.program,"u_viewMatrix"),u_gridSize:t.getUniformLocation(this.program,"u_gridSize"),u_dataTexture:t.getUniformLocation(this.program,"u_dataTexture")}}createShader(t,e){const r=this.gl.createShader(t);if(this.gl.shaderSource(r,e),this.gl.compileShader(r),!this.gl.getShaderParameter(r,this.gl.COMPILE_STATUS)){const i=this.gl.getShaderInfoLog(r);throw this.gl.deleteShader(r),new Error(`Shader compile error: ${i}`)}return r}initBuffers(){const t=this.gl,e=new Float32Array([0,0,1,0,0,1,1,0,1,1,0,1]);this.quadBuffer=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.bufferData(t.ARRAY_BUFFER,e,t.STATIC_DRAW),this.instanceBuffer=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,this.instanceBuffer),t.bufferData(t.ARRAY_BUFFER,1e5*3*4,t.DYNAMIC_DRAW)}initTexture(){const t=this.gl;this.dataTexture=t.createTexture(),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,this.dataTexture),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.NEAREST),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.NEAREST),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE)}updateTexture(t,e,r){const i=this.gl;i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,this.dataTexture),i.texImage2D(i.TEXTURE_2D,0,i.RGBA,e,r,0,i.RGBA,i.UNSIGNED_BYTE,t),i.useProgram(this.program),i.uniform1i(this.locations.u_dataTexture,0),i.uniform2f(this.locations.u_gridSize,e,r)}updateInstances(t,e){const r=this.gl;r.bindBuffer(r.ARRAY_BUFFER,this.instanceBuffer),r.bufferData(r.ARRAY_BUFFER,t,r.DYNAMIC_DRAW),this.instanceCount=e}render(t){const e=this.gl;e.clear(e.COLOR_BUFFER_BIT),e.useProgram(this.program),e.uniformMatrix3fv(this.locations.u_viewMatrix,!1,t),e.bindBuffer(e.ARRAY_BUFFER,this.quadBuffer),e.enableVertexAttribArray(this.locations.a_position),e.vertexAttribPointer(this.locations.a_position,2,e.FLOAT,!1,0,0),e.vertexAttribDivisor(this.locations.a_position,0),e.bindBuffer(e.ARRAY_BUFFER,this.instanceBuffer),e.enableVertexAttribArray(this.locations.a_instanceInfo),e.vertexAttribPointer(this.locations.a_instanceInfo,3,e.FLOAT,!1,0,0),e.vertexAttribDivisor(this.locations.a_instanceInfo,1),e.drawArraysInstanced(e.TRIANGLES,0,6,this.instanceCount),e.vertexAttribDivisor(this.locations.a_instanceInfo,0)}}function m(h){return new Worker(""+new URL("generation.worker-Cg35tNCA.js",import.meta.url).href,{name:h?.name})}console.log("Fantasy Map Engine Initialized");const n={width:1024,height:1024};class w{canvas;worker;sharedBuffer;dataView;renderer;quadtree=null;camera;isRendering=!1;frameCount=0;constructor(){this.canvas=document.getElementById("mapCanvas"),this.renderer=new v(this.canvas),this.camera=new f(this.canvas,n.width,n.height),this.resize(),window.addEventListener("resize",()=>this.resize());const t=n.width*n.height*4;try{this.sharedBuffer=new SharedArrayBuffer(t),console.log("SharedArrayBuffer created.")}catch(e){throw console.warn("SharedArrayBuffer not supported. Engine requires COOP/COEP headers."),e}this.dataView=new Uint8ClampedArray(this.sharedBuffer),this.worker=new m,this.worker.onmessage=this.handleWorkerMessage.bind(this),u({rebuildMap:e=>this.startGeneration(e),setWaterLevel:e=>{console.log("Water level set to:",e)}}),this.startGeneration("default-seed")}resize(){this.canvas&&(this.canvas.width=window.innerWidth,this.canvas.height=window.innerHeight,this.renderer.gl.viewport(0,0,this.canvas.width,this.canvas.height))}startGeneration(t){console.log("Starting generation...");const e={type:"init",buffer:this.sharedBuffer,width:n.width,height:n.height,seed:t};this.worker.postMessage(e)}handleWorkerMessage(t){if(t.data.type==="complete"){console.log("Generation complete!"),this.renderer.updateTexture(this.dataView,n.width,n.height),console.time("Build Quadtree"),this.quadtree=new g(this.dataView,n.width,n.height);const e=this.quadtree.build();console.timeEnd("Build Quadtree"),console.log(`Quadtree generated ${e.length} nodes`);const r=new Float32Array(e.length*3);for(let i=0;i<e.length;i++)r[i*3+0]=e[i].x,r[i*3+1]=e[i].y,r[i*3+2]=e[i].size;this.renderer.updateInstances(r,e.length),this.isRendering||(this.isRendering=!0,this.loop())}}loop(){this.frameCount++;const t=this.camera.getMatrix();this.renderer.render(t),requestAnimationFrame(()=>this.loop())}}new w;
