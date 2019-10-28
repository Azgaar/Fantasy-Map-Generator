"use strict";
let threeD = {}; // master object for 3d scane and parameters
let threeDscale = 50; // 3d scene scale

// start 3d view and heightmap edit preview
async function start3d(canvas) {
  const loaded = await loadTHREE();
  if (!loaded) {tip("Cannot load 3d library", false, "error", 4000); return false};

  threeD.Renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  threeD.scene = new THREE.Scene();
  //threeD.scene.background = new THREE.Color(0x53679f);
  threeD.camera = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, 0.1, 3000);
  threeD.camera.name = "camera";
  threeD.camera.position.x = 0;
  threeD.camera.position.z = 350;
  threeD.camera.position.y = 285;
  threeD.controls = await OrbitControls(threeD.camera, threeD.Renderer.domElement);
  threeD.controls.minDistance = 10; threeD.controls.maxDistance = 1000;
  threeD.controls.maxPolarAngle = Math.PI/2;
  threeD.controls.keys = {};

  threeD.Renderer.setSize(canvas.width, canvas.height);
  add3dMesh(graphWidth, graphHeight, grid.cellsX, grid.cellsY);
  addLight();

  updateWaterMesh();
  updateFog();
  updateSkybox();
  updateFogDistance();
  updateSceneBackground();
  updateLight();
  updateShadows();

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
  threeD.material.transparent = true;

  threeDscale = parseInt(threeDHeightScale.value);
  geometry.vertices.forEach((v, i) => v.z = getMeshHeight(i));
  geometry.computeVertexNormals();
  threeD.Renderer.shadowMap.enabled = true;
  threeD.mesh = new THREE.Mesh(geometry, threeD.material);
  threeD.mesh.name = "ground";
  threeD.mesh.rotation.x = -Math.PI / 2;
  if (threeDShadows.checked) {
    threeD.mesh.castShadow = true;
    threeD.mesh.receiveShadow = true;
    threeD.Renderer.shadowMap.enabled = true;
  } else {
    threeD.mesh.castShadow = false;
    threeD.mesh.receiveShadow = false;
    threeD.Renderer.shadowMap.enabled = false;
  }
  threeD.scene.add(threeD.mesh);
}

async function addWaterMesh(width, height) {
  const waterPlane = new THREE.PlaneGeometry(width*16, height*16, 10, 10);
  const waterMaterial = new THREE.MeshLambertMaterial();
  const urlWater = await getWater(width*16, height*16);

  waterMaterial.map = new THREE.TextureLoader().load(urlWater);
  // this is to hide the ocean when viewing from sea level
  waterMaterial.polygonOffset = true;
  waterMaterial.polygonOffsetFactor = 2;

  threeD.waterMesh = new THREE.Mesh(waterPlane, waterMaterial);
  threeD.waterMesh.rotation.x = -Math.PI / 2;
  threeD.waterMesh.position.y -= 3; // fix for z-fighting, gap is visible at sea level
  threeD.waterMesh.castShadow = false;
  threeD.waterMesh.receiveShadow = false;
  threeD.scene.add(threeD.waterMesh);
}

function updateHeightScale() {
  update3dPreview(canvas3d);
}

async function updateWaterMesh() {
  if (threeDExtendedWater.checked) {
    await addWaterMesh(graphWidth, graphHeight);
    update3dPreview(canvas3d);
  } else {
    if (threeD.waterMesh) {
      threeD.scene.remove(threeD.waterMesh);
      threeD.waterMesh = undefined;
      update3dPreview(canvas3d);
    }
  }
  render();
}

function addLight() {
  threeD.ambientLight = new THREE.AmbientLight(0xcccccc, .7);
  threeD.scene.add(threeD.ambientLight);

  threeD.spotLight = new THREE.SpotLight(0xcccccc, .8, 1000, .7, 0, 0);
  threeD.spotLight.position.set(100, 600, parseInt(threeDSpotlightDistance.value));
  threeD.spotLight.castShadow = threeDShadows.checked;
  threeD.scene.add(threeD.spotLight);
  //threeD.scene.add(new THREE.SpotLightHelper(spotLight));
}

function updateLight() {
  if (threeDSpotlight.checked) {
    if (threeD.spotLight) { threeD.spotLight.visible = true; }
  } else {
    if (threeD.spotLight) { threeD.spotLight.visible = false; }
  }
  render();
}

function updateSpotlightDistance() {
  threeD.spotLight.position.z = parseInt(threeDSpotlightDistance.value);
  render();
}

function updateShadows() {
  var b = threeDShadows.checked;
  if (threeD.mesh) {
    threeD.mesh.castShadow = b;
    threeD.mesh.receiveShadow = b;
    threeD.Renderer.shadowMap.enabled = b;
  }
  if (threeD.spotLight) {
    threeD.spotLight.castShadow = b;
  }
  render();
}

