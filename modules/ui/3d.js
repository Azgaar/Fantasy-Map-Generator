(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.ThreeD = factory());
}(this, (function () {'use strict';

// set default options
const options = {scale: 50, lightness: .7, shadow: .5, sun: {x: 100, y: 600, z: 1000}, rotateMesh: 0, rotateGlobe: .5,
  skyColor: "#9ecef5", waterColor: "#466eab", extendedWater: 0, resolution: 2};

// set variables
let Renderer, scene, camera, controls, animationFrame, material, texture,
  geometry, mesh, ambientLight, spotLight, waterPlane, waterMaterial, waterMesh,
  objexporter;
let drawCtx = document.createElement('canvas').getContext('2d');
let textMeshs = [], iconMeshs = [];

// initiate 3d scene
const create = async function(canvas, type = "viewMesh") {
  options.isOn = true;
  options.isGlobe = type === "viewGlobe";
  return options.isGlobe ? newGlobe(canvas) : newMesh(canvas);
}

// redraw 3d scene
const redraw = function() {
  scene.remove(mesh);
  Renderer.setSize(Renderer.domElement.width, Renderer.domElement.height);
  if (options.isGlobe) updateGlobeTexure();
  else createMesh(graphWidth, graphHeight, grid.cellsX, grid.cellsY);
  render();
}

// update 3d texture
const update = function() {
  if (options.isGlobe) updateGlobeTexure(); else update3dTexture();
}

// try to clean the memory as much as possible
const stop = function() {
  cancelAnimationFrame(animationFrame);
  texture.dispose();
  geometry.dispose();
  material.dispose();
  if (waterPlane) waterPlane.dispose();
  if (waterMaterial) waterMaterial.dispose();
  for (const mesh of textMeshs) {
    mesh.material.map.dispose();
    mesh.material.dispose();
    mesh.geometry.dispose();
    scene.remove(mesh);
  }
  for (const mesh of iconMeshs) {
    mesh.material.dispose();
    mesh.geometry.dispose();
    scene.remove(mesh);
  }

  Renderer.renderLists.dispose(); // is it required?
  Renderer.dispose();
  scene.remove(mesh);
  scene.remove(spotLight);
  scene.remove(ambientLight);
  scene.remove(waterMesh);

  // not sure it's required
  Renderer = undefined;
  scene = undefined;
  controls = undefined;
  camera = undefined;
  material = undefined;
  texture = undefined;
  geometry = undefined;
  mesh = undefined;

  ThreeD.options.isOn = false;
}

const setScale = function(scale) {
  options.scale = scale;
  geometry.vertices.forEach((v, i) => v.z = getMeshHeight(i));
  geometry.verticesNeedUpdate = true;
  geometry.computeVertexNormals();
  render();
  geometry.verticesNeedUpdate = false;
}

const setLightness = function(intensity) {
  options.lightness = intensity;
  ambientLight.intensity = intensity;
  render();
}

const setSun = function(x, y, z) {
  options.sun = {x, y, z};
  spotLight.position.set(x, y, z);
  render();
}

const setRotation = function(speed) {
  cancelAnimationFrame(animationFrame);
  if (options.isGlobe) options.rotateGlobe = speed; else options.rotateMesh = speed;
  controls.autoRotateSpeed = speed;
  controls.autoRotate = Boolean(controls.autoRotateSpeed);
  if (controls.autoRotate) animate();
}

const toggleSky = function() {
  if (options.extendedWater) {
    scene.background = null;
    scene.fog = null;
    scene.remove(waterMesh);
  } else extendWater(graphWidth, graphHeight);

  options.extendedWater = !options.extendedWater;
  redraw();
}

const setColors = function(sky, water) {
  options.skyColor = sky;
  scene.background = scene.fog.color = new THREE.Color(sky);
  options.waterColor = water;
  waterMaterial.color = new THREE.Color(water);
  render();
}

const setResolution = function(resolution) {
  options.resolution = resolution;
  update();
}

// download screenshot
const saveScreenshot = async function() {
  const URL = Renderer.domElement.toDataURL("image/jpeg");
  const link = document.createElement("a");
  link.download = getFileName() + ".jpeg";
  link.href = URL;
  link.click();
  tip(`Screenshot is saved. Open "Downloads" screen (CTRL + J) to check`, true, "success", 7000);
  window.setTimeout(() => window.URL.revokeObjectURL(URL), 5000);
}

const saveOBJ = async function() {
  downloadFile(await getOBJ(), getFileName() + ".obj", "text/plain;charset=UTF-8");
}

// start 3d view and heightmap edit preview
async function newMesh(canvas) {
  const loaded = await loadTHREE();
  if (!loaded) {tip("Cannot load 3d library", false, "error", 4000); return false};

  scene = new THREE.Scene();

  // light
  ambientLight = new THREE.AmbientLight(0xcccccc, options.lightness);
  scene.add(ambientLight);
  spotLight = new THREE.SpotLight(0xcccccc, .8, 2000, .8, 0, 0);
  spotLight.position.set(options.sun.x, options.sun.y, options.sun.z);
  spotLight.castShadow = true;
  scene.add(spotLight);
  //scene.add(new THREE.SpotLightHelper(spotLight));

  // Rendered
  Renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  Renderer.setSize(canvas.width, canvas.height);
  Renderer.shadowMap.enabled = true;
  if (options.extendedWater) extendWater(graphWidth, graphHeight);
  createMesh(graphWidth, graphHeight, grid.cellsX, grid.cellsY);

  // camera
  camera = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, .1, 2000);
  camera.position.set(0, rn(svgWidth/3.5), 500);

  // controls
  controls = await OrbitControls(camera, canvas);
  controls.enableKeys = false;
  controls.minDistance = 10;
  controls.maxDistance = 1000;
  controls.maxPolarAngle = Math.PI/2;
  controls.autoRotate = Boolean(options.rotateMesh);
  controls.autoRotateSpeed = options.rotateMesh;
  animate();
  controls.addEventListener("change", render);

  return true;
}

function createTextMesh(text, font, size, color) {
  drawCtx.clearRect(0, 0, drawCtx.canvas.width, drawCtx.canvas.height);
  drawCtx.font = "50px " + font;

  drawCtx.canvas.width = drawCtx.measureText(text).width;
  drawCtx.canvas.height = 50 + 5;
  drawCtx.font = "50px " + font;

  drawCtx.fillStyle = color;
  drawCtx.fillText(text, 0, 50);
    
  // canvas contents will be used for a texture
  const text_texture = new THREE.TextureLoader().load(drawCtx.canvas.toDataURL());
  text_texture.minFilter = THREE.LinearFilter
  text_texture.needsUpdate = true;
      
  const text_material = new THREE.MeshBasicMaterial({map: text_texture/*, side:THREE.DoubleSide*/, depthWrite: false});
  text_material.transparent = true;

  const text_mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(drawCtx.canvas.width*(size/100), drawCtx.canvas.height*(size/100)),
    text_material
  );
  text_mesh.renderOrder = 1;

  return text_mesh
}

function get3dCoords(x, base_y) {
  const svg = $('svg#map')[0];

  const y = getMeshHeight(findGridCell(x, base_y));
  x = x - svg.width.baseVal.value/2;
  const z = base_y - svg.height.baseVal.value/2;

  return [x, y, z];
}

// create a mesh from pixel data
async function createMesh(width, height, segmentsX, segmentsY) {
  const url = await getMapURL("mesh", options.extendedWater ? "noWater" : null);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 3000);
  if (texture) texture.dispose();
  texture = new THREE.TextureLoader().load(url, render);
  texture.needsUpdate = true;

  if (material) material.dispose();
  material = new THREE.MeshLambertMaterial();
  material.map = texture;
  material.transparent = true;

  if (geometry) geometry.dispose();
  geometry = new THREE.PlaneGeometry(width, height, segmentsX-1, segmentsY-1);
  geometry.vertices.forEach((v, i) => v.z = getMeshHeight(i));
  geometry.computeVertexNormals();

  if (mesh) scene.remove(mesh);
  mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI/2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  for (const mesh of textMeshs) {
    mesh.material.map.dispose();
    mesh.material.dispose();
    mesh.geometry.dispose();
    scene.remove(mesh);
  }
  textMeshs = []

  for (const mesh of iconMeshs) {
    mesh.material.dispose();
    mesh.geometry.dispose();
    scene.remove(mesh);
  }
  iconMeshs = []

  const svg = $('svg#map')[0];
  console.log(svg)
  // Labels
  if(layerIsOn("toggleLabels")) {
    // Cities labels
    const cities = $('#viewbox #labels #burgLabels #cities', svg)
    for (const label of cities[0].childNodes) {
      const text_mesh = createTextMesh(label.innerHTML, cities.css('font-family'), 25, cities.css('fill')) // cities.data('size')

      const [x, y, z] = get3dCoords(label.x.baseVal[0].value, label.y.baseVal[0].value)
      text_mesh.position.set(x, y + 15, z);
      text_mesh.animate = function () {
        this.rotation.copy(camera.rotation);
      }

      textMeshs.push(text_mesh)
      scene.add(text_mesh);
    }

    // Town labels
    const towns = $('#viewbox #labels #burgLabels #towns', svg)
    for (const label of towns[0].childNodes) {
      const text_mesh = createTextMesh(label.innerHTML, towns.css('font-family'), 7, towns.css('fill')) // towns.data('size')

      const [x, y, z] = get3dCoords(label.x.baseVal[0].value, label.y.baseVal[0].value)
      text_mesh.position.set(x, y + 5, z);
      text_mesh.animate = function () {
        if(this.position.distanceTo(camera.position) > 200) {
          this.visible = false;
        } else {
          this.visible = true;
          this.rotation.copy(camera.rotation);
        }
      }

      textMeshs.push(text_mesh)
      scene.add(text_mesh);
    }
  }
  // Icons
  if(layerIsOn("toggleIcons")) {
    const cities_icon = $('#viewbox #icons #burgIcons #cities', svg)[0]
    for (const icon of cities_icon.childNodes) {
      const icon_material = new THREE.MeshBasicMaterial({color: 0xcccccc});
      const icon_mesh = new THREE.Mesh(
        new THREE.SphereGeometry(2, 16, 16),
        icon_material
      );

      icon_mesh.position.set(...get3dCoords(icon.cx.baseVal.value, icon.cy.baseVal.value))

      iconMeshs.push(icon_mesh);
      scene.add(icon_mesh);
    }

    const town_icon = $('#viewbox #icons #burgIcons #towns', svg)[0]
    for (const icon of town_icon.childNodes) {
      const icon_material = new THREE.MeshBasicMaterial({color: 0xcccccc});
      const icon_mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 16),
        icon_material
      );

      icon_mesh.position.set(...get3dCoords(icon.cx.baseVal.value, icon.cy.baseVal.value))

      iconMeshs.push(icon_mesh);
      scene.add(icon_mesh);
    }
  }
}

