"use strict";

// Define variables - these make it easy to work with from the console
let _3dpreviewScale = 70;
let _3dpreviewCamera = null;
let _3dpreviewScene = null;
let _3dpreviewRenderer = null;
let _3danimationFrame = null;
let _3dmaterial = null;
let _3dmesh = null;

// Create a mesh from pixel data
async function addMesh(width, height, segmentsX, segmentsY) {
  const _3dgeometry = new THREE.PlaneGeometry(width, height, segmentsX-1, segmentsY-1);
  const _3dmaterial = new THREE.MeshBasicMaterial({wireframe: false});
  const url = await getMapURL("mesh");
  _3dmaterial.map = new THREE.TextureLoader().load(url);
  _3dgeometry.vertices.forEach((v, i) => v.z = getMeshHeight(i));
  _3dmesh = new THREE.Mesh(_3dgeometry, _3dmaterial);
  _3dmesh.rotation.x = -Math.PI / 2;
  _3dpreviewScene.add(_3dmesh);
}

function getMeshHeight(i) {
  const h = grid.cells.h[i];
  return h < 20 ? 0 : (h - 18) / 82 * _3dpreviewScale;
}

// Function to render scene and camera
function render() {
  _3danimationFrame = requestAnimationFrame(render);
  _3dpreviewRenderer.render(_3dpreviewScene, _3dpreviewCamera);
}

async function start3dpreview(canvas) {
  const loaded = await loadTHREE();
  if (!loaded) {
    tip("Cannot load 3d library", false, "error", 4000); 
    return false;
  };
  _3dpreviewScene = new THREE.Scene();
  _3dpreviewCamera = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, 0.1, 100000);
  _3dpreviewCamera.position.x = 0;
  _3dpreviewCamera.position.z = 350;
  _3dpreviewCamera.position.y = 285;
  _3dpreviewRenderer = new THREE.WebGLRenderer({canvas});
  OrbitControls(_3dpreviewCamera, _3dpreviewRenderer.domElement);
  _3dpreviewRenderer.setSize(canvas.width, canvas.height);
  addMesh(graphWidth, graphHeight, grid.cellsX, grid.cellsY);
  _3danimationFrame = requestAnimationFrame(render);
  return true;
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
  if (THREE.OrbitControls) {
    new THREE.OrbitControls(camera, domElement);
    return;
  }

  const script = document.createElement('script');
  script.src = "libs/orbitControls.min.js"
  document.head.append(script);
  script.onload = () => new THREE.OrbitControls(camera, domElement);
}

function update3dpreview(canvas) {
  _3dpreviewScene.remove(_3dmesh);
  _3dpreviewRenderer.setSize(canvas.width, canvas.height);
  addMesh(graphWidth, graphHeight, grid.cellsX, grid.cellsY);
}

function stop3dpreview() {
  cancelAnimationFrame(_3danimationFrame);
  _3danimationFrame = null;
  _3dmesh = undefined;
  _3dmaterial = undefined;
  _3dpreviewScene = null;
  _3dpreviewRenderer = null;
}