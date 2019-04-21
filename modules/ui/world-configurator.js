function editWorld() {
  if (customization) return;
  $("#worldConfigurator").dialog({title: "Configure World", width: 440});

  const globe = d3.select("#globe");
  const clr = d3.scaleSequential(d3.interpolateSpectral);
  const tMax = +temperatureEquatorOutput.max, tMin = +temperatureEquatorOutput.min; // temperature extremes
  const projection = d3.geoOrthographic().translate([100, 100]).scale(100);
  const path = d3.geoPath(projection);

  updateGlobeTemperature();
  updateGlobePosition();

  if (modules.editWorld) return;
  modules.editWorld = true;

  document.getElementById("worldControls").addEventListener("input", (e) => updateWorld(e.target));
  globe.select("#globeWindArrows").on("click", changeWind);
  globe.select("#restoreWind").on("click", restoreDefaultWinds);
  globe.select("#globeGraticule").attr("d", round(path(d3.geoGraticule()()))); // globe graticule
  updateWindDirections();

  function updateWorld(el) {
    if (el) {
      document.getElementById(el.dataset.stored+"Input").value = el.value;
      document.getElementById(el.dataset.stored+"Output").value = el.value;
      if (el.dataset.stored) lock(el.dataset.stored);
    }

    updateGlobeTemperature();
    updateGlobePosition();
    calculateTemperatures();
    generatePrecipitation();
    elevateLakes();
    Rivers.generate();
    defineBiomes();

    if (layerIsOn("toggleTemp")) drawTemp();
    if (layerIsOn("togglePrec")) drawPrec();
    if (layerIsOn("toggleBiomes")) drawBiomes();
    if (layerIsOn("toggleCoordinates")) drawCoordinates();
  }

  function updateGlobePosition() {
    const eqY = +document.getElementById("equatorOutput").value;
    const equidistance = document.getElementById("equidistanceOutput");
    equidistance.min = equidistanceInput.min = Math.max(graphHeight - eqY, eqY);
    equidistance.max = equidistanceInput.max = equidistance.min * 10;
    const eqD = +equidistance.value;
    calculateMapCoordinates();
    const mc = mapCoordinates; // shortcut

    const scale = +distanceScale.value, unit = distanceUnit.value;
    document.getElementById("mapSize").innerHTML = `${graphWidth}x${graphHeight}`;
    document.getElementById("mapSizeFriendly").innerHTML = `${rn(graphWidth * scale)}x${rn(graphHeight * scale)} ${unit}`;
    document.getElementById("meridianLength").innerHTML = rn(eqD * 2);
    document.getElementById("meridianLengthFriendly").innerHTML = `${rn(eqD * 2 * scale)} ${unit}`;
    document.getElementById("meridianLengthEarth").innerHTML = toKilometer(eqD * 2 * scale);
    document.getElementById("mapCoordinates").innerHTML = `${lat(mc.latN)} ${Math.abs(rn(mc.lonW))}°W; ${lat(mc.latS)} ${rn(mc.lonE)}°E`;

    function toKilometer(v) {
      let kilometers; // value converted to kilometers
      if (unit === "km") kilometers = v;
      else if (unit === "mi") kilometers = v * 1.60934;
      else if (unit === "lg") kilometers = v * 5.556;
      else if (unit === "vr") kilometers = v * 1.0668;
      else return ""; // do not show as distanceUnit is custom
      return " = " + rn(kilometers / 200) + "%🌏"; // % + Earth icon
    }

    function lat(lat) {return lat > 0 ? Math.abs(rn(lat)) + "°N" : Math.abs(rn(lat)) + "°S";} // parse latitude value
    const area = d3.geoGraticule().extent([[mc.lonW, mc.latN], [mc.lonE, mc.latS]]);
    globe.select("#globeArea").attr("d", round(path(area.outline()))); // map area
  }

  function updateGlobeTemperature() {   
    const tEq = +document.getElementById("temperatureEquatorOutput").value;
    document.getElementById("temperatureEquatorF").innerHTML = rn(tEq * 9/5 + 32);
    const tPole = +document.getElementById("temperaturePoleOutput").value;
    document.getElementById("temperaturePoleF").innerHTML = rn(tPole * 9/5 + 32);
    globe.selectAll(".tempGradient90").attr("stop-color", clr(1 - (tPole - tMin) / (tMax - tMin)));
    globe.selectAll(".tempGradient60").attr("stop-color", clr(1 - (tEq - (tEq - tPole) * 2/3 - tMin) / (tMax - tMin)));
    globe.selectAll(".tempGradient30").attr("stop-color", clr(1 - (tEq - (tEq - tPole) * 1/3 - tMin) / (tMax - tMin)));
    globe.select(".tempGradient0").attr("stop-color", clr(1 - (tEq - tMin) / (tMax - tMin)));
  }

  function updateWindDirections() {
    globe.select("#globeWindArrows").selectAll("path").each(function(d, i) {
      const tr = parseTransform(this.getAttribute("transform"));
      this.setAttribute("transform", `rotate(${winds[i]} ${tr[1]} ${tr[2]})`);
    });
  }

  function changeWind() {
    const arrow = d3.event.target.nextElementSibling;
    const tier = +arrow.dataset.tier;
    winds[tier] = (winds[tier] + 45) % 360;
    const tr = parseTransform(arrow.getAttribute("transform"));
    arrow.setAttribute("transform", `rotate(${winds[tier]} ${tr[1]} ${tr[2]})`);
    localStorage.setItem("winds", winds);
    const mapTiers = d3.range(mapCoordinates.latN, mapCoordinates.latS, -30).map(c => (90-c) / 30 | 0);
    if (mapTiers.includes(tier)) updateWorld();
  }
  
  function restoreDefaultWinds() {
    const defaultWinds = [225, 45, 225, 315, 135, 315];
    const mapTiers = d3.range(mapCoordinates.latN, mapCoordinates.latS, -30).map(c => (90-c) / 30 | 0);
    const update = mapTiers.some(t => winds[t] != defaultWinds[t]);
    winds = defaultWinds;
    updateWindDirections();
    if (update) updateWorld();
  }

}