function getMeshHeight(i) {
  const h = grid.cells.h[i];
  return h < 20 ? 0 : (h - 18) / 82 * options.scale;
}

function extendWater(width, height) {
  scene.background = new THREE.Color(options.skyColor);

  waterPlane = new THREE.PlaneGeometry(width * 10, height * 10, 1);
  waterMaterial = new THREE.MeshBasicMaterial({color: options.waterColor});
  scene.fog = new THREE.Fog(scene.background, 500, 3000);

  waterMesh = new THREE.Mesh(waterPlane, waterMaterial);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y -= 3;
  scene.add(waterMesh);
}

async function update3dTexture() {
  if (texture) texture.dispose();
  const url = await getMapURL("mesh");
  window.setTimeout(() => window.URL.revokeObjectURL(url), 3000);
  texture = new THREE.TextureLoader().load(url, render);
  material.map = texture;
}

async function newGlobe(canvas) {
  const loaded = await loadTHREE();
  if (!loaded) {tip("Cannot load 3d library", false, "error", 4000); return false};

  // scene
  scene = new THREE.Scene();
  scene.background = new THREE.TextureLoader().load("https://i0.wp.com/azgaar.files.wordpress.com/2019/10/stars-1.png", render);

  // Renderer
  Renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  Renderer.setSize(canvas.width, canvas.height);

  // material
  if (material) material.dispose();
  material = new THREE.MeshBasicMaterial();
  updateGlobeTexure(true);

  // camera
 camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 1000).translateZ(5);

  // controls
  controls = await OrbitControls(camera, Renderer.domElement);
  controls.enableKeys = false;
  controls.minDistance = 1.8;
  controls.maxDistance = 10;
  controls.autoRotate = Boolean(options.rotateGlobe);
  controls.autoRotateSpeed = options.rotateGlobe;
  controls.addEventListener("change", render);

  return true;
}

