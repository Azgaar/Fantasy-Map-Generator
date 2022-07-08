import * as d3 from "d3";

import {tip} from "scripts/tooltips";
import {rn} from "utils/numberUtils";
import {round, parseTransform} from "utils/stringUtils";

let isLoaded = false;

export function editWorld() {
  if (customization) return;
  $("#worldConfigurator").dialog({
    title: "Configure World",
    resizable: false,
    width: "minmax(40em, 85vw)",
    buttons: {
      "Whole World": () => applyWorldPreset(100, 50),
      Northern: () => applyWorldPreset(33, 25),
      Tropical: () => applyWorldPreset(33, 50),
      Southern: () => applyWorldPreset(33, 75),
      "Restore Winds": restoreDefaultWinds
    },
    open: function () {
      const buttons = $(this).dialog("widget").find(".ui-dialog-buttonset > button");
      buttons[0].addEventListener("mousemove", () => tip("Click to set map size to cover the whole World"));
      buttons[1].addEventListener("mousemove", () => tip("Click to set map size to cover the Northern latitudes"));
      buttons[2].addEventListener("mousemove", () => tip("Click to set map size to cover the Tropical latitudes"));
      buttons[3].addEventListener("mousemove", () => tip("Click to set map size to cover the Southern latitudes"));
      buttons[4].addEventListener("mousemove", () => tip("Click to restore default wind directions"));
    },
    close: function () {
      $(this).dialog("destroy");
    }
  });

  const globe = d3.select("#globe");
  const clr = d3.scaleSequential(d3.interpolateSpectral);
  const tMax = 30,
    tMin = -25; // temperature extremes
  const projection = d3.geoOrthographic().translate([100, 100]).scale(100);
  const path = d3.geoPath(projection);

  updateGlobeTemperature();
  updateGlobePosition();

  if (isLoaded) return;
  isLoaded = true;

  document.getElementById("worldControls").addEventListener("input", e => updateWorld(e.target));
  globe.select("#globeWindArrows").on("click", changeWind);
  globe.select("#globeGraticule").attr("d", round(path(d3.geoGraticule()()))); // globe graticule
  updateWindDirections();

  function updateWorld(el) {
    if (el) {
      document.getElementById(el.dataset.stored + "Input").value = el.value;
      document.getElementById(el.dataset.stored + "Output").value = el.value;
      if (el.dataset.stored) lock(el.dataset.stored);
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
    if (document.getElementById("canvas3d")) setTimeout(ThreeD.update(), 500);
  }

  function updateGlobePosition() {
    const size = +document.getElementById("mapSizeOutput").value;
    const eqD = ((graphHeight / 2) * 100) / size;

    calculateMapCoordinates();
    const mc = mapCoordinates;
    const scale = +distanceScaleInput.value;
    const unit = distanceUnitInput.value;
    const meridian = toKilometer(eqD * 2 * scale);
    document.getElementById("mapSize").innerHTML = `${graphWidth}x${graphHeight}`;
    document.getElementById("mapSizeFriendly").innerHTML = `${rn(graphWidth * scale)}x${rn(
      graphHeight * scale
    )} ${unit}`;
    document.getElementById("meridianLength").innerHTML = rn(eqD * 2);
    document.getElementById("meridianLengthFriendly").innerHTML = `${rn(eqD * 2 * scale)} ${unit}`;
    document.getElementById("meridianLengthEarth").innerHTML = meridian ? " = " + rn(meridian / 200) + "%🌏" : "";
    document.getElementById("mapCoordinates").innerHTML = `${lat(mc.latN)} ${Math.abs(rn(mc.lonW))}°W; ${lat(
      mc.latS
    )} ${rn(mc.lonE)}°E`;

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

  function updateGlobeTemperature() {
    const tEq = +document.getElementById("temperatureEquatorOutput").value;
    document.getElementById("temperatureEquatorF").innerHTML = rn((tEq * 9) / 5 + 32);
    const tPole = +document.getElementById("temperaturePoleOutput").value;
    document.getElementById("temperaturePoleF").innerHTML = rn((tPole * 9) / 5 + 32);
    globe.selectAll(".tempGradient90").attr("stop-color", clr(1 - (tPole - tMin) / (tMax - tMin)));
    globe
      .selectAll(".tempGradient60")
      .attr("stop-color", clr(1 - (tEq - ((tEq - tPole) * 2) / 3 - tMin) / (tMax - tMin)));
    globe
      .selectAll(".tempGradient30")
      .attr("stop-color", clr(1 - (tEq - ((tEq - tPole) * 1) / 3 - tMin) / (tMax - tMin)));
    globe.select(".tempGradient0").attr("stop-color", clr(1 - (tEq - tMin) / (tMax - tMin)));
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
    document.getElementById("mapSizeInput").value = document.getElementById("mapSizeOutput").value = size;
    document.getElementById("latitudeInput").value = document.getElementById("latitudeOutput").value = lat;
    lock("mapSize");
    lock("latitude");
    updateWorld();
  }
}
