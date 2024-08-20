"use strict";
function editUnits() {
  closeDialogs("#unitsEditor, .stable");
  $("#unitsEditor").dialog();

  if (modules.editUnits) return;
  modules.editUnits = true;

  $("#unitsEditor").dialog({
    title: "Units Editor",
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  const renderScaleBar = () => {
    drawScaleBar(scaleBar, scale);
    fitScaleBar(scaleBar, svgWidth, svgHeight);
  };

  // add listeners
  byId("distanceUnitInput").on("change", changeDistanceUnit);
  byId("distanceScaleInput").on("change", changeDistanceScale);
  byId("heightUnit").on("change", changeHeightUnit);
  byId("heightExponentInput").on("input", changeHeightExponent);
  byId("temperatureScale").on("change", changeTemperatureScale);

  byId("populationRateInput").on("change", changePopulationRate);
  byId("urbanizationInput").on("change", changeUrbanizationRate);
  byId("urbanDensityInput").on("change", changeUrbanDensity);

  byId("addLinearRuler").on("click", addRuler);
  byId("addOpisometer").on("click", toggleOpisometerMode);
  byId("addRouteOpisometer").on("click", toggleRouteOpisometerMode);
  byId("addPlanimeter").on("click", togglePlanimeterMode);
  byId("removeRulers").on("click", removeAllRulers);
  byId("unitsRestore").on("click", restoreDefaultUnits);

  function changeDistanceUnit() {
    if (this.value === "custom_name") {
      prompt("Provide a custom name for a distance unit", {default: ""}, custom => {
        this.options.add(new Option(custom, custom, false, true));
        lock("distanceUnit");
        renderScaleBar();
        calculateFriendlyGridSize();
      });
      return;
    }

    renderScaleBar();
    calculateFriendlyGridSize();
  }

  function changeDistanceScale() {
    distanceScale = +this.value;
    renderScaleBar();
    calculateFriendlyGridSize();
  }

  function changeHeightUnit() {
    if (this.value !== "custom_name") return;

    prompt("Provide a custom name for a height unit", {default: ""}, custom => {
      this.options.add(new Option(custom, custom, false, true));
      lock("heightUnit");
    });
  }

  function changeHeightExponent() {
    calculateTemperatures();
    if (layerIsOn("toggleTemp")) drawTemp();
  }

  function changeTemperatureScale() {
    if (layerIsOn("toggleTemp")) drawTemp();
  }

  function changePopulationRate() {
    populationRate = +this.value;
  }

  function changeUrbanizationRate() {
    urbanization = +this.value;
  }

  function changeUrbanDensity() {
    urbanDensity = +this.value;
  }

  function restoreDefaultUnits() {
    distanceScale = 3;
    byId("distanceScaleInput").value = distanceScale;
    unlock("distanceScale");

    // units
    const US = navigator.language === "en-US";
    const UK = navigator.language === "en-GB";
    distanceUnitInput.value = US || UK ? "mi" : "km";
    heightUnit.value = US || UK ? "ft" : "m";
    temperatureScale.value = US ? "°F" : "°C";
    areaUnit.value = "square";
    localStorage.removeItem("distanceUnit");
    localStorage.removeItem("heightUnit");
    localStorage.removeItem("temperatureScale");
    localStorage.removeItem("areaUnit");
    calculateFriendlyGridSize();

    // height exponent
    heightExponentInput.value = 1.8;
    localStorage.removeItem("heightExponent");
    calculateTemperatures();

    renderScaleBar();

    // population
    populationRate = populationRateInput.value = 1000;
    urbanization = urbanizationInput.value = 1;
    urbanDensity = urbanDensityInput.value = 10;
    localStorage.removeItem("populationRate");
    localStorage.removeItem("urbanization");
    localStorage.removeItem("urbanDensity");
  }

  function addRuler() {
    if (!layerIsOn("toggleRulers")) toggleRulers();
    const pt = byId("map").createSVGPoint();
    (pt.x = graphWidth / 2), (pt.y = graphHeight / 4);
    const p = pt.matrixTransform(viewbox.node().getScreenCTM().inverse());
    const dx = graphWidth / 4 / scale;
    const dy = (rulers.data.length * 40) % (graphHeight / 2);
    const from = [(p.x - dx) | 0, (p.y + dy) | 0];
    const to = [(p.x + dx) | 0, (p.y + dy) | 0];
    rulers.create(Ruler, [from, to]).draw();
  }

  function toggleOpisometerMode() {
    if (this.classList.contains("pressed")) {
      restoreDefaultEvents();
      clearMainTip();
      this.classList.remove("pressed");
    } else {
      if (!layerIsOn("toggleRulers")) toggleRulers();
      tip("Draw a curve to measure length. Hold Shift to disallow path optimization", true);
      unitsBottom.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
      this.classList.add("pressed");
      viewbox.style("cursor", "crosshair").call(
        d3.drag().on("start", function () {
          const point = d3.mouse(this);
          const opisometer = rulers.create(Opisometer, [point]).draw();

          d3.event.on("drag", function () {
            const point = d3.mouse(this);
            opisometer.addPoint(point);
          });

          d3.event.on("end", function () {
            restoreDefaultEvents();
            clearMainTip();
            addOpisometer.classList.remove("pressed");
            if (opisometer.points.length < 2) rulers.remove(opisometer.id);
            if (!d3.event.sourceEvent.shiftKey) opisometer.optimize();
          });
        })
      );
    }
  }

  function toggleRouteOpisometerMode() {
    if (this.classList.contains("pressed")) {
      restoreDefaultEvents();
      clearMainTip();
      this.classList.remove("pressed");
    } else {
      if (!layerIsOn("toggleRulers")) toggleRulers();
      tip("Draw a curve along routes to measure length. Hold Shift to measure away from roads.", true);
      unitsBottom.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
      this.classList.add("pressed");

      viewbox.style("cursor", "crosshair").call(
        d3.drag().on("start", function () {
          const cells = pack.cells;
          const burgs = pack.burgs;
          const point = d3.mouse(this);
          const c = findCell(point[0], point[1]);

          if (Routes.isConnected(c) || d3.event.sourceEvent.shiftKey) {
            const b = cells.burg[c];
            const x = b ? burgs[b].x : cells.p[c][0];
            const y = b ? burgs[b].y : cells.p[c][1];
            const routeOpisometer = rulers.create(RouteOpisometer, [[x, y]]).draw();

            d3.event.on("drag", function () {
              const point = d3.mouse(this);
              const c = findCell(point[0], point[1]);
              if (Routes.isConnected(c) || d3.event.sourceEvent.shiftKey) {
                routeOpisometer.trackCell(c, true);
              }
            });

            d3.event.on("end", function () {
              restoreDefaultEvents();
              clearMainTip();
              addRouteOpisometer.classList.remove("pressed");
              if (routeOpisometer.points.length < 2) {
                rulers.remove(routeOpisometer.id);
              }
            });
          } else {
            restoreDefaultEvents();
            clearMainTip();
            addRouteOpisometer.classList.remove("pressed");
            tip("Must start in a cell with a route in it", false, "error");
          }
        })
      );
    }
  }

  function togglePlanimeterMode() {
    if (this.classList.contains("pressed")) {
      restoreDefaultEvents();
      clearMainTip();
      this.classList.remove("pressed");
    } else {
      if (!layerIsOn("toggleRulers")) toggleRulers();
      tip("Draw a curve to measure its area. Hold Shift to disallow path optimization", true);
      unitsBottom.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
      this.classList.add("pressed");
      viewbox.style("cursor", "crosshair").call(
        d3.drag().on("start", function () {
          const point = d3.mouse(this);
          const planimeter = rulers.create(Planimeter, [point]).draw();

          d3.event.on("drag", function () {
            const point = d3.mouse(this);
            planimeter.addPoint(point);
          });

          d3.event.on("end", function () {
            restoreDefaultEvents();
            clearMainTip();
            addPlanimeter.classList.remove("pressed");
            if (planimeter.points.length < 3) rulers.remove(planimeter.id);
            else if (!d3.event.sourceEvent.shiftKey) planimeter.optimize();
          });
        })
      );
    }
  }

  function removeAllRulers() {
    if (!rulers.data.length) return;
    alertMessage.innerHTML = /* html */ ` Are you sure you want to remove all placed rulers?
      <br />If you just want to hide rulers, toggle the Rulers layer off in Menu`;
    $("#alert").dialog({
      resizable: false,
      title: "Remove all rulers",
      buttons: {
        Remove: function () {
          $(this).dialog("close");
          rulers.undraw();
          rulers = new Rulers();
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }
}