async function updateGlobeTexure(addMesh) {
  const world = mapCoordinates.latT > 179; // define if map covers whole world

  // texture size
  const scale = options.resolution;
  const height = 512 * scale;
  const width = 1024 * scale;

  // calculate map size and offset position
  const mapHeight = rn(mapCoordinates.latT / 180 * height);
  const mapWidth = world ? mapHeight * 2 : rn(graphWidth / graphHeight * mapHeight);
  const dy = world ? 0 : (90 - mapCoordinates.latN) / 180 * height;
  const dx = world ? 0 : mapWidth / 4;

  // draw map on canvas
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.canvas.width = width;
  ctx.canvas.height = height;

  // add cloud texture if map does not cover all the globe
  if (!world) {
    const img = new Image;
    img.onload = function() {ctx.drawImage(img, 0, 0, width, height)};
    img.src = "data:image/png;base64,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";
  }

  // fill canvas segment with map texture
  const img2 = new Image;
  img2.onload = function() {
    ctx.drawImage(img2, dx, dy, mapWidth, mapHeight);
    if (texture) texture.dispose();
    texture = new THREE.CanvasTexture(ctx.canvas, render);
    material.map = texture;
    if (addMesh) addGlobe3dMesh();
  };
  img2.src = await getMapURL("mesh", "globe");;
}

