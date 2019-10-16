// Define variables - these make it easy to work with from the console
var _3dpreviewScale = 50;
var _3dpreviewCamera = null;
var _3dpreviewScene = null;
var _3dpreviewRenderer = null;
var _3danimationFrame = null;
var _3dmaterial = null;
var _3dtexture = null;
var _3dmesh = null;

// Create a mesh from pixel data
function addMesh(width, height, segmentsX, segmentsY) {
  _3dgeometry = new THREE.PlaneGeometry(width, height, segmentsX-1, segmentsY-1);

  _3dmaterial = new THREE.MeshBasicMaterial({
    wireframe: false,
  });

  _3dtexture = new THREE.TextureLoader().load( getPreviewTexture(width, height) );
//  _3dtexture.minFilter = THREE.LinearFilter;
  _3dmaterial.map = _3dtexture;

  var terrain = getHeightmap();

  var l = _3dgeometry.vertices.length;

  for (var i = 0; i < l; i++) // For each vertex
  {
    var terrainValue = terrain[i] / 255;
    _3dgeometry.vertices[i].z = _3dgeometry.vertices[i].z + terrainValue * _3dpreviewScale; 
  }

  _3dmesh = new THREE.Mesh(_3dgeometry, _3dmaterial);
  _3dmesh.rotation.x = -Math.PI / 2;
  _3dpreviewScene.add(_3dmesh);
}

// Function to render scene and camera
function render() {
  _3danimationFrame = requestAnimationFrame(render);
  _3dpreviewRenderer.render(_3dpreviewScene, _3dpreviewCamera);
}

function check3dCamera(canvas) {
// workaround to fix camera problems
  var resetCamera = 0;
  if (!_3dpreviewCamera) {
    resetCamera = 1;
  } else if (isNaN(_3dpreviewCamera.position.x)) {
    _3dpreviewCamera = null;
    resetCamera = 1;
  }

  if (resetCamera) {
    _3dpreviewCamera = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, 0.1, 10000); //Field-of-View, Aspect Ratio, Near Render, Far Render
    _3dpreviewCamera.position.z = 800;
    _3dpreviewCamera.position.y = 1000;
  }
}

function removeMesh() {
  _3dpreviewScene.remove(_3dmesh);
  _3dmesh.geometry.dispose();
  _3dmesh.material.dispose();
  _3dmesh = undefined;
  _3dgeometry = undefined;
  _3dmaterial = undefined;
  _3dtexture = undefined;
}

function start3dpreview(canvas) {
  _3dpreviewScene = new THREE.Scene();

  check3dCamera(canvas);

  _3dpreviewRenderer = new THREE.WebGLRenderer({ canvas: canvas });
  _3dpreviewControls = new THREE.OrbitControls( _3dpreviewCamera, _3dpreviewRenderer.domElement );
  _3dpreviewRenderer.setSize(canvas.width, canvas.height);

  addMesh(graphWidth, graphHeight, grid.cellsX, grid.cellsY);

  document.body.appendChild(_3dpreviewRenderer.domElement);

  _3danimationFrame = requestAnimationFrame(render);
}

function stop3dpreview() {
  if (_3danimationFrame) {
    cancelAnimationFrame(_3danimationFrame);
    _3danimationFrame = null;
  }
  removeMesh();

  _3dpreviewScene = null;
  _3dpreviewRenderer = null;
  _3dpreviewControls = null;
}

function update3dpreview(canvas) {
  removeMesh();
  check3dCamera(canvas);

  _3dpreviewRenderer.setSize(canvas.width, canvas.height);
  addMesh(graphWidth, graphHeight, grid.cellsX, grid.cellsY);
}
