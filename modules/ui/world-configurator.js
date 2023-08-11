function editWorld() {
  if (customization) return;

  $("#worldConfigurator").dialog({
    title: "Configure World",
    resizable: false,
    width: "minmax(40em, 85vw)",
    buttons: {
      "Whole World": () => applyWorldPreset(100, 50),
      Northern: () => applyWorldPreset(33, 25),
      Tropical: () => applyWorldPreset(33, 50),
      Southern: () => applyWorldPreset(33, 75)
    },
    open: function () {
      const buttons = $(this).dialog("widget").find(".ui-dialog-buttonset > button");
      buttons[0].addEventListener("mousemove", () => tip("Click to set map size to cover the whole World"));
      buttons[1].addEventListener("mousemove", () => tip("Click to set map size to cover the Northern latitudes"));
      buttons[2].addEventListener("mousemove", () => tip("Click to set map size to cover the Tropical latitudes"));
      buttons[3].addEventListener("mousemove", () => tip("Click to set map size to cover the Southern latitudes"));
    },
    close: function () {
      $(this).dialog("destroy");
    }
  });

  const globe = d3.select("#globe");
  const projection = d3.geoOrthographic().translate([100, 100]).scale(100);
  const path = d3.geoPath(projection);

  updateInputValues();
  updateGlobeTemperature();
  updateGlobePosition();

  if (modules.editWorld) return;
  modules.editWorld = true;

  byId("worldControls").addEventListener("input", e => updateWorld(e.target));
  globe.select("#globeWindArrows").on("click", changeWind);
  globe.select("#globeGraticule").attr("d", round(path(d3.geoGraticule()()))); // globe graticule
  updateWindDirections();

  byId("restoreWinds").addEventListener("click", restoreDefaultWinds);

  function updateInputValues() {
    byId("temperatureEquatorInput").value = options.temperatureEquator;
    byId("temperatureEquatorOutput").value = options.temperatureEquator;
    byId("temperatureEquatorF").innerText = convertTemperature(options.temperatureEquator, "°F");

    byId("temperatureNorthPoleInput").value = options.temperatureNorthPole;
    byId("temperatureNorthPoleOutput").value = options.temperatureNorthPole;
    byId("temperatureNorthPoleF").innerText = convertTemperature(options.temperatureNorthPole, "°F");

    byId("temperatureSouthPoleInput").value = options.temperatureSouthPole;
    byId("temperatureSouthPoleOutput").value = options.temperatureSouthPole;
    byId("temperatureSouthPoleF").innerText = convertTemperature(options.temperatureSouthPole, "°F");
  }

  function updateWorld(el) {
    if (el?.dataset.stored) {
      const stored = el.dataset.stored;
      byId(stored + "Input").value = el.value;
      byId(stored + "Output").value = el.value;
      lock(el.dataset.stored);

      if (stored === "temperatureEquator") {
        options.temperatureEquator = Number(el.value);
        byId("temperatureEquatorF").innerText = convertTemperature(options.temperatureEquator, "°F");
      }
      if (stored === "temperatureNorthPole") {
        options.temperatureNorthPole = Number(el.value);
        byId("temperatureNorthPoleF").innerText = convertTemperature(options.temperatureNorthPole, "°F");
      }
      if (stored === "temperatureSouthPole") {
        options.temperatureSouthPole = Number(el.value);
        byId("temperatureSouthPoleF").innerText = convertTemperature(options.temperatureSouthPole, "°F");
      }
    }

    updateGlobeTemperature();
    updateGlobePosition();
    calculateTemperatures();
    generatePrecipitation();
    const heights = new Uint8Array(pack.cells.h);
    Rivers.generate();
    Lakes.defineGroup();
    Rivers.specify();
    pack.cells.h = new Float32Array(heights);
    Biomes.define();

    if (layerIsOn("toggleTemp")) drawTemp();
    if (layerIsOn("togglePrec")) drawPrec();
    if (layerIsOn("toggleBiomes")) drawBiomes();
    if (layerIsOn("toggleCoordinates")) drawCoordinates();
    if (layerIsOn("toggleRivers")) drawRivers();
    if (byId("canvas3d")) setTimeout(ThreeD.update(), 500);
  }

  function updateGlobePosition() {
    const size = +byId("mapSizeOutput").value;
    const eqD = ((graphHeight / 2) * 100) / size;

    calculateMapCoordinates();
    const mc = mapCoordinates;
    const scale = +distanceScaleInput.value;
    const unit = distanceUnitInput.value;
    const meridian = toKilometer(eqD * 2 * scale);
    byId("mapSize").innerHTML = `${graphWidth}x${graphHeight}`;
    byId("mapSizeFriendly").innerHTML = `${rn(graphWidth * scale)}x${rn(graphHeight * scale)} ${unit}`;
    byId("meridianLength").innerHTML = rn(eqD * 2);
    byId("meridianLengthFriendly").innerHTML = `${rn(eqD * 2 * scale)} ${unit}`;
    byId("meridianLengthEarth").innerHTML = meridian ? " = " + rn(meridian / 200) + "%🌏" : "";
    byId("mapCoordinates").innerHTML = `${lat(mc.latN)} ${Math.abs(rn(mc.lonW))}°W; ${lat(mc.latS)} ${rn(mc.lonE)}°E`;

    function toKilometer(v) {
      if (unit === "km") return v;
      else if (unit === "mi") return v * 1.60934;
      else if (unit === "lg") return v * 5.556;
      else if (unit === "vr") return v * 1.0668;
      return 0; // 0 if distanceUnitInput is a custom unit
    }

    // parse latitude value
    function lat(lat) {
      return lat > 0 ? Math.abs(rn(lat)) + "°N" : Math.abs(rn(lat)) + "°S";
    }

    const area = d3.geoGraticule().extent([
      [mc.lonW, mc.latN],
      [mc.lonE, mc.latS]
    ]);
    globe.select("#globeArea").attr("d", round(path(area.outline()))); // map area
  }

  // update temperatures on globe (visual-only)
  function updateGlobeTemperature() {
    const tEq = options.temperatureEquator;
    const tNP = options.temperatureNorthPole;
    const tSP = options.temperatureSouthPole;

    const scale = d3.scaleSequential(d3.interpolateSpectral);
    const getColor = value => scale(1 - value);
    const [tMin, tMax] = [-25, 30]; // temperature extremes
    const tDelta = tMax - tMin;

    globe.select("#grad90").attr("stop-color", getColor((tNP - tMin) / tDelta));
    globe.select("#grad60").attr("stop-color", getColor((tEq - ((tEq - tNP) * 2) / 3 - tMin) / tDelta));
    globe.select("#grad30").attr("stop-color", getColor((tEq - ((tEq - tNP) * 1) / 4 - tMin) / tDelta));
    globe.select("#grad0").attr("stop-color", getColor((tEq - tMin) / tDelta));
    globe.select("#grad-30").attr("stop-color", getColor((tEq - ((tEq - tSP) * 1) / 4 - tMin) / tDelta));
    globe.select("#grad-60").attr("stop-color", getColor((tEq - ((tEq - tSP) * 2) / 3 - tMin) / tDelta));
    globe.select("#grad-90").attr("stop-color", getColor((tSP - tMin) / tDelta));
  }

  function updateWindDirections() {
    globe
      .select("#globeWindArrows")
      .selectAll("path")
      .each(function (d, i) {
        const tr = parseTransform(this.getAttribute("transform"));
        this.setAttribute("transform", `rotate(${options.winds[i]} ${tr[1]} ${tr[2]})`);
      });
  }

  function changeWind() {
    const arrow = d3.event.target.nextElementSibling;
    const tier = +arrow.dataset.tier;
    options.winds[tier] = (options.winds[tier] + 45) % 360;
    const tr = parseTransform(arrow.getAttribute("transform"));
    arrow.setAttribute("transform", `rotate(${options.winds[tier]} ${tr[1]} ${tr[2]})`);
    localStorage.setItem("winds", options.winds);
    const mapTiers = d3.range(mapCoordinates.latN, mapCoordinates.latS, -30).map(c => ((90 - c) / 30) | 0);
    if (mapTiers.includes(tier)) updateWorld();
  }

  function restoreDefaultWinds() {
    const defaultWinds = [225, 45, 225, 315, 135, 315];
    const mapTiers = d3.range(mapCoordinates.latN, mapCoordinates.latS, -30).map(c => ((90 - c) / 30) | 0);
    const update = mapTiers.some(t => options.winds[t] != defaultWinds[t]);
    options.winds = defaultWinds;
    updateWindDirections();
    if (update) updateWorld();
  }

  function applyWorldPreset(size, lat) {
    byId("mapSizeInput").value = byId("mapSizeOutput").value = size;
    byId("latitudeInput").value = byId("latitudeOutput").value = lat;
    lock("mapSize");
    lock("latitude");
    updateWorld();
  }
}