async function getOBJ() {
  objexporter = await OBJExporter();

  const data = await objexporter.parse(mesh);
  return data;
}

function addGlobe3dMesh() {
  geometry = new THREE.SphereBufferGeometry(1, 64, 64);
  mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  if (controls.autoRotate) animate(); else render();
}

// render 3d scene and camera, do only on controls change
function render() {
  Renderer.render(scene,camera);
}

// animate 3d scene and camera
function animate() {
  animationFrame = requestAnimationFrame(animate);
  controls.update();
  for(const mesh of textMeshs) {
    if(mesh.animate) {
      mesh.animate();
    }
  }
  Renderer.render(scene, camera);
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
  if (THREE.OrbitControls) return new THREE.OrbitControls(camera, domElement);

  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = "libs/orbitControls.min.js"
    document.head.append(script);
    script.onload = () => resolve(new THREE.OrbitControls(camera, domElement));
    script.onerror = () => resolve(false);
  });
}

function OBJExporter() {
  if (THREE.OBJExporter) return new THREE.OBJExporter();

  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = "libs/objexporter.min.js"
    document.head.append(script);
    script.onload = () => resolve(new THREE.OBJExporter());
    script.onerror = () => resolve(false);
  });
}

return {create, redraw, update, stop, options, setScale, setLightness, setSun, setRotation, toggleSky, setResolution, setColors, saveScreenshot, saveOBJ};

})));
