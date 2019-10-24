"use strict";
let threeD = {}; // master object for 3d scane and parameters
let threeDscale = 50; // 3d scene scale

// start 3d view and heightmap edit preview
async function start3d(canvas) {
  const loaded = await loadTHREE();
  if (!loaded) {tip("Cannot load 3d library", false, "error", 4000); return false};

  threeD.scene = new THREE.Scene();
  //threeD.scene.background = new THREE.Color(0x53679f);
  threeD.camera = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, 0.1, 2000);
  threeD.camera.position.x = 0;
  threeD.camera.position.z = 350;
  threeD.camera.position.y = 285;
  threeD.Renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  threeD.controls = await OrbitControls(threeD.camera, threeD.Renderer.domElement);
  threeD.controls.minDistance = 10; threeD.controls.maxDistance = 1000;
  threeD.controls.maxPolarAngle = Math.PI/2;
  threeD.controls.keys = {};

  threeD.Renderer.setSize(canvas.width, canvas.height);
  add3dMesh(graphWidth, graphHeight, grid.cellsX, grid.cellsY);

  const ambientLight = new THREE.AmbientLight(0xcccccc, .7);
  threeD.scene.add(ambientLight);
  const spotLight = new THREE.SpotLight(0xcccccc, .8, 2000, .7, 0, 0);
  spotLight.position.set(100, 600, 1000);
  spotLight.castShadow = true;
  threeD.scene.add(spotLight);
  //threeD.scene.add(new THREE.SpotLightHelper(spotLight));

  threeD.controls.addEventListener("change", render);
  return true;
}

// create a mesh from pixel data
async function add3dMesh(width, height, segmentsX, segmentsY) {
  const geometry = new THREE.PlaneGeometry(width, height, segmentsX-1, segmentsY-1);

  // generateTexture
  //threeD.material = new THREE.MeshBasicMaterial();
  //const texture = new THREE.CanvasTexture(generateTexture(grid.cells.h, grid.cellsX, grid.cellsY));
  //threeD.material.map = texture;

  const url = await getMapURL("mesh");
  threeD.material = new THREE.MeshLambertMaterial();
  const texture = new THREE.TextureLoader().load(url, render);
  texture.needsUpdate = true;
  threeD.material.map = texture;

  geometry.vertices.forEach((v, i) => v.z = getMeshHeight(i));
  geometry.computeVertexNormals(); // added
  threeD.Renderer.shadowMap.enabled = true;  // added
  threeD.mesh = new THREE.Mesh(geometry, threeD.material);
  threeD.mesh.rotation.x = -Math.PI / 2;
  threeD.mesh.castShadow = true;
  threeD.mesh.receiveShadow = true;
  threeD.scene.add(threeD.mesh);
}

function getMeshHeight(i) {
  const h = grid.cells.h[i];
  return h < 20 ? 0 : (h - 18) / 82 * threeDscale;
}

function generateTexture(data, width, height) {
  let context, image, imageData;
  const vector3 = new THREE.Vector3(0, 0, 0);
  const sun = new THREE.Vector3(1, 1, 1);
  sun.normalize();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  context = canvas.getContext('2d');
  context.fillStyle = '#000';
  context.fillRect(0, 0, width, height);

  image = context.getImageData(0, 0, canvas.width, canvas.height);
  imageData = image.data;

  for (let i = 0, j = 0; i < imageData.length; i += 4, j ++) {
    vector3.x = data[j - 2] - data[j + 2];
    vector3.y = 2;
    vector3.z = data[j - width * 2] - data[j + width * 2];
    vector3.normalize();

    const shade = vector3.dot(sun);
    // initial: r 96 + shade * 128, g 32 + shade * 96, b shade * 96;
    const clr = (shade * 255) * (.5 + data[j] * .007); // new: black and white
    imageData[i] = imageData[i + 1] = imageData[i + 2] = clr;
  }
  context.putImageData(image, 0, 0);

  const canvasScaled = document.createElement('canvas');
  canvasScaled.width = width * 4;
  canvasScaled.height = height * 4;
  context = canvasScaled.getContext('2d');
  context.scale(4, 4);
  context.drawImage(canvas, 0, 0);

  image = context.getImageData(0, 0, canvasScaled.width, canvasScaled.height);
  imageData = image.data;

  for (let i = 0; i < imageData.length; i += 4) {
    const v = ~~(Math.random() * 5);
    imageData[i] += v;
    imageData[i + 1] += v;
    imageData[i + 2] += v;
  }
  context.putImageData(image, 0, 0);
  return canvasScaled;
}