function addFog() {
  var fogColor = new THREE.Color(threeDFogColorOutput.value);
  threeD.scene.background = fogColor;
  threeD.scene.fog = new THREE.Fog(fogColor, parseInt(threeDFogDistance.value), 3000);
}

function updateFog() {
  const w = document.getElementById("threeDFog");
  if (w.checked) {
    addFog();
  } else {
    threeD.scene.fog = undefined;
    render();
    updateSceneBackground();
  }
  render();
}

function updateFogDistance() {
  if (threeD.scene.fog) { threeD.scene.fog.near = parseInt(threeDFogDistance.value); render(); }
}

function updateSceneBackground() {
  var bgColor = new THREE.Color(threeDBackgroundColorOutput.value);

  threeD.scene.background = bgColor;
  render();
}

function getRGB(color) {
    var rgb = color.match(/^rgb?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
    return {
      r: parseInt(rgb[1]),
      g: parseInt(rgb[2]),
      b: parseInt(rgb[3]),
    };
}

function getSkyboxTexture(width, height) {
  var url = threeDSkyboxURL.value;
  if (url != "") {
    return url;
  } else {
  // this is a light-blue gradient 
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var color = d3.scaleSequential(d3.interpolateBlues);
    var ctx = canvas.getContext('2d');
    var image = ctx.createImageData(width, height);
  
    for (var y=0; y < height; y++) {
      let v = (y / height * 0.6) + (0.2); // use center 60% of "Blues"
      let rgb = getRGB(color(1-v));
      for (var x=0; x < width; x++) {
      let i = (y * width + x) * 4;
        image.data[i+0] = rgb.r;
        image.data[i+1] = rgb.g;
        image.data[i+2] = rgb.b;
        image.data[i+3] = 255;
      }
    }
    ctx.putImageData(image,0,0);
    return canvas.toDataURL();
  }
}

function addSkybox() {
  const shader = THREE.ShaderLib.equirect;

  const skyMaterial = new THREE.ShaderMaterial({
    fragmentShader: shader.fragmentShader,
    vertexShader: shader.vertexShader,
    uniforms: shader.uniforms,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const texture = new THREE.TextureLoader().load(getSkyboxTexture(640, 320));
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;

  skyMaterial.uniforms.tEquirect.value = texture;

  var plane = new THREE.SphereGeometry(1900, 32, 32);
  threeD.skyMesh = new THREE.Mesh(plane, skyMaterial);
  threeD.scene.add(threeD.skyMesh);
}

async function updateSkybox() {
  if (threeDSkybox.checked) {
    await addSkybox();
  } else {
    if (threeD.skyMesh) {
      threeD.scene.remove(threeD.skyMesh);
      threeD.skyMesh = undefined;
    }
  }
  render();
}

async function updateSkyboxType() {
    if (threeD.skyMesh) {
      threeD.scene.remove(threeD.skyMesh);
      threeD.skyMesh = undefined;
    }
 
    await addSkybox();
    render();
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
  if (threeD.mesh) {
    threeD.mesh.geometry.dispose();
    threeD.mesh.material.dispose();
    threeD.scene.remove(threeD.mesh);
  }
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

  if (modules.edit3d) {
    $("#threeDOptions").dialog("close");
  }
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

function close3d() {
  modules.edit3d = false;
}

function show3doptions(type) {
  if (type === "view3D") {
    if (modules.edit3d) return;
    modules.edit3d = true;

    $("#threeDOptions").dialog({
      title: "3D Options", resizable: false, width: fitContent(), close: close3d,
      position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
    });
  
    threeDHeightScale.addEventListener("click", updateHeightScale);
    threeDExtendedWater.addEventListener("click", updateWaterMesh);
    threeDFog.addEventListener("click", updateFog);
    threeDFogDistance.addEventListener("change", updateFogDistance);
    threeDSkybox.addEventListener("click", updateSkybox);
    threeDSpotlight.addEventListener("click", updateLight);
    threeDSpotlightDistance.addEventListener("change", updateSpotlightDistance);
    threeDShadows.addEventListener("click", updateShadows);
  
    threeDFogColor.addEventListener("input", function() {
      threeDFogColor.value = threeDFogColorOutput.value = d3.color(this.value).hex();
      updateFog();
    });

    threeDBackgroundColor.addEventListener("input", function() {
      threeDBackgroundColor.value = threeDBackgroundColorOutput.value = d3.color(this.value).hex();
      updateSceneBackground();
    });
  } else {
    if (modules.edit3d) {
      $("#threeDOptions").dialog("close");
    }
  }  
}