function loadTHREE() {
  if (window.THREE) return Promise.resolve(true);

  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = "libs/three.min.js"
    document.head.append(script);
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
  });
}

function OrbitControls(camera, domElement) {
  if (THREE.OrbitControls) new THREE.OrbitControls(camera, domElement);

  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = "libs/orbitControls.min.js"
    document.head.append(script);
    script.onload = () => resolve(new THREE.OrbitControls(camera, domElement));
    script.onerror = () => resolve(false);
  });
}

function update3dPreview(canvas) {
  threeD.scene.remove(threeD.mesh);
  threeD.Renderer.setSize(canvas.width, canvas.height);
  if (canvas.dataset.type === "viewGlobe") addGlobe3dMesh();
  else add3dMesh(graphWidth, graphHeight, grid.cellsX, grid.cellsY);
  render();
}

async function update3d() {
  const url = await getMapURL("mesh");
  threeD.material.map = new THREE.TextureLoader().load(url, render);
}

function stop3d() {
  if (!threeD.controls || !threeD.Renderer) return;
  threeD.controls.dispose();
  threeD.Renderer.dispose()
  cancelAnimationFrame(threeD.animationFrame);
  threeD = {};
}

async function startGlobe(canvas) {
  const loaded = await loadTHREE();
  if (!loaded) {tip("Cannot load 3d library", false, "error", 4000); return false};

  threeD.scene = new THREE.Scene();
  threeD.scene.background = new THREE.TextureLoader().load("https://i0.wp.com/azgaar.files.wordpress.com/2019/10/stars.png", render);
  threeD.Renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  threeD.Renderer.setSize(canvas.width, canvas.height);

  threeD.camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 1000).translateZ(5);
  threeD.controls = await OrbitControls(threeD.camera, threeD.Renderer.domElement);
  threeD.controls.minDistance = 1.8; threeD.controls.maxDistance = 10;
  threeD.controls.autoRotate = true;
  threeD.controls.keys = {};

  const ambientLight = new THREE.AmbientLight(0xcccccc, .9);
  threeD.scene.add(ambientLight);
  const spotLight = new THREE.SpotLight(0xcccccc, .6, 200, .7, .1, 0);
  spotLight.position.set(700, 300, 200);
  spotLight.castShadow = false;
  threeD.scene.add(spotLight);
  //threeD.scene.add(new THREE.SpotLightHelper(spotLight));

  addGlobe3dMesh();
  threeD.controls.addEventListener("change", render);
  threeD.animationFrame = requestAnimationFrame(animate);
  return true;
}

// create globe mesh just from svg
async function addGlobe3dMesh() {
  threeD.material = new THREE.MeshLambertMaterial();
  const url = await getMapURL("mesh", "globe");
  threeD.material.map = new THREE.TextureLoader().load(url, render);
  threeD.mesh = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 64, 64), threeD.material);
  threeD.scene.add(threeD.mesh);
}

// render 3d scene and camera, do only on controls change
function render() {
  threeD.Renderer.render(threeD.scene, threeD.camera);
}

// animate 3d scene and camera
function animate() {
  threeD.animationFrame = requestAnimationFrame(animate);
  threeD.controls.update();
  threeD.Renderer.render(threeD.scene, threeD.camera);
}

function toggleRotation() {
  const rotate = threeD.controls.autoRotate = !threeD.controls.autoRotate;
  rotate ? requestAnimationFrame(animate) : cancelAnimationFrame(threeD.animationFrame);
}

// download screenshot
async function saveScreenshot() {
  const URL = threeD.Renderer.domElement.toDataURL("image/jpeg");
  const link = document.createElement("a");
  link.download = getFileName() + ".jpeg";
  link.href = URL;
  document.body.appendChild(link);
  link.click();
  tip(`Screenshot is saved. Open "Downloads" screen (CTRL + J) to check`, true, "success", 7000);
  window.setTimeout(() => window.URL.revokeObjectURL(URL), 5000);
}